// PIP-004 S24 to S28 and CLI-001/S16: `spec check-report --report-file <path>`, through the CLI on a
// throwaway copy of chat-mini. Runs that must not wait for stdin pass a stdin that never closes.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, gitFixture, report } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const dirs: string[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const PASSING = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-001/S1 Streams tokens', status: 'passed' }] }] });
const TEST_COMMAND = 'cp test-report.json "{report}"';
const NOTICE = 'tests: running the test command';

/** A throwaway project with `ticket` in its `role` stage and a test command that gives a passing run. */
async function stage(ticket: string, role: string, testCommand = TEST_COMMAND): Promise<Fx> {
  const fx = gitFixture('spec-check-report-file', {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = testCommand;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      writeFileSync(join(dir, 'test-report.json'), PASSING);
    },
  });
  made.push(fx);
  expect((await fx.spec('', 'ticket', 'start', ticket, role)).code).toBe(0);
  return fx;
}

/** The stage of PIP-004/S1: TASK-101 in its implementer stage with only src/providers/select.ts changed. */
async function s1Stage(testCommand?: string): Promise<Fx> {
  const fx = await stage('TASK-101', 'implementer', testCommand);
  writeFileSync(join(fx.repo, 'src/providers/select.ts'), 'export const select = 1;\n');
  return fx;
}

const done = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection\nchanged: [PRV-001/S1]');
const refused = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: x\nverdict: approve');
const otherTicket = report('role: implementer\nticket: TASK-103\nresult: done\nsummary: Extracted provider selection\nchanged: [PRV-001/S1]');

/** The file inside the project's .git folder, which no check counts as a change of the working tree. */
const putFile = (fx: Fx, name: string, text: string): string => {
  writeFileSync(join(fx.repo, name), text);
  return name;
};

/** A run in process, with `stdin` as the stdin provider and `cwd` as the folder it runs in. */
const at = (fx: Fx, cwd: string, stdin: () => Promise<string>, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(fx.repo, 'spec')], env: {}, cwd, scriptPath: undefined, stdin, now: () => '2026-10-27T12:00:00.000Z' });
const never = (): Promise<string> => new Promise<string>(() => {});
const closed = (text: string) => () => Promise.resolve(text);

/** The result of `p`, or 'hung' when it has not settled within 20 seconds. */
async function settled<T>(p: Promise<T>): Promise<T | 'hung'> {
  let timer: NodeJS.Timeout | undefined;
  const hung = new Promise<'hung'>((resolve) => {
    timer = setTimeout(() => {
      resolve('hung');
    }, 20_000);
  });
  try {
    return await Promise.race([p, hung]);
  } finally {
    clearTimeout(timer);
  }
}

const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const MAIN = join(REPO, 'src/cli/main.ts');

interface Spawned {
  timedOut: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  /** Milliseconds from the start to the first byte on stderr, or null when there was none. */
  firstStderrMs: number | null;
  /** Milliseconds from the start to the exit. */
  closedMs: number;
}

/** The real entry point as a child process. `input` is written to stdin and closed; null leaves stdin open. */
const spawnSpec = (fx: Fx, input: string | null, ...argv: string[]): Promise<Spawned> => spawnEntry([TSX, MAIN], fx, input, argv);

/** The plugin launcher, which hands a project command to the project's pinned .spec/bin CLI. */
const spawnPlugin = (fx: Fx, input: string | null, ...argv: string[]): Promise<Spawned> => spawnEntry([join(REPO, 'plugin/scripts/spec')], fx, input, argv);

function spawnEntry(entry: string[], fx: Fx, input: string | null, argv: string[]): Promise<Spawned> {
  const env = { ...process.env };
  delete env.SPEC_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  delete env.SPEC_CLI_DELEGATED;
  delete env.SPEC_PLUGIN_VERSION;
  const child = spawn(process.execPath, [...entry, ...argv, '--root', join(fx.repo, 'spec')], { cwd: fx.repo, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const started = Date.now();
  let stdout = '';
  let stderr = '';
  let firstStderrMs: number | null = null;
  let timedOut = false;
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    firstStderrMs ??= Date.now() - started;
    stderr += chunk;
  });
  child.stdin.on('error', () => {});
  if (input !== null) child.stdin.end(input);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 25_000);
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ timedOut, code, stdout, stderr, firstStderrMs, closedMs: Date.now() - started });
    });
  });
}

