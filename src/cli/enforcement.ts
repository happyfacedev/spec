// Edit, commit and history enforcement. Git hooks call the same pinned CLI from every worktree.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { matchesAny } from '../core/glob';
import { PATTERNS } from '../core/ids';
import type { Ticket } from '../core/model';
import { manifestHasVersion, manifestListsRole, stageRoleOfPath } from '../core/role-manifest';
import type { Config, StageRole } from '../core/schemas';
import { parseTicket } from '../core/parse/tickets';
import { plainWrites } from '../core/shell-writes';
import { realPath, relativeInside, toPosix } from '../io/fs';
import { catFileBatch, commonDir, currentBranch, git, gitContext, gitWithInput, isRepo } from '../io/git';
import { worktreeBranches } from '../io/ticket-git';
import type { Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { GIT_HOOK_NAMES, SPEC_HOOK_MARKER } from './git-hooks';
import { isGenerated } from './generated';
import { type Out, json, ok, usageError } from './output';

const BYPASS_FILE = 'spec-bypass.json';
const BYPASS_TTL_MS = 60 * 60 * 1000;

interface BypassState {
  readonly id: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly decisionPath?: string;
}

export interface BypassStatus {
  readonly active: boolean;
  readonly id?: string;
  readonly reason?: string;
  readonly expiresAt?: string;
}

function bypassPath(root: string): string | null {
  const dir = commonDir(root);
  return dir === null ? null : join(dir, BYPASS_FILE);
}

function readBypass(root: string, now: string): BypassState | null {
  const file = bypassPath(root);
  if (file === null || !existsSync(file)) return null;
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object') return null;
    const state = value as Partial<BypassState>;
    if (typeof state.id !== 'string' || typeof state.reason !== 'string' || typeof state.expiresAt !== 'string') return null;
    const expiresAt = Date.parse(state.expiresAt);
    const currentTime = Date.parse(now);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(currentTime) || expiresAt <= currentTime) {
      unlinkSync(file);
      return null;
    }
    return state as BypassState;
  } catch {
    return null;
  }
}

export function bypassStatus(root: string, now = new Date().toISOString()): BypassStatus {
  const value = readBypass(root, now);
  return value ? { active: true, id: value.id, reason: value.reason, expiresAt: value.expiresAt } : { active: false };
}

export function cancelBypass(root: string, removeUncommittedAdr = false): boolean {
  const file = bypassPath(root);
  if (file === null || !existsSync(file)) return false;
  let state: Partial<BypassState> | null = null;
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (value !== null && typeof value === 'object') state = value;
  } catch {
    // A malformed state can be cleared, but it cannot name an ADR to remove.
  }
  if (removeUncommittedAdr && typeof state?.id === 'string' && PATTERNS.decision.test(state.id) && typeof state.decisionPath === 'string') {
    const decisionFile = resolve(root, state.decisionPath);
    const relativePath = relativeInside(decisionFile, root);
    if (relativePath !== null && basename(decisionFile) === `${state.id}-bypass.md`) {
      const inHead = git(root, ['ls-tree', '--name-only', 'HEAD', '--', relativePath]);
      if (inHead.code === 0 && !inHead.stdout.split('\n').includes(relativePath)) {
        const staged = git(root, ['ls-files', '--error-unmatch', '--', relativePath]);
        if (staged.code === 0 && git(root, ['rm', '--cached', '--force', '--', relativePath]).code !== 0) return false;
        if (existsSync(decisionFile)) unlinkSync(decisionFile);
      }
    }
  }
  unlinkSync(file);
  return true;
}

function nextDecision(specRoot: string, projectRoot: string): { id: string; file: string } {
  const dir = join(specRoot, 'decisions');
  const taken = new Set<number>(existsSync(dir)
    ? readdirSync(dir)
      .map((name) => /^ADR-(\d{3,4})/.exec(name)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number)
    : []);
  const specRel = toPosix(relative(projectRoot, specRoot));
  const decisionPath = specRel === '' ? 'decisions' : `${specRel}/decisions`;
  const branches = git(projectRoot, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/ticket']).stdout.split('\n').filter(Boolean);
  for (const branch of branches) {
    const tree = git(projectRoot, ['ls-tree', '-r', '--name-only', '-z', branch, '--', decisionPath]);
    for (const path of tree.stdout.split('\0').filter(Boolean)) {
      const n = /^ADR-(\d{3,4})/.exec(path.split('/').at(-1) ?? '')?.[1];
      if (n !== undefined) taken.add(Number(n));
    }
  }
  let n = 1;
  while (taken.has(n)) n++;
  const id = `ADR-${String(n).padStart(3, '0')}`;
  return { id, file: join(dir, `${id}-bypass.md`) };
}

export function openBypass(ws: Workspace, reason: string, now: string, actor: { user: string; agent: string | null; approved: boolean }): { ok: true; id: string } | { ok: false; error: string } {
  const why = reason.trim().replace(/\s+/g, ' ');
  if (!why) return { ok: false, error: 'spec bypass needs a reason' };
  if (readBypass(ws.projectRoot, now) !== null) return { ok: false, error: 'a bypass is already active; use spec bypass --status or --cancel first' };
  if (why.length > 72) return { ok: false, error: 'the bypass reason must be at most 72 characters so its decision title fits the spec format' };
  if (!isRepo(ws.projectRoot)) return { ok: false, error: 'spec bypass requires a git repository' };
  if (inTicketWorktree(ws, ws.projectRoot)) return { ok: false, error: 'spec bypass cannot be opened from a ticket worktree' };
  if (actor.agent !== null && ws.config?.enforce.bypass === 'person') return { ok: false, error: 'project policy is person-only; agents cannot open a bypass' };
  if (actor.agent !== null && !actor.approved) return { ok: false, error: `ask the person whether to open a bypass (\`.spec/bin/spec bypass "${why}"\`)` };
  const file = bypassPath(ws.projectRoot);
  if (file === null) return { ok: false, error: 'could not resolve the common git directory' };
  const decision = nextDecision(ws.specRoot, ws.projectRoot);
  const user = git(ws.projectRoot, ['config', '--get', 'user.name']).stdout.trim() || 'unknown';
  const date = now.slice(0, 10);
  const title = `Bypass: ${why}`;
  const body = [
    '---',
    `id: ${decision.id}`,
    `title: ${JSON.stringify(title)}`,
    'kind: bypass',
    'status: accepted',
    '---',
    '## Decision',
    `Permit one commit outside a ticket for: ${why}`,
    '',
    `Date: ${date} · Git user: ${user}`,
    actor.agent === null ? `Opened by: ${user} (no agent environment detected)` : `Opened by: agent (${actor.agent}) after the person's approval in the session`,
    '',
    '## Consequences',
    '- This exception is recorded and expires after one commit or one hour.',
    '',
    '## Context',
    '- A person chose to bypass the normal ticket workflow.',
    '',
    '## Alternatives',
    '- Deliver the change through a ticket: not chosen for this emergency.',
    '',
  ].join('\n');
  if (existsSync(decision.file)) return { ok: false, error: `decision file already exists: ${relative(ws.specRoot, decision.file)}` };
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(file, JSON.stringify({ id: decision.id, reason: why, createdAt: now, expiresAt: new Date(Date.parse(now) + BYPASS_TTL_MS).toISOString(), decisionPath: toPosix(relative(ws.projectRoot, decision.file)) }, null, 2) + '\n', { flag: 'wx' });
  } catch {
    return { ok: false, error: 'a bypass is already active; use spec bypass --status or --cancel first' };
  }
  try {
    mkdirSync(dirname(decision.file), { recursive: true });
    writeFileSync(decision.file, body, { flag: 'wx' });
  } catch (error) {
    unlinkSync(file);
    throw error;
  }
  return { ok: true, id: decision.id };
}

function canonicalPath(path: string): string {
  let current = resolve(path);
  const tail: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    tail.unshift(current.slice(parent.length + 1));
    current = parent;
  }
  return resolve(realPath(current), ...tail);
}

function pathFromInput(path: string, cwd: string): string {
  return canonicalPath(resolve(cwd, path));
}

function nearestExistingDirectory(path: string): string {
  let current = resolve(path);
  while (!existsSync(current) || !statSync(current).isDirectory()) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`no existing directory for ${path}`);
    current = parent;
  }
  return realPath(current);
}

/** The marker file for a project path relative to the work-tree root, symlinks resolved ('.' for the root itself). */
function projectMarkerFile(common: string, projectRel: string): string {
  const key = projectRel === '' ? '.' : toPosix(projectRel);
  return join(common, 'spec', 'projects', createHash('sha256').update(key).digest('hex').slice(0, 32));
}

/**
 * Records the project in the common Git directory, whatever core.hooksPath is. The marker is
 * ownership evidence only (INS-016 R13); outside a Git work tree nothing is written.
 */
