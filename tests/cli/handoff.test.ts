// PROP-076: an implementer blocked only on tests hands its committed work to the tester (PIP-008/R13,
// R14, R15). Through the CLI in real git repositories: chat-mini's PROP-201 with its earlier stages
// seeded in the ticket file, and a test command that copies a report this file writes.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { expandRole } from '../../src/core/roles';
import { inScopeScenarios } from '../../src/core/report';
import { REPO, gitFixture, loadFixture, report, ticketOf, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const worktrees: { fx: Fx; path: string }[] = [];
const scratch = tempDir('spec-handoff-');
afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of made) fx.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

const loaded = loadFixture();
const inScope = new Set(inScopeScenarios(loaded.spec, ticketOf(loaded.tickets, 'PROP-201')));
/** The names a test run holds for PROP-201: one test per in-scope scenario. */
const NAMES = loaded.spec.features.flatMap((f) => f.scenarios.filter((s) => inScope.has(s.id)).map((s) => `${s.id} ${s.title}`));
const results = (failing: string[] = []) =>
  JSON.stringify({
    testResults: [{ assertionResults: NAMES.map((title) => (failing.includes(title) ? { title, status: 'failed', failureMessages: ['AssertionError: expected 200 to be 201'] } : { title, status: 'passed' })) }],
  });

const S3_NAME = NAMES.find((n) => n.startsWith('PRV-001/S3 ')) ?? '';
const SUMMARY = 'Code done; one test is wrong';
const TEST_BLOCKER = { text: 'The test for PRV-001/S3 expects status 200; the scenario says 201', cites: ['PRV-001/S3'], tests: true };
const OTHER_BLOCKER = { text: 'Which name does the new provider take?', cites: ['PRV-001/S3'] };

const line = (role: string, result: string, extra = '', verdict = role === 'spec-review' ? 'approve' : 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: ${result}, summary: x, verdict: ${verdict}, assumed: []${extra} }`;
const handoffLine = line('implementer', 'blocked', `, blockers: [{ text: "The test expects 200", cites: [PRV-001/S3], tests: true }]`);
const BEFORE = [line('spec-writer', 'done'), line('spec-review', 'done'), line('tester', 'done')];
const blockedReport = (blockers: object[], summary = SUMMARY) => report(`role: implementer\nticket: PROP-201\nresult: blocked\nsummary: ${summary}\nblockers: ${JSON.stringify(blockers)}`);
const testerReport = report('role: tester\nticket: PROP-201\nresult: done\nsummary: Fixed the PRV-001/S3 test\nchanged: [PRV-001/S3]');

let counter = 0;
interface Setup {
  history?: string[];
  checkCommands?: string[];
}
type Staged = Fx & { reportFile: string; marker: string };
/** PROP-201 with `history` seeded, its `role` stage started, and a test run that passes. */
async function atStage(prefix: string, role: string, o: Setup = {}): Promise<Staged> {
  const reportFile = join(scratch, `report-${counter}.json`);
  const marker = join(scratch, `ran-${counter++}.marker`);
  writeFileSync(reportFile, results());
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `echo ran >> '${marker}' && cp '${reportFile}' "{report}"`;
      if (o.checkCommands) cfg.checkCommands = o.checkCommands;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      const file = join(dir, 'tickets/PROP-201.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${(o.history ?? BEFORE).join('\n')}`));
    },
  });
  made.push(fx);
  const started = await fx.spec('', 'ticket', 'start', 'PROP-201', role);
  expect(started.code, started.stderr).toBe(0);
  return Object.assign(fx, { reportFile, marker });
}
const atImplementer = (prefix: string, o: Setup = {}): Promise<Staged> => atStage(prefix, 'implementer', o);

/** The code the implementer wrote: src/app.ts changed, src/extra.ts new. */
function work(fx: Fx): void {
  appendFileSync(join(fx.repo, 'src/app.ts'), '// code done\n');
  writeFileSync(join(fx.repo, 'src/extra.ts'), 'export const extra = 1;\n');
}

