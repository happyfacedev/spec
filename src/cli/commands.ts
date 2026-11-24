import { resolve } from 'node:path';
import { delegationFindings, requiredDelegationFindings } from '../core/delegation-findings';
import { legacyConfigFindings } from '../core/legacy-config';
import { countErrors, finding, normalizeFindings, unreadableEntryFindings } from '../core/findings';
import { findUnits } from '../core/find';
import { type Graph, buildGraph, toJson } from '../core/graph';
import { classifyId, closestId } from '../core/ids';
import { GRAPH_PATH, INDEX_PATH, renderIndex } from '../core/index-md';
import { lintSpec } from '../core/lint';
import { renderShown, showUnit } from '../core/show';
import { IMPACT_TARGETS, computeImpact, renderImpact } from '../core/impact';
import { buildIndex, titleOf as unitTitle } from '../core/units';
import { relativeInside, writeIfChanged } from '../io/fs';
import type { Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { codePointerFindings } from '../core/adopt';
import { codeFiles } from './adopt';
import { missingGitHookIntegrations } from './git-hooks';
import { compareWithBase } from './lint-base';
import { afterMergeGeneratedGlobsWarning, legacyGeneratedGlobsWarning } from './config-warnings';
import { type Out, json, ok, renderFindings, usageError } from './output';

/** Writes _generated/graph.json and index.md, or refuses when the spec does not parse. */
export async function writeGenerated(ws: Workspace): Promise<{ ok: boolean; written: string[]; errors: string[]; graph: Graph | null }> {
  const errors = ws.spec.parseFindings.filter((f) => f.severity === 'error');
  if (errors.length > 0) return { ok: false, written: [], errors: errors.map((f) => `${f.file}:${f.line} ${f.rule} ${f.message}`), graph: null };
  const graph = buildGraph(ws.spec, buildIndex(ws.spec));
  const outputs: [string, string][] = [
    [GRAPH_PATH, toJson(graph)],
    [INDEX_PATH, renderIndex(ws.spec)],
  ];
  const written: string[] = [];
  for (const [path, text] of outputs) if (await writeIfChanged(resolve(ws.specRoot, path), text)) written.push(path);
  return { ok: true, written, errors: [], graph };
}

export async function cmdBuild(ws: Workspace, args: Args): Promise<Out> {
  const r = await writeGenerated(ws);
  if (!r.ok || !r.graph) {
    const errors = ws.spec.parseFindings.filter((f) => f.severity === 'error');
    if (args.format === 'json') return json({ spec: ws.spec.version, written: [], findings: errors }, 1);
    return { stdout: '', stderr: `build stopped: the spec does not parse\n${renderFindings(errors)}`, code: 1 };
  }
  const { graph, written } = r;
  if (args.format === 'json') return json({ spec: ws.spec.version, written, nodes: graph.nodes.length, edges: graph.edges.length, scenarios: graph.scenarios.length });
  const summary = `${ws.spec.version}: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.scenarios.length} scenarios`;
  return ok(`${summary}\n${written.length > 0 ? written.map((w) => `wrote ${w}`).join('\n') : 'up to date'}\n`);
}

/** Paths as findings name them: spec-root-relative, or project-root-relative for tickets. */
function findingPath(ws: Workspace, p: string, cwd: string): string | null {
  const abs = resolve(cwd, p);
  const ticket = relativeInside(abs, ws.ticketsDir);
  return ticket !== null ? `${ws.ticketsRel}/${ticket}` : relativeInside(abs, ws.specRoot);
}

export function cmdLint(ws: Workspace, args: Args, cwd: string): Out {
  const files = args.files.length > 0 ? args.files.map((f) => findingPath(ws, f, cwd)).filter((f): f is string => f !== null) : null;
  const core = lintSpec(ws.spec, { tickets: ws.tickets, ci: args.ci, files, budgets: ws.config?.budgets ?? {} });
  // L024 verifies authored Code: pointers against the checked-out source.
  const code = args.ci ? codeFiles(ws) : null;
  const local = files === null || files.includes('config.local.json') ? ws.configLocalFindings : [];
  const missingHooks = args.ci ? missingGitHookIntegrations(ws.projectRoot) : [];
  const hookHealth = missingHooks.length === 0 ? [] : [finding(
    'L033',
    'config.json',
    1,
    null,
    `Git enforcement hooks are not installed or integrated: ${missingHooks.join(', ')}`,
    'run .spec/bin/spec upgrade and add the reported lines to the configured hook files',
    'warning',
  )];
  const afterMergeWarning = afterMergeGeneratedGlobsWarning(ws.config);
  const afterMergeFindings = afterMergeWarning === null ? [] : [finding(
    'L034',
    'config.json',
    1,
    null,
    afterMergeWarning,
    'set generated.globs to the project-relative patterns written by afterMerge, or remove afterMerge',
    'warning',
  )];
  const legacyGlobsWarning = legacyGeneratedGlobsWarning(ws.config);
  const legacyGlobsFindings = legacyGlobsWarning === null ? [] : [finding(
    'L036',
    'config.json',
    1,
    null,
    legacyGlobsWarning,
    'move its globs into generated.globs and remove generatedGlobs',
    'warning',
  )];
  // L037 is not a per-file rule: --files never filters it (lint.Lint.files).
  const unreadableFindings = unreadableEntryFindings(ws.unreadable);
  const compared = args.base !== null || args.ci ? compareWithBase(ws, args.base) : { findings: [] };
  if ('refused' in compared) return { stdout: '', stderr: compared.refused, code: 2 };
  const findings = normalizeFindings([
    ...core,
    ...compared.findings,
    ...local,
    ...unreadableFindings,
    ...legacyConfigFindings(ws.config),
    ...delegationFindings(ws.delegation),
    ...requiredDelegationFindings(ws.delegation, ws.config?.formatVersion, args.ci),
    ...hookHealth,
    ...afterMergeFindings,
    ...legacyGlobsFindings,
    ...(args.ci && code ? codePointerFindings(ws.spec, code) : []),
  ]);
  const exit = countErrors(findings) > 0 ? 1 : 0;
  if (args.format === 'json') return json({ spec: ws.spec.version, findings }, exit);
  return ok(renderFindings(findings), exit);
}

function unknownArg(arg: string, known: Iterable<string>): Out {
  const near = closestId(arg, known);
  return usageError(`Unknown ${arg}.${near ? ` Did you mean ${near}?` : ''}`, USAGE);
}

export function cmdShow(ws: Workspace, args: Args): Out {
  const id = args.positionals[0];
  if (!id || args.positionals.length > 1) return usageError('usage: spec show <ID>', USAGE);
  const index = buildIndex(ws.spec);
  const known = [...index.byId.keys(), ...ws.spec.terms.map((t) => t.term), ...ws.tickets.tickets.map((t) => t.id)];
  // Only well-formed IDs or glossary terms reach the lookup.
  const wellFormed = classifyId(id) !== null || ws.spec.terms.some((t) => t.term.toLowerCase() === id.toLowerCase() || t.aliases.some((a) => a.toLowerCase() === id.toLowerCase()));
  const shown = wellFormed ? showUnit(ws.spec, index, id, ws.tickets) : null;
  if (!shown) return unknownArg(id, known);
  return args.format === 'json' ? json({ spec: ws.spec.version, ...shown }) : ok(renderShown(shown));
}

export function cmdImpact(ws: Workspace, args: Args): Out {
  const id = args.positionals[0];
  if (!id || args.positionals.length > 1) return usageError('usage: spec impact <ID|TICKET> [--depth n]', USAGE);
  const index = buildIndex(ws.spec);
  const kind = classifyId(id);
  const known = [...index.byId.keys(), ...ws.tickets.tickets.map((t) => t.id)];
  if (kind === null || !(IMPACT_TARGETS as readonly string[]).includes(kind)) {
    return kind === 'module'
      ? usageError(`impact takes a feature, scenario, rule, contract, field, invariant, decision, screen or ticket, not module ${id}`, USAGE)
      : unknownArg(id, known);
  }
  const ticket = kind === 'ticket' ? (ws.tickets.tickets.find((t) => t.id === id) ?? null) : null;
  if (kind === 'ticket' ? !ticket : !index.byId.has(id)) return unknownArg(id, known);
  const impact = computeImpact(ws.spec, index, id, ticket, { depth: args.depth ?? 1 });
  if (args.format === 'json') return json(impact);
  const titleOf = (x: string) => {
    const u = index.byId.get(x);
    return u ? unitTitle(u) : '';
  };
  return ok(renderImpact(impact, titleOf));
}

export function cmdFind(ws: Workspace, args: Args): Out {
  if (args.positionals.length === 0) return usageError('usage: spec find <words>', USAGE);
  const hits = findUnits(ws.spec, buildIndex(ws.spec), args.positionals);
  if (args.format === 'json') return json({ spec: ws.spec.version, query: args.positionals.join(' '), hits });
  if (hits.length === 0) return ok(`no matches for "${args.positionals.join(' ')}"\n`);
  return ok(`${hits.map((h) => `${h.id}  ${h.type}  ${h.title}`).join('\n')}\n`);
}
