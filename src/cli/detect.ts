import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseConfig, parseLocalConfig } from '../core/parse/tickets';
import { describeRoleModel, mergeDelegation, missingDelegationModels, selectModel, type RoleModel } from '../core/delegation';
import { STAGE_ROLES, type Delegation, type StageRole } from '../core/schemas';
import { type EffortGate, effortGate } from '../io/claude-version';
import { detectHarness } from './next';
import { type Args, USAGE } from './args';
import { type Out, json, ok, usageError } from './output';
import { changedPaths, git, isRepo } from '../io/git';
import { defaultsForStack, detectStacks } from './stacks';

export type DetectedState = 'empty' | 'code' | 'spec' | 'legacy-spec';

export interface Detection {
  readonly state: DetectedState;
  readonly dirty: boolean;
  readonly git: boolean;
  readonly baseBranch?: string;
  readonly stacks: ReturnType<typeof detectStacks>;
  readonly harness: 'claude-code' | 'astro' | null;
  readonly missingModels: StageRole[];
  readonly models: RoleModel[];
  readonly editMode: string;
}

function settingsMode(path: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const permissions = (parsed as Record<string, unknown>).permissions;
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return null;
    const mode = (permissions as Record<string, unknown>).defaultMode;
    return typeof mode === 'string' && mode !== '' ? mode : null;
  } catch {
    return null;
  }
}

function editModeAt(root: string): string {
  return settingsMode(join(root, '.claude/settings.local.json')) ?? settingsMode(join(root, '.claude/settings.json')) ?? 'default';
}

const EMPTY_ENTRIES = (name: string): boolean =>
  name === '.git' || /^README/i.test(name) || /^LICENSE/i.test(name)
  || ['.gitignore', '.editorconfig', '.vscode', '.idea', '.claude', '.DS_Store', 'Thumbs.db'].includes(name);

function legacySpecRoot(root: string): string | null {
  const skills = join(root, '.claude/skills');
  if (!existsSync(skills)) return null;
  try {
    for (const entry of readdirSync(skills, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z][a-z0-9_-]*-spec$/.test(entry.name)) continue;
      const skill = join(skills, entry.name);
      if (existsSync(join(skill, 'config.json'))) return skill;
      const nested = join(skill, 'spec');
      if (existsSync(join(nested, 'config.json'))) return nested;
      const projectSpec = join(root, 'spec');
      if (existsSync(join(skill, 'scripts/spec.cjs')) && existsSync(join(projectSpec, 'config.json'))) return projectSpec;
      try {
        const pointer: unknown = JSON.parse(readFileSync(join(skill, 'skill.json'), 'utf8'));
        if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) continue;
        const specRoot = (pointer as Record<string, unknown>).specRoot;
        if (typeof specRoot === 'string' && specRoot !== '') {
          const pointed = resolve(root, specRoot);
          if (existsSync(join(pointed, 'config.json'))) return pointed;
        }
      } catch {
        // A broken pointer does not make the project a legacy spec.
      }
    }
  } catch {
    return null;
  }
  return null;
}

interface ModelSettings { readonly delegation: Delegation; readonly unavailableModels: readonly string[] }

function modelSettingsAt(specRoot: string | null): ModelSettings {
  const none: ModelSettings = { delegation: {}, unavailableModels: [] };
  if (specRoot === null) return none;
  try {
    const configPath = join(specRoot, 'config.json');
    if (!existsSync(configPath)) return none;
    const shared = parseConfig('config.json', readFileSync(configPath, 'utf8')).config?.delegation ?? {};
    const localPath = join(specRoot, 'config.local.json');
    const local = existsSync(localPath) ? parseLocalConfig('config.local.json', readFileSync(localPath, 'utf8')) : none;
    return { delegation: mergeDelegation(shared, local.delegation), unavailableModels: local.unavailableModels };
  } catch {
    return none;
  }
}

