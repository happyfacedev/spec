// Tickets in any tracker, through a command (TKT-004). The tracker is tools/tickets.mjs, a small
// program each fixture gets: it keeps its entries and scripted replies in tracker.json, in the
// project root, and records what put is sent in puts.jsonl (both git-ignored).
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Finding } from '../../src/core/findings';
import { parseTicket } from '../../src/core/parse/tickets';
import type { Queue } from '../../src/core/queue';
import { CommandTicketStore } from '../../src/io/ticket-store';
import { FIXTURE, gitFixture } from '../helpers';

/** The tracker program. A put that saves writes its text into the entries. */
const ADAPTER = `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const [op, id] = process.argv.slice(2);
const state = JSON.parse(readFileSync('tracker.json', 'utf8'));
if (op === 'list' && state.list) {
  process.stdout.write(state.list.stdout);
  process.stderr.write(state.list.stderr);
  process.exitCode = state.list.exit;
} else if (op === 'list') {
  process.stdout.write(JSON.stringify({ tickets: Object.entries(state.tickets).map(([key, text]) => ({ id: key, text })) }));
} else if (op === 'put' && id) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  appendFileSync('puts.jsonl', JSON.stringify({ args: [op, id], input }) + '\\n');
  const reply = state.put ?? { exit: 0, stdout: '{"ok":true}', stderr: '', saves: true };
  if (reply.saves) {
    state.tickets[id] = input.text;
    writeFileSync('tracker.json', JSON.stringify(state));
  }
  process.stdout.write(reply.stdout);
  process.stderr.write(reply.stderr);
  process.exitCode = reply.exit;
} else {
  process.exitCode = 2;
}
`;

type Reply = { exit: number; stdout: string; stderr: string; saves: boolean };
type Tracker = { tickets: Record<string, string>; list?: Omit<Reply, 'saves'>; put?: Reply };
type Put = { args: string[]; input: { id: string; text: string; previous: string | null; note: string | null } };

const made: (() => void)[] = [];
afterAll(() => {
  for (const cleanup of made) cleanup();
});

/** A throwaway copy of chat-mini whose tickets live in the tracker: the repo's tickets dir is removed. */
function tracker(state: Tracker) {
  const f = gitFixture('spec-tracker-tickets', {
    setup: (dir) => {
      rmSync(join(dir, 'tickets'), { recursive: true, force: true });
      mkdirSync(join(dir, 'tools'), { recursive: true });
      writeFileSync(join(dir, 'tools/tickets.mjs'), ADAPTER);
      writeFileSync(join(dir, 'tracker.json'), JSON.stringify(state));
      appendFileSync(join(dir, '.gitignore'), '\ntracker.json\nputs.jsonl\n');
      const cfgPath = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
      cfg.tickets = { adapter: 'command', command: 'node tools/tickets.mjs' };
      writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
    },
  });
  made.push(f.cleanup);
  return f;
}

const ticketText = (id: string): string => readFileSync(join(FIXTURE, 'tickets', `${id}.md`), 'utf8');
/** TASK-103 (open) and BUG-301 (open, next stage tester): the two tickets of the examples. */
const TWO = (): Record<string, string> => ({ 'TASK-103': ticketText('TASK-103'), 'BUG-301': ticketText('BUG-301') });
const NEW_TASK = JSON.stringify({ type: 'task', title: 'Tidy the export', touches: ['CNV-003'], body: 'Tidy it.' });

