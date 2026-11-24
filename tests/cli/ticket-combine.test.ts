// TKT-012 spec ticket combine and spec ticket close (S12, S13), and what an absorbed ticket does elsewhere: TKT-002/S13
// (the keys combine and close edit), TKT-007/S9, S10 (the absorbed blocker), TKT-010/S12 (the queue), through the CLI on
// throwaway git copies of chat-mini. The close scenarios that need the installed git hooks (TKT-012/S11, S14) are in
// enforcement.test.ts, and WSP-004/S8 is in ticket-live-state.test.ts.
import { mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const mk = (files: Record<string, string> = {}): Fx => {
  const fx = gitFixture('spec-combine', {
    setup: (dir) => {
      for (const [id, text] of Object.entries(files)) writeFileSync(join(dir, 'tickets', `${id}.md`), text);
    },
  });
  made.push(fx);
  return fx;
};
const file = (fx: Fx, id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');
const bodyOf = (text: string) => text.slice(text.indexOf('\n---\n', 4) + 5);
const allTickets = (fx: Fx) => Object.fromEntries(readdirSync(join(fx.repo, 'tickets')).map((f) => [f, readFileSync(join(fx.repo, 'tickets', f), 'utf8')]));

interface Spec {
  type?: 'proposal' | 'bug' | 'task';
  title?: string;
  status?: string;
  absorbedInto?: string;
  touches?: string[];
  violates?: string[];
  dependsOn?: string[];
  questions?: string;
  history?: string;
  statusLine?: string;
  stage?: string;
  extra?: string;
  body?: string;
}
/** A ticket file; `questions` and `history` are written as given (block YAML under their key). */
const tk = (id: string, s: Spec = {}): string => {
  const type = s.type ?? 'proposal';
  const list = (xs: string[] | undefined) => `[${(xs ?? []).join(', ')}]`;
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${s.title ?? 'x'}`,
    s.statusLine ?? `status: ${s.status ?? 'open'}`,
    ...(s.absorbedInto ? [`absorbed_into: ${s.absorbedInto}`] : []),
    `stage: ${s.stage ?? 'null'}`,
    `touches: ${list(s.touches ?? (type === 'bug' ? [] : ['SET-001']))}`,
    `violates: ${list(s.violates)}`,
    `depends_on: ${list(s.dependsOn)}`,
    'changed: []',
    s.questions ? `questions:\n${s.questions}` : 'questions: []',
    s.history ? `history:\n${s.history}` : 'history: []',
    ...(s.extra ? [s.extra] : []),
    '---',
    `${s.body ?? 'Body.'}\n`,
  ].join('\n');
};
const Q_PREF = '  - id: Q1\n    kind: preference\n    text: Which colour?\n    default: blue\n    cites: []\n    answer: null\n    raised_by: null';
const Q_BLOCKER_AND_ANSWERED =
  '  - id: Q1\n    kind: blocker\n    text: Which order?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n' +
  '  - id: Q2\n    kind: blocker\n    text: Settled?\n    default: null\n    cites: []\n    answer: yes\n    raised_by: null';
const DONE_STAGE = '  - at: 2026-10-27T10:00:00Z\n    role: spec-writer\n    result: done\n    summary: spec\n    verdict: null\n    assumed: []\n    duration_s: 5';

interface Moved { id: string; added: string[]; questions: { from: string; to: string }[] }
interface Combined { ticket: string; absorbed: Moved[]; gate: { ticket: string; ready: boolean; blockers: { kind: string; id: string; text: string }[] } }
interface GateJson { ready: boolean; blockers: { kind: string; id: string; text: string }[] }

describe('TKT-012 spec ticket combine', () => {
  it('TKT-012/S1 One ticket folded into another', async () => {
    const fx = mk({
      'PROP-201': tk('PROP-201', { title: 'Add a fake provider', touches: ['SET-001'], questions: Q_PREF, body: 'Add it.' }),
      'PROP-202': tk('PROP-202', { title: 'List providers', touches: ['SET-001', 'UI-002'], questions: Q_BLOCKER_AND_ANSWERED, body: 'List them.' }),
    });
    const before = file(fx, 'PROP-202');
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-202');
    expect(out.stdout.startsWith('PROP-202 absorbed into PROP-201 (added UI-002; PROP-202#Q1 → PROP-201#Q2)\n\nPROP-201: not ready')).toBe(true);
    expect(out.code, out.stderr).toBe(0);
    const into = fx.ticket('PROP-201');
    expect(into?.touches).toEqual(['SET-001', 'UI-002']);
    expect(into?.questions).toHaveLength(2);
    expect(into?.questions[0]).toMatchObject({ id: 'Q1', kind: 'preference', text: 'Which colour?', default: 'blue', answer: null });
    expect(into?.questions[1]).toMatchObject({ id: 'Q2', kind: 'blocker', text: 'Which order?', answer: null });
    expect(bodyOf(file(fx, 'PROP-201')).split('\n').filter((l) => l.trim() !== '')).toEqual(['Add it.', 'From PROP-202: List providers', 'List them.']);
    const from = fx.ticket('PROP-202');
    expect(from?.status).toBe('absorbed');
    expect(from?.absorbed_into).toBe('PROP-201');
    const after = file(fx, 'PROP-202');
    expect(after.split('\n').filter((l) => l !== 'absorbed_into: PROP-201')).toEqual(before.split('\n').map((l) => (l === 'status: open' ? 'status: absorbed' : l)));
  }, 60_000);

  it('TKT-012/S2 Several tickets, and what each one adds', async () => {
    const fx = mk({
      'BUG-303': tk('BUG-303', { type: 'bug', title: 'Third', violates: ['PRV-002/S3'], dependsOn: ['TASK-101'], body: 'Three.' }),
      'BUG-304': tk('BUG-304', { type: 'bug', title: 'Fourth', violates: ['PRV-002/S4'], dependsOn: ['BUG-301'], body: 'Four.' }),
    });
    const out = await fx.spec('', 'ticket', 'combine', 'BUG-301', 'BUG-303', 'BUG-304', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout) as Combined;
    expect(r.ticket).toBe('BUG-301');
    expect(r.absorbed).toEqual([
      { id: 'BUG-303', added: ['TASK-101'], questions: [] },
      { id: 'BUG-304', added: ['PRV-002/S4'], questions: [] },
    ]);
    const into = fx.ticket('BUG-301');
    expect(into?.violates).toEqual(['PRV-002/S3', 'PRV-002/S4']);
    expect(into?.depends_on).toEqual(['TASK-101']);
    const body = bodyOf(file(fx, 'BUG-301'));
    expect(body).toContain('From BUG-303: Third');
    expect(body.indexOf('From BUG-303: Third')).toBeLessThan(body.indexOf('From BUG-304: Fourth'));
    expect(r.gate).toEqual((JSON.parse((await fx.spec('', 'gate', 'BUG-301', '--format', 'json')).stdout) as Combined['gate']));
  }, 60_000);

  it('TKT-012/S3 Committed together', async () => {
    const fx = mk();
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-202', 'PROP-205');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('PROP-201: combine PROP-202, PROP-205');
    expect(fx.git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n').sort()).toEqual(['tickets/PROP-201.md', 'tickets/PROP-202.md', 'tickets/PROP-205.md']);
    expect(fx.git('log', '-1', '--format=%B').stdout.replace(/\n+$/, '').endsWith('\n\nSpec-Ticket: PROP-201')).toBe(true);
    expect(fx.git('status', '--porcelain').stdout).toBe('');

    const other = mk();
    // "main" stays checked out in the fixture's own tree; the command runs in a second worktree on another branch.
    const tree = join(tempDir('spec-combine-tree-'), 'wt');
    try {
      expect(other.git('worktree', 'add', '-q', '-b', 'elsewhere', tree).code).toBe(0);
      const before = allTickets(other);
      const head = other.git('rev-parse', 'HEAD').stdout;
      const refused = await run({
        argv: ['ticket', 'combine', 'PROP-201', 'PROP-202', '--root', join(tree, 'spec')],
        env: {},
        cwd: tree,
        scriptPath: undefined,
        stdin: () => Promise.resolve(''),
        now: () => '2026-10-27T12:00:00.000Z',
      });
      expect(refused.code).toBe(1);
      expect(refused.stderr.startsWith('file tickets from main: run spec ticket combine in ')).toBe(true);
      expect(allTickets(other)).toEqual(before);
      expect(Object.fromEntries(readdirSync(join(tree, 'tickets')).map((f) => [f, readFileSync(join(tree, 'tickets', f), 'utf8')]))).toEqual(before);
      expect(other.git('rev-parse', 'HEAD').stdout).toBe(head);
      expect(other.git('status', '--porcelain').stdout).toBe('');
    } finally {
      other.git('worktree', 'remove', '--force', tree);
      rmSync(join(tree, '..'), { recursive: true, force: true });
    }
  }, 60_000);

  it('TKT-012/S4 Tickets that may not be combined', async () => {
    const fx = mk({
      'PROP-206': tk('PROP-206', { status: 'blocked' }),
      'PROP-207': tk('PROP-207', { history: DONE_STAGE }),
      'PROP-208': tk('PROP-208', { status: 'absorbed', absorbedInto: 'PROP-201' }),
      'PROP-210': tk('PROP-210'),
    });
    const before = allTickets(fx);
    const rows: [string[], string][] = [
      [['PROP-201', 'PROP-201'], 'PROP-201 cannot absorb itself'],
      [['PROP-201', 'PROP-206'], 'PROP-206 is blocked: only open tickets are combined'],
      [['PROP-206', 'PROP-201'], 'PROP-206 is blocked: only open tickets are combined'],
      [['PROP-201', 'PROP-208'], 'PROP-208 is absorbed: only open tickets are combined'],
      [['PROP-201', 'PROP-207'], 'PROP-207 has recorded stages: only tickets no stage has run on are combined'],
      [['PROP-201', 'TASK-101'], 'PROP-201 is a proposal and TASK-101 is a task: only tickets of one type are combined'],
      [['PROP-210', 'PROP-201'], 'PROP-201 has absorbed PROP-208: combine into PROP-201 instead'],
    ];
    for (const [args, line] of rows) {
      const out = await fx.spec('', 'ticket', 'combine', ...args);
      expect(out.stderr, args.join(' ')).toBe(`${line}\n`);
      expect(out.code, args.join(' ')).toBe(1);
      expect(allTickets(fx)).toEqual(before);
    }
    const both = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-206', 'PROP-207');
    expect(both.stderr.trimEnd().split('\n').sort()).toEqual(['PROP-206 is blocked: only open tickets are combined', 'PROP-207 has recorded stages: only tickets no stage has run on are combined']);
    expect(both.code).toBe(1);
    expect(allTickets(fx)).toEqual(before);
    const mixed = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-210', 'PROP-206');
    expect(mixed.code).toBe(1);
    expect(fx.ticket('PROP-210')?.status).toBe('open');
    expect(allTickets(fx)).toEqual(before);
  }, 120_000);

  it('TKT-012/S4 A ticket with a worktree of its own is not combined', async () => {
    const fx = mk({ 'PROP-209': tk('PROP-209') });
    const added = await fx.spec('', 'worktree', 'add', 'PROP-209');
    expect(added.code, added.stderr).toBe(0);
    const tree = join(`${realpathSync(fx.repo)}.worktrees`, 'PROP-209');
    const treeTickets = () => Object.fromEntries(readdirSync(join(tree, 'tickets')).map((f) => [f, readFileSync(join(tree, 'tickets', f), 'utf8')]));
    try {
      const before = allTickets(fx);
      const treeBefore = treeTickets();
      const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-209');
      expect(out.stderr).toBe('PROP-209 has a worktree on ticket/PROP-209: remove it first\n');
      expect(out.code).toBe(1);
      expect(allTickets(fx)).toEqual(before);
      expect(treeTickets()).toEqual(treeBefore);
    } finally {
      fx.git('worktree', 'remove', '--force', tree);
      rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    }
  }, 120_000);

  it('TKT-012/S2 (R2) INTO\'s own dependency on a FROM is dropped', async () => {
    const fx = mk({
      'PROP-201': tk('PROP-201', { dependsOn: ['PROP-202'] }),
      'PROP-202': tk('PROP-202', { title: 'Other' }),
    });
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-202', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.ticket('PROP-201')?.depends_on).toEqual([]);
    const r = JSON.parse(out.stdout) as Combined;
    expect(r.gate.blockers.filter((b) => b.id === 'PROP-202')).toEqual([]);
    const gate = JSON.parse((await fx.spec('', 'gate', 'PROP-201', '--format', 'json')).stdout) as GateJson;
    expect(gate.blockers.filter((b) => b.id === 'PROP-202')).toEqual([]);
  }, 60_000);

  it('TKT-002/S2 (R2) A block-style touches list is written on one line, with its comments', async () => {
    const into = tk('PROP-201').replace(
      'touches: [SET-001]',
      '# what it changes\ntouches:\n  - SET-001 # first\n  - PRV-001 # second',
    );
    const fx = mk({ 'PROP-201': into, 'PROP-202': tk('PROP-202', { title: 'Other', touches: ['SET-001', 'UI-002'] }) });
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-202');
    expect(out.code, out.stderr).toBe(0);
    const text = file(fx, 'PROP-201');
    const front = text.slice(0, text.indexOf('\n---\n', 4));
    const lines = front.split('\n');
    expect(lines.filter((l) => l.startsWith('touches:'))).toHaveLength(1);
    expect(lines.find((l) => l.startsWith('touches:'))).toMatch(/^touches: \[SET-001, PRV-001, UI-002\]/);
    expect(lines.some((l) => l.startsWith('  - SET-001') || l.startsWith('  - PRV-001'))).toBe(false);
    for (const comment of ['# what it changes', '# first', '# second']) expect(front).toContain(comment);
  }, 60_000);

  it('TKT-012/S5 Unknown tickets and missing arguments', async () => {
    const fx = mk();
    const unknown = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-20');
    expect(unknown.stderr.startsWith('Unknown PROP-20. Did you mean PROP-201?')).toBe(true);
    expect(unknown.code).toBe(2);
    const usage = await fx.spec('', 'ticket', 'combine', 'PROP-201');
    expect(usage.stderr.startsWith('usage: spec ticket combine <INTO> <FROM>...')).toBe(true);
    expect(usage.code).toBe(2);
  }, 60_000);

  it('TKT-012/S6 An absorbed ticket is never gated or started', async () => {
    const fx = mk({ 'PROP-202': tk('PROP-202', { status: 'absorbed', absorbedInto: 'PROP-201' }) });
    const out = await fx.spec('', 'gate', 'PROP-202', '--format', 'json');
    expect((JSON.parse(out.stdout) as GateJson).blockers).toEqual([{ kind: 'absorbed', id: 'PROP-201', text: 'PROP-202 was absorbed into PROP-201; its work goes on there' }]);
    expect(out.code).toBe(1);
    const start = await fx.spec('', 'ticket', 'start', 'PROP-202', 'spec-writer');
    expect(start.code).not.toBe(0);
    expect(fx.ticket('PROP-202')?.status).toBe('absorbed');
    expect(fx.git('branch', '--list', 'ticket/PROP-202').stdout).toBe('');
  }, 60_000);

  it('TKT-012/S7 A ticket that depends on an absorbed ticket', async () => {
    const fx = mk({
      'PROP-202': tk('PROP-202', { status: 'absorbed', absorbedInto: 'PROP-201' }),
      'TASK-930': tk('TASK-930', { type: 'task', touches: ['CNV-001'], dependsOn: ['PROP-202'] }),
    });
    const out = await fx.spec('', 'gate', 'TASK-930', '--format', 'json');
    expect((JSON.parse(out.stdout) as GateJson).blockers).toContainEqual({
      kind: 'unresolved',
      id: 'PROP-202',
      text: 'depends_on PROP-202, which was absorbed into PROP-201: depend on PROP-201 instead',
    });
  }, 60_000);

  it('TKT-012/S8 A moved question that cites its own ticket', async () => {
    const own = '  - id: Q1\n    kind: blocker\n    text: Which order?\n    default: null\n    cites: [PROP-901, TKT-012]\n    answer: null\n    raised_by: null';
    const fx = mk({
      'PROP-901': tk('PROP-901', { touches: ['TKT-012'], questions: own }),
      'PROP-902': tk('PROP-902', { touches: ['TKT-001'], body: 'Into.' }),
    });
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-902', 'PROP-901');
    expect(out.code, out.stderr).toBe(0);
    const into = fx.ticket('PROP-902');
    expect(into?.questions[0]).toMatchObject({ id: 'Q1', kind: 'blocker', text: 'Which order?', answer: null, cites: ['PROP-902', 'TKT-012'] });
    const gate = await fx.spec('', 'gate', 'PROP-902', '--format', 'json');
    const blockers = (JSON.parse(gate.stdout) as GateJson).blockers;
    expect(blockers.filter((b) => b.kind === 'question').map((b) => b.id)).toContain('PROP-902#Q1');
    expect(blockers.some((b) => b.kind === 'schema')).toBe(false);
  }, 60_000);

  it('TKT-012/S9 A moved question that cites a FROM question', async () => {
    const q = (id: string, text: string, cites: string, answer: string) =>
      `  - id: ${id}\n    kind: blocker\n    text: ${text}\n    default: null\n    cites: [${cites}]\n    answer: ${answer}\n    raised_by: null`;
    const questions = [
      q('Q1', 'Which order?', 'PROP-901', 'null'),
      q('Q2', 'Which name?', 'PROP-901#Q1', 'null'),
      q('Q3', 'Which old?', '', 'yes'),
      q('Q4', 'Which version?', 'PROP-901#Q3', 'null'),
    ].join('\n');
    const fx = mk({
      'PROP-901': tk('PROP-901', { touches: ['TKT-012'], questions }),
      'PROP-902': tk('PROP-902', { touches: ['TKT-001'], body: 'Into.' }),
    });
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-902', 'PROP-901');
    expect(out.code, out.stderr).toBe(0);
    const into = fx.ticket('PROP-902');
    expect(into?.questions).toHaveLength(3);
    expect(into?.questions[0]).toMatchObject({ id: 'Q1', kind: 'blocker', text: 'Which order?', answer: null, cites: ['PROP-902'] });
    expect(into?.questions[1]).toMatchObject({ id: 'Q2', kind: 'blocker', text: 'Which name?', answer: null, cites: ['PROP-902#Q1'] });
    expect(into?.questions[2]).toMatchObject({ id: 'Q3', kind: 'blocker', text: 'Which version?', answer: null, cites: [] });
    const gate = await fx.spec('', 'gate', 'PROP-902', '--format', 'json');
    const blockers = (JSON.parse(gate.stdout) as GateJson).blockers;
    const questionIds = blockers.filter((b) => b.kind === 'question').map((b) => b.id);
    expect(questionIds).toEqual(expect.arrayContaining(['PROP-902#Q1', 'PROP-902#Q2', 'PROP-902#Q3']));
    expect(blockers.some((b) => b.kind === 'schema')).toBe(false);
  }, 60_000);
});

interface CloseJson {
  ticket: string;
  absorbedInto: string;
  worktree: string | null;
  branch: string | null;
  tip: string | null;
  unmerged: number;
  stashes: { name: string; ref: string; commit: string }[];
  cleanup: string[];
}
const close = (fx: Fx, id: string, by: string, ...rest: string[]) => fx.spec('', 'ticket', 'close', id, '--superseded-by', by, ...rest);
/** Everything a refused close must leave as it was: ticket files, HEAD, refs (branches and stashes), worktrees and the index. */
const state = (fx: Fx) => ({
  tickets: allTickets(fx),
  head: fx.git('rev-parse', 'HEAD').stdout,
  refs: fx.git('for-each-ref', '--format=%(refname) %(objectname)').stdout,
  stashes: fx.git('stash', 'list', '--format=%H %gs').stdout,
  trees: fx.git('worktree', 'list', '--porcelain').stdout,
  status: fx.git('status', '--porcelain').stdout,
});
const Q1_OPEN = '  - id: Q1\n    kind: blocker\n    text: Which order?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null';
/** A project whose spec config says `tickets`, with a tracker program that lists nothing. */
const withTicketConfig = (tickets: Record<string, unknown>): Fx => {
  const fx = gitFixture('spec-close-store', {
    setup: (dir) => {
      const cfgPath = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
      cfg.tickets = tickets;
      writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
      mkdirSync(join(dir, 'tools'), { recursive: true });
      writeFileSync(join(dir, 'tools/tickets.mjs'), "process.stdout.write(JSON.stringify({ tickets: [] }));\n");
    },
  });
  made.push(fx);
  return fx;
};
const worktreesOf = (fx: Fx) => `${realpathSync(fx.repo)}.worktrees`;
/** TKT-012/S13: the line for a dirty target; the advice is a bypass a person approves, which commits and so clears the condition (R9). */
const DIRTY_212 =
  'tickets/PROP-212.md has uncommitted changes: ask the person whether to open a bypass with spec bypass, commit that file with its ADR, then close PROP-212; an approved agent must use --approved-by-person';

describe('TKT-012 spec ticket close', () => {
  it('TKT-012/S12 An open ticket in an older shape, with only a branch left', async () => {
    const older = (id: string) =>
      ['---', `id: ${id}`, 'type: proposal', 'title: Older shape', 'status: open      # set by the CLI', 'touches: [SET-001]', 'violates: []', 'depends_on: []', 'changed: []', 'questions: []', '---', 'Body.', ''].join('\n');
    const fx = mk({
      'PROP-063': tk('PROP-063', { status: 'done' }),
      'PROP-074': older('PROP-074'),
      'PROP-075': tk('PROP-075'),
      'PROP-076': tk('PROP-076'),
    });
    fx.git('branch', 'ticket/PROP-074');
    const tip = fx.git('rev-parse', '--short', 'ticket/PROP-074').stdout.trim();
    const before = file(fx, 'PROP-074');
    const superseder = file(fx, 'PROP-063');
    const refs = fx.git('for-each-ref', '--format=%(refname) %(objectname)').stdout;

    const out = await close(fx, 'PROP-074', 'PROP-063');
    expect(out.code, out.stderr).toBe(0);
    const lines = file(fx, 'PROP-074').split('\n');
    expect(lines).toContain('status: absorbed      # set by the CLI');
    expect(lines.filter((l) => l === 'absorbed_into: PROP-063')).toHaveLength(1);
    expect(lines.filter((l) => l !== 'absorbed_into: PROP-063')).toEqual(before.split('\n').map((l) => (l.startsWith('status: open') ? 'status: absorbed      # set by the CLI' : l)));
    expect(lines.some((l) => l.startsWith('stage:') || l.startsWith('history:'))).toBe(false);
    expect(file(fx, 'PROP-063')).toBe(superseder);
    expect(out.stdout).toBe(
      'PROP-074 absorbed into PROP-063 (closed; nothing was removed)\n' +
        `kept branch ticket/PROP-074 at ${tip}, every commit on it on main: git branch -d ticket/PROP-074 removes it\n`,
    );
    expect(fx.git('for-each-ref', '--format=%(refname) %(objectname)').stdout.replace(/refs\/heads\/main .*\n/, '')).toBe(refs.replace(/refs\/heads\/main .*\n/, ''));
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('PROP-063: close PROP-074 as superseded');
    expect(fx.git('show', '--name-only', '--format=', 'HEAD').stdout.trim()).toBe('tickets/PROP-074.md');
    const lint = await fx.spec('', 'lint');
    expect(lint.stdout + lint.stderr).not.toContain('PROP-074');

    // With neither branch nor worktree nor stash, the first line is the only one, and nothing is left to clean up.
    const bare = await close(fx, 'PROP-075', 'PROP-063');
    expect(bare.code, bare.stderr).toBe(0);
    expect(bare.stdout).toBe('PROP-075 absorbed into PROP-063 (closed; nothing was removed)\n');
    const json = await close(fx, 'PROP-076', 'PROP-063', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ ticket: 'PROP-076', absorbedInto: 'PROP-063', worktree: null, branch: null, tip: null, unmerged: 0, stashes: [], cleanup: [] } satisfies CloseJson);
  }, 120_000);

  it('TKT-012/S12 a stash "PROP-074 build: blocked", which a build stage left, is kept and named as any blocked stage\'s', async () => {
    const older = ['---', 'id: PROP-074', 'type: proposal', 'title: Older shape', 'status: open', 'touches: [SET-001]', 'violates: []', 'depends_on: []', 'changed: []', 'questions: []', '---', 'Body.', ''].join('\n');
    const fx = mk({ 'PROP-063': tk('PROP-063', { status: 'done' }), 'PROP-074': older });
    fx.git('branch', 'ticket/PROP-074');
    writeFileSync(join(fx.repo, 'src/app.ts'), '// a build stage\n');
    expect(fx.git('stash', 'push', '-q', '-m', 'PROP-074 build: blocked').code).toBe(0);
    const stash = fx.git('rev-parse', '--short', 'stash@{0}').stdout.trim();
    const tip = fx.git('rev-parse', '--short', 'ticket/PROP-074').stdout.trim();
    const out = await close(fx, 'PROP-074', 'PROP-063');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').filter(Boolean)).toEqual([
      'PROP-074 absorbed into PROP-063 (closed; nothing was removed)',
      `kept branch ticket/PROP-074 at ${tip}, every commit on it on main: git branch -d ticket/PROP-074 removes it`,
      `kept stash "PROP-074 build: blocked" at stash@{0} (${stash}): when git rev-parse --short stash@{0} still prints ${stash}, git stash drop stash@{0} discards it`,
    ]);
    expect(fx.git('stash', 'list').stdout).toContain('PROP-074 build: blocked');
    // The JSON output names it too.
    const again = mk({ 'PROP-063': tk('PROP-063', { status: 'done' }), 'PROP-076': older.replaceAll('PROP-074', 'PROP-076') });
    writeFileSync(join(again.repo, 'src/app.ts'), '// a build stage\n');
    expect(again.git('stash', 'push', '-q', '-m', 'PROP-076 build: blocked').code).toBe(0);
    const json = await close(again, 'PROP-076', 'PROP-063', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    expect((JSON.parse(json.stdout) as CloseJson).stashes.map((s) => s.name)).toEqual(['PROP-076 build: blocked']);
  }, 120_000);

  it.each([['double', '"'], ['single', "'"]])('TKT-012/S12 An open ticket in an older shape, with only a branch left: a %s-quoted status keeps its quotes', async (_kind, q) => {
    const text = (id: string, status: string) =>
      ['---', `id: ${id}`, 'type: proposal', 'title: Older shape', `status: ${q}${status}${q}  # set by hand`, 'touches: [SET-001]', 'violates: []', 'depends_on: []', 'changed: []', 'questions: []', '---', 'Body.', ''].join('\n');
    const fx = mk({ 'PROP-063': tk('PROP-063', { status: 'done' }), 'PROP-074': text('PROP-074', 'open') });
    const before = file(fx, 'PROP-074');
    const out = await close(fx, 'PROP-074', 'PROP-063');
    expect(out.code, out.stderr).toBe(0);
    const lines = file(fx, 'PROP-074').split('\n');
    expect(lines).toContain(`status: ${q}absorbed${q}  # set by hand`);
    expect(lines.filter((l) => l === 'absorbed_into: PROP-063')).toHaveLength(1);
    expect(lines.filter((l) => l !== 'absorbed_into: PROP-063')).toEqual(before.split('\n').map((l) => (l.startsWith('status:') ? `status: ${q}absorbed${q}  # set by hand` : l)));
  }, 120_000);

  it('TKT-012/S13 Tickets that may not be closed', async () => {
    const fx = mk({
      'PROP-201': tk('PROP-201'),
      'PROP-208': tk('PROP-208', { status: 'absorbed', absorbedInto: 'PROP-201' }),
      'PROP-205': tk('PROP-205', { status: 'in_progress', stage: 'tester', history: DONE_STAGE }),
      'PROP-206': tk('PROP-206', { status: 'done' }),
      'PROP-063': tk('PROP-063', { status: 'done' }),
      'PROP-210': tk('PROP-210', { status: 'blocked', questions: Q1_OPEN }),
      'PROP-212': tk('PROP-212', { status: 'blocked', questions: Q1_OPEN }),
      'PROP-213': tk('PROP-213'),
    });
    try {
      // PROP-213 is open on main, but the copy in its own worktree has a stage running (WSP-004/R1).
      expect((await fx.spec('', 'worktree', 'add', 'PROP-213')).code).toBe(0);
      const treeFile = join(worktreesOf(fx), 'PROP-213', 'tickets', 'PROP-213.md');
      writeFileSync(treeFile, readFileSync(treeFile, 'utf8').replace('status: open', 'status: in_progress').replace('stage: null', 'stage: tester'));
      const answered = file(fx, 'PROP-212').replace('answer: null', 'answer: yes');
      writeFileSync(join(fx.repo, 'tickets/PROP-212.md'), answered);
      const treeBefore = readFileSync(treeFile, 'utf8');
      const stopped = 'only open or blocked tickets are closed';
      const rows: [string, string, string][] = [
        ['PROP-205', 'PROP-063', `PROP-205 has its tester stage running: ${stopped}`],
        ['PROP-213', 'PROP-063', `PROP-213 has its tester stage running: ${stopped}`],
        ['PROP-206', 'PROP-063', `PROP-206 is done: ${stopped}`],
        ['PROP-208', 'PROP-063', `PROP-208 is absorbed: ${stopped}`],
        ['PROP-210', 'PROP-210', 'PROP-210 cannot be superseded by itself'],
        ['PROP-210', 'PROP-208', 'PROP-208 is absorbed into PROP-201: close PROP-210 as superseded by PROP-201 instead'],
        ['PROP-201', 'PROP-063', 'PROP-201 has absorbed PROP-208: only a ticket nothing was absorbed into is closed'],
        ['PROP-212', 'PROP-063', DIRTY_212],
      ];
      const before = state(fx);
      for (const [id, by, line] of rows) {
        const out = await close(fx, id, by);
        expect(out.stderr, `${id} ${by}`).toBe(`${line}\n`);
        expect(out.code, `${id} ${by}`).toBe(1);
        expect(out.stdout).toBe('');
        expect(state(fx), `${id} ${by}`).toEqual(before);
      }
      expect(readFileSync(treeFile, 'utf8')).toBe(treeBefore);
      expect(file(fx, 'PROP-212')).toBe(answered);
      expect(before.status).toContain(' M tickets/PROP-212.md');

      // Every problem found is printed, one per line, and nothing changes.
      const both = await close(fx, 'PROP-206', 'PROP-208');
      expect(both.stderr.trimEnd().split('\n').sort()).toEqual([`PROP-206 is done: ${stopped}`, 'PROP-208 is absorbed into PROP-201: close PROP-206 as superseded by PROP-201 instead'].sort());
      expect(both.code).toBe(1);
      expect(state(fx)).toEqual(before);

      // The same uncommitted answer, staged, is still refused and still staged.
      expect(fx.git('add', 'tickets/PROP-212.md').code).toBe(0);
      const staged = state(fx);
      expect(staged.status).toContain('M  tickets/PROP-212.md');
      const again = await close(fx, 'PROP-212', 'PROP-063');
      expect(again.stderr).toBe(`${DIRTY_212}\n`);
      expect(again.code).toBe(1);
      expect(state(fx)).toEqual(staged);
      expect(file(fx, 'PROP-212')).toBe(answered);
      expect(fx.git('reset', '-q', 'tickets/PROP-212.md').code).toBe(0);
      fx.git('checkout', '--', 'tickets/PROP-212.md');

      // Unknown ticket, and a missing option.
      const clean = state(fx);
      const unknown = await close(fx, 'PROP-210', 'PROP-29');
      expect(unknown.stderr.startsWith('Unknown PROP-29.')).toBe(true);
      expect(unknown.code).toBe(2);
      const usage = await fx.spec('', 'ticket', 'close', 'PROP-210');
      expect(usage.stderr.startsWith('usage: spec ticket close <TICKET> --superseded-by <ID>')).toBe(true);
      expect(usage.code).toBe(2);
      expect(state(fx)).toEqual(clean);

      // A staged notes.txt alone does not stop a close: it stays staged and out of the close commit.
      writeFileSync(join(fx.repo, 'notes.txt'), 'leave me staged\n');
      expect(fx.git('add', 'notes.txt').code).toBe(0);
      const done = await close(fx, 'PROP-210', 'PROP-063');
      expect(done.code, done.stderr).toBe(0);
      expect(fx.ticket('PROP-210')?.status).toBe('absorbed');
      expect(fx.git('show', '--name-only', '--format=', 'HEAD').stdout.trim()).toBe('tickets/PROP-210.md');
      expect(fx.git('diff', '--cached', '--name-only').stdout.trim()).toBe('notes.txt');
    } finally {
      fx.git('worktree', 'remove', '--force', join(worktreesOf(fx), 'PROP-213'));
      rmSync(worktreesOf(fx), { recursive: true, force: true });
    }
  }, 180_000);

  it('TKT-012/S13 A close in a ticket\'s worktree, or where tickets are not files in the repository', async () => {
    const other = mk({ 'PROP-201': tk('PROP-201'), 'PROP-202': tk('PROP-202') });
    // "main" stays checked out in the fixture's own tree; the command runs in a second worktree on another branch.
    const tree = join(tempDir('spec-close-tree-'), 'wt');
    try {
      expect(other.git('worktree', 'add', '-q', '-b', 'elsewhere', tree).code).toBe(0);
      const before = state(other);
      const refused = await run({
        argv: ['ticket', 'close', 'PROP-201', '--superseded-by', 'PROP-202', '--root', join(tree, 'spec')],
        env: {},
        cwd: tree,
        scriptPath: undefined,
        stdin: () => Promise.resolve(''),
        now: () => '2026-10-27T12:00:00.000Z',
      });
      expect(refused.code).toBe(1);
      expect(refused.stderr.startsWith('file tickets from main: run spec ticket close in ')).toBe(true);
      expect(refused.stderr).toContain(basename(other.repo));
      expect(state(other)).toEqual(before);
      expect(other.git('-C', tree, 'status', '--porcelain').stdout).toBe('');
    } finally {
      other.git('worktree', 'remove', '--force', tree);
      rmSync(join(tree, '..'), { recursive: true, force: true });
    }

    const prefix = 'spec ticket close needs tickets as files in this git repository';
    const tracker = withTicketConfig({ adapter: 'command', command: 'node tools/tickets.mjs' });
    const trackerBefore = state(tracker);
    const viaTracker = await close(tracker, 'PROP-210', 'PROP-201');
    expect(viaTracker.stderr).toBe(`${prefix}; this project keeps them in a tracker\n`);
    expect(viaTracker.code).toBe(1);
    expect(state(tracker)).toEqual(trackerBefore);

    const outside = withTicketConfig({ adapter: 'files', dir: '../tickets' });
    const outsideBefore = state(outside);
    const viaOutside = await close(outside, 'PROP-210', 'PROP-201');
    expect(viaOutside.stderr).toBe(`${prefix}; ../tickets is outside it\n`);
    expect(viaOutside.code).toBe(1);
    expect(state(outside)).toEqual(outsideBefore);

    const bare = mk({ 'PROP-201': tk('PROP-201'), 'PROP-202': tk('PROP-202') });
    rmSync(join(bare.repo, '.git'), { recursive: true, force: true });
    const ticketsBefore = allTickets(bare);
    const noGit = await close(bare, 'PROP-201', 'PROP-202');
    expect(noGit.stderr.startsWith(`${prefix}; `)).toBe(true);
    expect(noGit.stderr.trimEnd().endsWith('is in no git repository')).toBe(true);
    expect(noGit.stderr).toContain(basename(bare.repo));
    expect(noGit.code).toBe(1);
    expect(allTickets(bare)).toEqual(ticketsBefore);
  }, 120_000);
});

