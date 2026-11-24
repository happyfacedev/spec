// Building a spec with a person (/spec-init, ROADMAP 1): what is still a draft, what is missing,
// and confirming a drafted unit. `spec gaps` drives the interview: each gap is a question to ask.
import { type Finding, finding } from './findings';
import { compareIds } from './ids';
import type { Spec, Unit } from './model';
import { type TestCase, claimedScenario, coversScenario } from './test-report';
import { CONTRACT_LINKS } from './model';
import type { UnitIndex } from './units';

export interface Gaps {
  /** Drafted units a person has not confirmed, with where each came from. */
  drafts: { id: string; title: string; sources: readonly string[]; file: string }[];
  /** Open questions on spec units: blockers first. */
  questions: { id: string; kind: string; text: string }[];
  modulesWithoutFeatures: string[];
  /** Contracts no feature reads, writes, emits or consumes. */
  unusedContracts: string[];
  /** Null when tests were not run. */
  scenariosWithoutTests: string[] | null;
  /** Tests named after a scenario the spec does not have. Null when tests were not run. */
  testsWithoutScenario: string[] | null;
  /** Contracts whose `Code:` names a symbol no code file contains. Null when code was not read. */
  codeNotFound: { id: string; code: string }[] | null;
}

/** A code file, as the caller read it (core reads no files). */
export interface CodeFile {
  readonly path: string;
  readonly text: string;
}

/**
 * `Code: Cart.add(…)` is found when one code file holds both its owner (`Cart`) and its name
 * (`add`) as words. A rename or a deletion in the code shows up here; a word in a comment can
 * still satisfy it, so the check catches drift, not proof that the name means the same thing.
 */
export function codeNotFound(spec: Spec, code: readonly CodeFile[]): { id: string; code: string }[] {
  const out: { id: string; code: string }[] = [];
  const word = (w: string) => new RegExp(`(?<![\\w$])${w.replace(/\$/g, '\\$')}(?![\\w$])`);
  for (const c of spec.contracts) {
    if (c.status === 'removed' || !c.code) continue;
    const parts = c.code.symbol.split('.').filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
    if (parts.length === 0) continue;
    const needed = parts.slice(-2).map(word);
    if (!code.some((f) => needed.every((w) => w.test(f.text)))) out.push({ id: c.id, code: c.code.symbol });
  }
  return out;
}

/** L024 for `spec lint --ci`: each `Code:` line whose symbol the code no longer holds. */
export function codePointerFindings(spec: Spec, code: readonly CodeFile[]): Finding[] {
  return codeNotFound(spec, code).map((m) => {
    const c = spec.contracts.find((x) => x.id === m.id);
    return finding('L024', c?.file ?? '', c?.code?.line ?? c?.line ?? 1, m.id, `Code: ${m.code} is not in the code`, 'update the Code: line to where the code implements it now, or restore the code', 'warning');
  });
}

const titleOf = (u: Unit): string => {
  if ('title' in u) return u.title;
  if (u.type === 'contract') return u.summary;
  return u.type === 'module' ? (u.responsibility.split('\n')[0] ?? '') : '';
};

export function findGaps(spec: Spec, index: UnitIndex, tests: readonly TestCase[] | null, code: readonly CodeFile[] | null = null): Gaps {
  const drafts: Gaps['drafts'] = [];
  for (const u of [...spec.modules, ...spec.features, ...spec.contracts, ...spec.invariants, ...spec.decisions, ...spec.screens]) {
    if (u.draft !== null) drafts.push({ id: u.id, title: titleOf(u), sources: u.draft, file: u.file });
  }
  const questions = index.questions
    .filter((q) => q.answer === null)
    .map((q) => ({ id: `${q.owner}#${q.id}`, kind: q.kind, text: q.text }))
    .sort((a, b) => {
      const rank = (kind: string) => kind === 'blocker' ? 0 : kind === 'external' ? 1 : 2;
      return rank(a.kind) - rank(b.kind) || compareIds(a.id, b.id);
    });
  const modulesWithoutFeatures = spec.modules.filter((m) => m.status === 'active' && !m.external && !spec.features.some((f) => f.module === m.id)).map((m) => m.id);
  // A contract is used when a feature links it, or when a contract or member is typed by it (a
  // type used only inside other contracts is still part of their shape): the same rule as L012.
  const typedBy = new Set(index.links.filter((l) => l.kind === 'uses').map((l) => l.to.split('.').slice(0, 2).join('.')));
  const used = (id: string) => typedBy.has(id) || spec.features.some((f) => CONTRACT_LINKS.some((k) => f.links[k].some((r) => r.id === id || r.id.startsWith(`${id}.`))));
  const unusedContracts = spec.contracts.filter((c) => c.status === 'active' && !used(c.id)).map((c) => c.id);
  const scenarios = spec.features.filter((f) => f.status !== 'removed').flatMap((f) => f.scenarios.map((s) => s.id));
  const scenariosWithoutTests = tests === null ? null : scenarios.filter((s) => !tests.some((t) => coversScenario(t.name, s)));
  const prefixes = new Set(spec.modules.map((m) => m.prefix));
  const testsWithoutScenario =
    tests === null
      ? null
      : tests.filter((t) => {
          const s = claimedScenario(t.name, prefixes);
          return s !== null && !index.byId.has(s);
        }).map((t) => t.name);
  return {
    drafts: drafts.sort((a, b) => compareIds(a.id, b.id)),
    questions,
    modulesWithoutFeatures,
    unusedContracts,
    scenariosWithoutTests,
    testsWithoutScenario,
    codeNotFound: code === null ? null : codeNotFound(spec, code),
  };
}

