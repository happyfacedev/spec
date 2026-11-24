// PIP-021 (light lanes) with PIP-001/S34, PIP-012/S30 and PIP-020/S7 (PROP-092), through the CLI in real
// git copies of chat-mini. Tickets are written in the setup, with their earlier stages seeded as YAML;
// the test command copies a report this file writes, so a run's results are the file's to decide.
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { partitionedDescribe } from './partitioned-it';
const describe = partitionedDescribe(2);
import { gitFixture, loadFixture, report, validSpecWriterChecklist, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
type Built = Fx & { reportFile: string; failFlag: string };
const made: Fx[] = [];
const scratch = tempDir('spec-lanes-');
afterAll(() => {
  for (const fx of made) fx.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

/** The name of every test a run of chat-mini holds: one per scenario. */
const ALL_TESTS = loadFixture().spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
/** A vitest JSON report: every scenario's test passes, except the scenarios in `failing`, and none for those in `omit`. */
const results = (o: { failing?: string[]; omit?: string[] } = {}): string => {
  const has = (list: string[] | undefined, title: string) => (list ?? []).some((id) => title.startsWith(`${id} `));
  const rows = ALL_TESTS.filter((title) => !has(o.omit, title)).map((title) =>
    has(o.failing, title) ? { title, status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] } : { title, status: 'passed' },
  );
  return JSON.stringify({ testResults: [{ assertionResults: rows }] });
};

const AT = '2026-10-28T10:00:00.000Z';
/** One history record as YAML; `extra` is added after assumed, as `, lane: docs`. */
const rec = (role: string, o: { extra?: string; result?: string; verdict?: string } = {}): string =>
  `  - { at: "${AT}", role: ${role}, result: ${o.result ?? 'done'}, summary: x, verdict: ${o.verdict ?? (role === 'spec-review' ? 'approve' : 'null')}, assumed: []${o.extra ?? ''} }`;
const FINDING = (flag: 'tests' | 'spec' | null) => `{ cites: [PRV-002/S1], text: "a finding", class: C9${flag === null ? '' : `, ${flag}: true`} }`;
/** A reviewer record asking for changes, with one finding marked `flag`; `lane` is the lane it records. */
const changes = (flag: 'tests' | 'spec' | null, lane: 'full' | null): string =>
  rec('reviewer', { verdict: 'changes', extra: `${lane === null ? '' : `, lane: ${lane}`}, findings: [${FINDING(flag)}]` });

/** A proposal file touching PRV-002, with the given lane line (none when null) and history lines. */
const proposal = (id: string, lane: string | null, history: readonly string[] = []): string =>
  `---\nid: ${id}\ntype: proposal\ntitle: A lane proposal\nstatus: open\nstage: null\n${lane === null ? '' : `lane: ${lane}\n`}touches: [PRV-002]\nviolates: []\nchanged: []\nquestions: []\n${history.length === 0 ? 'history: []' : `history:\n${history.join('\n')}`}\n---\nA proposal for the lane tests.\n`;

let counter = 0;
/** A chat-mini copy holding `tickets`, whose test command copies this file's report and fails while `failFlag` exists. */
function build(prefix: string, tickets: Record<string, string>, o: { checkCommands?: string[] } = {}): Built {
  const n = counter++;
  const reportFile = join(scratch, `report-${n}.json`);
  const failFlag = join(scratch, `fail-${n}.flag`);
  writeFileSync(reportFile, results());
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `cp '${reportFile}' "{report}" && [ ! -f '${failFlag}' ]`;
      if (o.checkCommands) cfg.checkCommands = o.checkCommands;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      for (const [id, text] of Object.entries(tickets)) writeFileSync(join(dir, 'tickets', `${id}.md`), text);
    },
  });
  made.push(fx);
  return Object.assign(fx, { reportFile, failFlag });
}