/** The entries the tracker holds now, as its own file has them. */
const saved = (f: { repo: string }): Record<string, string> => (JSON.parse(readFileSync(join(f.repo, 'tracker.json'), 'utf8')) as { tickets: Record<string, string> }).tickets;
/** Every put the CLI sent, in order. */
const puts = (f: { repo: string }): Put[] => {
  const file = join(f.repo, 'puts.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Put) : [];
};
const findingsOf = (stdout: string): Finding[] => (JSON.parse(stdout) as { findings: Finding[] }).findings;
const queueOf = (stdout: string): Queue => JSON.parse(stdout) as Queue;
const queued = (q: Queue): string[] => [...q.ready, ...q.waiting, ...q.blocked, ...q.inProgress].map((e) => e.id);
const statusOf = (text: string): string | undefined => parseTicket('tickets/X.md', text).ticket?.data.status;

describe('tickets in any tracker, through a command (TKT-004)', () => {
  it('TKT-004/S1 The tracker is listed', async () => {
    const f = tracker({ tickets: TWO() });
    const out = await f.spec('', 'queue');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain('## Ready (2)\n- BUG-301 bug · next tester · Fallback moves on to a third provider');
  }, 30_000);

  it('TKT-004/S2 A ticket is updated with put', async () => {
    const f = tracker({ tickets: TWO() });
    const out = await f.spec('', 'ticket', 'start', 'TASK-103', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(puts(f)).toEqual([
      expect.objectContaining({
        args: ['put', 'TASK-103'],
        input: expect.objectContaining({ id: 'TASK-103', previous: ticketText('TASK-103'), note: 'TASK-103 implementer: started' }) as unknown,
      }),
    ]);
    // The whole new ticket: the same ticket, with its status and stage changed.
    const text = puts(f)[0]?.input.text ?? '';
    expect(text).toBe(saved(f)['TASK-103']);
    expect(parseTicket('tickets/TASK-103.md', text).ticket?.data).toMatchObject({ id: 'TASK-103', title: 'Simplify the fallback code', status: 'in_progress', stage: 'implementer' });
  }, 30_000);

  it('TKT-004/S3 A new ticket is created with put', async () => {
    const f = tracker({ tickets: TWO() });
    const out = await f.spec(NEW_TASK, 'ticket', 'new');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n')[0]).toBe('TASK-104 created');
    expect(puts(f)).toEqual([
      expect.objectContaining({ args: ['put', 'TASK-104'], input: expect.objectContaining({ id: 'TASK-104', previous: null, note: 'TASK-104: new ticket' }) as unknown }),
    ]);
  }, 30_000);

  it('TKT-004/S4 Tickets from a tracker are named by a virtual path', async () => {
    const f = tracker({ tickets: { 'TASK-103': 'not a ticket file\n', 'BUG-301': ticketText('BUG-301') } });
    const out = await f.spec('', 'gate', 'TASK-103');
    expect(out.code).toBe(1);
    expect(out.stdout).toMatch(/^- schema TASK-103: /m);
    expect(out.stdout).toContain('- schema: fix the ticket file so it matches the ticket schema (tracker/TASK-103.md)');
  }, 30_000);

  it('TKT-004/S5 An entry whose ID is not a ticket ID is skipped', async () => {
    const f = tracker({ tickets: { 'TASK-103': ticketText('TASK-103'), notes: 'hello' } });
    const out = await f.spec('', 'queue', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(queued(queueOf(out.stdout))).toEqual(['TASK-103']);
  }, 30_000);

  it('TKT-004/S6 The tracker refuses an update', async () => {
    const f = tracker({
      tickets: TWO(),
      put: { exit: 0, stdout: '{"ok":false,"error":"BUG-301 changed since it was read"}', stderr: '', saves: false },
    });
    const out = await f.spec('', 'ticket', 'start', 'BUG-301', 'tester');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('the tracker refused the update: BUG-301 changed since it was read');
    expect(saved(f)['BUG-301']).toBe(ticketText('BUG-301'));
  }, 30_000);

  it('TKT-004/S7 The tracker refuses a new ticket', async () => {
    const f = tracker({ tickets: TWO(), put: { exit: 0, stdout: '{"ok":false,"error":"read only"}', stderr: '', saves: false } });
    const out = await f.spec(NEW_TASK, 'ticket', 'new');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('the tracker refused the ticket: read only');
    expect(saved(f)).not.toHaveProperty('TASK-104');
  }, 30_000);

  it('TKT-004/S8 An empty reply to put is success', async () => {
    const f = tracker({ tickets: TWO(), put: { exit: 0, stdout: '', stderr: '', saves: true } });
    const out = await f.spec('', 'ticket', 'start', 'TASK-103', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain('TASK-103: stage implementer');
    expect(statusOf(saved(f)['TASK-103'] ?? '')).toBe('in_progress');
  }, 30_000);

  it('TKT-004/S9 The command exits non-zero', async () => {
    const f = tracker({ tickets: TWO(), put: { exit: 3, stdout: '', stderr: 'a\nb\nc\nd\n', saves: false } });
    const out = await f.spec('', 'ticket', 'start', 'TASK-103', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('the tickets command exited 3: b | c | d');
  }, 30_000);

  it('TKT-004/S10 list fails', async () => {
    const f = tracker({ tickets: TWO(), list: { exit: 1, stdout: '', stderr: 'no network\n' } });
    const lint = await f.spec('', 'lint', '--format', 'json');
    expect(findingsOf(lint.stdout)).toContainEqual(
      expect.objectContaining({
        rule: 'L020',
        file: 'tracker',
        line: 1,
        message: expect.stringMatching(/^the tickets command exited 1/) as string,
        fix: 'fix the tickets command in config.json (docs/TICKETS.md)',
      }),
    );
    // No ticket is read: the queue holds none.
    const queue = await f.spec('', 'queue', '--format', 'json');
    expect(queued(queueOf(queue.stdout))).toEqual([]);
  }, 30_000);

  it('TKT-004/S11 list prints something other than the protocol', async () => {
    const f = tracker({ tickets: TWO(), list: { exit: 0, stdout: 'hello', stderr: '' } });
    const lint = await f.spec('', 'lint', '--format', 'json');
    expect(findingsOf(lint.stdout)).toContainEqual(
      expect.objectContaining({
        rule: 'L020',
        file: 'tracker',
        message: expect.stringMatching(/^`list` did not print \{"tickets":\[\{"id","text"\}\]\}/) as string,
      }),
    );
  }, 30_000);

  it('TKT-004/S12 A ticket that is not in the tracker', async () => {
    // The CLI checks a ticket is listed before it changes it, so the store is asked directly.
    const f = tracker({ tickets: TWO() });
    const store = new CommandTicketStore('node tools/tickets.mjs', f.repo);
    expect(await store.update('TASK-999', { status: 'in_progress' })).toEqual({ ok: false, error: 'ticket TASK-999 is not in the tracker' });
  }, 30_000);

  it('TKT-004/S13 A new ticket whose ID the tracker already holds', async () => {
    // The CLI numbers a new ticket after every listed one, so the store is asked directly.
    const held = ticketText('TASK-103').replace('id: TASK-103', 'id: TASK-104');
    expect(held).toContain('id: TASK-104');
    const f = tracker({ tickets: { ...TWO(), 'TASK-104': held } });
    const store = new CommandTicketStore('node tools/tickets.mjs', f.repo);
    expect(await store.create('TASK-104', held)).toEqual({ ok: false, error: 'TASK-104 already exists in the tracker' });
    expect(puts(f)).toEqual([]);
  }, 30_000);

  it('TKT-004/S14 An entry whose ID is not a ticket ID is reported by lint', async () => {
    const f = tracker({ tickets: { 'TASK-103': ticketText('TASK-103'), notes: 'hello' } });
    const out = await f.spec('', 'lint', '--format', 'json');
    expect(out.code).toBe(0);
    expect(findingsOf(out.stdout)).toContainEqual(
      expect.objectContaining({
        rule: 'L020',
        severity: 'warning',
        file: 'tracker',
        line: 1,
        id: null,
        message: '`list` listed "notes", which is not a ticket ID',
        fix: 'fix the tickets command in config.json (docs/TICKETS.md)',
      }),
    );
  }, 30_000);

  it('TKT-004/R6 An entry that list returns with an ID that is not a ticket ID is left out of the tickets, and lint reports it as an L020 warning, never as an error', async () => {
    const f = tracker({ tickets: { 'TASK-103': ticketText('TASK-103'), notes: 'hello', 'task-104': 'hello' } });
    const queue = await f.spec('', 'queue', '--format', 'json');
    expect(queued(queueOf(queue.stdout))).toEqual(['TASK-103']);
    const lint = await f.spec('', 'lint', '--format', 'json');
    expect(lint.code).toBe(0);
    const left = findingsOf(lint.stdout).filter((x) => x.file === 'tracker');
    expect(left).toHaveLength(2);
    for (const x of left) expect(x).toMatchObject({ rule: 'L020', severity: 'warning', file: 'tracker', line: 1, id: null });
    expect(left.map((x) => x.message)).toEqual(
      expect.arrayContaining(['`list` listed "notes", which is not a ticket ID', '`list` listed "task-104", which is not a ticket ID']),
    );
  }, 30_000);
});
