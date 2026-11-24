// spec plan: a ticket whose branch holds a recorded stage not merged into main is in flight,
// whatever its status, and a ticket that conflicts with it waits after it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
type PlanJson = { blocked: { id: string; reason: string }[]; now: { id: string }[]; later: { id: string; wave: number; after: { id: string; reason: string }[] }[] };

const fixtures: Fx[] = [];
afterAll(() => {
  for (const f of fixtures) f.cleanup();
});

/** Puts a recorded spec-writer stage on branch ticket/PROP-201, which stays unmerged. */
function holdStage(f: Fx, status: 'open' | 'blocked'): void {
  f.git('checkout', '-q', '-b', 'ticket/PROP-201');
  const path = join(f.repo, 'tickets/PROP-201.md');
  const entry = '  - at: 2026-10-27T10:00:00.000Z\n    role: spec-writer\n    result: done\n    summary: Specified it\n    verdict: null\n    assumed: []\n';
  let text = readFileSync(path, 'utf8').replace('history: []\n', `history:\n${entry}`).replace('status: open', `status: ${status}`);
  if (status === 'blocked') {
    text = text.replace('questions: []\n', 'questions:\n  - id: Q1\n    kind: blocker\n    text: Which providers?\n    default: null\n    cites: []\n    answer: null\n    raised_by: spec-writer\n');
  }
  writeFileSync(path, text);
  f.git('add', '-A');
  f.git('commit', '-q', '-m', `PROP-201 spec-writer: Specified it`);
  f.git('checkout', '-q', 'main');
}

const plan = async (f: Fx, ...ids: string[]) => JSON.parse((await f.spec('', 'plan', ...ids, '--format', 'json')).stdout) as PlanJson;

describe('spec plan with tickets in flight', () => {
  it('TKT-011/S20 An open ticket with an unmerged stage holds its place', async () => {
    const f = gitFixture('spec-plan-flight-open');
    fixtures.push(f);
    holdStage(f, 'open');
    const p = await plan(f, 'PROP-202', 'PROP-201');
    expect(p.now.map((e) => e.id)).toContain('PROP-201');
    expect(p.now.map((e) => e.id)).not.toContain('PROP-202');
    const held = p.later.find((e) => e.id === 'PROP-202');
    expect(held?.wave).toBe(2);
    expect(held?.after).toEqual([{ id: 'PROP-201', reason: 'both add to SET-001, so their new scenario and rule numbers would collide' }]);
  }, 60_000);

  it('TKT-011/S21 A blocked ticket with an unmerged stage holds its place until it is merged', async () => {
    const f = gitFixture('spec-plan-flight-blocked');
    fixtures.push(f);
    holdStage(f, 'blocked');
    const p = await plan(f, 'BUG-301');
    expect(p.now).toEqual([]);
    const held = p.later.find((e) => e.id === 'BUG-301');
    expect(held?.wave).toBe(2);
    expect(held?.after.map((a) => a.id)).toEqual(['PROP-201']);

    const merged = f.git('merge', '-q', 'ticket/PROP-201');
    expect(merged.code, merged.stderr).toBe(0);
    const after = await plan(f, 'BUG-301');
    expect(after.now.map((e) => e.id)).toEqual(['BUG-301']);
  }, 60_000);

  it('TKT-011/S23 A ticket that waits for a person while in flight', async () => {
    const f = gitFixture('spec-plan-flight-person');
    fixtures.push(f);
    holdStage(f, 'blocked');
    const out = await f.spec('', 'plan', 'PROP-201', 'BUG-301');
    expect(out.code).toBe(0);
    const p = JSON.parse((await f.spec('', 'plan', 'PROP-201', 'BUG-301', '--format', 'json')).stdout) as PlanJson;
    expect(p.blocked.map((b) => b.id)).toEqual(['PROP-201']);
    expect([...p.now, ...p.later].map((e) => e.id)).not.toContain('PROP-201');
    const held = p.later.find((e) => e.id === 'BUG-301');
    expect(held?.wave).toBe(2);
    expect(held?.after.map((a) => a.id)).toEqual(['PROP-201']);
    const sections = out.stdout.split(/^## /m).slice(1);
    const listed = sections.filter((s) => /^- PROP-201\b/m.test(s));
    expect(listed).toHaveLength(1);
    expect(listed[0]?.startsWith('Needs a person')).toBe(true);
  }, 60_000);
});
