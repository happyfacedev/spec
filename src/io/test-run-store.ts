// PIP-008/R12: the test run a check made, kept in the repository's common git directory (never
// committed) with the time and the context it ran in, so `ticket advance` need not run the same
// tests on the same tree again. Anything unreadable or different means no reuse.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestRun } from '../core/test-report';
import { commonDir, git } from './git';

/** What a kept run is valid for. */
export interface RunContext {
  readonly specRoot: string;
  readonly ticket: string;
  readonly role: string;
  readonly testCommand: string;
  readonly tree: string;
  /** A build stage's proof run only (PIP-024/R6): the merge base its code is read from, and the setup command ('' for none). */
  readonly base?: string;
  readonly worktreeSetup?: string;
}

/** The stage's whole-tree run, or a build stage's proof run. */
export type KeptKind = 'whole' | 'proof';

export interface KeptRun {
  readonly at: string;
  readonly context: RunContext;
  readonly run: TestRun;
}

const fileOf = (cwd: string, ticket: string, kind: KeptKind): string | null => {
  const dir = commonDir(cwd);
  return dir ? join(dir, 'spec', 'test-runs', `${ticket}${kind === 'proof' ? '.proof' : ''}.json`) : null;
};

/**
 * Git's tree object for the working tree: every tracked change and every untracked file git does
 * not ignore, staged into a temporary index (the real one is never touched) and written with
 * `git write-tree`. Run from the repository root. Null when it cannot be made.
 */
export function treeKey(cwd: string): string | null {
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  const index = git(cwd, ['rev-parse', '--path-format=absolute', '--git-path', 'index']);
  if (top.code !== 0 || index.code !== 0) return null;
  const root = top.stdout.trim();
  const tmp = mkdtempSync(join(tmpdir(), 'spec-tree-'));
  try {
    const temp = join(tmp, 'index');
    const realIndex = index.stdout.trim();
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const env = { ...process.env, GIT_INDEX_FILE: temp };
    const run = (args: string[]) => spawnSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (existsSync(realIndex)) copyFileSync(realIndex, temp);
    else if (run(['read-tree', 'HEAD']).status !== 0) return null;
    if (run(['add', '-A']).status !== 0) return null;
    const tree = run(['write-tree']);
    return tree.status === 0 ? tree.stdout.trim() : null;
  } catch {
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The context a run made now would have; null when the tree cannot be made. */
export function runContext(cwd: string, specRoot: string, ticket: string, role: string, testCommand: string): RunContext | null {
  const tree = treeKey(cwd);
  return tree === null ? null : { specRoot: resolve(specRoot), ticket, role, testCommand, tree };
}

/** Deletes the runs kept for the ticket. */
export function dropTestRun(cwd: string, ticket: string): void {
  for (const kind of ['whole', 'proof'] as const) {
    const file = fileOf(cwd, ticket, kind);
    if (file) rmSync(file, { force: true });
  }
}

/** Keeps the run, replacing any kept for the ticket. Nothing is kept when the run gave no results. */
export function keepTestRun(cwd: string, ticket: string, context: RunContext | null, at: string, run: TestRun, kind: KeptKind = 'whole'): void {
  const file = fileOf(cwd, ticket, kind);
  if (!file || context === null || run.error !== null) return;
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    const kept: KeptRun = { at, context, run };
    writeFileSync(file, JSON.stringify(kept));
  } catch {
    // A run that cannot be kept is simply run again by advance.
  }
}

/** The run kept for the ticket; null when there is none or the file cannot be read. */
export function readTestRun(cwd: string, ticket: string, kind: KeptKind = 'whole'): KeptRun | null {
  const file = fileOf(cwd, ticket, kind);
  if (!file) return null;
  try {
    const k = JSON.parse(readFileSync(file, 'utf8')) as Partial<KeptRun> | null;
    const c = k?.context;
    const run = k?.run;
    if (!k || typeof k.at !== 'string' || !c || !run) return null;
    if (![c.specRoot, c.ticket, c.role, c.testCommand, c.tree].every((v) => typeof v === 'string')) return null;
    if (run.error !== null || !Array.isArray(run.tests) || (run.exitCode !== null && typeof run.exitCode !== 'number')) return null;
    return k as KeptRun;
  } catch {
    return null;
  }
}

/** Whether a kept run may stand in for a run in `now`'s context: the whole context matches, and an implementer's failed whole-tree run never does. */
export function reusable(kept: KeptRun, now: RunContext): boolean {
  const c = kept.context;
  if (c.specRoot !== now.specRoot || c.ticket !== now.ticket || c.role !== now.role || c.testCommand !== now.testCommand || c.tree !== now.tree) return false;
  if (c.base !== now.base || c.worktreeSetup !== now.worktreeSetup) return false;
  // A proof run holds failing tests by design, and is kept only when it had no problem.
  if (now.base !== undefined) return true;
  const failed = kept.run.exitCode !== 0 || kept.run.tests.some((t) => t.status === 'failed');
  return !(now.role === 'implementer' && failed);
}
