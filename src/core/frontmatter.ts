import { LineCounter, isMap, isSeq, parseDocument, type Node as YamlNode } from 'yaml';
import type { z } from 'zod';
import { type Finding, finding } from './findings';
import type { MdDoc } from './markdown';
import { ID_FORMAT } from './schemas';

/** What a well-formed ID of each kind looks like, for the fix of a malformed one. */
const ID_EXAMPLES: Readonly<Record<string, string>> = {
  feature: 'CRT-001 (the module prefix, a dash, three or four digits)',
  scenario: 'CRT-001/S1',
  contract: 'cart.Cart or cart.Cart.lines (<module>.<Name>, or .<member>)',
  invariant: 'INV-001',
  decision: 'ADR-001',
  screen: 'UI-001',
  module: 'cart (lowercase, the same as its folder under modules/)',
  prefix: 'CRT (two to four capital letters)',
  ticket: 'PROP-201, BUG-301 or TASK-101',
  question: 'Q1',
  unit: 'a feature, scenario, rule, contract, invariant, decision or screen ID',
};

export interface ParsedFrontmatter<T> {
  readonly data: T | null;
  /** The YAML as plain data, even when it does not match the schema. */
  readonly raw: unknown;
  readonly findings: Finding[];
  /** File line of a frontmatter path such as ['reads', 1]; falls back to the nearest parent. */
  readonly lineOf: (path: readonly PropertyKey[]) => number;
}

type Path = readonly PropertyKey[];

function getIn(value: unknown, path: Path): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

const show = (v: unknown): string => (typeof v === 'string' ? `"${v}"` : v === undefined ? 'nothing' : JSON.stringify(v));
const pathText = (p: Path): string => p.map((k, i) => (typeof k === 'number' ? `[${k}]` : i === 0 ? String(k) : `.${String(k)}`)).join('');

export function parseFrontmatter<S extends z.ZodType>(
  file: string,
  doc: MdDoc,
  schema: S,
  what: string,
): ParsedFrontmatter<z.infer<S>> {
  const findings: Finding[] = [];
  const fm = doc.frontmatter;
  if (!fm) {
    findings.push(finding('L001', file, 1, null, `${what} has no YAML frontmatter`, 'start the file with a --- frontmatter block'));
    return { data: null, raw: null, findings, lineOf: () => 1 };
  }
  const counter = new LineCounter();
  const ydoc = parseDocument(fm.raw, { lineCounter: counter, prettyErrors: false, uniqueKeys: true });
  const toLine = (offset: number): number => counter.linePos(offset).line + fm.line - 1;

  const lineOf = (path: Path): number => {
    let node: unknown = ydoc.contents;
    let line = fm.line - 1;
    for (const key of path) {
      if (isMap(node)) {
        const pair = node.items.find((p) => {
          const k: unknown = p.key;
          return k !== null && typeof k === 'object' && 'value' in k && k.value === key;
        });
        if (!pair) break;
        const k = pair.key as YamlNode | null;
        if (k?.range) line = toLine(k.range[0]);
        node = pair.value;
      } else if (isSeq(node) && typeof key === 'number') {
        const item = node.items[key] as YamlNode | undefined;
        if (!item) break;
        if (item.range) line = toLine(item.range[0]);
        node = item;
      } else break;
    }
    return line;
  };

  if (ydoc.errors.length > 0) {
    for (const e of ydoc.errors) {
      findings.push(finding('L001', file, toLine(e.pos[0]), null, `invalid YAML: ${e.message.split('\n')[0] ?? ''}`, 'fix the YAML syntax'));
    }
    return { data: null, raw: null, findings, lineOf };
  }

  const raw: unknown = ydoc.toJS();
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return { data: parsed.data, raw, findings, lineOf };

  const id = getIn(raw, ['id']);
  const unitId = typeof id === 'string' ? id : null;
  for (const issue of parsed.error.issues) {
    const path = issue.path;
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        findings.push(finding('L001', file, lineOf([...path, key]), unitId, `unknown field ${pathText([...path, key])} in ${what}`, `remove ${key} or fix its spelling`));
      }
      continue;
    }
    const value = getIn(raw, path);
    if (issue.message.startsWith(ID_FORMAT)) {
      const kind = issue.message.slice(ID_FORMAT.length);
      const example = ID_EXAMPLES[kind];
      findings.push(finding('L002', file, lineOf(path), unitId, `${pathText(path)}: ${show(value)} is not a valid ${kind} ID`, example ? `write it like ${example}` : `write a valid ${kind} ID`));
      continue;
    }
    if (value === undefined) {
      findings.push(finding('L001', file, lineOf(path), unitId, `${what} is missing required field ${pathText(path)}`, `add ${pathText(path)} to the frontmatter`));
      continue;
    }
    const fix = issue.code === 'invalid_value' ? `use one of: ${issue.values.map(String).join(', ')}` : `fix ${pathText(path)} to match the ${what} schema`;
    findings.push(finding('L001', file, lineOf(path), unitId, `${pathText(path)}: ${issue.message}`, fix));
  }
  return { data: null, raw, findings, lineOf };
}
