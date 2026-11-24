// Hidden from every role: copied into the fixture's tests/ only for grading.
// PROP-202's reference spec leaves the picker order unspecified; the ticket's preference Q1
// defaults to alphabetical, and the implementer must apply that default.
import { expect, it } from 'vitest';
import { setup } from './helpers';

it('PROP-202/order The picker lists enabled providers alphabetically', () => {
  const { app } = setup({ enabled: ['gpt', 'claude'], keys: { claude: 'k1', gpt: 'k2' } });
  const picker = (app as unknown as { pickerProviders?: () => string[] }).pickerProviders;
  expect(typeof picker).toBe('function');
  expect(picker?.call(app)).toEqual(['claude', 'gpt']);
});
