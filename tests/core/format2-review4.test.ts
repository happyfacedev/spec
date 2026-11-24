// Format 2, review round 4 (DECISIONS X114–X121): each accepted proposal, first as a failing test.
import { describe, expect, it } from 'vitest';
import { findGaps } from '../../src/core/adopt';
import { buildBrief } from '../../src/core/brief';
import { specDelta } from '../../src/core/delta';
import { moduleDependencies } from '../../src/core/graph';
import { computeImpact } from '../../src/core/impact';
import { lintSpec } from '../../src/core/lint';
import { type StageContext, checkReport } from '../../src/core/report';
import { baseWith, loadFixture, report, ticketOf, validSpecWriterChecklist } from '../helpers';

const lint = (files: Record<string, string | null> = {}) => {
  const { spec, tickets } = baseWith(files);
  return lintSpec(spec, { tickets }).map((f) => `${f.rule} ${f.severity === 'warning' ? 'w' : 'e'} ${f.id ?? '-'}: ${f.message}`);
};
const only = (code: string, files: Record<string, string | null>) => lint(files).filter((x) => x.startsWith(code));

const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const INVS = 'core/invariants.md';
const feature = (fm: string, behaviour: string, rules = 'None', outOfScope = 'None') =>
  `---\n${fm}\n---\n## Intent\nMake a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\n${rules}\n\n## Out of scope\n${outOfScope}\n`;
const BET_FM = 'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active';
const bet = (links: string, behaviour: string) => feature(`${BET_FM}\n${links}`, behaviour);
const BET_S1 = '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20';
const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (R1)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';
const R1 = '- R1: Every widget has a size (INV-001)';
const INV1 = (extra = '') => `# Invariants\n\n### INV-001: A widget always has a size\n${extra}No widget is stored without a size.\nDecisions: ADR-001\n`;

function stageCtx(after: ReturnType<typeof baseWith>, d: ReturnType<typeof specDelta>, path: string): StageContext {
  const t = ticketOf(loadFixture().tickets, 'PROP-201');
  return {
    spec: after.spec,
    index: after.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'spec-writer' } },
    role: 'spec-writer',
    changedPaths: [`spec/${path}`],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: [],
    testGlobs: [],
    protectedGlobs: [],
    lint: [],
    tests: null,
    newScenarios: [],
    removed: d.removed,
    unretired: d.unretired,
    specChanged: [...d.added, ...d.changed],
    codeChanges: [],
    stubsLeft: [],
  };
}
const SPEC_DONE = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Done.\n' + validSpecWriterChecklist('ALP-001/S1'));

describe('X114 observes: a contract the scenarios only set up or check', () => {
  const observer = bet('observes: [alpha.Widget.size, alpha.WidgetMade]\nwrites: [beta.Order.total]', BET_S1);
  it('takes any kind, lints clean, and adds no module dependency', () => {
    const { spec } = baseWith({ [BET]: observer });
    expect(lintSpec(spec, {})).toEqual([]);
    expect(moduleDependencies(spec)).toEqual([]);
    expect(moduleDependencies(baseWith().spec)).toEqual([['beta', 'alpha']]);
  });
  it('impact re-verifies the scenarios that observe it', () => {
    const { spec, index } = baseWith({ [BET]: observer });
    expect(computeImpact(spec, index, 'alpha.Widget.size', null).reverify).toEqual([{ id: 'BET-001', via: ['observes alpha.Widget.size'], scenarios: ['BET-001/S1'] }]);
  });
  it('an event cited only in a Then is the outcome (emitted, X134); a scenario that only checks it observes it', () => {
    const s1 = '### S1: Order priced by size\nGiven alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20\nAnd alpha.WidgetMade was emitted before';
    const emits = (links: string) => baseWith({ [BET]: bet(links, s1) }).spec.features.find((f) => f.id === 'BET-001')?.links.emits.map((r) => r.id);
    expect(emits('writes: [beta.Order.total]')).toEqual(['alpha.WidgetMade']);
    expect(emits('writes: [beta.Order.total]\nobserves: [alpha.WidgetMade]')).toEqual([]);
  });
  it('a write is an outcome, cited in a Then; a provided operation in a When', () => {
    const s1 = '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd beta.Order.total is 0\nWhen the user orders a widget of alpha.Widget.size 2\nThen the order is placed';
    expect(only('L008', { [BET]: bet('writes: [beta.Order.total]', s1) })).toEqual(['L008 e BET-001: BET-001 writes beta.Order.total, but no Then step cites it']);
  });
  it('And and But take the keyword before them', () => {
    expect(lint({ [BET]: bet('writes: [beta.Order.total]', `${BET_S1}\nBut beta.Order.total is not negative`) })).toEqual([]);
  });
});

