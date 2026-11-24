import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';

const removed = [
  ['dispatch', ['dispatch', 'TASK-101']],
  ['orchestrate', ['orchestrate']],
  ['orchestrate with a ticket', ['orchestrate', 'TASK-101']],
  ['orchestrate options', ['orchestrate', '--depth', '2']],
  ['dispatch restart', ['dispatch', '--restart', 'TASK-101']],
  ['orchestrate restart', ['orchestrate', '--restart']],
  ['compile-roles', ['compile-roles', 'claude-code']],
] as const;

describe('X139 removed commands', () => {
  for (const [name, argv] of removed) {
    it(`${name} is no longer registered`, async () => {
      const out = await run({ argv: [...argv], env: {}, cwd: process.cwd(), scriptPath: undefined });
      expect(out.code).toBe(2);
      expect(out.stderr).toContain(`unknown command ${argv[0]}`);
    });
  }
});
