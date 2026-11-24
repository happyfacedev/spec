// PIP-019: a done tester report on a proposal or a bug names a wrong implementation for every
// scenario the ticket changes (pipeline.Report.mutations). The check runs over contexts built here,
// as in documents-latest.test.ts.
import { describe, expect, it } from 'vitest';
import { planAdvance } from '../../src/core/advance';
import { type StageContext, checkReport, extractReport } from '../../src/core/report';
import type { HistoryEntry, Role } from '../../src/core/schemas';
import type { TestCase } from '../../src/core/test-report';
import { loadFixture, report, testerMutations, ticketOf, validTesterMutations } from '../helpers';

const fx = loadFixture();
const S4 = 'PRV-001/S4 Streams from gemini';
const SET4 = 'SET-001/S4 Enable gemini';
const NEW = ['PRV-001/S4', 'SET-001/S4'];
const everyTest = fx.spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
const BUG_S3 = 'PRV-002/S3 Fallback provider also rate-limits';

const passing = (names: string[]): TestCase[] => names.map((name) => ({ name, status: 'passed' as const }));
const stage = (role: Role, extra: object = {}): HistoryEntry => ({ at: 't', role, result: 'done', summary: '', verdict: null, assumed: [], ...extra });
const none = (id: string) => `the report names no wrong implementation for ${id}; add { scenario: ${id}, wrong: "<a plausible wrong implementation its test fails against>" } under mutations`;

function context(id: string, role: Role, over: Partial<StageContext> = {}, history: HistoryEntry[] = []): StageContext {
  const t = ticketOf(fx.tickets, id);
  return {
    spec: fx.spec,
    index: fx.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: role, history } },
    role,
    changedPaths: [],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: ['src/**'],
    testGlobs: ['tests/**'],
    protectedGlobs: [],
    lint: [],
    tests: null,
    newScenarios: [],
    removed: [],
    unretired: [],
    specChanged: [],
    codeChanges: [],
    stubsLeft: [],
    ...over,
  };
}

/** PROP-201's tester stage: the spec-writer added both S4s; `S4` fails on its assertion, the rest pass. */
const proposal = (history: HistoryEntry[] = [], failing: string[] = [S4]): StageContext =>
  context('PROP-201', 'tester', {
    changedPaths: ['tests/PRV-001.test.ts'],
    newScenarios: NEW,
    tests: {
      exitCode: failing.length > 0 ? 1 : 0,
      tests: [...passing([...everyTest, S4, SET4].filter((n) => !failing.includes(n))), ...failing.map((name) => ({ name, status: 'failed' as const, failureKind: 'assertion' as const }))],
      error: null,
    },
  }, history);

/** BUG-301's tester stage: it violates PRV-002/S3, whose test fails. */
const bug = (): StageContext =>
  context('BUG-301', 'tester', {
    changedPaths: ['tests/PRV-002.test.ts'],
    tests: { exitCode: 1, tests: [...passing(everyTest.filter((n) => n !== BUG_S3)), { name: BUG_S3, status: 'failed' as const, failureKind: 'assertion' as const }], error: null },
  });

const tester = (id: string, extra: string) => report(`role: tester\nticket: ${id}\nresult: done\nsummary: ok\nchanged: [PRV-001/S1]\n${extra}`);
const withMutations = (...entries: object[]) => 'mutations: ' + JSON.stringify(entries);
/** The parsed report's mutations; read loosely, since the Report type does not hold the key yet. */
const mutationsOf = (r: { report: object | null }): unknown => (r.report as Record<string, unknown> | null)?.mutations;

