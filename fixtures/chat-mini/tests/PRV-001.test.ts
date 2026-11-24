import { expect, it } from 'vitest';
import { done, rateLimit, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('PRV-001/S1 Streams tokens', () => {
  const { app, providers } = setup({ scripts: { claude: [token('Hel'), token('lo'), done(1, 2)] } });
  const reply = ok(app.send('Hi'));
  expect(providers.claude.calls[0]?.apiKey).toBe('sk-claude-secret');
  expect(app.events.filter((e) => e.type === 'TokenStreamed')).toEqual([
    { type: 'TokenStreamed', messageId: reply.id, text: 'Hel' },
    { type: 'TokenStreamed', messageId: reply.id, text: 'lo' },
  ]);
  expect(reply.content).toBe('Hello');
});

it('PRV-001/S2 Provider rate-limits', () => {
  const { app } = setup({ scripts: { claude: [token('Hel'), rateLimit(500)] } });
  const reply = ok(app.send('Hi'));
  expect(app.events).toContainEqual({ type: 'RateLimited', providerId: 'claude', retryAfterMs: 500 });
  expect(reply.content).toBe('Hel');
});

it('PRV-001/S3 The key never reaches the log', () => {
  const { app } = setup({ scripts: { claude: [token('Hel'), token('lo'), done(1, 2)] } });
  ok(app.send('Hi'));
  expect(app.log.length).toBeGreaterThan(0);
  expect(app.log.filter((line) => line.includes('sk-claude-secret'))).toEqual([]);
});
