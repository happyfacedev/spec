// Links a feature's steps already state (X134). Since X114 each verb sits at a fixed step position,
// so a contract's kind and the steps that cite it decide the verb, and only three verbs carry a
// fact no step can: `writes` (a Then checks a write and a read alike), `provides` (implementing an
// operation versus calling it) and `observes` (the test touches it, the code does not). Every
// other contract a step cites is derived: an entity or type is read; an operation is called; an
// event or error is consumed when a When cites it, or only a Given does, and emitted when it is
// the outcome. Checked against 416 hand-written links in seven specs: none derived differently.
import { refsMatch } from './ids';
import type { ContractKind, Feature, LinkKind, Ref } from './model';
import { stepCites } from './parse/feature';
import { isContractRef } from './scope';

/** Verbs a feature writes; the rest are derived from its steps. */
export const AUTHORED_LINKS = ['writes', 'provides', 'observes'] as const;
export const DERIVED_LINKS = ['reads', 'emits', 'consumes', 'calls'] as const;
export type DerivedLink = (typeof DERIVED_LINKS)[number];

/** The derived verb for a contract of `kind` cited at these step keywords. */
export function derivedVerb(kind: ContractKind | null, where: ReadonlySet<string>): DerivedLink {
  if (kind === 'operation') return 'calls';
  if (kind === 'event' || kind === 'error') return where.has('When') || !where.has('Then') ? 'consumes' : 'emits';
  return 'reads';
}

/** `f` with the links its steps state added: one per cited contract no written link covers. */
export function withDerivedLinks(f: Feature, kindOf: (id: string) => ContractKind | null): Feature {
  const written = (Object.keys(f.links) as LinkKind[]).flatMap((k) => f.links[k].map((r) => r.id)).filter(isContractRef);
  const writes = f.links.writes.map((r) => r.id);
  const cited = new Map<string, { where: Set<string>; line: number }>();
  for (const s of f.scenarios) {
    let current = 'Given';
    for (const st of s.steps) {
      if (st.keyword !== 'And' && st.keyword !== 'But') current = st.keyword;
      for (const id of stepCites(`${st.text}\n${st.attachment}`)) {
        if (!isContractRef(id)) continue;
        const c = cited.get(id) ?? { where: new Set<string>(), line: st.line };
        c.where.add(current);
        cited.set(id, c);
      }
    }
  }
  const derived: [string, DerivedLink, number][] = [];
  for (const [id, c] of cited) {
    const kind = kindOf(id);
    if (!written.some((w) => refsMatch(w, id))) {
      derived.push([id, derivedVerb(kind, c.where), c.line]);
      continue;
    }
    // A cite that overlaps a written link only in Thens checks that link ("Then no Message is
    // added" checks a write). Cited in a Given or When, a contract the feature writes is state it
    // depends on: it is read as well (read, then write). Observed and provided ones stay covered.
    const setup = c.where.has('Given') || c.where.has('When');
    const state = kind === 'entity' || kind === 'type';
    if (setup && state && writes.some((w) => refsMatch(w, id)) && !f.links.reads.some((r) => r.id === id)) derived.push([id, 'reads', c.line]);
  }
  if (derived.length === 0) return f;
  const links = Object.fromEntries(Object.entries(f.links).map(([k, v]) => [k, [...v]])) as Record<LinkKind, Ref[]>;
  for (const [id, verb, line] of derived) links[verb].push({ id, line });
  return { ...f, links, derived: derived.map(([id]) => id) };
}
