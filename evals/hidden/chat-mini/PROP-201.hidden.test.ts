// Hidden from every role: copied into the fixture's tests/ only for grading.
// The scenarios PROP-201's reference spec stage adds (PRV-001/S4, SET-001/S4).
import { expect, it } from 'vitest';
import { done, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('PRV-001/S4 Streams from gemini', () => {
  const { app, providers } = setup({ active: 'gemini' as never, enabled: ['gemini' as never], keys: { gemini: 'sk-gemini-secret' } as never, scripts: { gemini: [token('Hi'), done(1, 1)] } as never });
  const reply = ok(app.send('Hello'));
  const gemini = (providers as Record<string, { calls: { apiKey: string }[] } | undefined>).gemini;
  expect(gemini?.calls[0]?.apiKey).toBe('sk-gemini-secret');
  expect(reply.content).toBe('Hi');
});

it('SET-001/S4 Enable gemini', () => {
  const { app } = setup({ keys: { claude: 'sk-claude-secret', gemini: 'sk-gemini-secret' } as never });
  expect(app.enable('gemini' as never).ok).toBe(true);
  expect(app.config.enabled).toContain('gemini');
});
