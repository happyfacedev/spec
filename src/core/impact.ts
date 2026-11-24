// `spec impact`: the reach of a change, from spec files alone (D7). Two rings, must change and
// must re-verify, with the exact scenarios each change reaches. Contracts are the boundary:
// depth 1 stops at direct consumers.
import { classifyId, compareIds, compareStrings, refsMatch, sortIds } from './ids';
import { CONSUMER_LINKS, type ContractLink, type Feature, PRODUCER_LINKS, type Spec, type Ticket } from './model';
import { type ScopeGap, isContractRef, owningFeature, scopeGaps, ticketScope } from './scope';
import { type UnitIndex, isLive } from './units';

export interface ImpactItem {
  id: string;
  via: string[];
  scenarios: string[];
  depth?: number;
}

export interface Impact {
  target: string;
  spec: string;
  /**
   * True for a task: it changes no behaviour, so the inner ring is what must keep holding, not
   * what must change. The rings are the same; only what they ask of the work differs.
   */
  holds: boolean;
  changed: string[];
  mustChange: ImpactItem[];
  reverify: ImpactItem[];
  scopeGaps: ScopeGap[];
  /** IDs in the target ticket that name no unit. */
  unresolved: string[];
}

export const IMPACT_TARGETS = ['feature', 'scenario', 'rule', 'contract', 'field', 'invariant', 'decision', 'screen', 'ticket'] as const;

class Ring {
  private readonly items = new Map<string, { via: Set<string>; scenarios: Set<string>; depth: number }>();
  add(id: string, via: readonly string[], scenarios: readonly string[], depth = 1): void {
    const cur = this.items.get(id) ?? { via: new Set(), scenarios: new Set(), depth };
    for (const v of via) cur.via.add(v);
    for (const s of scenarios) cur.scenarios.add(s);
    cur.depth = Math.min(cur.depth, depth);
    this.items.set(id, cur);
  }
  has(id: string): boolean {
    return this.items.has(id);
  }
  ids(): string[] {
    return [...this.items.keys()];
  }
  delete(id: string): void {
    this.items.delete(id);
  }
  depthOf(id: string): number {
    return this.items.get(id)?.depth ?? 1;
  }
  toItems(withDepth: boolean): ImpactItem[] {
    return sortIds(this.items.keys()).map((id) => {
      const it = this.items.get(id);
      const via = [...(it?.via ?? [])].sort(compareStrings);
      const scenarios = sortIds(it?.scenarios ?? []);
      return withDepth ? { id, via, scenarios, depth: it?.depth ?? 1 } : { id, via, scenarios };
    });
  }
}

const matches = (cite: string, ref: string): boolean => (isContractRef(cite) && isContractRef(ref) ? refsMatch(cite, ref) : cite === ref);

/** Scenarios of `f` whose steps cite something matching any of `refs`. */
function flagged(f: Feature, refs: readonly string[]): string[] {
  return f.scenarios.filter((s) => s.cites.some((c) => refs.some((r) => matches(c.id, r)))).map((s) => s.id);
}

/** "reads conversation.Message (whole)" when an entity-level link reaches a field target. */
function viaText(kind: string, linkRef: string, target: string): string {
  const whole = isContractRef(target) && target.split('.').length === 3 && linkRef.split('.').length === 2;
  return `${kind} ${linkRef}${whole ? ' (whole)' : ''}`;
}

function linksMatching(f: Feature, kinds: readonly ContractLink[], target: string): { kind: ContractLink; ref: string }[] {
  return kinds.flatMap((kind) => f.links[kind].filter((r) => refsMatch(r.id, target)).map((r) => ({ kind, ref: r.id })));
}

interface Acc {
  readonly spec: Spec;
  readonly index: UnitIndex;
  readonly inner: Ring;
  readonly outer: Ring;
  readonly changed: Set<string>;
}

/** Features still served: active, or deprecated but still running. A removed one is history. */
const activeFeatures = (spec: Spec) => spec.features.filter((f) => isLive(f.status));

