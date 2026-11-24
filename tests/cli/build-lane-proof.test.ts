// PIP-024 (PROP-116): a done build stage is held to test first by the CLI's proof run, with PIP-019/S6,
// PIP-005/S14 and PIP-022/S3 for the build stage. PROP-215 is in the build lane of a real git copy of
// chat-mini; the test command (build-lane-fixture.ts) gives one report on the stage's whole tree and
// another on the proof tree, and logs the files it found in each.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_ID,
  MUTATIONS,
  S4_PRV,
  S4_SET,
  buildStage,
  cleanupAll,
  firstStageThenChanges,
  history,
  lines,
  mainBrings,
  plainFixture,
  rec,
  resetRuns,
  safeJson,
  secondBuildStage,
  snapshot,
  ticketText,
  type Case,
  type Fx,
} from './build-lane-fixture';
import { report } from '../helpers';

afterAll(cleanupAll);

const WHOLE = 'tests: running the test command';
const PROOF = 'tests: running the proof run on the code before the build';
const NOFAIL = (id: string) => `no test of ${id} fails on the code before the build; write one that fails there on what it asserts`;
const NOMUT = (id: string) => `the report names no wrong implementation for ${id}; add { scenario: ${id}, wrong: "<a plausible wrong implementation its test fails against>" } under mutations`;
const NOT_RUN = 'the check could not run: the test command gave no results: on the code before the build: ';

/** One build stage, built once for the tests that only read it (check-report changes nothing). */
let shared: Promise<Case> | undefined;
const stage = (): Promise<Case> => (shared ??= buildStage('proof-shared'));

