// The Claude Code adapter translates hook payloads; the shared guard decides edit authorization.
import { z } from 'zod';
import type { Finding } from '../../core/findings';
import { PATTERNS } from '../../core/ids';

export const HOOK_EVENTS = ['session-start', 'before-edit', 'after-edit', 'before-agent', 'before-handback', 'subagent-start', 'subagent-stop'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];
/** The events that delegate and record a ticket stage (INS-020); a failure to run them never blocks what is not a stage request (R11). */
export const STAGE_HOOK_EVENTS: readonly string[] = ['before-agent', 'before-handback', 'subagent-start', 'subagent-stop'];

export interface HookOps {
  queue(): string;
  sessionSilent(cwd: string): boolean;
  beforeEdit(path: string, cwd: string): string | null;
  /** The reason a shell command is refused, or null when it plainly writes no file tracked in a ticket worktree. */
  beforeShell(command: string, cwd: string): string | null;
  /** A quick classification used only when beforeEdit itself errors. */
  governed(path: string, cwd: string): boolean;
  /** Lint findings for one edited file, or null when the file is outside the spec and tickets. */
  lintFile(path: string): Finding[] | null;
}

export interface HookResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const out = (value: unknown): HookResult => ({ exitCode: 0, stdout: `${JSON.stringify(value)}\n`, stderr: '' });
const nothing: HookResult = { exitCode: 0, stdout: '', stderr: '' };
const unknownEvent = (event: string): HookResult => ({ exitCode: 1, stdout: '', stderr: `unknown hook event ${event}; events: ${HOOK_EVENTS.join(', ')}\n` });

const PreToolUse = z.object({
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  astro_tool_name: z.string().optional(),
  astro_tool_input: z.record(z.string(), z.unknown()).optional(),
  cwd: z.string().optional(),
  agent: z.string().optional(),
}).loose();
const PostToolUse = z.object({ tool_name: z.string(), tool_input: z.object({ file_path: z.string().optional() }).loose() });

function deny(reason: string): HookResult {
  return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'mcp__astro__edit', 'mcp__astro__write'];
const EDIT_INPUTS = ['file_path', 'notebook_path', 'path', 'edits', 'cells'];

/**
 * A shell call: some tool name says Bash and none says an edit, and no input has an edit's shape.
 * A payload that is both stays an edit, and is checked as one.
 */
function isShellTool(p: z.infer<typeof PreToolUse>): boolean {
  const names = [p.tool_name, p.astro_tool_name];
  if (names.some((name) => name !== undefined && EDIT_TOOLS.includes(name))) return false;
  if (!names.some((name) => name === 'Bash' || name === 'mcp__astro__bash')) return false;
  return ![p.tool_input, p.astro_tool_input].some((input) => input !== undefined && EDIT_INPUTS.some((key) => key in input));
}

/** Whether a hook payload is a Claude Code Bash or Astro bash call, which runs whatever goes wrong in spec (INS-016/R17). */
export function isShellPayload(text: string): boolean {
  try {
    const p = PreToolUse.safeParse(JSON.parse(text));
    return p.success && isShellTool(p.data);
  } catch {
    return false;
  }
}

/**
 * Whether a hook payload plainly names a shell tool: tool_name "Bash" with astro_tool_name absent or "mcp__astro__bash", or astro_tool_name "mcp__astro__bash" with tool_name absent or "Bash".
 * Looser than isShellPayload on shape (the pinned CLI, not this check, validates the payload), stricter on names (INS-016/R19).
 */
export function namesShellTool(text: string): boolean {
  try {
    const p: unknown = JSON.parse(text);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    const { tool_name: tool, astro_tool_name: astro } = p as Record<string, unknown>;
    // Either name alone, or both agreeing; any other or conflicting name (an edit, a read, ...) is not plainly a shell call.
    const toolOk = tool === undefined || tool === 'Bash';
    const astroOk = astro === undefined || astro === 'mcp__astro__bash';
    return toolOk && astroOk && (tool === 'Bash' || astro === 'mcp__astro__bash');
  } catch {
    return false;
  }
}

