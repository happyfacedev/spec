import { expect, it } from 'vitest';
import { done, rateLimit, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

const keys = { claude: 'sk-claude-secret', gpt: 'sk-gpt-secret', mistral: 'sk-mistral-secret' };

it('PRV-002/S1 Fallback enabled', () => {
  const { app, providers } = setup({
    enabled: ['claude', 'gpt'],
    fallback: 'gpt',
    keys,
    scripts: { claude: [rateLimit(500)], gpt: [token('Hi'), done(1, 1)] },
  });
  const reply = ok(app.send('Hello'));
  expect(providers.gpt.calls.map((c) => c.messages)).toEqual(providers.claude.calls.map((c) => c.messages));
  expect(reply.meta.fallbackFrom).toBe('claude');
  expect(app.events).toContainEqual({ type: 'FallbackTriggered', messageId: reply.id, from: 'claude', to: 'gpt' });
  expect(app.notices).toEqual([{ screen: 'UI-001', messageId: reply.id, text: 'Switched to gpt because claude is rate-limited.' }]);
});

it('PRV-002/S2 Fallback disabled', () => {
  const { app, providers } = setup({ enabled: ['claude', 'gpt'], fallback: null, keys, scripts: { claude: [rateLimit(500)] } });
  const reply = ok(app.send('Hello'));
  expect(reply.meta).toEqual({ stopReason: 'rate_limited', retryAfterMs: 500 });
  expect(providers.gpt.calls).toEqual([]);
});

it('PRV-002/S4 Fallback provider not enabled', () => {
  const { app, providers } = setup({ enabled: ['claude'], fallback: 'gpt', keys, scripts: { claude: [rateLimit(500)] } });
  const reply = ok(app.send('Hello'));
  expect(reply.meta).toEqual({ stopReason: 'rate_limited', retryAfterMs: 500 });
  expect(providers.gpt.calls).toEqual([]);
});
