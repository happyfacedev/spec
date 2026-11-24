// PIP-011: a test belongs to a scenario through its name alone. Checked through the CLI, as a
// tester's report is: `spec check-report tester BUG-301` on a throwaway copy of chat-mini. BUG-301
// violates PRV-002/S3, so every PRV-002 scenario is in scope, and check-report names each one that no
// test covers. The project's test command copies a report this file writes, in the format the runner
// writes: vitest's JSON, or Dart's JSON event stream, where a grouped test is reported group first.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitFixture, loadFixture, report, validTesterMutations, tempDir } from '../helpers';

const scratch = tempDir('spec-test-names-');
const reportFile = join(scratch, 'report');
const fx = gitFixture('spec-test-names', {
  setup: (dir) => {
    const config = join(dir, 'spec/config.json');
    const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
    cfg.testCommand = `cp '${reportFile}' "{report}"`;
    writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
  },
});
afterAll(() => {
  fx.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

const tester = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Tests for PRV-002/S3\n' + validTesterMutations('PRV-002/S3'));
const fixture = loadFixture();
const prv002 = fixture.spec.features.filter((f) => f.id === 'PRV-002').flatMap((f) => f.scenarios.map((s) => s.id));

/** The problems check-report gives the tester when the runner reports exactly these results. */
async function problemsFor(runnerReport: string): Promise<string[]> {
  writeFileSync(reportFile, runnerReport);
  const out = await fx.spec(tester, 'check-report', 'tester', 'BUG-301', '--format', 'json');
  return (JSON.parse(out.stdout) as { problems: string[] }).problems;
}

/** vitest's JSON report: one failing test per title. */
const vitestReport = (...titles: string[]) => JSON.stringify({ testResults: [{ assertionResults: titles.map((title) => ({ title, status: 'failed' })) }] });

/** Dart's JSON event stream: one failing test per name, as the runner reports it (the group's name first). */
const dartReport = (...names: string[]) =>
  [
    JSON.stringify({ protocolVersion: '0.1.1', runnerVersion: '1.31.1', type: 'start', time: 0 }),
    ...names.flatMap((name, i) => [
      JSON.stringify({ test: { id: i + 1, name }, type: 'testStart' }),
      JSON.stringify({ testID: i + 1, result: 'failure', skipped: false, hidden: false, type: 'testDone' }),
    ]),
    JSON.stringify({ success: false, type: 'done' }),
  ].join('\n');

/** check-report's problem for a scenario that no test covers. */
const uncovered = (problems: string[], id: string) => problems.some((p) => p.startsWith(`no test covers ${id};`));

describe('PIP-011: a test name matches its scenario', () => {
  beforeAll(async () => {
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
  }, 60_000);

  it('PIP-011/S1 The scenario ID, then a space', async () => {
    // Each name on its own: each one covers PRV-002/S1 by itself.
    expect(uncovered(await problemsFor(vitestReport('PRV-002/S1 Fallback enabled')), 'PRV-002/S1')).toBe(false);
    expect(uncovered(await problemsFor(vitestReport('PRV-002/S1')), 'PRV-002/S1')).toBe(false);
  }, 60_000);

  it('PIP-011/S2 A longer number is another scenario', async () => {
    expect(uncovered(await problemsFor(vitestReport('PRV-002/S10 Later')), 'PRV-002/S1')).toBe(true);
  }, 60_000);

  it('PIP-011/S3 The ID must come first', async () => {
    expect(prv002).toContain('PRV-002/S1');
    const problems = await problemsFor(vitestReport('fallback PRV-002/S1'));
    // It covers no scenario: every PRV-002 scenario is still named as uncovered.
    for (const id of prv002) expect(uncovered(problems, id)).toBe(true);
  }, 60_000);

  it('PIP-011/S4 A feature group around a scenario test', async () => {
    expect(uncovered(await problemsFor(dartReport('PRV-002 S1 Fallback enabled')), 'PRV-002/S1')).toBe(false);
    expect(uncovered(await problemsFor(dartReport('PRV-002 S11 Other')), 'PRV-002/S1')).toBe(true);
  }, 60_000);

  it('PIP-011/S5 Identifier-style names', async () => {
    expect(uncovered(await problemsFor(vitestReport('test_PRV_002_S1_fallback')), 'PRV-002/S1')).toBe(false);
    expect(uncovered(await problemsFor(vitestReport('TestPRV_002_S1Fallback')), 'PRV-002/S1')).toBe(false);
    expect(uncovered(await problemsFor(vitestReport('test_PRV_002_S10_x')), 'PRV-002/S1')).toBe(true);
  }, 60_000);

  it('PIP-011/S6 The scenario a test names, for removed scenarios', async () => {
    expect(fixture.index.byId.has('PRV-001/S9')).toBe(false);
    const removed = ['PRV-001/S9 Removed long ago', 'PRV-001 S9 Removed', 'PRV-001 S9', 'test_PRV_001_S9_removed'];
    const problems = await problemsFor(vitestReport(...removed, 'fallback keeps the reply going'));
    // Each removed name gives its problem, and the name that starts with no scenario ID gives none.
    expect(problems.filter((p) => p.startsWith('test "'))).toEqual(removed.map((n) => `test "${n}" names PRV-001/S9, which is not in the spec; delete or rename it`));
  }, 60_000);

  it('PIP-011/S8 A test named for a rule claims nothing', async () => {
    const named = ['PRV-002/R1 Fallback rule', 'PRV-002 R1 Fallback rule', 'test_PRV_002_R1_fallback'];
    const problems = await problemsFor(vitestReport(...named));
    // None covers PRV-002/S1, or any other PRV-002 scenario.
    for (const id of prv002) expect(uncovered(problems, id)).toBe(true);
    // None is read as naming a scenario (S6's problem), and none is flagged for being named for a rule.
    expect(problems.filter((p) => p.startsWith('test "'))).toEqual([]);
    for (const name of named) expect(problems.filter((p) => p.includes(name))).toEqual([]);
  }, 60_000);

  it('PIP-011/S7 A feature group with only the scenario number', async () => {
    expect(uncovered(await problemsFor(dartReport('PRV-002 S1')), 'PRV-002/S1')).toBe(false);
    expect(uncovered(await problemsFor(dartReport('PRV-002 S10')), 'PRV-002/S1')).toBe(true);
    expect(uncovered(await problemsFor(dartReport('PRV-002 S1Fallback')), 'PRV-002/S1')).toBe(true);
  }, 60_000);
});
