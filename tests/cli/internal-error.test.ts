// CLI-005 S4-S5, CLI-006 S5: a failure inside the tool, injected by the test.
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/cli/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/cli/commands')>()),
  cmdLint: () => {
    throw new Error('boom');
  },
}));
vi.mock('../../src/cli/brief', () => ({
  cmdBrief: () => {
    throw new Error('boom');
  },
}));

const { run } = await import('../../src/cli/run');
const ROOT = join(import.meta.dirname, '../../fixtures/chat-mini/spec');
const go = (...argv: string[]) => run({ argv: [...argv, '--root', ROOT], env: {}, cwd: process.cwd(), scriptPath: undefined });

describe('internal errors', () => {
  it('CLI-005/S4 A failure inside the tool', async () => {
    const out = await go('lint');
    expect(out.stderr.startsWith('spec: internal error: Error: boom')).toBe(true);
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });

  it('CLI-005/S5 An internal error carries its stack trace', async () => {
    const out = await go('lint');
    const rest = out.stderr.split('\n').slice(1).filter((l) => l !== '');
    expect(rest.length).toBeGreaterThan(0);
    for (const l of rest) expect(l.startsWith('    at ')).toBe(true);
  });

  it('CLI-006/S5 A failure inside the tool', async () => {
    const out = await go('brief', 'implementer', 'TASK-101');
    expect(out.stdout.startsWith('spec brief failed: Error: boom')).toBe(true);
    expect(out.stderr).toBe('');
    expect(out.code).toBe(0);
    expect(out.stdout).not.toContain('spec: internal error:');
  });
});
