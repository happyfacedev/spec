import { LineCounter, Parser, isAlias, isScalar, parseDocument, visit } from 'yaml';
import { type Finding, finding } from '../findings';
import { parseFrontmatter } from '../frontmatter';
import { compareIds } from '../ids';
import { parseMarkdown } from '../markdown';
import type { Ticket, TicketSet } from '../model';
import { ConfigSchema, LocalConfigSchema, type Config, type Delegation, TicketFrontmatter, TicketQuestionSchema, unknownTicketKeys } from '../schemas';
import { type SourceFile, textOf } from '../source';
import { basename, ownedQuestions } from './common';

/** Ticket findings all carry L020: the ticket store has one schema rule. */
const asTicketRule = (f: Finding): Finding => ({ ...f, rule: 'L020' });

const ANCHOR_FIX = 'write the value out: ticket files may not use YAML anchors or aliases';

/** Anchors, aliases and keys that are not strings, in file order (TKT-001/R11, LNT-014/R5). */
function yamlFeatureFindings(file: string, fm: { raw: string; line: number }): Finding[] {
  const counter = new LineCounter();
  const ydoc = parseDocument(fm.raw, { lineCounter: counter, prettyErrors: false });
  if (ydoc.errors.length > 0) return [];
  const rawId = ydoc.get('id');
  const id = typeof rawId === 'string' ? rawId : null;
  const found: { offset: number; message: string; fix: string }[] = [];
  const add = (offset: number, message: string, fix: string): void => {
    found.push({ offset, message, fix });
  };
  visit(ydoc, {
    Pair(_k, pair) {
      const key = pair.key;
      if (isAlias(key)) return;
      if (isScalar(key) ? typeof key.value !== 'string' : true) {
        const written = isScalar(key) ? (key.source ?? String(key.value)) : '?';
        const range = (key as { range?: [number, number, number] | null } | null)?.range;
        add(range?.[0] ?? 0, `ticket has a key that is not a string: ${written}`, `quote the key: "${written}"`);
      }
    },
    Alias(_k, node) {
      add(node.range?.[0] ?? 0, `ticket uses the YAML alias *${node.source}`, ANCHOR_FIX);
    },
  });
  // An anchor's own position is its `&name` token in the source, not the value it marks.
  for (const token of anchorTokens(new Parser().parse(fm.raw))) add(token.offset, `ticket uses the YAML anchor ${token.source}`, ANCHOR_FIX);
  found.sort((a, b) => a.offset - b.offset);
  return found.map((f) => finding('L020', file, counter.linePos(f.offset).line + fm.line - 1, id, f.message, f.fix, 'error'));
}

/** Every `&name` token in a CST, wherever it sits. */
function anchorTokens(tokens: Iterable<unknown>): { offset: number; source: string }[] {
  const out: { offset: number; source: string }[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v !== null && typeof v === 'object') {
      const t = v as { type?: unknown; offset?: unknown; source?: unknown };
      if (t.type === 'anchor' && typeof t.offset === 'number' && typeof t.source === 'string') out.push({ offset: t.offset, source: t.source });
      for (const x of Object.values(v)) walk(x);
    }
  };
  for (const t of tokens) walk(t);
  return out;
}

export function parseTicket(file: string, text: string): { ticket: Ticket | null; findings: Finding[] } {
  const doc = parseMarkdown(text);
  if (doc.frontmatter) {
    const yamlFindings = yamlFeatureFindings(file, doc.frontmatter);
    if (yamlFindings.length > 0) return { ticket: null, findings: yamlFindings };
  }
  const fm = parseFrontmatter(file, doc, TicketFrontmatter, 'ticket');
  const findings = fm.findings.map(asTicketRule);
  const unknown = unknownTicketKeys(fm.raw === null ? null : parseDocument(doc.frontmatter?.raw ?? '').contents);
  if (unknown.length > 0) {
    const text = unknown.map((u) => u.text).join(', ');
    const id = typeof (fm.raw as { id?: unknown }).id === 'string' ? (fm.raw as { id: string }).id : null;
    findings.push(
      finding(
        'L020',
        file,
        fm.lineOf(unknown[0]?.path ?? []),
        id,
        `ticket has fields this spec does not know: ${text}`,
        'if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling',
        'warning',
      ),
    );
  }
  const d = fm.data;
  if (!d) return { ticket: null, findings };
  if (basename(file) !== `${d.id}.md`) {
    findings.push(finding('L020', file, fm.lineOf(['id']), d.id, `ticket file ${basename(file)} is not named ${d.id}.md`, `rename the file to ${d.id}.md`));
  }
  const bodyStart = doc.blocks[0]?.start ?? text.length;
  return {
    ticket: {
      id: d.id,
      data: d,
      questions: ownedQuestions(fm, file, d.id, d.questions, TicketQuestionSchema),
      body: text.slice(bodyStart),
      text,
      lineOf: fm.lineOf,
      file,
      line: 1,
    },
    findings,
  };
}

/** Every `.md` file in the store. `path` is relative to the project root. */
export function parseTickets(files: readonly SourceFile[]): TicketSet {
  const tickets: Ticket[] = [];
  const findings: Finding[] = [];
  for (const f of files) {
    if (!f.path.endsWith('.md')) continue;
    const r = parseTicket(f.path, textOf(f));
    findings.push(...r.findings);
    if (r.ticket) tickets.push(r.ticket);
  }
  const seen = new Map<string, Ticket>();
  for (const t of tickets) {
    const prev = seen.get(t.id);
    if (prev) findings.push(finding('L003', t.file, t.line, t.id, `ticket ${t.id} is also defined in ${prev.file}`, 'IDs are never reused; give this ticket a new ID'));
    else seen.set(t.id, t);
  }
  tickets.sort((a, b) => compareIds(a.id, b.id));
  return { tickets, findings };
}

export function parseConfig(file: string, text: string): { config: Config | null; findings: Finding[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { config: null, findings: [finding('L001', file, 1, null, `${file} is not valid JSON: ${msg}`, 'fix the JSON syntax')] };
  }
  const r = ConfigSchema.safeParse(raw);
  if (r.success) return { config: r.data, findings: [] };
  return {
    config: null,
    findings: r.error.issues.map((i) =>
      finding(
        'L001',
        file,
        1,
        null,
        `${file} ${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
        i.path[0] === 'generatedGlobs' || (i.path[0] === 'generated' && i.path[1] === 'globs' && i.path.length > 2) ? 'use a non-empty project-relative POSIX glob without "." or ".." path segments' : 'match the config schema in docs/FORMAT.md',
      ),
    ),
  };
}

/** config.local.json: one person's delegation, and the models marked unavailable on this machine (format.LocalConfig). */
export function parseLocalConfig(file: string, text: string): { delegation: Delegation; unavailableModels: string[]; findings: Finding[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { delegation: {}, unavailableModels: [], findings: [finding('L001', file, 1, null, `${file} is not valid JSON: ${msg}`, 'fix the JSON syntax')] };
  }
  const local = LocalConfigSchema.safeParse(raw);
  if (!local.success) {
    return {
      delegation: {},
      unavailableModels: [],
      findings: local.error.issues.map((i) =>
        finding('L001', file, 1, null, `${file} ${i.path.map(String).join('.') || '(root)'}: ${i.message}`, 'match the delegation config schema in the README'),
      ),
    };
  }
  const marks = Object.entries(local.data.unavailableModels ?? {});
  return { delegation: local.data.delegation ?? {}, unavailableModels: marks.filter(([, marked]) => marked).map(([model]) => model), findings: [] };
}