describe('X115 an invariant says what it applies to', () => {
  const applies = INV1('Applies to: alpha.Widget.size\n');
  it('lints clean; a target that is missing, or not a contract, is an error', () => {
    expect(lint({ [INVS]: applies })).toEqual([]);
    expect(only('L004', { [INVS]: INV1('Applies to: alpha.Widget.weight, ALP-001\n') })).toEqual([
      'L004 e INV-001: INV-001 applies ALP-001, which is a feature',
      'L004 e INV-001: INV-001 applies alpha.Widget.weight, which does not exist',
    ]);
  });
  it('impact on the contract reaches the invariant and the scenarios that show it', () => {
    const { spec, index } = baseWith({ [INVS]: applies });
    const i = computeImpact(spec, index, 'alpha.Widget.size', null);
    expect(i.reverify.find((x) => x.id === 'INV-001')).toEqual({ id: 'INV-001', via: ['INV-001 applies to alpha.Widget.size'], scenarios: ['ALP-001/S1'] });
  });
  it('a brief that quotes the contract quotes the invariant, though the feature does not list it', () => {
    const { spec, index, tickets } = baseWith({ [INVS]: applies });
    expect(buildBrief({ spec, index, tickets, role: 'implementer', id: 'BET-001/S1' })).toContain('### INV-001: A widget always has a size');
    const plain = baseWith();
    expect(buildBrief({ spec: plain.spec, index: plain.index, tickets: plain.tickets, role: 'implementer', id: 'BET-001/S1' })).not.toContain('### INV-001');
  });
});

describe('X116 every invariant is shown by a scenario', () => {
  const two = `${INV1()}\n### INV-002: An order is never negative\nNo order total is below 0.\n`;
  it('an invariant no scenario cites, directly or through a rule, is a warning', () => {
    const alp = feature(ALP_FM.replace('[INV-001]', '[INV-001, INV-002]'), ALP_S1, R1);
    expect(only('L025', { [INVS]: two, [ALP]: alp })).toEqual(['L025 w INV-002: no scenario shows INV-002']);
  });
  it('PIP-007/S6 A changed invariant needs a changed scenario', () => {
    const before = baseWith().index;
    const after = baseWith({ [INVS]: INV1().replace('without a size', 'without a size above 0') });
    const d = specDelta('main', before, after.index);
    expect(checkReport(SPEC_DONE, stageCtx(after, d, INVS)).problems).toEqual([
      'INV-001 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new invariant, or add one',
    ]);
  });
});

describe('X117 one type per member; a literal is never a reference', () => {
  const contracts = (name: string) =>
    `# alpha contracts\n\n### alpha.Widget\nKind: entity · Status: active\nOne widget.\n\n${name}\n\n#### alpha.Widget.size\nThe widget's size. Type: number\n\n### alpha.WidgetMade\nKind: event · Status: active\nA widget was made.\n\n#### alpha.WidgetMade.name\nThe new widget's name. Type: string\n`;
  it('two Type: lines on one member are an error', () => {
    expect(only('L022', { 'modules/alpha/contracts.md': contracts("#### alpha.Widget.name\nThe widget's name. Type: string\nStored as Type: bytes") })).toEqual([
      'L022 e alpha.Widget.name: alpha.Widget.name has 2 Type: lines; a member has one type',
    ]);
  });
  it('an ID-shaped string literal names no contract', () => {
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': contracts('#### alpha.Widget.name\nThe widget\'s name. Type: "vendor.Cancelled" | "done"') });
    expect(lintSpec(spec, {})).toEqual([]);
    expect(index.links.filter((l) => l.kind === 'uses')).toEqual([]);
  });
});

