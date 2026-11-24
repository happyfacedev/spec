// L035 for `spec lint --base <ref>` and `--ci`: the working tree's spec against the spec at the base's
// tip and at the merge base of HEAD and the base, each read from git and parsed in memory.
import { relative } from 'node:path';
import type { Finding } from '../core/findings';
import { compareIds } from '../core/ids';
import { baseFindings, nextFreeIds, numberCollisions, topLevelCollisions } from '../core/lint/base';
import { parseSpec } from '../core/parse/spec';
import { type UnitIndex, buildIndex } from '../core/units';
import { toPosix } from '../io/fs';
import { branchExists, filesAt, isRepo, mergeBase, resolveCommit } from '../io/git';
import type { Workspace } from '../io/workspace';

/**
 * PIP-007/R10, R11: the problems for each scenario, rule, invariant, decision, feature or screen this
 * tree's branch added that the branch of another ticket in flight (a recorded spec-writer stage, not
 * merged into the base) also added with different text, each side against its own merge base with the
 * base branch.
 */
export function takenNumberProblems(ws: Workspace, ticket: string): string[] {
  const cwd = ws.projectRoot;
  const base = ws.config?.baseBranch ?? 'main';
  if (!isRepo(cwd) || !branchExists(cwd, base)) return [];
  const tip = resolveCommit(cwd, base);
  if (tip === null) return [];
  const myFork = mergeBase(cwd, tip, 'HEAD');
  const dir = toPosix(relative(cwd, ws.specRoot));
  const indexAt = (commit: string | null): UnitIndex => buildIndex(parseSpec((commit === null ? null : filesAt(cwd, commit, dir)) ?? []));
  const mine = buildIndex(ws.spec);
  const mineAtFork = indexAt(myFork);
  const out: string[] = [];
  const others = ws.tickets.tickets
    .filter((t) => t.id !== ticket && ws.ticketGit.branches.has(t.id) && !ws.ticketGit.mergedIntoBase.has(t.id) && t.data.history.some((h) => h.role === 'spec-writer'))
    .sort((a, b) => compareIds(a.id, b.id));
  // PIP-007/R11: each refused top-level ID names the lowest-numbered ticket that took it.
  const topLevel = new Map<string, string>();
  const compared: UnitIndex[] = [indexAt(tip), mine];
  for (const other of others) {
    const branch = `ticket/${other.id}`;
    const theirTip = resolveCommit(cwd, branch);
    if (theirTip === null) continue;
    const theirs = indexAt(theirTip);
    compared.push(theirs);
    const theirFork = indexAt(mergeBase(cwd, tip, theirTip));
    const taken = numberCollisions(mineAtFork, mine, theirFork, theirs);
    for (const t of taken) out.push(`${t.id} is also new on ${branch}, whose spec stage is recorded; take numbers after those ${other.id} added to ${t.feature}, or wait for ${other.id} to merge`);
    for (const id of topLevelCollisions(mineAtFork, mine, theirFork, theirs)) if (!topLevel.has(id)) topLevel.set(id, other.id);
  }
  const next = nextFreeIds([...topLevel.keys()], compared);
  for (const id of [...topLevel.keys()].sort(compareIds)) {
    const ticketId = topLevel.get(id);
    out.push(`${id} is also new on ticket/${ticketId}, whose spec stage is recorded; take ${next.get(id)}, or wait for ${ticketId} to merge`);
  }
  return out;
}

export type BaseComparison = { readonly findings: readonly Finding[] } | { readonly refused: string };

/**
 * `base` is the `--base` value, or null for the configured base branch under `--ci`. Nothing is compared
 * (no findings) when `--ci` runs outside a repository or the base branch does not exist.
 */
export function compareWithBase(ws: Workspace, base: string | null): BaseComparison {
  const cwd = ws.projectRoot;
  let ref: string;
  if (base !== null) {
    ref = base;
  } else {
    ref = ws.config?.baseBranch ?? 'main';
    if (!isRepo(cwd) || !branchExists(cwd, ref)) return { findings: [] };
  }
  const tip = resolveCommit(cwd, ref);
  if (tip === null) return { refused: `--base ${ref} is not a commit in this repository\n` };
  const dir = toPosix(relative(cwd, ws.specRoot));
  const indexAt = (commit: string | null): UnitIndex => {
    const files = commit === null ? null : filesAt(cwd, commit, dir);
    return buildIndex(parseSpec(files ?? []));
  };
  // Without a merge base the two sides share nothing: compared as if the merge base held no units.
  const fork = mergeBase(cwd, tip, 'HEAD');
  return { findings: baseFindings(ref, indexAt(fork), indexAt(tip), buildIndex(ws.spec)) };
}
