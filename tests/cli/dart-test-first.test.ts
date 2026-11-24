// Test-first on a compiled language: PROP-101 in Dart, through the CLI. A test against a method
// that does not exist yet does not compile, so the tester adds a stub marked SPEC-STUB; the
// implementer must replace it. Skipped where Dart is not installed.
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO, approveSpecReview, gitFixture, report, validSpecWriterChecklist, validTesterMutations } from '../helpers';

const hasDart = spawnSync('dart', ['--version'], { encoding: 'utf8' }).status === 0;
type Fixture = ReturnType<typeof gitFixture>;
let fx: Fixture | null = null;
const f = (): Fixture => {
  if (!fx) throw new Error('fixture not ready');
  return fx;
};
const json = async (stdin: string, ...argv: string[]) => JSON.parse((await f().spec(stdin, ...argv, '--format', 'json')).stdout) as { problems: string[]; next: string | null; status: string };
const testerReport = report('role: tester\nticket: PROP-101\nresult: done\nsummary: Test for CRT-001/S3, with a stub for Cart.remove\n' + validTesterMutations('CRT-001/S3'));
const implementerReport = report('role: implementer\nticket: PROP-101\nresult: done\nsummary: Cart.remove removes the line with that name');

describe.skipIf(!hasDart)('PROP-101 in Dart: test-first with stubs', () => {
  beforeAll(() => {
    fx = gitFixture('spec-dart', {
      fixture: join(REPO, 'fixtures/dart-mini'),
      patches: 'evals/reference-dart',
      setup: (dir) => {
        const r = spawnSync('dart', ['pub', 'get', '--offline'], { cwd: dir, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`dart pub get --offline failed (is package:test in the pub cache?): ${r.stderr}`);
      },
    });
  }, 120_000);
  afterAll(() => fx?.cleanup());

  it('spec-writer: the new operation and scenario are recorded', async () => {
    expect((await f().spec('', 'ticket', 'start', 'PROP-101', 'spec-writer')).code).toBe(0);
    f().apply('PROP-101.spec-writer.patch');
    const adv = await json(report('role: spec-writer\nticket: PROP-101\nresult: done\nsummary: Added cart.RemoveItem and CRT-001/S3\nchanged: [cart.RemoveItem, CRT-001/S3]\n' + validSpecWriterChecklist('CRT-001/S3', 'CRT-001/S1')), 'ticket', 'advance', 'PROP-101');
    expect(adv).toMatchObject({ next: 'spec-review', status: 'open', problems: [] });
  }, 60_000);

  it('spec-review: approves the spec change, and the tester is next', async () => {
    expect(await approveSpecReview(f(), 'PROP-101')).toMatchObject({ next: 'tester', status: 'open', problems: [] });
  }, 60_000);

  it('PIP-006/S16 Test first in Dart: a test against a missing method does not compile, so no test of that file runs', async () => {
    expect((await f().spec('', 'ticket', 'start', 'PROP-101', 'tester')).code).toBe(0);
    const test = join(f().repo, 'test/crt_001_test.dart');
    const before = readFileSync(test, 'utf8');
    appendFileSync(test, "\nvoid more() {\n  test('CRT-001/S3 Remove an item', () => Cart().remove('apple'));\n}\n");
    const out = (await f().spec('', 'test')).stdout;
    expect(out).toMatch(/^FAIL loading test\/crt_001_test\.dart$/m);
    expect(out).not.toMatch(/CRT-001\/S1/);
    const problems = (await json(testerReport, 'check-report', 'tester', 'PROP-101')).problems;
    expect(problems).toEqual(expect.arrayContaining([expect.stringMatching(/^no test covers CRT-001\/S3/), expect.stringMatching(/^no test covers CRT-001\/S1/)]));
    f().git('checkout', '--', 'test');
    expect(readFileSync(test, 'utf8')).toBe(before);
  }, 60_000);

  it('tester: with a SPEC-STUB stub the test compiles, fails, and the stage is accepted', async () => {
    f().apply('PROP-101.tester.patch');
    const out = (await f().spec('', 'test')).stdout;
    expect(out).toMatch(/^FAIL CRT-001\/S3 Remove an item$/m);
    expect(out).toMatch(/^PASS CRT-001\/S1 Add an item$/m);
    expect(await json(testerReport, 'ticket', 'advance', 'PROP-101')).toMatchObject({ next: 'implementer', status: 'open', problems: [] });
  }, 60_000);

  it('implementer: refused while the stub is there; accepted once it is real code', async () => {
    expect((await f().spec('', 'ticket', 'start', 'PROP-101', 'implementer')).code).toBe(0);
    const problems = (await json(implementerReport, 'check-report', 'implementer', 'PROP-101')).problems;
    expect(problems).toEqual(expect.arrayContaining(['SPEC-STUB is still in lib/cart.dart; replace every stub with the real code', expect.stringMatching(/^tests fail/)]));
    f().apply('PROP-101.implementer.patch');
    expect(await json(implementerReport, 'ticket', 'advance', 'PROP-101')).toMatchObject({ next: 'reviewer', status: 'open', problems: [] });
  }, 60_000);

  it('reviewer: approves; one commit per stage, and lint is clean', async () => {
    expect((await f().spec('', 'ticket', 'start', 'PROP-101', 'reviewer')).code).toBe(0);
    expect(await json(report('role: reviewer\nticket: PROP-101\nresult: done\nsummary: Cart.remove matches CRT-001/S3\nverdict: approve'), 'ticket', 'advance', 'PROP-101')).toMatchObject({ status: 'done' });
    const log = f().git('log', '--format=%s', 'main..HEAD').stdout.trim().split('\n');
    expect(log.map((s) => s.split(':')[0])).toEqual(['PROP-101 reviewer', 'PROP-101 implementer', 'PROP-101 tester', 'PROP-101 spec-review', 'PROP-101 spec-writer']);
    expect((await f().spec('', 'lint', '--ci')).code).toBe(0);
  }, 60_000);
});
