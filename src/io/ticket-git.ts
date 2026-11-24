// Where each ticket's state lives in git. A ticket runs on its own branch, ticket/<ID>, often in its
// own worktree, so the copy of its file in any other tree goes stale. These read the live copy, and
// write to it, wherever it is.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseTicket } from '../core/parse/tickets';
import { realPath } from './fs';
import { catFiles, git, resolveCommit } from './git';

export const ticketBranch = (id: string): string => `ticket/${id}`;
const idOfBranch = (branch: string): string | null => (branch.startsWith('ticket/') ? branch.slice('ticket/'.length) : null);

const lines = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

interface WorktreeState {
  readonly branches: Map<string, string>;
  readonly primary: string | null;
  readonly currentBranch: string | null;
}

function worktreeState(root: string, repoTop: string | null = null): WorktreeState {
  const r = git(root, ['worktree', 'list', '--porcelain']);
  const branches = new Map<string, string>();
  if (r.code !== 0) return { branches, primary: null, currentBranch: null };
  let path: string | null = null;
  let primary: string | null = null;
  let currentBranch: string | null = null;
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      path = line.slice('worktree '.length);
      primary ??= path;
    } else if (line.startsWith('branch refs/heads/') && path !== null) {
      const branch = line.slice('branch refs/heads/'.length);
      branches.set(branch, path);
      if (repoTop !== null && realPath(path) === repoTop) currentBranch = branch;
    } else if (line === '') path = null;
  }
  return { branches, primary, currentBranch };
}

/** Branch name → worktree path, for every worktree of the repository at `root`. */
export function worktreeBranches(root: string): Map<string, string> {
  return worktreeState(root).branches;
}

export interface LiveTicket {
  readonly branch: string;
  /** The worktree that has the branch checked out, or null when the copy is the branch tip. */
  readonly worktree: string | null;
  readonly text: string;
  /** The branch tip the text was read from, used as the commit's compare-and-swap value. */
  readonly tip: string;
}

export interface TicketGitState {
  /** Ticket ID → its live ticket file, for tickets whose newest copy is not in this tree. */
  readonly live: ReadonlyMap<string, LiveTicket>;
  /** Ticket ID → the worktree its branch is checked out in, this one included. */
  readonly worktrees: ReadonlyMap<string, string>;
  /** Ticket IDs that have a branch. */
  readonly branches: ReadonlySet<string>;
  /** Ticket IDs whose branch is merged into the base branch. */
  readonly mergedIntoBase: ReadonlySet<string>;
  /** The ticket whose branch this tree has checked out. */
  readonly current: string | null;
  /** Repository context already read while loading this state. */
  readonly repoTop: string | null;
  readonly prefix: string;
  readonly primaryWorktree: string | null;
}

export const NO_TICKET_GIT: TicketGitState = { live: new Map(), worktrees: new Map(), branches: new Set(), mergedIntoBase: new Set(), current: null, repoTop: null, prefix: '', primaryWorktree: null };

/**
 * Reads each ticket from its live copy. A done or absorbed ticket on the base branch takes precedence
 * only when the base tip establishes that state; other tickets retain their ticket-branch source.
 */
