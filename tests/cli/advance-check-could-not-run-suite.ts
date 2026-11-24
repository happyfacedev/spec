// PIP-022 / INV-015: a test run that gave no results is a check that could not run. `spec ticket
// advance` then records nothing, counts no refusal and exits 3. Each fixture's test command is a
// script driven by a `mode` file outside the repository: pass, fail (PRV-001/S1 fails), red (the
// bug's PRV-002/S3 fails), noreport (exit 0, no report), garbage (a report in no known format).
// A timeout is 10 minutes and a command that cannot start needs a broken shell, so the modes
// `timeout` and `nostart` are simulated: the child_process module the test runner takes gives the
// spawn error a real run gives (spawnSync /bin/sh ETIMEDOUT) for a command that names the fixture.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync as spawnProcess } from 'node:child_process';
import type * as ChildProcess from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { partitionedDescribe, partitionedIt } from './partitioned-it';
const describe = partitionedDescribe(2, 'PIP-022 a check that could not run is not a refused report');
const it = partitionedIt(2);
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { loadReport, loadTranscriptPath, saveReport } from '../../src/io/report-store';
import { gitFixture, report, testerMutations, validTesterMutations, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
// `hold` is `timeout` that first runs the callback registered in `during` for the fixture: the work another
// command does while this test run is going on (the stubbed run is synchronous, so the callback is the only way in).
type Mode = 'pass' | 'fail' | 'red' | 'noreport' | 'garbage' | 'timeout' | 'nostart' | 'hold';

const scratches = new Set<string>();
const during = new Map<string, () => void>();
const fixtures: Fx[] = [];
const worktrees: { fx: Fx; path: string }[] = [];

const SCRIPT = [
  'dir=$1; out=$2',
  'echo x >> "$dir/count"',
  'mode=$(cat "$dir/mode")',
  'case "$mode" in',
  '  noreport) exit 0 ;;',
  '  garbage) echo "this is not a test report" > "$out"; exit 0 ;;',
  '  fail)',
  '    echo \'{"testResults":[{"assertionResults":[{"title":"PRV-001/S1 Streams tokens","status":"failed"}]}]}\' > "$out"',
  '    exit 1 ;;',
  '  red)',
  '    echo \'{"testResults":[{"assertionResults":[{"title":"PRV-002/S1 Fallback enabled","status":"passed"},{"title":"PRV-002/S2 Fallback disabled","status":"passed"},{"title":"PRV-002/S3 Fallback provider also rate-limits","status":"failed"},{"title":"PRV-002/S4 Fallback provider not enabled","status":"passed"}]}]}\' > "$out"',
  '    exit 1 ;;',
  'esac',
  'echo \'{"testResults":[{"assertionResults":[{"title":"PRV-001/S1 Streams tokens","status":"passed"}]}]}\' > "$out"',
  'exit 0',
  '',
].join('\n');

beforeAll(() => {
  const real = process.getBuiltinModule.bind(process);
  const patched = (id: string): unknown => {
    const mod: typeof ChildProcess = real(id as 'node:child_process');
    if (id !== 'node:child_process') return mod;
    const spawnSync = (command: string, args?: readonly string[], options?: object) => {
      const line = args?.[1] ?? '';
      const dir = [...scratches].find((s) => line.includes(s));
      const mode = dir !== undefined && existsSync(join(dir, 'mode')) ? readFileSync(join(dir, 'mode'), 'utf8').trim() : '';
      if (dir !== undefined && (mode === 'timeout' || mode === 'nostart' || mode === 'hold')) {
        appendFileSync(join(dir, 'count'), 'x\n');
        if (mode === 'hold') {
          const work = during.get(dir);
          during.delete(dir);
          work?.();
        }
        const code = mode === 'nostart' ? 'ENOENT' : 'ETIMEDOUT';
        const error = Object.assign(new Error(`spawnSync /bin/sh ${code}`), { code });
        return { error, status: null, signal: null, stdout: '', stderr: '', pid: 0, output: [null, '', ''] };
      }
      return (mod.spawnSync as (c: string, a?: readonly string[], o?: object) => unknown)(command, args, options);
    };
    return { ...mod, spawnSync };
  };
  vi.spyOn(process, 'getBuiltinModule').mockImplementation(patched as unknown as typeof process.getBuiltinModule);
});

afterAll(() => {
  vi.restoreAllMocks();
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
  for (const s of scratches) rmSync(s, { recursive: true, force: true });
});

interface Env {
  fx: Fx;
  scratch: string;
  mode(m: Mode): void;
  runs(): number;
}

/** A git copy of chat-mini whose test command is the script, driven by the mode file. */
function make(prefix: string, tweak: (dir: string) => void = () => undefined): Env {
  const scratch = tempDir(`${prefix}-`);
  scratches.add(scratch);
  const script = join(scratch, 'runner.sh');
  writeFileSync(script, SCRIPT);
  writeFileSync(join(scratch, 'mode'), 'pass');
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `sh '${script}' '${scratch}' "{report}"`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      tweak(dir);
    },
  });
  fixtures.push(fx);
  return {
    fx,
    scratch,
    mode: (m) => {
      writeFileSync(join(scratch, 'mode'), m);
    },
    runs: () => (existsSync(join(scratch, 'count')) ? readFileSync(join(scratch, 'count'), 'utf8').split('\n').filter(Boolean).length : 0),
  };
}

