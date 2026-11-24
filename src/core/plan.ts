// `spec plan`: which tickets can run at the same time. Two tickets must not run in parallel when
// one depends on the other: explicitly (`depends_on`), or through the spec, when a proposal's blast
// radius reaches what the other works on, or both change the same unit. Touching the same
// feature, and so the same files, is fine: merging resolves that.
import { type Dependencies, gateTicket } from './gate';
import { classifyId, compareIds, compareStrings, parseContractRef, refsMatch } from './ids';
import { computeImpact } from './impact';
import type { Feature, Spec, Ticket, TicketSet } from './model';
import { nextStage } from './pipeline';
import type { Role } from './schemas';
import { isContractRef, ticketScope } from './scope';
import type { UnitIndex } from './units';

interface Footprint {
  readonly ticket: Ticket;
  /** Features the ticket works on. */
  readonly features: ReadonlySet<string>;
  /** Units other than features it names in touches, violates or changed. */
  readonly units: readonly string[];
  /** Proposals only: everything their change reaches beyond themselves, with how. */
  readonly radius: ReadonlyMap<string, string>;
}

/** Units that other features see: a change to one reaches whatever uses it. */
const SHARED = new Set(['contract', 'field', 'invariant', 'decision', 'screen']);

export function footprint(spec: Spec, index: UnitIndex, ticket: Ticket): Footprint {
  // R9: until a proposal's spec-writer stage is recorded, its footprint is what it touches and
  // violates, with no widening through the contracts its features read or write; `changed` joins
  // once that stage is recorded.
  const unspecced = ticket.data.type === 'proposal' && !ticket.data.history.some((h) => h.role === 'spec-writer');
  const scope = ticketScope(unspecced ? { ...ticket.data, changed: [] } : ticket.data);
  const features = new Set(scope.features);
  const radius = new Map<string, string>();
  // Bugs and tasks do not change what the spec says, so they reach nothing another ticket reads.
  // A proposal reaches other features only through the shared units it changes: features connect
  // through contracts, so a change inside a feature stops at its contracts (impact.ts, D7). Its
  // reach includes its own features that produce what it changes: another ticket working on one
  // of them builds on the shape that is changing.
  if (ticket.data.type === 'proposal') {
    for (const u of scope.units) {
      if (!SHARED.has(classifyId(u) ?? '')) continue;
      const impact = computeImpact(spec, index, u, null);
      for (const item of [...impact.mustChange, ...impact.reverify]) if (!radius.has(item.id)) radius.set(item.id, `${item.via[0] ?? ''} ← ${u}`);
    }
  }
  return { ticket, features, units: scope.units.filter((u) => classifyId(u) !== 'feature'), radius };
}

/** The contract refs a feature reads or writes. */
const readsOrWrites = (f: Feature): string[] => [...f.links.reads, ...f.links.writes].map((r) => r.id);

/** R10: a contract or member is widely used when at least 10 active features, and more than a tenth of them, read or write it. It decides grouping only (R11). */
const WIDELY_USED_MIN = 10;
const WIDELY_USED_SHARE = 10;

function widelyUsed(spec: Spec, ref: string): boolean {
  let active = 0;
  let users = 0;
  for (const f of spec.features) {
    if (f.status !== 'active') continue;
    active++;
    if (readsOrWrites(f).some((r) => refsMatch(ref, r))) users++;
  }
  return users >= WIDELY_USED_MIN && users * WIDELY_USED_SHARE > active;
}

const same = (a: string, b: string): boolean => (isContractRef(a) && isContractRef(b) ? refsMatch(a, b) : a === b);

