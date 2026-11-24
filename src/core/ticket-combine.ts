// `spec ticket combine <INTO> <FROM>...` (TKT-012): which tickets may be combined, and what each one gives
// INTO. Pure: the caller reads the tickets and saves the patches.
import type { Ticket } from './model';
import { bodyText, type TicketPatch } from './ticket-edit';

export interface MovedQuestion {
  from: string;
  to: string;
}

export interface AbsorbedTicket {
  id: string;
  /** The IDs INTO gained from it in touches, violates and depends_on, in the order added. */
  added: string[];
  questions: MovedQuestion[];
}

export interface CombinePlan {
  /** INTO's patch first, then each FROM's. */
  patches: { id: string; patch: TicketPatch }[];
  absorbed: AbsorbedTicket[];
}

const article = (type: string): string => `a ${type}`;

/** The FROM IDs once each, in the order given. */
export const distinct = (ids: readonly string[]): string[] => [...new Set(ids)];

/** What the store knows beyond the named tickets: every ticket, and the worktree each ticket branch is checked out in. */
export interface CombineContext {
  readonly tickets: readonly Ticket[];
  readonly worktrees: ReadonlyMap<string, string>;
}

/** Every reason these tickets may not be combined, one line each (TKT-012/R1); empty when they may. */
export function combineProblems(into: Ticket, froms: readonly Ticket[], ctx: CombineContext): string[] {
  const problems: string[] = [];
  const seen = distinct(froms.map((f) => f.id));
  const others = seen.filter((id) => id !== into.id).map((id) => froms.find((f) => f.id === id));
  if (seen.includes(into.id)) problems.push(`${into.id} cannot absorb itself`);
  let intoRefused = false;
  for (const t of [into, ...others]) {
    if (t === undefined) continue;
    const before = problems.length;
    if (t.data.status !== 'open') problems.push(`${t.id} is ${t.data.status.replace('_', ' ')}: only open tickets are combined`);
    else if (t.data.history.length > 0) problems.push(`${t.id} has recorded stages: only tickets no stage has run on are combined`);
    // A ticket with a worktree keeps its live copy there, not on the base branch.
    if (ctx.worktrees.has(t.id)) problems.push(`${t.id} has a worktree on ticket/${t.id}: remove it first`);
    if (t === into && problems.length > before) intoRefused = true;
  }
  // An absorbed ticket names the ticket it went into, and that one may not itself be absorbed (TKT-001/R12).
  // Nothing is absorbed when INTO is refused, so the line is left out then (TKT-012/S4).
  for (const f of intoRefused ? [] : others) {
    if (f === undefined) continue;
    for (const a of ctx.tickets) if (a.data.status === 'absorbed' && a.data.absorbed_into === f.id) problems.push(`${f.id} has absorbed ${a.id}: combine into ${f.id} instead`);
  }
  for (const f of others) {
    if (f !== undefined && f.data.type !== into.data.type) {
      problems.push(`${into.id} is ${article(into.data.type)} and ${f.id} is ${article(f.data.type)}: only tickets of one type are combined`);
    }
  }
  return problems;
}

const questionNumber = (id: string): number => Number(/^Q(\d+)$/.exec(id)?.[1] ?? 0);

/** INTO's new keys and body, and each FROM's absorbed marks (TKT-012/R2, R3). Call it only when combineProblems is empty. */
export function planCombine(into: Ticket, froms: readonly Ticket[]): CombinePlan {
  const all = new Set([into.id, ...froms.map((f) => f.id)]);
  const lists = { touches: [...into.data.touches], violates: [...into.data.violates], depends_on: into.data.depends_on.filter((id) => !all.has(id)) };
  const questions = into.data.questions.map((q) => ({ ...q }));
  let next = questions.reduce((n, q) => Math.max(n, questionNumber(q.id)), 0) + 1;
  const absorbed: AbsorbedTicket[] = [];
  let body = (bodyText(into.text) ?? '').trimEnd();
  for (const from of froms) {
    const added: string[] = [];
    for (const key of ['touches', 'violates', 'depends_on'] as const) {
      for (const id of from.data[key]) {
        if (lists[key].includes(id) || (key === 'depends_on' && all.has(id))) continue;
        lists[key].push(id);
        if (!added.includes(id)) added.push(id);
      }
    }
    const open = from.data.questions.filter((q) => q.answer === null).map((q) => ({ q, id: `Q${String(next++)}` }));
    const renamed = new Map<string, string>(open.map(({ q, id }) => [q.id, id] as const));
    // A cite of FROM's own ID names INTO (TKT-012/R7); a cite of a FROM question names its new ID, or is dropped when that question did not move (TKT-012/R8).
    const citeInto = (cite: string): string[] => {
      if (cite === from.id) return [into.id];
      if (!cite.startsWith(`${from.id}#`)) return [cite];
      const id = renamed.get(cite.slice(from.id.length + 1));
      return id === undefined ? [] : [`${into.id}#${id}`];
    };
    const moved: MovedQuestion[] = [];
    for (const { q, id } of open) {
      questions.push({ ...q, id, cites: q.cites.flatMap(citeInto) });
      moved.push({ from: `${from.id}#${q.id}`, to: `${into.id}#${id}` });
    }
    body += `\n\nFrom ${from.id}: ${from.data.title}\n\n${(bodyText(from.text) ?? '').trim()}`;
    absorbed.push({ id: from.id, added, questions: moved });
  }
  const patch: TicketPatch = { touches: lists.touches, violates: lists.violates, depends_on: lists.depends_on, body: `${body}\n` };
  if (questions.length > into.data.questions.length) patch.questions = questions;
  return {
    patches: [{ id: into.id, patch }, ...froms.map((f) => ({ id: f.id, patch: { status: 'absorbed' as const, absorbed_into: into.id } }))],
    absorbed,
  };
}

/** The text output: one line per FROM, then (the caller adds) a blank line and the gate. */
export function renderCombine(into: string, absorbed: readonly AbsorbedTicket[]): string {
  return absorbed
    .map((a) => `${a.id} absorbed into ${into} (added ${a.added.length > 0 ? a.added.join(', ') : 'nothing'}; ${a.questions.length > 0 ? a.questions.map((q) => `${q.from} → ${q.to}`).join(', ') : 'no open questions'})`)
    .join('\n');
}