/** What the "<ID> implementer: blocked" stash holds: [tracked changes, new files]. */
function stashHolds(fx: Fx): [string[], string[]] {
  const sha = fx.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(': PROP-201 implementer: blocked'))?.split(' ')[0] ?? '';
  expect(sha, 'the stash PROP-201 implementer: blocked').not.toBe('');
  const tracked = fx.git('diff', '--name-only', `${sha}^1`, sha).stdout.trim().split('\n').filter(Boolean).sort();
  const third = fx.git('rev-parse', '--verify', '--quiet', `${sha}^3`);
  const added = third.code === 0 ? fx.git('ls-tree', '-r', '--name-only', `${sha}^3`).stdout.trim().split('\n').filter(Boolean).sort() : [];
  return [tracked, added];
}

const last = (fx: Fx) => fx.ticket('PROP-201')?.history.at(-1) as Record<string, unknown> | undefined;
const committed = (fx: Fx) => fx.git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n').filter(Boolean).sort();
const clean = (fx: Fx) => fx.git('status', '--porcelain', '--untracked-files=all').stdout;

describe('PIP-008/S28 An implementer blocked only on tests hands its work to the tester', () => {
  it('PIP-008/S28 the work is committed, no question is raised and the tester is next', async () => {
    const fx = await atImplementer('handoff-s28');
    const questions = fx.ticket('PROP-201')?.questions;
    work(fx);
    const out = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'next: tester']);
    expect(out.stdout).not.toContain('stash:');
    // The stage's commit holds the code and the ticket file; nothing is left, nothing is stashed.
    expect(committed(fx)).toEqual(['src/app.ts', 'src/extra.ts', 'tickets/PROP-201.md']);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe(`PROP-201 implementer: ${SUMMARY}`);
    expect(fx.git('log', '-1', '--format=%B').stdout.trimEnd().endsWith('\n\nSpec-Ticket: PROP-201')).toBe(true);
    expect(clean(fx)).toBe('');
    expect(fx.git('stash', 'list').stdout).toBe('');
    // The ticket: no new question, open, and the record keeps the blocker whole.
    const t = fx.ticket('PROP-201');
    expect(t?.questions).toEqual(questions);
    expect(t).toMatchObject({ status: 'open', stage: null });
    expect(last(fx)).toMatchObject({ role: 'implementer', result: 'blocked' });
    expect(last(fx)?.blockers).toEqual([TEST_BLOCKER]);
    // The test command did not run: the tests are known to be wrong.
    expect(existsSync(fx.marker)).toBe(false);
    // The record's blockers are a key of the stage record, not one a newer spec added (lint would warn of it).
    const lint = await fx.spec('', 'lint');
    expect(lint.stdout + lint.stderr).not.toMatch(/history\[\d+\]\.blockers/);
  }, 120_000);

  it('PIP-008/S28 with --format json the Advanced has next tester, status open and no stash', async () => {
    const fx = await atImplementer('handoff-s28-json');
    work(fx);
    const out = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'PROP-201', next: 'tester', status: 'open', problems: [] });
  }, 120_000);

  it('PIP-008/S28 a bug hands off the same way', async () => {
    const fx = gitFixture('handoff-s28-bug', {
      setup: (dir) => {
        const file = join(dir, 'tickets/BUG-301.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${line('tester', 'done')}`));
      },
    });
    made.push(fx);
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    work(fx);
    const msg = report(`role: implementer\nticket: BUG-301\nresult: blocked\nsummary: ${SUMMARY}\nblockers: ${JSON.stringify([{ ...TEST_BLOCKER, cites: ['PRV-002/S3'] }])}`);
    const out = await fx.spec(msg, 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'BUG-301', next: 'tester', status: 'open', problems: [] });
    expect(fx.git('stash', 'list').stdout).toBe('');
    expect(clean(fx)).toBe('');
  }, 120_000);

  it('PIP-008/S28 a second blocker with no tests mark is recorded as a block: both files stashed, a question each', async () => {
    const fx = await atImplementer('handoff-s28-mixed');
    work(fx);
    const out = await fx.spec(blockedReport([TEST_BLOCKER, OTHER_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 3)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'status: blocked', 'stash: PROP-201 implementer: blocked']);
    expect(stashHolds(fx)).toEqual([['src/app.ts'], ['src/extra.ts']]);
    expect(committed(fx)).toEqual(['tickets/PROP-201.md']);
    const t = fx.ticket('PROP-201');
    expect(t?.status).toBe('blocked');
    expect(t?.questions.map((q) => ({ kind: q.kind, raised_by: q.raised_by }))).toEqual([
      { kind: 'blocker', raised_by: 'implementer' },
      { kind: 'blocker', raised_by: 'implementer' },
    ]);
    expect(last(fx)).not.toHaveProperty('blockers');
  }, 120_000);

  it('PIP-008/S28 a third hand-off is recorded as a block, once the history holds two', async () => {
    const earlier = [...BEFORE, handoffLine, line('tester', 'done', ', passed: false'), handoffLine, line('tester', 'done', ', passed: false')];
    const fx = await atImplementer('handoff-s28-third', { history: earlier });
    work(fx);
    const out = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 3)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'status: blocked', 'stash: PROP-201 implementer: blocked']);
    expect(stashHolds(fx)).toEqual([['src/app.ts'], ['src/extra.ts']]);
    const t = fx.ticket('PROP-201');
    expect(t?.status).toBe('blocked');
    expect(t?.questions.at(-1)).toMatchObject({ kind: 'blocker', raised_by: 'implementer' });
    expect(last(fx)).not.toHaveProperty('blockers');
    // One earlier hand-off is not yet two: that report still hands off.
    const once = await atImplementer('handoff-s28-second', { history: [...BEFORE, handoffLine, line('tester', 'done', ', passed: false')] });
    work(once);
    const second = await once.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201', '--format', 'json');
    expect(JSON.parse(second.stdout)).toMatchObject({ next: 'tester', status: 'open' });
  }, 180_000);

  it('PIP-008/S28 an unmarked blocker alone still stashes, as before', async () => {
    const fx = await atImplementer('handoff-s28-unmarked');
    work(fx);
    const out = await fx.spec(blockedReport([OTHER_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.stdout.split('\n').slice(0, 3)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'status: blocked', 'stash: PROP-201 implementer: blocked']);
    expect(fx.ticket('PROP-201')?.status).toBe('blocked');
    expect(last(fx)).not.toHaveProperty('blockers');
  }, 120_000);
});

