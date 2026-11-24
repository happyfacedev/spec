// PROP-201 through the test-first proposal pipeline, with the reference patches standing in for
// the roles: spec-writer → spec-review → tester (red) → implementer (green, code only) → reviewer.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { approveSpecReview, gitFixture, report, validSpecWriterChecklist, validTesterMutations } from '../helpers';

const fx = gitFixture('spec-test-first');
afterAll(fx.cleanup);

const json = async (stdin: string, ...argv: string[]) => JSON.parse((await fx.spec(stdin, ...argv, '--format', 'json')).stdout) as { problems: string[]; next: string | null; status: string };
const testerReport = report('role: tester\nticket: PROP-201\nresult: done\nsummary: Tests for PRV-001/S4 and SET-001/S4\n' + validTesterMutations('PRV-001/S4', 'SET-001/S4'));

describe('PROP-201, test-first', () => {
  it('spec-writer: advance records every unit the stage added, even ones its report left out', async () => {
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    fx.apply('reference/PROP-201.spec-writer.patch');
    const adv = await json(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')), 'ticket', 'advance', 'PROP-201');
    expect(adv).toMatchObject({ next: 'spec-review', status: 'open', problems: [] });
    expect(fx.ticket('PROP-201')?.changed).toEqual(expect.arrayContaining(['providers.ProviderConfig', 'PRV-001/S4', 'SET-001/S4']));
  }, 60_000);

  it('spec-review: approves the spec change, and the tester is next', async () => {
    expect(await approveSpecReview(fx, 'PROP-201')).toMatchObject({ next: 'tester', status: 'open', problems: [] });
  }, 60_000);

  it('the tester brief lists what is new in the spec', async () => {
    const text = (await fx.spec('', 'brief', 'tester', 'PROP-201')).stdout;
    expect(text).toContain('## New in the spec');
    expect(text).toContain('- PRV-001/S4 Streams from gemini (added)');
    expect(text).toContain('at least one must fail now');
  });

  it('tester: missing tests and tests that already pass are refused', async () => {
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester')).code).toBe(0);
    expect((await json(testerReport, 'check-report', 'tester', 'PROP-201')).problems).toEqual(
      expect.arrayContaining([expect.stringMatching(/^no test covers PRV-001\/S4/), expect.stringMatching(/^no test covers SET-001\/S4/)]),
    );
    appendFileSync(join(fx.repo, 'tests/PRV-001.test.ts'), "\nit('PRV-001/S4 Streams from gemini', () => { expect(1).toBe(1); });\n");
    appendFileSync(join(fx.repo, 'tests/SET-001.test.ts'), "\nit('SET-001/S4 Enable gemini', () => { expect(1).toBe(1); });\n");
    expect((await json(testerReport, 'check-report', 'tester', 'PROP-201')).problems).toEqual([expect.stringMatching(/passes on the current code; tests come before the code/)]);
    fx.git('checkout', '--', 'tests');
  }, 60_000);

  it('tester: the reference tests fail before the code and are recorded', async () => {
    fx.apply('reference/PROP-201.tester.patch');
    expect(await json(testerReport, 'ticket', 'advance', 'PROP-201')).toMatchObject({ next: 'implementer', status: 'open', problems: [] });
  }, 60_000);

  it("implementer: the brief says the tests are red; editing the tester's test is refused", async () => {
    expect((await fx.spec('', 'brief', 'implementer', 'PROP-201')).stdout).toContain("The tester's tests for these fail now.");
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'implementer')).code).toBe(0);
    fx.apply('reference/PROP-201.implementer.patch');
    appendFileSync(join(fx.repo, 'tests/PRV-001.test.ts'), '\n// loosened\n');
    const msg = report('role: implementer\nticket: PROP-201\nresult: done\nsummary: Added gemini to PROVIDER_IDS');
    expect((await json(msg, 'check-report', 'implementer', 'PROP-201')).problems).toEqual([expect.stringMatching(/the tests are the tester's/)]);
    fx.git('checkout', '--', 'tests/PRV-001.test.ts');
    expect(await json(msg, 'ticket', 'advance', 'PROP-201')).toMatchObject({ next: 'reviewer', status: 'open', problems: [] });
  }, 60_000);

  it('reviewer: approves; one commit per stage, in test-first order', async () => {
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'reviewer')).code).toBe(0);
    expect(await json(report('role: reviewer\nticket: PROP-201\nresult: done\nsummary: Matches the new scenarios\nverdict: approve'), 'ticket', 'advance', 'PROP-201')).toMatchObject({ next: null, status: 'done' });
    const log = fx.git('log', '--format=%s', 'main..HEAD').stdout.trim().split('\n');
    expect(log.map((s) => s.split(':')[0])).toEqual(['PROP-201 reviewer', 'PROP-201 implementer', 'PROP-201 tester', 'PROP-201 spec-review', 'PROP-201 spec-writer']);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 60_000);
});
