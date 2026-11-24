// The bundled CLI runs from any repo: under "type": "module", "type": "commonjs", and via symlink.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../src/cli/run';
import { tempDir } from './helpers';

const REPO = join(import.meta.dirname, '..');
const FIXTURE_SPEC = join(REPO, 'fixtures/chat-mini/spec');
let tmp = '';
let pluginBuild = '';
// What git reports for tracked files before and after the isolated build (INS-014/S14).
let trackedBefore = '';
let trackedAfter = '';
// Modified tracked files are compared by name and content hash, not by a full diff: an uncommitted
// rebuilt bundle makes `git diff` larger than execFileSync's output buffer.
const trackedState = (): string => {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' });
  const modified = execFileSync('git', ['diff', '--name-only', '--diff-filter=d'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter((path) => path !== '');
  const hashes = modified.length === 0 ? '' : execFileSync('git', ['hash-object', '--', ...modified], { cwd: REPO, encoding: 'utf8' });
  return status + modified.join('\n') + '\n' + hashes;
};

function filesUnder(root: string, prefix = ''): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix === '' ? entry.name : prefix + '/' + entry.name;
    return entry.isDirectory() ? filesUnder(join(root, entry.name), rel) : [rel];
  }).sort();
}

/** The tool names a hook group's matcher lists, sorted; the order the plugin writes them in is its own. */
const matcherTools = (matcher: string | undefined): string[] => (matcher ?? '').split('|').sort();

interface HookGroup { matcher?: string; hooks: { type?: string; command: string; timeout?: number }[] }
interface HooksFile { hooks: Record<string, HookGroup[] | undefined> }
const readHooks = (): HooksFile => JSON.parse(readFileSync(join(REPO, 'plugin/hooks/hooks.json'), 'utf8')) as HooksFile;
/** The one group under `event` whose command runs the hook `name`. */
function groupFor(hooks: HooksFile, event: string, name: string): HookGroup | undefined {
  const groups = (hooks.hooks[event] ?? []).filter((group) => group.hooks.some((h) => h.command.endsWith(`hook claude-code ${name}`)));
  expect(groups, `${event} groups running ${name}`).toHaveLength(1);
  return groups[0];
}

const install = (dir: string, type: string | null) => {
  const scripts = join(dir, '.claude/skills/chat-spec/scripts');
  mkdirSync(scripts, { recursive: true });
  if (type) writeFileSync(join(dir, 'package.json'), JSON.stringify({ type }));
  cpSync(join(REPO, 'dist/spec'), join(scripts, 'spec'));
  cpSync(join(REPO, 'dist/spec.cjs'), join(scripts, 'spec.cjs'));
  return join(scripts, 'spec');
};