describe('PIP-024 a build stage is held to test first', () => {
  it('PIP-024/S1 Tests that fail first and then pass are accepted', async () => {
    const c = await stage();
    c.setProof();
    resetRuns(c);
    const before = snapshot(c.fx);
    const out = await c.check();
    expect(out.problems).toEqual([]);
    expect(out.ok).toBe(true);
    expect(lines(out.stderr, 'tests: ')).toEqual([WHOLE, PROOF]);
    // The proof run held the stage's test files and spec folder, and the code and package.json as they were before the stage.
    const runs = c.runs();
    expect(runs).toHaveLength(2);
    const [whole, proof] = runs;
    const found = (run: typeof whole, file: string) => Number(run?.files[file] ?? 'absent');
    for (const file of ['src/providers/config.ts', 'package.json', 'tests/PRV-001.test.ts', 'tests/SET-001.test.ts', 'spec/modules/providers/contracts.md']) {
      expect(found(whole, file), `the whole tree holds the stage's ${file}`).toBeGreaterThan(0);
    }
    expect(found(proof, 'tests/PRV-001.test.ts')).toBeGreaterThan(0);
    expect(found(proof, 'tests/SET-001.test.ts')).toBeGreaterThan(0);
    expect(found(proof, 'spec/modules/providers/contracts.md')).toBeGreaterThan(0);
    expect(found(proof, 'src/providers/config.ts')).toBe(0);
    expect(found(proof, 'package.json')).toBe(0);
    // The proof tree is a folder of its own, removed when the check ends; the stage's tree and git are as they were.
    expect(proof?.dir).not.toBe(c.fx.repo);
    expect(existsSync(proof?.dir ?? c.fx.repo)).toBe(false);
    expect(snapshot(c.fx)).toEqual(before);
  }, 180_000);

  it('PIP-024/S2 A test that passes without the code is refused', async () => {
    const c = await stage();
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    expect((await c.check()).problems).toEqual([NOFAIL('SET-001/S4')]);
    // The same when the only test of SET-001/S4 is skipped on the proof tree.
    c.setProof({ failing: [{ id: 'PRV-001/S4' }], skip: ['SET-001/S4'] });
    expect((await c.check()).problems).toEqual([NOFAIL('SET-001/S4')]);
    // PRV-001/S1, reworded over the same steps, needs no failing test: it passes on the proof tree in S1.
    c.setProof();
    expect((await c.check()).problems).toEqual([]);
  }, 180_000);

  it('PIP-024/S3 A test that fails first by an error is refused', async () => {
    const c = await stage();
    const problem = `on the code before the build, the test "${S4_PRV}" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts, or report with lane: full`;
    c.setProof({ failing: [{ id: 'PRV-001/S4', kind: 'error' }, { id: 'SET-001/S4' }] });
    expect((await c.check()).problems).toEqual([problem]);
    // The problem is given as well when another test of PRV-001/S4 fails there on its assertion.
    c.setProof({ failing: [{ id: 'PRV-001/S4', kind: 'error' }, { id: 'SET-001/S4' }], extra: ['PRV-001/S4'] });
    expect((await c.check()).problems).toEqual([problem]);
  }, 180_000);

  it('PIP-024/S4 A failure that does not say it is an assertion proves nothing', async () => {
    const c = await stage();
    c.setProof({ failing: [{ id: 'PRV-001/S4', kind: 'none' }, { id: 'SET-001/S4' }] });
    expect((await c.check()).problems).toEqual([
      `on the code before the build, the test report does not say whether the test "${S4_PRV}" failed on an assertion; make the report tell them apart, or report with lane: full`,
    ]);
  }, 180_000);

  it('PIP-024/S5 A test file that does not load on the earlier code is refused', async () => {
    const c = await stage();
    c.setProof({ omit: ['PRV-001/S4'], failing: [{ id: 'SET-001/S4' }], failedFile: { name: 'tests/PRV-001.test.ts', message: "Cannot find module '../src/gemini'" } });
    expect((await c.check()).problems).toEqual([
      "no test of PRV-001/S4 ran on the code before the build (tests/PRV-001.test.ts: Cannot find module '../src/gemini'); write one that fails there on what it asserts, or report with lane: full",
    ]);
    // With a report that names no failed file, the problem has no text in parentheses.
    c.setProof({ omit: ['PRV-001/S4'], failing: [{ id: 'SET-001/S4' }] });
    const bare = (await c.check()).problems ?? [];
    expect(bare).toHaveLength(1);
    expect(bare[0]).toBe('no test of PRV-001/S4 ran on the code before the build; write one that fails there on what it asserts, or report with lane: full');
  }, 180_000);

  it('PIP-024/S6 A documented scenario passes on the earlier code', async () => {
    const c = await buildStage('proof-documented', { documents: ['SET-001/S4'] });
    // It passes there: the first check is accepted.
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    expect(await c.check()).toMatchObject({ ok: true, problems: [] });
    // It fails there: refused.
    c.setProof({ failing: [{ id: 'PRV-001/S4' }, { id: 'SET-001/S4' }] });
    expect((await c.check()).problems).toEqual([
      `the test "${S4_SET}" fails on the code before the build, but the spec-writer listed SET-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites SET-001/S4`,
    ]);
    // Only a skipped test of it: refused.
    c.setProof({ failing: [{ id: 'PRV-001/S4' }], skip: ['SET-001/S4'] });
    expect((await c.check()).problems).toEqual([
      'no test of SET-001/S4 passes on the code before the build, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass',
    ]);
  }, 240_000);

  it('PIP-024/S7 The whole tree is checked first, as the tester\'s and the implementer\'s', async () => {
    const c = await buildStage('proof-whole', { checkCommand: true });
    const whole = join(c.scratch, 'whole.json');
    const original = readFileSync(whole, 'utf8');
    const stub = join(c.fx.repo, 'src/providers/config.ts');
    const stubbed = readFileSync(stub, 'utf8');
    const rows = (mutate: (tests: { title: string; status: string }[]) => { title: string; status: string; failureMessages?: string[] }[]) => {
      const parsed = JSON.parse(original) as { testResults: { assertionResults: { title: string; status: string }[] }[] };
      writeFileSync(whole, JSON.stringify({ testResults: [{ assertionResults: mutate(parsed.testResults[0]?.assertionResults ?? []) }] }));
    };
    const cases: { name: string; apply: () => void; undo: () => void; problem: string; report?: string }[] = [
      {
        name: 'a failing test on the whole tree',
        apply: () => { rows((t) => t.map((x) => (x.title === S4_SET ? { ...x, status: 'failed', failureMessages: ['AssertionError: no'] } : x))); c.flag('whole-fail', true); },
        undo: () => { writeFileSync(whole, original); c.flag('whole-fail', false); },
        problem: `tests fail (exit 1): ${S4_SET}`,
      },
      {
        name: 'no test is named for SET-001/S4',
        apply: () => { rows((t) => t.filter((x) => !x.title.startsWith('SET-001/S4 '))); },
        undo: () => { writeFileSync(whole, original); },
        problem: 'no test covers SET-001/S4; name it "SET-001/S4 <scenario title>"',
      },
      {
        name: 'a passing test named after a scenario the spec does not have',
        apply: () => { rows((t) => [...t, { title: 'PRV-001/S9 Removed long ago', status: 'passed' }]); },
        undo: () => { writeFileSync(whole, original); },
        problem: 'test "PRV-001/S9 Removed long ago" names PRV-001/S9, which is not in the spec; delete or rename it',
      },
      {
        name: 'a check command that fails',
        apply: () => { c.flag('check-fail', true); },
        undo: () => { c.flag('check-fail', false); },
        problem: `${c.checkCommand} fails (exit 1): src/app.ts:3 unused`,
      },
      {
        name: 'a SPEC-STUB line the branch added',
        apply: () => { appendFileSync(stub, "// SPEC-STUB PROP-215: throw new Error('not yet')\n"); },
        undo: () => { writeFileSync(stub, stubbed); },
        problem: 'SPEC-STUB is still in src/providers/config.ts; replace every stub with the real code',
      },
      {
        name: 'no mutation for SET-001/S4',
        apply: () => undefined,
        undo: () => undefined,
        problem: NOMUT('SET-001/S4'),
        report: c.implementer({ mutations: MUTATIONS.slice(0, 1) }),
      },
    ];
    for (const row of cases) {
      row.apply();
      resetRuns(c);
      const out = await c.check(row.report);
      expect(out.problems, row.name).toEqual([row.problem]);
      expect(c.runCount(), `${row.name}: only the whole-tree run was made`).toBe(1);
      expect(out.stderr, row.name).not.toContain(PROOF);
      row.undo();
    }
  }, 300_000);

  it('PIP-024/S8 Every build stage is proved against the code before the first one', async () => {
    const c = await buildStage('proof-second');
    await firstStageThenChanges(c);
    mainBrings(c);
    await secondBuildStage(c);
    resetRuns(c);
    // The changed test of SET-001/S4 passes on the proof tree: the problem is the one of S2.
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    expect((await c.check()).problems).toEqual([NOFAIL('SET-001/S4')]);
    const proof = c.runs().at(-1);
    const found = (file: string) => Number(proof?.files[file] ?? 'absent');
    // The proof tree holds what main brought, and "src/providers/config.ts" without the first build stage's change.
    expect(found('src/other.ts')).toBeGreaterThan(0);
    expect(found('tests/other.test.ts')).toBeGreaterThan(0);
    expect(found('src/providers/config.ts')).toBe(0);
    // Each test that fails there on its assertion, one of each failing: accepted.
    c.setProof({ extra: ['PRV-001/S4'] });
    expect(await c.check()).toMatchObject({ ok: true, problems: [] });
  }, 300_000);

  it('PIP-024/S9 A branch with nothing to prove makes no proof run', async () => {
    const c = await buildStage('proof-reword', { id: 'PROP-216', rewordOnly: true });
    const out = await c.check(c.implementer({ mutations: null }));
    expect(out.problems).toEqual([]);
    expect(out.ok).toBe(true);
    expect(out.stderr).not.toContain(PROOF);
    expect(c.runCount()).toBe(1);
  }, 180_000);

  it('PIP-024/S10 A proof run with no results neither accepts nor refuses', async () => {
    const c = await buildStage('proof-no-results', { worktreeSetup: true });
    const ticketFile = join(c.fx.repo, 'tickets', `${c.id}.md`);
    const before = { status: snapshot(c.fx).status, ticket: readFileSync(ticketFile, 'utf8'), history: history(c).length };
    const unchanged = () => {
      expect(snapshot(c.fx).status).toBe(before.status);
      expect(readFileSync(ticketFile, 'utf8')).toBe(before.ticket);
      expect(history(c)).toHaveLength(before.history);
    };
    // The proof run writes no report.
    c.flag('proof-noreport', true);
    const out = await c.advanceText();
    expect(out.code).toBe(3);
    expect(lines(out.stderr, NOT_RUN)).toHaveLength(1);
    unchanged();
    // A report with no results from check-report is the one problem, and exit 1.
    const checked = await c.fx.spec(c.implementer(), 'check-report', 'implementer', c.id, '--format', 'json');
    expect(checked.code).toBe(1);
    const problems = safeJson<{ problems: string[] }>(checked.stdout)?.problems ?? [];
    expect(problems).toHaveLength(1);
    expect(problems[0]?.startsWith('the test command gave no results: on the code before the build: ')).toBe(true);
    c.flag('proof-noreport', false);
    // worktreeSetup failing in the proof tree is the same.
    c.flag('setup-fail', true);
    const setup = await c.advanceText();
    expect(setup.code).toBe(3);
    expect(lines(setup.stderr, `${NOT_RUN}worktreeSetup failed: `)).toHaveLength(1);
    expect(setup.stderr).toContain('setup boom');
    unchanged();
    c.flag('setup-fail', false);
    // A report with lane full, or a blocked one, needs no run: the stage can leave the lane though the proof run would give nothing.
    c.flag('proof-noreport', true);
    resetRuns(c);
    const left = await c.advance(c.implementer({ lane: 'full', mutations: null }));
    expect(left.code, left.stderr).toBe(0);
    expect(c.runCount()).toBe(0);
  }, 300_000);

  it('PIP-024/S12 Advance reuses a proof run made on the same trees', async () => {
    const c = await buildStage('proof-reuse');
    c.setProof();
    resetRuns(c);
    expect((await c.check()).ok).toBe(true);
    expect(c.runCount()).toBe(2);
    const out = await c.advance();
    expect(out.code, out.stderr).toBe(0);
    expect(c.runCount(), 'neither run is made again').toBe(2);
    const reused = lines(out.stderr, 'tests: ');
    expect(reused).toHaveLength(2);
    expect(reused[0]).toMatch(/^tests: reused the test run made at \S+ on this tree$/);
    expect(reused[1]).toMatch(/^tests: reused the proof run made at \S+ on this tree$/);

    // After a change to a file the tree holds, both runs are made again.
    const d = await buildStage('proof-reuse-changed');
    expect((await d.check()).ok).toBe(true);
    expect(d.runCount()).toBe(2);
    appendFileSync(join(d.fx.repo, 'src/app.ts'), '// changed after the check\n');
    const again = await d.advance();
    expect(again.code, again.stderr).toBe(0);
    expect(d.runCount()).toBe(4);
    expect(again.stderr).not.toMatch(/^tests: reused/m);
  }, 300_000);

  it('PIP-024/S13 The report claims nothing the runs do not show', async () => {
    const c = await stage();
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    const out = await c.check(c.implementer({ summary: 'every new test failed first' }));
    expect(out.problems).toEqual([NOFAIL('SET-001/S4')]);
    // A change to testGlobs in spec/config.json is refused as a spec change, and no proof run is made.
    c.setProof();
    const configPath = join(c.fx.repo, 'spec/config.json');
    const original = readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(original) as { testGlobs: string[] };
    cfg.testGlobs.push('src/providers/**');
    writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
    try {
      const changed = await c.check();
      expect(changed.problems).toContain('the implementer never changes spec files; revert spec/config.json');
      expect(changed.stderr).not.toContain(PROOF);
    } finally {
      writeFileSync(configPath, original);
    }
  }, 180_000);
});