/** Why `a` and `b` must not run at the same time, or null when they may. */
export function conflict(a: Footprint, b: Footprint): string | null {
  const ad = a.ticket.data;
  const bd = b.ticket.data;
  if (ad.depends_on.includes(b.ticket.id)) return `${a.ticket.id} depends on ${b.ticket.id}`;
  if (bd.depends_on.includes(a.ticket.id)) return `${b.ticket.id} depends on ${a.ticket.id}`;
  // Scenario and rule numbers are allocated per feature: two proposals adding to one feature would
  // both take the next number (X127). Bugs and tasks add none, so they share features freely.
  if (ad.type === 'proposal' && bd.type === 'proposal') {
    const shared = [...a.features].find((f) => b.features.has(f));
    if (shared) return `both add to ${shared}, so their new scenario and rule numbers would collide`;
  }
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    if (x.ticket.data.type !== 'proposal') continue;
    const reaches = (unit: string, via: string) => `${y.ticket.id} works on ${unit}, which ${x.ticket.id} reaches (${via})`;
    for (const f of y.features) {
      const via = x.radius.get(f);
      if (via !== undefined) return reaches(f, via);
    }
    for (const u of y.units) {
      for (const [r, via] of x.radius) if (same(r, u)) return reaches(u, via);
      if (x.units.some((v) => same(u, v))) return `both change ${u}`;
    }
  }
  return null;
}

export interface PlanEntry {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  /** Running: the stage in progress. Otherwise the next stage. */
  readonly stage: Role | null;
  /** 1 is now: running, or free to start. Each later wave starts once the earlier ones land. */
  readonly wave: number;
  /** The tickets it waits for, each with the reason. */
  readonly after: readonly { readonly id: string; readonly reason: string }[];
}

export interface Plan {
  readonly spec: string;
  readonly running: readonly PlanEntry[];
  /** Free to start now, all at once. */
  readonly now: readonly PlanEntry[];
  /** Waiting for a ticket in an earlier wave, or for a dependency to be merged. */
  readonly later: readonly PlanEntry[];
  /** Waiting for a person: a gate blocker or a ticket blocked on one. */
  readonly blocked: readonly { readonly id: string; readonly reason: string }[];
  /** Advice that changes no wave (R11): open, unstarted tickets of one type that could be combined. */
  readonly together: readonly PlanGroup[];
}

export interface PlanGroup {
  /** In ID order. */
  readonly ids: readonly string[];
  readonly type: string;
  readonly module: string;
  readonly contract: string;
  /** Distinct scenarios their impact gives to re-verify. */
  readonly reach: number;
  readonly command: string;
}

/** R11: a group re-verifies at most this many scenarios. */
const TOGETHER_MAX_REACH = 60;

interface Candidate {
  readonly ticket: Ticket;
  readonly modules: ReadonlySet<string>;
  /** The contracts (whole entities) its features read or write, widely used ones left out (R10). */
  readonly contracts: ReadonlySet<string>;
  readonly scenarios: ReadonlySet<string>;
}

