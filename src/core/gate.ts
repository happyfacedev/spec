// `spec gate <TICKET>`: ready only with a clear path. No brief is built for a ticket it refuses.
import { type Finding, compareFindings } from './findings';
import { closestId, compareIds } from './ids';
import { questionKind } from './lint/rules';
import { LINK_KINDS, type OwnedQuestion, type Spec, type Ticket } from './model';
import { ticketTypeProblems } from './schemas';
import { scopeGaps, ticketScope } from './scope';
import { type UnitIndex, draftOf, statusOf } from './units';

export type BlockerKind = 'absorbed' | 'schema' | 'unresolved' | 'removed' | 'draft' | 'question' | 'scope_gap' | 'dependency';

/** What the gate needs to know about other tickets: their status, and whether their work landed. */
export interface Dependencies {
  readonly status: ReadonlyMap<string, string>;
  /** Tickets whose work is in the base branch: done, with their branch merged or never made. */
  readonly landed: ReadonlySet<string>;
  /** Tickets with a branch not merged into the base branch. */
  readonly unmerged: ReadonlySet<string>;
  /** Absorbed tickets and the ticket each went into. */
  readonly absorbedInto: ReadonlyMap<string, string>;
}

/** `branches`: tickets with a branch; `merged`: tickets whose branch is merged into the base. */
export function dependencies(tickets: readonly Ticket[], branches: ReadonlySet<string>, merged: ReadonlySet<string>): Dependencies {
  const status = new Map(tickets.map((t) => [t.id, t.data.status]));
  const landed = new Set(tickets.filter((t) => t.data.status === 'done' && (!branches.has(t.id) || merged.has(t.id))).map((t) => t.id));
  const unmerged = new Set([...branches].filter((id) => !merged.has(id)));
  const absorbedInto = new Map(tickets.flatMap((t) => (t.data.status === 'absorbed' && t.data.absorbed_into !== undefined ? [[t.id, t.data.absorbed_into] as [string, string]] : [])));
  return { status, landed, unmerged, absorbedInto };
}

export interface GateBlocker {
  kind: BlockerKind;
  id: string;
  text: string;
}

export interface GatePreference {
  id: string;
  default: string;
  text: string;
}

export interface GateResult {
  ticket: string;
  ready: boolean;
  blockers: GateBlocker[];
  preferences: GatePreference[];
}

const KIND_ORDER: readonly BlockerKind[] = ['absorbed', 'schema', 'unresolved', 'removed', 'draft', 'question', 'scope_gap', 'dependency'];

/** Open questions in the ticket's scope: on the ticket, and on every unit and feature in scope. */
export function scopeQuestions(index: UnitIndex, ticket: Ticket): OwnedQuestion[] {
  const scope = ticketScope(ticket.data);
  const owners = new Set([...scope.units, ...scope.features]);
  const unitQs = index.questions.filter((q) => owners.has(q.owner));
  return [...ticket.questions, ...unitQs].filter((q) => q.answer === null);
}

/**
 * `ticket` is null when the file does not parse; `fileFindings` are the store's findings for it.
 * `deps` checks `depends_on`; without it, dependencies are not checked.
 */