/** A shell command is only ever allowed or refused for one call; whatever goes wrong, it runs (INS-016/R17). */
function beforeShell(p: z.infer<typeof PreToolUse>, ops: HookOps): HookResult {
  const command = [p.tool_input.command, p.astro_tool_input?.command].find((c): c is string => typeof c === 'string');
  if (command === undefined) return nothing;
  try {
    const reason = ops.beforeShell(command, p.cwd ?? process.cwd());
    return reason ? deny(reason) : nothing;
  } catch {
    return nothing;
  }
}

function beforeEdit(input: unknown, ops: HookOps): HookResult {
  const p = PreToolUse.safeParse(input);
  if (p.success && isShellTool(p.data)) return beforeShell(p.data, ops);
  const astroNames = ['mcp__astro__edit', 'mcp__astro__write'];
  if (!p.success || (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit', ...astroNames].includes(p.data.tool_name) && !astroNames.includes(p.data.astro_tool_name ?? ''))) return nothing;
  const toolInput = p.data.tool_input;
  const astroInput = p.data.astro_tool_input;
  const paths = [toolInput.file_path, toolInput.notebook_path, toolInput.path, astroInput?.file_path]
    .filter((path): path is string => typeof path === 'string');
  for (const edits of [toolInput.edits, toolInput.cells]) {
    if (!Array.isArray(edits)) continue;
    for (const edit of edits as unknown[]) {
      const filePath = typeof edit === 'object' && edit !== null && 'file_path' in edit
        ? (edit as { file_path?: unknown }).file_path
        : undefined;
      if (typeof filePath === 'string') paths.push(filePath);
    }
  }
  const cwd = p.data.cwd ?? process.cwd();
  for (const path of new Set(paths)) {
    try {
      const reason = ops.beforeEdit(path, cwd);
      if (reason) return deny(reason);
    } catch (error) {
      let governed = true;
      try {
        governed = ops.governed(path, cwd);
      } catch {
        // If classification also fails, do not silently authorize an edit.
      }
      if (governed) {
        const detail = error instanceof Error ? error.message : String(error);
        return deny(`spec could not check this edit: ${detail}; fix spec or ask the person for a bypass`);
      }
    }
  }
  return nothing;
}

function afterEdit(input: unknown, ops: HookOps): HookResult {
  const p = PostToolUse.safeParse(input);
  const path = p.success ? p.data.tool_input.file_path : undefined;
  if (!p.success || !['Edit', 'Write', 'MultiEdit'].includes(p.data.tool_name) || !path) return nothing;
  const findings = ops.lintFile(path);
  if (!findings || !findings.some((f) => f.severity === 'error')) return nothing;
  const lines = findings.map((f) => `${f.file}:${f.line} ${f.severity} ${f.rule}${f.id ? ` ${f.id}` : ''}: ${f.message}\n  fix: ${f.fix}`);
  return { exitCode: 2, stdout: '', stderr: `spec lint found problems after this edit:\n${lines.join('\n')}\n` };
}

/**
 * What `spec next` gives a stage request: the call runs as the stage's task, model and effort, or is refused with what
 * to do. `notice` is for the person.
 */
export type StageDecision = { readonly allow: true; readonly task: string; readonly role: string; readonly model: string | null; readonly effort: string | null; readonly notice: string | null } | { readonly allow: false; readonly reason: string };

/** What recording a handed-back or final message did (INS-020/R6 to R10, R15 to R18). */
export type Recorded =
  | { readonly kind: 'none' }
  | { readonly kind: 'accepted' }
  | { readonly kind: 'already'; readonly ticket: string; readonly role: string }
  | { readonly kind: 'refused'; readonly attempt: number; readonly max: number; readonly problems: readonly string[] }
  | { readonly kind: 'blocked'; readonly ticket: string; readonly problems: readonly string[] }
  | { readonly kind: 'unchecked'; readonly reason: string }
  | { readonly kind: 'failed'; readonly error: string };

export interface StageOps {
  /** `spec next <ID> --harness claude-code`, as a decision on the Agent call. */
  prepare(id: string): Promise<StageDecision>;
  /** The message's report block, recorded as `spec ticket advance <ID> --report -` records it when its stage is running. */
  record(message: string): Promise<Recorded>;
  /** A subagent transcript's text, or null when it cannot be read. */
  readTranscript(path: string): string | null;
  /** The one line of context every subagent gets (INS-020/R20). */
  subagentContext(): string;
}

const AgentCall = z.object({ tool_name: z.string(), tool_input: z.record(z.string(), z.unknown()) }).loose();
const HandbackCall = z.object({ tool_name: z.literal('SubagentHandback'), tool_input: z.object({ message: z.unknown().optional() }).loose() }).loose();
const SubagentStop = z.object({ last_assistant_message: z.unknown().optional(), agent_transcript_path: z.unknown().optional() }).loose();

/**
 * The ticket an Agent or Task call asks for: its prompt, trimmed, is exactly `spec:` and a ticket ID (INS-020/R1).
 * Nothing else in the prompt is read (INV-019).
 */
export function stageRequestOf(input: unknown): { id: string; toolInput: Record<string, unknown> } | null {
  const p = AgentCall.safeParse(input);
  if (!p.success || (p.data.tool_name !== 'Agent' && p.data.tool_name !== 'Task')) return null;
  const prompt = p.data.tool_input.prompt;
  if (typeof prompt !== 'string') return null;
  const id = /^spec:(.+)$/.exec(prompt.trim())?.[1];
  return id !== undefined && PATTERNS.ticket.test(id) ? { id, toolInput: p.data.tool_input } : null;
}

/** The ticket a raw before-agent payload requests, or null when it is not JSON or not a stage request. */
export function stageRequestIn(text: string): string | null {
  try {
    return stageRequestOf(JSON.parse(text))?.id ?? null;
  } catch {
    return null;
  }
}

/** A stage request the hook could not prepare is refused, never passed on as the bare request (INS-020/R17). */
export function couldNotPrepare(id: string, error: string): HookResult {
  return deny(`spec could not prepare ${id}: ${error}`);
}

/** The last assistant text of a Claude Code transcript (JSONL lines of {type, message: {role, content}}). */
export function lastAssistantText(jsonl: string): string | null {
  let last: string | null = null;
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (value === null || typeof value !== 'object') continue;
    const message = (value as { message?: unknown }).message;
    if (message === null || typeof message !== 'object' || (message as { role?: unknown }).role !== 'assistant') continue;
    const content = (message as { content?: unknown }).content;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.filter((b): b is { type: 'text'; text: string } => typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string').map((b) => b.text).join('\n')
        : '';
    if (text.trim() !== '') last = text;
  }
  return last;
}

const allow = (extra: Record<string, unknown> = {}, systemMessage?: string): HookResult =>
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', ...extra }, ...(systemMessage === undefined ? {} : { systemMessage }) });
const failed = (error: string): HookResult => ({ exitCode: 1, stdout: '', stderr: `spec hook: ${error}\n` });
const refusedText = (r: { attempt: number; max: number; problems: readonly string[] }): string =>
  `report refused (attempt ${String(r.attempt)} of ${String(r.max)}):\n${r.problems.map((p) => `- ${p}`).join('\n')}`;
const blockedText = (r: { ticket: string; problems: readonly string[] }): string =>
  `${r.ticket} is blocked: its report was refused for the last time${r.problems.length > 0 ? ` (${r.problems.join('; ')})` : ''}, and its work is stashed; run .spec/bin/spec gate ${r.ticket} to see what to resolve.`;

async function beforeAgent(input: unknown, ops: StageOps): Promise<HookResult> {
  const request = stageRequestOf(input);
  if (request === null) return nothing;
  let decision: StageDecision;
  try {
    decision = await ops.prepare(request.id);
  } catch (error) {
    return couldNotPrepare(request.id, error instanceof Error ? error.message : String(error));
  }
  if (!decision.allow) return deny(decision.reason);
  // Every other key, the agent type and an effort spec does not set among them, is passed back as given (INV-019).
  const updatedInput = {
    ...request.toolInput,
    prompt: decision.task,
    description: `${request.id} ${decision.role}`,
    ...(decision.model === null ? {} : { model: decision.model }),
    ...(decision.effort === null ? {} : { effort: decision.effort }),
  };
  return allow({ updatedInput }, decision.notice ?? undefined);
}

async function recordSafely(message: string, ops: StageOps): Promise<Recorded> {
  try {
    return await ops.record(message);
  } catch (error) {
    return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

async function beforeHandback(input: unknown, ops: StageOps): Promise<HookResult> {
  const p = HandbackCall.safeParse(input);
  const message = p.success ? p.data.tool_input.message : undefined;
  if (typeof message !== 'string' || message.trim() === '') return nothing;
  const r = await recordSafely(message, ops);
  switch (r.kind) {
    case 'none':
      return nothing;
    case 'accepted':
      return allow();
    case 'already':
      return allow({}, `${r.ticket} ${r.role} report already recorded`);
    case 'refused':
      return deny(`${refusedText(r)}\nFix each problem, then hand back again with your corrected report block.`);
    case 'blocked':
      return allow({}, blockedText(r));
    case 'unchecked':
      return deny(`${r.reason}\nNothing was recorded and no attempt was used. Hand back again with the same report block; if the check keeps failing, hand back a blocked report naming the reason.`);
    case 'failed':
      return failed(r.error);
  }
}

async function subagentStop(input: unknown, ops: StageOps): Promise<HookResult> {
  const p = SubagentStop.safeParse(input);
  if (!p.success) return nothing;
  let message = typeof p.data.last_assistant_message === 'string' ? p.data.last_assistant_message : '';
  if (message.trim() === '' && typeof p.data.agent_transcript_path === 'string') {
    const jsonl = ops.readTranscript(p.data.agent_transcript_path);
    message = jsonl === null ? '' : lastAssistantText(jsonl) ?? '';
  }
  if (message.trim() === '') return nothing;
  const r = await recordSafely(message, ops);
  switch (r.kind) {
    case 'none':
    case 'accepted':
      return nothing;
    case 'already':
      return out({ systemMessage: `${r.ticket} ${r.role} report already recorded` });
    case 'refused':
      return out({ decision: 'block', reason: `${refusedText(r)}\nFix each problem, then end again with your corrected report block.` });
    case 'blocked':
      return out({ systemMessage: blockedText(r) });
    case 'unchecked':
      return out({ decision: 'block', reason: `${r.reason}\nNothing was recorded and no attempt was used. End again with the same report block; if the check keeps failing, end with a blocked report naming the reason.` });
    case 'failed':
      return failed(r.error);
  }
}

/** The hooks that delegate a stage request and record its report (INS-020). */
export async function handleStageHook(event: string, input: unknown, ops: StageOps): Promise<HookResult> {
  switch (event) {
    case 'before-agent':
      return beforeAgent(input, ops);
    case 'before-handback':
      return beforeHandback(input, ops);
    case 'subagent-start':
      return out({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: ops.subagentContext() } });
    case 'subagent-stop':
      return subagentStop(input, ops);
    default:
      return unknownEvent(event);
  }
}

export function handleHook(event: string, input: unknown, ops: HookOps): HookResult {
  switch (event) {
    case 'session-start': {
      const payload = input !== null && typeof input === 'object' ? input as { agent?: unknown; cwd?: unknown } : {};
      const cwd = typeof payload.cwd === 'string' ? payload.cwd : process.cwd();
      if (payload.agent === 'subagent' || ops.sessionSilent(cwd)) return nothing;
      return out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ops.queue() } });
    }
    case 'before-edit':
      return beforeEdit(input, ops);
    case 'after-edit':
      return afterEdit(input, ops);
    case 'before-delegate':
    case 'before-finish':
      return nothing;
    default:
      return unknownEvent(event);
  }
}
