import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { InvalidSkillPointer, resolveProjectRoot, resolveSpecRoot } from '../io/root';
import { parseConfig } from '../core/parse/tickets';
import { loadWorkspace } from '../io/workspace';
import { currentBranch, withCommandGitCache } from '../io/git';
import { type Args, USAGE, parseArgs } from './args';
import { cmdBrief } from './brief';
import { cmdBuild, cmdFind, cmdImpact, cmdLint, cmdShow } from './commands';
import { type Out, ok, usageError } from './output';
import { STAGE_HOOK_EVENTS, couldNotPrepare, isShellPayload, namesShellTool, stageRequestIn } from '../adapters/claude-code/hooks';
import { cmdHook } from './claude-code';
import { cmdInit, cmdUpgrade } from './init';
import { cmdDetect } from './detect';
import { cmdConfigSet } from './config-set';
import { cmdAdvance, cmdCheckReport, cmdTest } from './report';
import { cmdStats } from './stats';
import { cmdGate, cmdPlan, cmdQueue, cmdTicket } from './tickets';
import { cmdConfirm, cmdGaps } from './adopt';
import { cmdMerge } from './merge';
import { cmdWorktree } from './worktree';
import { cmdNext, nextFailure } from './next';
import { cmdBypass, cmdGitHook, cmdVerifyHistory } from './enforcement';
import { VERSION } from './version';

export interface RunEnv {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly scriptPath: string | undefined;
  /** Read only by commands that take a message on stdin. */
  readonly stdin?: () => Promise<string>;
  /** ISO timestamp for ticket history. */
  readonly now?: () => string;
  /** Writes to standard error at once, for a notice that must reach the caller before the command ends. */
  readonly stderr?: (text: string) => void;
}

const COMMANDS = ['build', 'lint', 'show', 'find', 'impact', 'gate', 'queue', 'plan', 'stats', 'next', 'ticket', 'worktree', 'merge', 'gaps', 'confirm', 'brief', 'check-report', 'test', 'hook', 'upgrade', 'config', 'bypass', 'verify-history'];

const NO_ROOT = 'no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json';

function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    return match ? match.slice(1).map(Number) : null;
  };
  const next = parse(candidate);
  const have = parse(current);
  if (!next || !have) return false;
  for (let i = 0; i < 3; i++) {
    if ((next[i] ?? 0) !== (have[i] ?? 0)) return (next[i] ?? 0) > (have[i] ?? 0);
  }
  return false;
}

function realLauncherPath(scriptPath: string | undefined, cwd: string): string | null {
  if (!scriptPath) return null;
  try {
    return realpathSync(resolve(cwd, scriptPath));
  } catch {
    return null;
  }
}

function pluginLauncher(scriptPath: string | undefined, cwd: string): boolean {
  const launcher = realLauncherPath(scriptPath, cwd);
  return launcher !== null && existsSync(join(dirname(dirname(launcher)), '.claude-plugin/plugin.json'));
}

function projectRootForSpec(specRoot: string): string {
  const path = join(specRoot, 'config.json');
  const config = existsSync(path) ? parseConfig('config.json', readFileSync(path, 'utf8')).config : null;
  return resolveProjectRoot(specRoot, config?.projectRoot);
}

function olderLayoutHook(args: Args, launcher: string, payloadText: string, fallbackCwd: string): Out | null {
  if (args.command !== 'hook') return null;
  if (args.positionals[0] !== 'claude-code' || args.positionals[1] !== 'session-start') return ok('');
  let payload: { agent?: unknown; cwd?: unknown } = {};
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = {
        ...('agent' in parsed ? { agent: parsed.agent } : {}),
        ...('cwd' in parsed ? { cwd: parsed.cwd } : {}),
      };
    }
  } catch {
    // A missing or malformed hook payload still gets the migration line.
  }
  const cwd = typeof payload.cwd === 'string' ? payload.cwd : fallbackCwd;
  if (payload.agent === 'subagent' || currentBranch(cwd)?.startsWith('ticket/')) return ok('');
  const context = `spec here uses an older layout; ask Claude to run "${launcher}" upgrade to migrate`;
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }) + '\n', stderr: '', code: 0 };
}

function commandReadsStdin(args: Args): boolean {
  if (args.command === 'hook') return true;
  if (args.command === 'check-report') return args.reportFile === null;
  if (args.command === 'brief') return args.stdin;
  if (args.command !== 'ticket') return false;
  if (args.positionals[0] === 'new') return args.positionals.length < 2;
  if (args.positionals[0] === 'advance') return args.reportFile === null;
  return false;
}

