// A blocked stage's work, set aside by the CLI and given back to the next run of that stage. The
// tickets folder and what a worktree's setup made are never stashed: the ticket file's live state
// belongs to the CLI, and setup output belongs to no stage.
//
// The stash list is one per repository, shared by every worktree, and its entries are addressed
// by position. Every change the CLI makes to it runs under one repository-wide lock, and an entry
// is dropped only once its position is checked to still hold it (ADR-002).
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchesAny } from '../core/glob';
import type { Ticket } from '../core/model';
import { isBuildStage } from '../core/pipeline';
import type { Role } from '../core/schemas';
import { changedPaths, git } from './git';
import { lockPath, waitForLockSync } from './lock';
import { loadSetupPaths } from './ticket-state';

/** How long a stash change waits for another one in this repository. */
const STASH_LOCK_WAIT_MS = 60_000;

/** The project's pinned CLI is left out of a stash like a generated file (WSP-009/R5, R6). */
const PINNED_CLI_GLOB = '.spec/bin/**';

/** The stash name of a stage that blocked; a build stage's has its own, so no other stage restores it (PIP-021/R11). */
export const blockedStashName = (id: string, role: Role, data: Pick<Ticket['data'], 'type' | 'lane' | 'history'>): string => `${id} ${isBuildStage(data, role) ? 'build' : role}: blocked`;

const inside = (path: string, dir: string) => dir !== '' && (path === dir || path.startsWith(`${dir}/`));

/** Uncommitted paths that belong to a stage: everything but the tickets folder and the ticket's setup paths. */
export function stageChanges(root: string, ticketsRel: string, id: string): string[] {
  const setup = new Set(loadSetupPaths(root, id));
  return changedPaths(root).filter((p) => !inside(p, ticketsRel) && !setup.has(p));
}

/** Pathspecs that leave out the tickets folder and the ticket's setup paths. */
export const stageExcludes = (root: string, ticketsRel: string, id: string): string[] => [`:(exclude)${ticketsRel}`, ...loadSetupPaths(root, id).map((p) => `:(top,exclude)${p}`)];

/** Runs `fn` holding the repository's stash lock (`<git common dir>/spec/stash.lock`). */
export function withStashLock<T>(root: string, fn: () => T): T | { error: string } {
  const path = lockPath(root, 'stash.lock');
  if (path === null) return { error: `${root} is not a git repository` };
  const lock = waitForLockSync(path, STASH_LOCK_WAIT_MS);
  if (!lock.ok) return { error: `another spec command (pid ${String(lock.holder ?? '?')}) holds ${path}; try again once it ends` };
  try {
    return fn();
  } finally {
    lock.release();
  }
}

/** Puts these paths back as HEAD has them: restored from HEAD, or removed when HEAD lacks them. */
export function putBackAsHead(root: string, paths: readonly string[]): void {
  if (paths.length === 0) return;
  const top = git(root, ['rev-parse', '--show-toplevel']).stdout.trim();
  git(top, ['reset', '-q', '--', ...paths.map((p) => `:(top,literal)${p}`)]);
  for (const p of paths) {
    if (git(top, ['cat-file', '-e', `HEAD:${p}`]).code === 0) git(top, ['checkout', '-q', 'HEAD', '--', `:(top,literal)${p}`]);
    else if (existsSync(join(top, p))) rmSync(join(top, p), { force: true });
  }
}

/**
 * Stashes the stage's uncommitted changes, untracked files included, as `name`, except the files
 * `generatedGlobs` match: those are put back as HEAD has them (WSP-009/R5). Not stashed when there
 * was nothing else to stash; an error when git refused.
 */
export function stashStage(root: string, ticketsRel: string, id: string, name: string, projectGlobs: readonly string[] = []): { stashed: boolean } | { error: string } {
  const generatedGlobs = [...projectGlobs, PINNED_CLI_GLOB];
  const changes = stageChanges(root, ticketsRel, id);
  const generated = changes.filter((p) => matchesAny(p, generatedGlobs));
  const keep = changes.filter((p) => !matchesAny(p, generatedGlobs));
  if (keep.length === 0) {
    putBackAsHead(root, generated);
    return { stashed: false };
  }
  const stashed = withStashLock(root, () => {
    // A staged generated change would still reach the stash's index commit whatever the pathspec says.
    if (generated.length > 0) git(root, ['reset', '-q', '--', ...generated.map((p) => `:(top,literal)${p}`)]);
    const r = git(root, ['stash', 'push', '-u', '-q', '-m', name, '--', ...keep.map((p) => `:(top,literal)${p}`)]);
    if (r.code !== 0) return { error: `git could not stash the stage's changes: ${r.stderr.trim() || r.stdout.trim()}` };
    return { stashed: true };
  });
  if (!('error' in stashed)) putBackAsHead(root, generated);
  return stashed;
}

export type RestoreResult = { ok: true; restored: boolean } | { ok: false; stash: string; files: string[]; added: string[] } | { ok: false; error: string };

/** The newest stash entry named `name`, as its commit. */
function findStash(root: string, name: string): string | null {
  const list = git(root, ['stash', 'list', '--format=%H %gs']);
  if (list.code !== 0) return null;
  for (const line of list.stdout.split('\n')) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const subject = line.slice(space + 1);
    if (subject === name || subject.endsWith(`: ${name}`)) return line.slice(0, space);
  }
  return null;
}

const lines = (s: string) => s.split('\n').filter((p) => p !== '');

