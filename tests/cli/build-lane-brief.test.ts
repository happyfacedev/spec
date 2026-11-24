// PROP-116: what the build lane tells each role (PIP-012/S30, PIP-014/S10, PIP-017/S22, PIP-019/S4), how
// stats counts it (PIP-020/S7) and how its hooks run (INS-020/S24 is in build-lane-hooks.test.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { expandRole } from '../../src/core/roles';
import { REPO, gitFixture } from '../helpers';
import { buildStage, cleanupAll, firstStageThenChanges, plainFixture, rec, resetRuns, safeJson, ticketText, type Fx } from './build-lane-fixture';

const worktrees: { fx: Fx; path: string }[] = [];
const fixtures: Fx[] = [];
afterAll(() => {
  cleanupAll();
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
});

const BUILD_RULE =
  "Type proposal, build lane: the spec changes first and the spec review checks it; then the implementer writes the tests and the code in one stage, and the tester does not run. In this lane the implementer changes test files too, whatever its prompt says. With only the test files on the code as it was before the build, each new or changed scenario needs a test that fails on an assertion; with the code, every test must pass. The implementer names a wrong implementation for each such scenario under mutations: as { scenario, wrong }, and the reviewer checks some of those it recorded. If the work needs stubs, or a tester's own reading of the scenarios, put lane: full in your report, and the ticket moves to the full lane: from the implementer, its changes are stashed and the tester runs next; from any other role, it goes on from your stage.";
const FULL_RULE = 'Type proposal: the spec changes first; then tests are written against the new spec, and fail; then the code changes until they pass.';
const BUILD_LINE = 'Write a test for each and the code that makes it pass, in this stage. With only the test files on the code as it was before the build, each must have a test that fails on an assertion; then every test must pass.';
const FULL_IMPLEMENTER_LINE = "The tester's tests for these fail now. Change the code until every test passes, and replace any stub marked SPEC-STUB; do not change any test file.";

const group = (brief: string, title: string): string => new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(brief)?.[1] ?? '';

describe('PIP-012/S30 The rule for a proposal in a light lane', () => {
  it('PIP-012/S30 the build lane\'s rule, and the full lane\'s once a record has moved the ticket there', async () => {
    const fx = plainFixture('brief-s30', {
      'PROP-215': ticketText('PROP-215', 'build'),
      'PROP-217': ticketText('PROP-217', 'build', [rec('spec-writer', { extra: ', lane: full' })]),
    });
    const brief = async (role: string, id: string) => (await fx.spec('', 'brief', role, id)).stdout;
    for (const role of ['spec-writer', 'tester', 'implementer', 'reviewer']) {
      const text = await brief(role, 'PROP-215');
      expect(text, `${role} build`).toContain(BUILD_RULE);
      expect(text, `${role} build`).not.toContain(FULL_RULE);
    }
    const moved = await brief('tester', 'PROP-217');
    expect(moved).toContain(FULL_RULE);
    expect(moved).not.toContain('Type proposal, build lane: ');
  }, 120_000);
});

