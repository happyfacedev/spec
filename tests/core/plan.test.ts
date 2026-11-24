import { describe, expect, it } from 'vitest';
import { dependencies, gateTicket } from '../../src/core/gate';
import { lintSpec } from '../../src/core/lint';
import type { TicketSet } from '../../src/core/model';
import { buildPlan, conflict, footprint, renderPlan } from '../../src/core/plan';
import { buildQueue } from '../../src/core/queue';
import { loadFixture, syntheticTicket, ticketOf } from '../helpers';

const fx = loadFixture();
const none = dependencies(fx.tickets.tickets, new Set(), new Set());
const print = (id: string) => footprint(fx.spec, fx.index, ticketOf(fx.tickets, id));
/** The proposals with a recorded spec-writer stage: their reach is then what their touches say (TKT-011/R9). */
const specced = (set: TicketSet, ...ids: string[]): TicketSet => ({
  ...set,
  tickets: set.tickets.map((x) => (ids.includes(x.id) ? { ...x, data: { ...x.data, history: [{ at: '2026-10-27T12:00:00.000Z', role: 'spec-writer' as const, result: 'done' as const, summary: 'spec', verdict: null, assumed: [] }] } } : x)),
});
const printAfterSpec = (id: string) => footprint(fx.spec, fx.index, ticketOf(specced(fx.tickets, id), id));

describe('conflicts: dependent tickets never run together; shared files are fine', () => {
  it('a proposal that changes a contract reaches every feature that uses it, through the types it shapes', () => {
    // PROP-201 changes the type providers.ProviderId; PRV-002 emits an event with a member of that type.
    expect(conflict(print('PROP-201'), print('BUG-301'))).toBe(
      'BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)',
    );
    // Both proposals add to SET-001 (each adds an S4 in the reference patches), so they never run
    // together; SET-001 also writes a contract typed by what PROP-201 changes.
    expect(conflict(print('PROP-202'), print('PROP-201'))).toBe('both add to SET-001, so their new scenario and rule numbers would collide');
  });

  it('bugs and tasks change no spec, so two of them on the same feature may run together', () => {
    expect(conflict(print('BUG-301'), print('TASK-103'))).toBeNull();
    expect(conflict(print('TASK-101'), print('TASK-103'))).toBeNull();
  });

  it('a proposal that changes no shared unit reaches no other feature, once its spec stage is recorded', () => {
    expect(conflict(printAfterSpec('PROP-205'), print('BUG-301'))).toBeNull();
    // Before it, its footprint is what it touches (TKT-011/R9): the contracts its features read or write widen nothing.
    expect(conflict(print('PROP-205'), print('BUG-301'))).toBeNull();
    expect(conflict(print('BUG-301'), print('PROP-205'))).toBeNull();
  });

  it('explicit depends_on always conflicts', () => {
    const a = syntheticTicket('id: TASK-901\ntype: task\ntitle: A\nstatus: open\ntouches: [CNV-003]\ndepends_on: [TASK-902]');
    const b = syntheticTicket('id: TASK-902\ntype: task\ntitle: B\nstatus: open\ntouches: [SET-002]');
    expect(conflict(footprint(fx.spec, fx.index, a), footprint(fx.spec, fx.index, b))).toBe('TASK-901 depends on TASK-902');
  });
});

