// spec ticket advance records a stage's duration, and its model and cost when the transcript reports them (PIP-008 R8).
import { spawn } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { saveReport } from '../../src/io/report-store';
import { REPO, gitFixture, report, validTesterMutations, tempDir, trackChild } from '../helpers';

const hidden = readFileSync(join(REPO, 'evals/hidden/chat-mini/PRV-002.hidden.test.ts'), 'utf8');

const fixtures: ReturnType<typeof gitFixture>[] = [];
const dirs: string[] = [];
const worktrees: { fx: ReturnType<typeof gitFixture>; path: string }[] = [];
afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const f of fixtures) f.cleanup();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const STARTED = '2026-10-27T12:00:00.000Z';
const ENDED = '2026-10-27T12:20:30.000Z';
const EVENT_WAIT_TIMEOUT_MS = 30_000;
const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const MAIN = join(REPO, 'src/cli/main.ts');

const at = (fx: ReturnType<typeof gitFixture>, now: string, stdin: string, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(fx.repo, 'spec')], env: {}, cwd: fx.repo, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => now });

async function started() {
  const fx = gitFixture('spec-advance-record');
  fixtures.push(fx);
  expect((await at(fx, STARTED, '', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
  return fx;
}

async function startedAs(id: string, role: string, prefix: string) {
  const fx = gitFixture(prefix);
  fixtures.push(fx);
  expect((await at(fx, STARTED, '', 'ticket', 'start', id, role)).code).toBe(0);
  return fx;
}

const stageFile = (fx: ReturnType<typeof gitFixture>, id: string) => join(fx.repo, '.git/spec/stages', `${id}.json`);
const remembered = (fx: ReturnType<typeof gitFixture>, id: string, role: string, model: string, started = STARTED) => {
  const entries = fx.ticket(id)?.history.length ?? 0;
  writeFileSync(stageFile(fx, id), JSON.stringify({ stage: role, started, model, entries }));
};

const blockedTester = (id: string) => report(`role: tester\nticket: ${id}\nresult: blocked\nsummary: Waiting on a person\nblockers: [{ text: Need an answer, cites: [${id}] }]`);
const invalidModelEdges = [
  `e${'\u0301'.repeat(200_000)}`,
  'claude\u2028',
  'claude\u202e',
  'model\u007f',
  'model\u0085',
  'claude-opüs',
];
const installBug301ScenarioTest = (repo: string): void => {
  appendFileSync(join(repo, 'tests/PRV-002.test.ts'), `\n${hidden.slice(hidden.indexOf("it('PRV-002/S3"))}`);
};

async function waitForEvent(predicate: () => boolean, message: string): Promise<void> {
  const began = Date.now();
  while (!predicate() && Date.now() - began < EVENT_WAIT_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(predicate(), message).toBe(true);
}

function startCliTest(cwd: string) {
  const env = { ...process.env };
  delete env['SPEC_ROOT'];
  delete env['CLAUDE_PROJECT_DIR'];
  delete env['SPEC_CLI_DELEGATED'];
  delete env['SPEC_PLUGIN_VERSION'];
  const child = trackChild(spawn(process.execPath, [TSX, MAIN, 'test', '--root', join(cwd, 'spec')], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const done = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { resolve(code); });
  });
  return { child, done };
}

/** A transcript in which the harness reports a model and a cost, as `claude -p --output-format json` does. */
function transcript(lines: unknown[]): string {
  const dir = tempDir('spec-transcript-');
  dirs.push(dir);
  const file = join(dir, 'agent-a1.jsonl');
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return file;
}

function rawTranscript(jsonl: string): string {
  const dir = tempDir('spec-transcript-');
  dirs.push(dir);
  const file = join(dir, 'agent-a1.jsonl');
  writeFileSync(file, jsonl);
  return file;
}

const DONE = report('role: implementer\nticket: TASK-103\nresult: done\nsummary: Nothing to change yet');
const last = (fx: ReturnType<typeof gitFixture>) => fx.ticket('TASK-103')?.history.at(-1) as Record<string, unknown> | undefined;

describe('the stage record', () => {
  it('PIP-008/S27 A blocker marked external becomes an external question', async () => {
    const fx = gitFixture('spec-advance-external');
    fixtures.push(fx);
    expect((await at(fx, STARTED, '', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    const text = 'Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?';
    const external = report('role: spec-writer\nticket: PROP-201\nresult: blocked\nsummary: Waiting on API facts\nblockers: [{ text: "' + text + '", cites: [PROP-201], external: true }]');
    const adv = await at(fx, ENDED, external, 'ticket', 'advance', 'PROP-201');
    expect(adv.code, adv.stderr).toBe(0);
    expect(adv.stdout.split('\n').slice(0, 2)).toEqual(['PROP-201 spec-writer: Waiting on API facts', 'status: blocked']);
    expect(fx.ticket('PROP-201')?.questions).toEqual([{
      id: 'Q1', kind: 'external', text, default: null, cites: ['PROP-201'], answer: null, raised_by: 'spec-writer',
    }]);
    const gate = await fx.spec('', 'gate', 'PROP-201', '--format', 'json');
    expect(gate.code).toBe(1);
    const gateResult = JSON.parse(gate.stdout) as { blockers: { kind: string; id: string; text: string }[] };
    expect(gateResult.blockers).toEqual([{ kind: 'question', id: 'PROP-201#Q1', text }]);
    expect((await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes, verified in a spike')).code).toBe(0);
    const answered = await fx.spec('', 'gate', 'PROP-201', '--format', 'json');
    expect(answered.code).toBe(0);
    expect((JSON.parse(answered.stdout) as { ready: boolean }).ready).toBe(true);

    const ordinary = await started();
    const nonExternal = report('role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Needs a field\nblockers: [{ text: Needs a meta field, cites: [conversation.Message.meta], external: false }]');
    expect((await at(ordinary, ENDED, nonExternal, 'ticket', 'advance', 'TASK-103')).code).toBe(0);
    expect(ordinary.ticket('TASK-103')?.questions).toEqual([{
      id: 'Q1', kind: 'blocker', text: 'Needs a meta field', default: null,
      cites: ['conversation.Message.meta'], answer: null, raised_by: 'implementer',
    }]);
  }, 120_000);

  it('PIP-008/S20 A stage\'s duration, model and cost are recorded', async () => {
    const fx = await started();
    const file = transcript([
      { type: 'assistant', message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [] } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.42, modelUsage: { 'claude-sonnet-5-5': { costUSD: 0.42 } } },
    ]);
    const adv = await at(fx, ENDED, DONE, 'ticket', 'advance', 'TASK-103', '--transcript', file);
    expect(adv.code, adv.stderr).toBe(0);
    expect(last(fx)).toMatchObject({ duration_s: 1230, model: 'claude-sonnet-5-5', cost_usd: 0.42 });

    // No transcript: a duration and nothing else.
    const bare = await started();
    expect((await at(bare, ENDED, DONE, 'ticket', 'advance', 'TASK-103')).code).toBe(0);
    expect(last(bare)).toMatchObject({ duration_s: 1230 });
    expect(last(bare)).not.toHaveProperty('model');
    expect(last(bare)).not.toHaveProperty('cost_usd');

    // A transcript that reports neither.
    const silent = await started();
    const none = transcript([{ type: 'user', message: { role: 'user', content: 'hello' } }]);
    expect((await at(silent, ENDED, DONE, 'ticket', 'advance', 'TASK-103', '--transcript', none)).code).toBe(0);
    expect(last(silent)).toMatchObject({ duration_s: 1230 });
    expect(last(silent)).not.toHaveProperty('model');
    expect(last(silent)).not.toHaveProperty('cost_usd');

    const beforeStart = await startedAs('BUG-301', 'tester', 'spec-advance-record-before-start');
    remembered(beforeStart, 'BUG-301', 'tester', 'claude-opus-5-5');
    expect((await at(beforeStart, '2026-10-27T11:59:00.000Z', blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(beforeStart.ticket('BUG-301')?.history.at(-1)).toMatchObject({ duration_s: 0 });

    // A blocked report records duration and the model remembered for the stage too.
    const blocked = await started();
    writeFileSync(join(blocked.repo, '.git/spec/stages/TASK-103.json'), JSON.stringify({ stage: 'implementer', started: STARTED, model: 'claude-opus-5-5', entries: 0 }));
    const blockedReport = report('role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Needs a meta field\nblockers: [{ text: Needs a meta field, cites: [conversation.Message.meta] }]');
    expect((await at(blocked, ENDED, blockedReport, 'ticket', 'advance', 'TASK-103')).code).toBe(0);
    expect(last(blocked)).toMatchObject({ duration_s: 1230, model: 'claude-opus-5-5' });
    expect(last(blocked)).not.toHaveProperty('cost_usd');

    // A refused report records its duration and remembered model too.
    // BUG-301: the tester's failing test is committed, then the implementer reports done while it still fails.
    const refused = gitFixture('spec-advance-refused');
    fixtures.push(refused);
    expect((await at(refused, STARTED, '', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    installBug301ScenarioTest(refused.repo);
    const testerDone = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the test\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    expect((await at(refused, ENDED, testerDone, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    const implementerStart = '2026-10-27T12:20:31.000Z';
    const implementerEnd = '2026-10-27T12:41:01.000Z';
    expect((await at(refused, implementerStart, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    writeFileSync(join(refused.repo, '.git/spec/stages/BUG-301.json'), JSON.stringify({ stage: 'implementer', started: implementerStart, model: 'claude-opus-5-5', entries: 1 }));
    const failing = report('role: implementer\nticket: BUG-301\nresult: done\nsummary: Fixed it\nchanged: [PRV-002/S3]');
    const bad = await at(refused, implementerEnd, failing, 'ticket', 'advance', 'BUG-301');
    expect(bad.code).toBe(1);
    expect(refused.ticket('BUG-301')?.history.at(-1)).toMatchObject({ result: 'blocked', summary: 'invalid report', duration_s: 1230, model: 'claude-opus-5-5' });
    expect(refused.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('cost_usd');
    expect(JSON.parse(readFileSync(stageFile(refused, 'BUG-301'), 'utf8'))).toEqual({ stage: 'implementer', started: implementerStart });
  }, 120_000);

  it('PIP-025/S1 The model next chose is recorded without a transcript', async () => {
    const fx = await startedAs('BUG-301', 'tester', 'spec-model-s1');
    remembered(fx, 'BUG-301', 'tester', 'claude-opus-5-5');
    const startPath = stageFile(fx, 'BUG-301');
    const beforeNoOp = readFileSync(startPath, 'utf8');
    const noOp = await at(fx, STARTED, '', 'ticket', 'start', 'BUG-301', 'tester', '--format', 'json');
    expect(noOp.code, noOp.stderr).toBe(0);
    expect(readFileSync(startPath, 'utf8')).toBe(beforeNoOp);

    installBug301ScenarioTest(fx.repo);
    const testerDone = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the test\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    const recorded = await at(fx, ENDED, testerDone, 'ticket', 'advance', 'BUG-301');
    expect(recorded.code, recorded.stderr).toBe(0);
    expect(fx.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(fx.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('cost_usd');
    expect(JSON.parse(readFileSync(startPath, 'utf8'))).toEqual({ stage: 'tester', started: STARTED });

    const blocked = await startedAs('BUG-301', 'tester', 'spec-model-s1-blocked');
    remembered(blocked, 'BUG-301', 'tester', 'claude-opus-5-5');
    expect((await at(blocked, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(blocked.ticket('BUG-301')?.history.at(-1)).toMatchObject({ result: 'blocked', model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(blocked, 'BUG-301'), 'utf8'))).toEqual({ stage: 'tester', started: STARTED });

    const refused = await startedAs('BUG-301', 'tester', 'spec-model-s1-refused-checks');
    remembered(refused, 'BUG-301', 'tester', 'claude-opus-5-5');
    const wrongRole = report('role: spec-writer\nticket: BUG-301\nresult: blocked\nsummary: Wrong role\nblockers: [{ text: Waiting, cites: [BUG-301] }]');
    expect((await at(refused, ENDED, wrongRole, 'ticket', 'advance', 'BUG-301')).code).toBe(1);
    expect(refused.ticket('BUG-301')?.history.at(-1)).toMatchObject({ result: 'blocked', summary: 'invalid report', model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(refused, 'BUG-301'), 'utf8'))).toEqual({ stage: 'tester', started: STARTED });

    const handoff = gitFixture('spec-model-s1-handoff', {
      setup: (dir) => {
        const file = join(dir, 'tickets/BUG-301.md');
        const history = '  - { at: "2026-10-27T11:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [] }';
        writeFileSync(file, readFileSync(file, 'utf8').replace('history: []', `history:\n${history}`));
      },
    });
    fixtures.push(handoff);
    expect((await at(handoff, STARTED, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    remembered(handoff, 'BUG-301', 'implementer', 'claude-sonnet-5-5');
    const handoffReport = report('role: implementer\nticket: BUG-301\nresult: blocked\nsummary: The implementation is done\nblockers: [{ text: The tester needs a test fix, cites: [PRV-002/S3], tests: true }]');
    const handed = await at(handoff, ENDED, handoffReport, 'ticket', 'advance', 'BUG-301');
    expect(handed.code, handed.stderr).toBe(0);
    expect(handoff.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5' });
    expect(JSON.parse(readFileSync(stageFile(handoff, 'BUG-301'), 'utf8'))).toEqual({ stage: 'implementer', started: STARTED });
  }, 120_000);

  it('PIP-025/S2 A transcript\'s model wins', async () => {
    const makeStage = async (prefix: string) => {
      const fx = await startedAs('BUG-301', 'tester', prefix);
      remembered(fx, 'BUG-301', 'tester', 'claude-opus-5-5');
      return fx;
    };
    const completed = await makeStage('spec-model-s2-model');
    const modelAndCost = transcript([
      { type: 'assistant', message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [] } },
      { type: 'result', total_cost_usd: 0.42 },
    ]);
    expect((await at(completed, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', modelAndCost)).code).toBe(0);
    expect(completed.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', cost_usd: 0.42 });

    const costOnly = await makeStage('spec-model-s2-cost');
    const costTranscript = transcript([{ type: 'result', total_cost_usd: 0.42 }]);
    expect((await at(costOnly, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', costTranscript)).code).toBe(0);
    expect(costOnly.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5', cost_usd: 0.42 });

    const neither = await makeStage('spec-model-s2-neither');
    const emptyTranscript = transcript([{ type: 'user', message: { role: 'user', content: 'hello' } }]);
    expect((await at(neither, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', emptyTranscript)).code).toBe(0);
    expect(neither.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(neither.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('cost_usd');

    const stored = await makeStage('spec-model-s2-hook');
    const storedTranscript = transcript([
      { type: 'assistant', message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [] } },
      { type: 'result', total_cost_usd: 0.42 },
    ]);
    saveReport(stored.repo, 'BUG-301', blockedTester('BUG-301'), storedTranscript);
    expect((await at(stored, ENDED, '', 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(stored.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', cost_usd: 0.42 });
  }, 120_000);

  it('PIP-025/S3 A remembered model belongs to one stage', async () => {
    const first = await startedAs('BUG-301', 'tester', 'spec-model-s3-first');
    remembered(first, 'BUG-301', 'tester', 'claude-opus-5-5');
    installBug301ScenarioTest(first.repo);
    const testerDone = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the test\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    expect((await at(first, ENDED, testerDone, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(first.ticket('BUG-301')?.history.at(-1)).toMatchObject({ role: 'tester', model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(first, 'BUG-301'), 'utf8'))).not.toHaveProperty('model');

    const implementerStart = '2026-10-27T12:21:00.000Z';
    const implementerEnd = '2026-10-27T12:22:00.000Z';
    expect((await at(first, implementerStart, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    remembered(first, 'BUG-301', 'implementer', 'claude-sonnet-5-5', implementerStart);
    const handoff = report('role: implementer\nticket: BUG-301\nresult: blocked\nsummary: The implementation is done\nblockers: [{ text: The tester needs a test fix, cites: [PRV-002/S3], tests: true }]');
    expect((await at(first, implementerEnd, handoff, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(first.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5' });

    const secondTesterStart = '2026-10-27T12:23:00.000Z';
    const secondTesterEnd = '2026-10-27T12:24:00.000Z';
    expect((await at(first, secondTesterStart, '', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    expect(JSON.parse(readFileSync(stageFile(first, 'BUG-301'), 'utf8'))).not.toHaveProperty('model');
    expect((await at(first, secondTesterEnd, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(first.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('model');

    for (const [prefix, removeRecord] of [
      ['spec-model-s3-older-cli-record', false],
      ['spec-model-s3-older-cli-no-file', true],
    ] as const) {
      const older = await startedAs('BUG-301', 'tester', prefix);
      if (removeRecord) rmSync(stageFile(older, 'BUG-301'));
      else writeFileSync(stageFile(older, 'BUG-301'), JSON.stringify({ stage: 'tester', started: STARTED }));
      expect((await at(older, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
      expect(older.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('model');
    }

    const futureHistory = gitFixture('spec-model-s3-stale', {
      setup: (dir) => {
        const file = join(dir, 'tickets/BUG-301.md');
        const history = '  - { at: "2026-10-27T12:10:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [] }';
        writeFileSync(file, readFileSync(file, 'utf8').replace('history: []', `history:\n${history}`));
      },
    });
    fixtures.push(futureHistory);
    expect((await at(futureHistory, STARTED, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    remembered(futureHistory, 'BUG-301', 'implementer', 'claude-opus-5-5', STARTED);
    const implementerBlock = report('role: implementer\nticket: BUG-301\nresult: blocked\nsummary: Needs review\nblockers: [{ text: Needs review, cites: [PRV-002/S3] }]');
    expect((await at(futureHistory, '2026-10-27T12:20:00.000Z', implementerBlock, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(futureHistory.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(futureHistory, 'BUG-301'), 'utf8'))).toEqual({ stage: 'implementer', started: STARTED });

    for (const [prefix, entries] of [
      ['spec-model-s3-wrong-entry-count', 0],
      ['spec-model-s3-missing-entry-count', null],
    ] as const) {
      const stale = gitFixture(prefix, {
        setup: (dir) => {
          const file = join(dir, 'tickets/BUG-301.md');
          const history = '  - { at: "2026-10-27T12:10:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [] }';
          writeFileSync(file, readFileSync(file, 'utf8').replace('history: []', `history:\n${history}`));
        },
      });
      fixtures.push(stale);
      const laterStart = '2026-10-27T12:20:00.000Z';
      expect((await at(stale, laterStart, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
      const startRecord: Record<string, unknown> = { stage: 'implementer', started: laterStart, model: 'claude-sonnet-5-5' };
      if (entries !== null) startRecord.entries = entries;
      writeFileSync(stageFile(stale, 'BUG-301'), JSON.stringify(startRecord));
      const blockedImplementer = report('role: implementer\nticket: BUG-301\nresult: blocked\nsummary: Needs review\nblockers: [{ text: Needs review, cites: [PRV-002/S3] }]');
      expect((await at(stale, '2026-10-27T12:21:00.000Z', blockedImplementer, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
      expect(stale.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('model');
    }

    const otherRole = await startedAs('BUG-301', 'tester', 'spec-model-s3-other-role');
    writeFileSync(stageFile(otherRole, 'BUG-301'), JSON.stringify({ stage: 'implementer', started: STARTED, model: 'claude-opus-5-5' }));
    expect((await at(otherRole, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(otherRole.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('model');
  }, 120_000);

  it('PIP-025/S4 A recording that does not happen keeps the remembered model', async () => {
    const noReport = await startedAs('BUG-301', 'tester', 'spec-model-s4-no-report');
    remembered(noReport, 'BUG-301', 'tester', 'claude-opus-5-5');
    const noReportPath = stageFile(noReport, 'BUG-301');
    const absent = await at(noReport, ENDED, '', 'ticket', 'advance', 'BUG-301');
    expect(absent.code).toBe(2);
    expect(noReport.ticket('BUG-301')).toMatchObject({ stage: 'tester', status: 'in_progress' });
    expect(JSON.parse(readFileSync(noReportPath, 'utf8'))).toMatchObject({ model: 'claude-opus-5-5', entries: 0 });
    expect((await at(noReport, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(noReport.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(noReportPath, 'utf8'))).toEqual({ stage: 'tester', started: STARTED });

    const couldNotRun = gitFixture('spec-model-s4-check-could-not-run', {
      setup: (dir) => {
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.testCommand = 'true';
        writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      },
    });
    fixtures.push(couldNotRun);
    expect((await at(couldNotRun, STARTED, '', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    remembered(couldNotRun, 'BUG-301', 'tester', 'claude-opus-5-5');
    const testerDone = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the test\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    const unchecked = await at(couldNotRun, ENDED, testerDone, 'ticket', 'advance', 'BUG-301');
    expect(unchecked.code).toBe(3);
    expect(couldNotRun.ticket('BUG-301')).toMatchObject({ stage: 'tester', status: 'in_progress' });
    expect(JSON.parse(readFileSync(stageFile(couldNotRun, 'BUG-301'), 'utf8'))).toMatchObject({ model: 'claude-opus-5-5', entries: 0 });
    expect((await at(couldNotRun, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(couldNotRun.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(couldNotRun, 'BUG-301'), 'utf8'))).toEqual({ stage: 'tester', started: STARTED });

    const refused = await startedAs('BUG-301', 'tester', 'spec-model-s4-intake-refused');
    remembered(refused, 'BUG-301', 'tester', 'claude-opus-5-5');
    const wrongRole = report('role: spec-writer\nticket: BUG-301\nresult: blocked\nsummary: Wrong role\nblockers: [{ text: Waiting, cites: [BUG-301] }]');
    const intake = await at(refused, ENDED, wrongRole, 'ticket', 'advance', 'BUG-301', '--report', '-', '--format', 'json');
    expect(intake.code).toBe(1);
    expect(JSON.parse(intake.stdout)).toMatchObject({ status: 'in_progress', attempt: 1 });
    expect(refused.ticket('BUG-301')).toMatchObject({ stage: 'tester', status: 'in_progress' });
    expect(JSON.parse(readFileSync(stageFile(refused, 'BUG-301'), 'utf8'))).toMatchObject({ model: 'claude-opus-5-5', entries: 0 });
    expect((await at(refused, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(refused.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(JSON.parse(readFileSync(stageFile(refused, 'BUG-301'), 'utf8'))).toEqual({ stage: 'tester', started: STARTED });
  }, 120_000);

  it('PIP-025/S5 Only a bounded model and a plain cost are recorded', async () => {
    const invalidModels = [
      '',
      'm'.repeat(101),
      'model\nline',
      'model\ttab',
      'model\u0001control',
      ...invalidModelEdges,
    ];
    for (const [index, model] of invalidModels.entries()) {
      const fx = await startedAs('BUG-301', 'tester', `spec-model-s5-invalid-model-${index}`);
      remembered(fx, 'BUG-301', 'tester', 'claude-opus-5-5');
      const file = transcript([{ type: 'assistant', message: { role: 'assistant', model, content: [] } }]);
      expect((await at(fx, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', file)).code).toBe(0);
      expect(fx.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    }

    const atBound = await startedAs('BUG-301', 'tester', 'spec-model-s5-100-characters');
    remembered(atBound, 'BUG-301', 'tester', 'claude-opus-5-5');
    const oneHundred = 'm'.repeat(100);
    const bounded = transcript([{ type: 'assistant', message: { role: 'assistant', model: oneHundred, content: [] } }]);
    expect((await at(atBound, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', bounded)).code).toBe(0);
    expect(atBound.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: oneHundred });

    const invalidCosts = [
      transcript([{ type: 'result', total_cost_usd: -1 }]),
      rawTranscript('{"type":"result","total_cost_usd":1e400}\n'),
      transcript([{ type: 'result', total_cost_usd: 1_000_000 }]),
      transcript([{ type: 'result', total_cost_usd: '0.42' }]),
    ];
    for (const [index, file] of invalidCosts.entries()) {
      const fx = await startedAs('BUG-301', 'tester', `spec-model-s5-invalid-cost-${index}`);
      remembered(fx, 'BUG-301', 'tester', 'claude-opus-5-5');
      expect((await at(fx, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', file)).code).toBe(0);
      expect(fx.ticket('BUG-301')?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
      expect(fx.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('cost_usd');
    }

    const zero = await startedAs('BUG-301', 'tester', 'spec-model-s5-zero-cost');
    remembered(zero, 'BUG-301', 'tester', 'claude-opus-5-5');
    const zeroCost = transcript([{ type: 'result', total_cost_usd: 0 }]);
    expect((await at(zero, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', zeroCost)).code).toBe(0);
    expect(zero.ticket('BUG-301')?.history.at(-1)).toMatchObject({ cost_usd: 0 });

    const upperBound = await startedAs('BUG-301', 'tester', 'spec-model-s5-cost-below-limit');
    remembered(upperBound, 'BUG-301', 'tester', 'claude-opus-5-5');
    const largestCost = transcript([{ type: 'result', total_cost_usd: 999_999.99 }]);
    expect((await at(upperBound, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301', '--transcript', largestCost)).code).toBe(0);
    expect(upperBound.ticket('BUG-301')?.history.at(-1)).toMatchObject({ cost_usd: 999_999.99 });

    const invalidStart = await startedAs('BUG-301', 'tester', 'spec-model-s5-invalid-start-model');
    remembered(invalidStart, 'BUG-301', 'tester', 'm'.repeat(101));
    expect((await at(invalidStart, ENDED, blockedTester('BUG-301'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect(invalidStart.ticket('BUG-301')?.history.at(-1)).not.toHaveProperty('model');

    const invalidConfigured = gitFixture('spec-model-s5-invalid-config', {
      setup: (dir) => {
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'claude-opüs' } };
        writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      },
    });
    fixtures.push(invalidConfigured);
    const invalidNext = await invalidConfigured.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(invalidNext.code, invalidNext.stderr).toBe(0);
    const invalidEntry = JSON.parse(invalidNext.stdout) as { worktree: string };
    worktrees.push({ fx: invalidConfigured, path: invalidEntry.worktree });
    const invalidStartRecord = JSON.parse(readFileSync(stageFile(invalidConfigured, 'TASK-101'), 'utf8')) as Record<string, unknown>;
    expect(invalidStartRecord).not.toHaveProperty('model');

    const trimmed = gitFixture('spec-model-s5-trimmed-config', {
      setup: (dir) => {
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: ' opus ' } };
        writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      },
    });
    fixtures.push(trimmed);
    const trimmedNext = await trimmed.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(trimmedNext.code, trimmedNext.stderr).toBe(0);
    const trimmedEntry = JSON.parse(trimmedNext.stdout) as { model: string | null; worktree: string };
    expect(trimmedEntry.model).toBe('opus');
    worktrees.push({ fx: trimmed, path: trimmedEntry.worktree });
    expect(JSON.parse(readFileSync(stageFile(trimmed, 'TASK-101'), 'utf8'))).toMatchObject({ model: 'opus' });
  }, 120_000);

  it('PIP-025/S6 Time spent waiting for a test-run turn is in the duration', async () => {
    const fx = gitFixture('spec-model-s6', {
      setup: (dir) => {
        const ticket = join(dir, 'tickets/BUG-301.md');
        const tester = '  - { at: "2026-10-27T11:00:00.000Z", role: tester, result: done, summary: Added the test, verdict: null, assumed: [], mutations: [{ scenario: PRV-002/S3, wrong: "falls back to a third provider when the fallback rate-limits" }] }';
        const source = readFileSync(ticket, 'utf8')
          .replace('changed: []', 'changed: [PRV-002/S3]')
          .replace('history: []', `history:\n${tester}`);
        writeFileSync(ticket, source);
        installBug301ScenarioTest(dir);
        const markers = join(dir, '.git/test-run-markers');
        mkdirSync(join(dir, 'tests'), { recursive: true });
        writeFileSync(join(dir, 'tests/recording-turn.cjs'), [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          "const markers = " + JSON.stringify(markers) + ";",
          "const report = process.argv[2];",
          "function waitForFile(file) {",
          "  if (fs.existsSync(file)) return Promise.resolve();",
          "  return new Promise((resolve) => {",
          "    const watcher = fs.watch(markers, (_event, name) => {",
          "      if (String(name) === path.basename(file) && fs.existsSync(file)) { watcher.close(); resolve(); }",
          "    });",
          "    if (fs.existsSync(file)) { watcher.close(); resolve(); }",
          "  });",
          "}",
          "(async () => {",
          "  fs.mkdirSync(markers, { recursive: true });",
          "  const holder = path.join(markers, 'holder-started');",
          "  if (!fs.existsSync(holder)) {",
          "    fs.writeFileSync(holder, String(process.pid));",
          "    await waitForFile(path.join(markers, 'release-holder'));",
          "  } else {",
          "    fs.writeFileSync(path.join(markers, 'advance-started'), String(process.pid));",
          "    await waitForFile(path.join(markers, 'record-now'));",
          "  }",
          "  fs.writeFileSync(report, JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-002/S3 Fallback provider also rate-limits', status: 'passed' }] }] }));",
          "})().catch((error) => { console.error(error); process.exitCode = 1; });",
        ].join('\n'));
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.testCommand = 'node tests/recording-turn.cjs "{report}"';
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    expect((await at(fx, STARTED, '', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    fx.apply('reference/BUG-301.implementer.patch');
    remembered(fx, 'BUG-301', 'implementer', 'claude-sonnet-5-5');
    const done = report('role: implementer\nticket: BUG-301\nresult: done\nsummary: Implementation ready\nchanged: [PRV-002/S3]');
    const added = await fx.spec('', 'worktree', 'add', 'TASK-101', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const ticketTree = (JSON.parse(added.stdout) as { project: string }).project;
    worktrees.push({ fx, path: ticketTree });
    const markers = join(fx.repo, '.git/test-run-markers');
    const holder = startCliTest(ticketTree);
    await waitForEvent(() => existsSync(join(markers, 'holder-started')), 'the other ticket did not start its test command');

    let clock = '2026-10-27T12:16:00.000Z';
    const readings: string[] = [];
    let notices = '';
    const advancing = run({
      argv: ['ticket', 'advance', 'BUG-301', '--root', join(fx.repo, 'spec')],
      env: {},
      cwd: fx.repo,
      scriptPath: undefined,
      stdin: () => Promise.resolve(done),
      now: () => { readings.push(clock); return clock; },
      stderr: (text) => { notices += text; },
    });
    await waitForEvent(
      () => notices.includes('waiting for a test run to finish') || existsSync(join(markers, 'advance-started')),
      'ticket advance neither waited for the holder nor started its test command',
    );
    const startedBeforeRelease = existsSync(join(markers, 'advance-started'));
    clock = '2026-10-27T12:31:00.000Z';
    writeFileSync(join(markers, 'release-holder'), 'release');
    const holderCode = await holder.done;
    await waitForEvent(() => existsSync(join(markers, 'advance-started')), 'advance test command did not start after the holder released its turn');
    clock = '2026-10-27T12:40:00.000Z';
    writeFileSync(join(markers, 'record-now'), 'record');
    const advanced = await advancing;
    expect(holderCode).toBe(0);
    expect(advanced.code, advanced.stderr).toBe(0);
    expect(startedBeforeRelease).toBe(false);
    expect(notices).toContain('waiting for a test run to finish');
    expect(readings[0]).toBe('2026-10-27T12:16:00.000Z');
    expect(readings.at(-1)).toBe('2026-10-27T12:40:00.000Z');
    expect(fx.ticket('BUG-301')?.history.at(-1)).toMatchObject({ duration_s: 2400 });

    const stats = await fx.spec('', 'stats', 'BUG-301');
    expect(stats.code, stats.stderr).toBe(0);
    const table = stats.stdout.split('\n').filter((line) => line.trim() !== '');
    const ticketRow = table.find((line) => line.startsWith('BUG-301')) ?? '';
    expect(ticketRow).toContain('0:40:00');
    expect(ticketRow).toContain('1/2');
    const implementerRow = table.find((line) => line.trimStart().startsWith('implementer')) ?? '';
    expect(implementerRow).toContain('0:40:00');
    expect(implementerRow).toContain('1/1');
  }, 120_000);

  it('PIP-025/S7 A commit refused after the ticket was updated leaves a model nothing records', async () => {
    const fx = gitFixture('spec-model-s7', {
      setup: (dir) => {
        const ticketPath = join(dir, 'tickets/PROP-201.md');
        const writer = '  - { at: "2026-10-27T11:00:00.000Z", role: spec-writer, result: done, summary: Spec written, verdict: null, assumed: [] }';
        writeFileSync(ticketPath, readFileSync(ticketPath, 'utf8').replace('history: []', 'history:\n' + writer));
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { 'spec-review': 'worker-review' } };
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const built = await fx.spec('', 'build');
    const dirty = fx.git('status', '--porcelain').stdout.trim();
    if (dirty !== '') {
      fx.git('add', '-A');
      fx.git('commit', '-q', '-m', 'generated files current for PROP-114 S7');
    }
    const generatedClean = fx.git('status', '--porcelain').stdout.trim() === '';

    const next = await fx.spec('', 'next', 'PROP-201', '--harness', 'astro', '--format', 'json');
    const entry = JSON.parse(next.stdout) as { action: string; role: string; model: string | null; worktree: string };
    worktrees.push({ fx, path: entry.worktree });
    const startPath = stageFile(fx, 'PROP-201');
    const hook = join(fx.repo, '.git/hooks/pre-commit');
    writeFileSync(hook, "#!/bin/sh\nprintf '%s\\n' 'commits are closed'\nexit 1\n");
    chmodSync(hook, 0o755);

    const reviewReport = report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: Approved\nverdict: approve');
    const failed = await at(fx, ENDED, reviewReport, 'ticket', 'advance', 'PROP-201');
    const ticketPath = join(entry.worktree, 'tickets/PROP-201.md');
    const afterFailed = parseTicket('tickets/PROP-201.md', readFileSync(ticketPath, 'utf8')).ticket?.data;
    const recordAfterFailed = JSON.parse(readFileSync(startPath, 'utf8')) as Record<string, unknown>;

    rmSync(hook, { force: true });
    const testerStart = await run({
      argv: ['ticket', 'start', 'PROP-201', 'tester', '--root', join(entry.worktree, 'spec')],
      env: {},
      cwd: entry.worktree,
      scriptPath: undefined,
      stdin: () => Promise.resolve(''),
      now: () => '2026-10-27T12:21:00.000Z',
    });
    const recordAfterStart = JSON.parse(readFileSync(startPath, 'utf8')) as Record<string, unknown>;
    const testerReport = report('role: tester\nticket: PROP-201\nresult: blocked\nsummary: Waiting for a person\nblockers: [{ text: Waiting for a decision, cites: [PROP-201] }]');
    const testerAdvance = await run({
      argv: ['ticket', 'advance', 'PROP-201', '--root', join(entry.worktree, 'spec')],
      env: {},
      cwd: entry.worktree,
      scriptPath: undefined,
      stdin: () => Promise.resolve(testerReport),
      now: () => '2026-10-27T12:22:00.000Z',
    });
    const afterTester = parseTicket('tickets/PROP-201.md', readFileSync(ticketPath, 'utf8')).ticket?.data;
    const lastTesterRecord = afterTester?.history.at(-1) as Record<string, unknown> | undefined;

    expect({
      generated: { code: built.code, clean: generatedClean },
      next: { code: next.code, action: entry.action, role: entry.role, model: entry.model },
      failed: {
        code: failed.code,
        stderr: failed.stderr.trim(),
        status: afterFailed?.status,
        stage: afterFailed?.stage,
        history: afterFailed?.history.length,
        lastRole: afterFailed?.history.at(-1)?.role,
        record: { stage: recordAfterFailed.stage, model: recordAfterFailed.model, entries: recordAfterFailed.entries },
      },
      testerStart: {
        code: testerStart.code,
        stage: recordAfterStart.stage,
        hasModel: Object.hasOwn(recordAfterStart, 'model'),
      },
      testerAdvance: {
        code: testerAdvance.code,
        role: lastTesterRecord?.['role'],
        result: lastTesterRecord?.['result'],
        hasModel: lastTesterRecord !== undefined && Object.hasOwn(lastTesterRecord, 'model'),
      },
    }).toEqual({
      generated: { code: 0, clean: true },
      next: { code: 0, action: 'delegate', role: 'spec-review', model: 'worker-review' },
      failed: {
        code: 1,
        stderr: 'git commit failed: commits are closed',
        status: 'open',
        stage: null,
        history: 2,
        lastRole: 'spec-review',
        record: { stage: 'spec-review', model: 'worker-review', entries: 1 },
      },
      testerStart: { code: 0, stage: 'tester', hasModel: false },
      testerAdvance: { code: 0, role: 'tester', result: 'blocked', hasModel: false },
    });
  }, 120_000);
});
