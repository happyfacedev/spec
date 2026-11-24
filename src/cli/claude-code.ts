// hook claude-code <event>: the Claude Code adapter's CLI side.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOOK_EVENTS, type HookOps, type Recorded, STAGE_HOOK_EVENTS, type StageDecision, type StageOps, handleHook, handleStageHook } from '../adapters/claude-code/hooks';
import { describeRoleModel, isClaudeCodeModel } from '../core/delegation';
import { MAX_BOUNCES } from '../core/finish-report';
import { lintSpec } from '../core/lint';
import type { Ticket } from '../core/model';
import { buildQueue } from '../core/queue';
import { extractReport, hasReportBlock } from '../core/report';
import { STAGE_ROLES, type StageRole } from '../core/schemas';
import { buildIndex } from '../core/units';
import { EFFORT_NOT_SENT, type EffortGate, effortGate } from '../io/claude-version';
import { relativeInside } from '../io/fs';
import { loadStageStartRecord } from '../io/ticket-state';
import { type Workspace, reloadWorkspace } from '../io/workspace';
import { type Args, USAGE, parseArgs } from './args';
import { type Out, ok, usageError } from './output';
import { depsOf } from './tickets';
import { beforeEditReason, beforeShellReason, inTicketWorktree, isGovernedPath } from './enforcement';
import { missingGitHookIntegrations } from './git-hooks';
import { roleModels } from './detect';
import { advanceCommandFor, detectHarness, nextForStageRequest, projectCli } from './next';
import { cmdAdvance, rememberedModel } from './report';

/** INS-008/R2: what each stage role would start with now; null when no claude-code model is set or the session is Astro's. */
function modelsLine(ws: Workspace, env: Readonly<Record<string, string | undefined>>): string | null {
  if (ws.config === null || Object.keys(ws.delegation['claude-code'] ?? {}).length === 0 || detectHarness(null, env) === 'astro') return null;
  const gate = effortGate(env);
  const roles = roleModels(ws, 'claude-code', gate).map(describeRoleModel);
  return `Models: ${[...roles, ...(gate.notice() === null ? [] : [`effort ${EFFORT_NOT_SENT}`])].join(' · ')}`;
}

function hookOps(ws: Workspace, env: Readonly<Record<string, string | undefined>>, now: () => string): HookOps {
  const index = buildIndex(ws.spec);
  return {
    queue: () => {
      const q = buildQueue(ws.spec, index, ws.tickets, depsOf(ws));
      const waitingForPerson = q.blocked.filter((entry) => entry.reason?.startsWith('question ')).length;
      const blocked = q.waiting.length + q.blocked.length - waitingForPerson;
      const context = [
        'This repository is run by spec: every change to behaviour, spec or tests goes through a ticket.',
        'New behaviour /spec:feature, changed behaviour /spec:change, broken behaviour /spec:bug; questions about the spec: /spec:brief <words>.',
        'Run `.spec/bin/spec queue` for the full queue.',
        `Queue: ${q.ready.length} ready · ${q.inProgress.length} in progress · ${waitingForPerson} waiting for a person · ${blocked} blocked.`,
      ];
      const models = modelsLine(ws, env);
      if (models !== null) context.push(models);
      const missingHooks = missingGitHookIntegrations(ws.projectRoot);
      if (missingHooks.length > 0) context.push(`Git enforcement hooks are missing or not integrated (${missingHooks.join(', ')}); run .spec/bin/spec upgrade and add the reported hook lines.`);
      return context.join('\n');
    },
    sessionSilent: (cwd) => inTicketWorktree(ws, cwd),
    beforeEdit: (path, cwd) => beforeEditReason(ws, path, cwd, now()),
    beforeShell: (command, cwd) => beforeShellReason(ws, command, cwd),
    governed: (path, cwd) => isGovernedPath(ws, resolve(cwd, path)),
    lintFile: (path) => {
      const abs = resolve(ws.projectRoot, path);
      const ticket = relativeInside(abs, ws.ticketsDir);
      const file = ticket !== null ? `${ws.ticketsRel}/${ticket}` : relativeInside(abs, ws.specRoot);
      if (file === null) return null;
      return lintSpec(ws.spec, { tickets: ws.tickets, files: [file], budgets: ws.config?.budgets ?? {} });
    },
  };
}

const runningStage = (ticket: Ticket | undefined): StageRole | null =>
  ticket?.data.status === 'in_progress' && ticket.data.stage !== null && STAGE_ROLES.includes(ticket.data.stage) ? ticket.data.stage : null;

