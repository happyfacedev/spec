// Assembles the Spec from the files under the spec root. Each authored path has one meaning.
import { withDerivedLinks } from '../derive';
import { type Finding, finding } from '../findings';
import { compareIds, compareStrings } from '../ids';
import { parseMarkdown } from '../markdown';
import type { Contract, Decision, Feature, Invariant, Module, Screen, Spec, Term } from '../model';
import { type SourceFile, isGeneratedPath, specVersion, textOf } from '../source';
import { parseContracts } from './contracts';
import { parseGlossary, parseInvariants } from './core-files';
import { parseFeature } from './feature';
import { parseDecision, parseModule, parseScreen } from './units';

type Place =
  | { kind: 'skill' | 'config' | 'overview' | 'glossary' | 'invariants' | 'conventions' | 'decision' | 'screen' | 'role' | 'asset' | 'ignored' }
  | { kind: 'module' | 'contracts' | 'feature'; module: string }
  | { kind: 'unknown' };

export function placeOf(path: string): Place {
  if (isGeneratedPath(path) || path.split('/').some((s) => s.startsWith('.'))) return { kind: 'ignored' };
  if (path === 'SKILL.md') return { kind: 'skill' };
  if (path === 'config.json') return { kind: 'config' };
  if (path === 'core/overview.md') return { kind: 'overview' };
  // One file each, or a folder of files for a large spec, as contracts.md and contracts/*.md.
  if (path === 'core/glossary.md' || /^core\/glossary\/[^/]+\.md$/.test(path)) return { kind: 'glossary' };
  if (path === 'core/invariants.md' || /^core\/invariants\/[^/]+\.md$/.test(path)) return { kind: 'invariants' };
  if (path === 'core/conventions.md') return { kind: 'conventions' };
  let m = /^modules\/([^/]+)\/_module\.md$/.exec(path);
  if (m?.[1]) return { kind: 'module', module: m[1] };
  m = /^modules\/([^/]+)\/(?:contracts\.md|contracts\/[^/]+\.md)$/.exec(path);
  if (m?.[1]) return { kind: 'contracts', module: m[1] };
  m = /^modules\/([^/]+)\/features\/[^/]+\.md$/.exec(path);
  if (m?.[1]) return { kind: 'feature', module: m[1] };
  if (/^decisions\/[^/]+\.md$/.test(path)) return { kind: 'decision' };
  if (/^ui\/[^/]+\.md$/.test(path)) return { kind: 'screen' };
  if (/^roles\/[^/]+\.md$/.test(path)) return { kind: 'role' };
  if (!path.endsWith('.md')) return { kind: 'asset' };
  return { kind: 'unknown' };
}

export function parseSpec(files: readonly SourceFile[]): Spec {
  const findings: Finding[] = [];
  const modules: Module[] = [];
  const features: Feature[] = [];
  const contracts: Contract[] = [];
  const invariants: Invariant[] = [];
  const decisions: Decision[] = [];
  const screens: Screen[] = [];
  const terms: Term[] = [];
  let conventionsText: string | null = null;
  let skillName: string | null = null;
  const moduleFolders = new Set<string>();

  const sorted = [...files].sort((a, b) => compareStrings(a.path, b.path));
  for (const f of sorted) {
    const place = placeOf(f.path);
    const mm = /^modules\/([^/]+)\//.exec(f.path);
    if (mm?.[1]) moduleFolders.add(mm[1]);
    switch (place.kind) {
      // overview.md is free text for readers: purpose and actors. The module map is derived (index.md).
      case 'overview':
      case 'ignored':
      case 'asset':
      case 'role':
        break;
      case 'config': {
        // The project name decides the skill name: `<name>-spec`.
        const m = /"name"\s*:\s*"([a-z][a-z0-9_-]*)"/.exec(textOf(f));
        if (m?.[1]) skillName = `${m[1]}-spec`;
        break;
      }
      case 'skill': {
        // Older installs keep SKILL.md inside the spec root; config.json's name wins over it.
        const fm = parseMarkdown(textOf(f)).frontmatter;
        skillName ??= fm ? (/^name:\s*(\S+)\s*$/m.exec(fm.raw)?.[1] ?? null) : null;
        break;
      }
      case 'conventions':
        conventionsText = textOf(f);
        break;
      case 'glossary': {
        const r = parseGlossary(f.path, textOf(f));
        terms.push(...r.terms);
        findings.push(...r.findings);
        break;
      }
      case 'invariants': {
        const r = parseInvariants(f.path, textOf(f));
        invariants.push(...r.invariants);
        findings.push(...r.findings);
        break;
      }
      case 'module': {
        const r = parseModule(f.path, textOf(f), place.module);
        modules.push(r.module);
        findings.push(...r.findings);
        break;
      }
      case 'contracts': {
        const r = parseContracts(f.path, textOf(f), place.module);
        contracts.push(...r.contracts);
        findings.push(...r.findings);
        break;
      }
      case 'feature': {
        const r = parseFeature(f.path, textOf(f), place.module);
        features.push(r.feature);
        findings.push(...r.findings);
        break;
      }
      case 'decision': {
        const r = parseDecision(f.path, textOf(f));
        decisions.push(r.decision);
        findings.push(...r.findings);
        break;
      }
      case 'screen': {
        const r = parseScreen(f.path, textOf(f));
        screens.push(r.screen);
        findings.push(...r.findings);
        break;
      }
      case 'unknown':
        findings.push(finding('L002', f.path, 1, null, `${f.path} is not in a known place in the spec`, 'move it to core/, modules/<m>/, ui/ or decisions/, or delete it'));
        break;
    }
  }
  for (const folder of moduleFolders) {
    if (!modules.some((m) => m.folder === folder)) {
      findings.push(finding('L001', `modules/${folder}/_module.md`, 1, folder, `module folder modules/${folder}/ has no _module.md`, `add modules/${folder}/_module.md with id, prefix, domain and status`));
    }
  }
  const byId = <T extends { id: string }>(xs: T[]) => xs.sort((a, b) => compareIds(a.id, b.id));
  // Links the steps state are derived once every contract's kind is known.
  const kinds = new Map(contracts.map((c) => [c.id, c.kind]));
  const kindOf = (id: string) => kinds.get(id.split('.').slice(0, 2).join('.')) ?? null;
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (f) features[i] = withDerivedLinks(f, kindOf);
  }
  return {
    version: specVersion(files),
    files: sorted,
    skillName,
    modules: byId(modules),
    features: byId(features),
    contracts: byId(contracts),
    invariants: byId(invariants),
    decisions: byId(decisions),
    screens: byId(screens),
    terms: [...terms].sort((a, b) => compareStrings(a.term.toLowerCase(), b.term.toLowerCase()) || compareStrings(a.term, b.term)),
    conventionsText,
    parseFindings: findings,
  };
}
