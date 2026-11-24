// PIP-020: `spec stats` measures each ticket's stages, blocks, reopens, refusals, answers, review rounds and finding classes.
// A command line runs through the CLI entry point in a git copy of chat-mini whose tickets hold the histories below.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => {
  for (const fx of fixtures) fx.cleanup();
});

/** One finding as a history record keeps it; no class when `cls` is left out. */
const finding = (cites: string, cls?: string, text = 'a finding') => `{ cites: [${cites}], text: "${text}"${cls === undefined ? '' : `, class: ${cls}`} }`;
interface Stage {
  readonly role: string;
  readonly result?: 'done' | 'blocked' | 'reopened';
  readonly verdict?: 'approve' | 'changes';
  readonly findings?: readonly string[];
  readonly refusals?: number;
  readonly duration_s?: number;
  readonly model?: string;
  readonly cost_usd?: number;
  readonly at?: string;
}
/** A history of stages, one minute apart from `day` (or the stage's own `at`), as the YAML lines of a ticket. */
const historyOf = (day: string, stages: readonly Stage[]): string[] =>
  stages.map((s, i) => {
    const at = s.at ?? `${day}T10:${String(i).padStart(2, '0')}:00.000Z`;
    const findings = s.findings === undefined ? '' : `, findings: [${s.findings.join(', ')}]`;
    const refusals = s.refusals === undefined ? '' : `, refusals: ${s.refusals}`;
    const duration = s.duration_s === undefined ? '' : `, duration_s: ${s.duration_s}`;
    const model = s.model === undefined ? '' : `, model: "${s.model}"`;
    const cost = s.cost_usd === undefined ? '' : `, cost_usd: ${s.cost_usd}`;
    return `  - { at: "${at}", role: ${s.role}, result: ${s.result ?? 'done'}, summary: x, verdict: ${s.verdict ?? 'null'}, assumed: []${findings}${refusals}${duration}${model}${cost} }`;
  });
const question = (id: string, answer: string | null) => `  - id: ${id}\n    kind: blocker\n    text: A question\n    default: null\n    cites: []\n    answer: ${answer === null ? 'null' : `"${answer}"`}\n    raised_by: null`;
interface TicketSpec {
  readonly id: string;
  readonly type: 'proposal' | 'bug' | 'task';
  readonly status?: string;
  readonly stage?: string;
  readonly questions?: readonly string[];
  readonly history?: readonly string[];
}
const ticketFile = (t: TicketSpec): string => {
  const touches = t.type === 'proposal' ? 'touches: [providers.ProviderId]' : 'touches: []';
  const violates = t.type === 'bug' ? 'violates: [PRV-002/S3]' : 'violates: []';
  const questions = t.questions === undefined || t.questions.length === 0 ? 'questions: []' : `questions:\n${t.questions.join('\n')}`;
  const history = t.history === undefined || t.history.length === 0 ? 'history: []' : `history:\n${t.history.join('\n')}`;
  return `---\nid: ${t.id}\ntype: ${t.type}\ntitle: A ticket\nstatus: ${t.status ?? 'open'}\nstage: ${t.stage ?? 'null'}\n${touches}\n${violates}\nchanged: []\n${questions}\n${history}\n---\nA ticket for stats.\n`;
};
const fixtureWith = (prefix: string, tickets: readonly TicketSpec[]): Fx => {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      for (const t of tickets) writeFileSync(join(dir, `tickets/${t.id}.md`), ticketFile(t));
    },
  });
  fixtures.push(fx);
  return fx;
};