export function ticketGitState(projectRoot: string, ticketsRel: string | null, base: string): TicketGitState {
  const baseRefs = base === '' ? [] : base.startsWith('refs/') ? [base] : ['refs/heads/' + base, 'refs/remotes/' + base, 'refs/tags/' + base];
  const listedRefs = git(projectRoot, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/ticket/', ...baseRefs]);
  if (listedRefs.code !== 0) return NO_TICKET_GIT;
  const refs = lines(listedRefs.stdout)
    .map((line) => {
      const split = line.lastIndexOf(' ');
      if (split < 0) return null;
      const refname = line.slice(0, split);
      return { refname, branch: refname.startsWith('refs/heads/') ? refname.slice('refs/heads/'.length) : refname, tip: line.slice(split + 1) };
    })
    .filter((ref): ref is { refname: string; branch: string; tip: string } => ref !== null);
  const ticketRefs = refs.filter(({ refname }) => refname.startsWith('refs/heads/ticket/'));
  const branchTips = new Map(ticketRefs.map(({ branch, tip }) => [branch, tip]));
  const branchNames = ticketRefs.map((ref) => ref.branch);
  const branchIds = new Set(ticketRefs.map(({ branch }) => idOfBranch(branch)).filter((id): id is string => id !== null));
  const baseRef = base.startsWith('refs/')
    ? refs.find((ref) => ref.refname === base) ?? null
    : refs.find((ref) => ref.refname === 'refs/heads/' + base)
      ?? refs.find((ref) => ref.refname === 'refs/remotes/' + base)
      ?? refs.find((ref) => ref.refname === 'refs/tags/' + base)
      ?? null;
  const baseTip = baseRef?.tip ?? resolveCommit(projectRoot, base);
  const baseBranch = baseRef?.refname.startsWith('refs/heads/') ? baseRef.branch : null;
  const prefix = git(projectRoot, ['rev-parse', '--show-prefix']).stdout.trim();
  const top = git(projectRoot, ['rev-parse', '--show-toplevel']);
  const repoTop = realPath(top.stdout.trim());
  const here = repoTop;
  const listedWorktrees = worktreeState(projectRoot, repoTop);
  const trees = listedWorktrees.branches;
  const currentBranch = listedWorktrees.currentBranch ?? (git(projectRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']).stdout.trim() || null);
  let primaryWorktree = listedWorktrees.primary;
  if (listedWorktrees.currentBranch === null && currentBranch !== null) {
    const reportedPath = trees.get(currentBranch);
    if (reportedPath !== undefined && realPath(reportedPath) !== here) {
      trees.set(currentBranch, here);
      if (listedWorktrees.primary === reportedPath) primaryWorktree = here;
    }
  }
  const current = currentBranch === null ? null : idOfBranch(currentBranch);

  const merged = (into: string) => new Set(lines(git(projectRoot, ['branch', '--merged', into, '--format=%(refname)', '--list', 'ticket/*']).stdout)
    .map((refname) => refname.startsWith('refs/heads/') ? refname.slice('refs/heads/'.length) : refname));
  const mergedBase = baseTip === null ? new Set<string>() : merged(baseRef?.refname ?? base);
  const mergedHead = baseBranch !== null && currentBranch === baseBranch ? mergedBase : merged('HEAD');
  const baseTree = baseBranch === null ? null : trees.get(baseBranch) ?? null;
  const baseTreeIsHere = baseTree !== null && realPath(baseTree) === here;

  const live = new Map<string, LiveTicket>();
  const worktrees = new Map<string, string>();
  const tips: { id: string; branch: string; tip: string }[] = [];
  for (const branch of branchNames) {
    const id = idOfBranch(branch);
    const tip = branchTips.get(branch);
    if (!id || !tip) continue;
    const tree = trees.get(branch) ?? null;
    if (tree !== null) worktrees.set(id, tree);
    if (ticketsRel === null || (tree !== null && realPath(tree) === here)) continue;
    if (tree !== null) {
      const file = join(tree, prefix, ticketsRel, `${id}.md`);
      if (existsSync(file)) live.set(id, { branch, worktree: tree, text: readFileSync(file, 'utf8'), tip });
    } else if (!mergedHead.has(branch)) tips.push({ id, branch, tip });
  }
  const blobs = catFiles(projectRoot, tips.map((t) => `${t.tip}:./${ticketsRel ?? ''}/${t.id}.md`));
  tips.forEach((t, i) => {
    const b = blobs[i];
    if (b) live.set(t.id, { branch: t.branch, worktree: null, text: new TextDecoder().decode(b), tip: t.tip });
  });

  if (ticketsRel !== null && baseBranch !== null && baseTip !== null && (!baseTreeIsHere || live.size > 0)) {
    const absorbed = git(projectRoot, ['-c', 'submodule.recurse=false', 'grep', '-l', '--full-name', '-F', 'absorbed', baseTip, '--', `${ticketsRel}/*.md`]);
    const basePathPrefix = `${baseTip}:`;
    const absorbedPaths = absorbed.code === 0
      ? absorbed.stdout.split('\n').filter((line) => line.startsWith(basePathPrefix)).map((line) => line.slice(basePathPrefix.length))
      : [];
    const absorbedIds = absorbedPaths.map((path) => basename(path, '.md'));
    const mergedIds = [...mergedBase].map(idOfBranch).filter((id): id is string =>
      id !== null && branchIds.has(id)
      && (trees.has(ticketBranch(id)) || existsSync(join(here, prefix, ticketsRel, `${id}.md`))),
    );
    const candidateIds = [...new Set([...absorbedIds, ...mergedIds])];
    const baseFiles = catFiles(projectRoot, candidateIds.map((id) => `${baseTip}:./${ticketsRel}/${id}.md`));
    candidateIds.forEach((id, i) => {
      const blob = baseFiles[i];
      if (!blob) return;
      const text = new TextDecoder().decode(blob);
      const path = `${ticketsRel}/${id}.md`;
      const status = parseTicket(path, text).ticket?.data.status;
      if (status !== 'absorbed' && !(status === 'done' && branchIds.has(id) && mergedBase.has(ticketBranch(id)))) return;
      live.delete(id);
      if (baseTreeIsHere) return;
      if (baseTree !== null) {
        const file = join(baseTree, prefix, path);
        if (existsSync(file)) live.set(id, { branch: baseBranch, worktree: baseTree, text: readFileSync(file, 'utf8'), tip: baseTip });
      } else live.set(id, { branch: baseBranch, worktree: null, text, tip: baseTip });
    });
  }

  const ids = (names: Iterable<string>) => new Set([...names].map(idOfBranch).filter((x): x is string => x !== null));
  return { live, worktrees, branches: branchIds, mergedIntoBase: ids(mergedBase), current, repoTop, prefix, primaryWorktree };
}

/**
 * The message with exactly one closing "Spec-Ticket: <id>" trailer line (INS-016/R12): added after
 * a blank line, or left alone when the message already ends in it, as the commit-msg hook leaves it.
 */
export function withTicketTrailer(message: string, id: string): string {
  const body = message.replace(/\s+$/, '');
  const trailer = `Spec-Ticket: ${id}`;
  return body.split('\n').at(-1) === trailer ? `${body}\n` : `${body}\n\n${trailer}\n`;
}

/**
 * Commits one file onto a branch that no worktree has checked out, touching no working tree and
 * no index: a temporary index, `commit-tree`, then a compare-and-swap `update-ref`.
 * `path` is relative to the project root.
 */
export function commitToBranch(projectRoot: string, branch: string, path: string, text: string, message: string, expectedTip?: string): { ok: true } | { ok: false; error: string } {
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'spec-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
  const run = (args: string[], input?: string) => {
    const r = spawnSync('git', args, { cwd: projectRoot, env, encoding: 'utf8', input });
    return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
  };
  try {
    const resolvedTip = expectedTip === undefined ? run(['rev-parse', '--verify', `refs/heads/${branch}`]) : { ok: true, out: expectedTip, err: '' };
    if (!resolvedTip.ok) return { ok: false, error: `no branch ${branch}` };
    const tip = resolvedTip.out;
    const prefix = run(['rev-parse', '--show-prefix']).out;
    const blob = run(['hash-object', '-w', '--stdin'], text);
    const steps = [
      run(['read-tree', tip]),
      blob,
      blob.ok ? run(['update-index', '--add', '--cacheinfo', `100644,${blob.out},${prefix}${path}`]) : blob,
    ];
    const failed = steps.find((s) => !s.ok);
    if (failed) return { ok: false, error: `git could not stage ${path} on ${branch}: ${failed.err}` };
    const tree = run(['write-tree']);
    const messageArgs = message.replace(/\s+$/, '').split(/\n\n+/).flatMap((paragraph) => ['-m', paragraph]);
    const commit = tree.ok ? run(['commit-tree', tree.out, '-p', tip, ...messageArgs]) : tree;
    if (!commit.ok) return { ok: false, error: `git could not commit to ${branch}: ${commit.err}` };
    if (!run(['update-ref', `refs/heads/${branch}`, commit.out, tip]).ok) return { ok: false, error: `${branch} moved while it was being updated; try again` };
    return { ok: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
