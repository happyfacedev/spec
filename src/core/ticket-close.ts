// `spec ticket close <ID> --superseded-by <ID>` (TKT-012/R9, R12): which tickets may be closed, and what the close
// says it kept. Pure: the caller reads the tickets and git, and saves the file.
import type { Ticket } from './model';

/** A blocked stage's stash that the close kept. */
export interface KeptStash {
  name: string;
  /** Its place in `git stash list` when the close ran, such as "stash@{0}". */
  ref: string;
  /** Its stash commit, abbreviated. */
  commit: string;
}

/** What `spec ticket close --format json` prints. */
export interface CloseResult {
  ticket: string;
  absorbedInto: string;
  worktree: string | null;
  branch: string | null;
  tip: string | null;
  unmerged: number;
  stashes: KeptStash[];
  cleanup: string[];
}

/** What the caller read from git about the ticket's file on the base branch. */
export interface CloseFacts {
  readonly base: string;
  /** The ticket's file as committed at the tip of the base branch: null when the base has none, or it does not parse. */
  readonly baseCopy: Ticket | null;
  /** The ticket's file on the base branch has an uncommitted change, staged or not. */
  readonly uncommitted: boolean;
  /** Every ticket in the store, as read from its live copy. */
  readonly tickets: readonly Ticket[];
}

const ONLY = 'only open or blocked tickets are closed';

const running = (t: Ticket): boolean => t.data.status === 'in_progress' || t.data.stage !== null;

/** Every reason this ticket may not be closed as superseded by `by`, one line each (TKT-012/R9); empty when it may. */
export function closeProblems(ticket: Ticket, by: Ticket, facts: CloseFacts): string[] {
  const problems: string[] = [];
  const id = ticket.id;
  let refused = false;
  if (running(ticket)) {
    problems.push(`${id} has its ${ticket.data.stage ?? 'current'} stage running: ${ONLY}`);
    refused = true;
  } else if (ticket.data.status === 'done' || ticket.data.status === 'absorbed') {
    problems.push(`${id} is ${ticket.data.status}: ${ONLY}`);
    refused = true;
  }
  for (const a of facts.tickets) {
    if (a.data.status === 'absorbed' && a.data.absorbed_into === id) problems.push(`${id} has absorbed ${a.id}: only a ticket nothing was absorbed into is closed`);
  }
  if (facts.uncommitted) {
    problems.push(`${ticket.file} has uncommitted changes: ask the person whether to open a bypass with spec bypass, commit that file with its ADR, then close ${id}; an approved agent must use --approved-by-person`);
  } else if (!refused) {
    // The live copy may be open while the copy the close rewrites is not.
    const base = facts.baseCopy;
    if (base === null) problems.push(`${id} has no valid file on ${facts.base}: ${ONLY}`);
    else if (base.data.status !== 'open' && base.data.status !== 'blocked') problems.push(`${id} is ${base.data.status.replace('_', ' ')} on ${facts.base}: ${ONLY}`);
    else if (base.data.stage !== null) problems.push(`${id} has its ${base.data.stage} stage running on ${facts.base}: ${ONLY}`);
  }
  if (by.id === id) problems.push(`${id} cannot be superseded by itself`);
  else if (by.data.status === 'absorbed') {
    const into = by.data.absorbed_into ?? '?';
    problems.push(`${by.id} is absorbed into ${into}: close ${id} as superseded by ${into} instead`);
  }
  return problems;
}

/** The text output: the first line, then one line for each of the worktree, branch and stashes that were kept (TKT-012/R12). */
export function renderClose(result: CloseResult, base: string, recorded: number): string {
  const id = result.ticket;
  const lines = [`${id} absorbed into ${result.absorbedInto} (closed; nothing was removed)`];
  if (result.worktree !== null) lines.push(`kept worktree ${result.worktree}: spec worktree remove ${id} removes it`);
  if (result.branch !== null) {
    const advice = result.unmerged > 0
      ? `with ${String(result.unmerged)} commits not on ${base} and the ${String(recorded)} recorded stages of ${id}: git branch -D ${result.branch} discards them`
      : `every commit on it on ${base}: git branch -d ${result.branch} removes it`;
    lines.push(`kept branch ${result.branch} at ${result.tip ?? '?'}, ${advice}`);
  }
  for (const s of result.stashes) {
    lines.push(`kept stash "${s.name}" at ${s.ref} (${s.commit}): when git rev-parse --short ${s.ref} still prints ${s.commit}, git stash drop ${s.ref} discards it`);
  }
  return `${lines.join('\n')}\n`;
}

/** The commands a person may run to remove what was kept, in the order the text prints them (TKT-012/R12). */
export function closeCleanup(result: Omit<CloseResult, 'cleanup'>): string[] {
  const cleanup: string[] = [];
  if (result.worktree !== null) cleanup.push(`spec worktree remove ${result.ticket}`);
  if (result.branch !== null) cleanup.push(`git branch ${result.unmerged > 0 ? '-D' : '-d'} ${result.branch}`);
  for (const s of result.stashes) cleanup.push(`git stash drop ${s.ref}`);
  return cleanup;
}
