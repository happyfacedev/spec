// Git, called with argument arrays: nothing reaches a shell.
import { AsyncLocalStorage } from 'node:async_hooks';
import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SourceFile } from '../core/source';
import { type FileHunks, parseUnifiedDiff } from '../core/stubs';

export interface GitResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const GIT_MAX_BUFFER = 1024 * 1024 * 1024;

const commandGitCache = new AsyncLocalStorage<Map<string, GitResult>>();
const FIXED_REPOSITORY_FACTS = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'] as const;
const FIXED_REPOSITORY_FACT_SET = new Set<string>(FIXED_REPOSITORY_FACTS);

/** Scope repository-fact reuse to one CLI invocation. */
export function withCommandGitCache<T>(command: () => T): T {
  return commandGitCache.run(new Map(), command);
}

function fixedRepositoryFact(args: readonly string[]): string | null {
  return args.length === 2 && args[0] === 'rev-parse' && FIXED_REPOSITORY_FACT_SET.has(args[1] ?? '') ? args[1] ?? null : null;
}

function populateFixedRepositoryFacts(cwd: string, cache: Map<string, GitResult>): void {
  const directory = resolve(cwd);
  const key = JSON.stringify([directory, '__fixed-repository-facts__']);
  if (cache.has(key)) return;

  // The sentinel records one combined attempt; it is not a repository fact.
  cache.set(key, { code: 1, stdout: '', stderr: '' });
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  const r = spawnSync('git', ['rev-parse', ...FIXED_REPOSITORY_FACTS], { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
  if (r.status !== 0) return;

  const values = r.stdout.split('\n');
  if (values.length !== FIXED_REPOSITORY_FACTS.length + 1 || values.at(-1) !== '') return;
  FIXED_REPOSITORY_FACTS.forEach((fact, index) => {
    cache.set(JSON.stringify([directory, fact]), { code: 0, stdout: `${values[index] ?? ''}\n`, stderr: '' });
  });
}

function changesRepositoryLocation(args: readonly string[]): boolean {
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === '-C' || arg === '-c' || arg === '--git-dir' || arg === '--work-tree' || arg === '--namespace') {
      index += 2;
      continue;
    }
    if (arg?.startsWith('-')) {
      index++;
      continue;
    }
    break;
  }
  const command = args[index];
  const subcommand = args[index + 1];
  return command === 'init' || (command === 'worktree' && ['add', 'remove', 'move', 'prune', 'repair'].includes(subcommand ?? ''));
}

export function git(cwd: string, args: readonly string[], env?: Readonly<Record<string, string | undefined>>): GitResult {
  const cache = commandGitCache.getStore();
  const fact = fixedRepositoryFact(args);
  const directory = resolve(cwd);
  const key = fact === null ? null : JSON.stringify([directory, fact]);
  if (cache && changesRepositoryLocation(args)) cache.clear();
  if (!env && cache && key !== null) {
    populateFixedRepositoryFacts(cwd, cache);
    const saved = cache.get(key);
    if (saved) return saved;
  }
  // Loaded on first use: most commands never call git, and child_process costs ~5 ms to load.
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  // The whole index or tree of a large repository is listed in one call, far beyond Node's 1 MiB default.
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER, ...(env ? { env: { ...process.env, ...env } } : {}) });
  const result = { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
  if (!env && cache && key !== null && result.code === 0) cache.set(key, result);
  return result;
}

 /** Run a batched Git command that reads its requests from stdin. */
export function gitWithInput(cwd: string, args: readonly string[], input: string, env?: Readonly<Record<string, string | undefined>>): GitResult {
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  const r = spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER, ...(env ? { env: { ...process.env, ...env } } : {}) });
  return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

export const isRepo = (cwd: string): boolean => git(cwd, ['rev-parse', '--git-dir']).code === 0;

export type GitContext = 'none' | 'worktree' | 'bare' | 'broken';

function metadataContext(cwd: string): 'worktree' | 'bare' | null {
  const inspect = (current: string): 'worktree' | 'bare' | null => {
    try {
      lstatSync(join(current, '.git'));
      return 'worktree';
    } catch {
      // Continue looking for repository metadata in a parent directory.
    }
    try {
      const head = lstatSync(join(current, 'HEAD')).isFile();
      const config = lstatSync(join(current, 'config')).isFile();
      const objects = lstatSync(join(current, 'objects')).isDirectory();
      const refs = lstatSync(join(current, 'refs')).isDirectory();
      if (head && config && objects && refs) return 'bare';
    } catch {
      // A bare repository has all four Git metadata entries.
    }
    const parent = resolve(current, '..');
    return parent === current ? null : inspect(parent);
  };
  return inspect(resolve(cwd));
}

