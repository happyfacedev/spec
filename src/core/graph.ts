// _generated/graph.json: the whole graph for people and other tools, built by `spec build` and
// ignored by git. No command reads it back.
import { compareIds, compareStrings, contractModule } from './ids';
import { CODE_LINKS, type Spec, type Term } from './model';
import { TermFinder } from './terms';
import { type UnitIndex, buildIndex, statusOf } from './units';

export interface GraphNode {
  id: string;
  type: string;
  kind?: string;
  module?: string;
  title?: string;
  status: string;
  file: string;
  line: number;
}

export interface Graph {
  spec: string;
  nodes: GraphNode[];
  edges: { from: string; to: string; kind: string }[];
  scenarios: { id: string; feature: string; title: string; cites: string[] }[];
  questions: { owner: string; id: string; kind: string; open: boolean }[];
  terms: { term: string; aliases: string[]; usedBy: string[] }[];
}

export function buildGraph(spec: Spec, index: UnitIndex = buildIndex(spec)): Graph {
  const nodes: GraphNode[] = [];
  for (const u of index.byId.values()) {
    if (u.type === 'scenario') continue;
    switch (u.type) {
      case 'module':
        nodes.push({ id: u.id, type: u.type, status: u.status, file: u.file, line: u.line });
        continue;
      case 'feature':
        nodes.push({ id: u.id, type: u.type, module: u.module, title: u.title, status: u.status, file: u.file, line: u.line });
        continue;
      case 'rule': {
        const owner = index.byId.get(u.feature);
        nodes.push({ id: u.id, type: u.type, module: owner?.type === 'feature' ? owner.module : undefined, title: u.text, status: statusOf(u, index.byId), file: u.file, line: u.line });
        continue;
      }
      case 'contract':
        nodes.push({ id: u.id, type: u.type, kind: u.kind, module: u.homeModule, title: u.summary, status: u.status, file: u.file, line: u.line });
        continue;
      case 'field':
        nodes.push({ id: u.id, type: u.type, module: u.id.split('.')[0], status: u.status, file: u.file, line: u.line });
        continue;
      case 'invariant':
      case 'decision':
      case 'screen':
        nodes.push({ id: u.id, type: u.type, title: u.title, status: u.status, file: u.file, line: u.line });
        continue;
    }
  }
  nodes.sort((a, b) => compareIds(a.id, b.id));

  const edgeKeys = new Set<string>();
  const edges: Graph['edges'] = [];
  for (const l of index.links) {
    if (l.kind === 'cites' && index.byId.get(l.from)?.type === 'scenario') continue;
    const key = `${l.from}\0${l.to}\0${l.kind}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from: l.from, to: l.to, kind: l.kind });
  }
  for (const [from, to] of moduleDependencies(spec)) edges.push({ from, to, kind: 'depends_on' });
  edges.sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to) || compareStrings(a.kind, b.kind));

  const scenarios = spec.features
    .flatMap((f) => f.scenarios.map((s) => ({ id: s.id, feature: f.id, title: s.title, cites: s.cites.map((c) => c.id) })))
    .sort((a, b) => compareIds(a.id, b.id));

  const questions = index.questions
    .map((q) => ({ owner: q.owner, id: q.id, kind: q.kind, open: q.answer === null }))
    .sort((a, b) => compareIds(a.owner, b.owner) || compareIds(a.id, b.id));

  const finder = new TermFinder(spec.terms);
  const usedBy = new Map<Term, string[]>(spec.terms.map((t) => [t, []]));
  for (const f of spec.features) for (const t of finder.usedIn(f.body)) usedBy.get(t)?.push(f.id);
  const terms = spec.terms.map((t) => ({ term: t.term, aliases: [...t.aliases], usedBy: usedBy.get(t) ?? [] }));

  return { spec: spec.version, nodes, edges, scenarios, questions, terms };
}

/**
 * Module A depends on module B when a live feature of A's code uses a contract of B. Derived, never
 * written: a hand-kept list drifts from what the features say. `observes` is left out: a test that
 * checks another module's contract is no dependency of the code.
 */
export function moduleDependencies(spec: Spec): [string, string][] {
  const pairs = new Set<string>();
  for (const f of spec.features) {
    if (f.status === 'removed') continue;
    for (const k of CODE_LINKS) {
      for (const r of f.links[k]) {
        const to = contractModule(r.id);
        if (to !== f.module) pairs.add(`${f.module}\0${to}`);
      }
    }
  }
  return [...pairs].map((p) => p.split('\0') as [string, string]).sort((a, b) => compareStrings(a[0], b[0]) || compareStrings(a[1], b[1]));
}

/** Stable JSON: insertion-ordered keys, 2-space indent, LF, trailing newline. */
export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
