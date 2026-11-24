// Repository-wide turns for the test commands started by spec.
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { tmpdir, uptime } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PATTERNS } from '../core/ids';
import { parseTestReport, type TestRun } from '../core/test-report';
import { commonDir } from './git';
import { runTestCommand, TEST_TIMEOUT_MS } from './test-command';

const builtinSpawnSync = process.getBuiltinModule('node:child_process').spawnSync;

export const TEST_RUN_COMMANDS = ['spec test', 'spec check-report', 'spec ticket advance', 'spec merge', 'spec gaps'] as const;
export type TestRunCommand = (typeof TEST_RUN_COMMANDS)[number];

const MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_NOTICE_INTERVAL_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const GATE = '.turn-gate';
const NESTED_ENV = 'SPEC_TEST_RUN_PARENT';
const TIMEOUT_ENV = 'SPEC_TEST_RUN_TIMEOUT_MS';
const NOTICE_INTERVAL_ENV = 'SPEC_TEST_RUN_NOTICE_INTERVAL_MS';
const POLL_INTERVAL_ENV = 'SPEC_TEST_RUN_POLL_INTERVAL_MS';

function lowerMilliseconds(environment: NodeJS.ProcessEnv, key: string, defaultValue: number): number {
  const setting = environment[key];
  if (setting === undefined || !/^[0-9]+$/.test(setting)) return defaultValue;
  const value = Number(setting);
  return Number.isSafeInteger(value) && value > 0 && value < defaultValue ? value : defaultValue;
}

interface TurnRecord {
  readonly pid: number;
  readonly command: string;
  readonly ticket: string | null;
  readonly startedAt: string;
  readonly location?: 'main' | 'worktree' | 'ticket';
}

interface ParentMarker {
  readonly pid: number;
  readonly repository: string;
}

export interface TestRunTurnOptions {
  readonly command: TestRunCommand;
  readonly maxTestRuns: number;
  readonly ticket: string | null;
  readonly location: 'main' | 'worktree' | 'ticket';
  readonly stderr?: (text: string) => void;
  readonly beforeStart?: () => void;
  /** A run outside the repository (a proof run) takes its turn in the repository of this folder. */
  readonly repositoryRoot?: string;
  /** Called when the run has ended, also when it is interrupted, before the process ends by the signal. */
  readonly onEnd?: () => void;
}

export interface TestRunTurnResult {
  readonly run: TestRun;
  /** Waiting notices when there was no live stderr writer. */
  readonly stderr: string;
}

export function testRunLocation(projectRoot: string, ticket: string | null): 'main' | 'worktree' | 'ticket' {
  if (ticket !== null && PATTERNS.ticket.test(ticket)) return 'ticket';
  try {
    return lstatSync(join(projectRoot, '.git')).isFile() ? 'worktree' : 'main';
  } catch {
    return 'main';
  }
}

export function testRunTicket(ticket: string | null): string | null {
  return ticket !== null && PATTERNS.ticket.test(ticket) ? ticket : null;
}

interface Holder {
  readonly pid: number;
  readonly record: TurnRecord | null;
}

export interface ShellResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

const signalCode = (signal: NodeJS.Signals): number => (signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143);

// The source CLI's tsx launcher is the process callers observe while its TypeScript entrypoint runs.
function turnProcessId(): number {
  const sourceEntry = process.argv[1]?.endsWith('.ts') ?? false;
  return sourceEntry && process.ppid > 1 ? process.ppid : process.pid;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function canonicalRepository(projectRoot: string): string | null {
  const repository = commonDir(projectRoot);
  if (repository === null) return null;
  try {
    return realpathSync(resolve(projectRoot, repository));
  } catch {
    return null;
  }
}

function recordFile(runDir: string, pid: number): string {
  return join(runDir, String(pid));
}

function validStartedAt(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year ?? 0, (month ?? 0) - 1, day ?? 0);
  date.setUTCHours(hour ?? -1, minute ?? -1, second ?? -1, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 0) - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function parsedRecord(path: string, pid: number): TurnRecord | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Partial<TurnRecord>;
    const fields = Object.keys(record);
    if (fields.some((field) => !['pid', 'command', 'ticket', 'startedAt', 'location'].includes(field))) return null;
    if (record.pid !== pid || typeof record.command !== 'string' || !(record.ticket === null || typeof record.ticket === 'string')) return null;
    if (typeof record.startedAt !== 'string' || !validStartedAt(record.startedAt)) return null;
    if (record.location !== undefined && !['ticket', 'main', 'worktree'].includes(record.location)) return null;
    return record as TurnRecord;
  } catch {
    return null;
  }
}

