// PROP-058: a reviewer finding may ask only for tests (pipeline.ReviewFinding.tests).
// PIP-001 routes it to the tester, PIP-003 reads it, PIP-004 checks it, PIP-012 marks it in the briefs.
import { describe, expect, it } from 'vitest';
import { planAdvance } from '../../src/core/advance';
import { buildBrief } from '../../src/core/brief';
import type { Ticket } from '../../src/core/model';
import { nextStage } from '../../src/core/pipeline';
import { type StageContext, checkReport, extractReport } from '../../src/core/report';
import type { HistoryEntry, Report, Role } from '../../src/core/schemas';
import { loadFixture, report, ticketOf } from '../helpers';

const fx = loadFixture();
const NOW = '2026-10-31T12:00:00.000Z';
const NEEDS = 'no test checks the second rate limit';
const CODE = 'select.ts ignores the rule';
const GAP = 'no scenario covers a second rate limit';
const tests = { cites: ['PRV-001/S3'], text: NEEDS, tests: true };
const code = { cites: ['PRV-001/R1'], text: CODE };
const gap = { cites: ['PRV-001/S3'], text: GAP, spec: true };

const h = (role: Role, verdict: 'approve' | 'changes' | null = null, extra: object = {}): HistoryEntry => ({ at: 't', role, result: 'done', summary: '', verdict, assumed: [], ...extra });
const asReport = (r: Partial<Report>): Report => ({ role: 'reviewer', ticket: 'PROP-201', result: 'done', summary: 'ok', changed: [], assumed: [], blockers: [], verdict: 'changes', findings: [], ...r });
const running = (id: string, stage: Role, history: HistoryEntry[]): Ticket => {
  const t = ticketOf(fx.tickets, id);
  return { ...t, data: { ...t.data, status: 'in_progress', stage, history } };
};
const review = (id: string, history: HistoryEntry[], findings: unknown[]) => planAdvance(running(id, 'reviewer', history), asReport({ ticket: id, findings: findings as Report['findings'] }), NOW);
const prop = [h('spec-writer'), h('tester'), h('implementer')];
const changes = (findings: unknown[]) => h('reviewer', 'changes', { findings });

describe('PIP-001 a finding that asks for tests', () => {
  it('PIP-001/S18 A finding that asks only for tests sends the ticket to the tester', () => {
    const p = review('PROP-201', prop, [tests, code]);
    expect(p.next).toBe('tester');
    expect(p.status).toBe('open');
    expect(p.patch.history?.at(-1)).toMatchObject({ role: 'reviewer', verdict: 'changes', findings: [tests, code] });
    const back = [...prop, changes([tests, code])];
    expect(nextStage('proposal', back)).toEqual({ stage: 'tester' });
    expect(nextStage('proposal', [...back, h('tester')])).toEqual({ stage: 'implementer' });
    expect(nextStage('proposal', [...back, h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
    // A bug goes the same way; a task has no tester stage.
    expect(review('BUG-301', [h('tester'), h('implementer')], [tests]).next).toBe('tester');
    expect(review('TASK-101', [h('implementer')], [tests]).next).toBe('implementer');
    // tests: false is a finding about the code.
    expect(review('PROP-201', prop, [{ ...tests, tests: false }]).next).toBe('implementer');
    // The round is counted: the third round of changes blocks.
    const third = [h('spec-writer'), h('tester'), h('implementer'), changes([code]), h('implementer'), changes([code]), h('implementer')];
    const blocked = review('PROP-201', third, [tests]);
    expect(blocked.status).toBe('blocked');
    expect(blocked.next).toBeNull();
  });

  it('PIP-001/S19 With both marks the earliest stage wins', () => {
    expect(review('PROP-201', prop, [gap, tests]).next).toBe('spec-writer');
    expect(review('PROP-201', prop, [tests, gap]).next).toBe('spec-writer');
    const one = review('PROP-201', prop, [{ cites: ['PRV-001/S3'], text: 'x', spec: true, tests: true }]);
    expect(one.next).toBe('spec-writer');
    expect(review('BUG-301', [h('tester'), h('implementer')], [gap, tests]).next).toBe('tester');
    expect(review('TASK-101', [h('implementer')], [gap, tests]).next).toBe('implementer');
    // A report may carry both marks, on one finding or on two.
    const r = extractReport(reviewerMsg(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: x, spec: true, tests: true }]`));
    expect(r.problems).toEqual([]);
    expect(r.report?.findings[0]).toMatchObject({ spec: true, tests: true });
  });

});

const reviewerMsg = (fields: string) => report(`role: reviewer\nticket: PROP-201\nresult: done\nsummary: ok\n${fields}`);

describe('PIP-003 reading a finding that asks for tests', () => {
  it('PIP-003/S14 A finding may ask only for tests', () => {
    const r = extractReport(reviewerMsg(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: "${NEEDS}", tests: true }, { cites: [PRV-001/R1], text: "${CODE}", tests: false }]`));
    expect(r.problems).toEqual([]);
    expect(r.report?.findings[0]).toEqual({ cites: ['PRV-001/S3'], text: NEEDS, tests: true });
    expect(r.report?.findings[1]).toMatchObject({ cites: ['PRV-001/R1'], text: CODE });
    expect(r.report?.findings[1]).not.toMatchObject({ tests: true });
    const bad = extractReport(reviewerMsg('verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: x, tests: "yes" }]'));
    expect(bad.problems).toHaveLength(1);
    expect(bad.problems[0]).toMatch(/^report findings[.\d]*: /);
    expect(bad.problems[0]).toContain('tests');
  });
});

function check(role: Role, message: string) {
  const t = ticketOf(fx.tickets, 'PROP-201');
  const ctx: StageContext = {
    spec: fx.spec,
    index: fx.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: role } },
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
  };
  return checkReport(message, ctx);
}

