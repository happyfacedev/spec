// `spec next`: start a stage for the main session and prepare a task its harness can delegate.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isBuildStage, nextStage } from '../core/pipeline';
import { allMarkedUnavailable, missingDelegationModels, selectModel, type ModelSelection, type SkippedModel } from '../core/delegation';
import { FINDING_CLASS_LABELS, STAGE_ROLES, type Effort, type Role, type StageRole } from '../core/schemas';
import { ASSETS } from '../generated/assets';
import { buildIndex } from '../core/units';
import { expandRole, parseRoleFile, projectCliPath } from '../core/roles';
import { buildPlan } from '../core/plan';
import { type EffortGate, effortGate } from '../io/claude-version';
import { realPath } from '../io/fs';
import { git } from '../io/git';
import { ticketBranch } from '../io/ticket-git';
import { loadWorkspace, projectUsesLegacyCli, type Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { briefFor } from './brief';
import { type Out, json, ok, usageError } from './output';
import { depsOf, gateFor, restartTicketStage, startTicket } from './tickets';
import { addWorktree, worktreeProjectPath } from './worktree';

export type NextAction = 'delegate' | 'merge' | 'waiting' | 'done' | 'error';
export interface NextEntry {
  readonly ticket: string;
  readonly action: NextAction;
  readonly role?: StageRole;
  readonly worktree?: string;
  readonly branch?: string;
  readonly model?: string | null;
  readonly effort?: Effort | null;
  readonly skipped?: readonly SkippedModel[];
  readonly missingModels?: readonly StageRole[];
  readonly advance?: string;
  readonly task?: string;
  readonly questions?: readonly { id: string; text: string }[];
  readonly blockers?: readonly { kind?: string; id?: string; text: string }[];
}
interface NextSummary {
  readonly ticket: string;
  readonly action: NextAction;
  readonly role?: StageRole;
  readonly worktree?: string;
  readonly model: string | null;
}

const fail = (message: string): Out => ({ stdout: '', stderr: `${message}\n`, code: 1 });
export const projectCli = (ws: Workspace): string => projectCliPath(ws.spec.skillName, projectUsesLegacyCli(ws));

export function nextFailure(args: Args, message: string, ticket = args.positionals[0] ?? '', code = 2): Out {
  if (args.format === 'json') return json({ ticket, action: 'error', blockers: [{ text: message }] }, code);
  return code === 2 ? usageError(message, USAGE, code) : fail(message);
}

export function detectHarness(explicit: string | null, env: Readonly<Record<string, string | undefined>>): string | null {
  if (explicit) return explicit;
  if (env.SPEC_HARNESS) return env.SPEC_HARNESS;
  if (env.CLAUDE_CODE_ENTRYPOINT === 'astro' || Boolean(env.ASTRO_RUN_ID) || env.ASTRO_HOOK === '1') return 'astro';
  if (env.CLAUDECODE === '1') return 'claude-code';
  return null;
}

const selectionFor = (models: Workspace, harness: string | null, role: StageRole): ModelSelection => selectModel(models.delegation, models.unavailableModels, harness, role);

/** Why a role cannot start while every supported model of its list is marked unavailable; null when it can (CLI-007/R18). */
function markedBlockers(models: Workspace, harness: string | null, role: StageRole): { text: string }[] | null {
  const selection = selectionFor(models, harness, role);
  if (!allMarkedUnavailable(selection)) return null;
  return selection.skipped.map(({ model, reason }) => ({
    text: reason === 'marked unavailable'
      ? `${role} model ${model} is marked unavailable on this machine; unmark it with \`${projectCli(models)} config set unavailableModels.${model} false --local\``
      : `${role} model ${model} is ${reason}`,
  }));
}

/** The one sentence the review prompts ask for a class with (PIP-017/S13). */
const CLASS_SENTENCE = `Give each finding a class, as class: <class>: ${Object.entries(FINDING_CLASS_LABELS).map(([id, label]) => `${id} ${label}`).join(', ')}, or other.`;

function rolePrompt(ws: Workspace, role: StageRole): string | null {
  const path = join(ws.specRoot, 'roles', `${role}.md`);
  // A project installed before the spec review has no prompt for it: this version's own is used, and not written (PIP-017/R8).
  const bundled = !existsSync(path) && role === 'spec-review';
  if (!existsSync(path) && !bundled) return null;
  const source = bundled ? (ASSETS['roles/spec-review.md'] ?? '') : readFileSync(path, 'utf8');
  const sharedPath = join(ws.specRoot, 'roles', '_shared.md');
  const shared = bundled ? (ASSETS['roles/_shared.md'] ?? '') : existsSync(sharedPath) ? readFileSync(sharedPath, 'utf8') : '';
  const expanded = expandRole(source, shared) ?? source;
  const parsed = parseRoleFile(`roles/${role}.md`, expanded).role;
  if (!parsed) return null;
  let body = parsed.body.replace(/`spec (?=[a-z<])/g, `\`${projectCli(ws)} `);
  const promptWithoutReport = body.replace(/```report\r?\n[\s\S]*?\r?\n```/g, '');
  if (role === 'spec-writer' && !/(?:`checklist:`|checklist:)/.test(promptWithoutReport)) {
    body += "\n\nWork through every item of the brief's case checklist before finishing, and report each under checklist:. If you could not verify an external fact, end blocked with a blocker marked external: true.";
  }
  // PIP-017/R10: a review prompt an earlier version installed says nothing of classes; the project's role file stays as it is.
  if ((role === 'reviewer' || role === 'spec-review') && !/class:/.test(promptWithoutReport)) body += `\n\n${CLASS_SENTENCE}`;
  return body;
}

function reportForm(prompt: string, role: StageRole, ticket: string, build: boolean): string {
  const form = /\x60\x60\x60report\r?\n[\s\S]*?\r?\n\x60\x60\x60/.exec(prompt)?.[0];
  let result = form
    ? form.replace(/^role:.*$/m, `role: ${role}`).replace(/^ticket:.*$/m, `ticket: ${ticket}`)
    : ['```report', `role: ${role}`, `ticket: ${ticket}`, 'result: done', 'summary: "<one line, at most 120 characters>"', 'changed: []', 'assumed: []', 'blockers: []', 'verdict: null', 'findings: []', '```'].join('\n');
  if (role === 'spec-writer') {
    if (!/^documents:/m.test(result)) result = result.replace(/^(changed:.*)$/m, '$1\ndocuments: []');
    if (!/^checklist:/m.test(result)) result = result.replace(/^(documents:.*)$/m, '$1\nchecklist: []');
  }
  // PIP-017/R18: a build stage names mutations, as a tester does.
  if (build && !/^mutations:/m.test(result)) result = result.replace(/^(changed:.*)$/m, '$1\nmutations: []');
  return result;
}

/**
 * The project's own additions to a role prompt, spec/roles/<role>.local.md, trimmed, with its `spec` commands
 * given the CLI path (PIP-017/R11). Null when there is none or it holds only blank lines; an error naming
 * the file when it exists and cannot be read.
 */
function localRoleText(ws: Workspace, role: StageRole): string | null | { error: string } {
  const path = join(ws.specRoot, 'roles', `${role}.local.md`);
  if (!existsSync(path)) return null;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { error: `cannot read spec/roles/${role}.local.md` };
  }
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed.replace(/`spec (?=[a-z<])/g, `\`${projectCli(ws)} `);
}

