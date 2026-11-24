// spec init <repo> --name <project>: installs the project spec, pinned CLI and Claude settings.
import { copyFileSync, chmodSync, existsSync, linkSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { lineDiff } from '../core/diff';
import { parseConfig } from '../core/parse/tickets';
import { expandRole } from '../core/roles';
import { ROLES } from '../core/schemas';
import { toPosix } from '../io/fs';
import { ASSETS } from '../generated/assets';
import { loadWorkspace } from '../io/workspace';
import { currentBranch, git, isRepo } from '../io/git';
import { resolveProjectRoot } from '../io/root';
import { type CommitContext, commitRolePrompts, installGitHooks, writeProjectMarker } from './enforcement';
import { type Args, USAGE } from './args';
import { writeGenerated } from './commands';
import { type Out, json, ok, usageError } from './output';
import { afterMergeUpgradeNote } from './config-warnings';
import { migrateLegacyInstall, migrateLegacyOverseerPrompt } from './legacy-install';
import { defaultsForStack, detectStacks, STACK_NAMES, type StackInfo } from './stacks';
import { VERSION } from './version';

const asset = (path: string): string => ASSETS[path] ?? '';

/** The settings file when it was kept as it is: its reason is the whole skip line. */
const SETTINGS_KEPT = '.claude/settings.json (spec permissions and plugin state already present)';

/** The plugin ID in the happyface marketplace, and the ID older projects enabled (INS-003/R7). */
const PLUGIN_ID = 'spec@happyface';
const LEGACY_PLUGIN_ID = 'spec@spec';
/** The marketplace init and upgrade register, with no `autoUpdate` key (INS-003/R6). */
const MARKETPLACE_NAME = 'happyface';
const HAPPYFACE_MARKETPLACE = { source: { source: 'github', repo: 'happyfacedev/happyface-plugins' } };

interface Plan {
  written: string[];
  skipped: string[];
  notes: string[];
}

const SPEC_GUIDANCE = [
  '<!-- spec:begin -->',
  'This repository is run by spec: every change to behaviour, spec or tests goes through a ticket.',
  'New behaviour /spec:feature, changed behaviour /spec:change, broken behaviour /spec:bug; questions about the spec: /spec:brief <words>.',
  'Run `.spec/bin/spec queue` for the full queue.',
  '<!-- spec:end -->',
].join('\n');

function updateGuidance(repo: string, path: string, plan: Plan): void {
  const abs = join(repo, path);
  const have = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  const start = have.indexOf('<!-- spec:begin -->');
  const end = have.indexOf('<!-- spec:end -->');
  let next: string;
  if (start >= 0 && end >= start) {
    const endAt = end + '<!-- spec:end -->'.length;
    next = have.slice(0, start) + SPEC_GUIDANCE + have.slice(endAt);
  } else {
    if (start >= 0 || end >= 0) {
      plan.notes.push(`${path} has an unmatched spec guidance marker; left it unchanged`);
      return;
    }
    next = `${have.replace(/\n*$/, '')}${have ? '\n\n' : ''}${SPEC_GUIDANCE}\n`;
  }
  if (next === have) {
    plan.skipped.push(`${path} (spec guidance)`);
    return;
  }
  writeFileSync(abs, next);
  plan.written.push(`${path} (spec guidance)`);
}

function ensureGuidance(repo: string, plan: Plan): void {
  updateGuidance(repo, 'CLAUDE.md', plan);
  updateGuidance(repo, 'AGENTS.md', plan);
}

function ensureEnforceSince(repo: string, configPath: string, plan: Plan): void {
  if (!isRepo(repo) || !existsSync(configPath)) return;
  let config: Record<string, unknown>;
  let text: string;
  try {
    text = readFileSync(configPath, 'utf8');
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    config = parsed as Record<string, unknown>;
  } catch {
    return;
  }
  if (typeof config.enforceSince === 'string' && config.enforceSince.length > 0) return;
  const head = git(repo, ['rev-parse', 'HEAD']);
  if (head.code !== 0) return;
  const value = JSON.stringify(head.stdout.trim());
  const property = /^([ \t]*"enforceSince"[ \t]*:[ \t]*)(?:"(?:\\.|[^"\\])*"|null|true|false|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/m;
  let next: string;
  if (property.test(text)) {
    next = text.replace(property, (_line, prefix: string) => prefix + value);
  } else {
    const close = text.lastIndexOf('}');
    if (close < 0) return;
    const before = text.slice(0, close);
    const hasProperties = Object.keys(config).length > 0;
    if (!text.includes('\n')) {
      const trimmed = before.trimEnd();
      const trailing = before.slice(trimmed.length);
      next = `${trimmed}${hasProperties ? ', ' : ''}"enforceSince": ${value}${trailing}${text.slice(close)}`;
    } else {
      const newline = text.includes('\r\n') ? '\r\n' : '\n';
      const trimmed = before.trimEnd();
      const closeLineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) + 1;
      const closeIndent = before.slice(closeLineStart).match(/^[ \t]*/)?.[0] ?? '';
      const childIndent = /(?:^|\r?\n)([ \t]+)"[^"\n]+"[ \t]*:/.exec(text)?.[1] ?? `${closeIndent}  `;
      next = `${trimmed}${hasProperties ? ',' : ''}${newline}${childIndent}"enforceSince": ${value}${newline}${closeIndent}${text.slice(close)}`;
    }
  }
  writeFileSync(configPath, next);
  if (!plan.written.includes('spec/config.json')) plan.written.push(`${toPosix(relative(repo, configPath))} (enforceSince initialized)`);
}

