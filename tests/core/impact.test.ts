// Impact on chat-mini. The explicit cases are worked out by hand from the feature table; the
// snapshot covers every contract, field, feature, invariant, ADR, screen and ticket.
import { describe, expect, it } from 'vitest';
import { toJson } from '../../src/core/graph';
import { computeImpact } from '../../src/core/impact';
import { loadFixture, syntheticTicket, ticketOf } from '../helpers';

const { spec, tickets, index } = loadFixture();
const impact = (id: string, depth = 1) => computeImpact(spec, index, id, null, { depth });
const ticketImpact = (id: string) => computeImpact(spec, index, id, ticketOf(tickets, id));
const ring = (items: { id: string; scenarios: string[] }[]) => Object.fromEntries(items.map((i) => [i.id, i.scenarios]));

describe('impact: contracts and fields', () => {
  it('a field reaches its writers, and readers of the whole entity, with only the scenarios that cite it', () => {
    const i = impact('conversation.Message.meta');
    expect(ring(i.mustChange)).toEqual({
      'CNV-002': ['CNV-002/S2'],
      'PRV-002': ['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'],
    });
    // CNV-003/S2, the secrecy check, names each conversation.Message it exports (X108 fixture), so
    // a change to the message shape re-verifies it too.
    expect(i.reverify).toEqual([{ id: 'CNV-003', via: ['reads conversation.Message (whole)'], scenarios: ['CNV-003/S1', 'CNV-003/S2'] }]);
  });

  it('a sibling field is not reached: Message.usage leaves the meta writers alone', () => {
    const i = impact('conversation.Message.usage');
    expect(ring(i.mustChange)).toEqual({ 'PRV-003': ['PRV-003/S1'] });
    expect(ring(i.reverify)).toEqual({ 'CNV-003': ['CNV-003/S1', 'CNV-003/S2'] });
  });

  it('a whole entity reaches the writers of every field', () => {
    expect(Object.keys(ring(impact('conversation.Message').mustChange))).toEqual(['CNV-001', 'CNV-002', 'PRV-001', 'PRV-002', 'PRV-003']);
  });

  it('an entity reached through one field link flags scenarios citing that entity or any field', () => {
    const i = impact('providers.ProviderConfig');
    expect(ring(i.mustChange)).toEqual({ 'SET-001': ['SET-001/S1', 'SET-001/S2', 'SET-001/S3'] });
    expect(ring(i.reverify)).toEqual({
      'CNV-001': ['CNV-001/S1', 'CNV-001/S2'],
      // INV-001 applies to ProviderConfig.enabled: the scenarios that show it must still hold.
      'INV-001': ['CNV-001/S2', 'PRV-002/S4', 'SET-001/S2'],
      'PRV-001': ['PRV-001/S1', 'PRV-001/S2', 'PRV-001/S3'],
      'PRV-002': ['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'],
      'PRV-003': ['PRV-003/S1'],
    });
  });

  it('an event reaches its emitter and its consumers', () => {
    const i = impact('providers.RateLimited');
    expect(ring(i.mustChange)).toEqual({ 'PRV-001': ['PRV-001/S2'] });
    expect(ring(i.reverify)).toEqual({ 'PRV-002': ['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'] });
  });
});

describe('impact: features, scenarios, invariants, decisions, screens', () => {
  it('a feature: its outputs must change, their consumers re-verify', () => {
    const i = impact('PRV-001');
    expect(i.changed).toEqual(['PRV-001']);
    expect(ring(i.mustChange)).toEqual({
      'conversation.Message.content': ['PRV-001/S1', 'PRV-001/S2'],
      'providers.RateLimited': ['PRV-001/S2'],
      'providers.StreamReply': ['PRV-001/S1'],
      'providers.TokenStreamed': ['PRV-001/S1'],
    });
    // CNV-001 calls the operation PRV-001 provides: sending a message starts the stream (X108).
    expect(ring(i.reverify)).toEqual({
      'CNV-001': ['CNV-001/S1'],
      'CNV-002': ['CNV-002/S1'],
      'CNV-003': ['CNV-003/S1', 'CNV-003/S2'],
      'PRV-002': ['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'],
    });
    // A screen that shows what a feature produces is re-verified too: UI-001 shows PRV-002's event.
    expect(impact('PRV-002').reverify.find((r) => r.id === 'UI-001')?.via).toEqual(['UI-001 shows providers.FallbackTriggered']);
  });

  it('a scenario reaches what its feature reaches', () => {
    expect({ ...impact('PRV-002/S3'), target: null }).toEqual({ ...impact('PRV-002'), target: null });
  });

  it('an invariant reaches every feature that holds it, with the scenarios that check it, and no outer ring', () => {
    const i = impact('INV-001');
    expect(ring(i.mustChange)).toEqual({
      'CNV-001': ['CNV-001/S2'],
      'PRV-002': ['PRV-002/S4'],
      'SET-001': ['SET-001/S2'],
    });
    expect(i.mustChange.find((x) => x.id === 'PRV-002')?.via).toEqual(['PRV-002/R1 cites INV-001', 'PRV-002/S4 cites INV-001', 'invariants INV-001']);
    expect(i.reverify).toEqual([]);
  });

  it('a feature that holds an invariant no step cites has every scenario reached (X97)', () => {
    // SET-002 lists INV-002 but no step checks it; CNV-003/S2, the export check, now cites it.
    const i = ring(impact('INV-002').mustChange);
    expect(i['SET-002']).toEqual(['SET-002/S1', 'SET-002/S2']);
    expect(i['CNV-003']).toEqual(['CNV-003/S2']);
  });

  it('a decision reaches features and the contract sections that cite it', () => {
    expect(ring(impact('ADR-002').mustChange)).toEqual({
      'PRV-002': ['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'],
      'providers.ProviderConfig': [],
    });
    expect(ring(impact('ADR-001').mustChange)).toEqual({ 'conversation.Message': [] });
  });

  it('a screen reaches only the scenarios that show it', () => {
    expect(ring(impact('UI-001').mustChange)).toEqual({ 'PRV-002': ['PRV-002/S1'] });
  });
});