/** Git states that matter to edit enforcement; absent and bare repositories have no editable base. */
export function gitContext(cwd: string): GitContext {
  const result = git(cwd, ['rev-parse', '--is-bare-repository']);
  if (result.code === 0) return result.stdout.trim() === 'true' ? 'bare' : 'worktree';
  const metadata = metadataContext(cwd);
  return metadata === 'bare' ? 'bare' : metadata === 'worktree' ? 'broken' : 'none';
}

/** The commit a branch forked from, or null when either side does not exist. */
export function mergeBase(cwd: string, a: string, b: string): string | null {
  const r = git(cwd, ['merge-base', a, b]);
  return r.code === 0 ? r.stdout.trim() : null;
}

/** The commit a ref (branch, tag or commit) names, or null when git cannot resolve it to one. */
export function resolveCommit(cwd: string, ref: string): string | null {
  // A leading dash would be read as an option.
  if (ref === '' || ref.startsWith('-')) return null;
  const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return r.code === 0 ? r.stdout.trim() : null;
}

/**
 * Every file under `dir` (relative to `cwd`) as committed at `ref`, with paths relative to `dir`.
 * Null when the ref does not exist. One `cat-file --batch` call reads all the blobs.
 */
export function filesAt(cwd: string, ref: string, dir: string): SourceFile[] | null {
  const prefix = dir === '' || dir === '.' ? '' : `${dir.replace(/\/+$/, '')}/`;
  const ls = git(cwd, ['ls-tree', '-r', '-z', '--name-only', ref, '--', prefix === '' ? '.' : prefix]);
  if (ls.code !== 0) return null;
  const paths = ls.stdout.split('\0').filter((p) => p !== '');
  // ls-tree names paths relative to cwd; `<ref>:./<path>` reads them the same way (monorepos).
  const blobs = catFiles(cwd, paths.map((p) => `${ref}:./${p}`));
  if (blobs.some((b) => b === null)) return null;
  return paths
    .map((p, i) => ({ path: p.slice(prefix.length), content: blobs[i] ?? new Uint8Array() }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface GitObject {
  readonly type: string;
  readonly contents: Uint8Array;
}

export interface GitObjectBatch {
  readonly code: number;
  readonly stderr: string;
  readonly objects: readonly (GitObject | null)[];
}

/** Parse the response framing from `git cat-file --batch`. */
export function parseCatFileBatchOutput(stdout: Uint8Array, specs: readonly string[]): (GitObject | null)[] {
  const buf = Buffer.from(stdout);
  const objects: (GitObject | null)[] = [];
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const nl = buf.indexOf(10, at);
    if (nl < 0) {
      objects.push(null);
      at = buf.length;
      continue;
    }
    const header = buf.subarray(at, nl).toString('utf8');
    // A missing or unresolvable object has no body; its line still precedes the next response.
    if (header.endsWith(' missing') || header.endsWith(' ambiguous')) {
      objects.push(null);
      at = nl + 1;
      continue;
    }
    const parts = header.split(' ');
    const type = parts.at(-2) ?? '';
    const sizeText = parts.at(-1) ?? '';
    const size = Number(sizeText);
    if (parts.length < 3 || !['blob', 'tree', 'commit', 'tag'].includes(type) || !/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 0) {
      objects.push(null);
      at = nl + 1;
      continue;
    }
    if (nl + 1 + size >= buf.length) {
      objects.push(null);
      at = buf.length;
      continue;
    }
    objects.push({ type, contents: new Uint8Array(buf.subarray(nl + 1, nl + 1 + size)) });
    at = nl + 1 + size + 1;
  }
  return objects;
}

/** The contents of each object in one `cat-file --batch` call; null where one is missing. */
export function catFileBatch(cwd: string, specs: readonly string[]): GitObjectBatch {
  if (specs.length === 0) return { code: 0, stderr: '', objects: [] };
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  const r = spawnSync('git', ['cat-file', '--batch'], { cwd, input: `${specs.join('\n')}\n`, maxBuffer: GIT_MAX_BUFFER });
  return { code: r.status ?? 1, stderr: r.stderr.toString('utf8'), objects: parseCatFileBatchOutput(r.stdout, specs) };
}

/** The contents of each `<rev>:<path>` in one `cat-file --batch` call; null where one is missing. */
export function catFiles(cwd: string, specs: readonly string[]): (Uint8Array | null)[] {
  const batch = catFileBatch(cwd, specs);
  if (batch.code !== 0) return specs.map(() => null);
  return batch.objects.map((object) => object?.type === 'blob' ? object.contents : null);
}

/**
 * Uncommitted changes to `paths` against HEAD as hunks (`git diff -U0`); an untracked file is one
 * hunk of added lines.
 */
export function uncommittedHunks(cwd: string, paths: readonly string[]): FileHunks[] {
  if (paths.length === 0) return [];
  const untracked = new Set(git(cwd, ['ls-files', '--others', '--exclude-standard', '--', ...paths]).stdout.split('\n').filter((p) => p !== ''));
  const tracked = paths.filter((p) => !untracked.has(p));
  const out = tracked.length > 0 ? parseUnifiedDiff(git(cwd, ['diff', '-U0', '--no-color', '--no-renames', 'HEAD', '--', ...tracked]).stdout) : [];
  for (const p of untracked) out.push({ path: p, hunks: [{ removed: [], added: readFileSync(join(cwd, p), 'utf8').split('\n') }] });
  return out;
}

/** The repository's common git directory, shared by every worktree; null outside a repository. */
export function commonDir(cwd: string): string | null {
  const r = git(cwd, ['rev-parse', '--git-common-dir']);
  return r.code === 0 ? resolve(cwd, r.stdout.trim()) : null;
}

/**
 * The lines added to files matching `globs` (project-relative) since the merge base of `base` and
 * HEAD, as hunks: committed and uncommitted changes, plus every untracked file in full. Without a
 * merge base every line counts as added. Paths are relative to `cwd`.
 */
export function addedLinesSince(cwd: string, base: string, globs: readonly string[]): FileHunks[] {
  if (globs.length === 0) return [];
  const pathspecs = globs.map((g) => `:(glob)${g}`);
  const from = mergeBase(cwd, base, 'HEAD') ?? git(cwd, ['hash-object', '-t', 'tree', '/dev/null']).stdout.trim();
  // Explicit prefixes and no external diff: parseUnifiedDiff reads `+++ b/<path>`, whatever the user's config.
  const diff = git(cwd, ['diff', '-U0', '--no-color', '--no-ext-diff', '--no-renames', '--relative', '--src-prefix=a/', '--dst-prefix=b/', from, '--', ...pathspecs]);
  const out = diff.code === 0 ? parseUnifiedDiff(diff.stdout) : [];
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '--', ...pathspecs]).stdout.split('\n').filter((p) => p !== '');
  for (const p of untracked) {
    // A symlink or a folder made by worktreeSetup is not code anyone wrote.
    if (!lstatSync(join(cwd, p)).isFile()) continue;
    out.push({ path: p, hunks: [{ removed: [], added: readFileSync(join(cwd, p), 'utf8').split('\n') }] });
  }
  return out;
}