/** A plugin invocation uses the project's pinned CLI for every project command. */
async function deferToProjectCli(e: RunEnv, args: Args, projectRoot: string): Promise<Out | null> {
  if (e.env.SPEC_CLI_DELEGATED === '1' || args.version || args.command === 'init' || args.command === 'upgrade' || !e.scriptPath || !pluginLauncher(e.scriptPath, e.cwd)) return null;
  const bundled = join(projectRoot, '.spec/bin/spec');
  if (!existsSync(join(projectRoot, '.spec/bin/spec.cjs'))) return null;
  try {
    if (realpathSync(resolve(e.cwd, e.scriptPath)) === realpathSync(bundled)) return null;
  } catch {
    // If either path cannot be resolved, the launcher is not the project's pinned copy.
  }

  const env: Record<string, string | undefined> = { ...process.env, ...e.env, SPEC_CLI_DELEGATED: '1', SPEC_PLUGIN_VERSION: VERSION };
  if (!Object.hasOwn(e.env, 'SPEC_ROOT')) delete env.SPEC_ROOT;
  if (!Object.hasOwn(e.env, 'CLAUDE_PROJECT_DIR')) delete env.CLAUDE_PROJECT_DIR;
  const readsStdin = commandReadsStdin(args);
  const input = readsStdin && e.stdin ? await e.stdin() : undefined;
  // A hook reads the pinned CLI's stderr to decide whether to fail open (INS-016/R19), so it is captured; any other command's
  // stderr goes straight to ours as it is written, so a notice such as PIP-004/R12's reaches the caller before the command ends.
  const live = args.command !== 'hook';
  const result = spawnSync(process.execPath, [bundled, ...e.argv], {
    cwd: e.cwd,
    env,
    ...(readsStdin ? { input } : {}),
    stdio: [readsStdin ? 'pipe' : 'ignore', 'pipe', live ? 'inherit' : 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const hook = args.command === 'hook' && args.positionals[0] === 'claude-code';
  // A spec stage request the pinned CLI cannot prepare is refused, never passed on as the bare request (INS-020/R17).
  const stageRequest = hook && args.positionals[1] === 'before-agent' ? stageRequestIn(input ?? '') : null;
  const refuse = (error: string): Out => {
    const refusal = couldNotPrepare(stageRequest ?? '', error);
    return { stdout: refusal.stdout, stderr: '', code: refusal.exitCode };
  };
  if (result.error || result.signal || result.status === null) {
    const detail = result.error ? result.error.message : 'the delegated process was terminated' + (result.signal ? ' by ' + result.signal : '');
    if (stageRequest !== null) return refuse(`could not run ${bundled}: ${detail}`);
    const message = 'spec: could not run ' + bundled + ': ' + detail + '\n';
    return args.command === 'hook'
      ? { stdout: '', stderr: message, code: 0 }
      : { stdout: '', stderr: message, code: 1 };
  }
  const delegated: Out = { stdout: result.stdout, stderr: live ? '' : result.stderr, code: result.status };
  if (hook && result.status !== 0 && /unknown hook event/.test(`${result.stdout}\n${result.stderr}`)) {
    return stageRequest !== null
      ? refuse("this project's pinned CLI predates the before-agent hook; run .spec/bin/spec upgrade, or drive the stage with spec next and spec ticket advance as before")
      : { stdout: '', stderr: '', code: 0 };
  }
  if (stageRequest !== null && result.status !== 0) return refuse(result.stderr.trim() || `${bundled} exited ${String(result.status)}`);
  // Anything else these hooks fail on goes ahead: exit 1 is a non-blocking error to Claude Code (INS-020/R11).
  if (hook && STAGE_HOOK_EVENTS.includes(args.positionals[1] ?? '') && result.status !== 0) return { stdout: '', stderr: result.stderr, code: 1 };
  // An older pinned CLI can fail while loading its workspace; a plain shell command still runs, an edit keeps the failure (INS-016/R19).
  if (hook && args.positionals[1] === 'before-edit' && result.status !== 0 && namesShellTool(input ?? '')) return { stdout: '', stderr: '', code: 0 };
  if (!hook || args.positionals[1] !== 'session-start') return delegated;
  const version = spawnSync(process.execPath, [bundled, '--version'], { cwd: e.cwd, encoding: 'utf8' });
  const pinnedVersion = /^spec\s+(\S+)/.exec(version.stdout)?.[1];
  return appendPinnedUpgradeHint(delegated, args, pinnedVersion);
}

function appendContextLine(out: Out, line: string): Out {
  try {
    const value: unknown = JSON.parse(out.stdout);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    const specific = (value as Record<string, unknown>).hookSpecificOutput;
    if (!specific || typeof specific !== 'object' || Array.isArray(specific)) return out;
    const output = specific as Record<string, unknown>;
    if (typeof output.additionalContext !== 'string') return out;
    const oldHint = /^spec plugin \S+ is newer than this project's [^:\n]+:.*upgrade[^\n]*$/m;
    output.additionalContext = oldHint.test(output.additionalContext)
      ? output.additionalContext.replace(oldHint, line)
      : output.additionalContext.replace(/\n+$/, '') + '\n' + line;
    return { ...out, stdout: JSON.stringify(value) + '\n' };
  } catch {
    return out;
  }
}

function appendPinnedUpgradeHint(out: Out, args: Args, pinnedVersion: string | undefined): Out {
  if (args.positionals[0] !== 'claude-code' || args.positionals[1] !== 'session-start' || !pinnedVersion || !isNewerVersion(VERSION, pinnedVersion)) return out;
  return appendContextLine(out, `spec plugin ${VERSION} is newer than this project's ${pinnedVersion}: edit/commit/history enforcement needs upgrade; run .spec/bin/spec upgrade`);
}

function appendPluginUpgradeHint(out: Out, args: Args, pluginVersion: string | undefined): Out {
  if (args.positionals[0] !== 'claude-code' || args.positionals[1] !== 'session-start' || !pluginVersion || !isNewerVersion(pluginVersion, VERSION)) return out;
  return appendContextLine(out, `spec plugin ${pluginVersion} is newer than this project's ${VERSION}: edit/commit/history enforcement needs upgrade; run .spec/bin/spec upgrade`);
}


/** Answers the shell; a failure inside the tool becomes an internal error (brief: text on stdout, exit 0). */
export function run(e: RunEnv): Promise<Out> {
  return withCommandGitCache(() => runInCommand(e));
}

async function runInCommand(e: RunEnv): Promise<Out> {
  // Stdin is read once, by whichever step needs it first, so the failure handler below can still see the hook payload.
  const read = e.stdin;
  let payload: Promise<string> | undefined;
  const env: RunEnv = read ? { ...e, stdin: () => (payload ??= read()) } : e;
  try {
    return await runCommand(env);
  } catch (err) {
    // A shell command runs whatever goes wrong in spec, from locating the spec root to loading the workspace; an edit is still stopped (INS-016/R17, INV-014).
    const hook = parseArgs(e.argv);
    if (read && hook.command === 'hook' && hook.positionals[0] === 'claude-code' && hook.positionals[1] === 'before-edit') {
      try {
        if (isShellPayload(await env.stdin?.() ?? '')) return ok('');
      } catch {
        // An unreadable payload is not known to be a shell command: the error below stands.
      }
    }
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const args = parseArgs(e.argv);
    // A stage request is refused with the error; anything else these hooks fail on goes ahead (INS-020/R11, R17).
    if (read && args.command === 'hook' && args.positionals[0] === 'claude-code' && STAGE_HOOK_EVENTS.includes(args.positionals[1] ?? '')) {
      let text = '';
      try {
        text = await env.stdin?.() ?? '';
      } catch {
        // An unreadable payload is no stage request.
      }
      const id = args.positionals[1] === 'before-agent' ? stageRequestIn(text) : null;
      const message = err instanceof Error ? err.message : String(err);
      if (id !== null) {
        const refusal = couldNotPrepare(id, message);
        return { stdout: refusal.stdout, stderr: '', code: refusal.exitCode };
      }
      return { stdout: '', stderr: `spec: internal error: ${message}\n`, code: 1 };
    }
    if (args.command === 'brief') return ok(`spec brief failed: ${detail}\n`);
    if (args.command === 'next' && args.format === 'json') return nextFailure(args, detail, args.positionals[0] ?? '', 2);
    return { stdout: '', stderr: `spec: internal error: ${detail}\n`, code: 2 };
  }
}

async function runCommand(e: RunEnv): Promise<Out> {
  const args: Args = parseArgs(e.argv);
  if ((args.local && !(args.command === 'config' && args.positionals[0] === 'set'))
    || (args.stack !== null && args.command !== 'init')
    || (args.acceptEdits && args.command !== 'init')) {
    return usageError('--local is only valid for config set; --stack and --accept-edits are only valid for init', USAGE);
  }
  if (args.version) return ok(`spec ${VERSION}\n`);
  if (args.help || args.command === null) return ok(USAGE);
  const isBrief = args.command === 'brief';
  // brief always exits 0 and prints problems as text: a failing injected command aborts a Claude Code skill.
  const refuse = (message: string, code: number): Out =>
    isBrief ? ok(`${message}\n\n${USAGE}`) : args.command === 'next' && args.format === 'json' ? nextFailure(args, message, args.positionals[0] ?? '', code) : usageError(message, USAGE, code);
  if (args.errors.length > 0) return refuse(args.errors.join('\n'), 2);
  // init creates the spec root, so it runs before one is looked for.
  if (args.command === 'init') return cmdInit(args, e.cwd, e.scriptPath);
  if (args.command === 'upgrade') return cmdUpgrade(args, e.cwd, e.scriptPath, e.env);
  if (args.command === 'detect') return cmdDetect(args, e.cwd, e.env);
  const unknownCommand = !COMMANDS.includes(args.command);
  if (unknownCommand && !pluginLauncher(e.scriptPath, e.cwd)) return usageError(`unknown command ${args.command}`, USAGE);

  // spec hook exits 2 only to block a tool call, so a spec root it cannot use exits 1 there (INS-007/R1).
  const rootCode = args.command === 'hook' ? 1 : 2;
  let root: string | null;
  try {
    root = resolveSpecRoot({ flag: args.root, env: e.env.SPEC_ROOT, claudeProjectDir: e.env.CLAUDE_PROJECT_DIR, scriptPath: e.scriptPath, cwd: e.cwd });
  } catch (err) {
    if (err instanceof InvalidSkillPointer) return args.command === 'hook' ? ok('') : refuse(err.message, rootCode);
    throw err;
  }
  if (!root || !existsSync(root)) {
    if (args.command === 'hook') return ok('');
    if (unknownCommand) return usageError(`unknown command ${args.command}`, USAGE);
    return refuse(root ? `spec root ${root} does not exist` : NO_ROOT, rootCode);
  }
  const projectRoot = projectRootForSpec(root);
  if (args.command === 'hook' && pluginLauncher(e.scriptPath, e.cwd) && existsSync(join(root, 'config.json')) && !existsSync(join(projectRoot, '.spec/bin/spec.cjs'))) {
    const payload = args.positionals[0] === 'claude-code' && args.positionals[1] === 'session-start' && e.stdin ? await e.stdin() : '';
    return olderLayoutHook(args, realLauncherPath(e.scriptPath, e.cwd) ?? resolve(e.cwd, 'spec'), payload, e.cwd) ?? ok('');
  }
  const delegated = await deferToProjectCli(e, args, projectRoot);
  if (delegated) return delegated;
  if (args.command === 'config') return cmdConfigSet(args, root);
  const ws = await loadWorkspace(root, args.tickets, e.cwd);
  if (unknownCommand) return usageError(`unknown command ${args.command}`, USAGE);
  const readStdin = e.stdin ?? (() => Promise.resolve(''));
  const input = commandReadsStdin(args) ? await readStdin() : '';
  switch (args.command) {
    case 'brief':
      return cmdBrief(ws, args, args.stdin ? input : null);
    case 'build':
      return cmdBuild(ws, args);
    case 'lint':
      return cmdLint(ws, args, e.cwd);
    case 'show':
      return cmdShow(ws, args);
    case 'impact':
      return cmdImpact(ws, args);
    case 'gate':
      return cmdGate(ws, args);
    case 'queue':
      return cmdQueue(ws, args);
    case 'plan':
      return cmdPlan(ws, args);
    case 'stats':
      return cmdStats(ws, args);
    case 'next':
      return cmdNext(ws, args, e.env, e.now ?? (() => new Date().toISOString()));
    case 'worktree':
      return cmdWorktree(ws, args);
    case 'merge':
      return cmdMerge(ws, args, e.stderr);
    case 'gaps':
      return cmdGaps(ws, args, e.stderr);
    case 'confirm':
      return cmdConfirm(ws, args);
    case 'check-report':
      return cmdCheckReport(ws, args, input, e.now ?? (() => new Date().toISOString()), e.stderr);
    case 'test':
      return cmdTest(ws, args, e.stderr);
    case 'hook': {
      if (args.positionals[0] === 'git') return cmdGitHook(ws, { ...args, positionals: args.positionals.slice(1) }, (e.now ?? (() => new Date().toISOString()))());
      const out = await cmdHook(ws, args, input, e.env, e.now ?? (() => new Date().toISOString()));
      return appendPluginUpgradeHint(out, args, e.env.SPEC_PLUGIN_VERSION);
    }
    case 'bypass':
      return cmdBypass(ws, args, e.env, (e.now ?? (() => new Date().toISOString()))());
    case 'verify-history':
      return cmdVerifyHistory(ws, args);
    case 'ticket':
      if (args.positionals[0] === 'advance') return cmdAdvance(ws, args, input, e.now ?? (() => new Date().toISOString()), ws.projectRoot, false, e.stderr);
      return cmdTicket(ws, args, args.positionals[0] === 'new' && args.positionals.length < 2 ? input : '', e.cwd, e.now ?? (() => new Date().toISOString()));
    default:
      return cmdFind(ws, args);
  }
}