// The histories of PIP-020/S1.
const prop201 = (day: string): TicketSpec => ({
  id: 'PROP-201',
  type: 'proposal',
  questions: [question('Q1', 'yes'), question('Q2', 'no'), question('Q3', null)],
  history: historyOf(day, [
    { role: 'spec-writer' },
    { role: 'spec-review', verdict: 'changes', findings: [finding('PRV-001/S4', 'C1'), finding('PRV-001/R1', 'C4')] },
    { role: 'spec-writer' },
    { role: 'spec-review', verdict: 'approve' },
    { role: 'tester' },
    { role: 'implementer', result: 'blocked' },
    { role: 'tester', result: 'reopened' },
    { role: 'tester' },
    { role: 'implementer', refusals: 1 },
    { role: 'reviewer', verdict: 'changes', findings: [finding('PRV-001/S3', 'C1')] },
    { role: 'implementer' },
    { role: 'reviewer', verdict: 'approve' },
  ]),
});
const bug301 = (day: string): TicketSpec => ({
  id: 'BUG-301',
  type: 'bug',
  history: historyOf(day, [{ role: 'tester' }, { role: 'implementer' }, { role: 'reviewer', verdict: 'approve' }]),
});

const stats = (fx: Fx, ...argv: string[]) => fx.spec('', 'stats', ...argv);
const COLUMNS = ['ticket', 'stages', 'time', 'timed', 'blocked', 'reopened', 'refused', 'answered', 'spec review', 'review', 'findings'];
const ROLE_COLUMNS = ['role', 'stages', 'time', 'median', 'timed', 'cost', 'costed'];

/** The cells of a table line: runs of text with single spaces, which two or more spaces separate; and where each starts and ends. */
const cellsOf = (line: string): { text: string; start: number; end: number }[] =>
  [...line.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));

/** The table before the totals, as rows of cell texts, the header first; the lines from "total:" on. */
function read(stdout: string) {
  const lines = stdout.split('\n');
  const at = lines.findIndex((line) => line.startsWith('total:'));
  expect(at, stdout).toBeGreaterThan(0);
  const roleAt = lines.findIndex((line, index) => index > at && line.trimStart().startsWith('role'));
  const table = lines.slice(0, at).filter((line) => line.trim() !== '' && !/^[\s\-─|+=]+$/.test(line));
  const parsed = table.map(cellsOf);
  const totals = lines.slice(at, roleAt < 0 ? undefined : roleAt).filter((line) => line.trim() !== '');
  const roles = roleAt < 0
    ? []
    : lines.slice(roleAt).filter((line) => line.trim() !== '' && !/^[\s\-─|+=]+$/.test(line)).map(cellsOf);
  return {
    header: parsed[0]?.map((c) => c.text) ?? [],
    rows: parsed.slice(1).map((row) => row.map((c) => c.text)),
    parsed,
    totals,
    roleHeader: roles[0]?.map((c) => c.text) ?? [],
    roleRows: roles.slice(1).map((row) => row.map((c) => c.text)),
    roleParsed: roles,
  };
}

