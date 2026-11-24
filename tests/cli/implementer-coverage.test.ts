// PIP-023: an implementer's done report on a proposal or a bug needs a test in the run for each
// scenario the ticket violates or its branch added or changed. Each fixture's test command copies a
// report this file writes and exits 0, so the run's tests are the file's to decide (as in documents.test.ts).
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseSpec } from '../../src/core/parse/spec';
import { loadDir } from '../../src/io/fs';
import { gitFixture, report, validSpecWriterChecklist, validTesterMutations, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const S4 = 'PRV-001/S4 Streams from gemini';
const SET4 = 'SET-001/S4 Enable gemini';
const NO_S4 = 'no test covers PRV-001/S4; name it "PRV-001/S4 <scenario title>"';
const NO_SET4 = 'no test covers SET-001/S4; name it "SET-001/S4 <scenario title>"';
const NO_BUG = 'no test covers PRV-002/S3; name it "PRV-002/S3 <scenario title>"';

const scratches: string[] = [];
const fixtures: Fx[] = [];
afterAll(() => {
  for (const f of fixtures) f.cleanup();
  for (const s of scratches) rmSync(s, { recursive: true, force: true });
});

type Row = { title: string; status: 'passed' | 'failed'; failureMessages?: string[] };
const pass = (title: string): Row => ({ title, status: 'passed' });
const fail = (title: string): Row => ({ title, status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] });

/** A git copy of chat-mini whose test command copies a report this file writes and exits 0. */
function make(prefix: string) {
  const scratch = tempDir(`${prefix}-`);
  scratches.push(scratch);
  const reportFile = join(scratch, 'report');
  writeFileSync(reportFile, JSON.stringify({ testResults: [{ assertionResults: [] }] }));
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `cp '${reportFile}' "{report}"`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    },
  });
  fixtures.push(fx);
  return {
    fx,
    /** The run's tests from now on: these rows, and the command exits 0. */
    results(rows: Row[]) {
      writeFileSync(reportFile, JSON.stringify({ testResults: [{ assertionResults: rows }] }));
    },
  };
}
type Env = ReturnType<typeof make>;

const advance = async (fx: Fx, message: string, id: string) => {
  const out = await fx.spec(message, 'ticket', 'advance', id, '--format', 'json');
  const parsed = JSON.parse(out.stdout) as { problems: string[]; next: string | null };
  expect(parsed.problems, out.stderr).toEqual([]);
};
const check = async (fx: Fx, id: string) => {
  const out = await fx.spec(report(`role: implementer\nticket: ${id}\nresult: done\nsummary: The code`), 'check-report', 'implementer', id, '--format', 'json');
  return JSON.parse(out.stdout) as { ok: boolean; problems: string[] };
};

/** PROP-201 through its spec-writer, spec-review and tester stages (PRV-001/S4 and SET-001/S4 red), then its implementer stage started and the reference code applied. */
async function proposalInImplementer(prefix: string): Promise<Env> {
  const e = make(prefix);
  const { fx } = e;
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
  fx.apply('reference/PROP-201.spec-writer.patch');
  await advance(fx, report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')), 'PROP-201');
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-review')).code).toBe(0);
  await advance(fx, report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: The delta covers its cases\nverdict: approve'), 'PROP-201');
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester')).code).toBe(0);
  const spec = parseSpec(loadDir(join(fx.repo, 'spec')));
  const every = spec.features.filter((f) => f.id === 'PRV-001' || f.id === 'SET-001').flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
  e.results(every.map((t) => (t === S4 || t === SET4 ? fail(t) : pass(t))));
  await advance(fx, report('role: tester\nticket: PROP-201\nresult: done\nsummary: Tests for PRV-001/S4 and SET-001/S4\n' + validTesterMutations('PRV-001/S4', 'SET-001/S4')), 'PROP-201');
  expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'implementer')).code).toBe(0);
  fx.apply('reference/PROP-201.implementer.patch');
  return e;
}

describe('PIP-023: an implementer holds tests for the scenarios it delivers', () => {
  it('PIP-023/S1 An implementer\'s run with no test for its scenarios is refused', async () => {
    const e = await proposalInImplementer('impl-cov-s1');
    e.results([]);
    expect(await check(e.fx, 'PROP-201')).toMatchObject({ ok: false, problems: [NO_S4, NO_SET4] });
    e.results([pass(S4)]);
    expect((await check(e.fx, 'PROP-201')).problems).toEqual([NO_SET4]);
  }, 120_000);

  it('PIP-023/S2 A bug\'s violated scenario needs a test too', async () => {
    const e = make('impl-cov-s2');
    const { fx } = e;
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    appendFileSync(join(fx.repo, 'tests/PRV-002.test.ts'), "\nit('PRV-002/S3 Fallback provider also rate-limits', () => {\n  throw new Error('red');\n});\n");
    e.results([pass('PRV-002/S1 Fallback enabled'), pass('PRV-002/S2 Fallback disabled'), fail('PRV-002/S3 Fallback provider also rate-limits'), pass('PRV-002/S4 Fallback provider not enabled')]);
    await advance(fx, report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the PRV-002/S3 test; it fails on main\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3')), 'BUG-301');
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    fx.apply('reference/BUG-301.implementer.patch');
    e.results([]);
    expect(await check(fx, 'BUG-301')).toMatchObject({ ok: false, problems: [NO_BUG] });
  }, 120_000);

  it('PIP-023/S3 A run that covers its scenarios is accepted', async () => {
    const e = await proposalInImplementer('impl-cov-s3');
    e.results([pass(S4), pass(SET4)]);
    expect(await check(e.fx, 'PROP-201')).toMatchObject({ ok: true, problems: [] });
  }, 120_000);

  it('PIP-023/S4 A ticket that names no scenario needs none', async () => {
    const e = make('impl-cov-s4');
    expect((await e.fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    appendFileSync(join(e.fx.repo, 'src/app.ts'), '// the refactor\n');
    e.results([]);
    expect(await check(e.fx, 'TASK-101')).toMatchObject({ ok: true, problems: [] });
  }, 120_000);
});
