// Rewrites a ticket's frontmatter fields in place. Ticket files are the only files the CLI edits,
// and diffs stay minimal: a scalar field changes on its own line, comments and spacing kept; lists
// and records go through the YAML document, which keeps untouched fields and comments.
import { type Document, isMap, isNode, isScalar, isSeq, parseDocument, stringify } from 'yaml';
import type { TicketFrontmatter } from './schemas';

/**
 * What the CLI may change in a ticket. `touches`, `violates`, `depends_on`, `absorbed_into` and `body`
 * belong to `spec ticket combine` alone (TKT-002/R1); `body` is everything after the frontmatter.
 */
export type TicketPatch = Partial<Pick<TicketFrontmatter, 'status' | 'stage' | 'changed' | 'questions' | 'history' | 'touches' | 'violates' | 'depends_on' | 'absorbed_into'>> & { body?: string };

const FENCE = /^---\n([\s\S]*?\n)?---(\n|$)/;

/** Everything after the frontmatter, or null when the text has none. */
export function bodyText(text: string): string | null {
  const m = FENCE.exec(text);
  return m ? text.slice(m[0].length) : null;
}

/** Writes `absorbed_into` on the line after `status`, where people put it; null when there is no status line. */
function insertAfterStatus(yamlText: string, value: string): string | null {
  const re = /^(status:[^\n]*)$/m;
  if (!re.test(yamlText)) return null;
  return yamlText.replace(re, (line) => `${line}\nabsorbed_into: ${stringify(value).trimEnd()}`);
}

/**
 * Replaces a top-level `key: value  # comment` line's value, or returns null if there is none. With
 * `keepQuotes`, a string written in single or double quote marks keeps them (TKT-012/R10).
 */
function setScalarLine(yamlText: string, key: string, value: string | null, keepQuotes: boolean): string | null {
  const re = new RegExp(`^(${key}:[ \\t]*)([^\\s#][^#\\n]*?)?([ \\t]*(?:#.*)?)$`, 'm');
  if (!re.test(yamlText)) return null;
  const rendered = stringify(value).trimEnd();
  return yamlText.replace(re, (_m, head: string, old: string | undefined, tail: string) => {
    const quote = old?.[0] === '"' || old?.[0] === "'" ? old[0] : '';
    if (!keepQuotes || quote === '' || typeof value !== 'string' || !/^[^"'\\\n]*$/.test(value)) return `${head}${rendered}${tail}`;
    return `${head}${quote}${value}${quote}${tail}`;
  });
}

const isPlainRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A list of records over the same list in the file: each record that is already there is updated
 * key by key in its own node, so a key this spec does not know, its place and its comments stay
 * (TKT-001/R10); new records are appended. Returns false when the file's value is not such a list.
 */
function mergeRecords(doc: Document, key: string, value: unknown): 'flow' | 'block' | false {
  const seq = doc.get(key, true);
  if (!isSeq(seq) || !Array.isArray(value) || value.length === 0 || !value.every(isPlainRecord)) return false;
  // A list of records already written in flow style stays so, new records included (TKT-002/R3);
  // an empty `[]` is not one, its first records are a block.
  const keepFlow = seq.flow === true && seq.items.length > 0 && seq.items.every(isMap);
  merge(doc, seq, value);
  if (!keepFlow) blockify(seq);
  return keepFlow ? 'flow' : 'block';
}

const isStringList = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === 'string');
const newNode = (doc: Document, v: unknown): unknown => oneLineIdLists(doc.createNode(v, { flow: isStringList(v) }));

/** A list of IDs inside a record the CLI adds, such as a question's cites, is written on one line (TKT-002/R2). */
function oneLineIdLists<T>(node: T): T {
  if (isMap(node)) for (const p of node.items) oneLineIdLists(p.value);
  else if (isSeq(node)) {
    if (node.items.every((i) => isScalar(i) && typeof i.value === 'string')) node.flow = true;
    else for (const i of node.items) oneLineIdLists(i);
  }
  return node;
}

/** A value the file does not hold is not added when it says nothing: null or an empty list (TKT-002/R4). */
const isBlank = (v: unknown): boolean => v === null || (Array.isArray(v) && v.length === 0);

/** Updates `node` to hold `value`, in place and recursively, so what `value` lacks keeps its place; returns the node to keep. */
function merge(doc: Document, node: unknown, value: unknown): unknown {
  if (isMap(node) && isPlainRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      const sub = node.get(k, true);
      if (sub === undefined) {
        if (!isBlank(v)) node.set(k, newNode(doc, v));
      } else {
        const next = merge(doc, sub, v);
        if (next !== sub) node.set(k, next);
      }
    }
    return node;
  }
  if (isSeq(node) && Array.isArray(value)) {
    value.forEach((v, i) => {
      const sub: unknown = node.items[i];
      if (sub === undefined) node.items.push(newNode(doc, v));
      else node.items[i] = merge(doc, sub, v);
    });
    node.items.length = value.length;
    return node;
  }
  if (isNode(node) && !isMap(node) && !isSeq(node) && JSON.stringify(node.toJSON()) === JSON.stringify(value)) return node;
  // A value that changes keeps the comments of the one it replaces (TKT-002/R4).
  const next = newNode(doc, value);
  if (isNode(node) && isNode(next)) {
    if (node.comment !== undefined && next.comment === undefined) next.comment = node.comment;
    if (node.commentBefore !== undefined && next.commentBefore === undefined) next.commentBefore = node.commentBefore;
  }
  return next;
}