/**
 * Active contracts and members that use `target` (as their type, or in their text), directly or
 * through another user: a change to a type changes the shape of everything typed by it.
 */
export function usersOf(index: UnitIndex, target: string): string[] {
  const out: string[] = [];
  const seen = new Set([target]);
  const queue = [target];
  for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
    for (const l of index.links) {
      if (l.kind !== 'uses' || !isLive(l.fromStatus) || seen.has(l.from) || !refsMatch(l.to, t)) continue;
      seen.add(l.from);
      out.push(l.from);
      queue.push(l.from);
    }
  }
  return sortIds(out);
}

/**
 * Scenarios of `f` that show `id` (an invariant or a rule): they cite it, or cite a rule of `f`
 * that cites it. Their tests are the ones that check it.
 */
function showingIn(f: Feature, id: string): string[] {
  const viaRule = new Set(f.rules.filter((r) => r.cites.some((c) => c.id === id)).map((r) => r.id));
  return f.scenarios.filter((s) => s.cites.some((c) => c.id === id || viaRule.has(c.id))).map((s) => s.id);
}

/** Live scenarios that show `id`; see `showingIn`. */
export function scenariosShowing(spec: Spec, id: string): string[] {
  const out: string[] = [];
  for (const f of spec.features) if (isLive(f.status)) out.push(...showingIn(f, id));
  return sortIds(out);
}

function contractImpact(a: Acc, target: string): void {
  for (const u of [target, ...usersOf(a.index, target)]) {
    const note = u === target ? '' : ` (uses ${target})`;
    // An invariant that applies to the contract must still hold: re-verify the scenarios showing it.
    for (const i of a.spec.invariants) {
      if (!isLive(i.status)) continue;
      const hits = i.applies.filter((r) => refsMatch(r.id, u));
      if (hits.length > 0) a.outer.add(i.id, hits.map((r) => `${i.id} applies to ${r.id}${note}`), scenariosShowing(a.spec, i.id));
    }
    for (const f of activeFeatures(a.spec)) {
      const produce = linksMatching(f, PRODUCER_LINKS, u);
      const consume = linksMatching(f, CONSUMER_LINKS, u);
      if (produce.length > 0) {
        a.inner.add(f.id, [...produce, ...consume].map((l) => `${viaText(l.kind, l.ref, u)}${note}`), flagged(f, [u]));
      } else if (consume.length > 0) {
        a.outer.add(f.id, consume.map((l) => `${viaText(l.kind, l.ref, u)}${note}`), flagged(f, [u]));
      }
    }
    // A screen that shows the contract, or calls it, renders what changes: re-verify it.
    for (const s of a.spec.screens) {
      if (!isLive(s.status)) continue;
      const via = [...s.shows.map((r) => ({ kind: 'shows', r })), ...s.calls.map((r) => ({ kind: 'calls', r }))].filter((x) => refsMatch(x.r.id, u));
      if (via.length > 0) a.outer.add(s.id, via.map((x) => `${s.id} ${x.kind} ${x.r.id}${note}`), []);
    }
  }
}

