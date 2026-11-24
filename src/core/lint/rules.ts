import { type Finding, finding } from '../findings';
import { INDEX_PATH, renderIndex } from '../index-md';
import { RESERVED_PREFIXES, classifyId, closestId, compareStrings, contractModule, idsInText, refsMatch } from '../ids';
import { CONTRACT_LINKS, type ContractLink, type Feature, LINK_TARGET_KINDS, type OwnedQuestion, type Spec, type TicketSet, type TypeExpr, type Unit } from '../model';
import { stepCites } from '../parse/feature';
import { parseConfig } from '../parse/tickets';
import { isContractRef } from '../scope';
import { FORMAT_VERSION, type Status, ticketTypeProblems } from '../schemas';
import { lineCount, textOf } from '../source';
import { PRIMITIVES, checkType } from '../types';
import { type UnitIndex, contractKindOf, isLive, sameKind, statusOf } from '../units';

export interface RuleContext {
  readonly spec: Spec;
  readonly index: UnitIndex;
  readonly tickets: TicketSet | null;
  readonly budgets: Readonly<Record<string, number>>;
}

const fileOf = (spec: Spec, path: string) => spec.files.find((f) => f.path === path);

// ---------- L001 config ----------
export function configRule({ spec }: RuleContext): Finding[] {
  const f = fileOf(spec, 'config.json');
  if (!f) return [finding('L001', 'config.json', 1, null, 'the spec has no config.json', 'add config.json; spec init writes a starter')];
  const { config, findings } = parseConfig('config.json', textOf(f));
  if (!config) return findings;
  const v = config.formatVersion;
  if (v === undefined) {
    return [finding('L001', 'config.json', 1, null, `config.json has no formatVersion; this spec CLI reads format ${FORMAT_VERSION}`, `migrate the spec to format ${FORMAT_VERSION} (docs/FORMAT.md, "From format 1"), then add "formatVersion": ${FORMAT_VERSION}`)];
  }
  if (v > FORMAT_VERSION) return [finding('L001', 'config.json', 1, null, `config.json is format ${v}, newer than this spec CLI (format ${FORMAT_VERSION})`, 'update the spec CLI')];
  if (v < FORMAT_VERSION) return [finding('L001', 'config.json', 1, null, `config.json is format ${v}; this spec CLI reads format ${FORMAT_VERSION}`, `migrate the spec (docs/FORMAT.md), then set "formatVersion": ${FORMAT_VERSION}`)];
  return [];
}