/** A path as one shell word: plain paths as they are, any other single-quoted (PIP-017/R15). */
const shellQuote = (text: string): string => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`);

/** The absolute spec root inside the ticket's worktree, which the task's CLI takes as `--root` (PIP-017/R2). */
const worktreeSpecRoot = (ws: Workspace, worktree: string): string => resolve(worktree, relative(ws.projectRoot, ws.specRoot));

/**
 * The report file for one ticket and role: directly inside the ticket worktree parent, outside every worktree,
 * so a session in acceptEdits mode may write it (PIP-017/R4). The worktree is the project folder inside the
 * ticket's checkout; the checkout is as many levels up as the project's path inside the repository has.
 */
function reportFilePath(ws: Workspace, worktree: string, ticket: string, role: StageRole): string {
  const prefix = ws.ticketGit.repoTop === null ? git(ws.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim() : ws.ticketGit.prefix;
  const depth = prefix.split('/').filter((part) => part !== '').length;
  let top = resolve(worktree);
  for (let level = 0; level < depth; level++) top = dirname(top);
  return join(dirname(top), `${ticket}-${role}-report.md`);
}

function taskFor(ws: Workspace, role: StageRole, ticket: string, worktree: string, local: string | null, planned = false): string | null {
  const prompt = rolePrompt(ws, role);
  if (prompt === null) return null;
  const data = ws.tickets.tickets.find((t) => t.id === ticket)?.data;
  const report = reportForm(prompt, role, ticket, data !== undefined && isBuildStage(data, role));
  const roleText = prompt
    .replace(/\x60\x60\x60report\r?\n[\s\S]*?\r?\n\x60\x60\x60/, '')
    .replace(/^- If your first message has no brief, .+$/gm, '- Your brief is below; do not run brief again.')
    .replace(/`[^`]*ticket advance[^`]*`/g, 'the stage-advance command')
    .replace(/(check-report \S+ )<ticket ID>/g, `$1${ticket}`)
    .replace('End your final message with exactly one report block, in this form:', 'End your final message with exactly one report block, as shown under Report block below.');
  const cli = projectCli(ws);
  const rooted = `${cli} --root ${shellQuote(worktreeSpecRoot(ws, worktree))}`;
  const brief = briefFor(ws, role, ticket);
  return [
    local === null ? roleText : `${roleText.trimEnd()}\n\n${local}`,
    [
      '## Working folder',
      `- Absolute worktree: ${worktree}`,
      ...(planned ? [`- This worktree is planned; \`${cli} next --start\` creates it before delegation.`] : []),
      '- Work only inside it, and give your file tools absolute paths there.',
      `- Report file: ${reportFilePath(ws, worktree, ticket, role)} is the one file outside the worktree you may write: save your final report there. The main session records the stage from it; you never do.`,
      '- Each shell command starts in the project root and a cd does not carry over to the next one, so never run cd, alone or joined to another command.',
      `- CLI: ${rooted} (it is relative to the project root and acts on the worktree; give every \`${cli}\` command in this task that \`--root\` option, so \`${cli} test\` means \`${rooted} test\`.`,
      `- Run the tests only through the CLI's \`test\` (\`${rooted} test\`), which runs the project's test command in the worktree. Never commit: recording the stage commits it.`,
      `- Look at the worktree's git state only as \`git -C ${shellQuote(worktree)} status\`, \`git -C ${shellQuote(worktree)} diff\` or \`git -C ${shellQuote(worktree)} log\`.`,
      '- Give any other project command the worktree through its own directory option or path argument, written after the command words its allow rule names, so that a rule such as `Bash(dart format *)` still matches the whole command.',
    ].join('\n'),
    `## Brief\n${brief}`,
    `## Report block\n${report}`,
  ].join('\n\n');
}