function put(repo: string, path: string, text: string, plan: Plan, mode?: number): void {
  const abs = join(repo, path);
  if (existsSync(abs)) {
    plan.skipped.push(path);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  if (mode !== undefined) chmodSync(abs, mode);
  plan.written.push(path);
}

function worktreeParent(repo: string): string | null {
  const topResult = git(repo, ['rev-parse', '--show-toplevel']);
  if (topResult.code !== 0) return null;
  const top = topResult.stdout.trim();
  const project = realpathSync(repo);
  const configPath = join(repo, 'spec/config.json');
  const config = existsSync(configPath) ? parseConfig('config.json', readFileSync(configPath, 'utf8')).config : null;
  const parent = config?.worktrees
    ? resolve(project, config.worktrees)
    : join(dirname(top), basename(top) + '.worktrees');
  return toPosix(relative(project, parent)) || '.';
}

function stackPermissionRules(stacks: readonly StackInfo[]): string[] {
  const rules = new Set<string>();
  for (const stack of stacks) {
    if (stack.name === 'flutter') {
      rules.add('Bash(flutter test *)');
      rules.add('Bash(flutter analyze*)');
      rules.add('Bash(dart run build_runner *)');
    } else if (stack.name === 'dart') {
      rules.add('Bash(dart test *)');
      rules.add('Bash(dart analyze*)');
      rules.add('Bash(dart run build_runner *)');
    } else if (stack.name === 'node') {
      if (stack.testCommand.includes('vitest')) rules.add('Bash(npx vitest *)');
      if (stack.testCommand.includes('jest')) rules.add('Bash(npx jest *)');
    } else if (stack.name === 'python') rules.add('Bash(pytest *)');
    else if (stack.name === 'go') rules.add('Bash(go test *)');
    else if (stack.name === 'rust') rules.add('Bash(cargo test *)');
  }
  return [...rules];
}

/** Merges project-local CLI, plugin, stack and ticket-worktree permissions without removing existing settings. */
function mergeSettings(repo: string, plan: Plan, selectedStack?: StackInfo | null): void {
  const path = '.claude/settings.json';
  const abs = join(repo, path);
  let settings: Record<string, unknown> = {};
  if (existsSync(abs)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(abs, 'utf8'));
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      settings = parsed as Record<string, unknown>;
    } catch {
      plan.notes.push(path + ' is not a JSON object; add the spec permissions and enabledPlugins entry by hand');
      return;
    }
  }
  if (settings.permissions !== undefined && (!settings.permissions || typeof settings.permissions !== 'object' || Array.isArray(settings.permissions))) {
    plan.notes.push(path + ' permissions is not an object; add the spec permissions by hand');
    return;
  }
  if (settings.enabledPlugins !== undefined && (!settings.enabledPlugins || typeof settings.enabledPlugins !== 'object' || Array.isArray(settings.enabledPlugins))) {
    plan.notes.push(path + ' enabledPlugins is not an object; enable spec by hand');
    return;
  }
  if (settings.extraKnownMarketplaces !== undefined && (!settings.extraKnownMarketplaces || typeof settings.extraKnownMarketplaces !== 'object' || Array.isArray(settings.extraKnownMarketplaces))) {
    plan.notes.push(path + ' extraKnownMarketplaces is not an object; add the happyface marketplace by hand');
    return;
  }
  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  if (permissions.allow !== undefined && !Array.isArray(permissions.allow)) {
    plan.notes.push(path + ' permissions.allow is not an array; add the spec permissions by hand');
    return;
  }
  const allow: unknown[] = Array.isArray(permissions.allow) ? [...(permissions.allow as unknown[])] : [];
  const stacks = [...detectStacks(repo), ...(selectedStack ? [selectedStack] : [])];
  const rules = [
    'Bash(.spec/bin/spec *)',
    'Bash(./.spec/bin/spec *)',
    'Skill(spec:brief)',
    'Skill',
    ...stackPermissionRules(stacks),
  ];
  let added = 0;
  for (const rule of rules) {
    if (!allow.includes(rule)) {
      allow.push(rule);
      added++;
    }
  }
  // spec@spec moves to spec@happyface, whose own value always wins (INS-003/R7).
  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, unknown>;
  const nextEnabledPlugins: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(enabledPlugins)) {
    if (id === LEGACY_PLUGIN_ID) {
      if (!Object.hasOwn(enabledPlugins, PLUGIN_ID)) nextEnabledPlugins[PLUGIN_ID] = value;
    } else nextEnabledPlugins[id] = value;
  }
  if (Object.hasOwn(enabledPlugins, LEGACY_PLUGIN_ID)) added++;
  else if (!Object.hasOwn(enabledPlugins, PLUGIN_ID)) {
    nextEnabledPlugins[PLUGIN_ID] = true;
    added++;
  }
  // The happyface marketplace is added only when no entry of that name exists (INS-003/R6, INV-018).
  const marketplaces = (settings.extraKnownMarketplaces ?? {}) as Record<string, unknown>;
  if (!Object.hasOwn(marketplaces, MARKETPLACE_NAME)) added++;
  if (added === 0) {
    plan.skipped.push(SETTINGS_KEPT);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  const nextSettings = {
    ...settings,
    permissions: {
      ...permissions,
      allow,
    },
    enabledPlugins: nextEnabledPlugins,
    extraKnownMarketplaces: Object.hasOwn(marketplaces, MARKETPLACE_NAME) ? marketplaces : { ...marketplaces, [MARKETPLACE_NAME]: HAPPYFACE_MARKETPLACE },
  };
  writeFileSync(abs, JSON.stringify(nextSettings, null, 2) + '\n');
  plan.written.push(path + ' (permissions and plugin merged)');
}

