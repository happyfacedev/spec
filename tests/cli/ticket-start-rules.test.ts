// PIP-002/S1..S33: starting a stage on the ticket's branch, in real git.
import { appendFileSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const f of made) {
    f.git('worktree', 'prune');
    rmSync(`${realpathSync(f.repo)}.worktrees`, { recursive: true, force: true });
    f.cleanup();
  }
});

/** A fresh git copy of chat-mini; `edit` changes its files before the first commit. */
function fresh(edit?: (dir: string) => void): Fx {
  const f = gitFixture('spec-start-rules', { setup: edit });
  made.push(f);
  return f;
}
const file = (f: Fx, id: string) => join(f.repo, 'tickets', `${id}.md`);
const edit = (f: Fx, id: string, fn: (text: string) => string) => { writeFileSync(file(f, id), fn(readFileSync(file(f, id), 'utf8'))); };
const entry = (role: string, result: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: ${result}, summary: x, verdict: ${verdict}, assumed: [] }`;
const branch = (f: Fx) => f.git('branch', '--show-current').stdout.trim();
/** Replaces a ticket file's history and questions in `dir`, for fixtures edited before the first commit. */
const prepare = (id: string, history: string[], extra: (t: string) => string = (t) => t) => (dir: string) => {
  const p = join(dir, 'tickets', `${id}.md`);
  writeFileSync(p, extra(readFileSync(p, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`)));
};