/** R3, R19: a running stage is never delegated again; the reason names the relay of an unrecorded report, the restart and what a refused launch needs. */
function runningReason(ws: Workspace, id: string, role: StageRole): string {
  const cli = projectCli(ws);
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  const model = ticket === undefined ? undefined : rememberedModel(ticket, role, loadStageStartRecord(ws.projectRoot, id, role));
  return [
    `${id} already has its ${role} stage running; do not delegate it again.`,
    `Wait for the subagent running that stage to return. Only once you have confirmed that no subagent is running it: if that stage's subagent has finished, its report was not recorded, so write its final message with your file tool to the report path in \`${advanceCommandFor(ws, id, role)}\` and run that command from the project root;`,
    `otherwise run \`${cli} next ${id} --restart\` and delegate the task it returns with its model and effort, to run the stage again.`,
    // The record is only shown, and only as an alias spec itself would choose (INV-017).
    ...(isClaudeCodeModel(model) ? [
      `The stage was started on ${model}. Only once you have confirmed that no subagent is running it, and only when Claude Code's own error for the launch names ${model} as a model that cannot be used: run \`${cli} config set unavailableModels.${model} true --local\` and then \`${cli} next ${id} --restart\`, call Agent with a general-purpose subagent, that result's task as prompt, its model as model and, when it is set and the Agent tool takes one, its effort as effort, and tell the person that ${model} was skipped, why, and that \`${cli} config set unavailableModels.${model} false --local\` unmarks it.`,
      'When the error names another model or none, or is a usage limit, an outage or any other failure, mark nothing and take the failure to the person.',
    ] : []),
  ].join(' ');
}

/** INS-020/R1 to R5, R17, R19: `spec next <ID> --harness claude-code` as a decision on the Agent call. */
async function prepareStage(ws: Workspace, id: string, now: () => string, warnings: string[], gate: EffortGate): Promise<StageDecision> {
  const deny = (reason: string): StageDecision => ({ allow: false, reason });
  const cli = projectCli(ws);
  const again = `then call Agent with "spec:${id}" again`;
  const running = runningStage(ws.tickets.tickets.find((t) => t.id === id));
  if (running !== null) return deny(runningReason(ws, id, running));
  const one = await nextForStageRequest(ws, id, now, warnings, gate);
  if ('unmodelled' in one) {
    const role = one.unmodelled;
    return deny(`${id}'s next stage is ${role}, and no valid claude-code model is set for the ${role}; the stage has not started. Ask the person which model runs it: sonnet, opus, haiku or fable. Save the choice with \`${cli} config set delegation.claude-code.${role} <model> --local\`, ${again}.`);
  }
  if ('failure' in one) {
    // Another request may have started the stage while this one waited for it (R5).
    const fresh = await reloadWorkspace(ws);
    const started = runningStage(fresh.tickets.tickets.find((t) => t.id === id));
    return deny(started !== null ? runningReason(fresh, id, started) : `spec could not prepare ${id}: ${one.failure}`);
  }
  const entry = one.entry;
  switch (entry.action) {
    case 'delegate':
      return entry.task !== undefined && entry.role !== undefined
        ? { allow: true, task: entry.task, role: entry.role, model: entry.model ?? null, effort: entry.effort ?? null, notice: gate.notice() }
        : deny(`spec could not prepare ${id}: spec next gave no task`);
    case 'merge':
      return deny(`${id} has finished its stages and is ready to merge: run \`${cli} merge ${id}\` and tell the person whether it merged or was refused, and why.`);
    case 'done':
      return deny(`${id} is merged; there is no stage left to delegate.`);
    case 'error':
      return deny(`spec could not prepare ${id}: ${(entry.blockers ?? []).map((b) => b.text).join('; ')}`);
    case 'waiting': {
      const questions = entry.questions ?? [];
      const others = (entry.blockers ?? []).filter((b) => b.kind !== 'question');
      const lines = [
        ...questions.map((q) => `- question ${q.id}: ${q.text} (record the answer with \`${cli} ticket answer ${id} ${q.id} "<answer>"\`)`),
        ...others.map((b) => `- ${b.kind ? `${b.kind} ` : ''}${b.id ? `${b.id}: ` : ''}${b.text}`),
      ];
      const what = questions.length > 0
        ? `Ask the person each question, one at a time, record each answer with \`${cli} ticket answer ${id} <Q> "<answer>"\`, ${again}.`
        : 'Explain these blockers to the person; nothing starts while one is open.';
      return deny(`${id} cannot start its next stage yet:\n${lines.join('\n')}\n${what}`);
    }
  }
}

/** The ticket and role a report block names; read loosely when the block does not validate, so the advance check refuses it (R6, INV-019). */
function reportTarget(message: string): { ticket: string; role: string } | null {
  const report = extractReport(message).report;
  if (report !== null) return { ticket: report.ticket, role: report.role };
  if (!hasReportBlock(message)) return null;
  const block = /^ {0,3}(?:`{3,}|~{3,})\s*report\s*\n([\s\S]*?)(?:^ {0,3}(?:`{3,}|~{3,})\s*$|(?![\s\S]))/m.exec(message)?.[1] ?? '';
  const field = (key: string) => new RegExp(`^\\s*${key}:\\s*["']?([A-Za-z0-9-]+)`, 'm').exec(block)?.[1];
  const ticket = field('ticket');
  const role = field('role');
  return ticket !== undefined && role !== undefined ? { ticket, role } : null;
}

