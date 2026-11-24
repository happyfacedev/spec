// Markdown reduced to what the spec needs: frontmatter, top-level blocks with raw text and lines,
// and heading-delimited sections. A block scanner for the CommonMark block structure (fences,
// ATX and setext headings, lists, quotes, HTML, indented code, paragraphs). It agrees with remark
// on every spec file and on the edge cases in tests/core/markdown.test.ts, at a fraction of the
// cost (DECISIONS X49): a `###` inside a fence is never a heading.

export interface Block {
  readonly type: string;
  readonly line: number;
  readonly endLine: number;
  readonly start: number;
  readonly end: number;
  readonly raw: string;
  /** Headings only. */
  readonly depth: number;
  /** Headings only: the heading text without markers. */
  readonly title: string;
}

export interface Frontmatter {
  readonly raw: string;
  /** File line of the first YAML line (the line after the opening ---). */
  readonly line: number;
}

export interface MdDoc {
  readonly text: string;
  readonly frontmatter: Frontmatter | null;
  readonly blocks: readonly Block[];
}

export interface Section {
  readonly heading: Block;
  readonly title: string;
  readonly line: number;
  readonly blocks: readonly Block[];
  /** Last line with content, or the heading line when empty. */
  readonly endLine: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+|$)/;
const THEMATIC = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const BULLET = /^ {0,3}[-*+](?:[ \t]+|$)/;
const ORDERED = /^ {0,3}(\d{1,9})[.)](?:[ \t]+|$)/;
const QUOTE = /^ {0,3}>/;
const HTML = /^ {0,3}<(?:!--|\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$))/;
const INDENTED = /^(?: {4}|\t)/;

const blank = (l: string) => l.trim() === '';
const indentOf = (l: string) => l.length - l.trimStart().length;
const isListItem = (l: string) => (BULLET.test(l) && !THEMATIC.test(l)) || ORDERED.test(l);
/** Lines that end a paragraph without a blank line before them. */
function interruptsParagraph(l: string): boolean {
  if (ATX.test(l) || FENCE.test(l) || THEMATIC.test(l) || QUOTE.test(l) || HTML.test(l)) return true;
  if (BULLET.test(l)) return !blank(l.replace(/^ {0,3}[-*+]/, ''));
  const o = ORDERED.exec(l);
  return o !== null && o[1] === '1' && !blank(l.replace(ORDERED, ''));
}
/** Lines that start a new top-level block, ending a list or quote's lazy continuation. */
const startsBlock = (l: string) => ATX.test(l) || FENCE.test(l) || THEMATIC.test(l) || QUOTE.test(l) || HTML.test(l);

