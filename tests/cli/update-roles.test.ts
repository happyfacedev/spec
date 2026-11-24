// INS-005: spec init <repo> --update-roles, through the CLI with the built bundle.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { buildForTests, REPO, tempDir as makeTempDir } from '../helpers';

const BIN = join(REPO, 'dist/spec');
const TAIL = 'Run again with --yes to replace them; edits made to these files in this project would be lost.';
const LEGACY_OVERSEER_PROMPT = readFileSync(join(REPO, 'tests/fixtures/legacy-overseer-role.md'), 'utf8');
const UP_TO_DATE = 'role prompts are up to date\n';

beforeAll(() => {
  buildForTests();
}, 60_000);

const cli = (cwd: string, ...argv: string[]) => run({ argv, env: {}, cwd, scriptPath: BIN });
const tempDir = (): string => makeTempDir('spec-ins005-');
/** A repository with spec installed as "shop". */
async function installed(): Promise<string> {
  const repo = tempDir();
  expect((await cli(repo, 'init', '.', '--name', 'shop')).code).toBe(0);
  return repo;
}
const edit = (repo: string, path: string, from: string, to: string): void => {
  const abs = join(repo, path);
  const text = readFileSync(abs, 'utf8');
  expect(text).toContain(from);
  writeFileSync(abs, text.replace(from, to));
};
type Update = { changed: { role: string; path: string; diff: string[] }[]; written: string[]; removed: string[]; keptEdited: string[] };

