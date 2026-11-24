// ID patterns are owned here, and only here: `spec show` and lint messages name them for readers.

export const PATTERNS = {
  module: /^[a-z][a-z0-9-]*$/,
  prefix: /^[A-Z]{2,4}$/,
  feature: /^[A-Z]{2,4}-\d{3,4}$/,
  scenario: /^[A-Z]{2,4}-\d{3,4}\/S\d+$/,
  rule: /^[A-Z]{2,4}-\d{3,4}\/R\d+$/,
  // A member name may start with a capital and use underscores, so it can match the code's name
  // exactly in any stack: `created_at` (Python), `PriceCents` (Go, C#), `priceCents` (TS, Dart).
  contract: /^[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/,
  invariant: /^INV-\d{3,4}$/,
  decision: /^ADR-\d{3,4}$/,
  screen: /^UI-\d{3,4}$/,
  /** A retired scenario or rule number, as listed in a feature's `retired`. */
  retired: /^[SR]\d+$/,
  ticket: /^(PROP|BUG|TASK)-\d+$/,
  question: /^Q\d+$/,
} as const;

export const RESERVED_PREFIXES: readonly string[] = ['INV', 'ADR', 'UI', 'PROP', 'BUG', 'TASK'];

export type IdKind =
  | 'ticket'
  | 'invariant'
  | 'decision'
  | 'screen'
  | 'scenario'
  | 'rule'
  | 'feature'
  | 'contract'
  | 'field'
  | 'question'
  | 'module';

const prefixOf = (id: string): string => id.slice(0, id.indexOf('-'));

export function isFeatureId(s: string): boolean {
  return PATTERNS.feature.test(s) && !RESERVED_PREFIXES.includes(prefixOf(s));
}

/** Classifies a string by ID shape alone. Reserved prefixes win over the feature pattern. */
export function classifyId(s: string): IdKind | null {
  if (PATTERNS.ticket.test(s)) return 'ticket';
  if (PATTERNS.invariant.test(s)) return 'invariant';
  if (PATTERNS.decision.test(s)) return 'decision';
  if (PATTERNS.screen.test(s)) return 'screen';
  if (PATTERNS.scenario.test(s) && !RESERVED_PREFIXES.includes(prefixOf(s))) return 'scenario';
  if (PATTERNS.rule.test(s) && !RESERVED_PREFIXES.includes(prefixOf(s))) return 'rule';
  if (isFeatureId(s)) return 'feature';
  if (PATTERNS.contract.test(s)) return s.split('.').length === 3 ? 'field' : 'contract';
  if (PATTERNS.question.test(s) || /^[^#\s]+#Q\d+$/.test(s)) return 'question';
  if (PATTERNS.module.test(s)) return 'module';
  return null;
}

// ---------- contract refs ----------

export interface ContractRef {
  readonly entity: string; // <module>.<Name>
  readonly field: string | null;
}

export function parseContractRef(ref: string): ContractRef {
  const parts = ref.split('.');
  return { entity: `${parts[0] ?? ''}.${parts[1] ?? ''}`, field: parts[2] ?? null };
}

export function contractModule(ref: string): string {
  return ref.slice(0, ref.indexOf('.'));
}

/**
 * A whole-entity reference matches every field of that entity; a field reference
 * matches that field and the whole entity. Symmetric.
 */
export function refsMatch(a: string, b: string): boolean {
  const x = parseContractRef(a);
  const y = parseContractRef(b);
  if (x.entity !== y.entity) return false;
  return x.field === null || y.field === null || x.field === y.field;
}

// ---------- ordering ----------

/** Plain code-unit comparison; never locale-dependent. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const CHUNK = /(\d+)|(\D+)/g;
// IDs repeat across a run (sorting 50k links compares the same few thousand IDs), so their
// chunks are computed once. Pure: the cache never changes a result.
const chunkCache = new Map<string, readonly string[]>();
function chunks(s: string): readonly string[] {
  let c = chunkCache.get(s);
  if (!c) {
    c = s.match(CHUNK) ?? [];
    if (chunkCache.size > 100_000) chunkCache.clear();
    chunkCache.set(s, c);
  }
  return c;
}

/** Natural ID order: PRV-2 sorts before PRV-10. Total and deterministic. */
export function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  const xs = chunks(a);
  const ys = chunks(b);
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? '';
    const y = ys[i] ?? '';
    const xd = /^\d/.test(x);
    const yd = /^\d/.test(y);
    if (xd && yd) {
      const xt = x.replace(/^0+(?=\d)/, '');
      const yt = y.replace(/^0+(?=\d)/, '');
      if (xt.length !== yt.length) return xt.length - yt.length;
      const c = compareStrings(xt, yt);
      if (c !== 0) return c;
    } else {
      const c = compareStrings(x, y);
      if (c !== 0) return c;
    }
  }
  if (xs.length !== ys.length) return xs.length - ys.length;
  return compareStrings(a, b);
}

export function sortIds<T extends string>(ids: Iterable<T>): T[] {
  return [...ids].sort(compareIds);
}

export function uniqueSorted<T extends string>(ids: Iterable<T>): T[] {
  return sortIds(new Set(ids));
}

// ---------- IDs inside prose ----------

const ID_IN_TEXT =
  /(?<![A-Za-z0-9_.\-/])(?:[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?|[A-Z]{2,4}-\d{3,4}\/[SR]\d+|(?:PROP|BUG|TASK)-\d+|[A-Z]{2,4}-\d{3,4})(?![A-Za-z0-9_\-/])/g;

/** IDs written in free text, in order of first appearance, deduplicated. */
export function idsInText(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(ID_IN_TEXT)) seen.add(m[0]);
  return [...seen];
}

// ---------- suggestions ----------

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(up + 1, (prev[j - 1] ?? 0) + 1, diag + cost);
      diag = up;
    }
  }
  return prev[b.length] ?? 0;
}

/**
 * The closest known ID by case-insensitive edit distance; ties broken by natural order.
 * Null when nothing is close enough to be a plausible typo.
 */
export function closestId(input: string, known: Iterable<string>): string | null {
  const target = input.toLowerCase();
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const id of sortIds(new Set(known))) {
    const score = levenshtein(target, id.toLowerCase());
    if (score < bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return bestScore <= Math.max(2, Math.floor(target.length / 3)) ? best : null;
}