/** The model and effort each stage role would start with now under a harness (cli.Detection.models). */
export function roleModels(settings: ModelSettings, harness: string | null, gate: EffortGate): RoleModel[] {
  if (harness === null) return [];
  return STAGE_ROLES.map((role) => {
    const { model, effort, skipped } = selectModel(settings.delegation, settings.unavailableModels, harness, role);
    return { role, model, effort: gate.send(effort), skipped };
  });
}

function defaultBranch(root: string, gitRepo: boolean): string | undefined {
  if (!gitRepo) return undefined;
  const remote = git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remote.code === 0 && remote.stdout.trim().startsWith('origin/')) return remote.stdout.trim().slice(remote.stdout.trim().lastIndexOf('/') + 1);
  for (const branch of ['main', 'master']) {
    if (git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).code === 0) return branch;
  }
  const current = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const name = current.code === 0 ? current.stdout.trim() : '';
  return name === 'main' || name === 'master' ? name : undefined;
}

function detectProject(rootPath: string, env: Readonly<Record<string, string | undefined>>, gate: EffortGate): Detection {
  const root = resolve(rootPath);
  const gitRepo = isRepo(root);
  const directSpec = existsSync(join(root, 'spec/config.json'));
  const legacyRoot = legacySpecRoot(root);
  const pinnedCli = existsSync(join(root, '.spec/bin/spec.cjs'));
  const legacy = legacyRoot !== null && !pinnedCli;
  const specRoot = directSpec ? join(root, 'spec') : legacyRoot;
  let state: DetectedState;
  if (legacy) state = 'legacy-spec';
  else if (directSpec) state = 'spec';
  else {
    const entries = readdirSync(root, { withFileTypes: true });
    state = entries.every((entry) => EMPTY_ENTRIES(entry.name)) ? 'empty' : 'code';
  }
  const detectedHarness = detectHarness(null, env);
  const selectedHarness = detectedHarness === 'claude-code' || detectedHarness === 'astro' ? detectedHarness : null;
  const stacks = detectStacks(root);
  if (state === 'code' && stacks.length === 0) {
    const other = defaultsForStack('other', root);
    if (other) stacks.push(other);
  }
  const settings = modelSettingsAt(specRoot);
  const detection: Detection = {
    state,
    dirty: gitRepo && changedPaths(root).length > 0,
    git: gitRepo,
    stacks,
    harness: selectedHarness,
    missingModels: missingDelegationModels(settings.delegation, selectedHarness),
    models: roleModels(settings, selectedHarness, gate),
    editMode: editModeAt(root),
  };
  const baseBranch = defaultBranch(root, gitRepo);
  return {
    ...detection,
    ...(baseBranch ? { baseBranch } : {}),
  };
}

export function cmdDetect(args: Args, cwd: string, env: Readonly<Record<string, string | undefined>>): Out {
  if (args.positionals.length > 0) return usageError('usage: spec detect [--format json]', USAGE);
  const gate = effortGate(env);
  const result = detectProject(cwd, env, gate);
  const notice = gate.notice();
  const stderr = notice === null ? '' : `${notice}\n`;
  if (args.format === 'json') return { ...json(result), stderr };
  const stackNames = result.stacks.map((stack) => `${stack.name} (${stack.manifest})`);
  const text = ok([
    `state: ${result.state}`,
    `git: ${result.git ? 'yes' : 'no'}`,
    `dirty: ${result.dirty ? 'yes' : 'no'}`,
    `base branch: ${result.baseBranch ?? 'unknown'}`,
    `stacks: ${stackNames.length > 0 ? stackNames.join(', ') : 'none detected'}`,
    `harness: ${result.harness ?? 'unknown'}`,
    `missing models: ${result.missingModels.length > 0 ? result.missingModels.join(', ') : 'none'}`,
    `models: ${result.models.length > 0 ? result.models.map(describeRoleModel).join(' · ') : 'none'}`,
    `edit mode: ${result.editMode}`,
  ].join('\n') + '\n');
  return { ...text, stderr };
}
