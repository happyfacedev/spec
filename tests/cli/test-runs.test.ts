// PIP-009/R2-R5: spec CLI test-command runs share a repository-wide turn.
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { REPO, gitFixture, report, tempDir, trackChild } from '../helpers';

const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const MAIN = join(REPO, 'src/cli/main.ts');
const passing = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-001/S1 Streams tokens', status: 'passed' }] }] });
const failing = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-001/S1 Streams tokens', status: 'failed' }] }] });
const markerDirectory = (repo: string) => join(repo, '.git', 'test-run-markers');
const turnDirectory = (repo: string) => join(realpathSync(join(repo, '.git')), 'spec-test-runs');
const RUN_TIMEOUT_ENV = 'SPEC_TEST_RUN_TIMEOUT_MS';
const NOTICE_INTERVAL_ENV = 'SPEC_TEST_RUN_NOTICE_INTERVAL_MS';
const POLL_INTERVAL_ENV = 'SPEC_TEST_RUN_POLL_INTERVAL_MS';
const EVENT_WAIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 60_000;
const LONG_TEST_TIMEOUT_MS = 180_000;
const quickWaitEnv: NodeJS.ProcessEnv = { [NOTICE_INTERVAL_ENV]: '100', [POLL_INTERVAL_ENV]: '10' };
const runningAsRoot = process.getuid?.() === 0;
const active = (repo: string) => (existsSync(markerDirectory(repo)) ? readdirSync(markerDirectory(repo)).filter((name) => name.startsWith('active-')).length : 0)
  + readdirSync(repo).filter((name) => name.startsWith('active-')).length;
const waitingLines = (output: string) => output.split('\n').filter((line) => line.includes('waiting for a test run to finish'));
const turnRecordPids = (repo: string) => existsSync(turnDirectory(repo))
  ? readdirSync(turnDirectory(repo)).filter((name) => /^\d+$/.test(name)).sort()
  : [];
const made: ReturnType<typeof gitFixture>[] = [];

afterAll(() => {
  for (const fx of made) fx.cleanup();
});