describe('X118 removed is final', () => {
  it('PIP-007/S4 A removed unit never comes back', () => {
    const dead = INV1().replace('No widget is stored', 'Status: removed\nNo widget is stored');
    const before = baseWith({ [INVS]: dead }).index;
    const after = baseWith();
    const d = specDelta('main', before, after.index);
    expect(d.unretired).toEqual(['INV-001']);
    expect(checkReport(SPEC_DONE, stageCtx(after, d, INVS)).problems).toContain('INV-001 was removed and is active again; a removed ID is never reused, so give the new unit a new ID');
  });
});

describe('X119 an external module records another system’s contracts', () => {
  const module = '---\nid: pay\nprefix: PAY\ndomain: payments\nstatus: active\nexternal: true\n---\nThe payment provider, as this product uses it.\n\n## Owns\n- Charges\n\n## Non-goals\nNone\n';
  const contracts = '# pay contracts\n\n### pay.Charge\nKind: operation · Status: active\nCharges the shopper.\nOutput: null | pay.Declined\n\n### pay.Declined\nKind: error · Status: active\nThe provider declined the charge.\n';
  const caller = bet('writes: [beta.Order.total]', `${BET_S1}\nAnd pay.Charge charges 20`);
  const files = { 'modules/pay/_module.md': module, 'modules/pay/contracts.md': contracts, [BET]: caller };
  it('its operations need no provider here, and it needs no features', () => {
    expect(lint(files)).toEqual([]);
    const { spec, index } = baseWith(files);
    expect(findGaps(spec, index, null).modulesWithoutFeatures).toEqual([]);
  });
  it('a feature may not provide its operations, nor live in it', () => {
    const alp = feature(ALP_FM.replace('writes: [alpha.Widget]', 'writes: [alpha.Widget]\nprovides: [pay.Charge]'), `${ALP_S1}\nAnd pay.Declined is emitted`, R1).replace('When the user makes', 'When pay.Charge runs and the user makes');
    // Emitting its error is allowed since X124: an operation may pass an external error on.
    expect(only('L004', { ...files, [ALP]: alp })).toEqual(['L004 e ALP-001: ALP-001 provides pay.Charge, which belongs to external module pay']);
    const own = feature('id: PAY-001\ntitle: Charge\nmodule: pay\nstatus: active', '### S1: Charged\nGiven a cart\nWhen paying\nThen it is paid');
    expect(only('L001', { ...files, 'modules/pay/features/PAY-001-charge.md': own })).toEqual([
      'L001 e PAY-001: PAY-001 is in external module pay; an external module holds only the contracts this product uses',
    ]);
  });
});

describe('X120 an ID written in prose must exist', () => {
  it('a missing one is a warning; a ticket ID is not checked', () => {
    const alp = feature(ALP_FM, ALP_S1, R1, '- Bulk orders: see BET-099 and PROP-777');
    expect(only('L026', { [ALP]: alp })).toEqual(['L026 w ALP-001: ALP-001 mentions BET-099, which does not exist']);
  });
});

describe('X121 a native type’s fix keeps its meaning', () => {
  const contracts = (t: string) =>
    `# alpha contracts\n\n### alpha.Widget\nKind: entity · Status: active\nOne widget.\n\n#### alpha.Widget.name\nThe widget's name. Type: ${t}\n\n#### alpha.Widget.size\nThe widget's size. Type: number\n\n### alpha.WidgetMade\nKind: event · Status: active\nA widget was made.\n\n#### alpha.WidgetMade.name\nThe new widget's name. Type: string\n`;
  it('Optional names both readings; Set keeps uniqueness as a rule', () => {
    expect(only('L022', { 'modules/alpha/contracts.md': contracts('Optional<string>') })).toEqual([
      'L022 e alpha.Widget.name: "Optional<string>" is not a spec type: Optional is not a spec type; write string? (may be absent) or string | null (may be null)',
    ]);
    expect(only('L022', { 'modules/alpha/contracts.md': contracts('Set<string>') })).toEqual([
      'L022 e alpha.Widget.name: "Set<string>" is not a spec type: Set is not a spec type; write string[], and state that items are unique as a rule',
    ]);
  });
});
