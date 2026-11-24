// `spec queue`: tickets grouped as ready, blocked and in progress. The gate decides ready.
import { type Dependencies, gateTicket } from './gate';
import { PATTERNS, compareIds } from './ids';
import type { Spec, TicketSet } from './model';
import { nextStage } from './pipeline';
import type { Role } from './schemas';
import type { UnitIndex } from './units';

/** Claude Code caps SessionStart additionalContext at 10,000 characters (V10). */
export const QUEUE_LIMIT = 10_000;

export interface QueueEntry {
  id: string;
  type: string;
  title: string;
  /** Ready: the stage to delegate next. In progress: the running stage. */
  stage: Role | null;
  /** Blocked: the first blocker. */
  reason: string | null;
}

export interface Queue {
  spec: string;
  ready: QueueEntry[];
  /** Held only by tickets they depend on: clears by itself, no person needed. */
  waiting: QueueEntry[];
  blocked: QueueEntry[];
  inProgress: QueueEntry[];
  done: number;
}

export function buildQueue(spec: Spec, index: UnitIndex, set: TicketSet, deps: Dependencies | null = null): Queue {
  const q: Queue = { spec: spec.version, ready: [], waiting: [], blocked: [], inProgress: [], done: 0 };
  for (const t of set.tickets) {
    const d = t.data;
    if (d.status === 'absorbed') continue;
    if (d.status === 'done') {
      q.done++;
      continue;
    }
    const base = { id: t.id, type: d.type, title: d.title };
    if (d.status === 'in_progress') {
      q.inProgress.push({ ...base, stage: d.stage, reason: null });
      continue;
    }
    const gate = gateTicket(spec, index, t.id, t, set.findings.filter((f) => f.file === t.file), deps);
    const next = nextStage(d.type, d.history, d.questions, d.lane);
    const first = gate.blockers[0];
    if (first && gate.blockers.every((b) => b.kind === 'dependency')) q.waiting.push({ ...base, stage: null, reason: gate.blockers.map((b) => b.text).join('; ') });
    else if (first) q.blocked.push({ ...base, stage: null, reason: `${first.kind} ${first.id}: ${first.text}` });
    else if ('blocked' in next) q.blocked.push({ ...base, stage: null, reason: next.blocked });
    else if ('stage' in next) q.ready.push({ ...base, stage: next.stage, reason: null });
    else q.done++;
  }
  // Files that do not parse are blocked on their schema errors.
  const unparsed = new Map<string, string>();
  for (const f of set.findings) {
    const id = /([^/]+)\.md$/.exec(f.file)?.[1] ?? '';
    if (f.severity === 'error' && PATTERNS.ticket.test(id) && !set.tickets.some((t) => t.file === f.file) && !unparsed.has(id)) {
      unparsed.set(id, `schema ${id}: ${f.message}`);
    }
  }
  for (const [id, reason] of unparsed) q.blocked.push({ id, type: 'unknown', title: '(does not parse)', stage: null, reason });
  for (const list of [q.ready, q.waiting, q.blocked, q.inProgress]) list.sort((a, b) => compareIds(a.id, b.id));
  return q;
}

/** Shows tickets in group order and, when over `limit` characters, says how many it left out. */
export function renderQueue(q: Queue, limit: number = QUEUE_LIMIT): string {
  const total = q.ready.length + q.waiting.length + q.blocked.length + q.inProgress.length;
  let lo = 0;
  let hi = total;
  // The longest prefix of tickets that fits: rendering is monotonic in the number shown.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (renderFirst(q, mid, limit).length <= limit) lo = mid;
    else hi = mid - 1;
  }
  return renderFirst(q, lo, limit);
}

function renderFirst(q: Queue, keep: number, limit: number): string {
  const groups: [string, QueueEntry[], (e: QueueEntry) => string[]][] = [
    ['Ready', q.ready, (e) => [`- ${e.id} ${e.type} · next ${e.stage ?? '?'} · ${e.title}`]],
    ['Waiting', q.waiting, (e) => [`- ${e.id} ${e.type} · ${e.title}`, `  ${e.reason ?? ''}`]],
    ['Blocked', q.blocked, (e) => [`- ${e.id} ${e.type} · ${e.title}`, `  ${e.reason ?? ''}`]],
    ['In progress', q.inProgress, (e) => [`- ${e.id} ${e.type} · stage ${e.stage ?? '?'} · ${e.title}`]],
  ];
  const out = [`# Queue · ${q.spec}`, ''];
  let left = keep;
  let hidden = 0;
  for (const [name, items, render] of groups) {
    // Waiting appears only when something waits, so a project without dependencies sees no change.
    if (name === 'Waiting' && items.length === 0) continue;
    out.push(`## ${name} (${items.length})`);
    if (items.length === 0) out.push('None');
    for (const e of items) {
      if (left > 0) {
        out.push(...render(e));
        left--;
      } else hidden++;
    }
    out.push('');
  }
  if (hidden > 0) out.push(`… ${hidden} more ticket${hidden === 1 ? '' : 's'} not shown (capped at ${limit} characters); run spec queue --format json for all`);
  out.push(`Done: ${q.done}`);
  return `${out.join('\n')}\n`;
}
