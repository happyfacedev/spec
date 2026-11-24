// What worktreeSetup makes in a new worktree belongs to no role (ADR-001, I1): an untracked
// symlink it leaves must not fail the spec-writer's path check.
import { readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture, report, validSpecWriterChecklist } from '../helpers';

const fx = gitFixture('spec-setup-paths');
const tree = join(`${realpathSync(fx.repo)}.worktrees`, 'PROP-205');
const specIn = (dir: string, stdin: string, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => '2026-10-27T12:00:00.000Z' });

beforeAll(async () => {
  const cfgPath = join(fx.repo, 'spec/config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
  // Not ignored by the fixture's .gitignore, as a dir-only `node_modules/` rule would not ignore a link.
  cfg.worktreeSetup = 'ln -s "$SPEC_MAIN_ROOT/node_modules" vendor-modules';
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  expect((await fx.spec('', 'build')).code).toBe(0);
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'configure');
});
afterAll(() => {
  fx.git('worktree', 'prune');
  rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
  fx.cleanup();
});

describe('setup output is no role change', () => {
  it('WSP-001/S15 What setup made is recorded', async () => {
    expect((await fx.spec('', 'worktree', 'add', 'PROP-205')).code).toBe(0);
    const record = join(fx.repo, '.git/spec/setup/PROP-205.txt');
    expect(readFileSync(record, 'utf8').split('\n')).toContain('vendor-modules');
    writeFileSync(record, 'vendor-modules\n');
    expect((await fx.spec('', 'worktree', 'add', 'PROP-205')).stdout).toMatch(/^PROP-205: already at /);
    expect(readFileSync(record, 'utf8')).toBe('vendor-modules\n');
  });

  it("PIP-005/S13 What the worktree's setup made is no role's change", async () => {
    expect((await specIn(tree, '', 'ticket', 'start', 'PROP-205', 'spec-writer')).code).toBe(0);
    expect(fx.git('-C', tree, 'status', '--porcelain').stdout).toContain('?? vendor-modules');
    const msg = report('role: spec-writer\nticket: PROP-205\nresult: done\nsummary: Nothing to change yet\n' + validSpecWriterChecklist());
    const check = async () => JSON.parse((await specIn(tree, msg, 'check-report', 'spec-writer', 'PROP-205', '--format', 'json')).stdout) as { ok: boolean; problems: string[] };
    expect(await check()).toMatchObject({ ok: true, problems: [] });
    writeFileSync(join(tree, 'notes.txt'), 'mine\n');
    expect((await check()).problems).toEqual(['the spec-writer changes spec files only; revert notes.txt']);
  });

  it("PIP-008/S22 What the worktree's setup made never rides in a stage's commit", async () => {
    rmSync(join(tree, 'notes.txt'));
    const msg = report('role: spec-writer\nticket: PROP-205\nresult: done\nsummary: Nothing to change yet\n' + validSpecWriterChecklist());
    const out = await specIn(tree, msg, 'ticket', 'advance', 'PROP-205');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('-C', tree, 'log', '-1', '--format=%s').stdout.trim()).toBe('PROP-205 spec-writer: Nothing to change yet');
    expect(fx.git('-C', tree, 'show', '--name-only', '--format=', 'HEAD').stdout.trim()).toBe('tickets/PROP-205.md');
    expect(fx.git('-C', tree, 'status', '--porcelain').stdout).toBe('?? vendor-modules\n');
  });
});
