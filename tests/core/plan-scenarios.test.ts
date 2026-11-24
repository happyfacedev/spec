// TKT-011: one test per scenario of spec plan.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { dependencies } from '../../src/core/gate';
import type { TicketSet } from '../../src/core/model';
import { parseSpec } from '../../src/core/parse/spec';
import { computeImpact } from '../../src/core/impact';
import { buildPlan, renderPlan } from '../../src/core/plan';
import { buildIndex } from '../../src/core/units';
import { loadDir } from '../../src/io/fs';
import { LINT_BASE, fixtureFile, fixtureWith, gitFixture, loadFixture, syntheticTicket, tempDir } from '../helpers';

const fx = loadFixture();
const withTickets = (...extra: ReturnType<typeof syntheticTicket>[]): TicketSet => ({ tickets: [...fx.tickets.tickets, ...extra], findings: [] });
const noDeps = (set: TicketSet) => dependencies(set.tickets, new Set(), new Set());
const plan = (set: TicketSet, ...ids: string[]) => buildPlan(fx.spec, fx.index, set, noDeps(set), ids.length > 0 ? ids : null);
const setStatus = (set: TicketSet, id: string, status: 'done' | 'in_progress', stage: 'tester' | null = null): TicketSet => ({
  ...set,
  tickets: set.tickets.map((x) => (x.id === id ? { ...x, data: { ...x.data, status, stage } } : x)),
});
const waits = (e: { after: readonly { id: string; reason: string }[] } | undefined) => e?.after.map((a) => [a.id, a.reason]);
/** The proposals with a recorded spec-writer stage, so their reach is what their touches say (R9). */
const specced = (set: TicketSet, ...ids: string[]): TicketSet => ({
  ...set,
  tickets: set.tickets.map((x) => (ids.includes(x.id) ? { ...x, data: { ...x.data, history: [{ at: '2026-10-27T12:00:00.000Z', role: 'spec-writer' as const, result: 'done' as const, summary: 'spec', verdict: null, assumed: [] }] } } : x)),
});

type PlanRow = { id: string; after: { id: string }[] };
type PlanGroup = { ids: string[]; type: string; module: string; contract: string; reach: number; command: string };

