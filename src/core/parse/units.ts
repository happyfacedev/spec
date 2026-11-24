// Modules, decisions (ADRs) and screens: frontmatter plus fixed sections.
import { type Finding, finding } from '../findings';
import { parseFrontmatter } from '../frontmatter';
import { parseMarkdown, sectionText, splitSections } from '../markdown';
import type { Decision, Module, Screen } from '../model';
import { DecisionFrontmatter, ModuleFrontmatter, ScreenFrontmatter } from '../schemas';
import { lineCount } from '../source';
import {
  basename,
  checkListOrNone,
  checkSections,
  draftOf,
  fileStartsWithId,
  ownedQuestions,
  rawStatus,
  rawString,
  rawStrings,
  refAt,
  refsAt,
} from './common';

export function parseModule(file: string, text: string, folder: string): { module: Module; findings: Finding[] } {
  const findings: Finding[] = [];
  const doc = parseMarkdown(text);
  const fm = parseFrontmatter(file, doc, ModuleFrontmatter, 'module');
  findings.push(...fm.findings);
  const d = fm.data;
  const id = d?.id ?? rawString(fm.raw, 'id') ?? folder;
  if (id !== folder) {
    findings.push(finding('L002', file, fm.lineOf(['id']), id, `module id ${id} does not match its folder modules/${folder}/`, `set id: ${folder}, or rename the folder`));
  }
  const top = splitSections(doc.blocks, 2);
  const lastLine = doc.blocks[doc.blocks.length - 1]?.endLine ?? 1;
  const para = top.preamble.filter((b) => b.type === 'paragraph');
  if (para.length === 0) {
    findings.push(finding('L006', file, top.sections[0]?.line ?? lastLine, id, 'the module has no responsibility paragraph', 'start the body with one paragraph on what this module owns'));
  }
  findings.push(
    ...checkSections(file, id, top.sections, [
      { title: 'Owns', required: true, noneAllowed: false },
      { title: 'Non-goals', required: true, noneAllowed: true },
    ], lastLine),
  );
  for (const s of top.sections) if (s.title === 'Owns' || s.title === 'Non-goals') findings.push(...checkListOrNone(file, id, s));
  const module: Module = {
    type: 'module',
    id,
    folder,
    prefix: d?.prefix ?? rawString(fm.raw, 'prefix') ?? '',
    domain: d?.domain ?? rawString(fm.raw, 'domain') ?? '',
    external: d?.external ?? false,
    status: d?.status ?? rawStatus(fm.raw),
    draft: draftOf(d, fm.raw),
    supersededBy: refAt(fm, 'superseded_by', d ? d.superseded_by : rawString(fm.raw, 'superseded_by')),
    questions: ownedQuestions(fm, file, id, d ? d.questions : null),
    responsibility: para.map((b) => b.raw).join('\n\n'),
    text,
    file,
    line: 1,
  };
  return { module, findings };
}

const fileIdOf = (file: string, re: RegExp) => re.exec(basename(file))?.[1] ?? basename(file).replace(/\.md$/, '');

export function parseDecision(file: string, text: string): { decision: Decision; findings: Finding[] } {
  const findings: Finding[] = [];
  const doc = parseMarkdown(text);
  const fm = parseFrontmatter(file, doc, DecisionFrontmatter, 'decision');
  findings.push(...fm.findings);
  const d = fm.data;
  const id = d?.id ?? rawString(fm.raw, 'id') ?? fileIdOf(file, /^(ADR-\d{3,4})/);
  if (!fileStartsWithId(file, id)) {
    findings.push(finding('L002', file, fm.lineOf(['id']), id, `file name ${basename(file)} does not start with ${id}`, `rename the file to ${id}-<slug>.md`));
  }
  const top = splitSections(doc.blocks, 2);
  const lastLine = doc.blocks[doc.blocks.length - 1]?.endLine ?? 1;
  for (const b of top.preamble) findings.push(finding('L006', file, b.line, id, 'content before "## Decision"', 'move it into a section'));
  findings.push(
    ...checkSections(file, id, top.sections, [
      { title: 'Decision', required: true, noneAllowed: false },
      { title: 'Consequences', required: true, noneAllowed: true },
      { title: 'Context', required: true, noneAllowed: true },
      { title: 'Alternatives', required: true, noneAllowed: true },
    ], lastLine),
  );
  const sec = (t: string) => {
    const s = top.sections.find((x) => x.title === t);
    return s ? sectionText(doc, s) : '';
  };
  const rawStat = rawString(fm.raw, 'status');
  const decision: Decision = {
    type: 'decision',
    id,
    title: d?.title ?? rawString(fm.raw, 'title') ?? '',
    // A superseded decision is history: it no longer decides anything.
    status: (d?.status ?? rawStat) === 'superseded' ? 'removed' : 'active',
    draft: draftOf(d, fm.raw),
    supersedes: refsAt(fm, 'supersedes', d ? d.supersedes : rawStrings(fm.raw, 'supersedes')),
    supersededBy: refAt(fm, 'superseded_by', d ? d.superseded_by : rawString(fm.raw, 'superseded_by')),
    questions: ownedQuestions(fm, file, id, d ? d.questions : null),
    decisionText: sec('Decision'),
    consequencesText: sec('Consequences'),
    text,
    lineCount: lineCount(text),
    file,
    line: 1,
  };
  return { decision, findings };
}

export function parseScreen(file: string, text: string): { screen: Screen; findings: Finding[] } {
  const findings: Finding[] = [];
  const doc = parseMarkdown(text);
  const fm = parseFrontmatter(file, doc, ScreenFrontmatter, 'screen');
  findings.push(...fm.findings);
  const d = fm.data;
  const id = d?.id ?? rawString(fm.raw, 'id') ?? fileIdOf(file, /^(UI-\d{3,4})/);
  if (!fileStartsWithId(file, id)) {
    findings.push(finding('L002', file, fm.lineOf(['id']), id, `file name ${basename(file)} does not start with ${id}`, `rename the file to ${id}-<slug>.md`));
  }
  const top = splitSections(doc.blocks, 2);
  const lastLine = doc.blocks[doc.blocks.length - 1]?.endLine ?? 1;
  for (const b of top.preamble) findings.push(finding('L006', file, b.line, id, 'content before "## Layout"', 'move it into a section'));
  findings.push(
    ...checkSections(file, id, top.sections, [
      { title: 'Layout', required: true, noneAllowed: false },
      { title: 'States', required: true, noneAllowed: true },
      { title: 'Copy', required: false, noneAllowed: true },
    ], lastLine),
  );
  const screen: Screen = {
    type: 'screen',
    id,
    title: d?.title ?? rawString(fm.raw, 'title') ?? '',
    status: d?.status ?? rawStatus(fm.raw),
    draft: draftOf(d, fm.raw),
    supersededBy: refAt(fm, 'superseded_by', d ? d.superseded_by : rawString(fm.raw, 'superseded_by')),
    image: d?.image ?? rawString(fm.raw, 'image'),
    shows: refsAt(fm, 'shows', d ? d.shows : rawStrings(fm.raw, 'shows')),
    calls: refsAt(fm, 'calls', d ? d.calls : rawStrings(fm.raw, 'calls')),
    questions: ownedQuestions(fm, file, id, d ? d.questions : null),
    text,
    file,
    line: 1,
  };
  return { screen, findings };
}