export function gateTicket(spec: Spec, index: UnitIndex, id: string, ticket: Ticket | null, fileFindings: readonly Finding[], deps: Dependencies | null = null): GateResult {
  const blockers: GateBlocker[] = [];
  const schema = (f: Pick<Finding, 'message' | 'fix'>) => blockers.push({ kind: 'schema', id, text: `${f.message}: ${f.fix}` });

  // 0. An absorbed ticket is final: its work goes on in the ticket it went into, and nothing else is checked (TKT-012/R4).
  if (ticket?.data.status === 'absorbed') {
    const into = ticket.data.absorbed_into;
    if (into === undefined) schema({ message: 'an absorbed ticket names the ticket it went into', fix: 'add absorbed_into' });
    else blockers.push({ kind: 'absorbed', id: into, text: `${id} was absorbed into ${into}; its work goes on there` });
    return finish(id, blockers, []);
  }

  // 1. Schema, including the type's required fields and question kinds.
  for (const f of [...fileFindings].sort(compareFindings)) if (f.severity === 'error') schema(f);
  if (!ticket) return finish(id, blockers, []);
  for (const p of ticketTypeProblems(ticket.data)) schema(p);
  for (const f of questionKind(ticket.questions)) blockers.push({ kind: 'schema', id: f.id ?? id, text: `${f.message}: ${f.fix}` });

  // 2. Every ID in touches and violates resolves to an active unit.
  const known = [...index.byId.keys()];
  for (const ref of [...new Set([...ticket.data.touches, ...ticket.data.violates])]) {
    const u = index.byId.get(ref);
    if (!u) {
      const near = closestId(ref, known);
      blockers.push({ kind: 'unresolved', id: ref, text: `${ref} does not exist${near ? `; did you mean ${near}?` : ''}` });
    } else if (statusOf(u, index.byId) === 'removed') {
      // A deprecated unit is still served, so a bug or a migration may work on it; a removed one is history.
      const sup = 'supersededBy' in u && u.supersededBy ? `; use ${u.supersededBy.id}` : '';
      blockers.push({ kind: 'removed', id: ref, text: `${ref} is removed${sup}` });
    } else {
      // A removed module's units are history too, whatever their own status says (X130).
      const owner = u.type === 'scenario' || u.type === 'rule' ? index.byId.get(u.feature) : u.type === 'field' ? index.byId.get(u.entity) : u;
      const mod = owner?.type === 'feature' ? owner.module : owner?.type === 'contract' ? owner.homeModule : null;
      const m = mod === null ? undefined : spec.modules.find((x) => x.id === mod);
      if (m?.status === 'removed' && !blockers.some((b) => b.id === m.id)) blockers.push({ kind: 'removed', id: m.id, text: `${ref} is in module ${m.id}, which is removed` });
    }
  }
  // Work never builds on a drafted unit a person has not confirmed (ROADMAP 1b).
  const drafts = new Set<string>();
  for (const ref of [...ticketScope(ticket.data).units, ...ticketScope(ticket.data).features]) {
    const u = index.byId.get(ref);
    if (!u || draftOf(u, index.byId) === null) continue;
    const owner = u.type === 'scenario' || u.type === 'rule' ? u.feature : u.type === 'field' ? u.entity : u.id;
    drafts.add(owner);
  }
  // Nor on a draft its features use, directly or through the types those contracts use: a
  // confirmed feature that reads a contract typed by a drafted type builds on the draft.
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const u = index.byId.get(id);
    if (!u) return;
    if (draftOf(u, index.byId) !== null) drafts.add(u.type === 'field' ? u.entity : u.id);
    const entity = u.type === 'field' ? u.entity : u.id;
    for (const l of index.links) if (l.kind === 'uses' && (l.from === id || l.from === entity || l.from.startsWith(`${id}.`))) visit(l.to);
  };
  for (const fid of ticketScope(ticket.data).features) {
    const f = index.byId.get(fid);
    if (f?.type !== 'feature') continue;
    for (const k of LINK_KINDS) for (const r of f.links[k]) visit(r.id);
  }
  for (const d of drafts) blockers.push({ kind: 'draft', id: d, text: `${d} is a draft, not yet confirmed` });

  // 3. No open blocker on the ticket or on any unit in its scope. Preferences proceed on default.
  const preferences: GatePreference[] = [];
  for (const q of scopeQuestions(index, ticket)) {
    const qid = `${q.owner}#${q.id}`;
    if (q.kind === 'blocker' || q.kind === 'external') blockers.push({ kind: 'question', id: qid, text: q.text });
    else if (q.default !== null) preferences.push({ id: qid, default: q.default, text: q.text });
  }

  // 4. No scope gap.
  for (const g of scopeGaps(spec, ticketScope(ticket.data))) blockers.push({ kind: 'scope_gap', id: g.id, text: g.text });

  // 5. Every ticket it depends on is done, and its work is in the base branch.
  if (deps) {
    for (const dep of ticket.data.depends_on) {
      const st = deps.status.get(dep);
      if (st === undefined) {
        const near = closestId(dep, [...deps.status.keys()]);
        blockers.push({ kind: 'unresolved', id: dep, text: `depends_on ${dep}, which is not a ticket${near ? `; did you mean ${near}?` : ''}` });
      } else if (st === 'absorbed') {
        const into = deps.absorbedInto.get(dep);
        blockers.push({ kind: 'unresolved', id: dep, text: `depends_on ${dep}, which was absorbed${into === undefined ? '' : ` into ${into}`}: depend on ${into ?? 'the ticket it went into'} instead` });
      } else if (st !== 'done') blockers.push({ kind: 'dependency', id: dep, text: `waits for ${dep}, which is ${st.replace('_', ' ')}` });
      else if (!deps.landed.has(dep)) blockers.push({ kind: 'dependency', id: dep, text: `waits for ${dep}: it is done, but ticket/${dep} is not merged into the base branch yet` });
    }
  }

  return finish(id, blockers, preferences);
}

function finish(ticket: string, blockers: GateBlocker[], preferences: GatePreference[]): GateResult {
  blockers.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || compareIds(a.id, b.id));
  preferences.sort((a, b) => compareIds(a.id, b.id));
  return { ticket, ready: blockers.length === 0, blockers, preferences };
}

/** How to clear each kind of blocker, for the gate's text output and refused briefs. */
export const UNBLOCK: Readonly<Record<BlockerKind, string>> = {
  absorbed: 'nothing to clear: work on the ticket it was absorbed into',
  schema: 'fix the ticket file so it matches the ticket schema',
  unresolved: 'correct the ID in touches or violates, or create the unit first',
  removed: 'point the ticket at the unit that replaced it',
  draft: 'check the drafted unit against what the software should do, then run spec confirm <ID>',
  question: "answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record",
  scope_gap: 'add the named feature to touches, or narrow the contracts the ticket touches',
  dependency: 'finish the ticket it depends on and merge its branch; this clears by itself, no answer is needed',
};

export function renderGate(g: GateResult, ticketFile: string | null): string {
  const lines = [`${g.ticket}: ${g.ready ? 'ready' : 'not ready'}`];
  if (g.blockers.length > 0) {
    lines.push('', 'Blockers:');
    for (const b of g.blockers) lines.push(`- ${b.kind} ${b.id}: ${b.text}`);
    lines.push('', 'To unblock:');
    for (const kind of KIND_ORDER) {
      if (g.blockers.some((b) => b.kind === kind)) lines.push(`- ${kind}: ${UNBLOCK[kind]}${ticketFile && kind === 'schema' ? ` (${ticketFile})` : ''}`);
    }
  }
  if (g.preferences.length > 0) {
    lines.push('', 'Preferences (work proceeds on the default):');
    for (const p of g.preferences) lines.push(`- ${p.id} ${p.text} → ${p.default}`);
  }
  return `${lines.join('\n')}\n`;
}