function recordIsFree(path: string, pid: number, bootTime: number): boolean {
  try {
    if (statSync(path).mtimeMs <= bootTime || parsedRecord(path, pid) === null) return true;
    return !processAlive(pid);
  } catch {
    return true;
  }
}

function reapStale(runDir: string): void {
  const bootTime = new Date().getTime() - uptime() * 1000;
  for (const entry of readdirSync(runDir)) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (!Number.isSafeInteger(pid) || pid < 1) continue;
    const path = recordFile(runDir, pid);
    if (recordIsFree(path, pid, bootTime)) rmSync(path, { recursive: true, force: true });
  }
}

function compareFileAge(a: string, b: string): number {
  try {
    const left = statSync(a, { bigint: true }).mtimeNs;
    const right = statSync(b, { bigint: true }).mtimeNs;
    return left < right ? -1 : left > right ? 1 : a.localeCompare(b, undefined, { numeric: true });
  } catch {
    return a.localeCompare(b, undefined, { numeric: true });
  }
}

function holdersInOrder(runDir: string): Holder[] {
  return readdirSync(runDir)
    .filter((entry) => /^\d+$/.test(entry) && Number.isSafeInteger(Number(entry)) && Number(entry) > 0)
    .sort((a, b) => compareFileAge(recordFile(runDir, Number(a)), recordFile(runDir, Number(b))))
    .map((entry) => {
      const pid = Number(entry);
      return { pid, record: parsedRecord(recordFile(runDir, pid), pid) };
    });
}

function liveHoldersInOrder(runDir: string): Holder[] {
  const bootTime = new Date().getTime() - uptime() * 1000;
  return holdersInOrder(runDir).filter(({ pid }) => !recordIsFree(recordFile(runDir, pid), pid, bootTime));
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ');
}

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && typeof (error as NodeJS.ErrnoException).code === 'string';
}

function displayHolder(holder: Holder): string {
  const record = holder.record;
  if (!record || !(TEST_RUN_COMMANDS as readonly string[]).includes(record.command)) return `an unknown run (pid ${holder.pid})`;
  if (record.ticket !== null && PATTERNS.ticket.test(record.ticket) && record.location === 'ticket') {
    return `''${record.command}'' on ${record.ticket} (pid ${holder.pid})`;
  }
  if (record.ticket === null && record.location === 'main') {
    return `''${record.command}'' in the main checkout (pid ${holder.pid})`;
  }
  if (record.ticket === null && record.location === 'worktree') {
    return `''${record.command}'' in a worktree without a ticket (pid ${holder.pid})`;
  }
  return `an unknown run (pid ${holder.pid})`;
}

function readParentMarker(environment: NodeJS.ProcessEnv, repository: string): ParentMarker | null {
  try {
    const parsed: unknown = JSON.parse(environment[NESTED_ENV] ?? '');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const marker = parsed as Partial<ParentMarker>;
    if (!Number.isSafeInteger(marker.pid) || (marker.pid ?? 0) < 1 || typeof marker.repository !== 'string' || marker.repository !== repository) return null;
    const pid = marker.pid as number;
    const parentRecord = recordFile(join(repository, 'spec-test-runs'), pid);
    if (recordIsFree(parentRecord, pid, new Date().getTime() - uptime() * 1000)) return null;
    return marker as ParentMarker;
  } catch {
    return null;
  }
}

function writeRecord(runDir: string, options: TestRunTurnOptions): string {
  const pid = turnProcessId();
  const path = recordFile(runDir, pid);
  const temporary = join(runDir, `.tmp-${pid}`);
  const record: TurnRecord = {
    pid,
    command: options.command,
    ticket: options.ticket,
    startedAt: new Date().toISOString(),
    location: options.location,
  };
  writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
  renameSync(temporary, path);
  return path;
}

function recreateRunDirectory(runDir: string): void {
  statSync(dirname(runDir));
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
}

function reapAbandonedGateCandidates(runDir: string): void {
  for (const entry of readdirSync(runDir)) {
    const match = /^\.turn-gate-(\d+)-/.exec(entry);
    if (match === null) continue;
    const candidate = join(runDir, entry);
    try {
      const modifiedAt = statSync(candidate).mtimeMs;
      let ownerPid = Number(match[1]);
      try {
        const recordedPid = Number(readFileSync(join(candidate, 'owner'), 'utf8').trim());
        if (Number.isSafeInteger(recordedPid) && recordedPid > 0) ownerPid = recordedPid;
      } catch {
        // A contender can be killed before it writes the owner file.
      }
      if (!processAlive(ownerPid) || Date.now() - modifiedAt > 30_000) rmSync(candidate, { recursive: true, force: true });
    } catch {
      // The candidate may have been renamed or removed by its owner.
    }
  }
}