/** R11: groups of tickets that could be combined, by first ID. `tickets` are open, unstarted, in Start now or Later. */
function groupTogether(spec: Spec, index: UnitIndex, tickets: readonly Ticket[], prints: ReadonlyMap<string, Footprint>): PlanGroup[] {
  const wide = new Map<string, boolean>();
  const isWide = (c: string): boolean => {
    let w = wide.get(c);
    if (w === undefined) wide.set(c, (w = widelyUsed(spec, c)));
    return w;
  };
  const infos: Candidate[] = [...tickets].sort((a, b) => compareIds(a.id, b.id)).map((ticket) => {
    const modules = new Set<string>();
    const contracts = new Set<string>();
    for (const f of spec.features) {
      if (!prints.get(ticket.id)?.features.has(f.id)) continue;
      modules.add(f.module);
      for (const r of readsOrWrites(f)) {
        const entity = parseContractRef(r).entity;
        if (!isWide(entity)) contracts.add(entity);
      }
    }
    // What `spec impact` gives the ticket to re-verify: the scenarios of its outer ring. A ticket
    // whose ring holds none re-verifies the features it works on.
    const impact = computeImpact(spec, index, ticket.id, ticket);
    const scenarios = new Set(impact.reverify.flatMap((it) => it.scenarios));
    if (scenarios.size === 0) for (const f of spec.features) if (impact.changed.includes(f.id)) for (const s of f.scenarios) scenarios.add(s.id);
    return { ticket, modules, contracts, scenarios };
  });
  const groups: { members: Candidate[]; module: string; contract: string; scenarios: Set<string> }[] = [];
  const grouped = new Set<string>();
  const first = (xs: Iterable<string>, order: (a: string, b: string) => number): string | undefined => [...xs].sort(order)[0];
  for (const me of infos) {
    const type = me.ticket.data.type;
    const union = (s: ReadonlySet<string>) => new Set([...s, ...me.scenarios]);
    const joined = groups.find((g) => g.members[0]?.ticket.data.type === type && me.modules.has(g.module) && me.contracts.has(g.contract) && union(g.scenarios).size <= TOGETHER_MAX_REACH);
    if (joined) {
      joined.members.push(me);
      joined.scenarios = union(joined.scenarios);
      grouped.add(me.ticket.id);
      continue;
    }
    for (const other of infos) {
      if (other === me) break;
      if (other.ticket.data.type !== type || grouped.has(other.ticket.id)) continue;
      const module = first([...me.modules].filter((m) => other.modules.has(m)), compareStrings);
      const contract = first([...me.contracts].filter((c) => other.contracts.has(c)), compareIds);
      const scenarios = union(other.scenarios);
      if (module === undefined || contract === undefined || scenarios.size > TOGETHER_MAX_REACH) continue;
      groups.push({ members: [other, me], module, contract, scenarios });
      grouped.add(other.ticket.id).add(me.ticket.id);
      break;
    }
  }
  return groups
    .map((g) => {
      const ids = g.members.map((m) => m.ticket.id);
      return { ids, type: g.members[0]?.ticket.data.type ?? '', module: g.module, contract: g.contract, reach: g.scenarios.size, command: `spec ticket combine ${ids.join(' ')}` };
    })
    .sort((a, b) => compareIds(a.ids[0] ?? '', b.ids[0] ?? ''));
}

/**
 * `only`: the tickets to plan, in the order asked (default: every ticket not done, by ID).
 * Running tickets are always in the plan, since they hold their place in the first wave.
 */
