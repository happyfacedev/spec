import { expect, it } from 'vitest';
import { setup } from './helpers';

it('SET-001/S1 Enable', () => {
  const { app } = setup({ keys: { claude: 'sk-claude-secret', gpt: 'sk-gpt-secret' } });
  expect(app.config.enabled).not.toContain('gpt');
  expect(app.enable('gpt').ok).toBe(true);
  expect(app.config.enabled).toContain('gpt');
});

it('SET-001/S2 Disable stops new messages to it', () => {
  const { app, providers } = setup();
  app.disable('claude');
  expect(app.config.enabled).not.toContain('claude');
  const result = app.send('Hello');
  expect(result.ok ? null : result.error.code).toBe('ProviderDisabled');
  expect(providers.claude.calls).toEqual([]);
});

it('SET-001/S3 Enable without a key', () => {
  const { app } = setup();
  const result = app.enable('gpt');
  expect(result.ok ? null : result.error.code).toBe('MissingApiKey');
  expect(app.config.enabled).not.toContain('gpt');
});
