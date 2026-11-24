// PIP-021 (PROP-116): the build lane's stage order, its give-up to the full lane, its stash and its
// rounds of changes, with PIP-001/S35, PIP-002/S19, PIP-004/S23, PIP-006/S26 and PIP-008/S10 for the
// build stage. PROP-215 is in the build lane of a real git copy of chat-mini (build-lane-fixture.ts).
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MUTATIONS, buildStage, cleanupAll, firstStageThenChanges, history, nextOf, ordersOf, plainFixture, rec, safeJson, secondBuildStage, ticketText, type Case } from './build-lane-fixture';
import { report } from '../helpers';

afterAll(cleanupAll);

const BUILD_SW = rec('spec-writer', { extra: ', lane: build' });
const APPROVED = rec('spec-review');
const FINDING = (flag: 'tests' | 'spec' | null) => `{ cites: [PRV-001/S4], text: "a finding", class: C9${flag === null ? '' : `, ${flag}: true`} }`;
const changesRecord = (flag: 'tests' | 'spec' | null, lane: 'full' | null = null) =>
  rec('reviewer', { verdict: 'changes', extra: `${lane === null ? '' : `, lane: ${lane}`}, findings: [${FINDING(flag)}]` });

const reviewerReport = (id: string, verdict: 'approve' | 'changes', flag: 'tests' | 'spec' | null = null) =>
  report(`role: reviewer\nticket: ${id}\nresult: done\nsummary: ${verdict === 'approve' ? 'The change matches its scenarios' : 'One thing to fix'}\nverdict: ${verdict}${verdict === 'changes' ? `\nfindings: [${FINDING(flag)}]` : ''}`);

const stashes = (c: Case) => c.fx.git('stash', 'list').stdout;
const filesOf = (c: Case, ref: string) => c.fx.git('show', '--name-only', '--format=', ref).stdout.split('\n').filter(Boolean);
const text = async (c: Case, stdin: string, ...argv: string[]) => c.fx.spec(stdin, ...argv);
const startRole = async (c: Case, role: string) => {
  const out = await c.fx.spec('', 'ticket', 'start', c.id, role);
  expect(out.code, out.stderr).toBe(0);
};
const advanceJson = async (c: Case, message: string) => {
  const out = await c.fx.spec(message, 'ticket', 'advance', c.id, '--format', 'json');
  return { out, json: safeJson<{ next: string | null; status: string; problems: string[]; stash?: string }>(out.stdout) };
};
const testerReport = (c: Case, mutations: boolean) => report(`role: tester\nticket: ${c.id}\nresult: done\nsummary: Tests for gemini${mutations ? `\nmutations: ${JSON.stringify(MUTATIONS)}` : ''}`);
const checkTester = async (c: Case, message: string) => {
  const out = await c.fx.spec(message, 'check-report', 'tester', c.id, '--format', 'json');
  return safeJson<{ ok: boolean; problems: string[] }>(out.stdout);
};