describe('impact: tickets', () => {
  it('TASK-102: touched features are changed and leave the rings; no scope gap', () => {
    const i = ticketImpact('TASK-102');
    expect(i.changed).toEqual(['CNV-002', 'PRV-002']);
    expect(ring(i.mustChange)).toEqual({
      'conversation.Message.content': ['CNV-002/S1'],
      'conversation.Message.meta': ['CNV-002/S2', 'PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4'],
      'providers.FallbackTriggered': ['PRV-002/S1'],
    });
    // UI-001 shows the event PRV-002 emits, so it is re-verified with the rework.
    expect(ring(i.reverify)).toEqual({ 'CNV-003': ['CNV-003/S1', 'CNV-003/S2'], 'UI-001': [] });
    expect(i.scopeGaps).toEqual([]);
  });

  it('BUG-301: the owner of the violated scenario is changed', () => {
    expect(ticketImpact('BUG-301').changed).toEqual(['PRV-002']);
  });

  it('a touched contract whose writer is not in scope is a scope gap, with its fix', () => {
    const t = syntheticTicket('id: PROP-900\ntype: proposal\ntitle: Rename a provider\nstatus: open\ntouches: [providers.ProviderConfig.enabled, PRV-001]');
    const i = computeImpact(spec, index, t.id, t);
    expect(i.scopeGaps).toEqual([{ id: 'SET-001', text: 'SET-001 writes providers.ProviderConfig: add it to touches' }]);
  });

  it('a scenario in touches puts its feature in scope', () => {
    const t = syntheticTicket('id: PROP-901\ntype: proposal\ntitle: Tweak enabling\nstatus: open\ntouches: [providers.ProviderConfig, SET-001/S3]');
    const i = computeImpact(spec, index, t.id, t);
    expect(i.scopeGaps).toEqual([]);
    expect(i.changed).toEqual(['SET-001']);
  });

  it('IDs that name no unit are reported, not dropped', () => {
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: Ghost\nstatus: open\ntouches: [PRV-099, providers.Ghost]');
    expect(computeImpact(spec, index, t.id, t).unresolved).toEqual(['PRV-099', 'providers.Ghost']);
  });
});

describe('impact: depth', () => {
  it('depth 1 stops at direct consumers; depth 2 follows their outputs and marks each item', () => {
    expect(impact('providers.RateLimited').reverify.map((r) => r.id)).toEqual(['PRV-002']);
    const deep = impact('providers.RateLimited', 2);
    expect(deep.reverify.map((r) => [r.id, r.depth])).toEqual([
      ['CNV-003', 2],
      ['PRV-002', 1],
      ['UI-001', 2],
    ]);
    expect(deep.reverify[0]?.via).toEqual(['reads conversation.Message (whole) (from PRV-002)']);
  });

  it('a deeper walk never re-adds what is already in a ring', () => {
    const deep = impact('PRV-001', 5);
    const ids = deep.reverify.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const inner = new Set([...deep.mustChange.map((m) => m.id), ...deep.changed]);
    expect(ids.filter((id) => inner.has(id))).toEqual([]);
    // CNV-001 calls PRV-001's providers.StreamReply: reached first, at depth 1.
    expect(deep.reverify.find((r) => r.id === 'CNV-001')?.depth).toBe(1);
  });
});

describe('impact snapshot', () => {
  const targets = [
    ...spec.contracts.flatMap((c) => [c.id, ...c.fields.map((f) => f.id)]),
    ...spec.features.map((f) => f.id),
    ...spec.invariants.map((i) => i.id),
    ...spec.decisions.map((d) => d.id),
    ...spec.screens.map((s) => s.id),
  ];
  it('every fixture target and ticket matches the reviewed snapshot, byte-identical across runs', async () => {
    const all = () => ({
      ...Object.fromEntries(targets.map((t) => [t, impact(t)])),
      ...Object.fromEntries(tickets.tickets.map((t) => [t.id, ticketImpact(t.id)])),
    });
    expect(toJson(all())).toBe(toJson(all()));
    await expect(toJson(all())).toMatchFileSnapshot('./__snapshots__/chat-mini.impact.json');
  });
});
