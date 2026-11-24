// spec init and migration, through the CLI with the built bundle.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { expandRole, parseRoleFile } from '../../src/core/roles';
import { ASSETS } from '../../src/generated/assets';
import { buildForTests, REPO, tempDir } from '../helpers';

let dir = '';
const made: string[] = [];
const BIN = join(REPO, 'dist/spec');
const spec = (...argv: string[]) => run({ argv, env: {}, cwd: dir, scriptPath: BIN });
const CLI = '.spec/bin';
const LEGACY_OVERSEER_PROMPT = readFileSync(join(REPO, 'tests/fixtures/legacy-overseer-role.md'), 'utf8');
// INS-004: the two files init writes on every run, and the settings file, whose skip has its own line.
const GENERATED = ['spec/_generated/graph.json', 'spec/index.md'];
const SETTINGS = '.claude/settings.json';
// A written entry names .claude/settings.json with its merge in brackets; the path is the part before them.
const pathOf = (w: string): string => w.replace(' (permissions and plugin merged)', '');
type InitMigration = { removed: string[]; keptEdited: string[] };

/** A fresh repository with spec installed as "shop", and the paths that install wrote. */
async function installed(): Promise<{ repo: string; written: string[] }> {
  const repo = tempDir('spec-init-ins004-');
  made.push(repo);
  const out = await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN });
  expect(out.code).toBe(0);
  return { repo, written: (JSON.parse(out.stdout) as { written: string[] }).written };
}
const initText = (repo: string) => run({ argv: ['init', '.', '--name', 'shop'], env: {}, cwd: repo, scriptPath: BIN });

