// PIP-010: reading the test report of any stack, scenario by scenario (parseTestReport is what
// pipeline.RunTests reads the report with).
import { rmSync, writeFileSync } from 'node:fs';
import { tempDir } from '../helpers';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type TestRun, parseTestReport } from '../../src/core/test-report';
import { runTestCommand } from '../../src/io/test-command';

const ev = (o: object) => JSON.stringify(o);
const STREAM = [
  ev({ protocolVersion: '0.1.1', runnerVersion: '1.31.1', type: 'start', time: 0 }),
  ev({ test: { id: 1, name: 'loading test/prv_test.dart' }, type: 'testStart' }),
  ev({ testID: 1, result: 'success', skipped: false, hidden: true, type: 'testDone' }),
  ev({ test: { id: 3, name: 'PRV-002 S1 Fallback enabled' }, type: 'testStart' }),
  ev({ testID: 3, result: 'success', skipped: false, hidden: false, type: 'testDone' }),
  ev({ test: { id: 4, name: 'PRV-002/S3 Fallback provider also rate-limits' }, type: 'testStart' }),
  ev({ testID: 4, error: 'Expected: <4>', type: 'error' }),
  ev({ testID: 4, result: 'failure', skipped: false, hidden: false, type: 'testDone' }),
  ev({ success: false, type: 'done' }),
].join('\n');

/** Name and status of each test, whatever else the report says about it. */
const basics = (text: string) => {
  const r = parseTestReport(text);
  if ('error' in r) throw new Error(r.error);
  return r.tests.map((t) => ({ name: t.name, status: t.status }));
};
const testsOf = (text: string): Record<string, unknown>[] => {
  const r = parseTestReport(text);
  if ('error' in r) throw new Error(r.error);
  return r.tests as unknown as Record<string, unknown>[];
};
const vitest = (...results: object[]) => JSON.stringify({ testResults: [{ assertionResults: results }] });

describe('PIP-010: read the test report of any stack', () => {
  it('PIP-010/S1 vitest or jest JSON', () => {
    const json = vitest({ title: 'PRV-002/S1 Fallback enabled', status: 'passed' }, { title: 'PRV-002/S3 x', status: 'failed' }, { title: 'y', status: 'pending' });
    expect(basics(json)).toEqual([
      { name: 'PRV-002/S1 Fallback enabled', status: 'passed' },
      { name: 'PRV-002/S3 x', status: 'failed' },
      { name: 'y', status: 'skipped' },
    ]);
  });

  it('PIP-010/S2 The Dart and Flutter event stream', () => {
    expect(basics(STREAM)).toEqual([
      { name: 'PRV-002 S1 Fallback enabled', status: 'passed' },
      { name: 'PRV-002/S3 Fallback provider also rate-limits', status: 'failed' },
    ]);
  });

  it('PIP-010/S3 A Dart test file that does not compile', () => {
    const broken = [ev({ protocolVersion: '0.1.1', type: 'start' }), ev({ test: { id: 1, name: 'loading test/x_test.dart' }, type: 'testStart' }), ev({ testID: 1, result: 'error', hidden: true, type: 'testDone' }), ev({ success: false, type: 'done' })].join('\n');
    expect(basics(broken)).toEqual([{ name: 'loading test/x_test.dart', status: 'failed' }]);
  });

  it('PIP-010/S4 Package output before the events', () => {
    const afterPub = ['Resolving dependencies...', 'Downloading packages...', '  clock 1.1.2 (1.1.3 available)', 'Got dependencies!', STREAM].join('\n');
    expect(basics(afterPub)).toEqual(basics(STREAM));
  });

  it('PIP-010/S5 A skipped Dart test', () => {
    const stream = [
      ev({ protocolVersion: '0.1.1', type: 'start' }),
      ev({ test: { id: 3, name: 'PRV-002 S1 Fallback enabled' }, type: 'testStart' }),
      ev({ testID: 3, result: 'success', skipped: true, hidden: false, type: 'testDone' }),
      ev({ success: true, type: 'done' }),
    ].join('\n');
    expect(basics(stream)).toEqual([{ name: 'PRV-002 S1 Fallback enabled', status: 'skipped' }]);
  });

  it('PIP-010/S6 JUnit XML', () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="s">
      <testcase classname="t" name="test_PRV_002_S1_fallback_enabled" time="0.1"/>
      <testcase classname="t" name="PRV-002/S3 Fallback &amp; rate limits"><failure message="x">boom</failure></testcase>
      <testcase classname="t" name="TestSET_001_S2Disable"><skipped/></testcase>
    </testsuite></testsuites>`;
    expect(basics(xml)).toEqual([
      { name: 'test_PRV_002_S1_fallback_enabled', status: 'passed' },
      { name: 'PRV-002/S3 Fallback & rate limits', status: 'failed' },
      { name: 'TestSET_001_S2Disable', status: 'skipped' },
    ]);
  });

  it('PIP-010/S7 Text that is no report', () => {
    expect(parseTestReport('not a report')).toEqual({ error: 'the test report is neither JSON nor JUnit XML' });
  });

  it('PIP-010/S8 JSON in no known shape', () => {
    expect(parseTestReport('{"ok":true}')).toEqual({ error: 'the JSON test report is not in the vitest/jest or Dart format' });
  });

  it('PIP-010/S9 vitest or jest tell an assertion from an error', () => {
    const json = vitest(
      { title: 'PRV-001/S4 Streams from gemini', status: 'failed', failureDetails: [{ name: 'TypeError' }], failureMessages: ['TypeError: gemini.stream is not a function\n    at ...'] },
      { title: 'PRV-001/S5 Streams a reply', status: 'failed', failureDetails: [{ name: 'AssertionError' }] },
    );
    const [first, second] = testsOf(json);
    expect(first).toMatchObject({ failureKind: 'error', firstErrorLine: 'TypeError: gemini.stream is not a function' });
    expect(second).toMatchObject({ failureKind: 'assertion' });
  });

  it('PIP-010/S10 JUnit separates error from failure', () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="s">
      <testcase classname="t" name="PRV-001/S4 Streams from gemini"><error message="boom">trace</error></testcase>
      <testcase classname="t" name="PRV-001/S5 Streams a reply"><failure>nope</failure></testcase>
    </testsuite></testsuites>`;
    const [first, second] = testsOf(xml);
    expect(first).toMatchObject({ failureKind: 'error', firstErrorLine: 'boom' });
    expect(second).toMatchObject({ failureKind: 'assertion' });
  });

  it('PIP-010/S11 A report that does not tell them apart', () => {
    const [t] = testsOf(vitest({ title: 'PRV-001/S4 Streams from gemini', status: 'failed' }));
    expect(t).toMatchObject({ name: 'PRV-001/S4 Streams from gemini', status: 'failed' });
    expect(t).not.toHaveProperty('failureKind');
    expect(t).not.toHaveProperty('firstErrorLine');
  });
});