describe('PIP-019 a tester names a wrong implementation per changed scenario', () => {
  it('PIP-019/S1 A tester report that names no wrong implementation for a changed scenario is refused', () => {
    const partial = checkReport(tester('PROP-201', validTesterMutations('PRV-001/S4')), proposal());
    expect(partial.problems).toEqual([none('SET-001/S4')]);
    expect(partial.ok).toBe(false);

    // On a bug, the scenario it violates.
    const missing = checkReport(tester('BUG-301', ''), bug());
    expect(missing.problems).toEqual([none('PRV-002/S3')]);
    expect(checkReport(tester('BUG-301', validTesterMutations('PRV-002/S3')), bug())).toMatchObject({ ok: true, problems: [] });

    // Each scenario without one is one problem, in the order of the scenario IDs.
    expect(checkReport(tester('PROP-201', ''), proposal()).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
  });

  it('PIP-019/S1 A mutation with no wrong, or a wrong with a line break, is refused as the report is read (R2)', () => {
    const bad: object[][] = [
      [{ scenario: 'PRV-001/S4' }],
      [{ scenario: 'PRV-001/S4', wrong: '' }],
      [{ wrong: 'streams from the first enabled provider' }],
      [{ scenario: 'PRV-001/S4', wrong: 'streams from the first\nenabled provider' }],
      [{ scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider', note: 'extra' }],
    ];
    for (const entries of bad) {
      const r = checkReport(tester('PROP-201', withMutations(...entries)), proposal());
      expect(r.problems, JSON.stringify(entries)).toHaveLength(1);
      expect(r.problems[0]?.startsWith('report mutations.0: '), r.problems[0]).toBe(true);
      expect(r.report).toBeNull();
    }
  });

  it('PIP-019/R1 The scenarios need mutations before and after the implementer, documented ones included', () => {
    const after = [stage('spec-writer'), stage('tester'), stage('implementer'), stage('reviewer', { verdict: 'changes' })];
    expect(checkReport(tester('PROP-201', ''), proposal(after, [])).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
    expect(checkReport(tester('PROP-201', validTesterMutations(...NEW)), proposal(after, []))).toMatchObject({ ok: true, problems: [] });
    // The spec-writer listed both as behaviour the code already has: their tests pass, and they still need mutations.
    const documented = [stage('spec-writer', { documents: NEW })];
    expect(checkReport(tester('PROP-201', ''), proposal(documented, [])).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
    expect(checkReport(tester('PROP-201', validTesterMutations(...NEW)), proposal(documented, []))).toMatchObject({ ok: true, problems: [] });
  });

  it('PIP-019/S2 A full list of mutations is accepted', () => {
    const full = validTesterMutations('PRV-001/S4', 'SET-001/S4', 'CNV-001/S1');
    // CNV-001/S1 is a scenario the ticket does not change: accepted.
    const r = checkReport(tester('PROP-201', full), proposal());
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(mutationsOf(r)).toEqual(testerMutations('PRV-001/S4', 'SET-001/S4', 'CNV-001/S1'));
  });

  it('PIP-019/S2 A mutation for a scenario the spec does not have is refused', () => {
    const r = checkReport(tester('PROP-201', validTesterMutations('PRV-001/S4', 'SET-001/S4', 'PRV-001/S9')), proposal());
    expect(r.problems).toEqual(['mutations names PRV-001/S9, which is not in the spec; name a scenario your tests cover']);
    expect(r.ok).toBe(false);
  });

  describe('PIP-019/S5 A later tester round names only what no earlier round did', () => {
    const first = stage('tester', { mutations: [{ scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider, not the active one' }, { scenario: 'SET-001/S4', wrong: 'enables gemini without saving its key' }] });
    const earlier = [stage('spec-writer'), first, stage('implementer')];

    it('PIP-019/S5 a report that names less than the scenarios, or nothing, is accepted when earlier rounds named them', () => {
      const one = checkReport(tester('PROP-201', withMutations({ scenario: 'SET-001/S4', wrong: 'saves the key under the wrong provider' })), proposal(earlier, []));
      expect(one.problems).toEqual([]);
      expect(one.ok).toBe(true);
      expect(mutationsOf(one)).toEqual([{ scenario: 'SET-001/S4', wrong: 'saves the key under the wrong provider' }]);
      // A report with no mutations at all is accepted the same way.
      expect(checkReport(tester('PROP-201', ''), proposal(earlier, []))).toMatchObject({ ok: true, problems: [] });
    });

    it('PIP-019/S5 only the scenarios no earlier round named are asked for', () => {
      const half = [stage('spec-writer'), stage('tester', { mutations: [{ scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider' }] }), stage('implementer')];
      expect(checkReport(tester('PROP-201', ''), proposal(half, [])).problems).toEqual([none('SET-001/S4')]);
      expect(checkReport(tester('PROP-201', validTesterMutations('SET-001/S4')), proposal(half, []))).toMatchObject({ ok: true, problems: [] });
      // A bug: the scenario it violates, named by an earlier round.
      const named = [stage('tester', { mutations: [{ scenario: 'PRV-002/S3', wrong: 'falls back to a provider that is also rate-limited' }] }), stage('implementer')];
      const late = context('BUG-301', 'tester', { changedPaths: ['tests/PRV-002.test.ts'], tests: { exitCode: 0, tests: passing(everyTest), error: null } }, named);
      expect(checkReport(tester('BUG-301', ''), late)).toMatchObject({ ok: true, problems: [] });
    });

    it('PIP-019/S5 a done spec-writer stage recorded after the earlier tester stage resets what it named', () => {
      const reset = [...earlier, stage('spec-writer')];
      expect(checkReport(tester('PROP-201', ''), proposal(reset, [])).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
      expect(checkReport(tester('PROP-201', validTesterMutations('SET-001/S4')), proposal(reset, [])).problems).toEqual([none('PRV-001/S4')]);
      // Only a spec-writer stage recorded after it counts: one before the tester stage does not.
      const before = [stage('spec-writer'), stage('spec-writer'), first, stage('implementer')];
      expect(checkReport(tester('PROP-201', ''), proposal(before, []))).toMatchObject({ ok: true, problems: [] });
      // A blocked spec-writer stage is not a done one.
      const stuck: HistoryEntry = { ...stage('spec-writer'), result: 'blocked' };
      expect(checkReport(tester('PROP-201', ''), proposal([...earlier, stuck], []))).toMatchObject({ ok: true, problems: [] });
    });

    it('PIP-019/S5 only a done tester stage names mutations for a later round', () => {
      const blockedRound: HistoryEntry = { ...stage('tester', { mutations: first.mutations }), result: 'blocked' };
      expect(checkReport(tester('PROP-201', ''), proposal([stage('spec-writer'), blockedRound, stage('implementer')], [])).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
      // A mutation kept in another role's record names nothing.
      const other = stage('implementer', { mutations: first.mutations });
      expect(checkReport(tester('PROP-201', ''), proposal([stage('spec-writer'), other], [])).problems).toEqual([none('PRV-001/S4'), none('SET-001/S4')]);
    });

    it('PIP-019/S5 advance keeps only the mutations of the new report in the new record', () => {
      const t = ticketOf(fx.tickets, 'PROP-201');
      const running = { ...t, data: { ...t.data, status: 'in_progress' as const, stage: 'tester' as const, history: earlier } };
      const mutations = [{ scenario: 'SET-001/S4', wrong: 'saves the key under the wrong provider' }];
      const p = planAdvance(running, { role: 'tester', ticket: 'PROP-201', result: 'done', summary: 'ok', changed: [], assumed: [], blockers: [], verdict: null, findings: [], mutations }, '2026-10-27T12:00:00.000Z');
      expect(p.patch.history?.at(-1)?.mutations).toEqual(mutations);
    });
  });

  it('PIP-019/S3 Only a done tester on a proposal or bug is asked for mutations', () => {
    const blocked = report('role: tester\nticket: PROP-201\nresult: blocked\nsummary: Waiting\nblockers: [{ text: waiting, cites: [PROP-201] }]');
    expect(checkReport(blocked, proposal()).problems.filter((p) => p.includes('mutation'))).toEqual([]);
    const task = checkReport(report('role: tester\nticket: TASK-101\nresult: done\nsummary: ok'), context('TASK-101', 'tester', { tests: { exitCode: 0, tests: passing(everyTest), error: null } }));
    expect(task.problems.filter((p) => p.includes('mutation'))).toEqual([]);

    // Any other role's report that holds a mutation is refused, whatever its result.
    const one = withMutations({ scenario: 'PRV-001/S1', wrong: 'streams twice' });
    const refused = (role: string, ticket: string, result: string, extra: string) =>
      checkReport(report(`role: ${role}\nticket: ${ticket}\nresult: ${result}\nsummary: ok\n${extra}\n${one}`), context(ticket, role as Role, { tests: { exitCode: 0, tests: passing(everyTest), error: null } })).problems;
    const leave = (role: string) => `only the tester lists mutations; leave them out of the ${role}'s report`;
    expect(refused('implementer', 'TASK-101', 'done', '')).toContain(leave('implementer'));
    expect(refused('implementer', 'TASK-101', 'blocked', 'blockers: [{ text: waiting, cites: [TASK-101] }]')).toContain(leave('implementer'));
    expect(refused('reviewer', 'TASK-101', 'done', 'verdict: approve')).toContain(leave('reviewer'));
    expect(refused('spec-writer', 'PROP-201', 'done', '')).toContain(leave('spec-writer'));
  });

  it('PIP-019/R2 A mutation holds a scenario and a wrong, and nothing else', () => {
    const ok = extractReport(tester('PROP-201', withMutations({ scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider' })));
    expect(ok.problems).toEqual([]);
    expect(mutationsOf(ok)).toEqual([{ scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider' }]);
    // A list key with no value is an empty list.
    expect(mutationsOf(extractReport(tester('PROP-201', 'mutations:')))).toEqual([]);
  });
});
