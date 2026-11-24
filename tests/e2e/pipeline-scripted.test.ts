// End-to-end smoke test for X137: the session asks next for a stage task and owns delegation.
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

const fx = gitFixture('spec-session-next-e2e');
const worktrees: string[] = [];
afterAll(() => {
  for (const path of worktrees) fx.git('worktree', 'remove', '--force', path);
  fx.cleanup();
});

describe('session-driven ticket handoff', () => {
  it('spec next prepares one task in its ticket worktree', async () => {
    const out = await fx.spec('', 'next', 'TASK-101', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const task = JSON.parse(out.stdout) as { ticket: string; action: string; role: string; worktree: string; task: string; advance: string };
    worktrees.push(task.worktree);
    expect(task).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer' });
    expect(task.task).toContain('## Working folder');
    expect(task.task).toContain('## Brief');
    expect(task.advance.startsWith('.spec/bin/spec ticket advance TASK-101 --report-file ')).toBe(true);
    expect(task.advance).not.toContain('<path>');
    expect(task.task).not.toContain('compile-roles');
  }, 120_000);
});