describe('dist/spec', () => {
  beforeAll(() => {
    tmp = tempDir('spec-dist-');
    pluginBuild = join(tmp, 'plugin-output');
    trackedBefore = trackedState();
    execFileSync(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build.ts', '--out', pluginBuild], { cwd: REPO });
    trackedAfter = trackedState();
  }, 60_000);
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  for (const type of ['module', 'commonjs', null]) {
    it(`runs in a repo with package.json type ${String(type)}`, () => {
      const bin = install(join(tmp, String(type)), type);
      expect(execFileSync(bin, ['--version'], { encoding: 'utf8' })).toMatch(/^spec \d+\.\d+\.\d+\n$/);
    });
  }

  it('runs through a symlink', () => {
    const bin = install(join(tmp, 'linked'), null);
    const link = join(tmp, 'spec-link');
    symlinkSync(bin, link);
    expect(execFileSync(link, ['--version'], { encoding: 'utf8' })).toMatch(/^spec /);
  });

  it("finds the spec root through the skill folder's skill.json", () => {
    const dir = join(tmp, 'installed');
    const bin = install(dir, 'module');
    cpSync(FIXTURE_SPEC, join(dir, 'spec'), { recursive: true });
    writeFileSync(join(dir, '.claude/skills/chat-spec/skill.json'), JSON.stringify({ specRoot: 'spec' }));
    const out = execFileSync(bin, ['show', 'PRV-002/S3'], { encoding: 'utf8', cwd: tmp });
    expect(out).toContain('### S3: Fallback provider also rate-limits');
  });

  it('still finds an older install whose spec sits inside the skill folder', () => {
    const dir = join(tmp, 'older');
    const bin = install(dir, null);
    cpSync(FIXTURE_SPEC, join(dir, '.claude/skills/chat-spec'), { recursive: true });
    expect(execFileSync(bin, ['show', 'PRV-002/S3'], { encoding: 'utf8', cwd: tmp })).toContain('### S3:');
  });

  it('INS-014/S14 Build output can be compared without changing the repository', () => {
    const generated = filesUnder(pluginBuild);
    // The plugin and its docs are written; nothing else, and no marketplace manifest (INS-019/R1).
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.filter((path) => !path.startsWith('plugin/'))).toEqual([]);
    expect(generated).toContain('plugin/.claude-plugin/plugin.json');
    expect(generated).toContain('plugin/docs/WORKFLOW.md');
    expect(existsSync(join(pluginBuild, '.claude-plugin/marketplace.json'))).toBe(false);
    const committed = filesUnder(join(REPO, 'plugin')).map((path) => 'plugin/' + path);
    expect(generated).toEqual(committed);
    for (const path of generated) expect(readFileSync(join(pluginBuild, path)), path).toEqual(readFileSync(join(REPO, path)));
    expect(trackedAfter).toBe(trackedBefore);
  });

  it('INS-015/S33 Spec-init asks for a bypass before authoring on the enforced base: spec-init asks for approval before writing initial spec files', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec-init/SKILL.md'), 'utf8');
    expect(skill).toContain('Before writing any initial spec files on an enforced base checkout, ask the person whether to open a bypass.');
    expect(skill).toContain('do not write files until they approve.');
  });

  it('INS-015/S33/S2 spec-init explains the one-hour expiry and reopening after it expires', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec-init/SKILL.md'), 'utf8');
    expect(skill).toContain('one hour');
    expect(skill).toContain('If the hour expires before authoring is complete, stop and ask the person to open a new bypass before writing more.');
  });

  it('INS-015/S33/S3 spec-init asks to reopen after the one governed commit is consumed', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec-init/SKILL.md'), 'utf8');
    expect(skill).toContain('one governed base-branch commit');
    expect(skill).toContain('If that commit is consumed before setup is complete, stop and ask the person to open a new bypass before writing more.');
  });

  it('INS-014/S17 Namespaces command tokens without rewriting feature paths', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec-init/SKILL.md'), 'utf8');
    expect(skill).toContain('`modules/<module>/features/<ID>-<slug>.md`');
    expect(skill).toContain('modules/<module>/features/<ID>-<slug>.md');
    expect(skill).toContain('/spec:feature`');
    expect(skill).not.toContain('modules/<module>/spec:features/');
  });

  it('builds the plugin manifest, bundles and skills', () => {
    const plugin = JSON.parse(readFileSync(join(REPO, 'plugin/.claude-plugin/plugin.json'), 'utf8')) as Record<string, unknown>;
    expect(plugin).toMatchObject({ name: 'spec' });
    expect(plugin).not.toHaveProperty('version');
    for (const file of ['spec', 'spec.cjs']) {
      expect(readFileSync(join(REPO, 'plugin/scripts', file))).toEqual(readFileSync(join(REPO, 'dist', file)));
    }
    expect(statSync(join(REPO, 'plugin/scripts/spec')).mode & 0o777).toBe(0o755);
    for (const command of ['feature', 'change', 'bug', 'spec-init']) {
      const skill = readFileSync(join(REPO, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('Bash(.spec/bin/spec *)');
      expect(skill).toContain('this project');
      expect(skill).not.toMatch(/\{(cli|project|interview|ask)\}/);
    }
    const brief = readFileSync(join(REPO, 'plugin/skills/brief/SKILL.md'), 'utf8');
    expect(brief).toContain('exec .spec/bin/spec brief --stdin');
    expect(brief).toContain('ask Claude to run `/spec:spec` to set up this project');
    expect(brief).not.toContain('if [ ! -x');
    expect(brief).not.toContain('${CLAUDE_SKILL_DIR}');
    const hooks = readHooks();
    expect(Object.keys(hooks.hooks).sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionStart', 'SubagentStart', 'SubagentStop']);
    expect(hooks.hooks.SessionStart?.[0]).toMatchObject({ matcher: 'startup|resume|compact', hooks: [{ command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code session-start' }] });
    const before = groupFor(hooks, 'PreToolUse', 'before-edit');
    expect(before).toMatchObject({ hooks: [{ command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code before-edit' }] });
    expect(matcherTools(before?.matcher)).toEqual(['Bash', 'Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
    expect(hooks.hooks.PostToolUse?.[0]).toMatchObject({ matcher: 'Edit|Write|MultiEdit', hooks: [{ command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code after-edit' }] });
  });

  it('INS-014/S2 The plugin manifest carries no version', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string };
    for (const root of [REPO, pluginBuild]) {
      const plugin = JSON.parse(readFileSync(join(root, 'plugin/.claude-plugin/plugin.json'), 'utf8')) as Record<string, unknown>;
      expect(plugin.name, root).toBe('spec');
      expect(typeof plugin.description, root).toBe('string');
      expect(String(plugin.description).length, root).toBeGreaterThan(0);
      expect(Object.hasOwn(plugin, 'version'), root + ' has no version key').toBe(false);
    }
    expect(execFileSync(join(REPO, 'dist/spec'), ['--version'], { encoding: 'utf8' })).toBe(`spec ${pkg.version}\n`);
  });

  it('INS-019/S1 This repository publishes no marketplace', () => {
    expect(existsSync(join(REPO, '.claude-plugin/marketplace.json'))).toBe(false);
    expect(execFileSync('git', ['ls-files', '--', '.claude-plugin/marketplace.json'], { cwd: REPO, encoding: 'utf8' })).toBe('');
    expect(existsSync(join(pluginBuild, '.claude-plugin/marketplace.json'))).toBe(false);
    const manifests = filesUnder(pluginBuild).filter((path) => path.endsWith('.json') && (path.includes('.claude-plugin/') || /(^|\/)marketplace\.json$/.test(path)));
    expect(manifests).toEqual(['plugin/.claude-plugin/plugin.json']);
  });

  it('INS-019/S2 Setup and the docs say how to install and keep spec up to date', () => {
    const docs: Record<string, string> = {
      'plugin/skills/spec/SKILL.md': readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8'),
      'README.md': readFileSync(join(REPO, 'README.md'), 'utf8'),
      'docs/WORKFLOW.md': readFileSync(join(REPO, 'docs/WORKFLOW.md'), 'utf8'),
    };
    for (const [name, text] of Object.entries(docs)) {
      expect(text, name).toContain('/plugin marketplace add happyfacedev/happyface-plugins');
      expect(text, name).toContain('/plugin install spec@happyface');
      expect(text, name).toContain('claude plugin install spec@happyface --scope project');
      expect(text, name).toMatch(/auto-update/i);
      expect(text, name).toContain('Marketplaces > happyface');
      expect(text, name).toContain('autoUpdate');
      expect(text, name).toMatch(/managed settings/i);
      expect(text, name).not.toMatch(/marketplace add (https:\/\/github\.com\/)?happyfacedev\/spec(?![\w-])/);
      expect(text, name).not.toMatch(/install spec@spec(?![\w-])/);
    }
  });

  it('INS-014/S15 This repository pins its own CLI without duplicate plugin hooks', () => {
    const settings = JSON.parse(readFileSync(join(REPO, '.claude/settings.json'), 'utf8')) as { enabledPlugins: Record<string, boolean>; hooks: Record<string, { hooks: { command: string }[] }[]> };
    expect(settings.enabledPlugins['spec@happyface']).toBe(false);
    for (const groups of Object.values(settings.hooks)) {
      for (const group of groups) for (const hook of group.hooks) expect(hook.command).toContain('"$CLAUDE_PROJECT_DIR"/.spec/bin/spec hook claude-code');
    }
    const config = JSON.parse(readFileSync(join(REPO, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
    expect(config.afterMerge).toBeUndefined();
    for (const file of ['spec', 'spec.cjs']) {
      expect(execFileSync('git', ['ls-files', '--error-unmatch', '.spec/bin/' + file], { cwd: REPO, encoding: 'utf8' }).trim()).toBe('.spec/bin/' + file);
      expect(readFileSync(join(REPO, '.spec/bin', file))).toEqual(readFileSync(join(REPO, 'plugin/scripts', file)));
    }
  });

  it('INS-014/S3 The plugin bundle is built and committed', () => {
    for (const file of ['spec', 'spec.cjs']) expect(readFileSync(join(REPO, 'plugin/scripts', file))).toEqual(readFileSync(join(REPO, 'dist', file)));
    expect(statSync(join(REPO, 'plugin/scripts/spec')).mode & 0o777).toBe(0o755);
  });

  it('INS-014/S4 The plugin registers the active hooks', () => {
    const hooks = readHooks();
    expect(Object.keys(hooks.hooks).sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionStart', 'SubagentStart', 'SubagentStop']);
    expect(hooks.hooks.SessionStart).toEqual([{ matcher: 'startup|resume|compact', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code session-start' }] }]);
    expect(hooks.hooks.PostToolUse).toEqual([{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code after-edit' }] }]);
    const before = groupFor(hooks, 'PreToolUse', 'before-edit');
    expect(before).toMatchObject({ hooks: [{ command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code before-edit' }] });
    expect(matcherTools(before?.matcher)).toEqual(['Bash', 'Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
    // Each new hook has a group of its own (INS-020/S14).
    for (const [event, name] of [['PreToolUse', 'before-agent'], ['PreToolUse', 'before-handback'], ['SubagentStart', 'subagent-start'], ['SubagentStop', 'subagent-stop']] as const) {
      const group = groupFor(hooks, event, name);
      expect(group, name).toBeDefined();
      expect(group?.hooks, name).toHaveLength(1);
    }
  });

  it('INS-020/S14 The plugin registers the four hooks with long timeouts', () => {
    const hooks = readHooks();
    const pre = hooks.hooks.PreToolUse ?? [];
    const agent = groupFor(hooks, 'PreToolUse', 'before-agent');
    expect(agent?.matcher).toBe('Agent|Task');
    expect(agent?.hooks).toHaveLength(1);
    expect(agent?.hooks[0]?.command).toMatch(/hook claude-code before-agent$/);
    expect(agent?.hooks[0]?.timeout).toBe(1800);
    const handback = groupFor(hooks, 'PreToolUse', 'before-handback');
    expect(handback?.matcher).toBe('SubagentHandback');
    expect(handback?.hooks).toHaveLength(1);
    expect(handback?.hooks[0]?.command).toMatch(/hook claude-code before-handback$/);
    expect(handback?.hooks[0]?.timeout).toBe(3600);
    // Separate from the unchanged before-edit group.
    const edit = groupFor(hooks, 'PreToolUse', 'before-edit');
    expect(matcherTools(edit?.matcher)).toEqual(['Bash', 'Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
    expect(edit?.hooks).toEqual([{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code before-edit' }]);
    expect(new Set([agent, handback, edit]).size).toBe(3);
    expect(pre).toHaveLength(3);
    const stop = hooks.hooks.SubagentStop ?? [];
    expect(stop).toHaveLength(1);
    expect(stop[0]?.matcher ?? '').toBe('');
    expect(stop[0]?.hooks).toHaveLength(1);
    expect(stop[0]?.hooks[0]?.command).toMatch(/hook claude-code subagent-stop$/);
    expect(stop[0]?.hooks[0]?.timeout).toBe(3600);
    const start = hooks.hooks.SubagentStart ?? [];
    expect(start).toHaveLength(1);
    expect(start[0]?.matcher ?? '').toBe('');
    expect(start[0]?.hooks).toHaveLength(1);
    expect(start[0]?.hooks[0]?.command).toMatch(/hook claude-code subagent-start$/);
    expect(start[0]?.hooks[0]).not.toHaveProperty('timeout');
    // SessionStart and PostToolUse are as INS-014/S4 says.
    expect(hooks.hooks.SessionStart).toEqual([{ matcher: 'startup|resume|compact', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code session-start' }] }]);
    expect(hooks.hooks.PostToolUse).toEqual([{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/spec" hook claude-code after-edit' }] }]);
  });

  it('INS-016/S16 A write outside every ticket worktree, or without edit enforcement, runs as before: the plugin runs before-edit for the Bash tool as well', () => {
    const hooks = JSON.parse(readFileSync(join(REPO, 'plugin/hooks/hooks.json'), 'utf8')) as { hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]> };
    const before = (hooks.hooks.PreToolUse ?? []).filter((group) => group.hooks.some((h) => h.command.endsWith('hook claude-code before-edit')));
    expect(before).toHaveLength(1);
    expect(matcherTools(before[0]?.matcher)).toEqual(['Bash', 'Edit', 'MultiEdit', 'NotebookEdit', 'Write']);
  });

  it('INS-010/S11 Registered on the edit tools by the plugin', () => {
    const hooks = JSON.parse(readFileSync(join(REPO, 'plugin/hooks/hooks.json'), 'utf8')) as { hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]> };
    const group = hooks.hooks.PostToolUse?.[0];
    expect(group?.matcher).toBe('Edit|Write|MultiEdit');
    expect(group?.hooks[0]?.command).toMatch(/hook claude-code after-edit$/);
  });

  it('INS-014/S5 Plugin command skills are generated for the project', () => {
    for (const command of ['feature', 'change', 'bug', 'spec-init', 'run']) {
      const skill = readFileSync(join(REPO, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('Bash(.spec/bin/spec *)');
      expect(skill).toContain('this project');
      expect(skill).not.toMatch(/\{(cli|project|interview|ask|drive)\}/);
      if (['feature', 'change', 'bug', 'run'].includes(command)) expect(skill).toContain('## Driving a ticket');
    }
  });

  it('INS-014/S6 The brief skill uses the project CLI', () => {
    const brief = readFileSync(join(REPO, 'plugin/skills/brief/SKILL.md'), 'utf8');
    expect(brief).toContain('exec .spec/bin/spec brief --stdin');
    expect(brief).toContain('argument-hint: [<spec-writer|spec-review|tester|implementer|reviewer>]');
    expect(brief).toContain('ask Claude to run `/spec:spec` to set up this project');
    expect(brief).not.toContain('if [ ! -x');
    expect(brief).not.toContain('${CLAUDE_SKILL_DIR}');
  });

  it('PIP-015/S22 The generated brief skill advertises only stage roles', () => {
    const brief = readFileSync(join(pluginBuild, 'plugin/skills/brief/SKILL.md'), 'utf8');
    expect(brief).toContain('argument-hint: [<spec-writer|spec-review|tester|implementer|reviewer>] <ID> | <question words>');
    expect(brief).not.toMatch(/^argument-hint:.*overseer/m);
  });

  it('INS-012/S28 Plugin skills allow the command they inject', () => {
    for (const name of ['brief', 'feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(REPO, 'plugin/skills', name, 'SKILL.md'), 'utf8');
      const allowed = skill.split('\n').find((line) => line.startsWith('allowed-tools:')) ?? '';
      expect(allowed.endsWith('Bash(exec .spec/bin/spec brief --stdin *)'), name).toBe(true);
      expect(skill).toContain('exec .spec/bin/spec brief --stdin');
    }
  });

  it('INS-014/S7 and S21 Setup resolves the plugin registry and Astro runs command-skill fallbacks', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('read `~/.claude/plugins/installed_plugins.json`');
    expect(setup).toContain('plugins["spec@happyface"]');
    expect(setup).toContain('"<installPath>/scripts/spec" detect --format json');

    const feature = readFileSync(join(pluginBuild, 'plugin/skills/feature/SKILL.md'), 'utf8');
    expect(feature).toContain('if the harness does not run');
    expect(feature).toContain('run `.spec/bin/spec brief --stdin` yourself with the user request as stdin');

    const specInit = readFileSync(join(pluginBuild, 'plugin/skills/spec-init/SKILL.md'), 'utf8');
    expect(specInit).toContain('run `.spec/bin/spec gaps --no-tests` yourself');
  });

  it('INS-014/S22 Existing installs require every missing active-harness model', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('For a detected `spec` or `legacy-spec` state, do not reinstall.');
    expect(skill).toContain('detect.missingModels');
    expect(skill).toContain('does not continue until each has a default');
    expect(skill).toContain('If `detect.harness` is null, ask which current harness first; because detection cannot list missing roles for an unknown harness, then treat all four stage roles as missing and ask for each');
    expect(skill).not.toContain('offer the model-selection step');
  });

  it('INS-014/S23 Model choices are explicit and local overrides stay local', () => {
    const setup = readFileSync(join(REPO, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('offer exactly `sonnet`, `opus`, `haiku` or `fable`');
    expect(setup).toContain('never offer full model IDs or `inherit`');
    expect(setup).toContain('shared defaults are committed with the install');
    const drive = readFileSync(join(REPO, 'plugin/skills/run/SKILL.md'), 'utf8');
    expect(drive).toContain('delegate(role=<active model>');
    expect(drive).toContain('config set delegation.<harness>.<role> <model> --local');
  });

  it('INS-014/S23 Setup proposes the Claude Code model lists first', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    // The first list setup proposes for each role: model, then effort, best first; spec-review sonnet high is set alongside.
    expect(setup).toMatch(/spec-writer[^\n]*opus[^\n]*medium/);
    expect(setup).toMatch(/tester[^\n]*sonnet[^\n]*high[^\n]*haiku[^\n]*high/);
    expect(setup).toMatch(/implementer[^\n]*opus[^\n]*medium[^\n]*haiku[^\n]*high/);
    expect(setup).toMatch(/reviewer[^\n]*sonnet[^\n]*high/);
    expect(setup).toMatch(/spec-review[^\n]*sonnet[^\n]*high/);
    // A person may take another list or one model, and the choices stay the four aliases.
    expect(setup).toContain('offer exactly `sonnet`, `opus`, `haiku` or `fable`');
    expect(setup).toContain('never offer full model IDs or `inherit`');
  });

  it('INS-014/S25 Setup establishes a deliberate project test baseline', async () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('which stack is the app');
    expect(setup).toContain('vitest or jest');
    expect(setup).toContain('npm install --save-dev vitest');
    expect(setup).toContain('npm install --save-dev jest');
    expect(setup).toContain('one trivial passing test');
    expect(setup).toContain('no tests yet');
    expect(setup).toContain('fix first');
    expect(setup).toContain('known-failing ticket');
    expect(setup).toContain('blocks every other ticket until fixed');
    expect(setup).toContain('stop');

    const multiple = mkdtempSync(join(tmp, 'multi-stack-'));
    writeFileSync(join(multiple, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^5.0.0' } }));
    writeFileSync(join(multiple, 'pubspec.yaml'), 'name: mobile_app\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const out = await run({ argv: ['detect', '--format', 'json'], cwd: multiple, env: {}, scriptPath: undefined });
    const detected = JSON.parse(out.stdout) as { stacks: { name: string }[] };
    expect(detected.stacks.map((stack) => stack.name)).toContain('node');
    expect(detected.stacks.map((stack) => stack.name)).toContain('flutter');
  });

  it('INS-014/S27 Setup description and day-to-day routing cover user requests', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    const description = setup.match(/^description: (.+)$/m)?.[1] ?? '';
    for (const trigger of ['set up spec', 'start a new project with spec', 'questions about spec', 'add a feature', 'change behaviour', 'check tickets', 'what does the spec say']) {
      expect(description).toContain(trigger);
    }
    expect(setup).toContain('`/spec:feature`');
    expect(setup).toContain('`/spec:change`');
    expect(setup).toContain('decisions, invariants and glossary');
    expect(setup).toContain('tests-only requests');
    expect(setup).toContain('task ticket via `/spec:change`');
    expect(setup).toContain('`/spec:run`');
    expect(setup).toContain('`/spec:brief`');
  });

  it('INS-014/S38 Generated command skills resolve missing models locally before delegation', () => {
    for (const command of ['feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('entry.missingModels');
      expect(skill).toContain('Only ask for a model when `entry.missingModels` contains that role');
      expect(skill).toContain('Use `entry.model` when it is set and valid');
      // On Claude Code the entry's effort goes with the model when it is set and valid.
      expect(skill).toContain('entry.effort');
      expect(skill).toContain('Never ask merely because a stage is being delegated');
      expect(skill).toContain('config set delegation.<harness>.<role> <model> --local');
      expect(skill).toContain('use its saved value for the active role');
    }
  });

  it('INS-014/S26 Generated command skills use safe harness, report, and refusal instructions', () => {
    for (const command of ['feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('model: <active model>');
      expect(skill).not.toContain('model: entry.model');
      expect(skill).toContain('prompt: entry.task');
      expect(skill).not.toContain('task: entry.task');
      expect(skill).toContain('run_in_background');
      expect(skill).toContain('`run_in_background` for parallel work only when `editMode` is "acceptEdits"');
      // The final message goes, with the file tool, to the report path entry.advance already names; never a scratch folder or mktemp.
      const saveLine = skill.split('\n').find((line) => line.includes('final message') && line.includes('entry.advance')) ?? '';
      expect(saveLine, 'a line that writes the final message to the path in entry.advance').not.toBe('');
      expect(saveLine).toContain('file tool');
      const driving = skill.slice(Math.max(0, skill.indexOf('## Driving a ticket')));
      expect(skill).toContain('## Driving a ticket');
      expect(skill).not.toContain('mktemp');
      expect(driving).not.toMatch(/scratch dir/i);
      expect(skill).toContain('Run `entry.advance` from the project root');
      expect(skill).not.toContain('cd into the worktree');
      expect(skill).not.toContain('cd there');
      expect(skill).not.toContain('entry.advanceRelative');
      expect(skill).not.toContain('entry.cwd');
      expect(skill).toContain('exit 1 on a gate question is normal');
      expect(skill).toContain('third refusal');
      expect(skill).toContain('blocks the ticket');
      expect(skill).toContain('stash');
      expect(skill).toContain('next <ID> --restart');
      expect(skill).toContain('confirm no subagent is still running');
      expect(skill).toContain('restores the stage\'s stash');
      expect(skill).toContain('full delegate entry');
      // This relay is for Astro and for a Claude Code project whose CLI refuses the before-agent event (INS-020/R13).
      expect(skill).toContain('hook claude-code before-agent');
      expect(skill).toContain('unknown hook event before-agent');
      expect(skill).toContain('Astro');
    }
  });

  /**
   * What the failed-launch bullet of a driving skill gets wrong, as a list of problems (empty when it is right). The bullet is
   * the line that gives the command that marks a model; its clauses are matched loosely, a sentence at a time.
   */
  function failedLaunchProblems(skill: string): string[] {
    const bullet = skill.split('\n').find((line) => /unavailableModels\.<model> true --local/.test(line));
    if (bullet === undefined) return ['no bullet gives the command that marks a model'];
    const problems: string[] = [];
    const sentences = bullet.split(/\.\s+/);
    const marking = sentences.find((sentence) => /unavailableModels\.<model> true --local/.test(sentence)) ?? '';
    const need = (sentence: string, pattern: RegExp, what: string) => {
      if (!pattern.test(sentence)) problems.push(what);
    };
    // Mark only once no subagent runs the stage and Claude Code's own error names the model the denial names; then restart and say how to unmark.
    need(marking, /confirm/i, 'mark only once it is confirmed');
    need(marking, /no subagent/i, 'mark only once no subagent runs the stage');
    need(marking, /error[^.]*\bnames?\b[^.]*\bsame model\b/i, "mark only when Claude Code's error names that same model");
    need(marking, /next <ID> --restart/, 'then restart the stage');
    need(marking, /person/i, 'tell the person');
    need(marking, /unavailableModels\.<model> false --local/, 'say how to unmark');
    // Any other failure marks nothing and goes to the person.
    const nothing = sentences.find((sentence) => /usage limit/i.test(sentence)) ?? '';
    need(nothing, /another model/i, 'a different model marks nothing');
    need(nothing, /\bnone\b/i, 'an error naming no model marks nothing');
    need(nothing, /usage limit/i, 'a usage limit marks nothing');
    need(nothing, /outage/i, 'an outage marks nothing');
    need(nothing, /any other failure/i, 'any other failure marks nothing');
    need(nothing, /mark nothing|do not mark|never mark/i, 'it marks nothing');
    need(nothing, /person/i, 'the failure goes to the person');
    return problems;
  }

  it('INS-020/S26 Command skills close a failed launch and tell the person which models are marked', () => {
    for (const command of ['feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      // The failed-launch bullet itself says all of it.
      expect(failedLaunchProblems(skill), command).toEqual([]);
      // The matcher fails on a skill without that bullet, and on one whose bullet marks when it should not.
      const bullet = skill.split('\n').find((line) => /unavailableModels\.<model> true --local/.test(line)) ?? '';
      const without = skill.split('\n').filter((line) => line !== bullet).join('\n');
      expect(failedLaunchProblems(without), `${command}: bullet deleted`).not.toEqual([]);
      const altered = (from: RegExp, to: string) => {
        const changed = bullet.replace(from, () => to);
        expect(changed, `${command}: the alteration applies`).not.toBe(bullet);
        return skill.replace(bullet, () => changed);
      };
      expect(failedLaunchProblems(altered(/mark nothing/, 'mark the model')), `${command}: marks on a usage limit`).not.toEqual([]);
      expect(failedLaunchProblems(altered(/, and only when [^,]*same model[^,]*,/, ',')), `${command}: marks whatever the error names`).not.toEqual([]);
      expect(failedLaunchProblems(altered(/confirmed no subagent is still running it/, 'looked')), `${command}: marks without confirming`).not.toEqual([]);
      expect(failedLaunchProblems(altered(/ or is a usage limit, an outage/, ',')), `${command}: no word on a usage limit`).not.toEqual([]);
      // When nothing can start the person is told which models are marked and how to unmark one.
      expect(skill, command).toContain('marked unavailable');
      expect(skill, command).toMatch(/unavailableModels\.<model> false/);
    }
  });

  it('INS-020/S16 Driving skills delegate a restarted stage with the entry\'s model and effort', () => {
    for (const command of ['feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill, command).toContain('entry.effort');
      expect(skill, command).toContain('--restart');
    }
  });

  it('INS-020/S15 Driving on Claude Code loops on the stage request', () => {
    for (const command of ['feature', 'change', 'bug', 'run']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      // Probe the pinned CLI before the first delegation, then send stage requests to a general-purpose subagent.
      expect(skill, command).toContain('.spec/bin/spec hook claude-code before-agent');
      expect(skill, command).toMatch(/empty stdin/i);
      expect(skill, command).toContain('general-purpose');
      expect(skill, command).toContain('spec:<ID>');
      // Each refusal's reason is followed.
      expect(skill, command).toContain('ticket answer');
      expect(skill, command).toContain('config set');
      expect(skill, command).toContain('--local');
      expect(skill, command).toContain('spec merge <ID>');
      // Background and foreground follow editMode; an old CLI or Astro relays.
      expect(skill, command).toContain('`editMode`');
      expect(skill, command).toContain('unknown hook event before-agent');
      expect(skill, command).toContain('Astro');
    }
    const runSkill = readFileSync(join(pluginBuild, 'plugin/skills/run/SKILL.md'), 'utf8');
    expect(runSkill).toContain('spec next --summary');
  });

  it('INS-014/S24 Setup preserves role guidance and explains routine limits', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    const writer = readFileSync(join(REPO, 'roles/spec-writer.md'), 'utf8');
    expect(setup).toContain('bloc_test');
    expect(setup).toContain('mocktail');
    expect(setup).toContain('fake_async');
    expect(setup).toContain('code generation once');
    expect(setup).toContain('SPEC-STUB');
    expect(setup).toContain('spec queue');
    expect(setup).toContain('spec gate <ID>');
    expect(setup).toContain('spec next <ID> --restart');
    expect(setup).toContain('confirm no subagent is running');
    expect(setup).toContain('.spec/bin/spec upgrade');
    expect(setup).toContain('--update-roles');
    expect(setup).toContain('Never change anything outside a ticket');
    expect(writer).toContain('The spec says what the product does, never how it is built');
    expect(writer).toContain('no class, function, file, package, framework, state-management or storage names');

  });

  it('INS-014/S31 Setup conditions base-branch protection on enforcement', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('`.claude/settings.local.json` `permissions.defaultMode` to `acceptEdits`');
    expect(setup).toContain('also changes your own main session in this project');
    expect(setup).toContain('edits stay scoped to the project and its worktrees');
    expect(setup).toContain('when `.spec/bin/spec verify-history` exists');
    expect(setup).toContain('before-edit hook and Git hooks guard the base branch');
  });

  it('INS-014/S32 Setup warns when enforcement is absent', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('if `.spec/bin/spec verify-history` does not exist');
    expect(setup).toContain('base-branch edits are not blocked');
    expect(setup).toContain('ask the person before editing there');
  });

  it('INS-014/S20 Setup uses the pinned bypass and handles older CLIs', () => {
    const skill = readFileSync(join(REPO, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('.spec/bin/spec bypass "spec setup"');
    expect(skill).toContain('unknown command bypass');
    expect(skill).toContain('commits normally');
  });

  it('INS-001/S28 Python virtual environment setup is optional', () => {
    const skill = readFileSync(join(REPO, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('Python virtual environments are optional');
    expect(skill).toContain('no default worktree setup');
  });

  it('INS-014/S7 Setup resolves the bootstrap CLI from the scoped plugin registry', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('allowed-tools: Read, Bash(.spec/bin/spec *)');
    expect(skill).not.toContain('Bash(printf *)');
    expect(skill).not.toContain('Bash(node -e *)');
    expect(skill).not.toContain('```!');
    expect(skill).toContain('read `~/.claude/plugins/installed_plugins.json`');
    // spec@happyface first; spec@spec only when no spec@happyface entry is eligible (R5, R15).
    expect(skill).toContain('plugins["spec@happyface"]');
    expect(skill).toMatch(/spec@spec[^\n]*when no[^\n]*spec@happyface[^\n]*eligible/);
    expect(skill).not.toMatch(/In `plugins\["spec@spec"\]`, keep entries/);
    expect(skill).toContain('scope is `user` or whose `projectPath` resolves to this repository');
    expect(skill).toContain('latest `lastUpdated` (falling back to `installedAt`)');
    expect(skill).toContain('matches `spec upgrade`');
    expect(skill).toContain('"<installPath>/scripts/spec" detect --format json');
    expect(skill).toContain('approve this absolute bootstrap command once');
    expect(skill).toContain('init . --name <slug> --stack <stack>');
    expect(skill).toContain('config set delegation.<harness>.<role> <model>');
    expect(skill).toContain('<installPath>/docs/');
    expect(skill).toContain('.spec/bin/spec');
    expect(skill).not.toContain('Astro follows the same registry lookup');
    expect(skill).not.toContain('${CLAUDE_PLUGIN_ROOT}/docs/');
    expect(skill).not.toContain('Unverified (C8)');
    expect(skill).not.toContain('~/dev/happyface/spec');
    const workflow = readFileSync(join(pluginBuild, 'plugin/docs/WORKFLOW.md'), 'utf8');
    expect(workflow).toContain('spec@happyface');
    expect(workflow).not.toContain('keeps `spec@spec` entries scoped to the user or whose `projectPath` resolves to this repository');
    expect(workflow).toContain('latest `lastUpdated` (falling back to `installedAt`)');
  });

  it('INS-014/S36 Astro asks for its CLI path without a Claude Code install', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('On Astro, if the plugin is not installed for Claude Code, ask the person for the spec CLI path');
    expect(skill).not.toContain('Astro follows the same registry lookup');
    expect(skill).not.toMatch(/Astro[^\n.]*uses the Claude Code registry/);
  });

  it('INS-014/S21 Astro runs skipped command-skill briefs itself', () => {
    const skill = readFileSync(join(pluginBuild, 'plugin/skills/feature/SKILL.md'), 'utf8');
    expect(skill).toContain('Astro');
    expect(skill).toContain('run `.spec/bin/spec brief --stdin` yourself with the user request as stdin');
  });

  it('INS-014/S28 Setup and workflow explain Claude Code project trust', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    const workflow = readFileSync(join(pluginBuild, 'plugin/docs/WORKFLOW.md'), 'utf8');
    expect(setup).toContain('accept the project trust prompt once in an interactive session');
    expect(workflow).toContain('headless runs ignore those project settings until then');
    const trustBullet = /- With project trust accepted[^\n]*/.exec(setup)?.[0] ?? '';
    expect(trustBullet).toContain('permissions.additionalDirectories');
    expect(trustBullet).toContain('.claude/settings.local.json');
    expect(trustBullet).toContain('relative `.spec/bin/spec` command');
    expect(trustBullet).toMatch(/an absolute [^.]*does not match/);
    // The command runs from the project root with --root, because a subagent's cd never carries over; the old "from a ticket worktree" is gone.
    expect(trustBullet).toContain('--root');
    expect(trustBullet).toContain('project root');
    expect(trustBullet).not.toContain('from a ticket worktree');
    // In acceptEdits mode the report file inside the listed worktree parent needs no approval.
    expect(trustBullet).toContain('acceptEdits');
    expect(trustBullet).toContain('report file');
  });

  it('INS-014/S29 Existing specs suggest upgrade when worktree permissions are missing', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('permissions.additionalDirectories');
    expect(setup).toContain('`.spec/bin/spec upgrade .`');
    expect(setup).toContain('do not reinstall');
    const repair = /If [^\n]*?permissions\.additionalDirectories[^\n]*?`\.spec\/bin\/spec upgrade \.`/.exec(setup)?.[0] ?? '';
    expect(repair).toContain('`.claude/settings.local.json`');
    expect(repair).toContain('`.claude/settings.json`');
    expect(repair).toContain('permissions.additionalDirectories');
  });

  it('INS-014/S30 Build-skill commands become scoped Bash permissions', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toContain('ask which commands the skill requires');
    expect(setup).toContain('Bash(<command> *)');
    for (const command of ['dart run build_runner', 'dart format', 'mason make', 'dart tools/fix_part_directives.dart']) {
      expect(setup).toContain(command);
    }
    expect(setup).toContain('preserve existing');
  });

  it('INS-017/S1 Setup skips the edit-mode question when edits are already accepted', () => {
    const setup = readFileSync(join(pluginBuild, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(setup).toMatch(/`editMode`[^\n]*`acceptEdits`[^\n]*skip/i);
    expect(setup).toContain('does not ask about `acceptEdits`');
    expect(setup).toContain('does not run `--accept-edits`');
    expect(setup).toContain('any other value');
    expect(setup).toContain('before setting `acceptEdits`');
    expect(setup).toContain('before-edit hook and Git hooks guard the base branch');
    expect(setup).toContain('base-branch edits are not blocked');
  });

  it('INS-017/S2 Driving warns before backgrounding subagents that cannot edit', () => {
    for (const command of ['run', 'feature', 'change', 'bug']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('.spec/bin/spec detect --format json');
      expect(skill).toContain('`editMode`');
      expect(skill).toContain('"acceptEdits"');
      expect(skill).toContain('background subagents cannot edit ticket worktrees');
      expect(skill).toContain('.spec/bin/spec init . --name <config name> --accept-edits');
      expect(skill).toContain('only after the person agrees');
      expect(skill).toContain('never write `permissions.defaultMode` any other way');
      expect(skill).toContain('in the foreground, one at a time, without `run_in_background`');
      expect(skill).toContain('run_in_background');
      expect(skill).toMatch(/Astro[^\n]*(without the warning|unaffected)/);
    }
  });

  it('INV-008 The reported edit mode never grants an edit', () => {
    for (const command of ['run', 'feature', 'change', 'bug']) {
      const skill = readFileSync(join(pluginBuild, 'plugin/skills', command, 'SKILL.md'), 'utf8');
      expect(skill).toContain('never write `permissions.defaultMode` any other way');
    }
  });

});

// An in-place build rewrites tracked files in the folder it runs in, so it runs in a copy of the
// repository's build inputs, never in this checkout.
describe('in-place build of a copy', () => {
  const STALE_MARKETPLACE = JSON.stringify({ name: 'spec', owner: { name: 'happyfacedev' }, plugins: [{ name: 'spec', source: './plugin' }] }, null, 2) + '\n';
  const copies: string[] = [];
  afterAll(() => {
    for (const copy of copies) rmSync(copy, { recursive: true, force: true });
  });
  const buildInPlace = (setup: (copy: string) => void): string => {
    const copy = tempDir('spec-inplace-build-');
    copies.push(copy);
    for (const path of ['package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'scripts', 'src', 'templates', 'roles', 'plugin', 'docs']) cpSync(join(REPO, path), join(copy, path), { recursive: true });
    symlinkSync(join(REPO, 'node_modules'), join(copy, 'node_modules'));
    setup(copy);
    execFileSync(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build.ts'], { cwd: copy });
    return copy;
  };

  it('INS-019/S3 The in-place build removes only the stale marketplace file', () => {
    const notes = '# Notes\n\nKept by hand, not by the build.\n';
    const copy = buildInPlace((dir) => {
      mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
      writeFileSync(join(dir, '.claude-plugin/marketplace.json'), STALE_MARKETPLACE);
      writeFileSync(join(dir, '.claude-plugin/notes.md'), notes);
    });
    expect(existsSync(join(copy, '.claude-plugin/marketplace.json'))).toBe(false);
    expect(existsSync(join(copy, '.claude-plugin/notes.md')), '.claude-plugin/notes.md is kept').toBe(true);
    expect(readFileSync(join(copy, '.claude-plugin/notes.md'), 'utf8')).toBe(notes);
    expect(statSync(join(copy, '.claude-plugin')).isDirectory()).toBe(true);
  }, 120_000);

  it('INS-019/S4 The in-place build removes a marketplace folder it leaves empty', () => {
    const copy = buildInPlace((dir) => {
      mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
      writeFileSync(join(dir, '.claude-plugin/marketplace.json'), STALE_MARKETPLACE);
    });
    expect(existsSync(join(copy, '.claude-plugin/marketplace.json'))).toBe(false);
    expect(existsSync(join(copy, '.claude-plugin'))).toBe(false);
  }, 120_000);
});
