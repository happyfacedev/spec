// spec worktree add|remove|list: one ticket's own git worktree on its own branch.
import { cpSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { PATTERNS } from '../core/ids';
import { realPath } from '../io/fs';
import { branchExists, git, isRepo } from '../io/git';
import { lockPath, waitForLockSync } from '../io/lock';
import { ticketBranch, ticketGitState } from '../io/ticket-git';
import { markSetupFailed, setupFailed, clearSetupFailed, clearSetupState, saveSetupPaths } from '../io/ticket-state';
import { type Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { type Out, json, ok, usageError } from './output';

const fail = (message: string): Out => ({ stdout: '', stderr: `${message}\n`, code: 1 });

interface Repo {
  readonly top: string;
  /** The project root's path inside the repository, e.g. `apps/chat/` or empty. */
  readonly prefix: string;
}

function repoOf(ws: Workspace): Repo | null {
  if (ws.ticketGit.repoTop !== null) return { top: ws.ticketGit.repoTop, prefix: ws.ticketGit.prefix };
  if (!isRepo(ws.projectRoot)) return null;
  return { top: git(ws.projectRoot, ['rev-parse', '--show-toplevel']).stdout.trim(), prefix: git(ws.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim() };
}

/** Where a ticket's worktree goes: config `worktrees`, else `<repo>.worktrees/` beside the repository. */
export function worktreeDir(ws: Workspace, repo: Repo, id: string): string {
  const parent = ws.config?.worktrees ? resolve(ws.projectRoot, ws.config.worktrees) : join(dirname(repo.top), `${basename(repo.top)}.worktrees`);
  return join(parent, id);
}

export type WorktreeResult = { ok: true; path: string; project: string; created: boolean; reran?: true } | { ok: false; error: string };

/** The ticket's worktree, made if needed: its branch from the base, the CLI bundle, the setup command. */
export function addWorktree(ws: Workspace, id: string): WorktreeResult {
  const repo = repoOf(ws);
  if (!repo) return { ok: false, error: `${ws.projectRoot} is not a git repository` };
  // One add per ticket at a time: the retry state is read, setup runs and the state moves under it.
  const path = lockPath(ws.projectRoot, `worktree-${id}.lock`);
  const lock = path === null ? null : waitForLockSync(path, SETUP_LOCK_WAIT_MS);
  if (lock !== null && !lock.ok) return { ok: false, error: busyMessage(id, lock.holder) };
  try {
    return addLocked(ws, repo, id);
  } finally {
    if (lock?.ok) lock.release();
  }
}

/** How long an add waits for another add of the same ticket: long enough for a real worktreeSetup. */
export const SETUP_LOCK_WAIT_MS = 15 * 60_000;

/** What an add or a remove prints when the ticket's lock stays held past the wait. */
export const busyMessage = (id: string, holder: number | null): string => `another spec worktree add for ${id} is still running${holder === null ? '' : ` (pid ${String(holder)})`}`;

function addLocked(ws: Workspace, repo: Repo, id: string): WorktreeResult {
  // Read after the lock is taken: an add that waited sees what the one before it left.
  const existing = ticketGitState(ws.projectRoot, ws.ticketsInRepo ? ws.ticketsRel : null, ws.config?.baseBranch ?? 'main').worktrees.get(id);
  // Only the checkout whose setup failed runs it again; any other checkout, the primary tree included, is left as it is.
  if (existing !== undefined && !setupFailed(ws.projectRoot, id, existing)) return { ok: true, path: existing, project: join(existing, repo.prefix), created: false };
  const created = existing === undefined;
  const reran = !created;
  const path = existing ?? worktreeDir(ws, repo, id);
  if (existing === undefined) {

    const branch = ticketBranch(id);
    const base = ws.config?.baseBranch ?? 'main';
    const r = branchExists(ws.projectRoot, branch) ? git(ws.projectRoot, ['worktree', 'add', '-q', path, branch]) : git(ws.projectRoot, ['worktree', 'add', '-q', '-b', branch, path, base]);
    if (r.code !== 0) return { ok: false, error: `git could not add a worktree for ${id}: ${r.stderr.trim()}` };
    // A genuinely new checkout starts with no record or failure from an earlier one.
    clearSetupState(ws.projectRoot, id, true);
  }
  const project = join(path, repo.prefix);
  // A git-ignored pinned CLI is copied into the checkout; committed copies arrive with the branch.
  const pinned = '.spec/bin';
  const pinnedFiles = ['spec', 'spec.cjs'];
  const untrackedPinned = pinnedFiles.some((file) => git(ws.projectRoot, ['ls-files', '--error-unmatch', `${pinned}/${file}`]).code !== 0);
  if (existsSync(join(ws.projectRoot, pinned)) && !existsSync(join(project, pinned)) && untrackedPinned) {
    cpSync(join(ws.projectRoot, pinned), join(project, pinned), { recursive: true });
  }
  // Legacy projects still get their old skill CLI in new worktrees.
  if (ws.spec.skillName) {
    const scripts = `.claude/skills/${ws.spec.skillName}/scripts`;
    if (existsSync(join(ws.projectRoot, scripts)) && !existsSync(join(project, scripts))) cpSync(join(ws.projectRoot, scripts), join(project, scripts), { recursive: true });
  }
  if (ws.config?.worktreeSetup) {
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const s = spawnSync('/bin/sh', ['-c', ws.config.worktreeSetup], { cwd: project, encoding: 'utf8', env: { ...process.env, SPEC_MAIN_ROOT: ws.projectRoot, SPEC_TICKET: id } });
    if (s.status !== 0) {
      markSetupFailed(ws.projectRoot, id, path);
      return { ok: false, error: `worktreeSetup failed in ${project}: ${`${s.stderr}${s.stdout}`.trim().split('\n').slice(-3).join(' | ')}` };
    }
  }
  // Whatever the tree holds untracked now was made by setup, not by any stage (PIP-005).
  saveSetupPaths(path, id);
  clearSetupFailed(ws.projectRoot, id);
  return { ok: true, path, project, created, ...(created || !reran ? {} : { reran: true }) };
}

/** Ticket ID → worktree, freshly read when routing to a live ticket checkout. */
function ticketWorktrees(ws: Workspace): ReadonlyMap<string, string> {
  return ticketGitState(ws.projectRoot, null, ws.config?.baseBranch ?? 'main').worktrees;
}

/** The project folder of this ticket's worktree, whether it exists yet or not. */
export function worktreeProjectPath(ws: Workspace, id: string, worktrees?: ReadonlyMap<string, string>): string {
  const repo = repoOf(ws);
  if (!repo) return ws.projectRoot;
  const available = worktrees ?? (ws.store.dirRel === null || ws.ticketsInRepo ? ws.ticketGit.worktrees : ticketWorktrees(ws));
  return join(available.get(id) ?? worktreeDir(ws, repo, id), repo.prefix);
}

export function cmdWorktree(ws: Workspace, args: Args): Out {
  const [sub, id] = args.positionals;
  if (sub === 'list') {
    const base = ws.config?.baseBranch ?? 'main';
    // Reuse the command's workspace snapshot unless ticket files are outside the repository.
    const state = ws.store.dirRel === null || ws.ticketsInRepo ? ws.ticketGit : ticketGitState(ws.projectRoot, null, base);
    const rows = [...state.worktrees].map(([t, path]) => {
      const status = ws.tickets.tickets.find((x) => x.id === t)?.data.status ?? null;
      return { ticket: t, path, status, ...(status === 'done' && state.mergedIntoBase.has(t) ? { merged: true } : {}) };
    });
    if (args.format === 'json') return json(rows);
    const line = (r: (typeof rows)[number]) => `${r.ticket} ${r.status ?? '?'} ${r.path}${'merged' in r ? ` (merged into ${base}; spec worktree remove ${r.ticket} removes it)` : ''}`;
    return ok(rows.length === 0 ? 'no ticket worktrees\n' : `${rows.map(line).join('\n')}\n`);
  }
  if ((sub !== 'add' && sub !== 'remove') || !id || !PATTERNS.ticket.test(id)) return usageError('usage: spec worktree add <TICKET> | remove <TICKET> | list', USAGE);
  if (sub === 'add') {
    if (!ws.tickets.tickets.some((t) => t.id === id)) return usageError(`Unknown ${id}.`, USAGE);
    const w = addWorktree(ws, id);
    if (!w.ok) return fail(w.error);
    if (args.format === 'json') return json({ ok: w.ok, path: w.path, project: w.project, created: w.created });
    return ok(`${id}: ${w.created ? 'created' : w.reran ? 'set up' : 'already at'} ${w.project} on ${ticketBranch(id)}\n`);
  }
  // The lock an add holds (WSP-002/R2): a remove never clears the retry state under an add. Only
  // this command takes it, and so does `spec merge` while it removes a merged ticket's tree (WSP-006/R8).
  const lockFile = lockPath(ws.projectRoot, `worktree-${id}.lock`);
  const lock = lockFile === null ? null : waitForLockSync(lockFile, SETUP_LOCK_WAIT_MS);
  if (lock !== null && !lock.ok) return fail(busyMessage(id, lock.holder));
  try {
    return removeLocked(ws, id);
  } finally {
    if (lock?.ok) lock.release();
  }
}

function removeLocked(ws: Workspace, id: string): Out {
  // Read after the lock is taken: an add that held it may have changed the tree.
  const path = ticketWorktrees(ws).get(id);
  if (path === undefined) {
    clearSetupFailed(ws.projectRoot, id);
    return fail(`${id} has no worktree`);
  }
  if (realPath(path) === realPath(git(ws.projectRoot, ['rev-parse', '--show-toplevel']).stdout.trim())) return fail(`${id}'s worktree is this one; run remove from another tree`);
  // git refuses to remove a worktree with uncommitted changes: nothing is ever lost here.
  const r = git(ws.projectRoot, ['worktree', 'remove', path]);
  if (r.code !== 0) return fail(`git could not remove ${path}: ${r.stderr.trim()}`);
  clearSetupState(ws.projectRoot, id, false);
  return ok(`${id}: removed ${path}; ${ticketBranch(id)} is kept\n`);
}