describe('PIP-014/S10 A build stage is told to write tests and code', () => {
  it('PIP-014/S10 A build stage is told to write tests and code', async () => {
    const c = await buildStage('brief-s10', { documents: ['SET-001/S4'], removeS3: true, stopBefore: 'implementer' });
    const brief = async (role: string) => (await c.fx.spec('', 'brief', role, c.id)).stdout;
    const implementer = group(await brief('implementer'), 'New in the spec');
    expect(implementer).toContain(BUILD_LINE);
    expect(implementer).not.toContain('do not change any test file');
    expect(implementer).toContain('- PRV-001/S4 Streams from gemini (added)');
    expect(implementer).toContain('- SET-001/S4 Enable gemini (added; documents current behaviour, so its test must pass on the code before the build)');
    expect(implementer.trimEnd().endsWith('Removed from the spec: SET-001/S3. Delete their tests: a test must name a scenario the spec has. Remove the behaviour they described, unless another scenario still needs it.')).toBe(true);

    // The brief of every later build stage says the same.
    await c.fx.spec('', 'ticket', 'start', c.id, 'implementer');
    c.fx.apply('reference/PROP-201.tester.patch');
    c.fx.apply('reference/PROP-201.implementer.patch');
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    resetRuns(c);
    await firstStageThenChanges(c);
    expect(group(await brief('implementer'), 'New in the spec')).toBe(implementer);

    // Once the ticket has left the build lane, the implementer's group is the full lane's, and a tester's keeps the documented lines.
    const gave = await buildStage('brief-s10-full', { documents: ['SET-001/S4'], removeS3: true });
    const out = await gave.fx.spec(gave.implementer({ lane: 'full', mutations: null }), 'ticket', 'advance', gave.id, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const full = group((await gave.fx.spec('', 'brief', 'implementer', gave.id)).stdout, 'New in the spec');
    expect(full).toContain(FULL_IMPLEMENTER_LINE);
    expect(full).not.toContain(BUILD_LINE);
    const tester = group((await gave.fx.spec('', 'brief', 'tester', gave.id)).stdout, 'New in the spec');
    expect(tester).toContain('- SET-001/S4 Enable gemini (added; documents current behaviour, so its test must pass now)');
  }, 300_000);
});

describe('PIP-017/S22 A build stage\'s task is the implementer\'s, with mutations in its form', () => {
  type Entry = { role: string; model: string | null; worktree: string; task: string };
  const approved = [rec('spec-writer', { extra: ', lane: build' }), rec('spec-review')];

  async function next(prefix: string, id: string, o: { thisVersion: boolean; history?: string[]; models?: boolean }): Promise<{ entry: Entry | undefined; fx: Fx; code: number | null; stderr: string }> {
    const fx = gitFixture(prefix, {
      setup: (dir) => {
        if (o.thisVersion) {
          const shared = readFileSync(join(REPO, 'roles/_shared.md'), 'utf8');
          const prompt = expandRole(readFileSync(join(REPO, 'roles/implementer.md'), 'utf8'), shared);
          if (prompt === null) throw new Error('roles/implementer.md does not expand');
          writeFileSync(join(dir, 'spec/roles/implementer.md'), prompt);
        }
        writeFileSync(join(dir, 'tickets/PROP-215.md'), ticketText('PROP-215', 'build', o.history ?? approved));
      },
    });
    fixtures.push(fx);
    if (o.models === true) {
      for (const [role, model] of [['implementer', 'sonnet'], ['tester', 'opus'], ['reviewer', 'opus']] as const) {
        const set = await fx.spec('', 'config', 'set', `delegation.claude-code.${role}`, model, '--local');
        expect(set.code, set.stderr).toBe(0);
      }
    }
    const out = await fx.spec('', 'next', id, ...(o.models === true ? ['--harness', 'claude-code'] : []), '--format', 'json');
    const entry = safeJson<Entry>(out.stdout);
    if (entry?.worktree !== undefined) worktrees.push({ fx, path: entry.worktree });
    return { entry, fx, code: out.code, stderr: out.stderr };
  }
  const form = (entry: Entry | undefined) => (/```report\n([\s\S]*?)\n```/.exec(entry?.task ?? '')?.[1] ?? '').split('\n');
  const prose = (entry: Entry | undefined) => ((entry?.task ?? '').split('\n## Working folder\n')[0] ?? '').split('```report')[0] ?? '';

  it('PIP-017/S22 A build stage\'s task is the implementer\'s, with mutations in its form', async () => {
    const { entry, code, stderr } = await next('brief-s22', 'PROP-215', { thisVersion: true, models: true });
    expect(code, stderr).toBe(0);
    expect(entry?.role).toBe('implementer');
    expect(entry?.model).toBe('sonnet');
    // The task's brief starts with the build lane's rule.
    const task = entry?.task ?? '';
    const ticket = group(task.slice(task.indexOf('## Ticket')), 'Ticket');
    expect(ticket).toContain(BUILD_RULE);
    // The role prompt says that, with the build lane named in the rule, the implementer writes the tests too.
    const text = prose(entry);
    expect(text).toContain('You are the implementer.');
    expect(text).toMatch(/build lane/);
    expect(text).toMatch(/tests? too|test files too|writes? the tests/i);
    // The report block holds "mutations: []" on the line after its "changed:" line.
    const lines = form(entry);
    const at = lines.findIndex((l) => l.startsWith('changed:'));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at + 1]).toMatch(/^mutations: \[\]/);

    // With a project prompt that predates the build lane, the role prompt is the project's with only what R6, R10 and R11 add.
    const old = await next('brief-s22-old', 'PROP-215', { thisVersion: false });
    const file = join(old.fx.repo, 'spec/roles/implementer.md');
    const before = readFileSync(file, 'utf8');
    const firstLine = before.split('\n').find((l) => l.trim() !== '') ?? before;
    expect(old.entry?.task).toContain(firstLine);
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(prose(old.entry)).not.toMatch(/build lane/);
    const oldForm = form(old.entry);
    const oldAt = oldForm.findIndex((l) => l.startsWith('changed:'));
    expect(oldAt).toBeGreaterThanOrEqual(0);
    expect(oldForm[oldAt + 1]).toMatch(/^mutations: \[\]/);

    // An implementer task outside the build lane holds no "mutations:" line.
    const task101 = await next('brief-s22-task', 'TASK-101', { thisVersion: true });
    expect(task101.entry?.role).toBe('implementer');
    expect(form(task101.entry).some((l) => l.startsWith('mutations:'))).toBe(false);
  }, 300_000);
});

