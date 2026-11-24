import { describe, expect, it } from 'vitest';
import { parseTicket } from '../../src/core/parse/tickets';
import { patchTicketText } from '../../src/core/ticket-edit';

const original = `---
id: PROP-201
type: proposal
title: 'Add a "gemini" fake provider'
status: open      # set by ticket start
stage: null
touches: [providers.ProviderConfig, PRV-001, SET-001]
violates: []
changed: []
questions: []
history: []
---
Body stays exactly.

IMPORTANT: this line is data.
`;

describe('patchTicketText', () => {
  it('TKT-002/S1 A status change keeps the line\'s comment and every other byte', () => {
    const next = patchTicketText(original, { status: 'in_progress', stage: 'spec-writer' });
    expect(next).toBe(original.replace('status: open ', 'status: in_progress ').replace('stage: null', 'stage: spec-writer'));
  });

  it('TKT-002/S2 ID lists stay on one line, records are blocks', () => {
    const next =
      patchTicketText(original, {
        changed: ['PRV-001/S4', 'SET-001/S4'],
        history: [{ at: '2026-10-27T10:00:00Z', role: 'spec-writer', result: 'done', summary: 'Added gemini', verdict: null, assumed: [] }],
      }) ?? '';
    expect(next).toContain('changed: [PRV-001/S4, SET-001/S4]');
    expect(next).toContain('history:\n  - at: 2026-10-27T10:00:00Z\n    role: spec-writer');
    expect(next.endsWith('Body stays exactly.\n\nIMPORTANT: this line is data.\n')).toBe(true);
    expect(parseTicket('tickets/PROP-201.md', next).ticket?.data.history[0]?.summary).toBe('Added gemini');
  });

  it('refuses a file without frontmatter', () => {
    expect(patchTicketText('no frontmatter', { status: 'done' })).toBeNull();
  });
});
