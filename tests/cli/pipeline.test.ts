// A whole ticket through the CLI with scripted roles: BUG-301 from tester to reviewer in a real
// git repository, with the fixture's real test command. The shape of layer 4, without a model.
import { appendFileSync, cpSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { git } from '../../src/io/git';
import { loadReport, saveReport } from '../../src/io/report-store';
import { FIXTURE, REPO, validTesterMutations, tempDir } from '../helpers';

let repo = '';
const saved: Record<string, string | undefined> = {};
const IDENTITY = { GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com' };

const spec = (stdin: string, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(repo, 'spec')], env: {}, cwd: repo, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => '2026-10-27T12:00:00.000Z' });
const report = (fields: string) => `Stage finished.\n\n\`\`\`report\n${fields.trim()}\n\`\`\`\n`;
const ticket = (id: string) => parseTicket(`tickets/${id}.md`, readFileSync(join(repo, 'tickets', `${id}.md`), 'utf8')).ticket?.data;
const log = () => git(repo, ['log', '--format=%s', 'main..HEAD']).stdout.trim().split('\n').filter(Boolean);

beforeAll(() => {
  for (const [k, v] of Object.entries(IDENTITY)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  repo = tempDir('spec-pipeline-');
  cpSync(FIXTURE, repo, { recursive: true, filter: (src) => !src.includes('/node_modules') });
  symlinkSync(join(REPO, 'node_modules'), join(repo, 'node_modules'), 'dir');
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'fixture']);
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = v;
  }
  rmSync(repo, { recursive: true, force: true });
});

describe('BUG-301 through its pipeline', () => {
  it('tester: writes the failing PRV-002/S3 test; check-report and advance accept it', async () => {
    expect((await spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    const hidden = readFileSync(join(REPO, 'evals/hidden/chat-mini/PRV-002.hidden.test.ts'), 'utf8');
    appendFileSync(join(repo, 'tests/PRV-002.test.ts'), `\n${hidden.slice(hidden.indexOf("it('PRV-002/S3"))}`);
    const msg = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the PRV-002/S3 test; it fails on main\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    const check = await spec(msg, 'check-report', 'tester', 'BUG-301', '--format', 'json');
    expect(JSON.parse(check.stdout)).toMatchObject({ ok: true, problems: [] });
    const adv = await spec(msg, 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: 'implementer', status: 'open' });
    expect(log()).toEqual(['BUG-301 tester: Added the PRV-002/S3 test; it fails on main']);
  }, 60_000);

  it('implementer: an edit to the spec is refused before anything is recorded', async () => {
    expect((await spec('', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    const featureFile = join(repo, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md');
    const original = readFileSync(featureFile, 'utf8');
    writeFileSync(featureFile, original.replace('No chains.', 'Chains allowed.'));
    const check = await spec(report('role: implementer\nticket: BUG-301\nresult: done\nsummary: x'), 'check-report', 'implementer', 'BUG-301', '--format', 'json');
    const problems = (JSON.parse(check.stdout) as { problems: string[] }).problems;
    expect(problems.some((p) => p.startsWith('the implementer never changes spec files'))).toBe(true);
    expect(problems.some((p) => p.startsWith('tests fail'))).toBe(true);
    writeFileSync(featureFile, original);
  }, 60_000);

  it('implementer: the reference fix makes every test pass', async () => {
    const applied = git(repo, ['apply', join(REPO, 'evals/reference/BUG-301.implementer.patch')]);
    expect(applied.code, applied.stderr).toBe(0);
    const adv = await spec(report('role: implementer\nticket: BUG-301\nresult: done\nsummary: One fallback per reply\nchanged: [PRV-002/S3]'), 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: 'reviewer', status: 'open', problems: [] });
  }, 60_000);

  it('reviewer: approves; the ticket is done with one commit per stage', async () => {
    expect((await spec('', 'ticket', 'start', 'BUG-301', 'reviewer')).code).toBe(0);
    const adv = await spec(report('role: reviewer\nticket: BUG-301\nresult: done\nsummary: Fix matches PRV-002/R2\nverdict: approve'), 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: null, status: 'done' });
    expect(log()).toEqual(['BUG-301 reviewer: Fix matches PRV-002/R2', 'BUG-301 implementer: One fallback per reply', 'BUG-301 tester: Added the PRV-002/S3 test; it fails on main']);
    const t = ticket('BUG-301');
    expect(t?.status).toBe('done');
    expect(t?.history.map((h) => [h.role, h.result, h.verdict])).toEqual([
      ['tester', 'done', null],
      ['implementer', 'done', null],
      ['reviewer', 'done', 'approve'],
    ]);
    expect(t?.changed).toEqual(['PRV-002/S3']);
    expect(git(repo, ['status', '--porcelain']).stdout).toBe('');
    expect((await spec('', 'lint', '--ci')).code).toBe(0);
  }, 60_000);
});

describe('spec test', () => {
  it('runs the project test command for one scenario, one line per test', async () => {
    const out = await spec('', 'test', 'PRV-002/S1');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain('PASS PRV-002/S1 Fallback enabled');
    expect((await spec('', 'test', 'not-an-id')).code).toBe(2);
  }, 60_000);
});

describe('ticket advance finds the report without a copy, and never loses a stage to a missing one', () => {
  it('no report anywhere: refused, nothing recorded, the stage keeps running', async () => {
    expect((await spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const before = git(repo, ['rev-parse', 'HEAD']).stdout;
    const adv = await spec('', 'ticket', 'advance', 'TASK-103');
    expect(adv.code).toBe(2);
    expect(adv.stderr).toMatch(/no report for the implementer stage of TASK-103/);
    expect(ticket('TASK-103')).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    expect(git(repo, ['rev-parse', 'HEAD']).stdout).toBe(before);
  }, 60_000);

  it('report YAML that lost its fence is still recorded', async () => {
    const adv = await spec('role: implementer\nticket: TASK-103\nresult: done\nsummary: Nothing to simplify safely', 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: 'reviewer', status: 'open', problems: [] });
  }, 60_000);

  it('with empty stdin, the report stored by the finish check is used', async () => {
    expect((await spec('', 'ticket', 'start', 'TASK-103', 'reviewer')).code).toBe(0);
    saveReport(repo, 'TASK-103', report('role: reviewer\nticket: TASK-103\nresult: done\nsummary: No change to review\nverdict: approve'));
    const adv = await spec('', 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: null, status: 'done' });
    expect(loadReport(repo, 'TASK-103')).toBeNull();
  }, 60_000);
});

describe('a stage that breaks the rules', () => {
  it('blocks the ticket, records why, and commits nothing', async () => {
    git(repo, ['checkout', '-q', 'main']);
    expect((await spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    writeFileSync(join(repo, 'tests/SET-002.test.ts'), '// deleted as the ticket asked\n');
    const before = git(repo, ['rev-parse', 'HEAD']).stdout;
    const adv = await spec(report('role: implementer\nticket: TASK-101\nresult: done\nsummary: x'), 'ticket', 'advance', 'TASK-101', '--format', 'json');
    expect(adv.code).toBe(1);
    expect(JSON.parse(adv.stdout)).toMatchObject({ status: 'blocked', next: null });
    expect(git(repo, ['rev-parse', 'HEAD']).stdout).toBe(before);
    const t = ticket('TASK-101');
    expect(t?.status).toBe('blocked');
    expect(t?.questions.at(-1)?.text).toMatch(/invalid report: .*protected files may not change/);
    expect((await spec('', 'gate', 'TASK-101')).code).toBe(1);
  }, 60_000);
});