/** The paths a stash entry changes in tracked files. */
const trackedPaths = (root: string, sha: string): string[] => lines(git(root, ['diff', '--name-only', '--no-renames', `${sha}^1`, sha]).stdout);

/** The new files a stash entry holds, which only `git stash show --include-untracked` lists. */
const addedPaths = (root: string, sha: string): string[] =>
  git(root, ['rev-parse', '--verify', '--quiet', `${sha}^3`]).code === 0 ? lines(git(root, ['ls-tree', '-r', '--name-only', '--full-tree', `${sha}^3`]).stdout) : [];

/** Whether a stash entry named `name` exists. */
export const hasStash = (root: string, name: string): boolean => findStash(root, name) !== null;

/** Every path a stash entry holds: its tracked changes and its untracked files. */
const stashPaths = (root: string, sha: string): string[] => [...new Set([...trackedPaths(root, sha), ...addedPaths(root, sha)])].sort();

/**
 * A stash commit like `sha` that leaves out the files `globs` match, as a stash made before
 * WSP-009/R5 may hold them: those paths stay as the stash's base has them, so applying it never
 * conflicts in them. `sha` itself when it holds none.
 */
function withoutGenerated(root: string, sha: string, globs: readonly string[]): string {
  const tracked = trackedPaths(root, sha).filter((p) => matchesAny(p, globs));
  const added = addedPaths(root, sha);
  const addedGenerated = added.filter((p) => matchesAny(p, globs));
  if (tracked.length === 0 && addedGenerated.length === 0) return sha;
  const dir = mkdtempSync(join(tmpdir(), 'spec-stash-'));
  const env = { GIT_INDEX_FILE: join(dir, 'index'), GIT_AUTHOR_NAME: 'spec', GIT_AUTHOR_EMAIL: 'spec@localhost', GIT_COMMITTER_NAME: 'spec', GIT_COMMITTER_EMAIL: 'spec@localhost' };
  try {
    const treeWithout = (from: string, paths: readonly string[], base: string | null): string | null => {
      if (git(root, ['read-tree', from], env).code !== 0) return null;
      for (const p of paths) {
        const at = base === null ? '' : git(root, ['ls-tree', '--full-tree', base, '--', p], env).stdout.trim();
        const m = /^(\d+) blob ([0-9a-f]+)\t/.exec(at);
        if (m?.[1] && m[2]) git(root, ['update-index', '--add', '--cacheinfo', `${m[1]},${m[2]},${p}`], env);
        else git(root, ['update-index', '--force-remove', '--', p], env);
      }
      const t = git(root, ['write-tree'], env);
      return t.code === 0 ? t.stdout.trim() : null;
    };
    const tree = treeWithout(sha, tracked, `${sha}^1`);
    if (tree === null) return sha;
    const parents = [`${sha}^1`, `${sha}^2`];
    if (added.length > 0) {
      if (addedGenerated.length === 0) parents.push(`${sha}^3`);
      else if (addedGenerated.length < added.length) {
        rmSync(env.GIT_INDEX_FILE, { force: true });
        const kept = treeWithout(`${sha}^3`, addedGenerated, null);
        const c = kept === null ? null : git(root, ['commit-tree', kept, '-m', 'untracked files'], env);
        if (c === null || c.code !== 0) return sha;
        parents.push(c.stdout.trim());
      }
    }
    const made = git(root, ['commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-m', 'stash without generated files'], env);
    return made.code === 0 ? made.stdout.trim() : sha;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** For tests: runs between finding an entry's position and dropping it. */
export interface StashSeams {
  readonly beforeDrop?: () => void;
}

/**
 * Drops the stash entry `sha`. Positions shift when an entry is pushed, by spec or anything else,
 * so the position is checked to hold `sha` right before the drop, and found again when it does not.
 */
function dropEntry(root: string, sha: string, seams: StashSeams): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    const at = git(root, ['stash', 'list', '--format=%H']).stdout.split('\n').indexOf(sha);
    if (at < 0) return;
    if (attempt === 0) seams.beforeDrop?.();
    const ref = `stash@{${String(at)}}`;
    if (git(root, ['rev-parse', '--verify', '--quiet', ref]).stdout.trim() !== sha) continue;
    git(root, ['stash', 'drop', '-q', ref]);
    return;
  }
}

/**
 * Applies the stash named `name` and drops it; a file in it that `generatedGlobs` match, from a stash
 * made before WSP-009/R5, is left as the branch has it. When it does not apply, every path it
 * touched is put back as HEAD has it, the stash is kept whole, and the conflicting files and the new
 * files it holds are returned.
 */
export function restoreStash(root: string, name: string, seams: StashSeams = {}, projectGlobs: readonly string[] = []): RestoreResult {
  const generatedGlobs = [...projectGlobs, PINNED_CLI_GLOB];
  const r = withStashLock(root, (): RestoreResult => {
    const sha = findStash(root, name);
    if (sha === null) return { ok: true, restored: false };
    const applied = git(root, ['stash', 'apply', '-q', withoutGenerated(root, sha, generatedGlobs)]);
    if (applied.code !== 0) {
      const touched = stashPaths(root, sha);
      const unmerged = git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=U']).stdout.split('\n').filter((p) => p !== '');
      // The tree was clean outside the tickets folder before the apply, so whatever is at these paths now came from it.
      putBackAsHead(root, touched);
      return { ok: false, stash: name, files: unmerged.length > 0 ? unmerged : touched, added: addedPaths(root, sha).sort() };
    }
    dropEntry(root, sha, seams);
    return { ok: true, restored: true };
  });
  return 'error' in r ? { ok: false, error: r.error } : r;
}