beforeAll(() => {
  buildForTests();
  dir = tempDir('spec-init-');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] } }));
}, 60_000);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe('spec init', () => {
  it('installs the spec and pinned CLI without compiled agents; the result lints clean with --ci', async () => {
    const out = await spec('init', '.', '--name', 'shop', '--format', 'json');
    expect(out.code).toBe(0);
    const r = JSON.parse(out.stdout) as { written: string[]; skipped: string[]; notes: string[] };
    expect(r.notes).toEqual(['git hooks not installed: not a git repository']);
    for (const f of ['spec', 'spec.cjs']) expect(r.written).toContain(`${CLI}/${f}`);
    for (const f of ['config.json', 'core/overview.md', 'core/conventions.md', 'roles/implementer.md', '_generated/graph.json', 'index.md']) expect(r.written).toContain(`spec/${f}`);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toContain('<!-- spec:begin -->');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('/spec:feature');
    expect(JSON.parse(readFileSync(join(dir, 'spec/config.json'), 'utf8'))).toMatchObject({ name: 'shop' });
    expect(existsSync(join(dir, '.claude/agents'))).toBe(false);
    const lint = spawnSync(join(dir, CLI, 'spec'), ['lint', '--ci'], { cwd: dir, encoding: 'utf8' });
    expect(lint.status, lint.stdout + lint.stderr).toBe(0);
  });

  it('--update-roles shows what a newer version would replace, and writes only with --yes', async () => {
    const path = join(dir, 'spec/roles/tester.md');
    const current = readFileSync(path, 'utf8');
    // An install from an older version: its tester was asked to test after the code.
    writeFileSync(path, current.replace('Tests come before the code', 'Tests come after the code'));
    const check = await spec('init', '.', '--update-roles');
    expect(check.code).toBe(1);
    expect(check.stdout).toContain('--- spec/roles/tester.md');
    expect(check.stdout).toMatch(/^- .*Tests come after the code/m);
    expect(check.stdout).toMatch(/^\+ .*Tests come before the code/m);
    expect(check.stdout).toContain('Run again with --yes');
    expect(readFileSync(path, 'utf8')).toContain('Tests come after the code');
    const apply = await spec('init', '.', '--update-roles', '--yes');
    expect(apply.code).toBe(0);
    expect(apply.stdout).toContain('wrote spec/roles/tester.md');
    expect(readFileSync(path, 'utf8')).toBe(current);
    expect(existsSync(join(dir, '.claude/agents/tester.md'))).toBe(false);
    expect((await spec('init', '.', '--update-roles')).stdout).toBe('role prompts are up to date\n');
  });

  it('merges CLI permissions and plugin enablement, and keeps existing hooks', () => {
    const s = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')) as { permissions: { allow: string[] }; enabledPlugins: Record<string, boolean>; hooks: Record<string, { hooks: { command: string }[] }[]> };
    expect(s.permissions.allow).toEqual(['Bash(npm test)', 'Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill']);
    expect(s.enabledPlugins).toEqual({ 'spec@happyface': true });
    expect(s.hooks.PreToolUse?.map((h) => h.hooks[0]?.command)).toEqual(['echo mine']);
    expect(Object.keys(s.hooks)).toEqual(['PreToolUse']);
  });

  it('INS-004/S1 Existing files are skipped, not overwritten', async () => {
    const before = readFileSync(join(dir, 'spec/core/overview.md'), 'utf8');
    writeFileSync(join(dir, 'spec/core/overview.md'), `${before}\nEdited by a person.\n`);
    const r = JSON.parse((await spec('init', '.', '--name', 'shop', '--format', 'json')).stdout) as { skipped: string[] };
    expect(readFileSync(join(dir, 'spec/core/overview.md'), 'utf8')).toContain('Edited by a person.');
    expect(r.skipped).toContain('spec/core/overview.md');
    expect(r.skipped).toContain('.claude/settings.json (spec permissions and plugin state already present)');
  });

  it('INS-004/S2 Only generated files are written again', async () => {
    const { repo } = await installed();
    const r = JSON.parse((await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN })).stdout) as { written: string[] };
    expect(r.written.filter((w) => !GENERATED.includes(w))).toEqual([]);
  });

  it('INS-004/S3 Text output names each skip', async () => {
    const { repo, written } = await installed();
    const out = await initText(repo);
    expect(out.code).toBe(0);
    const lines = out.stdout.split('\n');
    const existing = written.map(pathOf).filter((p) => p !== SETTINGS && !GENERATED.includes(p));
    expect(existing).toContain('spec/core/overview.md');
    for (const p of existing) expect(lines, p).toContain(`skipped ${p} (exists)`);
    expect(lines).toContain('skipped .claude/settings.json (spec permissions and plugin state already present)');
  });

  it('INS-004/S8 A second init removes an unchanged obsolete role prompt', async () => {
    const { repo } = await installed();
    const path = join(repo, 'spec/roles/overseer.md');
    writeFileSync(path, LEGACY_OVERSEER_PROMPT);
    const result = JSON.parse((await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN })).stdout) as InitMigration;
    expect(result.removed).toContain('spec/roles/overseer.md');
    expect(result.keptEdited).not.toContain('spec/roles/overseer.md');
    expect(existsSync(path)).toBe(false);
  });

  it('INS-004/S10 A second init reports a mismatched --name and keeps the configured name', async () => {
    const { repo } = await installed();
    const out = await run({ argv: ['init', '.', '--name', 'store', '--accept-edits', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN });
    expect(out.code, out.stderr).toBe(0);
    const result = JSON.parse(out.stdout) as { notes: string[] };
    expect(JSON.parse(readFileSync(join(repo, 'spec/config.json'), 'utf8'))).toMatchObject({ name: 'shop' });
    expect(result.notes).toContain('--name store differs from spec/config.json name shop; keeping the existing name');
  });

  it('INS-004/S9 A second init keeps an edited obsolete role prompt', async () => {
    const { repo } = await installed();
    const path = join(repo, 'spec/roles/overseer.md');
    const edited = `${LEGACY_OVERSEER_PROMPT}\nEdited by a person.\n`;
    writeFileSync(path, edited);
    const result = JSON.parse((await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN })).stdout) as InitMigration;
    expect(result.keptEdited).toContain('spec/roles/overseer.md');
    expect(readFileSync(path, 'utf8')).toBe(edited);
  });

  it('INS-004/S7 Init does not write compiled agents', async () => {
    const { repo } = await installed();
    const lines = (await initText(repo)).stdout.split('\n');
    expect(lines.some((line) => line.includes('.claude/agents/'))).toBe(false);
    expect(existsSync(join(repo, '.claude/agents/tester.md'))).toBe(false);
  });

  it('keeps custom agent files during init migration', async () => {
    const { repo } = await installed();
    const agent = join(repo, '.claude/agents/tester.md');
    mkdirSync(join(repo, '.claude/agents'), { recursive: true });
    writeFileSync(agent, 'name: tester\ncustom: keep\n');
    const out = await initText(repo);
    expect(readFileSync(agent, 'utf8')).toBe('name: tester\ncustom: keep\n');
    expect(out.stdout).toContain('kept (edited): .claude/agents/tester.md');
  });

  it('INS-004/S6 A build failure is a note', async () => {
    const repo = tempDir('spec-init-ins004-');
    made.push(repo);
    mkdirSync(join(repo, 'spec'), { recursive: true });
    // A file in no place a spec file may go: the parse fails with L002, so the spec does not build.
    writeFileSync(join(repo, 'spec/stray.md'), '# Stray\n');
    const out = await run({ argv: ['init', '.', '--name', 'shop', '--format', 'json'], env: {}, cwd: repo, scriptPath: BIN });
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as { notes: string[] }).notes).toContainEqual(expect.stringMatching(/^spec build failed: /));
  });

  it('LNT-003 ignores legacy agent files in lint --ci', async () => {
    const agent = join(dir, '.claude/agents/reviewer.md');
    mkdirSync(join(dir, '.claude/agents'), { recursive: true });
    writeFileSync(agent, 'custom agent\n');
    const lint = await spec('lint', '--ci', '--root', 'spec', '--format', 'json');
    expect(lint.code).toBe(0);
    expect((JSON.parse(lint.stdout) as { findings: { rule: string }[] }).findings.some((finding) => finding.rule === 'L021')).toBe(false);
  });

  it('refuses a bad name or a missing repo', async () => {
    expect((await spec('init', '.', '--name', 'Shop')).code).toBe(2);
    expect((await spec('init', 'nowhere', '--name', 'shop')).code).toBe(2);
    expect(existsSync(join(dir, 'nowhere'))).toBe(false);
  });
});