describe('INS-005 update-roles', () => {
  it('INS-005/S1 Up to date', async () => {
    const repo = await installed();
    const out = await cli(repo, 'init', '.', '--update-roles');
    expect(out.stdout).toBe(UP_TO_DATE);
    expect(out.code).toBe(0);
  });

  it('INS-005/S2 A differing prompt is shown, not written', async () => {
    const repo = await installed();
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');
    const before = readFileSync(join(repo, 'spec/roles/tester.md'), 'utf8');
    const out = await cli(repo, 'init', '.', '--update-roles');
    const lines = out.stdout.split('\n');
    expect(lines).toContain('--- spec/roles/tester.md');
    expect(lines.some((l) => l.startsWith('- ') && l.includes('Tests come after the code'))).toBe(true);
    expect(lines.some((l) => l.startsWith('+ ') && l.includes('Tests come before the code'))).toBe(true);
    expect(out.stdout.endsWith(`1 role prompt differs. ${TAIL}\n`)).toBe(true);
    expect(readFileSync(join(repo, 'spec/roles/tester.md'), 'utf8')).toBe(before);
    expect(out.code).toBe(1);
  });

  it('INS-005/S3 Several differing prompts', async () => {
    const repo = await installed();
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');
    writeFileSync(join(repo, 'spec/roles/reviewer.md'), `${readFileSync(join(repo, 'spec/roles/reviewer.md'), 'utf8')}\nEdited by a person.\n`);
    const out = await cli(repo, 'init', '.', '--update-roles');
    expect(out.stdout.split('\n').filter((l) => l.startsWith('--- '))).toEqual(['--- spec/roles/reviewer.md', '--- spec/roles/tester.md']);
    expect(out.stdout).toMatch(/\n\n--- spec\/roles\/tester\.md\n/);
    expect(out.stdout.endsWith(`2 role prompts differ. ${TAIL}\n`)).toBe(true);
  });

  it('INS-005/S4 --yes replaces only role prompts', async () => {
    const repo = await installed();
    const path = join(repo, 'spec/roles/tester.md');
    const current = readFileSync(path, 'utf8');
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');
    const out = await cli(repo, 'init', '.', '--update-roles', '--yes');
    expect(readFileSync(path, 'utf8')).toBe(current);
    expect(existsSync(join(repo, '.claude/agents/tester.md'))).toBe(false);
    const lines = out.stdout.split('\n');
    const diffAt = lines.indexOf('--- spec/roles/tester.md');
    expect(diffAt).toBeGreaterThanOrEqual(0);
    expect(lines.indexOf('wrote spec/roles/tester.md')).toBeGreaterThan(diffAt);
    expect(out.code).toBe(0);
    expect((await cli(repo, 'init', '.', '--update-roles')).stdout).toBe(UP_TO_DATE);
  });

  it('INS-005/S5 The name comes from the config', async () => {
    const repo = await installed();
    expect(JSON.parse(readFileSync(join(repo, 'spec/config.json'), 'utf8'))).toMatchObject({ name: 'shop' });
    const out = await cli(repo, 'init', '.', '--update-roles');
    expect(out.stdout).toBe(UP_TO_DATE);
    expect(out.code).toBe(0);
  });

  it('INS-005/S6 No name anywhere', async () => {
    const repo = await installed();
    rmSync(join(repo, 'spec/config.json'));
    const out = await cli(repo, 'init', '.', '--update-roles');
    expect(out.stderr.startsWith('--update-roles needs --name <project>, or a name in spec/config.json')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('INS-005/S13 Only role prompts are compared', async () => {
    const repo = await installed();
    mkdirSync(join(repo, '.claude/skills/shop-spec'), { recursive: true });
    mkdirSync(join(repo, '.claude/skills/feature'), { recursive: true });
    const paths = ['.claude/skills/shop-spec/SKILL.md', '.claude/skills/feature/SKILL.md'];
    for (const path of paths) writeFileSync(join(repo, path), 'edited\n');
    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.changed.some((c) => c.path.startsWith('.claude/skills/'))).toBe(false);
    for (const path of paths) expect(readFileSync(join(repo, path), 'utf8')).toBe('edited\n');
  });

  it('INS-005/S8 JSON output', async () => {
    const repo = await installed();
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');
    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0]).toMatchObject({ role: 'tester', path: 'spec/roles/tester.md' });
    expect(Array.isArray(r.changed[0]?.diff)).toBe(true);
    expect(r.written).toEqual([]);
    expect(out.code).toBe(1);
  });

  it('INS-005/S9 Missing stage role prompts count as differing', async () => {
    const repo = await installed();
    rmSync(join(repo, 'spec/roles'), { recursive: true, force: true });
    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.changed.map((c) => c.role).sort()).toEqual(['implementer', 'reviewer', 'spec-review', 'spec-writer', 'tester']);
    const implementer = r.changed.find((c) => c.path === 'spec/roles/implementer.md');
    expect(implementer).toBeDefined();
    expect(implementer?.diff.length).toBeGreaterThan(0);
    for (const l of implementer?.diff ?? []) expect(l.startsWith('+ '), l).toBe(true);
    expect(out.code).toBe(1);
  });

  it('INS-001/S29 Role updates leave the internal overseer prompt alone', async () => {
    const repo = await installed();
    rmSync(join(repo, 'spec/roles'), { recursive: true, force: true });
    mkdirSync(join(repo, 'spec/roles'), { recursive: true });
    writeFileSync(join(repo, 'spec/roles/overseer.md'), 'custom internal prompt\n');

    const preview = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const planned = JSON.parse(preview.stdout) as Update;
    expect(planned.changed.map((c) => c.role).sort()).toEqual(['implementer', 'reviewer', 'spec-review', 'spec-writer', 'tester']);
    expect(planned.changed.some((c) => c.path === 'spec/roles/overseer.md')).toBe(false);

    const applied = await cli(repo, 'init', '.', '--update-roles', '--yes', '--format', 'json');
    const result = JSON.parse(applied.stdout) as Update;
    expect(result.written.map((path) => path.split('/').at(-1)).sort()).toEqual(['implementer.md', 'reviewer.md', 'spec-review.md', 'spec-writer.md', 'tester.md']);
    expect(readFileSync(join(repo, 'spec/roles/overseer.md'), 'utf8')).toBe('custom internal prompt\n');
  });

  it('INS-005/S17 An install from before the spec review gets its prompt', async () => {
    const repo = await installed();
    const path = join(repo, 'spec/roles/spec-review.md');
    expect(existsSync(path), 'init installs spec/roles/spec-review.md').toBe(true);
    const shipped = readFileSync(path, 'utf8');
    const others = ['spec-writer', 'tester', 'implementer', 'reviewer'].map((role) => [role, readFileSync(join(repo, `spec/roles/${role}.md`), 'utf8')] as const);
    // An install by an earlier version had no spec-review prompt.
    rmSync(path);

    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0]).toMatchObject({ role: 'spec-review', path: 'spec/roles/spec-review.md' });
    expect(r.changed[0]?.diff.length).toBeGreaterThan(0);
    for (const line of r.changed[0]?.diff ?? []) expect(line.startsWith('+ '), line).toBe(true);
    expect(out.code).toBe(1);
    expect(existsSync(path)).toBe(false);

    const applied = await cli(repo, 'init', '.', '--update-roles', '--yes', '--format', 'json');
    expect((JSON.parse(applied.stdout) as Update).written).toEqual(['spec/roles/spec-review.md']);
    expect(readFileSync(path, 'utf8')).toBe(shipped);
    for (const [role, text] of others) expect(readFileSync(join(repo, `spec/roles/${role}.md`), 'utf8'), role).toBe(text);
    expect((await cli(repo, 'init', '.', '--update-roles')).stdout).toBe(UP_TO_DATE);
  });

  it('INS-005/S18 Lines the shipped prompt lacks are listed, with where project additions belong', async () => {
    const repo = await installed();
    const path = join(repo, 'spec/roles/tester.md');
    const shipped = readFileSync(path, 'utf8');
    // One line inside the "How to work:" list and one paragraph after the list.
    const lines = shipped.split('\n');
    const listAt = lines.indexOf('How to work:');
    expect(listAt).toBeGreaterThanOrEqual(0);
    const listEnd = lines.findIndex((l, i) => i > listAt && l.trim() === '');
    expect(listEnd).toBeGreaterThan(listAt);
    const edited = [...lines.slice(0, listAt + 1), '- Check the code against DECISIONS.md.', ...lines.slice(listAt + 1, listEnd), '', 'Run npm run lint before you finish.', ...lines.slice(listEnd)].join('\n');
    writeFileSync(path, edited);

    const out = await cli(repo, 'init', '.', '--update-roles');
    const outLines = out.stdout.split('\n');
    const header = outLines.indexOf("spec/roles/tester.md has lines this version's prompt lacks:");
    expect(header, out.stdout).toBeGreaterThanOrEqual(0);
    expect(outLines.slice(header, header + 4)).toEqual([
      "spec/roles/tester.md has lines this version's prompt lacks:",
      '  - Check the code against DECISIONS.md.',
      '  Run npm run lint before you finish.',
      'Project additions belong in spec/roles/tester.local.md, written by you: spec next adds it after the shipped prompt, and --yes replaces these lines.',
    ]);
    // After the diff.
    expect(header).toBeGreaterThan(outLines.indexOf('--- spec/roles/tester.md'));
    expect(header).toBeGreaterThan(outLines.findLastIndex((l) => l.startsWith('+ ') || l.startsWith('- ')));
    expect(out.stdout.endsWith(`1 role prompt differs. ${TAIL}\n`)).toBe(true);
    expect(out.code).toBe(1);

    const json = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(json.stdout) as { changed: { path: string; extra: string[] }[] };
    expect(r.changed.find((c) => c.path === 'spec/roles/tester.md')?.extra).toEqual(['- Check the code against DECISIONS.md.', 'Run npm run lint before you finish.']);
    expect(readFileSync(path, 'utf8')).toBe(edited);
    expect(existsSync(join(repo, 'spec/roles/tester.local.md'))).toBe(false);
    expect(json.code).toBe(1);

    // A differing prompt with nothing beyond the shipped text lists no lines.
    const missing = await installed();
    const shortened = shipped.replace('- Test only what the scenarios say. No tests for behaviour the brief does not describe.\n', '');
    expect(shortened).not.toBe(shipped);
    writeFileSync(join(missing, 'spec/roles/tester.md'), shortened);
    const quiet = await cli(missing, 'init', '.', '--update-roles', '--format', 'json');
    const q = JSON.parse(quiet.stdout) as { changed: { path: string; extra: string[] }[] };
    expect(q.changed.find((c) => c.path === 'spec/roles/tester.md')?.extra).toEqual([]);
    expect((await cli(missing, 'init', '.', '--update-roles')).stdout).not.toContain('has lines this version');

    const applied = await cli(repo, 'init', '.', '--update-roles', '--yes');
    expect(applied.code).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(shipped);
    expect(existsSync(join(repo, 'spec/roles/tester.local.md'))).toBe(false);
    expect(applied.stdout).not.toContain('has lines this version');
  });

  it('INS-005/S19 An existing local file is never touched', async () => {
    const repo = await installed();
    const local = join(repo, 'spec/roles/tester.local.md');
    writeFileSync(local, 'Use the helpers.');
    const shipped = readFileSync(join(repo, 'spec/roles/tester.md'), 'utf8');
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');

    const out = await cli(repo, 'init', '.', '--update-roles', '--yes', '--format', 'json');
    expect(out.code).toBe(0);
    expect(readFileSync(local, 'utf8')).toBe('Use the helpers.');
    expect(readFileSync(join(repo, 'spec/roles/tester.md'), 'utf8')).toBe(shipped);
    const r = JSON.parse(out.stdout) as Update;
    expect(r.written).toEqual(['spec/roles/tester.md']);
    for (const path of [...r.changed.map((c) => c.path), ...r.written]) expect(path.endsWith('.local.md'), path).toBe(false);

    // With every prompt up to date, local files change nothing in the output.
    writeFileSync(join(repo, 'spec/roles/reviewer.local.md'), 'reviewer additions\n\nmore\n');
    const upToDate = await cli(repo, 'init', '.', '--update-roles');
    expect(upToDate.stdout).toBe(UP_TO_DATE);
    expect(upToDate.code).toBe(0);
    expect(readFileSync(local, 'utf8')).toBe('Use the helpers.');
    expect(readFileSync(join(repo, 'spec/roles/reviewer.local.md'), 'utf8')).toBe('reviewer additions\n\nmore\n');

    // Without --yes the file stays as it is too.
    edit(repo, 'spec/roles/tester.md', 'Tests come before the code', 'Tests come after the code');
    const preview = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    expect((JSON.parse(preview.stdout) as Update).changed.map((c) => c.path)).toEqual(['spec/roles/tester.md']);
    expect(readFileSync(local, 'utf8')).toBe('Use the helpers.');
  });

  it('INS-005/S10 The repository is required', async () => {
    const out = await cli(tempDir(), 'init', '--update-roles');
    expect(out.stderr.startsWith('usage: spec init <repo> --update-roles [--yes]')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('INS-005/S15 An unchanged obsolete overseer prompt is removed', async () => {
    const repo = await installed();
    const path = join(repo, 'spec/roles/overseer.md');
    writeFileSync(path, LEGACY_OVERSEER_PROMPT);
    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.removed).toContain('spec/roles/overseer.md');
    expect(r.keptEdited).not.toContain('spec/roles/overseer.md');
    expect(r.changed).toEqual([]);
    expect(existsSync(path)).toBe(false);
    expect(out.code).toBe(0);
  });

  it('INS-005/S16 An edited obsolete overseer prompt is kept and reported', async () => {
    const repo = await installed();
    const path = join(repo, 'spec/roles/overseer.md');
    const edited = `${LEGACY_OVERSEER_PROMPT}\nEdited by a person.\n`;
    writeFileSync(path, edited);
    const out = await cli(repo, 'init', '.', '--update-roles', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.keptEdited).toContain('spec/roles/overseer.md');
    expect(r.removed).not.toContain('spec/roles/overseer.md');
    expect(readFileSync(path, 'utf8')).toBe(edited);
    expect(out.code).toBe(0);
  });

  it('INS-005/S14 A valid name override does not affect role prompts', async () => {
    const repo = await installed();
    const out = await cli(repo, 'init', '.', '--update-roles', '--name', 'other_project', '--format', 'json');
    const r = JSON.parse(out.stdout) as Update;
    expect(r.changed).toEqual([]);
    expect(out.code).toBe(0);
  });

  it('INS-005/S12 A name that is not a slug is refused', async () => {
    const container = tempDir();
    const repo = join(container, 'repo');
    mkdirSync(repo);
    expect((await cli(repo, 'init', '.', '--name', 'shop')).code).toBe(0);
    const snapshot = (dir: string): Record<string, string> => {
      const seen: Record<string, string> = {};
      for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
        if (e.isFile()) seen[join(e.parentPath, e.name)] = readFileSync(join(e.parentPath, e.name), 'utf8');
        else if (e.isDirectory()) seen[`${join(e.parentPath, e.name)}/`] = '';
      }
      return seen;
    };
    // An old command skill, so that a write would be visible if the name were used.
    mkdirSync(join(repo, '.claude/skills/feature'), { recursive: true });
    writeFileSync(join(repo, '.claude/skills/feature/SKILL.md'), 'edited\n');
    const before = snapshot(container);
    for (const extra of [['--yes'], []]) {
      const out = await cli(repo, 'init', '.', '--update-roles', '--name', '../x', ...extra);
      expect(out.stderr.startsWith('--name is a lowercase slug, such as chat; not ../x')).toBe(true);
      expect(out.code).toBe(2);
      expect(snapshot(container)).toEqual(before);
    }
  });
});
