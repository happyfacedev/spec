// WSP-004: every tree sees every ticket's live state, and a ticket is written where it is read from.
// Real git, on throwaway copies of chat-mini; other trees are real worktrees.
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { FileTicketStore } from '../../src/io/ticket-store';
import { ticketGitState } from '../../src/io/ticket-git';
import { git, isRepo, withCommandGitCache } from '../../src/io/git';
import { gitFixture, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const extra: string[] = [];
afterAll(() => {
  for (const fx of made) {
    fx.git('worktree', 'prune');
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    fx.cleanup();
  }
  for (const dir of extra) rmSync(dir, { recursive: true, force: true });
});

const fresh = (): Fx => {
  const fx = gitFixture('spec-live-state');
  made.push(fx);
  return fx;
};
const wt = (fx: Fx, id: string) => join(`${realpathSync(fx.repo)}.worktrees`, id);
/** The CLI run inside another tree, as a harness session there would. */
const specIn = (dir: string, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve(''), now: () => '2026-10-27T12:00:00.000Z' });
const path = (dir: string, id: string) => join(dir, 'tickets', `${id}.md`);
const statusOf = (text: string) => /^status: (.*)$/m.exec(text)?.[1];
const symbolicRefCalls = (calls: readonly (readonly unknown[])[]) =>
  calls.filter((call) => {
    if (call[0] !== 'git' || !Array.isArray(call[1])) return false;
    const args = call[1] as readonly unknown[];
    return args[0] === 'symbolic-ref';
  }).length;
const queueJson = async (fx: Fx) =>
  JSON.parse((await fx.spec('', 'queue', '--format', 'json')).stdout) as Record<'ready' | 'waiting' | 'blocked' | 'inProgress', { id: string; stage: string | null }[]>;
/** A branch from HEAD whose first commit rewrites one ticket file, checked out again on main afterwards. */
function branchWith(fx: Fx, id: string, f: (text: string) => string): void {
  fx.git('checkout', '-q', '-b', `ticket/${id}`);
  writeFileSync(path(fx.repo, id), f(readFileSync(path(fx.repo, id), 'utf8')));
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', `${id} work`);
  fx.git('checkout', '-q', 'main');
}
const RECORD = '  - at: 2026-10-27T09:00:00.000Z\n    role: tester\n    result: done\n    summary: Tested\n    verdict: null\n    assumed: []\n    duration_s: 3';

function ticketText(id: string, status: string, stage: string | null, questionIds: string[] = []): string {
  const questions = questionIds.length === 0
    ? 'questions: []'
    : `questions:\n${questionIds.map((question) => `  - id: ${question}\n    kind: blocker\n    text: What should ${question} answer?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null`).join('\n')}`;
  return `---\nid: ${id}\ntype: proposal\ntitle: ${id}\nstatus: ${status}\nstage: ${stage ?? 'null'}\ntouches: [SET-001]\nviolates: []\ndepends_on: []\nchanged: []\n${questions}\nhistory: []\n---\n${id} body.\n`;
}

function addTicketWorktree(fx: Fx, id: string): string {
  const dir = wt(fx, id);
  const added = fx.git('worktree', 'add', '-q', '-b', `ticket/${id}`, dir, 'main');
  if (added.code !== 0) throw new Error(`could not add ${id} worktree: ${added.stderr}`);
  return dir;
}

function mergedDoneTicket(prefix: string, questionIds = ['Q1']): { fx: Fx; leftover: string; stale: string } {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      writeFileSync(path(dir, 'PROP-051'), ticketText('PROP-051', 'in_progress', 'implementer', questionIds));
      writeFileSync(path(dir, 'PROP-090'), ticketText('PROP-090', 'open', null));
    },
  });
  made.push(fx);
  const leftover = addTicketWorktree(fx, 'PROP-051');
  writeFileSync(path(leftover, 'PROP-051'), ticketText('PROP-051', 'done', null, questionIds));
  fx.git('-C', leftover, 'add', 'tickets/PROP-051.md');
  fx.git('-C', leftover, 'commit', '-q', '-m', 'PROP-051: done');
  const stale = addTicketWorktree(fx, 'PROP-090');
  const merged = fx.git('merge', '--ff-only', 'ticket/PROP-051');
  if (merged.code !== 0) throw new Error(`could not merge PROP-051: ${merged.stderr}`);
  writeFileSync(path(leftover, 'PROP-051'), ticketText('PROP-051', 'in_progress', 'implementer', questionIds));
  return { fx, leftover, stale };
}

