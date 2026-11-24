// FMT-002 (the config) and INS-001 (a fresh install), through the CLI.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { parseConfig } from '../../src/core/parse/tickets';
import { buildForTests, LINT_BASE, REPO, gitFixture, tempDir } from '../helpers';

const BIN = join(REPO, 'dist/spec');
const made: string[] = [];
const fixtures: ReturnType<typeof gitFixture>[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
  for (const f of fixtures) f.cleanup();
});

describe('FMT-002: the config', () => {
  it('FMT-002/S1 Defaults for every key but the test command', () => {
    const { config, findings } = parseConfig('config.json', '{ "formatVersion": 2, "testCommand": "npm test" }');
    expect(findings).toEqual([]);
    expect(config).toMatchObject({ tickets: { adapter: 'files', dir: 'tickets' }, baseBranch: 'main', codeGlobs: [], testGlobs: [], protectedGlobs: [], budgets: {} });
    // generated is not set, and no default stands in for it.
    expect(config).not.toBeNull();
    expect((config as Record<string, unknown>).generated).toBeUndefined();
    expect(Object.keys(config as Record<string, unknown>)).not.toContain('generated');
  });

  it('FMT-002/S14 maxParallel is optional and a whole number of 1 or more', async () => {
    const parsed = parseConfig('config.json', '{ "formatVersion": 2, "testCommand": "npm test" }');
    expect(parsed.findings).toEqual([]);
    expect((parsed.config as Record<string, unknown> | undefined)?.maxParallel).toBeUndefined();
    const withCfg = async (value: number) => {
      const fx = gitFixture('spec-fmt2-s14', {
        fixture: LINT_BASE,
        setup: (dir) => {
          const file = join(dir, 'spec/config.json');
          const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
          cfg.maxParallel = value;
          writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
        },
      });
      fixtures.push(fx);
      return fx.spec('', 'lint');
    };
    expect((await withCfg(2)).stdout).toContain('lint clean');
    const bad = await withCfg(0);
    expect(bad.stdout + bad.stderr).toContain('maxParallel');
  }, 60_000);

  it('FMT-002/S20 Legacy dispatch keys are accepted and warned about', async () => {
    const models = { small: 'sonnet', large: 'opus', threshold: 4 };
    const parsed = parseConfig('config.json', JSON.stringify({ formatVersion: 2, testCommand: 'npm test', dispatchCommand: 'claude -p {ticket}', models }));
    expect(parsed.findings).toEqual([]);
    const fx = gitFixture('spec-fmt2-x139', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const file = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        cfg.dispatchCommand = 'claude -p {ticket}';
        cfg.models = models;
        writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint');
    expect(out.code).toBe(0);
    expect(out.stdout.match(/warning L028/g)).toHaveLength(2);
    expect(out.stdout).toContain('dispatchCommand is ignored since X139; the session drives stages with spec next');
    expect(out.stdout).toContain('models is ignored since X139; the session drives stages with spec next');
  }, 60_000);

  it('FMT-002/S16 afterMerge is optional and a shell command', async () => {
    const parsed = parseConfig('config.json', '{ "formatVersion": 2, "testCommand": "npm test" }');
    expect(parsed.findings).toEqual([]);
    expect((parsed.config as Record<string, unknown> | undefined)?.afterMerge).toBeUndefined();
    const withAfterMerge = async (value: unknown) => {
      const fx = gitFixture('spec-fmt2-s16', {
        fixture: LINT_BASE,
        setup: (dir) => {
          const file = join(dir, 'spec/config.json');
          const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
          cfg.afterMerge = value;
          writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
        },
      });
      fixtures.push(fx);
      return fx.spec('', 'lint');
    };
    expect((await withAfterMerge('npm run build')).stdout).toContain('warning L034');
    const bad = await withAfterMerge(5);
    expect(bad.stdout + bad.stderr).toContain('afterMerge');
  }, 120_000);

  it('FMT-002/S17 generated is optional, needs globs, and its command is optional', async () => {
    const parsed = parseConfig('config.json', '{ "formatVersion": 2, "testCommand": "npm test" }');
    expect(parsed.findings).toEqual([]);
    expect((parsed.config as Record<string, unknown> | undefined)?.generated).toBeUndefined();
    const withGenerated = async (value: unknown) => {
      const fx = gitFixture('spec-fmt2-s17', {
        fixture: LINT_BASE,
        setup: (dir) => {
          const file = join(dir, 'spec/config.json');
          const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
          cfg.generated = value;
          writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
        },
      });
      fixtures.push(fx);
      return fx.spec('', 'lint');
    };
    expect((await withGenerated({ globs: ['src/generated/**'], command: 'npm run build --silent' })).stdout).toContain('lint clean');
    // R8: the command is optional.
    const noCommand = await withGenerated({ globs: ['src/generated/**'] });
    expect(noCommand.stdout).toBe('lint clean\n');
    expect(noCommand.code).toBe(0);
    // R8: an empty globs list, an outside glob and an empty command are each an L001 on that member.
    const parse = (generated: unknown) => parseConfig('config.json', JSON.stringify({ formatVersion: 2, testCommand: 'npm test', generated }));
    const noGlobs = parse({ globs: [], command: 'npm run build --silent' });
    expect(noGlobs.findings.map((f) => [f.rule, f.message.split(':')[0]])).toEqual([['L001', 'config.json generated.globs']]);
    const emptyCommand = parse({ globs: ['src/generated/**'], command: '' });
    expect(emptyCommand.findings.map((f) => [f.rule, f.message.split(':')[0]])).toEqual([['L001', 'config.json generated.command']]);
    for (const glob of ['../outside/**', '/tmp/**', 'plugin\\generated/**', './src/**', 'src/./x/**']) {
      expect(parse({ globs: [glob] }).findings.map((f) => [f.rule, f.message.split(':')[0]]), glob).toEqual([['L001', 'config.json generated.globs.0']]);
    }
    const outside = await withGenerated({ globs: ['../outside/**'], command: 'npm run build --silent' });
    expect(outside.stdout).toContain('config.json generated.globs.0: must be a non-empty project-relative POSIX glob');
    expect(outside.code).toBe(1);
    const empty = await withGenerated({ globs: ['src/generated/**'], command: '' });
    expect(empty.stdout).toContain('config.json generated.command');
    expect(empty.code).toBe(1);
  }, 180_000);

  it('FMT-002/S19 generatedGlobs is read as generated without a command', async () => {
    const fx = gitFixture('spec-fmt2-s19', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const file = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        cfg.generatedGlobs = ['plugin/generated/**'];
        writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    });
    fixtures.push(fx);
    const lint = await fx.spec('', 'lint', '--format', 'json');
    expect(lint.code).toBe(0);
    const findings = (JSON.parse(lint.stdout) as { findings: { rule: string; severity: string; file: string; message: string; fix: string }[] }).findings;
    expect(findings).toEqual([
      expect.objectContaining({
        rule: 'L036',
        severity: 'warning',
        file: 'config.json',
        message: 'generatedGlobs is replaced by generated; it is read as generated.globs without a command',
        fix: 'move its globs into generated.globs and remove generatedGlobs',
      }),
    ]);

    const invalid = (generatedGlobs: string[]) => parseConfig('config.json', JSON.stringify({ formatVersion: 2, testCommand: 'npm test', generatedGlobs }));
    for (const glob of ['../outside/**', '/tmp/**', 'plugin\\generated/**', 'plugin//generated/**']) {
      expect(invalid([glob]).findings[0]?.message).toContain('generatedGlobs.0');
    }
    const bad = gitFixture('spec-fmt2-s17-bad', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const file = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        cfg.generatedGlobs = ['../outside/**'];
        writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    });
    fixtures.push(bad);
    const out = await bad.spec('', 'lint');
    expect(out.stdout).toContain('config.json generatedGlobs.0: must be a non-empty project-relative POSIX glob');
    expect(out.code).toBe(1);
  }, 120_000);

  it('FMT-002/S11 Format 2 is read', async () => {
    // The lint base, with the one unused contract used, is an otherwise clean spec.
    const fx = gitFixture('spec-fmt2-s11', { fixture: LINT_BASE });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint');
    expect(out.stdout).toContain('lint clean');
  }, 60_000);

  it('FMT-002/S12 The project root defaults to the spec root\'s parent', async () => {
    const fx = gitFixture('spec-fmt2-s12');
    fixtures.push(fx);
    const out = await fx.spec('', 'show', 'TASK-101');
    expect(out.stdout.split('\n')[0]).toBe('tickets/TASK-101.md:1');
  }, 60_000);

  it('FMT-002/S13 A configured project root', async () => {
    const fx = gitFixture('spec-fmt2-s13', {
      setup: (dir) => {
        mkdirSync(join(dir, 'app'));
        renameSync(join(dir, 'tickets'), join(dir, 'app/tickets'));
        const config = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
        cfg.projectRoot = '../app';
        writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'show', 'TASK-101');
    expect(out.stdout.split('\n')[0]).toBe('tickets/TASK-101.md:1');
  }, 60_000);
});

const CLI = '.spec/bin';
const WRITTEN = [
  'spec/config.json',
  'spec/.gitignore',
  'spec/core/overview.md',
  'spec/core/conventions.md',
  'spec/core/glossary.md',
  'spec/core/invariants.md',
  'spec/roles/spec-writer.md',
  'spec/roles/spec-review.md',
  'spec/roles/tester.md',
  'spec/roles/implementer.md',
  'spec/roles/reviewer.md',
  `${CLI}/spec`,
  `${CLI}/spec.cjs`,
  '.claude/settings.json (permissions and plugin merged)',
  'CLAUDE.md (spec guidance)',
  'AGENTS.md (spec guidance)',
  'spec/_generated/graph.json',
  'spec/index.md',
];

interface Installation {
  repo: string;
  skill: string;
  spec: string;
  written: string[];
  skipped: string[];
  notes: string[];
  removed: string[];
  keptEdited: string[];
}

function emptyRepo(): string {
  const dir = tempDir('spec-ins001-');
  made.push(dir);
  return dir;
}

/** `spec init . --name shop` in a fresh folder, from the built CLI (or from source when `scriptPath` is null). */
async function install(opts: { format?: 'json'; scriptPath?: string | undefined; name?: string } = {}) {
  const repo = emptyRepo();
  const argv = ['init', '.', '--name', opts.name ?? 'shop', ...(opts.format ? ['--format', opts.format] : [])];
  const out = await run({ argv, env: {}, cwd: repo, scriptPath: 'scriptPath' in opts ? opts.scriptPath : BIN });
  return { repo, out };
}
const file = (repo: string, path: string) => readFileSync(join(repo, path), 'utf8');

beforeAll(() => {
  buildForTests();
}, 120_000);

describe('INS-001: a fresh install', () => {
  it('INS-001/S14 Every file a fresh install writes', async () => {
    const { out } = await install({ format: 'json' });
    expect(out.code).toBe(0);
    const r = JSON.parse(out.stdout) as Installation;
    expect(r.written).toEqual(WRITTEN);
    expect(r.skipped).toEqual([]);
    expect(r.notes).toEqual(['git hooks not installed: not a git repository']);
    expect(r.removed).toEqual([]);
    expect(r.keptEdited).toEqual([]);
  }, 120_000);

  it('INS-002/S9 An underscore is accepted in a project slug', async () => {
    const { repo, out } = await install({ name: 'chat_app', format: 'json' });
    expect(out.code).toBe(0);
    expect(JSON.parse(file(repo, 'spec/config.json'))).toMatchObject({ name: 'chat_app' });
  }, 120_000);

  it('INS-001/S15 Text output', async () => {
    const { out } = await install();
    const lines = out.stdout.split('\n').filter((l) => l !== '');
    const writes = lines.filter((line) => line.startsWith('wrote '));
    expect(writes).toHaveLength(WRITTEN.length);
    expect(writes[0]).toBe('wrote spec/config.json');
    expect(writes.at(-1)).toBe('wrote spec/index.md');
    expect(lines.at(-1)).toBe('note: git hooks not installed: not a git repository');
  }, 120_000);

  it('INS-001/S16 JSON output', async () => {
    const { out } = await install({ format: 'json' });
    const r = JSON.parse(out.stdout) as Installation;
    expect(Object.keys(r).sort()).toEqual(['keptEdited', 'notes', 'removed', 'repo', 'skill', 'skipped', 'spec', 'updated', 'written']);
    expect(r).toMatchObject({ skill: 'spec:brief', spec: 'spec' });
  }, 120_000);

  it('INS-001/S17 Init leaves plugin skills to the plugin', async () => {
    const { repo } = await install();
    expect(() => statSync(join(repo, '.claude/skills/shop-spec'))).toThrow();
    expect(file(repo, 'spec/.gitignore').trim()).toBe('_generated/\nconfig.local.json');
  }, 120_000);

  it('INS-001/S18 The config starts with the project\'s name and a vitest setup', async () => {
    const { repo } = await install();
    const cfg = JSON.parse(file(repo, 'spec/config.json')) as Record<string, unknown>;
    expect(cfg).toMatchObject({
      formatVersion: 2,
      name: 'shop',
      tickets: { adapter: 'files', dir: 'tickets' },
      baseBranch: 'main',
      codeGlobs: ['src/**'],
      testGlobs: ['tests/**'],
      protectedGlobs: [],
      budgets: {},
      testCommand: 'npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"',
    });
    expect(cfg).not.toHaveProperty('dispatchCommand');
  }, 120_000);

  it('INS-001/S19 The core files carry the project\'s name', async () => {
    const { repo } = await install();
    expect(file(repo, 'spec/core/overview.md').startsWith('# shop')).toBe(true);
    for (const f of ['overview', 'conventions', 'glossary', 'invariants']) expect(file(repo, `spec/core/${f}.md`)).not.toContain('{project}');
  }, 120_000);

  it('INS-001/S20 The role prompts are self-contained', async () => {
    const { repo } = await install();
    for (const role of ['spec-writer', 'spec-review', 'implementer', 'tester', 'reviewer']) {
      expect(existsSync(join(repo, `spec/roles/${role}.md`)), `${role} is installed`).toBe(true);
      const text = file(repo, `spec/roles/${role}.md`);
      expect(text, role).toMatch(/^role:/m);
      expect(text, role).toMatch(/^description:/m);
      expect(text, role).toMatch(/^capabilities:/m);
      for (const token of ['{shared}', '{role}', '{changed}']) expect(text, role).not.toContain(token);
    }
    expect(() => statSync(join(repo, 'spec/roles/overseer.md'))).toThrow();
  }, 120_000);

  it('INS-001/S21 The bundled CLI is copied and executable', async () => {
    const { repo } = await install();
    for (const f of ['spec', 'spec.cjs']) {
      expect(readFileSync(join(repo, CLI, f)).equals(readFileSync(join(REPO, 'dist', f)))).toBe(true);
      expect(statSync(join(repo, CLI, f)).mode & 0o777).toBe(0o755);
    }
  }, 120_000);

  it('INS-001/S22 Run from source, the CLI is not copied', async () => {
    const { repo, out } = await install({ format: 'json', scriptPath: undefined });
    const r = JSON.parse(out.stdout) as Installation;
    expect(r.written).not.toContain(`${CLI}/spec`);
    expect(r.written).not.toContain(`${CLI}/spec.cjs`);
    expect(r.notes).toContain(`${CLI}/spec not installed: run init from the built dist/spec`);
    expect(() => statSync(join(repo, CLI, 'spec'))).toThrow();
  }, 120_000);

  it('INS-001/S23 Init leaves plugin command skills to the plugin', async () => {
    const { repo } = await install();
    expect(() => statSync(join(repo, '.claude/skills/feature/SKILL.md'))).toThrow();
    expect((JSON.parse(file(repo, '.claude/settings.json')) as { enabledPlugins: unknown }).enabledPlugins).toEqual({ 'spec@happyface': true });
  }, 120_000);

  it('INS-001/S24 A new install passes lint --ci', async () => {
    const { repo } = await install();
    const lint = spawnSync(join(repo, CLI, 'spec'), ['lint', '--ci'], { cwd: repo, encoding: 'utf8' });
    expect(lint.status, lint.stdout + lint.stderr).toBe(0);
  }, 120_000);

  it('INS-001/S25 The repository may be the working directory', async () => {
    const { out } = await install({ format: 'json' });
    expect((JSON.parse(out.stdout) as Installation).repo).toBe('.');
  }, 120_000);
});

describe('INS-003: project permissions and plugin enablement', () => {
  it('INS-003/S9 The CLI and brief skill are allowed', async () => {
    const { repo, out } = await install({ format: 'json' });
    expect(out.code).toBe(0);
    const text = file(repo, '.claude/settings.json');
    const settings = JSON.parse(text) as { permissions: { allow: unknown }; enabledPlugins: unknown; extraKnownMarketplaces: unknown };
    expect(settings.permissions.allow).toEqual(['Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']);
    expect(settings.enabledPlugins).toEqual({ 'spec@happyface': true });
    expect(settings.extraKnownMarketplaces).toEqual({ happyface: { source: { source: 'github', repo: 'happyfacedev/happyface-plugins' } } });
    expect(text).not.toContain('autoUpdate');
  });

  it('INS-003/S10 Plugin hooks are not copied into settings', async () => {
    const { repo } = await install();
    expect(JSON.parse(file(repo, '.claude/settings.json'))).not.toHaveProperty('hooks');
  });

  it('INS-003/S11 Existing settings and hooks are kept', async () => {
    const repo = emptyRepo();
    const initial = {
      model: 'opus',
      permissions: { allow: ['Bash(npm test)'], deny: ['Bash(rm *)'] },
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] },
    };
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(join(repo, '.claude/settings.json'), JSON.stringify(initial));
    await run({ argv: ['init', '.', '--name', 'shop'], env: {}, cwd: repo, scriptPath: BIN });
    const after = JSON.parse(file(repo, '.claude/settings.json')) as { model: string; permissions: { deny: string[]; allow: string[] }; hooks: unknown };
    expect(after.model).toBe('opus');
    expect(after.permissions.deny).toEqual(['Bash(rm *)']);
    expect(after.permissions.allow).toEqual(['Bash(npm test)', 'Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']);
    expect(after.hooks).toEqual(initial.hooks);
  });

  it('INS-003/S12 Nothing is added twice', async () => {
    const { repo } = await install();
    const before = file(repo, '.claude/settings.json');
    const given = JSON.parse(before) as { permissions: { allow: string[] }; enabledPlugins: Record<string, unknown>; extraKnownMarketplaces: Record<string, unknown> };
    expect(given.permissions.allow).toEqual(expect.arrayContaining(['Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']));
    expect(given.enabledPlugins['spec@happyface']).toBe(true);
    expect(given.extraKnownMarketplaces).toHaveProperty('happyface');
    const out = await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN });
    expect(file(repo, '.claude/settings.json')).toBe(before);
    expect((JSON.parse(out.stdout) as Installation).skipped).toContain('.claude/settings.json (spec permissions and plugin state already present)');
  });

  it('INS-003/S14 An explicitly disabled plugin stays disabled', async () => {
    const repo = emptyRepo();
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(join(repo, '.claude/settings.json'), JSON.stringify({ enabledPlugins: { 'spec@happyface': false } }));
    const out = await run({ argv: ['init', '.', '--name', 'shop'], env: {}, cwd: repo, scriptPath: BIN });
    expect(out.code, out.stderr).toBe(0);
    const settings = JSON.parse(file(repo, '.claude/settings.json')) as { enabledPlugins: Record<string, unknown>; permissions: { allow: string[] } };
    expect(settings.enabledPlugins['spec@happyface']).toBe(false);
    expect(Object.hasOwn(settings.enabledPlugins, 'spec@spec')).toBe(false);
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(['Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']));
  });

  it('INS-003/S13 A settings file that is not a JSON object is left alone', async () => {
    const repo = emptyRepo();
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(join(repo, '.claude/settings.json'), '[1]');
    const out = await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN });
    expect(file(repo, '.claude/settings.json')).toBe('[1]');
    expect((JSON.parse(out.stdout) as Installation).notes).toContain('.claude/settings.json is not a JSON object; add the spec permissions and enabledPlugins entry by hand');
    expect(out.code).toBe(0);
  });
});

describe('INS-002 project name', () => {
  it('INS-002/S8 Letters, digits and hyphens are accepted', async () => {
    const repo = emptyRepo();
    const out = await run({ argv: ['init', '.', '--name', 'my-shop2'], env: {}, cwd: repo, scriptPath: BIN });
    expect(out.code).toBe(0);
    expect(JSON.parse(file(repo, 'spec/config.json'))).toMatchObject({ name: 'my-shop2' });
    expect(statSync(join(repo, '.spec/bin/spec')).mode & 0o777).toBe(0o755);
  });
});
