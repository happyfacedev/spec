import { type Finding, finding } from '../findings';
import { parseFrontmatter } from '../frontmatter';
import { PATTERNS, classifyId, idsInText } from '../ids';
import { blockLines, isNone, listItems, parseMarkdown, sectionText, splitSections } from '../markdown';
import { type Feature, type FeatureRule, LINK_KINDS, type LinkKind, type Ref, type Scenario } from '../model';
import { FeatureFrontmatter } from '../schemas';
import { lineCount } from '../source';
import { basename, checkListOrNone, checkSections, draftOf, fileStartsWithId, ownedQuestions, rawStatus, rawString, rawStrings, refAt, refsAt } from './common';

const SECTIONS = [
  { title: 'Intent', required: true, noneAllowed: false },
  { title: 'Behaviour', required: true, noneAllowed: false },
  { title: 'Rules', required: true, noneAllowed: true },
  { title: 'Out of scope', required: true, noneAllowed: true },
] as const;

export const STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'] as const;

const LINK_TARGETS: Record<LinkKind, readonly string[]> = {
  reads: ['contract', 'field'],
  writes: ['contract', 'field'],
  emits: ['contract', 'field'],
  consumes: ['contract', 'field'],
  provides: ['contract', 'field'],
  calls: ['contract', 'field'],
  observes: ['contract', 'field'],
  invariants: ['invariant'],
  decisions: ['decision'],
  ui: ['screen'],
};

/**
 * Contract, screen, invariant and rule IDs in a step, in order of first appearance. A rule of the
 * step's own feature may be written short, in parentheses: `(R2)` or `(INV-001, R2)`. A quoted
 * string is data the step states, never a citation: `the export is "vendor.Cancelled"` (X123).
 */
export function stepCites(raw: string, feature: string | null = null): string[] {
  const text = raw.replace(/"[^"\n]*"/g, '""');
  const out = idsInText(text).filter((id) => {
    const k = classifyId(id);
    return k === 'contract' || k === 'field' || k === 'screen' || k === 'invariant' || k === 'rule';
  });
  if (feature) {
    for (const g of text.matchAll(/\(([^()]*)\)/g)) {
      for (const tok of (g[1] ?? '').split(',').map((t) => t.trim())) {
        const rid = /^R\d+$/.test(tok) ? `${feature}/${tok}` : null;
        if (rid && !out.includes(rid)) out.push(rid);
      }
    }
  }
  return out;
}

