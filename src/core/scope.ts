// A ticket's scope and its scope gaps. impact and gate share this one rule.
import { classifyId, refsMatch, uniqueSorted } from './ids';
import { type Feature, PRODUCER_LINKS, type Spec } from './model';
import type { TicketFrontmatter } from './schemas';

export interface ScopeGap {
  readonly id: string;
  readonly text: string;
}

export const isContractRef = (id: string): boolean => {
  const k = classifyId(id);
  return k === 'contract' || k === 'field';
};

/** The feature that owns a scenario or rule ID, or the ID itself for a feature. */
export function owningFeature(id: string): string | null {
  const k = classifyId(id);
  if (k === 'feature') return id;
  if (k === 'scenario' || k === 'rule') return id.slice(0, id.indexOf('/'));
  return null;
}

export interface TicketScope {
  /** touches, violates and changed, in that order, deduplicated. */
  readonly units: readonly string[];
  /** Features in scope: named directly, or owning a named scenario or rule. */
  readonly features: readonly string[];
  /** Contract refs in touches and changed: the ones the scope-gap rule checks. */
  readonly contracts: readonly string[];
}

export function ticketScope(t: Pick<TicketFrontmatter, 'touches' | 'violates' | 'changed'>): TicketScope {
  const units = [...new Set([...t.touches, ...t.violates, ...t.changed])];
  const features = uniqueSorted(units.map(owningFeature).filter((f): f is string => f !== null));
  const contracts = uniqueSorted([...t.touches, ...t.changed].filter(isContractRef));
  return { units, features, contracts };
}

/**
 * Every active feature that writes or emits a contract in touches or changed must itself be in
 * scope. A whole-entity ref and its field refs match each other.
 */
export function scopeGaps(spec: Spec, scope: TicketScope): ScopeGap[] {
  const inScope = new Set(scope.features);
  const gaps: ScopeGap[] = [];
  for (const f of spec.features) {
    if (f.status === 'removed' || inScope.has(f.id)) continue;
    const hits = producerLinksMatching(f, scope.contracts);
    if (hits.length > 0) gaps.push({ id: f.id, text: `${f.id} ${hits.join(', ')}: add it to touches` });
  }
  return gaps;
}

function producerLinksMatching(f: Feature, contracts: readonly string[]): string[] {
  const out: string[] = [];
  for (const kind of PRODUCER_LINKS) {
    for (const r of f.links[kind]) if (contracts.some((c) => refsMatch(r.id, c))) out.push(`${kind} ${r.id}`);
  }
  return out;
}
