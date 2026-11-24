// What a ticket's branch changed in the spec: units added, changed or removed between two versions,
// compared by ID and text. Test-first stages and briefs read it, so no role has to copy the list.
import { classifyId, sortIds } from './ids';
import type { Unit } from './model';
import { type UnitIndex, statusOf } from './units';

export interface SpecDelta {
  /** The version compared against, e.g. the merge base with the base branch. */
  readonly base: string;
  readonly added: readonly string[];
  readonly changed: readonly string[];
  /** In the base, gone now. A unit is retired, never deleted, so check-report questions each one. */
  readonly removed: readonly string[];
  /**
   * Units whose wording changed but whose behaviour did not, so no red test: a scenario's title
   * over the same steps, a screen's layout over the same states and copy.
   */
  readonly reworded: readonly string[];
  /**
   * Retirement undone, which is never allowed: scenario and rule numbers taken off their feature's
   * `retired` list, and removed units made live again (a new unit takes a new ID).
   */
  readonly unretired: readonly string[];
}

export const EMPTY_DELTA: SpecDelta = { base: '', added: [], changed: [], removed: [], reworded: [], unretired: [] };

/**
 * What a unit says, compared across versions. A scenario is its steps; its title is wording. A
 * screen is its states and copy; its layout describes how it looks, which no test checks (X133).
 */
function substance(u: Unit): string {
  if (u.type === 'scenario') return u.steps.map((s) => `${s.text}\n${norm(s.attachment)}`).join('\n');
  if (u.type === 'screen') return norm(u.text.replace(/^## Layout\n[\s\S]*?(?=^## |(?![\s\S]))/m, ''));
  return norm(u.text);
}

const norm = (text: string): string =>
  text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();

export function specDelta(base: string, before: UnitIndex, after: UnitIndex): SpecDelta {
  const added: string[] = [];
  const changed: string[] = [];
  const reworded: string[] = [];
  for (const [id, u] of after.byId) {
    const old = before.byId.get(id);
    if (!old) added.push(id);
    else if (substance(old) !== substance(u)) changed.push(id);
    else if (norm(old.text) !== norm(u.text) && (u.type === 'scenario' || u.type === 'screen')) reworded.push(id);
  }
  const removed = [...before.byId.keys()].filter((id) => !after.byId.has(id));
  const unretired: string[] = [];
  for (const old of before.byId.values()) {
    const now = after.byId.get(old.id);
    if (!now) continue;
    if (statusOf(old, before.byId) === 'removed' && statusOf(now, after.byId) !== 'removed') unretired.push(old.id);
    if (old.type !== 'feature' || now.type !== 'feature') continue;
    for (const r of old.retired) if (!now.retired.some((x) => x.id === r.id)) unretired.push(`${old.id}/${r.id}`);
  }
  return { base, added: sortIds(added), changed: sortIds(changed), removed: sortIds(removed), reworded: sortIds(reworded), unretired: sortIds(unretired) };
}

/** Removed scenarios: their tests go too, or they would test behaviour the spec no longer has. */
export function removedScenarios(d: SpecDelta): string[] {
  return d.removed.filter((id) => classifyId(id) === 'scenario');
}

/** Added, changed and reworded units except features and modules, whose text changes with any part. */
export function deltaUnits(d: SpecDelta): string[] {
  return sortIds([...d.added, ...d.changed, ...d.reworded].filter((id) => !['feature', 'module'].includes(classifyId(id) ?? '')));
}

/** The scenarios a change adds or alters: the behaviour its tests must show failing first. A reworded one is not among them. */
export function deltaScenarios(d: SpecDelta): string[] {
  return sortIds([...d.added, ...d.changed].filter((id) => classifyId(id) === 'scenario'));
}
