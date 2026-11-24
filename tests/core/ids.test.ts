import { describe, expect, it } from 'vitest';
import { classifyId, closestId, compareIds, idsInText, refsMatch, sortIds } from '../../src/core/ids';

describe('classifyId', () => {
  it.each([
    ['PRV-007', 'feature'],
    ['PRV-0007', 'feature'],
    ['PRV-007/S1', 'scenario'],
    ['PRV-007/R2', 'rule'],
    ['providers.RateLimited', 'contract'],
    ['conversation.Message.meta', 'field'],
    ['INV-005', 'invariant'],
    ['ADR-019', 'decision'],
    ['UI-031', 'screen'],
    ['PROP-42', 'ticket'],
    ['BUG-301', 'ticket'],
    ['TASK-7', 'ticket'],
    ['Q2', 'question'],
    ['PROP-042#Q2', 'question'],
    ['providers', 'module'],
  ])('classifyId: case %# is a %s', (id, kind) => {
    expect(classifyId(id)).toBe(kind);
  });

  it.each(['PROP-001/S1', 'INV-001/S1', 'prv-007', 'Providers.rateLimited', 'P-001', 'PRV-07', "x'; touch /tmp/pwned; '"])('classifyId: case %# is not a unit ID', (id) => {
    expect(['feature', 'scenario', 'rule', 'contract', 'field']).not.toContain(classifyId(id));
  });

  it('reserved prefixes never classify as features', () => {
    for (const p of ['INV', 'ADR', 'PROP', 'BUG', 'TASK']) expect(classifyId(`${p}-1000`)).not.toBe('feature');
  });
});

describe('natural ID order', () => {
  it('sorts numbers by value', () => {
    expect(sortIds(['PRV-10', 'PRV-2', 'PRV-1'])).toEqual(['PRV-1', 'PRV-2', 'PRV-10']);
    expect(sortIds(['PRV-001/S10', 'PRV-001/S2', 'PRV-001'])).toEqual(['PRV-001', 'PRV-001/S2', 'PRV-001/S10']);
  });
  it('is a total order (distinct strings never compare equal)', () => {
    expect(compareIds('PRV-01', 'PRV-1')).not.toBe(0);
    expect(Math.sign(compareIds('a', 'b'))).toBe(-Math.sign(compareIds('b', 'a')));
  });
});

describe('refsMatch', () => {
  it('a field matches itself and its entity, not its sibling', () => {
    expect(refsMatch('conversation.Message.meta', 'conversation.Message')).toBe(true);
    expect(refsMatch('conversation.Message', 'conversation.Message.meta')).toBe(true);
    expect(refsMatch('conversation.Message.meta', 'conversation.Message.meta')).toBe(true);
    expect(refsMatch('conversation.Message.meta', 'conversation.Message.content')).toBe(false);
    expect(refsMatch('conversation.Message', 'conversation.MessageList')).toBe(false);
  });
});

describe('idsInText', () => {
  it('finds IDs in prose, in order, without trailing punctuation', () => {
    expect(idsInText('When "A" emits providers.RateLimited. Then conversation.Message.meta and UI-031 (INV-002)')).toEqual([
      'providers.RateLimited',
      'conversation.Message.meta',
      'UI-031',
      'INV-002',
    ]);
  });
  it('does not split longer IDs', () => {
    expect(idsInText('ADR-0011 and ADR-001x')).toEqual(['ADR-0011']);
  });
});

describe('closestId', () => {
  it('suggests near typos only', () => {
    expect(closestId('PRV-02', ['PRV-001', 'PRV-002', 'CNV-002'])).toBe('PRV-002');
    expect(closestId("x'; rm -rf /", ['PRV-001', 'ADR-001'])).toBeNull();
  });
});
