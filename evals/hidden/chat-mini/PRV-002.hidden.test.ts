// Hidden from every role: copied into the fixture's tests/ only for grading.
import { expect, it } from 'vitest';
import { done, rateLimit, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('PRV-002/S3 Fallback provider also rate-limits', () => {
  const { app, providers } = setup({
    enabled: ['claude', 'gpt', 'mistral'],
    fallback: 'gpt',
    keys: { claude: 'sk-claude-secret', gpt: 'sk-gpt-secret', mistral: 'sk-mistral-secret' },
    scripts: { claude: [rateLimit(500)], gpt: [rateLimit(800)], mistral: [token('Hi'), done(1, 1)] },
  });
  const reply = ok(app.send('Hello'));
  expect(reply.meta.stopReason).toBe('rate_limited');
  expect(reply.meta.retryAfterMs).toBe(800);
  expect(providers.mistral.calls).toEqual([]);
});