describe('PIP-021 a proposal in the build lane', () => {
  it('PIP-021/S9 A build-lane proposal runs spec-writer, spec-review, implementer, reviewer', async () => {
    // On an empty history the tester is refused with the lane's order.
    const empty = plainFixture('flow-s9-empty', { 'PROP-215': ticketText('PROP-215', 'build') });
    const refused = await empty.spec('', 'ticket', 'start', 'PROP-215', 'tester');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('tester is not a stage of a proposal in the build lane: spec-writer → spec-review → implementer → reviewer');

    const c = await buildStage('flow-s9');
    expect(c.nexts).toEqual(['spec-review', 'implementer']);
    const done = await advanceJson(c, c.implementer());
    expect(done.json?.problems).toEqual([]);
    expect(done.json?.next).toBe('reviewer');
    // The build stage's one commit holds its test files and its code.
    const subjects = c.fx.git('log', '--format=%s', '-2').stdout.split('\n');
    expect(subjects[0]?.startsWith('PROP-215 implementer: ')).toBe(true);
    expect(subjects[1]?.startsWith('PROP-215 spec-review: ')).toBe(true);
    const files = filesOf(c, 'HEAD');
    expect(files).toEqual(expect.arrayContaining(['tests/PRV-001.test.ts', 'tests/SET-001.test.ts', 'src/providers/config.ts']));
    await startRole(c, 'reviewer');
    const last = await advanceJson(c, reviewerReport(c.id, 'approve'));
    expect(last.json).toMatchObject({ next: null, status: 'done' });
    expect(history(c).map((r) => r['role'])).toEqual(['spec-writer', 'spec-review', 'implementer', 'reviewer']);
    expect(history(c).map((r) => r['lane'])).toEqual(['build', undefined, undefined, undefined]);

    // A ticket whose lane is set to "build" after its first stage was recorded without it keeps its full order.
    const later = plainFixture('flow-s9-later', { 'PROP-212': ticketText('PROP-212', 'build', [rec('spec-writer'), APPROVED]) });
    expect((await nextOf(later, ['PROP-212']))['PROP-212']).toBe('tester');
  }, 300_000);

  it('PIP-021/S10 A spec review\'s changes, or a reopened spec stage, stay in the build lane', async () => {
    const c = await buildStage('flow-s10', { stopBefore: 'spec-review' });
    expect(history(c).map((r) => r['lane'])).toEqual(['build']);
    await startRole(c, 'spec-review');
    const changes = await advanceJson(c, report(`role: spec-review\nticket: ${c.id}\nresult: done\nsummary: One gap\nverdict: changes\nfindings: [{ cites: [PRV-001/S4], text: "a gap", class: C9 }]`));
    expect(changes.json?.problems).toEqual([]);
    expect(changes.json?.next).toBe('spec-writer');
    await startRole(c, 'spec-writer');
    const again = await advanceJson(c, report(`role: spec-writer\nticket: ${c.id}\nresult: done\nsummary: Answered the gap\nchanged: [PRV-001]\nchecklist: ${JSON.stringify([{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] }, { item: 'C2', outcome: 'na', reason: 'none apply' }, { item: 'C3', outcome: 'na', reason: 'none apply' }, { item: 'C4', outcome: 'na', reason: 'none apply' }, { item: 'C5', outcome: 'na', reason: 'none apply' }, { item: 'C6', outcome: 'scenarios', ids: ['PRV-001/S1'] }, { item: 'C8', outcome: 'na', reason: 'none apply' }])}`));
    expect(again.json?.next).toBe('spec-review');
    await startRole(c, 'spec-review');
    const approved = await advanceJson(c, report(`role: spec-review\nticket: ${c.id}\nresult: done\nsummary: The delta covers its cases\nverdict: approve`));
    expect(approved.json?.next).toBe('implementer');
    // After a done build stage, a person's answer that reopens "spec-writer" gives the same order.
    const reopened = rec('spec-writer', { result: 'reopened' });
    const orders = await ordersOf('flow-s10-orders', {
      'PROP-401': { lane: 'build', history: [BUILD_SW, rec('spec-review', { verdict: 'changes' })] },
      'PROP-402': { lane: 'build', history: [BUILD_SW, rec('spec-review', { verdict: 'changes' }), rec('spec-writer')] },
      'PROP-403': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer'), reopened] },
      'PROP-404': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer'), reopened, rec('spec-writer')] },
      'PROP-405': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer'), reopened, rec('spec-writer'), APPROVED] },
    });
    expect(orders).toEqual({ 'PROP-401': 'spec-writer', 'PROP-402': 'spec-review', 'PROP-403': 'spec-writer', 'PROP-404': 'spec-review', 'PROP-405': 'implementer' });
  }, 300_000);

  it('PIP-021/S11 A done report that asks for the full lane hands the ticket to the tester', async () => {
    const c = await buildStage('flow-s11');
    c.setProof({ failing: [] });
    const out = await text(c, c.implementer({ lane: 'full', mutations: null, summary: 'Needs stubs' }), 'ticket', 'advance', c.id);
    expect(out.code, out.stderr).toBe(0);
    expect(c.runCount(), 'the test command does not run').toBe(0);
    expect(history(c).at(-1)).toMatchObject({ role: 'implementer', result: 'done', lane: 'full' });
    expect(history(c).at(-1)).not.toHaveProperty('mutations');
    expect(out.stdout.split('\n').filter(Boolean)).toEqual(['PROP-215 implementer: Needs stubs', 'next: tester', 'stash: PROP-215 build: blocked']);
    expect(c.fx.ticket(c.id)).toMatchObject({ status: 'open', questions: [] });
    // The stage's commit holds only the ticket file; the stash holds its changes.
    expect(filesOf(c, 'HEAD')).toEqual(['tickets/PROP-215.md']);
    expect(stashes(c)).toContain('PROP-215 build: blocked');
    const held = c.fx.git('stash', 'show', '--name-only', 'stash@{0}').stdout.split('\n');
    expect(held).toEqual(expect.arrayContaining(['src/providers/config.ts', 'tests/PRV-001.test.ts']));
    // The tester that follows is held to test first: a done report whose new tests all pass is refused.
    await startRole(c, 'tester');
    c.fx.apply('reference/PROP-201.tester.patch');
    expect((await checkTester(c, testerReport(c, true)))?.ok).toBe(false);
    // With a failing test it is accepted; then the implementer, then the reviewer. The check above kept its run
    // of this tree (PIP-008/R12), so a file of the tree changes before advance, which then runs the tests itself.
    appendFileSync(join(c.fx.repo, 'tests/PRV-001.test.ts'), '// a test that now fails\n');
    c.setProof();
    const tester = await advanceJson(c, testerReport(c, true));
    expect(tester.json?.problems).toEqual([]);
    expect(tester.json?.next).toBe('implementer');
    await startRole(c, 'implementer');
    c.fx.apply('reference/PROP-201.implementer.patch');
    const implementer = await advanceJson(c, report(`role: implementer\nticket: ${c.id}\nresult: done\nsummary: The code`));
    expect(implementer.json?.problems).toEqual([]);
    expect(implementer.json?.next).toBe('reviewer');
  }, 300_000);

  it('PIP-021/S12 A blocked build stage that asks for the full lane goes to the tester once answered', async () => {
    const c = await buildStage('flow-s12');
    const blockers = '[{ text: "Needs a stub for gemini", cites: [PRV-001/S4] }]';
    const out = await advanceJson(c, c.implementer({ result: 'blocked', lane: 'full', mutations: null, blockers }));
    expect(out.out.code, out.out.stderr).toBe(0);
    expect(history(c).at(-1)).toMatchObject({ role: 'implementer', result: 'blocked', lane: 'full' });
    const question = c.fx.ticket(c.id)?.questions.at(-1);
    expect(question?.text.endsWith('Its changes are kept in git stash "PROP-215 build: blocked"; no later stage gets them back.')).toBe(true);
    expect((await c.fx.spec('', 'ticket', 'answer', c.id, question?.id ?? 'Q1', 'go on')).code).toBe(0);
    const refused = await c.fx.spec('', 'ticket', 'start', c.id, 'implementer');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('the next stage of PROP-215 is tester, not implementer');
    const started = await c.fx.spec('', 'ticket', 'start', c.id, 'tester');
    expect(started.code, started.stderr).toBe(0);
    // The tester is held to test first, as in S11.
    c.fx.apply('reference/PROP-201.tester.patch');
    c.setProof({ failing: [] });
    expect((await checkTester(c, testerReport(c, true)))?.ok).toBe(false);
  }, 300_000);

  it('PIP-021/S13 A blocked build stage that stays in the lane gets its work back', async () => {
    const c = await buildStage('flow-s13');
    const blockers = '[{ text: "Which key does gemini use?", cites: [SET-001/S4] }]';
    const out = await text(c, c.implementer({ result: 'blocked', mutations: null, blockers }), 'ticket', 'advance', c.id);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.trimEnd().split('\n').at(-1)).toBe('stash: PROP-215 build: blocked');
    const question = c.fx.ticket(c.id)?.questions.at(-1);
    expect(question?.text.endsWith('Its changes are kept in git stash "PROP-215 build: blocked"; the next build stage gets them back.')).toBe(true);
    expect((await c.fx.spec('', 'ticket', 'answer', c.id, question?.id ?? 'Q1', 'the same key')).code).toBe(0);
    // The next start brings both files back and drops that stash.
    await startRole(c, 'implementer');
    expect(readFileSync(join(c.fx.repo, 'tests/PRV-001.test.ts'), 'utf8')).toContain('PRV-001/S4');
    expect(readFileSync(join(c.fx.repo, 'src/providers/config.ts'), 'utf8')).toContain('gemini');
    expect(stashes(c)).not.toContain('PROP-215 build: blocked');
    // A third refused report stashes and blocks the same way, and the ticket is still in the build lane.
    const wrong = report(`role: tester\nticket: ${c.id}\nresult: done\nsummary: Incorrect role`);
    for (const attempt of [1, 2]) {
      const refusedOnce = await c.fx.spec(wrong, 'ticket', 'advance', c.id, '--report', '-', '--format', 'json');
      expect(refusedOnce.code, `attempt ${attempt}`).toBe(1);
    }
    const third = await c.fx.spec(wrong, 'ticket', 'advance', c.id, '--report', '-', '--format', 'json');
    expect(third.code).toBe(1);
    expect(stashes(c)).toContain('PROP-215 build: blocked');
    expect(history(c).at(-1)).toMatchObject({ role: 'implementer', result: 'blocked', summary: 'invalid report' });
    expect(history(c).at(-1)).not.toHaveProperty('lane');
    expect(c.fx.ticket(c.id)?.questions.at(-1)?.text.endsWith('Its changes are kept in git stash "PROP-215 build: blocked"; the next build stage gets them back. Answer to resume.')).toBe(true);
    // "spec next --restart" keeps and restores an interrupted build stage's changes through a stash of that name.
    expect((await c.fx.spec('', 'ticket', 'answer', c.id, c.fx.ticket(c.id)?.questions.at(-1)?.id ?? 'Q2', 'try again')).code).toBe(0);
    await startRole(c, 'implementer');
    const restart = await c.fx.spec('', 'next', c.id, '--restart');
    expect(restart.code, restart.stderr).toBe(0);
    expect(readFileSync(join(c.fx.repo, 'tests/PRV-001.test.ts'), 'utf8')).toContain('PRV-001/S4');
    expect(stashes(c)).not.toContain('implementer: blocked');
  }, 300_000);

  it('PIP-021/S13 once the ticket has left the lane, its stash is left alone and close keeps it', async () => {
    const left = ticketText('PROP-215', 'build', [BUILD_SW, APPROVED, rec('implementer', { extra: ', lane: full' }), rec('tester')]);
    const fx = plainFixture('flow-s13-left', { 'PROP-215': left, 'PROP-216': ticketText('PROP-216', null) });
    appendFileSync(join(fx.repo, 'src/app.ts'), '// the build stage\n');
    expect(fx.git('stash', 'push', '-q', '-m', 'PROP-215 build: blocked').code).toBe(0);
    const started = await fx.spec('', 'ticket', 'start', 'PROP-215', 'implementer');
    expect(started.code, started.stderr).toBe(0);
    expect(readFileSync(join(fx.repo, 'src/app.ts'), 'utf8')).not.toContain('the build stage');
    expect(fx.git('stash', 'list').stdout).toContain('PROP-215 build: blocked');
    // A close on the base branch prints a "kept stash" line for it.
    const other = plainFixture('flow-s13-close', { 'PROP-215': ticketText('PROP-215', 'build', [BUILD_SW, APPROVED, rec('implementer', { extra: ', lane: full' }), rec('tester')]) });
    appendFileSync(join(other.repo, 'src/app.ts'), '// the build stage\n');
    expect(other.git('stash', 'push', '-q', '-m', 'PROP-215 build: blocked').code).toBe(0);
    const closed = await other.spec('', 'ticket', 'close', 'PROP-215', '--superseded-by', 'PROP-202');
    expect(closed.code, closed.stderr).toBe(0);
    expect(closed.stdout).toContain('kept stash "PROP-215 build: blocked" at ');
  }, 300_000);

  it('PIP-021/S14 A build stage cannot hand a test to the tester', async () => {
    const c = await buildStage('flow-s14');
    const blockers = '[{ text: "a test is wrong", cites: [PRV-001/S4], tests: true }]';
    const problem = 'the build lane has no tester stage: fix the test in this stage, and drop tests: true from the blocker';
    expect((await c.check(c.implementer({ result: 'blocked', mutations: null, blockers }))).problems).toEqual([problem]);
    expect((await c.check(c.implementer({ result: 'blocked', mutations: null, blockers, lane: 'full' }))).problems).toEqual([problem]);
    // Once the ticket has left the lane, its implementer stage may hand a test to the tester.
    const fx = plainFixture('flow-s14-left', { 'PROP-215': ticketText('PROP-215', 'build', [BUILD_SW, APPROVED, rec('implementer', { extra: ', lane: full' }), rec('tester')]) });
    expect((await fx.spec('', 'ticket', 'start', 'PROP-215', 'implementer')).code).toBe(0);
    // This plain spec has no PRV-001/S4: the blocker cites a scenario it has.
    const handoff = report('role: implementer\nticket: PROP-215\nresult: blocked\nsummary: A test is wrong\nblockers: [{ text: "a test is wrong", cites: [PRV-001/S1], tests: true }]');
    const out = await fx.spec(handoff, 'check-report', 'implementer', 'PROP-215', '--format', 'json');
    expect(safeJson<{ ok: boolean }>(out.stdout)?.ok).toBe(true);
  }, 300_000);

  it('PIP-021/S15 A round of changes in the build lane', async () => {
    const c = await buildStage('flow-s15');
    await firstStageThenChanges(c);
    await secondBuildStage(c);
    const done = await advanceJson(c, c.implementer());
    expect(done.json?.problems).toEqual([]);
    expect(done.json?.next).toBe('reviewer');
    expect(history(c).at(-1)).not.toHaveProperty('lane');

    // Had the finding tests: true, the ticket goes to the tester, then the implementer, then the reviewer.
    const d = await buildStage('flow-s15-tests');
    const first = await advanceJson(d, d.implementer());
    expect(first.json?.next).toBe('reviewer');
    await startRole(d, 'reviewer');
    const review = await advanceJson(d, reviewerReport(d.id, 'changes', 'tests'));
    expect(review.json?.next).toBe('tester');
    expect(history(d).at(-1)).toMatchObject({ role: 'reviewer', lane: 'full' });
    // The tester may leave every test passing, since a build stage is recorded done.
    await startRole(d, 'tester');
    appendFileSync(join(d.fx.repo, 'tests/PRV-001.test.ts'), '// a stronger test\n');
    const tester = await advanceJson(d, testerReport(d, false));
    expect(tester.json?.problems).toEqual([]);
    expect(tester.json?.next).toBe('implementer');
    // The implementer after it may change no test file.
    await startRole(d, 'implementer');
    appendFileSync(join(d.fx.repo, 'tests/SET-001.test.ts'), '// another test\n');
    const refused = await d.fx.spec(report(`role: implementer\nticket: ${d.id}\nresult: done\nsummary: Tests`), 'check-report', 'implementer', d.id, '--format', 'json');
    expect((safeJson<{ problems: string[] }>(refused.stdout)?.problems ?? []).join('\n')).toContain("on a proposal the tests are the tester's and the implementer changes code only; revert tests/SET-001.test.ts");
  }, 400_000);

  it('PIP-021/S16 A later build stage that leaves the lane keeps the earlier one\'s work', async () => {
    const c = await buildStage('flow-s16');
    await firstStageThenChanges(c);
    const firstCommit = c.fx.git('log', '--format=%s').stdout;
    expect(firstCommit).toContain('PROP-215 implementer: ');
    await secondBuildStage(c);
    const out = await text(c, c.implementer({ lane: 'full', mutations: null }), 'ticket', 'advance', c.id, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(safeJson<{ next: string }>(out.stdout)?.next).toBe('tester');
    expect(stashes(c)).toContain('PROP-215 build: blocked');
    expect(c.fx.git('log', '--format=%s').stdout).toContain('PROP-215 implementer: ');
    expect(readFileSync(join(c.fx.repo, 'src/providers/config.ts'), 'utf8')).toContain('gemini');
    // That tester may leave every test passing, as the first build stage's done record counts.
    await startRole(c, 'tester');
    appendFileSync(join(c.fx.repo, 'tests/PRV-001.test.ts'), '// a stronger test\n');
    expect((await checkTester(c, testerReport(c, false)))?.ok).toBe(true);
  }, 400_000);
});

