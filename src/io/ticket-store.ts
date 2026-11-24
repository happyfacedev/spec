// Ticket stores. Every store holds tickets in the ticket file format; only where they live
// differs. `files` keeps them in the repository; `command` reaches any tracker through a small
// program that speaks a two-operation protocol (docs/TICKETS.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { finding } from '../core/findings';
import { PATTERNS } from '../core/ids';
import type { Ticket, TicketSet } from '../core/model';
import { parseConfig, parseTicket, parseTickets } from '../core/parse/tickets';
import { sourceFromText } from '../core/source';
import { type TicketPatch, patchTicketText } from '../core/ticket-edit';
import { loadDir, toPosix } from './fs';
import { git } from './git';
import { NO_TICKET_GIT, type TicketGitState, commitToBranch, ticketGitState, withTicketTrailer } from './ticket-git';

export type StoreResult = { ok: true; ticket: Ticket } | { ok: false; error: string };

export interface TicketStore {
  /** The tickets dir relative to the project root when tickets are files in this repository. */
  readonly dirRel: string | null;
  /** Every ticket. `git` is where ticket branches stand; the file store reads live copies from it. */
  list(git?: TicketGitState): Promise<TicketSet>;
  /** The IDs a new ticket must not take: the tickets `loaded` holds, and whatever else the store keeps. */
  taken(loaded: TicketSet, git: TicketGitState): string[];
  get(id: string): Promise<Ticket | null>;
  /** `note` says why, for stores that keep a history (a commit message, a tracker comment). */
  update(id: string, patch: TicketPatch, note?: string): Promise<StoreResult>;
  /** Saves a new ticket; refuses an ID that is taken. Returns the path it was written to, if any. */
  create(id: string, text: string): Promise<{ ok: true; file: string | null } | { ok: false; error: string }>;
}

/** The path findings use for a ticket that lives outside the repository. */
export const TRACKER_DIR = 'tracker';

const FIX_TRACKER = 'fix the tickets command in config.json (docs/TICKETS.md)';

function patched(file: string, text: string, patch: TicketPatch, id: string): { text: string; ticket: Ticket } | { error: string } {
  const next = patchTicketText(text, patch);
  if (next === null) return { error: `ticket ${id} has no editable frontmatter` };
  const parsed = parseTicket(file, next);
  if (!parsed.ticket) return { error: `updating ${id} would break its schema: ${parsed.findings.map((f) => f.message).join('; ')}` };
  return { text: next, ticket: parsed.ticket };
}

/**
 * tickets/<ID>.md under the project root. A ticket absorbed or done and merged on the base branch
 * is read and written there; otherwise a newer ticket-branch copy is used. Paths in results are
 * project-root-relative.
 */
export class FileTicketStore implements TicketStore {
  readonly dirRel: string;
  readonly base: string;

  constructor(
    readonly dir: string,
    readonly projectRoot: string,
    base?: string,
  ) {
    const configFile = resolve(projectRoot, 'spec/config.json');
    const configuredBase = existsSync(configFile) ? parseConfig('spec/config.json', readFileSync(configFile, 'utf8')).config?.baseBranch : undefined;
    this.base = base ?? configuredBase ?? 'main';
    this.dirRel = toPosix(relative(projectRoot, dir));
  }

  list(state: TicketGitState = this.state()): Promise<TicketSet> {
    const files = new Map(loadDir(this.dir, this.projectRoot).map((f) => [f.path, f]));
    for (const [id, live] of state.live) {
      const path = `${this.dirRel}/${id}.md`;
      files.set(path, sourceFromText(path, live.text));
    }
    return Promise.resolve(parseTickets([...files.values()]));
  }

  /** The loaded tickets, every `<ID>.md` file under the tickets dir whether or not it parses, and every live copy. */
  taken(loaded: TicketSet, state: TicketGitState): string[] {
    const named = loadDir(this.dir, this.projectRoot)
      .filter((f) => f.path.endsWith('.md'))
      .map((f) => basename(f.path, '.md'));
    return [...new Set([...loaded.tickets.map((t) => t.id), ...named, ...state.live.keys()])].filter((id) => PATTERNS.ticket.test(id));
  }

  private state(): TicketGitState {
    return this.dirRel.startsWith('..') ? NO_TICKET_GIT : ticketGitState(this.projectRoot, this.dirRel, this.base);
  }

  async get(id: string): Promise<Ticket | null> {
    return (await this.list()).tickets.find((t) => t.id === id) ?? null;
  }

  update(id: string, patch: TicketPatch, note?: string): Promise<StoreResult> {
    return Promise.resolve(this.write(id, patch, note));
  }

  async create(id: string, text: string): Promise<{ ok: true; file: string } | { ok: false; error: string }> {
    if ((await this.list()).tickets.some((t) => t.id === id)) return { ok: false, error: `${id} already exists` };
    const file = `${this.dirRel}/${id}.md`;
    const abs = resolve(this.projectRoot, file);
    if (existsSync(abs)) return { ok: false, error: `${file} already exists` };
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(abs, text, 'utf8');
    return { ok: true, file };
  }

