// One lookup of every unit by ID, and one list of every authored link. Graph, lint, show and
// impact all read these, so a link means the same thing everywhere.
import { compareIds, compareStrings } from './ids';
import { type ContractKind, type Draft, LINK_KINDS, type OwnedQuestion, type Spec, type Unit } from './model';
import type { Status } from './schemas';

/** `uses`: a contract or member is typed by another contract (`Type:` or `Output:`). */
export type LinkKindAll = (typeof LINK_KINDS)[number] | 'uses' | 'shows' | 'applies' | 'supersedes' | 'superseded_by' | 'cites';

export interface Link {
  readonly from: string;
  readonly to: string;
  readonly kind: LinkKindAll;
  readonly file: string;
  readonly line: number;
  /** Status of the declaring unit. */
  readonly fromStatus: Status;
}

export type UnitType = Unit['type'];

export interface UnitIndex {
  readonly byId: ReadonlyMap<string, Unit>;
  /** Every definition, duplicates included, in file order. */
  readonly definitions: readonly Unit[];
  readonly links: readonly Link[];
  readonly questions: readonly OwnedQuestion[];
}

/** Still part of what the software does: active, or deprecated but served. */
export const isLive = (s: Status): boolean => s !== 'removed';

export function statusOf(u: Unit, byId: ReadonlyMap<string, Unit>): Status {
  if (u.type === 'scenario' || u.type === 'rule') {
    const f = byId.get(u.feature);
    return f && f.type === 'feature' ? f.status : 'active';
  }
  return u.status;
}

/** A unit's draft sources, or null once confirmed. Scenarios and rules follow their feature; fields their entity. */
export function draftOf(u: Unit, byId: ReadonlyMap<string, Unit>): Draft {
  if (u.type === 'scenario' || u.type === 'rule') {
    const f = byId.get(u.feature);
    return f && f.type === 'feature' ? f.draft : null;
  }
  if (u.type === 'field') {
    const c = byId.get(u.entity);
    return c && c.type === 'contract' ? c.draft : null;
  }
  return u.draft;
}

/** The kind of a contract, or of the contract a member belongs to; null for any other unit. */
export function contractKindOf(u: Unit, byId: ReadonlyMap<string, Unit>): ContractKind | null {
  if (u.type === 'contract') return u.kind;
  if (u.type === 'field') {
    const c = byId.get(u.entity);
    return c && c.type === 'contract' ? c.kind : null;
  }
  return null;
}

/** Fields count as contracts: a field may be superseded by a field or an entity. */
export function sameKind(a: UnitType, b: UnitType): boolean {
  const norm = (t: UnitType) => (t === 'field' ? 'contract' : t);
  return norm(a) === norm(b);
}

export function titleOf(u: Unit): string {
  switch (u.type) {
    case 'feature':
    case 'scenario':
    case 'invariant':
    case 'decision':
    case 'screen':
      return u.title;
    case 'rule':
      return u.text;
    case 'contract':
      return u.summary;
    case 'field':
      return u.text.split('\n')[1]?.trim() ?? '';
    case 'module':
      return u.responsibility.split(/(?<=\.)\s/)[0] ?? '';
  }
}

export function buildIndex(spec: Spec): UnitIndex {
  const definitions: Unit[] = [];
  for (const m of spec.modules) definitions.push(m);
  for (const f of spec.features) {
    definitions.push(f, ...f.scenarios, ...f.rules);
  }
  for (const c of spec.contracts) definitions.push(c, ...c.fields);
  definitions.push(...spec.invariants, ...spec.decisions, ...spec.screens);

  const byId = new Map<string, Unit>();
  for (const u of definitions) if (!byId.has(u.id)) byId.set(u.id, u);

  const links: Link[] = [];
  const push = (from: string, fromStatus: Status, kind: LinkKindAll, to: string, file: string, line: number) =>
    links.push({ from, to, kind, file, line, fromStatus });

  const questions: OwnedQuestion[] = [];
  for (const m of spec.modules) {
    if (m.supersededBy) push(m.id, m.status, 'superseded_by', m.supersededBy.id, m.file, m.supersededBy.line);
    questions.push(...m.questions);
  }
  for (const f of spec.features) {
    for (const k of LINK_KINDS) for (const r of f.links[k]) push(f.id, f.status, k, r.id, f.file, r.line);
    if (f.supersededBy) push(f.id, f.status, 'superseded_by', f.supersededBy.id, f.file, f.supersededBy.line);
    for (const s of f.scenarios) for (const c of s.cites) push(s.id, f.status, 'cites', c.id, f.file, c.line);
    for (const r of f.rules) for (const c of r.cites) push(r.id, f.status, 'cites', c.id, f.file, c.line);
    questions.push(...f.questions);
  }
  for (const c of spec.contracts) {
    for (const d of c.decisions) push(c.id, c.status, 'decisions', d.id, c.file, d.line);
    for (const u of c.uses) push(c.id, c.status, 'uses', u.id, c.file, u.line);
    if (c.supersededBy) push(c.id, c.status, 'superseded_by', c.supersededBy.id, c.file, c.supersededBy.line);
    for (const fl of c.fields) {
      for (const u of fl.uses) push(fl.id, fl.status, 'uses', u.id, fl.file, u.line);
      if (fl.supersededBy) push(fl.id, fl.status, 'superseded_by', fl.supersededBy.id, fl.file, fl.supersededBy.line);
    }
  }
  for (const i of spec.invariants) {
    for (const w of i.decisions) push(i.id, i.status, 'decisions', w.id, i.file, w.line);
    for (const a of i.applies) push(i.id, i.status, 'applies', a.id, i.file, a.line);
    if (i.supersededBy) push(i.id, i.status, 'superseded_by', i.supersededBy.id, i.file, i.supersededBy.line);
  }
  for (const d of spec.decisions) {
    for (const s of d.supersedes) push(d.id, d.status, 'supersedes', s.id, d.file, s.line);
    if (d.supersededBy) push(d.id, d.status, 'superseded_by', d.supersededBy.id, d.file, d.supersededBy.line);
    questions.push(...d.questions);
  }
  for (const s of spec.screens) {
    for (const r of s.shows) push(s.id, s.status, 'shows', r.id, s.file, r.line);
    for (const r of s.calls) push(s.id, s.status, 'calls', r.id, s.file, r.line);
    if (s.supersededBy) push(s.id, s.status, 'superseded_by', s.supersededBy.id, s.file, s.supersededBy.line);
    questions.push(...s.questions);
  }
  for (const q of questions) {
    const owner = byId.get(q.owner);
    const st = owner ? statusOf(owner, byId) : 'active';
    for (const c of q.cites) push(`${q.owner}#${q.id}`, st, 'cites', c, q.file, q.line);
  }
  links.sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to) || compareStrings(a.kind, b.kind) || a.line - b.line);
  return { byId, definitions, links, questions };
}

/** Links that point at `id`, excluding tombstone pointers. */
export function backlinks(index: UnitIndex, id: string): Link[] {
  return index.links.filter((l) => l.to === id && l.kind !== 'superseded_by');
}