export function parseFeature(file: string, text: string, folderModule: string): { feature: Feature; findings: Finding[] } {
  const findings: Finding[] = [];
  const doc = parseMarkdown(text);
  const fm = parseFrontmatter(file, doc, FeatureFrontmatter, 'feature');
  findings.push(...fm.findings);
  const data = fm.data;
  const raw = fm.raw;
  const fileId = /^([A-Z]{2,4}-\d{3,4})/.exec(basename(file))?.[1] ?? basename(file).replace(/\.md$/, '');
  const id = data?.id ?? rawString(raw, 'id') ?? fileId;

  if (!fileStartsWithId(file, id)) {
    findings.push(finding('L002', file, fm.lineOf(['id']), id, `file name ${basename(file)} does not start with ${id}`, `rename the file to ${id}-<slug>.md`));
  }
  const module = data?.module ?? rawString(raw, 'module') ?? folderModule;
  if (module !== folderModule) {
    findings.push(finding('L002', file, fm.lineOf(['module']), id, `module is ${module} but the file is in modules/${folderModule}/`, `set module: ${folderModule}, or move the file`));
  }

  // With invalid frontmatter, keep only well-formed IDs so one typo does not cascade into L004/L008.
  const links = Object.fromEntries(
    LINK_KINDS.map((k) => [k, refsAt(fm, k, data ? data[k] : rawStrings(raw, k).filter((s) => LINK_TARGETS[k].includes(classifyId(s) ?? '')))]),
  ) as Record<LinkKind, Ref[]>;
  // The steps state what a feature reads, calls, consumes and emits (derive.ts, X134).
  for (const k of ['reads', 'emits', 'consumes', 'calls'] as const) {
    if (links[k].length > 0) findings.push(finding('L001', file, fm.lineOf([k]), id, `${k} is derived from the steps; the frontmatter lists only writes, provides and observes`, `remove ${k}: the steps that cite ${links[k].map((r) => r.id).join(', ')} link them`, 'warning'));
  }
  const retired = refsAt(fm, 'retired', data ? data.retired : rawStrings(raw, 'retired').filter((s) => PATTERNS.retired.test(s)));
  const retiredNos = new Set(retired.map((r) => r.id));
  const reused = (unit: string, no: string, line: number) => {
    if (retiredNos.has(no)) findings.push(finding('L003', file, line, unit, `${unit} is retired; its number is never used again`, `give it the next unused number, or remove ${no} from retired if it was never released`));
  };

  // ---- body ----
  const top = splitSections(doc.blocks, 2);
  const bodyStart = doc.blocks[0]?.start ?? text.length;
  const lastLine = doc.blocks[doc.blocks.length - 1]?.endLine ?? 1;
  for (const b of top.preamble) {
    findings.push(finding('L006', file, b.line, id, 'content before "## Intent"', 'move it into a section'));
  }
  // A removed feature is a tombstone: its scenarios are retired, so Behaviour may say None.
  const status = data?.status ?? rawStatus(raw);
  const sections = status === 'removed' ? SECTIONS.map((s) => (s.title === 'Behaviour' ? { ...s, noneAllowed: true } : s)) : SECTIONS;
  findings.push(...checkSections(file, id, top.sections, sections, lastLine));
  const byTitle = (t: string) => top.sections.find((s) => s.title === t);

  const intentS = byTitle('Intent');
  if (intentS && intentS.blocks.length > 0 && (intentS.blocks.length !== 1 || intentS.blocks[0]?.type !== 'paragraph')) {
    findings.push(finding('L006', file, intentS.line, id, '"## Intent" is one paragraph', 'merge it into one paragraph'));
  }

  const scenarios: Scenario[] = [];
  const behaviourS = byTitle('Behaviour');
  if (behaviourS && !(status === 'removed' && isNone(behaviourS.blocks))) {
    const inner = splitSections(behaviourS.blocks, 3);
    for (const b of inner.preamble) {
      findings.push(finding('L006', file, b.line, id, 'content before the first scenario', 'move it into a "### S<n>: <title>" scenario'));
    }
    if (inner.sections.length === 0 && behaviourS.blocks.length > 0) {
      findings.push(finding('L006', file, behaviourS.line, id, '"## Behaviour" has no scenarios', 'add "### S1: <title>" with Given / When / Then steps'));
    }
    const seenN = new Set<number>();
    for (const s of inner.sections) {
      const m = /^S(\d+):\s+(\S.*)$/.exec(s.title);
      if (!m) {
        findings.push(finding('L007', file, s.line, id, `scenario heading "${s.title}" is not "S<n>: <title>"`, 'write the heading as "### S<n>: <title>"'));
        continue;
      }
      const n = Number(m[1]);
      const sid = `${id}/S${n}`;
      if (seenN.has(n)) {
        findings.push(finding('L007', file, s.line, sid, `scenario number S${n} is used twice in ${id}`, 'give each scenario a new number; never reuse one'));
        continue;
      }
      seenN.add(n);
      reused(sid, `S${n}`, s.line);
      const steps: { keyword: string; text: string; attachment: string; file: string; line: number }[] = [];
      // A table (lines starting "|") or a fenced block right after a step belongs to that step:
      // the data it states, too long for one line.
      const attach = (raw: string, line: number) => {
        const last = steps[steps.length - 1];
        if (last) last.attachment = last.attachment ? `${last.attachment}\n${raw}` : raw;
        else findings.push(finding('L007', file, line, sid, `scenario ${sid} starts with a table or block, not a step`, 'put it under the step it belongs to'));
      };
      for (const b of s.blocks) {
        if (b.type === 'code') {
          attach(b.raw, b.line);
          continue;
        }
        if (b.type !== 'paragraph') {
          findings.push(finding('L007', file, b.line, sid, `scenario ${sid} holds a ${b.type}; scenarios are step lines, each with an optional table or fenced block`, 'rewrite it as Given / When / Then / And / But lines'));
          continue;
        }
        for (const l of blockLines(b)) {
          if (l.text.startsWith('|')) {
            attach(l.text, l.line);
            continue;
          }
          const kw = l.text.split(/\s+/)[0] ?? '';
          if (!(STEP_KEYWORDS as readonly string[]).includes(kw)) {
            findings.push(finding('L007', file, l.line, sid, `step "${l.text}" does not start with Given, When, Then, And or But`, 'start the step with Given, When, Then, And or But'));
          }
          steps.push({ keyword: kw, text: l.text, attachment: '', file, line: l.line });
        }
      }
      if (!steps.some((st) => st.keyword === 'When')) {
        findings.push(finding('L007', file, s.line, sid, `scenario ${sid} has no When step`, 'add a When step for the action'));
      }
      if (!steps.some((st) => st.keyword === 'Then')) {
        findings.push(finding('L007', file, s.line, sid, `scenario ${sid} has no Then step`, 'add a Then step for the outcome'));
      }
      const cites: Ref[] = [];
      const citedIds = new Set<string>();
      for (const st of steps) {
        for (const c of stepCites(`${st.text}\n${st.attachment}`, id)) {
          if (citedIds.has(c)) continue;
          citedIds.add(c);
          cites.push({ id: c, line: st.line });
        }
      }
      scenarios.push({ type: 'scenario', id: sid, n, title: (m[2] ?? '').trim(), feature: id, steps, cites, text: sectionText(doc, s), file, line: s.line });
    }
  }

  if (status === 'removed' && scenarios.length > 0) {
    const nos = scenarios.map((s) => `S${s.n}`);
    findings.push(
      finding('L006', file, behaviourS?.line ?? 1, id, `removed ${id} still holds ${nos.join(', ')}; retire ${nos.length === 1 ? 'it' : 'them'} (retired: [${nos.join(', ')}]) and write None under ## Behaviour`, 'a removed feature describes no behaviour; its tests go with it'),
    );
  }

  const rules: FeatureRule[] = [];
  const rulesS = byTitle('Rules');
  if (rulesS && !isNone(rulesS.blocks)) {
    const seenN = new Set<number>();
    for (const b of rulesS.blocks) {
      if (b.type !== 'list') {
        findings.push(finding('L006', file, b.line, id, '"## Rules" holds "- R<n>: …" lines, or None', 'turn this text into a "- R<n>: …" line'));
        continue;
      }
      for (const item of listItems(b)) {
        const m = /^R(\d+):\s+(\S.*)$/.exec(item.text);
        if (!m) {
          findings.push(finding('L006', file, item.line, id, `rule "${item.text}" is not "R<n>: <text>"`, 'write the rule as "- R<n>: <text>"'));
          continue;
        }
        const n = Number(m[1]);
        const rid = `${id}/R${n}`;
        if (seenN.has(n)) {
          findings.push(finding('L003', file, item.line, rid, `rule ${rid} is defined twice`, 'give the rule a new number; never reuse one'));
          continue;
        }
        seenN.add(n);
        reused(rid, `R${n}`, item.line);
        const ruleText = (m[2] ?? '').trim();
        const cites = idsInText(ruleText).map((c) => ({ id: c, line: item.line }));
        rules.push({ type: 'rule', id: rid, n, feature: id, text: ruleText, cites, file, line: item.line });
      }
    }
  }

  const oosS = byTitle('Out of scope');
  if (oosS) findings.push(...checkListOrNone(file, id, oosS));

  const feature: Feature = {
    type: 'feature',
    id,
    title: data?.title ?? rawString(raw, 'title') ?? '',
    module,
    folderModule,
    status,
    draft: draftOf(data, raw),
    supersededBy: refAt(fm, 'superseded_by', data ? data.superseded_by : rawString(raw, 'superseded_by')),
    links,
    retired,
    questions: ownedQuestions(fm, file, id, data ? data.questions : null),
    intent: intentS ? intentS.blocks.map((b) => b.raw).join('\n\n') : '',
    scenarios,
    rules,
    text,
    body: text.slice(bodyStart),
    behaviourText: behaviourS ? sectionText(doc, behaviourS) : '',
    rulesText: rulesS ? sectionText(doc, rulesS) : '',
    lineCount: lineCount(text),
    file,
    line: 1,
  };
  return { feature, findings };
}