export function buildPlan(spec: Spec, index: UnitIndex, set: TicketSet, deps: Dependencies, only: readonly string[] | null = null): Plan {
  const byId = new Map(set.tickets.map((t) => [t.id, t]));
  const blocked: { id: string; reason: string }[] = [];
  const asked = only ?? set.tickets.filter((t) => t.data.status !== 'done' && t.data.status !== 'absorbed').map((t) => t.id);
  for (const id of asked) if (!byId.has(id)) blocked.push({ id, reason: `${id} is not a ticket` });

  const running = set.tickets.filter((t) => t.data.status === 'in_progress');
  const candidates: Ticket[] = [];
  const stageOf = new Map<string, Role | null>();
  for (const id of asked) {
    const t = byId.get(id);
    if (!t || t.data.status === 'done' || t.data.status === 'absorbed' || t.data.status === 'in_progress') continue;
    const gate = gateTicket(spec, index, t.id, t, set.findings.filter((f) => f.file === t.file), deps);
    const human = gate.blockers.find((b) => b.kind !== 'dependency');
    const next = nextStage(t.data.type, t.data.history, t.data.questions, t.data.lane);
    if (human) blocked.push({ id, reason: `${human.kind} ${human.id}: ${human.text}` });
    else if ('blocked' in next) blocked.push({ id, reason: next.blocked });
    else if ('stage' in next) {
      candidates.push(t);
      stageOf.set(t.id, next.stage);
    }
  }

  // In flight (R8): a branch holding a recorded stage not merged into the base branch, whatever the
  // status. One that is not a candidate (blocked, or not asked for) still holds its place in wave 1.
  const inFlight = (t: Ticket): boolean => t.data.status !== 'done' && t.data.status !== 'absorbed' && t.data.status !== 'in_progress' && t.data.history.length > 0 && deps.unmerged.has(t.id);
  const held = set.tickets.filter((t) => inFlight(t) && !candidates.includes(t));
  const heldIds = new Set(held.map((t) => t.id));

  // Order: running first, then explicit dependencies before their dependents, then tickets in
  // flight, then as asked.
  const order: Ticket[] = [...running];
  const pending = [...held, ...candidates.filter(inFlight), ...candidates.filter((t) => !inFlight(t))];
  while (pending.length > 0) {
    const i = pending.findIndex((t) => t.data.depends_on.every((d) => !pending.some((p) => p.id === d)));
    // A dependency cycle: lint reports it; the plan keeps the asked order.
    const [t] = pending.splice(i < 0 ? 0 : i, 1);
    if (t) order.push(t);
  }

  // First fit, in priority order: each ticket takes the earliest wave in which nothing it conflicts
  // with runs, and comes after every ticket it explicitly depends on. Independent work starts at
  // once; when two tickets conflict, the one asked first (or with the lower ID) goes first.
  const prints = new Map(order.map((t) => [t.id, footprint(spec, index, t)]));
  const wave = new Map<string, number>();
  const outside = new Map<string, { id: string; reason: string }[]>();
  const blockedIds = new Set(blocked.map((b) => b.id));
  /** Tickets that wait for a person through a dependency (R7). */
  const viaDependency = new Set<string>();
  for (const t of order) {
    if (t.data.status === 'in_progress' || heldIds.has(t.id)) {
      wave.set(t.id, 1);
      continue;
    }
    const me = prints.get(t.id);
    if (!me) continue;
    let min = 1;
    const ext: { id: string; reason: string }[] = [];
    for (const dep of t.data.depends_on) {
      const placed = wave.get(dep);
      if (placed !== undefined) {
        if (!Number.isFinite(placed)) {
          // R7: the dependency waits for a person, so this ticket does too, and so are its dependents.
          blocked.push({ id: t.id, reason: `waits for ${dep}, which waits for a person` });
          viaDependency.add(t.id);
        }
        min = Math.max(min, placed + 1);
        continue;
      }
      // A dependency outside this plan: landed, done but not merged, blocked, or not asked for.
      if (deps.landed.has(dep)) continue;
      const st = byId.get(dep)?.data.status;
      if (blockedIds.has(dep) || st === 'blocked') {
        blocked.push({ id: t.id, reason: `waits for ${dep}, which needs a person` });
        viaDependency.add(t.id);
        min = Number.POSITIVE_INFINITY;
      } else if (st !== undefined) {
        ext.push({ id: dep, reason: st === 'done' ? `${dep} is done; merge ticket/${dep} first` : `${t.id} depends on ${dep}, which is not in this plan (${st.replace('_', ' ')})` });
        min = Math.max(min, 2);
      }
    }
    const mine: { id: string; reason: string }[] = [];
    for (const other of order) {
      if (other.id === t.id || !wave.has(other.id)) continue;
      const them = prints.get(other.id);
      const why = them ? conflict(me, them) : null;
      if (why !== null) mine.push({ id: other.id, reason: why });
    }
    // R8: a ticket with no recorded stage takes a wave later than a conflicting ticket in flight, even
    // when a running ticket or a dependency holds that one back from wave 1; a dependency of the one in
    // flight is exempt, and so are running tickets and tickets in flight, which keep the R5 order.
    if (t.data.history.length === 0) {
      for (const c of mine) {
        const other = byId.get(c.id);
        const placed = wave.get(c.id);
        if (!other || placed === undefined || !Number.isFinite(placed) || !inFlight(other) || other.data.depends_on.includes(t.id)) continue;
        min = Math.max(min, placed + 1);
      }
    }
    let w = min;
    while (Number.isFinite(w) && mine.some((c) => wave.get(c.id) === w)) w++;
    // R7: a conflict with a ticket ahead that waits for a person through a dependency holds it too.
    const stuck = mine.find((c) => viaDependency.has(c.id));
    if (stuck && Number.isFinite(w)) {
      blocked.push({ id: t.id, reason: `waits for ${stuck.id}, which waits for a person` });
      w = Number.POSITIVE_INFINITY;
    }
    wave.set(t.id, w);
    outside.set(t.id, ext);
  }
  // Each ticket waits for what it conflicts with in an earlier wave, whichever was placed first.
  const after = new Map<string, { id: string; reason: string }[]>();
  for (const t of order) {
    const w = wave.get(t.id) ?? 1;
    const earlier = order.filter((o) => o.id !== t.id && (wave.get(o.id) ?? 1) < w).flatMap((o) => {
      const a = prints.get(t.id);
      const b = prints.get(o.id);
      const why = a && b ? conflict(a, b) : null;
      return why === null ? [] : [{ id: o.id, reason: why }];
    });
    after.set(t.id, [...(outside.get(t.id) ?? []), ...earlier]);
  }

  const entry = (t: Ticket): PlanEntry => ({
    id: t.id,
    type: t.data.type,
    title: t.data.title,
    stage: t.data.status === 'in_progress' ? t.data.stage : (stageOf.get(t.id) ?? null),
    wave: wave.get(t.id) ?? 1,
    after: after.get(t.id) ?? [],
  });
  const finite = (t: Ticket) => Number.isFinite(wave.get(t.id) ?? 1);
  const byWave = (a: PlanEntry, b: PlanEntry) => a.wave - b.wave || compareIds(a.id, b.id);
  const waiting = candidates.filter(finite);
  const together = groupTogether(spec, index, waiting.filter((t) => t.data.status === 'open' && t.data.history.length === 0), prints);
  return {
    spec: spec.version,
    running: running.map(entry).sort(byWave),
    now: candidates.filter((t) => finite(t) && (wave.get(t.id) ?? 1) === 1).map(entry).sort(byWave),
    later: candidates.filter((t) => finite(t) && (wave.get(t.id) ?? 1) > 1).map(entry).sort(byWave),
    blocked: [...new Map(blocked.reverse().map((b) => [b.id, b])).values()].sort((a, b) => compareIds(a.id, b.id)),
    together,
  };
}