export function writeProjectMarker(repo: string): void {
  const common = commonDir(repo);
  if (common === null) return;
  const top = git(repo, ['rev-parse', '--show-toplevel']);
  if (top.code !== 0) return;
  const rel = relativeInside(repo, top.stdout.trim());
  if (rel === null) return;
  const file = projectMarkerFile(common, rel);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ path: rel === '' ? '.' : rel })}\n`);
  } catch {
    // A marker is only ownership evidence; failing to write it must not fail setup.
  }
}

function projectOwnsGitRoot(ws: Workspace, root: string, bypassStatePresent: boolean): boolean {
  if (realPath(ws.projectRoot) === root || bypassStatePresent) return true;
  const common = commonDir(root);
  if (common !== null) {
    if (existsSync(join(common, BYPASS_FILE)) || existsSync(join(common, 'spec/commit-token'))) return true;
    const markerRel = relativeInside(realPath(ws.projectRoot), root);
    if (markerRel !== null && existsSync(projectMarkerFile(common, markerRel))) return true;
    for (const name of GIT_HOOK_NAMES) {
      const hook = join(common, 'hooks', name);
      if (existsSync(hook) && readFileSync(hook, 'utf8').split(/\r?\n/).includes(SPEC_HOOK_MARKER)) return true;
    }
  }
  const since = ws.config?.enforceSince;
  if (since && git(root, ['rev-parse', '--verify', '--quiet', `${since}^{commit}`]).code === 0) return true;

  const configPath = relativeInside(canonicalPath(join(ws.specRoot, 'config.json')), root);
  if (configPath === null) return false;
  const head = git(root, ['rev-parse', '--verify', 'HEAD']);
  if (head.code !== 0) return false;
  const configRel = toPosix(configPath);
  const trackedConfig = git(root, ['ls-tree', '-r', '--name-only', head.stdout.trim(), '--', configRel]);
  if (trackedConfig.code !== 0) throw new Error(trackedConfig.stderr.trim() || 'git could not check the project config path');
  if (trackedConfig.stdout.split('\n').includes(configRel)) return true;
  if (!existsSync(join(ws.specRoot, 'config.json'))) return false;
  const projectRel = relativeInside(realPath(ws.projectRoot), root);
  if (projectRel === null) return false;
  const projectPrefix = toPosix(projectRel);
  const projectFiles = git(root, ['ls-tree', '-r', '--name-only', head.stdout.trim(), '--', projectPrefix || '.']);
  if (projectFiles.code !== 0) throw new Error(projectFiles.stderr.trim() || 'git could not check files under the project path');
  return projectFiles.stdout.split('\n').some((path) => path !== '' && path !== configRel && (projectPrefix === '' || path.startsWith(`${projectPrefix}/`)));
}

function targetIsOnBaseBranch(ws: Workspace, target: string, base: string, bypassStatePresent = false): boolean {
  const start = nearestExistingDirectory(dirname(target));
  const context = gitContext(start);
  if (context === 'none' || context === 'bare') return false;
  if (context === 'broken') {
    const failure = git(start, ['rev-parse', '--show-toplevel']);
    throw new Error(failure.stderr.trim() || 'git could not classify the target checkout');
  }
  const top = git(start, ['rev-parse', '--show-toplevel']);
  if (top.code !== 0) throw new Error(top.stderr.trim() || 'git could not locate the target checkout');
  const root = realPath(top.stdout.trim());
  if (!projectOwnsGitRoot(ws, root, bypassStatePresent)) return false;
  const branch = currentBranch(root);
  if (branch === base) return true;
  if (branch !== null) return false;
  const head = git(root, ['rev-parse', '--verify', 'HEAD']);
  const baseTip = git(root, ['rev-parse', '--verify', `refs/heads/${base}`]);
  if (head.code !== 0 || baseTip.code !== 0) throw new Error(head.stderr.trim() || baseTip.stderr.trim() || 'git could not identify the target checkout branch');
  return head.stdout.trim() === baseTip.stdout.trim();
}

/** The pinned CLI folder, a governed path (INS-015/R1, INS-016/R15). */
const PINNED_CLI_DIR = '.spec/bin';

type GovernedContext = Pick<Workspace, 'projectRoot' | 'specRoot' | 'ticketsDir' | 'config'>;

/**
 * Whether a project-relative POSIX path is governed, judged by where it sits in the tree and never by where a
 * symlink at it points (INS-016/R14, INV-011). Only the project, spec and tickets roots are resolved through
 * symlinks, once, here.
 */
function treeGovernor(ws: GovernedContext): (rel: string) => boolean {
  const project = canonicalPath(ws.projectRoot);
  // A root is the project-relative place it is configured at, whatever it is in this checkout: a root replaced
  // by a symlink to an outside folder stays governed (INV-011). The resolved place is kept too, for a project
  // reached through a differently spelled folder.
  const folders = new Set<string>();
  for (const dir of [ws.specRoot, ws.ticketsDir]) {
    const lexical = within(resolve(dir), resolve(ws.projectRoot));
    const resolvedRel = within(canonicalPath(dir), project);
    if (lexical !== null) folders.add(lexical);
    if (resolvedRel !== null) folders.add(resolvedRel);
  }
  const globs = [...(ws.config?.codeGlobs ?? []), ...(ws.config?.testGlobs ?? []), ...(ws.config?.protectedGlobs ?? [])];
  const under = (rel: string, dir: string): boolean => dir === '' || rel === dir || rel.startsWith(dir + '/');
  return (rel) => [...folders].some((dir) => under(rel, dir)) || under(rel, PINNED_CLI_DIR) || matchesAny(rel, globs);
}

/** `path` relative to `dir` by their spelling alone (POSIX, '' for `dir` itself), or null when it is not inside. */
function within(path: string, dir: string): string | null {
  if (path === dir) return '';
  return path.startsWith(dir.endsWith('/') ? dir : dir + '/') ? toPosix(path.slice(dir.length).replace(/^\/+/, '')) : null;
}

/**
 * The project-relative path an edit names, from the spelling alone: relative to the project as given or as
 * resolved, with the folders above the file resolved or not. Null when the named path is outside the project.
 */
function namedProjectPath(ws: GovernedContext, absPath: string): string | null {
  const named = resolve(absPath);
  const spellings = [named, resolve(canonicalPath(dirname(named)), basename(named))];
  const projects = [resolve(ws.projectRoot), canonicalPath(ws.projectRoot)];
  for (const spelling of spellings) for (const project of projects) {
    const rel = within(spelling, project);
    if (rel !== null) return rel;
  }
  return null;
}

/**
 * A path in the checkout that holds the file an edit names (INS-016/R14). Inside the project it follows the
 * named folders only as far as they really stay in the project, so a folder replaced by a link to somewhere
 * else (a `.spec/bin` that points at another repository) does not move the edit to that checkout.
 */
function checkoutProbe(ws: GovernedContext, named: string): string {
  const rel = namedProjectPath(ws, named);
  if (rel === null) return join(canonicalPath(dirname(named)), basename(named));
  const project = canonicalPath(ws.projectRoot);
  let dir = project;
  const folders = rel.split('/').slice(0, -1).filter(Boolean);
  for (const folder of folders) {
    const next = join(dir, folder);
    const real = realPath(next);
    if (!existsSync(next) || !statSync(next).isDirectory() || within(real, project) === null) break;
    dir = real;
  }
  return join(dir, basename(named));
}

/**
 * Whether a file an edit names is governed (INS-016/R14): the path it names, however its folders are linked,
 * or the file it resolves to, sits in a governed place.
 */
export function isGovernedPath(ws: GovernedContext, absPath: string): boolean {
  const governed = treeGovernor(ws);
  const named = resolve(absPath);
  const project = canonicalPath(ws.projectRoot);
  const spellings = [named, resolve(canonicalPath(dirname(named)), basename(named)), canonicalPath(named)];
  const projects = [resolve(ws.projectRoot), project];
  const folders = [ws.specRoot, ws.ticketsDir].flatMap((dir) => [resolve(dir), canonicalPath(dir)]);
  return spellings.some((spelling) => folders.some((dir) => within(spelling, dir) !== null)
    || projects.some((root) => {
      const rel = within(spelling, root);
      return rel !== null && governed(rel);
    }));
}

export function governedPaths(ws: Workspace): readonly string[] {
  return [
    ...(ws.config?.codeGlobs ?? []),
    ...(ws.config?.testGlobs ?? []),
    ...(ws.config?.protectedGlobs ?? []),
    toPosix(relative(ws.projectRoot, ws.specRoot)) + '/**',
    toPosix(relative(ws.projectRoot, ws.ticketsDir)) + '/**',
    `${PINNED_CLI_DIR}/**`,
  ];
}

const SYMLINK_MODE = '120000';
const MAX_LINK_HOPS = 40;

/** A symlink entry under a governed path whose target is absolute, leaves the project or loops (INS-016/R14). */
interface LinkIssue {
  readonly path: string;
  readonly why: string;
}

const GITLINK_MODE = '160000';

/** Every entry of one Git index or tree (path -> mode and blob), and the folders they sit in. */
interface TreeEntries {
  readonly entries: ReadonlyMap<string, { readonly mode: string; readonly sha: string }>;
  readonly dirs: ReadonlySet<string>;
}

function entriesOf(listing: string, pattern: RegExp): TreeEntries {
  const entries = new Map<string, { mode: string; sha: string }>();
  const dirs = new Set<string>();
  for (const line of listing.split('\0')) {
    const entry = pattern.exec(line);
    if (entry === null) continue;
    const path = entry[3] ?? '';
    entries.set(path, { mode: entry[1] ?? '', sha: entry[2] ?? '' });
    for (let slash = path.indexOf('/'); slash >= 0; slash = path.indexOf('/', slash + 1)) dirs.add(path.slice(0, slash));
  }
  return { entries, dirs };
}

/** The whole index, or an error: an index that cannot be listed is never read as an empty one. */
function indexEntries(root: string): TreeEntries {
  const listed = git(root, ['ls-files', '--stage', '-z']);
  if (listed.code !== 0) throw new Error(listed.stderr.trim() || 'git could not list the index');
  return entriesOf(listed.stdout, /^(\d+) ([0-9a-f]+) 0\t(.*)$/s);
}

function historyTree(root: string, treeish: string): HistoryTree {
  const context = activeHistoryRead;
  const tree = context?.root === root ? context.commits.get(treeish)?.tree ?? treeish : treeish;
  const cached = context?.root === root ? context.trees.get(tree) : undefined;
  if (cached !== undefined) return cached;
  const listing = historyGit(root, ['ls-tree', '-r', '-z', tree]).stdout;
  const result = { listing, entries: entriesOf(listing, /^(\d+) (?:blob|commit) ([0-9a-f]+)\t(.*)$/s) };
  if (context?.root === root) context.trees.set(tree, result);
  return result;
}

function commitEntries(root: string, commit: string): TreeEntries {
  return historyTree(root, historyCommit(root, commit).tree).entries;
}

/**
 * Why the symlink entry at `path` is refused, or null. Its target is read from the tree as text and resolved
 * from the link's own folder through that tree's entries; nothing is followed on disk (INV-011). Every
 * component must be an entry of the tree under its exact spelling: a missing one, a case variant, or a
 * path through a file or a submodule (whose contents the tree does not hold) is unresolved.
 */
function linkProblem(root: string, path: string, tree: TreeEntries): string | null {
  const queue = path.split('/');
  const resolved: string[] = [];
  let hops = 0;
  while (queue.length > 0) {
    const part = queue.shift() ?? '';
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (resolved.pop() === undefined) return 'its target leaves the project';
      continue;
    }
    resolved.push(part);
    const here = resolved.join('/');
    const entry = tree.entries.get(here);
    const continues = queue.some((rest) => rest !== '' && rest !== '.');
    if (entry === undefined) {
      if (!tree.dirs.has(here)) return 'its target does not exist in the tree';
      continue;
    }
    if (entry.mode !== SYMLINK_MODE) {
      if (continues) return entry.mode === GITLINK_MODE ? 'its target passes through a submodule, whose contents the tree does not hold' : 'its target passes through a file';
      continue;
    }
    if (++hops > MAX_LINK_HOPS) return 'its target loops';
    const blob = historyBlob(root, entry.sha);
    if (blob.code !== 0) return 'its target cannot be read';
    const target = blob.stdout;
    if (target === '' || target.startsWith('/') || target.startsWith('\\') || /^[A-Za-z]:/.test(target)) return target === '' ? 'its target is empty' : 'its target is an absolute path';
    resolved.pop();
    queue.unshift(...target.split('/'));
  }
  return null;
}

function linkIssues(root: string, paths: readonly string[], tree: TreeEntries): LinkIssue[] {
  const issues: LinkIssue[] = [];
  for (const path of paths) {
    if (tree.entries.get(path)?.mode !== SYMLINK_MODE) continue;
    const why = linkProblem(root, path, tree);
    if (why !== null) issues.push({ path, why });
  }
  return issues;
}

const describeLink = (issue: LinkIssue): string => `${issue.path} is a symlink that points outside the project or cannot be resolved inside it (${issue.why})`;

function ticketWorktreeRoot(ws: Workspace, cwd: string): string | null {
  const branch = currentBranch(cwd);
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (top.code === 0 && branch?.startsWith('ticket/')) return realPath(top.stdout.trim());
  const here = realPath(resolve(cwd));
  for (const tree of ws.ticketGit.worktrees.values()) {
    const resolved = realPath(tree);
    if (here === resolved || here.startsWith(resolved + '/')) return resolved;
  }
  return null;
}

export function inTicketWorktree(ws: Workspace, cwd: string): boolean {
  return ticketWorktreeRoot(ws, cwd) !== null;
}

function editsEnforced(config: Config | null): boolean {
  return config?.enforce.edits !== false;
}

export function beforeEditReason(ws: Workspace, filePath: string, cwd: string, now = new Date().toISOString()): string | null {
  if (!editsEnforced(ws.config)) return null;
  const target = pathFromInput(filePath, cwd);
  const tree = ticketWorktreeRoot(ws, cwd);
  if (tree !== null) {
    const inside = relativeInside(target, tree);
    return inside === null ? `Edits from this ticket worktree must stay inside ${tree}; ${filePath} is outside it.` : null;
  }
  const base = ws.config?.baseBranch ?? 'main';
  const named = resolve(cwd, filePath);
  if (!isGovernedPath(ws, named)) return null;
  const bypassFile = bypassPath(ws.projectRoot);
  const bypassStatePresent = bypassFile !== null && existsSync(bypassFile);
  if (readBypass(ws.projectRoot, now) !== null) return null;
  // The checkout is the one the named path sits in, not the one a symlink at it resolves to (INS-016/R14).
  if (!targetIsOnBaseBranch(ws, checkoutProbe(ws, named), base, bypassStatePresent)) return null;
  return `Cannot edit governed file ${filePath} on base branch ${base}. Use /spec:feature for new behaviour, /spec:change for changed behaviour, or /spec:bug for broken behaviour; ask the person whether to open a bypass (\`.spec/bin/spec bypass "<reason>"\`).`;
}