describe('PIP-024/S14 Other implementer stages have no proof run', () => {
  const checkImplementer = async (fx: Fx, id: string) => {
    const started = await fx.spec('', 'ticket', 'start', id, 'implementer');
    expect(started.code, started.stderr).toBe(0);
    appendFileSync(join(fx.repo, 'src/app.ts'), '// the code\n');
    const out = await fx.spec(report(`role: implementer\nticket: ${id}\nresult: done\nsummary: The code`), 'check-report', 'implementer', id, '--format', 'json');
    return { out, parsed: safeJson<{ ok: boolean; problems: string[] }>(out.stdout) };
  };

  it('PIP-024/S14 Other implementer stages have no proof run', async () => {
    // TASK-101 is in the fixture; BUG-301 has its tester done; PROP-210 is in the docs lane after a reviewer's changes.
    const mutation = ', mutations: [{ scenario: PRV-002/S3, wrong: "returns the first fallback" }]';
    const bug = `---\nid: BUG-301\ntype: bug\ntitle: A bug\nstatus: open\nstage: null\ntouches: []\nviolates: [PRV-002/S3]\nchanged: []\nquestions: []\nhistory:\n${rec('tester', { extra: mutation })}\n---\nFix it.\n`;
    const docs = ticketText('PROP-210', 'docs', [rec('spec-writer', { extra: ', lane: docs' }), rec('spec-review'), rec('reviewer', { verdict: 'changes', extra: ', findings: [{ cites: [PRV-001/S1], text: "a finding", class: C9 }]' })]);
    for (const id of ['TASK-101', 'BUG-301', 'PROP-210']) {
      const fx = plainFixture(`proof-other-${id.toLowerCase()}`, { 'BUG-301': bug, 'PROP-210': docs });
      const { out, parsed } = await checkImplementer(fx, id);
      expect(parsed?.problems, `${id}: ${out.stderr}`).toEqual([]);
      expect(parsed?.ok, id).toBe(true);
      expect(out.stderr, id).not.toContain(PROOF);
    }
  }, 300_000);

  it('PIP-024/S14 a proposal in the full lane has no proof run in its implementer stage', async () => {
    const c = await buildStage('proof-full-lane', { id: 'PROP-201', lane: null, stopBefore: 'implementer' });
    // Its tester's tests fail on the code (the whole-tree script reports them failing), its implementer's code makes them pass.
    const started = await c.fx.spec('', 'ticket', 'start', c.id, 'tester');
    expect(started.code, started.stderr).toBe(0);
    c.fx.apply('reference/PROP-201.tester.patch');
    const muts = JSON.stringify(MUTATIONS);
    const tester = await c.fx.spec(report(`role: tester\nticket: ${c.id}\nresult: done\nsummary: Tests for gemini\nmutations: ${muts}`), 'ticket', 'advance', c.id, '--format', 'json');
    expect(tester.code, tester.stderr).toBe(0);
    expect(safeJson<{ next: string }>(tester.stdout)?.next).toBe('implementer');
    const impl = await c.fx.spec('', 'ticket', 'start', c.id, 'implementer');
    expect(impl.code, impl.stderr).toBe(0);
    c.fx.apply('reference/PROP-201.implementer.patch');
    resetRuns(c);
    const out = await c.check(report(`role: implementer\nticket: ${c.id}\nresult: done\nsummary: The code`));
    expect(out.problems).toEqual([]);
    expect(out.stderr).not.toContain(PROOF);
    expect(c.runCount()).toBe(1);
  }, 300_000);
});

