// GRF-010 through the CLI: `spec impact <ID> --format json` on chat-mini, or on a throwaway git copy
// of it with the one edit a scenario needs. ALP-001 comes from the lint-case base, which has it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FIXTURE, LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** A throwaway git copy of `fixture` with `edit` applied to it before git sees it. */
function copyOf(edit?: (dir: string) => void, fixture = FIXTURE): Fx {
  const fx = gitFixture('spec-impact-scenarios', { fixture, setup: edit });
  made.push(fx);
  return fx;
}

const patch = (dir: string, path: string, from: string, to: string) => {
  const file = join(dir, path);
  const text = readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`${path}: no "${from}" to change`);
  writeFileSync(file, text.replace(from, to));
};

const PRV_002 = 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
const INVARIANTS = 'spec/core/invariants.md';
const ALP_001 = 'spec/modules/alpha/features/ALP-001-make-a-widget.md';

const TWO_SCENARIOS = [
  '### S1: Widget made',
  'Given no widget exists',
  'When the user makes a widget of size 2',
  'Then alpha.Widget holds a widget of size 2',
  '',
  '### S2: Second widget refused',
  'Given a widget exists',
  'When the user makes another widget',
  'Then no second widget is stored',
].join('\n');

/** Rewrites ALP-001 of the lint base: `front` is its frontmatter lines, `steps` its Behaviour. */
const withAlp001 = (front: string, steps: string) => (dir: string) => {
  writeFileSync(join(dir, ALP_001), `---\nid: ALP-001\ntitle: Make a widget\nmodule: alpha\n${front}---\n## Intent\nMake a widget when the user asks for one.\n\n## Behaviour\n${steps}\n\n## Rules\nNone\n\n## Out of scope\nNone\n`);
};

const QUESTION_CITES_INV_001 = 'status: active\nwrites: [alpha.Widget]\nquestions:\n  - id: Q1\n    kind: preference\n    text: Should a widget have a colour as well as a size?\n    default: Leave it out.\n    cites: [INV-001]\n    answer: null\n    raised_by: null\n';

interface Item {
  id: string;
  via: string[];
  scenarios: string[];
}

async function impactOf(fx: Fx, id: string): Promise<{ mustChange: Item[]; reverify: Item[] }> {
  const out = await fx.spec('', 'impact', id, '--format', 'json');
  expect(out.code).toBe(0);
  return JSON.parse(out.stdout) as { mustChange: Item[]; reverify: Item[] };
}

const ring = (items: Item[]) => Object.fromEntries(items.map((i) => [i.id, i.scenarios]));
const item = (items: Item[], id: string) => items.find((i) => i.id === id);