/** `gate` is null for a summary, which shows no effort, so `claude` is not run for it (CLI-007/R19). */
function delegateEntry(ws: Workspace, ticket: string, role: StageRole, worktree: string, harness: string | null, models: Workspace, gate: EffortGate | null, planned = false): NextEntry | Out {
  const local = localRoleText(ws, role);
  if (local !== null && typeof local === 'object') return fail(local.error);
  const task = taskFor(ws, role, ticket, worktree, local, planned);
  if (task === null) return fail(`no valid spec/roles/${role}.md prompt`);
  const cli = projectCli(ws);
  const selection = selectionFor(models, harness, role);
  return {
    ticket,
    action: 'delegate',
    role,
    worktree,
    branch: ticketBranch(ticket),
    model: selection.model,
    effort: gate?.send(selection.effort) ?? null,
    skipped: selection.skipped,
    missingModels: missingDelegationModels(models.delegation, harness),
    advance: `${cli} ticket advance ${ticket} --report-file ${shellQuote(reportFilePath(ws, worktree, ticket, role))}`,
    task,
  };
}

async function workspaceAt(ws: Workspace, project: string): Promise<Workspace> {
  if (realPath(project) === realPath(ws.projectRoot)) return ws;
  const spec = resolve(project, relative(ws.projectRoot, ws.specRoot));
  return loadWorkspace(spec, null, project);
}

