// ticket start against a real git repository: a throwaway copy of chat-mini.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { git } from '../../src/io/git';
import { FIXTURE, tempDir } from '../helpers';

let repo = '';
const spec = (...argv: string[]) => run({ argv: [...argv, '--root', join(repo, 'spec')], env: {}, cwd: repo, scriptPath: undefined });
const g = (...args: string[]) => git(repo, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args]);
const ticket = (id: string) => readFileSync(join(repo, 'tickets', `${id}.md`), 'utf8');

beforeAll(() => {
  repo = tempDir('spec-start-');
  cpSync(FIXTURE, repo, { recursive: true, filter: (src) => !src.includes('/node_modules') });
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'fixture');
});
afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('spec ticket start', () => {
  it('creates ticket/<ID> from main and sets status and stage, leaving the body alone', async () => {
    const before = ticket('PROP-201');
    const out = await spec('ticket', 'start', 'PROP-201', 'spec-writer', '--format', 'json');
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'PROP-201', branch: 'ticket/PROP-201', created: true, stage: 'spec-writer', status: 'in_progress' });
    expect(g('branch', '--show-current').stdout.trim()).toBe('ticket/PROP-201');
    expect(ticket('PROP-201')).toBe(before.replace('status: open', 'status: in_progress').replace('stage: null', 'stage: spec-writer'));
  });

  it('is idempotent for the stage that is running', async () => {
    const out = await spec('ticket', 'start', 'PROP-201', 'spec-writer', '--format', 'json');
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as { created: boolean }).created).toBe(false);
  });

  it('refuses a ticket the gate refuses', async () => {
    const out = await spec('ticket', 'start', 'PROP-206', 'spec-writer');
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/PROP-206 is not ready/);
  });

  it('refuses a role outside the pipeline, or out of order', async () => {
    expect((await spec('ticket', 'start', 'TASK-101', 'tester')).stderr).toMatch(/tester is not a stage of a task: implementer → reviewer/);
    expect((await spec('ticket', 'start', 'PROP-202', 'implementer')).stderr).toMatch(/the next stage of PROP-202 is spec-writer/);
    expect((await spec('ticket', 'start', 'TASK-101', 'boss')).code).toBe(2);
  });

  it('refuses a second ticket while another has a stage running in the same working tree', async () => {
    const out = await spec('ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/PROP-201 has its spec-writer stage running in this tree; wait for it to finish .* or give TASK-101 its own worktree \(spec worktree add TASK-101\)/);
  });

  it('refuses to switch branches over uncommitted work outside the tickets dir', async () => {
    // PROP-201's stage is over (its ticket file back to open), so only the dirty tree stands in the way.
    g('checkout', '--', 'tickets/PROP-201.md');
    writeFileSync(join(repo, 'src/scratch.ts'), 'export {};\n');
    const out = await spec('ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/uncommitted changes in src\/scratch\.ts/);
    expect(g('branch', '--show-current').stdout.trim()).toBe('ticket/PROP-201');
    rmSync(join(repo, 'src/scratch.ts'));
  });
});