/** R18: the ticket's latest stage record is this role's and no stage of it is running. */
const justRecorded = (ticket: Ticket | undefined, role: string): boolean =>
  ticket !== undefined && !(ticket.data.status === 'in_progress' && ticket.data.stage !== null) && ticket.data.history.at(-1)?.role === role;

interface AdvancedJson { status?: unknown; problems?: unknown; attempt?: unknown }

/** INS-020/R6 to R10, R15 to R18: a report for the running stage, recorded through `spec ticket advance <ID> --report -`. */
async function recordStage(ws: Workspace, args: Args, message: string, now: () => string): Promise<Recorded> {
  const target = reportTarget(message);
  if (target === null) return { kind: 'none' };
  const { ticket: id, role } = target;
  const ticket = ws.tickets.tickets.find((t) => t.id === id);
  if (ticket === undefined) return { kind: 'none' };
  if (runningStage(ticket) !== role) return justRecorded(ticket, role) ? { kind: 'already', ticket: id, role } : { kind: 'none' };
  const advance: Args = { ...parseArgs(['ticket', 'advance', id, '--report', '-', '--format', 'json']), root: args.root, tickets: args.tickets };
  const out = await cmdAdvance(ws, advance, message, now);
  if (out.code === 0) return { kind: 'accepted' };
  let parsed: AdvancedJson | null = null;
  try {
    parsed = JSON.parse(out.stdout) as AdvancedJson;
  } catch {
    // Not a report answer: the stage was not checked (below).
  }
  const problems = Array.isArray(parsed?.problems) ? parsed.problems.filter((p): p is string => typeof p === 'string') : [];
  if (parsed !== null && out.code === 3) return { kind: 'unchecked', reason: `the check could not run: ${problems.join('; ')}` };
  if (parsed !== null && out.code === 1) {
    if (parsed.status === 'blocked') return { kind: 'blocked', ticket: id, problems };
    return { kind: 'refused', attempt: typeof parsed.attempt === 'number' ? parsed.attempt : 1, max: MAX_BOUNCES, problems };
  }
  // Another advance recorded the stage while this one waited for its turn (R10).
  const fresh = (await reloadWorkspace(ws)).tickets.tickets.find((t) => t.id === id);
  if (justRecorded(fresh, role)) return { kind: 'already', ticket: id, role };
  return { kind: 'failed', error: `${id} ${role} report was not recorded: ${(out.stderr || out.stdout).trim()}` };
}

function stageOps(ws: Workspace, args: Args, env: Readonly<Record<string, string | undefined>>, now: () => string, warnings: string[]): StageOps {
  return {
    prepare: (id) => prepareStage(ws, id, now, warnings, effortGate(env)),
    record: (message) => recordStage(ws, args, message, now),
    readTranscript: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null;
      }
    },
    subagentContext: () => 'spec: if your whole task is "spec:<ticket ID>" and nothing else, your brief did not arrive, so make no change and reply only "spec brief missing for <ticket ID>".',
  };
}

export async function cmdHook(ws: Workspace, args: Args, stdin: string, env: Readonly<Record<string, string | undefined>>, now: () => string): Promise<Out> {
  const [harness, event] = args.positionals;
  if (harness !== 'claude-code') return usageError(`unknown harness ${harness ?? '(none)'}; supported: claude-code`, USAGE, 1);
  // Keep settings from older pins safe after X139 removed these events.
  if (event === 'before-delegate' || event === 'before-finish') return ok('');
  if (!event || !(HOOK_EVENTS as readonly string[]).includes(event)) return usageError(`unknown hook event ${event ?? '(none)'}; events: ${HOOK_EVENTS.join(', ')}`, USAGE, 1);
  let input: unknown = {};
  if (stdin.trim() !== '') {
    try {
      input = JSON.parse(stdin);
    } catch {
      return { stdout: '', stderr: 'spec hook: the hook input is not JSON\n', code: 1 };
    }
  }
  if (STAGE_HOOK_EVENTS.includes(event)) {
    const warnings: string[] = [];
    const result = await handleStageHook(event, input, stageOps(ws, args, env, now, warnings));
    return { stdout: result.stdout, stderr: `${warnings.map((w) => `${w}\n`).join('')}${result.stderr}`, code: result.exitCode };
  }
  const result = handleHook(event, input, hookOps(ws, env, now));
  return { stdout: result.stdout, stderr: result.stderr, code: result.exitCode };
}
