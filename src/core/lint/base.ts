// L035 (LNT-018): the IDs a branch reuses or drops against its base branch. Pure: the caller parses the
// spec at the merge base and at the base's tip and hands the three indexes in.
import { type Finding, finding } from '../findings';
import { compareIds } from '../ids';
import type { Unit } from '../model';
import type { UnitIndex } from '../units';

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** What a unit says, for telling a reuse from an alike addition: a scenario its title, a rule its text. */
function meaning(u: Unit): string {
  switch (u.type) {
    case 'scenario':
      return squash(u.title);
    case 'rule':
      return squash(u.text);
    case 'feature':
      // The whole file, frontmatter links included, without the scenarios and rules: they are units of
      // their own and are compared as such.
      return squash(u.text.replace(u.behaviourText, '').replace(u.rulesText, ''));
    case 'contract':
      // Its members are units of their own.
      return squash(u.headText);
    default:
      return squash(u.text);
  }
}

const quoted = (u: Unit): string | null => (u.type === 'scenario' ? u.title : u.type === 'rule' ? u.text : null);

/**
 * PIP-007/R10: the scenarios and rules that both branches added since their own merge bases, with text
 * that differs as L035 compares it. `mine` and `theirs` are the two branches' specs, `myFork` and
 * `theirFork` the specs where each parted from the base. Scenarios come first, each kind in ID order.
 */
export function numberCollisions(myFork: UnitIndex, mine: UnitIndex, theirFork: UnitIndex, theirs: UnitIndex): { readonly id: string; readonly feature: string }[] {
  const out: { id: string; feature: string; kind: number }[] = [];
  for (const [id, unit] of mine.byId) {
    if ((unit.type !== 'scenario' && unit.type !== 'rule') || myFork.byId.has(id) || theirFork.byId.has(id)) continue;
    const other = theirs.byId.get(id);
    if (!other || meaning(unit) === meaning(other)) continue;
    out.push({ id, feature: unit.feature, kind: unit.type === 'scenario' ? 0 : 1 });
  }
  return out.sort((a, b) => a.kind - b.kind || compareIds(a.id, b.id)).map(({ id, feature }) => ({ id, feature }));
}

const isTopLevel = (u: Unit): boolean => u.type === 'invariant' || u.type === 'decision' || u.type === 'feature' || u.type === 'screen';

/**
 * PIP-007/R11: the invariants, decisions, features and screens that both branches added since their own
 * merge bases, with text that differs as L035 compares them, in ID order. The arguments are as for
 * `numberCollisions`.
 */
export function topLevelCollisions(myFork: UnitIndex, mine: UnitIndex, theirFork: UnitIndex, theirs: UnitIndex): string[] {
  const out: string[] = [];
  for (const [id, unit] of mine.byId) {
    if (!isTopLevel(unit) || myFork.byId.has(id) || theirFork.byId.has(id)) continue;
    const other = theirs.byId.get(id);
    if (!other || meaning(unit) === meaning(other)) continue;
    out.push(id);
  }
  return out.sort(compareIds);
}

/**
 * PIP-007/R11: for each refused ID, the ID to take instead. It keeps the prefix and is one more than the
 * highest number of that prefix in any of `indexes` (tombstones included); refused IDs of one prefix take
 * consecutive numbers in ascending order.
 */
export function nextFreeIds(refused: readonly string[], indexes: readonly UnitIndex[]): Map<string, string> {
  const highest = new Map<string, number>();
  for (const index of indexes) {
    for (const [id, unit] of index.byId) {
      if (!isTopLevel(unit)) continue;
      const m = /^([A-Z]+)-(\d+)$/.exec(id);
      if (!m) continue;
      const prefix = m[1] ?? '';
      highest.set(prefix, Math.max(highest.get(prefix) ?? 0, Number(m[2])));
    }
  }
  const out = new Map<string, string>();
  for (const id of [...refused].sort(compareIds)) {
    const m = /^([A-Z]+)-(\d+)$/.exec(id);
    if (!m) continue;
    const prefix = m[1] ?? '';
    const next = Math.max(highest.get(prefix) ?? 0, Number(m[2])) + 1;
    highest.set(prefix, next);
    out.set(id, `${prefix}-${String(next).padStart((m[2] ?? '').length, '0')}`);
  }
  return out;
}

/**
 * `mergeBase` is the spec where HEAD and the base parted (empty when they have no merge base), `tip` the
 * base's spec, `work` the working tree's. `ref` names the base in messages.
 */
export function baseFindings(ref: string, mergeBase: UnitIndex, tip: UnitIndex, work: UnitIndex): Finding[] {
  const out: Finding[] = [];
  for (const [id, mine] of work.byId) {
    if (mergeBase.byId.has(id)) continue;
    const theirs = tip.byId.get(id);
    if (!theirs || meaning(mine) === meaning(theirs)) continue;
    const here = quoted(mine);
    const there = quoted(theirs);
    const what = here !== null && there !== null ? `'${here}' here and '${there}' on ${ref}` : `defined differently here and on ${ref}`;
    out.push(
      finding('L035', mine.file, mine.line, id, `${id} is ${what}, and each side added it after they parted`, `IDs are never reused: give this one an ID that ${ref} does not have`),
    );
  }
  for (const [id, old] of mergeBase.byId) {
    if (work.byId.has(id) || !tip.byId.has(id)) continue;
    if (old.type === 'scenario' || old.type === 'rule') {
      const feature = work.byId.get(old.feature);
      const no = id.slice(old.feature.length + 1);
      if (feature?.type === 'feature' && feature.retired.some((r) => r.id === no)) continue;
      out.push(
        finding('L035', feature?.file ?? old.file, 1, id, `${id} is on ${ref} but not here; add ${no} to retired in ${old.feature}, so its number is never reused`, 'keep the number in retired, or restore the unit'),
      );
    } else {
      out.push(finding('L035', old.file, 1, id, `${id} is on ${ref} but not here; keep it as a tombstone with status: removed`, 'keep the unit with status: removed (and Superseded by: where it has a successor), or restore it'));
    }
  }
  return out;
}