/** Files matching `globs` (tracked or not, ignored ones excepted) that contain `text`. */
export function filesContaining(cwd: string, text: string, globs: readonly string[]): string[] {
  if (globs.length === 0) return [];
  // submodule.recurse=true in a user's config implies --recurse-submodules, which git refuses with --untracked.
  const r = git(cwd, ['-c', 'submodule.recurse=false', 'grep', '-l', '-F', '--untracked', text, '--', ...globs.map((g) => `:(glob)${g}`)]);
  return r.code === 0 ? r.stdout.split('\n').filter((p) => p !== '').sort() : [];
}

export const currentBranch = (cwd: string): string | null => {
  const r = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return r.code === 0 ? r.stdout.trim() : null;
};

export const branchExists = (cwd: string, branch: string): boolean =>
  git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).code === 0;

/**
 * Paths with uncommitted changes against HEAD, split into tracked files (modified, staged, deleted,
 * unmerged) and untracked files one by one; ignored files are in neither. Both sorted.
 */
export function dirtyPaths(cwd: string): { tracked: string[]; untracked: string[] } {
  const out = { tracked: [] as string[], untracked: [] as string[] };
  // --no-renames reports a rename as a deletion plus an addition, so both paths show.
  const r = git(cwd, ['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all']);
  if (r.code !== 0) return out;
  for (const entry of r.stdout.split('\0')) {
    if (entry.length < 4) continue;
    (entry.startsWith('??') ? out.untracked : out.tracked).push(entry.slice(3));
  }
  out.tracked.sort();
  out.untracked.sort();
  return out;
}

/** Paths with uncommitted changes against HEAD, untracked files included. */
export function changedPaths(cwd: string): string[] {
  const { tracked, untracked } = dirtyPaths(cwd);
  return [...tracked, ...untracked].sort();
}

/** Whether git in this repository compares paths without regard to case (`core.ignoreCase`). */
export const ignoresCase = (cwd: string): boolean => git(cwd, ['config', '--type=bool', 'core.ignoreCase']).stdout.trim() === 'true';
