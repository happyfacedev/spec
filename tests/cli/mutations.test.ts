// PIP-019 through the CLI: check-report asks a done tester for a wrong implementation per changed
// scenario, `spec ticket advance` keeps them in the stage record, and `spec next` gives the tester
// and the reviewer prompts that ask for and check them.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { expandRole } from '../../src/core/roles';
import { REPO, approveSpecReview, gitFixture, report, testerMutations, validSpecWriterChecklist, validTesterMutations } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
const worktrees: { fx: Fx; path: string }[] = [];
afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
});
const fresh = (prefix: string, opts: Parameters<typeof gitFixture>[1] = {}): Fx => {
  const fx = gitFixture(prefix, opts);
  fixtures.push(fx);
  return fx;
};

const json = async (fx: Fx, stdin: string, ...argv: string[]) => JSON.parse((await fx.spec(stdin, ...argv, '--format', 'json')).stdout) as { problems: string[]; next: string | null; status: string };
const record = (fx: Fx, id: string) => (fx.ticket(id)?.history.at(-1) ?? {}) as Record<string, unknown>;
const none = (id: string) => `the report names no wrong implementation for ${id}; add { scenario: ${id}, wrong: "<a plausible wrong implementation its test fails against>" } under mutations`;
const tester = (id: string, summary: string, extra: string) => report(`role: tester\nticket: ${id}\nresult: done\nsummary: ${summary}\n${extra}`);