const cli = gitFixture('spec-plan-scenarios');
const scratch: string[] = [];
afterAll(() => {
  cli.cleanup();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

const moduleFiles = (dir: string, id: string, prefix: string) => {
  mkdirSync(join(dir, `spec/modules/${id}/features`), { recursive: true });
  writeFileSync(join(dir, `spec/modules/${id}/_module.md`), `---\nid: ${id}\nprefix: ${prefix}\ndomain: make\nstatus: active\n---\nThe ${id} module.\n\n## Owns\n- Things\n\n## Non-goals\nNone\n`);
};
const featureFile = (dir: string, module: string, id: string, reads: string[], scenarios = 1) => {
  const body = Array.from({ length: scenarios }, (_, i) => `### S${i + 1}: Case ${i + 1}\nGiven a thing\nWhen it runs\nThen it is done\n`).join('\n');
  writeFileSync(
    join(dir, `spec/modules/${module}/features/${id}-feature.md`),
    `---\nid: ${id}\ntitle: Feature ${id}\nmodule: ${module}\nstatus: active\nreads: [${reads.join(', ')}]\n---\n## Intent\nDo a thing.\n\n## Behaviour\n${body}\n## Rules\nNone\n\n## Out of scope\nNone\n`,
  );
};
const loadScratch = (dir: string) => {
  const spec = parseSpec(loadDir(join(dir, 'spec')));
  return { spec, index: buildIndex(spec) };
};

/**
 * A mkdtemp spec of `features` active features: AAA-001 and AAA-002, both in the module app, read
 * only out.Result.code, and `codeReaders` features in all read it (AAA-001, AAA-002, then OUT-xxx);
 * the rest read nothing.
 */
function wideSpec(codeReaders: number, features: number) {
  const dir = tempDir('spec-plan-wide-');
  scratch.push(dir);
  cpSync(join(LINT_BASE, 'spec'), join(dir, 'spec'), { recursive: true });
  for (const [id, prefix] of [['app', 'AAA'], ['out', 'OUT'], ['fill', 'FIL']] as const) moduleFiles(dir, id, prefix);
  writeFileSync(join(dir, 'spec/modules/out/contracts.md'), '# out contracts\n\n### out.Result\nKind: entity · Status: active\nA result.\n\n#### out.Result.code\nThe code. Type: number\n');
  featureFile(dir, 'app', 'AAA-001', ['out.Result.code']);
  featureFile(dir, 'app', 'AAA-002', ['out.Result.code']);
  const pad = (n: number) => String(n).padStart(3, '0');
  for (let i = 1; i <= codeReaders - 2; i++) featureFile(dir, 'out', `OUT-${pad(i)}`, ['out.Result.code']);
  for (let i = 1; i <= features - codeReaders; i++) featureFile(dir, 'fill', `FIL-${pad(i)}`, []);
  return loadScratch(dir);
}

/** Two features of `scenarios` scenarios each, both reading the whole contract big.Thing. */
function bigSpec(scenarios: number) {
  const dir = tempDir('spec-plan-big-');
  scratch.push(dir);
  cpSync(join(LINT_BASE, 'spec'), join(dir, 'spec'), { recursive: true });
  moduleFiles(dir, 'big', 'BIG');
  writeFileSync(join(dir, 'spec/modules/big/contracts.md'), '# big contracts\n\n### big.Thing\nKind: entity · Status: active\nA thing.\n\n#### big.Thing.x\nThe x. Type: number\n');
  featureFile(dir, 'big', 'BIG-001', ['big.Thing'], scenarios);
  featureFile(dir, 'big', 'BIG-002', ['big.Thing'], scenarios);
  return loadScratch(dir);
}

describe('spec plan scenarios', () => {
  it('TKT-011/S1 The whole plan', async () => {
    const out = await cli.spec('', 'plan');
    expect(out.stdout).toBe(readFileSync(join(import.meta.dirname, '__snapshots__/chat-mini.plan.txt'), 'utf8'));
    expect(out.code).toBe(0);
    // No proposal has had its spec stage, so PROP-202 and PROP-205 conflict only with PROP-201; PROP-201 waits in wave 2, so they fit wave 1 by first fit although they come after it by ID (R5, R9).
    const now = out.stdout.slice(out.stdout.indexOf('## Start now'), out.stdout.indexOf('## Later'));
    expect(now).toBe(
      [
        '## Start now, in parallel (6)',
        '- BUG-301 bug · next tester · Fallback moves on to a third provider',
        '- PROP-202 proposal · next spec-writer · List enabled providers in the model picker',
        '- PROP-205 proposal · next spec-writer · Add a copy-message action',
        '- TASK-101 task · next implementer · Extract provider selection into its own module',
        '- TASK-102 task · next implementer · Record which provider produced each message',
        '- TASK-103 task · next implementer · Simplify the fallback code',
        '',
        '',
      ].join('\n'),
    );
    // PROP-201 is the only ticket in Later, in wave 2 after the six (R2, R3, R5).
    const later = out.stdout.slice(out.stdout.indexOf('## Later'), out.stdout.indexOf('## Could run together'));
    expect(later).toBe(
      [
        '## Later (1)',
        '- PROP-201 proposal · wave 2, next spec-writer · Add a "gemini" fake provider',
        '  after BUG-301: BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)',
        '  after PROP-202: both add to SET-001, so their new scenario and rule numbers would collide',
        '  after PROP-205: PROP-205 works on CNV-001, which PROP-201 reaches (observes settings.ApiKey (whole) (uses providers.ProviderId) ← providers.ProviderId)',
        '  after TASK-101: TASK-101 works on PRV-001, which PROP-201 reaches (emits providers.RateLimited (whole) (uses providers.ProviderId) ← providers.ProviderId)',
        '  after TASK-102: TASK-102 works on CNV-002, which PROP-201 reaches (writes conversation.Message.meta (uses providers.ProviderId) ← providers.ProviderId)',
        '  after TASK-103: TASK-103 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)',
        '',
        '',
      ].join('\n'),
    );
    // R9: no after line in the plan says "may reach".
    expect(out.stdout).not.toContain('may reach');
  }, 30_000);

  it('TKT-011/S2 A proposal reaches what another ticket works on', () => {
    const p = plan(fx.tickets, 'PROP-201', 'BUG-301');
    const e = p.later.find((x) => x.id === 'BUG-301');
    expect(e?.wave).toBe(2);
    expect(waits(e)).toEqual([['PROP-201', 'BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)']]);
  });

  it('TKT-011/S3 Two proposals on one feature', () => {
    const p = plan(fx.tickets, 'PROP-202', 'PROP-201');
    expect(p.now.map((e) => e.id)).toContain('PROP-202');
    expect(waits(p.later.find((e) => e.id === 'PROP-201'))).toContainEqual(['PROP-202', 'both add to SET-001, so their new scenario and rule numbers would collide']);
  });

  it('TKT-011/S4 Bugs and tasks share features freely', () => {
    const p = plan(fx.tickets, 'BUG-301', 'TASK-103');
    expect(p.now.map((e) => e.id)).toEqual(['BUG-301', 'TASK-103']);
    expect(p.later).toEqual([]);
  });

  it('TKT-011/S5 A proposal that changes no shared unit reaches nothing', () => {
    expect(plan(specced(fx.tickets, 'PROP-205'), 'PROP-205', 'BUG-301').now.map((e) => e.id)).toEqual(['BUG-301', 'PROP-205']);
  });

  it('TKT-011/S6 Both change one unit', () => {
    const prop = syntheticTicket('id: PROP-946\ntype: proposal\ntitle: Change the invariant\nstatus: open\ntouches: [INV-001]');
    const task = syntheticTicket('id: TASK-946\ntype: task\ntitle: Work on it\nstatus: open\ntouches: [INV-001, PRV-001]');
    const p = plan(withTickets(prop, task), 'PROP-946', 'TASK-946');
    expect(waits(p.later.find((e) => e.id === 'TASK-946'))).toEqual([['PROP-946', 'both change INV-001']]);
  });

  it('TKT-011/S19 A ticket in conflict with one that waits for a person', () => {
    const bug = syntheticTicket('id: BUG-950\ntype: bug\ntitle: Waits\nstatus: open\nviolates: [PRV-002/S3]\ndepends_on: [PROP-206]');
    const task = syntheticTicket('id: TASK-961\ntype: task\ntitle: After PROP-201\nstatus: open\ntouches: [CNV-003]\ndepends_on: [PROP-201]');
    const p = plan({ tickets: [bug, task, ...fx.tickets.tickets], findings: [] });
    expect(p.blocked).toContainEqual({ id: 'BUG-950', reason: 'waits for PROP-206, which needs a person' });
    expect(p.blocked).toContainEqual({ id: 'PROP-201', reason: 'waits for BUG-950, which waits for a person' });
    expect(p.blocked).toContainEqual({ id: 'TASK-961', reason: 'waits for PROP-201, which waits for a person' });
    const listed = [...p.now, ...p.later].map((e) => e.id);
    expect(listed).not.toContain('PROP-201');
    expect(listed).not.toContain('TASK-961');
    // None of these is in flight (no unmerged stage), so R7's in-flight exception (S23) does not apply.
    const named = [...p.running, ...p.now, ...p.later].flatMap((e) => e.after.map((a) => a.id));
    for (const id of ['PROP-201', 'TASK-961', 'BUG-950']) expect(named).not.toContain(id);
  });

  it('TKT-011/S7 depends_on always orders two tickets', () => {
    const a = syntheticTicket('id: TASK-901\ntype: task\ntitle: A\nstatus: open\ntouches: [CNV-003]\ndepends_on: [TASK-902]');
    const b = syntheticTicket('id: TASK-902\ntype: task\ntitle: B\nstatus: open\ntouches: [SET-002]');
    const p = plan(withTickets(a, b), 'TASK-901', 'TASK-902');
    expect(p.now.map((e) => e.id)).toEqual(['TASK-902']);
    const e = p.later.find((x) => x.id === 'TASK-901');
    expect(e?.wave).toBe(2);
    expect(waits(e)).toEqual([['TASK-902', 'TASK-901 depends on TASK-902']]);
  });

  it('TKT-011/S8 The order asked decides who goes first', () => {
    const p = plan(fx.tickets, 'PROP-201', 'BUG-301');
    expect(p.now.map((e) => e.id)).toEqual(['PROP-201']);
    expect(p.later.map((e) => e.id)).toEqual(['BUG-301']);
  });

  it('TKT-011/S9 Independent tickets start together', () => {
    expect(plan(specced(fx.tickets, 'PROP-205'), 'BUG-301', 'PROP-205', 'TASK-103').now.map((e) => e.id)).toEqual(['BUG-301', 'PROP-205', 'TASK-103']);
  });

  it('TKT-011/S10 A running ticket holds its place', () => {
    const p = plan(setStatus(specced(fx.tickets, 'PROP-201', 'PROP-205'), 'PROP-201', 'in_progress', 'tester'), 'BUG-301', 'PROP-205');
    expect(p.running.map((e) => [e.id, e.stage, e.wave])).toEqual([['PROP-201', 'tester', 1]]);
    expect(p.now).toEqual([]);
    expect(p.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([
      ['BUG-301', 2, ['PROP-201']],
      ['PROP-205', 2, ['PROP-201']],
    ]);
  });

  it('TKT-011/S11 First fit', () => {
    // The spec-writer stages of PROP-201 and PROP-205 are recorded and their branches merged into the base branch, so neither is in flight (R8).
    const set = setStatus(specced(fx.tickets, 'PROP-201', 'PROP-205'), 'BUG-301', 'in_progress', 'tester');
    const merged = new Set(['PROP-201', 'PROP-205']);
    const p = buildPlan(fx.spec, fx.index, set, dependencies(set.tickets, merged, merged), ['PROP-201', 'PROP-205', 'TASK-103']);
    expect(p.now.map((e) => e.id)).toEqual(['PROP-205', 'TASK-103']);
    expect(p.later.find((e) => e.id === 'PROP-201')?.after.map((a) => a.id)).toEqual(['BUG-301', 'PROP-205', 'TASK-103']);
  });

  it('TKT-011/S27 A ticket held in flight keeps its place ahead of tickets with no recorded stage', () => {
    // PROP-201 is open with a recorded spec-writer stage on an unmerged branch; BUG-301 runs and conflicts with it; TASK-102 has no stage and conflicts with PROP-201 only.
    const set = setStatus(specced(fx.tickets, 'PROP-201'), 'BUG-301', 'in_progress', 'tester');
    const flight = (merged: readonly string[]) => dependencies(set.tickets, new Set(['PROP-201']), new Set(merged));
    const p = buildPlan(fx.spec, fx.index, set, flight([]), ['PROP-201', 'TASK-102']);
    expect(p.running.map((e) => [e.id, e.wave])).toEqual([['BUG-301', 1]]);
    expect(p.now).toEqual([]);
    expect(p.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([
      ['PROP-201', 2, ['BUG-301']],
      ['TASK-102', 3, ['PROP-201']],
    ]);
    expect(p.later.find((e) => e.id === 'PROP-201')?.after.map((a) => a.id)).not.toContain('TASK-102');
    // Once ticket/PROP-201 is merged into the base branch, PROP-201 is no longer in flight.
    const merged = buildPlan(fx.spec, fx.index, set, flight(['PROP-201']), ['PROP-201', 'TASK-102']);
    expect(merged.now.map((e) => [e.id, e.wave])).toEqual([['TASK-102', 1]]);
    expect(merged.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([['PROP-201', 2, ['BUG-301', 'TASK-102']]]);
  });

  it('TKT-011/S28 Running tickets, dependencies and other tickets in flight keep their order', () => {
    const dep = syntheticTicket('id: TASK-901\ntype: task\ntitle: Before PROP-201\nstatus: open\ntouches: [CNV-003]');
    const set = specced(withTickets(dep), 'PROP-201', 'PROP-202');
    const wired: TicketSet = { ...set, tickets: set.tickets.map((x) => (x.id === 'PROP-201' ? { ...x, data: { ...x.data, depends_on: ['TASK-901'] } } : x)) };
    const p = buildPlan(fx.spec, fx.index, wired, dependencies(wired.tickets, new Set(['PROP-201', 'PROP-202']), new Set()), ['PROP-202', 'PROP-201', 'TASK-901']);
    expect(p.now.map((e) => [e.id, e.wave])).toEqual([
      ['PROP-202', 1],
      ['TASK-901', 1],
    ]);
    const late = p.later.find((e) => e.id === 'PROP-201');
    expect(late?.wave).toBe(2);
    expect(waits(late)).toEqual([
      ['PROP-202', 'both add to SET-001, so their new scenario and rule numbers would collide'],
      ['TASK-901', 'PROP-201 depends on TASK-901'],
    ]);
  });

  it('TKT-011/S12 A dependency outside the plan', () => {
    const dep = syntheticTicket('id: TASK-901\ntype: task\ntitle: After BUG-301\nstatus: open\ntouches: [CNV-003]\ndepends_on: [BUG-301]');
    const set = setStatus(withTickets(dep), 'BUG-301', 'done');
    const p = buildPlan(fx.spec, fx.index, set, dependencies(set.tickets, new Set(['BUG-301']), new Set()), ['TASK-901']);
    const e = p.later.find((x) => x.id === 'TASK-901');
    expect(e?.wave).toBe(2);
    expect(waits(e)).toEqual([['BUG-301', 'BUG-301 is done; merge ticket/BUG-301 first']]);
  });

  it('TKT-011/S13 A dependency that is open but not in the plan', () => {
    const dep = syntheticTicket('id: TASK-901\ntype: task\ntitle: After BUG-301\nstatus: open\ntouches: [CNV-003]\ndepends_on: [BUG-301]');
    const e = plan(withTickets(dep), 'TASK-901').later.find((x) => x.id === 'TASK-901');
    expect(e?.wave).toBe(2);
    expect(waits(e)).toEqual([['BUG-301', 'TASK-901 depends on BUG-301, which is not in this plan (open)']]);
  });

  it('TKT-011/S14 A dependency that needs a person', () => {
    const dep = syntheticTicket('id: TASK-901\ntype: task\ntitle: After PROP-206\nstatus: open\ntouches: [CNV-003]\ndepends_on: [PROP-206]');
    expect(plan(withTickets(dep)).blocked).toContainEqual({ id: 'TASK-901', reason: 'waits for PROP-206, which needs a person' });
  });

  it('TKT-011/S15 A ticket that is not in the store', async () => {
    expect(plan(fx.tickets, 'PROP-999').blocked).toEqual([{ id: 'PROP-999', reason: 'PROP-999 is not a ticket' }]);
    expect((await cli.spec('', 'plan', 'PROP-999')).code).toBe(0);
  }, 30_000);

  it('TKT-011/S16 An argument that is not a ticket ID', async () => {
    const out = await cli.spec('', 'plan', 'PRV-001');
    expect(out.stderr.startsWith('Unknown PRV-001.')).toBe(true);
    expect(out.code).toBe(2);
  }, 30_000);

  it('TKT-011/S17 Done tickets are left out', () => {
    const p = plan(setStatus(fx.tickets, 'TASK-101', 'done'));
    const ids = [...p.running, ...p.now, ...p.later, ...p.blocked].map((e) => e.id);
    expect(ids).not.toContain('TASK-101');
  });

  it('TKT-011/S18 The JSON result', async () => {
    const out = await cli.spec('', 'plan', '--format', 'json');
    const p = JSON.parse(out.stdout) as {
      now: { id: string; wave: number; after: unknown[] }[];
      later: { id: string; type: string; stage: string; wave: number; after: { id: string; reason: string }[] }[];
    };
    const e = p.later.find((x) => x.id === 'PROP-201');
    expect(e).toMatchObject({ type: 'proposal', stage: 'spec-writer', wave: 2 });
    expect(e?.after).toHaveLength(6);
    expect(e?.after[1]).toEqual({ id: 'PROP-202', reason: 'both add to SET-001, so their new scenario and rule numbers would collide' });
    // R5, R9: before their spec stage PROP-202 and PROP-205 conflict only with PROP-201, which asked later, so they take wave 1.
    for (const id of ['PROP-202', 'PROP-205']) expect(p.now.find((x) => x.id === id)).toMatchObject({ wave: 1, after: [] });
  }, 30_000);

  it('TKT-011/S24 Absorbed tickets are left out', async () => {
    const abs = gitFixture('spec-plan-absorbed', {
      setup: (dir) => {
        const file = join(dir, 'tickets/PROP-202.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace('status: open', 'status: absorbed\nabsorbed_into: PROP-201'));
      },
    });
    try {
      for (const argv of [['plan'], ['plan', 'PROP-202', 'PROP-201']]) {
        const out = await abs.spec('', ...argv, '--format', 'json');
        const p = JSON.parse(out.stdout) as { running: PlanRow[]; now: PlanRow[]; later: PlanRow[]; blocked: { id: string }[] };
        const entries = [...p.running, ...p.now, ...p.later];
        expect([...entries, ...p.blocked].map((e) => e.id)).not.toContain('PROP-202');
        expect(entries.flatMap((e) => e.after.map((a) => a.id))).not.toContain('PROP-202');
        if (argv.length > 1) expect(p.now.map((e) => e.id)).toContain('PROP-201');
      }
    } finally {
      abs.cleanup();
    }
  }, 60_000);

  it("TKT-011/S22 Before its spec stage, a proposal's footprint is what it touches", () => {
    // CNV-003 reads conversation.Message.content, which CNV-001 writes and CNV-002 reads: that widens nothing before the spec stage.
    // The fixture's CNV-002 writes the member too, which would give PROP-950 a scope gap after its spec stage, so it only reads it here.
    const cnv002 = 'modules/conversation/features/CNV-002-stop-a-reply.md';
    const original = fixtureFile(cnv002);
    const writesLine = 'writes: [conversation.Message.content, conversation.Message.meta]';
    if (!original.includes(writesLine)) throw new Error('CNV-002 is not as the fixture has it');
    const prv001 = 'modules/providers/features/PRV-001-stream-a-reply.md';
    const prvOriginal = fixtureFile(prv001);
    const prvWritesLine = 'writes: [conversation.Message.content]';
    if (!prvOriginal.includes(prvWritesLine)) throw new Error('PRV-001 is not as the fixture has it');
    const reader = fixtureWith({
      [cnv002]: original.replace(writesLine, 'reads: [conversation.Message.content]\nwrites: [conversation.Message.meta]'),
      [prv001]: prvOriginal.replace(prvWritesLine, 'reads: [conversation.Message.content]'),
    });
    const plan = (set: TicketSet, ...ids: string[]) => buildPlan(reader.spec, reader.index, set, noDeps(set), ids);
    const prop = syntheticTicket('id: PROP-950\ntype: proposal\ntitle: Export nothing for nothing\nstatus: open\ntouches: [CNV-001, CNV-003]');
    const task = syntheticTicket('id: TASK-950\ntype: task\ntitle: Tidy the send path\nstatus: open\ntouches: [CNV-001]');
    const other = syntheticTicket('id: PROP-951\ntype: proposal\ntitle: Change the meta\nstatus: open\ntouches: [CNV-002]');
    const before = plan(withTickets(prop, task, other), 'PROP-950', 'TASK-950', 'PROP-951');
    expect(before.now.map((e) => e.id)).toEqual(['PROP-950', 'PROP-951', 'TASK-950']);
    expect(before.later).toEqual([]);

    // Once the spec-writer stage of PROP-950 is recorded with conversation.Message.content in changed, it reaches CNV-001 and CNV-002.
    const changed = syntheticTicket('id: PROP-950\ntype: proposal\ntitle: Export nothing for nothing\nstatus: open\ntouches: [CNV-001, CNV-003]\nchanged: [conversation.Message.content]');
    const after = plan(specced(withTickets(changed, task, other), 'PROP-950'), 'PROP-950', 'TASK-950', 'PROP-951');
    expect(after.now.map((e) => e.id)).toEqual(['PROP-950']);
    expect(after.later.map((e) => [e.id, e.after.map((a) => a.id)])).toEqual([['PROP-951', ['PROP-950']], ['TASK-950', ['PROP-950']]]);
    expect(waits(after.later.find((e) => e.id === 'TASK-950'))?.[0]?.[1]?.startsWith('TASK-950 works on CNV-001, which PROP-950 reaches (')).toBe(true);
    expect(waits(after.later.find((e) => e.id === 'PROP-951'))?.[0]?.[1]?.startsWith('PROP-951 works on CNV-002, which PROP-950 reaches (')).toBe(true);

    // Two proposals that touch CNV-003 never run together, before and after any stage (R3).
    const twin = syntheticTicket('id: PROP-952\ntype: proposal\ntitle: Export differently\nstatus: open\ntouches: [CNV-003]');
    const collide = [['PROP-950', 'both add to CNV-003, so their new scenario and rule numbers would collide']];
    expect(waits(plan(withTickets(prop, twin), 'PROP-950', 'PROP-952').later.find((e) => e.id === 'PROP-952'))).toEqual(collide);
    expect(waits(plan(specced(withTickets(prop, twin), 'PROP-950'), 'PROP-950', 'PROP-952').later.find((e) => e.id === 'PROP-952'))).toEqual(collide);

    // A bug on CNV-003 and TASK-950 start together, before and after any stage (R4).
    const bug = syntheticTicket('id: BUG-950\ntype: bug\ntitle: Export bug\nstatus: open\nviolates: [CNV-003/S1]');
    expect(plan(withTickets(bug, task), 'BUG-950', 'TASK-950').now.map((e) => e.id)).toEqual(['BUG-950', 'TASK-950']);
    expect(plan(specced(withTickets(bug, task), 'BUG-950'), 'BUG-950', 'TASK-950').now.map((e) => e.id)).toEqual(['BUG-950', 'TASK-950']);
  });

  it('TKT-011/S25 A widely used contract neither holds a proposal back nor groups tickets', () => {
    const a = syntheticTicket('id: PROP-960\ntype: proposal\ntitle: Change AAA-001\nstatus: open\ntouches: [AAA-001]');
    const b = syntheticTicket('id: PROP-961\ntype: proposal\ntitle: Change AAA-002\nstatus: open\ntouches: [AAA-002]');
    const set: TicketSet = { tickets: [a, b], findings: [] };
    const run = (codeReaders: number, features: number) => {
      const s = wideSpec(codeReaders, features);
      return buildPlan(s.spec, s.index, set, noDeps(set), ['PROP-960', 'PROP-961']);
    };

    // 40 active features, 12 read out.Result.code (more than a tenth, at least 10): it groups nothing.
    const wide = run(12, 40);
    expect(wide.now.map((e) => e.id)).toEqual(['PROP-960', 'PROP-961']);
    expect(wide.together).toEqual([]);

    // Only 9 read it, or 130 active features (12 is not more than a tenth): it groups the two, and still holds neither back.
    for (const [codeReaders, features] of [[9, 40], [12, 130]] as const) {
      const narrow = run(codeReaders, features);
      expect(narrow.together).toHaveLength(1);
      expect(narrow.together[0]).toMatchObject({ ids: ['PROP-960', 'PROP-961'], type: 'proposal', contract: 'out.Result' });
      expect(narrow.now.map((e) => e.id)).toEqual(['PROP-960', 'PROP-961']);
      expect(narrow.later).toEqual([]);
    }
  });

  it('TKT-011/S26 Tickets that could run together', async () => {
    const out = await cli.spec('', 'plan');
    const text = out.stdout;
    const lines = [
      '- PROP-201 + PROP-202 · proposal · module settings, contract providers.ProviderConfig · re-verify 13 scenarios · spec ticket combine PROP-201 PROP-202',
      '- TASK-101 + TASK-102 + TASK-103 · task · module providers, contract conversation.Message · re-verify 4 scenarios · spec ticket combine TASK-101 TASK-102 TASK-103',
    ];
    const at = text.indexOf('## Could run together (2)\n');
    expect(at).toBeGreaterThan(text.indexOf('## Later (1)'));
    expect(text.slice(at)).toMatch(new RegExp(`^## Could run together \\(2\\)\\n${lines.map((l) => l.replace(/[+·]/g, '\\$&')).join('\\n')}\\n\\n## Needs a person`));

    const json = JSON.parse((await cli.spec('', 'plan', '--format', 'json')).stdout) as { now: PlanRow[]; later: (PlanRow & { wave: number })[]; together: PlanGroup[] };
    expect(json.together).toEqual([
      { ids: ['PROP-201', 'PROP-202'], type: 'proposal', module: 'settings', contract: 'providers.ProviderConfig', reach: 13, command: 'spec ticket combine PROP-201 PROP-202' },
      { ids: ['TASK-101', 'TASK-102', 'TASK-103'], type: 'task', module: 'providers', contract: 'conversation.Message', reach: 4, command: 'spec ticket combine TASK-101 TASK-102 TASK-103' },
    ]);
    // PROP-206 (Needs a person), PROP-205 and BUG-301 are in no group.
    expect(json.together.flatMap((g) => g.ids)).toEqual(['PROP-201', 'PROP-202', 'TASK-101', 'TASK-102', 'TASK-103']);
    // Advice only: waves and after lines are S1's.
    expect(json.now.map((e) => e.id)).toEqual(['BUG-301', 'PROP-202', 'PROP-205', 'TASK-101', 'TASK-102', 'TASK-103']);
    expect(json.later.map((e) => [e.id, e.wave, e.after.map((a) => a.id)])).toEqual([['PROP-201', 2, ['BUG-301', 'PROP-202', 'PROP-205', 'TASK-101', 'TASK-102', 'TASK-103']]]);
  }, 60_000);

  it('TKT-011/S26 A group stays at most 60 scenarios to re-verify; with no group the section says None', () => {
    const together = (scenarios: number) => {
      const s = bigSpec(scenarios);
      const a = syntheticTicket('id: TASK-970\ntype: task\ntitle: Tidy BIG-001\nstatus: open\ntouches: [BIG-001]');
      const b = syntheticTicket('id: TASK-971\ntype: task\ntitle: Tidy BIG-002\nstatus: open\ntouches: [BIG-002]');
      const set: TicketSet = { tickets: [a, b], findings: [] };
      const p = buildPlan(s.spec, s.index, set, noDeps(set), null);
      return { p, groups: (p as unknown as { together?: PlanGroup[] }).together, text: renderPlan(p) };
    };
    // 30 + 30 = 60: still small enough.
    const ok = together(30);
    expect(ok.groups).toEqual([{ ids: ['TASK-970', 'TASK-971'], type: 'task', module: 'big', contract: 'big.Thing', reach: 60, command: 'spec ticket combine TASK-970 TASK-971' }]);
    expect(ok.text).toContain('## Could run together (1)\n- TASK-970 + TASK-971 · task · module big, contract big.Thing · re-verify 60 scenarios · spec ticket combine TASK-970 TASK-971\n');
    // 31 + 31 = 62: joining would take it above 60, so both stay out.
    const over = together(31);
    expect(over.groups).toEqual([]);
    expect(over.text).toContain('## Later (0)\nNone\n\n## Could run together (0)\nNone\n\n## Needs a person');
    expect(over.p.now.map((e) => e.id)).toEqual(['TASK-970', 'TASK-971']);
  });

  it('TKT-011/S26 Two tickets with empty re-verify lists count their own features, 31 + 31 = 62, and are not grouped', () => {
    const s = bigSpec(31);
    const a = syntheticTicket('id: TASK-970\ntype: task\ntitle: Tidy BIG-001\nstatus: open\ntouches: [BIG-001]');
    const b = syntheticTicket('id: TASK-971\ntype: task\ntitle: Tidy BIG-002\nstatus: open\ntouches: [BIG-002]');
    // Each ticket's own spec impact has nothing to re-verify (the features only read the contract).
    for (const t of [a, b]) expect(computeImpact(s.spec, s.index, t.id, t).reverify).toEqual([]);
    const set: TicketSet = { tickets: [a, b], findings: [] };
    const p = buildPlan(s.spec, s.index, set, noDeps(set), null);
    expect(p.now.map((e) => e.id)).toEqual(['TASK-970', 'TASK-971']);
    expect(p.together).toEqual([]);
    expect(renderPlan(p)).toContain('## Could run together (0)\nNone\n');
  });
});