function fixture(command: string | ((dir: string) => string) = 'cp passing.json "{report}"', extra: Record<string, unknown> = {}, setup?: (dir: string) => void) {
  const fx = gitFixture('spec-test-runs', {
    setup: (dir) => {
      writeFileSync(join(dir, 'passing.json'), passing);
      writeFileSync(join(dir, 'failing.json'), failing);
      const file = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      writeFileSync(file, `${JSON.stringify({ ...config, testCommand: typeof command === 'string' ? command : command(dir), ...extra }, null, 2)}\n`);
      setup?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

function setTestCommand(dir: string, command: string): void {
  const file = join(dir, 'spec/config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  config['testCommand'] = command;
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function gatedCommand(repo: string): string {
  const markers = quote(markerDirectory(repo));
  return `mkdir -p ${markers}; pid=$$; touch ${markers}/started-$pid; printf '%s' "$SPEC_TEST_RUN_PARENT" > ${markers}/env-$pid; mkdir ${markers}/active-$pid; printf '%s\\n' "$pid" >> ${markers}/starts; while [ ! -f ${markers}/release-$pid ] && [ ! -f ${markers}/release-all ]; do sleep 0.01; done; rmdir ${markers}/active-$pid; mode=pass; if [ -f ${markers}/mode ]; then mode=$(cat ${markers}/mode); fi; if [ "$mode" = fail ]; then cp failing.json "{report}"; exit 1; elif [ "$mode" = no-report ]; then exit 0; else cp passing.json "{report}"; fi`;
}

function timeLimitedCommand(repo: string): string {
  const markers = quote(markerDirectory(repo));
  const firstStatement = quote(join(repo, 'time-limited-command-started'));
  const child = `const fs=require("node:fs");const dir=process.argv[1];fs.writeFileSync(dir+"/time-limited-child-pid",String(process.pid));setInterval(()=>{if(fs.existsSync(dir+"/release-time-limited-child"))process.exit(0)},10)`;
  return `touch ${firstStatement}; mkdir -p ${markers}; pid=$$; touch ${markers}/started-$pid; mkdir ${markers}/active-$pid; printf '%s\\n' "$pid" >> ${markers}/starts; node -e ${quote(child)} ${markers}; rmdir ${markers}/active-$pid; cp passing.json "{report}"`;
}

function gatedAuxCommand(repo: string, name: string): string {
  const markers = quote(markerDirectory(repo));
  return `mkdir -p ${markers}; touch ${markers}/${name}-started; while [ ! -f ${markers}/${name}-release ] && [ ! -f ${markers}/release-all-aux ]; do sleep 0.01; done; touch ${markers}/${name}-ended`;
}

function releaseAllAuxCommands(fx: ReturnType<typeof gitFixture>): void {
  mkdirSync(markerDirectory(fx.repo), { recursive: true });
  writeFileSync(join(markerDirectory(fx.repo), 'release-all-aux'), 'release');
}

function releaseAllRuns(fx: ReturnType<typeof gitFixture>): void {
  mkdirSync(markerDirectory(fx.repo), { recursive: true });
  writeFileSync(join(markerDirectory(fx.repo), 'release-all'), 'release');
}

function releaseAuxCommand(fx: ReturnType<typeof gitFixture>, name: string): void {
  writeFileSync(join(markerDirectory(fx.repo), `${name}-release`), 'release');
}

function interruptibleCommand(repo: string): string {
  const markers = quote(markerDirectory(repo));
  const child = `const fs=require("node:fs");const shell=process.argv[1];const dir=process.argv[2];const pid=process.pid;fs.appendFileSync(dir+"/child-pids",pid+"\\n");setInterval(()=>{if(fs.existsSync(dir+"/child-release-"+shell)){fs.writeFileSync(dir+"/child-done-"+shell,"done");process.exit(0)}},10)`;
  return `mkdir -p ${markers}; pid=$$; touch ${markers}/started-$pid; mkdir ${markers}/active-$pid; printf '%s\\n' "$pid" >> ${markers}/starts; node -e ${quote(child)} "$pid" ${markers}; rmdir ${markers}/active-$pid; cp passing.json "{report}"`;
}

function nestedRepositoryCommand(repo: string, otherRepo: string): string {
  const root = quote(repo);
  const sameCli = quote(join(repo, '.spec/bin/spec'));
  const sameSpec = quote(join(repo, 'spec'));
  const sameOut = quote(join(repo, 'same-stdout'));
  const sameErr = quote(join(repo, 'same-stderr'));
  const other = quote(otherRepo);
  const otherSpec = quote(join(otherRepo, 'spec'));
  const otherOut = quote(join(otherRepo, 'nested-stdout'));
  const otherErr = quote(join(otherRepo, 'nested-stderr'));
  return `if [ "$SPEC_NESTED_DEPTH" = 1 ]; then printf '%s' "$SPEC_TEST_RUN_PARENT" > ${root}/same-env; node -e 'require("node:fs").writeFileSync("same-child-env",process.env.SPEC_TEST_RUN_PARENT??"")'; touch ${root}/same-ran; cp ${root}/passing.json "{report}"; else touch ${root}/parent-started; printf '%s' "$SPEC_TEST_RUN_PARENT" > ${root}/parent-env; node -e 'require("node:fs").writeFileSync("parent-child-env",process.env.SPEC_TEST_RUN_PARENT??"")'; SPEC_NESTED_DEPTH=1 ${sameCli} test PRV-002/S1 --root ${sameSpec} >${sameOut} 2>${sameErr}; sameStatus=$?; printf '%s' "$sameStatus" > ${root}/same-status; if [ "$sameStatus" -ne 0 ]; then exit "$sameStatus"; fi; touch ${root}/same-done; while [ ! -f ${root}/allow-other ]; do sleep 0.01; done; (cd ${other} && ./.spec/bin/spec test --root ${otherSpec}) >${otherOut} 2>${otherErr}; otherStatus=$?; printf '%s' "$otherStatus" > ${quote(join(otherRepo, 'nested-status'))}; if [ "$otherStatus" -ne 0 ]; then exit "$otherStatus"; fi; cp ${root}/passing.json "{report}"; fi`;
}

function startedPids(fx: ReturnType<typeof gitFixture>): string[] {
  const path = join(markerDirectory(fx.repo), 'starts');
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : [];
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function waitForStarted(fx: ReturnType<typeof gitFixture>, count: number, running: Running, message: string, timeout = 10_000): Promise<void> {
  await waitForRunCondition(running, () => startedPids(fx).length >= count, message, timeout);
}

function releaseRun(fx: ReturnType<typeof gitFixture>, pid: string): void {
  writeFileSync(join(markerDirectory(fx.repo), `release-${pid}`), 'release');
}

function resetRuns(fx: ReturnType<typeof gitFixture>): void {
  for (const pid of startedPids(fx)) {
    rmSync(join(markerDirectory(fx.repo), `release-${pid}`), { force: true });
    rmSync(join(markerDirectory(fx.repo), `started-${pid}`), { force: true });
    rmSync(join(markerDirectory(fx.repo), `active-${pid}`), { recursive: true, force: true });
  }
  rmSync(join(markerDirectory(fx.repo), 'starts'), { force: true });
  rmSync(join(markerDirectory(fx.repo), 'release-all'), { force: true });
  rmSync(join(markerDirectory(fx.repo), 'release-all-aux'), { force: true });
  if (existsSync(markerDirectory(fx.repo))) {
    for (const name of readdirSync(markerDirectory(fx.repo)).filter((entry) => entry.startsWith('armed-'))) {
      rmSync(join(markerDirectory(fx.repo), name), { force: true });
    }
  }
}

interface Result {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface Running {
  child: ReturnType<typeof spawn>;
  done: Promise<Result>;
  readonly stdout: string;
  readonly stderr: string;
}

interface StartSpecOptions {
  readonly detached?: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly goFile?: string;
}

function startSpecWith(fx: ReturnType<typeof gitFixture>, cwd: string, options: StartSpecOptions, ...args: string[]): Running {
  const env = { ...process.env };
  delete env['SPEC_ROOT'];
  delete env['CLAUDE_PROJECT_DIR'];
  delete env['SPEC_CLI_DELEGATED'];
  delete env['SPEC_PLUGIN_VERSION'];
  Object.assign(env, options.env ?? {});
  const command = [process.execPath, TSX, MAIN, ...args, '--root', join(cwd, 'spec')];
  const child = trackChild(options.goFile === undefined
    ? spawn(command[0] ?? process.execPath, command.slice(1), { cwd, env, detached: options.detached, stdio: ['ignore', 'pipe', 'pipe'] })
    : spawn('/bin/sh', [
        '-c',
        'mkdir -p "$2"; touch "$2/armed-$$"; while [ ! -f "$1" ]; do sleep 0.01; done; shift 2; exec "$@"',
        'spec-start-gate',
        options.goFile,
        markerDirectory(fx.repo),
        ...command,
      ], { cwd, env, detached: options.detached, stdio: ['ignore', 'pipe', 'pipe'] }));
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (part: string) => { stdout += part; });
  child.stderr.setEncoding('utf8').on('data', (part: string) => { stderr += part; });
  const done = new Promise<Result>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { resolve({ code, signal, stdout, stderr }); });
  });
  return { child, done, get stdout() { return stdout; }, get stderr() { return stderr; } };
}

function startSpec(fx: ReturnType<typeof gitFixture>, cwd: string, ...args: string[]): Running {
  return startSpecWith(fx, cwd, {}, ...args);
}

function startSpecWithEnv(fx: ReturnType<typeof gitFixture>, cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): Running {
  return startSpecWith(fx, cwd, { env }, ...args);
}

function startSpecDetached(fx: ReturnType<typeof gitFixture>, cwd: string, ...args: string[]): Running {
  return startSpecWith(fx, cwd, { detached: true }, ...args);
}

function startSpecAfterGo(fx: ReturnType<typeof gitFixture>, cwd: string, goFile: string, env: NodeJS.ProcessEnv, ...args: string[]): Running {
  return startSpecWith(fx, cwd, { env, goFile }, ...args);
}

async function invoke(fx: ReturnType<typeof gitFixture>, cwd: string, ...args: string[]) {
  return run({
    argv: [...args, '--root', join(cwd, 'spec')],
    env: {},
    cwd,
    scriptPath: undefined,
    stdin: () => Promise.resolve(''),
    now: () => '2026-10-27T12:00:00.000Z',
  });
}

async function waitFor(predicate: () => boolean, message: string, timeout = EVENT_WAIT_TIMEOUT_MS): Promise<void> {
  const until = Date.now() + timeout;
  while (!predicate() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(predicate(), message).toBe(true);
}

async function waitForRunCondition(run: Running, predicate: () => boolean, message: string, timeout = EVENT_WAIT_TIMEOUT_MS): Promise<void> {
  let finished = false;
  void run.done.then(() => { finished = true; });
  await waitFor(() => predicate() || finished, message, timeout);
  expect(predicate(), `${message}; stdout: ${run.stdout}; stderr: ${run.stderr}`).toBe(true);
}

async function waitForOutput(run: Running, output: string, message: string, timeout = 10_000): Promise<void> {
  await waitForRunCondition(run, () => run.stderr.includes(output), message, timeout);
}

function addWorktree(fx: ReturnType<typeof gitFixture>, name: string, branch?: string, base = 'main'): string {
  const folder = `${fx.repo}.worktrees`;
  mkdirSync(folder, { recursive: true });
  const path = join(folder, name);
  const result = branch === undefined
    ? fx.git('worktree', 'add', '--quiet', '--detach', path, base)
    : fx.git('worktree', 'add', '--quiet', path, '-b', `ticket/${branch}`, base);
  expect(result.code, result.stderr).toBe(0);
  return path;
}

function reportFile(fields: string): string {
  const dir = tempDir('spec-test-runs-report-');
  const file = join(dir, 'report.md');
  writeFileSync(file, report(fields));
  return file;
}

async function startImplementer(fx: ReturnType<typeof gitFixture>, cwd: string, ticket = 'TASK-101'): Promise<void> {
  const out = await invoke(fx, cwd, 'ticket', 'start', ticket, 'implementer');
  expect(out.code, out.stderr).toBe(0);
}

function passingImplementerReport(ticket = 'TASK-101'): string {
  return reportFile(`role: implementer\nticket: ${ticket}\nresult: done\nsummary: Extracted provider selection\nchanged: [PRV-001/S1]`);
}

function setTicketDone(dir: string, id: string): void {
  const file = join(dir, 'tickets', `${id}.md`);
  writeFileSync(file, readFileSync(file, 'utf8').replace('status: open', 'status: done'));
}

function createUnmergedTicketBranch(fx: ReturnType<typeof gitFixture>, id: string): void {
  const tree = addWorktree(fx, `merge-${id}`, id);
  const path = `src/merge-${id}.ts`;
  writeFileSync(join(tree, path), `export const mergeFixture = '${id}';\\n`);
  expect(fx.git('-C', tree, 'add', path).code).toBe(0);
  expect(fx.git('-C', tree, 'commit', '-q', '-m', `${id} merge fixture`).code).toBe(0);
}


describe('PIP-009: test-command turns', () => {
  it('PIP-009/S13 A run that finds no other starts at once', async () => {
    const fx = fixture(`touch started; cp passing.json "{report}"`);
    const out = await startSpec(fx, fx.repo, 'test').done;
    expect(out.code).toBe(0);
    expect(existsSync(join(fx.repo, 'started'))).toBe(true);
    expect(out.stderr).not.toContain('waiting for a test run to finish');
  });

  it('PIP-009/S14 A second run waits its turn and says so', async () => {
    const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => { setTicketDone(dir, 'TASK-103'); });
    createUnmergedTicketBranch(fx, 'TASK-103');
    const ticketTree = addWorktree(fx, 'TASK-101', 'TASK-101');
    await startImplementer(fx, ticketTree);
    const holderReport = passingImplementerReport();
    const holder = startSpec(fx, ticketTree, 'check-report', 'implementer', 'TASK-101', '--report-file', holderReport);
    const waiter = startSpecWithEnv(fx, fx.repo, quickWaitEnv, 'merge', 'TASK-103');
    try {
      await waitForStarted(fx, 1, holder, 'the check-report test command did not start');
      const holderPid = startedPids(fx)[0] ?? '';
      await waitForOutput(waiter, 'waiting for a test run to finish', 'merge did not announce its wait');
      const expected = `spec merge: waiting for a test run to finish: ''spec check-report'' on TASK-101 (pid ${holder.child.pid})`;
      expect(waiter.stderr).toContain(expected);
      expect(active(fx.repo)).toBe(1);
      let waiterFinished = false;
      void waiter.done.then(() => { waiterFinished = true; });
      await waitFor(() => waitingLines(waiter.stderr).length >= 4 || waiterFinished, 'merge did not print the waiting line for four notice intervals');
      const notices = waitingLines(waiter.stderr);
      expect(notices.length).toBeGreaterThanOrEqual(4);
      expect(notices.every((line) => line === expected)).toBe(true);
      expect(waiter.stdout).toBe('');
      releaseRun(fx, holderPid);
      await waitForStarted(fx, 2, waiter, 'the waiting test command did not start after release');
      releaseRun(fx, startedPids(fx)[1] ?? '');
      const [holderResult, secondResult] = await Promise.all([holder.done, waiter.done]);
      expect(holderResult.stdout).toBe('report ok\n');
      expect(secondResult.code).toBe(0);
      expect(secondResult.stdout).toContain('TASK-103: merged (');
      expect(secondResult.stdout).not.toContain('waiting for a test run to finish');
      expect(secondResult.stderr).toContain('waiting for a test run to finish');
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([holder.done, waiter.done]);
      resetRuns(fx);
    }

    const raceFx = fixture((dir) => gatedCommand(dir));
    const raceMarkers = markerDirectory(raceFx.repo);
    mkdirSync(raceMarkers, { recursive: true });
    const goFile = join(raceMarkers, 'go');
    const runs: Running[] = [];
    try {
      for (let index = 0; index < 8; index += 1) runs.push(startSpecAfterGo(raceFx, raceFx.repo, goFile, quickWaitEnv, 'test'));
      await waitFor(() => readdirSync(raceMarkers).filter((name) => name.startsWith('armed-')).length === 8, 'all eight test requests did not arm behind the shared go-file');
      writeFileSync(goFile, 'go');
      await waitFor(() => startedPids(raceFx).length > 1 || runs.filter((run) => waitingLines(run.stderr).length > 0).length === 7, 'the simultaneous requests did not resolve their first turn');
      expect(startedPids(raceFx)).toHaveLength(1);
      expect(active(raceFx.repo)).toBe(1);
      for (let index = 0; index < 8; index += 1) {
        const pid = startedPids(raceFx)[index] ?? '';
        expect(pid).not.toBe('');
        expect(active(raceFx.repo)).toBeLessThanOrEqual(1);
        releaseRun(raceFx, pid);
        if (index < 7) {
          await waitFor(() => startedPids(raceFx).length >= index + 2, `run ${index + 2} did not start after the preceding command ended`);
          expect(active(raceFx.repo)).toBe(1);
        }
      }
      expect((await Promise.all(runs.map((run) => run.done))).every((result) => result.code === 0)).toBe(true);
    } finally {
      writeFileSync(goFile, 'go');
      releaseAllRuns(raceFx);
      await Promise.allSettled(runs.map((run) => run.done));
      resetRuns(raceFx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S15 The turn is shared by the main checkout and every worktree', async () => {
    const fx = fixture((dir) => gatedCommand(dir));
    const ticketTree = addWorktree(fx, 'TASK-101', 'TASK-101');
    const holder = startSpec(fx, fx.repo, 'test');
    await waitForStarted(fx, 1, holder, 'main-checkout test command did not start');
    const holderPid = startedPids(fx)[0] ?? '';
    const waiter = startSpec(fx, ticketTree, 'test');
    await waitForOutput(waiter, 'waiting for a test run to finish', 'worktree test did not wait');
    expect(waiter.stderr).toContain(`''spec test'' in the main checkout (pid ${holder.child.pid})`);
    expect(startedPids(fx)).toHaveLength(1);
    releaseRun(fx, holderPid);
    await waitForStarted(fx, 2, waiter, 'worktree test did not start after release');
    releaseRun(fx, startedPids(fx)[1] ?? '');
    expect((await holder.done).code).toBe(0);
    expect((await waiter.done).code).toBe(0);
    resetRuns(fx);

    const reverseHolder = startSpec(fx, ticketTree, 'test');
    await waitForStarted(fx, 1, reverseHolder, 'ticket-worktree test command did not start');
    const reverseHolderPid = startedPids(fx)[0] ?? '';
    const reverseWaiter = startSpec(fx, fx.repo, 'test');
    await waitForOutput(reverseWaiter, 'waiting for a test run to finish', 'main-checkout test did not wait');
    expect(reverseWaiter.stderr).toContain(`''spec test'' on TASK-101 (pid ${reverseHolder.child.pid})`);
    expect(startedPids(fx)).toHaveLength(1);
    releaseRun(fx, reverseHolderPid);
    await waitForStarted(fx, 2, reverseWaiter, 'main-checkout test did not start after release');
    releaseRun(fx, startedPids(fx)[1] ?? '');
    expect((await reverseHolder.done).code).toBe(0);
    expect((await reverseWaiter.done).code).toBe(0);
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S16 Waiting is not a test result', async () => {
    const fx = fixture((dir) => {
      const advanceStarted = quote(join(dir, 'advance-test-command-started'));
      const commandStart = quote(join(dir, 'test-command-first-statement'));
      return `touch ${commandStart}; if [ "$PROP113_TEST_ADVANCE" = "1" ]; then touch ${advanceStarted}; cp passing.json "{report}"; else ${gatedCommand(dir)}; fi`;
    });
    const commandStart = join(fx.repo, 'test-command-first-statement');
    const advanceStarted = join(fx.repo, 'advance-test-command-started');
    const ticketTree = addWorktree(fx, 'TASK-101', 'TASK-101');
    await startImplementer(fx, ticketTree);
    const refused = await invoke(fx, ticketTree, 'ticket', 'advance', 'TASK-101', '--report-file', reportFile('not a report'));
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).not.toContain('check could not run');

    const validReport = passingImplementerReport();
    const checkHolder = startSpec(fx, fx.repo, 'test');
    const check = startSpecWithEnv(fx, ticketTree, quickWaitEnv, 'check-report', 'implementer', 'TASK-101', '--report-file', validReport);
    try {
      await waitForStarted(fx, 1, checkHolder, 'the check-report holder did not start its test command');
      const checkHolderPid = startedPids(fx)[0] ?? '';
      await waitForOutput(check, 'waiting for a test run to finish', 'check-report did not announce its wait');
      expect(startedPids(fx)).toHaveLength(1);
      releaseRun(fx, checkHolderPid);
      await waitForStarted(fx, 2, check, 'check-report did not start its test command after release');
      releaseRun(fx, startedPids(fx)[1] ?? '');
      expect((await checkHolder.done).code).toBe(0);
      const checked = await check.done;
      expect(checked.code).toBe(0);
      expect(checked.stdout).toBe('report ok\n');
      expect(checked.stderr).not.toContain('check could not run');
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([checkHolder.done, check.done]);
      resetRuns(fx);
    }

    writeFileSync(join(ticketTree, 'src/providers/test-run-turn.ts'), 'export const changed = true;\\n');
    const holder = startSpec(fx, fx.repo, 'test');
    let advance: Running | null = null;
    try {
      await waitForStarted(fx, 1, holder, 'the advance holder did not start its test command');
      const advanceHolderPid = startedPids(fx)[0] ?? '';
      rmSync(commandStart, { force: true });
      const waitingAdvance = startSpecWithEnv(fx, fx.repo, {
        ...quickWaitEnv,
        [RUN_TIMEOUT_ENV]: '3000',
        PROP113_TEST_ADVANCE: '1',
      }, 'ticket', 'advance', 'TASK-101', '--report-file', validReport);
      advance = waitingAdvance;
      await waitForOutput(waitingAdvance, 'waiting for a test run to finish', 'ticket advance did not announce its wait');
      let advanceFinished = false;
      void waitingAdvance.done.then(() => { advanceFinished = true; });
      await waitFor(() => waitingLines(waitingAdvance.stderr).length >= 32 || advanceFinished, 'ticket advance did not wait past its test-command time limit');
      expect(waitingLines(waitingAdvance.stderr).length).toBeGreaterThanOrEqual(32);
      expect(startedPids(fx)).toHaveLength(1);
      releaseRun(fx, advanceHolderPid);
      await waitFor(() => existsSync(advanceStarted) || advanceFinished, 'ticket advance test command did not start after its longer wait');
      expect(existsSync(advanceStarted)).toBe(true);
      expect((await holder.done).code).toBe(0);
      const advanced = await waitingAdvance.done;
      expect(advanced.code, `advance stdout: ${advanced.stdout}; stderr: ${advanced.stderr}`).toBe(0);
      expect(advanced.stderr).not.toContain('check could not run');
      expect(advanced.stdout).not.toContain('could not run');
      const ticket = parseTicket('tickets/TASK-101.md', readFileSync(join(ticketTree, 'tickets/TASK-101.md'), 'utf8')).ticket;
      expect(ticket?.data.history.at(-1)?.refusals).toBe(1);
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([holder.done, ...(advance ? [advance.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it.each(['pass', 'fail', 'no-report', 'timeout'] as const)('PIP-009/S17 The turn is given back however a run ends (%s)', async (mode) => {
    const fx = fixture((dir) => mode === 'timeout' ? timeLimitedCommand(dir) : gatedCommand(dir), {}, (dir) => {
      const configPath = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      config['checkCommands'] = [gatedAuxCommand(dir, 'check')];
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    });
    await startImplementer(fx, fx.repo);
    mkdirSync(markerDirectory(fx.repo), { recursive: true });
    writeFileSync(join(markerDirectory(fx.repo), 'mode'), mode === 'timeout' ? 'pass' : mode);
    const holder = startSpecWithEnv(fx, fx.repo, mode === 'timeout' ? { [RUN_TIMEOUT_ENV]: '5000' } : {}, 'check-report', 'implementer', 'TASK-101', '--report-file', passingImplementerReport());
    let waiter: Running | null = null;
    const record = join(fx.repo, '.git', 'spec-test-runs', String(holder.child.pid));
    let timedChildPid = 0;
    try {
      if (mode === 'timeout') {
        await waitForRunCondition(holder, () => existsSync(join(fx.repo, 'time-limited-command-started')), 'timeout test command did not write its first-statement marker');
        await waitFor(() => existsSync(join(markerDirectory(fx.repo), 'time-limited-child-pid')), 'timeout test command did not start its child');
      }
      await waitForStarted(fx, 1, holder, `${mode} check-report test command did not start`);
      const holderTestPid = startedPids(fx)[0] ?? '';
      const checkStarted = join(markerDirectory(fx.repo), 'check-started');
      if (mode !== 'timeout') releaseRun(fx, holderTestPid);
      let checkFinished = false;
      void holder.done.then(() => { checkFinished = true; });
      await waitFor(() => existsSync(checkStarted) || checkFinished, `${mode} check command did not start after its test command ended`);
      expect(existsSync(checkStarted)).toBe(true);
      expect(existsSync(record)).toBe(false);
      if (mode === 'timeout') {
        timedChildPid = Number(readFileSync(join(markerDirectory(fx.repo), 'time-limited-child-pid'), 'utf8'));
        expect(timedChildPid).toBeGreaterThan(0);
        await waitFor(() => !pidAlive(timedChildPid), 'time-limited command child was still running after the command timed out');
        expect(pidAlive(timedChildPid)).toBe(false);
      }

      writeFileSync(join(markerDirectory(fx.repo), 'mode'), 'pass');
      setTestCommand(fx.repo, gatedCommand(fx.repo));
      const waitingRun = startSpecWithEnv(fx, fx.repo, quickWaitEnv, 'test');
      waiter = waitingRun;
      await waitForStarted(fx, 2, waitingRun, `${mode} test command did not start while check-report remained busy`);
      expect(waitingLines(waitingRun.stderr)).toHaveLength(0);
      expect(existsSync(record)).toBe(false);
      expect(holder.child.exitCode).toBeNull();
      expect(existsSync(join(markerDirectory(fx.repo), 'check-ended'))).toBe(false);

      const waiterTestPid = startedPids(fx)[1] ?? '';
      releaseRun(fx, waiterTestPid);
      await waitFor(() => !existsSync(join(markerDirectory(fx.repo), `active-${waiterTestPid}`)), `${mode} second test command did not end while check-report remained busy`);
      expect((await waitingRun.done).code).toBe(0);
      expect(holder.child.exitCode).toBeNull();
      expect(existsSync(join(markerDirectory(fx.repo), 'check-ended'))).toBe(false);

      releaseAuxCommand(fx, 'check');
      const checked = await holder.done;
      expect(existsSync(join(markerDirectory(fx.repo), 'check-ended'))).toBe(true);
      if (mode === 'pass') expect(checked.code, `check-report stdout: ${checked.stdout}; stderr: ${checked.stderr}`).toBe(0);
      else expect(checked.code).not.toBe(0);
      if (mode === 'timeout') {
        expect(checked.stdout).toContain('the test command gave no results');
        expect(checked.stdout).not.toContain('report ok');
      }
    } finally {
      releaseAllRuns(fx);
      releaseAllAuxCommands(fx);
      if (mode === 'timeout') writeFileSync(join(markerDirectory(fx.repo), 'release-time-limited-child'), 'release');
      await Promise.allSettled([holder.done, ...(waiter ? [waiter.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S18 A turn whose holder is gone is taken over', async () => {
    const fx = fixture((dir) => `touch ${quote(join(dir, 'ran'))}; cp passing.json "{report}"`);
    const dir = join(fx.repo, '.git', 'spec-test-runs');
    mkdirSync(dir, { recursive: true });
    const liveButUnreadable = join(dir, String(process.pid));
    writeFileSync(liveButUnreadable, 'not a record');
    const unreadableRun = startSpec(fx, fx.repo, 'test');
    try {
      await waitForRunCondition(unreadableRun, () => existsSync(join(fx.repo, 'ran')), 'unreadable live record was not taken over');
      expect(existsSync(join(fx.repo, 'ran'))).toBe(true);
      expect(waitingLines(unreadableRun.stderr)).toHaveLength(0);
      const out = await unreadableRun.done;
      expect(out.code).toBe(0);
      expect(out.stderr).not.toContain('waiting for a test run to finish');
    } finally {
      rmSync(liveButUnreadable, { force: true });
      if (unreadableRun.child.exitCode === null) unreadableRun.child.kill('SIGTERM');
      await Promise.allSettled([unreadableRun.done]);
    }

    const killedFx = fixture(`if [ ! -f killed-once ]; then touch killed-once; kill -9 "$PPID"; fi; cp passing.json "{report}"`);
    const killed = startSpec(killedFx, killedFx.repo, 'test');
    const killedRecord = join(killedFx.repo, '.git', 'spec-test-runs', String(killed.child.pid));
    await waitForRunCondition(killed, () => existsSync(killedRecord), 'holder record was not written before the holder was killed');
    await killed.done;
    const takeover = await startSpec(killedFx, killedFx.repo, 'test').done;
    expect(takeover.code).toBe(0);
    expect(takeover.stderr).not.toContain('waiting for a test run to finish');
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S19 Stopping a run that waits', async () => {
    const fx = fixture((dir) => gatedCommand(dir));
    const holder = startSpec(fx, fx.repo, 'test');
    await waitForStarted(fx, 1, holder, 'holder did not start');
    const holderPid = startedPids(fx)[0] ?? '';
    const canceled = startSpec(fx, fx.repo, 'test');
    await waitForOutput(canceled, 'waiting for a test run to finish', 'first waiter did not wait');
    canceled.child.kill('SIGTERM');
    const stopped = await canceled.done;
    expect(stopped.stdout).toBe('');
    const next = startSpec(fx, fx.repo, 'gaps');
    await waitForOutput(next, 'waiting for a test run to finish', 'later waiter did not wait behind the holder');
    expect(next.stderr).toContain(`''spec test'' in the main checkout (pid ${holder.child.pid})`);
    expect(startedPids(fx)).toHaveLength(1);
    releaseRun(fx, holderPid);
    await waitForStarted(fx, 2, next, 'later run did not start after holder ended');
    releaseRun(fx, startedPids(fx)[1] ?? '');
    expect((await holder.done).code).toBe(0);
    expect((await next.done).code).toBe(0);
    expect(startedPids(fx)).toHaveLength(2);
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S20 More than one run at a time', async () => {
    const fx = fixture((dir) => gatedCommand(dir), { maxTestRuns: 2 });
    const file = join(fx.repo, 'spec/config.json');
    const one = startSpec(fx, fx.repo, 'test');
    await waitForStarted(fx, 1, one, 'the first configured turn was not in use');
    const two = startSpec(fx, fx.repo, 'test');
    await waitForStarted(fx, 2, two, 'two configured turns were not in use');
    const three = startSpec(fx, fx.repo, 'test');
    await waitForOutput(three, 'waiting for a test run to finish', 'third run did not wait for the two occupied turns');
    expect(three.stderr).toContain('spec test: waiting for a test run to finish:');
    expect(three.stderr).toContain(`''spec test'' in the main checkout (pid ${one.child.pid}), ''spec test'' in the main checkout (pid ${two.child.pid})`);
    expect(startedPids(fx)).toHaveLength(2);
    expect(active(fx.repo)).toBe(2);
    const pids = startedPids(fx);
    releaseRun(fx, pids[0] ?? '');
    await waitForStarted(fx, 3, three, 'third test command did not start when one turn was freed');
    expect(active(fx.repo)).toBe(2);
    releaseRun(fx, pids[1] ?? '');
    releaseRun(fx, startedPids(fx)[2] ?? '');
    expect((await one.done).code).toBe(0);
    expect((await two.done).code).toBe(0);
    expect((await three.done).code).toBe(0);
    resetRuns(fx);

    for (const value of [0, 1.5, '2']) {
      const cfg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      cfg['maxTestRuns'] = value;
      writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
      const lint = await invoke(fx, fx.repo, 'lint', '--format', 'json');
      expect(`${lint.stdout}\n${lint.stderr}`).toContain('maxTestRuns');
    }
  }, TEST_TIMEOUT_MS);

  it.each(['refusal', 'worktreeSetup', 'checkCommands', 'afterMerge', 'generated'] as const)('PIP-009/S21 A run refused before it starts does not wait (%s)', async (step) => {
    if (step === 'refusal') {
      const fx = fixture((dir) => gatedCommand(dir));
      const holder = startSpec(fx, fx.repo, 'test');
      try {
        await waitForStarted(fx, 1, holder, 'refusal holder did not start');
        const invalid = await invoke(fx, fx.repo, 'test', 'not-an-id');
        expect(invalid.code).toBe(2);
        expect(invalid.stderr).not.toContain('waiting for a test run to finish');
        const configPath = join(fx.repo, 'spec/config.json');
        const savedConfig = readFileSync(configPath, 'utf8');
        try {
          rmSync(configPath);
          const missing = await invoke(fx, fx.repo, 'test');
          expect(missing.code).toBe(1);
          expect(missing.stderr).toBe('config.json has no testCommand\n');
          expect(missing.stderr).not.toContain('waiting for a test run to finish');
        } finally {
          writeFileSync(configPath, savedConfig);
        }
      } finally {
        releaseAllRuns(fx);
        await holder.done;
        resetRuns(fx);
      }
      return;
    }

    if (step === 'worktreeSetup') {
      const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => {
        const config = JSON.parse(readFileSync(join(dir, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
        const markers = quote(markerDirectory(dir));
        config['worktreeSetup'] = `mkdir -p ${markers}; touch ${markers}/setup-started; while [ ! -f ${markers}/setup-release ]; do sleep 0.01; done; touch ${markers}/setup-ended`;
        writeFileSync(join(dir, 'spec/config.json'), `${JSON.stringify(config, null, 2)}\n`);
      });
      const holder = startSpec(fx, fx.repo, 'test');
      let add: Running | null = null;
      try {
        await waitForStarted(fx, 1, holder, 'worktree-setup holder did not start');
        add = startSpec(fx, fx.repo, 'worktree', 'add', 'TASK-101');
        await waitFor(() => existsSync(join(markerDirectory(fx.repo), 'setup-started')), 'worktreeSetup did not start while the turn was held');
        expect(active(fx.repo)).toBe(1);
        writeFileSync(join(markerDirectory(fx.repo), 'setup-release'), 'release');
        const added = await add.done;
        expect(added.code).toBe(0);
        expect(added.stderr).not.toContain('waiting for a test run to finish');
        expect(existsSync(join(markerDirectory(fx.repo), 'setup-ended'))).toBe(true);
        expect(active(fx.repo)).toBe(1);
      } finally {
        releaseAllRuns(fx);
        if (add) await Promise.allSettled([add.done]);
        await holder.done;
        resetRuns(fx);
      }
      return;
    }

    if (step === 'checkCommands') {
      const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => {
        const config = JSON.parse(readFileSync(join(dir, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
        config['checkCommands'] = [gatedAuxCommand(dir, 'check')];
        writeFileSync(join(dir, 'spec/config.json'), `${JSON.stringify(config, null, 2)}\n`);
      });
      await startImplementer(fx, fx.repo);
      const check = startSpec(fx, fx.repo, 'check-report', 'implementer', 'TASK-101', '--report-file', passingImplementerReport());
      let turnHolder: Running | null = null;
      try {
        await waitForStarted(fx, 1, check, 'check-report test command did not start');
        releaseRun(fx, startedPids(fx)[0] ?? '');
        await waitFor(() => existsSync(join(markerDirectory(fx.repo), 'check-started')), 'checkCommands did not start after check-report gave its turn back');
        expect(existsSync(join(fx.repo, '.git', 'spec-test-runs', String(check.child.pid)))).toBe(false);
        turnHolder = startSpec(fx, fx.repo, 'test');
        await waitForStarted(fx, 2, turnHolder, 'the checkCommands turn holder did not start');
        expect(active(fx.repo)).toBe(1);
        releaseAuxCommand(fx, 'check');
        const checked = await check.done;
        expect(checked.code).toBe(0);
        expect(checked.stderr).not.toContain('waiting for a test run to finish');
        expect(existsSync(join(markerDirectory(fx.repo), 'check-ended'))).toBe(true);
        expect(active(fx.repo)).toBe(1);
      } finally {
        releaseAllRuns(fx);
        releaseAllAuxCommands(fx);
        await Promise.allSettled([check.done, ...(turnHolder ? [turnHolder.done] : [])]);
        resetRuns(fx);
      }
      return;
    }

    if (step === 'afterMerge') {
      const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => {
        setTicketDone(dir, 'TASK-103');
        const config = JSON.parse(readFileSync(join(dir, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
        config['afterMerge'] = gatedAuxCommand(dir, 'after-merge');
        writeFileSync(join(dir, 'spec/config.json'), `${JSON.stringify(config, null, 2)}\n`);
      });
      createUnmergedTicketBranch(fx, 'TASK-103');
      const merge = startSpec(fx, fx.repo, 'merge', 'TASK-103');
      let turnHolder: Running | null = null;
      try {
        await waitForStarted(fx, 1, merge, 'merge test command did not start before afterMerge');
        releaseRun(fx, startedPids(fx)[0] ?? '');
        await waitFor(() => existsSync(join(markerDirectory(fx.repo), 'after-merge-started')), 'afterMerge did not start after the merge test ended');
        turnHolder = startSpec(fx, fx.repo, 'test');
        await waitForStarted(fx, 2, turnHolder, 'test-command turn holder did not start during afterMerge');
        expect(active(fx.repo)).toBe(1);
        releaseAuxCommand(fx, 'after-merge');
        const merged = await merge.done;
        expect(merged.code).toBe(0);
        expect(merged.stderr).not.toContain('waiting for a test run to finish');
        expect(existsSync(join(markerDirectory(fx.repo), 'after-merge-ended'))).toBe(true);
        expect(active(fx.repo)).toBe(1);
      } finally {
        releaseAllRuns(fx);
        releaseAllAuxCommands(fx);
        await Promise.allSettled([merge.done, ...(turnHolder ? [turnHolder.done] : [])]);
        resetRuns(fx);
      }
      return;
    }

    const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => {
      mkdirSync(join(dir, 'generated'), { recursive: true });
      writeFileSync(join(dir, 'generated/output.txt'), 'base\n');
      setTicketDone(dir, 'TASK-103');
      const config = JSON.parse(readFileSync(join(dir, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
      config['generated'] = { globs: ['generated/output.txt'], command: gatedAuxCommand(dir, 'generated') };
      writeFileSync(join(dir, 'spec/config.json'), `${JSON.stringify(config, null, 2)}\n`);
    });
    const branch = addWorktree(fx, 'merge-TASK-103', 'TASK-103');
    writeFileSync(join(branch, 'generated/output.txt'), 'ticket side\n');
    writeFileSync(join(branch, 'src/merge-generated.ts'), 'export const generatedConflictFixture = true;\n');
    expect(fx.git('-C', branch, 'add', 'generated/output.txt', 'src/merge-generated.ts').code).toBe(0);
    expect(fx.git('-C', branch, 'commit', '-q', '-m', 'TASK-101 generated conflict fixture').code).toBe(0);
    writeFileSync(join(fx.repo, 'generated/output.txt'), 'main side\n');
    expect(fx.git('add', 'generated/output.txt').code).toBe(0);
    expect(fx.git('commit', '-q', '-m', 'main generated conflict fixture').code).toBe(0);
    const merge = startSpec(fx, fx.repo, 'merge', 'TASK-103');
    let turnHolder: Running | null = null;
    try {
      await waitFor(() => existsSync(join(markerDirectory(fx.repo), 'generated-started')), 'generated.command did not start on the conflicted generated file');
      turnHolder = startSpec(fx, fx.repo, 'test');
      await waitForStarted(fx, 1, turnHolder, 'test command did not start during generated.command');
      expect(active(fx.repo)).toBe(1);
      releaseAuxCommand(fx, 'generated');
      await waitForOutput(merge, 'waiting for a test run to finish', 'merge did not wait for the holder after generated.command ended');
      expect(existsSync(join(markerDirectory(fx.repo), 'generated-ended'))).toBe(true);
      expect(startedPids(fx)).toHaveLength(1);
      releaseRun(fx, startedPids(fx)[0] ?? '');
      await waitForStarted(fx, 2, merge, 'merge test command did not start after the holder released its turn');
      releaseRun(fx, startedPids(fx)[1] ?? '');
      const merged = await merge.done;
      expect(merged.code).toBe(0);
      expect(merged.stderr).toContain('waiting for a test run to finish');
    } finally {
      releaseAllRuns(fx);
      releaseAllAuxCommands(fx);
      await Promise.allSettled([merge.done, ...(turnHolder ? [turnHolder.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S22 A forged record can only make a run wait', async () => {
    const fx = fixture();
    const dir = join(fx.repo, '.git', 'spec-test-runs');
    mkdirSync(dir, { recursive: true });
    const record = join(dir, '1');
    writeFileSync(record, JSON.stringify({ pid: 1, command: 'anything at all', ticket: 'x; rm -rf .', startedAt: new Date().toISOString(), location: 'ticket' }));
    const stopped = startSpecWithEnv(fx, fx.repo, quickWaitEnv, 'test');
    let resumed: Running | null = null;
    try {
      await waitForOutput(stopped, 'an unknown run (pid 1)', 'forged holder was not rendered as unknown');
      stopped.child.kill('SIGTERM');
      const stoppedResult = await stopped.done;
      expect(stoppedResult.stdout).toBe('');
      expect(stoppedResult.stderr).toContain('an unknown run (pid 1)');
      const canonicalTurnDirectory = join(realpathSync(join(fx.repo, '.git')), 'spec-test-runs');
      expect(stoppedResult.stderr).toContain(`spec test: each turn is a file in ${canonicalTurnDirectory}; remove one whose process is not a spec run to free its turn`);
      expect(existsSync(join(fx.repo, 'spec/config.json'))).toBe(true);

      const waitingRun = startSpecWithEnv(fx, fx.repo, quickWaitEnv, 'test');
      resumed = waitingRun;
      await waitForOutput(waitingRun, 'an unknown run (pid 1)', 'forged record did not continue to hold a turn');
      rmSync(record);
      expect((await waitingRun.done).code).toBe(0);
      expect(waitingRun.stdout).toContain('PASS PRV-001/S1 Streams tokens');
    } finally {
      rmSync(record, { force: true });
      if (stopped.child.exitCode === null) stopped.child.kill('SIGTERM');
      if (resumed?.child.exitCode === null) resumed.child.kill('SIGTERM');
      await Promise.allSettled([stopped.done, ...(resumed ? [resumed.done] : [])]);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S23 An invalid maxTestRuns refuses the run at once', async () => {
    for (const value of [0, 1.5, '2']) {
      const fx = fixture(`touch ran; cp passing.json "{report}"`, { maxTestRuns: value });
      const out = await startSpec(fx, fx.repo, 'test').done;
      expect(out.code).toBe(1);
      expect(out.stderr).toBe('config.json has no testCommand\n');
      expect(existsSync(join(fx.repo, 'ran'))).toBe(false);
      expect(existsSync(join(fx.repo, '.git', 'spec-test-runs'))).toBe(false);
      expect(out.stderr).not.toContain('waiting for a test run to finish');
    }
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)('PIP-009/S24 Interrupting the holder stops its test command and frees the turn (%s)', async (signal) => {
    const fx = fixture((dir) => interruptibleCommand(dir), {}, (dir) => { setTicketDone(dir, 'TASK-103'); });
    createUnmergedTicketBranch(fx, 'TASK-103');
    const ticketTree = addWorktree(fx, 'TASK-101', 'TASK-101');
    const holder = startSpecDetached(fx, ticketTree, 'test');
    let waiter: Running | null = null;
    let childPid = 0;
    let holderShell = '';
    let waiterShell = '';
    try {
      await waitForRunCondition(holder, () => existsSync(join(markerDirectory(fx.repo), 'child-pids')), 'test command did not start its child');
      await waitForStarted(fx, 1, holder, 'test command did not mark its start');
      holderShell = startedPids(fx)[0] ?? '';
      childPid = Number(readFileSync(join(markerDirectory(fx.repo), 'child-pids'), 'utf8').trim().split('\n')[0]);
      waiter = startSpec(fx, fx.repo, 'merge', 'TASK-103');
      await waitForOutput(waiter, 'waiting for a test run to finish', 'merge did not wait for holder');
      expect(waiter.stderr).toContain(`''spec test'' on TASK-101 (pid ${holder.child.pid})`);
      expect(startedPids(fx)).toHaveLength(1);
      if (signal === 'SIGHUP') process.kill(-Number(holder.child.pid), signal);
      else holder.child.kill(signal);
      await waitForStarted(fx, 2, waiter, `${signal} did not free the turn for the merge test command`);
      expect(pidAlive(childPid)).toBe(false);
      expect(pidAlive(Number(holderShell))).toBe(false);
      expect(existsSync(join(markerDirectory(fx.repo), `child-done-${holderShell}`))).toBe(false);
      expect(existsSync(join(turnDirectory(fx.repo), String(holder.child.pid)))).toBe(false);
      await holder.done;
      waiterShell = startedPids(fx)[1] ?? '';
      writeFileSync(join(markerDirectory(fx.repo), `child-release-${waiterShell}`), 'release');
      expect((await waiter.done).code).toBe(0);
      expect(existsSync(join(markerDirectory(fx.repo), `active-${waiterShell}`))).toBe(false);
    } finally {
      if (holderShell !== '') writeFileSync(join(markerDirectory(fx.repo), `child-release-${holderShell}`), 'release');
      if (waiterShell !== '') writeFileSync(join(markerDirectory(fx.repo), `child-release-${waiterShell}`), 'release');
      releaseAllRuns(fx);
      if (childPid > 0 && pidAlive(childPid)) {
        try { process.kill(childPid, 'SIGKILL'); } catch { /* process exited between the check and signal */ }
      }
      if (holder.child.exitCode === null) holder.child.kill('SIGTERM');
      if (waiter?.child.exitCode === null) waiter.child.kill('SIGTERM');
      await Promise.allSettled([holder.done, ...(waiter ? [waiter.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S25 Where a turn is kept, and how a person frees one', async () => {
    const fx = fixture((dir) => gatedCommand(dir));
    const ticketTree = addWorktree(fx, 'TASK-101', 'TASK-101');
    const holderTree = addWorktree(fx, 'TASK-103', 'TASK-103');
    await startImplementer(fx, holderTree, 'TASK-103');
    const holderReport = passingImplementerReport('TASK-103');
    const holder = startSpec(fx, holderTree, 'check-report', 'implementer', 'TASK-103', '--report-file', holderReport);
    let waiter: Running | null = null;
    try {
      await waitForStarted(fx, 1, holder, 'holder did not start');
      const holderTestPid = startedPids(fx)[0] ?? '';
      const record = join(fx.repo, '.git', 'spec-test-runs', String(holder.child.pid));
      expect(existsSync(record)).toBe(true);

      const waitingRun = startSpecWithEnv(fx, ticketTree, { [POLL_INTERVAL_ENV]: '10' }, 'test');
      waiter = waitingRun;
      await waitForOutput(waitingRun, 'waiting for a test run to finish', 'worktree did not wait');
      const notice = waitingRun.stderr;
      expect(notice).toContain(`''spec check-report'' on TASK-103 (pid ${holder.child.pid})`);
      rmSync(record);
      await waitForStarted(fx, 2, waitingRun, 'waiter did not take the removed turn at its next look');
      expect(startedPids(fx)).toHaveLength(2);
      expect(waitingLines(waitingRun.stderr)).toHaveLength(1);
      const waiterTestPid = startedPids(fx)[1] ?? '';
      releaseRun(fx, waiterTestPid);
      expect((await waiter.done).code).toBe(0);
      expect(active(fx.repo)).toBe(1);
      releaseRun(fx, holderTestPid);
      const holderResult = await holder.done;
      expect(holderResult.code).toBe(0);
      expect(holderResult.stdout).toBe('report ok\n');
      expect(waitingLines(waiter.stderr)).toHaveLength(1);
      const canonicalTurnDirectory = turnDirectory(fx.repo);
      expect(notice).toContain(`spec test: each turn is a file in ${canonicalTurnDirectory}; remove one whose process is not a spec run to free its turn`);
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([holder.done, ...(waiter ? [waiter.done] : [])]);
      resetRuns(fx);
    }

    const oldTime = new Date('2000-01-01T00:00:00.000Z');
    const reusedPidRecord = join(turnDirectory(fx.repo), String(process.pid));
    mkdirSync(turnDirectory(fx.repo), { recursive: true });
    writeFileSync(reusedPidRecord, JSON.stringify({ pid: process.pid, command: 'spec test', ticket: null, startedAt: oldTime.toISOString() }));
    utimesSync(reusedPidRecord, oldTime, oldTime);
    const afterRestartRun = startSpec(fx, fx.repo, 'test');
    try {
      await waitForStarted(fx, 1, afterRestartRun, 'pre-restart record prevented a new test command');
      expect(afterRestartRun.stderr).not.toContain('waiting for a test run to finish');
      releaseRun(fx, startedPids(fx)[0] ?? '');
      expect((await afterRestartRun.done).code).toBe(0);
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([afterRestartRun.done]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S25 A waiter restores a turn folder removed while it waits', async () => {
    const fx = fixture((dir) => gatedCommand(dir));
    const holder = startSpec(fx, fx.repo, 'test');
    let waiter: Running | null = null;
    try {
      await waitForStarted(fx, 1, holder, 'turn-folder-removal holder did not start');
      const holderPid = startedPids(fx)[0] ?? '';
      const waitingRun = startSpecWithEnv(fx, fx.repo, { [POLL_INTERVAL_ENV]: '10' }, 'test');
      waiter = waitingRun;
      await waitForOutput(waitingRun, 'waiting for a test run to finish', 'waiter did not wait before the turn folder was removed');
      rmSync(turnDirectory(fx.repo), { recursive: true, force: true });
      await waitForStarted(fx, 2, waitingRun, 'waiter did not take a turn after the folder was removed');
      expect(existsSync(turnDirectory(fx.repo))).toBe(true);
      expect(turnRecordPids(fx.repo)).toContain(String(waitingRun.child.pid));
      expect(waitingRun.stderr).not.toContain('no turn can be kept');
      const waiterPid = startedPids(fx)[1] ?? '';
      releaseRun(fx, waiterPid);
      expect((await waitingRun.done).code).toBe(0);
      releaseRun(fx, holderPid);
      expect((await holder.done).code).toBe(0);
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([holder.done, ...(waiter ? [waiter.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S26 Every worktree of the repository shares the turn, however it is reached', async () => {
    const fx = fixture((dir) => gatedCommand(dir), {}, (dir) => { setTicketDone(dir, 'TASK-103'); });
    createUnmergedTicketBranch(fx, 'TASK-103');
    const scratchTree = addWorktree(fx, 'scratch');
    const links = join(`${fx.repo}.worktrees`, 'links');
    mkdirSync(links, { recursive: true });
    const symlink = join(links, 'scratch');
    symlinkSync(scratchTree, symlink);
    const holder = startSpec(fx, fx.repo, 'merge', 'TASK-103');
    await waitForStarted(fx, 1, holder, 'main-checkout merge test command did not start');
    const holderTestPid = startedPids(fx)[0] ?? '';

    const rooted = startSpec(fx, scratchTree, 'test');
    await waitForOutput(rooted, 'waiting for a test run to finish', '--root worktree did not share the main lock');
    expect(rooted.stderr).toContain(`''spec merge'' in the main checkout (pid ${holder.child.pid})`);
    expect(startedPids(fx)).toHaveLength(1);
    releaseRun(fx, holderTestPid);
    await waitForStarted(fx, 2, rooted, 'rooted worktree did not start after release');
    releaseRun(fx, startedPids(fx)[1] ?? '');
    expect((await rooted.done).code).toBe(0);
    expect((await holder.done).code).toBe(0);
    resetRuns(fx);

    const worktreeHolder = startSpec(fx, scratchTree, 'test');
    await waitForStarted(fx, 1, worktreeHolder, 'unticketed worktree test command did not start');
    const worktreeTestPid = startedPids(fx)[0] ?? '';
    const linkedWaiter = startSpec(fx, symlink, 'test');
    await waitForOutput(linkedWaiter, 'waiting for a test run to finish', 'symlinked worktree did not share the lock');
    expect(linkedWaiter.stderr).toContain(`''spec test'' in a worktree without a ticket (pid ${worktreeHolder.child.pid})`);
    expect(startedPids(fx)).toHaveLength(1);
    releaseRun(fx, worktreeTestPid);
    await waitForStarted(fx, 2, linkedWaiter, 'symlinked worktree did not start after release');
    releaseRun(fx, startedPids(fx)[1] ?? '');
    expect((await worktreeHolder.done).code).toBe(0);
    expect((await linkedWaiter.done).code).toBe(0);
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S27 A run inside a holder\'s test command does not wait for its own parent', async () => {
    const otherFx = fixture((dir) => gatedCommand(dir));
    const fx = fixture((dir) => nestedRepositoryCommand(dir, otherFx.repo));
    await startImplementer(fx, fx.repo);
    const holderReport = passingImplementerReport();
    const holder = startSpec(fx, fx.repo, 'check-report', 'implementer', 'TASK-101', '--report-file', holderReport);
    let otherHolder: Running | null = null;
    try {
      const parentStarted = join(fx.repo, 'parent-started');
      await waitFor(() => existsSync(parentStarted), 'holder test command did not start');
      const sameDone = join(fx.repo, 'same-done');
      await waitFor(() => existsSync(sameDone) || holder.child.exitCode !== null, 'same-repository nested test did not finish');
      expect(existsSync(sameDone)).toBe(true);
      const parentValue = JSON.stringify({ pid: holder.child.pid, repository: realpathSync(join(fx.repo, '.git')) });
      expect(readFileSync(join(fx.repo, 'parent-env'), 'utf8')).toBe(parentValue);
      expect(readFileSync(join(fx.repo, 'parent-child-env'), 'utf8')).toBe(parentValue);
      expect(readFileSync(join(fx.repo, 'same-env'), 'utf8')).toBe(parentValue);
      expect(readFileSync(join(fx.repo, 'same-child-env'), 'utf8')).toBe(parentValue);
      expect(readFileSync(join(fx.repo, 'same-status'), 'utf8')).toBe('0');
      expect(readFileSync(join(fx.repo, 'same-stderr'), 'utf8')).not.toContain('waiting for a test run to finish');
      expect(turnRecordPids(fx.repo)).toEqual([String(holder.child.pid)]);

      const secondRepositoryHolder = startSpec(otherFx, otherFx.repo, 'test');
      otherHolder = secondRepositoryHolder;
      await waitForStarted(otherFx, 1, secondRepositoryHolder, 'second-repository holder did not start');
      writeFileSync(join(fx.repo, 'allow-other'), 'go');
      const foreignStderr = join(otherFx.repo, 'nested-stderr');
      await waitFor(() => (existsSync(foreignStderr) && readFileSync(foreignStderr, 'utf8').includes('waiting for a test run to finish')) || startedPids(otherFx).length > 1, 'second-repository nested run did not resolve its own turn');
      expect(readFileSync(foreignStderr, 'utf8')).toContain(`spec test: waiting for a test run to finish: ''spec test'' in the main checkout (pid ${secondRepositoryHolder.child.pid})`);
      expect(startedPids(otherFx)).toHaveLength(1);
      expect(turnRecordPids(otherFx.repo)).toEqual([String(secondRepositoryHolder.child.pid)]);
      releaseRun(otherFx, startedPids(otherFx)[0] ?? '');
      const nestedStatus = join(otherFx.repo, 'nested-status');
      await waitFor(() => startedPids(otherFx).length >= 2 || existsSync(nestedStatus), 'nested second-repository test command did not start after its holder ended');
      expect(startedPids(otherFx), `nested run stderr: ${readFileSync(foreignStderr, 'utf8')}; stdout: ${readFileSync(join(otherFx.repo, 'nested-stdout'), 'utf8')}; status: ${existsSync(nestedStatus) ? readFileSync(nestedStatus, 'utf8') : '<still running>'}`).toHaveLength(2);
      const nestedRecords = turnRecordPids(otherFx.repo);
      expect(nestedRecords).toHaveLength(1);
      expect(nestedRecords[0]).not.toBe(String(secondRepositoryHolder.child.pid));
      const nestedTestPid = startedPids(otherFx)[1] ?? '';
      expect(readFileSync(join(markerDirectory(otherFx.repo), `env-${nestedTestPid}`), 'utf8')).toBe(JSON.stringify({ pid: Number(nestedRecords[0]), repository: realpathSync(join(otherFx.repo, '.git')) }));
      releaseRun(otherFx, nestedTestPid);
      expect((await secondRepositoryHolder.done).code).toBe(0);
      await waitFor(() => existsSync(nestedStatus), 'nested second-repository CLI did not finish after its test command ended');
      expect(readFileSync(nestedStatus, 'utf8')).toBe('0');
      const out = await holder.done;
      const details = `outer stdout: ${out.stdout}; outer stderr: ${out.stderr}; second-repository stderr: ${readFileSync(foreignStderr, 'utf8')}`;
      expect(out.code, details).toBe(0);
      expect(out.stdout, details).toBe('report ok\n');
      expect(out.stderr, details).not.toContain('waiting for a test run to finish');
    } finally {
      writeFileSync(join(fx.repo, 'allow-other'), 'go');
      releaseAllRuns(fx);
      releaseAllRuns(otherFx);
      if (holder.child.exitCode === null) holder.child.kill('SIGTERM');
      await Promise.allSettled([holder.done, ...(otherHolder ? [otherHolder.done] : [])]);
      resetRuns(fx);
      resetRuns(otherFx);
    }

    const deadProcess = trackChild(spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' }));
    const deadPid = deadProcess.pid ?? 0;
    expect(deadPid).toBeGreaterThan(0);
    await new Promise<void>((resolve) => { deadProcess.once('close', () => { resolve(); }); });
    const markerFx = fixture((dir) => gatedCommand(dir));
    const cases: { name: string; marker: string; foreign?: boolean }[] = [
      { name: 'dead pid', marker: JSON.stringify({ pid: deadPid, repository: realpathSync(join(markerFx.repo, '.git')) }) },
      { name: 'pid without a record', marker: JSON.stringify({ pid: process.pid, repository: realpathSync(join(markerFx.repo, '.git')) }) },
      { name: 'another repository', marker: '', foreign: true },
      { name: 'unreadable text', marker: 'not a SPEC_TEST_RUN_PARENT value' },
    ];
    for (const testCase of cases) {
      const localHolder = startSpec(markerFx, markerFx.repo, 'test');
      let foreignHolder: Running | null = null;
      let waiter: Running | null = null;
      try {
        await waitForStarted(markerFx, 1, localHolder, `${testCase.name} marker holder did not start`);
        let marker = testCase.marker;
        if (testCase.foreign) {
          const runningForeignHolder = startSpec(otherFx, otherFx.repo, 'test');
          foreignHolder = runningForeignHolder;
          await waitForStarted(otherFx, 1, runningForeignHolder, 'other-repository marker holder did not start');
          marker = JSON.stringify({ pid: runningForeignHolder.child.pid, repository: realpathSync(join(otherFx.repo, '.git')) });
        }
        const launched = startSpecWithEnv(markerFx, markerFx.repo, { ...quickWaitEnv, SPEC_TEST_RUN_PARENT: marker }, 'test');
        waiter = launched;
        await waitFor(() => waitingLines(launched.stderr).length > 0 || startedPids(markerFx).length > 1 || launched.child.exitCode !== null, `${testCase.name} parent marker was not rejected`);
        expect(launched.stderr).toContain(`''spec test'' in the main checkout (pid ${localHolder.child.pid})`);
        expect(startedPids(markerFx)).toHaveLength(1);
        if (foreignHolder) expect(startedPids(otherFx)).toHaveLength(1);
        releaseRun(markerFx, startedPids(markerFx)[0] ?? '');
        await waitForStarted(markerFx, 2, launched, `${testCase.name} marker run did not take its own turn`);
        releaseRun(markerFx, startedPids(markerFx)[1] ?? '');
        expect((await Promise.all([localHolder.done, launched.done])).every((result) => result.code === 0)).toBe(true);
      } finally {
        releaseAllRuns(markerFx);
        if (foreignHolder) releaseAllRuns(otherFx);
        await Promise.allSettled([localHolder.done, ...(waiter ? [waiter.done] : []), ...(foreignHolder ? [foreignHolder.done] : [])]);
        resetRuns(markerFx);
        if (foreignHolder) resetRuns(otherFx);
      }
    }
  }, LONG_TEST_TIMEOUT_MS);

  it('PIP-009/S28 A turn folder that is a regular file runs without a turn', async () => {
    const fx = fixture((dir) => `touch ${quote(join(dir, 'ran'))}; cp passing.json "{report}"`);
    const control = await startSpec(fx, fx.repo, 'test').done;
    expect(control.code).toBe(0);
    const ran = join(fx.repo, 'ran');
    const folder = turnDirectory(fx.repo);
    rmSync(folder, { recursive: true, force: true });
    writeFileSync(folder, 'not a directory');
    rmSync(ran, { force: true });

    const out = await startSpec(fx, fx.repo, 'test').done;
    const lines = out.stderr.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`spec test: no turn can be kept in ${folder}: `);
    expect(lines[0]?.endsWith('; running without one')).toBe(true);
    expect(out.stderr).not.toContain('internal error');
    expect(out.stderr).not.toContain(' at ');
    expect(out.code).toBe(control.code);
    expect(out.stdout).toBe(control.stdout);
    expect(out.stderr).not.toContain('waiting for a test run to finish');
    expect(existsSync(ran)).toBe(true);
  });

  it.skipIf(runningAsRoot)('PIP-009/S28 A readable unwritable turn folder waits for live records', async () => {
    const fx = fixture((dir) => `touch ${quote(join(dir, 'ran'))}; cp passing.json "{report}"`);
    const folder = turnDirectory(fx.repo);
    mkdirSync(folder, { recursive: true });
    const ready = join(fx.repo, 'dummy-holder-ready');
    const dummy = trackChild(spawn(process.execPath, [
      '-e',
      `require("node:fs").writeFileSync(${JSON.stringify(ready)}, "ready"); setInterval(() => {}, 1000)`,
    ], { stdio: 'ignore' }));
    const dummyPid = dummy.pid ?? 0;
    let waiter: Running | null = null;
    try {
      expect(dummyPid).toBeGreaterThan(0);
      await waitFor(() => existsSync(ready), 'dummy live holder did not start');
      writeFileSync(join(folder, String(dummyPid)), JSON.stringify({
        pid: dummyPid,
        command: 'spec check-report',
        ticket: 'PROP-112',
        startedAt: new Date().toISOString(),
        location: 'ticket',
      }));
      chmodSync(folder, 0o555);
      waiter = startSpecWithEnv(fx, fx.repo, { [POLL_INTERVAL_ENV]: '10' }, 'test');
      const noTurnPrefix = `spec test: no turn can be kept in ${folder}: `;
      await waitForOutput(waiter, noTurnPrefix, 'read-only turn folder did not announce its missing write turn');
      const lines = waiter.stderr.split('\n').filter(Boolean);
      expect(lines[0]).toContain(noTurnPrefix);
      expect(lines[0]?.endsWith('; running without one')).toBe(true);
      expect(lines.filter((line) => line.startsWith(noTurnPrefix))).toHaveLength(1);
      expect(waiter.stderr).not.toContain('internal error');
      expect(waiter.stderr).not.toContain(' at ');
      expect(lines[1]).toContain(`spec test: waiting for a test run to finish: ''spec check-report'' on PROP-112 (pid ${dummyPid})`);
      expect(existsSync(join(fx.repo, 'ran'))).toBe(false);

      const dummyDone = new Promise<void>((resolve) => { dummy.once('close', () => { resolve(); }); });
      dummy.kill('SIGTERM');
      await dummyDone;
      await waitForRunCondition(waiter, () => existsSync(join(fx.repo, 'ran')), 'read-only run did not start after the live record ended');
      expect(existsSync(join(fx.repo, 'ran'))).toBe(true);
      expect(existsSync(join(folder, String(waiter.child.pid)))).toBe(false);
      const out = await waiter.done;
      expect(out.code).toBe(0);
      expect(out.stdout).toContain('PASS PRV-001/S1 Streams tokens');
    } finally {
      try { chmodSync(folder, 0o700); } catch { /* the folder may not have been created */ }
      if (dummy.exitCode === null) dummy.kill('SIGTERM');
      releaseAllRuns(fx);
      if (waiter) await Promise.allSettled([waiter.done]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S29 A lower time limit gives no results', async () => {
    const fx = fixture((dir) => `touch ${quote(join(dir, 'lower-time-limit-command-started'))}; sleep 3; cp passing.json "{report}"`);
    const out = await startSpecWithEnv(fx, fx.repo, { [RUN_TIMEOUT_ENV]: '1000' }, 'test').done;
    expect(existsSync(join(fx.repo, 'lower-time-limit-command-started'))).toBe(true);
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/^spec test: /);
    expect(out.stdout).not.toContain('PASS PRV-001/S1 Streams tokens');
  }, TEST_TIMEOUT_MS);

  it.each(['700000', '600000', '0', '-5', '1.5', '1e3', '0x10', ' 7 ', 'abc', ''] as const)('PIP-009/S29 A setting that is not a lower plain decimal value is ignored (%s)', async (value) => {
    const commandDuration = value === '1e3' ? '1.2' : value === '0x10' || value === ' 7 ' ? '0.1' : null;
    const fx = fixture((dir) => `touch ${quote(join(dir, 'ignored-setting-command-started'))}; ${commandDuration === null ? '' : `sleep ${commandDuration}; `}cp passing.json "{report}"`);
    const out = await startSpecWithEnv(fx, fx.repo, { [RUN_TIMEOUT_ENV]: value }, 'test').done;
    expect(out.code, `SPEC_TEST_RUN_TIMEOUT_MS=${JSON.stringify(value)} stderr: ${out.stderr}`).toBe(0);
    expect(existsSync(join(fx.repo, 'ignored-setting-command-started'))).toBe(true);
    expect(out.stdout).toContain('PASS PRV-001/S1 Streams tokens');
    expect(out.stderr).not.toContain('timed out');
  }, TEST_TIMEOUT_MS);

  it('PIP-009/S29 One-millisecond intervals do not skip a wait', async () => {
    const fx = fixture((dir) => gatedCommand(dir));
    const holder = startSpec(fx, fx.repo, 'test');
    let waiter: Running | null = null;
    try {
      await waitForStarted(fx, 1, holder, 'one-millisecond interval holder did not start');
      const waiterRun = startSpecWithEnv(fx, fx.repo, {
        [NOTICE_INTERVAL_ENV]: '1',
        [POLL_INTERVAL_ENV]: '1',
      }, 'test');
      waiter = waiterRun;
      await waitForOutput(waiterRun, 'waiting for a test run to finish', 'one-millisecond settings skipped the waiting notice');
      expect(startedPids(fx)).toHaveLength(1);
      expect(waitingLines(waiterRun.stderr).length).toBeGreaterThanOrEqual(1);
      const holderPid = startedPids(fx)[0] ?? '';
      releaseRun(fx, holderPid);
      await waitForStarted(fx, 2, waiterRun, 'one-millisecond waiter did not start after the holder ended');
      releaseRun(fx, startedPids(fx)[1] ?? '');
      expect((await holder.done).code).toBe(0);
      expect((await waiterRun.done).code).toBe(0);
      expect(waitingLines(waiterRun.stderr).length).toBeGreaterThanOrEqual(1);
    } finally {
      releaseAllRuns(fx);
      await Promise.allSettled([holder.done, ...(waiter ? [waiter.done] : [])]);
      resetRuns(fx);
    }
  }, TEST_TIMEOUT_MS);
});