describe('PIP-019/S6 A build stage names them as a tester does', () => {
  it('PIP-019/S6 A build stage names them as a tester does', async () => {
    const c = await buildStage('proof-mutations');
    c.setProof();
    // With no mutations, each scenario the branch added is a problem, in the order of the IDs.
    expect((await c.check(c.implementer({ mutations: null }))).problems).toEqual([NOMUT('PRV-001/S4'), NOMUT('SET-001/S4')]);
    // With one for each, the report is accepted, and advance keeps them in the implementer's record.
    expect(await c.check()).toMatchObject({ ok: true, problems: [] });
    const out = await c.advance();
    expect(out.json?.problems).toEqual([]);
    expect(history(c).at(-1)).toMatchObject({ role: 'implementer', result: 'done', mutations: MUTATIONS });
    // A later build stage need not name them again, as no done spec-writer stage was recorded since.
    await firstStageChangesOnly(c);
    mainBrings(c);
    await secondBuildStage(c);
    c.setProof();
    expect(await c.check(c.implementer({ mutations: null }))).toMatchObject({ ok: true, problems: [] });
    // A done implementer report on a proposal in the full lane that holds one is refused as on any non-tester role.
    const full = await buildStage('proof-mutations-full', { id: 'PROP-201', lane: null, stopBefore: 'implementer' });
    expect((await full.fx.spec('', 'ticket', 'start', full.id, 'tester')).code).toBe(0);
    full.fx.apply('reference/PROP-201.tester.patch');
    const tester = await full.fx.spec(report(`role: tester\nticket: ${full.id}\nresult: done\nsummary: Tests\nmutations: ${JSON.stringify(MUTATIONS)}`), 'ticket', 'advance', full.id, '--format', 'json');
    expect(tester.code, tester.stderr).toBe(0);
    expect((await full.fx.spec('', 'ticket', 'start', full.id, 'implementer')).code).toBe(0);
    full.fx.apply('reference/PROP-201.implementer.patch');
    const refused = await full.check();
    expect(refused.problems).toEqual(['only the tester lists mutations; leave them out of the implementer\'s report']);
  }, 400_000);
});