describe('PIP-019/S4 The tester names what each test catches, and the reviewer checks it', () => {
  it('PIP-019/S4 the reviewer\'s prompt takes the mutations of the done build stages too', async () => {
    const reviewing = [rec('spec-writer', { extra: ', lane: build' }), rec('spec-review'), rec('implementer', { extra: ', mutations: [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider" }]' })];
    const fx = gitFixture('brief-s4', {
      setup: (dir) => {
        const shared = readFileSync(join(REPO, 'roles/_shared.md'), 'utf8');
        const prompt = expandRole(readFileSync(join(REPO, 'roles/reviewer.md'), 'utf8'), shared);
        if (prompt === null) throw new Error('roles/reviewer.md does not expand');
        writeFileSync(join(dir, 'spec/roles/reviewer.md'), prompt);
        writeFileSync(join(dir, 'tickets/PROP-215.md'), ticketText('PROP-215', 'build', reviewing));
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'PROP-215', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = safeJson<{ role: string; worktree: string; task: string }>(out.stdout);
    if (entry?.worktree !== undefined) worktrees.push({ fx, path: entry.worktree });
    expect(entry?.role).toBe('reviewer');
    const text = ((entry?.task ?? '').split('\n## Working folder\n')[0] ?? '').split('```report')[0] ?? '';
    const takes = text.split('\n').filter((line) => /mutations/.test(line));
    expect(text, takes.join('\n')).toMatch(/build lane[^.]*implementer/i);
    expect(takes.some((line) => /since the latest done spec-writer/i.test(line))).toBe(true);
    expect(text).toMatch(/at random/);
    expect(text).toContain('tests: true');
  }, 120_000);
});

describe('PIP-020/S7 A proposal in a light lane', () => {
  it('PIP-020/S7 a build-lane proposal has the minimum 4, and 5 once it has left the lane', async () => {
    const done = [rec('spec-writer', { extra: ', lane: build' }), rec('spec-review'), rec('implementer'), rec('reviewer', { verdict: 'approve' })];
    const left = [rec('spec-writer', { extra: ', lane: build' }), rec('spec-review'), rec('implementer', { extra: ', lane: full' }), rec('tester'), rec('implementer'), rec('reviewer', { verdict: 'approve' })];
    const fx = plainFixture('brief-s7', {
      'PROP-215': ticketText('PROP-215', 'build', done),
      'PROP-219': ticketText('PROP-219', 'build', left),
    });
    const json = await fx.spec('', 'stats', 'PROP-215', 'PROP-219', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const stats = safeJson<{ tickets: { id: string; minimum: number }[] }>(json.stdout);
    expect(stats?.tickets.map((t) => [t.id, t.minimum])).toEqual([['PROP-215', 4], ['PROP-219', 5]]);
    const text = await fx.spec('', 'stats', 'PROP-215', 'PROP-219');
    const row = (id: string) => (text.stdout.split('\n').find((l) => l.startsWith(id)) ?? '').trim().split(/\s{2,}/).slice(0, 2);
    expect(row('PROP-215')).toEqual(['PROP-215', '4/4']);
  }, 120_000);
});