/** The real path of a file that may not exist yet: its nearest existing folder resolved, the rest as written. */
function realTarget(path: string): string {
  const missing: string[] = [];
  let dir = dirname(path);
  while (!existsSync(dir) && dirname(dir) !== dir) {
    missing.unshift(basename(dir));
    dir = dirname(dir);
  }
  return join(realPath(dir), ...missing, basename(path));
}

/**
 * Why a shell command is refused: it plainly writes a file tracked in a ticket worktree of the
 * repository holding `cwd` (INS-016/R16). Everything unclear is allowed (R17, INV-014).
 */
export function beforeShellReason(ws: Workspace, command: string, cwd: string): string | null {
  if (!editsEnforced(ws.config)) return null;
  const targets = plainWrites(command);
  if (targets.length === 0) return null;
  const trees = [...worktreeBranches(cwd)].filter(([branch]) => branch.startsWith('ticket/')).map(([, path]) => realPath(path));
  if (trees.length === 0) return null;
  for (const target of targets) {
    const real = realTarget(resolve(cwd, target));
    for (const tree of trees) {
      const inside = relativeInside(real, tree);
      if (inside === null || inside === '') continue;
      const listed = git(tree, ['ls-files', '-z', '--', `:(literal)${inside}`]);
      if (listed.code !== 0) return null;
      if (listed.stdout.split('\0').includes(inside)) {
        return `spec refused this shell command: it writes the tracked file ${inside}; change files with your edit tools (Edit or Write), not the shell`;
      }
    }
  }
  return null;
}

/** The project path a spec-managed hook records, read as text and never run (INS-018/R3); null when it is missing or not a plain relative path (INS-018/R2). */
function recordedProject(text: string): string | null {
  const line = text.split(/\r?\n/).find((l) => l.startsWith('project_root="$worktree_root"/'));
  const quoted = line === undefined ? null : /^'((?:[^']|'\\'')*)'$/.exec(line.slice('project_root="$worktree_root"/'.length));
  if (quoted?.[1] === undefined) return null;
  const path = quoted[1].replaceAll(`'\\''`, `'`);
  if (path === '' || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').includes('..')) return null;
  return path;
}

/** Every working tree of the repository holding `repo`, the main one and the linked ones. */
function workingTrees(repo: string): string[] {
  const listed = git(repo, ['worktree', 'list', '--porcelain']);
  if (listed.code !== 0) return [];
  return listed.stdout
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length));
}

/** What to do with an existing spec-managed hook for the project at `project` (INS-018/R1, R2). */
function ownedHookVerdict(repo: string, text: string, project: string, shown: string): { write: boolean; note: string | null } {
  const recorded = recordedProject(text);
  if (recorded === project) return { write: true, note: null };
  if (recorded === null) return { write: false, note: `kept ${shown}; its spec project path cannot be read; to repoint it, delete that file and run spec upgrade in ${project}` };
  if (workingTrees(repo).some((tree) => existsSync(join(tree, recorded)))) {
    return { write: false, note: `kept ${shown}; it serves the spec project at ${recorded}, not this project at ${project}; to repoint it, delete that file and run spec upgrade in ${project}` };
  }
  return { write: true, note: `took over ${shown} from the spec project at ${recorded}, which no longer exists` };
}

export function installGitHooks(named: string): { written: string[]; notes: string[] } {
  // Git reports relative paths from the real folder, which a symlink named on the command line is not (INS-018/S4).
  const repo = realPath(named);
  const dir = commonDir(repo);
  if (dir === null) return { written: [], notes: ['git hooks not installed: not a git repository'] };
  if (!existsSync(join(repo, '.spec/bin/spec'))) return { written: [], notes: ['git hooks not installed: .spec/bin/spec is missing'] };
  const resolved = git(repo, ['rev-parse', '--git-path', 'hooks']);
  if (resolved.code !== 0) return { written: [], notes: ['git hooks not installed: could not resolve core.hooksPath'] };
  const hooksDir = resolve(repo, resolved.stdout.trim());
  const defaultHooksDir = resolve(dir, 'hooks');
  const displayDir = relativeInside(hooksDir, repo) ?? (hooksDir === defaultHooksDir ? '.git/hooks' : toPosix(hooksDir));
  const written: string[] = [];
  const notes: string[] = [];
  if (hooksDir !== defaultHooksDir) {
    for (const name of GIT_HOOK_NAMES) notes.push(`core.hooksPath is not the common Git hooks directory; add this line to ${toPosix(join(displayDir, name))}: .spec/bin/spec hook git ${name} "$@"`);
    return { written, notes };
  }
  mkdirSync(hooksDir, { recursive: true });
  // The project path is the real folder relative to the working tree root, however the folder was named (INS-018/S4).
  const top = git(repo, ['rev-parse', '--show-toplevel']);
  const inside = top.code === 0 ? relativeInside(repo, top.stdout.trim()) : null;
  const projectPrefix = (inside ?? git(repo, ['rev-parse', '--show-prefix']).stdout.trim().replace(/\/+$/, '')) || '.';
  const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  for (const name of GIT_HOOK_NAMES) {
    const file = join(hooksDir, name);
    const body = `#!/bin/sh\n${SPEC_HOOK_MARKER}\nworktree_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0\nproject_root="$worktree_root"/${quote(projectPrefix)}\ncli="$project_root/.spec/bin/spec"\nif [ ! -x "$cli" ] || [ ! -f "$project_root/.spec/bin/spec.cjs" ]; then\n  printf '%s\\n' "spec hook warning: pinned CLI missing at $cli; restore it with spec upgrade" >&2\n  exit 0\nfi\nexec "$cli" hook git ${name} "$@" --root "$project_root/spec"\n`;
    if (existsSync(file)) {
      const have = readFileSync(file, 'utf8');
      if (!have.split('\n').includes(SPEC_HOOK_MARKER)) {
        notes.push(`kept existing ${toPosix(join(displayDir, name))}; add this line: .spec/bin/spec hook git ${name} "$@"`);
        continue;
      }
      const verdict = ownedHookVerdict(repo, have, projectPrefix, toPosix(join(displayDir, name)));
      if (verdict.note !== null) notes.push(verdict.note);
      if (!verdict.write) continue;
    }
    writeFileSync(file, body);
    chmodSync(file, 0o755);
    written.push(toPosix(join(displayDir, name)));
  }
  return { written, notes };
}

function stagePaths(root: string, pathspecs: readonly string[] = []): string[] {
  const args = ['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACDMRT', '-z'];
  if (pathspecs.length > 0) args.push('--', ...pathspecs);
  const r = git(root, args);
  return r.code === 0 ? r.stdout.split('\0').filter(Boolean).map(toPosix) : [];
}

/** What a spec-owned base commit is for: a ticket, or the role prompts `spec init --update-roles --yes` wrote (INS-005/R5). */
export type CommitPurpose =
  | { readonly kind: 'ticket' | 'combine' | 'merge' | 'afterMerge'; readonly ticket: string }
  | { readonly kind: 'roles'; readonly version: string };

interface CommitToken {
  readonly nonce: string;
  readonly createdAt: string;
  readonly purpose: CommitPurpose;
  readonly paths: readonly string[];
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const REGULAR_FILE_MODES = new Set(['100644', '100755']);

/**
 * What a spec-owned commit needs of the workspace. A role-update commit builds it from the config alone, so no
 * file of the spec, a `.local.md` among them, is read (INS-005/R4).
 */
export type CommitContext = Pick<Workspace, 'projectRoot' | 'specRoot' | 'ticketsDir' | 'config'>;

/** The stage role whose prompt `path` is, or null: a `.local.md`, another folder or another file is none. */
function rolePromptOf(ws: Pick<Workspace, 'projectRoot' | 'specRoot'>, path: string): StageRole | null {
  return stageRoleOfPath(toPosix(relative(ws.projectRoot, ws.specRoot)), path);
}

/** Why the blob `mode` + `text` is not a prompt `version` shipped for `role`, or null when the manifest lists it (INS-005/R5). */
function rolePromptIssue(path: string, role: StageRole, version: string, mode: string, text: string): string | null {
  if (!REGULAR_FILE_MODES.has(mode)) return `${path} is not a regular file`;
  return manifestListsRole(version, role, sha256(text)) ? null : `${path} is not a ${role} prompt that spec ${version} shipped`;
}

/** The staged (or, in a hook, temporary-index) role prompts checked as data against the manifest; the first issue, or null. */
function stagedRolesIssue(ws: Workspace, paths: readonly string[], version: string): string | null {
  if (paths.length === 0) return 'no role prompt is staged';
  if (!manifestHasVersion(version)) return `spec ${version} is not in the shipped-prompt manifest`;
  for (const path of paths) {
    const role = rolePromptOf(ws, path);
    if (role === null) return `${path} is not a stage-role prompt`;
    const entry = git(ws.projectRoot, ['ls-files', '--stage', '-z', '--', path]);
    const mode = entry.code === 0 ? /^(\d+) [0-9a-f]+ 0\t/.exec(entry.stdout)?.[1] : undefined;
    const blob = git(ws.projectRoot, ['show', `:${path}`]);
    if (mode === undefined || blob.code !== 0) return `${path} is not staged as a file`;
    const issue = rolePromptIssue(path, role, version, mode, blob.stdout);
    if (issue !== null) return issue;
  }
  return null;
}

/**
 * INS-015/R4: a combine marker names several ticket files, INTO's among them; a close marker (the same kind, cited by
 * the superseding ticket) names the one ticket file `spec ticket close` retires, which is not the cited ticket's.
 */
function isCombinePathSet(tickets: string, cited: string, paths: readonly string[]): boolean {
  const isTicketFile = (path: string): boolean => path.startsWith(`${tickets}/`) && path.endsWith('.md') && PATTERNS.ticket.test(path.slice(tickets.length + 1, -3));
  if (!paths.every(isTicketFile)) return false;
  const citedPath = `${tickets}/${cited}.md`;
  return paths.length > 1 ? paths.includes(citedPath) : paths.length === 1 && paths[0] !== citedPath;
}

const COMMIT_TOKEN_TTL_MS = 60_000;
function commitTokenPath(root: string): string | null {
  const dir = commonDir(root);
  return dir === null ? null : join(dir, 'spec', 'commit-token');
}

function consumeCommitToken(ws: Workspace, staged: readonly string[], now: string, consume = true): boolean {
  const file = commitTokenPath(ws.projectRoot);
  if (file === null || !existsSync(file)) return false;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    value = null;
  } finally {
    if (consume) unlinkSync(file);
  }
  if (!value || typeof value !== 'object') return false;
  const token = value as Partial<CommitToken>;
  if (typeof token.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(token.nonce) || typeof token.createdAt !== 'string' || !Array.isArray(token.paths)) return false;
  const age = Date.parse(now) - Date.parse(token.createdAt);
  if (!Number.isFinite(age) || age < 0 || age >= COMMIT_TOKEN_TTL_MS) return false;
  const actual = [...staged].sort();
  const expected = token.paths.filter((path): path is string => typeof path === 'string').sort();
  if (expected.length !== token.paths.length || JSON.stringify(actual) !== JSON.stringify(expected)) return false;
  const purpose = token.purpose;
  if (!purpose || typeof purpose !== 'object') return false;
  if (purpose.kind === 'roles') return typeof purpose.version === 'string' && stagedRolesIssue(ws, actual, purpose.version) === null;
  if (typeof purpose.ticket !== 'string' || !PATTERNS.ticket.test(purpose.ticket)) return false;
  if (purpose.kind === 'ticket') {
    const tickets = toPosix(relative(ws.projectRoot, ws.ticketsDir));
    return actual.length === 1 && actual[0] === `${tickets}/${purpose.ticket}.md`;
  }
  const tickets = toPosix(relative(ws.projectRoot, ws.ticketsDir));
  if (purpose.kind === 'combine') return isCombinePathSet(tickets, purpose.ticket, actual);
  const ticketPath = `${tickets}/${purpose.ticket}.md`;
  const stagedTicket = git(ws.projectRoot, ['show', `:${ticketPath}`]);
  if (purpose.kind === 'merge') {
    const ticket = stagedTicket.code === 0 ? parseTicket(ticketPath, stagedTicket.stdout).ticket : null;
    return git(ws.projectRoot, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).code === 0 && ticket?.data.status === 'done';
  }
  const parts = git(ws.projectRoot, ['rev-list', '--parents', '-n', '1', 'HEAD']).stdout.trim().split(/\s+/);
  if (parts.length !== 3) return false;
  const merge = parts[0] ?? '';
  const mergeMessage = git(ws.projectRoot, ['show', '-s', '--format=%B', merge]).stdout;
  const committedTicket = git(ws.projectRoot, ['show', `${merge}:${ticketPath}`]);
  const ticket = committedTicket.code === 0 ? parseTicket(ticketPath, committedTicket.stdout).ticket : null;
  return ticketTrailerId(mergeMessage) === purpose.ticket && ticket?.data.status === 'done';
}

