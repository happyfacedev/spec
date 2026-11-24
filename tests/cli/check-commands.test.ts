// PIP-006/R7: check-report runs format.Config.checkCommands for a done tester or implementer stage.
// Each test builds a throwaway copy of chat-mini whose config holds the commands under test, and
// whose test command copies a report this file writes (as in test-names.test.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, report, validTesterMutations } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const results = (...tests: [string, 'passed' | 'failed'][]) =>
  JSON.stringify({ testResults: [{ assertionResults: tests.map(([title, status]) => ({ title, status })) }] });

const TESTER_RESULTS = results(['CNV-001/S1 Send to active provider', 'failed'], ['CNV-001/S2 Active provider disabled', 'passed']);
const IMPLEMENTER_RESULTS = results(['CNV-001/S1 Send to active provider', 'passed'], ['CNV-001/S2 Active provider disabled', 'passed']);

/** A chat-mini copy with the check commands set, `ticket` started in `role`, and the test run's results in place. */
async function stage(ticket: string, role: string, checkCommands: string[] | undefined, runnerReport: string): Promise<Fx> {
  const fx = gitFixture('spec-check-commands', {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = 'cp test-report.json "{report}"';
      // `{repo}` in a command is the fixture's root, so a command can print absolute paths.
      if (checkCommands) cfg.checkCommands = checkCommands.map((command) => command.replaceAll('{repo}', dir));
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      writeFileSync(join(dir, 'test-report.json'), runnerReport);
      // A proposal reaches its tester only after its spec-writer and spec-review stages.
      if (role === 'tester' && ticket.startsWith('PROP-')) {
        const file = join(dir, 'tickets', `${ticket}.md`);
        const entry = '  - { at: "2026-10-28T10:00:00.000Z", role: spec-writer, result: done, summary: spec, verdict: null, assumed: [] }';
        const review = '  - { at: "2026-10-28T10:05:00.000Z", role: spec-review, result: done, summary: ok, verdict: approve, assumed: [] }';
        writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${entry}\n${review}`));
      }
    },
  });
  made.push(fx);
  expect((await fx.spec('', 'ticket', 'start', ticket, role)).code).toBe(0);
  return fx;
}

const check = async (fx: Fx, role: string, ticket: string, message: string) =>
  JSON.parse((await fx.spec(message, 'check-report', role, ticket, '--format', 'json')).stdout) as { ok: boolean; problems: string[] };

const tester = report('role: tester\nticket: PROP-205\nresult: done\nsummary: Tests for CNV-001\n' + validTesterMutations('CNV-001/S1'));
const implementer = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection');

describe('PIP-006: check commands', () => {
  it("PIP-006/S19 A lint error in a tester's own test file is refused", async () => {
    const cmd = "echo 'tests/CNV-001.test.ts:12 no-unused-vars'; exit 1";
    const fx = await stage('PROP-205', 'tester', [cmd], TESTER_RESULTS);
    expect((await check(fx, 'tester', 'PROP-205', tester)).problems).toEqual([
      `${cmd} fails on tests/CNV-001.test.ts: tests/CNV-001.test.ts:12 no-unused-vars; fix it before the implementer starts`,
    ]);

    // The same failure printed as ESLint does: the absolute path alone on a line, the position on the next.
    const absoluteCmd = "echo '{repo}/tests/CNV-001.test.ts'; echo '  12:5  error  no-unused-vars'; exit 1";
    const absolute = await stage('PROP-205', 'tester', [absoluteCmd], TESTER_RESULTS);
    expect((await check(absolute, 'tester', 'PROP-205', tester)).problems).toEqual([
      `${absoluteCmd.replaceAll('{repo}', absolute.repo)} fails on tests/CNV-001.test.ts: ${absolute.repo}/tests/CNV-001.test.ts; fix it before the implementer starts`,
    ]);
  }, 120_000);

  it('PIP-006/S20 A failure outside the test files does not refuse the tester', async () => {
    const fx = await stage('PROP-205', 'tester', ["echo 'src/app.ts:3 no-unused-vars'; exit 1"], TESTER_RESULTS);
    expect(await check(fx, 'tester', 'PROP-205', tester)).toMatchObject({ ok: true, problems: [] });
  }, 120_000);

  it('PIP-006/S21 An implementer is refused when any check command fails', async () => {
    const lint = 'echo lint ok';
    const typecheck = "echo 'src/app.ts:3 type error'; echo e2; echo e3; echo e4; echo e5; echo e6; exit 1";
    const fx = await stage('TASK-101', 'implementer', [lint, typecheck], IMPLEMENTER_RESULTS);
    expect((await check(fx, 'implementer', 'TASK-101', implementer)).problems).toEqual([`${typecheck} fails (exit 1): src/app.ts:3 type error; e2; e3; e4; e5`]);
  }, 120_000);

  it('PIP-006/S22 Without checkCommands nothing changes', async () => {
    const none = await stage('TASK-101', 'implementer', undefined, IMPLEMENTER_RESULTS);
    expect(await check(none, 'implementer', 'TASK-101', implementer)).toMatchObject({ ok: true, problems: [] });

    // A blocked report runs no command, even with commands configured.
    const fx = await stage('TASK-101', 'implementer', ['touch ran.marker; exit 1'], IMPLEMENTER_RESULTS);
    const blocked = report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Stuck\nblockers:\n  - text: unknown\n    cites: [TASK-101]');
    expect(await check(fx, 'implementer', 'TASK-101', blocked)).toMatchObject({ ok: true, problems: [] });
    expect(existsSync(join(fx.repo, 'ran.marker'))).toBe(false);
  }, 120_000);
});
