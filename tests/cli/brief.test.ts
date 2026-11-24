// spec brief through the CLI: the reviewer's diff from real git, and exit 0 whatever happens.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { git } from '../../src/io/git';
import { FIXTURE, gitFixture, tempDir } from '../helpers';

let repo = '';
const g = (...args: string[]) => git(repo, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args]);
const brief = (...argv: string[]) => run({ argv: ['brief', ...argv, '--root', join(repo, 'spec')], env: {}, cwd: repo, scriptPath: undefined });

beforeAll(() => {
  repo = tempDir('spec-brief-');
  cpSync(FIXTURE, repo, { recursive: true, filter: (src) => !src.includes('/node_modules') });
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'fixture');
  g('checkout', '-q', '-b', 'ticket/TASK-101');
  writeFileSync(join(repo, 'src/providers/select.ts'), 'export const select = 1;\n');
  writeFileSync(join(repo, 'NOTES.md'), 'outside the code and test globs\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'TASK-101 implementer: extract selection');
});
afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('spec brief (CLI)', () => {
  it('the reviewer brief carries the diff against the base, limited to code and test globs', async () => {
    const out = await brief('reviewer', 'TASK-101');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('`git diff main...HEAD` on src/**, tests/**');
    expect(out.stdout).toContain('+export const select = 1;');
    expect(out.stdout).not.toContain('NOTES.md');
  });

  it('INS-016/S7/S3 reviewer diff preserves a governed source renamed out of its globs', async () => {
    g('checkout', '-q', '-b', 'ticket/TASK-102', 'main');
    g('mv', 'src/settings/providers.ts', 'README.providers.ts');
    g('commit', '-q', '-m', 'rename governed source outside its globs');
    const out = await brief('reviewer', 'TASK-101');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('-// SET-001 Enable providers.');
  });

  it('a bad base is reported in the brief, not as a failure', async () => {
    const out = await brief('reviewer', 'TASK-101', '--base', 'no-such-branch');
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/## Diff\n.*unavailable \(/);
  });

  it('exits 0 with a hint when there is no spec root or the options are wrong', async () => {
    const noRoot = await run({ argv: ['brief', 'implementer', 'TASK-101'], env: {}, cwd: tmpdir(), scriptPath: undefined });
    expect(noRoot.code).toBe(0);
    expect(noRoot.stdout).toMatch(/^no spec root/);
    expect((await brief('implementer', 'TASK-101', '--depth', 'x')).code).toBe(0);
    expect((await brief('implementer', 'TASK-101', 'extra')).stdout).toMatch(/^spec brief takes a role and one ID/);
  });

  it("the skill's empty '$0' '$1' gives the home brief", async () => {
    const out = await brief('', '');
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/^# Brief · spec@[0-9a-f]{8}\n\n## Modules/);
  });

  it("PIP-012/S20 The spec-writer's case checklist", async () => {
    const expected = [
      'Work through every item before you finish, and report each under checklist: as { item, outcome, ids, reason }. The outcome is scenarios, invariant or question, with the IDs that cover the item, or na, with the reason it does not apply.',
      '- C1 neighbours: run spec impact PROP-201; for each feature it reaches, cite a scenario that shows the change keeps it working, or changes it with it.',
      '- C2 environment axes: paths (symlinks, case, relative and absolute), install layouts and versions, platforms, and an upgrade from every older state.',
      '- C3 concurrency and ordering: for each state shared across an await or a process boundary, a scenario of the form: while X is in progress, a second Y happens.',
      '- C4 trust boundaries: for each input that crosses one, an invariant: who can set it, what happens if it is forged, and which side decides.',
      '- C5 fail closed: unknown, missing or unverifiable input is refused, and a scenario says so.',
      '- C6 preserved behaviour: scenarios on the unchanged path that must behave exactly as before.',
      '- C8 external facts: for each fact about another tool or service, say where you verified it; one you could not verify is a blocker marked external: true, and the stage ends blocked.',
    ].join('\n');
    const section = (text: string) => text.split('\n## Case checklist\n')[1]?.split('\n## ')[0]?.replace(/\n$/, '') ?? null;
    const groups = (text: string) => text.split('\n').filter((line) => line.startsWith('## ')).map((line) => line.slice(3));
    const normal = gitFixture('spec-brief-case-checklist');
    const budgeted = gitFixture('spec-brief-case-checklist-budget', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        writeFileSync(path, `${JSON.stringify({ ...config, budgets: { 'brief.spec-writer': 300 } }, null, 2)}\n`);
      },
    });
    try {
      const proposal = await normal.spec('', 'brief', 'spec-writer', 'PROP-201');
      expect(proposal.code).toBe(0);
      expect(section(proposal.stdout)).toBe(expected);
      const proposalGroups = groups(proposal.stdout);
      expect(proposalGroups.indexOf('Conventions')).toBeLessThan(proposalGroups.indexOf('Case checklist'));
      expect(proposalGroups.indexOf('Case checklist')).toBeLessThan(proposalGroups.indexOf('Expand'));

      for (const role of ['implementer', 'tester', 'reviewer']) {
        expect((await normal.spec('', 'brief', role, 'PROP-201')).stdout).not.toContain('## Case checklist');
      }
      for (const id of ['BUG-301', 'TASK-101', 'PRV-001']) {
        expect((await normal.spec('', 'brief', 'spec-writer', id)).stdout).not.toContain('## Case checklist');
      }

      const trimmed = await budgeted.spec('', 'brief', 'spec-writer', 'PROP-201');
      expect(trimmed.code).toBe(0);
      expect(trimmed.stdout).not.toBe(proposal.stdout);
      expect(section(trimmed.stdout)).toBe(expected);
    } finally {
      normal.cleanup();
      budgeted.cleanup();
    }
  }, 60_000);
});
