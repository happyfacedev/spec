import { expect, it } from 'vitest';
import { setup } from './helpers';

it('SET-002/S1 Add a key', () => {
  const { app } = setup();
  app.addKey('gpt', 'sk-gpt-1234');
  expect(app.state.keys.get('gpt')).toBe('sk-gpt-1234');
  expect(app.maskedKey('gpt')).toBe('****1234');
});

it('SET-002/S2 Delete a key', () => {
  const { app } = setup({ keys: { claude: 'sk-claude-secret', gpt: 'sk-gpt-1234' } });
  app.deleteKey('gpt');
  expect(app.state.keys.has('gpt')).toBe(false);
  expect(app.maskedKey('gpt')).toBeNull();
});