function readSettingsForAcceptEdits(repo: string, path: string): { settings: Record<string, unknown> | null; mode?: unknown; error?: string } {
  const abs = join(repo, path);
  if (!existsSync(abs)) return { settings: {} };
  try {
    const parsed: unknown = JSON.parse(readFileSync(abs, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { settings: null, error: 'is not a JSON object' };
    const settings = parsed as Record<string, unknown>;
    if (settings.permissions !== undefined && (!settings.permissions || typeof settings.permissions !== 'object' || Array.isArray(settings.permissions))) {
      return { settings: null, error: 'permissions is not an object' };
    }
    const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
    return Object.hasOwn(permissions, 'defaultMode') ? { settings, mode: permissions.defaultMode } : { settings };
  } catch {
    return { settings: null, error: 'is not valid JSON' };
  }
}

function acceptEditsConflict(repo: string): string | null {
  for (const path of ['.claude/settings.json', '.claude/settings.local.json']) {
    const result = readSettingsForAcceptEdits(repo, path);
    if (result.error) return `cannot enable background edits: ${path} ${result.error}; review it and rerun init`;
    if (result.mode !== undefined && result.mode !== 'acceptEdits') {
      return `cannot enable background edits: ${path} has permissions.defaultMode ${JSON.stringify(result.mode)}; it was left unchanged. Review that preference and rerun init --accept-edits if you want to replace it`;
    }
  }
  return null;
}

/**
 * The person's own `.claude/settings.local.json` (INS-003/R5): this checkout's worktree parent, and with --accept-edits
 * the default mode. The committed settings are never touched here. The root `.gitignore` ignores the file.
 */
function writePersonalSettings(repo: string, plan: Plan, acceptEdits: boolean): void {
  const path = '.claude/settings.local.json';
  const abs = join(repo, path);
  const worktree = worktreeParent(repo);
  if (!acceptEdits && worktree === null) return;
  const result = readSettingsForAcceptEdits(repo, path);
  if (result.settings === null) {
    plan.notes.push(`${path} ${result.error ?? 'is not a JSON object'}${worktree ? `; add '${worktree}' to permissions.additionalDirectories by hand` : ''}`);
  } else {
    const settings = result.settings;
    const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = { ...permissions };
    if (acceptEdits && result.mode !== 'acceptEdits') {
      next.defaultMode = 'acceptEdits';
      changed = true;
    }
    if (worktree) {
      if (permissions.additionalDirectories !== undefined && !Array.isArray(permissions.additionalDirectories)) {
        plan.notes.push(`${path} permissions.additionalDirectories is not an array; add '${worktree}' by hand`);
      } else {
        const directories: unknown[] = Array.isArray(permissions.additionalDirectories) ? [...(permissions.additionalDirectories as unknown[])] : [];
        if (!directories.includes(worktree)) {
          directories.push(worktree);
          next.additionalDirectories = directories;
          changed = true;
        }
      }
    }
    if (changed) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, JSON.stringify({ ...settings, permissions: next }, null, 2) + '\n');
      plan.written.push(path + ' (personal permissions merged)');
    }
  }
  const ignorePath = '.gitignore';
  const ignoreAbs = join(repo, ignorePath);
  const ignore = existsSync(ignoreAbs) ? readFileSync(ignoreAbs, 'utf8') : '';
  const ignoredPath = '.claude/settings.local.json';
  if (!ignore.split(/\r?\n/).includes(ignoredPath)) {
    const separator = ignore.length > 0 && !/[\r\n]$/.test(ignore) ? '\n' : '';
    writeFileSync(ignoreAbs, `${ignore}${separator}${ignoredPath}\n`);
    plan.written.push(ignorePath + ' (ignored personal Claude settings)');
  }
}

