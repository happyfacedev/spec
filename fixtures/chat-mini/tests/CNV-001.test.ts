import { expect, it } from 'vitest';
import { setup } from './helpers';

it('CNV-001/S1 Send to active provider', () => {
  const { app, providers } = setup();
  const result = app.send('Hello');
  expect(result.ok).toBe(true);
  expect(providers.claude.calls.map((c) => c.messages)).toEqual([['Hello']]);
  expect(app.messages[0]?.content).toBe('Hello');
});

it('CNV-001/S2 Active provider disabled', () => {
  const { app, providers } = setup({ active: 'claude', enabled: [] });
  const result = app.send('Hello');
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe('ProviderDisabled');
  expect(providers.claude.calls).toEqual([]);
  expect(app.messages).toEqual([]);
  expect(result.error.message).not.toContain('sk-claude-secret');
});