function staleGate(gate: string): boolean {
  try {
    const ownerPath = join(gate, 'owner');
    const pid = Number(readFileSync(ownerPath, 'utf8').trim());
    if (Number.isSafeInteger(pid) && pid > 0) return !processAlive(pid);
  } catch {
    // A gate without a readable owner can be left only by an interrupted write.
  }
  try {
    return Date.now() - statSync(gate).mtimeMs > 2_000;
  } catch {
    return false;
  }
}

function reclaimStaleGate(gate: string): boolean {
  if (!staleGate(gate)) return false;
  let ownerPid = process.pid;
  try {
    const pid = Number(readFileSync(join(gate, 'owner'), 'utf8').trim());
    if (Number.isSafeInteger(pid) && pid > 0) ownerPid = pid;
  } catch {
    // The stale gate may have been left before its owner was written.
  }
  const stale = join(dirname(gate), `${GATE}-${ownerPid}-stale-${randomUUID()}`);
  try {
    renameSync(gate, stale);
  } catch {
    return false;
  }
  if (staleGate(stale)) {
    rmSync(stale, { recursive: true, force: true });
    return true;
  }
  try {
    renameSync(stale, gate);
  } catch {
    // A new gate won; leave this displaced gate for stale-candidate cleanup.
  }
  return false;
}

async function underGate<T>(
  runDir: string,
  interrupted: () => boolean,
  wait: (ms: number) => Promise<void>,
  pollIntervalMs: number,
  action: () => T,
): Promise<T | null> {
  const gate = join(runDir, GATE);
  let restoredMissingDirectory = false;
  while (!interrupted()) {
    let candidate: string;
    try {
      candidate = mkdtempSync(join(runDir, `${GATE}-${process.pid}-`));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === 'ENOENT' || code === 'ENOTDIR') && !restoredMissingDirectory) {
        recreateRunDirectory(runDir);
        restoredMissingDirectory = true;
        continue;
      }
      throw error;
    }
    try {
      writeFileSync(join(candidate, 'owner'), String(process.pid), { mode: 0o600 });
      renameSync(candidate, gate);
    } catch (error) {
      rmSync(candidate, { recursive: true, force: true });
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' && !restoredMissingDirectory) {
        recreateRunDirectory(runDir);
        restoredMissingDirectory = true;
        continue;
      }
      if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
      if (reclaimStaleGate(gate)) continue;
      await wait(pollIntervalMs);
      continue;
    }
    try {
      reapAbandonedGateCandidates(runDir);
      return action();
    } finally {
      try {
        if (readFileSync(join(gate, 'owner'), 'utf8').trim() === String(process.pid)) {
          rmSync(gate, { recursive: true, force: true });
        }
      } catch {
        // A gate that cannot be removed is reclaimed by the next waiter.
      }
    }
  }
  return null;
}

function makeTestRun(error: string): TestRun {
  return { exitCode: null, tests: [], error };
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // The shell group already ended.
  }
}

function processGroupAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function waitForProcessGroupExit(pid: number | undefined): Promise<void> {
  while (processGroupAlive(pid)) await new Promise<void>((resolveWait) => { setTimeout(resolveWait, 10); });
}

async function waitWithoutTurn(
  runDir: string,
  command: TestRunCommand,
  maxTestRuns: number,
  noticeIntervalMs: number,
  pollIntervalMs: number,
  wait: (ms: number) => Promise<void>,
  interrupted: () => boolean,
  write: (text: string) => void,
  turnlessNotice: string,
): Promise<void> {
  const limit = Math.max(1, Math.floor(maxTestRuns));
  let firstNotice = true;
  let lastNotice = 0;
  let pendingTurnlessNotice = turnlessNotice;
  while (!interrupted()) {
    let holders: Holder[];
    try {
      const observed = holdersInOrder(runDir);
      const bootTime = Date.now() - uptime() * 1000;
      holders = observed.filter(({ pid }) => !recordIsFree(recordFile(runDir, pid), pid, bootTime));
    } catch {
      if (pendingTurnlessNotice !== '') write(pendingTurnlessNotice);
      return;
    }
    if (holders.length < limit) {
      if (pendingTurnlessNotice !== '') write(pendingTurnlessNotice);
      return;
    }

    const now = Date.now();
    if (firstNotice || now - lastNotice >= noticeIntervalMs) {
      const waiting = `${command}: waiting for a test run to finish: ${holders.map(displayHolder).join(', ')}\n`;
      write(firstNotice
        ? `${pendingTurnlessNotice}${waiting}${command}: each turn is a file in ${runDir}; remove one whose process is not a spec run to free its turn\n`
        : waiting);
      pendingTurnlessNotice = '';
      firstNotice = false;
      lastNotice = now;
    }
    await wait(pollIntervalMs);
  }
  if (pendingTurnlessNotice !== '') write(pendingTurnlessNotice);
}