function moveOffMain(fx: Fx): void {
  const moved = fx.git('checkout', '-q', '-b', 'ticket/TASK-103');
  if (moved.code !== 0) throw new Error(`could not move off main: ${moved.stderr}`);
}

async function readTicket(dir: string, id: string) {
  return new FileTicketStore(join(dir, 'tickets'), dir).get(id);
}

async function queueIn(dir: string): Promise<{ stdout: string; code: number; stderr: string }> {
  return specIn(dir, 'queue');
}

describe('WSP-004: Every tree sees every ticket\'s live state', () => {
  it('WSP-004/S1 A stage running in another worktree, not yet committed', async () => {
    const fx = fresh();
    expect((await fx.spec('', 'worktree', 'add', 'BUG-301')).code).toBe(0);
    expect((await specIn(wt(fx, 'BUG-301'), 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    expect((await fx.spec('', 'queue')).stdout).toMatch(/## In progress \(1\)\n- BUG-301 bug · stage tester/);
    expect((await queueJson(fx)).inProgress).toEqual([expect.objectContaining({ id: 'BUG-301', stage: 'tester' })]);
    expect(statusOf(readFileSync(path(fx.repo, 'BUG-301'), 'utf8'))).toBe('open');
  }, 60_000);

  it('WSP-004/S2 A branch no tree has checked out', async () => {
    const fx = fresh();
    branchWith(fx, 'BUG-301', (t) => t.replace('history: []', `history:\n${RECORD}`).replace('changed: []', 'changed: [PRV-002/S3]'));
    expect((await fx.spec('', 'queue')).stdout).toMatch(/- BUG-301 bug · next implementer/);
    const t = await new FileTicketStore(join(fx.repo, 'tickets'), fx.repo).get('BUG-301');
    expect(t?.data.history.map((h) => h.role)).toEqual(['tester']);
  }, 60_000);

  it('WSP-004/S3 A branch already merged here', async () => {
    const fx = fresh();
    fx.git('branch', 'ticket/TASK-101');
    writeFileSync(path(fx.repo, 'TASK-101'), readFileSync(path(fx.repo, 'TASK-101'), 'utf8').replace('status: open', 'status: blocked'));
    fx.git('commit', '-q', '-am', 'block TASK-101 on main');
    const t = await new FileTicketStore(join(fx.repo, 'tickets'), fx.repo).get('TASK-101');
    expect(t?.data.status).toBe('blocked');
  }, 60_000);

  it('WSP-004/S4 The tree that has the branch checked out reads its own file', async () => {
    const fx = fresh();
    fx.git('checkout', '-q', '-b', 'ticket/PROP-205');
    writeFileSync(path(fx.repo, 'PROP-205'), readFileSync(path(fx.repo, 'PROP-205'), 'utf8').replace('status: open', 'status: in_progress').replace('stage: null', 'stage: spec-writer'));
    expect((await fx.spec('', 'queue')).stdout).toMatch(/- PROP-205 proposal · stage spec-writer/);
  }, 60_000);

  it('WSP-004/S5 An update to a ticket running in another worktree', async () => {
    const fx = fresh();
    expect((await fx.spec('', 'worktree', 'add', 'PROP-206')).code).toBe(0);
    const before = readFileSync(path(fx.repo, 'PROP-206'), 'utf8');
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    expect(readFileSync(path(wt(fx, 'PROP-206'), 'PROP-206'), 'utf8')).toMatch(/answer: yes/);
    expect(fx.git('-C', wt(fx, 'PROP-206'), 'status', '--porcelain').stdout).toContain('tickets/PROP-206.md');
    expect(readFileSync(path(fx.repo, 'PROP-206'), 'utf8')).toBe(before);
  }, 60_000);

  it('WSP-004/S6 An update to a ticket whose branch no tree has checked out', async () => {
    const fx = fresh();
    branchWith(fx, 'PROP-206', (t) => `${t}Extra line.\n`);
    const head = fx.git('rev-parse', 'HEAD').stdout;
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s', 'ticket/PROP-206').stdout.trim()).toBe('PROP-206: answer Q1');
    // R2, INS-016/R12: the message ends in exactly one trailer line.
    const body = fx.git('log', '-1', '--format=%B', 'ticket/PROP-206').stdout.replace(/\n+$/, '');
    expect(body.endsWith('\n\nSpec-Ticket: PROP-206')).toBe(true);
    expect(body.split('\n').filter((l) => l.startsWith('Spec-Ticket:'))).toEqual(['Spec-Ticket: PROP-206']);
    expect(fx.git('show', 'ticket/PROP-206:tickets/PROP-206.md').stdout).toMatch(/answer: yes/);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);
  }, 60_000);

  it('WSP-004/S7 The branch moved while it was being updated', async () => {
    const fx = fresh();
    branchWith(fx, 'PROP-206', (t) => `${t}Extra line.\n`);
    const real = process.env.PATH ?? '';
    // A git that moves the branch just before `commit-tree` builds the update's commit.
    const bin = tempDir('spec-git-shim-');
    extra.push(bin);
    mkdirSync(bin, { recursive: true });
    const shim = join(bin, 'git');
    writeFileSync(
      shim,
      `#!/bin/sh\nif [ "$1" = commit-tree ]; then\n  other=$(PATH="${real}" git commit-tree "$4^{tree}" -p "$4" -m other)\n  PATH="${real}" git update-ref refs/heads/ticket/PROP-206 "$other"\nfi\nPATH="${real}" exec git "$@"\n`,
    );
    chmodSync(shim, 0o755);
    const tipBefore = fx.git('rev-parse', 'ticket/PROP-206').stdout.trim();
    process.env.PATH = `${bin}:${real}`;
    let out;
    try {
      out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
    } finally {
      process.env.PATH = real;
    }
    expect(out.stderr).toContain('ticket/PROP-206 moved while it was being updated; try again');
    expect(out.code).toBe(1);
    expect(fx.git('rev-parse', 'ticket/PROP-206').stdout.trim()).not.toBe(tipBefore);
    expect(fx.git('show', 'ticket/PROP-206:tickets/PROP-206.md').stdout).not.toMatch(/answer: yes/);
  }, 60_000);

  it('WSP-004/S8 A ticket closed on the base branch, with its worktree kept', async () => {
    const plain = (id: string, status: string) =>
      ['---', `id: ${id}`, 'type: proposal', 'title: x', `status: ${status}`, 'stage: null', 'touches: [SET-001]', 'violates: []', 'depends_on: []', 'changed: []', 'questions: []', 'history: []', '---', 'Body.', ''].join('\n');
    const fx = gitFixture('spec-live-state-close', {
      setup: (dir) => {
        for (const [id, status] of [['PROP-063', 'done'], ['PROP-073', 'open'], ['PROP-090', 'open']]) writeFileSync(path(dir, id ?? ''), plain(id ?? '', status ?? ''));
      },
    });
    made.push(fx);
    expect((await fx.spec('', 'worktree', 'add', 'PROP-073')).code).toBe(0);
    const kept = path(wt(fx, 'PROP-073'), 'PROP-073');
    writeFileSync(kept, readFileSync(kept, 'utf8').replace('status: open', 'status: blocked'));
    // PROP-090's branch is made from "main" before the close commit.
    expect((await fx.spec('', 'worktree', 'add', 'PROP-090')).code).toBe(0);

    const closed = await fx.spec('', 'ticket', 'close', 'PROP-073', '--superseded-by', 'PROP-063');
    expect(closed.code, closed.stderr).toBe(0);
    expect(fx.git('show', 'main:tickets/PROP-073.md').stdout).toMatch(/^status: absorbed$/m);

    for (const dir of [fx.repo, wt(fx, 'PROP-073'), wt(fx, 'PROP-090')]) {
      const queue = JSON.parse((await specIn(dir, 'queue', '--format', 'json')).stdout) as Record<'ready' | 'waiting' | 'blocked' | 'inProgress', { id: string }[]>;
      const listed = [...queue.ready, ...queue.waiting, ...queue.blocked, ...queue.inProgress].map((e) => e.id);
      expect(listed, dir).not.toContain('PROP-073');
      expect(listed, dir).toContain('PROP-090');
      const gate = JSON.parse((await specIn(dir, 'gate', 'PROP-073', '--format', 'json')).stdout) as { blockers: { kind: string; id: string }[] };
      expect(gate.blockers.map((b) => [b.kind, b.id]), dir).toEqual([['absorbed', 'PROP-063']]);
      const read = await new FileTicketStore(join(dir, 'tickets'), dir).get('PROP-073');
      expect(read?.data.status, dir).toBe('absorbed');
    }
    expect(statusOf(readFileSync(kept, 'utf8'))).toBe('blocked');
    expect(statusOf(readFileSync(path(wt(fx, 'PROP-090'), 'PROP-073'), 'utf8'))).toBe('open');
  }, 120_000);

  it('WSP-004/S9 A ticket done and merged on the base branch, with a leftover worktree', async () => {
    const { fx, leftover, stale } = mergedDoneTicket('spec-live-state-done');
    for (const dir of [fx.repo, leftover, stale]) {
      const out = await queueIn(dir);
      expect(out.code, out.stderr).toBe(0);
      expect(out.stdout).toMatch(/^Done: 1$/m);
      const queue = JSON.parse((await specIn(dir, 'queue', '--format', 'json')).stdout) as Awaited<ReturnType<typeof queueJson>>;
      expect([...queue.ready, ...queue.waiting, ...queue.blocked, ...queue.inProgress].map((entry) => entry.id), dir).not.toContain('PROP-051');
      expect((await readTicket(dir, 'PROP-051'))?.data.status, dir).toBe('done');
    }
    const kept = readFileSync(path(leftover, 'PROP-051'), 'utf8');
    expect(statusOf(kept)).toBe('in_progress');
    expect(/^stage: implementer$/m.test(kept)).toBe(true);
  }, 120_000);

  it('WSP-004/S10 An update to a ticket done and merged on the base branch', async () => {
    const { fx, leftover, stale } = mergedDoneTicket('spec-live-state-done-answer');
    const baseBefore = readFileSync(path(fx.repo, 'PROP-051'), 'utf8');
    const leftoverBefore = readFileSync(path(leftover, 'PROP-051'), 'utf8');
    const staleBefore = readFileSync(path(stale, 'PROP-051'), 'utf8');
    const out = await specIn(stale, 'ticket', 'answer', 'PROP-051', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    expect((await readTicket(fx.repo, 'PROP-051'))?.data.questions.find((q) => q.id === 'Q1')?.answer).toBe('yes');
    expect(readFileSync(path(fx.repo, 'PROP-051'), 'utf8')).not.toBe(baseBefore);
    expect(fx.git('status', '--porcelain').stdout).toContain('M tickets/PROP-051.md');
    expect(readFileSync(path(leftover, 'PROP-051'), 'utf8')).toBe(leftoverBefore);
    expect(readFileSync(path(stale, 'PROP-051'), 'utf8')).toBe(staleBefore);
  }, 120_000);

  it('WSP-004/S11 An update to a ticket read from the base branch, which no tree has checked out', async () => {
    const { fx, leftover, stale } = mergedDoneTicket('spec-live-state-done-commit');
    moveOffMain(fx);
    const mainBefore = fx.git('rev-parse', 'main').stdout.trim();
    const staleHead = fx.git('-C', stale, 'rev-parse', 'HEAD').stdout.trim();
    const staleStatus = fx.git('-C', stale, 'status', '--porcelain').stdout;
    const leftoverBefore = readFileSync(path(leftover, 'PROP-051'), 'utf8');
    const out = await specIn(stale, 'ticket', 'answer', 'PROP-051', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s', 'main').stdout.trim()).toBe('PROP-051: answer Q1');
    const body = fx.git('log', '-1', '--format=%B', 'main').stdout.replace(/\n+$/, '');
    expect(body.endsWith('\n\nSpec-Ticket: PROP-051')).toBe(true);
    expect(body.split('\n').filter((line) => line.startsWith('Spec-Ticket:'))).toEqual(['Spec-Ticket: PROP-051']);
    expect(fx.git('show', 'main:tickets/PROP-051.md').stdout).toMatch(/answer: yes/);
    expect(fx.git('rev-parse', 'main').stdout.trim()).not.toBe(mainBefore);
    expect(fx.git('-C', stale, 'rev-parse', 'HEAD').stdout.trim()).toBe(staleHead);
    expect(fx.git('-C', stale, 'status', '--porcelain').stdout).toBe(staleStatus);
    expect(readFileSync(path(leftover, 'PROP-051'), 'utf8')).toBe(leftoverBefore);
  }, 120_000);

  it('WSP-004/S12 The base branch moved while a ticket read from it was being updated', async () => {
    const { fx, leftover, stale } = mergedDoneTicket('spec-live-state-base-moved');
    moveOffMain(fx);
    const mainBefore = fx.git('rev-parse', 'main').stdout.trim();
    const branchTipBefore = fx.git('rev-parse', 'ticket/PROP-051').stdout.trim();
    const leftoverBefore = readFileSync(path(leftover, 'PROP-051'), 'utf8');
    const real = process.env.PATH ?? '';
    const bin = tempDir('spec-git-base-shim-');
    extra.push(bin);
    mkdirSync(bin, { recursive: true });
    const shim = join(bin, 'git');
    writeFileSync(
      shim,
      `#!/bin/sh\nif [ "$1" = commit-tree ] && [ "$6" = "PROP-051: answer Q1" ]; then\n  other=$(PATH="${real}" git commit-tree "$4^{tree}" -p "$4" -m other)\n  PATH="${real}" git update-ref refs/heads/main "$other" "$4"\nfi\nPATH="${real}" exec git "$@"\n`,
    );
    chmodSync(shim, 0o755);
    process.env.PATH = `${bin}:${real}`;
    let out;
    try {
      out = await specIn(stale, 'ticket', 'answer', 'PROP-051', 'Q1', 'yes');
    } finally {
      process.env.PATH = real;
    }
    expect(out.stderr.trim()).toBe('main moved while it was being updated; try again');
    expect(out.code).toBe(1);
    expect(fx.git('rev-parse', 'main').stdout.trim()).not.toBe(mainBefore);
    expect(fx.git('rev-parse', 'ticket/PROP-051').stdout.trim()).toBe(branchTipBefore);
    expect(fx.git('show', 'main:tickets/PROP-051.md').stdout).not.toMatch(/answer: yes/);
    expect(fx.git('show', 'ticket/PROP-051:tickets/PROP-051.md').stdout).not.toMatch(/answer: yes/);
    expect(readFileSync(path(leftover, 'PROP-051'), 'utf8')).toBe(leftoverBefore);
  }, 120_000);

  it('WSP-004/S13 A ticket done on its branch but not merged yet', async () => {
    const fx = fresh();
    const tree = addTicketWorktree(fx, 'BUG-301');
    const done = readFileSync(path(tree, 'BUG-301'), 'utf8').replace(/^status: open$/m, 'status: done');
    writeFileSync(path(tree, 'BUG-301'), done);
    fx.git('-C', tree, 'add', 'tickets/BUG-301.md');
    fx.git('-C', tree, 'commit', '-q', '-m', 'BUG-301: done');
    expect(fx.git('merge-base', '--is-ancestor', 'ticket/BUG-301', 'main').code).not.toBe(0);
    expect((await fx.spec('', 'queue')).stdout).toMatch(/^Done: 1$/m);
    expect((await readTicket(fx.repo, 'BUG-301'))?.data.status).toBe('done');
    expect(statusOf(readFileSync(path(fx.repo, 'BUG-301'), 'utf8'))).toBe('open');
  }, 60_000);

  it('WSP-004/S14 A base branch that does not exist reads nothing from it', async () => {
    const fx = gitFixture('spec-live-state-no-base', {
      setup: (dir) => {
        writeFileSync(path(dir, 'PROP-051'), ticketText('PROP-051', 'done', null));
      },
    });
    made.push(fx);
    const configPath = join(fx.repo, 'spec/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.baseBranch = 'trunk';
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const tree = addTicketWorktree(fx, 'PROP-051');
    writeFileSync(path(tree, 'PROP-051'), ticketText('PROP-051', 'in_progress', 'implementer'));
    expect(fx.git('show-ref', '--verify', 'refs/heads/trunk').code).not.toBe(0);
    const out = await fx.spec('', 'queue');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/## In progress \(1\)\n- PROP-051 proposal · stage implementer/);
    expect((await readTicket(fx.repo, 'PROP-051'))?.data.status).toBe('in_progress');
  }, 60_000);

  it('WSP-004/S15 A second update to a ticket read from the base branch keeps the first', async () => {
    const { fx, stale } = mergedDoneTicket('spec-live-state-two-answers', ['Q1', 'Q2']);
    const first = await specIn(stale, 'ticket', 'answer', 'PROP-051', 'Q1', 'yes');
    expect(first.code, first.stderr).toBe(0);
    const second = await specIn(stale, 'ticket', 'answer', 'PROP-051', 'Q2', 'no');
    expect(second.code, second.stderr).toBe(0);
    for (const dir of [fx.repo, stale]) {
      const questions = (await readTicket(dir, 'PROP-051'))?.data.questions;
      expect(questions?.find((q) => q.id === 'Q1')?.answer, dir).toBe('yes');
      expect(questions?.find((q) => q.id === 'Q2')?.answer, dir).toBe('no');
    }
    const text = readFileSync(path(fx.repo, 'PROP-051'), 'utf8');
    expect(statusOf(text)).toBe('done');
    expect(fx.git('status', '--porcelain').stdout).toContain('M tickets/PROP-051.md');
  }, 120_000);

  it('WSP-004/S16 A ticket done on the base branch whose branch has new work', async () => {
    const fx = gitFixture('spec-live-state-unmerged-done', {
      setup: (dir) => {
        writeFileSync(path(dir, 'PROP-051'), ticketText('PROP-051', 'done', null, ['Q1']));
      },
    });
    made.push(fx);
    const tree = addTicketWorktree(fx, 'PROP-051');
    writeFileSync(join(tree, 'branch-only.txt'), 'new work on ticket branch\n');
    fx.git('-C', tree, 'add', 'branch-only.txt');
    fx.git('-C', tree, 'commit', '-q', '-m', 'PROP-051: new branch work');
    writeFileSync(path(tree, 'PROP-051'), ticketText('PROP-051', 'in_progress', 'implementer', ['Q1']));
    const baseBefore = readFileSync(path(fx.repo, 'PROP-051'), 'utf8');
    const queue = await fx.spec('', 'queue');
    expect(queue.code, queue.stderr).toBe(0);
    expect(queue.stdout).toMatch(/## In progress \(1\)\n- PROP-051 proposal · stage implementer/);
    const answered = await fx.spec('', 'ticket', 'answer', 'PROP-051', 'Q1', 'yes');
    expect(answered.code, answered.stderr).toBe(0);
    expect((await readTicket(tree, 'PROP-051'))?.data.questions.find((q) => q.id === 'Q1')?.answer).toBe('yes');
    expect(readFileSync(path(tree, 'PROP-051'), 'utf8')).not.toBe(baseBefore);
    expect(readFileSync(path(fx.repo, 'PROP-051'), 'utf8')).toBe(baseBefore);
  }, 120_000);

  it('WSP-004/S17 A ticket done on the base branch with no branch of its own', async () => {
    const fx = gitFixture('spec-live-state-no-ticket-branch', {
      setup: (dir) => {
        rmSync(join(dir, 'tickets'), { recursive: true, force: true });
        mkdirSync(join(dir, 'tickets'));
        writeFileSync(path(dir, 'TASK-102'), ticketText('TASK-102', 'open', null).replace('type: proposal', 'type: task'));
      },
    });
    made.push(fx);
    const stale = addTicketWorktree(fx, 'PROP-090');
    writeFileSync(path(fx.repo, 'TASK-102'), ticketText('TASK-102', 'done', null).replace('type: proposal', 'type: task'));
    fx.git('add', 'tickets/TASK-102.md');
    fx.git('commit', '-q', '-m', 'TASK-102: done');
    expect(fx.git('show-ref', '--verify', 'refs/heads/ticket/TASK-102').code).not.toBe(0);
    const out = await queueIn(stale);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/## Ready \(1\)\n- TASK-102 task · next implementer/);
  }, 60_000);

  it('WSP-004/S18 The leftover worktree of a ticket done and merged on the base branch is listed as merged', async () => {
    const { fx, leftover } = mergedDoneTicket('spec-live-state-list-merged');
    const out = await specIn(fx.repo, 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain(`PROP-051 done ${leftover} (merged into main; spec worktree remove PROP-051 removes it)`);
    expect(existsSync(leftover)).toBe(true);
    expect(statusOf(readFileSync(path(leftover, 'PROP-051'), 'utf8'))).toBe('in_progress');
  }, 120_000);

  it('keeps a tag with the base branch name from hiding the branch tip', async () => {
    const { fx, leftover } = mergedDoneTicket('spec-live-state-base-tag');
    const tagged = fx.git('tag', 'main');
    expect(tagged.code, tagged.stderr).toBe(0);
    const out = await specIn(fx.repo, 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain(`PROP-051 done ${leftover} (merged into main; spec worktree remove PROP-051 removes it)`);
  }, 120_000);

  it('accepts a remote-tracking base for merged marks without treating it as a write branch', () => {
    const { fx } = mergedDoneTicket('spec-live-state-remote-base');
    const configPath = join(fx.repo, 'spec/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.baseBranch = 'origin/main';
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const tip = fx.git('rev-parse', 'main').stdout.trim();
    const remote = fx.git('update-ref', 'refs/remotes/origin/main', tip);
    expect(remote.code, remote.stderr).toBe(0);

    const state = ticketGitState(fx.repo, 'tickets', 'origin/main');
    expect(state.mergedIntoBase.has('PROP-051')).toBe(true);
    expect(state.live.get('PROP-051')?.branch).toBe('ticket/PROP-051');
  }, 60_000);

  it('does not use a remote-tracking base as a live write branch for an absorbed ticket', () => {
    const { fx } = mergedDoneTicket('spec-live-state-remote-absorbed');
    const ticketFile = path(fx.repo, 'PROP-051');
    const absorbed = readFileSync(ticketFile, 'utf8').replace(/^status: done$/m, 'status: absorbed\nabsorbed_into: PROP-063');
    writeFileSync(ticketFile, absorbed);
    fx.git('add', 'tickets/PROP-051.md');
    fx.git('commit', '-q', '-m', 'PROP-051: absorbed');
    const configPath = join(fx.repo, 'spec/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.baseBranch = 'origin/main';
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const tip = fx.git('rev-parse', 'main').stdout.trim();
    const remote = fx.git('update-ref', 'refs/remotes/origin/main', tip);
    expect(remote.code, remote.stderr).toBe(0);
    expect(fx.git('tag', 'absorbed-base', tip).code).toBe(0);

    for (const base of ['origin/main', 'absorbed-base', tip]) {
      const state = ticketGitState(fx.repo, 'tickets', base);
      expect(state.mergedIntoBase.has('PROP-051'), base).toBe(true);
      expect(state.live.get('PROP-051')?.branch, base).toBe('ticket/PROP-051');
    }
  }, 60_000);

  it('matches symbolic-ref inside a linked ticket worktree without the fallback', () => {
    const fx = fresh();
    const tree = addTicketWorktree(fx, 'TASK-101');
    const oracle = fx.git('-C', tree, 'symbolic-ref', '--quiet', '--short', 'HEAD');
    expect(oracle.code, oracle.stderr).toBe(0);
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      const state = withCommandGitCache(() => ticketGitState(tree, null, 'main'));
      expect(symbolicRefCalls(spawn.mock.calls)).toBe(0);
      expect(state.current).toBe(oracle.stdout.trim().slice('ticket/'.length));
      expect(state.worktrees.get('TASK-101')).toBe(realpathSync(tree));
    } finally {
      spawn.mockRestore();
    }
  }, 60_000);

  it('matches git branch --merged for local, remote, tag, and commit bases', () => {
    const fx = fresh();
    branchWith(fx, 'TASK-101', (text) => `${text}Branch content.\n`);
    const merged = fx.git('merge', '--ff-only', 'ticket/TASK-101');
    expect(merged.code, merged.stderr).toBe(0);
    const tip = fx.git('rev-parse', 'main').stdout.trim();
    expect(fx.git('update-ref', 'refs/remotes/origin/main', tip).code).toBe(0);
    expect(fx.git('tag', 'base-tag', tip).code).toBe(0);

    for (const base of ['main', 'origin/main', 'base-tag', tip]) {
      const oracle = fx.git('branch', '--merged', base, '--format=%(refname)', '--list', 'ticket/*');
      const ids = oracle.stdout.split('\n').filter(Boolean).map((ref) => ref.replace(/^refs\/heads\/ticket\//, '')).sort();
      const state = ticketGitState(fx.repo, null, base);
      expect([...state.mergedIntoBase].sort(), base).toEqual(ids);
    }
  }, 60_000);

  it('matches symbolic-ref in a ticket branch with a separate git dir', () => {
    const fx = fresh();
    const checkout = fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
    expect(checkout.code, checkout.stderr).toBe(0);
    const separateParent = tempDir('spec-separate-git-dir-');
    const separate = join(separateParent, 'repo.git');
    extra.push(separateParent);
    const initialized = fx.git('init', '-q', '--separate-git-dir', separate);
    expect(initialized.code, initialized.stderr).toBe(0);

    const oracle = fx.git('symbolic-ref', '--quiet', '--short', 'HEAD');
    expect(oracle.code, oracle.stderr).toBe(0);
    const facts = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'];
    const factOracle = new Map(facts.map((fact) => [fact, fx.git('rev-parse', fact).stdout]));
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      const combined = withCommandGitCache(() => {
        const state = ticketGitState(fx.repo, null, 'main');
        const derivedFacts = new Map(facts.map((fact) => [fact, git(fx.repo, ['rev-parse', fact]).stdout]));
        return { state, derivedFacts };
      });
      expect(symbolicRefCalls(spawn.mock.calls)).toBe(1);
      expect(combined.state.current).toBe(oracle.stdout.trim().slice('ticket/'.length));
      expect(combined.state.worktrees.get('TASK-101')).toBe(realpathSync(fx.repo));
      expect(combined.state.primaryWorktree).toBe(realpathSync(fx.repo));
      for (const fact of facts) expect(combined.derivedFacts.get(fact)).toBe(factOracle.get(fact));
    } finally {
      spawn.mockRestore();
    }
  }, 60_000);

  it('matches symbolic-ref inside a submodule', () => {
    const parent = fresh();
    const source = fresh();
    const submodule = join(parent.repo, 'submodule');
    const added = parent.git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source.repo, 'submodule');
    expect(added.code, added.stderr).toBe(0);
    const checkout = parent.git('-C', submodule, 'checkout', '-q', '-b', 'ticket/TASK-101');
    expect(checkout.code, checkout.stderr).toBe(0);

    const oracle = parent.git('-C', submodule, 'symbolic-ref', '--quiet', '--short', 'HEAD');
    expect(oracle.code, oracle.stderr).toBe(0);
    const facts = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'];
    const factOracle = new Map(facts.map((fact) => [fact, git(submodule, ['rev-parse', fact], {}).stdout]));
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      const combined = withCommandGitCache(() => {
        const state = ticketGitState(submodule, null, 'main');
        const derivedFacts = new Map(facts.map((fact) => [fact, git(submodule, ['rev-parse', fact]).stdout]));
        return { state, derivedFacts };
      });
      expect(symbolicRefCalls(spawn.mock.calls)).toBe(1);
      expect(combined.state.current).toBe(oracle.stdout.trim().slice('ticket/'.length));
      expect(combined.state.worktrees.get('TASK-101')).toBe(realpathSync(submodule));
      expect(combined.state.primaryWorktree).toBe(realpathSync(submodule));
      for (const fact of facts) expect(combined.derivedFacts.get(fact)).toBe(factOracle.get(fact));
    } finally {
      spawn.mockRestore();
    }
  }, 60_000);

  it('uses for-each-ref like rev-parse --git-dir to recognize repository directories', () => {
    const fx = fresh();
    const bare = tempDir('spec-live-state-bare-');
    const outside = tempDir('spec-live-state-outside-');
    expect(git(bare, ['init', '--bare', '-q', '-b', 'main']).code).toBe(0);

    for (const directory of [fx.repo, join(fx.repo, '.git'), bare, outside]) {
      const oracle = git(directory, ['rev-parse', '--git-dir'], {});
      expect(isRepo(directory)).toBe(oracle.code === 0);
      const state = ticketGitState(directory, null, 'main');
      expect(state.repoTop !== null, directory).toBe(oracle.code === 0);
    }
  }, 60_000);

  it('uses HEAD ancestry for a detached checkout with a remote-tracking base', () => {
    const fx = fresh();
    const branch = fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
    expect(branch.code, branch.stderr).toBe(0);
    writeFileSync(path(fx.repo, 'TASK-101'), `${readFileSync(path(fx.repo, 'TASK-101'), 'utf8')}Branch-only change.\n`);
    fx.git('add', 'tickets/TASK-101.md');
    fx.git('commit', '-q', '-m', 'TASK-101: branch update');
    const remote = fx.git('update-ref', 'refs/remotes/origin/main', fx.git('rev-parse', 'main').stdout.trim());
    expect(remote.code, remote.stderr).toBe(0);
    const detached = fx.git('checkout', '-q', '--detach', 'HEAD');
    expect(detached.code, detached.stderr).toBe(0);

    const symbolic = fx.git('symbolic-ref', '--quiet', '--short', 'HEAD');
    expect(symbolic.code).not.toBe(0);
    const atHead = fx.git('branch', '--merged', 'HEAD', '--format=%(refname)', '--list', 'ticket/*').stdout;
    const atRemote = fx.git('branch', '--merged', 'origin/main', '--format=%(refname)', '--list', 'ticket/*').stdout;
    expect(atHead).toContain('refs/heads/ticket/TASK-101');
    expect(atRemote).not.toContain('refs/heads/ticket/TASK-101');

    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      const state = withCommandGitCache(() => ticketGitState(fx.repo, 'tickets', 'origin/main'));
      expect(symbolicRefCalls(spawn.mock.calls)).toBe(1);
      expect(state.current).toBeNull();
      expect(state.mergedIntoBase.has('TASK-101')).toBe(false);
      expect(state.live.has('TASK-101')).toBe(false);
    } finally {
      spawn.mockRestore();
    }
  }, 60_000);
});
