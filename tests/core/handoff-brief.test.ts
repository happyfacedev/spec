// PIP-012/R14, S27: a hand-off's blockers ride in the tester's brief. Run on chat-mini's PROP-201
// with histories built in memory.
import { describe, expect, it } from 'vitest';
import { buildBrief } from '../../src/core/brief';
import type { Ticket } from '../../src/core/model';
import type { HistoryEntry } from '../../src/core/schemas';
import { loadFixture, SPEC_REVIEW, ticketOf } from '../helpers';

const fx = loadFixture();
const brief = (role: string, history: HistoryEntry[]) => {
  const t = ticketOf(fx.tickets, 'PROP-201');
  const ticket: Ticket = { ...t, data: { ...t.data, status: 'open', stage: null, history } };
  return buildBrief({ ...fx, tickets: { ...fx.tickets, tickets: fx.tickets.tickets.map((x) => (x.id === 'PROP-201' ? ticket : x)) }, role, id: 'PROP-201' });
};
const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const group = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';

const h = (role: HistoryEntry['role'], result: HistoryEntry['result'] = 'done', verdict: 'approve' | 'changes' | null = null, extra: object = {}): HistoryEntry => ({ at: 't', role, result, summary: '', verdict, assumed: [], ...extra });
const GROUP = "Implementer's test blockers";
const TEXT = 'The test for PRV-001/S4 expects status 200; the scenario says 201';
const blockers = [{ text: TEXT, cites: ['PRV-001/S4'], tests: true }];
const prior = [h('spec-writer'), h(SPEC_REVIEW, 'done', 'approve'), h('tester')];
const handoff = [...prior, h('implementer', 'blocked', null, { blockers })];

describe("PIP-012 a hand-off's blockers ride in the tester's brief", () => {
  it("PIP-012/S27 A hand-off's blockers ride in the tester's brief", () => {
    const text = brief('tester', handoff);
    // The group follows "## Ticket" and holds the blocker, "- <cites>: <text>".
    expect(groupsOf(text).slice(0, 2)).toEqual(['Ticket', GROUP]);
    expect(group(text, GROUP).trim()).toBe(`- PRV-001/S4: ${TEXT}`);
    expect(text).toContain(`## ${GROUP}\n- PRV-001/S4: ${TEXT}\n`);
  });

  it('PIP-012/S27 several cites are joined by ", "; a blocker that cites nothing gives its text alone', () => {
    const many = [
      { text: 'first test is wrong', cites: ['PRV-001/S3', 'PRV-001/S4'], tests: true },
      { text: 'second test is wrong', cites: [], tests: true },
      { text: 'third test is wrong', tests: true },
    ];
    const text = brief('tester', [...prior, h('implementer', 'blocked', null, { blockers: many })]);
    expect(group(text, GROUP).trim().split('\n')).toEqual(['- PRV-001/S3, PRV-001/S4: first test is wrong', '- second test is wrong', '- third test is wrong']);
  });

  it("PIP-012/S27 once that tester's stage is done, the group is left out", () => {
    const text = brief('tester', [...handoff, h('tester')]);
    expect(groupsOf(text)).not.toContain(GROUP);
    // A tester stage that is only blocked does not take it away.
    expect(groupsOf(brief('tester', [...handoff, h('tester', 'blocked')]))).toContain(GROUP);
    // Nor does it show once the implementer's code was fixed afterwards and the hand-off is no longer the last implementer stage.
    expect(groupsOf(brief('tester', [...handoff, h('tester'), h('implementer')]))).not.toContain(GROUP);
  });

  it("PIP-012/S27 no other role's brief holds the group", () => {
    for (const role of ['spec-writer', SPEC_REVIEW, 'implementer', 'reviewer']) {
      expect(groupsOf(brief(role, handoff)), role).not.toContain(GROUP);
    }
  });

  it('PIP-012/S27 a blocked implementer record without blockers, or an ordinary done one, gives the tester no group', () => {
    expect(groupsOf(brief('tester', [...prior, h('implementer', 'blocked')]))).not.toContain(GROUP);
    expect(groupsOf(brief('tester', [...prior, h('implementer')]))).not.toContain(GROUP);
  });

  it('PIP-012/S2 The groups each role gets: the tester\'s blockers precede Review findings', () => {
    const findings = [{ cites: ['PRV-001/S3'], text: 'no test covers the second rate limit', tests: true }];
    const asked = [...prior, h('implementer'), h('reviewer', 'done', 'changes', { findings }), h('implementer', 'blocked', null, { blockers })];
    const groups = groupsOf(brief('tester', asked));
    expect(groups.slice(0, 3)).toEqual(['Ticket', GROUP, 'Review findings']);
    expect(groups.at(-1)).toBe('Expand');
  });
});