/** Every non-blank line of `have` that is not a line of `shipped`, in file order (INS-005/R3). */
function extraLines(have: string, shipped: string): string[] {
  const known = new Set(shipped.split(/\r?\n/));
  return have.split(/\r?\n/).filter((line) => line.trim() !== '' && !known.has(line));
}

/**
 * Commits the role prompts just written when the repository is on its base branch (INS-005/R5).
 * Null when nothing is committed (no git, another branch, nothing differing from HEAD).
 */
function commitWrittenRoles(repo: string, written: readonly string[], context: CommitContext | null): { commit: { full: string; short: string } | null } | { error: string } {
  if (written.length === 0 || context === null) return { commit: null };
  const result = commitRolePrompts(context, written, VERSION);
  return result.ok ? { commit: result.commit } : { error: result.error };
}

/**
 * What committing the role prompts needs, from the config alone: no spec file is loaded, so no `.local.md` is
 * read (INS-005/R4). Null when nothing is to be committed: outside git, or off the base branch.
 */
function roleCommitContext(repo: string): CommitContext | null {
  if (!isRepo(repo)) return null;
  const specRoot = join(repo, 'spec');
  const configPath = join(specRoot, 'config.json');
  const config = existsSync(configPath) ? parseConfig('config.json', readFileSync(configPath, 'utf8')).config : null;
  if (currentBranch(repo) !== (config?.baseBranch ?? 'main')) return null;
  const projectRoot = resolveProjectRoot(specRoot, config?.projectRoot);
  return { specRoot, projectRoot, ticketsDir: join(projectRoot, 'tickets'), config };
}

/**
 * init --update-roles: each installed role prompt against this version's, as a diff. Nothing is
 * written without --yes, since a project may have tuned its prompts (X66). With --yes, the role
 * files are replaced and, on the base branch, committed. A `.local.md` is never read or touched (INS-005/R4).
 */
function updateRoles(repo: string, yes: boolean, format: Args['format']): Out {
  const migration = migrateLegacyOverseerPrompt(repo);
  const specDir = 'spec';
  const shared = asset('roles/_shared.md');
  const changes: { role: string; path: string; next: string; diff: string[]; extra: string[]; before: string | null }[] = [];
  const wanted = [
    ...[...ROLES].sort().flatMap((role) => {
      const next = expandRole(asset(`roles/${role}.md`), shared);
      return next ? [{ role, path: `${specDir}/roles/${role}.md`, next }] : [];
    }),
  ];
  for (const w of wanted) {
    const abs = join(repo, w.path);
    const have = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (have !== w.next) changes.push({ ...w, diff: lineDiff(have ?? '', w.next), extra: have === null ? [] : extraLines(have, w.next), before: have });
  }
  const written: string[] = [];
  let committed: { full: string; short: string } | null = null;
  if (yes) {
    // Everything that can throw before the first write is done first.
    const context = changes.length > 0 ? roleCommitContext(repo) : null;
    const putBack = (): void => {
      for (const c of changes) {
        if (c.before === null) rmSync(join(repo, c.path), { force: true });
        else writeFileSync(join(repo, c.path), c.before);
      }
    };
    try {
      for (const c of changes) {
        mkdirSync(dirname(join(repo, c.path)), { recursive: true });
        writeFileSync(join(repo, c.path), c.next);
        written.push(c.path);
      }
      const result = commitWrittenRoles(repo, written, context);
      if ('error' in result) {
        putBack();
        return { stdout: '', stderr: `${result.error}\n`, code: 1 };
      }
      committed = result.commit;
    } catch (error) {
      putBack();
      throw error;
    }
  }
  const code = changes.length > 0 && !yes ? 1 : 0;
  if (format === 'json') {
    return json({ changed: changes.map((c) => ({ role: c.role, path: c.path, diff: c.diff, extra: c.extra })), written, removed: migration.removed, keptEdited: migration.keptEdited, ...(committed ? { commit: committed.full } : {}) }, code);
  }
  if (changes.length === 0 && migration.removed.length === 0 && migration.keptEdited.length === 0) return ok('role prompts are up to date\n');
  const notices = [...migration.removed.map((path) => `removed ${path}`), ...migration.keptEdited.map((path) => `kept (edited): ${path}`)];
  const lacking = (c: (typeof changes)[number]): string =>
    yes || c.extra.length === 0
      ? ''
      : `\n${c.path} has lines this version's prompt lacks:\n${c.extra.map((line) => `  ${line}`).join('\n')}\nProject additions belong in ${specDir}/roles/${c.role}.local.md, written by you: spec next adds it after the shipped prompt, and --yes replaces these lines.`;
  const parts = [...notices, ...changes.map((c) => `--- ${c.path}\n${c.diff.join('\n')}${lacking(c)}`)];
  if (changes.length === 0) return ok(`${parts.join('\n')}\n`, code);
  const tail = yes
    ? `\n${written.map((w) => `wrote ${w}`).join('\n')}\n${committed ? `committed the role prompts as ${committed.short}\n` : ''}`
    : `\n${changes.length === 1 ? '1 role prompt differs' : `${changes.length} role prompts differ`}. Run again with --yes to replace them; edits made to these files in this project would be lost.\n`;
  return ok(`${parts.join('\n\n')}\n${tail}`, code);
}