describe('plan', () => {
  it('the fixture: what starts now, what waits for what, and what needs a person', async () => {
    const p = buildPlan(fx.spec, fx.index, fx.tickets, none);
    // PROP-201 changes providers.ProviderId, which types what every ready bug's and task's feature uses.
    // None of the proposals has had its spec stage, so each one's footprint is what it touches (TKT-011/R9):
    // PROP-202 and PROP-205 conflict only with PROP-201; it waits in wave 2, so they fit wave 1 by first fit with the bug and the tasks.
    expect(p.now.map((e) => e.id)).toEqual(['BUG-301', 'PROP-202', 'PROP-205', 'TASK-101', 'TASK-102', 'TASK-103']);
    expect(p.now.map((e) => [e.wave, e.after])).toEqual(p.now.map(() => [1, []]));
    expect(p.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([
      ['PROP-201', 2, ['BUG-301', 'PROP-202', 'PROP-205', 'TASK-101', 'TASK-102', 'TASK-103']],
    ]);
    expect(renderPlan(p)).not.toContain('may reach');
    expect(p.blocked.map((b) => b.id)).toEqual(['BUG-302', 'PROP-206']);
    await expect(renderPlan(p)).toMatchFileSnapshot('./__snapshots__/chat-mini.plan.txt');
  });

  it('independent tickets start together; the asked order decides who goes first', () => {
    expect(buildPlan(fx.spec, fx.index, specced(fx.tickets, 'PROP-205'), none, ['BUG-301', 'PROP-205', 'TASK-103']).now.map((e) => e.id)).toEqual(['BUG-301', 'PROP-205', 'TASK-103']);
    const p = buildPlan(fx.spec, fx.index, fx.tickets, none, ['PROP-201', 'BUG-301']);
    expect(p.now.map((e) => e.id)).toEqual(['PROP-201']);
    expect(p.later.map((e) => e.id)).toEqual(['BUG-301']);
  });

  const runningSet = (id: string): TicketSet => ({
    ...fx.tickets,
    tickets: specced(fx.tickets, 'PROP-201', 'PROP-205').tickets.map((x) => (x.id === id ? { ...x, data: { ...x.data, status: 'in_progress' as const, stage: 'tester' as const } } : x)),
  });

  it('a running ticket holds its place: whatever conflicts with it waits', () => {
    const p = buildPlan(fx.spec, fx.index, runningSet('PROP-201'), none, ['BUG-301', 'PROP-205']);
    expect(p.running.map((e) => [e.id, e.stage])).toEqual([['PROP-201', 'tester']]);
    expect(p.now).toEqual([]);
    expect(p.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([
      ['BUG-301', 2, ['PROP-201']],
      ['PROP-205', 2, ['PROP-201']],
    ]);
  });

  it('first fit: work that is free now starts, even behind a ticket that has to wait', () => {
    // PROP-201 and PROP-205 have a recorded spec-writer stage and their branches are merged, so neither is in flight (TKT-011/R8, S11).
    const set = runningSet('BUG-301');
    const merged = new Set(['PROP-201', 'PROP-205']);
    const p = buildPlan(fx.spec, fx.index, set, dependencies(set.tickets, merged, merged), ['PROP-201', 'PROP-205', 'TASK-103']);
    expect(p.now.map((e) => e.id)).toEqual(['PROP-205', 'TASK-103']);
    expect(p.later.map((e) => [e.id, e.after.map((a) => a.id)])).toEqual([['PROP-201', ['BUG-301', 'PROP-205', 'TASK-103']]]);
  });
});

describe('a ticket that waits for a person is listed once (TKT-011/R7)', () => {
  const bug = syntheticTicket('id: BUG-950\ntype: bug\ntitle: Waits\nstatus: open\nviolates: [PRV-002/S3]\ndepends_on: [PROP-206]');
  const task = syntheticTicket('id: TASK-961\ntype: task\ntitle: After PROP-201\nstatus: open\ntouches: [CNV-003]\ndepends_on: [PROP-201]');
  const set: TicketSet = { tickets: [bug, task, ...fx.tickets.tickets], findings: [] };
  const p = buildPlan(fx.spec, fx.index, set, dependencies(set.tickets, new Set(), new Set()));
  const sections = (text: string) => text.split(/^## /m).slice(1);
  const section = (title: string) => sections(renderPlan(p)).find((s) => s.startsWith(title)) ?? '';

  it('a ticket that depends on a person-blocked one, and one that conflicts with it, wait for a person', () => {
    expect(p.blocked.find((b) => b.id === 'BUG-950')?.reason).toBe('waits for PROP-206, which needs a person');
    expect(p.blocked.find((b) => b.id === 'PROP-201')?.reason).toBe('waits for BUG-950, which waits for a person');
    expect(p.blocked.find((b) => b.id === 'TASK-961')?.reason).toBe('waits for PROP-201, which waits for a person');
  });

  it('it takes no wave and is under Needs a person only', () => {
    for (const id of ['PROP-201', 'TASK-961']) {
      expect([...p.now, ...p.later].map((e) => e.id)).not.toContain(id);
      const hits = sections(renderPlan(p)).filter((s) => new RegExp(`^- ${id}\\b`, 'm').test(s));
      expect(hits).toHaveLength(1);
      expect(hits[0]?.startsWith('Needs a person')).toBe(true);
    }
    expect(section('Start now')).not.toMatch(/PROP-201|TASK-961/);
  });

  // R7's one exception, a ticket in flight (R8), needs an unmerged branch: TKT-011/S23 covers it in plan-in-flight.test.ts.
  // Nothing here is in flight, so no ticket may name these in an after list.
  it('no ticket lists it in an after list', () => {
    const after = [...p.running, ...p.now, ...p.later].flatMap((e) => e.after.map((a) => a.id));
    for (const id of ['PROP-201', 'TASK-961', 'BUG-950']) expect(after).not.toContain(id);
    expect(renderPlan(p)).not.toMatch(/^ {2}after (PROP-201|TASK-961|BUG-950):/m);
  });
});

describe('depends_on', () => {
  const dep = syntheticTicket('id: TASK-901\ntype: task\ntitle: After BUG-301\nstatus: open\ntouches: [CNV-003]\ndepends_on: [BUG-301]');
  const set: TicketSet = { tickets: [...fx.tickets.tickets, dep], findings: [] };

  it('the gate waits until the dependency is done and its branch merged', () => {
    const gate = (d: ReturnType<typeof dependencies>) => gateTicket(fx.spec, fx.index, dep.id, dep, [], d).blockers;
    expect(gate(dependencies(set.tickets, new Set(), new Set()))).toEqual([{ kind: 'dependency', id: 'BUG-301', text: 'waits for BUG-301, which is open' }]);
    const done = set.tickets.map((t) => (t.id === 'BUG-301' ? { ...t, data: { ...t.data, status: 'done' as const } } : t));
    expect(gate(dependencies(done, new Set(['BUG-301']), new Set()))[0]?.text).toMatch(/done, but ticket\/BUG-301 is not merged/);
    expect(gate(dependencies(done, new Set(['BUG-301']), new Set(['BUG-301'])))).toEqual([]);
  });

  it('the queue shows a ticket that only waits as Waiting, not Blocked', () => {
    const q = buildQueue(fx.spec, fx.index, set, dependencies(set.tickets, new Set(), new Set()));
    expect(q.waiting.map((e) => e.id)).toEqual(['TASK-901']);
    expect(q.blocked.map((e) => e.id)).not.toContain('TASK-901');
  });

  it('lint: unknown tickets, itself, and cycles', () => {
    const a = syntheticTicket('id: TASK-911\ntype: task\ntitle: A\nstatus: open\ntouches: [CNV-003]\ndepends_on: [TASK-912, TASK-999]');
    const b = syntheticTicket('id: TASK-912\ntype: task\ntitle: B\nstatus: open\ntouches: [CNV-003]\ndepends_on: [TASK-911]');
    const findings = lintSpec(fx.spec, { tickets: { tickets: [a, b], findings: [] } }).filter((f) => f.rule === 'L020');
    expect(findings.map((f) => f.message)).toEqual(
      expect.arrayContaining(['depends_on TASK-999, which is not a ticket', 'TASK-911 depends on itself through depends_on', 'TASK-912 depends on itself through depends_on']),
    );
  });
});