describe('GRF-010: Reach of a change to an invariant, decision or screen', () => {
  it('GRF-010/S1 An invariant reaches the scenarios that cite it', async () => {
    const r = await impactOf(copyOf(), 'INV-001');
    expect(ring(r.mustChange)).toEqual({ 'CNV-001': ['CNV-001/S2'], 'PRV-002': ['PRV-002/S4'], 'SET-001': ['SET-001/S2'] });
    expect(item(r.mustChange, 'PRV-002')?.via).toEqual(['PRV-002/R1 cites INV-001', 'PRV-002/S4 cites INV-001', 'invariants INV-001']);
    expect(r.reverify).toEqual([]);
  }, 60_000);

  it('GRF-010/S2 A feature that lists an invariant no step cites has every scenario reached', async () => {
    const r = await impactOf(copyOf(), 'INV-002');
    const set002 = item(r.mustChange, 'SET-002');
    expect(set002?.via).toContain('invariants INV-002');
    expect(set002?.scenarios).toEqual(['SET-002/S1', 'SET-002/S2']);
  }, 60_000);

  it('GRF-010/S3 An invariant cited only through a rule reaches the scenarios that cite that rule', async () => {
    const fx = copyOf((dir) => {
      patch(dir, PRV_002, '"gpt" is never called (INV-001, R1)', '"gpt" is never called (R1)');
    });
    const r = await impactOf(fx, 'INV-001');
    const prv = item(r.mustChange, 'PRV-002');
    expect(prv?.via).toContain('PRV-002/R1 cites INV-001');
    expect(prv?.via).toContain('invariants INV-001');
    expect(prv?.scenarios).toEqual(['PRV-002/S4']);
  }, 60_000);

  it('GRF-010/S4 A question that cites an invariant reaches its feature', async () => {
    const fx = copyOf(withAlp001(QUESTION_CITES_INV_001, TWO_SCENARIOS), LINT_BASE);
    const r = await impactOf(fx, 'INV-001');
    const alp = item(r.mustChange, 'ALP-001');
    expect(alp?.via).toContain('ALP-001#Q1 cites INV-001');
    expect(alp?.scenarios).toEqual(['ALP-001/S1', 'ALP-001/S2']);
  }, 60_000);

  it('GRF-010/S5 A decision reaches every scenario of the features that list it', async () => {
    const r = await impactOf(copyOf(), 'ADR-002');
    const prv = item(r.mustChange, 'PRV-002');
    expect(prv?.via).toContain('decisions ADR-002');
    expect(prv?.scenarios).toEqual(['PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4']);
  }, 60_000);

  it('GRF-010/S6 A decision reaches the contracts that name it', async () => {
    const fx = copyOf();
    const adr2 = await impactOf(fx, 'ADR-002');
    const cfg = item(adr2.mustChange, 'providers.ProviderConfig');
    expect(cfg?.via).toContain('decisions ADR-002');
    expect(cfg?.scenarios).toEqual([]);
    const adr1 = await impactOf(fx, 'ADR-001');
    expect(adr1.mustChange.map((i) => i.id)).toEqual(['conversation.Message']);
    expect(adr1.mustChange[0]?.scenarios).toEqual([]);
  }, 60_000);

  it('GRF-010/S7 A decision reaches the invariants that name it', async () => {
    const fx = copyOf((dir) => {
      patch(dir, INVARIANTS, 'This holds for the active provider and for the fallback.\n', 'This holds for the active provider and for the fallback.\nDecisions: ADR-001\n');
    });
    const r = await impactOf(fx, 'ADR-001');
    const inv = item(r.mustChange, 'INV-001');
    expect(inv?.via).toContain('decisions ADR-001');
    expect(inv?.scenarios).toEqual([]);
  }, 60_000);

  it('GRF-010/S8 A screen reaches only the scenarios that show it', async () => {
    const r = await impactOf(copyOf(), 'UI-001');
    expect(r.mustChange).toEqual([{ id: 'PRV-002', via: ['PRV-002/S1 cites UI-001', 'ui UI-001'], scenarios: ['PRV-002/S1'] }]);
    expect(r.reverify).toEqual([]);
  }, 60_000);

  it('GRF-010/S9 A screen no step shows reaches its feature with no scenarios', async () => {
    const fx = copyOf(withAlp001('status: active\nwrites: [alpha.Widget]\nui: [UI-001]\n', TWO_SCENARIOS), LINT_BASE);
    const r = await impactOf(fx, 'UI-001');
    const alp = item(r.mustChange, 'ALP-001');
    expect(alp?.via).toContain('ui UI-001');
    expect(alp?.scenarios).toEqual([]);
  }, 60_000);

  it('GRF-010/S10 A removed feature is not reached', async () => {
    // Control: the same feature, live, is reached; only its status differs in the removed case.
    const live = await impactOf(copyOf(withAlp001('status: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\n', TWO_SCENARIOS), LINT_BASE), 'INV-001');
    expect(item(live.mustChange, 'ALP-001')).toBeDefined();
    const removed = await impactOf(copyOf(withAlp001('status: removed\ninvariants: [INV-001]\n', 'None'), LINT_BASE), 'INV-001');
    expect(removed.mustChange.map((i) => i.id)).not.toContain('ALP-001');
  }, 60_000);

  it('GRF-010/S11 An invariant cited directly and through a rule reaches both sets of scenarios', async () => {
    const fx = copyOf((dir) => {
      patch(dir, PRV_002, '"gpt" is never called (INV-001, R1)', '"gpt" is never called (INV-001)');
      patch(dir, PRV_002, 'Then "gpt" is called with the same messages as "claude"\n', 'Then "gpt" is called with the same messages as "claude" (R1)\n');
    });
    const r = await impactOf(fx, 'INV-001');
    const prv = item(r.mustChange, 'PRV-002');
    expect(prv?.via).toEqual(['PRV-002/R1 cites INV-001', 'PRV-002/S4 cites INV-001', 'invariants INV-001']);
    expect(prv?.scenarios).toEqual(['PRV-002/S1', 'PRV-002/S4']);
  }, 60_000);
});