function installedVersion(repo: string, launcher: string): string | null {
  if (!existsSync(launcher)) return null;
  const result = spawnSync(process.execPath, [launcher, '--version'], { cwd: repo, encoding: 'utf8', timeout: 10_000 });
  if (result.error || result.status !== 0) return null;
  return /^spec (\S+)$/.exec(result.stdout.trim())?.[1] ?? null;
}

function compareVersions(left: string, right: string): number | null {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value);
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

function isTargetProjectLauncher(path: string, cwd: string, repo: string): boolean {
  const typed = resolve(cwd, path);
  if (basename(typed) !== 'spec' || basename(dirname(typed)) !== 'bin' || basename(dirname(dirname(typed))) !== '.spec') return false;
  const owner = resolve(dirname(dirname(dirname(typed))));
  return owner === resolve(repo);
}

function sourceDirectory(path: string): string | null {
  const absolute = resolve(path);
  for (const candidate of [absolute, join(absolute, 'scripts')]) {
    if (existsSync(join(candidate, 'spec')) && existsSync(join(candidate, 'spec.cjs'))) return candidate;
  }
  return null;
}

function installedPluginPaths(home: string | undefined, projectRoot: string): string[] {
  if (!home) return [];
  const file = join(home, '.claude/plugins/installed_plugins.json');
  if (!existsSync(file)) return [];
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const plugins = (value as Record<string, unknown>).plugins;
    if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) return [];
    const flatten = (entry: unknown): Record<string, unknown>[] => {
      if (Array.isArray(entry)) return entry.flatMap(flatten);
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.installPath === 'string') return [item];
      return Object.values(item).flatMap(flatten);
    };
    const canonicalPath = (path: string): string => {
      const absolute = resolve(path);
      try {
        return realpathSync(absolute);
      } catch {
        return absolute;
      }
    };
    const root = canonicalPath(projectRoot);
    const eligible = (id: string): Record<string, unknown>[] =>
      flatten((plugins as Record<string, unknown>)[id]).filter((entry) =>
        entry.scope === 'user' || (typeof entry.projectPath === 'string' && canonicalPath(entry.projectPath) === root),
      );
    // spec@happyface entries; spec@spec only when no spec@happyface entry is eligible (INS-014/R15).
    const preferred = eligible(PLUGIN_ID);
    const entries = preferred.length > 0 ? preferred : eligible(LEGACY_PLUGIN_ID);
    const timestamp = (value: unknown): number | null => {
      if (typeof value !== 'string') return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const updatedAt = (entry: Record<string, unknown>): number =>
      timestamp(entry.lastUpdated) ?? timestamp(entry.installedAt) ?? 0;
    entries.sort((a, b) => updatedAt(b) - updatedAt(a));
    return entries.map((entry) => {
      const path = entry.installPath as string;
      return path.startsWith('~') ? join(home, path.slice(1).replace(/^[/\\\\]/, '')) : path;
    });
  } catch {
    return [];
  }
}

interface UpgradeSource {
  readonly dir: string;
  readonly version: string;
}
type UpgradeSourceResult = { source: UpgradeSource } | { error: string } | null;

function upgradeSource(args: Args, cwd: string, scriptPath: string | undefined, env: Readonly<Record<string, string | undefined>>, repo: string): UpgradeSourceResult {
  const candidates: string[] = [];
  if (args.from !== null) {
    const explicit = sourceDirectory(resolve(cwd, args.from));
    if (!explicit) return { error: '--from must name a directory containing spec and spec.cjs' };
    candidates.push(explicit);
  }
  if (env.SPEC_PLUGIN_ROOT) candidates.push(join(env.SPEC_PLUGIN_ROOT, 'scripts'));
  let fallbackLauncherDir: string | null = null;
  if (scriptPath && !isTargetProjectLauncher(scriptPath, cwd, repo)) {
    try {
      const launcher = realpathSync(resolve(cwd, scriptPath));
      const launcherDir = dirname(launcher);
      if (existsSync(join(dirname(launcherDir), '.claude-plugin/plugin.json'))) candidates.push(launcherDir);
      else fallbackLauncherDir = launcherDir;
    } catch {
      // A launcher without a real file cannot supply an upgrade bundle.
    }
  }
  for (const path of installedPluginPaths(env.HOME, repo)) candidates.push(path);
  if (fallbackLauncherDir) candidates.push(fallbackLauncherDir);

  const target = resolve(repo, '.spec/bin');
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const dir = sourceDirectory(candidate);
    if (!dir) continue;
    let identity = resolve(dir);
    try {
      identity = realpathSync(dir);
    } catch {
      // Keep the resolved path for a candidate that is not a symlink.
    }
    if (seen.has(identity)) continue;
    seen.add(identity);
    let targetIdentity = target;
    try {
      targetIdentity = realpathSync(target);
    } catch {
      // A missing target is the normal first-install case.
    }
    if (identity === targetIdentity) continue;
    const version = installedVersion(cwd, join(dir, 'spec'));
    if (version) return { source: { dir, version } };
  }
  return null;
}