describe('PIP-021/S6 Any stage can move its ticket to the full lane, and none can make it lighter', () => {
  it('PIP-021/S6 a build-lane ticket moves to the full lane from a spec review, and no report makes it lighter', async () => {
    const fx = plainFixture('flow-s6', { 'PROP-215': ticketText('PROP-215', 'build', [BUILD_SW]) });
    const started = await fx.spec('', 'ticket', 'start', 'PROP-215', 'spec-review');
    expect(started.code, started.stderr).toBe(0);
    const approval = (extra: string) => report(`role: spec-review\nticket: PROP-215\nresult: done\nsummary: The delta covers its cases\nverdict: approve${extra}`);
    for (const lane of ['docs', 'tests', 'build']) {
      const out = await fx.spec(approval(`\nlane: ${lane}`), 'check-report', 'spec-review', 'PROP-215', '--format', 'json');
      const check = safeJson<{ ok: boolean; problems: string[] }>(out.stdout);
      expect(check?.ok, lane).toBe(false);
      expect((check?.problems ?? []).some((p) => p.startsWith('report lane: ')), lane).toBe(true);
    }
    const out = await fx.spec(approval('\nlane: full'), 'ticket', 'advance', 'PROP-215', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(safeJson<{ next: string }>(out.stdout)?.next).toBe('tester');
    const records = (fx.ticket('PROP-215')?.history ?? []) as unknown as Record<string, unknown>[];
    expect(records.at(-1)).toMatchObject({ role: 'spec-review', lane: 'full' });
  }, 120_000);
});

describe('PIP-001/S35 A light lane leaves out only the stages it skips', () => {
  it('PIP-001/S35 A light lane leaves out only the stages it skips', async () => {
    const asked = [BUILD_SW, APPROVED, rec('implementer'), changesRecord(null)];
    const orders = await ordersOf('flow-s35', {
      'PROP-401': { lane: 'build', history: asked },
      'PROP-402': { lane: 'build', history: [...asked, rec('implementer')] },
      'PROP-403': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer', { result: 'blocked' })] },
      'PROP-404': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer', { result: 'blocked', extra: ', lane: full' })] },
      'PROP-405': { lane: 'build', history: [BUILD_SW, APPROVED, rec('implementer', { extra: ', lane: full' })] },
    });
    expect(orders).toEqual({ 'PROP-401': 'implementer', 'PROP-402': 'reviewer', 'PROP-403': 'implementer', 'PROP-404': 'tester', 'PROP-405': 'tester' });
    // A third such "changes" blocks it on a person.
    const twice = [BUILD_SW, APPROVED, rec('implementer'), changesRecord(null), rec('implementer'), changesRecord(null), rec('implementer')];
    const fx = plainFixture('flow-s35-third', { 'PROP-215': ticketText('PROP-215', 'build', twice) });
    expect((await fx.spec('', 'ticket', 'start', 'PROP-215', 'reviewer')).code).toBe(0);
    const out = await fx.spec(reviewerReport('PROP-215', 'changes'), 'ticket', 'advance', 'PROP-215', '--format', 'json');
    expect(safeJson<{ next: string | null; status: string }>(out.stdout)).toMatchObject({ next: null, status: 'blocked' });
  }, 300_000);
});

describe('PIP-002/S19 Only the same stage on the same ticket restores', () => {
  it('PIP-002/S19 a ticket that left the build lane restores nothing from its stash, one still in it restores its own', async () => {
    const inLane = ticketText('PROP-216', 'build', [BUILD_SW, APPROVED]);
    const out = ticketText('PROP-215', 'build', [BUILD_SW, APPROVED, rec('implementer', { extra: ', lane: full' }), rec('tester')]);
    const left = plainFixture('flow-s19-left', { 'PROP-215': out });
    appendFileSync(join(left.repo, 'src/app.ts'), '// from the build stage\n');
    expect(left.git('stash', 'push', '-q', '-m', 'PROP-215 build: blocked').code).toBe(0);
    expect((await left.spec('', 'ticket', 'start', 'PROP-215', 'implementer')).code).toBe(0);
    expect(readFileSync(join(left.repo, 'src/app.ts'), 'utf8')).not.toContain('from the build stage');
    expect(left.git('stash', 'list').stdout).toContain('PROP-215 build: blocked');

    const stayed = plainFixture('flow-s19-lane', { 'PROP-216': inLane });
    appendFileSync(join(stayed.repo, 'src/app.ts'), '// from the build stage\n');
    expect(stayed.git('stash', 'push', '-q', '-m', 'PROP-216 build: blocked').code).toBe(0);
    expect((await stayed.spec('', 'ticket', 'start', 'PROP-216', 'implementer')).code).toBe(0);
    expect(readFileSync(join(stayed.repo, 'src/app.ts'), 'utf8')).toContain('from the build stage');
    expect(stayed.git('stash', 'list').stdout).not.toContain('PROP-216 build: blocked');
  }, 300_000);
});

describe('PIP-004/S23 Only an implementer on a proposal or bug marks a blocker tests', () => {
  it('PIP-004/S23 on a proposal in a build stage a blocker marked tests is the only problem', async () => {
    const c = await buildStage('flow-s23');
    const blockers = '[{ text: "a test is wrong", cites: [PRV-001/S4], tests: true }]';
    const out = await c.check(c.implementer({ result: 'blocked', mutations: null, blockers }));
    expect(out.problems).toEqual(['the build lane has no tester stage: fix the test in this stage, and drop tests: true from the blocker']);
    // On a task the same report gives the task's problem.
    const task = plainFixture('flow-s23-task', {});
    expect((await task.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    // The base spec has no PRV-001/S4: the blocker cites a scenario it has (PIP-004/R3).
    const bad = await task.spec(report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Stuck\nblockers: [{ text: "a test is wrong", cites: [PRV-001/S1], tests: true }]'), 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    expect(safeJson<{ problems: string[] }>(bad.stdout)?.problems).toEqual(['a task has no tester stage: fix the test in this stage, and drop tests: true from the blocker']);
  }, 300_000);
});

describe('PIP-006/S26 A tester stage after the implementer may pass', () => {
  it('PIP-006/S26 before the first implementer, a tester whose new tests all pass is refused when the only implementer records are build stages that gave up', async () => {
    const c = await buildStage('flow-s26');
    c.setProof({ failing: [] });
    const out = await text(c, c.implementer({ lane: 'full', mutations: null }), 'ticket', 'advance', c.id);
    expect(out.code, out.stderr).toBe(0);
    await startRole(c, 'tester');
    c.fx.apply('reference/PROP-201.tester.patch');
    const check = await checkTester(c, testerReport(c, true));
    expect(check?.ok).toBe(false);
    expect((check?.problems ?? []).length).toBeGreaterThan(0);
  }, 300_000);
});

describe('PIP-008/S10 A report that fails its checks blocks the ticket', () => {
  it('PIP-008/S10 for a build stage the stash is "PROP-215 build: blocked", in the output line and in the question', async () => {
    const c = await buildStage('flow-s10-build');
    const out = await text(c, c.implementer({ mutations: null }), 'ticket', 'advance', c.id);
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('stash: PROP-215 build: blocked\n');
    expect(stashes(c)).toContain('PROP-215 build: blocked');
    expect(stashes(c)).not.toContain('PROP-215 implementer: blocked');
    expect(c.fx.ticket(c.id)?.questions.at(-1)?.text.endsWith('. Its changes are kept in git stash "PROP-215 build: blocked"; the next build stage gets them back. Answer to resume.')).toBe(true);
    expect(c.fx.ticket(c.id)).toMatchObject({ status: 'blocked', stage: null });
    expect(history(c).at(-1)).toMatchObject({ role: 'implementer', result: 'blocked', summary: 'invalid report' });
    expect(readFileSync(join(c.fx.repo, 'package.json'), 'utf8')).not.toContain('gemini-sdk');
  }, 300_000);
});
