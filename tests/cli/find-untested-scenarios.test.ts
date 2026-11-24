// ADP-003: spec gaps lists the scenarios no test is named after, and says why the tests were not checked.
// The test command here stands in for the project's: it has the same {filter} and {report} placeholders
// and copies a report file to {report}, so each test states the results the run gives.
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FIXTURE, LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** Copies the report file to {report}. */
const COPY_REPORT = 'cat test-report.json > "{report}"';
/** Copies the report file, and first logs each run: the filter it was given and the directory it ran in. */
const LOGGED = 'echo "filter=[{filter}] cwd=$(pwd -P)" >> runs.log && cat test-report.json > "{report}"';

/** One test per scenario of chat-mini, each named after its scenario. */
const EVERY_SCENARIO = [
  'CNV-001/S1 Send to active provider',
  'CNV-001/S2 Active provider disabled',
  'CNV-002/S1 Partial reply kept',
  'CNV-002/S2 Stop reason recorded',
  'CNV-003/S1 Text exported',
  'CNV-003/S2 No key material in export',
  'PRV-001/S1 Streams tokens',
  'PRV-001/S2 Provider rate-limits',
  'PRV-001/S3 The key never reaches the log',
  'PRV-002/S1 Fallback enabled',
  'PRV-002/S2 Fallback disabled',
  'PRV-002/S3 Fallback provider also rate-limits',
  'PRV-002/S4 Fallback provider not enabled',
  'PRV-003/S1 Usage recorded at the end of a reply',
  'SET-001/S1 Enable',
  'SET-001/S2 Disable stops new messages to it',
  'SET-001/S3 Enable without a key',
  'SET-002/S1 Add a key',
  'SET-002/S2 Delete a key',
];

/** The vitest JSON report the test command copies: one passed test per name. */
const vitestReport = (names: readonly string[]) => JSON.stringify({ testResults: [{ assertionResults: names.map((title) => ({ title, status: 'passed' })) }] });

