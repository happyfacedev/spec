// PIP-012/R8, R11 and R12: the spec review's brief and the groups its findings ride in. Run on
// chat-mini's PROP-201 with histories built in memory; the spec delta comes from git, in
// tests/cli/brief-spec-review.test.ts.
import { describe, expect, it } from 'vitest';
import { buildBrief } from '../../src/core/brief';
import type { Ticket } from '../../src/core/model';
import type { HistoryEntry } from '../../src/core/schemas';
import { loadFixture, SPEC_REVIEW, ticketOf } from '../helpers';

const fx = loadFixture();
const withHistory = (history: HistoryEntry[]) => {
  const t = ticketOf(fx.tickets, 'PROP-201');
  const ticket: Ticket = { ...t, data: { ...t.data, status: 'open', stage: null, history } };
  return { ...fx, tickets: { ...fx.tickets, tickets: fx.tickets.tickets.map((x) => (x.id === 'PROP-201' ? ticket : x)) } };
};
const brief = (role: string, history: HistoryEntry[]) => buildBrief({ ...withHistory(history), role, id: 'PROP-201' });
const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const group = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';

const h = (role: HistoryEntry['role'], verdict: 'approve' | 'changes' | null = null, extra: object = {}): HistoryEntry => ({ at: 't', role, result: 'done', summary: '', verdict, assumed: [], ...extra });
const SPEC_FINDINGS = [{ cites: ['PRV-001/S4', 'PRV-002'], text: 'no scenario covers PRV-002 when the key is missing' }];
const LINE = '- PRV-001/S4, PRV-002: no scenario covers PRV-002 when the key is missing';

describe('PIP-012 the spec review findings ride in the briefs', () => {
  const asked = [h('spec-writer'), h(SPEC_REVIEW, 'changes', { findings: SPEC_FINDINGS })];

  it("PIP-012/S23 The spec review's findings ride to the spec-writer and back to the spec review", () => {
    const writer = brief('spec-writer', asked);
    expect(groupsOf(writer)[1]).toBe('Spec review findings');
    expect(writer).toContain(`## Spec review findings\n${LINE}\n`);
    // Once that spec-writer stage is done, the spec review's brief holds the same group.
    const back = [...asked, h('spec-writer')];
    const review = brief(SPEC_REVIEW, back);
    expect(groupsOf(review)[1]).toBe('Spec review findings');
    expect(review).toContain(`## Spec review findings\n${LINE}\n`);
    // The group sits after "Review findings" and before the groups that follow the assumptions
    // (PROP-201 has no open preference, so "Assume unless told otherwise" is absent).
    const order = groupsOf(brief(SPEC_REVIEW, [h('spec-writer'), h('tester'), h('implementer'), h('reviewer', 'changes', { findings: [{ cites: ['PRV-001/S3'], text: 'gap', spec: true }] }), h('spec-writer'), h(SPEC_REVIEW, 'changes', { findings: SPEC_FINDINGS }), h('spec-writer')]));
    expect(order.indexOf('Review findings')).toBeLessThan(order.indexOf('Spec review findings'));
    expect(order.indexOf('Spec review findings')).toBeGreaterThan(0);
    expect(order.indexOf('Spec review findings')).toBeLessThan(order.indexOf('Features in scope'));
  });

  it('PIP-012/S23 Only the spec-writer and the spec review list them, and only until a spec review runs again', () => {
    const back = [...asked, h('spec-writer')];
    for (const role of ['tester', 'implementer', 'reviewer']) {
      expect(groupsOf(brief(role, back)), role).not.toContain('Spec review findings');
    }
    // Once a spec-review stage is done again, no brief holds the group.
    const again = [...back, h(SPEC_REVIEW, 'approve')];
    for (const role of ['spec-writer', SPEC_REVIEW, 'tester', 'implementer', 'reviewer']) {
      expect(groupsOf(brief(role, again)), role).not.toContain('Spec review findings');
    }
    // A fresh "changes" lists only its own findings.
    const second = [...again, h('spec-writer'), h(SPEC_REVIEW, 'changes', { findings: [{ cites: ['PRV-002/S1'], text: 'second round finding' }] })];
    const text = group(brief('spec-writer', second), 'Spec review findings');
    expect(text.trim()).toBe('- PRV-002/S1: second round finding');
  });

  it("PIP-012/S23 A reviewer's findings that sent the proposal to the spec-writer show in the spec review's brief (R8)", () => {
    const gap = { cites: ['PRV-001/S3'], text: 'no scenario covers a second rate limit', spec: true };
    const code = { cites: ['PRV-001/R1'], text: 'select.ts ignores the rule' };
    const sent = [h('spec-writer'), h(SPEC_REVIEW, 'approve'), h('tester'), h('implementer'), h('reviewer', 'changes', { findings: [gap, code] }), h('spec-writer')];
    for (const role of ['spec-writer', SPEC_REVIEW]) {
      const text = brief(role, sent);
      expect(text, role).toContain('## Review findings\n- PRV-001/S3 (gap in the spec): no scenario covers a second rate limit\n- PRV-001/R1: select.ts ignores the rule');
      expect(groupsOf(text)[1], role).toBe('Review findings');
    }
    // Once a reviewer stage is done again the group is gone, as for every other role.
    const later = [...sent, h(SPEC_REVIEW, 'approve'), h('tester'), h('implementer'), h('reviewer', 'approve')];
    expect(groupsOf(brief(SPEC_REVIEW, later))).not.toContain('Review findings');
  });
});