describe('TKT-002/S13 combine edits only the keys it owns', () => {
  it('TKT-002/S13 Combining edits only the keys combine owns', async () => {
    const from = tk('PROP-202', { statusLine: 'status: open      # set by the CLI', extra: 'owner: bob' });
    const into = tk('PROP-201', { body: 'Into body.' }).replace('touches: [SET-001]', 'touches: [SET-001]   # scope');
    const fx = mk({ 'PROP-201': into, 'PROP-202': from });
    const out = await fx.spec('', 'ticket', 'combine', 'PROP-201', 'PROP-202');
    expect(out.code, out.stderr).toBe(0);
    const absorbed = file(fx, 'PROP-202').split('\n');
    expect(absorbed).toContain('status: absorbed      # set by the CLI');
    expect(absorbed).toContain('absorbed_into: PROP-201');
    expect(absorbed.filter((l) => l !== 'absorbed_into: PROP-201')).toEqual(from.split('\n').map((l) => (l.startsWith('status: open') ? 'status: absorbed      # set by the CLI' : l)));
    const merged = file(fx, 'PROP-201').split('\n');
    expect(merged.filter((l) => l.startsWith('touches:'))).toEqual(['touches: [SET-001] # scope']);
    const owned = (l: string) => /^(touches|violates|depends_on|questions):/.test(l);
    const rest = (lines: string[]) => lines.slice(0, lines.indexOf('---', 1)).filter((l) => !owned(l));
    expect(rest(merged)).toEqual(rest(into.split('\n')));
  }, 60_000);

  it('TKT-002/S13 Closing edits only the keys close owns', async () => {
    const closed = tk('PROP-205', { status: 'blocked', statusLine: 'status: blocked   # set by the CLI', extra: 'owner: bob' });
    const by = tk('PROP-201', { body: 'By body.' }).replace('touches: [SET-001]', 'touches: [SET-001]   # scope');
    const fx = mk({ 'PROP-205': closed, 'PROP-201': by });
    const out = await close(fx, 'PROP-205', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    const lines = file(fx, 'PROP-205').split('\n');
    expect(lines).toContain('status: absorbed   # set by the CLI');
    expect(lines.filter((l) => l === 'absorbed_into: PROP-201')).toHaveLength(1);
    expect(lines.filter((l) => l !== 'absorbed_into: PROP-201')).toEqual(closed.split('\n').map((l) => (l.startsWith('status: blocked') ? 'status: absorbed   # set by the CLI' : l)));
    expect(file(fx, 'PROP-201')).toBe(by);
  }, 60_000);
});

describe('TKT-007: the absorbed blocker', () => {
  const unblock = (stdout: string) => {
    const lines = stdout.split('\n');
    const at = lines.indexOf('To unblock:');
    const rest = at < 0 ? [] : lines.slice(at + 1);
    const end = rest.indexOf('');
    return end < 0 ? rest : rest.slice(0, end);
  };

  it('TKT-007/S9 Blockers in a fixed order, each fix once', async () => {
    const open = tk('TASK-930', {
      type: 'proposal',
      touches: ['PRV-009'],
      dependsOn: ['BUG-301'],
      questions: '  - id: Q1\n    kind: blocker\n    text: Which?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null',
    });
    const fx = mk({ 'TASK-930': open });
    const out = await fx.spec('', 'gate', 'TASK-930', '--format', 'json');
    expect((JSON.parse(out.stdout) as GateJson).blockers.map((b) => b.kind)).toEqual(['schema', 'unresolved', 'question', 'dependency']);
    const text = await fx.spec('', 'gate', 'TASK-930');
    expect(unblock(text.stdout).map((l) => l.split(':')[0])).toEqual(['- schema', '- unresolved', '- question', '- dependency']);
    expect(unblock(text.stdout)[0]).toBe('- schema: fix the ticket file so it matches the ticket schema (tickets/TASK-930.md)');

    const gone = mk({ 'TASK-930': tk('TASK-930', { type: 'proposal', status: 'absorbed', absorbedInto: 'TASK-101', touches: ['PRV-009'], dependsOn: ['BUG-301'] }) });
    const after = await gone.spec('', 'gate', 'TASK-930', '--format', 'json');
    expect((JSON.parse(after.stdout) as GateJson).blockers.map((b) => b.kind)).toEqual(['absorbed']);
  }, 60_000);

  it('TKT-007/S10 How each kind is cleared', async () => {
    const ticket = tk('TASK-931', {
      type: 'proposal',
      touches: ['PRV-009', 'UI-001', 'CNV-003', 'settings.ApiKey'],
      dependsOn: ['BUG-301'],
      questions: '  - id: Q1\n    kind: blocker\n    text: Which?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null',
    });
    const fx = gitFixture('spec-combine-kinds', {
      setup: (dir) => {
        writeFileSync(join(dir, 'tickets/TASK-931.md'), ticket);
        const ui = join(dir, 'spec/ui/UI-001-fallback-notice.md');
        writeFileSync(ui, readFileSync(ui, 'utf8').replace('status: active', 'status: removed\nsuperseded_by: UI-002'));
        const cnv = join(dir, 'spec/modules/conversation/features/CNV-003-export-to-markdown.md');
        writeFileSync(cnv, readFileSync(cnv, 'utf8').replace('status: active\n', 'status: active\ndraft: true\n'));
        writeFileSync(join(dir, 'tickets/TASK-932.md'), tk('TASK-932', { type: 'task', status: 'absorbed', absorbedInto: 'TASK-101', touches: ['CNV-001'] }));
      },
    });
    made.push(fx);
    const out = await fx.spec('', 'gate', 'TASK-931', '--format', 'json');
    expect((JSON.parse(out.stdout) as GateJson).blockers.map((b) => b.kind)).toEqual(['schema', 'unresolved', 'removed', 'draft', 'question', 'scope_gap', 'dependency']);
    const text = await fx.spec('', 'gate', 'TASK-931');
    expect(unblock(text.stdout)).toEqual([
      '- schema: fix the ticket file so it matches the ticket schema (tickets/TASK-931.md)',
      '- unresolved: correct the ID in touches or violates, or create the unit first',
      '- removed: point the ticket at the unit that replaced it',
      '- draft: check the drafted unit against what the software should do, then run spec confirm <ID>',
      "- question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record",
      '- scope_gap: add the named feature to touches, or narrow the contracts the ticket touches',
      '- dependency: finish the ticket it depends on and merge its branch; this clears by itself, no answer is needed',
    ]);
    // An absorbed ticket has only the absorbed blocker, so its line is checked on its own.
    const gone = await fx.spec('', 'gate', 'TASK-932');
    expect(unblock(gone.stdout)).toEqual(['- absorbed: nothing to clear: work on the ticket it was absorbed into']);
  }, 60_000);
});

describe('TKT-010/S12 the queue leaves absorbed tickets out', () => {
  it('TKT-010/S12 Absorbed tickets are left out', async () => {
    const fx = mk({
      'PROP-202': tk('PROP-202', { status: 'absorbed', absorbedInto: 'PROP-201' }),
      'PROP-205': tk('PROP-205', { status: 'absorbed', absorbedInto: 'PROP-201' }),
    });
    const out = await fx.spec('', 'queue', '--format', 'json');
    const q = JSON.parse(out.stdout) as { ready: { id: string }[]; waiting: { id: string }[]; blocked: { id: string }[]; inProgress: { id: string }[]; done: number };
    const listed = [...q.ready, ...q.waiting, ...q.blocked, ...q.inProgress].map((e) => e.id);
    expect(listed).not.toContain('PROP-202');
    expect(listed).not.toContain('PROP-205');
    expect(q.ready.map((e) => e.id)).toContain('PROP-201');
    expect(q.done).toBe(0);
  }, 60_000);
});
