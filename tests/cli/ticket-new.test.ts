// TKT-005 spec ticket new: structured fields in, a ticket with the next free ID out, committed and gated.
// Each test runs the CLI on its own copy of chat-mini (highest PROP-206, BUG-302, TASK-103).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture } from '../helpers';

type Fixture = ReturnType<typeof gitFixture>;
type NewResult = { ticket: string; file: string | null; dryRun?: boolean; gate: { ready: boolean; blockers: { kind: string; id: string }[]; preferences: { id: string }[] } };

const fixtures: Fixture[] = [];
afterAll(() => {
  for (const f of fixtures) f.cleanup();
});
const mk = (prefix: string, setup?: (dir: string) => void): Fixture => {
  const fx = gitFixture(prefix, { setup });
  fixtures.push(fx);
  return fx;
};
const create = (fx: Fixture, input: object, ...extra: string[]) => fx.spec(JSON.stringify(input), 'ticket', 'new', ...extra);
const createJson = (fx: Fixture, input: object, ...extra: string[]) => create(fx, input, '--format', 'json', ...extra);
const read = (fx: Fixture, file: string) => readFileSync(join(fx.repo, file), 'utf8');
const ticketFiles = (fx: Fixture) => readdirSync(join(fx.repo, 'tickets')).sort();
/** A tracker program: its first list prints tracker-list.json, and every later list exits 3. */
const LISTER = `import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const [op] = process.argv.slice(2);
if (op !== 'list') process.exitCode = 2;
else if (existsSync('listed')) {
  process.stderr.write('the tracker answers the first list only\\n');
  process.exitCode = 3;
} else {
  writeFileSync('listed', '');
  process.stdout.write(readFileSync('tracker-list.json', 'utf8'));
}
`;
/** A throwaway chat-mini whose tickets live in a command tracker that holds TASK-103. */
const commandTracker = (prefix: string): Fixture =>
  mk(prefix, (dir) => {
    const text = readFileSync(join(dir, 'tickets/TASK-103.md'), 'utf8');
    rmSync(join(dir, 'tickets'), { recursive: true, force: true });
    mkdirSync(join(dir, 'tools'), { recursive: true });
    writeFileSync(join(dir, 'tools/tickets.mjs'), LISTER);
    writeFileSync(join(dir, 'tracker-list.json'), JSON.stringify({ tickets: [{ id: 'TASK-103', text }] }));
    appendFileSync(join(dir, '.gitignore'), '\nlisted\n');
    const cfgPath = join(dir, 'spec/config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
    cfg.tickets = { adapter: 'command', command: 'node tools/tickets.mjs' };
    writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  });

const PROPOSAL = {
  type: 'proposal',
  title: 'Show the token count under each reply',
  touches: ['PRV-003'],
  questions: [{ kind: 'preference', text: 'Show counts for replies that were stopped?', default: 'yes' }],
  body: 'Under each reply, show how many tokens it used.',
};
const TASK = { type: 'task', title: 'Tidy the export', touches: ['CNV-003'], body: 'Tidy it.' };

describe('TKT-005 spec ticket new', () => {
  it('TKT-005/S1 The next ID of each type', async () => {
    const fx = mk('tkt-s1');
    const r = JSON.parse((await createJson(fx, PROPOSAL)).stdout) as NewResult;
    expect(r.ticket).toBe('PROP-207');
  });

  it('TKT-005/S2 The first ticket of a type', async () => {
    const fx = mk('tkt-s2', (dir) => {
      for (const f of readdirSync(join(dir, 'tickets'))) if (f.startsWith('TASK-')) rmSync(join(dir, 'tickets', f));
    });
    const r = JSON.parse((await createJson(fx, TASK)).stdout) as NewResult;
    expect(r.ticket).toBe('TASK-001');
  });

  it('TKT-005/S3 A ticket file that does not parse still holds its ID', async () => {
    const fx = mk('tkt-s3', (dir) => {
      rmSync(join(dir, 'tickets/TASK-102.md'));
      rmSync(join(dir, 'tickets/TASK-103.md'));
      writeFileSync(join(dir, 'tickets/TASK-150.md'), 'this is not a ticket\n');
    });
    const out = await create(fx, TASK);
    expect(out.stdout).toMatch(/^TASK-151 created/);
  });

  it('TKT-005/S4 The ticket as written', async () => {
    const fx = mk('tkt-s4');
    const out = await createJson(fx, PROPOSAL);
    expect(out.code, out.stderr).toBe(0);
    expect(read(fx, 'tickets/PROP-207.md')).toBe(`---
id: PROP-207
type: proposal
title: Show the token count under each reply
status: open
stage: null
touches: [PRV-003]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: Show counts for replies that were stopped?
    default: yes
    cites: []
    answer: null
    raised_by: null
history: []
---
Under each reply, show how many tokens it used.
`);
  });

  it('TKT-005/S5 The JSON result', async () => {
    const fx = mk('tkt-s5');
    const out = await createJson(fx, PROPOSAL);
    const r = JSON.parse(out.stdout) as NewResult;
    expect(r).toMatchObject({ ticket: 'PROP-207', file: 'tickets/PROP-207.md', gate: { ready: true } });
    expect(r.gate.preferences.map((p) => p.id)).toEqual(['PROP-207#Q1']);
    expect(out.code).toBe(0);
  });

  it('TKT-005/S6 Committed on its own', async () => {
    const fx = mk('tkt-s6');
    await create(fx, PROPOSAL);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('PROP-207: new proposal, Show the token count under each reply');
    expect(fx.git('show', '--name-only', '--format=', 'HEAD').stdout.trim()).toBe('tickets/PROP-207.md');
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  });

  it('TKT-005/S7 The text result', async () => {
    const fx = mk('tkt-s7');
    const out = await create(fx, TASK);
    expect(out.stdout).toMatch(/^TASK-104 created \(tickets\/TASK-104\.md\)\n\nTASK-104: ready/);
  });

  it('TKT-005/S8 A ticket the gate refuses is still created', async () => {
    const fx = mk('tkt-s8');
    const out = await createJson(fx, { type: 'bug', title: 'Export drops the last message', violates: ['CNV-003/S9'], body: 'The last message is missing.' });
    const r = JSON.parse(out.stdout) as NewResult;
    expect(r.ticket).toBe('BUG-303');
    expect(existsSync(join(fx.repo, 'tickets/BUG-303.md'))).toBe(true);
    expect(r.gate.blockers).toEqual([expect.objectContaining({ kind: 'unresolved', id: 'CNV-003/S9' })]);
    expect(r.gate.blockers).toHaveLength(1);
    expect(out.code).toBe(0);
  });

  it('TKT-005/S9 Read from a file', async () => {
    const fx = mk('tkt-s9');
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('not json', 'ticket', 'new', 'ticket.json');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/^TASK-104 created/);
    expect(read(fx, 'tickets/TASK-104.md')).toContain('title: Tidy the export');
  });

  it('TKT-005/S10 A dry run saves nothing', async () => {
    const fx = mk('tkt-s10');
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const head = fx.git('rev-parse', 'HEAD').stdout;
    const out = await fx.spec('', 'ticket', 'new', '--dry-run', 'ticket.json');
    expect(out.stdout).toMatch(/^TASK-104 would be created \(dry run; nothing saved\)\n\nTASK-104: ready/);
    expect(existsSync(join(fx.repo, 'tickets/TASK-104.md'))).toBe(false);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);
  });

  it('TKT-005/S11 A dry run in JSON', async () => {
    const fx = mk('tkt-s11');
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', '--dry-run', '--format', 'json', 'ticket.json');
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-104', file: null, dryRun: true });
  });

  it('TKT-005/S12 The gate on a draft', async () => {
    const fx = mk('tkt-s12', (dir) => {
      const path = join(dir, 'spec/modules/conversation/features/CNV-003-export-to-markdown.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n'));
    });
    const out = await create(fx, { ...TASK, touches: ['CNV-003/S1'] }, '--dry-run');
    expect(out.stdout.split('\n')).toContain('- draft CNV-003: CNV-003 is a draft, not yet confirmed');
    expect(out.stdout).toContain('run spec confirm <ID>');
  });

  it('TKT-005/S13 Input that is not JSON', async () => {
    const fx = mk('tkt-s13');
    const out = await fx.spec('not json', 'ticket', 'new');
    expect(out.stderr).toMatch(/^spec ticket new reads the ticket as JSON on stdin: \{ "type", "title", "touches", "violates", "depends_on", "questions", "body" \}\n\nusage: /);
    expect(out.code).toBe(2);
  });

  it('TKT-005/S14 A malformed ID', async () => {
    const fx = mk('tkt-s14');
    const before = ticketFiles(fx);
    const head = fx.git('rev-parse', 'HEAD').stdout;
    const out = await create(fx, { ...TASK, touches: ['not an id'] });
    expect(out.stderr).toMatch(/^the ticket is not valid: /);
    expect(out.code).toBe(1);
    expect(ticketFiles(fx)).toEqual(before);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);
  });

  it('TKT-005/S15 A missing body', async () => {
    const fx = mk('tkt-s15');
    const out = await create(fx, { type: TASK.type, title: TASK.title, touches: TASK.touches });
    expect(out.stderr.trim()).toBe('the ticket is not valid: body: Invalid input: expected string, received undefined');
  });

  it('TKT-005/S16 An unknown key', async () => {
    const fx = mk('tkt-s16');
    const out = await create(fx, { ...TASK, owner: 'alex' });
    expect(out.stderr).toMatch(/^the ticket is not valid: \(root\): Unrecognized key: /);
    expect(out.stderr).toContain('owner');
  });

  it('TKT-005/S17 The file does not exist', async () => {
    const fx = mk('tkt-s17');
    const out = await fx.spec('', 'ticket', 'new', 'missing.json');
    expect(out.stderr.trim()).toBe('missing.json does not exist');
    expect(out.code).toBe(1);
  });

  it('TKT-005/S18 Questions are numbered in order', async () => {
    const fx = mk('tkt-s18');
    const out = await create(fx, {
      ...PROPOSAL,
      questions: [
        { kind: 'blocker', text: 'Which counter?' },
        { kind: 'preference', text: 'Show it?', default: 'yes' },
      ],
    });
    expect(out.code, out.stderr).toBe(0);
    const text = read(fx, 'tickets/PROP-207.md');
    expect(text).toMatch(/ {2}- id: Q1\n {4}kind: blocker\n {4}text: Which counter\?\n(?: {4}.*\n)*? {4}answer: null\n {4}raised_by: null\n {2}- id: Q2\n {4}kind: preference\n(?: {4}.*\n)*? {4}answer: null\n {4}raised_by: null\n/);
  });

  it('TKT-005/R2 A new ticket can carry an external question that blocks its gate', async () => {
    const fx = mk('tkt-r2-external');
    const question = { kind: 'external', text: 'Does the external API paginate?', cites: ['PRV-001'] };
    const input = { ...PROPOSAL, questions: [question] };
    const head = fx.git('rev-parse', 'HEAD').stdout;

    const dry = await createJson(fx, input, '--dry-run');
    expect(dry.code, dry.stderr).toBe(0);
    const dryResult = JSON.parse(dry.stdout) as NewResult;
    expect(dryResult).toMatchObject({ ticket: 'PROP-207', file: null, dryRun: true, gate: { ready: false } });
    expect(dryResult.gate.blockers).toEqual([expect.objectContaining({ kind: 'question', id: 'PROP-207#Q1', text: 'Does the external API paginate?' })]);
    expect(existsSync(join(fx.repo, 'tickets/PROP-207.md'))).toBe(false);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);

    const out = await createJson(fx, input);
    expect(out.code, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout) as NewResult;
    expect(r).toMatchObject({ ticket: 'PROP-207', file: 'tickets/PROP-207.md', gate: { ready: false } });
    expect(r.gate.blockers).toEqual([expect.objectContaining({ kind: 'question', id: 'PROP-207#Q1', text: 'Does the external API paginate?' })]);
    expect(r.gate.blockers).toHaveLength(1);
    expect(r.gate.preferences).toEqual([]);
    expect(read(fx, 'tickets/PROP-207.md')).toMatch(
      / {2}- id: Q1\n {4}kind: external\n {4}text: Does the external API paginate\?\n(?: {4}.*\n)*? {4}cites: \[PRV-001\]\n {4}answer: null\n {4}raised_by: null\n/,
    );
  });

  it('TKT-005/S19 Outside a git repository', async () => {
    const fx = mk('tkt-s19');
    rmSync(join(fx.repo, '.git'), { recursive: true, force: true });
    const out = await createJson(fx, TASK);
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(join(fx.repo, 'tickets/TASK-104.md'))).toBe(true);
    expect(existsSync(join(fx.repo, '.git'))).toBe(false);
  });

  it('TKT-005/S20 A long title stays on one line', async () => {
    const fx = mk('tkt-s20');
    const title = `${'word '.repeat(19)}wordy`;
    expect(title).toHaveLength(100);
    const out = await createJson(fx, { ...TASK, title });
    expect(out.code, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout) as NewResult;
    const lines = read(fx, r.file ?? '').split('\n');
    const i = lines.findIndex((l) => l.startsWith('title:'));
    expect(lines[i]).toContain(title);
    expect(lines[i + 1]).toMatch(/^status:/);
  });

  it('TKT-005/S21 Filed from a ticket branch', async () => {
    const fx = mk('tkt-s21');
    expect((await fx.spec('', 'worktree', 'add', 'TASK-101')).code).toBe(0);
    const tree = join(`${realpathSync(fx.repo)}.worktrees`, 'TASK-101');
    const before = fx.git('-C', tree, 'rev-parse', 'HEAD').stdout;
    const out = await run({ argv: ['ticket', 'new', '--root', join(tree, 'spec')], env: {}, cwd: tree, scriptPath: undefined, stdin: () => Promise.resolve(JSON.stringify(TASK)), now: () => '2026-10-27T12:00:00.000Z' });
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`file tickets from main: run spec ticket new in ${realpathSync(fx.repo)}; nothing was saved\n`);
    expect(existsSync(join(tree, 'tickets/TASK-104.md'))).toBe(false);
    expect(fx.git('-C', tree, 'rev-parse', 'HEAD').stdout).toBe(before);
    fx.git('worktree', 'remove', '--force', tree);
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
  });

  it('TKT-005/S22 A commit git refuses saves nothing', async () => {
    const fx = mk('tkt-s22');
    writeFileSync(join(fx.repo, '.git/hooks/pre-commit'), '#!/bin/sh\necho "commits are closed" >&2\nexit 1\n', { mode: 0o755 });
    const out = await create(fx, TASK);
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('git could not commit tickets/TASK-104.md: commits are closed; nothing was saved\n');
    expect(existsSync(join(fx.repo, 'tickets/TASK-104.md'))).toBe(false);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  });

  it('TKT-005/S23 A broken file on the next ID is skipped, not refused', async () => {
    const fx = mk('tkt-s23', (dir) => {
      writeFileSync(join(dir, 'tickets/TASK-104.md'), 'this is not a ticket\n');
    });
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', 'ticket.json');
    expect(out.stdout).toMatch(/^TASK-105 created \(tickets\/TASK-105\.md\)/);
    expect(read(fx, 'tickets/TASK-104.md')).toBe('this is not a ticket\n');
    expect(out.code, out.stderr).toBe(0);
  });

  it('TKT-001/R7 Ticket IDs are unique in a store: an unreadable ticket file still holds its ID', async () => {
    const fx = mk('tkt-r7-unreadable', (dir) => {
      symlinkSync('does-not-exist.md', join(dir, 'tickets/TASK-104.md'));
    });
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', 'ticket.json');
    const output = `${out.stdout}${out.stderr}`;
    expect(out.stdout).not.toMatch(/^TASK-104 created/);
    expect(output).toContain('TASK-104');
    expect(output).toMatch(/cannot be read|unreadable/);
    expect(readlinkSync(join(fx.repo, 'tickets/TASK-104.md'))).toBe('does-not-exist.md');
  });

  it('TKT-005/S24 A JSON file that does not parse', async () => {
    const fx = mk('tkt-s24');
    writeFileSync(join(fx.repo, 'ticket.json'), 'not json');
    const before = ticketFiles(fx);
    const head = fx.git('rev-parse', 'HEAD').stdout;
    const out = await fx.spec('', 'ticket', 'new', 'ticket.json');
    expect(out.stderr).toMatch(/^spec ticket new reads the ticket as JSON from ticket\.json: \{ "type", "title", "touches", "violates", "depends_on", "questions", "body" \}\n\nusage: /);
    expect(out.code).toBe(2);
    expect(ticketFiles(fx)).toEqual(before);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);
  });

  it('TKT-005/S25 A broken copy on another ticket branch holds its ID', async () => {
    const fx = mk('tkt-s25');
    const git = (...args: string[]) => {
      const r = fx.git(...args);
      expect(r.code, r.stderr).toBe(0);
    };
    git('checkout', '-q', '-b', 'ticket/TASK-150');
    writeFileSync(join(fx.repo, 'tickets/TASK-150.md'), 'this is not a ticket\n');
    git('add', 'tickets/TASK-150.md');
    git('commit', '-q', '-m', 'TASK-150: a broken copy');
    git('checkout', '-q', 'main');
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', 'ticket.json');
    expect(out.stdout).toMatch(/^TASK-151 created \(tickets\/TASK-151\.md\)/);
    expect(out.code, out.stderr).toBe(0);
  });

  it("TKT-005/S26 A tracker's next ID comes from its first list", async () => {
    const fx = commandTracker('tkt-s26');
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', '--dry-run', 'ticket.json');
    expect(out.stdout).toMatch(/^TASK-104 would be created \(dry run; nothing saved\)/);
    expect(out.code, out.stderr).toBe(0);
  });

  it('TKT-005/S27 An absorbed ticket holds its ID', async () => {
    const fx = mk('tkt-s27', (dir) => {
      const text = readFileSync(join(dir, 'tickets/TASK-103.md'), 'utf8').replace('id: TASK-103', 'id: TASK-104').replace('status: open', 'status: absorbed\nabsorbed_into: TASK-103');
      writeFileSync(join(dir, 'tickets/TASK-104.md'), text);
    });
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', '--dry-run', 'ticket.json');
    expect(out.stdout).toMatch(/^TASK-105 would be created \(dry run; nothing saved\)/);
    expect(out.code, out.stderr).toBe(0);
  });

  it('TKT-005/S23 A broken file past 2^53 on the next ID is skipped, not refused', async () => {
    const fx = mk('tkt-s23-big', (dir) => {
      writeFileSync(join(dir, 'tickets/TASK-9007199254740992.md'), 'this is not a ticket\n');
    });
    writeFileSync(join(fx.repo, 'ticket.json'), JSON.stringify(TASK));
    const out = await fx.spec('', 'ticket', 'new', 'ticket.json');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/^TASK-9007199254740993 created \(tickets\/TASK-9007199254740993\.md\)/);
    expect(read(fx, 'tickets/TASK-9007199254740992.md')).toBe('this is not a ticket\n');
  });
});
