import { expect, it } from 'vitest';
import { done, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

it('PRV-003/S1 Usage recorded at the end of a reply', () => {
  const { app } = setup({ scripts: { claude: [token('Hi'), done(12, 3)] } });
  const reply = ok(app.send('Hello'));
  expect(reply.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
});
