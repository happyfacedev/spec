// PIP-024/R2, R4: the proof tree of a build stage: its test files, spec folder and tickets on the code as it was before
// the build. A plain folder in the system's temp folder, never a git worktree; it is written from a temporary index, so
// the stage's tree, the real index, the stash, the branches and the list of worktrees stay as they are.
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { matchesAny } from '../core/glob';
import { git, gitWithInput } from './git';

export interface ProofTreeSource {
  readonly projectRoot: string;
  /** The stage's tree, as git's tree object (see treeKey). */
  readonly tree: string;
  /** The merge base of HEAD and the base branch. */
  readonly base: string;
  readonly testGlobs: readonly string[];
  /** The spec and tickets folders, relative to the project root. */
  readonly specPrefix: string;
  readonly ticketsPrefix: string;
  /** What the worktree's setup made, relative to the repository root: the proof tree's own setup makes it again. */
  readonly setupPaths: readonly string[];
}

/** An empty folder of its own, by its real path: a test runner names files by it. */
export const makeProofFolder = (): string => realpathSync(mkdtempSync(join(tmpdir(), 'spec-proof-')));

export function removeProofFolder(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // A folder that cannot be removed is left in the temp folder; it decides nothing.
  }
}

const under = (path: string, folder: string): boolean => folder !== '' && folder !== '.' && (path === folder || path.startsWith(`${folder}/`));

/** Writes the proof tree into `dir` and returns its project root, or why it could not be written. */
export function writeProofTree(dir: string, s: ProofTreeSource): { project: string } | { error: string } {
  const top = git(s.projectRoot, ['rev-parse', '--show-toplevel']);
  const shown = git(s.projectRoot, ['rev-parse', '--show-prefix']);
  if (top.code !== 0 || shown.code !== 0) return { error: `${s.projectRoot} is not a git repository` };
  const root = top.stdout.trim();
  const prefix = shown.stdout.trim();
  const temp = mkdtempSync(join(tmpdir(), 'spec-proof-index-'));
  const env = { GIT_INDEX_FILE: join(temp, 'index') };
  try {
    const specFolder = posix.join(prefix, s.specPrefix);
    const ticketsFolder = posix.join(prefix, s.ticketsPrefix);
    const keeps = (path: string) => under(path, specFolder) || under(path, ticketsFolder) || (path.startsWith(prefix) && matchesAny(path.slice(prefix.length), s.testGlobs));
    const read = git(root, ['read-tree', s.tree], env);
    if (read.code !== 0) return { error: `git could not read the stage's tree: ${read.stderr.trim()}` };
    const diff = git(root, ['diff-tree', '-r', '-z', '--raw', '--no-abbrev', '--no-renames', '--ignore-submodules=none', s.base, s.tree]);
    if (diff.code !== 0) return { error: `git could not compare the stage's tree with ${s.base}: ${diff.stderr.trim()}` };
    const removed: string[] = [];
    const restored: string[] = [];
    const gone = (path: string) => removed.push(`0 ${'0'.repeat(s.tree.length)}\t${path}\0`);
    const parts = diff.stdout.split('\0');
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const path = parts[i + 1] ?? '';
      const m = /^:(\d+) \d+ ([0-9a-f]+) /.exec(parts[i] ?? '');
      if (!m) return { error: `git's comparison of the stage's tree with ${s.base} could not be read` };
      if (keeps(path)) continue;
      if (m[1] === '000000') gone(path);
      else restored.push(`${m[1] ?? ''} ${m[2] ?? ''}\t${path}\0`);
    }
    const tracked = new Set(git(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']).stdout.split('\0'));
    for (const path of s.setupPaths) if (!tracked.has(path)) gone(path);
    if (removed.length + restored.length > 0) {
      // Removals first, so a file put back where the branch made a folder finds its place free.
      const put = gitWithInput(root, ['update-index', '-z', '--index-info'], [...removed, ...restored].join(''), env);
      if (put.code !== 0) return { error: `git could not put the code back: ${put.stderr.trim()}` };
    }
    const out = git(root, ['checkout-index', '-a', '-f', '-q', `--prefix=${dir}/`], env);
    if (out.code !== 0) return { error: `git could not write the proof tree: ${out.stderr.trim()}` };
    const project = join(dir, prefix);
    mkdirSync(project, { recursive: true });
    return { project };
  } catch (err) {
    return { error: `the proof tree could not be written: ${err instanceof Error ? (err.message.split('\n')[0] ?? '') : String(err)}` };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
