// PIP-006/R12: an implementer's failing run names its failed tests, then the files and suites the
// report marks failed with a message of their own; with none to name, it keeps the end of the
// test output. The project's test command copies a report this file writes and prints an output
// this file writes (as in failure-kind.test.ts), so each test sets what the runner said.
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitFixture, report, tempDir } from '../helpers';

const scratch = tempDir('spec-failed-files-');
const reportFile = join(scratch, 'report');
const outFile = join(scratch, 'output');
const fx = gitFixture('spec-failed-files', {
  setup: (dir) => {
    const config = join(dir, 'spec/config.json');
    const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
    cfg.testCommand = `cp '${reportFile}' "{report}"; cat '${outFile}'; exit 1`;
    writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
  },
});
afterAll(() => {
  fx.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

const implementer = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection\nchanged: [PRV-001/S1]');

interface FileResult {
  name: string;
  status: 'failed' | 'passed';
  message: string;
  assertionResults: { title: string; status: string; failureMessages?: string[] }[];
}
const failedTest = { title: 'PRV-001/S1 Streams tokens', status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] };
const run = (files: FileResult[], output = '') => {
  writeFileSync(reportFile, JSON.stringify({ testResults: files }));
  writeFileSync(outFile, output);
};
const problemsFor = async () => {
  const out = await fx.spec(implementer, 'check-report', 'implementer', 'TASK-101', '--format', 'json');
  return (JSON.parse(out.stdout) as { problems: string[] }).problems;
};
const root = () => fx.repo;
const loadFail = (): FileResult => ({
  name: join(root(), 'tests/core/app.test.ts'),
  status: 'failed',
  message: `Cannot find module './nope' imported from ${join(root(), 'tests/core/app.test.ts')}`,
  assertionResults: [],
});
const hookFail = (): FileResult => ({
  name: join(root(), 'tests/core/db.test.ts'),
  status: 'failed',
  message: 'db is down\n    at beforeAll (tests/core/db.test.ts:3:9)',
  assertionResults: [{ title: 'PRV-001/S2 Saves a draft', status: 'skipped' }],
});
const loadLine = () => `tests/core/app.test.ts: Cannot find module './nope' imported from ${join(root(), 'tests/core/app.test.ts')}`;
const hookLine = 'tests/core/db.test.ts: db is down';

beforeAll(async () => {
  expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
  writeFileSync(join(fx.repo, 'src/providers/select.ts'), 'export const select = 1;\n');
}, 120_000);

describe('PIP-006: a failing run names what broke', () => {
  it('PIP-006/S8 The implementer is done when every test passes', async () => {
    run([{ name: join(root(), 'tests/core/a.test.ts'), status: 'failed', message: '', assertionResults: [failedTest] }]);
    expect(await problemsFor()).toEqual(['tests fail (exit 1): PRV-001/S1 Streams tokens']);

    // With more failures it names the first 5, joined by "; ".
    const many = Array.from({ length: 7 }, (_, i) => ({ title: `PRV-001/S${i + 1} Fails ${i + 1}`, status: 'failed' }));
    run([{ name: join(root(), 'tests/core/a.test.ts'), status: 'failed', message: '', assertionResults: many }]);
    expect(await problemsFor()).toEqual([`tests fail (exit 1): ${many.slice(0, 5).map((t) => t.title).join('; ')}`]);
  }, 60_000);

  it('PIP-006/S35 A test file that fails to load or a hook that throws is named', async () => {
    run([loadFail(), hookFail()]);
    expect(await problemsFor()).toEqual([`tests fail (exit 1): ${loadLine()}; ${hookLine}`]);

    // A failed file with an empty message is not named; failed tests come first.
    const testOnly: FileResult = { name: join(root(), 'tests/core/a.test.ts'), status: 'failed', message: '', assertionResults: [failedTest] };
    run([testOnly, loadFail(), hookFail()]);
    expect(await problemsFor()).toEqual([`tests fail (exit 1): PRV-001/S1 Streams tokens; ${loadLine()}; ${hookLine}`]);

    // The first 5 names in all are kept.
    const five = Array.from({ length: 4 }, (_, i): FileResult => ({ name: join(root(), `tests/core/f${i}.test.ts`), status: 'failed', message: `boom ${i}`, assertionResults: [] }));
    run([testOnly, ...five, hookFail()]);
    expect(await problemsFor()).toEqual([`tests fail (exit 1): PRV-001/S1 Streams tokens; ${five.map((f, i) => `tests/core/f${i}.test.ts: boom ${i}`).join('; ')}`]);
  }, 60_000);

  it('PIP-006/S35 spec test keeps the failed-file diagnostics out of its JSON', async () => {
    // R12: the diagnostics live only in the problem text; `spec test` prints what it printed before.
    run([loadFail(), hookFail()], 'RUN v3\nError: suite failed to load\n');
    const out = await fx.spec('', 'test', '--format', 'json');
    expect(out.stdout.trim()).not.toBe('');
    const json = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(json).not.toHaveProperty('failedFiles');
    expect(json).not.toHaveProperty('outputTail');
    expect(out.stdout).not.toContain('failedFiles');
    expect(out.stdout).not.toContain('outputTail');
  }, 60_000);

  it('PIP-006/S36 A failing run that names nothing keeps the end of the test output', async () => {
    const passing: FileResult = { name: join(root(), 'tests/core/a.test.ts'), status: 'passed', message: '', assertionResults: [{ title: 'PRV-001/S1 Streams tokens', status: 'passed' }] };
    const lines = ['RUN v3', '', 'Error: coverage threshold for lines (80%) not met', '  at check (cov.js:3)', 'Tests 12 passed', '   ', 'Exit 1', 'Done'];
    run([passing], `${lines.join('\n')}\n`);
    expect(await problemsFor()).toEqual([
      'tests fail (exit 1): the test report names no failed test or file; the test output ends: Error: coverage threshold for lines (80%) not met | at check (cov.js:3) | Tests 12 passed | Exit 1 | Done',
    ]);

    // With an empty output, the problem says the command printed nothing.
    run([passing], '');
    expect(await problemsFor()).toEqual(['tests fail (exit 1): the test report names no failed test or file, and the test command printed nothing']);

    // spec ticket advance blocks the ticket on this refusal with the same problem text in its question.
    run([passing], `${lines.join('\n')}\n`);
    const adv = await fx.spec(implementer, 'ticket', 'advance', 'TASK-101', '--format', 'json');
    expect(adv.code).not.toBe(0);
    const text = JSON.stringify(fx.ticket('TASK-101')?.questions ?? []);
    expect(text).toContain('the test output ends: Error: coverage threshold for lines (80%) not met | at check (cov.js:3) | Tests 12 passed | Exit 1 | Done');
  }, 60_000);
});