function runShell(
  projectRoot: string,
  command: string,
  environment: NodeJS.ProcessEnv,
  timeoutMs: number | null,
  setStop: (stop: (signal: NodeJS.Signals) => void) => void,
  interrupted: () => boolean,
): Promise<ShellResult> {
  return new Promise((resolveResult) => {
    const child: ChildProcess = spawn('/bin/sh', ['-c', command], {
      cwd: projectRoot,
      env: environment,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const sizes = { stdout: 0, stderr: 0 };
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    let spawnError: string | null = null;
    let overflow = false;
    let timedOut = false;
    let stopped = false;
    let escalation: NodeJS.Timeout | null = null;
    const stop = (signal: NodeJS.Signals) => {
      if (stopped) return;
      stopped = true;
      signalGroup(child.pid, signal);
      escalation = setTimeout(() => { signalGroup(child.pid, 'SIGKILL'); }, 150);
    };
    setStop(stop);
    const timer = timeoutMs === null ? undefined : setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
    }, timeoutMs);
    const add = (part: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizes[part] += bytes.byteLength;
      if (sizes[part] > MAX_BUFFER) {
        overflow = true;
        stop('SIGTERM');
        return;
      }
      const decoded = decoders[part].write(bytes);
      if (part === 'stdout') stdout += decoded;
      else stderr += decoded;
    };
    child.stdout?.on('data', (chunk: Buffer | string) => { add('stdout', chunk); });
    child.stderr?.on('data', (chunk: Buffer | string) => { add('stderr', chunk); });
    child.once('error', (error: NodeJS.ErrnoException) => {
      spawnError = error.code ? `spawnSync /bin/sh ${error.code}` : error.message;
    });
    child.once('close', (code) => {
      void (async () => {
        clearTimeout(timer);
        if (escalation) clearTimeout(escalation);
        stdout += decoders.stdout.end();
        stderr += decoders.stderr.end();
        if (stopped || interrupted()) {
          signalGroup(child.pid, 'SIGKILL');
          await waitForProcessGroupExit(child.pid);
        }
        resolveResult({
          status: timedOut || overflow ? null : code,
          stdout,
          stderr,
          error: spawnError ?? (timedOut ? 'spawnSync /bin/sh ETIMEDOUT' : overflow ? 'spawnSync /bin/sh ENOBUFS' : null),
        });
      })();
    });
  });
}

function testRunFromOutput(projectRoot: string, report: string, result: ShellResult): TestRun {
  if (result.error !== null) return makeTestRun(result.error);
  if (!existsSync(report)) {
    const tail = `${result.stderr}${result.stdout}`.trim().split('\n').slice(-3).join(' | ');
    return { exitCode: result.status, tests: [], error: `the test command wrote no report to {report}${tail ? `: ${tail}` : ''}` };
  }
  const parsed = parseTestReport(readFileSync(report, 'utf8'));
  if ('error' in parsed) return { exitCode: result.status, tests: [], error: parsed.error };
  const prefix = `${projectRoot.replace(/\/+$/, '')}/`;
  const failedFiles = (parsed.failedFiles ?? []).map((f) => ({ name: f.name.startsWith(prefix) ? f.name.slice(prefix.length) : f.name, message: f.message }));
  const outputTail = `${result.stderr}${result.stdout}`.split('\n').map((line) => line.trim()).filter((line) => line !== '').slice(-5);
  return {
    exitCode: result.status,
    tests: parsed.tests,
    error: null,
    ...(failedFiles.length > 0 ? { failedFiles } : {}),
    ...(result.status !== 0 && outputTail.length > 0 ? { outputTail } : {}),
  };
}