interface Advanced {
  ticket: string;
  next: string | null;
  status: string;
  problems: string[];
}
const start = async (fx: Fx, id: string, role: string) => {
  const out = await fx.spec('', 'ticket', 'start', id, role);
  expect(out.code, out.stderr).toBe(0);
};
const advance = async (fx: Fx, id: string, message: string): Promise<Advanced> => {
  const out = await fx.spec(message, 'ticket', 'advance', id, '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  return JSON.parse(out.stdout) as Advanced;
};
const records = (fx: Fx, id: string) => (fx.ticket(id)?.history ?? []) as unknown as Record<string, unknown>[];
const lanesOf = (fx: Fx, id: string) => records(fx, id).map((r) => r.lane);

const swReport = (id: string) => report(`role: spec-writer\nticket: ${id}\nresult: done\nsummary: Aligned the scenarios\n${validSpecWriterChecklist()}`);
const approval = (id: string, extra = '') => report(`role: spec-review\nticket: ${id}\nresult: done\nsummary: The delta covers its cases\nverdict: approve${extra}`);
const reviewerApproval = (id: string) => report(`role: reviewer\nticket: ${id}\nresult: done\nsummary: The change matches its scenarios\nverdict: approve`);
const testerReport = (id: string) => report(`role: tester\nticket: ${id}\nresult: done\nsummary: Stronger tests for the fallback`);

const FEATURE = 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
/** Edits the PRV-002 feature file in the tree: `from` must be there. */
function editFeature(fx: Fx, from: string, to: string): void {
  const file = join(fx.repo, FEATURE);
  const text = readFileSync(file, 'utf8');
  expect(text, `${from} in ${FEATURE}`).toContain(from);
  writeFileSync(file, text.replace(from, to));
}
const reword = (fx: Fx) => { editFeature(fx, '### S1: Fallback enabled', '### S1: Fallback is enabled'); };
/** The stage every ready ticket runs next, as `spec queue` reads the tickets of this tree. */
async function nextOf(fx: Fx, ids: readonly string[]): Promise<Record<string, string | null>> {
  const out = await fx.spec('', 'queue', '--format', 'json');
  const queue = JSON.parse(out.stdout) as { ready: { id: string; stage: string | null }[] };
  return Object.fromEntries(ids.map((id) => [id, queue.ready.find((e) => e.id === id)?.stage ?? null]));
}

/** The next stage of tickets seeded with a lane and a history: one fixture, one queue. */
async function ordersOf(prefix: string, seeded: Record<string, { lane: string | null; history: readonly string[] }>): Promise<Record<string, string | null>> {
  const fx = build(prefix, Object.fromEntries(Object.entries(seeded).map(([id, s]) => [id, proposal(id, s.lane, s.history)])));
  return nextOf(fx, Object.keys(seeded));
}

describe('PIP-001/S34 A proposal with no lane, or the full lane, runs every stage', () => {
  it('PIP-001/S34 A proposal with no lane, or the full lane, runs every stage', async () => {
    for (const [id, lane] of [['PROP-213', null], ['PROP-214', 'full']] as const) {
      const fx = build(`lane-s34-${id}`, { [id]: proposal(id, lane) });
      const nexts: (string | null)[] = [];
      await start(fx, id, 'spec-writer');
      nexts.push((await advance(fx, id, swReport(id))).next);
      await start(fx, id, 'spec-review');
      nexts.push((await advance(fx, id, approval(id))).next);
      await start(fx, id, 'tester');
      nexts.push((await advance(fx, id, testerReport(id))).next);
      await start(fx, id, 'implementer');
      appendFileSync(join(fx.repo, 'src/app.ts'), '// the code\n');
      nexts.push((await advance(fx, id, report(`role: implementer\nticket: ${id}\nresult: done\nsummary: The code`))).next);
      expect(nexts, id).toEqual(['spec-review', 'tester', 'implementer', 'reviewer']);
      await start(fx, id, 'reviewer');
      const last = await advance(fx, id, reviewerApproval(id));
      expect(last).toMatchObject({ next: null, status: 'done' });
      expect(records(fx, id).map((r) => r.role), id).toEqual(['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer']);
      expect(lanesOf(fx, id).every((l) => l === undefined), `${id} records no lane`).toBe(true);
    }
  }, 300_000);
});

describe('PIP-021 A proposal in a light lane', () => {
  it('PIP-021/S1 A docs-lane proposal runs spec-writer, spec-review, reviewer', async () => {
    const fx = build('lane-s1', { 'PROP-210': proposal('PROP-210', 'docs'), 'PROP-215': proposal('PROP-215', 'docs') });
    // On an empty history the tester is refused with the lane's order.
    const refused = await fx.spec('', 'ticket', 'start', 'PROP-215', 'tester');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('tester is not a stage of a proposal in the docs lane: spec-writer → spec-review → reviewer');
    // The spec-writer rewords PRV-002/S1, which a passing test covers, and the test command exits 0.
    await start(fx, 'PROP-210', 'spec-writer');
    reword(fx);
    const afterWriter = await advance(fx, 'PROP-210', swReport('PROP-210'));
    expect(afterWriter.problems).toEqual([]);
    expect(afterWriter.next).toBe('spec-review');
    await start(fx, 'PROP-210', 'spec-review');
    expect((await advance(fx, 'PROP-210', approval('PROP-210'))).next).toBe('reviewer');
    await start(fx, 'PROP-210', 'reviewer');
    const last = await advance(fx, 'PROP-210', reviewerApproval('PROP-210'));
    expect(last.status).toBe('done');
    expect(records(fx, 'PROP-210').map((r) => r.role)).toEqual(['spec-writer', 'spec-review', 'reviewer']);
    expect(lanesOf(fx, 'PROP-210')).toEqual(['docs', undefined, undefined]);
  }, 180_000);

  it('PIP-021/S2 A tests-lane proposal runs spec-writer, tester, reviewer', async () => {
    const fx = build('lane-s2', { 'PROP-211': proposal('PROP-211', 'tests'), 'PROP-216': proposal('PROP-216', 'tests') }, { checkCommands: ['echo checked'] });
    const refused = await fx.spec('', 'ticket', 'start', 'PROP-216', 'spec-review');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('spec-review is not a stage of a proposal in the tests lane: spec-writer → tester → reviewer');
    // The spec-writer changes no file in the spec folder.
    await start(fx, 'PROP-211', 'spec-writer');
    const afterWriter = await advance(fx, 'PROP-211', swReport('PROP-211'));
    expect(afterWriter.problems).toEqual([]);
    expect(afterWriter.next).toBe('tester');
    // The tester's tests pass, the check command exits 0 and no SPEC-STUB line is left.
    await start(fx, 'PROP-211', 'tester');
    appendFileSync(join(fx.repo, 'tests/PRV-002.test.ts'), '// a stronger test\n');
    const afterTester = await advance(fx, 'PROP-211', testerReport('PROP-211'));
    expect(afterTester.problems).toEqual([]);
    expect(afterTester.next).toBe('reviewer');
    expect(lanesOf(fx, 'PROP-211')).toEqual(['tests', undefined]);
  }, 180_000);
});

describe('PIP-021/S3 A docs-lane spec-writer whose scenarios lack a passing test moves the proposal to the full lane', () => {
  const ADD_S9 = (fx: Fx) => {
    editFeature(fx, '\n## Rules', '\n### S9: Fallback after a long wait\nGiven providers.ProviderConfig has "claude" active, "claude" and "gpt" enabled, and "gpt" as fallback\nWhen "claude" emits providers.RateLimited with retryAfterMs 900\nThen "gpt" is called with the same messages as "claude"\n\n## Rules');
  };
  const cases: { name: string; edit: (fx: Fx) => void; results?: string; flag?: boolean; noRun?: boolean }[] = [
    { name: 'the stage adds PRV-002/S9, and no test covers it', edit: ADD_S9 },
    { name: 'the stage changes the steps of PRV-002/S2, and no test covers it', edit: (fx) => { editFeature(fx, '"gpt" is never called\n\n### S3', '"gpt" is never called and nothing is retried\n\n### S3'); }, results: results({ omit: ['PRV-002/S2'] }) },
    { name: 'the stage changes only the title of PRV-002/S3, and no test covers it', edit: (fx) => { editFeature(fx, '### S3: Fallback provider also rate-limits', '### S3: Fallback provider rate-limits too'); }, results: results({ omit: ['PRV-002/S3'] }) },
    { name: 'the stage rewords PRV-002/S1, and the only test that covers it fails', edit: reword, results: results({ failing: ['PRV-002/S1'] }) },
    { name: 'every scenario it changes has a passing test, but another test fails', edit: reword, results: results({ failing: ['PRV-002/S4'] }) },
    { name: 'every test passes, but the test command exits 1', edit: reword, flag: true },
    { name: 'the project\'s tests cannot be run', edit: reword, noRun: true },
  ];

  it('PIP-021/S3 A docs-lane spec-writer whose scenarios lack a passing test moves the proposal to the full lane', async () => {
    for (const c of cases) {
      const fx = build('lane-s3', { 'PROP-210': proposal('PROP-210', 'docs') });
      await start(fx, 'PROP-210', 'spec-writer');
      c.edit(fx);
      if (c.results) writeFileSync(fx.reportFile, c.results);
      if (c.flag) writeFileSync(fx.failFlag, 'exit 1');
      if (c.noRun) rmSync(fx.reportFile);
      const out = await advance(fx, 'PROP-210', swReport('PROP-210'));
      expect(out.problems, c.name).toEqual([]);
      expect(lanesOf(fx, 'PROP-210'), c.name).toEqual(['full']);
      expect(out.next, c.name).toBe('spec-review');
      // The ticket file still reads docs.
      expect((fx.ticket('PROP-210') as unknown as Record<string, unknown>).lane, c.name).toBe('docs');
    }
  }, 600_000);

  it('PIP-021/S3 once the spec review approves, the full order goes on: tester, implementer, reviewer', async () => {
    const fx = build('lane-s3-tail', { 'PROP-210': proposal('PROP-210', 'docs') });
    await start(fx, 'PROP-210', 'spec-writer');
    ADD_S9(fx);
    expect((await advance(fx, 'PROP-210', swReport('PROP-210'))).next).toBe('spec-review');
    expect(lanesOf(fx, 'PROP-210')).toEqual(['full']);
    await start(fx, 'PROP-210', 'spec-review');
    expect((await advance(fx, 'PROP-210', approval('PROP-210'))).next).toBe('tester');
    const full = rec('spec-writer', { extra: ', lane: full' });
    const orders = await ordersOf('lane-s3-orders', {
      'PROP-401': { lane: 'docs', history: [full, rec('spec-review')] },
      'PROP-402': { lane: 'docs', history: [full, rec('spec-review'), rec('tester')] },
      'PROP-403': { lane: 'docs', history: [full, rec('spec-review'), rec('tester'), rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'tester', 'PROP-402': 'implementer', 'PROP-403': 'reviewer' });
  }, 180_000);
});

describe('PIP-021/S4 A tests-lane spec-writer that changes the spec sends the proposal to the spec review', () => {
  it('PIP-021/S4 A tests-lane spec-writer that changes the spec sends the proposal to the spec review', async () => {
    const fx = build('lane-s4', { 'PROP-211': proposal('PROP-211', 'tests') });
    await start(fx, 'PROP-211', 'spec-writer');
    appendFileSync(join(fx.repo, 'spec/core/overview.md'), '\nA sentence the spec-writer added.\n');
    const out = await advance(fx, 'PROP-211', swReport('PROP-211'));
    expect(out.problems).toEqual([]);
    expect(lanesOf(fx, 'PROP-211')).toEqual(['full']);
    expect(out.next).toBe('spec-review');
    await start(fx, 'PROP-211', 'spec-review');
    expect((await advance(fx, 'PROP-211', approval('PROP-211'))).next).toBe('tester');
    const full = rec('spec-writer', { extra: ', lane: full' });
    const orders = await ordersOf('lane-s4-orders', {
      'PROP-401': { lane: 'tests', history: [full, rec('spec-review')] },
      'PROP-402': { lane: 'tests', history: [full, rec('spec-review'), rec('tester')] },
      'PROP-403': { lane: 'tests', history: [full, rec('spec-review'), rec('tester'), rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'tester', 'PROP-402': 'implementer', 'PROP-403': 'reviewer' });
  }, 180_000);
});

describe('PIP-021/S5 A tests-lane tester is checked as any tester first, then against the implementer\'s checks', () => {
  const OUTSIDE = "echo 'src/app.ts:3 no-unused-vars'; exit 1";
  const ON_TESTS = "echo 'tests/PRV-002.test.ts:12 no-unused-vars'; exit 1";
  /** A tests-lane PROP-211 whose spec-writer is recorded and whose tester stage is running with a test change. */
  async function atTester(prefix: string, checkCommands?: string[]): Promise<Built> {
    const fx = build(prefix, { 'PROP-211': proposal('PROP-211', 'tests', [rec('spec-writer', { extra: ', lane: tests' })]) }, { checkCommands });
    await start(fx, 'PROP-211', 'tester');
    appendFileSync(join(fx.repo, 'tests/PRV-002.test.ts'), '// a stronger test\n');
    return fx;
  }
  const afterTester = async (fx: Fx) => {
    const out = await advance(fx, 'PROP-211', testerReport('PROP-211'));
    expect(out.problems).toEqual([]);
    expect(lanesOf(fx, 'PROP-211')).toEqual(['tests', 'full']);
    expect(out.next).toBe('implementer');
  };

  it('PIP-021/S5 a failing test moves the ticket to the full lane, and the implementer runs next, then the reviewer', async () => {
    const fx = await atTester('lane-s5-test');
    writeFileSync(fx.reportFile, results({ failing: ['PRV-002/S1'] }));
    await afterTester(fx);
    // Once that implementer stage is done, the reviewer runs next.
    const full = rec('tester', { extra: ', lane: full' });
    const orders = await ordersOf('lane-s5-orders', {
      'PROP-401': { lane: 'tests', history: [rec('spec-writer', { extra: ', lane: tests' }), full] },
      'PROP-402': { lane: 'tests', history: [rec('spec-writer', { extra: ', lane: tests' }), full, rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'implementer', 'PROP-402': 'reviewer' });
  }, 180_000);

  it('PIP-021/S5 a check command failing on a file outside testGlobs moves the ticket to the full lane', async () => {
    const fx = await atTester('lane-s5-command', [OUTSIDE]);
    await afterTester(fx);
  }, 180_000);

  it('PIP-021/S5 a SPEC-STUB line the branch added moves the ticket to the full lane', async () => {
    const fx = await atTester('lane-s5-stub');
    appendFileSync(join(fx.repo, 'src/app.ts'), "// SPEC-STUB PROP-211: throw new Error('not yet')\n");
    await afterTester(fx);
  }, 180_000);

  it('PIP-021/S5 a lint error in the tester\'s own test file refuses the report as on any tester stage, and records no lane', async () => {
    const fx = await atTester('lane-s5-lint', [ON_TESTS]);
    const out = await fx.spec(testerReport('PROP-211'), 'ticket', 'advance', 'PROP-211', '--format', 'json');
    expect(out.stdout + out.stderr).toContain('tests/PRV-002.test.ts');
    const last = records(fx, 'PROP-211').at(-1);
    expect(last).toMatchObject({ role: 'tester', result: 'blocked' });
    expect(lanesOf(fx, 'PROP-211')).toEqual(['tests', undefined]);
    // The tester runs again once the question is answered.
    expect((await fx.spec('', 'ticket', 'answer', 'PROP-211', 'Q1', 'fixed')).code).toBe(0);
    expect((await nextOf(fx, ['PROP-211']))['PROP-211']).toBe('tester');
  }, 180_000);
});

describe('PIP-021/S6 Any stage can move its ticket to the full lane, and none can make it lighter', () => {
  const docsSw = rec('spec-writer', { extra: ', lane: docs' });

  it('PIP-021/S6 a spec review that approves with lane full moves a docs ticket to the full lane', async () => {
    const fx = build('lane-s6', { 'PROP-210': proposal('PROP-210', 'docs', [docsSw]) });
    await start(fx, 'PROP-210', 'spec-review');
    const out = await advance(fx, 'PROP-210', approval('PROP-210', '\nlane: full'));
    expect(out.problems).toEqual([]);
    expect(lanesOf(fx, 'PROP-210')).toEqual(['docs', 'full']);
    expect(out.next).toBe('tester');
  }, 120_000);

  it('PIP-021/S6 a report with lane docs is refused with a problem starting "report lane: "', async () => {
    const fx = build('lane-s6-lighter', { 'PROP-210': proposal('PROP-210', 'docs', [docsSw]) });
    await start(fx, 'PROP-210', 'spec-review');
    const out = await fx.spec(approval('PROP-210', '\nlane: docs'), 'check-report', 'spec-review', 'PROP-210', '--format', 'json');
    const check = JSON.parse(out.stdout) as { ok: boolean; problems: string[] };
    expect(check.ok).toBe(false);
    expect(check.problems.some((p) => p.startsWith('report lane: '))).toBe(true);
  }, 120_000);

  it('PIP-021/S6 on a proposal in the full lane, a report with lane full changes no stage', async () => {
    const fx = build('lane-s6-full', { 'PROP-213': proposal('PROP-213', null, [rec('spec-writer')]) });
    await start(fx, 'PROP-213', 'spec-review');
    const out = await advance(fx, 'PROP-213', approval('PROP-213', '\nlane: full'));
    expect(out.problems).toEqual([]);
    expect(out.next).toBe('tester');
    expect(lanesOf(fx, 'PROP-213')).toEqual([undefined, undefined]);
  }, 120_000);
});

describe('PIP-021/S7 A reviewer finding that needs an earlier stage takes a light lane back to the full order', () => {
  const light = [rec('spec-writer', { extra: ', lane: docs' }), rec('spec-review')];
  const findingYaml = (flag: 'tests' | 'spec' | null) => `[{ cites: [PRV-002/S1], text: "a finding", class: C9${flag === null ? '' : `, ${flag}: true`} }]`;
  async function review(prefix: string, flag: 'tests' | 'spec' | null) {
    const fx = build(prefix, { 'PROP-210': proposal('PROP-210', 'docs', light) });
    await start(fx, 'PROP-210', 'reviewer');
    const message = report(`role: reviewer\nticket: PROP-210\nresult: done\nsummary: One thing to fix\nverdict: changes\nfindings: ${findingYaml(flag)}`);
    return { fx, out: await advance(fx, 'PROP-210', message) };
  }

  it('PIP-021/S7 a finding marked tests moves the ticket to the full lane: tester, implementer, reviewer', async () => {
    const { fx, out } = await review('lane-s7-tests', 'tests');
    expect(out.problems).toEqual([]);
    expect(lanesOf(fx, 'PROP-210')).toEqual(['docs', undefined, 'full']);
    expect(out.next).toBe('tester');
    const rest = [...light, changes('tests', 'full')];
    const orders = await ordersOf('lane-s7-tests-orders', {
      'PROP-401': { lane: 'docs', history: [...rest, rec('tester')] },
      'PROP-402': { lane: 'docs', history: [...rest, rec('tester'), rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'implementer', 'PROP-402': 'reviewer' });
  }, 180_000);

  it('PIP-021/S7 a finding marked spec moves the ticket to the full lane: spec-writer, then the full order', async () => {
    const { fx, out } = await review('lane-s7-spec', 'spec');
    expect(out.problems).toEqual([]);
    expect(lanesOf(fx, 'PROP-210')).toEqual(['docs', undefined, 'full']);
    expect(out.next).toBe('spec-writer');
    const rest = [...light, changes('spec', 'full'), rec('spec-writer')];
    const orders = await ordersOf('lane-s7-spec-orders', {
      'PROP-401': { lane: 'docs', history: rest },
      'PROP-402': { lane: 'docs', history: [...rest, rec('spec-review')] },
      'PROP-403': { lane: 'docs', history: [...rest, rec('spec-review'), rec('tester')] },
      'PROP-404': { lane: 'docs', history: [...rest, rec('spec-review'), rec('tester'), rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'spec-review', 'PROP-402': 'tester', 'PROP-403': 'implementer', 'PROP-404': 'reviewer' });
  }, 180_000);

  it('PIP-021/S7 findings marked neither way: the implementer, then the reviewer, and the record has no lane', async () => {
    const { fx, out } = await review('lane-s7-neither', null);
    expect(out.problems).toEqual([]);
    expect(out.next).toBe('implementer');
    expect(lanesOf(fx, 'PROP-210')).toEqual(['docs', undefined, undefined]);
    const orders = await ordersOf('lane-s7-neither-orders', {
      'PROP-401': { lane: 'docs', history: [...light, changes(null, null), rec('implementer')] },
    });
    expect(orders).toEqual({ 'PROP-401': 'reviewer' });
  }, 180_000);
});

describe('PIP-021/S8 The lane is fixed once the first stage is recorded', () => {
  it('PIP-021/S8 The lane is fixed once the first stage is recorded', async () => {
    const fx = build('lane-s8', { 'PROP-212': proposal('PROP-212', null) });
    const file = join(fx.repo, 'tickets/PROP-212.md');
    const refuse = async (role: string) => {
      const out = await fx.spec('', 'ticket', 'start', 'PROP-212', role);
      expect(out.code).toBe(1);
      return out.stderr;
    };
    // A done spec-writer that changed the spec has no lane on its record; the ticket's lane is then set to "tests".
    writeFileSync(file, proposal('PROP-212', 'tests', [rec('spec-writer')]));
    expect(await refuse('tester')).toContain('the next stage of PROP-212 is spec-review, not tester');
    // With the lane set to "docs" after the spec review approved, the next stage is the tester, not the reviewer.
    writeFileSync(file, proposal('PROP-212', 'docs', [rec('spec-writer'), rec('spec-review')]));
    expect(await refuse('reviewer')).toContain('the next stage of PROP-212 is tester, not reviewer');
    // A history recorded before lanes existed, in a ticket with no lane key, runs the full order.
    writeFileSync(file, proposal('PROP-212', null, [rec('spec-writer'), rec('spec-review')]));
    expect(await refuse('reviewer')).toContain('the next stage of PROP-212 is tester, not reviewer');
    // A first record with lane docs runs the docs lane though the ticket's lane is later set to "full" or "tests".
    const docs = [rec('spec-writer', { extra: ', lane: docs' }), rec('spec-review')];
    const later = await ordersOf('lane-s8-later', {
      'PROP-401': { lane: 'full', history: docs },
      'PROP-402': { lane: 'tests', history: docs },
      'PROP-403': { lane: null, history: docs },
    });
    expect(later).toEqual({ 'PROP-401': 'reviewer', 'PROP-402': 'reviewer', 'PROP-403': 'reviewer' });
  }, 180_000);

  it('PIP-021/S8 an edit of the lane while the first stage is running is the lane the first record keeps, and the guards use it', async () => {
    /** A docs-lane PROP-210 whose spec-writer stage is running, its lane edited to `edited`; `change` is made to the tree before the report. */
    async function firstStage(prefix: string, edited: string, change?: (fx: Built) => void) {
      const fx = build(prefix, { 'PROP-210': proposal('PROP-210', 'docs') });
      await start(fx, 'PROP-210', 'spec-writer');
      const file = join(fx.repo, 'tickets/PROP-210.md');
      const text = readFileSync(file, 'utf8');
      expect(text).toContain('lane: docs');
      writeFileSync(file, text.replace('lane: docs', `lane: ${edited}`));
      change?.(fx);
      const out = await advance(fx, 'PROP-210', swReport('PROP-210'));
      expect(out.problems).toEqual([]);
      return { fx, out };
    }
    // Edited to tests, with no spec file changed: the first record keeps tests and the tester runs next.
    const toTests = await firstStage('lane-s8-edit-tests', 'tests');
    expect(lanesOf(toTests.fx, 'PROP-210')).toEqual(['tests']);
    expect(toTests.out.next).toBe('tester');
    // Edited to tests, with a spec file changed: the tests-lane guard of the lane the record keeps moves it to the full lane.
    const changed = await firstStage('lane-s8-edit-guard', 'tests', (fx) => { appendFileSync(join(fx.repo, 'spec/core/overview.md'), '\nA sentence the spec-writer added.\n'); });
    expect(lanesOf(changed.fx, 'PROP-210')).toEqual(['full']);
    expect(changed.out.next).toBe('spec-review');
    // Edited to full: no light lane is kept, and the first record has no lane.
    const toFull = await firstStage('lane-s8-edit-full', 'full');
    expect(lanesOf(toFull.fx, 'PROP-210')).toEqual([undefined]);
    expect(toFull.out.next).toBe('spec-review');
    // Once recorded, the lane is the record's: a later edit changes nothing.
    const file = join(toTests.fx.repo, 'tickets/PROP-210.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('lane: tests', 'lane: docs'));
    expect((await nextOf(toTests.fx, ['PROP-210']))['PROP-210']).toBe('tester');
  }, 300_000);
});

describe('PIP-012/S30 The rule for a proposal in a light lane', () => {
  const DOCS = "Type proposal, docs lane: the spec's text changes to match what the code and its tests already do; no test or code changes, and the tester does not run. The implementer runs only if the reviewer asks for changes and marks no finding for the spec or the tests. If the work needs a new test or a code change, put lane: full in your report, and the ticket moves to the full lane and goes on from your stage.";
  const TESTS = 'Type proposal, tests lane: only tests change; the spec and the code stay as they are, and the spec review does not run. The implementer runs only if the reviewer asks for changes and marks no finding for the spec or the tests. If the spec or the code must change, put lane: full in your report, and the ticket moves to the full lane and goes on from your stage.';
  const FULL = 'Type proposal: the spec changes first; then tests are written against the new spec, and fail; then the code changes until they pass.';

  it('PIP-012/S30 The rule for a proposal in a light lane', async () => {
    const fx = build('lane-s30', {
      'PROP-210': proposal('PROP-210', 'docs'),
      'PROP-211': proposal('PROP-211', 'tests'),
      'PROP-217': proposal('PROP-217', 'docs', [rec('spec-writer', { extra: ', lane: full' })]),
      'PROP-218': proposal('PROP-218', 'tests', [rec('spec-writer', { extra: ', lane: full' })]),
    });
    const brief = async (role: string, id: string) => (await fx.spec('', 'brief', role, id)).stdout;
    for (const role of ['spec-writer', 'tester', 'reviewer']) {
      const docs = await brief(role, 'PROP-210');
      expect(docs, `${role} docs`).toContain(DOCS);
      expect(docs, `${role} docs`).not.toContain(FULL);
      const tests = await brief(role, 'PROP-211');
      expect(tests, `${role} tests`).toContain(TESTS);
      expect(tests, `${role} tests`).not.toContain(FULL);
    }
    // Once a record has moved either to the full lane, its rule is the proposal's rule of S4.
    for (const id of ['PROP-217', 'PROP-218']) {
      const text = await brief('tester', id);
      expect(text, id).toContain(FULL);
      expect(text, id).not.toContain('docs lane');
      expect(text, id).not.toContain('tests lane');
    }
  }, 120_000);
});

describe('PIP-020/S7 A proposal in a light lane', () => {
  it('PIP-020/S7 A proposal in a light lane', async () => {
    const fx = build('lane-stats', {
      'PROP-210': proposal('PROP-210', 'docs', [rec('spec-writer', { extra: ', lane: docs' }), rec('spec-review'), rec('reviewer', { verdict: 'approve' })]),
      'PROP-211': proposal('PROP-211', 'tests', [rec('spec-writer', { extra: ', lane: tests' }), rec('tester'), rec('reviewer', { verdict: 'approve' })]),
      'PROP-212': proposal('PROP-212', 'docs', [rec('spec-writer', { extra: ', lane: docs' }), rec('spec-review', { verdict: 'changes' }), rec('spec-writer', { extra: ', lane: full' })]),
    });
    const json = await fx.spec('', 'stats', 'PROP-210', 'PROP-211', 'PROP-212', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const stats = JSON.parse(json.stdout) as { tickets: { id: string; minimum: number }[] };
    expect(stats.tickets.map((t) => [t.id, t.minimum])).toEqual([['PROP-210', 3], ['PROP-211', 3], ['PROP-212', 5]]);
    const text = await fx.spec('', 'stats', 'PROP-210', 'PROP-211', 'PROP-212');
    const row = (id: string) => (text.stdout.split('\n').find((l) => l.startsWith(id)) ?? '').trim().split(/\s{2,}/).slice(0, 2);
    expect(row('PROP-210')).toEqual(['PROP-210', '3/3']);
    expect(row('PROP-211')).toEqual(['PROP-211', '3/3']);
  }, 120_000);

  it('PIP-020/S7 a tests-lane proposal that left its lane at the tester has the minimum 5, not the legacy 4', async () => {
    const fx = build('lane-stats-widened', {
      'PROP-219': proposal('PROP-219', 'tests', [rec('spec-writer', { extra: ', lane: tests' }), rec('tester', { extra: ', lane: full' })]),
    });
    const json = await fx.spec('', 'stats', 'PROP-219', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const stats = JSON.parse(json.stdout) as { tickets: { id: string; stages: number; minimum: number }[] };
    expect(stats.tickets.map((t) => [t.id, t.stages, t.minimum])).toEqual([['PROP-219', 2, 5]]);
    const text = await fx.spec('', 'stats', 'PROP-219');
    const row = (text.stdout.split('\n').find((l) => l.startsWith('PROP-219')) ?? '').trim().split(/\s{2,}/).slice(0, 2);
    expect(row).toEqual(['PROP-219', '2/5']);
  }, 120_000);
});
