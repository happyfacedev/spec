// gate, queue, plan and ticket start/answer: the commands that decide whether work may begin.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withBlocker } from '../core/advance';
import { type Dependencies, type GateResult, dependencies, gateTicket, renderGate } from '../core/gate';
import { PATTERNS, closestId } from '../core/ids';
import { PIPELINES, laneOf, nextStage, pipelineOf } from '../core/pipeline';
import { buildPlan, conflict, footprint, renderPlan } from '../core/plan';
import { buildQueue, renderQueue } from '../core/queue';
import { parseTicket } from '../core/parse/tickets';
import { type CloseResult, type KeptStash, closeCleanup, closeProblems, renderClose } from '../core/ticket-close';
import { combineProblems, planCombine, renderCombine } from '../core/ticket-combine';
import { NewTicketInput, nextTicketId, renderNewTicket } from '../core/ticket-new';
import type { Ticket } from '../core/model';
import { type HistoryEntry, ROLES, type Role } from '../core/schemas';
import { type TicketPatch, patchTicketText } from '../core/ticket-edit';
import { buildIndex } from '../core/units';
import { realPath } from '../io/fs';
import { branchExists, currentBranch, git, isRepo } from '../io/git';
import { lockPath, tryLock, waitForLock } from '../io/lock';
import { blockedStashName, hasStash, restoreStash, stageChanges, stashStage } from '../io/stash';
import { ticketBranch, withTicketTrailer, worktreeBranches } from '../io/ticket-git';
import { clearReportRefusals, clearSavedReport } from '../io/report-store';
import { loadStageStart, saveStageStart } from '../io/ticket-state';
import { type Workspace, reloadWorkspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { conflictedPaths, isGenerated, mergedWorkspace, projectGlobs, rebuildAfterStash, rebuildGenerated, specGenerated } from './generated';
import { type Out, json, ok, usageError } from './output';
import { commitWithToken } from './enforcement';

const fail = (message: string): Out => ({ stdout: '', stderr: `${message}\n`, code: 1 });

export function unknownTicket(ws: Workspace, id: string): Out {
  const near = closestId(id, ws.tickets.tickets.map((t) => t.id));
  return usageError(`Unknown ${id}.${near ? ` Did you mean ${near}?` : ''}`, USAGE);
}

/** Other tickets' status and whether their work is merged into the base branch. */
export const depsOf = (ws: Workspace): Dependencies => dependencies(ws.tickets.tickets, ws.ticketGit.branches, ws.ticketGit.mergedIntoBase);

/** The gate for one ticket ID, or null when the store has no such ticket file. */
export function gateFor(ws: Workspace, id: string, spec: Workspace['spec'] = ws.spec): { gate: GateResult; file: string } | null {
  const ticket = ws.tickets.tickets.find((t) => t.id === id) ?? null;
  const file = ticket?.file ?? `${ws.ticketsRel}/${id}.md`;
  const fileFindings = ws.tickets.findings.filter((f) => f.file === file);
  if (!ticket && fileFindings.length === 0) return null;
  return { gate: gateTicket(spec, buildIndex(spec), id, ticket, fileFindings, depsOf(ws)), file };
}

export function cmdGate(ws: Workspace, args: Args): Out {
  const id = args.positionals[0];
  if (!id || args.positionals.length > 1) return usageError('usage: spec gate <TICKET>', USAGE);
  if (!PATTERNS.ticket.test(id)) return unknownTicket(ws, id);
  const r = gateFor(ws, id);
  if (!r) return unknownTicket(ws, id);
  const code = r.gate.ready ? 0 : 1;
  return args.format === 'json' ? json(r.gate, code) : ok(renderGate(r.gate, r.file), code);
}

export function cmdQueue(ws: Workspace, args: Args): Out {
  if (args.positionals.length > 0) return usageError('usage: spec queue', USAGE);
  const q = buildQueue(ws.spec, buildIndex(ws.spec), ws.tickets, depsOf(ws));
  return args.format === 'json' ? json(q) : ok(renderQueue(q));
}

/** spec plan [<TICKET>...]: which tickets can run in parallel now, and what waits for what. */
export function cmdPlan(ws: Workspace, args: Args): Out {
  for (const id of args.positionals) if (!PATTERNS.ticket.test(id)) return unknownTicket(ws, id);
  const p = buildPlan(ws.spec, buildIndex(ws.spec), ws.tickets, depsOf(ws), args.positionals.length > 0 ? args.positionals : null);
  return args.format === 'json' ? json(p) : ok(renderPlan(p));
}

const TICKET_USAGE = 'usage: spec ticket new < ticket.json | spec ticket start <TICKET> <role> | spec ticket advance <TICKET> [--report-file <path>|--report -] | spec ticket answer <TICKET> <Q> <answer> | spec ticket combine <INTO> <FROM>... | spec ticket close <TICKET> --superseded-by <ID>';
const CLOSE_USAGE = 'usage: spec ticket close <TICKET> --superseded-by <ID>';

export async function cmdTicket(ws: Workspace, args: Args, stdin = '', cwd = ws.projectRoot, now: () => string = () => new Date().toISOString()): Promise<Out> {
  const [sub, id] = args.positionals;
  if (sub === 'answer') return ticketAnswer(ws, args, now);
  if (sub === 'new') return ticketNew(ws, args, stdin, cwd);
  if (sub === 'combine') return ticketCombine(ws, args);
  if (sub === 'close') return ticketClose(ws, args);
  const role = args.positionals[2];
  if (sub !== 'start' || !id || !role || args.positionals.length > 3) return usageError(TICKET_USAGE, USAGE);
  if (!PATTERNS.ticket.test(id)) return unknownTicket(ws, id);
  if (!(ROLES as readonly string[]).includes(role)) return usageError(`Unknown role ${role}. Roles: ${ROLES.join(', ')}`, USAGE);
  return ticketStart(ws, id, role as Role, args, now);
}

/** `synced`: the start merged the base branch into the ticket's branch first (PIP-002/R6). `warning`: what the start says on stderr though it succeeded (WSP-009/R6). */
export type StartResult = { ok: true; branch: string; created: boolean; base: string; synced: boolean; warning?: string } | { ok: false; error: string };

/** How long a start waits for another start of the same ticket to finish. */
const START_LOCK_WAIT_MS = 60_000;

/**
 * The gate again, the stage order, the guards for parallel work, then branch ticket/<ID> synced
 * with the base branch, the stage's own stash, and the ticket's status and stage.
 */
export async function startTicket(ws: Workspace, id: string, role: Role, now: () => string = () => new Date().toISOString(), model?: string | null): Promise<StartResult> {
  const no = (error: string): StartResult => ({ ok: false, error });
  const r = gateFor(ws, id);
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (!r || !ticket) return no(`unknown ticket ${id}`);
  if (!r.gate.ready) return no(`${id} is not ready; spec gate ${id} lists the blockers. Nothing starts while a blocker is open.`);
  const d = ticket.data;
  if (d.status === 'done') return no(`${id} is done`);
  const next = nextStage(d.type, d.history, d.questions, d.lane);
  // A role the lane skips is refused unless the history makes it the next stage: the implementer after a reviewer's unmarked changes (PIP-021/R1).
  const lane = laneOf(d.type, d.lane, d.history);
  const pipeline = pipelineOf(d.type, d.lane, d.history);
  if (!pipeline.includes(role) && !(lane !== 'full' && 'stage' in next && next.stage === role)) {
    return no(`${role} is not a stage of a ${d.type}${lane === 'full' ? '' : ` in the ${lane} lane`}: ${pipeline.join(' → ')}`);
  }
  if ('done' in next) return no(`${id} has finished its pipeline`);
  if ('blocked' in next) return no(`${id} is blocked: ${next.blocked}`);
  if (next.stage !== role) return no(`the next stage of ${id} is ${next.stage}, not ${role}`);

  const root = ws.projectRoot;
  if (!isRepo(root)) return no(`${root} is not a git repository`);
  // One start of a ticket at a time, in any tree (PIP-002/R7): two that both passed the checks
  // above would both run the stage.
  const path = lockPath(root, join('start', `${id}.lock`));
  if (path === null) return no(`${root} is not a git repository`);
  const lock = await waitForLock(path, START_LOCK_WAIT_MS);
  if (!lock.ok) return no(`another start of ${id} (pid ${String(lock.holder ?? '?')}) holds ${path}; try again once it ends`);
  try {
    const live = await ws.store.get(id);
    // A close that committed while this start waited for the lock made the ticket absorbed (TKT-012/R13).
    if (live !== null && live.data.status === 'absorbed') {
      return no(`${id} is not ready; spec gate ${id} lists the blockers: it is absorbed into ${live.data.absorbed_into ?? 'another ticket'}. Nothing starts while a blocker is open.`);
    }
    if (live !== null && live.data.status === 'in_progress' && live.data.stage !== null && !(d.status === 'in_progress' && d.stage === role)) {
      return no(`${id} already has its ${live.data.stage} stage running; it started after this command read the ticket`);
    }
    return await startLocked(ws, id, role, d, now, model, live?.data.history.length ?? d.history.length);
  } finally {
    lock.release();
  }
}

/** Explicitly restarts the in-progress stage after the main session confirms its delegate stopped. */
export async function restartTicketStage(ws: Workspace, id: string, now: () => string = () => new Date().toISOString(), gateSpec: Workspace['spec'] = ws.spec, model?: string | null): Promise<StartResult> {
  const no = (error: string): StartResult => ({ ok: false, error });
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (!ticket) return no(`unknown ticket ${id}`);
  const role = ticket.data.stage;
  if (ticket.data.status !== 'in_progress' || role === null) return no(`${id} has no in-progress stage to restart`);
  if (!PIPELINES[ticket.data.type].includes(role)) return no(`${id} has no pipeline stage to restart`);
  const r = gateFor(ws, id, gateSpec);
  if (!r || !r.gate.ready) return no(`${id} is not ready; spec gate ${id} lists the blockers. Nothing restarts while a blocker is open.`);

  const root = ws.projectRoot;
  if (!isRepo(root)) return no(`${root} is not a git repository`);
  const path = lockPath(root, join('start', `${id}.lock`));
  if (path === null) return no(`${root} is not a git repository`);
  const lock = await waitForLock(path, START_LOCK_WAIT_MS);
  if (!lock.ok) return no(`another start of ${id} (pid ${String(lock.holder ?? '?')}) holds ${path}; try again once it ends`);
  try {
    const live = await ws.store.get(id);
    if (live === null || live.data.status !== 'in_progress' || live.data.stage !== role) {
      return no(`${id} no longer has its ${role} stage running; refresh and try again`);
    }
    const name = blockedStashName(id, role, live.data);
    const stashed = stashStage(root, ws.ticketsRel, id, name, projectGlobs(ws));
    if ('error' in stashed) return no(stashed.error);
    // The start path restores this stash into the same stage's worktree, as it does for a blocked stage.
    const started = await startLocked(ws, id, role, { ...live.data, status: 'open', stage: null }, now, model, live.data.history.length);
    if (started.ok) clearSavedReport(root, id);
    return started;
  } finally {
    lock.release();
  }
}

/**
 * When the ticket's first stage started, in ms: the first history entry's time less its measured
 * duration; else the recorded start of the stage now running. A ticket with neither is starting its
 * first stage, which is after every running ticket (Infinity). A running stage with no record counts
 * as the earliest, so the ticket holds others back as it did before.
 */
function firstStageStart(root: string, t: Ticket): number {
  const first = t.data.history[0];
  if (first !== undefined) {
    const at = Date.parse(first.at);
    return Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at - (first.duration_s ?? 0) * 1000;
  }
  if (t.data.status !== 'in_progress' || t.data.stage === null) return Number.POSITIVE_INFINITY;
  const started = Date.parse(loadStageStart(root, t.id, t.data.stage) ?? '');
  return Number.isNaN(started) ? Number.NEGATIVE_INFINITY : started;
}

async function startLocked(ws: Workspace, id: string, role: Role, d: Ticket['data'], now: () => string, model?: string | null, entries?: number): Promise<StartResult> {
  const no = (error: string): StartResult => ({ ok: false, error });
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (!ticket) return no(`unknown ticket ${id}`);
  const root = ws.projectRoot;
  const branch = ticketBranch(id);
  // A ticket's stages run in the tree that has its branch checked out.
  const elsewhere = ws.ticketGit.worktrees.get(id);
  if (elsewhere !== undefined && realPath(elsewhere) !== realPath(git(root, ['rev-parse', '--show-toplevel']).stdout.trim())) {
    return no(`${branch} is checked out in ${elsewhere}; run the stages of ${id} there`);
  }
  // One working tree runs one ticket at a time: a second would switch branches under the first.
  const here = ws.ticketGit.current;
  const busy = here !== null && here !== id ? ws.tickets.tickets.find((t) => t.id === here && t.data.status === 'in_progress') : undefined;
  if (busy) return no(`${busy.id} has its ${busy.data.stage ?? 'current'} stage running in this tree; wait for it to finish and run spec ticket advance ${busy.id} first, or give ${id} its own worktree (spec worktree add ${id})`);
  // Tickets that depend on each other never run at the same time, in any tree.
  const index = buildIndex(ws.spec);
  const mine = footprint(ws.spec, index, ticket);
  const myStart = firstStageStart(root, ticket);
  for (const other of ws.tickets.tickets) {
    if (other.id === id || other.data.status !== 'in_progress') continue;
    // PIP-002/R2: only a ticket that started its first stage before this one holds it back.
    const theirStart = firstStageStart(root, other);
    if (theirStart > myStart || (theirStart === myStart && other.id > id)) continue;
    const why = conflict(mine, footprint(ws.spec, index, other));
    if (why !== null) return no(`${id} must wait for ${other.id}, which is running: ${why}. Start ${id} once ${other.id} is done and merged.`);
  }

  const base = ws.config?.baseBranch ?? 'main';
  let created = false;
  // Ticket files may be dirty (a person answering a question), and so may what the worktree's setup
  // made; anything else must be committed, so every change at advance belongs to the stage (A3).
  const dirty = stageChanges(root, ws.ticketsRel, id);
  const switching = currentBranch(root) !== branch;
  if (dirty.length > 0) return no(switching ? `cannot switch to ${branch}: uncommitted changes in ${dirty.join(', ')}` : `cannot start the ${role} stage of ${id}: uncommitted changes in ${dirty.join(', ')}; commit or remove them first`);
  if (switching) {
    created = !branchExists(root, branch);
    const sw = created ? git(root, ['checkout', '-q', '-b', branch, base]) : git(root, ['checkout', '-q', branch]);
    if (sw.code !== 0) return no(`git could not switch to ${branch}: ${sw.stderr.trim()}`);
  }
  // Every stage runs on the current base: its roles, agents, bundle and config (PIP-002/R6).
  const sync = await syncWithBase(ws, id, role, d, branch, base);
  if (!sync.ok) return no(sync.error);
  // After the dirt check and the sync: the blocked stage's own work is the one change a start brings back.
  const stash = blockedStashName(id, role, d);
  // The config the synced branch holds decides which files are generated (WSP-009/R5, R6).
  const eff = hasStash(root, stash) ? await mergedWorkspace(ws, root) : ws;
  const restored = restoreStash(root, stash, {}, projectGlobs(eff));
  if ('error' in restored) return no(`${restored.error}; ${id} is as it was`);
  if (!restored.ok) {
    const added = restored.added.length > 0 ? ` It also holds new files that only git stash show --include-untracked lists: ${restored.added.join(', ')}.` : '';
    const text = `git stash "${stash}" does not apply to ${branch}: it conflicts in ${restored.files.join(', ')}.${added} A person must apply it by hand (git stash list names it), then answer to resume.`;
    await ws.store.update(id, { status: 'blocked', stage: null, questions: withBlocker(d.questions, text, role) }, `${id} ${role}: stash does not apply`);
    return no(`${text} ${id} is blocked; the stash is kept and the tree is as it was.`);
  }
  const warning = restored.restored ? rebuildAfterStash(eff, root, id) : null;
  const already = d.status === 'in_progress' && d.stage === role;
  const updated = await ws.store.update(id, { status: 'in_progress', stage: role }, `${id} ${role}: started`);
  if (!updated.ok) return no(updated.error);
  if (!already) {
    clearReportRefusals(root, id, role);
    saveStageStart(root, id, role, now(), model, entries);
  }
  return { ok: true, branch, created, base, synced: sync.synced, ...(warning === null ? {} : { warning }) };
}

/**
 * Merges the base branch into the ticket's branch, checked out here, when the branch lacks its
 * tip. Conflicts only in generated files are rebuilt from the merged source; any other conflict
 * aborts the merge and blocks the ticket on a question for a person.
 */
async function syncWithBase(ws: Workspace, id: string, role: Role, d: Ticket['data'], branch: string, base: string): Promise<{ ok: true; synced: boolean } | { ok: false; error: string }> {
  const root = ws.projectRoot;
  if (!branchExists(root, base) || git(root, ['merge-base', '--is-ancestor', base, 'HEAD']).code === 0) return { ok: true, synced: false };
  const message = `${id}: sync with ${base}`;
  // git merges only onto an index that matches HEAD, so nothing staged can ride in the sync commit.
  const staged = git(root, ['diff', '--cached', '--name-only', '--no-renames']).stdout.split('\n').filter((p) => p !== '');
  if (staged.length > 0) return { ok: false, error: `cannot sync ${branch} with ${base}: staged changes in ${staged.join(', ')}; commit or unstage them first` };
  const m = git(root, ['merge', '--no-ff', '--no-commit', '-q', base]);
  let conflicted: string[] = [];
  // The workspace with the merged config: the base's `generated` counts (WSP-009/R1).
  let eff = ws;
  if (m.code !== 0) {
    conflicted = conflictedPaths(root);
    // git refused before merging anything, for example over an uncommitted ticket file.
    if (conflicted.length === 0) {
      git(root, ['merge', '--abort']);
      return { ok: false, error: `git could not sync ${branch} with ${base}: ${(m.stderr.trim() || m.stdout.trim()).split('\n').slice(0, 3).join(' ')}` };
    }
    eff = await mergedWorkspace(ws, root);
    const other = conflicted.filter((p) => !isGenerated(eff, p));
    if (other.length > 0) {
      git(root, ['merge', '--abort']);
      const text = `syncing ${branch} with ${base} conflicts in ${other.join(', ')}; a person must merge`;
      await ws.store.update(id, { status: 'blocked', stage: null, questions: withBlocker(d.questions, text, role) }, `${id} ${role}: sync with ${base} conflicts`);
      return { ok: false, error: `${text}. ${id} is blocked; ${branch} is as it was.` };
    }
  }
  const gen = await rebuildGenerated(eff, root, conflicted);
  if (!gen.ok) {
    git(root, ['merge', '--abort']);
    return { ok: false, error: `syncing ${branch} with ${base}: ${gen.error}` };
  }
  for (const p of specGenerated(ws)) if (existsSync(join(root, p))) git(root, ['add', '-A', '--', p]);
  const c = git(root, ['commit', '-q', '-m', withTicketTrailer(message, id)]);
  if (c.code !== 0) {
    git(root, ['merge', '--abort']);
    return { ok: false, error: `git could not commit the sync of ${branch} with ${base}: ${c.stderr.trim() || c.stdout.trim()}` };
  }
  return { ok: true, synced: true };
}

async function ticketStart(ws: Workspace, id: string, role: Role, args: Args, now: () => string): Promise<Out> {
  if (!ws.tickets.tickets.some((t) => t.id === id) && !gateFor(ws, id)) return unknownTicket(ws, id);
  const s = await startTicket(ws, id, role, now);
  if (!s.ok) return fail(s.error);
  const out = args.format === 'json' ? json({ ticket: id, branch: s.branch, created: s.created, stage: role, status: 'in_progress' }) : ok(`${id}: stage ${role} on ${s.branch}${s.created ? ` (created from ${s.base})` : ''}\n`);
  return s.warning === undefined ? out : { ...out, stderr: `${s.warning}\n` };
}

/**
 * TKT-005/R8, TKT-012/R5: a ticket file committed on a ticket branch would reach the base only with
 * that ticket's merge, and every other tree would miss it until then. Returns why this tree may not
 * file tickets, or null on the base branch.
 */
function offBase(ws: Workspace, command: 'new' | 'combine' | 'close'): string | null {
  const base = ws.config?.baseBranch ?? 'main';
  if (currentBranch(ws.projectRoot) === base) return null;
  const tree = worktreeBranches(ws.projectRoot).get(base);
  const prefix = git(ws.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim();
  return `file tickets from ${base}: ${tree === undefined ? `check out ${base} first` : `run spec ticket ${command} in ${join(tree, prefix)}`}; nothing was saved`;
}

/** Commits these files together, and nothing else. On a refusal the staged state is undone and the reason returned; the caller puts the files back. */
function commitFiles(ws: Workspace, files: readonly string[], message: string, purpose: { readonly kind: 'ticket' | 'combine'; readonly ticket: string }): string | null {
  const add = git(ws.projectRoot, ['add', '--', ...files]);
  // A new ticket and a combine commit under a spec-owned marker bound to their files, so the enforcement hooks let them through (X140).
  const commit = add.code !== 0 ? add
    : commitWithToken(ws, purpose, ['commit', '-q', '-m', `${message}\n\nSpec-Ticket: ${purpose.ticket}`, '--', ...files]);
  if (commit.code === 0) return null;
  git(ws.projectRoot, ['reset', '-q', '--', ...files]);
  return `git could not commit ${files.join(', ')}: ${(commit.stderr.trim() || commit.stdout.trim()).split('\n').slice(0, 3).join(' ')}; nothing was saved`;
}

/**
 * spec ticket combine <INTO> <FROM>...: INTO takes over the work of each FROM, which is marked
 * absorbed and keeps its file. Files in this repository are committed together on the base branch.
 */
async function ticketCombine(ws: Workspace, args: Args): Promise<Out> {
  const [, intoId, ...fromIds] = args.positionals;
  if (!intoId || fromIds.length === 0) return usageError('usage: spec ticket combine <INTO> <FROM>...', USAGE);
  const find = (id: string): Ticket | null => (PATTERNS.ticket.test(id) ? (ws.tickets.tickets.find((t) => t.id === id) ?? null) : null);
  for (const id of [intoId, ...fromIds]) if (find(id) === null) return unknownTicket(ws, id);
  const into = find(intoId) as Ticket;
  const named = [...new Set(fromIds)].map((id) => find(id) as Ticket);
  const problems = combineProblems(into, named, { tickets: ws.tickets.tickets, worktrees: ws.ticketGit.worktrees });
  if (problems.length > 0) return { stdout: '', stderr: `${problems.join('\n')}\n`, code: 1 };

  const repo = ws.ticketsInRepo && isRepo(ws.projectRoot);
  const off = repo ? offBase(ws, 'combine') : null;
  if (off !== null) return fail(off);
  const plan = planCombine(into, named.filter((t) => t.id !== into.id));

  // Where each ticket's live copy is: a file in this tree is committed here; one on a branch or in
  // another worktree is saved there.
  const local = plan.patches.map((p) => p.id).filter((id) => repo && !ws.ticketGit.live.has(id));
  const before = new Map(local.map((id) => [id, readFileSync(resolve(ws.projectRoot, `${ws.ticketsRel}/${id}.md`), 'utf8')]));
  const putBack = (): void => {
    for (const [id, text] of before) writeFileSync(resolve(ws.projectRoot, `${ws.ticketsRel}/${id}.md`), text, 'utf8');
  };
  const saved = new Map<string, Ticket>();
  for (const { id, patch } of plan.patches) {
    const r = await ws.store.update(id, patch, `${plan.patches[0]?.id ?? id}: combine ${plan.absorbed.map((a) => a.id).join(', ')}`);
    if (!r.ok) {
      putBack();
      return fail(r.error);
    }
    saved.set(id, r.ticket);
  }
  if (local.length > 0) {
    const refused = commitFiles(ws, local.map((id) => `${ws.ticketsRel}/${id}.md`), `${into.id}: combine ${plan.absorbed.map((a) => a.id).join(', ')}`, { kind: 'combine', ticket: into.id });
    if (refused !== null) {
      putBack();
      return fail(refused);
    }
  }
  const tickets = ws.tickets.tickets.map((t) => saved.get(t.id) ?? t);
  const merged = saved.get(into.id) as Ticket;
  const gate = gateTicket(ws.spec, buildIndex(ws.spec), into.id, merged, [], dependencies(tickets, ws.ticketGit.branches, ws.ticketGit.mergedIntoBase));
  if (args.format === 'json') return json({ ticket: into.id, absorbed: plan.absorbed, gate });
  return ok(`${renderCombine(into.id, plan.absorbed)}\n\n${renderGate(gate, merged.file)}`);
}

/** The blocked stages' stashes of a ticket, in the order `git stash list` has them (TKT-012/R12). */
function keptStashes(root: string, id: string): KeptStash[] {
  const list = git(root, ['stash', 'list', '--format=%H %gs']);
  if (list.code !== 0) return [];
  const named = new RegExp(`(?:^|: )(${id} [a-z-]+: blocked)$`);
  const kept: KeptStash[] = [];
  list.stdout.split('\n').filter((l) => l !== '').forEach((line, at) => {
    const space = line.indexOf(' ');
    const name = named.exec(line.slice(space + 1))?.[1];
    if (name === undefined) return;
    kept.push({ name, ref: `stash@{${String(at)}}`, commit: git(root, ['rev-parse', '--short', line.slice(0, space)]).stdout.trim() });
  });
  return kept;
}

/**
 * spec ticket close <TICKET> --superseded-by <ID> (TKT-012/R9-R14): marks a ticket absorbed in its file on the
 * base branch and commits that file alone. Deletes nothing; names the worktree, branch and stashes it kept.
 */
async function ticketClose(ws: Workspace, args: Args): Promise<Out> {
  const [, id, ...extra] = args.positionals;
  const by = args.supersededBy;
  if (!id || !by || extra.length > 0) return usageError(CLOSE_USAGE, USAGE);
  const root = ws.projectRoot;
  const unfit = ws.store.dirRel === null ? 'this project keeps them in a tracker' : !ws.ticketsInRepo ? `${ws.ticketsRel} is outside it` : !isRepo(root) ? `${root} is in no git repository` : null;
  if (unfit !== null) return fail(`spec ticket close needs tickets as files in this git repository; ${unfit}`);
  const off = offBase(ws, 'close');
  if (off !== null) return fail(off);
  for (const x of [id, by]) if (!PATTERNS.ticket.test(x) || !ws.tickets.tickets.some((t) => t.id === x)) return unknownTicket(ws, x);

  // No stage starts on the ticket from its checks until the close has committed (TKT-012/R13).
  const path = lockPath(root, join('start', `${id}.lock`));
  if (path === null) return fail(`${root} is not a git repository`);
  const lock = tryLock(path);
  if (!lock.ok) return fail(`${id} is being started by another process; try again once it ends`);
  try {
    // Read again under the lock: a start that finished meanwhile has changed the ticket.
    const now = await reloadWorkspace(ws);
    const ticket = now.tickets.tickets.find((t) => t.id === id);
    const superseding = now.tickets.tickets.find((t) => t.id === by);
    if (!ticket || !superseding) return unknownTicket(now, ticket ? by : id);
    const base = now.config?.baseBranch ?? 'main';
    const file = `${now.ticketsRel}/${id}.md`;
    const abs = resolve(root, file);
    const onBase = git(root, ['show', `refs/heads/${base}:./${file}`]);
    const problems = closeProblems(ticket, superseding, {
      base,
      baseCopy: onBase.code === 0 ? parseTicket(file, onBase.stdout).ticket : null,
      uncommitted: git(root, ['status', '--porcelain', '-z', '--untracked-files=all', '--', file]).stdout !== '',
      tickets: now.tickets.tickets,
    });
    if (problems.length > 0) return { stdout: '', stderr: `${problems.join('\n')}\n`, code: 1 };

    const before = readFileSync(abs, 'utf8');
    const text = patchTicketText(before, { status: 'absorbed', absorbed_into: by }, { keepQuotes: true });
    if (text === null || parseTicket(file, text).ticket === null) return fail(`closing ${id} would break its schema; nothing was saved`);
    writeFileSync(abs, text, 'utf8');
    const refused = commitFiles(now, [file], `${by}: close ${id} as superseded`, { kind: 'combine', ticket: by });
    if (refused !== null) {
      writeFileSync(abs, before, 'utf8');
      return fail(refused);
    }

    const branch = ticketBranch(id);
    const hasBranch = branchExists(root, branch);
    const stem = {
      ticket: id,
      absorbedInto: by,
      worktree: now.ticketGit.worktrees.get(id) ?? null,
      branch: hasBranch ? branch : null,
      tip: hasBranch ? git(root, ['rev-parse', '--short', branch]).stdout.trim() : null,
      unmerged: hasBranch ? Number(git(root, ['rev-list', '--count', `${base}..${branch}`]).stdout.trim()) || 0 : 0,
      stashes: keptStashes(root, id),
    };
    const result: CloseResult = { ...stem, cleanup: closeCleanup(stem) };
    return args.format === 'json' ? json(result) : ok(renderClose(result, base, ticket.data.history.length));
  } finally {
    lock.release();
  }
}

/**
 * spec ticket new: a ticket from JSON on stdin ({ type, title, touches, violates, depends_on,
 * questions, body }), with the next free ID. In a repository the ticket file is committed on its
 * own, so worktrees made from this branch see it. Prints the ID and what the gate says.
 */
async function ticketNew(ws: Workspace, args: Args, stdin: string, cwd: string): Promise<Out> {
  // A file path, or stdin. Claude Code refuses heredocs that hold JSON ("brace with quote
  // character"), so agents write the JSON to a file with their file tool and pass its path.
  const path = args.positionals[1];
  let text = stdin;
  if (path !== undefined) {
    const abs = resolve(cwd, path);
    if (!existsSync(abs)) return fail(`${path} does not exist`);
    text = readFileSync(abs, 'utf8');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const where = path === undefined ? 'on stdin' : `from ${path}`;
    return usageError(`spec ticket new reads the ticket as JSON ${where}: { "type", "title", "touches", "violates", "depends_on", "questions", "body" }`, USAGE);
  }
  const input = NewTicketInput.safeParse(raw);
  if (!input.success) return fail(`the ticket is not valid: ${input.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
  const id = nextTicketId(input.data.type, ws.store.taken(ws.tickets, ws.ticketGit));
  const r = renderNewTicket(id, input.data, `${ws.ticketsRel}/${id}.md`);
  if ('problems' in r) return fail(`the ticket is not valid: ${r.problems.join('; ')}`);
  if (args.dryRun) {
    const gate = gateTicket(ws.spec, buildIndex(ws.spec), id, r.ticket, [], depsOf(ws));
    if (args.format === 'json') return json({ ticket: id, file: null, dryRun: true, gate });
    return ok(`${id} would be created (dry run; nothing saved)\n\n${renderGate(gate, null)}`);
  }
  const repo = ws.ticketsInRepo && isRepo(ws.projectRoot);
  const off = repo ? offBase(ws, 'new') : null;
  if (off !== null) return fail(off);
  const saved = await ws.store.create(id, r.text);
  if (!saved.ok) return fail(saved.error);
  if (saved.file && repo) {
    const refused = commitFiles(ws, [saved.file], `${id}: new ${input.data.type}, ${input.data.title}`, { kind: 'ticket', ticket: id });
    if (refused !== null) {
      rmSync(resolve(ws.projectRoot, saved.file), { force: true });
      return fail(refused);
    }
  }
  const gate = gateTicket(ws.spec, buildIndex(ws.spec), id, r.ticket, [], depsOf(ws));
  if (args.format === 'json') return json({ ticket: id, file: saved.file, gate });
  return ok(`${id} created${saved.file ? ` (${saved.file})` : ''}\n\n${renderGate(gate, saved.file)}`);
}

/**
 * spec ticket answer <TICKET> <Q> <answer>: answers one of the ticket's own questions, wherever
 * the ticket's live copy is. Questions on spec units are answered in the spec.
 */
async function ticketAnswer(ws: Workspace, args: Args, now: () => string): Promise<Out> {
  const [, id, q, ...words] = args.positionals;
  const answer = words.join(' ').trim();
  if (!id || !q || answer === '' || args.back === '') return usageError('usage: spec ticket answer <TICKET> <Q> <answer> [--back <role>]', USAGE);
  const back = args.back;
  if (back !== null && !(ROLES as readonly string[]).includes(back)) return usageError(`Unknown role ${back}. Roles: ${ROLES.join(', ')}`, USAGE);
  if (!PATTERNS.ticket.test(id)) return unknownTicket(ws, id);
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (!ticket) return unknownTicket(ws, id);
  const qid = q.replace(`${id}#`, '');
  if (q.includes('#') && !q.startsWith(`${id}#`)) return fail(`${q} is a question on ${q.split('#')[0] ?? ''}, a spec unit: answer it in its spec file`);
  const question = ticket.data.questions.find((x) => x.id === qid);
  if (!question) return fail(`${id} has no question ${qid}; its questions: ${ticket.data.questions.map((x) => x.id).join(', ') || 'none'}`);
  const questions = ticket.data.questions.map((x) => (x.id === qid ? { ...x, answer } : x));
  // A blocked ticket goes back to open: the gate decides whether it is ready again.
  let patch: TicketPatch = ticket.data.status === 'blocked' ? { questions, status: 'open' } : { questions };
  if (back !== null) {
    const d = ticket.data;
    if (d.status === 'in_progress' && d.stage !== null) return fail(`${id} has its ${d.stage} stage running; finish it before going back`);
    const finished = [...new Set(d.history.filter((h) => h.result === 'done').map((h) => h.role))];
    if (!finished.includes(back as Role)) return fail(`${id} has no finished ${back} stage to go back to; stages it has finished: ${finished.join(', ') || 'none'}`);
    const entry: HistoryEntry = { at: now(), role: back as Role, result: 'reopened', summary: `reopened by ${id}#${qid}`, verdict: null, assumed: [] };
    patch = { questions, status: 'open', history: [...d.history, entry] };
  }
  const r = await ws.store.update(id, patch, `${id}: answer ${qid}`);
  if (!r.ok) return fail(r.error);
  const gate = gateTicket(ws.spec, buildIndex(ws.spec), id, r.ticket, [], depsOf(ws));
  if (args.format === 'json') return json(back === null ? { ticket: id, question: qid, answer, ready: gate.ready } : { ticket: id, question: qid, answer, ready: gate.ready, next: back });
  return ok(`${id}#${qid} answered.${gate.ready ? ` ${id} is ready again.` : ` ${id} is still not ready; spec gate ${id} says why.`}\n${back === null ? '' : `next: ${back}\n`}`);
}
