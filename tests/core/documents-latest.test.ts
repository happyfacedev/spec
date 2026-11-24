// PIP-006/R10, R8: which scenarios count as documented (only the latest done spec-writer stage's
// list), what a documented scenario needs (a test that runs and passes) and that R8's error check
// still applies to it. The tester's check runs over a ticket history and a test run built here.
import { describe, expect, it } from 'vitest';
import { type StageContext, checkReport } from '../../src/core/report';
import type { HistoryEntry, Role } from '../../src/core/schemas';
import type { TestCase } from '../../src/core/test-report';
import { loadFixture, report, ticketOf, validTesterMutations } from '../helpers';

const fx = loadFixture();
const testerReport = report('role: tester\nticket: PROP-201\nresult: done\nsummary: ok\nchanged: [PRV-001/S1]\n' + validTesterMutations('PRV-001/S4', 'SET-001/S4'));
const S4 = 'PRV-001/S4 Streams from gemini';
const SET4 = 'SET-001/S4 Enable gemini';
const NEW = ['PRV-001/S4', 'SET-001/S4'];
const inScope = fx.spec.features.filter((f) => f.id === 'PRV-001' || f.id === 'SET-001').flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
const passing = (names: string[]): TestCase[] => names.map((name) => ({ name, status: 'passed' as const }));
const done = (role: Role, extra: object = {}): HistoryEntry => ({ at: 't', role, result: 'done', summary: '', verdict: null, assumed: [], ...extra });
const listed = (documents: string[]) => ({ documents });

/** The tester's check on PROP-201 with `history`; every in-scope test and both new ones, except as `override` says. */
function check(history: HistoryEntry[], override: Record<string, Partial<TestCase> | null> = {}) {
  const t = ticketOf(fx.tickets, 'PROP-201');
  const tests = passing([...inScope, S4, SET4]).flatMap((c) => {
    const o = override[c.name];
    return o === null ? [] : [{ ...c, ...o }];
  });
  const ctx: StageContext = {
    spec: fx.spec,
    index: fx.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'tester', history } },
    role: 'tester',
    changedPaths: ['tests/PRV-001.test.ts'],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: ['src/**'],
    testGlobs: ['tests/**'],
    protectedGlobs: [],
    lint: [],
    tests: { exitCode: 1, tests, error: null },
    newScenarios: NEW,
    removed: [],
    unretired: [],
    specChanged: [],
    codeChanges: [],
    stubsLeft: [],
  };
  return checkReport(testerReport, ctx);
}

const failsOn = (kind?: TestCase['failureKind'], line?: string): Partial<TestCase> => ({ status: 'failed', ...(kind ? { failureKind: kind } : {}), ...(line ? { firstErrorLine: line } : {}) });
const DOCUMENTED_FAIL = (id: string, name: string) =>
  `the test "${name}" fails, but the spec-writer listed ${id} under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites ${id}`;

describe('PIP-006 documented scenarios in a ticket that came back', () => {
  const first = done('spec-writer', listed(NEW));
  const reopened = [first, done('tester'), done('reviewer', { verdict: 'changes' }), done('spec-writer')];

  it('PIP-006/S32 A reopened spec-writer stage revokes what it no longer lists', () => {
    const r = check(reopened, { [SET4]: failsOn('assertion') });
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    // Had the latest done stage listed SET-001/S4, its failing test would be refused.
    const relisted = [...reopened.slice(0, 3), done('spec-writer', listed(['SET-001/S4']))];
    expect(check(relisted, { [SET4]: failsOn('assertion') }).problems).toEqual([DOCUMENTED_FAIL('SET-001/S4', SET4)]);
    // A blocked spec-writer stage after the latest done one changes nothing.
    const blocked: HistoryEntry = { ...done('spec-writer'), result: 'blocked' };
    expect(check([...relisted, blocked], { [SET4]: failsOn('assertion') }).problems).toEqual([DOCUMENTED_FAIL('SET-001/S4', SET4)]);
  });

  it('PIP-006/S33 A documented scenario whose only test is skipped is refused', () => {
    const history = [first];
    expect(check(history, { [SET4]: { status: 'skipped' } }).problems).toEqual([
      'no test of SET-001/S4 passes, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass',
    ]);
  });

  it('PIP-006/S33 a documented scenario with one passing and one skipped test gives no problem', () => {
    expect(checkWithExtra([first], { name: SET4, status: 'skipped' }).problems).toEqual([]);
  });

  it('PIP-006/S34 A documented test that fails by an error keeps the error\'s problem', () => {
    const line = 'TypeError: gemini.stream is not a function';
    expect(check([first], { [S4]: failsOn('error', line) }).problems).toEqual([
      DOCUMENTED_FAIL('PRV-001/S4', S4),
      `the test "${S4}" fails with an error, not an assertion: ${line}; make it fail on what it asserts`,
    ]);
  });
});

