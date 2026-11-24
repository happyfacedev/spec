// PIP-024/S11 (PROP-116): the proof run takes its own turn after the whole-tree run has given its turn back,
// has its own time limit, and two checks never share a proof tree. The test command of build-lane-fixture.ts
// waits on files outside the repository (whole-gate, holder-release, proof-gate), so every step waits for an
// event with a generous limit and never for a fixed time.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, trackChild } from '../helpers';
import { buildStage, cleanupAll, safeJson, snapshot, type Case } from './build-lane-fixture';

afterAll(cleanupAll);

const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const MAIN = join(REPO, 'src/cli/main.ts');
const WAITING = 'waiting for a test run to finish';
const EVENT_LIMIT_MS = 90_000;

interface Running { child: ReturnType<typeof spawn>; done: Promise<{ code: number | null; stdout: string; stderr: string }>; readonly stdout: string; readonly stderr: string }

function spawnCli(c: Case, env: NodeJS.ProcessEnv, ...argv: string[]): Running {
  const e = { ...process.env };
  delete e['SPEC_ROOT'];
  delete e['CLAUDE_PROJECT_DIR'];
  delete e['SPEC_CLI_DELEGATED'];
  delete e['SPEC_PLUGIN_VERSION'];
  Object.assign(e, env);
  const child = trackChild(spawn(process.execPath, [TSX, MAIN, ...argv, '--root', join(c.fx.repo, 'spec')], { cwd: c.fx.repo, env: e, stdio: ['ignore', 'pipe', 'pipe'] }));
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (part: string) => { stdout += part; });
  child.stderr.setEncoding('utf8').on('data', (part: string) => { stderr += part; });
  const done = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { resolve({ code, stdout, stderr }); });
  });
  return { child, done, get stdout() { return stdout; }, get stderr() { return stderr; } };
}

async function waitFor(predicate: () => boolean, message: string, run?: Running): Promise<void> {
  const state = { finished: false };
  void run?.done.then(() => { state.finished = true; });
  const until = Date.now() + EVENT_LIMIT_MS;
  while (!predicate() && !state.finished && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 20));
  expect(predicate(), `${message}${run === undefined ? '' : `; stdout: ${run.stdout}; stderr: ${run.stderr}`}`).toBe(true);
}

const turnFolder = (c: Case) => join(realpathSync(join(c.fx.repo, '.git')), 'spec-test-runs');
/** The tickets named by the turn records now in the repository. */
const turnTickets = (c: Case): (string | null)[] => {
  const folder = turnFolder(c);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => /^\d+$/.test(name))
    .map((name) => safeJson<{ ticket: string | null }>(readFileSync(join(folder, name), 'utf8'))?.ticket ?? null);
};
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const flagged = (c: Case, name: string): boolean => existsSync(join(c.scratch, name));

describe('PIP-024/S11 The proof run takes its own turn, and two checks do not share a tree', () => {
  it('PIP-024/S11 The proof run takes its own turn, and two checks do not share a tree', async () => {
    const c = await buildStage('turns');
    const message = join(c.scratch, 'report.md');
    writeFileSync(message, c.implementer());
    const quick = { SPEC_TEST_RUN_NOTICE_INTERVAL_MS: '100', SPEC_TEST_RUN_POLL_INTERVAL_MS: '10' };

    // "spec test" in the main checkout takes the only turn after the stage's whole-tree run gave its turn back.
    c.flag('whole-gate', true);
    const check = spawnCli(c, { ...quick, SPEC_TEST_RUN_TIMEOUT_MS: '15000' }, 'check-report', 'implementer', c.id, '--report-file', message, '--format', 'json');
    await waitFor(() => flagged(c, 'whole-started'), 'the whole-tree run did not start', check);
    const holder = spawnCli(c, { ...quick, HOLD_TURN: '1' }, 'test');
    await waitFor(() => holder.stderr.includes(WAITING), 'spec test did not wait for the whole-tree run', holder);
    c.flag('whole-release', true);
    await waitFor(() => flagged(c, 'holder-started'), 'spec test did not take the turn the whole-tree run gave back', holder);
    // The proof run waits, with "waiting for a test run to finish" on stderr, and has not started.
    await waitFor(() => check.stderr.includes(WAITING), 'the proof run did not announce its wait', check);
    expect(c.runs()).toHaveLength(1);
    // It keeps waiting longer than the test command's time limit: the limit counts from its own start.
    await waitFor(() => check.stderr.split('\n').filter((l) => l.includes(WAITING)).length >= 170, 'the proof run did not wait past the time limit', check);
    c.flag('holder-release', true);
    expect((await holder.done).code).toBe(0);
    const checked = await check.done;
    expect(checked.stderr).not.toContain('could not run');
    expect(safeJson<{ ok: boolean }>(checked.stdout)?.ok).toBe(true);
    expect(c.runs(), 'the whole-tree run and the proof run').toHaveLength(2);

    // While it runs it holds one turn recorded for PROP-215; a check interrupted with Ctrl-C stops its test command and gives its turn back.
    const before = snapshot(c.fx);
    c.flag('proof-gate', true);
    const second = spawnCli(c, quick, 'check-report', 'implementer', c.id, '--report-file', message, '--format', 'json');
    await waitFor(() => flagged(c, 'proof-started'), 'the proof run did not start', second);
    expect(turnTickets(c)).toEqual([c.id]);
    const pid = Number(readFileSync(join(c.scratch, 'proof-pid'), 'utf8').trim());
    expect(alive(pid)).toBe(true);
    // The proof tree is a folder of its own while the proof run goes on, and is removed when the check is interrupted (R4).
    const folder = c.runs().at(-1)?.dir ?? c.fx.repo;
    expect(folder).not.toBe(c.fx.repo);
    expect(existsSync(folder), 'the proof folder exists during the proof run').toBe(true);
    second.child.kill('SIGINT');
    await second.done;
    await waitFor(() => !alive(pid), 'the proof run\'s test command was not stopped');
    await waitFor(() => !existsSync(folder), 'the proof folder was left behind after the interrupt');
    expect(turnTickets(c)).toEqual([]);
    expect(snapshot(c.fx)).toEqual(before);
    c.flag('proof-gate', false);
  }, 300_000);

  it('PIP-024/S11 two checks at the same time each make their own proof tree and give the result they would give alone', async () => {
    const c = await buildStage('turns-two');
    const message = join(c.scratch, 'report.md');
    writeFileSync(message, c.implementer());
    const a = spawnCli(c, {}, 'check-report', 'implementer', c.id, '--report-file', message, '--format', 'json');
    const b = spawnCli(c, {}, 'check-report', 'implementer', c.id, '--report-file', message, '--format', 'json');
    const [first, second] = await Promise.all([a.done, b.done]);
    for (const out of [first, second]) {
      expect(safeJson<{ ok: boolean; problems: string[] }>(out.stdout), out.stderr).toMatchObject({ ok: true, problems: [] });
    }
    const proofs = c.runs().filter((run) => Number(run.files['src/providers/config.ts'] ?? 'absent') === 0).map((run) => run.dir);
    expect(proofs).toHaveLength(2);
    expect(new Set(proofs).size).toBe(2);
  }, 300_000);
});