describe('PIP-020 spec stats', () => {
  it('PIP-020/S1 One row per ticket, then the totals', async () => {
    const fx = fixtureWith('stats-s1', [prop201('2026-10-20'), bug301('2026-10-30')]);
    const out = await stats(fx);
    expect(out.code, out.stderr).toBe(0);
    const { header, rows, parsed, totals, roleHeader, roleRows, roleParsed } = read(out.stdout);
    expect(header).toEqual(COLUMNS);
    // The columns are aligned: in each, every cell starts at the same place, or every cell ends at the same place.
    for (let column = 0; column < COLUMNS.length; column++) {
      const cells = parsed.map((row) => row[column]);
      expect(cells.every((c) => c !== undefined), `column ${column}`).toBe(true);
      const starts = new Set(cells.map((c) => c?.start));
      const ends = new Set(cells.map((c) => c?.end));
      expect(starts.size === 1 || ends.size === 1, `column ${COLUMNS[column]} is aligned`).toBe(true);
    }
    expect(rows).toEqual([
      ['BUG-301', '3/3', '-', '0/3', '0', '0', '0', '0', '-', 'approve', '-'],
      ['PROP-201', '11/5', '-', '0/11', '1', '1', '1', '2', 'changes, approve', 'changes, approve', 'C1 2, C4 1'],
    ]);
    expect(totals).toEqual([
      'total: 2 tickets, 14 stages for a minimum of 8, 1 blocked, 1 reopened, 1 refused, 2 answered',
      'spec review: 2.0 rounds to approve, 0% approved in one round (1 ticket)',
      'review: 1.5 rounds to approve, 50% approved in one round (2 tickets)',
      'findings: C1 2, C4 1',
    ]);
    expect(roleHeader).toEqual(ROLE_COLUMNS);
    expect(roleRows).toEqual([
      ['spec-writer', '2', '-', '-', '0/2', '-', '0/2'],
      ['spec-review', '2', '-', '-', '0/2', '-', '0/2'],
      ['tester', '3', '-', '-', '0/3', '-', '0/3'],
      ['implementer', '4', '-', '-', '0/4', '-', '0/4'],
      ['reviewer', '3', '-', '-', '0/3', '-', '0/3'],
    ]);
    expect(roleParsed).toHaveLength(6);
    for (let column = 0; column < ROLE_COLUMNS.length; column++) {
      const cells = roleParsed.map((row) => row[column]);
      expect(cells.every((c) => c !== undefined), `role column ${column}`).toBe(true);
      const starts = new Set(cells.map((c) => c?.start));
      const ends = new Set(cells.map((c) => c?.end));
      expect(starts.size === 1 || ends.size === 1, `role column ${ROLE_COLUMNS[column]} is aligned`).toBe(true);
    }
    // Reading writes nothing.
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 60_000);

  it('PIP-020/S2 JSON output', async () => {
    const fx = fixtureWith('stats-s2', [prop201('2026-10-20'), bug301('2026-10-30')]);
    const out = await stats(fx, 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const result = JSON.parse(out.stdout) as { spec: string; tickets: unknown[]; totals: Record<string, unknown>; roles: unknown[] };
    expect(result.spec).toMatch(/^spec@\w+/);
    expect(result.tickets).toEqual([
      {
        id: 'PROP-201',
        type: 'proposal',
        stages: 11,
        minimum: 5,
        rounds: { 'spec-writer': 2, 'spec-review': 2, tester: 2, implementer: 3, reviewer: 2 },
        blocked: 1,
        reopened: 1,
        refusals: 1,
        answered: 2,
        specReview: ['changes', 'approve'],
        review: ['changes', 'approve'],
        findings: { C1: 2, C4: 1 },
        duration_s: null,
        timed: 0,
      },
    ]);
    expect(result.roles).toEqual([
      { role: 'spec-writer', stages: 2, duration_s: null, median_s: null, timed: 0, cost_usd: null, costed: 0 },
      { role: 'spec-review', stages: 2, duration_s: null, median_s: null, timed: 0, cost_usd: null, costed: 0 },
      { role: 'tester', stages: 2, duration_s: null, median_s: null, timed: 0, cost_usd: null, costed: 0 },
      { role: 'implementer', stages: 3, duration_s: null, median_s: null, timed: 0, cost_usd: null, costed: 0 },
      { role: 'reviewer', stages: 2, duration_s: null, median_s: null, timed: 0, cost_usd: null, costed: 0 },
    ]);
    expect(result.totals).toMatchObject({
      tickets: 1,
      stages: 11,
      minimum: 5,
      blocked: 1,
      reopened: 1,
      refusals: 1,
      answered: 2,
      specReview: { approved: 1, meanRounds: 2, firstRound: 0 },
      review: { approved: 1, meanRounds: 2, firstRound: 0 },
      findings: { C1: 2, C4: 1 },
    });
  }, 60_000);

  it('PIP-020/S2 JSON output, no ticket approved by a review', async () => {
    // PROP-204's latest spec-review verdict is changes and it has no reviewer verdict.
    const fx = fixtureWith('stats-s2-none', [
      { id: 'PROP-204', type: 'proposal', history: historyOf('2026-10-25', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }, { role: 'spec-review', verdict: 'changes' }]) },
    ]);
    const json = await stats(fx, 'PROP-204', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const result = JSON.parse(json.stdout) as { totals: { specReview: unknown; review: unknown; findings: unknown } };
    expect(result.totals.review).toEqual({ approved: 0, meanRounds: null, firstRound: null });
    expect(result.totals.specReview).toEqual({ approved: 0, meanRounds: null, firstRound: null });
    expect(result.totals.findings).toEqual({});
    const text = await stats(fx, 'PROP-204');
    expect(text.code, text.stderr).toBe(0);
    const lines = text.stdout.split('\n');
    expect(lines).toContain('review: no ticket approved yet');
    expect(lines).toContain('spec review: no ticket approved yet');
    expect(lines).toContain('findings: none');
  }, 60_000);

  it('PIP-020/S3 Which tickets are measured', async () => {
    const prop202 = (history: readonly string[], running: boolean): TicketSpec => ({
      id: 'PROP-202',
      type: 'proposal',
      status: running ? 'in_progress' : 'open',
      stage: running ? 'tester' : 'null',
      history,
    });
    const before = historyOf('2026-10-31', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }]);
    const fx = fixtureWith('stats-s3', [prop201('2026-10-20'), bug301('2026-10-30'), prop202(before, true)]);
    const ids = (stdout: string) => read(stdout).rows.map((row) => row[0]);
    const all = await stats(fx);
    expect(all.code, all.stderr).toBe(0);
    // TASK-101 has an empty history, so it is not measured; PROP-202's running tester stage is not counted.
    expect(ids(all.stdout)).toEqual(['BUG-301', 'PROP-201', 'PROP-202']);
    expect(read(all.stdout).rows[2]?.slice(0, 2)).toEqual(['PROP-202', '2/5']);
    // Once the stage is recorded, a run counts it.
    const recorded = historyOf('2026-10-31', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }, { role: 'tester' }]);
    writeFileSync(join(fx.repo, 'tickets/PROP-202.md'), ticketFile(prop202(recorded, false)));
    const after = await stats(fx);
    expect(read(after.stdout).rows.find((row) => row[0] === 'PROP-202')?.slice(0, 2)).toEqual(['PROP-202', '3/5']);
    writeFileSync(join(fx.repo, 'tickets/PROP-202.md'), ticketFile(prop202(before, true)));
    // --since keeps the tickets whose first entry was recorded on or after that day.
    const since = await stats(fx, '--since', '2026-10-30');
    expect(since.code, since.stderr).toBe(0);
    expect(ids(since.stdout)).toEqual(['BUG-301', 'PROP-202']);
    // A ticket named on the command line is shown even with an empty history.
    const named = await stats(fx, 'TASK-101');
    expect(named.code, named.stderr).toBe(0);
    const namedTable = read(named.stdout);
    expect(namedTable.rows).toEqual([['TASK-101', '0/2', '-', '0/0', '0', '0', '0', '0', '-', '-', '-']]);
    expect(namedTable.roleHeader).toEqual([]);
    expect(named.stdout.trimEnd().split('\n').at(-1)).toBe('findings: none');
    // No ticket left: one line, exit 0; in JSON, no tickets.
    const none = await stats(fx, '--since', '2026-11-01');
    expect(none.code, none.stderr).toBe(0);
    expect(none.stdout.trim()).toBe('no tickets with a recorded stage');
    const noneJson = await stats(fx, '--since', '2026-11-01', '--format', 'json');
    expect(noneJson.code, noneJson.stderr).toBe(0);
    expect((JSON.parse(noneJson.stdout) as { tickets: unknown[]; roles: unknown[] })).toMatchObject({ tickets: [], roles: [] });
    const namedJson = await stats(fx, 'TASK-101', '--format', 'json');
    expect(namedJson.code, namedJson.stderr).toBe(0);
    expect((JSON.parse(namedJson.stdout) as { roles: unknown[] }).roles).toEqual([]);
  }, 120_000);

  it('PIP-020/S3 Which tickets are measured, the day is a UTC day', async () => {
    const fx = fixtureWith('stats-s3-utc', [
      { id: 'TASK-102', type: 'task', history: historyOf('2026-10-29', [{ role: 'implementer', at: '2026-10-29T23:59:59.999Z' }]) },
      { id: 'TASK-103', type: 'task', history: historyOf('2026-10-30', [{ role: 'implementer', at: '2026-10-30T00:00:00.000Z' }]) },
    ]);
    const out = await stats(fx, '--since', '2026-10-30');
    expect(out.code, out.stderr).toBe(0);
    expect(read(out.stdout).rows.map((row) => row[0])).toEqual(['TASK-103']);
    // A ticket's first entry decides, not a later one.
    const later = fixtureWith('stats-s3-first', [
      { id: 'TASK-102', type: 'task', history: historyOf('2026-10-29', [{ role: 'implementer', at: '2026-10-20T10:00:00.000Z' }, { role: 'reviewer', verdict: 'approve', at: '2026-10-31T10:00:00.000Z' }]) },
    ]);
    const first = await stats(later, '--since', '2026-10-30');
    expect(first.stdout.trim()).toBe('no tickets with a recorded stage');
  }, 120_000);

  it('PIP-020/S4 A history recorded by an earlier version', async () => {
    const old = (cls: string | undefined): TicketSpec => ({
      id: 'PROP-205',
      type: 'proposal',
      history: historyOf('2026-10-10', [
        { role: 'spec-writer' },
        { role: 'tester' },
        { role: 'implementer' },
        { role: 'reviewer', verdict: 'changes', findings: [finding('PRV-001/S3', cls)] },
        { role: 'implementer' },
        { role: 'reviewer', verdict: 'approve' },
      ]),
    });
    const fx = fixtureWith('stats-s4', [old(undefined)]);
    const out = await stats(fx, 'PROP-205');
    expect(out.code, out.stderr).toBe(0);
    expect(read(out.stdout).rows).toEqual([['PROP-205', '6/4', '-', '0/6', '0', '0', '0', '0', '-', 'changes, approve', 'unclassified 1']]);
    // A class outside the finding classes, as a hand-edited history may hold, is unclassified too.
    writeFileSync(join(fx.repo, 'tickets/PROP-205.md'), ticketFile(old('C10')));
    const edited = await stats(fx, 'PROP-205');
    expect(edited.code, edited.stderr).toBe(0);
    expect(read(edited.stdout).rows).toEqual([['PROP-205', '6/4', '-', '0/6', '0', '0', '0', '0', '-', 'changes, approve', 'unclassified 1']]);
    // Findings of the classes count in class order, with other and unclassified last.
    const mixed: TicketSpec = {
      id: 'PROP-205',
      type: 'proposal',
      history: historyOf('2026-10-10', [
        { role: 'spec-writer' },
        { role: 'tester' },
        { role: 'implementer' },
        { role: 'reviewer', verdict: 'changes', findings: [finding('PRV-001/S3', 'C10'), finding('PRV-001/S3', 'other'), finding('PRV-001/S3', 'C9'), finding('PRV-001/S3'), finding('PRV-001/S3', 'C2'), finding('PRV-001/S3', 'C9')] },
      ]),
    };
    writeFileSync(join(fx.repo, 'tickets/PROP-205.md'), ticketFile(mixed));
    const ordered = await stats(fx, 'PROP-205');
    expect(read(ordered.stdout).rows[0]?.[10]).toBe('C2 1, C9 2, other 1, unclassified 2');
    expect(read(ordered.stdout).totals.at(-1)).toBe('findings: C2 1, C9 2, other 1, unclassified 2');
  }, 120_000);

  it('PIP-020/S5 A wrong command line', async () => {
    const fx = fixtureWith('stats-s5', [prop201('2026-10-20'), bug301('2026-10-30')]);
    const unknown = await stats(fx, 'PROP-999');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr.startsWith('Unknown PROP-999.')).toBe(true);
    expect(unknown.stdout).toBe('');
    // One unknown ID among known ones refuses the whole command before anything is printed.
    const mixed = await stats(fx, 'PROP-201', 'PROP-999');
    expect(mixed.code).toBe(2);
    expect(mixed.stderr.startsWith('Unknown PROP-999.')).toBe(true);
    expect(mixed.stdout).toBe('');
    const word = await stats(fx, '--since', 'yesterday');
    expect(word.code).toBe(2);
    expect(word.stderr.startsWith('--since is a date as YYYY-MM-DD, not yesterday')).toBe(true);
    expect(word.stdout).toBe('');
    const impossible = await stats(fx, '--since', '2026-02-30');
    expect(impossible.code).toBe(2);
    expect(impossible.stderr.startsWith('--since is a date as YYYY-MM-DD, not 2026-02-30')).toBe(true);
    expect(impossible.stdout).toBe('');
    const json = await stats(fx, '--since', 'yesterday', '--format', 'json');
    expect(json.code).toBe(2);
    expect(json.stdout).toBe('');
    // A real day is accepted.
    expect((await stats(fx, '--since', '2026-02-28')).code).toBe(0);
  }, 60_000);

  it('PIP-020/S6 A review that ran again after approving counts every round', async () => {
    const rereview = historyOf('2026-10-12', [
      { role: 'spec-writer' },
      { role: 'spec-review', verdict: 'approve' },
      { role: 'tester' },
      { role: 'implementer' },
      { role: 'reviewer', verdict: 'changes', findings: [finding('PRV-001/S3', 'C1')] },
      { role: 'spec-writer' },
      { role: 'spec-review', verdict: 'changes', findings: [finding('PRV-001/S4', 'C1')] },
      { role: 'spec-writer' },
      { role: 'spec-review', verdict: 'approve' },
      { role: 'tester' },
      { role: 'implementer' },
      { role: 'reviewer', verdict: 'approve' },
    ]);
    const back = historyOf('2026-10-13', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }, { role: 'spec-review', verdict: 'changes' }]);
    const fx = fixtureWith('stats-s6', [
      { id: 'PROP-203', type: 'proposal', status: 'done', history: rereview },
      { id: 'PROP-204', type: 'proposal', history: back },
    ]);
    const json = await stats(fx, 'PROP-203', 'PROP-204', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const result = JSON.parse(json.stdout) as { tickets: { id: string; specReview: string[]; review: string[] }[]; totals: { specReview: unknown; review: unknown } };
    expect(result.tickets.map((t) => [t.id, t.specReview, t.review])).toEqual([
      ['PROP-203', ['approve', 'changes', 'approve'], ['changes', 'approve']],
      ['PROP-204', ['approve', 'changes'], []],
    ]);
    // PROP-203 took 3 rounds, not 1; PROP-204, whose latest verdict is changes, is not approved.
    expect(result.totals.specReview).toEqual({ approved: 1, meanRounds: 3, firstRound: 0 });
    expect(result.totals.review).toEqual({ approved: 1, meanRounds: 2, firstRound: 0 });
    const text = await stats(fx, 'PROP-203', 'PROP-204');
    expect(text.code, text.stderr).toBe(0);
    const { totals, rows } = read(text.stdout);
    expect(totals).toContain('spec review: 3.0 rounds to approve, 0% approved in one round (1 ticket)');
    expect(totals).toContain('review: 2.0 rounds to approve, 0% approved in one round (1 ticket)');
    expect(rows.map((row) => [row[0], row[8], row[9]])).toEqual([
      ['PROP-203', 'approve, changes, approve', 'changes, approve'],
      ['PROP-204', 'approve, changes', '-'],
    ]);
  }, 60_000);

  it('PIP-020/S6 A ticket approved in its only round counts as approved in one round', async () => {
    const fx = fixtureWith('stats-s6-first', [
      { id: 'PROP-203', type: 'proposal', history: historyOf('2026-10-12', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }]) },
      { id: 'PROP-204', type: 'proposal', history: historyOf('2026-10-13', [{ role: 'spec-writer' }, { role: 'spec-review', verdict: 'changes' }, { role: 'spec-writer' }, { role: 'spec-review', verdict: 'approve' }]) },
    ]);
    const out = await stats(fx, 'PROP-203', 'PROP-204', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).not.toBe('');
    const result = JSON.parse(out.stdout) as { totals: { specReview: unknown } };
    expect(result.totals.specReview).toEqual({ approved: 2, meanRounds: 1.5, firstRound: 0.5 });
    const text = await stats(fx, 'PROP-203', 'PROP-204');
    expect(text.code, text.stderr).toBe(0);
    expect(read(text.stdout).totals).toContain('spec review: 1.5 rounds to approve, 50% approved in one round (2 tickets)');
  }, 60_000);

  it('PIP-020/S8 Time per ticket, and stages, time and cost per role', async () => {
    const fx = fixtureWith('stats-s8', [
      {
        id: 'PROP-220',
        type: 'proposal',
        history: historyOf('2026-10-20', [
          { role: 'spec-writer', duration_s: 600, model: 'claude-opus-5-5', cost_usd: 1.25 },
          { role: 'spec-review', verdict: 'approve', duration_s: 300 },
          { role: 'tester', duration_s: 1800, cost_usd: 0.5 },
          { role: 'implementer', result: 'blocked', duration_s: 1000 },
          { role: 'implementer', duration_s: 2001 },
          { role: 'reviewer', verdict: 'approve', duration_s: 400 },
        ]),
      },
      {
        id: 'TASK-120',
        type: 'task',
        history: historyOf('2026-10-21', [
          { role: 'implementer' },
          { role: 'reviewer', verdict: 'approve', duration_s: 3600, cost_usd: 0.25 },
        ]),
      },
    ]);
    const out = await stats(fx, 'PROP-220', 'TASK-120');
    expect(out.code, out.stderr).toBe(0);
    const { rows, roleHeader, roleRows } = read(out.stdout);
    expect(rows.map((row) => [row[0], row[2], row[3]])).toEqual([
      ['PROP-220', '1:41:41', '6/6'],
      ['TASK-120', '1:00:00', '1/2'],
    ]);
    expect(roleHeader).toEqual(ROLE_COLUMNS);
    expect(roleRows).toEqual([
      ['spec-writer', '1', '0:10:00', '0:10:00', '1/1', '$1.25', '1/1'],
      ['spec-review', '1', '0:05:00', '0:05:00', '1/1', '-', '0/1'],
      ['tester', '1', '0:30:00', '0:30:00', '1/1', '$0.50', '1/1'],
      ['implementer', '3', '0:50:01', '0:25:00', '2/3', '-', '0/3'],
      ['reviewer', '2', '1:06:40', '0:33:20', '2/2', '$0.25', '1/2'],
    ]);
    const json = await stats(fx, 'PROP-220', 'TASK-120', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const result = JSON.parse(json.stdout) as {
      tickets: { id: string; duration_s: number | null; timed: number }[];
      roles: { role: string; stages: number; duration_s: number | null; median_s: number | null; timed: number; cost_usd: number | null; costed: number }[];
    };
    expect(result.tickets.map(({ id, duration_s, timed }) => [id, duration_s, timed])).toEqual([
      ['PROP-220', 6101, 6],
      ['TASK-120', 3600, 1],
    ]);
    expect(result.roles.slice(-2)).toEqual([
      { role: 'implementer', stages: 3, duration_s: 3001, median_s: 1500, timed: 2, cost_usd: null, costed: 0 },
      { role: 'reviewer', stages: 2, duration_s: 4000, median_s: 2000, timed: 2, cost_usd: 0.25, costed: 1 },
    ]);
    const taskOnly = await stats(fx, 'TASK-120');
    expect(read(taskOnly.stdout).roleRows).toEqual([
      ['implementer', '1', '-', '-', '0/1', '-', '0/1'],
      ['reviewer', '1', '1:00:00', '1:00:00', '1/1', '$0.25', '1/1'],
    ]);
  }, 60_000);

  it('PIP-020/S9 Waiting time is in the time, and cost is rounded only in text', async () => {
    const fx = fixtureWith('stats-s9', [{
      id: 'PROP-230',
      type: 'proposal',
      history: historyOf('2026-10-22', [
        { role: 'spec-writer', duration_s: 300, cost_usd: 0.1 },
        { role: 'spec-review', verdict: 'changes', duration_s: 60 },
        { role: 'spec-writer', duration_s: 240, cost_usd: 0.2 },
        { role: 'spec-review', verdict: 'approve', duration_s: 60 },
        { role: 'tester', duration_s: 2400, cost_usd: 0.125 },
      ]),
    }, {
      id: 'PROP-232',
      type: 'proposal',
      history: historyOf('2026-10-23', [
        { role: 'spec-writer', cost_usd: 1.005 },
        { role: 'tester', cost_usd: 2.675 },
        { role: 'implementer', cost_usd: 0.004999 },
      ]),
    }]);
    const out = await stats(fx, 'PROP-230');
    expect(out.code, out.stderr).toBe(0);
    const { rows, roleRows } = read(out.stdout);
    expect(rows.map((row) => [row[0], row[2], row[3]])).toEqual([['PROP-230', '0:51:00', '5/5']]);
    expect(roleRows).toEqual([
      ['spec-writer', '2', '0:09:00', '0:04:30', '2/2', '$0.30', '2/2'],
      ['spec-review', '2', '0:02:00', '0:01:00', '2/2', '-', '0/2'],
      ['tester', '1', '0:40:00', '0:40:00', '1/1', '$0.13', '1/1'],
    ]);
    const json = await stats(fx, 'PROP-230', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    const roles = (JSON.parse(json.stdout) as { roles: { role: string; cost_usd: number | null }[] }).roles;
    expect(roles.find((role) => role.role === 'spec-writer')?.cost_usd).toBe(0.30000000000000004);
    expect(roles.find((role) => role.role === 'tester')?.cost_usd).toBe(0.125);

    const decimalCosts = await stats(fx, 'PROP-232');
    expect(decimalCosts.code, decimalCosts.stderr).toBe(0);
    expect(read(decimalCosts.stdout).roleRows.map((row) => [row[0], row[5]])).toEqual([
      ['spec-writer', '$1.01'],
      ['tester', '$2.68'],
      ['implementer', '$0.00'],
    ]);
  }, 60_000);

  it('PIP-020/S10 A record with a cost, duration or model out of bounds is not measured', async () => {
    const fx = fixtureWith('stats-s10', [{
      id: 'PROP-220',
      type: 'proposal',
      history: historyOf('2026-10-20', [
        { role: 'spec-writer', duration_s: 600, cost_usd: 1.25 },
        { role: 'spec-review', verdict: 'approve', duration_s: 300 },
        { role: 'tester', duration_s: 1800, cost_usd: 0.5 },
      ]),
    }]);
    const invalidRecords = [
      ...['-1', '1000000', '1e308', '"0.42"', '.inf'].map((cost) => `{ at: "2026-10-23T10:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [], cost_usd: ${cost} }`),
      '{ at: "2026-10-23T10:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [], duration_s: 1.5 }',
      '{ at: "2026-10-23T10:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [], duration_s: -5 }',
      '{ at: "2026-10-23T10:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [], model: "" }',
      '{ at: "2026-10-23T10:00:00.000Z", role: tester, result: done, summary: x, verdict: null, assumed: [], model: "claude\\u2028" }',
    ];
    for (const record of invalidRecords) {
      const source = ticketFile({ id: 'PROP-231', type: 'proposal', history: [`  - ${record}`] });
      writeFileSync(join(fx.repo, 'tickets/PROP-231.md'), source);
      const lint = await fx.spec('', 'lint');
      expect(lint.stdout, lint.stderr).toContain('L020');
      expect(lint.stdout, lint.stderr).toContain('tickets/PROP-231.md');
      const out = await stats(fx, '--format', 'json');
      expect(out.code, out.stderr).toBe(0);
      const result = JSON.parse(out.stdout) as {
        tickets: { id: string }[];
        roles: { role: string; stages: number; duration_s: number | null; median_s: number | null; timed: number; cost_usd: number | null; costed: number }[];
      };
      expect(result.tickets.map((ticket) => ticket.id)).toEqual(['PROP-220']);
      expect(result.roles).toEqual([
        { role: 'spec-writer', stages: 1, duration_s: 600, median_s: 600, timed: 1, cost_usd: 1.25, costed: 1 },
        { role: 'spec-review', stages: 1, duration_s: 300, median_s: 300, timed: 1, cost_usd: null, costed: 0 },
        { role: 'tester', stages: 1, duration_s: 1800, median_s: 1800, timed: 1, cost_usd: 0.5, costed: 1 },
      ]);
      const byId = await stats(fx, 'PROP-231');
      expect(byId.code).toBe(2);
      expect(byId.stderr).toContain('Unknown PROP-231');
    }
  }, 60_000);
});
