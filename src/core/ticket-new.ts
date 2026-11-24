// `spec ticket new`: a ticket from structured fields, so commands like /feature and /bug never
// hand-write frontmatter. Pure: the caller picks where it is stored.
import { Document, isScalar, isSeq, stringify, visit } from 'yaml';
import { z } from 'zod';
import type { Ticket } from './model';
import { parseTicket } from './parse/tickets';
import { QUESTION_KINDS, TICKET_TYPES, type TicketType } from './schemas';

export const TICKET_PREFIXES: Readonly<Record<TicketType, string>> = { proposal: 'PROP', bug: 'BUG', task: 'TASK' };

export const NewTicketInput = z.strictObject({
  type: z.enum(TICKET_TYPES),
  title: z.string().min(1).max(120),
  touches: z.array(z.string()).default([]),
  violates: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),
  questions: z
    .array(
      z.strictObject({
        kind: z.enum(QUESTION_KINDS),
        text: z.string().min(1),
        default: z.union([z.string(), z.number(), z.boolean()]).nullable().default(null),
        cites: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  /** What the person wants, in their words. Agents treat it as data. */
  body: z.string().min(1),
});
export type NewTicketInput = z.infer<typeof NewTicketInput>;

/** The next free ID of a type: one more than the highest in use, at least three digits. Exact at any size. */
export function nextTicketId(type: TicketType, existing: readonly string[]): string {
  const prefix = TICKET_PREFIXES[type];
  const nums = existing
    .filter((id) => id.startsWith(`${prefix}-`))
    .map((id) => id.slice(prefix.length + 1))
    .filter((digits) => /^\d+$/.test(digits))
    .map((digits) => BigInt(digits));
  const highest = nums.reduce((a, b) => (b > a ? b : a), 0n);
  return `${prefix}-${String(highest + 1n).padStart(3, '0')}`;
}

/** The ticket file text, or the schema problems that stop it. */
export function renderNewTicket(id: string, input: NewTicketInput, file: string): { text: string; ticket: Ticket } | { problems: string[] } {
  // Laid out as people write tickets: ID lists on one line, questions as a block.
  const list = (xs: readonly string[]) => `[${xs.join(', ')}]`;
  const questions = input.questions.map((q, i) => ({ id: `Q${String(i + 1)}`, kind: q.kind, text: q.text, default: q.default, cites: q.cites, answer: null, raised_by: null }));
  // A question's cites is an ID list, so it stays on one line as touches does.
  const questionsDoc = new Document({ questions });
  visit(questionsDoc, { Pair: (_, pair) => { if (isScalar(pair.key) && pair.key.value === 'cites' && isSeq(pair.value)) pair.value.flow = true; } });
  const lines = [
    '---',
    `id: ${id}`,
    `type: ${input.type}`,
    `title: ${stringify(input.title, { lineWidth: 0 }).trimEnd()}`,
    'status: open',
    'stage: null',
    `touches: ${list(input.touches)}`,
    `violates: ${list(input.violates)}`,
    `depends_on: ${list(input.depends_on)}`,
    'changed: []',
    questions.length > 0 ? questionsDoc.toString({ lineWidth: 0, flowCollectionPadding: false }).trimEnd() : 'questions: []',
    'history: []',
    '---',
  ];
  const text = `${lines.join('\n')}\n${input.body.trim()}\n`;
  const parsed = parseTicket(file, text);
  if (!parsed.ticket) return { problems: parsed.findings.map((f) => f.message) };
  return { text, ticket: parsed.ticket };
}