/**
 * The text report. `testsReason` is why the test command gave no results (the same reason `spec
 * test` prints), or null when the tests were skipped or ran.
 */
export function renderGaps(g: Gaps, version: string, testsReason: string | null = null): string {
  const out = [`# Gaps · ${version}`, ''];
  const section = (title: string, lines: string[]) => {
    out.push(`## ${title} (${String(lines.length)})`, ...(lines.length === 0 ? ['None'] : lines), '');
  };
  section(
    'Drafts to confirm',
    g.drafts.map((d) => {
      const head = d.title === '' ? d.id : `${d.id} ${d.title}`;
      return `- ${head}${d.sources.length > 0 ? ` (from ${d.sources.join(', ')})` : ''}`;
    }),
  );
  section('Open questions', g.questions.map((q) => `- ${q.id} ${q.kind}: ${q.text}`));
  section('Modules without features', g.modulesWithoutFeatures.map((m) => `- ${m}`));
  section('Contracts no feature uses', g.unusedContracts.map((c) => `- ${c}`));
  if (g.scenariosWithoutTests === null) {
    out.push('## Scenarios without a test', 'Not checked (no test run).', ...(testsReason === null ? [] : [`spec gaps: ${testsReason}`]), '');
  } else section('Scenarios without a test', g.scenariosWithoutTests.map((s) => `- ${s}`));
  if (g.testsWithoutScenario !== null && g.testsWithoutScenario.length > 0) section('Tests for no scenario', g.testsWithoutScenario.map((t) => `- ${t}`));
  if (g.codeNotFound !== null && g.codeNotFound.length > 0) section('Code pointers not found', g.codeNotFound.map((c) => `- ${c.id} Code: ${c.code} (update the Code: line, or the code)`));
  const total =
    g.drafts.length +
    g.questions.length +
    g.modulesWithoutFeatures.length +
    g.unusedContracts.length +
    (g.scenariosWithoutTests?.length ?? 0) +
    (g.testsWithoutScenario?.length ?? 0) +
    (g.codeNotFound?.length ?? 0);
  // With no test run, nothing was checked: the closing line must not claim that every scenario was tested.
  const tested = g.scenariosWithoutTests === null ? 'the tests were not checked' : 'every scenario tested';
  out.push(total === 0 ? `No gaps: every unit is confirmed, every question answered, ${tested}.` : `${String(total)} gap${total === 1 ? '' : 's'}.`);
  return `${out.join('\n')}\n`;
}

/**
 * The file text with one unit confirmed: `draft` and `sources` leave its frontmatter, or the
 * `· Draft: …` part leaves its status line. Null when the unit is not a draft in this text.
 */
export function confirmInText(text: string, unit: Unit): string | null {
  if (unit.type === 'contract' || unit.type === 'invariant') {
    const start = text.indexOf(unit.text);
    if (start < 0) return null;
    const section = unit.text.replace(/ · Draft:[^\n]*/, '');
    return section === unit.text ? null : `${text.slice(0, start)}${section}${text.slice(start + unit.text.length)}`;
  }
  const fm = /^---\n([\s\S]*?\n)---\n/.exec(text);
  if (!fm) return null;
  const lines = (fm[1] ?? '').split('\n');
  const kept: string[] = [];
  let inSources = false;
  let changed = false;
  for (const l of lines) {
    if (/^draft:/.test(l)) {
      changed = true;
      continue;
    }
    if (/^sources:/.test(l)) {
      changed = true;
      inSources = !/\[.*\]\s*$/.test(l);
      continue;
    }
    if (inSources && /^\s+-\s/.test(l)) continue;
    inSources = false;
    kept.push(l);
  }
  return changed ? `---\n${kept.join('\n')}---\n${text.slice(fm[0].length)}` : null;
}