  private write(id: string, patch: TicketPatch, note: string | undefined): StoreResult {
    const state = this.state();
    const file = `${this.dirRel}/${id}.md`;
    const live = state.live.get(id);
    const here = resolve(this.projectRoot, file);
    const text = live ? live.text : existsSync(here) ? readFileSync(here, 'utf8') : null;
    if (text === null) return { ok: false, error: `ticket ${id} is not in the store` };
    const next = patched(file, text, patch, id);
    if ('error' in next) return { ok: false, error: next.error };
    if (live?.worktree) {
      // The ticket runs in another worktree: its file there is the live copy.
      const prefix = git(this.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim();
      writeFileSync(join(live.worktree, prefix, file), next.text, 'utf8');
    } else if (live) {
      const c = commitToBranch(this.projectRoot, live.branch, file, next.text, withTicketTrailer(note ?? `${id}: update the ticket`, id), live.tip);
      if (!c.ok) return { ok: false, error: c.error };
    } else writeFileSync(here, next.text, 'utf8');
    return { ok: true, ticket: next.ticket };
  }
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const ListReply = z.object({ tickets: z.array(z.object({ id: z.string(), text: z.string() })) });
const PutReply = z.union([z.object({ ok: z.literal(true) }).loose(), z.object({ ok: z.literal(false), error: z.string() }).loose()]);

/**
 * Any tracker, through a program: `<command> list` prints `{"tickets":[{"id","text"}]}`;
 * `<command> put <ID>` reads `{"id","text","previous","note"}` on stdin and saves the text.
 * `text` is the ticket in the ticket file format. The command is the project's own, so it runs in
 * a shell; the only value added to it is a validated ticket ID.
 */
export class CommandTicketStore implements TicketStore {
  readonly dirRel = null;

  constructor(
    readonly command: string,
    readonly projectRoot: string,
  ) {}

  private call(args: string, input = ''): { ok: true; stdout: string } | { ok: false; error: string } {
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const r = spawnSync('/bin/sh', ['-c', `${this.command} ${args}`], { cwd: this.projectRoot, encoding: 'utf8', input, timeout: 120_000, maxBuffer: 256 * 1024 * 1024 });
    if (r.error) return { ok: false, error: `the tickets command failed: ${r.error.message}` };
    if (r.status !== 0) return { ok: false, error: `the tickets command exited ${String(r.status)}: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}` };
    return { ok: true, stdout: r.stdout };
  }

  list(): Promise<TicketSet> {
    const r = this.call('list');
    const fail = (message: string): TicketSet => ({
      tickets: [],
      findings: [finding('L020', TRACKER_DIR, 1, null, message, FIX_TRACKER, 'error')],
    });
    if (!r.ok) return Promise.resolve(fail(r.error));
    let reply: z.infer<typeof ListReply>;
    try {
      reply = ListReply.parse(JSON.parse(r.stdout));
    } catch {
      return Promise.resolve(fail('`list` did not print {"tickets":[{"id","text"}]}'));
    }
    // An entry whose ID is not a ticket ID is left out of the tickets and reported as a warning.
    const set = parseTickets(reply.tickets.filter((t) => PATTERNS.ticket.test(t.id)).map((t) => sourceFromText(`${TRACKER_DIR}/${t.id}.md`, t.text)));
    const skipped = reply.tickets
      .filter((t) => !PATTERNS.ticket.test(t.id))
      .map((t) => finding('L020', TRACKER_DIR, 1, null, `\`list\` listed "${t.id}", which is not a ticket ID`, FIX_TRACKER, 'warning'));
    return Promise.resolve({ tickets: set.tickets, findings: [...set.findings, ...skipped] });
  }

  taken(loaded: TicketSet): string[] {
    return loaded.tickets.map((t) => t.id);
  }

  async get(id: string): Promise<Ticket | null> {
    return (await this.list()).tickets.find((t) => t.id === id) ?? null;
  }

  async create(id: string, text: string): Promise<{ ok: true; file: null } | { ok: false; error: string }> {
    if (!PATTERNS.ticket.test(id)) return { ok: false, error: `${id} is not a ticket ID` };
    if (await this.get(id)) return { ok: false, error: `${id} already exists in the tracker` };
    const r = this.call(`put ${id}`, JSON.stringify({ id, text, previous: null, note: `${id}: new ticket` }));
    if (!r.ok) return { ok: false, error: r.error };
    const reply = PutReply.safeParse(parseJson(r.stdout));
    if (reply.success && !reply.data.ok) return { ok: false, error: `the tracker refused the ticket: ${reply.data.error}` };
    return { ok: true, file: null };
  }

  async update(id: string, patch: TicketPatch, note?: string): Promise<StoreResult> {
    if (!PATTERNS.ticket.test(id)) return { ok: false, error: `${id} is not a ticket ID` };
    const current = await this.get(id);
    if (!current) return { ok: false, error: `ticket ${id} is not in the tracker` };
    const next = patched(current.file, current.text, patch, id);
    if ('error' in next) return { ok: false, error: next.error };
    const r = this.call(`put ${id}`, JSON.stringify({ id, text: next.text, previous: current.text, note: note ?? null }));
    if (!r.ok) return { ok: false, error: r.error };
    // An empty reply is success; so is any reply that is not a refusal.
    const reply = PutReply.safeParse(parseJson(r.stdout));
    if (reply.success && !reply.data.ok) return { ok: false, error: `the tracker refused the update: ${reply.data.error}` };
    return { ok: true, ticket: next.ticket };
  }
}