/** Run a spec-owned base commit with a short-lived, staged-set-bound hook token. */
export function commitWithToken(ws: CommitContext, purpose: CommitPurpose, args: readonly string[]): ReturnType<typeof git> {
  const root = ws.projectRoot;
  const base = ws.config?.baseBranch ?? 'main';
  if (currentBranch(root) !== base) return git(root, args);
  const file = commitTokenPath(root);
  if (file === null) return { code: 1, stdout: '', stderr: 'could not resolve the common git directory' };
  const separator = args.indexOf('--');
  const pathspecs = separator < 0 ? [] : args.slice(separator + 1);
  const paths = stagePaths(root, pathspecs).sort();
  if (purpose.kind === 'roles') {
    const stray = paths.filter((path) => rolePromptOf(ws, path) === null);
    if (paths.length === 0 || stray.length > 0) return { code: 1, stdout: '', stderr: `a role-update commit must stage only stage-role prompts${stray.length > 0 ? `, not ${stray.join(', ')}` : ''}` };
  }
  if (purpose.kind === 'ticket') {
    const tickets = toPosix(relative(root, ws.ticketsDir));
    if (paths.length !== 1 || paths[0] !== `${tickets}/${purpose.ticket}.md`) {
      return { code: 1, stdout: '', stderr: `spec ticket commit must stage only ${tickets}/${purpose.ticket}.md` };
    }
  }
  if (purpose.kind === 'combine' && !isCombinePathSet(toPosix(relative(root, ws.ticketsDir)), purpose.ticket, paths)) {
    return { code: 1, stdout: '', stderr: `spec ticket combine must stage only ticket files, ${purpose.ticket}'s among them, and spec ticket close only the one ticket file it retires` };
  }
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const token: CommitToken = { nonce: randomBytes(32).toString('hex'), createdAt: new Date().toISOString(), purpose, paths };
  try {
    writeFileSync(file, `${JSON.stringify(token)}\n`, { flag: 'wx', mode: 0o600 });
    chmodSync(file, 0o600);
  } catch {
    return { code: 1, stdout: '', stderr: 'another spec commit token is active; wait for it to finish or remove the stale token' };
  }
  try {
    return git(root, args);
  } finally {
    if (existsSync(file)) unlinkSync(file);
  }
}

function firstLines(text: string): string {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 2).join(' ') || 'git gave no reason';
}

/**
 * INS-005/R5: commits the role prompts `spec init --update-roles --yes` wrote, and nothing else staged, under a
 * role-update marker bound to those files. `commit` is null when they match what HEAD already holds. On failure
 * each file's index entry (the staged blob and mode, or its absence) is put back as it was before; the caller
 * puts the files' working-tree content back.
 */
