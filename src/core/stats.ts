// `spec stats` (PIP-020): what each ticket's history and questions say about how the process ran. Pure.
import { compareIds } from './ids';
import type { Ticket } from './model';
import { LIGHT_PIPELINES, laneOf } from './pipeline';
import { FINDING_CLASSES, ROLES, type Role, type TicketType } from './schemas';

type Verdict = 'approve' | 'changes';

/** How many rounds one review took to approve, over the tickets it approved. */
export interface RoundStats {
  readonly approved: number;
  readonly meanRounds: number | null;
  readonly firstRound: number | null;
}

export interface TicketStats {
  readonly id: string;
  readonly type: TicketType;
  readonly stages: number;
  readonly duration_s: number | null;
  readonly timed: number;
  readonly minimum: number;
  readonly rounds: Readonly<Record<string, number>>;
  readonly blocked: number;
  readonly reopened: number;
  readonly refusals: number;
  readonly answered: number;
  readonly specReview: readonly Verdict[];
  readonly review: readonly Verdict[];
  readonly findings: Readonly<Record<string, number>>;
}

export interface RoleStats {
  readonly role: Role;
  readonly stages: number;
  readonly duration_s: number | null;
  readonly median_s: number | null;
  readonly timed: number;
  readonly cost_usd: number | null;
  readonly costed: number;
}

export interface StatsTotals {
  readonly tickets: number;
  readonly stages: number;
  readonly minimum: number;
  readonly blocked: number;
  readonly reopened: number;
  readonly refusals: number;
  readonly answered: number;
  readonly specReview: RoundStats;
  readonly review: RoundStats;
  readonly findings: Readonly<Record<string, number>>;
}

export interface StatsResult {
  readonly spec: string;
  readonly tickets: readonly TicketStats[];
  readonly totals: StatsTotals;
  readonly roles: readonly RoleStats[];
}

export const UNCLASSIFIED = 'unclassified';
/** The keys of a findings count, in the order they are shown. */
const FINDING_KEYS: readonly string[] = [...FINDING_CLASSES, UNCLASSIFIED];

const MINIMUM: Readonly<Record<TicketType, number>> = { proposal: 5, bug: 3, task: 2 };

/** A findings count with its keys in class order, leaving out the classes with none. */
function ordered(counts: ReadonlyMap<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of FINDING_KEYS) {
    const n = counts.get(key);
    if (n !== undefined && n > 0) out[key] = n;
  }
  return out;
}

function sumCounts(parts: readonly Readonly<Record<string, number>>[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const part of parts) for (const [key, n] of Object.entries(part)) counts.set(key, (counts.get(key) ?? 0) + n);
  return ordered(counts);
}

/** The fewest stages the ticket's type needs: its lane's stages for a proposal still in a light lane, 4 for a proposal recorded before the spec review existed (PIP-020/R2). */
function minimumOf(ticket: Ticket): number {
  const { type, history, lane } = ticket.data;
  const running = laneOf(type, lane, history);
  if (running !== 'full') return LIGHT_PIPELINES[running].length;
  // A proposal that left its light lane runs the full order, whatever its tester stage did first; the rule of 4 is for legacy histories only.
  if (type === 'proposal' && history.some((h) => h.lane === 'full')) return MINIMUM[type];
  const ran = (role: Role) => history.some((h) => h.role === role && h.result !== 'reopened');
  if (type === 'proposal' && history.some((h) => h.role === 'tester' && h.result === 'done') && !ran('spec-review')) return 4;
  return MINIMUM[type];
}

