import { describe, expect, it } from 'vitest';
import { gateTicket } from '../../src/core/gate';
import { toJson } from '../../src/core/graph';
import type { Spec, Ticket } from '../../src/core/model';
import type { UnitIndex } from '../../src/core/units';
import { fixtureFile, fixtureWith, loadFixture, syntheticTicket, ticketOf } from '../helpers';

const { spec, tickets, index } = loadFixture();
const gate = (t: Ticket, s: Spec = spec, i: UnitIndex = index) => gateTicket(s, i, t.id, t, tickets.findings.filter((f) => f.file === t.file));
const fixtureGate = (id: string) => gate(ticketOf(tickets, id));

describe('gate on the fixture tickets', () => {
  it('TKT-007/S1 A ready ticket', () => {
    const refused = tickets.tickets.filter((t) => !gate(t).ready).map((t) => t.id);
    expect(refused).toEqual(['BUG-302', 'PROP-206']);
    expect(fixtureGate('TASK-101').ready).toBe(true);
  });

  it('TKT-007/S2 An open blocker question on the ticket', () => {
    expect(fixtureGate('PROP-206').blockers).toEqual([{ kind: 'question', id: 'PROP-206#Q1', text: 'Do renamed providers keep their usage history?' }]);
  });

  it('TKT-001/S2 A bug that names no scenario', () => {
    const b = fixtureGate('BUG-302').blockers;
    expect(b.map((x) => x.kind)).toEqual(['schema']);
    expect(b[0]?.text).toMatch(/must name the scenario.*turn the ticket into a proposal/);
  });

  it('TKT-007/S6 A preference proceeds on its default', () => {
    const g = fixtureGate('PROP-202');
    expect(g.ready).toBe(true);
    expect(g.preferences).toEqual([{ id: 'PROP-202#Q1', default: 'alphabetical', text: 'In what order does the model picker list enabled providers?' }]);
  });

  it('matches the reviewed snapshot for every fixture ticket', async () => {
    const all = Object.fromEntries(tickets.tickets.map((t) => [t.id, gate(t)]));
    await expect(toJson(all)).toMatchFileSnapshot('./__snapshots__/chat-mini.gate.json');
  });
});

const PRV002 = 'modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
const withQuestions = (yaml: string) => fixtureWith({ [PRV002]: fixtureFile(PRV002).replace('ui: [UI-001]', `ui: [UI-001]\n${yaml}`) });

describe('gate conditions, one at a time', () => {
  it('TKT-001/S14 A preference without a default', () => {
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]\nquestions:\n  - { id: Q1, kind: preference, text: Which name?, default: null }');
    expect(gate(t).blockers.map((b) => [b.kind, b.id])).toEqual([['schema', 'TASK-900#Q1']]);
  });

  it('2. every ID in touches and violates resolves, with a suggestion', () => {
    const t = syntheticTicket('id: TASK-901\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-009]');
    expect(gate(t).blockers).toEqual([{ kind: 'unresolved', id: 'PRV-009', text: 'PRV-009 does not exist; did you mean PRV-001?' }]);
  });

  it('2. ... and is not removed (a deprecated unit is still served, so work on it may start)', () => {
    const ui = 'ui/UI-001-fallback-notice.md';
    const t = syntheticTicket('id: TASK-902\ntype: task\ntitle: x\nstatus: open\ntouches: [UI-001]');
    const removed = fixtureWith({ [ui]: fixtureFile(ui).replace('status: active', 'status: removed\nsuperseded_by: UI-002') });
    expect(gate(t, removed.spec, removed.index).blockers).toEqual([{ kind: 'removed', id: 'UI-001', text: 'UI-001 is removed; use UI-002' }]);
    const deprecated = fixtureWith({ [ui]: fixtureFile(ui).replace('status: active', 'status: deprecated') });
    expect(gate(t, deprecated.spec, deprecated.index).blockers).toEqual([]);
  });

  it('TKT-007/S3 An open blocker on a unit in scope', () => {
    const s = withQuestions(
      'questions:\n  - { id: Q1, kind: blocker, text: Does a fallback count toward usage?, cites: [conversation.Message.usage] }\n  - { id: Q2, kind: preference, text: Notice wording?, default: as in UI-001 }',
    );
    const g = gate(ticketOf(tickets, 'TASK-103'), s.spec, s.index);
    expect(g.blockers).toEqual([{ kind: 'question', id: 'PRV-002#Q1', text: 'Does a fallback count toward usage?' }]);
    expect(g.preferences.map((p) => p.id)).toEqual(['PRV-002#Q2']);
  });

  it('TKT-007/S4 A violated scenario puts its feature\'s questions in scope', () => {
    const s = withQuestions('questions:\n  - { id: Q1, kind: blocker, text: Is a third provider ever allowed? }');
    expect(gate(ticketOf(tickets, 'BUG-301'), s.spec, s.index).blockers.map((b) => b.id)).toEqual(['PRV-002#Q1']);
  });

  it('TKT-007/S5 An answered blocker no longer blocks', () => {
    const s = withQuestions('questions:\n  - { id: Q1, kind: blocker, text: Is a third provider ever allowed?, answer: "no" }');
    expect(gate(ticketOf(tickets, 'BUG-301'), s.spec, s.index).ready).toBe(true);
  });

  it('4. a scope gap blocks, with its fix', () => {
    const t = syntheticTicket('id: PROP-903\ntype: proposal\ntitle: x\nstatus: open\ntouches: [settings.ApiKey]');
    expect(gate(t).blockers).toEqual([{ kind: 'scope_gap', id: 'SET-002', text: 'SET-002 writes settings.ApiKey: add it to touches' }]);
  });

  it('a ticket file that does not parse is refused on its schema errors', () => {
    const findings = [{ rule: 'L020' as const, severity: 'error' as const, file: 'tickets/TASK-904.md', line: 3, id: 'TASK-904', message: 'type: Invalid option', fix: 'use one of: proposal, bug, task' }];
    expect(gateTicket(spec, index, 'TASK-904', null, findings)).toEqual({
      ticket: 'TASK-904',
      ready: false,
      blockers: [{ kind: 'schema', id: 'TASK-904', text: 'type: Invalid option: use one of: proposal, bug, task' }],
      preferences: [],
    });
  });

  it('TKT-007/S14 Questions outside the scope do not block', () => {
    const s = withQuestions('questions:\n  - { id: Q1, kind: blocker, text: Is a third provider ever allowed? }');
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]');
    expect(gate(t, s.spec, s.index).blockers.filter((blocker) => blocker.kind === 'question')).toEqual([]);
  });

  it('TKT-007/S15 A preference without a default is not listed', () => {
    const s = withQuestions('questions:\n  - { id: Q1, kind: preference, text: Notice wording?, default: null }');
    const g = gate(ticketOf(tickets, 'TASK-103'), s.spec, s.index);
    expect(g.preferences.some((preference) => preference.id === 'PRV-002#Q1')).toBe(false);
  });
});
