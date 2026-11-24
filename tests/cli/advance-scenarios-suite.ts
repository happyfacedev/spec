// PIP-008: one test per scenario of spec ticket advance, through the CLI in real git repositories.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { partitionedDescribe } from './partitioned-it';
const describe = partitionedDescribe(2);
import { saveReport, loadReport } from '../../src/io/report-store';
import { REPO, gitFixture, report, testerMutations, validSpecWriterChecklist, validTesterMutations } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
const fresh = (prefix: string): Fx => {
  const f = gitFixture(prefix);
  fixtures.push(f);
  return f;
};
afterAll(() => {
  for (const f of fixtures) f.cleanup();
});

const hidden = readFileSync(join(REPO, 'evals/hidden/chat-mini/PRV-002.hidden.test.ts'), 'utf8');
const testerReport = report('role: tester\nticket: BUG-301\nresult: done\nsummary: Added the PRV-002/S3 test; it fails on main\nchanged: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
const subjects = (f: Fx, range: string) => f.git('log', '--format=%s', range).stdout.trim().split('\n').filter(Boolean);
/** The whole message of the commit at `rev`, without the final newline. */
const message = (f: Fx, rev: string) => f.git('log', '-1', '--format=%B', rev).stdout.replace(/\n+$/, '');
/** PIP-008/R1, INS-016/R12: a blank line, then exactly one trailer line, last. */
const expectTrailer = (f: Fx, rev: string, id: string) => {
  const text = message(f, rev);
  expect(text.endsWith(`\n\nSpec-Ticket: ${id}`)).toBe(true);
  expect(text.split('\n').filter((l) => l.startsWith('Spec-Ticket:'))).toEqual([`Spec-Ticket: ${id}`]);
};
const implReport = (id: string, summary: string, extra = '') => report(`role: implementer\nticket: ${id}\nresult: done\nsummary: ${summary}${extra}`);

/** BUG-301's tester stage up to, not including, advance. */
async function testerStage(f: Fx): Promise<void> {
  expect((await f.spec('', 'ticket', 'start', 'BUG-301', 'tester')).code).toBe(0);
  appendFileSync(join(f.repo, 'tests/PRV-002.test.ts'), `\n${hidden.slice(hidden.indexOf("it('PRV-002/S3"))}`);
}

describe('spec ticket advance', () => {
  it('PIP-008/S1 A done stage is recorded and committed', async () => {
    const f = fresh('adv-s1');
    await testerStage(f);
    const out = await f.spec(testerReport, 'ticket', 'advance', 'BUG-301');
    expect(out.stdout.split('\n').slice(0, 2)).toEqual(['BUG-301 tester: Added the PRV-002/S3 test; it fails on main', 'next: implementer']);
    expect(out.code).toBe(0);
    expect(subjects(f, 'main..HEAD')).toEqual(['BUG-301 tester: Added the PRV-002/S3 test; it fails on main']);
    expectTrailer(f, 'HEAD', 'BUG-301');
    const t = f.ticket('BUG-301');
    expect(t?.status).toBe('open');
    expect(t?.stage).toBeNull();
    const { duration_s: duration, ...entry } = (t?.history.at(-1) ?? {}) as Record<string, unknown>;
    expect(entry).toEqual({ at: '2026-10-27T12:00:00.000Z', role: 'tester', result: 'done', summary: 'Added the PRV-002/S3 test; it fails on main', verdict: null, assumed: [], mutations: testerMutations('PRV-002/S3') });
    expect(typeof duration).toBe('number');
    expect(t?.changed).toContain('PRV-002/S3');
  }, 60_000);

  it('PIP-008/S2 JSON output', async () => {
    const f = fresh('adv-s2');
    await testerStage(f);
    const out = await f.spec(testerReport, 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'BUG-301', next: 'implementer', status: 'open', problems: [] });
  }, 60_000);

  it('PIP-008/S3 The last stage finishes the ticket', async () => {
    const f = fresh('adv-s3');
    await testerStage(f);
    expect((await f.spec(testerReport, 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect((await f.spec('', 'ticket', 'start', 'BUG-301', 'implementer')).code).toBe(0);
    f.apply('reference/BUG-301.implementer.patch');
    expect((await f.spec(implReport('BUG-301', 'One fallback per reply', '\nchanged: [PRV-002/S3]'), 'ticket', 'advance', 'BUG-301')).code).toBe(0);
    expect((await f.spec('', 'ticket', 'start', 'BUG-301', 'reviewer')).code).toBe(0);
    const out = await f.spec(report('role: reviewer\nticket: BUG-301\nresult: done\nsummary: Fix matches PRV-002/R2\nverdict: approve'), 'ticket', 'advance', 'BUG-301', '--format', 'json');
    expect(JSON.parse(out.stdout)).toMatchObject({ status: 'done', next: null });
    const text = f.ticket('BUG-301');
    expect(text?.status).toBe('done');
    expect(subjects(f, 'main..HEAD')).toEqual(['BUG-301 reviewer: Fix matches PRV-002/R2', 'BUG-301 implementer: One fallback per reply', 'BUG-301 tester: Added the PRV-002/S3 test; it fails on main']);
    expect(f.git('status', '--porcelain').stdout).toBe('');
    expect((await f.spec('', 'lint', '--ci')).code).toBe(0);
  }, 120_000);
});

describe('spec ticket advance, report details', () => {
  const f = fresh('adv-details');

  it('PIP-008/S4 A multi-line summary becomes one line', async () => {
    expect((await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    const msg = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: |-\n  Did it\n  well');
    expect((await f.spec(msg, 'ticket', 'advance', 'TASK-101')).code).toBe(0);
    expect(subjects(f, '-1')).toEqual(['TASK-101 implementer: Did it well']);
    expectTrailer(f, 'HEAD', 'TASK-101');
    expect(f.ticket('TASK-101')?.history.at(-1)?.summary).toBe('Did it well');
  }, 60_000);

  it('PIP-008/S5 A long summary is cut in the commit only', async () => {
    const summary = `${'abcdefghi '.repeat(21)}abcde`;
    expect(summary).toHaveLength(215);
    expect((await f.spec('', 'ticket', 'start', 'TASK-102', 'implementer')).code).toBe(0);
    expect((await f.spec(implReport('TASK-102', summary), 'ticket', 'advance', 'TASK-102')).code).toBe(0);
    const full = `TASK-102 implementer: ${summary}`;
    expect(subjects(f, '-1')).toEqual([`${full.slice(0, 119).trimEnd()}…`]);
    expectTrailer(f, 'HEAD', 'TASK-102');
    expect(f.ticket('TASK-102')?.history.at(-1)?.summary).toBe(summary);
  }, 60_000);

  it('PIP-008/S6 A blocked stage turns its blockers into questions', async () => {
    expect((await f.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const blocked = (text: string) => report(`role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Stuck\nchanged: [PRV-001/S1]\nblockers: [{ text: ${text}, cites: [conversation.Message.meta] }]`);
    const out = await f.spec(blocked('Needs a meta field'), 'ticket', 'advance', 'TASK-103');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[1]).toBe('status: blocked');
    const t = f.ticket('TASK-103');
    expect(t?.questions).toEqual([{ id: 'Q1', kind: 'blocker', text: 'Needs a meta field', default: null, cites: ['conversation.Message.meta'], answer: null, raised_by: 'implementer' }]);
    expect(t?.status).toBe('blocked');
    expect(subjects(f, '-1')).toEqual(['TASK-103 implementer: Stuck']);
    // A blocked report adds nothing to changed (S7).
    expect(t?.changed).toEqual([]);
    // A new question takes the number after the highest one.
    expect((await f.spec('', 'ticket', 'answer', 'TASK-103', 'Q1', 'add', 'it')).code).toBe(0);
    expect((await f.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    expect((await f.spec(blocked('Needs more'), 'ticket', 'advance', 'TASK-103')).code).toBe(0);
    expect(f.ticket('TASK-103')?.questions.map((q) => q.id)).toEqual(['Q1', 'Q2']);
  }, 60_000);

  it('PIP-004/S11 A blocker may cite its own ticket and its questions, and ticket advance records it', async () => {
    const g = fresh('adv-s11');
    expect((await g.spec('', 'ticket', 'start', 'TASK-102', 'implementer')).code).toBe(0);
    const msg = report('role: implementer\nticket: TASK-102\nresult: blocked\nsummary: Stuck\nblockers: [{ text: Which one, cites: [TASK-102#Q1, TASK-102] }]');
    expect((await g.spec(msg, 'check-report', 'implementer', 'TASK-102')).code).toBe(0);
    const out = await g.spec(msg, 'ticket', 'advance', 'TASK-102');
    expect(out.stderr).not.toContain('would break its schema');
    expect(out.code, out.stderr).toBe(0);
    const t = g.ticket('TASK-102');
    expect(t?.status).toBe('blocked');
    expect(t?.questions).toHaveLength(1);
    expect(t?.questions[0]).toMatchObject({ id: 'Q1', kind: 'blocker', text: 'Which one', answer: null, raised_by: 'implementer' });
    expect(t?.questions[0]?.cites.every((c) => c === 'TASK-102' || c.startsWith('TASK-102#Q'))).toBe(true);
    expect(t?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'blocked' });
  }, 60_000);

  it('PIP-008/S7 Changed units accumulate', async () => {
    const g = fresh('adv-s7');
    const created = await g.spec(JSON.stringify({ type: 'task', title: 'Touch two features', touches: ['PRV-001', 'PRV-002'], body: 'x' }), 'ticket', 'new');
    const id = /^(TASK-\d+) created/.exec(created.stdout)?.[1] ?? '';
    expect(id).not.toBe('');
    g.git('add', '-A');
    g.git('commit', '-q', '-m', 'new ticket');
    const started = await g.spec('', 'ticket', 'start', id, 'implementer');
    expect(started.code, started.stderr).toBe(0);
    const out = await g.spec(implReport(id, 'Done', '\nchanged: [PRV-002/S1, PRV-001/S1]'), 'ticket', 'advance', id);
    expect(out.code, out.stderr).toBe(0);
    expect(g.ticket(id)?.changed).toEqual(['PRV-001/S1', 'PRV-002/S1']);
  }, 60_000);

  it('PIP-008/S9 Defaults applied are kept', async () => {
    expect((await f.spec('', 'ticket', 'start', 'PROP-202', 'spec-writer')).code).toBe(0);
    const msg = report('role: spec-writer\nticket: PROP-202\nresult: done\nsummary: Specified\nassumed: [{ question: PROP-202#Q1, value: alphabetical }]\n' + validSpecWriterChecklist());
    const out = await f.spec(msg, 'ticket', 'advance', 'PROP-202');
    expect(out.code, out.stderr).toBe(0);
    expect(f.ticket('PROP-202')?.history.at(-1)?.assumed).toEqual([{ question: 'PROP-202#Q1', value: 'alphabetical' }]);
  }, 60_000);
});

describe('spec ticket advance, spec-writer', () => {
  it('PIP-008/S8 The spec-writer\'s changes are read from the tree',async () => {
    const f = fresh('adv-s8');
    expect((await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    f.apply('reference/PROP-201.spec-writer.patch');
    const out = await f.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\nchanged: [providers.ProviderConfig]\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(f.ticket('PROP-201')?.changed).toEqual(expect.arrayContaining(['providers.ProviderConfig', 'PRV-001/S4', 'SET-001/S4']));
  }, 60_000);

  it('PIP-008/S18 The generated files are rebuilt before the commit', async () => {
    const f = fresh('adv-s18');
    expect((await f.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    f.apply('reference/PROP-201.spec-writer.patch');
    const feature = join(f.repo, 'spec/modules/settings/features/SET-001-enable-providers.md');
    writeFileSync(feature, readFileSync(feature, 'utf8').replace('title: Enable providers', 'title: Switch providers on'));
    expect((await f.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini\n' + validSpecWriterChecklist('PRV-001/S4', 'PRV-001/S1')),'ticket', 'advance', 'PROP-201')).code).toBe(0);
    const files = f.git('show', '--name-only', '--format=', 'HEAD').stdout;
    expect(files).toContain('spec/index.md');
  }, 60_000);
});

describe('spec ticket advance, refusals and sources', () => {
  const f = fresh('adv-refusals');

  it('PIP-008/S10 A report that fails its checks blocks the ticket', async () => {
    expect((await f.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    writeFileSync(join(f.repo, 'tests/SET-002.test.ts'), '// deleted as the ticket asked\n');
    const head = f.git('rev-parse', 'HEAD').stdout;
    const out = await f.spec(implReport('TASK-101', 'x'), 'ticket', 'advance', 'TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr.startsWith('report rejected:\n- ')).toBe(true);
    expect(out.stderr).toContain('TASK-101 is blocked; nothing was committed.');
    expect(f.git('rev-parse', 'HEAD').stdout).toBe(head);
    // The stage's change is kept in a stash, not left in the tree (PIP-008/R4).
    expect(f.git('status', '--porcelain').stdout).not.toContain('tests/SET-002.test.ts');
    expect(f.git('stash', 'list').stdout).toContain('TASK-101 implementer: blocked');
    expect(out.stderr).toContain('stash: TASK-101 implementer: blocked\n');
    const t = f.ticket('TASK-101');
    expect(t).toMatchObject({ status: 'blocked', stage: null });
    expect(t?.history.at(-1)).toMatchObject({ role: 'implementer', result: 'blocked', summary: 'invalid report', verdict: null, assumed: [] });
    const q = t?.questions.at(-1);
    expect(q).toMatchObject({ kind: 'blocker', raised_by: 'implementer' });
    expect(q?.text.startsWith('The implementer stage ended with an invalid report: ')).toBe(true);
    expect(q?.text.endsWith('. Its changes are kept in git stash "TASK-101 implementer: blocked"; the next implementer stage gets them back. Answer to resume.')).toBe(true);
    f.git('checkout', '-q', '--', 'tests/SET-002.test.ts');
    f.git('checkout', '-q', '--', 'tickets');
  }, 60_000);

  it('PIP-008/S10 a changed generated file is put back as HEAD has it and is not in the stash', async () => {
    const g = gitFixture('adv-s10-generated', {
      setup: (dir) => {
        const config = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
        cfg.generated = { globs: ['src/generated/**'] };
        writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
        mkdirSync(join(dir, 'src/generated'), { recursive: true });
        writeFileSync(join(dir, 'src/generated/assets.ts'), "export const assets = 'head';\n");
      },
    });
    fixtures.push(g);
    expect((await g.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    writeFileSync(join(g.repo, 'tests/SET-002.test.ts'), '// deleted as the ticket asked\n');
    writeFileSync(join(g.repo, 'src/generated/assets.ts'), "export const assets = 'rebuilt';\n");
    writeFileSync(join(g.repo, 'src/generated/created.ts'), 'export const created = 1;\n');
    const out = await g.spec(implReport('TASK-101', 'x'), 'ticket', 'advance', 'TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('stash: TASK-101 implementer: blocked\n');
    expect(readFileSync(join(g.repo, 'src/generated/assets.ts'), 'utf8')).toBe("export const assets = 'head';\n");
    expect(existsSync(join(g.repo, 'src/generated/created.ts'))).toBe(false);
    expect(g.git('status', '--porcelain', '--untracked-files=all').stdout.split('\n').filter((l) => l !== '' && !l.includes('tickets/'))).toEqual([]);
    const stash = g.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(': TASK-101 implementer: blocked'))?.split(' ')[0] ?? '';
    expect(stash).not.toBe('');
    expect(g.git('diff', '--name-only', `${stash}^1`, stash).stdout.trim().split('\n')).toEqual(['tests/SET-002.test.ts']);
    const third = g.git('rev-parse', '--verify', '--quiet', `${stash}^3`);
    expect(third.code === 0 ? g.git('ls-tree', '-r', '--name-only', `${stash}^3`).stdout.trim() : '').toBe('');
  }, 60_000);

  it('PIP-008/S10 JSON form of a refused report', async () => {
    const g = fresh('adv-s10-json');
    expect((await g.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    writeFileSync(join(g.repo, 'tests/SET-002.test.ts'), '// deleted\n');
    const out = await g.spec(implReport('TASK-101', 'x'), 'ticket', 'advance', 'TASK-101', '--format', 'json');
    expect(out.code).toBe(1);
    const j = JSON.parse(out.stdout) as { status: string; next: null; problems: string[] };
    expect(j).toMatchObject({ status: 'blocked', next: null });
    expect(j.problems.length).toBeGreaterThan(0);
  }, 60_000);

  it('PIP-008/S11 No report anywhere', async () => {
    const g = fresh('adv-s11');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const head = g.git('rev-parse', 'HEAD').stdout;
    const out = await g.spec('', 'ticket', 'advance', 'TASK-103');
    expect(out.code).toBe(2);
    expect(out.stderr.startsWith('no report for the implementer stage of TASK-103: pass the role\'s final message on stdin. Nothing was recorded; the stage is still running.')).toBe(true);
    expect(g.ticket('TASK-103')).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    expect(g.git('rev-parse', 'HEAD').stdout).toBe(head);
  }, 60_000);

  it('PIP-008/S12 Report YAML that lost its fence', async () => {
    const g = fresh('adv-s12');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const bare = await g.spec('just some words, not a report', 'ticket', 'advance', 'TASK-103');
    expect(bare.code).toBe(2);
    const out = await g.spec('role: implementer\nticket: TASK-103\nresult: done\nsummary: Nothing to simplify safely', 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'TASK-103', next: 'reviewer', status: 'open', problems: [] });
  }, 60_000);

  it('PIP-008/S13 The report stored by the finish check', async () => {
    const g = fresh('adv-s13');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    expect((await g.spec(implReport('TASK-103', 'Nothing'), 'ticket', 'advance', 'TASK-103')).code).toBe(0);
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'reviewer')).code).toBe(0);
    saveReport(g.repo, 'TASK-103', report('role: reviewer\nticket: TASK-103\nresult: done\nsummary: No change to review\nverdict: approve'));
    const out = await g.spec('', 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(out.stdout)).toMatchObject({ status: 'done' });
    expect(loadReport(g.repo, 'TASK-103')).toBeNull();
  }, 60_000);

  it('PIP-008/S14 A fenced report on stdin wins', async () => {
    const g = fresh('adv-s14');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    saveReport(g.repo, 'TASK-103', implReport('TASK-103', 'The stored one'));
    const out = await g.spec(implReport('TASK-103', 'The one on stdin'), 'ticket', 'advance', 'TASK-103');
    expect(out.stdout.split('\n')[0]).toBe('TASK-103 implementer: The one on stdin');
    expect(loadReport(g.repo, 'TASK-103')).toBeNull();
  }, 60_000);

  it('PIP-008/S15 Only this ticket\'s files are committed', async () => {
    const g = fresh('adv-s15');
    expect((await g.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    const other = join(g.repo, 'tickets/TASK-102.md');
    appendFileSync(other, '\nA note.\n');
    expect((await g.spec(implReport('TASK-101', 'Nothing'), 'ticket', 'advance', 'TASK-101')).code).toBe(0);
    const files = g.git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n');
    expect(files).toContain('tickets/TASK-101.md');
    expect(files).not.toContain('tickets/TASK-102.md');
    expect(g.git('status', '--porcelain').stdout).toContain('tickets/TASK-102.md');
  }, 60_000);

  it('PIP-008/S17 No stage running', async () => {
    const out = await f.spec('', 'ticket', 'advance', 'TASK-102');
    expect(out.code).toBe(1);
    expect(out.stderr.trim()).toBe('TASK-102 has no stage running; spec ticket start begins one');
  }, 60_000);
});

describe('spec ticket advance, a blocked stage\'s work', () => {
  it('PIP-008/S21 A blocked stage\'s changes are kept in a stash', async () => {
    const g = fresh('adv-s21');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    appendFileSync(join(g.repo, 'src/app.ts'), '// half done\n');
    writeFileSync(join(g.repo, 'src/extra.ts'), 'export const extra = 1;\n');
    const msg = report('role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Stuck\nblockers: [{ text: Needs a meta field, cites: [conversation.Message.meta] }]');
    const out = await g.spec(msg, 'ticket', 'advance', 'TASK-103');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 3)).toEqual(['TASK-103 implementer: Stuck', 'status: blocked', 'stash: TASK-103 implementer: blocked']);
    // Only the ticket file is committed; the tree is clean.
    expect(g.git('show', '--name-only', '--format=', 'HEAD').stdout.trim()).toBe('tickets/TASK-103.md');
    expect(g.git('status', '--porcelain', '--untracked-files=all').stdout).toBe('');
    // The stash holds the stage's work, and never the ticket file.
    const stash = g.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(': TASK-103 implementer: blocked'))?.split(' ')[0] ?? '';
    expect(stash).not.toBe('');
    const tracked = g.git('diff', '--name-only', `${stash}^1`, stash).stdout.trim().split('\n');
    const untracked = g.git('ls-tree', '-r', '--name-only', `${stash}^3`).stdout.trim().split('\n');
    expect(tracked).toEqual(['src/app.ts']);
    expect(untracked).toEqual(['src/extra.ts']);
    const q = g.ticket('TASK-103')?.questions.at(-1);
    expect(q?.text).toBe('Needs a meta field. Its changes are kept in git stash "TASK-103 implementer: blocked"; the next implementer stage gets them back.');

    // The next run of the stage gets them back, after the start's own dirt check.
    expect((await g.spec('', 'ticket', 'answer', 'TASK-103', 'Q1', 'add', 'it')).code).toBe(0);
    const again = await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer');
    expect(again.code, again.stderr).toBe(0);
    expect(readFileSync(join(g.repo, 'src/app.ts'), 'utf8').endsWith('// half done\n')).toBe(true);
    expect(readFileSync(join(g.repo, 'src/extra.ts'), 'utf8')).toBe('export const extra = 1;\n');
    expect(g.git('stash', 'list').stdout).not.toContain('TASK-103 implementer: blocked');
  }, 60_000);

  it('PIP-008/S21 a blocked stage that changed nothing stashes nothing', async () => {
    const g = fresh('adv-s21-none');
    expect((await g.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const msg = report('role: implementer\nticket: TASK-103\nresult: blocked\nsummary: Stuck\nblockers: [{ text: Needs a meta field, cites: [] }]');
    const out = await g.spec(msg, 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'TASK-103', next: null, status: 'blocked', problems: [] });
    expect(g.git('stash', 'list').stdout).toBe('');
    expect(g.ticket('TASK-103')?.questions.at(-1)?.text).toBe('Needs a meta field');
  }, 60_000);
});

describe('spec ticket advance, a ticket kept in a tracker', () => {
  it('PIP-008/S16 A stage that changed nothing still commits', async () => {
    const tracker = fresh('adv-s16');
    const db = join(tracker.repo, '.tracker.json');
    const all: Record<string, string> = { 'TASK-103': readFileSync(join(tracker.repo, 'tickets/TASK-103.md'), 'utf8') };
    writeFileSync(db, JSON.stringify(all));
    writeFileSync(join(tracker.repo, '.gitignore'), `${readFileSync(join(tracker.repo, '.gitignore'), 'utf8')}.tracker.json\n`);
    tracker.git('rm', '-rq', 'tickets');
    const cfgPath = join(tracker.repo, 'spec/config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
    cfg.tickets = { adapter: 'command', command: `node ${join(REPO, 'examples/ticket-adapters/json-file.mjs')} .tracker.json` };
    writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
    expect((await tracker.spec('', 'build')).code).toBe(0);
    tracker.git('add', '-A');
    tracker.git('commit', '-q', '-m', 'configure');
    expect((await tracker.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const adv = await tracker.spec(implReport('TASK-103', 'Nothing to simplify safely'), 'ticket', 'advance', 'TASK-103', '--format', 'json');
    expect(JSON.parse(adv.stdout)).toMatchObject({ next: 'reviewer' });
    expect(tracker.git('show', '--name-only', '--format=%s', 'HEAD').stdout.trim()).toBe('TASK-103 implementer: Nothing to simplify safely');
  }, 60_000);
});
