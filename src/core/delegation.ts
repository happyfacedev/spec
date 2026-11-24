import { CLAUDE_CODE_MODELS, STAGE_ROLES, type Delegation, type DelegationSetting, type Effort, type ModelChoice, type StageRole } from './schemas';

/** The stage roles a harness must give a model. The spec review is left out: the reviewer's model covers it (PIP-017/R8). */
export const REQUIRED_MODEL_ROLES: readonly StageRole[] = STAGE_ROLES.filter((role) => role !== 'spec-review');

/** A model list entry that was not selected (cli.SkippedModel). */
export interface SkippedModel {
  readonly model: string;
  readonly reason: 'not a supported model' | 'marked unavailable';
}

/** What a stage role would start with now; `effort` is the one its entry sets, whether or not it can be sent. */
export interface ModelSelection {
  readonly model: string | null;
  readonly effort: Effort | null;
  readonly skipped: readonly SkippedModel[];
}

/** One stage role's selection (cli.RoleModel). */
export interface RoleModel extends ModelSelection {
  readonly role: StageRole;
}

export const isClaudeCodeModel = (model: unknown): model is (typeof CLAUDE_CODE_MODELS)[number] => CLAUDE_CODE_MODELS.some((candidate) => candidate === model);

/** A role's entries, best first; a text means a list of one with no effort (FMT-015/R8). */
export function modelChoices(setting: DelegationSetting | undefined): readonly ModelChoice[] {
  if (setting === undefined) return [];
  return typeof setting === 'string' ? [{ model: setting }] : setting;
}

export const isSupportedModel = (harness: string, model: string): boolean => harness !== 'claude-code' || isClaudeCodeModel(model);

/** Whether a role's setting holds a supported model, marked unavailable or not. */
export const hasSupportedModel = (harness: string, setting: DelegationSetting | undefined): boolean =>
  modelChoices(setting).some((choice) => isSupportedModel(harness, choice.model));

export function missingDelegationModels(delegation: Delegation, harness: string | null): StageRole[] {
  return harness === null ? [] : REQUIRED_MODEL_ROLES.filter((role) => !hasSupportedModel(harness, delegation[harness]?.[role]));
}

/** The shared delegation with one person's settings over it, role by role (FMT-015/R3). */
export function mergeDelegation(shared: Delegation, local: Delegation): Delegation {
  const merged: Delegation = { ...shared };
  for (const [harness, roles] of Object.entries(local)) merged[harness] = { ...merged[harness], ...roles };
  return merged;
}

/** The first supported entry not marked unavailable; only claude-code reads the marks (FMT-015/R8, R9). */
export function selectModel(delegation: Delegation, unavailable: readonly string[], harness: string | null, role: StageRole): ModelSelection {
  if (harness === null) return { model: null, effort: null, skipped: [] };
  const own = delegation[harness]?.[role];
  const reviewer = delegation[harness]?.reviewer;
  // The spec review without a supported model of its own takes the same harness's reviewer setting (PIP-017/R8).
  const setting = role === 'spec-review' && !hasSupportedModel(harness, own) && reviewer !== undefined ? reviewer : own;
  const skipped: SkippedModel[] = [];
  for (const { model, effort } of modelChoices(setting)) {
    if (!isSupportedModel(harness, model)) skipped.push({ model, reason: 'not a supported model' });
    else if (harness === 'claude-code' && unavailable.includes(model)) skipped.push({ model, reason: 'marked unavailable' });
    else return { model, effort: effort ?? null, skipped };
  }
  return { model: null, effort: null, skipped };
}

/** True when the role has supported entries and every one is marked unavailable, so nothing may start (CLI-007/R18). */
export const allMarkedUnavailable = (selection: ModelSelection): boolean =>
  selection.model === null && selection.skipped.some((entry) => entry.reason === 'marked unavailable');

/** One role as session start names it, with the models skipped because they are marked (INS-008/R2). */
export function describeRoleModel({ role, model, effort, skipped }: RoleModel): string {
  const marked = skipped.filter((entry) => entry.reason === 'marked unavailable').map((entry) => entry.model).join(', ');
  const chosen = model !== null ? `${model}${effort === null ? '' : ` ${effort}`}` : marked !== '' ? 'none available' : 'not set';
  return `${role} ${chosen}${marked === '' ? '' : ` (${marked} marked unavailable)`}`;
}
