// PIP-018: accept a stage's final message from the main session without a finish hook.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect } from 'vitest';
import { partitionedDescribe, partitionedIt } from './partitioned-it';
const describe = partitionedDescribe(2, 'ticket advance report intake');
const it = partitionedIt(2);
import { parseArgs } from '../../src/cli/args';
import { cmdAdvance } from '../../src/cli/report';
import { run } from '../../src/cli/run';
import { loadWorkspace } from '../../src/io/workspace';
import { gitFixture, report } from '../helpers';

const fixtures: ReturnType<typeof gitFixture>[] = [];
const worktrees: { fx: ReturnType<typeof gitFixture>; path: string }[] = [];
afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
});

async function started() {
  const fx = gitFixture('spec-report-intake');
  fixtures.push(fx);
  expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
  return fx;
}

async function delegated(prefix: string) {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const path = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      config.worktreeSetup = 'ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules';
      writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
    },
  });
  fixtures.push(fx);
  const out = await fx.spec('', 'next', 'TASK-101', '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  const entry = JSON.parse(out.stdout) as { worktree: string };
  worktrees.push({ fx, path: entry.worktree });
  return { fx, worktree: entry.worktree };
}

const valid = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Kept the implementation unchanged');

describe('ticket advance report intake', () => {
  it('PIP-018/S1 next, edit, and report-file advance commit in the ticket worktree from either checkout', async () => {
    for (const fromPrimary of [true, false]) {
      const { fx, worktree } = await delegated(fromPrimary ? 'spec-report-primary' : 'spec-report-worktree');
      const code = join(worktree, 'src/session-delegation-review.test.ts');
      writeFileSync(code, '// A harmless code edit made by the delegated stage.\n');
      const reportPath = join(fx.repo, '.git/final-report.md');
      writeFileSync(reportPath, valid);
      const root = fromPrimary ? join(fx.repo, 'spec') : join(worktree, 'spec');
      const cwd = fromPrimary ? join(fx.repo, 'src') : worktree;
      const fileArg = fromPrimary ? '.git/final-report.md' : reportPath;
      const advanced = await run({
        argv: ['ticket', 'advance', 'TASK-101', '--report-file', fileArg, '--format', 'json', '--root', root],
        env: {},
        cwd,
        scriptPath: undefined,
        now: () => '2026-10-30T12:00:00.000Z',
      });
      expect(advanced.code, advanced.stderr).toBe(0);
      expect(JSON.parse(advanced.stdout)).toMatchObject({ ticket: 'TASK-101', next: 'reviewer', status: 'open' });
      expect(fx.git('-C', worktree, 'branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
      expect(fx.git('-C', worktree, 'log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101 implementer: Kept the implementation unchanged');
      expect(fx.git('-C', worktree, 'show', '--pretty=', '--name-only', 'HEAD').stdout).toContain('src/session-delegation-review.test.ts');
    }
  }, 120_000);

  it('PIP-018/S1 refuses a redirected workspace that is detached from the ticket branch', async () => {
    const { fx, worktree } = await delegated('spec-report-detached');
    fx.git('-C', worktree, 'checkout', '--detach');
    const ws = await loadWorkspace(join(worktree, 'spec'), null, worktree);
    const result = await cmdAdvance(ws, parseArgs(['ticket', 'advance', 'TASK-101']), '', () => '2026-10-30T12:00:00.000Z', worktree, true);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('does not own ticket/TASK-101');
    expect(result.stderr).toContain('detached or on another branch');
  }, 60_000);

  it('PIP-018/S1 reads a final message from --report-file, checks it, and advances', async () => {
    const fx = await started();
    const path = join(fx.repo, '.git', 'final.md');
    const transcript = join(fx.repo, '.git', 'agent.jsonl');
    writeFileSync(path, valid);
    writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', model: 'test-model', content: 'done' } })}\n${JSON.stringify({ type: 'result', total_cost_usd: 0.02 })}\n`);
    const out = await fx.spec('', 'ticket', 'advance', 'TASK-101', '--report-file', '.git/final.md', '--transcript', transcript, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', next: 'reviewer', status: 'open' });
    expect(fx.ticket('TASK-101')?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'done', model: 'test-model', cost_usd: 0.02 });
    expect(existsSync(join(fx.repo, '.git', 'spec', 'reports', 'TASK-101.md'))).toBe(false);
  }, 120_000);

  it('PIP-018/S5 reads a final message from --report -', async () => {
    const fx = await started();
    const out = await fx.spec(valid, 'ticket', 'advance', 'TASK-101', '--report', '-');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.ticket('TASK-101')?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'done' });
  }, 120_000);

  it('PIP-018/S2 refuses a report naming another ticket without saving it there', async () => {
    const fx = await started();
    const wrong = report('role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Waiting\nblockers: [{ text: Need a person, cites: [conversation.Message] }]');
    const out = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('attempt 1 of 3');
    expect(out.stderr).toContain('this run is TASK-101, the report names TASK-103');
    expect(fx.ticket('TASK-101')?.stage).toBe('implementer');
    expect(existsSync(join(fx.repo, '.git', 'spec', 'reports', 'TASK-103.md'))).toBe(false);
  }, 60_000);

  it('PIP-018/S3 returns problems and attempt numbers 1 and 2 to the running stage', async () => {
    const fx = await started();
    const wrong = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    for (const attempt of [1, 2]) {
      const out = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
      expect(out.code).toBe(1);
      const result = JSON.parse(out.stdout) as { ticket: string; status: string; attempt: number; problems: string[] };
      expect(result).toMatchObject({ ticket: 'TASK-101', status: 'in_progress', attempt });
      expect(result.problems[0]).toContain('the report says role tester, but this stage is implementer');
      expect(fx.ticket('TASK-101')?.stage).toBe('implementer');
    }
  }, 60_000);

  it('PIP-018/S4 keeps the third refused message and blocks on its problems', async () => {
    const fx = await started();
    const wrong = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-');
    await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-');
    const out = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', status: 'blocked', attempt: 3 });
    expect(fx.ticket('TASK-101')?.status).toBe('blocked');
    expect(fx.ticket('TASK-101')?.questions.at(-1)?.text).toContain('the report says role tester, but this stage is implementer');
    expect(out.stdout).toContain('attempt');
  }, 60_000);

  it('PIP-018/S7 starts a new stage with a fresh refusal budget', async () => {
    const fx = await started();
    const badImplementer = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    const first = await fx.spec(badImplementer, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(JSON.parse(first.stdout)).toMatchObject({ attempt: 1 });
    const implementerDone = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Implementer finished');
    expect((await fx.spec(implementerDone, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'reviewer')).code).toBe(0);
    const reviewerChanges = report('role: reviewer\nticket: TASK-101\nresult: done\nsummary: Split the implementation\nverdict: changes\nfindings: [{ cites: [PRV-001/S1], text: Split the helper, class: C6 }]');
    expect((await fx.spec(reviewerChanges, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    const restarted = await fx.spec(badImplementer, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(JSON.parse(restarted.stdout)).toMatchObject({ attempt: 1, status: 'in_progress' });
  }, 120_000);

  it('PIP-018/S8 keeps the refusal count when the running stage is restarted', async () => {
    const fx = await started();
    const wrong = report('role: tester\\nticket: TASK-101\\nresult: done\\nsummary: Incorrect role');
    const first = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(JSON.parse(first.stdout)).toMatchObject({ attempt: 1, status: 'in_progress' });
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    const second = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(JSON.parse(second.stdout)).toMatchObject({ attempt: 2, status: 'in_progress' });
  }, 60_000);

  it('PIP-018/S9 The recorded stage keeps how many of its reports were refused', async () => {
    const wrong = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    // Two refused intakes, then a valid report: the done record holds refusals 2 (R7).
    const fx = await started();
    for (const attempt of [1, 2]) {
      const refused = await fx.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
      expect(JSON.parse(refused.stdout), `attempt ${attempt}`).toMatchObject({ attempt });
    }
    writeFileSync(join(fx.repo, 'final-report.md'), valid);
    const done = await fx.spec('', 'ticket', 'advance', 'TASK-101', '--report-file', 'final-report.md');
    expect(done.code, done.stderr).toBe(0);
    expect(fx.ticket('TASK-101')?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'done', refusals: 2 });
    // The third intake refused too: the blocked record it makes holds refusals 3 (R3, R7).
    const blocked = await started();
    for (let i = 0; i < 3; i++) await blocked.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-');
    expect(blocked.ticket('TASK-101')?.status).toBe('blocked');
    expect(blocked.ticket('TASK-101')?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'blocked', refusals: 3 });
    // A stage whose first report was recorded has no refusals key.
    const clean = await started();
    expect((await clean.spec(valid, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    expect(clean.ticket('TASK-101')?.history.at(-1)).not.toHaveProperty('refusals');
    // A stage started anew after a refusal counts from 0: the new record has no key (R5).
    const again = await started();
    expect(JSON.parse((await again.spec(wrong, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json')).stdout)).toMatchObject({ attempt: 1 });
    expect((await again.spec(valid, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    expect(again.ticket('TASK-101')?.history.at(-1)).toMatchObject({ result: 'done', refusals: 1 });
    expect((await again.spec('', 'ticket', 'start', 'TASK-101', 'reviewer')).code).toBe(0);
    const changes = report('role: reviewer\nticket: TASK-101\nresult: done\nsummary: Split the implementation\nverdict: changes\nfindings: [{ cites: [PRV-001/S1], text: Split the helper, class: C6 }]');
    expect((await again.spec(changes, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    expect((await again.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    expect((await again.spec(valid, 'ticket', 'advance', 'TASK-101', '--report', '-')).code).toBe(0);
    const anew = again.ticket('TASK-101')?.history.at(-1);
    expect(anew).toMatchObject({ role: 'implementer', result: 'done' });
    expect(anew).not.toHaveProperty('refusals');
  }, 180_000);

  it('PIP-018/S6 advances from a report file supplied by the main session', async () => {
    const fx = await started();
    writeFileSync(join(fx.repo, 'final-report.md'), valid);
    const advanced = await fx.spec('', 'ticket', 'advance', 'TASK-101', '--report-file', 'final-report.md');
    expect(advanced.code, advanced.stderr).toBe(0);
    expect(fx.ticket('TASK-101')?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'done' });
  }, 120_000);
});
