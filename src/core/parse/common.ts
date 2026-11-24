import type { z } from 'zod';
import { type Finding, finding } from '../findings';
import type { ParsedFrontmatter } from '../frontmatter';
import { type Block, type Section, isNone } from '../markdown';
import type { OwnedQuestion, Ref } from '../model';
import { type Question, QuestionSchema, type Status } from '../schemas';

export const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** `PRV-001-slug.md` and `PRV-001.md` start with PRV-001; `PRV-0011.md` does not. */
export function fileStartsWithId(path: string, id: string): boolean {
  const name = basename(path);
  return name === `${id}.md` || name.startsWith(`${id}-`);
}

export function rawField(raw: unknown, key: string): unknown {
  return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
}

export function rawString(raw: unknown, key: string): string | null {
  const v = rawField(raw, key);
  return typeof v === 'string' ? v : null;
}

export function rawStrings(raw: unknown, key: string): string[] {
  const v = rawField(raw, key);
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** A draft's sources (maybe none), or null for a confirmed unit. */
export function draftOf(d: { draft: boolean; sources: string[] } | null | undefined, raw: unknown): readonly string[] | null {
  if (d) return d.draft ? d.sources : null;
  return rawField(raw, 'draft') === true ? rawStrings(raw, 'sources') : null;
}

export function rawStatus(raw: unknown): Status {
  const s = rawString(raw, 'status');
  return s === 'deprecated' || s === 'removed' ? s : 'active';
}

/** Refs for a frontmatter list with the line each item was written on. */
export function refsAt<T>(fm: ParsedFrontmatter<T>, key: string, ids: readonly string[]): Ref[] {
  return ids.map((id, i) => ({ id, line: fm.lineOf([key, i]) }));
}

export function refAt<T>(fm: ParsedFrontmatter<T>, key: string, id: string | null): Ref | null {
  return id === null ? null : { id, line: fm.lineOf([key]) };
}

/** Questions from frontmatter; with invalid frontmatter, keeps the ones that parse alone. */
export function ownedQuestions<T>(
  fm: ParsedFrontmatter<T>,
  file: string,
  owner: string,
  parsed: readonly Question[] | null,
  schema: z.ZodType<Question> = QuestionSchema,
): OwnedQuestion[] {
  const list: readonly (Question | null)[] =
    parsed ??
    (() => {
      const v = rawField(fm.raw, 'questions');
      return Array.isArray(v) ? v.map((q) => {
        const r = schema.safeParse(q);
        return r.success ? r.data : null;
      }) : [];
    })();
  const out: OwnedQuestion[] = [];
  list.forEach((q, i) => {
    if (q) out.push({ ...q, owner, file, line: fm.lineOf(['questions', i]) });
  });
  return out;
}

export interface ExpectedSection {
  readonly title: string;
  readonly required: boolean;
  /** May the section say None. */
  readonly noneAllowed: boolean;
}

/** L006: required sections exist, in order, and nothing else; an empty section says None. */
export function checkSections(
  file: string,
  id: string | null,
  sections: readonly Section[],
  expected: readonly ExpectedSection[],
  fallbackLine: number,
): Finding[] {
  const out: Finding[] = [];
  const names = expected.map((e) => e.title);
  const order = expected.map((e) => `## ${e.title}`).join(', ');
  const seen = new Map<string, Section>();
  for (const s of sections) {
    if (!names.includes(s.title)) {
      out.push(finding('L006', file, s.line, id, `unexpected section "## ${s.title}"`, `use only these sections, in order: ${order}`));
      continue;
    }
    if (seen.has(s.title)) {
      out.push(finding('L006', file, s.line, id, `section "## ${s.title}" appears twice`, 'merge the two sections'));
      continue;
    }
    seen.set(s.title, s);
  }
  for (const e of expected) {
    if (e.required && !seen.has(e.title)) {
      out.push(finding('L006', file, fallbackLine, id, `missing section "## ${e.title}"`, `add "## ${e.title}"${e.noneAllowed ? ', or write None under it' : ''}`));
    }
  }
  const present = sections.filter((s) => names.includes(s.title)).map((s) => names.indexOf(s.title));
  if (present.some((v, i) => i > 0 && v < (present[i - 1] ?? -1))) {
    const first = sections[0];
    out.push(finding('L006', file, first ? first.line : fallbackLine, id, 'sections are out of order', `order them: ${order}`));
  }
  for (const e of expected) {
    const s = seen.get(e.title);
    if (s && s.blocks.length === 0) {
      out.push(finding('L006', file, s.line, id, `section "## ${e.title}" is empty`, e.noneAllowed ? 'write None under it' : 'fill it in'));
    }
    if (s && !e.noneAllowed && isNone(s.blocks)) {
      out.push(finding('L006', file, s.line, id, `section "## ${e.title}" cannot be None`, 'fill it in'));
    }
  }
  return out;
}

/** A list-or-None section: bullets, or the single word None. */
export function checkListOrNone(file: string, id: string | null, s: Section): Finding[] {
  if (s.blocks.length === 0 || isNone(s.blocks)) return [];
  return s.blocks
    .filter((b: Block) => b.type !== 'list')
    .map((b) => finding('L006', file, b.line, id, `"## ${s.title}" holds bullets or None`, 'turn this text into a bullet, or write None'));
}

export const META_SEP = ' · ';

/** `Key: value · Key: value` → ordered pairs, or null when the line does not have that shape. */
export function parseMetaLine(line: string): [string, string][] | null {
  const parts = line.split(META_SEP);
  const out: [string, string][] = [];
  for (const p of parts) {
    const m = /^([A-Z][A-Za-z ]*):\s*(\S.*)$/.exec(p.trim());
    if (!m) return null;
    out.push([m[1] ?? '', (m[2] ?? '').trim()]);
  }
  return out;
}

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}