describe('PIP-019 mutations in a tester stage', () => {
  it('PIP-019/S1 A tester report that names no wrong implementation for a changed scenario is refused', async () => {
    const fx = fresh('spec-mutations-bug');
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    const hidden = readFileSync(join(REPO, 'evals/hidden/chat-mini/PRV-002.hidden.test.ts'), 'utf8');
    appendFileSync(join(fx.repo, 'tests/PRV-002.test.ts'), `\n${hidden.slice(hidden.indexOf("it('PRV-002/S3"))}`);

    // BUG-301 violates PRV-002/S3: a done report with no mutations gives that problem, and advance records nothing.
    const bare = tester('BUG-301', 'Added the PRV-002/S3 test', 'changed: [PRV-002/S3]');
    expect((await json(fx, bare, 'check-report', 'tester', 'BUG-301')).problems).toEqual([none('PRV-002/S3')]);

    // A mutation with no wrong gives the only problem, starting "report mutations.0: ".
    const noWrong = tester('BUG-301', 'Added the PRV-002/S3 test', 'mutations: [{ scenario: PRV-002/S3 }]');
    const problems = (await json(fx, noWrong, 'check-report', 'tester', 'BUG-301')).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]?.startsWith('report mutations.0: ')).toBe(true);

    // Advance refuses the bare report too, and records no done tester stage.
    const refused = await fx.spec(bare, 'ticket', 'advance', 'BUG-301');
    expect(refused.code).toBe(1);
    expect(fx.ticket('BUG-301')?.history.some((h) => h.role === 'tester' && h.result === 'done')).toBe(false);
  }, 120_000);

  it('PIP-019/S2 A full list of mutations is accepted and kept in the stage record', async () => {
    const fx = fresh('spec-mutations-kept');
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    fx.apply('reference/PROP-201.spec-writer.patch');
    const adv = await json(fx, report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')), 'ticket', 'advance', 'PROP-201');
    expect(adv).toMatchObject({ next: 'spec-review', problems: [] });
    expect(await approveSpecReview(fx, 'PROP-201')).toMatchObject({ next: 'tester', problems: [] });
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester')).code).toBe(0);
    fx.apply('reference/PROP-201.tester.patch');

    // Only one of the two changed scenarios is named: refused with the other.
    const partial = tester('PROP-201', 'Tests for PRV-001/S4 and SET-001/S4', validTesterMutations('PRV-001/S4'));
    expect((await json(fx, partial, 'check-report', 'tester', 'PROP-201')).problems).toEqual([none('SET-001/S4')]);

    // A mutation for a scenario the spec does not have is refused.
    const unknown = tester('PROP-201', 'Tests for PRV-001/S4 and SET-001/S4', validTesterMutations('PRV-001/S4', 'SET-001/S4', 'PRV-001/S9'));
    expect((await json(fx, unknown, 'check-report', 'tester', 'PROP-201')).problems).toEqual(['mutations names PRV-001/S9, which is not in the spec; name a scenario your tests cover']);

    // Both changed ones and a third the ticket does not change (CNV-001/S1): accepted, and kept whole and in order.
    const full = tester('PROP-201', 'Tests for PRV-001/S4 and SET-001/S4', validTesterMutations('PRV-001/S4', 'SET-001/S4', 'CNV-001/S1'));
    expect(await json(fx, full, 'check-report', 'tester', 'PROP-201')).toMatchObject({ ok: true, problems: [] });
    expect(await json(fx, full, 'ticket', 'advance', 'PROP-201')).toMatchObject({ next: 'implementer', problems: [] });
    expect(record(fx, 'PROP-201')).toMatchObject({ role: 'tester', result: 'done', mutations: testerMutations('PRV-001/S4', 'SET-001/S4', 'CNV-001/S1') });
  }, 180_000);

  it('PIP-019/R3 A report with no mutations leaves the key out of the stage record', async () => {
    const fx = fresh('spec-mutations-blocked');
    expect((await fx.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
    const blocked = report('role: tester\nticket: BUG-301\nresult: blocked\nsummary: Waiting\nblockers: [{ text: "Which status does the fallback return?", cites: [PRV-002/S3] }]');
    const adv = await json(fx, blocked, 'ticket', 'advance', 'BUG-301');
    expect(adv.problems).toEqual([]);
    expect(record(fx, 'BUG-301')).toMatchObject({ role: 'tester', result: 'blocked' });
    expect(record(fx, 'BUG-301')).not.toHaveProperty('mutations');
  }, 60_000);
});

describe('PIP-019/S4 The tester names what each test catches, and the reviewer checks it', () => {
  type Entry = { worktree: string; task: string };
  const done = (role: string, extra = '') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: null, assumed: []${extra} }`;
  const approved = '  - { at: "2026-10-28T10:00:00.000Z", role: spec-review, result: done, summary: x, verdict: approve, assumed: [] }';
  const mutations = ', mutations: [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider" }, { scenario: SET-001/S4, wrong: "enables gemini without saving its key" }]';

  /** A chat-mini copy whose tester and reviewer prompts are this version's templates, and PROP-201 with `history` done. */
  async function task(prefix: string, history: string[]): Promise<Entry> {
    const fx = fresh(prefix, {
      setup: (dir) => {
        const shared = readFileSync(join(REPO, 'roles/_shared.md'), 'utf8');
        for (const role of ['tester', 'reviewer']) {
          const prompt = expandRole(readFileSync(join(REPO, `roles/${role}.md`), 'utf8'), shared);
          if (prompt === null) throw new Error(`roles/${role}.md does not expand`);
          writeFileSync(join(dir, `spec/roles/${role}.md`), prompt);
        }
        const file = join(dir, 'tickets/PROP-201.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
      },
    });
    const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as Entry;
    worktrees.push({ fx, path: entry.worktree });
    return entry;
  }
  const prose = (entry: Entry) => (entry.task.split('\n## Working folder\n')[0] ?? '').split('```report')[0] ?? '';
  const form = (entry: Entry) => (/```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '').split('\n');

  it('PIP-019/S4 The tester\'s prompt forbids a test that compares generated output with itself and asks for mutations', async () => {
    const entry = await task('spec-mutations-tester-prompt', [done('spec-writer'), approved]);
    expect(entry.task).toContain('You are the tester.');
    const text = prose(entry);
    expect(text).toMatch(/no test may compare generated output with itself/i);
    expect(text).toMatch(/wrong implementation/);
    expect(text).toMatch(/fail(?:s)? against/);
    expect(text).toContain('mutations:');
    expect(form(entry).some((line) => /^mutations: \[\]/.test(line))).toBe(true);
    // Mutations are asked for only where no tester round recorded after the latest done spec-writer stage named one,
    // and for the scenarios whose test the round changed: rounds before that spec-writer stage do not count (PIP-019/R4).
    const asks = text.split('\n').filter((line) => /mutations/.test(line));
    expect(asks.some((line) => /spec-writer/.test(line) && /tester round/i.test(line) && /changed/.test(line)), asks.join('\n')).toBe(true);
    expect(text).toMatch(/before (?:that|the latest) (?:done )?spec-writer[^.]*do(?:es)? not count/i);
  }, 120_000);

  it('PIP-019/S4 The reviewer\'s prompt checks one named mutation per test, chosen at random', async () => {
    const entry = await task('spec-mutations-reviewer-prompt', [done('spec-writer'), approved, done('tester', mutations), done('implementer')]);
    expect(entry.task).toContain('You are the reviewer.');
    const text = prose(entry);
    expect(text).toContain('mutations');
    expect(text).toMatch(/at random/);
    expect(text).toMatch(/would still pass/);
    expect(text).toContain('tests: true');
    // It takes the mutations of the done tester stages since the latest done spec-writer stage (PIP-019/R4).
    const takes = text.split('\n').filter((line) => /mutations/.test(line));
    expect(takes.some((line) => /since the latest done spec-writer/i.test(line)), takes.join('\n')).toBe(true);
    // Only the tester lists mutations: the reviewer's report form has no such key.
    expect(form(entry).some((line) => line.startsWith('mutations:'))).toBe(false);
  }, 120_000);
});
