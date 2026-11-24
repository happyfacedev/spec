// core/invariants.md and core/glossary.md: no frontmatter, ### sections.
import { type Finding, finding } from '../findings';
import { PATTERNS } from '../ids';
import { parseMarkdown, sectionText, splitSections } from '../markdown';
import type { Invariant, Ref, Term } from '../model';
import { parseMetaLine, splitList } from './common';
import { optionalStatusLine } from './contracts';

function deepSections(text: string) {
  const doc = parseMarkdown(text);
  // Treat every ### as a unit; ## and # headings only separate groups.
  const blocks = doc.blocks.filter((b) => !(b.type === 'heading' && b.depth < 3));
  return { doc, sections: splitSections(blocks, 3).sections };
}

const linesOf = (raw: string, start: number) =>
  raw
    .split('\n')
    .map((t, i) => ({ text: t.trim(), line: start + i }))
    .filter((l) => l.text !== '');

export function parseInvariants(file: string, text: string): { invariants: Invariant[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const { doc, sections } = deepSections(text);
  const invariants: Invariant[] = [];
  for (const s of sections) {
    const m = /^([^:\s]+):\s+(\S.*)$/.exec(s.title);
    const id = m?.[1] ?? s.title;
    if (!m || !PATTERNS.invariant.test(id)) {
      findings.push(finding('L002', file, s.line, id, `invariant heading "${s.title}" is not "INV-<NNN>: <title>"`, 'write the heading as "### INV-<NNN>: <title>"'));
      continue;
    }
    const lines = s.blocks.flatMap((b) => linesOf(b.raw, b.line));
    const decisions: Ref[] = [];
    const applies: Ref[] = [];
    let shownBy: string | null = null;
    let status: Invariant['status'] = 'active';
    let supersededBy: Ref | null = null;
    let draft: readonly string[] | null = null;
    for (const l of lines) {
      // One spelling for a decision link everywhere: `Decisions:`, as on contracts.
      const old = /^Why:\s*(.*)$/.exec(l.text);
      if (old) findings.push(finding('L001', file, l.line, id, `"Why:" is format 1; write "Decisions: ${(old[1] ?? '').trim()}"`, 'rename the line to Decisions:'));
      const w = /^Decisions:\s*(.*)$/.exec(l.text);
      if (w) {
        for (const adr of splitList(w[1] ?? '')) {
          if (PATTERNS.decision.test(adr)) decisions.push({ id: adr, line: l.line });
          else findings.push(finding('L002', file, l.line, id, `"${adr}" in the Decisions line is not an ADR ID`, 'list ADR-<NNN> IDs, comma-separated'));
        }
      }
      // What it constrains: impact on these contracts reaches it. Each target is checked by L004.
      const a = /^Applies to:\s*(.*)$/.exec(l.text);
      if (a) for (const target of splitList(a[1] ?? '')) applies.push({ id: target, line: l.line });
      const sb = /^Shown by:\s*(\S.*)$/.exec(l.text);
      if (sb?.[1]) shownBy = sb[1].trim();
      const st = optionalStatusLine(file, id, l.text, l.line, findings);
      if (st) {
        status = st.status;
        supersededBy = st.supersededBy;
        draft = st.draft;
      }
    }
    invariants.push({
      type: 'invariant',
      id,
      title: (m[2] ?? '').trim(),
      status,
      draft,
      supersededBy,
      decisions,
      applies,
      shownBy,
      text: sectionText(doc, s),
      lineCount: s.endLine - s.line + 1,
      file,
      line: s.line,
    });
  }
  return { invariants, findings };
}

export function parseGlossary(file: string, text: string): { terms: Term[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const { doc, sections } = deepSections(text);
  const terms: Term[] = [];
  for (const s of sections) {
    const lines = s.blocks.flatMap((b) => linesOf(b.raw, b.line));
    const aliasLine = lines.find((l) => l.text.startsWith('Aliases:'));
    const meta = aliasLine ? parseMetaLine(aliasLine.text) : null;
    if (aliasLine && !meta) {
      findings.push(finding('L001', file, aliasLine.line, s.title, `"${aliasLine.text}" is not "Aliases: a, b"`, 'list aliases comma-separated after "Aliases:"'));
    }
    if (lines.filter((l) => l !== aliasLine).length === 0) {
      findings.push(finding('L001', file, s.line, s.title, `glossary term "${s.title}" has no definition`, 'add one to three lines that define it'));
    }
    terms.push({
      type: 'term',
      term: s.title,
      aliases: aliasLine ? splitList(aliasLine.text.replace(/^Aliases:\s*/, '')) : [],
      aliasLine: aliasLine?.line ?? s.line,
      text: sectionText(doc, s),
      lineCount: s.endLine - s.line + 1,
      file,
      line: s.line,
    });
  }
  return { terms, findings };
}
