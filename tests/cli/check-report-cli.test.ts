// PIP-004 S2, S3, S17 and PIP-006 S9, through the CLI on a throwaway copy of chat-mini.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, report } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const PASSING = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'PRV-001/S1 Streams tokens', status: 'passed' }] }] });

async function implementerStage(testCommand: string | null, tweak: (dir: string) => void = () => {}): Promise<Fx> {
  const fx = gitFixture('spec-check-report-cli', {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = testCommand ?? 'false';
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      writeFileSync(join(dir, 'test-report.json'), PASSING);
      tweak(dir);
    },
  });
  made.push(fx);
  expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
  return fx;
}

const done = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection\nchanged: [PRV-001/S1]');

describe('check-report through the CLI', () => {
  it('PIP-004/S2 A refused stage', async () => {
    const fx = await implementerStage('cp test-report.json "{report}"');
    const out = await fx.spec(report('role: implementer\nticket: TASK-101\nresult: done\nsummary: x\nverdict: approve'), 'check-report', 'implementer', 'TASK-101');
    expect(out.code).toBe(1);
    expect(out.stdout).toMatch(/^report rejected:\n(- .+\n?)+$/);
    expect(out.stdout).toContain('- only the reviewer and the spec review set verdict and findings');
  }, 120_000);

  it('PIP-004/S3 JSON output', async () => {
    const fx = await implementerStage('cp test-report.json "{report}"');
    writeFileSync(join(fx.repo, 'src/providers/select.ts'), 'export const select = 1;\n');
    const out = await fx.spec(done, 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ok: true, problems: [], report: { role: 'implementer', ticket: 'TASK-101', result: 'done', changed: ['PRV-001/S1'] } });
    const text = await fx.spec(done, 'check-report', 'implementer', 'TASK-101');
    expect(text.stdout).toBe('report ok\n');
    expect(text.code).toBe(0);
  }, 120_000);

  it('PIP-004/S17 Unknown role or ticket', async () => {
    const fx = await implementerStage('cp test-report.json "{report}"');
    const role = await fx.spec(done, 'check-report', 'boss', 'TASK-101');
    expect(role.code).toBe(2);
    expect(role.stderr).toContain('Unknown role boss. Roles: spec-writer, spec-review, tester, implementer, reviewer');
    const ticket = await fx.spec(done, 'check-report', 'implementer', 'TASK-999');
    expect(ticket.code).toBe(2);
    expect(ticket.stderr.startsWith('Unknown TASK-999.')).toBe(true);
  }, 120_000);

  it('PIP-006/S9 The test command gave no results', async () => {
    const fx = await implementerStage('false');
    const problems = (JSON.parse((await fx.spec(done, 'check-report', 'implementer', 'TASK-101', '--format', 'json')).stdout) as { problems: string[] }).problems;
    const test = problems.filter((p) => p.includes('test command'));
    expect(test).toHaveLength(1);
    expect(test[0]?.startsWith('the test command gave no results: ')).toBe(true);

    // With no config at all, the reason is that config.json has no testCommand.
    const bare = await implementerStage(null);
    rmSync(join(bare.repo, 'spec/config.json'));
    const bareProblems = (JSON.parse((await bare.spec(done, 'check-report', 'implementer', 'TASK-101', '--format', 'json')).stdout) as { problems: string[] }).problems;
    expect(bareProblems.filter((p) => p.startsWith('the test command'))).toEqual(['the test command gave no results: config.json has no testCommand']);
  }, 120_000);
});
