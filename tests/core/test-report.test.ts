import { describe, expect, it } from 'vitest';
import { matchesAny, matchesGlob } from '../../src/core/glob';
import { coversScenario, parseTestReport } from '../../src/core/test-report';

describe('test reports from any stack', () => {
  it('reads vitest/jest JSON', () => {
    const json = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-002/S1 Fallback enabled', status: 'passed' }, { title: 'PRV-002/S3 x', status: 'failed' }, { title: 'y', status: 'pending' }] }] });
    expect(parseTestReport(json)).toMatchObject({
      tests: [
        { name: 'PRV-002/S1 Fallback enabled', status: 'passed' },
        { name: 'PRV-002/S3 x', status: 'failed' },
        { name: 'y', status: 'skipped' },
      ],
    });
  });

  it('reads the Dart/Flutter JSON event stream (dart test --reporter json, flutter test --machine)', () => {
    const ev = (o: object) => JSON.stringify(o);
    const stream = [
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
    expect(parseTestReport(stream)).toMatchObject({
      tests: [
        { name: 'PRV-002 S1 Fallback enabled', status: 'passed' },
        { name: 'PRV-002/S3 Fallback provider also rate-limits', status: 'failed' },
      ],
    });
    // A test file that does not compile: the runner's own loading test fails, and nothing else runs.
    const broken = [ev({ protocolVersion: '0.1.1', type: 'start' }), ev({ test: { id: 1, name: 'loading test/x_test.dart' }, type: 'testStart' }), ev({ testID: 1, result: 'error', hidden: true, type: 'testDone' })].join('\n');
    expect(parseTestReport(broken)).toMatchObject({ tests: [{ name: 'loading test/x_test.dart', status: 'failed' }] });
    // flutter test runs pub get first and prints its progress to stdout, ahead of the events
    // (seen with Flutter 3.38 in a fresh checkout).
    const afterPub = ['Resolving dependencies...', 'Downloading packages...', '  clock 1.1.2 (1.1.3 available)', 'Got dependencies!', stream].join('\n');
    expect(parseTestReport(afterPub)).toEqual(parseTestReport(stream));
    // A group named after the feature, around a test named after the scenario.
    expect(coversScenario('PRV-002 S1 Fallback enabled', 'PRV-002/S1')).toBe(true);
    expect(coversScenario('PRV-002 S11 Other', 'PRV-002/S1')).toBe(false);
  });

  it('reads JUnit XML (pytest, Go, Gradle, .NET)', () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="s">
      <testcase classname="t" name="test_PRV_002_S1_fallback_enabled" time="0.1"/>
      <testcase classname="t" name="PRV-002/S3 Fallback &amp; rate limits"><failure message="x">boom</failure></testcase>
      <testcase classname="t" name="TestSET_001_S2Disable"><skipped/></testcase>
    </testsuite></testsuites>`;
    expect(parseTestReport(xml)).toMatchObject({
      tests: [
        { name: 'test_PRV_002_S1_fallback_enabled', status: 'passed' },
        { name: 'PRV-002/S3 Fallback & rate limits', status: 'failed' },
        { name: 'TestSET_001_S2Disable', status: 'skipped' },
      ],
    });
  });

  it('rejects anything else with a reason', () => {
    expect(parseTestReport('not a report')).toHaveProperty('error');
    expect(parseTestReport('{"ok":true}')).toHaveProperty('error');
  });

  it.each([
    ['PRV-002/S1 Fallback enabled', 'PRV-002/S1', true],
    ['PRV-002/S1', 'PRV-002/S1', true],
    ['PRV-002/S10 Later', 'PRV-002/S1', false],
    ['test_PRV_002_S1_fallback', 'PRV-002/S1', true],
    ['TestPRV_002_S1Fallback', 'PRV-002/S1', true],
    ['test_PRV_002_S10_x', 'PRV-002/S1', false],
    ['fallback PRV-002/S1', 'PRV-002/S1', false],
  ])('coversScenario case %#', (name, id, want) => {
    expect(coversScenario(name, id)).toBe(want);
  });
});

describe('path globs', () => {
  it.each([
    ['src/a.ts', 'src/**', true],
    ['src/x/y/a.ts', 'src/**', true],
    ['srcx/a.ts', 'src/**', false],
    ['tests/SET-002.test.ts', 'tests/SET-002.test.ts', true],
    ['a/b/c.md', '**/*.md', true],
    ['c.md', '**/*.md', true],
    ['a/b.ts', '*.ts', false],
  ])('%s ~ %s: %s', (path, glob, want) => {
    expect(matchesGlob(path, glob)).toBe(want);
  });
  it('matchesAny', () => {
    expect(matchesAny('tests/x.test.ts', ['src/**', 'tests/**'])).toBe(true);
  });
});