/** Consumers of `from`'s outputs onto the outer ring, except `from` and anything in `skip`. */
function consumersOf(a: Acc, from: Feature, depth: number, note: string, skip: ReadonlySet<string> = new Set()): void {
  const outputs = PRODUCER_LINKS.flatMap((k) => from.links[k].map((r) => r.id));
  // A feature that writes a type's members changes every contract typed by it too (X122): a
  // reader of `conversation.Message` reads what PRV-002 writes into `conversation.DeliveryMeta`.
  const reached = new Map<string, string>();
  for (const o of outputs) {
    if (!reached.has(o)) reached.set(o, '');
    for (const u of usersOf(a.index, o)) if (!reached.has(u)) reached.set(u, ` (uses ${o})`);
  }
  const targets = [...reached.keys()];
  for (const g of activeFeatures(a.spec)) {
    if (g.id === from.id || skip.has(g.id)) continue;
    const hits = CONSUMER_LINKS.flatMap((kind) =>
      g.links[kind].filter((r) => targets.some((o) => refsMatch(r.id, o))).map((r) => ({ kind, ref: r.id })),
    );
    if (hits.length === 0) continue;
    const matched = targets.filter((o) => hits.some((h) => refsMatch(h.ref, o)));
    const via = hits.map((h) => {
      const out = matched.find((o) => refsMatch(h.ref, o)) ?? h.ref;
      return `${viaText(h.kind, h.ref, out)}${reached.get(out) ?? ''}${note}`;
    });
    a.outer.add(g.id, [...new Set(via)], flagged(g, matched), depth);
  }
  // Screens that show or call what the feature produces render the change.
  for (const s of a.spec.screens) {
    if (!isLive(s.status) || skip.has(s.id)) continue;
    const via = [...s.shows.map((r) => ({ kind: 'shows', r })), ...s.calls.map((r) => ({ kind: 'calls', r }))].filter((x) => outputs.some((o) => refsMatch(x.r.id, o)));
    if (via.length > 0) a.outer.add(s.id, via.map((x) => `${s.id} ${x.kind} ${x.r.id}${note}`), [], depth);
  }
}

function featureImpact(a: Acc, f: Feature): void {
  a.changed.add(f.id);
  for (const kind of PRODUCER_LINKS) {
    for (const r of f.links[kind]) a.inner.add(r.id, [`${f.id} ${kind} ${r.id}`], flagged(f, [r.id]));
  }
  consumersOf(a, f, 1, '');
}

function citedImpact(a: Acc, id: string): void {
  const kind = classifyId(id);
  for (const f of activeFeatures(a.spec)) {
    const via: string[] = [];
    const key = kind === 'invariant' ? 'invariants' : kind === 'decision' ? 'decisions' : 'ui';
    if (f.links[key].some((r) => r.id === id)) via.push(`${key} ${id}`);
    for (const s of f.scenarios) if (s.cites.some((c) => c.id === id)) via.push(`${s.id} cites ${id}`);
    for (const r of f.rules) if (r.cites.some((c) => c.id === id)) via.push(`${r.id} cites ${id}`);
    for (const q of f.questions) if (q.cites.includes(id)) via.push(`${f.id}#${q.id} cites ${id}`);
    if (via.length === 0) continue;
    // A screen reaches the scenarios that show it. An invariant reaches the scenarios that show it
    // (they cite it, or a rule that cites it: they are the ones that check it), or every scenario
    // when none does; a decision, every one.
    const shown = kind === 'invariant' ? showingIn(f, id) : flagged(f, [id]);
    const scenarios = kind === 'screen' || (kind === 'invariant' && shown.length > 0) ? shown : f.scenarios.map((s) => s.id);
    a.inner.add(f.id, via, scenarios);
  }
  if (kind === 'decision') {
    for (const c of a.spec.contracts) if (isLive(c.status) && c.decisions.some((d) => d.id === id)) a.inner.add(c.id, [`decisions ${id}`], []);
    for (const i of a.spec.invariants) if (isLive(i.status) && i.decisions.some((w) => w.id === id)) a.inner.add(i.id, [`decisions ${id}`], []);
  }
}

function unitImpact(a: Acc, index: UnitIndex, id: string): boolean {
  const kind = classifyId(id);
  if (kind === 'contract' || kind === 'field') {
    if (!index.byId.has(id)) return false;
    contractImpact(a, id);
    return true;
  }
  if (kind === 'invariant' || kind === 'decision' || kind === 'screen') {
    if (!index.byId.has(id)) return false;
    citedImpact(a, id);
    return true;
  }
  const owner = owningFeature(id);
  const f = owner === null ? undefined : a.spec.features.find((x) => x.id === owner);
  if (!f || !index.byId.has(id)) return false;
  featureImpact(a, f);
  return true;
}