function headingTitle(raw: string): string {
  const first = raw.split('\n')[0] ?? '';
  return first.replace(/^\s{0,3}#{1,6}(\s+|$)/, '').replace(/\s+#+\s*$/, '').replace(/^#+$/, '').trim();
}

function scanFrontmatter(lines: readonly string[]): { fm: Frontmatter | null; next: number } {
  if (lines[0] !== '---') return { fm: null, next: 0 };
  const close = lines.findIndex((l, i) => i > 0 && l === '---');
  if (close < 0) return { fm: null, next: 0 };
  return { fm: { raw: lines.slice(1, close).join('\n'), line: 2 }, next: close + 1 };
}

export function parseMarkdown(text: string): MdDoc {
  const lines = text.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const l of lines) {
    starts.push(offset);
    offset += l.length + 1;
  }
  const { fm, next } = scanFrontmatter(lines);
  const blocks: Block[] = [];
  const at = (i: number) => lines[i] ?? '';
  const push = (type: string, first: number, last: number, depth = 0) => {
    const firstLine = at(first);
    const start = (starts[first] ?? 0) + (type === 'code' && INDENTED.test(firstLine) ? 0 : Math.min(indentOf(firstLine), 3));
    // Like remark, a block ends at the end of its last line, trailing whitespace included.
    const end = (starts[last] ?? 0) + at(last).length;
    const raw = text.slice(start, end);
    blocks.push({ type, line: first + 1, endLine: last + 1, start, end, raw, depth, title: type === 'heading' ? headingTitle(raw) : '' });
  };

  let i = next;
  const n = lines.length;
  while (i < n) {
    const l = at(i);
    if (blank(l)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(l);
    if (fence && !(fence[1]?.startsWith('`') && fence[2]?.includes('`'))) {
      const mark = fence[1] ?? '```';
      const closeRe = new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}[ \\t]*$`);
      let j = i + 1;
      while (j < n && !closeRe.test(at(j))) j++;
      // An unclosed fence runs to the end of the document, trailing blank lines included.
      const last = j < n ? j : n - 1;
      push('code', i, last);
      i = last + 1;
      continue;
    }
    const atx = ATX.exec(l);
    if (atx) {
      push('heading', i, i, atx[1]?.length ?? 1);
      i++;
      continue;
    }
    if (THEMATIC.test(l)) {
      push('thematicBreak', i, i);
      i++;
      continue;
    }
    if (INDENTED.test(l)) {
      let last = i;
      let j = i + 1;
      while (j < n && (INDENTED.test(at(j)) || blank(at(j)))) {
        if (!blank(at(j))) last = j;
        j++;
      }
      push('code', i, last);
      i = last + 1;
      continue;
    }
    if (QUOTE.test(l)) {
      let j = i + 1;
      while (j < n && !blank(at(j)) && (QUOTE.test(at(j)) || !startsBlock(at(j)))) j++;
      push('blockquote', i, j - 1);
      i = j;
      continue;
    }
    if (HTML.test(l)) {
      const comment = /^ {0,3}<!--/.test(l);
      let j = i;
      if (comment) while (j < n && !at(j).includes('-->')) j++;
      else while (j + 1 < n && !blank(at(j + 1))) j++;
      const last = Math.min(j, n - 1);
      push('html', i, last);
      i = last + 1;
      continue;
    }
    if (isListItem(l)) {
      let last = i;
      let j = i + 1;
      while (j < n) {
        const m = at(j);
        if (blank(m)) {
          let k = j + 1;
          while (k < n && blank(at(k))) k++;
          if (k < n && (isListItem(at(k)) || indentOf(at(k)) >= 2)) {
            j = k;
            continue;
          }
          break;
        }
        if (isListItem(m) || indentOf(m) >= 2 || !startsBlock(m)) {
          last = j;
          j++;
          continue;
        }
        break;
      }
      push('list', i, last);
      i = last + 1;
      continue;
    }
    // Paragraph, or a setext heading when an underline follows.
    let j = i + 1;
    let setext = 0;
    while (j < n && !blank(at(j))) {
      const s = SETEXT.exec(at(j));
      if (s) {
        setext = s[1]?.startsWith('=') ? 1 : 2;
        break;
      }
      if (interruptsParagraph(at(j))) break;
      j++;
    }
    if (setext > 0) {
      push('heading', i, j, setext);
      i = j + 1;
    } else {
      push('paragraph', i, j - 1);
      i = j;
    }
  }
  return { text, frontmatter: fm, blocks };
}

/**
 * Splits blocks at headings of exactly `depth`. A heading shallower than `depth` ends the run.
 * Returns the blocks before the first such heading and the sections.
 */
export function splitSections(
  blocks: readonly Block[],
  depth: number,
): { preamble: Block[]; sections: Section[]; rest: Block[] } {
  const preamble: Block[] = [];
  const sections: Section[] = [];
  let current: { heading: Block; blocks: Block[] } | null = null;
  const close = () => {
    if (!current) return;
    const last = current.blocks[current.blocks.length - 1];
    sections.push({
      heading: current.heading,
      title: current.heading.title,
      line: current.heading.line,
      blocks: current.blocks,
      endLine: last ? last.endLine : current.heading.endLine,
    });
    current = null;
  };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;
    if (b.type === 'heading' && b.depth < depth) {
      close();
      return { preamble, sections, rest: blocks.slice(i) };
    }
    if (b.type === 'heading' && b.depth === depth) {
      close();
      current = { heading: b, blocks: [] };
    } else if (current) {
      current.blocks.push(b);
    } else {
      preamble.push(b);
    }
  }
  close();
  return { preamble, sections, rest: [] };
}

/** Raw source from the section heading to its last block. */
export function sectionText(doc: MdDoc, s: Section): string {
  const last = s.blocks[s.blocks.length - 1];
  return doc.text.slice(s.heading.start, last ? last.end : s.heading.end);
}

/** Raw source of the blocks only (no heading). */
export function blocksText(doc: MdDoc, blocks: readonly Block[]): string {
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  return first && last ? doc.text.slice(first.start, last.end) : '';
}

/** Lines of a block with their file line numbers. Blank lines are skipped. */
export function blockLines(b: Block): { text: string; line: number }[] {
  return b.raw
    .split('\n')
    .map((text, i) => ({ text: text.trim(), line: b.line + i }))
    .filter((l) => l.text !== '');
}

/** True for a section whose only content is the word None. */
export function isNone(blocks: readonly Block[]): boolean {
  return blocks.length === 1 && blocks[0]?.type === 'paragraph' && /^None\.?$/.test(blocks[0].raw.trim());
}

/** Items of a list block: raw text without the bullet, with their line. */
export function listItems(b: Block): { text: string; line: number }[] {
  const items: { text: string; line: number }[] = [];
  const lines = b.raw.split('\n');
  lines.forEach((l, i) => {
    const m = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (m) items.push({ text: (m[1] ?? '').trim(), line: b.line + i });
    else {
      const prev = items[items.length - 1];
      if (prev && l.trim() !== '') items[items.length - 1] = { text: `${prev.text} ${l.trim()}`, line: prev.line };
    }
  });
  return items;
}