describe('PIP-004 check-report --report-file', () => {
  it('PIP-004/S24 A report in a file is checked as one on stdin', async () => {
    const fx = await s1Stage();
    const rel = putFile(fx, '.git/TASK-101-i.md', done);
    // Run from a folder inside the project: a relative path is read from the project root, not from here.
    const cwd = join(fx.repo, 'src/providers');

    const ok = await settled(at(fx, cwd, never, 'check-report', 'implementer', 'TASK-101', '--report-file', rel));
    expect(ok, 'check-report waited for stdin to close').not.toBe('hung');
    if (ok === 'hung') return;
    expect(ok.stderr).not.toContain('does not exist');
    expect(ok.stdout).toBe('report ok\n');
    expect(ok.code).toBe(0);

    // The report of S2 in the file gives the stdout and exit code of S2.
    const bad = await settled(at(fx, cwd, never, 'check-report', 'implementer', 'TASK-101', '--report-file', putFile(fx, '.git/TASK-101-bad.md', refused)));
    expect(bad, 'check-report waited for stdin to close').not.toBe('hung');
    if (bad === 'hung') return;
    expect(bad.code).toBe(1);
    expect(bad.stdout).toMatch(/^report rejected:\n(- .+\n?)+$/);
    expect(bad.stdout).toContain('- only the reviewer and the spec review set verdict and findings');

    // With --format json, stdout is the ReportCheck of S3.
    const json = await settled(at(fx, cwd, never, 'check-report', 'implementer', 'TASK-101', '--report-file', rel, '--format', 'json'));
    expect(json, 'check-report waited for stdin to close').not.toBe('hung');
    if (json === 'hung') return;
    expect(json.code).toBe(0);
    expect(JSON.parse(json.stdout)).toMatchObject({ ok: true, problems: [], report: { role: 'implementer', ticket: 'TASK-101', result: 'done', changed: ['PRV-001/S1'] } });

    // An absolute path to the same file gives the same result.
    const absolute = await settled(at(fx, cwd, never, 'check-report', 'implementer', 'TASK-101', '--report-file', join(fx.repo, rel)));
    expect(absolute, 'check-report waited for stdin to close').not.toBe('hung');
    if (absolute === 'hung') return;
    expect(absolute.stdout).toBe('report ok\n');
    expect(absolute.code).toBe(0);
  }, 120_000);

  it('PIP-004/S25 The file wins over stdin', async () => {
    const fx = await s1Stage();
    const rel = putFile(fx, '.git/TASK-101-i.md', done);
    const out = await settled(at(fx, fx.repo, closed(otherTicket), 'check-report', 'implementer', 'TASK-101', '--report-file', rel));
    expect(out, 'check-report waited for stdin').not.toBe('hung');
    if (out === 'hung') return;
    expect(out.stdout).toBe('report ok\n');
    expect(out.code).toBe(0);
    // Without the file, the same stdin is the report that is read, and it names another ticket (PIP-004/S5).
    const stdinOnly = await at(fx, fx.repo, closed(otherTicket), 'check-report', 'implementer', 'TASK-101');
    expect(stdinOnly.stdout).toContain('- the report is for TASK-103, but this stage is for TASK-101');
    expect(stdinOnly.code).toBe(1);
  }, 120_000);

  it('PIP-004/S26 A path that cannot be read is refused', async () => {
    const fx = await s1Stage();
    mkdirSync(join(fx.repo, '.git/a-folder'));
    const treeBefore = fx.git('status', '--porcelain').stdout;
    const kept = join(fx.repo, '.git/spec/test-runs/TASK-101.json');
    expect(existsSync(kept)).toBe(false);

    const missing = await at(fx, fx.repo, closed(done), 'check-report', 'implementer', 'TASK-101', '--report-file', '.git/missing.md');
    expect(missing.stderr.trimEnd()).toBe('.git/missing.md does not exist');
    expect(missing.stdout).toBe('');
    expect(missing.code).toBe(2);

    const folder = await at(fx, fx.repo, closed(done), 'check-report', 'implementer', 'TASK-101', '--report-file', '.git/a-folder');
    expect(folder.stderr.startsWith('.git/a-folder')).toBe(true);
    expect(folder.stderr).not.toContain('internal error');
    expect(folder.stderr).not.toMatch(/\n\s+at /);
    expect(folder.stdout).toBe('');
    expect(folder.code).toBe(2);

    // No check runs: the working tree and the kept test run are as they were.
    expect(fx.git('status', '--porcelain').stdout).toBe(treeBefore);
    expect(existsSync(kept)).toBe(false);
  }, 120_000);

  it('PIP-004/S26 An empty --report-file value is refused as an option without a value', async () => {
    const fx = await s1Stage();
    const treeBefore = fx.git('status', '--porcelain').stdout;
    const kept = join(fx.repo, '.git/spec/test-runs/TASK-101.json');
    for (const empty of [['--report-file='], ['--report-file', '']]) {
      const label = JSON.stringify(empty);
      // A valid report on a closed stdin: if the empty value were read as no file, this would be "report ok".
      const out = await settled(at(fx, fx.repo, closed(done), 'check-report', 'implementer', 'TASK-101', ...empty));
      expect(out, `${label}: check-report waited for stdin`).not.toBe('hung');
      if (out === 'hung') return;
      expect(out.stderr.startsWith('--report-file needs a value'), `${label}: stderr is "${out.stderr}"`).toBe(true);
      expect(out.stderr, label).not.toContain('does not exist');
      expect(out.stdout, label).toBe('');
      expect(out.code, label).toBe(2);
      // No check runs.
      expect(fx.git('status', '--porcelain').stdout, label).toBe(treeBefore);
      expect(existsSync(kept), label).toBe(false);
    }
  }, 120_000);

  it('PIP-004/S27 Without a file, stdin is read as before', async () => {
    const fx = await s1Stage();
    const ok = await at(fx, fx.repo, closed(done), 'check-report', 'implementer', 'TASK-101');
    expect(ok.stdout).toBe('report ok\n');
    expect(ok.code).toBe(0);
    // A report on stdin that is not valid gives the problems of PIP-003.
    const bad = await at(fx, fx.repo, closed('Finished, nothing to report.\n'), 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    const out = JSON.parse(bad.stdout) as { ok: boolean; problems: string[]; report: unknown };
    expect(out.ok).toBe(false);
    expect(out.problems).toEqual(['the final message has no ```report block; end with exactly one']);
    expect(out.report).toBeNull();
    expect(bad.code).toBe(1);
  }, 120_000);

  it('PIP-004/S28 A check that runs the tests says so on stderr', async () => {
    // The test command takes two seconds, so a notice written before the run reaches the caller long before the exit.
    const fx = await s1Stage(`sleep 2 && ${TEST_COMMAND}`);
    const text = await spawnSpec(fx, done, 'check-report', 'implementer', 'TASK-101');
    expect(text.timedOut, text.stderr).toBe(false);
    expect(text.stderr.split('\n')[0]).toBe(NOTICE);
    expect(text.firstStderrMs, 'no stderr').not.toBeNull();
    expect(text.closedMs - (text.firstStderrMs ?? 0), 'the notice came only when the run was over').toBeGreaterThan(1000);
    expect(text.stdout).toBe('report ok\n');
    expect(text.code).toBe(0);

    const json = await spawnSpec(fx, done, 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    expect(json.timedOut, json.stderr).toBe(false);
    expect(json.stderr.split('\n')[0]).toBe(NOTICE);
    expect(JSON.parse(json.stdout)).toMatchObject({ ok: true, problems: [] });
    expect(json.code).toBe(0);

    // But a blocked report, or a done reviewer or spec-writer report, runs no test and writes no "tests: " line.
    const blocked = report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Stuck\nblockers: [{ text: Needs a name, cites: [TASK-101] }]');
    const fxBlocked = await stage('TASK-101', 'implementer');
    const b = await spawnSpec(fxBlocked, blocked, 'check-report', 'implementer', 'TASK-101');
    expect(b.timedOut, b.stderr).toBe(false);
    expect(b.stdout).toBe('report ok\n');
    expect(b.stderr).not.toMatch(/^tests: /m);

    // TASK-103 reaches its reviewer stage after its implementer stage is recorded (PIP-001).
    const fxReviewer = await stage('TASK-103', 'implementer');
    const implemented = await fxReviewer.spec(report('role: implementer\nticket: TASK-103\nresult: done\nsummary: Nothing to change'), 'ticket', 'advance', 'TASK-103');
    expect(implemented.code, implemented.stderr).toBe(0);
    expect((await fxReviewer.spec('', 'ticket', 'start', 'TASK-103', 'reviewer')).code).toBe(0);
    const r = await spawnSpec(fxReviewer, report('role: reviewer\nticket: TASK-103\nresult: done\nsummary: Matches the scenarios\nverdict: approve'), 'check-report', 'reviewer', 'TASK-103');
    expect(r.timedOut, r.stderr).toBe(false);
    expect(r.stdout).not.toBe('');
    expect(r.stderr).not.toMatch(/^tests: /m);

    const fxWriter = await stage('PROP-201', 'spec-writer');
    const w = await spawnSpec(fxWriter, report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini'), 'check-report', 'spec-writer', 'PROP-201');
    expect(w.timedOut, w.stderr).toBe(false);
    expect(w.stdout).not.toBe('');
    expect(w.stderr).not.toMatch(/^tests: /m);
  }, 120_000);
});

describe('PIP-004 check-report through the plugin launcher', () => {
  it('PIP-004/S28 A check that runs the tests says so on stderr, through the plugin launcher', async () => {
    // The launcher hands the command to the project's pinned CLI; the notice must still reach the caller before the two-second run ends.
    const fx = await s1Stage(`sleep 2 && ${TEST_COMMAND}`);
    const out = await spawnPlugin(fx, done, 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    expect(out.timedOut, out.stderr).toBe(false);
    expect(out.stderr.split('\n')[0]).toBe(NOTICE);
    expect(out.firstStderrMs, 'no stderr').not.toBeNull();
    expect(out.closedMs - (out.firstStderrMs ?? 0), 'the notice came only when the run was over').toBeGreaterThan(1000);
    // stdout stays one clean ReportCheck.
    expect(JSON.parse(out.stdout)).toMatchObject({ ok: true, problems: [], report: { role: 'implementer', ticket: 'TASK-101' } });
    expect(out.code).toBe(0);
  }, 120_000);
});

describe('CLI-001 check-report and stdin', () => {
  it('CLI-001/S16 A report-file check does not read stdin', async () => {
    const fx = await stage('TASK-101', 'implementer');
    const dir = mkdtempSync(join(tmpdir(), 'spec-check-report-file-'));
    dirs.push(dir);
    const file = join(dir, 'report.md');
    writeFileSync(file, refused);

    // stdin stays open: the command returns and checks the file.
    const fromFile = await spawnSpec(fx, null, 'check-report', 'implementer', 'TASK-101', '--report-file', file);
    expect(fromFile.timedOut, fromFile.stderr).toBe(false);
    expect(fromFile.stdout).toContain('- only the reviewer and the spec review set verdict and findings');
    expect(fromFile.code).toBe(1);

    // Without --report-file, the same command reads the report from stdin.
    const fromStdin = await spawnSpec(fx, refused, 'check-report', 'implementer', 'TASK-101');
    expect(fromStdin.timedOut, fromStdin.stderr).toBe(false);
    expect(fromStdin.stdout).toContain('- only the reviewer and the spec review set verdict and findings');
    expect(fromStdin.code).toBe(1);
    const empty = await spawnSpec(fx, '', 'check-report', 'implementer', 'TASK-101');
    expect(empty.stdout).toContain('the final message has no ```report block');
  }, 120_000);
});