describe('roles', () => {
  it('every role template expands to a self-contained neutral role file', () => {
    for (const role of ['spec-writer', 'spec-review', 'implementer', 'tester', 'reviewer']) {
      const text = expandRole(ASSETS[`roles/${role}.md`] ?? '', ASSETS['roles/_shared.md'] ?? '');
      expect(text, role).not.toBeNull();
      expect(text).not.toMatch(/\{(shared|role|changed)\}/);
      expect(parseRoleFile(`roles/${role}.md`, text ?? '').findings).toEqual([]);
    }
  });

  it('every role prompt declares capabilities for its harness task', () => {
    for (const role of ['spec-writer', 'spec-review', 'implementer', 'tester', 'reviewer']) {
      const text = expandRole(ASSETS[`roles/${role}.md`] ?? '', ASSETS['roles/_shared.md'] ?? '');
      const parsed = parseRoleFile(`roles/${role}.md`, text ?? '').role;
      expect(parsed?.capabilities.length, role).toBeGreaterThan(0);
    }
  });

  it('the bundled assets match roles/ and templates/', async () => {
    const { renderAssets, ASSETS_PATH } = await import('../../scripts/gen-assets');
    expect(readFileSync(ASSETS_PATH, 'utf8')).toBe(renderAssets());
  });
});