describe('PIP-002 start a stage on the ticket branch', () => {
  it('PIP-002/S1 Start the first stage of a new ticket', async () => {
    const f = fresh();
    const before = readFileSync(file(f, 'PROP-201'), 'utf8');
    const out = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer', '--format', 'json');
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'PROP-201', branch: 'ticket/PROP-201', created: true, stage: 'spec-writer', status: 'in_progress' });
    expect(branch(f)).toBe('ticket/PROP-201');
    expect(readFileSync(file(f, 'PROP-201'), 'utf8')).toBe(before.replace('status: open', 'status: in_progress').replace('stage: null', 'stage: spec-writer'));
  });

  it('PIP-002/S2 Text output', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(out.stdout.trim()).toBe('PROP-201: stage spec-writer on ticket/PROP-201 (created from main)');
  });

  it('PIP-002/S3 Starting the running stage again changes nothing', async () => {
    const f = fresh();
    await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    const out = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer', '--format', 'json');
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as { created: boolean }).created).toBe(false);
  });

  it('PIP-002/S4 An existing branch is checked out, not created', async () => {
    const f = fresh(prepare('BUG-301', [entry('tester', 'done')]));
    f.git('branch', 'ticket/BUG-301');
    const out = await f.spec('', 'ticket', 'start', 'BUG-301', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(branch(f)).toBe('ticket/BUG-301');
    expect(out.stdout.trim()).toBe('BUG-301: stage implementer on ticket/BUG-301');
  });

  it('PIP-002/S5 The gate refuses the ticket', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'PROP-206', 'spec-writer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('PROP-206 is not ready; spec gate PROP-206 lists the blockers. Nothing starts while a blocker is open.');
  });

  it('PIP-002/S6 A done ticket', async () => {
    const f = fresh();
    edit(f, 'TASK-103', (t) => t.replace(/^status: .*$/m, 'status: done'));
    const out = await f.spec('', 'ticket', 'start', 'TASK-103', 'reviewer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('TASK-103 is done');
  });

  it('PIP-002/S7 A role out of order', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'PROP-202', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('the next stage of PROP-202 is spec-writer, not implementer');
  });

  it('PIP-002/S8 Answering the review-round question grants one more round', async () => {
    const history = [entry('implementer', 'done'), entry('reviewer', 'done', 'changes'), entry('implementer', 'done'), entry('reviewer', 'done', 'changes'), entry('implementer', 'done'), entry('reviewer', 'done', 'changes')];
    const question = 'questions:\n  - id: Q1\n    kind: blocker\n    text: the reviewer asked for changes 3 times; a person must decide. How should TASK-101 proceed?\n    default: null\n    cites: []\n    answer: carry on\n    raised_by: overseer';
    const f = fresh(prepare('TASK-101', history, (t) => t.replace('questions: []', question)));
    f.git('branch', 'ticket/TASK-101');
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'TASK-101', branch: 'ticket/TASK-101', created: false, stage: 'implementer', status: 'in_progress' });
  });

  it('PIP-002/S29 Each further round needs its own answer', async () => {
    const rounds = [entry('implementer', 'done'), entry('reviewer', 'done', 'changes')];
    const history = [...rounds, ...rounds, ...rounds, ...rounds];
    const question = 'questions:\n  - id: Q1\n    kind: blocker\n    text: the reviewer asked for changes 3 times; a person must decide. How should TASK-101 proceed?\n    default: null\n    cites: []\n    answer: carry on\n    raised_by: overseer';
    const f = fresh(prepare('TASK-101', history, (t) => t.replace('questions: []', question)));
    const before = readFileSync(file(f, 'TASK-101'), 'utf8');
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('TASK-101 is blocked: the reviewer asked for changes 4 times; a person must decide');
    const after = readFileSync(file(f, 'TASK-101'), 'utf8');
    expect(after).toBe(before);
    expect(after).toMatch(/^status: (?!in_progress).*$/m);
    expect(after).toMatch(/^stage: null$/m);
  });

  it('PIP-002/S9 An unknown role', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'boss');
    expect(out.stderr).toContain('Unknown role boss. Roles: spec-writer, spec-review, tester, implementer, reviewer');
    expect(out.code).toBe(2);
  });

  const specRound = [entry('spec-writer', 'done'), entry('spec-review', 'done', 'changes')];
  const answered = (who: 'spec-review' | 'reviewer', times: number, id: string) =>
    `questions:\n  - id: Q1\n    kind: blocker\n    text: the ${who} asked for changes ${times} times; a person must decide. How should ${id} proceed?\n    default: null\n    cites: []\n    answer: carry on\n    raised_by: overseer`;

  it('PIP-002/S30 Answering the spec-review round question grants one more spec round', async () => {
    const three = [...specRound, ...specRound, ...specRound];
    const f = fresh(prepare('PROP-201', three, (t) => t.replace('questions: []', answered('spec-review', 3, 'PROP-201'))));
    const ok = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer', '--format', 'json');
    expect(ok.code, ok.stderr).toBe(0);
    expect((JSON.parse(ok.stdout) as { stage: string }).stage).toBe('spec-writer');

    const four = [...three, ...specRound];
    const g = fresh(prepare('PROP-201', four, (t) => t.replace('questions: []', answered('spec-review', 3, 'PROP-201'))));
    const before = readFileSync(file(g, 'PROP-201'), 'utf8');
    const refused = await g.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('PROP-201 is blocked: the spec-review asked for changes 4 times; a person must decide');
    expect(readFileSync(file(g, 'PROP-201'), 'utf8')).toBe(before);

    // An answer about the reviewer's rounds grants no spec round.
    const wrong = fresh(prepare('PROP-201', three, (t) => t.replace('questions: []', answered('reviewer', 3, 'PROP-201'))));
    const noGrant = await wrong.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(noGrant.code).toBe(1);
    expect(noGrant.stderr).toContain('PROP-201 is blocked: the spec-review asked for changes 3 times; a person must decide');

    // Nor does an answer about the spec review's rounds grant a reviewer round.
    const reviewerRound = [entry('implementer', 'done'), entry('reviewer', 'done', 'changes')];
    const history = [entry('spec-writer', 'done'), entry('spec-review', 'done', 'approve'), entry('tester', 'done'), ...reviewerRound, ...reviewerRound, ...reviewerRound];
    const other = fresh(prepare('PROP-201', history, (t) => t.replace('questions: []', answered('spec-review', 3, 'PROP-201'))));
    const reviewer = await other.spec('', 'ticket', 'start', 'PROP-201', 'implementer');
    expect(reviewer.code).toBe(1);
    expect(reviewer.stderr).toContain('PROP-201 is blocked: the reviewer asked for changes 3 times; a person must decide');
  });

  it('PIP-002/S31 A spec review in progress holds the tester back', async () => {
    const f = fresh(prepare('PROP-201', [entry('spec-writer', 'done')]));
    const started = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-review');
    expect(started.code, started.stderr).toBe(0);
    const out = await f.spec('', 'ticket', 'start', 'PROP-201', 'tester');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('the next stage of PROP-201 is spec-review, not tester');
    expect(readFileSync(file(f, 'PROP-201'), 'utf8')).toMatch(/^stage: spec-review$/m);
  });

  it('PIP-002/S10 An unknown ticket', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'TASK-109', 'implementer');
    expect(out.stderr).toMatch(/^Unknown TASK-109\. Did you mean TASK-10\d\?/);
    expect(out.code).toBe(2);
  });

  it('PIP-002/S11 Wrong number of arguments', async () => {
    const f = fresh();
    const out = await f.spec('', 'ticket', 'start', 'TASK-101');
    expect(out.stderr.startsWith('usage: spec ticket new < ticket.json | spec ticket start <TICKET> <role> | spec ticket advance <TICKET> [--report-file <path>|--report -] | spec ticket answer <TICKET> <Q> <answer>')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('PIP-002/S12 Not a git repository', async () => {
    const f = fresh();
    rmSync(join(f.repo, '.git'), { recursive: true, force: true });
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/ is not a git repository/);
    expect(out.stderr).toContain(f.repo.split('/').at(-1) ?? '');
  });

  it('PIP-002/S13 The branch is checked out in another worktree', async () => {
    const f = fresh();
    mkdirSync(`${realpathSync(f.repo)}.worktrees`, { recursive: true });
    expect((await f.spec('', 'worktree', 'add', 'TASK-101')).code).toBe(0);
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain(`ticket/TASK-101 is checked out in ${realpathSync(f.repo)}.worktrees/TASK-101; run the stages of TASK-101 there`);
  });

  it('PIP-002/S14 Another ticket stage is running in this tree', async () => {
    const f = fresh();
    expect((await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain(
      'PROP-201 has its spec-writer stage running in this tree; wait for it to finish and run spec ticket advance PROP-201 first, or give TASK-101 its own worktree (spec worktree add TASK-101)',
    );
  });

  it('PIP-002/S15 A conflicting ticket is running elsewhere', async () => {
    const f = fresh();
    mkdirSync(`${realpathSync(f.repo)}.worktrees`, { recursive: true });
    await f.spec('', 'worktree', 'add', 'BUG-301');
    const dir = join(`${realpathSync(f.repo)}.worktrees`, 'BUG-301');
    const started = await run({ argv: ['ticket', 'start', 'BUG-301', 'tester', '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve('') });
    expect(started.code, started.stderr).toBe(0);
    const out = await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(out.code).toBe(1);
    expect(out.stderr.startsWith('PROP-201 must wait for BUG-301, which is running: ')).toBe(true);
    expect(out.stderr.trimEnd().endsWith('Start PROP-201 once BUG-301 is done and merged.')).toBe(true);
  });

  /** A history entry with its measured duration, so the stage's own start is known: `at` minus `seconds`. */
  const timed = (role: string, at: string, seconds: number, verdict = 'null') =>
    `  - { at: "${at}", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [], duration_s: ${String(seconds)} }`;
  const wt = (f: Fx, id: string) => join(`${realpathSync(f.repo)}.worktrees`, id);
  /** Runs `spec` in the ticket's worktree, as if at `now`. */
  const inTree = (f: Fx, id: string, now: string, ...argv: string[]) => {
    const dir = wt(f, id);
    return run({ argv: [...argv, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve(''), now: () => now });
  };
  const addTree = async (f: Fx, id: string) => {
    mkdirSync(`${realpathSync(f.repo)}.worktrees`, { recursive: true });
    expect((await f.spec('', 'worktree', 'add', id)).code).toBe(0);
  };
  /** TASK-101 (works on PRV-001) has a recorded implementer stage, started 2026-10-28T07:59:00Z, and no stage running. */
  const taskDone = prepare('TASK-101', [timed('implementer', '2026-10-28T08:00:00.000Z', 60)]);

  it('PIP-002/S32 A running ticket is never held back by a ticket that started after it', async () => {
    const f = fresh(taskDone);
    await addTree(f, 'PROP-201');
    // PROP-201 touches PRV-001 and providers.ProviderId, which TASK-101's feature uses: they conflict.
    const prop = await inTree(f, 'PROP-201', '2026-10-28T09:00:00.000Z', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(prop.code, prop.stderr).toBe(0);
    const out = await run({ argv: ['ticket', 'start', 'TASK-101', 'reviewer', '--format', 'json', '--root', join(f.repo, 'spec')], env: {}, cwd: f.repo, scriptPath: undefined, stdin: () => Promise.resolve(''), now: () => '2026-10-28T10:00:00.000Z' });
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', stage: 'reviewer' });

    // Once the spec-writer stage of PROP-201 is recorded, while TASK-101 runs its reviewer stage, PROP-201 is the one that waits.
    const g = fresh((dir) => {
      taskDone(dir);
      prepare('PROP-201', [timed('spec-writer', '2026-10-28T09:30:00.000Z', 1800)])(dir);
      const p = join(dir, 'tickets/TASK-101.md');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^status: .*$/m, 'status: in_progress').replace(/^stage: .*$/m, 'stage: reviewer'));
    });
    const refused = await g.spec('', 'ticket', 'start', 'PROP-201', 'spec-review');
    expect(refused.code).toBe(1);
    expect(refused.stderr.startsWith('PROP-201 must wait for TASK-101, which is running: ')).toBe(true);
  }, 120_000);

  it("PIP-002/S33 Before its spec stage, a ticket's footprint is what it touches", async () => {
    // TASK-102 works on CNV-002 and conversation.Message.meta; PROP-205 touches only CNV-001, which reads
    // conversation.Message.content, which CNV-002 reads or writes too.
    const f = fresh();
    await addTree(f, 'TASK-102');
    expect((await inTree(f, 'TASK-102', '2026-10-28T08:00:00.000Z', 'ticket', 'start', 'TASK-102', 'implementer')).code).toBe(0);
    const out = await f.spec('', 'ticket', 'start', 'PROP-205', 'spec-writer', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'PROP-205', stage: 'spec-writer' });

    const g = fresh();
    await addTree(g, 'TASK-102');
    expect((await inTree(g, 'TASK-102', '2026-10-28T08:00:00.000Z', 'ticket', 'start', 'TASK-102', 'implementer')).code).toBe(0);
    const next = await g.spec('', 'next', 'PROP-205', '--format', 'json');
    expect(next.stderr).not.toContain('PROP-205 must wait for TASK-102');
    expect(next.stdout).not.toContain('PROP-205 must wait for TASK-102');
    expect(next.code, next.stderr).toBe(0);

    // Two proposals that touch SET-001 still never run together.
    const h = fresh();
    await addTree(h, 'PROP-202');
    expect((await inTree(h, 'PROP-202', '2026-10-28T08:00:00.000Z', 'ticket', 'start', 'PROP-202', 'spec-writer')).code).toBe(0);
    const refused = await h.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
    expect(refused.code).toBe(1);
    expect(refused.stderr.startsWith('PROP-201 must wait for PROP-202, which is running: both add to SET-001, so their new scenario and rule numbers would collide')).toBe(true);
  }, 180_000);

  it('PIP-002/S16 Uncommitted work outside the tickets folder', async () => {
    const f = fresh();
    f.git('checkout', '-q', '-b', 'other');
    writeFileSync(join(f.repo, 'src/scratch.ts'), 'export {};\n');
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('cannot switch to ticket/TASK-101: uncommitted changes in src/scratch.ts');
    expect(branch(f)).toBe('other');
  });

  it('PIP-002/S17 An uncommitted ticket file does not stop the switch', async () => {
    const f = fresh();
    appendFileSync(file(f, 'TASK-102'), '\nA person answered.\n');
    const out = await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(branch(f)).toBe('ticket/TASK-101');
  });
});
