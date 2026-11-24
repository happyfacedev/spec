// spec merge: merge one done ticket when the merged result still passes tests and lint.
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { matchesGlob } from '../core/glob';
import { PATTERNS } from '../core/ids';
import { lintSpec } from '../core/lint';
import { countErrors, unreadableEntryFindings } from '../core/findings';
import { toPosix } from '../io/fs';
import { changedPaths, currentBranch, dirtyPaths, git, ignoresCase, isRepo } from '../io/git';
import { lockPath, waitForLock } from '../io/lock';
import { ticketBranch, ticketGitState } from '../io/ticket-git';
import { clearSetupFailed } from '../io/ticket-state';
import { runTestCommandWithTurn, testRunLocation, testRunTicket } from '../io/test-run-turn';
import { type Workspace, loadWorkspace, reloadWorkspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { conflictedPaths, isGenerated, mergedWorkspace, projectGlobs, rebuildGenerated, specGenerated } from './generated';
import { type Out, json, ok, usageError } from './output';
import { SETUP_LOCK_WAIT_MS, busyMessage } from './worktree';
import { commitWithToken } from './enforcement';

export type MergeResult = { ok: true; ticket: string; commit: string; rebuilt: boolean; worktreeBusy?: string; worktreeKept?: string; afterMergeError?: string } | { ok: false; ticket: string; error: string };

/** How long a merge waits for another merge in this repository to finish. */
const MERGE_LOCK_WAIT_MS = 30 * 60 * 1000;

/**
 * Merges one done ticket into the base branch, which must be checked out and clean here. One merge
 * at a time per repository (WSP-006/R7): a second waits for the first, then sees its result.
 */
export async function mergeTicket(ws: Workspace, id: string, write?: (text: string) => void): Promise<MergeResult> {
  const root = ws.projectRoot;
  if (!isRepo(root)) return { ok: false, ticket: id, error: `${root} is not a git repository` };
  const path = lockPath(root, 'merge.lock');
  if (path === null) return { ok: false, ticket: id, error: `${root} is not a git repository` };
  const lock = await waitForLock(path, MERGE_LOCK_WAIT_MS);
  if (!lock.ok) return { ok: false, ticket: id, error: `another merge (pid ${String(lock.holder ?? '?')}) holds ${path}; try again once it ends` };
  try {
    // Read again under the lock: a merge that held it may have moved the base branch.
    return await mergeLocked(await reloadWorkspace(ws), id, write);
  } finally {
    lock.release();
  }
}

/**
 * Removes a merged ticket's worktree and `.failed` marker, under the ticket's lock. Called with the
 * merge lock held (WSP-006/R8, WSP-007/R1). `removed` is the tree's path when it was removed; `busy`
 * is the lock holder's message when the lock stayed held.
 */
async function removeMergedWorktree(root: string, id: string, base: string): Promise<{ removed?: string; busy?: string; kept?: string }> {
  const lockFile = lockPath(root, `worktree-${id}.lock`);
  const ticketLock = lockFile === null ? null : await waitForLock(lockFile, SETUP_LOCK_WAIT_MS);
  if (ticketLock !== null && !ticketLock.ok) return { busy: busyMessage(id, ticketLock.holder) };
  try {
    // Read under the lock: an add that held it may have made or changed the tree.
    const tree = ticketGitState(root, null, base).worktrees.get(id);
    if (tree === undefined) {
      // A removal that died after git took the tree away leaves its marker; the .txt record stays.
      clearSetupFailed(root, id);
      return {};
    }
    const removal = git(root, ['worktree', 'remove', tree]);
    if (removal.code === 0) {
      clearSetupFailed(root, id);
      return { removed: tree };
    }
    // Git kept the tree (and so its setup state): say why (WSP-006/R8).
    const dirty = changedPaths(tree);
    if (dirty.length > 0) return { kept: `${tree} has uncommitted changes: ${dirty.slice(0, 5).join(', ')}` };
    return { kept: `git could not remove ${tree}: ${(removal.stderr.trim() || removal.stdout.trim()).split('\n')[0] ?? ''}` };
  } finally {
    if (ticketLock?.ok) ticketLock.release();
  }
}

/** `p` and every folder above it, as git writes them. */
function withFolders(p: string): string[] {
  const parts = p.split('/');
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

/**
 * The untracked files that sit where a file the branch adds goes, or in a folder that file would
 * replace, or at a path the branch needs as a folder (WSP-007/R4). Paths compare through `fold`.
 */
function collidingWithAdded(untracked: readonly string[], added: readonly string[], fold: (p: string) => string): string[] {
  if (added.length === 0) return [];
  const files = new Set(added.map(fold));
  const folders = new Set(added.flatMap((p) => withFolders(fold(p)).slice(0, -1)));
  return untracked.filter((u) => {
    const parts = withFolders(fold(u));
    return folders.has(parts[parts.length - 1] ?? '') || parts.some((x) => files.has(x));
  });
}

/**
 * The untracked files at a generated path the merge or afterMerge rebuilds, or in a folder at such
 * a path (WSP-007/R4): the spec root's index.md, the pinned `.spec/bin/` CLI, and every path the
 * project's `generated` globs (or an old `generatedGlobs`) match.
 */
function collidingWithGenerated(ws: Workspace, untracked: readonly string[], fold: (p: string) => string): string[] {
  const specRel = toPosix(relative(ws.projectRoot, ws.specRoot));
  const index = fold(specRel === '' ? 'index.md' : `${specRel}/index.md`);
  const bin = fold('.spec/bin/');
  const globs = projectGlobs(ws).map(fold);
  const hit = (p: string) => p === index || p.startsWith(bin) || globs.some((g) => matchesGlob(p, g));
  return untracked.filter((u) => withFolders(fold(u)).some(hit));
}

/** What git says it would overwrite when it refuses to merge over untracked files, else none. */
function overwrittenByMerge(out: { stdout: string; stderr: string }): string[] {
  const lines = `${out.stderr}\n${out.stdout}`.split('\n');
  const at = lines.findIndex((l) => l.includes('untracked working tree files would be overwritten by merge'));
  if (at < 0) return [];
  const names: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (!l.startsWith('\t')) break;
    names.push(l.trim());
  }
  return names;
}

/** `<base> has uncommitted changes: <the first five of paths, sorted>` (workspace.BaseBranchDirty). */
const dirtyMessage = (base: string, paths: readonly string[]): string => `${base} has uncommitted changes: ${[...paths].sort().slice(0, 5).join(', ')}`;

async function mergeLocked(ws: Workspace, id: string, write?: (text: string) => void): Promise<MergeResult> {
  const no = (error: string): MergeResult => ({ ok: false, ticket: id, error });
  const root = ws.projectRoot;
  const base = ws.config?.baseBranch ?? 'main';
  // WSP-007/R3: INV-002 needs a test run on the merged result; without a command nothing merges.
  if (!ws.config) return no('config.json has no testCommand to run on the merged result');
  const testCommand = ws.config.testCommand;
  if (currentBranch(root) !== base) return no(`merging happens on ${base}; this tree has ${currentBranch(root) ?? 'no branch'} checked out`);
  const branch = ticketBranch(id);
  const branchExists = git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).code === 0;
  // WSP-007/R4: tracked changes always refuse; an untracked file only where the merge would write one.
  const fold = ignoresCase(root) ? (p: string) => p.toLowerCase() : (p: string) => p;
  const dirty = dirtyPaths(root);
  const added = branchExists ? git(root, ['diff', '-z', '--name-only', '--diff-filter=A', '--no-renames', `HEAD...${branch}`]).stdout.split('\0').filter((p) => p !== '') : [];
  const blocking = [...new Set([...collidingWithAdded(dirty.untracked, added, fold), ...collidingWithGenerated(ws, dirty.untracked, fold)])];
  if (dirty.tracked.length + blocking.length > 0) return no(dirtyMessage(base, [...dirty.tracked, ...blocking]));
  // Untracked files from before the merge stay out of every commit it makes (WSP-007/S24).
  const untrackedBefore = new Set(dirty.untracked);
  const t = ws.tickets.tickets.find((x) => x.id === id);
  if (!t) return no(`unknown ticket ${id}`);
  if (t.data.status !== 'done') return no(`${id} is ${t.data.status.replace('_', ' ')}, not done`);
  if (!branchExists) return no(`${branch} does not exist`);
  // Read from the repository's own branches: ws.ticketGit is empty when tickets live outside it (WSP-007/S18).
  if (ticketGitState(root, null, base).mergedIntoBase.has(id)) {
    const left = await removeMergedWorktree(root, id, base);
    const tail = left.removed !== undefined ? `; removed its worktree ${left.removed}` : left.busy !== undefined ? `; its worktree was not removed: ${left.busy}` : '';
    return no(`${branch} is already merged into ${base}${tail}`);
  }

  const before = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  // The commit this merge made, once it made one. Undo moves the base branch back only while it
  // still stands where this merge left it (WSP-006/R7): a commit anyone else made on top stays.
  let made: string | null = null;
  const undo = (why: string) => {
    const headNow = git(root, ['rev-parse', 'HEAD']).stdout.trim();
    // Left as it is, the base branch holds the merge: the branch is no longer "unmerged".
    const left = why.replace(`; ${branch} stays unmerged`, '');
    if (headNow !== (made ?? before)) {
      git(root, ['merge', '--abort']);
      return no(`${left}; ${base} moved to ${headNow.slice(0, 7)} during the merge, so spec left it as it is: undo the merge of ${branch} by hand`);
    }
    git(root, ['merge', '--abort']);
    // --keep, never --hard: a change someone made in this checkout while the tests ran survives,
    // and git refuses rather than overwrite one in a file the merge changed (WSP-006/R1).
    if (git(root, ['reset', '-q', '--keep', before]).code !== 0) {
      const touched = new Set(git(root, ['diff', '--name-only', '--no-renames', before, 'HEAD']).stdout.split('\n').filter((p) => p !== ''));
      const dirty = changedPaths(root);
      const files = dirty.filter((p) => touched.has(p));
      return no(`${left}; spec could not move ${base} back to ${before.slice(0, 7)} without overwriting uncommitted changes in ${(files.length > 0 ? files : dirty).join(', ')}, so it left ${base} as it is: undo the merge of ${branch} by hand`);
    }
    return no(why);
  };
  let rebuilt = false;
  // LC_ALL=C: git's refusal to merge over untracked files is read below, in its own words.
  const m = git(root, ['merge', '--no-ff', '--no-commit', '-q', branch], { LC_ALL: 'C' });
  let conflicted: string[] = [];
  // The workspace with the merged config: the incoming side's `generated` counts (WSP-009/R1).
  let eff = ws;
  if (m.code !== 0) {
    // WSP-007/S26: a file made where the branch adds one; git changed nothing and names the paths.
    const overwritten = overwrittenByMerge(m);
    if (overwritten.length > 0) return undo(dirtyMessage(base, overwritten));
    // Generated files are rebuilt, never merged by hand; any other conflict needs a person.
    conflicted = conflictedPaths(root);
    eff = await mergedWorkspace(ws, root);
    const other = conflicted.filter((p) => !isGenerated(eff, p));
    if (conflicted.length === 0 || other.length > 0) return undo(`merging ${branch} conflicts in ${other.join(', ') || 'the tree'}; a person must merge it`);
    rebuilt = true;
  }
  // WSP-007/S27: a file made at a generated path since the first check is never rebuilt over.
  const generatedHits = (w: Workspace): string | null => {
    const hits = collidingWithGenerated(w, dirtyPaths(root).untracked, fold);
    return hits.length > 0 ? dirtyMessage(base, hits) : null;
  };
  const beforeRebuild = generatedHits(m.code === 0 ? await mergedWorkspace(ws, root) : eff);
  if (beforeRebuild !== null) return undo(beforeRebuild);
  // WSP-006/R4: generated index files are rebuilt from the merged source, never merged as text.
  // The bundled CLI is the project's afterMerge's to rebuild.
  const gen = await rebuildGenerated(eff, root, conflicted);
  if (!gen.ok) return undo(gen.error);
  // One path at a time: git refuses the whole add over a path that is missing or ignored.
  for (const p of specGenerated(ws)) if (existsSync(join(root, p))) git(root, ['add', '-A', '--', p]);
  if (commitWithToken(ws, { kind: 'merge', ticket: id }, ['commit', '-q', '-m', `Merge ${branch}: ${t.data.title}\n\nSpec-Ticket: ${id}`]).code !== 0) return undo('git could not commit the merge');
  made = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  // The merged result must hold: lint clean, every test green.
  const merged = await loadWorkspace(ws.specRoot, null, root);
  const lint = lintSpec(merged.spec, { tickets: merged.tickets, budgets: merged.config?.budgets ?? {} });
  if (countErrors([...lint, ...unreadableEntryFindings(merged.unreadable)]) > 0) return undo(`after merging ${branch} the spec has lint errors; ${branch} stays unmerged`);
  {
    const turn = {
      command: 'spec merge' as const,
      maxTestRuns: merged.config?.maxTestRuns ?? 1,
      ticket: testRunTicket(merged.ticketGit.current),
      location: testRunLocation(root, merged.ticketGit.current),
      ...(write ? { stderr: write } : {}),
    };
    const execute = async () => (await runTestCommandWithTurn(root, testCommand, '', turn)).run;
    let run = await execute();
    const failedOf = (r: typeof run) => r.tests.filter((x) => x.status === 'failed');
    if (run.error !== null || run.exitCode !== 0 || failedOf(run).length > 0) {
      // WSP-006/R5: once more, so a test that passes the second time is named flaky; refused all the same.
      const first = run;
      run = await execute();
      const passedAgain = (name: string) => run.tests.some((x) => x.name === name && x.status === 'passed');
      const flaky = ' (flaky: failed, then passed on the rerun)';
      const names = failedOf(first).slice(0, 3).map((x) => `${x.name}${passedAgain(x.name) ? flaky : ''}`);
      const rerunPassed = run.error === null && run.exitCode === 0 && failedOf(run).length === 0;
      const detail = names.join('; ') || first.error || `exit ${String(first.exitCode)}${rerunPassed ? flaky : ''}`;
      return undo(`after merging ${branch} tests fail (${detail}); ${branch} stays unmerged`);
    }
  }
  // WSP-007/S27: checked before the worktree goes, so a refusal still undoes the merge completely.
  if (ws.config.afterMerge !== undefined) {
    const beforeAfterMerge = generatedHits(merged);
    if (beforeAfterMerge !== null) return undo(beforeAfterMerge);
  }
  // Its worktree is no longer needed; git keeps it if anything there is uncommitted. WSP-006/R8: the
  // ticket's lock is taken only while the merge lock is held, and released first, so an add or a
  // remove (which never take the merge lock) cannot deadlock with this.
  const left = await removeMergedWorktree(root, id, base);
  const worktreeBusy = left.busy;
  const worktreeKept = left.kept;
  // WSP-006/R6: afterMerge runs once; the ticket stays merged whether it succeeds or fails.
  let afterMergeError: string | undefined;
  if (ws.config.afterMerge !== undefined) {
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const r = spawnSync('/bin/sh', ['-c', ws.config.afterMerge], { cwd: root, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) {
      const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => l.trim() !== '');
      afterMergeError = `afterMerge failed: ${lines.slice(-3).join(' | ') || r.error?.message || `exit ${String(r.status)}`}`;
    }
    // WSP-007/S24: what afterMerge changed, never an untracked file that was there before the merge.
    const now = dirtyPaths(root);
    const changes = [...now.tracked, ...now.untracked.filter((p) => !untrackedBefore.has(p))];
    if (changes.length > 0) {
      git(root, ['--literal-pathspecs', 'add', '-A', '--', ...changes]);
      const committed = commitWithToken(await loadWorkspace(ws.specRoot, null, root), { kind: 'afterMerge', ticket: id }, ['commit', '-q', '-m', `${id}: after merge\n\nSpec-Ticket: ${id}`]);
      if (committed.code !== 0) {
        const detail = (committed.stderr.trim() || committed.stdout.trim()).split('\n').slice(0, 2).join(' ');
        afterMergeError = afterMergeError ?? `afterMerge commit failed: ${detail || 'git could not commit the changes'}`;
      }
    }
  }
  return {
    ok: true,
    ticket: id,
    commit: git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim(),
    rebuilt,
    ...(worktreeBusy !== undefined ? { worktreeBusy } : {}),
    ...(worktreeKept !== undefined ? { worktreeKept } : {}),
    ...(afterMergeError !== undefined ? { afterMergeError } : {}),
  };
}

