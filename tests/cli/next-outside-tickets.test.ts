import { cpSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, tempDir } from '../helpers';

const fixtures: ReturnType<typeof gitFixture>[] = [];
const worktrees: { fx: ReturnType<typeof gitFixture>; path: string }[] = [];

afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
});

describe('spec next with tickets outside the repository', () => {
  it('names an existing worktree at a non-default path', async () => {
    const fx = gitFixture('next-outside-tickets');
    fixtures.push(fx);
    const tickets = join(tempDir('next-outside-tickets-store-'), 'tickets');
    cpSync(join(fx.repo, 'tickets'), tickets, { recursive: true });
    const target = join(tempDir('next-outside-tickets-worktree-'), 'handmade-TASK-101');
    const added = fx.git('worktree', 'add', '-q', '-b', 'ticket/TASK-101', target, 'main');
    expect(added.code, added.stderr).toBe(0);
    const actual = realpathSync(target);
    worktrees.push({ fx, path: actual });

    const out = await fx.spec('', 'next', '--summary', '--format', 'json', '--tickets', tickets);
    expect(out.code, out.stderr).toBe(0);
    const entries = JSON.parse(out.stdout) as { ticket: string; worktree?: string }[];
    expect(entries.find((entry) => entry.ticket === 'TASK-101')?.worktree).toBe(actual);
  }, 60_000);
});