export function commitRolePrompts(ws: CommitContext, files: readonly string[], version: string): { ok: true; commit: { full: string; short: string } | null } | { ok: false; error: string } {
  const root = ws.projectRoot;
  const refused = (detail: string): { ok: false; error: string } => ({ ok: false, error: `git could not commit ${files.join(', ')}: ${detail}; nothing was saved` });
  // The index entry of each file before anything stages it: mode and blob, or null when it has none.
  const listed = git(root, ['ls-files', '--stage', '-z', '--', ...files]);
  if (listed.code !== 0) return refused(firstLines(listed.stderr));
  const before = new Map<string, { mode: string; sha: string } | null>(files.map((file) => [file, null]));
  for (const line of listed.stdout.split('\0').filter(Boolean)) {
    const entry = /^(\d+) ([0-9a-f]+) (\d)\t(.*)$/s.exec(line);
    if (entry === null || entry[3] !== '0') return refused(`${entry?.[4] ?? line} has unmerged entries in the index`);
    before.set(entry[4] ?? '', { mode: entry[1] ?? '', sha: entry[2] ?? '' });
  }
  const restoreIndex = (): void => {
    for (const [file, entry] of before) {
      if (entry === null) git(root, ['rm', '-q', '--cached', '-f', '--ignore-unmatch', '--', file]);
      else git(root, ['update-index', '--add', '--cacheinfo', `${entry.mode},${entry.sha},${file}`]);
    }
  };
  const failure = (detail: string): { ok: false; error: string } => {
    restoreIndex();
    return refused(detail);
  };
  try {
    const added = git(root, ['add', '--', ...files]);
    if (added.code !== 0) return failure(firstLines(added.stderr));
    const staged = stagePaths(root, files);
    if (staged.length === 0) {
      restoreIndex();
      return { ok: true, commit: null };
    }
    const result = commitWithToken(ws, { kind: 'roles', version }, ['commit', '-q', '-m', `spec: update role prompts to ${version}\n\nSpec-Roles: ${version}`, '--', ...staged]);
    if (result.code !== 0) return failure(firstLines(result.stderr || result.stdout));
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
  const full = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  const short = git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim();
  return { ok: true, commit: { full, short: short || full.slice(0, 7) } };
}

function bypassAdrPath(ws: Workspace, id: string): string {
  const spec = toPosix(relative(ws.projectRoot, ws.specRoot));
  return `${spec === '' ? '' : `${spec}/`}decisions/${id}-bypass.md`;
}

function preCommit(ws: Workspace, now: string, consumeToken = true): Out {
  if (ws.config?.enforce.commits === false) return ok('');
  const root = ws.projectRoot;
  if (currentBranch(root) !== (ws.config?.baseBranch ?? 'main')) return ok('');
  const staged = stagePaths(root);
  const changed = staged.filter(treeGovernor(ws));
  // A symlink that leaves the project is refused whatever else authorizes the commit (INS-016/R14, INV-011).
  let links: LinkIssue[] = [];
  if (changed.length > 0) {
    try {
      links = linkIssues(root, changed, indexEntries(root));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { stdout: '', stderr: `spec refused this base-branch commit: could not read the index to check symlinks under governed paths (${detail}).\n`, code: 1 };
    }
  }
  if (links.length > 0) return { stdout: '', stderr: `spec refused this base-branch commit: ${links.slice(0, 8).map(describeLink).join('; ')}.\n`, code: 1 };
  const token = consumeCommitToken(ws, staged, now, consumeToken);
  if (token) return ok('');
  const bypass = readBypass(root, now);
  if (bypass !== null && staged.includes(bypassAdrPath(ws, bypass.id))) return ok('');
  try {
    const pullIssues = pendingPullMergeIssues(ws, !consumeToken);
    if (pullIssues !== null) {
      return pullIssues.length === 0
        ? ok('')
        : { stdout: '', stderr: `spec refused this base-branch pull merge: ${pullIssues.slice(0, 8).join('; ')}.\n`, code: 1 };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { stdout: '', stderr: `spec refused this base-branch pull merge: could not validate incoming history: ${detail}.\n`, code: 1 };
  }
  if (changed.length === 0) return ok('');
  if (bypass !== null) return { stdout: '', stderr: `spec refused this base-branch commit: active bypass ${bypass.id} requires its ADR to be staged with governed paths (${changed.slice(0, 8).join(', ')}).\n`, code: 1 };
  return { stdout: '', stderr: `spec refused this base-branch commit: governed paths are staged (${changed.slice(0, 8).join(', ')}). Work through a ticket, or ask the person whether to open a bypass (\`.spec/bin/spec bypass "<reason>"\`).\n`, code: 1 };
}

function trailerFooter(message: string): string {
  return message.trimEnd().split(/\n\s*\n/).at(-1) ?? '';
}

function appendTicketTrailer(ws: Workspace, msgPath: string, ticket: string): Out {
  const root = ws.projectRoot;
  const tickets = toPosix(relative(root, ws.ticketsDir));
  const path = `${tickets}/${ticket}.md`;
  if (!PATTERNS.ticket.test(ticket) || git(root, ['cat-file', '-e', `HEAD:${path}`]).code !== 0) return ok('');
  const staged = stagePaths(root);
  if (!staged.some(treeGovernor(ws))) return ok('');
  const message = readFileSync(msgPath, 'utf8');
  if (!new RegExp(`^Spec-Ticket: ${ticket.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'm').test(trailerFooter(message))) {
    const trimmed = message.replace(/\s*$/, '');
    writeFileSync(msgPath, `${trimmed}${trimmed ? '\n\n' : ''}Spec-Ticket: ${ticket}\n`);
  }
  return ok('');
}

function appendBypassTrailer(ws: Workspace, msgPath: string, now: string): Out {
  const root = ws.projectRoot;
  const branch = currentBranch(root);
  if (branch?.startsWith('ticket/')) return appendTicketTrailer(ws, msgPath, branch.slice('ticket/'.length));
  if (ws.config?.enforce.commits === false || branch !== (ws.config?.baseBranch ?? 'main')) return ok('');
  const staged = stagePaths(root);
  if (!staged.some(treeGovernor(ws))) return ok('');
  const state = readBypass(root, now);
  if (state === null || !staged.includes(bypassAdrPath(ws, state.id))) return ok('');
  const message = readFileSync(msgPath, 'utf8');
  if (!new RegExp(`^Spec-Bypass: ${state.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(trailerFooter(message))) {
    const trimmed = message.replace(/\s*$/, '');
    writeFileSync(msgPath, `${trimmed}${trimmed ? '\n\n' : ''}Spec-Bypass: ${state.id}\n`);
  }
  cancelBypass(root);
  return ok('');
}

export function cmdGitHook(ws: Workspace, args: Args, now = new Date().toISOString()): Out {
  const [name, messagePath] = args.positionals;
  if ((name === 'pre-commit' || name === 'pre-merge-commit') && args.positionals.length === 1) return preCommit(ws, now, name === 'pre-commit');
  if (name === 'commit-msg' && messagePath) return appendBypassTrailer(ws, messagePath, now);
  return usageError('usage: spec hook git <pre-commit|pre-merge-commit|commit-msg> [<message-file>]', USAGE);
}

interface HistoryOffender {
  readonly commit: string;
  readonly subject: string;
  readonly paths: readonly string[];
  readonly reason: string;
}

function historyGit(root: string, args: readonly string[]): ReturnType<typeof git> {
  const context = activeHistoryRead?.root === root ? activeHistoryRead : null;
  const commit = args[0] === 'show' && args[1] === '-s' && (args[2] === '--format=%B' || args[2] === '--format=%s') && args[3] !== undefined
    ? historyMetadata(root, args[3])
    : args[0] === 'rev-list' && args[1] === '--parents' && args[2] === '-n' && args[3] === '1' && args[4] !== undefined
      ? historyMetadata(root, args[4])
      : null;
  const result = commit !== null
    ? args[0] === 'show'
      ? { code: 0, stdout: args[2] === '--format=%B' ? commit.message : `${commit.subject}\n`, stderr: '' }
      : { code: 0, stdout: `${commit.sha} ${commit.parents.join(' ')}\n`, stderr: '' }
    : args.length === 1 && args[0] === '--version' && context?.version !== null && context?.version !== undefined
      ? context.version
      : git(root, args);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  if (args.length === 1 && args[0] === '--version' && context !== null) context.version = result;
  return result;
}

/** A path a commit changes against its first parent, with the mode it has in the commit (000000 when removed). */
interface TouchedEntry {
  readonly path: string;
  readonly mode: string;
}

interface HistoryCommit {
  readonly sha: string;
  readonly tree: string;
  readonly parents: readonly string[];
  readonly message: string;
  subject: string;
  touched: TouchedEntry[];
  touchedLoaded: boolean;
}

interface HistoryTree {
  readonly listing: string;
  readonly entries: TreeEntries;
}

interface HistoryReadContext {
  readonly root: string;
  readonly ws: Workspace;
  readonly commits: Map<string, HistoryCommit>;
  readonly trees: Map<string, HistoryTree>;
  readonly files: Map<string, ReturnType<typeof git>>;
  readonly blobs: Map<string, ReturnType<typeof git>>;
  version: ReturnType<typeof git> | null;
}

let activeHistoryRead: HistoryReadContext | null = null;

function withHistoryRead<T>(ws: Workspace, command: () => T): T {
  if (activeHistoryRead?.root === ws.projectRoot) return command();
  const previous = activeHistoryRead;
  activeHistoryRead = {
    root: ws.projectRoot,
    ws,
    commits: new Map(),
    trees: new Map(),
    files: new Map(),
    blobs: new Map(),
    version: null,
  };
  try {
    return command();
  } finally {
    activeHistoryRead = previous;
  }
}

function gitSubject(message: string): string {
  const firstParagraph = message.split(/\r?\n[ \t]*\r?\n/, 1)[0] ?? '';
  return firstParagraph.split(/\r?\n/).join(' ').trim();
}

export function commitFromObject(sha: string, contents: Uint8Array): HistoryCommit {
  const object = Buffer.from(contents);
  const separator = object.indexOf(Buffer.from('\n\n'));
  const headerEnd = separator < 0 ? object.length : separator;
  const header = object.subarray(0, headerEnd).toString('utf8');
  const tree = /^tree ([0-9a-f]+)$/m.exec(header)?.[1];
  if (tree === undefined) throw new Error(`git could not read commit tree ${sha}`);
  const parents = [...header.matchAll(/^parent ([0-9a-f]+)$/gm)].map((match) => match[1]).filter((parent): parent is string => parent !== undefined);
  const message = separator < 0 ? '' : object.subarray(separator + 2).toString('utf8');
  return { sha, tree, parents, message, subject: gitSubject(message), touched: [], touchedLoaded: false };
}

function parseDiffTreeBatch(stdout: string, commits: readonly string[]): Map<string, TouchedEntry[]> {
  const out = new Map(commits.map((commit) => [commit, [] as TouchedEntry[]]));
  const fields = stdout.split('\0');
  let current: string | null = null;
  for (let i = 0; i < fields.length; i++) {
    const token = fields[i] ?? '';
    for (const line of token.split('\n')) {
      const header = /^(?:commit )?([0-9a-f]{40}|[0-9a-f]{64})(?: ([0-9a-f]{40}|[0-9a-f]{64}))?$/.exec(line.trim());
      if (header !== null) {
        current = header[1] ?? null;
        continue;
      }
      const raw = /^:(\d+) (\d+) [0-9a-f]+ [0-9a-f]+ [A-Z][0-9]*$/.exec(line);
      if (raw === null) continue;
      const path = fields[i + 1] ?? '';
      if (current !== null) out.get(current)?.push({ path: toPosix(path), mode: raw[2] ?? '' });
      i++;
      break;
    }
  }
  return out;
}

function historyFileKey(revision: string, path: string): string {
  return `${revision}\0${path}`;
}

function prefetchHistoryFiles(context: HistoryReadContext, commits: readonly HistoryCommit[]): void {
  const tickets = toPosix(relative(context.root, context.ws.ticketsDir));
  const spec = toPosix(relative(context.root, context.ws.specRoot));
  const decisions = spec === '' ? 'decisions' : `${spec}/decisions`;
  const requests = new Map<string, { readonly key: string; readonly object: string }>();
  const add = (revision: string, path: string): void => {
    if (path.includes('\n') || path.includes('\r')) return;
    const key = historyFileKey(revision, path);
    if (!context.files.has(key)) requests.set(key, { key, object: `${revision}:${path}` });
  };
  for (const commit of commits) {
    const ticketId = ticketTrailerId(commit.message);
    if (ticketId !== null) {
      const ticketPath = `${tickets}/${ticketId}.md`;
      add(commit.sha, ticketPath);
      for (const parent of commit.parents) add(parent, ticketPath);
    }
    const bypasses = bypassTrailerIds(commit.message);
    const rolesCommit = rolesTrailerLines(commit.message).length > 0;
    for (const entry of commit.touched) {
      if (isTicketFilePath(tickets, entry.path)) {
        add(commit.sha, entry.path);
        for (const parent of commit.parents) add(parent, entry.path);
      }
      if (rolesCommit && rolePromptOf(context.ws, entry.path) !== null) add(commit.sha, entry.path);
      if (bypasses.length > 0 && entry.path.startsWith(`${decisions}/`) && entry.path.endsWith('.md')) {
        add(commit.sha, entry.path);
        if (commit.parents[0] !== undefined) add(commit.parents[0], entry.path);
      }
    }
  }
  if (requests.size === 0) return;
  const batch = catFileBatch(context.root, [...requests.values()].map((request) => request.object));
  for (const [index, request] of [...requests.values()].entries()) {
    const object = batch.objects[index];
    if (object === undefined || (object === null && batch.code !== 0)) continue;
    context.files.set(request.key, object?.type === 'blob'
      ? { code: 0, stdout: Buffer.from(object.contents).toString('utf8'), stderr: '' }
      : { code: 1, stdout: '', stderr: '' });
  }
}

function readHistorySubjects(root: string, commits: readonly HistoryCommit[]): void {
  if (commits.length === 0) return;
  const result = gitWithInput(
    root,
    ['log', '--no-walk=unsorted', '--stdin', '--format=format:%H%x00%s%x00'],
    `${commits.map((commit) => commit.sha).join('\n')}\n`,
  );
  if (result.code === 0) {
    const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
    const fields = result.stdout.split('\0');
    for (let index = 0; index + 1 < fields.length; index += 2) {
      const sha = (fields[index] ?? '').trim();
      const subject = fields[index + 1];
      const commit = bySha.get(sha);
      if (commit !== undefined && subject !== undefined) commit.subject = subject;
    }
    return;
  }
  for (const commit of commits) {
    const shown = git(root, ['show', '-s', '--format=%s', commit.sha]);
    if (shown.code !== 0) throw new Error(shown.stderr.trim() || `git show -s --format=%s ${commit.sha} failed`);
    commit.subject = shown.stdout.trim();
  }
}

function readHistoryMetadata(root: string, shas: readonly string[]): HistoryCommit[] {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) throw new Error('history reader is not initialized');
  const missing = [...new Set(shas)].filter((sha) => !context.commits.has(sha));
  if (missing.length > 0) {
    const batch = catFileBatch(root, missing);
    if (batch.code !== 0) throw new Error(batch.stderr.trim() || 'git cat-file --batch failed');
    const loaded = missing.map((sha, index) => {
      const object = batch.objects[index];
      if (object?.type !== 'commit') throw new Error(`git could not read commit ${sha}`);
      return commitFromObject(sha, object.contents);
    });
    readHistorySubjects(root, loaded);
    for (const commit of loaded) context.commits.set(commit.sha, commit);
  }
  return shas.map((sha) => {
    const commit = context.commits.get(sha);
    if (commit === undefined) throw new Error(`git could not read commit ${sha}`);
    return commit;
  });
}

function readHistoryCommits(root: string, shas: readonly string[]): HistoryCommit[] {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) throw new Error('history reader is not initialized');
  const commits = readHistoryMetadata(root, shas);
  const pending = [...new Map(commits.map((commit) => [commit.sha, commit])).values()].filter((commit) => !commit.touchedLoaded);
  if (pending.length > 0) {
    const requests = pending.map((commit) => commit.parents[0] === undefined ? commit.sha : `${commit.sha} ${commit.parents[0]}`).join('\n');
    const diff = gitWithInput(root, ['diff-tree', '--raw', '--no-abbrev', '--no-renames', '-r', '-z', '--root', '--stdin'], `${requests}\n`);
    if (diff.code !== 0) throw new Error(diff.stderr.trim() || 'git diff-tree failed');
    const touched = parseDiffTreeBatch(diff.stdout, pending.map((commit) => commit.sha));
    for (const commit of pending) {
      commit.touched = touched.get(commit.sha) ?? [];
      commit.touchedLoaded = true;
    }
    prefetchHistoryFiles(context, pending);
  }
  return commits;
}

function historyMetadata(root: string, sha: string): HistoryCommit {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) throw new Error('history reader is not initialized');
  return readHistoryMetadata(root, [sha])[0] as HistoryCommit;
}

function historyCommitsInRange(root: string, args: readonly string[]): string[] {
  const commits = historyGit(root, args).stdout.split('\n').filter(Boolean);
  readHistoryCommits(root, commits);
  return commits;
}

function historyCommit(root: string, sha: string): HistoryCommit {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) throw new Error('history reader is not initialized');
  return readHistoryCommits(root, [sha])[0] as HistoryCommit;
}

function historyFile(root: string, revision: string, path: string): ReturnType<typeof git> {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) return git(root, ['show', `${revision}:${path}`]);
  const key = historyFileKey(revision, path);
  const saved = context.files.get(key);
  if (saved !== undefined) return saved;
  if (path.includes('\n') || path.includes('\r')) {
    const result = git(root, ['show', `${revision}:${path}`]);
    context.files.set(key, result);
    return result;
  }
  const batch = catFileBatch(root, [`${revision}:${path}`]);
  let result: ReturnType<typeof git>;
  const object = batch.objects[0];
  if (object?.type === 'blob') {
    result = { code: 0, stdout: Buffer.from(object.contents).toString('utf8'), stderr: '' };
  } else if (batch.code === 0) {
    result = { code: 1, stdout: '', stderr: '' };
  } else {
    result = git(root, ['show', `${revision}:${path}`]);
  }
  context.files.set(key, result);
  return result;
}

function historyBlob(root: string, sha: string): ReturnType<typeof git> {
  const context = activeHistoryRead;
  if (context === null || context.root !== root) return git(root, ['cat-file', 'blob', sha]);
  const saved = context.blobs.get(sha);
  if (saved !== undefined) return saved;
  const batch = catFileBatch(root, [sha]);
  const object = batch.objects[0];
  const result = object?.type === 'blob'
    ? { code: 0, stdout: Buffer.from(object.contents).toString('utf8'), stderr: '' }
    : batch.code === 0
      ? { code: 1, stdout: '', stderr: '' }
      : git(root, ['cat-file', 'blob', sha]);
  context.blobs.set(sha, result);
  return result;
}

function touchedEntries(root: string, commit: string): TouchedEntry[] {
  return historyCommit(root, commit).touched;
}

function touchedPaths(root: string, commit: string): string[] {
  return touchedEntries(root, commit).map((entry) => entry.path);
}

/** The symlinks a commit adds or changes under governed paths whose targets are refused (INS-016/R14). */
function commitLinkIssues(root: string, commit: string, governed: (rel: string) => boolean): LinkIssue[] {
  const changed = touchedEntries(root, commit).filter((entry) => entry.mode === SYMLINK_MODE && governed(entry.path)).map((entry) => entry.path);
  return changed.length === 0 ? [] : linkIssues(root, changed, commitEntries(root, commit));
}