// ---------- L003 id-unique ----------
export function idUnique({ index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const first = new Map<string, Unit>();
  for (const u of index.definitions) {
    const prev = first.get(u.id);
    if (!prev) {
      first.set(u.id, u);
      continue;
    }
    out.push(finding('L003', u.file, u.line, u.id, `${u.id} is already defined in ${prev.file}:${prev.line}`, 'IDs are never reused; give this unit a new ID'));
  }
  return out;
}

// ---------- L004 ref-resolves ----------
const EXPECTED: Partial<Record<string, readonly string[]>> = {
  reads: ['contract', 'field'],
  writes: ['contract', 'field'],
  emits: ['contract', 'field'],
  consumes: ['contract', 'field'],
  provides: ['contract', 'field'],
  calls: ['contract', 'field'],
  observes: ['contract', 'field'],
  uses: ['contract', 'field'],
  applies: ['contract', 'field'],
  invariants: ['invariant'],
  decisions: ['decision'],
  ui: ['screen'],
  shows: ['contract', 'field'],
  supersedes: ['decision'],
};

/** What a screen may show: anything with a value to render. It calls operations like a feature. */
const SHOWS_KINDS: readonly string[] = ['entity', 'type', 'event', 'error'];

export function refResolves({ spec, index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const known = [...index.byId.keys()];
  const external = new Set(spec.modules.filter((m) => m.external).map((m) => m.id));
  for (const l of index.links) {
    const target = index.byId.get(l.to);
    if (!target) {
      const near = closestId(l.to, known.filter((k) => classifyId(k) === classifyId(l.to)));
      out.push(finding('L004', l.file, l.line, l.from, `${l.from} ${l.kind} ${l.to}, which does not exist`, near ? `did you mean ${near}? Otherwise define ${l.to} first` : `define ${l.to} first, or remove the reference`));
      continue;
    }
    const exp = EXPECTED[l.kind];
    if (exp && !exp.includes(target.type)) {
      out.push(finding('L004', l.file, l.line, l.from, `${l.from} ${l.kind} ${l.to}, which is a ${target.type}`, `${l.kind} points to ${exp.join(' or ')} IDs`));
      continue;
    }
    // A feature's or a screen's contract link says what it does with the contract, so it must suit the kind.
    const allowed = l.kind === 'shows' ? SHOWS_KINDS : (LINK_TARGET_KINDS as Partial<Record<string, readonly string[]>>)[l.kind];
    const kind = contractKindOf(target, index.byId);
    if (allowed && kind && !allowed.includes(kind)) {
      // Suggest only verbs a writer may write (X134); the steps state the rest. A screen has no writes,
      // provides or observes, so it gets shows or calls (X109, R4).
      const screen = index.byId.get(l.from)?.type === 'screen';
      const fits = (['writes', 'provides'] as const).filter((k) => LINK_TARGET_KINDS[k].includes(kind));
      const derived = kind === 'operation' ? 'called' : kind === 'event' || kind === 'error' ? 'consumed in a Given or When, emitted in a Then' : 'read';
      const fix = screen
        ? `list ${l.to} under ${kind === 'operation' ? 'calls' : 'shows'}`
        : fits.length > 0
          ? `list ${l.to} under ${fits.join(' or ')}, or under observes if the feature's code does not use it`
          : `remove it from ${l.kind}: a step that names it links it (${derived}); list it under observes if the feature's code does not use it`;
      out.push(finding('L004', l.file, l.line, l.from, `${l.from} ${l.kind} ${l.to}, which is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`, `${fix}; ${l.kind} takes ${allowed.join(' or ')} contracts`));
      continue;
    }
    // Another system provides an external module's operations and emits its events; this product
    // only uses them. An external error may be passed on, so a feature may emit one (X124).
    if ((l.kind === 'provides' || (l.kind === 'emits' && kind !== 'error')) && external.has(contractModule(l.to))) {
      out.push(finding('L004', l.file, l.line, l.from, `${l.from} ${l.kind} ${l.to}, which belongs to external module ${contractModule(l.to)}`, `${l.kind === 'provides' ? 'call it (calls)' : 'consume it (consumes)'}; the other system ${l.kind} it`));
    }
  }
  for (const s of spec.screens) {
    if (!s.image) continue;
    // Images sit beside the screen file, so the path is relative to ui/.
    const path = s.image.startsWith('ui/') ? s.image : `ui/${s.image}`;
    if (!fileOf(spec, path)) out.push(finding('L004', s.file, 1, s.id, `image ${s.image} does not exist`, `add the image at ${path}, or remove image:`));
  }
  return out;
}

// ---------- L005 ref-active ----------
export function refActive({ spec, index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  // A module's status covers what it holds (X130): a removed module holds only tombstones, and the
  // live units of a deprecated one are moving to its replacement.
  const moduleStatus = new Map(spec.modules.map((m) => [m.id, m.status]));
  const held: { id: string; status: Status; module: string; file: string; line: number }[] = [
    ...spec.features.map((f) => ({ id: f.id, status: f.status, module: f.module, file: f.file, line: 1 })),
    ...spec.contracts.map((c) => ({ id: c.id, status: c.status, module: c.homeModule, file: c.file, line: c.line })),
  ];
  for (const u of held) {
    const ms = moduleStatus.get(u.module);
    if (!isLive(u.status) || ms === undefined || ms === 'active') continue;
    out.push(finding('L005', u.file, u.line, u.id, `${u.status} ${u.id} is in ${ms} module ${u.module}`, ms === 'removed' ? `remove ${u.id} too (status: removed), or move it to a live module` : `move ${u.id} to the module that replaces ${u.module}`, ms === 'removed' ? 'error' : 'warning'));
  }
  for (const l of index.links) {
    // A removed unit is history: nothing live may link to it. A deprecated one is still served:
    // an active unit may keep linking to it while it moves off, so that is a warning.
    if (l.fromStatus === 'removed' || l.kind === 'superseded_by' || l.kind === 'supersedes') continue;
    const target = index.byId.get(l.to);
    if (!target) continue;
    const st = statusOf(target, index.byId);
    if (st === 'active' || (st === 'deprecated' && l.fromStatus !== 'active')) continue;
    const sup = 'supersededBy' in target && target.supersededBy ? target.supersededBy.id : null;
    const fix = sup ? `point to ${sup} instead` : `point to the unit that replaces ${l.to}`;
    out.push(finding('L005', l.file, l.line, l.from, `${l.fromStatus} ${l.from} ${l.kind} ${l.to}, which is ${st}`, fix, st === 'deprecated' ? 'warning' : 'error'));
  }
  return out;
}

// ---------- L008 steps-match-links ----------
// Where a verb's contract must be cited. What the code writes or emits is an outcome, checked in a
// Then; what it consumes arrives first, in a Given or a When; a provided operation is what the When
// invokes; a call happens in the When or the Then, never only in setup. `reads` and `observes` may
// sit anywhere. A contract the scenarios only set up or check is observed, not consumed or written.
const PLACE: Partial<Record<ContractLink, { keywords: readonly string[]; fix: string }>> = {
  writes: { keywords: ['Then'], fix: 'a write is an outcome: cite it in the Then that checks it, or list it under reads or observes if the feature does not write it' },
  emits: { keywords: ['Then'], fix: 'an emitted event or error is an outcome: cite it in the Then that checks it, or list it under consumes or observes if the feature does not emit it' },
  calls: { keywords: ['When', 'Then'], fix: 'a call is part of what happens: cite it in the When that makes it or the Then that checks it, or list it under observes if the scenario only sets it up' },
  provides: { keywords: ['When'], fix: 'a provided operation is what the When invokes: cite it there, or list it under calls or observes if the feature does not implement it' },
  consumes: { keywords: ['Given', 'When'], fix: 'a consumed event or error arrives before the outcome: cite it in the Given or When, or list it under observes if the scenario only checks it' },
};

/** The keywords of the steps that cite `ref`, with And and But read as the keyword before them. */
function stepKeywordsCiting(f: Feature, ref: string): string[] {
  const out: string[] = [];
  for (const s of f.scenarios) {
    let current = 'Given';
    for (const st of s.steps) {
      if (st.keyword !== 'And' && st.keyword !== 'But') current = st.keyword;
      // Every step, not the scenario's cites: those keep only an ID's first mention.
      if (stepCites(`${st.text}\n${st.attachment}`).some((id) => isContractRef(id) && refsMatch(id, ref))) out.push(current);
    }
  }
  return out;
}

export function stepsMatchLinks({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const f of spec.features) {
    const declared = CONTRACT_LINKS.flatMap((k) => f.links[k].map((r) => ({ ...r, kind: k })));
    const cited = f.scenarios.flatMap((s) => s.cites.map((c) => ({ ...c, scenario: s.id })));
    const citedContracts = cited.filter((c) => {
      const k = classifyId(c.id);
      return k === 'contract' || k === 'field';
    });
    const citedScreens = cited.filter((c) => classifyId(c.id) === 'screen');
    // A step may cite the invariant it checks; the frontmatter lists it. Listing one no step cites
    // is fine: it then shapes every scenario of the feature.
    for (const c of cited.filter((x) => classifyId(x.id) === 'invariant')) {
      if (!f.links.invariants.some((i) => i.id === c.id)) {
        out.push(finding('L008', f.file, c.line, c.scenario, `${c.scenario} cites ${c.id}, which is not in invariants`, `add ${c.id} to invariants, or remove it from the step`));
      }
    }
    for (const c of citedContracts) {
      if (!declared.some((d) => refsMatch(c.id, d.id))) {
        out.push(finding('L008', f.file, c.line, c.scenario, `${c.scenario} cites ${c.id}, which is not in the frontmatter`, `add ${c.id} to writes or provides if the feature's code changes or implements it, or to observes if the scenario only sets it up or checks it; or remove it from the step`));
      }
    }
    for (const d of declared) {
      if (!citedContracts.some((c) => refsMatch(c.id, d.id))) {
        out.push(finding('L008', f.file, d.line, f.id, `${d.id} is in ${d.kind} but no step cites it`, `write ${d.id} in the step that depends on it, or remove it from ${d.kind}`));
        continue;
      }
      // The verb is checked against where the steps cite it (X114).
      const place = PLACE[d.kind];
      if (place && !stepKeywordsCiting(f, d.id).some((k) => place.keywords.includes(k))) {
        out.push(finding('L008', f.file, d.line, f.id, `${f.id} ${d.kind} ${d.id}, but no ${place.keywords.join(' or ')} step cites it`, place.fix));
      }
    }
    for (const c of citedScreens) {
      if (!f.links.ui.some((u) => u.id === c.id)) {
        out.push(finding('L008', f.file, c.line, c.scenario, `${c.scenario} cites ${c.id}, which is not in ui`, `add ${c.id} to ui, or remove it from the step`));
      }
    }
    for (const u of f.links.ui) {
      if (!citedScreens.some((c) => c.id === u.id)) {
        out.push(finding('L008', f.file, u.line, f.id, `${u.id} is in ui but no step cites it`, `write ${u.id} in the step that shows it, or remove it from ui`));
      }
    }
  }
  return out;
}

// ---------- L009 granularity ----------
export const GRANULARITY_THRESHOLD = 8;
export function granularity({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const c of spec.contracts) {
    if (c.kind !== 'entity' || c.status !== 'active') continue;
    const users = spec.features.filter((f) => f.status === 'active' && CONTRACT_LINKS.some((k) => f.links[k].some((r) => r.id === c.id)));
    if (users.length >= GRANULARITY_THRESHOLD) {
      out.push(finding('L009', c.file, c.line, c.id, `${users.length} features reference ${c.id} as a whole`, 'reference the fields each feature uses, such as ' + `${c.id}.<field>`, 'warning'));
    }
  }
  return out;
}

// ---------- L010 question-kind ----------
const FORCES_BLOCKER = new Set(['contract', 'field', 'invariant', 'decision']);
export function questionKind(questions: readonly OwnedQuestion[]): Finding[] {
  const out: Finding[] = [];
  for (const q of questions) {
    const qid = `${q.owner}#${q.id}`;
    if (q.kind === 'preference' && q.default === null) {
      out.push(finding('L010', q.file, q.line, qid, `preference ${qid} has no default`, 'add the default work proceeds on, or make it a blocker'));
    }
    const forcing = q.cites.filter((c) => FORCES_BLOCKER.has(classifyId(c) ?? ''));
    if (q.kind === 'preference' && forcing.length > 0) {
      out.push(finding('L010', q.file, q.line, qid, `${qid} cites ${forcing.join(', ')}, so it is a blocker`, 'set kind: blocker'));
    }
  }
  return out;
}

// ---------- L011 size ----------
export const SIZE_LIMITS = { skill: 20, feature: 250, contracts: 600, invariant: 15, adr: 120, glossary: 4 } as const;
export function size({ spec, budgets }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const limit = (k: keyof typeof SIZE_LIMITS) => budgets[`size.${k}`] ?? SIZE_LIMITS[k];
  const check = (file: string, line: number, id: string | null, what: string, n: number, max: number) => {
    if (n > max) out.push(finding('L011', file, line, id, `${what} is ${n} lines, over its ${max}-line budget`, 'split it into smaller units'));
    else if (n >= Math.ceil(max * 0.8)) out.push(finding('L011', file, line, id, `${what} is ${n} lines, ${Math.round((n / max) * 100)}% of its ${max}-line budget`, 'consider splitting it before it grows further', 'warning'));
  };
  const skill = fileOf(spec, 'SKILL.md');
  if (skill) check('SKILL.md', 1, null, 'SKILL.md', lineCount(textOf(skill)), limit('skill'));
  for (const f of spec.features) check(f.file, 1, f.id, `feature ${f.id}`, f.lineCount, limit('feature'));
  for (const file of spec.files) {
    if (/^modules\/[^/]+\/(contracts\.md|contracts\/[^/]+\.md)$/.test(file.path)) check(file.path, 1, null, file.path, lineCount(textOf(file)), limit('contracts'));
  }
  for (const i of spec.invariants) check(i.file, i.line, i.id, `invariant ${i.id}`, i.lineCount, limit('invariant'));
  for (const d of spec.decisions) check(d.file, 1, d.id, `decision ${d.id}`, d.lineCount, limit('adr'));
  for (const t of spec.terms) check(t.file, t.line, t.term, `glossary entry "${t.term}"`, t.lineCount, limit('glossary'));
  return out;
}

// ---------- L012 orphan ----------
export function orphan({ spec, index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const targets = new Set(index.links.filter((l) => l.kind !== 'superseded_by').map((l) => l.to));
  const used = (id: string) => targets.has(id);
  for (const c of spec.contracts) {
    if (c.status === 'active' && !used(c.id) && !c.fields.some((f) => used(f.id))) {
      out.push(finding('L012', c.file, c.line, c.id, `nothing references ${c.id}`, 'reference it from the features that read or write it, or deprecate it', 'warning'));
    }
  }
  for (const u of [...spec.invariants, ...spec.decisions, ...spec.screens]) {
    if (u.status === 'active' && !used(u.id)) {
      out.push(finding('L012', u.file, u.line, u.id, `nothing references ${u.id}`, 'reference it from the units it shapes, or deprecate it', 'warning'));
    }
  }
  // An operation features call is a boundary someone must implement: in this spec, a feature
  // that provides it. An external module's operation is provided by the other system.
  const external = new Set(spec.modules.filter((m) => m.external).map((m) => m.id));
  for (const c of spec.contracts) {
    if (c.kind !== 'operation' || !isLive(c.status) || external.has(c.homeModule)) continue;
    const live = spec.features.filter((f) => isLive(f.status));
    // One feature implements an operation (X131): two providers are two owners of one boundary.
    const providers = live.filter((f) => f.links.provides.some((r) => r.id === c.id || r.id.startsWith(`${c.id}.`))).map((f) => f.id);
    if (providers.length > 1) {
      out.push(finding('L012', c.file, c.line, c.id, `${c.id} is provided by ${providers.join(' and ')}; one feature implements an operation`, 'keep provides on the feature that implements it, and calls on the others; two implementations are two operations', 'warning'));
    }
    if (live.some((f) => f.links.provides.some((r) => r.id === c.id || r.id.startsWith(`${c.id}.`)))) continue;
    for (const f of live) {
      const call = f.links.calls.find((r) => r.id === c.id || r.id.startsWith(`${c.id}.`));
      if (call) out.push(finding('L012', c.file, c.line, c.id, `${f.id} calls ${c.id}, which no feature provides`, `add ${c.id} to provides of the feature that implements it`, 'warning'));
    }
  }
  return out;
}

// L013 cycle is retired with `requires:` (X111): nothing but that check read the links.

// ---------- L023 rule-shown ----------
// Every rule is shown by a scenario that cites it, `(R2)`, so a rule is never only prose, and a
// change to it is checked against the scenarios that show it (check-report).
export function ruleShown({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const f of spec.features) {
    if (!isLive(f.status)) continue;
    for (const r of f.rules) {
      if (!f.scenarios.some((s) => s.cites.some((c) => c.id === r.id))) {
        out.push(finding('L023', f.file, r.line, r.id, `no scenario of ${f.id} shows ${r.id}`, `cite it, (R${r.n}), in a step of the scenario that shows it, or add one`, 'warning'));
      }
    }
  }
  return out;
}

// ---------- L025 invariant-shown ----------
// Like a rule, an invariant is checked by the scenarios that cite it, directly or through a rule
// they show; one no scenario shows is only prose, and a change to it turns no test red. One no
// scenario can show (a latency budget, a review rule) says how it is checked: `Shown by:` (X125).
export function invariantShown({ spec }: RuleContext): Finding[] {
  const shown = new Set<string>();
  for (const f of spec.features) {
    if (!isLive(f.status)) continue;
    const rules = new Map(f.rules.map((r) => [r.id, r.cites.map((c) => c.id)]));
    for (const s of f.scenarios) for (const c of s.cites) for (const id of [c.id, ...(rules.get(c.id) ?? [])]) shown.add(id);
  }
  return spec.invariants
    .filter((i) => i.status === 'active' && i.shownBy === null && !shown.has(i.id))
    .map((i) => finding('L025', i.file, i.line, i.id, `no scenario shows ${i.id}`, `cite it, (${i.id}), in a step that checks it, or in a rule a scenario shows; if no scenario can, say how it is checked: "Shown by: <benchmark, review, …>"`, 'warning'));
}

// ---------- L026 prose-refs ----------
// An ID written in prose is a pointer for the reader, not a link; it still must not dangle. Ticket
// IDs live outside the spec and are not checked.
export function proseRefs({ spec, index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const linked = new Set(index.links.map((l) => l.to));
  // `SHA-256` and `ISO-8601` have a feature ID's shape; only this spec's prefixes make one (X132).
  const prefixes = new Set(spec.modules.map((m) => m.prefix));
  const ours = (ref: string, k: string) => !['feature', 'scenario', 'rule'].includes(k) || prefixes.has(ref.split('-')[0] ?? '');
  const check = (id: string, file: string, line: number, raw: string) => {
    // A quoted string is a literal value ("vendor.Cancelled"), and a heading defines a unit; neither
    // is a pointer. Blanked, not cut, so line numbers hold.
    const text = raw.replace(/"[^"\n]*"/g, (m) => ' '.repeat(m.length)).replace(/^#.*$/gm, '');
    for (const ref of idsInText(text)) {
      const k = classifyId(ref);
      if (k === null || k === 'ticket' || !ours(ref, k) || linked.has(ref) || index.byId.has(ref)) continue;
      const at = text.slice(0, text.indexOf(ref)).split('\n').length - 1;
      out.push(finding('L026', file, line + at, id, `${id} mentions ${ref}, which does not exist`, 'correct the ID, or write the name without an ID', 'warning'));
    }
  };
  // Frontmatter holds links, which L004 checks; blank it but keep its lines.
  const body = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, (fm) => '\n'.repeat(fm.split('\n').length - 1));
  for (const u of [...spec.modules, ...spec.features, ...spec.decisions, ...spec.screens]) check(u.id, u.file, 1, body(u.text));
  for (const c of spec.contracts) check(c.id, c.file, c.line, c.text);
  for (const i of spec.invariants) check(i.id, i.file, i.line, i.text);
  return out;
}

// ---------- L014 module-prefix ----------
export function modulePrefix({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const byPrefix = new Map<string, string>();
  for (const m of spec.modules) {
    if (RESERVED_PREFIXES.includes(m.prefix)) {
      out.push(finding('L014', m.file, 1, m.id, `prefix ${m.prefix} is reserved`, `pick a prefix other than ${RESERVED_PREFIXES.join(', ')}`));
    }
    const prev = byPrefix.get(m.prefix);
    if (prev) out.push(finding('L014', m.file, 1, m.id, `prefix ${m.prefix} is already registered by ${prev}`, 'give each module its own prefix'));
    else byPrefix.set(m.prefix, m.id);
  }
  // A prefix only numbers new features: a feature keeps its ID when it moves to another module,
  // so its tests, tickets and history stay valid. The prefix must still belong to some module.
  for (const f of spec.features) {
    const prefix = f.id.split('-')[0] ?? '';
    if (spec.modules.length > 0 && !byPrefix.has(prefix)) {
      out.push(finding('L014', f.file, 1, f.id, `${f.id} has prefix ${prefix}, which no module registers`, `number it with its module's prefix, or register ${prefix} on a module`));
    }
    // An external module's behaviour belongs to the other system; here it is only a boundary.
    if (spec.modules.some((m) => m.id === f.module && m.external)) {
      out.push(finding('L001', f.file, 1, f.id, `${f.id} is in external module ${f.module}; an external module holds only the contracts this product uses`, 'move the feature to the module of this product that does the work'));
    }
  }
  return out;
}

// ---------- L016 deprecated ----------
// A tombstone may have no replacement: some behaviour is simply removed. When it names one, the
// replacement is a current unit of the same kind.
export function deprecated({ index }: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const u of index.byId.values()) {
    if (u.type === 'scenario' || u.type === 'rule') continue;
    const sup = u.supersededBy;
    if (!sup) continue;
    if (u.status === 'active') {
      out.push(finding('L016', u.file, sup.line, u.id, `active ${u.id} has superseded_by`, 'deprecate it, or remove superseded_by'));
      continue;
    }
    const target = index.byId.get(sup.id);
    if (!target) continue; // L004
    if (!sameKind(u.type, target.type)) {
      out.push(finding('L016', u.file, sup.line, u.id, `${u.id} is superseded by ${sup.id}, which is a ${target.type}`, `point superseded_by to another ${u.type}`));
      continue;
    }
    // A tombstone's pointer is history: when its replacement is replaced or removed in turn, the
    // old tombstone is never edited. A deprecated unit is still served, so its pointer tells
    // callers where to move now: its chain must reach a current unit. No chain may loop.
    const path = [u.id];
    let at: Unit | undefined = target;
    while (at && statusOf(at, index.byId) !== 'active' && 'supersededBy' in at && at.supersededBy && !path.includes(at.id)) {
      path.push(at.id);
      at = index.byId.get(at.supersededBy.id);
    }
    if (at && path.includes(at.id)) {
      out.push(finding('L016', u.file, sup.line, u.id, `${u.id} is superseded in a cycle: ${[...path, at.id].join(' → ')}`, 'point the last unit of the chain to the current, active unit'));
    } else if (u.status === 'deprecated' && at && statusOf(at, index.byId) !== 'active') {
      const end = statusOf(at, index.byId);
      out.push(
        finding('L016', u.file, sup.line, u.id, `deprecated ${u.id} is superseded by ${sup.id}${at.id === sup.id ? '' : `, whose chain ends at ${at.id}`}, which is ${end}; point it at the unit that replaces it now`, 'callers of a deprecated unit need a live replacement'),
      );
    }
  }
  return out;
}

// ---------- L017 generated-fresh ----------
// Only index.md is committed: it changes when a module or feature title does, so it reads well in
// a PR. _generated/graph.json is built on demand (`spec build`) and ignored by git.
export function generatedFresh({ spec }: RuleContext): Finding[] {
  const f = fileOf(spec, INDEX_PATH);
  if (!f) return [finding('L017', INDEX_PATH, 1, null, `${INDEX_PATH} is missing`, 'run spec build and commit the result')];
  if (textOf(f) !== renderIndex(spec)) return [finding('L017', INDEX_PATH, 1, null, `${INDEX_PATH} is stale`, 'run spec build and commit the result')];
  return [];
}

// ---------- L018 glossary ----------
export function glossary({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const seen = new Map<string, string>();
  // File order, so the later definition is the one flagged.
  const inFileOrder = [...spec.terms].sort((a, b) => compareStrings(a.file, b.file) || a.line - b.line);
  for (const t of inFileOrder) {
    const names: [string, number][] = [[t.term, t.line], ...t.aliases.map((a): [string, number] => [a, t.aliasLine])];
    for (const [name, line] of names) {
      const key = name.toLowerCase();
      const prev = seen.get(key);
      if (prev !== undefined) out.push(finding('L018', t.file, line, t.term, `"${name}" is already defined by "${prev}"`, 'define each term and alias once; merge the entries or drop the alias'));
      else seen.set(key, t.term);
    }
  }
  return out;
}

// ---------- L022 type-refs ----------
// Every `Type:` and `Output:` is written in the spec's one type language (types.ts), so a spec
// shared by several stacks has one notation, and every named type is a qualified reference impact
// can follow. Every member states its type.
export function typeRefs({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  const byName = new Map<string, string[]>();
  for (const c of spec.contracts) {
    const name = c.id.split('.')[1] ?? '';
    byName.set(name, [...(byName.get(name) ?? []), c.id]);
  }
  const check = (owner: string, file: string, types: readonly TypeExpr[], member = false) => {
    for (const t of types) {
      const p = checkType(t.expr, byName, member);
      if (p) out.push(finding('L022', file, t.line, owner, `"${t.expr}" is not a spec type: ${p.message}`, `write it in the spec's type language: ${PRIMITIVES.join(', ')}, "literals", <module>.<Name>, T[], map<K, V>, A | B, and on a member T? for "may be absent" (docs/FORMAT.md)`));
    }
  };
  // One type each: two lines would be two answers to "what is it", and a merge can leave both.
  const once = (owner: string, file: string, types: readonly TypeExpr[], what: string) => {
    if (types.length > 1) out.push(finding('L022', file, types[1]?.line ?? 1, owner, `${owner} has ${types.length} ${what} lines; a ${owner.split('.').length === 3 ? 'member' : 'contract'} has one type`, `keep the one that is true; write any union as one expression, A | B`));
  };
  for (const c of spec.contracts) {
    check(c.id, c.file, c.types);
    once(c.id, c.file, c.types, 'Type:/Output:');
    // Each kind has one shape (X129): a type is an expression or a record of members; an entity,
    // event or error is its members; an operation is its members (inputs) and an Output:.
    if (isLive(c.status)) {
      const at = c.types[0];
      if (c.kind === 'type' && at && c.fields.length > 0) {
        out.push(finding('L022', c.file, at.line, c.id, `type ${c.id} has both a Type: and members; it is one or the other`, 'keep the Type: for a value like an ID or a union, or the members for a record'));
      } else if ((c.kind === 'entity' || c.kind === 'event' || c.kind === 'error') && at) {
        out.push(finding('L022', c.file, at.line, c.id, `${c.kind} ${c.id} has a${at.key === 'Output' ? 'n Output:' : ' Type:'} line; an ${c.kind} is described by its members`, `give it #### members, or make it a Kind: type`));
      } else if (c.kind === 'operation' && at && c.types.some((t) => t.key === 'Type')) {
        out.push(finding('L022', c.file, at.line, c.id, `operation ${c.id} has a Type: line; an operation has members and an Output:`, 'write its result as "Output: <type>"'));
      }
    }
    if (isLive(c.status) && c.kind === 'type' && c.fields.length === 0 && c.types.length === 0) {
      out.push(finding('L022', c.file, c.line, c.id, `type ${c.id} has neither a Type: nor members`, 'add "Type: <type>", or #### members with their types'));
    }
    for (const f of c.fields) {
      check(f.id, f.file, f.types, true);
      once(f.id, f.file, f.types, 'Type:');
      if (isLive(f.status) && f.types.length === 0) out.push(finding('L022', f.file, f.line, f.id, `${f.id} has no Type:`, 'end its description with "Type: <type>"'));
    }
  }
  return out;
}

// ---------- L001 member draft markers ----------
/** A draft marks a contract or an invariant (ADP-001/R1); a member's `· Draft:` is refused, whatever its sources. */
export function memberDrafts({ spec }: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const c of spec.contracts) {
    for (const f of c.fields) {
      if (f.draftLine === null) continue;
      out.push(finding('L001', f.file, f.draftLine, f.id, `· Draft: marks a contract, not a member; mark the contract ${f.entity} instead`, `move · Draft: <sources> to the status line of ${f.entity}`));
    }
  }
  return out;
}

// ---------- L020 ticket-schema ----------
export function ticketSchema({ tickets }: RuleContext): Finding[] {
  if (!tickets) return [];
  const out: Finding[] = [...tickets.findings];
  for (const t of tickets.tickets) {
    // Type-required fields are the gate's refusals; lint reports them so CI does not fail on a
    // ticket that the gate exists to refuse. See DECISIONS.md.
    for (const p of ticketTypeProblems(t.data)) {
      const key = t.data.type === 'bug' ? 'violates' : 'touches';
      out.push(finding('L020', t.file, t.lineOf([key]), t.id, p.message, p.fix, 'warning'));
    }
  }
  out.push(...dependencyProblems(tickets));
  out.push(...absorbedProblems(tickets));
  return out;
}

/** absorbed_into is on an absorbed ticket and only there, and names another ticket that is not absorbed (TKT-001/R12). */
function absorbedProblems(tickets: TicketSet): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(tickets.tickets.map((t) => [t.id, t]));
  for (const t of tickets.tickets) {
    const into = t.data.absorbed_into;
    const at = (message: string, fix: string, key: string): void => {
      out.push(finding('L020', t.file, t.lineOf([key]), t.id, message, fix, 'error'));
    };
    if (t.data.status !== 'absorbed') {
      if (into !== undefined) at('only an absorbed ticket has absorbed_into', 'remove absorbed_into', 'absorbed_into');
      continue;
    }
    if (into === undefined) {
      at('an absorbed ticket names the ticket it went into', 'add absorbed_into', 'status');
      continue;
    }
    const target = byId.get(into);
    if (into === t.id) at('absorbed_into names the ticket itself', 'name the ticket it was combined into', 'absorbed_into');
    else if (!target) at(`absorbed_into ${into}, which is not a ticket`, 'name the ticket it was combined into', 'absorbed_into');
    else if (target.data.status === 'absorbed') {
      const onward = target.data.absorbed_into;
      at(`absorbed_into ${into}, which is itself absorbed${onward === undefined ? '' : ` into ${onward}`}`, onward === undefined ? 'name the ticket it was combined into' : `set absorbed_into to ${onward}`, 'absorbed_into');
    }
  }
  return out;
}

/** depends_on names existing tickets, never the ticket itself, and never loops back to it. */
function dependencyProblems(tickets: TicketSet): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(tickets.tickets.map((t) => [t.id, t]));
  for (const t of tickets.tickets) {
    const line = t.lineOf(['depends_on']);
    for (const dep of t.data.depends_on) {
      if (dep === t.id) out.push(finding('L020', t.file, line, t.id, `${t.id} depends on itself`, 'remove it from depends_on'));
      else if (!byId.has(dep)) out.push(finding('L020', t.file, line, t.id, `depends_on ${dep}, which is not a ticket`, 'correct the ID, or remove it from depends_on'));
    }
    // A cycle through t: walk its dependencies until t comes back.
    const seen = new Set<string>();
    const stack = [...t.data.depends_on.filter((d) => d !== t.id)];
    while (stack.length > 0) {
      const id = stack.pop() ?? '';
      if (id === t.id) {
        out.push(finding('L020', t.file, line, t.id, `${t.id} depends on itself through depends_on`, 'break the cycle: one of these tickets must come first'));
        break;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(byId.get(id)?.data.depends_on ?? []));
    }
  }
  return out;
}
