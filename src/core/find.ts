// `spec find <words>`: search IDs, titles and glossary terms; ranked, deterministic.
import { compareIds } from './ids';
import type { Spec } from './model';
import { type UnitIndex, titleOf } from './units';

export interface FindHit {
  id: string;
  type: string;
  title: string;
  score: number;
}

export const FIND_LIMIT = 20;

// A whole word, plurals included: "rate-limit" matches "rate-limits".
const wordIn = (w: string, text: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:e?s)?(?![\\p{L}\\p{N}])`, 'iu').test(text);

export function findUnits(spec: Spec, index: UnitIndex, query: readonly string[]): FindHit[] {
  const words = query.map((w) => w.toLowerCase()).filter((w) => w !== '');
  if (words.length === 0) return [];
  const phrase = words.length >= 2 ? words.join(' ') : null;
  const candidates: { id: string; type: string; title: string; names: string[] }[] = [];
  for (const u of index.byId.values()) candidates.push({ id: u.id, type: u.type, title: titleOf(u), names: [] });
  for (const t of spec.terms) {
    const def = t.text.split('\n').slice(1).find((l) => l.trim() !== '' && !l.startsWith('Aliases:'))?.trim() ?? '';
    candidates.push({ id: t.term, type: 'term', title: def, names: [t.term, ...t.aliases] });
  }
  const hits: FindHit[] = [];
  for (const c of candidates) {
    let score = 0;
    const id = c.id.toLowerCase();
    for (const w of words) {
      if (id === w) score += 100;
      else if (id.includes(w)) score += 30;
      if (c.names.some((n) => n.toLowerCase() === w)) score += 50;
      if (wordIn(w, c.title)) score += 10;
      else if (c.title.toLowerCase().includes(w)) score += 4;
    }
    if (phrase !== null) {
      if (id === phrase) score += 100;
      if (c.names.some((n) => n.toLowerCase() === phrase)) score += 50;
    }
    if (score > 0) hits.push({ id: c.id, type: c.type, title: c.title, score });
  }
  hits.sort((a, b) => b.score - a.score || compareIds(a.id, b.id));
  return hits.slice(0, FIND_LIMIT);
}