function bypassAdrAt(root: string, commit: string, specRoot: string, id: string): { path: string | null; isNew: boolean; isBypass: boolean } {
  const specPath = toPosix(relative(root, specRoot));
  const dir = specPath === '' ? 'decisions' : `${specPath}/decisions`;
  const tree = historyTree(root, historyCommit(root, commit).tree);
  const path = [...tree.entries.entries.keys()].find((candidate) => {
    if (!candidate.startsWith(`${dir}/`)) return false;
    const name = candidate.split('/').at(-1) ?? '';
    return name === `${id}.md` || name.startsWith(`${id}-`);
  }) ?? null;
  if (path === null) return { path: null, isNew: false, isBypass: false };
  const parents = historyCommit(root, commit).parents;
  const prior = parents[0] === undefined ? { code: 1 } : historyFile(root, parents[0], path);
  const source = historyFile(root, commit, path);
  const frontmatter = /^---\s*\n([\s\S]*?)\n---(?:\n|$)/.exec(source.stdout)?.[1] ?? '';
  return { path, isNew: prior.code !== 0, isBypass: /^kind:\s*["']?bypass["']?\s*$/m.test(frontmatter) };
}

function bypassTrailerIds(message: string): string[] {
  return [...trailerFooter(message).matchAll(/^Spec-Bypass:\s*(ADR-\d{3,4})\s*$/gm)].map((m) => m[1]).filter((x): x is string => x !== undefined);
}

function ticketTrailerId(message: string): string | null {
  const ids = [...trailerFooter(message).matchAll(/^Spec-Ticket:\s*(\S+)\s*$/gm)].map((m) => m[1]).filter((x): x is string => x !== undefined);
  return ids.length === 1 ? ids[0] ?? null : null;
}

function ticketTrailerLines(message: string): string[] {
  return trailerFooter(message).split('\n').filter((line) => /^Spec-Ticket\s*:/i.test(line));
}

function rolesTrailerLines(message: string): string[] {
  return trailerFooter(message).split('\n').filter((line) => /^Spec-Roles\s*:/i.test(line));
}

/**
 * Why a `Spec-Roles: <version>` commit is not a genuine role-update commit, or null (INS-005/R5, INS-015/R6).
 * The commit's files are read as data and hashed; nothing from the commit or its history is run.
 */
function rolesCommitIssue(ws: Workspace, root: string, commit: string, message: string): string | null {
  const lines = rolesTrailerLines(message);
  const version = lines.length === 1 ? /^Spec-Roles:[ \t]*(\S+)[ \t]*$/.exec(lines[0] ?? '')?.[1] : undefined;
  if (version === undefined) return 'a commit must cite exactly one "Spec-Roles: <version>" trailer';
  if (!manifestHasVersion(version)) return `Spec-Roles ${version} is not in the shipped-prompt manifest`;
  const parents = historyCommit(root, commit).parents;
  if (parents.length !== 1) return 'Spec-Roles is valid only on a single-parent commit';
  const touched = touchedPaths(root, commit);
  if (touched.length === 0) return 'Spec-Roles commit touches no role prompt';
  for (const path of touched) {
    const role = rolePromptOf(ws, path);
    if (role === null) return `Spec-Roles commit touches ${path}, which is not a stage-role prompt`;
    const entry = historyTree(root, historyCommit(root, commit).tree).entries.entries.get(path);
    const mode = entry?.mode;
    const blob = historyFile(root, commit, path);
    if (mode === undefined || blob.code !== 0) return `Spec-Roles commit removes or replaces ${path}`;
    const issue = rolePromptIssue(path, role, version, mode, blob.stdout);
    if (issue !== null) return `Spec-Roles ${version} commit: ${issue}`;
  }
  return null;
}

interface MergeResultIssue {
  readonly path: string;
  readonly reason: string;
}

function changedPathsBetween(root: string, from: string, to: string): string[] {
  return historyGit(root, ['diff', '--name-only', '--no-renames', '-z', from, to]).stdout.split('\0').filter(Boolean).map(toPosix);
}

export function treeEntryFromListing(listing: string, path: string): string {
  return listing.split('\0').filter(Boolean)
    .filter((entry) => {
      const tab = entry.indexOf('\t');
      const name = tab < 0 ? '' : entry.slice(tab + 1);
      return name === path || name.startsWith(`${path}/`);
    })
    .map((entry) => `${entry}\0`)
    .join('');
}

function treeEntry(root: string, tree: string, path: string): string {
  if (path.startsWith(':') || path.includes('\uFFFD') || ['*', '?', '[', ']', '\\'].some((character) => path.includes(character))) return historyGit(root, ['ls-tree', '-r', '-z', tree, '--', path]).stdout;
  return treeEntryFromListing(historyTree(root, tree).listing, path);
}

function mergeResultIssues(ws: Workspace, first: string, second: string, resultTree: string): MergeResultIssue[] {
  const root = ws.projectRoot;
  const governed = treeGovernor(ws);
  const changed = changedPathsBetween(root, first, resultTree)
    .filter((path) => governed(path) && !isGenerated(ws, path));
  if (changed.length === 0) return [];

  const versionText = historyGit(root, ['--version']).stdout;
  const version = /git version (\d+)\.(\d+)(?:\.(\d+))?/i.exec(versionText);
  if (version === null) throw new Error(`could not determine Git version from ${versionText.trim() || 'empty output'}`);
  const major = Number(version[1]);
  const minor = Number(version[2]);
  const supportsMergeTree = major > 2 || (major === 2 && minor >= 38);
  if (supportsMergeTree) {
    const clean = git(root, ['merge-tree', '--write-tree', '--messages', '--name-only', '-z', first, second]);
    if (clean.code !== 0 && clean.code !== 1) throw new Error(clean.stderr.trim() || 'git merge-tree failed');
    const fields = clean.stdout.split('\0');
    const cleanTree = fields[0]?.trim() ?? '';
    if (!/^[a-f0-9]{40,64}$/i.test(cleanTree)) throw new Error('git merge-tree returned no clean result tree');
    const conflicts = new Set<string>();
    for (const field of fields.slice(1)) {
      if (field === '') break;
      conflicts.add(toPosix(field));
    }
    return changed.flatMap((path) => {
      if (conflicts.has(path)) return [{ path, reason: `merge conflict in ${path} was resolved by hand; a bypass is required` }];
      if (treeEntry(root, cleanTree, path) !== treeEntry(root, resultTree, path)) {
        return [{ path, reason: `merge result differs from the clean merge of its parents at ${path}; a bypass is required` }];
      }
      return [];
    });
  }

  const base = historyGit(root, ['merge-base', first, second]).stdout.trim();
  const firstChanged = new Set(changedPathsBetween(root, base, first));
  const secondChanged = new Set(changedPathsBetween(root, base, second));
  return changed.flatMap((path) => {
    if (firstChanged.has(path) && secondChanged.has(path)) {
      return [{ path, reason: `both parents changed ${path}; Git before 2.38 needs a bypass to verify this merge` }];
    }
    const expectedTree = secondChanged.has(path) ? second : first;
    if (treeEntry(root, expectedTree, path) !== treeEntry(root, resultTree, path)) {
      return [{ path, reason: `merge result at ${path} does not match its unchanged parent; a bypass is required` }];
    }
    return [];
  });
}

function mergeCommitIssues(ws: Workspace, root: string, commit: string, parents: readonly string[], subject: string): HistoryOffender[] {
  if (parents.length !== 2) return [];
  const first = parents[0] ?? '';
  const second = parents[1] ?? '';
  const tree = historyCommit(root, commit).tree;
  return mergeResultIssues(ws, first, second, tree).map((issue) => ({
    commit: commit.slice(0, 12),
    subject,
    paths: [issue.path],
    reason: issue.reason,
  }));
}

function ticketTrailerValidity(ws: Workspace, root: string, commit: string, paths: readonly string[], id: string, validMerges: ReadonlyMap<string, string>, sideCommit = false): { valid: boolean; reason: string } {
  const tickets = toPosix(relative(root, ws.ticketsDir));
  const ticketPath = `${tickets}/${id}.md`;
  const source = historyFile(root, commit, ticketPath);
  if (source.code !== 0) return { valid: false, reason: `Spec-Ticket references ${id}, but ${ticketPath} is absent from that commit` };
  const parsed = parseTicket(ticketPath, source.stdout).ticket;
  if (!parsed) return { valid: false, reason: `Spec-Ticket references invalid ticket file ${ticketPath}` };
  const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', commit]).stdout.trim().split(/\s+/).slice(1);
  if (sideCommit) return { valid: true, reason: '' };
  if (parents.length === 2) {
    if (parsed.data.status !== 'done') return { valid: false, reason: `Spec-Ticket ${id} is not done in the merge ticket file` };
    const firstParent = parents[0] ?? '';
    const secondParent = parents[1] ?? '';
    const second = historyFile(root, secondParent, ticketPath);
    if (second.code !== 0) return { valid: false, reason: `Spec-Ticket ${id} is absent from the second parent` };
    if (source.stdout !== second.stdout) return { valid: false, reason: `Spec-Ticket ${id} does not match the second parent's ticket file` };
    const before = historyFile(root, firstParent, ticketPath);
    const beforeTicket = before.code === 0 ? parseTicket(ticketPath, before.stdout).ticket : null;
    if (!beforeTicket) return { valid: false, reason: `Spec-Ticket ${id} was absent or invalid at the first parent` };
    if (beforeTicket.data.status === 'done') return { valid: false, reason: `Spec-Ticket ${id} was already done at the first parent` };
    return { valid: true, reason: '' };
  }
  if (parents.length === 1) {
    const merge = parents[0] ?? '';
    if (validMerges.get(merge) === id) {
      const mergeTicket = historyFile(root, merge, ticketPath);
      const mergeParsed = mergeTicket.code === 0 ? parseTicket(ticketPath, mergeTicket.stdout).ticket : null;
      if (mergeParsed?.data.status !== 'done') return { valid: false, reason: `Spec-Ticket ${id} is not done in its parent merge` };
      const changed = touchedPaths(root, commit);
      const nonGenerated = changed.filter((path) => !isGenerated(ws, path));
      if (nonGenerated.length > 0) return { valid: false, reason: `afterMerge child touches non-generated paths: ${nonGenerated.slice(0, 8).join(', ')}` };
      return { valid: true, reason: '' };
    }
    if (paths.length === 1 && paths[0] === ticketPath) return { valid: true, reason: '' };
    // A close commit touches only other tickets' files, never the cited ticket's (INS-015/R6).
    const touched = touchedPaths(root, commit);
    if (touched.length > 0 && !touched.includes(ticketPath) && touched.every((path) => isTicketFilePath(tickets, path))) {
      const issue = closeCommitIssue(root, commit, merge, id, tickets);
      return { valid: issue === null, reason: issue ?? '' };
    }
    if (paths.length > 1) {
      const issue = combineCommitIssue(ws, root, commit, merge, id);
      return { valid: issue === null, reason: issue ?? '' };
    }
    return { valid: false, reason: `Spec-Ticket ${id} is not the ticket of a verified parent merge` };
  }
  if (paths.length === 1 && paths[0] === ticketPath) return { valid: true, reason: '' };
  return { valid: false, reason: `Spec-Ticket ${id} must be a ticket-file-only commit, a completion merge, or its generated-only afterMerge child` };
}

/** INS-015/R6: a single-parent commit of ticket files only, where every ticket but the cited one is newly absorbed into it. */
function combineCommitIssue(ws: Workspace, root: string, commit: string, parent: string, id: string): string | null {
  const tickets = toPosix(relative(root, ws.ticketsDir));
  const ticketPath = `${tickets}/${id}.md`;
  const touched = touchedPaths(root, commit);
  const others = touched.filter((path) => path !== ticketPath);
  if (!touched.includes(ticketPath) || others.length === 0) return `Spec-Ticket ${id} must be a ticket-file-only commit, a completion merge, or its generated-only afterMerge child`;
  const stray = touched.filter((path) => !path.startsWith(`${tickets}/`) || !path.endsWith('.md') || !PATTERNS.ticket.test(path.slice(tickets.length + 1, -3)));
  if (stray.length > 0) return `combine commit for ${id} touches non-ticket paths: ${stray.slice(0, 8).join(', ')}`;
  for (const path of others) {
    const after = historyFile(root, commit, path);
    const afterTicket = after.code === 0 ? parseTicket(path, after.stdout).ticket : null;
    if (afterTicket?.data.status !== 'absorbed' || afterTicket.data.absorbed_into !== id) return `combine commit for ${id}: ${path} is not absorbed into ${id} in that commit`;
    const before = historyFile(root, parent, path);
    const beforeTicket = before.code === 0 ? parseTicket(path, before.stdout).ticket : null;
    if (beforeTicket?.data.status === 'absorbed') return `combine commit for ${id}: ${path} was already absorbed before that commit`;
  }
  return null;
}

const isTicketFilePath = (tickets: string, path: string): boolean => path.startsWith(`${tickets}/`) && path.endsWith('.md') && PATTERNS.ticket.test(path.slice(tickets.length + 1, -3));

/**
 * Whether `after` is `before` with exactly the characters of the status scalar replaced ("open" or "blocked" becoming
 * "absorbed"), one `absorbed_into: <id>` line inserted, and no other byte different (a comment included); and whether
 * the parsed tickets agree on every key but those two.
 */
function onlyCloseKeysChanged(before: Ticket, beforeText: string, after: Ticket, afterText: string, id: string): boolean {
  const added = `absorbed_into: ${id}`;
  const lines = afterText.split('\n');
  const textMatches = lines.some((line, at) => {
    if (line !== added) return false;
    const rest = [...lines.slice(0, at), ...lines.slice(at + 1)].join('\n');
    let i = 0;
    while (i < rest.length && i < beforeText.length && rest[i] === beforeText[i]) i++;
    const was = ['blocked', 'open'].find((value) => beforeText.startsWith(value, i));
    return was !== undefined
      && /(?:^|[\n{,])[ \t]*status:[ \t]*["']?$/.test(beforeText.slice(0, i))
      && rest.startsWith('absorbed', i)
      && rest.slice(i + 'absorbed'.length) === beforeText.slice(i + was.length);
  });
  if (!textMatches) return false;
  const other = (ticket: Ticket): Record<string, unknown> => {
    return Object.fromEntries(Object.entries(ticket.data).filter(([key]) => key !== 'status' && key !== 'absorbed_into'));
  };
  return before.data.absorbed_into === undefined && isDeepStrictEqual(other(before), other(after));
}

/**
 * INS-015/R6: a single-parent commit of ticket files only, none of them the cited one, where each was open or
 * blocked with no stage at its parent and now differs only in status "absorbed" and an added absorbed_into naming the
 * cited ticket, which is in that commit and not absorbed. The files are read as data (INV-012).
 */
function closeCommitIssue(root: string, commit: string, parent: string, id: string, tickets: string): string | null {
  const read = (rev: string, path: string): { text: string; ticket: Ticket | null } | null => {
    const shown = historyFile(root, rev, path);
    return shown.code === 0 ? { text: shown.stdout, ticket: parseTicket(path, shown.stdout).ticket } : null;
  };
  const cited = read(commit, `${tickets}/${id}.md`);
  if (cited?.ticket == null || cited.ticket.data.status === 'absorbed') return `close commit for ${id}: ${id} is missing or absorbed in that commit`;
  for (const path of touchedPaths(root, commit)) {
    const after = read(commit, path);
    if (after?.ticket?.data.status !== 'absorbed' || after.ticket.data.absorbed_into !== id) return `close commit for ${id}: ${path} is not absorbed into ${id} in that commit`;
    const before = read(parent, path);
    const status = before?.ticket?.data.status;
    if (before?.ticket == null || (status !== 'open' && status !== 'blocked') || before.ticket.data.stage !== null) {
      return `close commit for ${id}: ${path} was not open or blocked with no stage running at its parent`;
    }
    if (!onlyCloseKeysChanged(before.ticket, before.text, after.ticket, after.text, id)) return `close commit for ${id}: ${path} changes more than its status and absorbed_into`;
  }
  return null;
}

function validTrailer(ws: Workspace, root: string, commit: string, message: string, ticketValid: boolean, ticketReason: string, usedBypass: ReadonlySet<string>): { valid: boolean; reason: string } {
  const ticketLines = ticketTrailerLines(message);
  if (ticketLines.length > 0) {
    if (ticketTrailerId(message) !== null && ticketValid) return { valid: true, reason: '' };
    return { valid: false, reason: ticketReason };
  }
  const ids = bypassTrailerIds(message);
  const id = ids[0];
  if (rolesTrailerLines(message).length > 0) {
    const rolesIssue = rolesCommitIssue(ws, root, commit, message);
    if (rolesIssue === null) return { valid: true, reason: '' };
    if (ids.length === 0) return { valid: false, reason: rolesIssue };
  }
  if (ids.length === 1 && id !== undefined) {
    if (usedBypass.has(id)) return { valid: false, reason: `Spec-Bypass ${id} was already cited by an earlier first-parent commit` };
    const adr = bypassAdrAt(root, commit, ws.specRoot, id);
    if (adr.path === null) return { valid: false, reason: `Spec-Bypass references missing ${id}` };
    if (!adr.isNew) return { valid: false, reason: `Spec-Bypass ${id} was not added in this commit` };
    if (!adr.isBypass) return { valid: false, reason: `Spec-Bypass ${id} is not a bypass ADR (front matter must say kind: bypass)` };
    return { valid: true, reason: '' };
  }
  return { valid: false, reason: ids.length > 1 ? 'a commit must cite exactly one Spec-Bypass ADR' : 'missing Spec-Ticket or Spec-Bypass trailer' };
}

function ticketMergeSideOffenders(ws: Workspace, root: string, merge: string, ticketId: string, validMerges: ReadonlyMap<string, string>): HistoryOffender[] {
  const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', merge]).stdout.trim().split(/\s+/).slice(1);
  if (parents.length !== 2) return [];
  const first = parents[0] ?? '';
  const second = parents[1] ?? '';
  const sideRange = historyCommitsInRange(root, ['rev-list', '--reverse', second, `^${first}`]);
  const offenders: HistoryOffender[] = [];
  for (const sideCommit of sideRange) {
    const paths = touchedPaths(root, sideCommit).filter(treeGovernor(ws));
    if (paths.length === 0) continue;
    const message = historyGit(root, ['show', '-s', '--format=%B', sideCommit]).stdout;
    const lines = ticketTrailerLines(message);
    const sideTicket = ticketTrailerId(message);
    const validity = lines.length !== 1 || sideTicket !== ticketId
      ? { valid: false, reason: `side commit must carry exactly Spec-Ticket: ${ticketId} and cite the same ticket ${ticketId}` }
      : ticketTrailerValidity(ws, root, sideCommit, paths, ticketId, validMerges, true);
    if (!validity.valid) {
      const subject = historyGit(root, ['show', '-s', '--format=%s', sideCommit]).stdout.trim();
      offenders.push({ commit: sideCommit.slice(0, 12), subject, paths, reason: `invalid side commit: ${validity.reason}` });
    }
  }
  return offenders;
}

function validatePullSideHistory(
  ws: Workspace,
  root: string,
  firstParent: string,
  secondParent: string,
  validMerges: Map<string, string>,
  usedBypass: Set<string>,
  usedMergeTickets: Set<string>,
  covered = new Set<string>(),
): HistoryOffender[] {
  const range = historyCommitsInRange(root, ['rev-list', '--reverse', secondParent, `^${firstParent}`]);
  const mergeIssues = new Map<string, HistoryOffender[]>();
  const offenders: HistoryOffender[] = [];
  for (const commit of range) {
    const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', commit]).stdout.trim().split(/\s+/).slice(1);
    if (parents.length !== 2) continue;
    const message = historyGit(root, ['show', '-s', '--format=%B', commit]).stdout;
    const ticketId = ticketTrailerId(message);
    if (ticketId === null) continue;
    const paths = touchedPaths(root, commit).filter(treeGovernor(ws));
    let validation: { valid: boolean; reason: string };
    if (usedMergeTickets.has(ticketId)) {
      validation = { valid: false, reason: `Spec-Ticket ${ticketId} was already used by a base merge` };
    } else {
      validation = ticketTrailerValidity(ws, root, commit, paths, ticketId, validMerges);
    }
    if (!validation.valid) {
      const subject = historyGit(root, ['show', '-s', '--format=%s', commit]).stdout.trim();
      mergeIssues.set(commit, [{ commit: commit.slice(0, 12), subject, paths, reason: validation.reason }]);
      continue;
    }
    const sideIssues = ticketMergeSideOffenders(ws, root, commit, ticketId, validMerges);
    const subject = historyGit(root, ['show', '-s', '--format=%s', commit]).stdout.trim();
    const contentIssues = mergeCommitIssues(ws, root, commit, parents, subject);
    if (sideIssues.length > 0 || contentIssues.length > 0) {
      mergeIssues.set(commit, [...sideIssues, ...contentIssues]);
      continue;
    }
    usedMergeTickets.add(ticketId);
    validMerges.set(commit, ticketId);
    covered.add(commit);
    const first = parents[0] ?? '';
    const second = parents[1] ?? '';
    const nested = historyCommitsInRange(root, ['rev-list', '--reverse', second, `^${first}`]);
    for (const sideCommit of nested) covered.add(sideCommit);
  }
  for (const commit of range) {
    if (covered.has(commit)) continue;
    const paths = touchedPaths(root, commit).filter(treeGovernor(ws));
    const message = historyGit(root, ['show', '-s', '--format=%B', commit]).stdout;
    const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', commit]).stdout.trim().split(/\s+/).slice(1);
    const ticketLines = ticketTrailerLines(message);
    const ticketId = ticketTrailerId(message);
    const bypassIds = bypassTrailerIds(message);
    const subject = historyGit(root, ['show', '-s', '--format=%s', commit]).stdout.trim();
    if (parents.length === 2 && ticketId !== null) {
      const mergeOffenders = mergeIssues.get(commit);
      if (mergeOffenders) offenders.push(...mergeOffenders);
      else if (!validMerges.has(commit)) offenders.push({ commit: commit.slice(0, 12), subject, paths, reason: `Spec-Ticket ${ticketId} merge has no validated side history` });
      covered.add(commit);
      continue;
    }
    if (parents.length === 2 && ticketLines.length === 0 && bypassIds.length === 0) {
      const first = parents[0] ?? '';
      const second = parents[1] ?? '';
      const contentIssues = mergeCommitIssues(ws, root, commit, parents, subject);
      const nestedOffenders = validatePullSideHistory(ws, root, first, second, validMerges, usedBypass, usedMergeTickets, covered);
      offenders.push(...contentIssues, ...nestedOffenders);
      covered.add(commit);
      continue;
    }
    if (paths.length === 0) {
      for (const id of bypassIds) usedBypass.add(id);
      continue;
    }
    const ticketValidity = ticketId === null
      ? { valid: false, reason: 'missing Spec-Ticket trailer' }
      : ticketTrailerValidity(ws, root, commit, paths, ticketId, validMerges);
    const trailer = validTrailer(ws, root, commit, message, ticketValidity.valid, ticketValidity.reason, usedBypass);
    const contentMergeIssues = mergeCommitIssues(ws, root, commit, parents, subject);
    if (!trailer.valid) offenders.push({ commit: commit.slice(0, 12), subject, paths, reason: trailer.reason });
    if (!(trailer.valid && bypassIds.length === 1)) offenders.push(...contentMergeIssues);
    for (const id of bypassIds) usedBypass.add(id);
  }
  return offenders;
}

function priorHistoryContext(ws: Workspace): { validMerges: Map<string, string>; usedBypass: Set<string>; usedMergeTickets: Set<string> } {
  const root = ws.projectRoot;
  const since = ws.config?.enforceSince ?? null;
  // Earlier commits are only read for the IDs they cite, never re-validated: existing offenders remain
  // visible to verify-history but do not block a valid incoming pull. Incomplete history still refuses it.
  if (git(root, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true') {
    throw new Error('repository is shallow; fetch full history with fetch-depth: 0');
  }
  const args = since === null
    ? ['rev-list', '--first-parent', '--reverse', 'HEAD']
    : ['rev-list', '--first-parent', '--reverse', `${since}..HEAD`];
  const listed = git(root, args);
  if (listed.code !== 0) throw new Error(since === null ? listed.stderr.trim() || 'could not list first-parent history' : `enforceSince ${since} does not resolve`);
  const commits = listed.stdout.split('\n').filter(Boolean);
  readHistoryMetadata(root, commits);
  const validMerges = new Map<string, string>();
  const usedBypass = new Set<string>();
  const usedMergeTickets = new Set<string>();
  for (const commit of commits) {
    const message = historyGit(root, ['show', '-s', '--format=%B', commit]).stdout;
    for (const id of bypassTrailerIds(message)) usedBypass.add(id);
    const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', commit]).stdout.trim().split(/\s+/).slice(1);
    const ticketId = ticketTrailerId(message);
    if (parents.length === 2 && ticketId !== null) {
      validMerges.set(commit, ticketId);
      usedMergeTickets.add(ticketId);
    }
  }
  return { validMerges, usedBypass, usedMergeTickets };
}

function pendingPullMergeIssues(ws: Workspace, allowFetchHeadFallback = false): string[] | null {
  return withHistoryRead(ws, () => pendingPullMergeIssuesWithHistoryRead(ws, allowFetchHeadFallback));
}

function pendingPullMergeIssuesWithHistoryRead(ws: Workspace, allowFetchHeadFallback: boolean): string[] | null {
  const root = ws.projectRoot;
  const mergeHead = git(root, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
  const messagePath = git(root, ['rev-parse', '--git-path', 'MERGE_MSG']);
  let message = '';
  if (messagePath.code === 0) {
    const messageFile = resolve(root, messagePath.stdout.trim());
    if (existsSync(messageFile)) message = readFileSync(messageFile, 'utf8');
    else if (mergeHead.code === 0) throw new Error('pending merge message is missing');
  } else if (mergeHead.code === 0) {
    throw new Error(messagePath.stderr.trim() || 'could not locate the pending merge message');
  } else if (!allowFetchHeadFallback) {
    return null;
  }
  if (mergeHead.code !== 0 && message === '' && !allowFetchHeadFallback) return null;
  if (/^Spec-(?:Ticket|Bypass)\s*:/im.test(trailerFooter(message))) return null;
  const second = mergeHead.code === 0
    ? mergeHead.stdout.trim()
    : allowFetchHeadFallback
      ? git(root, ['rev-parse', '--verify', '--quiet', 'FETCH_HEAD']).stdout.trim()
      : '';
  if (!second) return null;
  const resultTree = git(root, ['write-tree']);
  if (resultTree.code !== 0) throw new Error(resultTree.stderr.trim() || 'could not read the pending merge index');
  const first = historyGit(root, ['rev-parse', 'HEAD']).stdout.trim();
  const context = priorHistoryContext(ws);
  const side = validatePullSideHistory(ws, root, first, second, context.validMerges, context.usedBypass, context.usedMergeTickets);
  const result = mergeResultIssues(ws, first, second, resultTree.stdout.trim());
  return [...side.map((entry) => entry.reason), ...result.map((entry) => entry.reason)];
}

export function verifyHistory(ws: Workspace, sinceArg: string | null, baseArg: string | null = null): { since: string | null; base: string; scanned: number; offenders: HistoryOffender[]; error?: string } {
  return withHistoryRead(ws, () => verifyHistoryWithHistoryRead(ws, sinceArg, baseArg));
}

function verifyHistoryWithHistoryRead(ws: Workspace, sinceArg: string | null, baseArg: string | null): { since: string | null; base: string; scanned: number; offenders: HistoryOffender[]; error?: string } {
  const root = ws.projectRoot;
  const configuredBase = ws.config?.baseBranch ?? 'main';
  const candidates = baseArg !== null
    ? [{ name: baseArg, ref: `${baseArg}^{commit}` }]
    : [
      { name: configuredBase, ref: `refs/heads/${configuredBase}` },
      { name: `origin/${configuredBase}`, ref: `refs/remotes/origin/${configuredBase}` },
      { name: 'HEAD', ref: 'HEAD' },
    ];
  let base = candidates.at(-1)?.name ?? 'HEAD';
  let baseSha: string | null = null;
  for (const candidate of candidates) {
    const resolved = git(root, ['rev-parse', '--verify', candidate.ref]);
    if (resolved.code === 0) {
      base = candidate.name;
      baseSha = resolved.stdout.trim();
      break;
    }
  }
  const since = sinceArg ?? ws.config?.enforceSince ?? null;
  if (baseSha === null) return { since, base, scanned: 0, offenders: [], error: `base ref ${base} does not exist` };
  if (git(root, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true') {
    return { since, base, scanned: 0, offenders: [], error: 'repository is shallow; fetch full history with fetch-depth: 0 before running spec verify-history' };
  }
  const revArgs = since === null
    ? ['rev-list', '--first-parent', '--reverse', baseSha]
    : ['rev-list', '--first-parent', '--reverse', `${since}..${baseSha}`];
  const revisions = git(root, revArgs);
  if (revisions.code !== 0) return { since, base, scanned: 0, offenders: [], error: `invalid --since ref ${since}` };
  const offenders: HistoryOffender[] = [];
  const usedBypass = new Set<string>();
  const usedMergeTickets = new Set<string>();
  const validMerges = new Map<string, string>();
  const commits = revisions.stdout.split('\n').filter(Boolean);
  const governed = treeGovernor(ws);
  try {
    const ancestry = git(root, ['rev-list', '--reverse', baseSha]);
    if (ancestry.code === 0) {
      try {
        readHistoryCommits(root, ancestry.stdout.split('\n').filter(Boolean));
      } catch {
        readHistoryCommits(root, commits);
      }
    } else {
      readHistoryCommits(root, commits);
    }
    for (const commit of commits) {
      const message = historyGit(root, ['show', '-s', '--format=%B', commit]).stdout;
      const citedBypass = bypassTrailerIds(message);
      const paths = touchedPaths(root, commit).filter(governed);
      const parents = historyGit(root, ['rev-list', '--parents', '-n', '1', commit]).stdout.trim().split(/\s+/).slice(1);
      const ticketId = ticketTrailerId(message);
      const subject = historyGit(root, ['show', '-s', '--format=%s', commit]).stdout.trim();
      // A symlink under a governed path that leaves the project is listed whatever the trailer (INS-016/R14, INV-011).
      const links = commitLinkIssues(root, commit, governed);
      if (links.length > 0) {
        offenders.push({ commit: commit.slice(0, 12), subject, paths: links.map((link) => link.path), reason: links.map(describeLink).join('; ') });
        for (const id of citedBypass) usedBypass.add(id);
        if (parents.length === 2 && ticketId !== null) usedMergeTickets.add(ticketId);
        continue;
      }
      if (parents.length === 2 && ticketTrailerLines(message).length === 0 && citedBypass.length === 0) {
        const contentIssues = mergeCommitIssues(ws, root, commit, parents, subject);
        const pullOffenders = validatePullSideHistory(ws, root, parents[0] ?? '', parents[1] ?? '', validMerges, usedBypass, usedMergeTickets);
        offenders.push(...contentIssues, ...pullOffenders);
        continue;
      }
      const duplicateMergeTicket = parents.length === 2 && ticketId !== null && usedMergeTickets.has(ticketId);
      if (parents.length === 2 && ticketId !== null) usedMergeTickets.add(ticketId);
      if (paths.length === 0 && parents.length !== 2) {
        for (const id of citedBypass) usedBypass.add(id);
        continue;
      }
      const ticketValidity = ticketId === null
        ? { valid: false, reason: 'missing Spec-Ticket trailer' }
        : duplicateMergeTicket
          ? { valid: false, reason: `Spec-Ticket ${ticketId} was already used by a base merge` }
          : ticketTrailerValidity(ws, root, commit, paths, ticketId, validMerges);
      const trailer = validTrailer(ws, root, commit, message, ticketValidity.valid, ticketValidity.reason, usedBypass);
      const bypassAuthorized = trailer.valid && ticketTrailerLines(message).length === 0 && citedBypass.length === 1;
      const contentIssues = bypassAuthorized ? [] : mergeCommitIssues(ws, root, commit, parents, subject);
      if (trailer.valid) {
        let sideOffenders: HistoryOffender[] = [];
        if (parents.length === 2 && ticketId !== null) {
          sideOffenders = ticketMergeSideOffenders(ws, root, commit, ticketId, validMerges);
        }
        offenders.push(...contentIssues, ...sideOffenders);
        if (parents.length === 2 && ticketId !== null && contentIssues.length === 0 && sideOffenders.length === 0) validMerges.set(commit, ticketId);
        for (const id of citedBypass) usedBypass.add(id);
        continue;
      }
      for (const id of citedBypass) usedBypass.add(id);
      offenders.push(...contentIssues, { commit: commit.slice(0, 12), subject, paths, reason: trailer.reason });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { since, base, scanned: commits.length, offenders, error: `history scan failed: ${detail}` };
  }
  return { since, base, scanned: commits.length, offenders };
}

export function cmdVerifyHistory(ws: Workspace, args: Args): Out {
  if (args.positionals.length > 0) return usageError('usage: spec verify-history [--since <ref>] [--base <ref>] [--format json]', USAGE);
  if (ws.config?.enforce.history === false) return args.format === 'json' ? json({ enabled: false, offenders: [] }) : ok('history enforcement disabled\n');
  const result = verifyHistory(ws, args.since, args.base);
  if (result.error) return args.format === 'json' ? json(result, 1) : { stdout: '', stderr: `spec verify-history: ${result.error}\n`, code: 1 };
  const code = result.offenders.length > 0 ? 1 : 0;
  if (args.format === 'json') return json(result, code);
  if (result.offenders.length === 0) return ok(`history clean (${String(result.scanned)} first-parent commits checked on ${result.base})\n`);
  return ok(`${result.offenders.length} history violation${result.offenders.length === 1 ? '' : 's'}:\n${result.offenders.map((x) => `- ${x.commit} ${x.subject}: ${x.reason} (${x.paths.join(', ')})`).join('\n')}\n`, 1);
}

export function cmdBypass(ws: Workspace, args: Args, env: Readonly<Record<string, string | undefined>>, now = new Date().toISOString()): Out {
  if (args.bypassStatus && args.bypassCancel) return usageError('use either --status or --cancel', USAGE);
  if (args.bypassStatus) {
    const state = bypassStatus(ws.projectRoot, now);
    return args.format === 'json' ? json(state) : ok(state.active ? `bypass active: ${state.id} · ${state.reason} · expires ${state.expiresAt}\n` : 'no active bypass\n');
  }
  if (args.bypassCancel) {
    const cancelled = cancelBypass(ws.projectRoot, true);
    return args.format === 'json' ? json({ cancelled }) : ok(cancelled ? 'bypass cancelled\n' : 'no active bypass\n');
  }
  if (args.positionals.length !== 1) return usageError('usage: spec bypass "<reason>" | --status | --cancel', USAGE);
  const user = git(ws.projectRoot, ['config', '--get', 'user.name']).stdout.trim() || 'unknown';
  const agent = env.ASTRO_HOOK !== undefined || env.ASTRO_RUN_ID !== undefined
    ? 'Astro'
    : env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT !== undefined
      ? 'Claude Code'
      : process.stdin.isTTY ? null : 'non-interactive';
  const result = openBypass(ws, args.positionals[0] ?? '', now, { user, agent, approved: args.approvedByPerson });
  if (!result.ok) return { stdout: '', stderr: `${result.error}\n`, code: 1 };
  return args.format === 'json' ? json({ active: true, id: result.id, reason: args.positionals[0], expiresAt: new Date(Date.parse(now) + BYPASS_TTL_MS).toISOString() }) : ok(`bypass ${result.id} active for one commit or one hour\n`);
}

export { BYPASS_TTL_MS };
