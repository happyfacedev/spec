// Format 2, review round 6 (DECISIONS X128–X133): each accepted proposal, first as a failing test.
import { describe, expect, it } from 'vitest';
import { specDelta } from '../../src/core/delta';
import { gateTicket } from '../../src/core/gate';
import { lintSpec } from '../../src/core/lint';
import { type StageContext, checkReport } from '../../src/core/report';
import { baseWith, loadFixture, report, syntheticTicket, ticketOf, validSpecWriterChecklist } from '../helpers';

const lint = (files: Record<string, string | null> = {}) => {
  const { spec, tickets } = baseWith(files);
  return lintSpec(spec, { tickets }).map((f) => `${f.rule} ${f.severity === 'warning' ? 'w' : 'e'} ${f.id ?? '-'}: ${f.message}`);
};
const only = (code: string, files: Record<string, string | null>) => lint(files).filter((x) => x.startsWith(code));
const feature = (fm: string, behaviour: string, rules = 'None', outOfScope = 'None') =>
  `---\n${fm}\n---\n## Intent\nMake a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\n${rules}\n\n## Out of scope\n${outOfScope}\n`;
const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (R1)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';
const R1 = '- R1: Every widget has a size (INV-001)';
const CONTRACTS = (extra: string) =>
  `# alpha contracts\n\n### alpha.Widget\nKind: entity · Status: active\nOne widget.\n\n#### alpha.Widget.name\nThe widget's name. Type: string\n\n#### alpha.Widget.size\nThe widget's size. Type: number\n\n### alpha.WidgetMade\nKind: event · Status: active\nA widget was made.\n\n#### alpha.WidgetMade.name\nThe new widget's name. Type: string\n${extra}`;
const MAKE = '\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nCode: Factory.makeWidget\nOutput: alpha.Widget\n\n#### alpha.MakeWidget.size\nThe size to make. Type: number\n';

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

describe('X128 Code: names a symbol; the members are the inputs', () => {
  it('a parameter list is refused', () => {
    expect(lint({ 'modules/alpha/contracts.md': CONTRACTS(MAKE) })).toEqual(['L012 w alpha.MakeWidget: nothing references alpha.MakeWidget']);
    expect(only('L001', { 'modules/alpha/contracts.md': CONTRACTS(MAKE.replace('Code: Factory.makeWidget', 'Code: Factory.makeWidget(size)')) })).toEqual([
      'L001 e alpha.MakeWidget: "Code: Factory.makeWidget(size)" holds a signature; Code: names the symbol, and the members are its inputs',
    ]);
  });
});

describe('X129 a contract’s shape fits its kind', () => {
  it('a type has a Type: or members, not both; an entity, event or error has no Type: or Output:; an operation no Type:', () => {
    const c = CONTRACTS('\n### alpha.Size\nKind: type · Status: active\nA size. Type: int\n\n#### alpha.Size.unit\nThe unit. Type: string\n\n### alpha.Gone\nKind: error · Status: active\nIt is gone.\nType: string\n\n### alpha.Make\nKind: operation · Status: active\nMakes one.\nType: string\n');
    expect(only('L022', { 'modules/alpha/contracts.md': c })).toEqual([
      'L022 e alpha.Size: type alpha.Size has both a Type: and members; it is one or the other',
      'L022 e alpha.Gone: error alpha.Gone has a Type: line; an error is described by its members',
      'L022 e alpha.Make: operation alpha.Make has a Type: line; an operation has members and an Output:',
    ]);
  });
});

describe('X130 a removed module holds no live units', () => {
  it('a live feature or contract in a removed module is an error; in a deprecated one, a warning', () => {
    const mod = (status: string) => `---\nid: alpha\nprefix: ALP\ndomain: make\nstatus: ${status}\n---\nMakes widgets.\n\n## Owns\n- Widgets\n\n## Non-goals\nNone\n`;
    expect(only('L005', { 'modules/alpha/_module.md': mod('removed') })).toEqual([
      'L005 e alpha.Widget: active alpha.Widget is in removed module alpha',
      'L005 e alpha.WidgetMade: active alpha.WidgetMade is in removed module alpha',
      'L005 e ALP-001: active ALP-001 is in removed module alpha',
    ]);
    expect(only('L005', { 'modules/alpha/_module.md': mod('deprecated') }).map((x) => x.slice(0, 7))).toEqual(['L005 w ', 'L005 w ', 'L005 w ']);
    const { spec, index } = baseWith({ 'modules/alpha/_module.md': mod('removed') });
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [ALP-001]');
    expect(gateTicket(spec, index, 'TASK-900', t, []).blockers.map((b) => `${b.kind} ${b.id}`)).toEqual(['removed alpha']);
  });
});

describe('X131 one feature provides an operation', () => {
  it('two providers are a warning', () => {
    const alp = feature(ALP_FM.replace('writes: [alpha.Widget]', 'writes: [alpha.Widget]\nprovides: [alpha.MakeWidget]'), ALP_S1.replace('When the user makes', 'When alpha.MakeWidget runs as the user makes'), R1);
    const bet = feature('id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]\nprovides: [alpha.MakeWidget]', '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it through alpha.MakeWidget\nThen beta.Order.total is 20');
    expect(only('L012', { 'modules/alpha/contracts.md': CONTRACTS(MAKE), [ALP]: alp, [BET]: bet })).toEqual([
      'L012 w alpha.MakeWidget: alpha.MakeWidget is provided by ALP-001 and BET-001; one feature implements an operation',
    ]);
  });
});

describe('X132 a prose ID is checked only when its prefix is the spec’s', () => {
  it('SHA-256 and ISO-8601 are names, not IDs; BET-099 still warns', () => {
    const alp = feature(ALP_FM, ALP_S1, R1, '- Hashing widget names with SHA-256 or dating them by ISO-8601\n- Bulk orders, which BET-099 handles');
    expect(only('L026', { [ALP]: alp })).toEqual(['L026 w ALP-001: ALP-001 mentions BET-099, which does not exist']);
  });
});

describe('X133 a screen’s states and copy are behaviour; its layout is not', () => {
  const ui = (copy: string, layout = 'A card with the widget\'s name and size.') => `---\nid: UI-001\ntitle: Widget card\nstatus: active\n---\n## Layout\n${layout}\n\n## States\n- Made: the card is shown.\n\n## Copy\n- Title: "${copy}"\n`;
  const SPEC_DONE = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Done.\n' + validSpecWriterChecklist('ALP-001/S1'));
  it('PIP-007/S7 A screen whose states or copy changed needs a changed scenario', () => {
    const before = baseWith({ 'ui/UI-001-widget-card.md': ui('Your widget') }).index;
    const after = baseWith({ 'ui/UI-001-widget-card.md': ui('Widget ready') });
    const d = specDelta('main', before, after.index);
    expect(checkReport(SPEC_DONE, stageCtx(after, d, 'ui/UI-001-widget-card.md')).problems).toEqual([
      'UI-001 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new screen, or add one',
    ]);
  });
  it('PIP-007/S7 A screen layout-only change is a rewording', () => {
    const before = baseWith({ 'ui/UI-001-widget-card.md': ui('Your widget') }).index;
    const after = baseWith({ 'ui/UI-001-widget-card.md': ui('Your widget', 'A wide card.') });
    const d = specDelta('main', before, after.index);
    expect([d.changed, d.reworded]).toEqual([[], ['UI-001']]);
    expect(checkReport(SPEC_DONE, stageCtx(after, d, 'ui/UI-001-widget-card.md')).problems).toEqual([]);
  });
});
