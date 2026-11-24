import { expect, it } from 'vitest';
import { done, token } from '../src/providers/fake-provider';
import { ok, setup } from './helpers';

const script = [token('Hel'), token('lo'), token(' world'), done(1, 3)];

it('CNV-002/S1 Partial reply kept', () => {
  const { app } = setup({ scripts: { claude: script } });
  app.onEvent((e) => {
    if (e.type === 'TokenStreamed' && e.text === 'Hel') app.stop(e.messageId);
  });
  const reply = ok(app.send('Hi'));
  expect(reply.content).toBe('Hel');
  expect(app.events.filter((e) => e.type === 'TokenStreamed')).toHaveLength(1);
});

it('CNV-002/S2 Stop reason recorded', () => {
  const { app } = setup({ scripts: { claude: script } });
  app.onEvent((e) => {
    if (e.type === 'TokenStreamed') app.stop(e.messageId);
  });
  const reply = ok(app.send('Hi'));
  expect(reply.meta.stopReason).toBe('user');
});