/** Lists of records are blocks, as people write them, unless already flow; lists of plain values stay on one line. */
function blockify(node: unknown): void {
  if (isMap(node)) {
    node.flow = false;
    for (const p of node.items) blockify(p.value);
  } else if (isSeq(node) && !node.items.every((i) => !isMap(i) && !isSeq(i))) {
    node.flow = false;
    for (const i of node.items) blockify(i);
  }
}

/**
 * A list of IDs is written on one line (TKT-002/R2), even one that was a block: the comments on its
 * items move to the end of the line, after the list's own, so none is lost (R4).
 */
function oneLine(node: unknown): unknown {
  if (!isSeq(node)) return node;
  const notes: string[] = [];
  const take = (c: string | null | undefined): void => {
    if (typeof c === 'string' && c.trim() !== '') notes.push(c.trim());
  };
  take(node.comment);
  for (const item of node.items) {
    if (!isNode(item)) continue;
    take(item.commentBefore);
    take(item.comment);
    item.commentBefore = undefined;
    item.comment = undefined;
  }
  node.flow = true;
  node.comment = notes.length > 0 ? ` ${notes.join(' # ')}` : undefined;
  return node;
}

/** `keepQuotes`: a scalar already written in quote marks keeps them, as `spec ticket close` does (TKT-012/R10). */
export function patchTicketText(text: string, patch: TicketPatch, { keepQuotes = false }: { keepQuotes?: boolean } = {}): string | null {
  const m = FENCE.exec(text);
  if (!m) return null;
  let yamlText = m[1] ?? '';
  if (parseDocument(yamlText).errors.length > 0) return null;
  const structured: [string, unknown][] = [];
  const entries: [string, unknown][] = Object.entries(patch);
  for (const [key, value] of entries) {
    if (value === undefined || key === 'body') continue;
    const scalar = value === null || typeof value === 'string';
    let edited = scalar ? setScalarLine(yamlText, key, value, keepQuotes) : null;
    if (edited === null && key === 'absorbed_into' && typeof value === 'string') edited = insertAfterStatus(yamlText, value);
    if (edited !== null) yamlText = edited;
    else structured.push([key, value]);
  }
  if (structured.length > 0) {
    const doc = parseDocument(yamlText);
    for (const [key, value] of structured) {
      // Lists of IDs stay on one line, as people write them; lists of records are blocks.
      const flow = Array.isArray(value) && value.every((v) => typeof v === 'string');
      if (mergeRecords(doc, key, value)) continue;
      // A list of IDs that is already a list in the file is updated in place, so its comment stays.
      const current = doc.get(key, true);
      if (flow && isSeq(current)) doc.set(key, oneLine(merge(doc, current, value)));
      else doc.set(key, doc.createNode(value, { flow }));
    }
    const flowKeys = ['questions', 'history'].filter((k) => {
      const seq = doc.get(k, true);
      return isSeq(seq) && seq.flow === true && seq.items.length > 0 && seq.items.every(isMap);
    });
    // The library puts a blank line before a comment that ends the frontmatter; it stays where it was (TKT-002/R4).
    const trailing = doc.comment;
    doc.comment = null;
    yamlText = doc.toString({ lineWidth: 0, flowCollectionPadding: false });
    if (typeof trailing === 'string') yamlText += `${trailing.split('\n').map((l) => `#${l}`).join('\n')}\n`;
    // A flow list with comments inside is printed with its `[` on a line of its own, whether the
    // patch changed it or not; TKT-002/R3 wants it on the key's line.
    for (const key of flowKeys) yamlText = yamlText.replace(new RegExp(`^((?:${key}|"${key}"|'${key}'):)[ \\t]*\\n[ \\t]+\\[`, 'm'), '$1 [');
  }
  return `---\n${yamlText}---\n${patch.body ?? text.slice(m[0].length)}`;
}