/** Runs one spec-started test command under its repository's configured concurrency limit. */
export async function runTestCommandWithTurn(
  projectRoot: string,
  template: string,
  filter: string,
  options: TestRunTurnOptions,
): Promise<TestRunTurnResult> {
  if (filter !== '' && !PATTERNS.scenario.test(filter)) {
    return { run: { exitCode: null, tests: [], error: `invalid filter ${filter}` }, stderr: '' };
  }
  const repository = canonicalRepository(options.repositoryRoot ?? projectRoot);
  const testTimeoutMs = lowerMilliseconds(process.env, TIMEOUT_ENV, TEST_TIMEOUT_MS);
  const noticeIntervalMs = lowerMilliseconds(process.env, NOTICE_INTERVAL_ENV, DEFAULT_NOTICE_INTERVAL_MS);
  const pollIntervalMs = lowerMilliseconds(process.env, POLL_INTERVAL_ENV, DEFAULT_POLL_INTERVAL_MS);
  const temporary = mkdtempSync(join(tmpdir(), 'spec-tests-'));
  const report = join(temporary, 'report');
  let interrupted: NodeJS.Signals | null = null;
  let wake: (() => void) | null = null;
  let stopChild: ((signal: NodeJS.Signals) => void) | null = null;
  let notices = '';
  let heldRecord: string | null = null;
  const write = (text: string) => {
    if (options.stderr) options.stderr(text);
    else notices += text;
  };
  const onInterrupt = (signal: NodeJS.Signals) => {
    interrupted ??= signal;
    wake?.();
    stopChild?.(signal);
  };
  const onSigint = () => { onInterrupt('SIGINT'); };
  const onSigterm = () => { onInterrupt('SIGTERM'); };
  const onSighup = () => { onInterrupt('SIGHUP'); };
  const wasInterrupted = () => interrupted !== null;
  const signalReceived = () => interrupted;
  const channel = process as NodeJS.Process & { send?: unknown };
  const onDisconnect = () => { onInterrupt('SIGTERM'); };
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  process.on('SIGHUP', onSighup);
  if (typeof channel.send === 'function') process.on('disconnect', onDisconnect);
  const ownerPid = turnProcessId();
  const ownerMonitor = ownerPid === process.pid ? null : setInterval(() => {
    if (!processAlive(ownerPid)) onInterrupt('SIGTERM');
  }, 50);

  const pause = (ms: number): Promise<void> => new Promise((resolvePause) => {
    if (wasInterrupted()) {
      resolvePause();
      return;
    }
    const timer = setTimeout(() => {
      wake = null;
      resolvePause();
    }, ms);
    wake = () => {
      clearTimeout(timer);
      wake = null;
      resolvePause();
    };
  });

  try {
    const environment = { ...process.env };
    let parent: ParentMarker | null = null;
    if (repository !== null) {
      parent = readParentMarker(environment, repository);
      if (parent === null) {
        const runDir = join(repository, 'spec-test-runs');
        try {
          mkdirSync(runDir, { recursive: true, mode: 0o700 });
          let firstNotice = true;
          let lastNotice = 0;
          const limit = Math.max(1, Math.floor(options.maxTestRuns));
          while (!wasInterrupted() && heldRecord === null) {
            const acquisition = await underGate(
              runDir,
              wasInterrupted,
              pause,
              pollIntervalMs,
              () => {
                reapStale(runDir);
                const holders = holdersInOrder(runDir);
                if (holders.length >= limit) return { record: null, holders };
                return { record: writeRecord(runDir, options), holders: [] };
              },
            );
            if (wasInterrupted()) break;
            if (acquisition === null) continue;
            heldRecord = acquisition.record;
            if (heldRecord !== null) break;

            const details = acquisition.holders.map(displayHolder).join(', ');
            const waiting = `${options.command}: waiting for a test run to finish: ${details}\n`;
            if (firstNotice) {
              write(`${waiting}${options.command}: each turn is a file in ${runDir}; remove one whose process is not a spec run to free its turn\n`);
              firstNotice = false;
            } else {
              write(waiting);
            }
            lastNotice = Date.now();
            while (!wasInterrupted() && Date.now() - lastNotice < noticeIntervalMs) {
              await pause(pollIntervalMs);
              if (wasInterrupted()) break;
              let liveCount = 0;
              try {
                liveCount = liveHoldersInOrder(runDir).length;
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
              }
              if (liveCount >= limit) continue;
              const checked = await underGate(
                runDir,
                wasInterrupted,
                pause,
                pollIntervalMs,
                () => {
                  reapStale(runDir);
                  const holders = holdersInOrder(runDir);
                  if (holders.length >= limit) return { record: null, holders };
                  return { record: writeRecord(runDir, options), holders: [] };
                },
              );
              if (checked && checked.record !== null) {
                heldRecord = checked.record;
                break;
              }
            }
          }
        } catch (error) {
          if (!isFileSystemError(error)) throw error;
          let readable = true;
          try {
            readdirSync(runDir);
          } catch {
            readable = false;
          }
          const turnlessNotice = `${options.command}: no turn can be kept in ${runDir}: ${errorMessage(error)}; running without one\n`;
          if (readable) {
            await waitWithoutTurn(
              runDir,
              options.command,
              options.maxTestRuns,
              noticeIntervalMs,
              pollIntervalMs,
              pause,
              wasInterrupted,
              write,
              turnlessNotice,
            );
          } else {
            write(turnlessNotice);
          }
        }
      }
    }

    if (wasInterrupted()) return { run: makeTestRun('test run interrupted'), stderr: notices };
    if (repository !== null && (parent !== null || heldRecord !== null)) {
      const marker = parent ?? { pid: turnProcessId(), repository };
      environment[NESTED_ENV] = JSON.stringify(marker);
    } else {
      environment[NESTED_ENV] = undefined;
    }
    const childProcess = process.getBuiltinModule('node:child_process');
    // Tests replace spawnSync to model timeout and start errors; production uses the interruptible spawn path.
    if (childProcess.spawnSync !== builtinSpawnSync) {
      const previousMarker = process.env[NESTED_ENV];
      if (repository !== null) process.env[NESTED_ENV] = JSON.stringify(parent ?? { pid: turnProcessId(), repository });
      try {
        options.beforeStart?.();
        return { run: runTestCommand(projectRoot, template, filter), stderr: notices };
      } finally {
        if (previousMarker === undefined) process.env[NESTED_ENV] = undefined;
        else process.env[NESTED_ENV] = previousMarker;
      }
    }
    options.beforeStart?.();
    const command = template.replaceAll('{filter}', filter).replaceAll('{report}', report);
    const result = await runShell(projectRoot, command, environment, testTimeoutMs, (stop) => { stopChild = stop; }, wasInterrupted);
    stopChild = null;
    if (wasInterrupted()) return { run: makeTestRun('test run interrupted'), stderr: notices };
    return { run: testRunFromOutput(projectRoot, report, result), stderr: notices };
  } finally {
    if (heldRecord !== null) rmSync(heldRecord, { force: true });
    rmSync(temporary, { recursive: true, force: true });
    if (ownerMonitor !== null) clearInterval(ownerMonitor);
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    process.off('SIGHUP', onSighup);
    if (typeof channel.send === 'function') process.off('disconnect', onDisconnect);
    options.onEnd?.();
    const signal = signalReceived();
    if (signal !== null) {
      process.kill(process.pid, signal);
      process.exit(signalCode(signal));
    }
  }
}