describe('PIP-008/S31 A hand-off whose code fails an implementer check is an ordinary block', () => {
  const NOT_HANDED = 'not handed to the tester: ';
  const TESTS_PROBLEM = 'on a proposal the tests are the tester\'s and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong';
  const CMD = "echo 'src/app.ts:3 type error'; exit 1";

  /** Runs a hand-off report over a tree `mutate` leaves, and checks it was recorded as an ordinary block for `problem`. */
  async function refused(prefix: string, problem: string, mutate: (fx: Fx) => void, o: Setup = {}): Promise<{ fx: Fx; out: { stdout: string } }> {
    const fx = await atImplementer(prefix, o);
    work(fx);
    mutate(fx);
    const out = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 4)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'status: blocked', `${NOT_HANDED}${problem}`, 'stash: PROP-201 implementer: blocked']);
    const t = fx.ticket('PROP-201');
    expect(t?.status).toBe('blocked');
    const q = t?.questions.at(-1);
    expect(q).toMatchObject({ kind: 'blocker', raised_by: 'implementer' });
    expect(q?.text.endsWith(` Not handed to the tester: ${problem}`)).toBe(true);
    expect(last(fx)).not.toHaveProperty('blockers');
    expect(committed(fx)).toEqual(['tickets/PROP-201.md']);
    expect(clean(fx)).toBe('');
    return { fx, out };
  }

  it('PIP-008/S31 a changed test file is refused, and the stash holds it with the code', async () => {
    const { fx } = await refused('handoff-s31-tests', TESTS_PROBLEM, (f) => {
      appendFileSync(join(f.repo, 'tests/PRV-001.test.ts'), '// fixed by the implementer\n');
    });
    expect(stashHolds(fx)).toEqual([['src/app.ts', 'tests/PRV-001.test.ts'], ['src/extra.ts']]);
  }, 120_000);

  it('PIP-008/S31 a check command that exits 1 is refused with that command\'s problem', async () => {
    const { fx } = await refused('handoff-s31-command', `${CMD} fails (exit 1): src/app.ts:3 type error`, () => undefined, { checkCommands: [CMD] });
    expect(stashHolds(fx)).toEqual([['src/app.ts'], ['src/extra.ts']]);
  }, 120_000);

  it('PIP-008/S31 a SPEC-STUB line the branch added, left in src/app.ts, is refused', async () => {
    const { fx } = await refused('handoff-s31-stub', 'SPEC-STUB is still in src/app.ts; replace every stub with the real code', (f) => {
      appendFileSync(join(f.repo, 'src/app.ts'), "// SPEC-STUB PROP-201: throw new Error('not yet')\n");
    });
    expect(stashHolds(fx)).toEqual([['src/app.ts'], ['src/extra.ts']]);
  }, 120_000);

  it('INV-003 a hand-off over spec files is refused, not committed', async () => {
    const { fx } = await refused('handoff-s31-spec', 'the implementer never changes spec files; revert spec/core/overview.md', (f) => {
      appendFileSync(join(f.repo, 'spec/core/overview.md'), '\nAn edit the implementer may not make.\n');
    });
    expect(stashHolds(fx)).toEqual([['spec/core/overview.md', 'src/app.ts'], ['src/extra.ts']]);
  }, 120_000);

  it('INV-003 a hand-off over a protected file is refused, with the protected-file problem among its problems', async () => {
    const fx = await atImplementer('handoff-s31-protected');
    work(fx);
    appendFileSync(join(fx.repo, 'tests/SET-002.test.ts'), '// forged\n');
    const out = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    const lines = out.stdout.split('\n');
    expect(lines.slice(0, 2)).toEqual([`PROP-201 implementer: ${SUMMARY}`, 'status: blocked']);
    expect(lines[2]?.startsWith(NOT_HANDED)).toBe(true);
    expect(lines[2]).toContain('protected files may not change: revert tests/SET-002.test.ts');
    expect(lines[3]).toBe('stash: PROP-201 implementer: blocked');
    expect(committed(fx)).toEqual(['tickets/PROP-201.md']);
    expect(last(fx)).not.toHaveProperty('blockers');
  }, 120_000);
});