async function primaryWorkspace(ws: Workspace): Promise<Workspace> {
  let primaryTop = ws.ticketGit.primaryWorktree;
  let prefix = ws.ticketGit.prefix;
  if (primaryTop === null) {
    const listed = git(ws.projectRoot, ['worktree', 'list', '--porcelain']);
    if (listed.code !== 0) return ws;
    primaryTop = listed.stdout.split(/\n\n/).map((block) => /^worktree (.+)$/m.exec(block)?.[1]).find((path) => path !== undefined) ?? null;
    if (primaryTop === null) return ws;
    prefix = git(ws.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim();
  }
  const project = resolve(primaryTop, prefix);
  if (realPath(project) === realPath(ws.projectRoot)) return ws;
  const spec = resolve(project, relative(ws.projectRoot, ws.specRoot));
  return existsSync(spec) ? loadWorkspace(spec, null, project) : ws;
}

async function startEntry(ws: Workspace, ticket: string, role: StageRole, harness: string | null, models: Workspace, now: () => string, gate: EffortGate, restart = false, warnings: string[] = []): Promise<NextEntry | Out> {
  let project: string;
  if (ws.ticketGit.current === ticket) project = ws.projectRoot;
  else {
    const existing = ws.ticketGit.worktrees.get(ticket);
    if (existing !== undefined) project = worktreeProjectPath(ws, ticket);
    else {
      const added = addWorktree(ws, ticket);
      if (!added.ok) return fail(added.error);
      project = added.project;
    }
  }
  const target = await workspaceAt(ws, project);
  const { model } = selectionFor(models, harness, role);
  const started = restart ? await restartTicketStage(target, ticket, now, models.spec, model) : await startTicket(target, ticket, role, now, model);
  if (!started.ok) return fail(started.error);
  // The start succeeded but said something (WSP-009/R6): the caller puts it on stderr.
  if (started.warning !== undefined) warnings.push(started.warning);
  const fresh = await loadWorkspace(target.specRoot, null, project);
  const entry = delegateEntry(fresh, ticket, role, project, harness, models, gate);
  if ('code' in entry) return entry;
  return { ...entry, branch: started.branch };
}

function waiting(ticket: string, gateBlockers: readonly { kind: string; id: string; text: string }[], fallback?: string): NextEntry {
  const questions = gateBlockers.filter((b) => b.kind === 'question').map(({ id, text }) => ({ id: id.split('#').at(-1) ?? id, text }));
  const blockers = gateBlockers.length > 0 ? gateBlockers : fallback ? [{ text: fallback }] : [];
  return { ticket, action: 'waiting', ...(questions.length > 0 ? { questions } : {}), ...(blockers.length > 0 ? { blockers } : {}) };
}

function terminal(ws: Workspace, ticket: string): NextEntry {
  return ws.ticketGit.mergedIntoBase.has(ticket) ? { ticket, action: 'done' } : { ticket, action: 'merge' };
}

function renderEntry(entry: NextEntry, planned = false): string {
  if (entry.action === 'delegate') {
    const model = entry.model ?? `(not set — choose one for ${entry.role})`;
    const location = planned ? `${entry.worktree} (planned; created only with --start)` : entry.worktree;
    return `ticket: ${entry.ticket}  role: ${entry.role}  worktree: ${location}  model: ${model}${entry.effort ? `  effort: ${entry.effort}` : ''}\nadvance: \`${entry.advance}\`\n\n${entry.task}\n`;
  }
  if (entry.action === 'merge') return `${entry.ticket}: merge\nnext: spec merge ${entry.ticket}\n`;
  if (entry.action === 'done') return `${entry.ticket}: merged\n`;
  if (entry.action === 'error') return `${entry.ticket}: error\n${(entry.blockers ?? []).map((b) => `- ${b.text}`).join('\n')}\n`;
  const details = [
    ...(entry.questions ?? []).map((q) => `- question ${q.id}: ${q.text}`),
    ...(entry.blockers ?? []).map((b) => `- ${b.kind ? `${b.kind} ` : ''}${b.id ? `${b.id}: ` : ''}${b.text}`),
  ];
  return `${entry.ticket}: waiting${details.length > 0 ? `\n${details.join('\n')}` : ''}\n`;
}

function summarizeEntry(entry: NextEntry): NextSummary {
  return {
    ticket: entry.ticket,
    action: entry.action,
    ...(entry.role ? { role: entry.role } : {}),
    ...(entry.worktree ? { worktree: entry.worktree } : {}),
    model: entry.model ?? null,
  };
}

function renderSummary(entry: NextEntry): string {
  return [
    `ticket: ${entry.ticket}`,
    `action: ${entry.action}`,
    `role: ${entry.role ?? '—'}`,
    `worktree: ${entry.worktree ?? '—'}`,
    `model: ${entry.model ?? '—'}`,
  ].join('  ') + '\n';
}

function asOut(entries: readonly NextEntry[], args: Args, singular: boolean, code = 0, planned = false, summary = false): Out {
  if (args.format === 'json') return json(summary ? entries.map(summarizeEntry) : singular ? entries[0] : entries, code);
  return ok(summary
    ? entries.map(renderSummary).join('')
    : entries.map((entry) => renderEntry(entry, planned)).join('\n'), code);
}

/** One ticket's next result; `failure` is what nextFailure reports, `unmodelled` a role a stage request refuses before it starts. */
export type OneNext = { entry: NextEntry; code: number } | { failure: string; code: number } | { unmodelled: StageRole };

/** `spec next <ID>` without --restart: the ticket's stage starts, unless `requireModel` and its role has no model (INS-020/R4). */
async function nextOne(ws: Workspace, id: string, harness: string | null, models: Workspace, now: () => string, warnings: string[], gate: EffortGate, requireModel = false): Promise<OneNext> {
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (!ticket) return { failure: `Unknown ${id}.`, code: 2 };
  if (ticket.data.status === 'done') return { entry: terminal(ws, id), code: 0 };
  if (ticket.data.status === 'in_progress') {
    return { entry: waiting(id, [], `already has its ${ticket.data.stage ?? 'current'} stage running; do not delegate it again`), code: 1 };
  }
  const gated = gateFor(ws, id);
  if (!gated || !gated.gate.ready) return { entry: waiting(id, gated?.gate.blockers ?? [], gated ? undefined : `unknown ticket ${id}`), code: 1 };
  const next = nextStage(ticket.data.type, ticket.data.history, ticket.data.questions, ticket.data.lane);
  if ('done' in next) return { entry: terminal(ws, id), code: 0 };
  if ('blocked' in next) return { entry: waiting(id, [], next.blocked), code: 1 };
  if (!STAGE_ROLES.includes(next.stage)) return { entry: waiting(id, [], `the next stage ${next.stage} cannot be delegated`), code: 1 };
  const marked = markedBlockers(models, harness, next.stage);
  if (marked !== null) return { entry: { ticket: id, action: 'waiting', blockers: marked }, code: 1 };
  if (requireModel && selectionFor(models, harness, next.stage).model === null) return { unmodelled: next.stage };
  const entry = await startEntry(ws, id, next.stage, harness, models, now, gate, false, warnings);
  return 'code' in entry ? { failure: entry.stderr.trim(), code: entry.code } : { entry, code: 0 };
}

/**
 * `spec next <ID> --harness claude-code` for a stage request (INS-020/R1): the same result, except that a role with
 * no valid model is returned before its stage starts (R4). What the start said goes in `warnings`.
 */
export async function nextForStageRequest(ws: Workspace, id: string, now: () => string, warnings: string[], gate: EffortGate): Promise<OneNext> {
  return nextOne(ws, id, 'claude-code', await primaryWorkspace(ws), now, warnings, gate, true);
}

/** The `advance` command `spec next` names for a ticket's stage: the report path for that ticket and role (cli.Next.advance). */
export function advanceCommandFor(ws: Workspace, ticket: string, role: StageRole): string {
  const worktree = ws.ticketGit.current === ticket ? ws.projectRoot : worktreeProjectPath(ws, ticket);
  return `${projectCli(ws)} ticket advance ${ticket} --report-file ${shellQuote(reportFilePath(ws, worktree, ticket, role))}`;
}

/** One ticket starts immediately; no ID returns the plan's safe first wave, optionally starting it. */
export async function cmdNext(ws: Workspace, args: Args, env: Readonly<Record<string, string | undefined>>, now: () => string): Promise<Out> {
  if (args.report !== null || args.reportFile !== null) return nextFailure(args, 'spec next does not accept report options');
  if (args.restart && (args.positionals.length !== 1 || args.start)) return nextFailure(args, 'usage: spec next <TICKET> --restart');
  if (args.positionals.length > 1 || (args.start && args.positionals.length > 0)) return nextFailure(args, 'usage: spec next [<TICKET>] [--start] [--harness <name>]');
  if (args.harness !== null && args.harness.trim() === '') return nextFailure(args, '--harness needs a non-empty name');
  if (args.summary && (args.positionals.length > 0 || args.start)) return nextFailure(args, '--summary is only for listing the current safe wave');
  const harness = detectHarness(args.harness, env);
  const warnings: string[] = [];
  const gate = effortGate(env);
  const said = (out: Out): Out => {
    const notice = gate.notice();
    return withWarnings(out, notice === null ? warnings : [...warnings, notice]);
  };
  const models = await primaryWorkspace(ws);
  const id = args.positionals[0];
  if (id !== undefined) {
    const ticket = ws.tickets.tickets.find((t) => t.id === id);
    if (!ticket) return nextFailure(args, `Unknown ${id}.`, id);
    if (args.restart) {
      const existing = ws.ticketGit.worktrees.get(id);
      const target = existing !== undefined && ws.ticketGit.current !== id ? await workspaceAt(ws, worktreeProjectPath(ws, id)) : ws;
      const active = target.tickets.tickets.find((t) => t.id === id);
      if (!active || active.data.status !== 'in_progress' || active.data.stage === null) return nextFailure(args, '--restart requires a ticket with an in-progress stage', id, 1);
      if (!STAGE_ROLES.includes(active.data.stage)) return nextFailure(args, `the running stage ${active.data.stage} cannot be restarted`, id, 1);
      const marked = markedBlockers(models, harness, active.data.stage);
      if (marked !== null) {
        return args.format === 'json'
          ? json({ ticket: id, action: 'error', blockers: marked }, 1)
          : fail(marked.map((b) => b.text).join('\n'));
      }
      const entry = await startEntry(ws, id, active.data.stage, harness, models, now, gate, true, warnings);
      return 'code' in entry ? nextFailure(args, entry.stderr.trim(), id, entry.code) : said(asOut([entry], args, true));
    }
    const one = await nextOne(ws, id, harness, models, now, warnings, gate);
    if ('failure' in one) return nextFailure(args, one.failure, id, one.code);
    if ('unmodelled' in one) return nextFailure(args, `no ${harness ?? '(none)'} model for ${one.unmodelled}`, id, 1);
    return said(asOut([one.entry], args, true, one.code));
  }

  const plan = buildPlan(ws.spec, buildIndex(ws.spec), ws.tickets, depsOf(ws));
  const cap = ws.config?.maxParallel ?? null;
  const nowPlan = cap === null ? plan.now : plan.now.slice(0, cap);
  const candidates = nowPlan.filter((item) => item.stage !== null);
  const entries: NextEntry[] = [];
  let code = 0;
  let startWorkspace = ws;
  for (const candidate of candidates) {
    const stage = candidate.stage as Role;
    if (!STAGE_ROLES.includes(stage)) continue;
    const marked = markedBlockers(models, harness, stage);
    if (marked !== null) {
      entries.push({ ticket: candidate.id, action: 'waiting', blockers: marked });
      code = 1;
    } else if (args.start) {
      const result = await startEntry(startWorkspace, candidate.id, stage, harness, models, now, gate, false, warnings);
      if ('code' in result) {
        entries.push({ ticket: candidate.id, action: 'waiting', blockers: [{ text: result.stderr.trim() }] });
        code = 1;
      } else entries.push(result);
      startWorkspace = await loadWorkspace(startWorkspace.specRoot, null, startWorkspace.projectRoot);
    } else {
      const project = ws.ticketGit.current === candidate.id ? ws.projectRoot : worktreeProjectPath(ws, candidate.id);
      const existing = ws.ticketGit.worktrees.has(candidate.id) ? await workspaceAt(ws, project) : ws;
      const result = delegateEntry(existing, candidate.id, stage, project, harness, models, args.summary ? null : gate, true);
      if ('code' in result) {
        entries.push({ ticket: candidate.id, action: 'waiting', blockers: [{ text: result.stderr.trim() }] });
        code = 1;
      } else entries.push(result);
    }
  }
  return said(asOut(entries, args, false, code, !args.start, args.summary));
}

/** Puts what the starts said on stderr, one line each; stdout stays as it was. */
const withWarnings = (out: Out, warnings: readonly string[]): Out => (warnings.length === 0 ? out : { ...out, stderr: `${out.stderr}${warnings.map((w) => `${w}\n`).join('')}` });
