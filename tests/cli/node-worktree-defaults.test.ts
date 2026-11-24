import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { defaultsForStack } from '../../src/cli/stacks';
import { REPO, gitFixture, tempDir } from '../helpers';

const made: (() => void)[] = [];
afterAll(() => {
  for (const cleanup of made) cleanup();
});

describe('INS-001/S27 Node worktree defaults', () => {
  it('INS-001/S27 Init links ticket worktrees to the project node_modules', async () => {
    const repo = tempDir('spec-s4-node-default-');
    made.push(() => {
      rmSync(repo, { recursive: true, force: true });
    });
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^5.0.0' } }));
    const out = await run({
      argv: ['init', '.', '--name', 'node-app', '--stack', 'node'],
      env: {},
      cwd: repo,
      scriptPath: join(REPO, 'plugin/scripts/spec'),
    });
    expect(out.code, out.stderr).toBe(0);
    const config = JSON.parse(readFileSync(join(repo, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
    expect(config.worktreeSetup).toBe('ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules');
  });

  it('INS-001/S27 A Node ticket worktree can run its configured test command', async () => {
    let worktrees = '';
    const fx = gitFixture('spec-s4-node-worktree', {
      setup: (dir) => {
        worktrees = dir + '.worktrees';
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.worktreeSetup = defaultsForStack('node', dir)?.worktreeSetup;
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    made.push(() => {
      fx.git('worktree', 'prune');
      rmSync(worktrees, { recursive: true, force: true });
      fx.cleanup();
    });
    const started = await fx.spec('', 'worktree', 'add', 'TASK-103', '--format', 'json');
    expect(started.code, started.stderr).toBe(0);
    const project = (JSON.parse(started.stdout) as { project: string }).project;
    expect(existsSync(join(project, 'node_modules/vitest/package.json'))).toBe(true);
    const tested = await run({
      argv: ['test', '--root', join(project, 'spec')],
      env: {},
      cwd: project,
      scriptPath: join(project, '.spec/bin/spec'),
    });
    expect(tested.code, tested.stderr).toBe(0);
  }, 60_000);
});

describe('INS-001/S28 Python worktree option', () => {
  it('INS-001/S28 Documents project-specific venv setup without a default', () => {
    const skill = readFileSync(join(REPO, 'plugin/skills/spec/SKILL.md'), 'utf8');
    expect(skill).toContain('Python virtual environments are optional');
    expect(skill).toContain('no default worktree setup');
  });
});