function replaceIn(dir: string, file: string, from: string, to: string) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`${file} does not hold ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}

/** CNV-002 is deprecated: still served, so its scenarios still count. */
const deprecateCnv002 = (dir: string) => { replaceIn(dir, 'spec/modules/conversation/features/CNV-002-stop-a-reply.md', 'status: active\n', 'status: deprecated\n'); };

/** ALP-001 emits alpha.WidgetMade, so the lint base has no unused contract. */
const emitWidgetMade = (dir: string) => { replaceIn(dir, 'spec/modules/alpha/features/ALP-001-make-a-widget.md', 'writes: [alpha.Widget]\n', 'writes: [alpha.Widget]\nemits: [alpha.WidgetMade]\n'); };

/** A throwaway repo of `fixture`, with the test command set and the report the command copies. */
function repo(fixture: string, testCommand: string, tests: readonly string[] = [], edit: (dir: string) => void = () => {}): Fx {
  const fx = gitFixture('spec-find-untested', {
    fixture,
    setup: (dir) => {
      const cfgPath = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(cfgPath, `${JSON.stringify({ ...cfg, testCommand }, null, 2)}\n`);
      writeFileSync(join(dir, 'test-report.json'), vitestReport(tests));
      edit(dir);
    },
  });
  made.push(fx);
  return fx;
}

const gaps = (fx: Fx, ...flags: string[]) => fx.spec('', 'gaps', ...flags);

interface GapJson {
  scenariosWithoutTests: string[] | null;
  testsWithoutScenario: string[] | null;
}
const gapJson = (stdout: string) => JSON.parse(stdout) as GapJson;

/** The lines after the line that is exactly `header`. */
function linesAfter(stdout: string, header: string): string[] {
  const lines = stdout.split('\n');
  const at = lines.indexOf(header);
  expect(at).toBeGreaterThanOrEqual(0);
  return lines.slice(at + 1);
}

/** The last line of the output, without its newline. */
const lastLine = (stdout: string) => stdout.trimEnd().split('\n').at(-1);

describe('spec gaps and the tests', () => {
  it('ADP-003/S1 The whole suite runs', async () => {
    const fx = repo(FIXTURE, LOGGED, EVERY_SCENARIO);
    expect((await gaps(fx)).code).toBe(0);
    expect(readFileSync(join(fx.repo, 'runs.log'), 'utf8')).toBe(`filter=[] cwd=${realpathSync(fx.repo)}\n`);
  });

  it('ADP-003/S2 A scenario no test is named after', async () => {
    const fx = repo(FIXTURE, COPY_REPORT, EVERY_SCENARIO.filter((t) => !t.startsWith('PRV-002/S3 ')));
    const out = await gaps(fx);
    expect(linesAfter(out.stdout, '## Scenarios without a test (1)')[0]).toBe('- PRV-002/S3');
    expect(gapJson((await gaps(fx, '--format', 'json')).stdout).scenariosWithoutTests).toEqual(['PRV-002/S3']);
  });

  it('ADP-003/S3 Tests skipped', async () => {
    const fx = repo(FIXTURE, LOGGED, EVERY_SCENARIO);
    const text = await gaps(fx, '--no-tests');
    expect(linesAfter(text.stdout, '## Scenarios without a test')[0]).toBe('Not checked (no test run).');
    expect(text.stdout).not.toContain('## Tests for no scenario');
    const g = gapJson((await gaps(fx, '--no-tests', '--format', 'json')).stdout);
    expect(g.scenariosWithoutTests).toBeNull();
    expect(g.testsWithoutScenario).toBeNull();
    expect(existsSync(join(fx.repo, 'runs.log'))).toBe(false);
  });

  it('ADP-003/S4 The tests could not run', async () => {
    const fx = repo(FIXTURE, 'false');
    const out = await gaps(fx);
    expect(out.code).toBe(0);
    const after = linesAfter(out.stdout, '## Scenarios without a test');
    expect(after[0]).toBe('Not checked (no test run).');
    expect(after[1]).toMatch(/^spec gaps: the test command wrote no report to /);
  });

  it("ADP-003/S5 A deprecated feature's scenarios still count", async () => {
    const fx = repo(FIXTURE, COPY_REPORT, EVERY_SCENARIO.filter((t) => !t.startsWith('CNV-002/S1 ')), deprecateCnv002);
    expect(gapJson((await gaps(fx, '--format', 'json')).stdout).scenariosWithoutTests).toContain('CNV-002/S1');
  });

  it('ADP-003/S6 A test for no scenario', async () => {
    const fx = repo(FIXTURE, COPY_REPORT, [...EVERY_SCENARIO, 'CNV-001/S9 Ghost scenario']);
    expect(linesAfter((await gaps(fx)).stdout, '## Tests for no scenario (1)')[0]).toBe('- CNV-001/S9 Ghost scenario');
    expect(gapJson((await gaps(fx, '--format', 'json')).stdout).testsWithoutScenario).toEqual(['CNV-001/S9 Ghost scenario']);
  });

  it('ADP-003/S7 No test for an unknown scenario', async () => {
    const fx = repo(FIXTURE, COPY_REPORT, [...EVERY_SCENARIO, 'a helper test that names no scenario']);
    expect((await gaps(fx)).stdout).not.toContain('## Tests for no scenario');
    expect(gapJson((await gaps(fx, '--format', 'json')).stdout).testsWithoutScenario).toEqual([]);
  });

  it('ADP-003/S9 The closing line when the tests were not checked', async () => {
    const fx = repo(LINT_BASE, LOGGED, [], emitWidgetMade);
    const out = await gaps(fx, '--no-tests');
    expect(lastLine(out.stdout)).toBe('No gaps: every unit is confirmed, every question answered, the tests were not checked.');
    expect(out.code).toBe(0);
  });

  it('ADP-003/S10 The closing line when the tests could not run', async () => {
    const fx = repo(LINT_BASE, 'false', [], emitWidgetMade);
    const out = await gaps(fx);
    expect(lastLine(out.stdout)).toBe('No gaps: every unit is confirmed, every question answered, the tests were not checked.');
    expect(out.code).toBe(0);
  });
});