/** Runs a shell command with no turn and no time limit, its output kept. */
export type PlainShell = (cwd: string, command: string, environment: NodeJS.ProcessEnv) => Promise<ShellResult>;

/**
 * Does `work`, whose shell commands an interrupt stops with every process they started; `cleanup` then runs before
 * the process ends by the signal.
 */
export async function withInterruptCleanup<T>(cleanup: () => void, work: (shell: PlainShell) => Promise<T>): Promise<T> {
  let interrupted: NodeJS.Signals | null = null;
  let stopChild: ((signal: NodeJS.Signals) => void) | null = null;
  const handlers = (['SIGINT', 'SIGTERM', 'SIGHUP'] as const).map((signal) => {
    const handler = () => {
      interrupted ??= signal;
      stopChild?.(signal);
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  const received = (): NodeJS.Signals | null => interrupted;
  // A signal that arrived during synchronous work is delivered only once the event loop turns.
  const delivered = () => new Promise<void>((resolveTurn) => { setImmediate(resolveTurn); });
  try {
    return await work(async (cwd, command, environment) => {
      await delivered();
      if (received() !== null) return { status: null, stdout: '', stderr: '', error: 'interrupted' };
      return runShell(cwd, command, environment, null, (stop) => { stopChild = stop; }, () => received() !== null);
    });
  } finally {
    await delivered();
    for (const { signal, handler } of handlers) process.off(signal, handler);
    const signal = received();
    if (signal !== null) {
      cleanup();
      process.kill(process.pid, signal);
      process.exit(signalCode(signal));
    }
  }
}