/** Whether the launcher and bundle in `target` are byte-identical to the source's; a missing file is different. */
function sameBytes(sourceDir: string, target: string): boolean {
  for (const file of ['spec', 'spec.cjs']) {
    try {
      if (!readFileSync(join(sourceDir, file)).equals(readFileSync(join(target, file)))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Replaces the pinned launcher and bundle (INS-013/R7): both new files are written under temporary names in
 * `target`, then the bundle is renamed into place and then the launcher. On any failure the old files are back,
 * no temporary file is left and the error is rethrown. If the old bundle cannot be put back, the aside copy is kept
 * and the thrown message carries both errors and how to move it back by hand (INS-013/R8).
 */
function replacePinnedCli(sourceDir: string, target: string): void {
  const launcher = join(target, 'spec');
  const bundle = join(target, 'spec.cjs');
  const tempLauncher = join(target, `.spec.${process.pid}.tmp`);
  const tempBundle = join(target, `.spec.cjs.${process.pid}.tmp`);
  const aside = join(target, `.spec.cjs.${process.pid}.old`);
  let keptAside = false;
  let bundlePlaced = false;
  try {
    mkdirSync(target, { recursive: true });
    copyFileSync(join(sourceDir, 'spec.cjs'), tempBundle);
    chmodSync(tempBundle, 0o755);
    copyFileSync(join(sourceDir, 'spec'), tempLauncher);
    chmodSync(tempLauncher, 0o755);
    if (existsSync(bundle)) {
      // A second name for the old bundle keeps it whole while the new one replaces it in a single rename.
      try {
        linkSync(bundle, aside);
      } catch {
        copyFileSync(bundle, aside);
      }
      keptAside = true;
    }
    renameSync(tempBundle, bundle);
    bundlePlaced = true;
    renameSync(tempLauncher, launcher);
  } catch (error) {
    const undo = (step: () => void): void => {
      try {
        step();
      } catch {
        // Keep undoing the rest; the original error is the one reported.
      }
    };
    undo(() => {
      rmSync(tempBundle, { force: true });
    });
    undo(() => {
      rmSync(tempLauncher, { force: true });
    });
    let restoreMessage: string | null = null;
    if (bundlePlaced) {
      try {
        if (keptAside) renameSync(aside, bundle);
        else rmSync(bundle, { force: true });
      } catch (failure) {
        restoreMessage = failure instanceof Error ? failure.message : String(failure);
      }
    }
    if (restoreMessage !== null && keptAside) {
      // INS-013/R8: the old bundle is not back, so the aside copy is the only good one; keep it and say how to use it.
      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          `restoring the old bundle failed too: ${restoreMessage}`,
          `the old bundle is kept as ${basename(aside)} in ${target}`,
          `to put it back by hand, move ${aside} over ${bundle}`,
        ].join('\n'),
        { cause: error },
      );
    }
    undo(() => {
      rmSync(aside, { force: true });
    });
    throw error;
  }
  rmSync(aside, { force: true });
}

function upgradeOutputDetails(migration: ReturnType<typeof migrateLegacyInstall>): string[] {
  return [
    ...migration.removed.map((path) => 'removed ' + path),
    ...migration.updated.map((path) => 'updated ' + path),
    ...migration.keptEdited.map((path) => 'kept (edited): ' + path),
  ];
}

export function cmdUpgrade(args: Args, cwd: string, scriptPath: string | undefined, env: Readonly<Record<string, string | undefined>> = process.env): Out {
  if (args.positionals.length > 1) return usageError('usage: spec upgrade [<repo>] [--from <dir>] [--force]', USAGE);

  const repo = resolve(cwd, args.positionals[0] ?? '.');
  if (!existsSync(repo) || !statSync(repo).isDirectory()) return usageError(`${repo} is not a directory`, USAGE);
  const resolved = upgradeSource(args, cwd, scriptPath, env, repo);
  if (resolved && 'error' in resolved) return usageError(resolved.error, USAGE);
  if (!resolved) {
    let launcher = scriptPath ? resolve(cwd, scriptPath) : resolve(cwd, 'spec');
    try {
      if (scriptPath) launcher = realpathSync(launcher);
    } catch {
      // Keep the absolute launcher path when it cannot be resolved.
    }
    return { stdout: '', stderr: `no newer spec found; run "${launcher}" upgrade from a Claude Code session\n`, code: 1 };
  }

  const source = resolved.source;
  const target = join(repo, '.spec/bin');
  const launcher = join(target, 'spec');
  const oldVersion = installedVersion(repo, launcher);
  const order = oldVersion ? compareVersions(source.version, oldVersion) : null;
  if (order !== null && order < 0 && !args.force) {
    return usageError(`source spec ${source.version} is older than this project's ${oldVersion ?? 'unknown'}; pass --force to downgrade`, USAGE);
  }

  const prior = oldVersion ?? (existsSync(launcher) ? 'unknown' : 'not installed');
  // At an equal version the bytes decide (INS-013/R6): a missing or different file is a rebuild.
  const rebuilt = order === 0 && !sameBytes(source.dir, target);
  const upgraded = order !== 0 || rebuilt;
  if (upgraded) {
    try {
      replacePinnedCli(source.dir, target);
    } catch (error) {
      return { stdout: '', stderr: `upgrade failed: ${error instanceof Error ? error.message : String(error)}\n`, code: 1 };
    }
  }

  const migration = migrateLegacyInstall(repo, source.dir);
  const plan: Plan = { written: [], skipped: [], notes: [] };
  writePersonalSettings(repo, plan, false);
  mergeSettings(repo, plan);
  ensureGuidance(repo, plan);
  const configPath = join(repo, 'spec/config.json');
  ensureEnforceSince(repo, configPath, plan);
  const config = existsSync(configPath) ? parseConfig('config.json', readFileSync(configPath, 'utf8')).config : null;
  const afterMergeWarning = afterMergeUpgradeNote(config);
  if (afterMergeWarning !== null) plan.notes.push(afterMergeWarning);
  if (isRepo(repo) && plan.written.includes('spec/config.json (enforceSince initialized)')) {
    plan.notes.push('setup changed governed files; ask the person whether to open a bypass before committing them; an approved agent must use --approved-by-person');
  }
  // The pinned CLI under .spec/bin is governed (INS-016/R15): upgrade writes it and commits nothing.
  if (upgraded && isRepo(repo) && currentBranch(repo) === (config?.baseBranch ?? 'main')) {
    plan.notes.push('setup wrote governed files; ask the person whether to open a bypass before committing them; an approved agent must use --approved-by-person');
  }
  const hooks = installGitHooks(repo);
  plan.written.push(...hooks.written);
  plan.notes.push(...hooks.notes);
  writeProjectMarker(repo);
  const removed = [...migration.removed];
  const updated = [...migration.updated, ...plan.written];
  const keptEdited = [...migration.keptEdited];
  const details = [...upgradeOutputDetails(migration), ...plan.written.map((path) => 'updated ' + path)];
  if (plan.notes.length > 0) details.push(...plan.notes.map((note) => 'note: ' + note));
  const downgraded = upgraded && order !== null && order < 0;
  if (args.format === 'json') return json({ upgraded, downgraded, rebuilt, oldVersion: prior, version: source.version, removed, updated, keptEdited, notes: plan.notes });
  const headline = rebuilt
    ? 'rebuilt .spec/bin/spec ' + source.version
    : upgraded
      ? (downgraded ? 'downgraded ' : 'upgraded ') + '.spec/bin/spec ' + prior + ' → ' + source.version
      : 'up to date ' + source.version;
  return ok([headline, ...details].join('\n') + '\n');
}

export async function cmdInit(args: Args, cwd: string, scriptPath: string | undefined): Promise<Out> {
  const target = args.positionals[0];
  if (args.updateRoles) {
    if (args.acceptEdits) return usageError('--accept-edits is only valid when installing spec', USAGE);
    if (args.stack !== null) return usageError('--stack is only valid when installing spec', USAGE);
    if (!target) return usageError('usage: spec init <repo> --update-roles [--yes]', USAGE);
    const repo = resolve(cwd, target);
    const cfg = join(repo, 'spec', 'config.json');
    // A given --name is checked before the config or anything else is read.
    if (args.name !== null && !/^[a-z][a-z0-9_-]*$/.test(args.name)) return usageError(`--name is a lowercase slug, such as chat; not ${args.name}`, USAGE);
    const configured = args.name === null && existsSync(cfg) ? parseConfig('config.json', readFileSync(cfg, 'utf8')).config?.name : undefined;
    const name = args.name ?? configured;
    if (!name) return usageError('--update-roles needs --name <project>, or a name in spec/config.json', USAGE);
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) return usageError(`--name is a lowercase slug, such as chat; not ${name}`, USAGE);
    return updateRoles(repo, args.yes, args.format);
  }
  const name = args.name;
  if (!target || !name) return usageError('usage: spec init <repo> --name <project>', USAGE);
  if (!/^[a-z][a-z0-9_-]*$/.test(name)) return usageError(`--name is a lowercase slug, such as chat; not ${name}`, USAGE);
  const repo = resolve(cwd, target);
  if (!existsSync(repo) || !statSync(repo).isDirectory()) return usageError(`${repo} is not a directory`, USAGE);
  if (args.stack !== null && !STACK_NAMES.includes(args.stack as (typeof STACK_NAMES)[number])) return usageError(`--stack must be one of ${STACK_NAMES.join(', ')}`, USAGE);
  if (args.acceptEdits) {
    const conflict = acceptEditsConflict(repo);
    if (conflict) return { stdout: '', stderr: conflict + '\n', code: 1 };
  }
  const stack = args.stack === null ? null : defaultsForStack(args.stack, repo);
  const base = '.spec/bin';
  const specDir = 'spec';
  const plan: Plan = { written: [], skipped: [], notes: [] };
  const configPath = join(repo, specDir, 'config.json');
  const freshSpec = !existsSync(configPath);
  if (!freshSpec) {
    const installedName = parseConfig('config.json', readFileSync(configPath, 'utf8')).config?.name;
    if (installedName && name !== installedName) {
      plan.notes.push(`--name ${name} differs from spec/config.json name ${installedName}; keeping the existing name`);
    }
  }
  const sourceDir = scriptPath ? dirname(realpathSync(resolve(cwd, scriptPath))) : undefined;
  const migration = migrateLegacyInstall(repo, sourceDir);
  const fill = (t: string) => t.replaceAll('{project}', name);

  let configText = fill(asset('templates/config.json'));
  if (stack) {
    const config = JSON.parse(configText) as Record<string, unknown>;
    config.testCommand = stack.testCommand;
    config.codeGlobs = stack.codeGlobs;
    config.testGlobs = stack.testGlobs;
    if (stack.worktreeSetup) config.worktreeSetup = stack.worktreeSetup;
    configText = JSON.stringify(config, null, 2) + '\n';
  }
  put(repo, `${specDir}/config.json`, configText, plan);
  // The graph is built on demand; only index.md is committed (DECISIONS X92).
  put(repo, `${specDir}/.gitignore`, '_generated/\nconfig.local.json\n', plan);
  for (const f of ['overview', 'conventions', 'glossary', 'invariants']) put(repo, `${specDir}/core/${f}.md`, fill(asset(`templates/core/${f}.md`)), plan);
  const shared = asset('roles/_shared.md');
  for (const role of ROLES) {
    const text = expandRole(asset(`roles/${role}.md`), shared);
    if (text) put(repo, `${specDir}/roles/${role}.md`, text, plan);
  }

  // The pinned CLI: copy the files beside the running launcher.
  const here = sourceDir;
  if (here && existsSync(join(here, 'spec.cjs')) && existsSync(join(here, 'spec'))) {
    for (const f of ['spec', 'spec.cjs']) {
      const dest = `${base}/${f}`;
      if (existsSync(join(repo, dest))) plan.skipped.push(dest);
      else {
        mkdirSync(join(repo, base), { recursive: true });
        copyFileSync(join(here, f), join(repo, dest));
        chmodSync(join(repo, dest), 0o755);
        plan.written.push(dest);
      }
    }
  } else plan.notes.push(`${base}/spec not installed: run init from the built dist/spec`);

  writePersonalSettings(repo, plan, args.acceptEdits);
  mergeSettings(repo, plan, stack);
  ensureEnforceSince(repo, configPath, plan);
  ensureGuidance(repo, plan);

  if (isRepo(repo) && (freshSpec || plan.written.includes('spec/config.json (enforceSince initialized)'))) {
    plan.notes.push('setup wrote governed files; ask the person whether to open a bypass before committing them; an approved agent must use --approved-by-person');
  }
  // The generated graph and index, so a new install passes `spec lint --ci` at once.
  const built = await writeGenerated(await loadWorkspace(join(repo, specDir), null, cwd));
  for (const w of built.written) plan.written.push(`${specDir}/${w}`);
  if (!built.ok) plan.notes.push(`spec build failed: ${built.errors.join('; ')}`);
  const hooks = installGitHooks(repo);
  plan.written.push(...hooks.written);
  plan.notes.push(...hooks.notes);
  writeProjectMarker(repo);

  const result = { repo: toPosix(relative(cwd, repo)) || '.', skill: 'spec:brief', spec: specDir, written: plan.written, skipped: plan.skipped, notes: plan.notes, removed: migration.removed, updated: migration.updated, keptEdited: migration.keptEdited };
  if (args.format === 'json') return json(result);
  const skippedLine = (s: string): string => (s === SETTINGS_KEPT ? `skipped ${s}` : `skipped ${s} (exists)`);
  const lines = [
    ...plan.written.map((w) => `wrote ${w}`),
    ...plan.skipped.map(skippedLine),
    ...migration.removed.map((path) => `removed ${path}`),
    ...migration.updated.map((path) => `updated ${path}`),
    ...migration.keptEdited.map((path) => `kept (edited): ${path}`),
    ...plan.notes.map((n) => `note: ${n}`),
  ];
  return ok(`${lines.join('\n')}\n`);
}
