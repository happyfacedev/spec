import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';

describe('X139 removed finish hook', () => {
  it('before-finish remains a silent compatibility no-op', async () => {
    const out = await run({ argv: ['hook', 'claude-code', 'before-finish'], env: {}, cwd: process.cwd(), scriptPath: undefined, stdin: () => Promise.resolve('not json') });
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });
});
