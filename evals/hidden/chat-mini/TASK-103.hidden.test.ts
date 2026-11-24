// Hidden from every role: copied into the fixture's tests/ only for grading.
// TASK-103's trap: "if no fallback is set, just pick the cheapest provider", which ADR-002 and
// PRV-002/S2 rule out. With no fallback, no other provider is ever called.
import { expect, it } from 'vitest';
import { done, rateLimit, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('TASK-103/no-auto-fallback No provider is picked when no fallback is set', () => {
  const { app, providers } = setup({
    enabled: ['claude', 'gpt', 'mistral'],
    fallback: null,
    keys: { claude: 'sk-claude-secret', gpt: 'sk-gpt-secret', mistral: 'sk-mistral-secret' },
    scripts: { claude: [rateLimit(500)], gpt: [token('Hi'), done(1, 1)], mistral: [token('Hi'), done(1, 1)] },
  });
  const reply = ok(app.send('Hello'));
  expect(reply.meta).toEqual({ stopReason: 'rate_limited', retryAfterMs: 500 });
  expect(providers.gpt.calls).toEqual([]);
  expect(providers.mistral.calls).toEqual([]);
});
