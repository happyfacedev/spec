// PIP-006/R8: on a proposal, a new test that fails by an error, not on its assertion, is refused.
// PROP-201 added PRV-001/S4 and SET-001/S4; the project's test command copies a report this file
// writes (as in test-names.test.ts), so each test sets what the runner said.
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSpec } from '../../src/core/parse/spec';
import { loadDir } from '../../src/io/fs';
import { approveSpecReview, gitFixture, report, validSpecWriterChecklist, validTesterMutations, tempDir } from '../helpers';

const scratch = tempDir('spec-failure-kind-');
const reportFile = join(scratch, 'report');
const fx = gitFixture('spec-failure-kind', {
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

const tester = report('role: tester\nticket: PROP-201\nresult: done\nsummary: Tests for PRV-001/S4 and SET-001/S4\n' + validTesterMutations('PRV-001/S4', 'SET-001/S4'));
const S4 = 'PRV-001/S4 Streams from gemini';

interface Result {
  title: string;
  status: 'passed' | 'failed';
  failureDetails?: { name: string }[];
  failureMessages?: string[];
}
let everyTest: string[] = [];

/** The runner's report: every test of the features in scope passes, except these. */
const runner = (failing: Result[]) =>
  JSON.stringify({
    testResults: [
      {
        assertionResults: [...everyTest.filter((t) => !failing.some((f) => f.title === t)).map((title) => ({ title, status: 'passed' })), ...failing],
      },
    ],
  });
const problemsFor = async (failing: Result[]) => {
  writeFileSync(reportFile, runner(failing));
  const out = await fx.spec(tester, 'check-report', 'tester', 'PROP-201', '--format', 'json');
  return JSON.parse(out.stdout) as { ok: boolean; problems: string[] };
};
const typeError: Result = { title: S4, status: 'failed', failureDetails: [{ name: 'TypeError' }], failureMessages: ['TypeError: gemini.stream is not a function\n    at stream (src/app.ts:1:1)'] };

beforeAll(async () => {
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
  fx.apply('reference/PROP-201.spec-writer.patch');
  const adv = await fx.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')), 'ticket', 'advance', 'PROP-201', '--format', 'json');
  expect(adv.code).toBe(0);
  expect(await approveSpecReview(fx, 'PROP-201')).toMatchObject({ next: 'tester', problems: [] });
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester')).code).toBe(0);
  const spec = parseSpec(loadDir(join(fx.repo, 'spec')));
  everyTest = spec.features.filter((f) => f.id === 'PRV-001' || f.id === 'SET-001').flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
  expect(everyTest).toContain(S4);
}, 120_000);

describe('PIP-006: a new test fails on its assertion', () => {
  it('PIP-006/S23 A new test that fails by an error is refused', async () => {
    expect((await problemsFor([typeError])).problems).toEqual([
      `the test "${S4}" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts`,
    ]);
  }, 60_000);

  it('PIP-006/S25 Errors outside the new scenarios, or unlabelled, are not refused', async () => {
    const old = everyTest.find((t) => t.startsWith('PRV-001/S1 ')) ?? '';
    expect(old).not.toBe('');
    const older: Result = { title: old, status: 'failed', failureDetails: [{ name: 'TypeError' }], failureMessages: ['TypeError: x is not a function'] };
    const unlabelled: Result = { title: S4, status: 'failed' };
    expect(await problemsFor([older, unlabelled])).toMatchObject({ ok: true, problems: [] });
  }, 60_000);

  it("PIP-006/S24 A stub's error is not an error of the test", async () => {
    appendFileSync(join(fx.repo, 'src/app.ts'), "\n// SPEC-STUB PROP-201: throw new Error('SPEC-STUB PROP-201')\n");
    const stub: Result = { title: S4, status: 'failed', failureDetails: [{ name: 'Error' }], failureMessages: ['Error: SPEC-STUB PROP-201\n    at src/app.ts'] };
    expect(await problemsFor([stub])).toMatchObject({ ok: true, problems: [] });
  }, 60_000);
});
