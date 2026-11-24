import type { Term } from './model';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD = /[\p{L}\p{N}_]+/gu;

/** Whole-word, case-insensitive matcher for a term and its aliases. */
export function termMatcher(t: Term): RegExp {
  const words = [t.term, ...t.aliases].map((w) => escape(w).replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
}

/** The lowercase words of a text: a cheap filter before any term regex runs. */
export function wordsOf(text: string): ReadonlySet<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}

/**
 * Matches terms against many texts. A term or alias can only match a text that contains all of
 * its words, so the regex runs only on likely hits (200 terms × 2,000 features: 340 ms → a few).
 */
export class TermFinder {
  private readonly entries: { term: Term; matcher: RegExp; phrases: string[][] }[];

  constructor(terms: readonly Term[]) {
    this.entries = terms.map((term) => ({
      term,
      matcher: termMatcher(term),
      phrases: [term.term, ...term.aliases].map((p) => p.toLowerCase().match(WORD) ?? []),
    }));
  }

  usedIn(text: string, words: ReadonlySet<string> = wordsOf(text)): Term[] {
    return this.entries
      .filter((e) => e.phrases.some((ws) => ws.length > 0 && ws.every((w) => words.has(w))) && e.matcher.test(text))
      .map((e) => e.term);
  }
}

export function termsUsedIn(text: string, terms: readonly Term[]): Term[] {
  return new TermFinder(terms).usedIn(text);
}
