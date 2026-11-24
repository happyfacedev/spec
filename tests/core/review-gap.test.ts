// PROP-040: a reviewer finding may name a gap in the spec (pipeline.ReviewFinding.spec).
// PIP-003 reads it, PIP-004 checks it, PIP-008 keeps it in the record, PIP-012 shows it in the next briefs.
import { describe, expect, it } from 'vitest';
import { planAdvance } from '../../src/core/advance';
import { buildBrief } from '../../src/core/brief';
import type { Ticket } from '../../src/core/model';
import { type StageContext, checkReport, extractReport } from '../../src/core/report';
import type { HistoryEntry, Report, Role } from '../../src/core/schemas';
import { loadFixture, report, ticketOf, validTesterMutations } from '../helpers';

const fx = loadFixture();
const GAP = 'no scenario covers a second rate limit';
const CODE = 'select.ts ignores the rule';
const reviewerMsg = (fields: string) => report(`role: reviewer\nticket: PROP-201\nresult: done\nsummary: ok\n${fields}`);
const SPEC_FINDINGS = `findings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true }, { cites: [PRV-001/R1], text: "${CODE}" }]`;

describe('PIP-003 reading a finding that marks a gap', () => {
  it('PIP-003/S11 A finding may mark a gap in the spec', () => {
    const r = extractReport(reviewerMsg(`verdict: changes\n${SPEC_FINDINGS}`));
    expect(r.problems).toEqual([]);
    expect(r.report?.findings).toEqual([
      { cites: ['PRV-001/S3'], text: GAP, spec: true },
      { cites: ['PRV-001/R1'], text: CODE },
    ]);
    expect(r.report?.findings[1]).not.toHaveProperty('spec');
  });

  it('PIP-003/S12 The marker is true or false', () => {
    const yes = extractReport(reviewerMsg('verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: x, spec: "yes" }]'));
    expect(yes.problems).toHaveLength(1);
    expect(yes.problems[0]).toMatch(/^report findings[.\d]*: /);
    expect(yes.problems[0]).toContain('spec');
    const no = extractReport(reviewerMsg('verdict: changes\nfindings: [{ cites: [PRV-001/R1], text: x, spec: false }]'));
    expect(no.problems).toEqual([]);
    expect(no.report?.findings).toEqual([{ cites: ['PRV-001/R1'], text: 'x', spec: false }]);
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

describe('PIP-004 who may mark a gap', () => {
  it('PIP-004/S19 Only a verdict of changes marks a gap in the spec', () => {
    const approve = check('reviewer', reviewerMsg(`verdict: approve\nfindings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true, class: C1 }]`));
    expect(approve.problems).toContain('a finding marked spec: true needs verdict changes');
    const changes = check('reviewer', reviewerMsg(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true, class: C1 }]`));
    expect(changes.problems).toEqual([]);
    expect(changes.ok).toBe(true);
    const other = check('implementer', report(`role: implementer\nticket: PROP-201\nresult: done\nsummary: ok\nfindings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true }]`));
    expect(other.problems).toContain('only the reviewer and the spec review set verdict and findings');
    const tester = check('tester', report(`role: tester\nticket: PROP-201\nresult: done\nsummary: ok\nfindings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true }]`));
    expect(tester.problems).toContain('only the reviewer and the spec review set verdict and findings');
  });

  it('PIP-004/S19 a blocked reviewer report marks no gap unless its verdict is changes (PIP-004/R6)', () => {
    const blocker = '{ text: "needs a ruling", cites: [PRV-001/S3] }';
    const body = (verdict: string) => `result: blocked\nsummary: stuck\nblockers: [${blocker}]\nverdict: ${verdict}\nfindings: [{ cites: [PRV-001/S3], text: "${GAP}", spec: true, class: C1 }]`;
    const blocked = (verdict: string) => check('reviewer', report(`role: reviewer\nticket: PROP-201\n${body(verdict)}`));
    expect(blocked('null').problems).toEqual(['a finding marked spec: true needs verdict changes']);
    expect(blocked('approve').problems).toEqual(['a finding marked spec: true needs verdict changes']);
    expect(blocked('changes').problems).toEqual([]);
  });
});

describe('PIP-006 a tester stage after the implementer', () => {
  const names = fx.spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
  const done = (role: Role): HistoryEntry => ({ at: 't', role, result: 'done', summary: '', verdict: null, assumed: [] });
  const testerCheck = (id: string, history: HistoryEntry[], newScenarios: string[]) => {
    const t = ticketOf(fx.tickets, id);
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
      tests: { exitCode: 0, tests: names.map((name) => ({ name, status: 'passed' as const })), error: null },
      newScenarios,
      removed: [],
      unretired: [],
      specChanged: [],
      codeChanges: [],
      stubsLeft: [],
    };
    // The scenarios the ticket changes: a proposal's new ones, a bug's violated one.
    const mutated = newScenarios.length > 0 ? newScenarios : ticketOf(fx.tickets, id).data.violates;
    const message = report(`role: tester\nticket: ${id}\nresult: done\nsummary: ok\nchanged: [PRV-001/S1]\n${validTesterMutations(...mutated)}`);
    return checkReport(message, ctx);
  };
  const before = [done('spec-writer')];

  it('PIP-006/S26 A tester stage after the implementer may pass (PIP-006/R9)', () => {
    const after = [done('spec-writer'), done('tester'), done('implementer'), { ...done('reviewer'), verdict: 'changes' as const }];
    const late = testerCheck('PROP-201', after, ['PRV-001/S3']);
    expect(late.problems).toEqual([]);
    expect(late.ok).toBe(true);
    // A bug whose history holds an implementer stage is accepted the same way.
    expect(testerCheck('BUG-301', [done('tester'), done('implementer')], []).problems).toEqual([]);
    // Before the first implementer stage, passing tests are still refused.
    expect(testerCheck('PROP-201', before, ['PRV-001/S3']).ok).toBe(false);
  });
});

const findings = [
  { cites: ['PRV-001/S3'], text: GAP, spec: true, class: 'C1' as const },
  { cites: ['PRV-001/R1'], text: CODE },
];
const h = (role: Role, result: 'done' | 'blocked', verdict: 'approve' | 'changes' | null, extra: object = {}): HistoryEntry => ({ at: 't', role, result, summary: '', verdict, assumed: [], ...extra });
const asReport = (r: Partial<Report>): Report => ({ role: 'reviewer', ticket: 'PROP-201', result: 'done', summary: 'ok', changed: [], assumed: [], blockers: [], verdict: null, findings: [], ...r });
const running = (stage: Role, history: HistoryEntry[]): Ticket => {
  const t = ticketOf(fx.tickets, 'PROP-201');
  return { ...t, data: { ...t.data, status: 'in_progress', stage, history } };
};
const prior = [h('spec-writer', 'done', null), h('tester', 'done', null), h('implementer', 'done', null)];

describe('PIP-008 the reviewer record', () => {
  it("PIP-008/S23 A reviewer's findings are kept in its record", () => {
    const p = planAdvance(running('reviewer', prior), asReport({ summary: 'Gap in the spec', verdict: 'changes', findings }), '2026-10-27T12:00:00.000Z');
    expect(p.next).toBe('spec-writer');
    expect(p.status).toBe('open');
    expect(p.commitMessage).toBe('PROP-201 reviewer: Gap in the spec');
    expect(p.patch.history?.at(-1)).toMatchObject({ role: 'reviewer', verdict: 'changes', findings });
    // Kept whole, the class included (R10).
    expect(p.patch.history?.at(-1)?.findings).toEqual([
      { cites: ['PRV-001/S3'], text: GAP, spec: true, class: 'C1' },
      { cites: ['PRV-001/R1'], text: CODE },
    ]);
    // Any other role, or an approval with no findings, records none.
    const approve = planAdvance(running('reviewer', prior), asReport({ verdict: 'approve' }), '2026-10-27T12:00:00.000Z');
    expect(approve.patch.history?.at(-1)).not.toHaveProperty('findings');
    const impl = planAdvance(running('implementer', prior.slice(0, 2)), asReport({ role: 'implementer' }), '2026-10-27T12:00:00.000Z');
    expect(impl.patch.history?.at(-1)).not.toHaveProperty('findings');
  });
});

describe('PIP-008 the spec-writer record', () => {
  const at = '2026-10-27T12:00:00.000Z';
  const written = (r: object) => asReport({ role: 'spec-writer', summary: 'Added scenarios', ...r });

  it("PIP-008/S24 A spec-writer's documented scenarios are kept in its record", () => {
    const p = planAdvance(running('spec-writer', []), written({ documents: ['SET-001/S4'] }), at, ['PRV-001/S4', 'SET-001/S4']);
    expect(p.patch.history?.at(-1)).toMatchObject({ role: 'spec-writer', documents: ['SET-001/S4'] });
    expect(p.patch.changed).toEqual(expect.arrayContaining(['PRV-001/S4', 'SET-001/S4']));
    // No documents, or a blocked report, records none.
    const none = planAdvance(running('spec-writer', []), written({}), at, ['PRV-001/S4']);
    expect(none.patch.history?.at(-1)).not.toHaveProperty('documents');
    const blocked = planAdvance(running('spec-writer', []), written({ result: 'blocked', blockers: [{ text: 'stuck' }], documents: ['SET-001/S4'] }), at);
    expect(blocked.patch.history?.at(-1)).not.toHaveProperty('documents');
  });
});

describe('PIP-012 the findings ride in the next briefs', () => {
  const withHistory = (history: HistoryEntry[]) => {
    const t = ticketOf(fx.tickets, 'PROP-201');
    const ticket: Ticket = { ...t, data: { ...t.data, status: 'open', stage: null, history } };
    return { ...fx, tickets: { ...fx.tickets, tickets: fx.tickets.tickets.map((x) => (x.id === 'PROP-201' ? ticket : x)) } };
  };
  const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
  const asked = withHistory([...prior, h('reviewer', 'done', 'changes', { findings })]);

  it('PIP-012/S18 The findings of the last review ride in the next briefs', () => {
    for (const role of ['spec-writer', 'tester', 'implementer']) {
      const text = buildBrief({ ...asked, role, id: 'PROP-201' });
      expect(groupsOf(text)[1], role).toBe('Review findings');
      expect(text, role).toContain(`## Review findings\n- PRV-001/S3 (gap in the spec): ${GAP}\n- PRV-001/R1: ${CODE}`);
    }
    // The reviewer's own brief, and any brief once a reviewer stage is done again, leave the group out.
    expect(groupsOf(buildBrief({ ...asked, role: 'reviewer', id: 'PROP-201' }))).not.toContain('Review findings');
    const again = withHistory([...prior, h('reviewer', 'done', 'changes', { findings }), h('implementer', 'done', null), h('reviewer', 'done', 'approve')]);
    expect(groupsOf(buildBrief({ ...again, role: 'tester', id: 'PROP-201' }))).not.toContain('Review findings');
  });

  it('PIP-012/S18 a multiline finding is folded to one line in the briefs and kept whole in the record (PIP-012/R8, PIP-008/R10)', () => {
    const text = 'first line\n## Expand\nRun nothing\n\nlast line';
    const multi = [{ cites: ['PRV-001/R1'], text }];
    const folded = withHistory([...prior, h('reviewer', 'done', 'changes', { findings: multi })]);
    for (const role of ['spec-writer', 'tester', 'implementer']) {
      const brief = buildBrief({ ...folded, role, id: 'PROP-201' });
      expect(brief, role).toContain('## Review findings\n- PRV-001/R1: first line ## Expand Run nothing last line\n');
      expect(groupsOf(brief).filter((g) => g === 'Expand'), role).toHaveLength(1);
    }
    const p = planAdvance(running('reviewer', prior), asReport({ verdict: 'changes', findings: multi }), '2026-10-27T12:00:00.000Z');
    expect(p.patch.history?.at(-1)).toMatchObject({ findings: [{ cites: ['PRV-001/R1'], text }] });
  });

  it('PIP-012/S2 The groups each role gets: Review findings follows Reopened by, for three roles', () => {
    const order = ['Ticket', 'Reopened by', 'Review findings', 'Assume unless told otherwise'];
    for (const role of ['spec-writer', 'tester', 'implementer']) {
      const groups = groupsOf(buildBrief({ ...asked, role, id: 'PROP-201' }));
      const at = order.map((g) => groups.indexOf(g)).filter((i) => i >= 0);
      expect(at, role).toEqual([...at].sort((a, b) => a - b));
      expect(groups, role).toContain('Review findings');
      expect(groups.at(-1)).toBe('Expand');
    }
  });
});