const implementerDone = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Kept the implementation unchanged');
// Refused at intake without a test run (PIP-008/R12: a run kept by a refused report would be reused by the next advance).
const wrongRole = report('role: tester\nticket: TASK-101\nresult: blocked\nsummary: Incorrect role\nblockers: [{ text: Waiting, cites: [TASK-101] }]');
const testerDone = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the PRV-002/S3 test; it fails on main\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
const REASON = 'spawnSync /bin/sh ETIMEDOUT';
const lastLine = (text: string) => text.trimEnd().split('\n').at(-1) ?? '';

/** TASK-101's implementer stage with src/app.ts changed, and one earlier intake of its report refused (refusal count 1). */
async function implementerStage(prefix: string): Promise<Env> {
  const e = make(prefix);
  expect((await e.fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
  appendFileSync(join(e.fx.repo, 'src/app.ts'), '\n// changed\n');
  const first = await e.fx.spec(wrongRole, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
  expect(JSON.parse(first.stdout)).toMatchObject({ attempt: 1, status: 'in_progress' });
  writeFileSync(join(e.fx.repo, '.git/report.md'), implementerDone);
  return e;
}

/** Everything a check that could not run must leave as it found it. */
const snapshot = (fx: Fx, id: string) => ({
  head: fx.git('rev-parse', 'HEAD').stdout,
  status: fx.git('status', '--porcelain', '--untracked-files=all').stdout,
  stash: fx.git('stash', 'list').stdout,
  ticket: fx.ticket(id),
});

/** Stores a done implementer report with a transcript, as the finish check does; returns what was stored. */
function storeReport(e: Env, summary: string, model: string, cost: number): { report: string; transcript: string } {
  const text = report(`role: implementer\nticket: TASK-101\nresult: done\nsummary: ${summary}`);
  const transcript = join(e.scratch, `${model}.jsonl`);
  writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', model, content: 'done' } })}\n${JSON.stringify({ type: 'result', total_cost_usd: cost })}\n`);
  saveReport(e.fx.repo, 'TASK-101', text, transcript);
  return { report: text, transcript };
}

/** The bytes of the stored report and of the transcript path kept beside it; null for a file that is not there. */
function storedFiles(e: Env): { report: Buffer | null; transcript: Buffer | null } {
  const read = (name: string) => (existsSync(join(e.fx.repo, '.git/spec/reports', name)) ? readFileSync(join(e.fx.repo, '.git/spec/reports', name)) : null);
  return { report: read('TASK-101.md'), transcript: read('TASK-101.transcript') };
}

const advanceFile = (e: Env, ...extra: string[]) => e.fx.spec('', 'ticket', 'advance', 'TASK-101', '--report-file', '.git/report.md', ...extra);

describe('PIP-022 a check that could not run is not a refused report', () => {
  it('PIP-022/S1 A test run that gave no results does not refuse the report', async () => {
    const e = await implementerStage('pip022-s1');
    e.mode('timeout');
    const before = snapshot(e.fx, 'TASK-101');
    const out = await advanceFile(e);
    expect(out.stderr.startsWith(`the check could not run: the test command gave no results: ${REASON}`), out.stderr).toBe(true);
    expect(lastLine(out.stderr)).toMatch(/again/i);
    expect(out.code).toBe(3);
    expect(out.stderr).not.toContain('report refused');
    expect(out.stderr).not.toContain('attempt');
    const after = snapshot(e.fx, 'TASK-101');
    expect(after).toEqual(before);
    expect(after.ticket).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    expect(after.status).toContain(' M src/app.ts');
    expect(after.stash).not.toContain('TASK-101 implementer: blocked');
    expect(loadReport(e.fx.repo, 'TASK-101')).toBeNull();
    // The refusal count is still 1: the next report refused for a failing test is attempt 2 of 3.
    e.mode('fail');
    const refused = await advanceFile(e);
    expect(refused.code).toBe(1);
    expect(refused.stderr.startsWith('report refused (attempt 2 of 3):'), refused.stderr).toBe(true);
  }, 120_000);

  it('PIP-022/S1 A test run that gave no results does not refuse the report, in JSON', async () => {
    const e = await implementerStage('pip022-s1-json');
    e.mode('timeout');
    const before = snapshot(e.fx, 'TASK-101');
    const out = await advanceFile(e, '--format', 'json');
    expect(out.code).toBe(3);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', next: null, status: 'in_progress', problems: [`the test command gave no results: ${REASON}`] });
    expect(snapshot(e.fx, 'TASK-101')).toEqual(before);
  }, 120_000);

  it('PIP-022/S1 A test run that gave no results does not refuse the report, from the primary checkout', async () => {
    const e = make('pip022-s1-primary');
    const { fx } = e;
    const next = await fx.spec('', 'next', 'TASK-101', '--format', 'json');
    expect(next.code, next.stderr).toBe(0);
    const worktree = (JSON.parse(next.stdout) as { worktree: string }).worktree;
    worktrees.push({ fx, path: worktree });
    appendFileSync(join(worktree, 'src/app.ts'), '\n// changed\n');
    writeFileSync(join(fx.repo, '.git/final-report.md'), implementerDone);
    const ticketIn = () => parseTicket('tickets/TASK-101.md', readFileSync(join(worktree, 'tickets/TASK-101.md'), 'utf8')).ticket?.data;
    const state = () => ({
      head: fx.git('-C', worktree, 'rev-parse', 'HEAD').stdout,
      status: fx.git('-C', worktree, 'status', '--porcelain', '--untracked-files=all').stdout,
      stash: fx.git('stash', 'list').stdout,
      ticket: ticketIn(),
    });
    const before = state();
    expect(before.ticket).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    e.mode('timeout');
    const out = await run({
      argv: ['ticket', 'advance', 'TASK-101', '--report-file', '.git/final-report.md', '--root', join(fx.repo, 'spec')],
      env: {},
      cwd: join(fx.repo, 'src'),
      scriptPath: undefined,
      now: () => '2026-10-30T12:00:00.000Z',
    });
    expect(out.stderr.startsWith(`the check could not run: the test command gave no results: ${REASON}`), out.stderr).toBe(true);
    expect(out.code).toBe(3);
    expect(state()).toEqual(before);
  }, 120_000);

  it('PIP-022/S2 The same report is accepted when the retry gets results', async () => {
    const e = await implementerStage('pip022-s2');
    e.mode('timeout');
    expect((await advanceFile(e)).code).toBe(3);
    e.mode('pass');
    const out = await advanceFile(e);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual(['TASK-101 implementer: Kept the implementation unchanged', 'next: reviewer']);
    const last = e.fx.ticket('TASK-101')?.history.at(-1);
    expect(last).toMatchObject({ role: 'implementer', result: 'done', refusals: 1 });
  }, 120_000);

  it('PIP-022/S2 A report given on stdin is not stored by the run that could not check it', async () => {
    const e = await implementerStage('pip022-s2-stdin');
    const advanceStdin = () => e.fx.spec(implementerDone, 'ticket', 'advance', 'TASK-101', '--report', '-');
    e.mode('timeout');
    const out = await advanceStdin();
    expect(out.code).toBe(3);
    expect(loadReport(e.fx.repo, 'TASK-101')).toBeNull();
    e.mode('pass');
    const retry = await advanceStdin();
    expect(retry.code, retry.stderr).toBe(0);
    expect(retry.stdout.split('\n').slice(0, 2)).toEqual(['TASK-101 implementer: Kept the implementation unchanged', 'next: reviewer']);
    expect(e.fx.ticket('TASK-101')?.history.at(-1)).toMatchObject({ result: 'done', refusals: 1 });
  }, 120_000);

  it('PIP-022/S2 A report the finish check stored stays stored until the tests give results', async () => {
    const e = make('pip022-s2-stored');
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    saveReport(e.fx.repo, 'TASK-101', implementerDone);
    const stored = loadReport(e.fx.repo, 'TASK-101');
    expect(stored).not.toBeNull();
    e.mode('timeout');
    const out = await e.fx.spec('', 'ticket', 'advance', 'TASK-101');
    expect(out.code).toBe(3);
    expect(out.stderr.startsWith(`the check could not run: the test command gave no results: ${REASON}`), out.stderr).toBe(true);
    expect(loadReport(e.fx.repo, 'TASK-101')).toBe(stored);
    expect(e.fx.ticket('TASK-101')).toMatchObject({ status: 'in_progress', stage: 'implementer', history: [] });
    e.mode('pass');
    const retry = await e.fx.spec('', 'ticket', 'advance', 'TASK-101');
    expect(retry.code, retry.stderr).toBe(0);
    expect(retry.stdout.split('\n').slice(0, 2)).toEqual(['TASK-101 implementer: Kept the implementation unchanged', 'next: reviewer']);
    expect(loadReport(e.fx.repo, 'TASK-101')).toBeNull();
    expect(e.fx.ticket('TASK-101')?.history.at(-1)).not.toHaveProperty('refusals');
  }, 120_000);

  it('PIP-022/S2 A stored report and its transcript survive a no-results advance that brings its own report', async () => {
    for (const via of ['--report-file', '--report -']) {
      const e = await implementerStage('pip022-s2-kept');
      const kept = storeReport(e, 'The stored one', 'stored-model', 0.05);
      const before = storedFiles(e);
      const advance = () => (via === '--report-file' ? advanceFile(e) : e.fx.spec(implementerDone, 'ticket', 'advance', 'TASK-101', '--report', '-'));
      e.mode('timeout');
      const out = await advance();
      expect(out.code, `${via}: ${out.stderr}`).toBe(3);
      expect(out.stderr.startsWith('the check could not run: '), via).toBe(true);
      // Byte for byte what the finish check stored, nothing rewritten, nothing deleted.
      expect(storedFiles(e), `${via}: the stored report and transcript path`).toEqual(before);
      expect(loadReport(e.fx.repo, 'TASK-101'), via).toBe(kept.report);
      expect(loadTranscriptPath(e.fx.repo, 'TASK-101'), via).toBe(kept.transcript);
      // Usable on retry: with nothing on stdin, advance records the stored report with the stored transcript.
      e.mode('pass');
      const retry = await e.fx.spec('', 'ticket', 'advance', 'TASK-101');
      expect(retry.code, `${via}: ${retry.stderr}`).toBe(0);
      expect(retry.stdout.split('\n').slice(0, 2), via).toEqual(['TASK-101 implementer: The stored one', 'next: reviewer']);
      expect(e.fx.ticket('TASK-101')?.history.at(-1), via).toMatchObject({ role: 'implementer', result: 'done', summary: 'The stored one', model: 'stored-model', cost_usd: 0.05, refusals: 1 });
      expect(loadReport(e.fx.repo, 'TASK-101'), via).toBeNull();
    }
  }, 300_000);

  it('PIP-022/S2 Another advance that records the stage meanwhile is not undone by a no-results advance', async () => {
    for (const via of ['--report-file', '--report -']) {
      const e = await implementerStage('pip022-r1-consumed');
      storeReport(e, 'The stored one', 'stored-model', 0.05);
      // While this advance waits for its test run, a second advance takes the stage's report from stdin, which deletes
      // the stored one (PIP-008/R5), and records the stage.
      const competitor = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: The competitor');
      let second: { status: number | null; stderr: string } = { status: null, stderr: 'the hook did not run' };
      during.set(e.scratch, () => {
        const r = spawnProcess(join(e.fx.repo, '.spec/bin/spec'), ['ticket', 'advance', 'TASK-101', '--root', join(e.fx.repo, 'spec')], { cwd: e.fx.repo, input: competitor, encoding: 'utf8' });
        second = { status: r.status, stderr: `${r.stderr}${r.error?.message ?? ''}` };
      });
      e.mode('hold');
      if (via === '--report-file') await advanceFile(e);
      else await e.fx.spec(implementerDone, 'ticket', 'advance', 'TASK-101', '--report', '-');
      expect(second.status, `${via}: ${second.stderr}`).toBe(0);
      // The stage was recorded by the second advance, once, and its report is gone: the first put nothing back.
      const done = e.fx.ticket('TASK-101')?.history.filter((h) => h.role === 'implementer' && h.result === 'done');
      expect(done?.map((h) => h.summary), via).toEqual(['The competitor']);
      expect(e.fx.git('log', '-1', '--format=%s').stdout.trim(), via).toBe('TASK-101 implementer: The competitor');
      expect(loadReport(e.fx.repo, 'TASK-101'), `${via}: the consumed report came back`).toBeNull();
      expect(loadTranscriptPath(e.fx.repo, 'TASK-101'), `${via}: the consumed transcript path came back`).toBeNull();
    }
  }, 300_000);

  it('PIP-022/S2 A newer stored report is not overwritten by a no-results advance', async () => {
    for (const via of ['--report-file', '--report -']) {
      const e = await implementerStage('pip022-r1-newer');
      storeReport(e, 'The stored one', 'stored-model', 0.05);
      // While this advance waits for its test run, the finish check stores a newer report.
      const newer: { report: string; transcript: string }[] = [];
      during.set(e.scratch, () => {
        newer.push(storeReport(e, 'The newer one', 'newer-model', 0.07));
      });
      e.mode('hold');
      const before = e.fx.ticket('TASK-101');
      if (via === '--report-file') await advanceFile(e);
      else await e.fx.spec(implementerDone, 'ticket', 'advance', 'TASK-101', '--report', '-');
      expect(newer, `${via}: the hook did not run`).toHaveLength(1);
      expect(loadReport(e.fx.repo, 'TASK-101'), `${via}: the newer report was overwritten`).toBe(newer[0]?.report);
      expect(loadTranscriptPath(e.fx.repo, 'TASK-101'), `${via}: the newer transcript path was overwritten`).toBe(newer[0]?.transcript);
      expect(e.fx.ticket('TASK-101'), via).toEqual(before);
      // And the newer one is what a retry records.
      e.mode('pass');
      const retry = await e.fx.spec('', 'ticket', 'advance', 'TASK-101');
      expect(retry.code, `${via}: ${retry.stderr}`).toBe(0);
      expect(e.fx.ticket('TASK-101')?.history.at(-1), via).toMatchObject({ summary: 'The newer one', model: 'newer-model', cost_usd: 0.07 });
    }
  }, 300_000);

  it('PIP-022/S3 Every way a run gives no results is a check that could not run', async () => {
    // The premise: with results (the bug's test red) the same report is recorded.
    const good = make('pip022-s3-good');
    await startTester(good);
    appendTest(good);
    good.mode('red');
    const recorded = await good.fx.spec(testerDone, 'ticket', 'advance', 'BUG-301');
    expect(recorded.code, recorded.stderr).toBe(0);
    expect(recorded.stdout.split('\n')[1]).toBe('next: implementer');

    const ways: { mode: Mode; reason: string }[] = [
      { mode: 'nostart', reason: 'spawnSync /bin/sh ENOENT' },
      { mode: 'timeout', reason: REASON },
      { mode: 'noreport', reason: 'the test command wrote no report' },
      { mode: 'garbage', reason: 'the test report is neither JSON nor JUnit XML' },
    ];
    for (const way of ways) {
      const e = make(`pip022-s3-${way.mode}`);
      await startTester(e);
      appendTest(e);
      e.mode(way.mode);
      const before = snapshot(e.fx, 'BUG-301');
      const out = await e.fx.spec(testerDone, 'ticket', 'advance', 'BUG-301');
      expect(out.stderr.startsWith('the check could not run: the test command gave no results: '), `${way.mode}: ${out.stderr}`).toBe(true);
      expect(out.stderr, way.mode).toContain(way.reason);
      expect(out.code, way.mode).toBe(3);
      expect(snapshot(e.fx, 'BUG-301'), `${way.mode}: nothing changed`).toEqual(before);
      // No refusal was counted: the record made once the tests give results has none.
      e.mode('red');
      const retry = await e.fx.spec(testerDone, 'ticket', 'advance', 'BUG-301');
      expect(retry.code, `${way.mode}: ${retry.stderr}`).toBe(0);
      const last = e.fx.ticket('BUG-301')?.history.at(-1);
      expect(last, way.mode).toMatchObject({ role: 'tester', result: 'done', mutations: testerMutations('PRV-002/S3') });
      expect(last, way.mode).not.toHaveProperty('refusals');
    }
  }, 300_000);

  it('PIP-022/S4 A run that gave results with a test failing is still refused', async () => {
    const e = make('pip022-s4-fail');
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    writeFileSync(join(e.fx.repo, '.git/report.md'), implementerDone);
    e.mode('fail');
    const out = await advanceFile(e);
    expect(out.stderr.startsWith('report refused (attempt 1 of 3):'), out.stderr).toBe(true);
    expect(out.stderr).toContain('tests fail (exit 1): PRV-001/S1 Streams tokens');
    expect(out.code).toBe(1);
  }, 120_000);

  it('PIP-022/S4 A project with no testCommand is still refused', async () => {
    const e = make('pip022-s4-bare');
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    rmSync(join(e.fx.repo, 'spec/config.json'));
    writeFileSync(join(e.fx.repo, '.git/report.md'), implementerDone);
    const out = await advanceFile(e);
    expect(out.stderr.startsWith('report refused (attempt 1 of 3):'), out.stderr).toBe(true);
    expect(out.stderr).toContain('- the test command gave no results: config.json has no testCommand');
    expect(out.code).toBe(1);
  }, 120_000);

  it('PIP-022/S4 A report with another problem is still refused when the test command times out', async () => {
    const e = make('pip022-s4-mixed', (dir) => {
      const file = join(dir, 'tickets/PROP-205.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: in_progress').replace(/^stage: .*$/m, 'stage: implementer'));
    });
    writeFileSync(join(e.fx.repo, 'src/conversation/copy.ts'), 'export const copy = 1;\n');
    appendFileSync(join(e.fx.repo, 'tests/PRV-001.test.ts'), '\n// touched\n');
    writeFileSync(join(e.fx.repo, '.git/report.md'), report('role: implementer\nticket: PROP-205\nresult: done\nsummary: Added the copy action'));
    e.mode('timeout');
    const out = await e.fx.spec('', 'ticket', 'advance', 'PROP-205', '--report-file', '.git/report.md');
    expect(out.stderr.startsWith('report refused (attempt 1 of 3):'), out.stderr).toBe(true);
    expect(out.stderr).toContain("- on a proposal the tests are the tester's and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong");
    expect(out.stderr).toContain(`- the test command gave no results: ${REASON}`);
    expect(out.stderr).not.toContain('the check could not run');
    expect(out.code).toBe(1);
  }, 120_000);

  it('PIP-022/S4 A done reviewer report is recorded although the test command would time out', async () => {
    const e = make('pip022-s4-reviewer');
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const implemented = await e.fx.spec(report('role: implementer\nticket: TASK-103\nresult: done\nsummary: Nothing to change'), 'ticket', 'advance', 'TASK-103');
    expect(implemented.code, implemented.stderr).toBe(0);
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-103', 'reviewer')).code).toBe(0);
    e.mode('timeout');
    const runsBefore = e.runs();
    const out = await e.fx.spec(report('role: reviewer\nticket: TASK-103\nresult: done\nsummary: No change to review\nverdict: approve'), 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-103', status: 'done', next: null, problems: [] });
    expect(e.runs(), 'the test command did not run for a reviewer').toBe(runsBefore);
  }, 120_000);
});

/** BUG-301's tester stage started. */
async function startTester(e: Env): Promise<Env> {
  expect((await e.fx.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
  return e;
}

/** The tester's work: the bug's test, added to the test file. */
function appendTest(e: Env): void {
  appendFileSync(join(e.fx.repo, 'tests/PRV-002.test.ts'), "\nit('PRV-002/S3 Fallback provider also rate-limits', () => {\n  throw new Error('red');\n});\n");
}