// S12 to S14 run the tests through the test command (pipeline.RunTests), whose report file holds the text.
const scratch = tempDir('spec-junit-');
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});
let written = 0;
/** The pipeline.TestRun of a test command that writes `text` as its report and exits 0. */
const runWith = (text: string): TestRun => {
  const file = join(scratch, `report-${written++}`);
  writeFileSync(file, text);
  return runTestCommand(scratch, `cp '${file}' "{report}"`);
};
const NOT_JUNIT = 'the XML test report is not a complete JUnit report';

describe('PIP-010/R3: only a complete JUnit report is XML results', () => {
  it('PIP-010/S12 XML that is not a JUnit report', () => {
    const run = runWith('<html><body><h1>502 Bad Gateway</h1></body></html>');
    expect(run.error).toBe(NOT_JUNIT);
    expect(run.tests).toEqual([]);
  });

  it('PIP-010/S13 A JUnit report cut off before its end', () => {
    const run = runWith('<?xml version="1.0"?><testsuites><testsuite name="s">\n  <testcase classname="t" name="PRV-002/S1 Fallback enabled" time="0.1"/>\n');
    expect(run.error).toBe(NOT_JUNIT);
    expect(run.tests).toEqual([]);
  });

  it('PIP-010/S13 A JUnit report cut off before its end: a truncated second root after a self-closing first', () => {
    const run = runWith('<testsuite/><testsuite><testcase name="incomplete"/>');
    expect(run.error).toBe(NOT_JUNIT);
    expect(run.tests).toEqual([]);
  });

  it('PIP-010/S13 A JUnit report cut off before its end: two complete roots back to back are not one report', () => {
    const run = runWith('<testsuite><testcase name="first"/></testsuite><testsuite><testcase name="second"/></testsuite>');
    expect(run.error).toBe(NOT_JUNIT);
    expect(run.tests).toEqual([]);
  });

  it('PIP-010/S6 JUnit XML: a legal XML comment after the closed root is read', () => {
    const run = runWith('<testsuite><testcase name="works"/></testsuite><!-- end -->');
    expect(run.error).toBeNull();
    expect(run.tests).toEqual([{ name: 'works', status: 'passed' }]);
  });

  it('PIP-010/S6 JUnit XML: a processing instruction after the closed root is read', () => {
    const run = runWith('<?xml version="1.0"?><testsuites><testsuite><testcase name="works"/></testsuite></testsuites>\n<?report end?>\n');
    expect(run.error).toBeNull();
    expect(run.tests).toEqual([{ name: 'works', status: 'passed' }]);
  });

  it('PIP-010/S14 A JUnit report with no test cases', () => {
    const run = runWith('<?xml version="1.0"?><testsuites><testsuite name="s" tests="0"></testsuite></testsuites>');
    expect(run.tests).toEqual([]);
    expect(run.error).toBeNull();
  });

  it("PIP-010/S15 A quoted ']' in the DOCTYPE", () => {
    const run = runWith('<?xml version="1.0"?>\n<!DOCTYPE testsuites [<!ENTITY example "a]b">]>\n<testsuites><testsuite name="s">\n  <testcase classname="t" name="PRV-002/S1 Fallback enabled"/>\n</testsuite></testsuites>\n');
    expect(run.error).toBeNull();
    expect(run.tests).toEqual([{ name: 'PRV-002/S1 Fallback enabled', status: 'passed' }]);
  });
});