export function ticketStats(ticket: Ticket): TicketStats {
  const { history, questions } = ticket.data;
  const stages = history.filter((h) => h.result !== 'reopened');
  const timedStages = stages.filter((h) => h.duration_s !== undefined);
  const duration_s = timedStages.length === 0 ? null : timedStages.reduce((sum, h) => sum + (h.duration_s ?? 0), 0);
  const rounds: Record<string, number> = {};
  for (const role of ROLES) {
    const n = stages.filter((h) => h.role === role).length;
    if (n > 0) rounds[role] = n;
  }
  const verdicts = (role: Role): Verdict[] => history.filter((h) => h.role === role && h.verdict !== null).map((h) => h.verdict as Verdict);
  const counts = new Map<string, number>();
  for (const h of history) {
    if (h.role !== 'reviewer' && h.role !== 'spec-review') continue;
    for (const f of h.findings ?? []) {
      const cls = typeof f.class === 'string' && (FINDING_CLASSES as readonly string[]).includes(f.class) ? f.class : UNCLASSIFIED;
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
  }
  return {
    id: ticket.id,
    type: ticket.data.type,
    stages: stages.length,
    duration_s,
    timed: timedStages.length,
    minimum: minimumOf(ticket),
    rounds,
    blocked: history.filter((h) => h.result === 'blocked').length,
    reopened: history.length - stages.length,
    refusals: history.reduce((sum, h) => sum + (h.refusals ?? 0), 0),
    answered: questions.filter((q) => q.answer !== null).length,
    specReview: verdicts('spec-review'),
    review: verdicts('reviewer'),
    findings: ordered(counts),
  };
}

/** Rounds over the tickets whose latest verdict is approve: every verdict is a round (PIP-020/R5). */
export function roundStats(sequences: readonly (readonly Verdict[])[]): RoundStats {
  const approved = sequences.filter((s) => s.at(-1) === 'approve');
  if (approved.length === 0) return { approved: 0, meanRounds: null, firstRound: null };
  const total = approved.reduce((sum, s) => sum + s.length, 0);
  return { approved: approved.length, meanRounds: total / approved.length, firstRound: approved.filter((s) => s.length === 1).length / approved.length };
}

export function totalsOf(rows: readonly TicketStats[]): StatsTotals {
  const sum = (pick: (row: TicketStats) => number) => rows.reduce((n, row) => n + pick(row), 0);
  return {
    tickets: rows.length,
    stages: sum((r) => r.stages),
    minimum: sum((r) => r.minimum),
    blocked: sum((r) => r.blocked),
    reopened: sum((r) => r.reopened),
    refusals: sum((r) => r.refusals),
    answered: sum((r) => r.answered),
    specReview: roundStats(rows.map((r) => r.specReview)),
    review: roundStats(rows.map((r) => r.review)),
    findings: sumCounts(rows.map((r) => r.findings)),
  };
}

function roleStatsOf(tickets: readonly Ticket[]): RoleStats[] {
  return ROLES.flatMap((role) => {
    const stages = tickets.flatMap((ticket) => ticket.data.history.filter((entry) => entry.role === role && entry.result !== 'reopened'));
    if (stages.length === 0) return [];
    const durations = stages.flatMap((entry) => entry.duration_s === undefined ? [] : [entry.duration_s]);
    const costs = stages.flatMap((entry) => entry.cost_usd === undefined ? [] : [entry.cost_usd]);
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const middle = Math.floor(sortedDurations.length / 2);
    const median_s = sortedDurations.length === 0
      ? null
      : sortedDurations.length % 2 === 1
        ? sortedDurations[middle] ?? null
        : Math.floor(((sortedDurations[middle - 1] ?? 0) + (sortedDurations[middle] ?? 0)) / 2);
    return [{
      role,
      stages: stages.length,
      duration_s: durations.length === 0 ? null : durations.reduce((sum, value) => sum + value, 0),
      median_s,
      timed: durations.length,
      cost_usd: costs.length === 0 ? null : costs.reduce((sum, value) => sum + value, 0),
      costed: costs.length,
    }];
  });
}

/**
 * The tickets to measure: `ids` (even with an empty history), else every ticket with a history entry;
 * then, with `since`, only those whose first entry's `at` it accepts (the caller reads the clock-free
 * UTC day rule). In ID order.
 */
export function buildStats(spec: string, tickets: readonly Ticket[], ids: readonly string[], since: ((firstAt: string) => boolean) | null): StatsResult {
  const chosen = ids.length > 0 ? tickets.filter((t) => ids.includes(t.id)) : tickets.filter((t) => t.data.history.length > 0);
  const kept = since === null ? chosen : chosen.filter((t) => {
    const first = t.data.history[0];
    return first !== undefined && since(first.at);
  });
  const orderedTickets = [...kept].sort((a, b) => compareIds(a.id, b.id));
  const rows = orderedTickets.map(ticketStats);
  return { spec, tickets: rows, totals: totalsOf(rows), roles: roleStatsOf(orderedTickets) };
}

const cell = (n: number) => String(n);
const verdictsCell = (v: readonly Verdict[]) => (v.length === 0 ? '-' : v.join(', '));
export const countsText = (counts: Readonly<Record<string, number>>): string => {
  const parts = Object.entries(counts).map(([key, n]) => `${key} ${n}`);
  return parts.length === 0 ? '' : parts.join(', ');
};

function roundsLine(label: string, r: RoundStats): string {
  if (r.meanRounds === null || r.firstRound === null) return `${label}: no ticket approved yet`;
  return `${label}: ${r.meanRounds.toFixed(1)} rounds to approve, ${Math.round(r.firstRound * 100)}% approved in one round (${r.approved} ${r.approved === 1 ? 'ticket' : 'tickets'})`;
}

const COLUMNS = ['ticket', 'stages', 'time', 'timed', 'blocked', 'reopened', 'refused', 'answered', 'spec review', 'review', 'findings'] as const;
const NUMERIC = new Set(['stages', 'timed', 'blocked', 'reopened', 'refused', 'answered']);
const ROLE_COLUMNS = ['role', 'stages', 'time', 'median', 'timed', 'cost', 'costed'] as const;
const ROLE_NUMERIC = new Set(['stages', 'timed', 'costed', 'cost']);

function durationText(seconds: number | null): string {
  if (seconds === null) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

/** Round a number's shortest decimal representation to cents, with halfway values up. */
function costText(value: number): string {
  if (!Number.isFinite(value)) return `$${String(value)}`;
  const [coefficient = '0', exponentText] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText ?? 0);
  const [whole = '0', fraction = ''] = coefficient.split('.');
  const digits = BigInt(`${whole}${fraction}` || '0');
  const decimalPlaces = fraction.length - exponent;
  let cents: bigint;
  if (decimalPlaces <= 2) {
    cents = digits * 10n ** BigInt(2 - decimalPlaces);
  } else {
    const divisor = 10n ** BigInt(decimalPlaces - 2);
    const quotient = digits / divisor;
    const remainder = digits % divisor;
    cents = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }
  return `$${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function renderTable(columns: readonly string[], rows: readonly (readonly string[])[], numeric: ReadonlySet<string>): string {
  const widths = columns.map((name, i) => Math.max(name.length, ...rows.map((row) => row[i]?.length ?? 0)));
  const line = (cells: readonly string[]) => cells
    .map((text, i) => (numeric.has(columns[i] ?? '') ? text.padStart(widths[i] ?? 0) : text.padEnd(widths[i] ?? 0)))
    .join('  ')
    .trimEnd();
  return [line(columns), ...rows.map(line)].join('\n');
}

function roleRows(roles: readonly RoleStats[]): string {
  const rows = roles.map((role) => [
    role.role,
    cell(role.stages),
    durationText(role.duration_s),
    durationText(role.median_s),
    `${role.timed}/${role.stages}`,
    role.cost_usd === null ? '-' : costText(role.cost_usd),
    `${role.costed}/${role.stages}`,
  ]);
  return renderTable(ROLE_COLUMNS, rows, ROLE_NUMERIC);
}

/** The text output: a table with one row per ticket, then the totals and role measures. */
export function renderStats(result: StatsResult): string {
  if (result.tickets.length === 0) return 'no tickets with a recorded stage\n';
  const rows = result.tickets.map((t) => [t.id, `${t.stages}/${t.minimum}`, durationText(t.duration_s), `${t.timed}/${t.stages}`, cell(t.blocked), cell(t.reopened), cell(t.refusals), cell(t.answered), verdictsCell(t.specReview), verdictsCell(t.review), countsText(t.findings) || '-']);
  const table = renderTable(COLUMNS, rows, NUMERIC);
  const t = result.totals;
  const totals = [
    `total: ${t.tickets} tickets, ${t.stages} stages for a minimum of ${t.minimum}, ${t.blocked} blocked, ${t.reopened} reopened, ${t.refusals} refused, ${t.answered} answered`,
    roundsLine('spec review', t.specReview),
    roundsLine('review', t.review),
    `findings: ${countsText(t.findings) || 'none'}`,
  ];
  return `${table}\n\n${totals.join('\n')}${result.roles.length === 0 ? '' : `\n\n${roleRows(result.roles)}`}\n`;
}
