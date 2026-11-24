import { expect, it } from 'vitest';
import { done, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('CNV-003/S1 Text exported', () => {
  const { app } = setup({ scripts: { claude: [token('Hello there'), done(1, 2)] } });
  ok(app.send('Hi'));
  expect(app.exportMarkdown()).toBe('Hi\n\nHello there\n');
});

it('CNV-003/S2 No key material in export', () => {
  const { app } = setup({ scripts: { claude: [token('Hello there'), done(1, 2)] } });
  ok(app.send('Hi'));
  expect(app.exportMarkdown()).not.toContain('sk-claude-secret');
});