/** Follows consumer outputs to `depth`, marking each new item with its depth. */
function expand(a: Acc, depth: number): void {
  let frontier = a.outer.ids();
  for (let d = 2; d <= depth && frontier.length > 0; d++) {
    // Reached at a shallower depth, or changing anyway: not re-added. Same-depth paths all count.
    const skip = new Set([...a.outer.ids(), ...a.inner.ids(), ...a.changed]);
    for (const id of frontier) {
      const f = a.spec.features.find((x) => x.id === id);
      if (f) consumersOf(a, f, d, ` (from ${f.id})`, skip);
    }
    frontier = a.outer.ids().filter((id) => !skip.has(id));
  }
}

export interface ImpactOptions {
  readonly depth?: number;
}

export function computeImpact(spec: Spec, index: UnitIndex, target: string, ticket: Ticket | null, opts: ImpactOptions = {}): Impact {
  const depth = opts.depth ?? 1;
  const a: Acc = { spec, index, inner: new Ring(), outer: new Ring(), changed: new Set() };
  const unresolved: string[] = [];
  let gaps: ScopeGap[] = [];
  if (ticket) {
    const scope = ticketScope(ticket.data);
    for (const id of scope.units) if (!unitImpact(a, index, id)) unresolved.push(id);
    for (const f of scope.features) if (spec.features.some((x) => x.id === f)) a.changed.add(f);
    gaps = scopeGaps(spec, scope);
  } else if (!unitImpact(a, index, target)) {
    unresolved.push(target);
  }
  // Changed features leave the rings; the inner ring wins over the outer.
  for (const id of a.changed) {
    a.inner.delete(id);
    a.outer.delete(id);
  }
  for (const id of a.inner.ids()) a.outer.delete(id);
  if (depth > 1) expand(a, depth);
  return {
    target,
    spec: spec.version,
    holds: ticket?.data.type === 'task',
    changed: sortIds(a.changed),
    mustChange: a.inner.toItems(false),
    reverify: a.outer.toItems(depth > 1),
    scopeGaps: [...gaps].sort((x, y) => compareIds(x.id, y.id)),
    unresolved: sortIds(unresolved),
  };
}

/** How many distinct scenarios an impact reaches: those of its changed features and those it flags in both rings. */
export function reachedScenarios(spec: Spec, i: Impact): number {
  const ids = new Set<string>();
  for (const it of [...i.mustChange, ...i.reverify]) for (const s of it.scenarios) ids.add(s);
  for (const f of spec.features) if (i.changed.includes(f.id)) for (const s of f.scenarios) ids.add(s.id);
  return ids.size;
}

export function renderImpact(i: Impact, titleOf: (id: string) => string): string {
  const lines = [`# Impact · ${i.target} · ${i.spec}`, ''];
  const section = (name: string, items: readonly ImpactItem[]) => {
    lines.push(`## ${name} (${items.length})`);
    if (items.length === 0) lines.push('None');
    for (const it of items) {
      const title = titleOf(it.id);
      lines.push(`- ${it.id}${title ? ` ${title}` : ''}${it.depth !== undefined ? ` [depth ${it.depth}]` : ''}`);
      lines.push(`  via: ${it.via.join('; ')}`);
      if (it.scenarios.length > 0) lines.push(`  scenarios: ${it.scenarios.join(', ')}`);
    }
    lines.push('');
  };
  if (i.changed.length > 0) lines.push(`${i.holds ? 'Reworked' : 'Changed'}: ${i.changed.join(', ')}`, '');
  if (i.holds) lines.push('A task changes no behaviour: everything below must hold exactly as it is.', '');
  section(i.holds ? 'Must hold' : 'Must change', i.mustChange);
  section('Re-verify', i.reverify);
  lines.push(`## Scope gaps (${i.scopeGaps.length})`);
  if (i.scopeGaps.length === 0) lines.push('None');
  for (const g of i.scopeGaps) lines.push(`- ${g.text}`);
  if (i.unresolved.length > 0) lines.push('', `Unresolved: ${i.unresolved.join(', ')}`);
  return `${lines.join('\n')}\n`;
}
