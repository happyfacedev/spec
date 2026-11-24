import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURE_SPEC, REPO, tempDir as makeTempDir } from '../helpers';
import { COMMANDS, expandCommand } from '../../src/core/commands';

const BIN = join(REPO, 'plugin/scripts/spec');
const VERSION = (JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string }).version;
const tempDir = (): string => makeTempDir('spec-ins013-');
const upgrade = (cwd: string, ...args: string[]) => {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: tempDir() };
  delete env.SPEC_PLUGIN_ROOT;
  return spawnSync(BIN, ['upgrade', ...args], { cwd, env, encoding: 'utf8' });
};
const installVersion = (bin: string, version: string, bundle: string): void => {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'spec'), '#!/usr/bin/env node\nprocess.stdout.write("spec ' + version + '\\n");\n');
  chmodSync(join(bin, 'spec'), 0o755);
  writeFileSync(join(bin, 'spec.cjs'), bundle);
};
const installOld = (repo: string, version = '0.0.1'): void => {
  installVersion(join(repo, '.spec/bin'), version, 'old bundle\n');
};
const SOURCE = join(REPO, 'plugin/scripts');
const firstLine = (text: string): string => text.split('\n')[0] ?? '';
// A copy of the running CLI's files in repo/.spec/bin; `bundleTail` and `launcherTail` append a comment so the copy still runs but its bytes differ.
const installCurrent = (repo: string, bundleTail = '', launcherTail = ''): string => {
  const bin = join(repo, '.spec/bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'spec'), readFileSync(join(SOURCE, 'spec'), 'utf8') + launcherTail);
  writeFileSync(join(bin, 'spec.cjs'), readFileSync(join(SOURCE, 'spec.cjs'), 'utf8') + bundleTail);
  chmodSync(join(bin, 'spec'), 0o755);
  return bin;
};
const expectCopiesOf = (bin: string, source: string): void => {
  for (const file of ['spec', 'spec.cjs']) {
    expect(readFileSync(join(bin, file)).equals(readFileSync(join(source, file))), file + ' is a copy of the source').toBe(true);
  }
};
const makeOldLayout = (repo: string, edited = false): void => {
  cpSync(FIXTURE_SPEC, join(repo, 'spec'), { recursive: true });
  const skill = join(repo, '.claude/skills/shop-spec');
  mkdirSync(join(skill, 'scripts'), { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), readFileSync(join(REPO, 'templates/SKILL.md'), 'utf8').replaceAll('{project}', 'shop') + (edited ? '\nEdited by user.\n' : ''));
  writeFileSync(join(skill, 'skill.json'), JSON.stringify({ specRoot: 'spec' }, null, 2) + '\n');
  cpSync(join(REPO, 'plugin/scripts/spec'), join(skill, 'scripts/spec'));
  const interview = readFileSync(join(REPO, 'templates/commands/_interview.md'), 'utf8');
  const drive = readFileSync(join(REPO, 'templates/commands/_drive.md'), 'utf8');
  for (const command of COMMANDS) {
    const path = join(repo, '.claude/skills', command, 'SKILL.md');
    mkdirSync(join(repo, '.claude/skills', command), { recursive: true });
    const template = readFileSync(join(REPO, 'templates/commands', command + '.md'), 'utf8');
    const text = expandCommand(template, interview, drive, '.claude/skills/shop-spec/scripts/spec', 'shop');
    writeFileSync(path, text + (edited && command === 'feature' ? '\nEdited by user.\n' : ''));
  }
  const legacyOrchestrate = readFileSync(join(REPO, 'tests/fixtures/legacy-orchestrate.md'), 'utf8').replaceAll('chat', 'shop');
  const orchestrate = join(repo, '.claude/skills/orchestrate/SKILL.md');
  mkdirSync(join(repo, '.claude/skills/orchestrate'), { recursive: true });
  writeFileSync(orchestrate, legacyOrchestrate + (edited ? '\nEdited by user.\n' : ''));
  const hook = (point: string) => ({ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/skills/shop-spec/scripts/spec hook claude-code ' + point });
  writeFileSync(join(repo, '.claude/settings.json'), JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: 'startup|resume|compact', hooks: [hook('session-start')] }],
      PreToolUse: [{ matcher: 'Agent|Task', hooks: [hook('before-delegate')] }],
      PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [hook('after-edit')] }],
      SubagentStop: [{ hooks: [hook('before-finish')] }],
    },
    permissions: { allow: ['Bash(.claude/skills/shop-spec/scripts/spec *)', 'Bash(./.claude/skills/shop-spec/scripts/spec *)', 'Skill(shop-spec)'] },
  }, null, 2) + '\n');
};
const runWithEnv = (repo: string, env: NodeJS.ProcessEnv, ...args: string[]) => spawnSync(BIN, ['upgrade', ...args], { cwd: repo, env, encoding: 'utf8' });
// `entries` are the `spec@spec` records, or, as a map, the records under each plugin ID.
const upgradeFromRegistry = (repo: string, home: string, entries: readonly Record<string, unknown>[] | Record<string, readonly Record<string, unknown>[]>) => {
  mkdirSync(join(home, '.claude/plugins'), { recursive: true });
  const plugins = Array.isArray(entries) ? { 'spec@spec': entries } : entries;
  writeFileSync(join(home, '.claude/plugins/installed_plugins.json'), JSON.stringify({ plugins }));
  const runner = join(home, 'runner/scripts');
  mkdirSync(runner, { recursive: true });
  for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(runner, file));
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
  delete env.SPEC_PLUGIN_ROOT;
  return spawnSync(join(runner, 'spec'), ['upgrade'], { cwd: repo, env, encoding: 'utf8' });
};

