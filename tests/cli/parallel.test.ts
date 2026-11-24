import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';

describe('X139 session-driven parallel work', () => {
  it('help points callers at next instead of dispatch', async () => {
    const out = await run({ argv: ['--help'], env: {}, cwd: process.cwd(), scriptPath: undefined });
    expect(out.stdout).toContain('next [<TICKET>] [--start|--restart]');
    expect(out.stdout).not.toContain('dispatch <TICKET>');
  });
});