describe('PIP-008/S29 The tester after a hand-off records whether the tests pass', () => {
  /** A hand-off recorded, then the tester stage started on the committed code, with a tests change of its own. */
  async function atTester(prefix: string, o: Setup = {}): Promise<Staged> {
    const fx = await atImplementer(prefix, o);
    work(fx);
    const handed = await fx.spec(blockedReport([TEST_BLOCKER]), 'ticket', 'advance', 'PROP-201');
    expect(handed.stdout.split('\n')[1], handed.stderr).toBe('next: tester');
    const started = await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester');
    expect(started.code, started.stderr).toBe(0);
    // The tester starts on a tree with no change but the ticket file, and no stash to restore (PIP-002/S19, S20).
    expect(clean(fx).split('\n').filter((l) => l !== '' && !l.includes('tickets/'))).toEqual([]);
    expect(fx.git('stash', 'list').stdout).toBe('');
    appendFileSync(join(fx.repo, 'tests/PRV-001.test.ts'), '// the corrected test\n');
    return fx;
  }
  const advance = async (fx: Fx) => {
    const out = await fx.spec(testerReport, 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    return out;
  };

  it('PIP-008/S29 every test passing gives passed true and the reviewer next', async () => {
    const fx = await atTester('handoff-s29-pass');
    const out = await advance(fx);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual([`PROP-201 tester: Fixed the PRV-001/S3 test`, 'next: reviewer']);
    expect(last(fx)).toMatchObject({ role: 'tester', result: 'done', passed: true });
    // The test command ran for this stage.
    expect(existsSync(fx.marker)).toBe(true);
    const lint = await fx.spec('', 'lint');
    expect(lint.stdout + lint.stderr).not.toMatch(/history\[\d+\]\.(blockers|passed)/);
  }, 180_000);

  it('PIP-008/S29 a failing test gives passed false and the implementer next', async () => {
    const fx = await atTester('handoff-s29-fail');
    writeFileSync(fx.reportFile, results([S3_NAME]));
    const out = await advance(fx);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual([`PROP-201 tester: Fixed the PRV-001/S3 test`, 'next: implementer']);
    expect(last(fx)).toMatchObject({ role: 'tester', result: 'done', passed: false });
  }, 180_000);

  it('PIP-008/S29 every test passing but a check command exiting 1 gives passed false', async () => {
    const flag = join(scratch, 'fail-checks.flag');
    const cmd = `if [ -f '${flag}' ]; then echo 'src/app.ts:3 type error'; exit 1; fi`;
    const fx = await atTester('handoff-s29-command', { checkCommands: [cmd] });
    writeFileSync(flag, 'now');
    const out = await advance(fx);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual([`PROP-201 tester: Fixed the PRV-001/S3 test`, 'next: implementer']);
    expect(last(fx)).toMatchObject({ role: 'tester', result: 'done', passed: false });
  }, 180_000);

  it('PIP-008/S29 every test passing but a SPEC-STUB line the branch added still in src/app.ts gives passed false', async () => {
    const fx = await atTester('handoff-s29-stub');
    appendFileSync(join(fx.repo, 'src/app.ts'), "// SPEC-STUB PROP-201: throw new Error('not yet')\n");
    const out = await advance(fx);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual([`PROP-201 tester: Fixed the PRV-001/S3 test`, 'next: implementer']);
    expect(last(fx)).toMatchObject({ role: 'tester', result: 'done', passed: false });
  }, 180_000);

  it('PIP-008/S29 a tester stage that does not follow a hand-off records no passed', async () => {
    // The last implementer stage is done, and a reviewer finding asked for tests.
    const asked = line('reviewer', 'done', ', findings: [{ cites: [PRV-001/S3], text: "no test covers the second rate limit", tests: true, class: C7 }]', 'changes');
    const fx = await atStage('handoff-s29-none', 'tester', { history: [...BEFORE, line('implementer', 'done'), asked] });
    appendFileSync(join(fx.repo, 'tests/PRV-001.test.ts'), '// a stronger test\n');
    const out = await advance(fx);
    expect(out.stdout.split('\n')[1]).toBe('next: implementer');
    expect(last(fx)).toMatchObject({ role: 'tester', result: 'done' });
    expect(last(fx)).not.toHaveProperty('passed');
  }, 120_000);
});

describe("PIP-008/S30 The implementer's and tester's prompts say how to hand off a test fix", () => {
  type Entry = { role: string; worktree: string; task: string };

  /** A chat-mini copy whose implementer and tester prompts are this version's templates, with PROP-201 at `history`. */
  async function task(prefix: string, history: string[]): Promise<Entry> {
    const fx = gitFixture(prefix, {
      setup: (dir) => {
        const shared = readFileSync(join(REPO, 'roles/_shared.md'), 'utf8');
        for (const role of ['implementer', 'tester']) {
          const prompt = expandRole(readFileSync(join(REPO, `roles/${role}.md`), 'utf8'), shared);
          if (prompt === null) throw new Error(`roles/${role}.md does not expand`);
          writeFileSync(join(dir, `spec/roles/${role}.md`), prompt);
        }
        const file = join(dir, 'tickets/PROP-201.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
      },
    });
    made.push(fx);
    const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as Entry;
    worktrees.push({ fx, path: entry.worktree });
    return entry;
  }
  const prose = (entry: Entry) => (entry.task.split('\n## Working folder\n')[0] ?? '').split('```report')[0] ?? '';
  const form = (entry: Entry) => (/```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '').split('\n');

  it("PIP-008/S30 the implementer's prompt asks for blockers marked tests: true, and says when the hand-off is refused", async () => {
    const entry = await task('handoff-s30-implementer', BEFORE);
    expect(entry.role).toBe('implementer');
    expect(entry.task).toContain('You are the implementer.');
    const text = prose(entry);
    // When its code is done and only a test is wrong, it reports blocked with each blocker marked tests: true, citing the scenario.
    expect(text).toMatch(/only a test is wrong/i);
    expect(text).toContain('tests: true');
    expect(text).toMatch(/cit\w* the scenario whose test is wrong/i);
    // The hand-off is refused when its changes touch a test or spec file, fail a check command or leave a SPEC-STUB.
    const refusal = text.split('\n').filter((l) => /refused/i.test(l));
    expect(refusal.some((l) => /test/i.test(l) && /spec file/i.test(l) && /check command/i.test(l) && /SPEC-STUB/.test(l)), refusal.join('\n')).toBe(true);
    // Its report block form's blockers line shows the mark.
    expect(form(entry).find((l) => l.startsWith('blockers:'))).toContain('tests: true');
  }, 120_000);

  it("PIP-008/S30 the tester's prompt says the implementer's code is committed and its blockers are in the brief", async () => {
    const entry = await task('handoff-s30-tester', BEFORE.slice(0, 2));
    expect(entry.role).toBe('tester');
    expect(entry.task).toContain('You are the tester.');
    const text = prose(entry);
    expect(text).toContain("Implementer's test blockers");
    expect(text).toMatch(/committed/);
    expect(text).toMatch(/fix only the tests/i);
    expect(text).toMatch(/(?:run|running) them against/i);
  }, 120_000);
});