export async function cmdMerge(ws: Workspace, args: Args, write?: (text: string) => void): Promise<Out> {
  const ids = args.positionals;
  if (ids.length === 0) return usageError('usage: spec merge <TICKET>...', USAGE);
  // WSP-007/R2: every argument is checked before anything merges.
  for (const id of ids) if (!PATTERNS.ticket.test(id)) return usageError(`Unknown ${id}.`, USAGE);
  const results: MergeResult[] = [];
  let notices = '';
  const emit = (text: string) => {
    if (write) write(text);
    else notices += text;
  };
  let current = ws;
  for (const id of ids) {
    results.push(await mergeTicket(current, id, emit));
    current = await loadWorkspace(ws.specRoot, null, ws.projectRoot);
  }
  const code = results.every((r) => r.ok && r.afterMergeError === undefined) ? 0 : 1;
  const out = args.format === 'json'
    ? json(results, code)
    : ok(`${results.map((r) => (r.ok ? `${r.ticket}: merged (${r.commit}${r.rebuilt ? ', generated files rebuilt' : ''})${r.worktreeBusy !== undefined ? `, but its worktree was not removed: ${r.worktreeBusy}` : ''}${r.worktreeKept !== undefined ? `, but its worktree was kept: ${r.worktreeKept}` : ''}${r.afterMergeError !== undefined ? `, but ${r.afterMergeError}` : ''}` : `${r.ticket}: not merged, ${r.error}`)).join('\n')}\n`, code);
  return notices === '' ? out : { ...out, stderr: `${notices}${out.stderr}` };
}
