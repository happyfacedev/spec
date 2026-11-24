// PIP-002/R6: a stage starts on the current base. When the ticket's branch lacks the base branch's
// tip, ticket start merges the base in first; conflicts only in generated files are rebuilt, any
// other conflict blocks the ticket for a person (ADR-002, H2).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseTicket } from '../../src/core/parse/tickets';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const EXPORT = 'src/conversation/export.ts';
const read = (fx: Fx, path: string) => readFileSync(join(fx.repo, path), 'utf8');
const write = (fx: Fx, path: string, text: string) => {
  writeFileSync(join(fx.repo, path), text);
};
const commitAll = (fx: Fx, message: string) => {
  fx.git('add', '-A');
  expect(fx.git('commit', '-q', '-m', message).code).toBe(0);
};

/** ticket/TASK-101 with one commit of `onBranch`, then main with one commit of `onMain`; the tree is back on main. */
function diverged(prefix: string, onBranch: (fx: Fx) => void, onMain: (fx: Fx) => void): Fx {
  const fx = gitFixture(prefix);
  made.push(fx);
  fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
  onBranch(fx);
  commitAll(fx, 'TASK-101: on the branch');
  fx.git('checkout', '-q', 'main');
  onMain(fx);
  commitAll(fx, 'main moves on');
  return fx;
}
const ticket = (fx: Fx) => parseTicket('tickets/TASK-101.md', read(fx, 'tickets/TASK-101.md')).ticket?.data;

describe('ticket start syncs the branch with the base', () => {
  it('PIP-002/S23 A branch behind the base is synced before the stage starts', async () => {
    const fx = diverged(
      'spec-sync-s23',
      (f) => { write(f, 'src/branch-note.ts', 'export const branch = 1;\n'); },
      (f) => { write(f, 'src/main-note.ts', 'export const main = 1;\n'); },
    );
    const mainTip = fx.git('rev-parse', 'main').stdout.trim();
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    // R6, INS-016/R12: the message ends in exactly one trailer line.
    const body = fx.git('log', '-1', '--format=%B').stdout.replace(/\n+$/, '');
    expect(body.endsWith('\n\nSpec-Ticket: TASK-101')).toBe(true);
    expect(body.split('\n').filter((l) => l.startsWith('Spec-Ticket:'))).toEqual(['Spec-Ticket: TASK-101']);
    expect(fx.git('merge-base', '--is-ancestor', mainTip, 'HEAD').code).toBe(0);
    expect(existsSync(join(fx.repo, 'src/main-note.ts'))).toBe(true);
    // Only the ticket file is uncommitted: the stage starts on a clean tree.
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
    // A branch that already holds the base's tip is not merged again.
    fx.git('checkout', '-q', '--', 'tickets');
    const synced = fx.git('rev-parse', 'HEAD').stdout.trim();
    const again = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(again.code, again.stderr).toBe(0);
    expect(fx.git('rev-parse', 'HEAD').stdout.trim()).toBe(synced);
  }, 60_000);

  /** Diverged as in S23, with ticket/TASK-101 checked out and another ticket's file edited, staged or not. */
  async function otherTicketEdited(prefix: string, staged: boolean) {
    const fx = diverged(
      prefix,
      (f) => { write(f, 'src/branch-note.ts', 'export const branch = 1;\n'); },
      (f) => { write(f, 'src/main-note.ts', 'export const main = 1;\n'); },
    );
    fx.git('checkout', '-q', 'ticket/TASK-101');
    const edited = read(fx, 'tickets/TASK-102.md').replace(/^title: .*$/m, 'title: Edited by a person');
    write(fx, 'tickets/TASK-102.md', edited);
    if (staged) fx.git('add', 'tickets/TASK-102.md');
    const tip = fx.git('rev-parse', 'HEAD').stdout.trim();
    return { fx, edited, tip, out: await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer') };
  }

  it('PIP-002/S28 Another ticket\'s uncommitted edit never rides in the sync', async () => {
    const { fx, edited } = await otherTicketEdited('spec-sync-s28', false);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    // The sync commit brings only what main had; the edit is still uncommitted, as it was.
    expect(fx.git('diff', '--name-only', 'HEAD^1', 'HEAD').stdout).toBe('src/main-note.ts\n');
    expect(fx.git('show', 'HEAD:tickets/TASK-102.md').stdout).not.toContain('Edited by a person');
    expect(read(fx, 'tickets/TASK-102.md')).toBe(edited);
    expect(fx.git('status', '--porcelain', '--', 'tickets/TASK-102.md').stdout).toBe(' M tickets/TASK-102.md\n');
  }, 60_000);

  it('PIP-002/S28 a staged edit refuses the sync, and stays staged', async () => {
    const { fx, edited, tip, out } = await otherTicketEdited('spec-sync-s28-staged', true);
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('cannot sync ticket/TASK-101 with main: staged changes in tickets/TASK-102.md; commit or unstage them first\n');
    expect(fx.git('rev-parse', 'HEAD').stdout.trim()).toBe(tip);
    expect(existsSync(join(fx.repo, '.git/MERGE_HEAD'))).toBe(false);
    expect(read(fx, 'tickets/TASK-102.md')).toBe(edited);
    expect(fx.git('status', '--porcelain', '--', 'tickets/TASK-102.md').stdout).toBe('M  tickets/TASK-102.md\n');
    expect(ticket(fx)).toMatchObject({ status: 'open', stage: null });
  }, 60_000);

  it('PIP-002/S24 Generated files that conflict in the sync are rebuilt', async () => {
    const fx = diverged(
      'spec-sync-s24',
      (f) => { write(f, 'spec/index.md', read(f, 'spec/index.md').replace(/^# .*$/m, '# Index edited on the branch')); },
      (f) => { write(f, 'spec/index.md', read(f, 'spec/index.md').replace(/^# .*$/m, '# Index edited on main')); },
    );
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(read(fx, 'spec/index.md')).not.toMatch(/edited on (the branch|main)/);
    // The sync committed what spec build writes from the merged spec.
    expect((await fx.spec('', 'build')).code).toBe(0);
    expect(fx.git('status', '--porcelain', '--', 'spec').stdout).toBe('');
  }, 60_000);

  it('PIP-002/S25 Any other conflict in the sync blocks the ticket', async () => {
    const fx = diverged(
      'spec-sync-s25',
      (f) => { write(f, EXPORT, read(f, EXPORT).replace("join('\\n\\n')", "join('\\n---\\n')")); },
      (f) => { write(f, EXPORT, read(f, EXPORT).replace("join('\\n\\n')", "join('\\n\\n\\n')")); },
    );
    const branchTip = fx.git('rev-parse', 'ticket/TASK-101').stdout.trim();
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`syncing ticket/TASK-101 with main conflicts in ${EXPORT}; a person must merge. TASK-101 is blocked; ticket/TASK-101 is as it was.\n`);
    expect(fx.git('rev-parse', 'HEAD').stdout.trim()).toBe(branchTip);
    expect(existsSync(join(fx.repo, '.git/MERGE_HEAD'))).toBe(false);
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
    const t = ticket(fx);
    expect(t).toMatchObject({ status: 'blocked', stage: null });
    expect(t?.questions.at(-1)).toMatchObject({ kind: 'blocker', raised_by: 'implementer', answer: null, text: `syncing ticket/TASK-101 with main conflicts in ${EXPORT}; a person must merge` });
  }, 60_000);
});