/** The reviewer asks for changes after the build stage already recorded. */
async function firstStageChangesOnly(c: Case): Promise<void> {
  const started = await c.fx.spec('', 'ticket', 'start', c.id, 'reviewer');
  expect(started.code, started.stderr).toBe(0);
  const message = report(`role: reviewer\nticket: ${c.id}\nresult: done\nsummary: One thing to fix\nverdict: changes\nfindings: [{ cites: [PRV-001/S4], text: "a finding", class: C9 }]`);
  const out = await c.fx.spec(message, 'ticket', 'advance', c.id, '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  expect(safeJson<{ next: string }>(out.stdout)?.next).toBe('implementer');
}

describe('PIP-005/S14 A build stage changes tests and code, and nothing else', () => {
  it('PIP-005/S14 A build stage changes tests and code, and nothing else', async () => {
    const c = await buildStage('proof-paths');
    c.setProof();
    const clean = await c.check();
    expect((clean.problems ?? []).filter((p) => p.includes('src/providers/config.ts') || p.includes('tests/PRV-001.test.ts'))).toEqual([]);
    expect(clean.problems).toEqual([]);
    // With a spec file and a protected file changed too, the path problems are, in order, these two.
    const configPath = join(c.fx.repo, 'spec/config.json');
    const original = readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(original) as { testGlobs: string[] };
    cfg.testGlobs.push('docs/**');
    writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
    appendFileSync(join(c.fx.repo, 'tests/SET-002.test.ts'), '// a protected test\n');
    const out = await c.check();
    expect((out.problems ?? []).filter((p) => p.startsWith('the implementer never changes') || p.startsWith('protected files may not change'))).toEqual([
      'the implementer never changes spec files; revert spec/config.json',
      'protected files may not change: revert tests/SET-002.test.ts',
    ]);
    writeFileSync(configPath, original);
    // Once the ticket has left the build lane, its implementer's change to a test is refused as on any proposal.
    const left = ticketText('PROP-215', 'build', [rec('spec-writer', { extra: ', lane: build' }), rec('spec-review'), rec('implementer', { extra: ', lane: full' }), rec('tester')]);
    const fx = plainFixture('proof-paths-left', { 'PROP-215': left });
    const started = await fx.spec('', 'ticket', 'start', 'PROP-215', 'implementer');
    expect(started.code, started.stderr).toBe(0);
    appendFileSync(join(fx.repo, 'tests/PRV-001.test.ts'), '// a test\n');
    const refused = await fx.spec(report('role: implementer\nticket: PROP-215\nresult: done\nsummary: Code'), 'check-report', 'implementer', 'PROP-215', '--format', 'json');
    expect(safeJson<{ problems: string[] }>(refused.stdout)?.problems).toContain("on a proposal the tests are the tester's and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong");
  }, 300_000);
});

describe('PIP-022/S3 Every way a run gives no results is a check that could not run', () => {
  it('PIP-022/S3 the proof run of a build stage that gives no results is a check that could not run', async () => {
    const c = await buildStage('proof-could-not-run');
    const before = { history: history(c).length, status: snapshot(c.fx).status };
    // The first run passes; the proof run ends in each way: no report, a report in no known format.
    const ways: { name: string; arm: () => void; disarm: () => void }[] = [
      { name: 'no report', arm: () => { c.flag('proof-noreport', true); }, disarm: () => { c.flag('proof-noreport', false); } },
      { name: 'a report in no known format', arm: () => { writeFileSync(join(c.scratch, 'proof.json'), 'not a report'); }, disarm: () => { c.setProof(); } },
    ];
    for (const way of ways) {
      way.arm();
      const out = await c.advanceText();
      expect(out.code, way.name).toBe(3);
      expect(lines(out.stderr, 'the check could not run: the test command gave no results: on the code before the build: '), way.name).toHaveLength(1);
      expect(history(c), way.name).toHaveLength(before.history);
      expect(snapshot(c.fx).status, way.name).toBe(before.status);
      expect(history(c).some((h) => h['role'] === 'implementer'), `${way.name}: no refusal is counted`).toBe(false);
      way.disarm();
    }
    expect(DEFAULT_ID).toBe(c.id);
  }, 300_000);
});