describe('INS-013 upgrade the project CLI', () => {
  it('INS-013/S1 Installs the pinned CLI when it is missing', () => {
    const repo = tempDir();
    const out = upgrade(repo, '.');
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toBe(`upgraded .spec/bin/spec not installed → ${VERSION}\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n`);
    for (const file of ['spec', 'spec.cjs']) {
      expect(readFileSync(join(repo, '.spec/bin', file))).toEqual(readFileSync(join(REPO, 'plugin/scripts', file)));
    }
    expect(execFileSync(join(repo, '.spec/bin/spec'), ['--version'], { encoding: 'utf8' })).toBe(`spec ${VERSION}\n`);
  });

  it('INS-013/S2 Replaces a different pinned version', () => {
    const repo = tempDir();
    installOld(repo);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toBe(`upgraded .spec/bin/spec 0.0.1 → ${VERSION}\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n`);
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'))).toEqual(readFileSync(join(REPO, 'plugin/scripts/spec.cjs')));
  });

  it('INS-013/S3 Leaves an up-to-date CLI alone', () => {
    const repo = tempDir();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(bin, file));
    chmodSync(join(bin, 'spec'), 0o755);
    const old = new Date('2020-01-01T00:00:00Z');
    for (const file of ['spec', 'spec.cjs']) utimesSync(join(bin, file), old, old);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe(`up to date ${VERSION}`);
    expect(out.stdout).toBe(`up to date ${VERSION}\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n`);
    expectCopiesOf(bin, SOURCE);
    for (const file of ['spec', 'spec.cjs']) expect(statSync(join(bin, file)).mtimeMs, file + ' was not rewritten').toBe(old.getTime());
  });

  it('INS-013/S4 JSON reports the old and current versions', () => {
    const repo = tempDir();
    installOld(repo);
    const out = upgrade(repo, '--format', 'json');
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ upgraded: true, downgraded: false, oldVersion: '0.0.1', version: VERSION, removed: [], updated: ['.claude/settings.json (permissions and plugin merged)', 'CLAUDE.md (spec guidance)', 'AGENTS.md (spec guidance)'], keptEdited: [], notes: ['git hooks not installed: not a git repository'] });
  });

  it('INS-013/S5 Uses the newest installed plugin entry', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const older = join(home, 'cache/older');
    const newest = join(home, 'cache/newest');
    installVersion(older, '0.3.0', 'older bundle');
    installVersion(newest, '0.2.0', 'newest bundle');
    const registry = join(home, '.claude/plugins/installed_plugins.json');
    mkdirSync(join(home, '.claude/plugins'), { recursive: true });
    writeFileSync(registry, JSON.stringify({ plugins: { 'spec@spec': [
      { installPath: older, version: '0.3.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z' },
      { installPath: newest, version: '0.2.0', scope: 'user', installedAt: '2026-02-01T00:00:00.000Z' },
    ] } }));
    const runner = join(home, 'runner/scripts');
    mkdirSync(runner, { recursive: true });
    for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(runner, file));
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
    delete env.SPEC_PLUGIN_ROOT;
    const out = spawnSync(join(runner, 'spec'), ['upgrade'], { cwd: repo, env, encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toBe('upgraded .spec/bin/spec 0.0.1 → 0.2.0\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('newest bundle');
  });

  it('INS-013/S6 --from wins over the plugin root and installed registry', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const from = join(home, 'chosen');
    const plugin = join(home, 'plugin');
    installVersion(join(from, 'scripts'), '0.4.0', 'from bundle');
    installVersion(join(plugin, 'scripts'), '0.3.0', 'plugin bundle');
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, SPEC_PLUGIN_ROOT: plugin };
    const out = runWithEnv(repo, env, '--from', from);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toBe('upgraded .spec/bin/spec 0.0.1 → 0.4.0\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('from bundle');
  });

  it('INS-013/S7 A project copy cannot upgrade itself without a source', () => {
    const repo = tempDir();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(bin, file));
    chmodSync(join(bin, 'spec'), 0o755);
    const home = tempDir();
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
    delete env.SPEC_PLUGIN_ROOT;
    const out = spawnSync(join(bin, 'spec'), ['upgrade'], { cwd: repo, env, encoding: 'utf8' });
    expect(out.status).toBe(1);
    expect(out.stderr).toContain(`no newer spec found; run "${realpathSync(join(repo, '.spec/bin/spec'))}" upgrade from a Claude Code session`);
  });

  it('INS-013/S9 Upgrade removes only generated old-layout files and replaces old settings rules', () => {
    const repo = tempDir();
    makeOldLayout(repo);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    for (const path of [
      '.claude/skills/shop-spec/SKILL.md',
      '.claude/skills/shop-spec/skill.json',
      '.claude/skills/shop-spec/scripts/spec',
      '.claude/skills/feature/SKILL.md',
    ]) expect(out.stdout).toContain('removed ' + path);
    expect(existsSync(join(repo, '.claude/skills/shop-spec'))).toBe(false);
    expect(existsSync(join(repo, '.claude/skills/feature/SKILL.md'))).toBe(false);
    const settings = JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8')) as { hooks?: unknown; permissions: { allow: string[] }; enabledPlugins: Record<string, boolean> };
    expect(settings.hooks).toBeUndefined();
    expect(settings.permissions.allow).toEqual(['Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']);
    expect(settings.enabledPlugins).toEqual({ 'spec@happyface': true });
  });

  it('INS-013/S10 Init reports edited old-layout files instead of deleting them', () => {
    const repo = tempDir();
    makeOldLayout(repo, true);
    const out = spawnSync(BIN, ['init', '.', '--name', 'shop'], { cwd: repo, encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toContain('kept (edited): .claude/skills/shop-spec/SKILL.md');
    expect(out.stdout).toContain('kept (edited): .claude/skills/feature/SKILL.md');
    expect(existsSync(join(repo, '.claude/skills/shop-spec/SKILL.md'))).toBe(true);
    expect(existsSync(join(repo, '.claude/skills/feature/SKILL.md'))).toBe(true);
    const settings = JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8')) as { hooks?: unknown };
    expect(settings.hooks).toBeUndefined();
  });

  it('Ignores unrelated folders that end in -spec', () => {
    const repo = tempDir();
    makeOldLayout(repo);
    const unrelated = join(repo, '.claude/skills/unrelated-spec');
    mkdirSync(unrelated, { recursive: true });
    writeFileSync(join(unrelated, 'SKILL.md'), 'A user skill, not a spec install.\n');
    const settingsPath = join(repo, '.claude/settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks: Record<string, unknown>; permissions: { allow: string[] } };
    settings.hooks.UserPromptSubmit = [{ hooks: [{ command: '"$CLAUDE_PROJECT_DIR"/.claude/skills/unrelated-spec/scripts/spec hook claude-code session-start' }] }];
    settings.permissions.allow.push('Bash(.claude/skills/unrelated-spec/scripts/spec *)', 'Skill(unrelated-spec)');
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).not.toContain('unrelated-spec');
    expect(readFileSync(join(unrelated, 'SKILL.md'), 'utf8')).toBe('A user skill, not a spec install.\n');
    const migrated = JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks: Record<string, { hooks: { command: string }[] }[]>; permissions: { allow: string[] } };
    expect(migrated.hooks.UserPromptSubmit?.[0]?.hooks[0]?.command).toContain('unrelated-spec');
    expect(migrated.permissions.allow).toContain('Bash(.claude/skills/unrelated-spec/scripts/spec *)');
    expect(migrated.permissions.allow).toContain('Skill(unrelated-spec)');
  });

  it('FMT-002/S20 Legacy dispatch keys are accepted but warned about', () => {
    const repo = tempDir();
    makeOldLayout(repo);
    const configPath = join(repo, 'spec/config.json');
    const oldDispatch = 'claude -p {ticket} --allowedTools "Bash(.claude/skills/shop-spec/scripts/spec *)" "Skill(shop-spec)"';
    const oldModels = { small: 'sonnet', large: 'opus', threshold: 4 };
    const original = readFileSync(configPath, 'utf8').replace('  "baseBranch": "main",\n', '  "baseBranch": "main",\n  "dispatchCommand": ' + JSON.stringify(oldDispatch) + ',\n  "models": ' + JSON.stringify(oldModels) + ',\n');
    writeFileSync(configPath, original);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    const lint = spawnSync(BIN, ['lint', '--root', 'spec'], { cwd: repo, encoding: 'utf8' });
    expect(lint.status, lint.stdout + lint.stderr).toBe(0);
    expect(lint.stdout).toContain('warning L028');
    expect(lint.stdout).toContain('dispatchCommand is ignored since X139; the session drives stages with spec next');
    expect(lint.stdout).toContain('models is ignored since X139; the session drives stages with spec next');
  });

  it('The running plugin launcher wins over the installed plugin registry', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const installed = join(home, 'cache/older');
    installVersion(join(installed, 'scripts'), '0.0.2', 'installed bundle');
    mkdirSync(join(home, '.claude/plugins'), { recursive: true });
    writeFileSync(join(home, '.claude/plugins/installed_plugins.json'), JSON.stringify({ plugins: { 'spec@spec': [{ installPath: installed, version: '0.0.2', scope: 'user' }] } }));
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
    delete env.SPEC_PLUGIN_ROOT;
    const out = runWithEnv(repo, env);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toBe(`upgraded .spec/bin/spec 0.0.1 → ${VERSION}\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n`);
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'))).toEqual(readFileSync(join(REPO, 'plugin/scripts/spec.cjs')));
  });

  it('INS-013/S14 Removes an unchanged generated orchestrate skill', () => {
    const repo = tempDir();
    makeOldLayout(repo);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toContain('removed .claude/skills/orchestrate/SKILL.md');
    expect(existsSync(join(repo, '.claude/skills/orchestrate'))).toBe(false);
  });

  it('INS-013/S15 Keeps and reports an edited generated orchestrate skill', () => {
    const repo = tempDir();
    makeOldLayout(repo, true);
    const path = join(repo, '.claude/skills/orchestrate/SKILL.md');
    const before = readFileSync(path, 'utf8');
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toContain('kept (edited): .claude/skills/orchestrate/SKILL.md');
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('INS-013/S16 Strips removed hooks that invoke the pinned CLI', () => {
    const repo = tempDir();
    installOld(repo);
    const cli = '"$CLAUDE_PROJECT_DIR"/.spec/bin/spec hook claude-code ';
    const command = (event: string) => ({ type: 'command', command: cli + event });
    const hooks = {
      PreToolUse: [{ matcher: 'Agent|Task', hooks: [command('before-delegate')] }],
      SubagentStop: [{ hooks: [command('before-finish')] }],
      SessionStart: [{ matcher: 'startup|resume|compact', hooks: [command('session-start')] }],
      PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [command('after-edit')] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo keep this hook' }] }],
    };
    const settingsPath = join(repo, '.claude/settings.json');
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ permissions: { defaultMode: 'default' }, hooks }, null, 2) + '\n');
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { permissions: { defaultMode: string }; hooks: Record<string, { hooks: { command: string }[] }[]> };
    expect(settings.hooks.PreToolUse).toBeUndefined();
    expect(settings.hooks.SubagentStop).toBeUndefined();
    expect(settings.hooks.SessionStart?.[0]?.hooks[0]?.command).toBe(cli + 'session-start');
    expect(settings.hooks.PostToolUse?.[0]?.hooks[0]?.command).toBe(cli + 'after-edit');
    expect(settings.hooks.UserPromptSubmit?.[0]?.hooks[0]?.command).toBe('echo keep this hook');
    expect(settings.permissions.defaultMode).toBe('default');
  });

  it('INS-014/S34 A user-scoped plugin registry entry is eligible', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const user = join(home, 'cache/user');
    const other = join(home, 'cache/other-project');
    installVersion(user, '0.3.0', 'user bundle');
    installVersion(other, '0.2.0', 'other project bundle');
    const out = upgradeFromRegistry(repo, home, { 'spec@happyface': [
      { installPath: user, version: '0.3.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z' },
      { installPath: other, version: '0.2.0', scope: 'project', projectPath: '/different/repo', installedAt: '2026-02-01T00:00:00.000Z' },
    ] });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe('upgraded .spec/bin/spec 0.0.1 → 0.3.0');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('user bundle');
  });

  it('INS-014/S35 A matching project-scoped plugin entry is eligible', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const matching = join(home, 'cache/matching-project');
    const other = join(home, 'cache/other-project');
    installVersion(matching, '0.3.0', 'matching project bundle');
    installVersion(other, '0.2.0', 'other project bundle');
    const out = upgradeFromRegistry(repo, home, { 'spec@happyface': [
      { installPath: matching, version: '0.3.0', scope: 'project', projectPath: repo, installedAt: '2026-01-01T00:00:00.000Z' },
      { installPath: other, version: '0.2.0', scope: 'project', projectPath: '/different/repo', installedAt: '2026-02-01T00:00:00.000Z' },
    ] });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe('upgraded .spec/bin/spec 0.0.1 → 0.3.0');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('matching project bundle');
  });

  it('INS-013/S35 Upgrade prefers the happyface plugin ID', () => {
    // A: user-scoped spec@happyface; B: user-scoped spec@spec, updated later than A.
    const preferred = tempDir();
    installOld(preferred);
    const home = tempDir();
    const a = join(home, 'cache/happyface');
    const b = join(home, 'cache/spec');
    installVersion(a, '0.3.0', 'happyface bundle');
    installVersion(b, '0.4.0', 'old id bundle');
    const out = upgradeFromRegistry(preferred, home, {
      'spec@happyface': [{ installPath: a, version: '0.3.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z', lastUpdated: '2026-01-02T00:00:00.000Z' }],
      'spec@spec': [{ installPath: b, version: '0.4.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z', lastUpdated: '2026-03-01T00:00:00.000Z' }],
    });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expectCopiesOf(join(preferred, '.spec/bin'), a);

    // The only spec@happyface install is project-scoped to another repository, so B is used.
    const fallback = tempDir();
    installOld(fallback);
    const otherHome = tempDir();
    const elsewhere = join(otherHome, 'cache/happyface-elsewhere');
    const old = join(otherHome, 'cache/spec');
    installVersion(elsewhere, '0.3.0', 'happyface elsewhere bundle');
    installVersion(old, '0.4.0', 'old id bundle');
    const fell = upgradeFromRegistry(fallback, otherHome, {
      'spec@happyface': [{ installPath: elsewhere, version: '0.3.0', scope: 'project', projectPath: '/different/repo', installedAt: '2026-04-01T00:00:00.000Z', lastUpdated: '2026-04-02T00:00:00.000Z' }],
      'spec@spec': [{ installPath: old, version: '0.4.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z', lastUpdated: '2026-03-01T00:00:00.000Z' }],
    });
    expect(fell.status, fell.stdout + fell.stderr).toBe(0);
    expectCopiesOf(join(fallback, '.spec/bin'), old);
  });

  it('INS-013/S17 A newer unrelated project install does not outrank a user install', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const user = join(home, 'cache/user');
    const other = join(home, 'cache/other-project');
    installVersion(user, '0.3.0', 'user bundle');
    installVersion(other, '0.4.0', 'other project bundle');
    const out = upgradeFromRegistry(repo, home, [
      { installPath: user, version: '0.3.0', scope: 'user', installedAt: '2026-01-01T00:00:00.000Z' },
      { installPath: other, version: '0.4.0', scope: 'project', projectPath: '/different/repo', installedAt: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe('upgraded .spec/bin/spec 0.0.1 → 0.3.0');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('user bundle');
  });

  it("INS-013/S18 A newer unrelated project install does not outrank this project's install", () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const matching = join(home, 'cache/matching-project');
    const other = join(home, 'cache/other-project');
    installVersion(matching, '0.3.0', 'matching project bundle');
    installVersion(other, '0.4.0', 'other project bundle');
    const out = upgradeFromRegistry(repo, home, [
      { installPath: matching, version: '0.3.0', scope: 'project', projectPath: repo, installedAt: '2026-01-01T00:00:00.000Z' },
      { installPath: other, version: '0.4.0', scope: 'project', projectPath: '/different/repo', installedAt: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe('upgraded .spec/bin/spec 0.0.1 → 0.3.0');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('matching project bundle');
  });

  it('INS-013/S20 Uses lastUpdated instead of a later installedAt value', () => {
    const repo = tempDir();
    installOld(repo);
    const home = tempDir();
    const newestUpdate = join(home, 'cache/newest-update');
    const newestInstall = join(home, 'cache/newest-install');
    installVersion(newestUpdate, '0.3.0', 'newest update bundle');
    installVersion(newestInstall, '0.2.0', 'newest install bundle');
    const out = upgradeFromRegistry(repo, home, [
      { installPath: newestUpdate, version: '0.3.0', scope: 'user', installedAt: '2026-10-01T00:00:00.000Z', lastUpdated: '2026-10-22T00:00:00.000Z' },
      { installPath: newestInstall, version: '0.2.0', scope: 'user', installedAt: '2026-10-23T00:00:00.000Z', lastUpdated: '2026-10-21T00:00:00.000Z' },
    ]);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('newest update bundle');
  });

  it('INS-013/S19 Upgrade preserves invalid shared and local delegation values', () => {
    const repo = tempDir();
    cpSync(FIXTURE_SPEC, join(repo, 'spec'), { recursive: true });
    const configPath = join(repo, 'spec/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.delegation = { 'claude-code': { 'spec-writer': 'claude-sonnet-5-5', tester: 'inherit' } };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    const localPath = join(repo, 'spec/config.local.json');
    const local = { delegation: { 'claude-code': { implementer: 'opus-4' } } };
    writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n');
    const sharedBefore = readFileSync(configPath, 'utf8');
    const localBefore = readFileSync(localPath, 'utf8');
    const out = upgrade(repo, '.', '--from', join(REPO, 'plugin/scripts'));
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(sharedBefore);
    expect(readFileSync(localPath, 'utf8')).toBe(localBefore);
  });

  it('INS-013/S21 A different build at the same version is replaced', () => {
    const repo = tempDir();
    const bin = installCurrent(repo, '\n// an older build\n');
    expect(execFileSync(join(bin, 'spec'), ['--version'], { encoding: 'utf8' })).toBe(`spec ${VERSION}\n`);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expectCopiesOf(bin, SOURCE);
    expect(firstLine(out.stdout)).toBe(`rebuilt .spec/bin/spec ${VERSION}`);
  });

  it('INS-013/S22 A different launcher at the same version is replaced', () => {
    const repo = tempDir();
    const bin = installCurrent(repo, '', '\n// a pinned launcher\n');
    expect(execFileSync(join(bin, 'spec'), ['--version'], { encoding: 'utf8' })).toBe(`spec ${VERSION}\n`);
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expectCopiesOf(bin, SOURCE);
    expect(firstLine(out.stdout)).toBe(`rebuilt .spec/bin/spec ${VERSION}`);
  });

  it('INS-013/S23 A rebuild at the same version is named in JSON', () => {
    const repo = tempDir();
    installCurrent(repo, '\n// an older build\n');
    const out = upgrade(repo, '--format', 'json');
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ upgraded: true, rebuilt: true, downgraded: false, oldVersion: VERSION, version: VERSION });
  });

  it('INS-013/S24 A rebuild at the same version needs no --force', () => {
    const repo = tempDir();
    const bin = installCurrent(repo);
    const source = tempDir();
    installCurrent(source, '\n// the source build\n');
    const from = join(source, '.spec/bin');
    const out = upgrade(repo, '--from', from);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expectCopiesOf(bin, from);
    expect(firstLine(out.stdout)).toBe(`rebuilt .spec/bin/spec ${VERSION}`);
    expect(out.stdout.startsWith('downgraded')).toBe(false);
  });

  it('INS-013/S25 A launcher left without its bundle is restored', () => {
    const repo = tempDir();
    const bin = installCurrent(repo);
    rmSync(join(bin, 'spec.cjs'));
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(readFileSync(join(bin, 'spec.cjs')).equals(readFileSync(join(SOURCE, 'spec.cjs')))).toBe(true);
    expect(statSync(join(bin, 'spec.cjs')).mode & 0o777).toBe(0o755);
    expect(readFileSync(join(bin, 'spec')).equals(readFileSync(join(SOURCE, 'spec')))).toBe(true);
  });

  it('INS-013/S28 A replacement leaves only the two pinned files', () => {
    const repo = tempDir();
    installOld(repo);
    const bin = join(repo, '.spec/bin');
    expect(execFileSync(join(bin, 'spec'), ['--version'], { encoding: 'utf8' })).toBe('spec 0.0.1\n');
    const out = upgrade(repo);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(readdirSync(bin).sort()).toEqual(['spec', 'spec.cjs']);
    for (const file of ['spec', 'spec.cjs']) expect(statSync(join(bin, file)).mode & 0o777, file + ' mode').toBe(0o755);
    expectCopiesOf(bin, SOURCE);
  });

  it('INS-013/S26 A different version is still reported by version', () => {
    const text = tempDir();
    installVersion(join(text, '.spec/bin'), '0.0.1', 'a bundle unlike the running one\n');
    const out = upgrade(text);
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(firstLine(out.stdout)).toBe(`upgraded .spec/bin/spec 0.0.1 → ${VERSION}`);
    const json = tempDir();
    installVersion(join(json, '.spec/bin'), '0.0.1', 'a bundle unlike the running one\n');
    const result = upgrade(json, '--format', 'json');
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ upgraded: true, rebuilt: false });
  });

  it('INS-013/S27 An unreadable pinned version is replaced', () => {
    const repo = tempDir();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'spec'), '#!/usr/bin/env node\nprocess.exit(1);\n');
    chmodSync(join(bin, 'spec'), 0o755);
    const out = upgrade(repo, '--format', 'json');
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ upgraded: true, oldVersion: 'unknown', version: VERSION });
    expectCopiesOf(bin, SOURCE);
  });

  it('INS-013/S8 A downgrade needs --force and is reported', () => {
    const repo = tempDir();
    installVersion(join(repo, '.spec/bin'), '0.2.0', 'new bundle');
    const oldSource = tempDir();
    installVersion(oldSource, '0.1.0', 'old source bundle');
    const refused = upgrade(repo, '--from', oldSource);
    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain('pass --force to downgrade');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('new bundle');
    const forced = upgrade(repo, '--from', oldSource, '--force');
    expect(forced.status, forced.stdout + forced.stderr).toBe(0);
    expect(forced.stdout).toBe('downgraded .spec/bin/spec 0.2.0 → 0.1.0\nupdated .claude/settings.json (permissions and plugin merged)\nupdated CLAUDE.md (spec guidance)\nupdated AGENTS.md (spec guidance)\nnote: git hooks not installed: not a git repository\n');
    expect(readFileSync(join(repo, '.spec/bin/spec.cjs'), 'utf8')).toBe('old source bundle');
  });
});
