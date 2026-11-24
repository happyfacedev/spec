// Loads everything one command needs: the spec files, the config and the ticket store.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Spec, TicketSet } from '../core/model';
import { parseSpec } from '../core/parse/spec';
import { mergeDelegation } from '../core/delegation';
import { parseConfig, parseLocalConfig } from '../core/parse/tickets';
import type { Config, Delegation } from '../core/schemas';
import { loadDir, toPosix, type UnreadableEntry } from './fs';
import { resolveProjectRoot } from './root';
import { NO_TICKET_GIT, type TicketGitState, ticketGitState } from './ticket-git';
import { CommandTicketStore, FileTicketStore, TRACKER_DIR, type TicketStore } from './ticket-store';

export interface Workspace {
  readonly specRoot: string;
  readonly projectRoot: string;
  /** The tickets dir (files store), or the virtual dir findings use for a tracker. */
  readonly ticketsDir: string;
  /** The tickets dir relative to the project root, as ticket paths in findings use it. */
  readonly ticketsRel: string;
  /** True when ticket files are in this repository and are committed with each stage. */
  readonly ticketsInRepo: boolean;
  readonly config: Config | null;
  readonly delegation: Delegation;
  /** The Claude Code models config.local.json marks unavailable (FMT-015/R9). */
  readonly unavailableModels: readonly string[];
  readonly configLocalFindings: readonly import('../core/findings').Finding[];
  readonly spec: Spec;
  /** Entries under the spec root the loader skipped because they cannot be read (L037). */
  readonly unreadable: readonly UnreadableEntry[];
  readonly store: TicketStore;
  readonly tickets: TicketSet;
  /** Where each ticket's branch and worktree stand. */
  readonly ticketGit: TicketGitState;
}

/** Whether this project still uses the old skill-local CLI, even before tests copy its ignored launcher. */
export function projectUsesLegacyCli(ws: Workspace): boolean {
  const skillName = ws.spec.skillName;
  if (skillName === null || existsSync(resolve(ws.projectRoot, '.spec/bin/spec.cjs'))) return false;
  const skillDir = resolve(ws.projectRoot, '.claude/skills', skillName);
  if (existsSync(resolve(skillDir, 'scripts/spec'))) return true;
  const pointer = resolve(skillDir, 'skill.json');
  if (!existsSync(pointer)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(pointer, 'utf8'));
    return typeof parsed === 'object' && parsed !== null && 'specRoot' in parsed
      && typeof parsed.specRoot === 'string' && resolve(ws.projectRoot, parsed.specRoot) === resolve(ws.specRoot);
  } catch {
    return false;
  }
}

/** The same workspace read again from disk, with the same ticket store. */
export const reloadWorkspace = (ws: Workspace): Promise<Workspace> => loadWorkspace(ws.specRoot, ws.store instanceof FileTicketStore ? ws.ticketsDir : null, ws.projectRoot);

export async function loadWorkspace(specRoot: string, ticketsFlag: string | null, cwd: string): Promise<Workspace> {
  const cfgPath = resolve(specRoot, 'config.json');
  const config = existsSync(cfgPath) ? parseConfig('config.json', readFileSync(cfgPath, 'utf8')).config : null;
  const localPath = resolve(specRoot, 'config.local.json');
  const local = existsSync(localPath) ? parseLocalConfig('config.local.json', readFileSync(localPath, 'utf8')) : { delegation: {}, unavailableModels: [], findings: [] };
  const delegation = mergeDelegation(config?.delegation ?? {}, local.delegation);
  const mergedConfig = config === null ? null : { ...config, ...(Object.keys(delegation).length > 0 ? { delegation } : {}) };
  const projectRoot = resolveProjectRoot(specRoot, config?.projectRoot);
  const base = config?.baseBranch ?? 'main';
  const t = config?.tickets ?? { adapter: 'files' as const, dir: 'tickets' };
  const store: TicketStore =
    t.adapter === 'command' && !ticketsFlag
      ? new CommandTicketStore(t.command, projectRoot)
      : new FileTicketStore(ticketsFlag ? resolve(cwd, ticketsFlag) : resolve(projectRoot, t.adapter === 'files' ? t.dir : 'tickets'), projectRoot, base);
  const ticketsRel = store.dirRel ?? TRACKER_DIR;
  const outside = store.dirRel !== null && store.dirRel.startsWith('..');
  const ticketGit = outside ? NO_TICKET_GIT : ticketGitState(projectRoot, store.dirRel, base);
  const unreadable: UnreadableEntry[] = [];
  const specFiles = loadDir(specRoot, specRoot, unreadable);
  return {
    specRoot,
    projectRoot,
    ticketsDir: resolve(projectRoot, ticketsRel),
    ticketsRel: toPosix(ticketsRel),
    ticketsInRepo: store.dirRel !== null && !outside,
    config: mergedConfig,
    delegation,
    unavailableModels: local.unavailableModels,
    configLocalFindings: local.findings,
    spec: parseSpec(specFiles),
    unreadable,
    store,
    tickets: await store.list(ticketGit),
    ticketGit,
  };
}

/** Re-reads the spec files without reloading the ticket store. */
export function reloadWorkspaceSpec(ws: Workspace): Workspace {
  const unreadable: UnreadableEntry[] = [];
  const specFiles = loadDir(ws.specRoot, ws.specRoot, unreadable);
  return { ...ws, spec: parseSpec(specFiles), unreadable };
}
