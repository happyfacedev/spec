// `spec stats` (PIP-020): reads the tickets' histories and questions and prints the measures; changes nothing.
import { PATTERNS } from '../core/ids';
import { buildStats, renderStats } from '../core/stats';
import type { Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { type Out, json, ok, usageError } from './output';
import { unknownTicket } from './tickets';

/** True when `text` is a real day written YYYY-MM-DD. */
export function isRealDay(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The UTC day, as YYYY-MM-DD, a history entry's `at` was recorded on. */
function dayOf(at: string): string {
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? at.slice(0, 10) : new Date(ms).toISOString().slice(0, 10);
}

export function cmdStats(ws: Workspace, args: Args): Out {
  for (const id of args.positionals) if (!PATTERNS.ticket.test(id) || !ws.tickets.tickets.some((t) => t.id === id)) return unknownTicket(ws, id);
  const since = args.since;
  if (since !== null && !isRealDay(since)) return usageError(`--since is a date as YYYY-MM-DD, not ${since}`, USAGE);
  const result = buildStats(ws.spec.version, ws.tickets.tickets, args.positionals, since === null ? null : (firstAt) => dayOf(firstAt) >= since);
  return args.format === 'json' ? json(result) : ok(renderStats(result));
}