export function renderPlan(p: Plan): string {
  const line = (e: PlanEntry, what: string) => `- ${e.id} ${e.type} · ${what} · ${e.title}`;
  const out = [`# Plan · ${p.spec}`, ''];
  out.push(`## Running (${p.running.length})`, ...(p.running.length === 0 ? ['None'] : p.running.map((e) => line(e, `stage ${e.stage ?? '?'}`))), '');
  out.push(`## Start now, in parallel (${p.now.length})`, ...(p.now.length === 0 ? ['None'] : p.now.map((e) => line(e, `next ${e.stage ?? '?'}`))), '');
  out.push(`## Later (${p.later.length})`);
  if (p.later.length === 0) out.push('None');
  for (const e of p.later) {
    out.push(line(e, `wave ${e.wave}, next ${e.stage ?? '?'}`));
    for (const a of e.after) out.push(`  after ${a.id}: ${a.reason}`);
  }
  out.push('', `## Could run together (${p.together.length})`);
  if (p.together.length === 0) out.push('None');
  for (const g of p.together) out.push(`- ${g.ids.join(' + ')} · ${g.type} · module ${g.module}, contract ${g.contract} · re-verify ${g.reach} scenarios · ${g.command}`);
  out.push('', `## Needs a person (${p.blocked.length})`, ...(p.blocked.length === 0 ? ['None'] : p.blocked.map((b) => `- ${b.id}: ${b.reason}`)), '');
  return `${out.join('\n')}\n`;
}
