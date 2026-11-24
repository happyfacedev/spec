// PROP-048: a spec-writer lists, under `documents:`, the scenarios it added that the current build
// already satisfies; the tester's stage then needs their tests to pass (PIP-006/R10) and no failing
// test for them (R3). PROP-201 added PRV-001/S4 and SET-001/S4 (reference/PROP-201.spec-writer.patch).
// Each fixture's test command copies a report this file writes (as in failure-kind.test.ts).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSpec } from '../../src/core/parse/spec';
import { loadDir } from '../../src/io/fs';
import { gitFixture, report, validSpecWriterChecklist, validTesterMutations, tempDir } from '../helpers';

const S4 = 'PRV-001/S4 Streams from gemini';
const SET4 = 'SET-001/S4 Enable gemini';
const NOT_ADDED = 'which this branch did not add; list only new scenarios whose behaviour the current build already has';
const RED = (ids: string) => `every test of the new or changed scenarios (${ids}) passes on the current code; tests come before the code, so at least one must fail until the implementer's change`;

interface Result {
  title: string;
  status: 'passed' | 'failed';
  failureMessages?: string[];
}

const scratches: string[] = [];
const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups) c();
  for (const s of scratches) rmSync(s, { recursive: true, force: true });
});

/** A PROP-201 repo whose spec-writer stage (documents: `documented`, or no key when null) is recorded, then the tester started. */
async function proposal(prefix: string, documented: string | null) {
  const scratch = tempDir(`${prefix}-`);
  scratches.push(scratch);
  const reportFile = join(scratch, 'report');
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `cp '${reportFile}' "{report}"`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    },
  });
  cleanups.push(fx.cleanup);
  const docs = documented === null ? '' : `\ndocuments: [${documented}]`;
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
  fx.apply('reference/PROP-201.spec-writer.patch');
  return {
    fx,
    docs,
    async finishSpecWriter() {
      // Not asserted here: a spec-writer report with documents is refused until the feature exists,
      // and that must show in each test's own result, not as a skipped test.
      await fx.spec(report(`role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]${docs}\n${validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')}`), 'ticket', 'advance', 'PROP-201', '--format', 'json');
      // The spec review approves before the tester starts (PIP-001/S1); also not asserted here.
      await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-review');
      await fx.spec(report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: The delta covers its cases\nverdict: approve'), 'ticket', 'advance', 'PROP-201', '--format', 'json');
      await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester');
      const spec = parseSpec(loadDir(join(fx.repo, 'spec')));
      const everyTest = spec.features.filter((f) => f.id === 'PRV-001' || f.id === 'SET-001').flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
      return everyTest;
    },
    /** check-report of a tester whose run has these tests (all passing except `failing`), minus `missing`. */
    async tester(everyTest: string[], failing: Result[], missing: string[] = [], extra = '') {
      const rows = [
        ...everyTest.filter((t) => !missing.includes(t) && !failing.some((f) => f.title === t)).map((title) => ({ title, status: 'passed' })),
        ...failing,
      ];
      writeFileSync(reportFile, JSON.stringify({ testResults: [{ assertionResults: rows }] }));
      const msg = report(`role: tester\nticket: PROP-201\nresult: done\nsummary: Tests for PRV-001/S4 and SET-001/S4\n${validTesterMutations('PRV-001/S4', 'SET-001/S4')}${extra}`);
      const out = await fx.spec(msg, 'check-report', 'tester', 'PROP-201', '--format', 'json');
      return JSON.parse(out.stdout) as { ok: boolean; problems: string[] };
    },
  };
}

describe('PIP-006 documented scenarios', () => {
  let both: Awaited<ReturnType<typeof proposal>>;
  let bothTests: string[] = [];
  beforeAll(async () => {
    both = await proposal('spec-documents-both', 'PRV-001/S4, SET-001/S4');
    bothTests = await both.finishSpecWriter();
  }, 120_000);

  it('PIP-006/S27 A proposal whose new scenarios only document today\'s behaviour passes its tester stage', async () => {
    expect(await both.tester(bothTests, [])).toMatchObject({ ok: true, problems: [] });
  }, 60_000);

  it('PIP-006/S29 A documented scenario still needs a passing test', async () => {
    const failing: Result = { title: S4, status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] };
    const out = await both.tester(bothTests, [failing], [SET4]);
    expect(out.problems).toEqual([
      'no test covers SET-001/S4; name it "SET-001/S4 <scenario title>"',
      `the test "${S4}" fails, but the spec-writer listed PRV-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites PRV-001/S4`,
    ]);
  }, 60_000);
});

describe('PIP-006 one documented, one not', () => {
  let one: Awaited<ReturnType<typeof proposal>>;
  let oneTests: string[] = [];
  beforeAll(async () => {
    one = await proposal('spec-documents-one', 'PRV-001/S4');
    oneTests = await one.finishSpecWriter();
  }, 120_000);

  it('PIP-006/S28 An undocumented new scenario in the same proposal still starts red', async () => {
    expect((await one.tester(oneTests, [])).problems).toEqual([RED('SET-001/S4')]);
    const failing: Result = { title: SET4, status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] };
    expect(await one.tester(oneTests, [failing])).toMatchObject({ ok: true, problems: [] });
  }, 60_000);
});

describe('PIP-006 who may list documents', () => {
  let none: Awaited<ReturnType<typeof proposal>>;
  beforeAll(async () => {
    none = await proposal('spec-documents-none', null);
  }, 120_000);

  it('PIP-006/S30 A spec-writer may list only scenarios it added', async () => {
    const msg = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\ndocuments: [PRV-001/S4, PRV-001/S1, PRV-001/S9]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1'));
    const out = JSON.parse((await none.fx.spec(msg, 'check-report', 'spec-writer', 'PROP-201', '--format', 'json')).stdout) as { problems: string[] };
    expect(out.problems).toEqual([`documents lists PRV-001/S1, ${NOT_ADDED}`, `documents lists PRV-001/S9, ${NOT_ADDED}`]);
  }, 60_000);

  it('PIP-006/S31 Only the spec-writer lists documents', async () => {
    const tests = await none.finishSpecWriter();
    const out = await none.tester(tests, [], [], '\ndocuments: [PRV-001/S4]');
    expect(out.problems).toContain('only the spec-writer lists documents; leave it out of the tester\'s report');
    expect(out.problems).toContain(RED('PRV-001/S4, SET-001/S4'));
  }, 60_000);
});
