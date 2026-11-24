// Format 2, review round 5 (DECISIONS X122–X127): each accepted proposal, first as a failing test.
import { describe, expect, it } from 'vitest';
import { dependencies } from '../../src/core/gate';
import { computeImpact } from '../../src/core/impact';
import { lintSpec } from '../../src/core/lint';
import { stepCites } from '../../src/core/parse/feature';
import { buildPlan } from '../../src/core/plan';
import { baseWith, fixtureFile, fixtureWith, syntheticTicket } from '../helpers';

const lint = (files: Record<string, string | null> = {}) => {
  const { spec, tickets } = baseWith(files);
  return lintSpec(spec, { tickets }).map((f) => `${f.rule} ${f.severity === 'warning' ? 'w' : 'e'} ${f.id ?? '-'}: ${f.message}`);
};
const only = (code: string, files: Record<string, string | null>) => lint(files).filter((x) => x.startsWith(code));
const feature = (fm: string, behaviour: string, rules = 'None') => `---\n${fm}\n---\n## Intent\nMake a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\n${rules}\n\n## Out of scope\nNone\n`;
const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (R1)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';
const R1 = '- R1: Every widget has a size (INV-001)';

describe('X122 impact follows a feature’s outputs to the contracts typed by them', () => {
  it('a feature that writes a type’s members still reaches the readers of the entity it is part of', () => {
    const prv = fixtureFile('modules/providers/features/PRV-002-fall-back-on-rate-limit.md')
      .replace('writes: [conversation.Message.meta]', 'writes: [conversation.DeliveryMeta.fallbackFrom, conversation.DeliveryMeta.stopReason, conversation.DeliveryMeta.retryAfterMs]')
      .replaceAll('conversation.Message.meta', 'conversation.DeliveryMeta');
    const { spec, index } = fixtureWith({ 'modules/providers/features/PRV-002-fall-back-on-rate-limit.md': prv });
    const cnv = computeImpact(spec, index, 'PRV-002', null).reverify.find((x) => x.id === 'CNV-003');
    expect(cnv?.via).toEqual(['reads conversation.Message (whole) (uses conversation.DeliveryMeta.fallbackFrom)']);
  });
});

describe('X123 a quoted string in a step is data', () => {
  it('cites nothing, in the step or in its data', () => {
    expect(stepCites('Then the exported text is "vendor.Cancelled"')).toEqual([]);
    expect(stepCites('Then alpha.Widget.name is "beta.Order"')).toEqual(['alpha.Widget.name']);
  });
});

describe('X124 an operation may pass on an external error', () => {
  const module = '---\nid: pay\nprefix: PAY\ndomain: payments\nstatus: active\nexternal: true\n---\nThe payment provider.\n\n## Owns\n- Charges\n\n## Non-goals\nNone\n';
  const contracts = '# pay contracts\n\n### pay.Charge\nKind: operation · Status: active\nCharges the shopper.\nOutput: null | pay.Declined\n\n### pay.Declined\nKind: error · Status: active\nThe provider declined the charge.\n\n### pay.Settled\nKind: event · Status: active\nThe provider settled a charge.\n';
  // The Then that names each one makes it the feature's outcome: emitted (X134).
  const bet = (extra: string) =>
    feature('id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]', `### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it through pay.Charge\nThen beta.Order.total is 20\n${extra}`);
  const files = (b: string) => ({ 'modules/pay/_module.md': module, 'modules/pay/contracts.md': contracts, [BET]: b });
  it('emitting the external error is allowed; emitting its event is not', () => {
    expect(only('L004', files(bet('And ordering fails with pay.Declined when the charge is declined')))).toEqual([]);
    expect(only('L004', files(bet('And pay.Settled is emitted')))).toEqual(['L004 e BET-001: BET-001 emits pay.Settled, which belongs to external module pay']);
  });
});

describe('X125 an invariant no scenario can show says how it is checked', () => {
  it('Shown by: silences L025', () => {
    const invs = '# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nDecisions: ADR-001\n\n### INV-002: A widget page loads within 2 s\nApplies to: alpha.Widget\nShown by: the load benchmark in CI\nThe p95 load time stays under 2 s.\n';
    const alp = feature(ALP_FM.replace('[INV-001]', '[INV-001, INV-002]'), ALP_S1, R1);
    expect(lint({ 'core/invariants.md': invs, [ALP]: alp })).toEqual([]);
    expect(only('L025', { 'core/invariants.md': invs.replace('Shown by: the load benchmark in CI\n', ''), [ALP]: alp })).toEqual(['L025 w INV-002: no scenario shows INV-002']);
  });
});

describe('X127 two proposals on one feature run one after the other', () => {
  it('their new scenario numbers would collide', () => {
    const { spec, index } = baseWith();
    const a = syntheticTicket('id: PROP-901\ntype: proposal\ntitle: a\nstatus: open\ntouches: [BET-001]');
    const b = syntheticTicket('id: PROP-902\ntype: proposal\ntitle: b\nstatus: open\ntouches: [BET-001]');
    const plan = buildPlan(spec, index, { tickets: [a, b], findings: [] }, dependencies([a, b], new Set(), new Set()));
    expect(plan.later.map((p) => `${p.id} after ${p.after.map((x) => `${x.id}: ${x.reason}`).join('; ')}`)).toEqual([
      'PROP-902 after PROP-901: both add to BET-001, so their new scenario and rule numbers would collide',
    ]);
  });
});