describe("PIP-012 the spec-writer's checklist in the spec review's brief", () => {
  const written = (checklist: object[] | undefined) => h('spec-writer', null, checklist === undefined ? {} : { checklist });

  it("PIP-012/S22 The spec review gets the spec-writer's checklist, one line per item in item order", () => {
    // Given out of order on purpose: the brief lists the items C1, C2, C4, C6, C8.
    const checklist = [
      { item: 'C8', outcome: 'question', ids: ['PROP-201#Q1'] },
      { item: 'C2', outcome: 'na', ids: [], reason: 'no path is read' },
      { item: 'C6', outcome: 'scenarios', ids: ['PRV-001/S1', 'PRV-001/S2'] },
      { item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] },
      { item: 'C4', outcome: 'invariant', ids: ['INV-002'] },
    ];
    const text = group(brief(SPEC_REVIEW, [written(checklist)]), "Spec-writer's checklist");
    expect(text.trim().split('\n')).toEqual([
      '- C1 neighbours: scenarios PRV-001/S4',
      '- C2 environment axes: na: no path is read',
      '- C4 trust boundaries: invariant INV-002',
      '- C6 preserved behaviour: scenarios PRV-001/S1, PRV-001/S2',
      '- C8 external facts: question PROP-201#Q1',
    ]);
  });

  it('PIP-012/S22 Only the latest done spec-writer stage counts', () => {
    const first = [{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S1'] }];
    const latest = [{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] }];
    const history = [written(first), h(SPEC_REVIEW, 'changes', { findings: SPEC_FINDINGS }), written(latest)];
    const text = group(brief(SPEC_REVIEW, history), "Spec-writer's checklist");
    expect(text.trim()).toBe('- C1 neighbours: scenarios PRV-001/S4');
  });

  it('PIP-012/S22 A spec-writer stage recorded with no checklist gives the one line', () => {
    const text = group(brief(SPEC_REVIEW, [written(undefined)]), "Spec-writer's checklist");
    expect(text.trim()).toBe('The spec-writer reported no checklist; treat every item as open.');
  });

  it("PIP-012/S22 No other role's brief holds the checklist group", () => {
    const history = [written([{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] }])];
    for (const role of ['spec-writer', 'tester', 'implementer', 'reviewer']) {
      expect(groupsOf(brief(role, history)), role).not.toContain("Spec-writer's checklist");
      expect(groupsOf(brief(role, history)), role).not.toContain('Spec delta');
    }
  });
});
