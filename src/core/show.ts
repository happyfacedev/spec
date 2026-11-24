// `spec show <ID>`: one unit as stored, plus generated backlinks (used by, cited by).
import { classifyId, compareIds, compareStrings, refsMatch } from './ids';
import type { Spec, Term, Ticket, TicketSet, Unit } from './model';
import { type Link, type UnitIndex, statusOf, titleOf } from './units';

export interface ShownUnit {
  id: string;
  type: string;
  file: string;
  line: number;
  status: string | null;
  text: string;
  usedBy: { id: string; kind: string; title: string }[];
  citedBy: { id: string; title: string }[];
}

const isContractish = (id: string) => {
  const k = classifyId(id);
  return k === 'contract' || k === 'field';
};

/** Links into `id`. Contract targets use ref matching: an entity and its fields reach each other. */
export function linksInto(index: UnitIndex, id: string): Link[] {
  const match = isContractish(id) ? (to: string) => isContractish(to) && refsMatch(to, id) : (to: string) => to === id;
  return index.links.filter((l) => l.kind !== 'superseded_by' && match(l.to));
}

function storedText(u: Unit): string {
  return u.type === 'rule' ? `- R${u.n}: ${u.text}` : u.text;
}

export function findTerm(spec: Spec, name: string): Term | null {
  const key = name.toLowerCase();
  return spec.terms.find((t) => t.term.toLowerCase() === key || t.aliases.some((a) => a.toLowerCase() === key)) ?? null;
}

export function showUnit(spec: Spec, index: UnitIndex, id: string, tickets: TicketSet | null): ShownUnit | null {
  const u = index.byId.get(id);
  if (u) {
    const into = linksInto(index, id).filter((l) => l.from !== id);
    const titled = (from: string) => {
      const owner = index.byId.get(from.split('#')[0] ?? from);
      return owner ? titleOf(owner) : '';
    };
    const usedBy = into
      .filter((l) => l.kind !== 'cites')
      .map((l) => ({ id: l.from, kind: l.to === id ? l.kind : `${l.kind} ${l.to}`, title: titled(l.from) }));
    const citedBy = [...new Map(into.filter((l) => l.kind === 'cites').map((l) => [l.from, { id: l.from, title: titled(l.from) }])).values()];
    usedBy.sort((a, b) => compareIds(a.id, b.id) || compareStrings(a.kind, b.kind));
    citedBy.sort((a, b) => compareIds(a.id, b.id));
    return { id, type: u.type, file: u.file, line: u.line, status: statusOf(u, index.byId), text: storedText(u), usedBy, citedBy };
  }
  const t = findTerm(spec, id);
  if (t) return { id: t.term, type: 'term', file: t.file, line: t.line, status: null, text: t.text, usedBy: [], citedBy: [] };
  const ticket: Ticket | undefined = tickets?.tickets.find((x) => x.id === id);
  if (ticket) return { id, type: 'ticket', file: ticket.file, line: 1, status: ticket.data.status, text: ticket.text, usedBy: [], citedBy: [] };
  return null;
}

export function renderShown(s: ShownUnit): string {
  const lines = [`${s.file}:${s.line}`, '', s.text.replace(/\n+$/, '')];
  if (s.usedBy.length > 0 || s.citedBy.length > 0) lines.push('', '## Backlinks (generated)');
  if (s.usedBy.length > 0) {
    lines.push('Used by:');
    for (const u of s.usedBy) lines.push(`- ${u.id} ${u.kind}${u.title ? ` — ${u.title}` : ''}`);
  }
  if (s.citedBy.length > 0) {
    lines.push('Cited by:');
    for (const c of s.citedBy) lines.push(`- ${c.id}${c.title ? ` — ${c.title}` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}