describe('PIP-004 who may ask for tests', () => {
  it('PIP-004/S20 Only a verdict of changes asks for tests', () => {
    const f = `findings: [{ cites: [PRV-001/S3], text: "${NEEDS}", tests: true, class: C7 }]`;
    const approve = check('reviewer', reviewerMsg(`verdict: approve\n${f}`));
    expect(approve.problems).toContain('a finding marked tests: true needs verdict changes');
    const changesR = check('reviewer', reviewerMsg(`verdict: changes\n${f}`));
    expect(changesR.problems).toEqual([]);
    expect(changesR.ok).toBe(true);
    const both = check('reviewer', reviewerMsg(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: "${NEEDS}", tests: true, spec: true, class: C7 }]`));
    expect(both.problems).toEqual([]);
    const other = check('implementer', report(`role: implementer\nticket: PROP-201\nresult: done\nsummary: ok\n${f}`));
    expect(other.problems).toContain('only the reviewer and the spec review set verdict and findings');
  });
});

describe('PIP-012 the tests mark rides in the briefs', () => {
  const withHistory = (history: HistoryEntry[]) => {
    const t = ticketOf(fx.tickets, 'PROP-201');
    const ticket: Ticket = { ...t, data: { ...t.data, status: 'open', stage: null, history } };
    return { ...fx, tickets: { ...fx.tickets, tickets: fx.tickets.tickets.map((x) => (x.id === 'PROP-201' ? ticket : x)) } };
  };
  const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

  it('PIP-012/S19 A finding that asks for tests is marked in the tester\'s brief', () => {
    const asked = withHistory([...prop, changes([tests, code])]);
    const text = buildBrief({ ...asked, role: 'tester', id: 'PROP-201' });
    expect(groupsOf(text)[1]).toBe('Review findings');
    expect(text).toContain(`## Review findings\n- PRV-001/S3 (needs tests): ${NEEDS}\n- PRV-001/R1: ${CODE}`);
    // The implementer's brief holds the same group once the tester's stage is done.
    const after = withHistory([...prop, changes([tests, code]), h('tester')]);
    expect(buildBrief({ ...after, role: 'implementer', id: 'PROP-201' })).toContain(`## Review findings\n- PRV-001/S3 (needs tests): ${NEEDS}\n- PRV-001/R1: ${CODE}`);
    // A finding with both marks.
    const both = withHistory([...prop, changes([{ cites: ['PRV-001/S3'], text: 'both', spec: true, tests: true }])]);
    expect(buildBrief({ ...both, role: 'tester', id: 'PROP-201' })).toContain('- PRV-001/S3 (gap in the spec) (needs tests): both');
  });
});