describe('PIP-006 documented scenarios after the implementer (R9, R10)', () => {
  const docs = done('spec-writer', listed(NEW));
  const after = [docs, done('tester'), done('implementer'), done('reviewer', { verdict: 'changes' })];
  const line = 'TypeError: gemini.stream is not a function';

  it('PIP-006/S29 Before the implementer, a documented scenario still needs a passing test (also after a blocked implementer stage)', () => {
    // The exemption ends at the first implementer stage "whatever its result": a blocked one counts too.
    const blockedImpl: HistoryEntry = { ...done('implementer'), result: 'blocked' };
    expect(check([docs, done('tester')], { [S4]: failsOn('assertion') }).problems).toEqual([DOCUMENTED_FAIL('PRV-001/S4', S4)]);
    expect(check([docs, done('tester'), blockedImpl], { [S4]: failsOn('assertion') }).problems).toEqual([]);
  });

  it("PIP-006/S37 After the implementer, a documented scenario's failing test is held like any test", () => {
    const failing = check(after, { [S4]: failsOn('assertion') });
    expect(failing.problems).toEqual([]);
    expect(failing.ok).toBe(true);
    // A failure by an error is still refused, with the error's problem alone.
    expect(check(after, { [S4]: failsOn('error', line) }).problems).toEqual([
      `the test "${S4}" fails with an error, not an assertion: ${line}; make it fail on what it asserts`,
    ]);
    // A missing test is still refused.
    expect(check(after, { [SET4]: null }).problems).toEqual(['no test covers SET-001/S4; name it "SET-001/S4 <scenario title>"']);
    // A skipped-only documented test no longer needs to pass.
    expect(check(after, { [SET4]: { status: 'skipped' } }).problems).toEqual([]);
  });

  it('PIP-006/S38 A documented test left failing cannot pass the implementer', () => {
    const t = ticketOf(fx.tickets, 'PROP-201');
    const ctx: StageContext = {
      spec: fx.spec,
      index: fx.index,
      ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'implementer', history: after } },
      role: 'implementer',
      changedPaths: ['src/core/select.ts'],
      specPrefix: 'spec',
      ticketsPrefix: 'tickets',
      codeGlobs: ['src/**'],
      testGlobs: ['tests/**'],
      protectedGlobs: [],
      lint: [],
      tests: { exitCode: 1, tests: passing([...inScope, S4, SET4]).map((c) => (c.name === S4 ? { ...c, ...failsOn('assertion') } : c)), error: null },
      newScenarios: NEW,
      removed: [],
      unretired: [],
      specChanged: [],
      codeChanges: [],
      stubsLeft: [],
    };
    const msg = report('role: implementer\nticket: PROP-201\nresult: done\nsummary: ok\nchanged: [PRV-001/S1]');
    expect(checkReport(msg, ctx).problems).toEqual([`tests fail (exit 1): ${S4}`]);
  });
});

/** Like `check`, with one more test row beside the passing ones. */
function checkWithExtra(history: HistoryEntry[], extra: TestCase) {
  const t = ticketOf(fx.tickets, 'PROP-201');
  const tests = [...passing([...inScope, S4, SET4]), extra];
  const ctx: StageContext = {
    spec: fx.spec,
    index: fx.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'tester', history } },
    role: 'tester',
    changedPaths: ['tests/PRV-001.test.ts'],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: ['src/**'],
    testGlobs: ['tests/**'],
    protectedGlobs: [],
    lint: [],
    tests: { exitCode: 1, tests, error: null },
    newScenarios: NEW,
    removed: [],
    unretired: [],
    specChanged: [],
    codeChanges: [],
    stubsLeft: [],
  };
  return checkReport(testerReport, ctx);
}
