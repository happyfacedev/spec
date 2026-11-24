// Format 2, review round 2 (DECISIONS X95–X104): each proposal accepted from the second round of
// structure reviews, first as a failing test.
import { describe, expect, it } from 'vitest';
import { findGaps } from '../../src/core/adopt';
import { buildBrief } from '../../src/core/brief';
import { specDelta } from '../../src/core/delta';
import { gateTicket } from '../../src/core/gate';
import { computeImpact } from '../../src/core/impact';
import { lintSpec } from '../../src/core/lint';
import { type StageContext, checkReport } from '../../src/core/report';
import { baseWith, loadFixture, report, syntheticTicket, ticketOf, validSpecWriterChecklist } from '../helpers';

const lint = (files: Record<string, string | null> = {}) => {
  const { spec, tickets } = baseWith(files);
  return lintSpec(spec, { tickets }).map((f) => `${f.rule} ${f.id ?? '-'}: ${f.message}`);
};

const ALPHA = (widget: string, extra = '') => `# alpha contracts

### alpha.Widget
Kind: entity · Status: active
One widget.

${widget}

### alpha.WidgetMade
Kind: event · Status: active
A widget was made.

#### alpha.WidgetMade.name
The new widget's name. Type: string
${extra}`;
const NAME_SIZE = "#### alpha.Widget.name\nThe widget's name. Type: string\n\n#### alpha.Widget.size\nThe widget's size. Type: number";
const ALP_PATH = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET_PATH = 'modules/beta/features/BET-001-order-a-widget.md';
const feature = (fm: string, behaviour: string, rules = 'None') => `---\n${fm}\n---\n## Intent\nMake a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\n${rules}\n\n## Out of scope\nNone\n`;
const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (R1)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';

describe('X95 member names may start with a capital (Go, C#)', () => {
  it('cart.Line.PriceCents is a member ID', () => {
    const contracts = ALPHA(NAME_SIZE.replaceAll('alpha.Widget.size', 'alpha.Widget.SizeCm'));
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.SizeCm is 2\nWhen the user orders it\nThen beta.Order.total is 20',
    );
    expect(lint({ 'modules/alpha/contracts.md': contracts, [BET_PATH]: bet })).toEqual([]);
  });
});

describe('X96 one portable type language', () => {
  const withTypes = (name: string, size: string) => ({ 'modules/alpha/contracts.md': ALPHA(`#### alpha.Widget.name\nThe widget's name. Type: ${name}\n\n#### alpha.Widget.size\nThe widget's size. Type: ${size}`, '\n### alpha.Size\nKind: type · Status: active\nA size. Type: int\n') });

  it('accepts primitives, literals, references, lists, maps, unions and null', () => {
    expect(lint(withTypes('"small" | "large" | null', 'map<string, alpha.Size[]> | (int | number)[]'))).toEqual([]);
  });

  it('refuses native spellings and inline objects, naming the portable form', () => {
    const f = lint(withTypes('{ first: string, last?: string }', 'List<int>'));
    expect(f.filter((x) => x.startsWith('L022'))).toEqual([
      'L022 alpha.Widget.name: "{ first: string, last?: string }" is not a spec type: an inline object; name it as a Kind: type contract with members',
      'L022 alpha.Widget.size: "List<int>" is not a spec type: List is not a spec type; write int[]',
    ]);
  });

  it('refuses a member without a Type, and a malformed one', () => {
    const f = lint({ 'modules/alpha/contracts.md': ALPHA("#### alpha.Widget.name\nThe widget's name.\n\n#### alpha.Widget.size\nThe widget's size. Type: typo[[<") });
    expect(f.filter((x) => x.startsWith('L022'))).toEqual([
      'L022 alpha.Widget.name: alpha.Widget.name has no Type:',
      'L022 alpha.Widget.size: "typo[[<" is not a spec type: typo is not a primitive (string, int, number, decimal, bool, bytes, date, datetime, duration, null)',
    ]);
  });
});

describe('X97 a scenario cites the invariant it checks', () => {
  const invFeature = feature(ALP_FM, `${ALP_S1}\n\n### S2: Size zero refused\nGiven no widget exists\nWhen the user makes a widget of size 0\nThen no alpha.Widget is stored (INV-001)`);

  it('impact on the invariant reaches only the scenarios that cite it', () => {
    const { spec, index } = baseWith({ [ALP_PATH]: invFeature });
    const i = computeImpact(spec, index, 'INV-001', null);
    expect(i.mustChange.find((x) => x.id === 'ALP-001')?.scenarios).toEqual(['ALP-001/S2']);
  });

  it('a cited invariant must be in the frontmatter', () => {
    const f = lint({ [ALP_PATH]: invFeature.replace('invariants: [INV-001]\n', '') });
    expect(f.filter((x) => x.startsWith('L008'))).toEqual(['L008 ALP-001/S2: ALP-001/S2 cites INV-001, which is not in invariants']);
  });
});

describe('X98 retirement is append-only', () => {
  const fx = loadFixture();
  it('the delta lists a retired number taken off the list', () => {
    const before = baseWith({ [ALP_PATH]: feature(`${ALP_FM}\nretired: [S9]`, ALP_S1, '- R1: Every widget has a size (INV-001)') }).index;
    const after = baseWith().index;
    expect(specDelta('main', before, after).unretired).toEqual(['ALP-001/S9']);
  });

  it('PIP-007/S3 A retired number stays retired', () => {
    const t = ticketOf(fx.tickets, 'PROP-201');
    const ctx: StageContext = {
      spec: fx.spec,
      index: fx.index,
      ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'spec-writer' } },
      role: 'spec-writer',
      changedPaths: ['spec/modules/providers/features/PRV-001-stream-a-reply.md'],
      specPrefix: 'spec',
      ticketsPrefix: 'tickets',
      codeGlobs: [],
      testGlobs: [],
      protectedGlobs: [],
      lint: [],
      tests: null,
      newScenarios: [],
      removed: [],
      unretired: ['PRV-001/S9'],
      specChanged: [],
      codeChanges: [],
      stubsLeft: [],
    };
    expect(checkReport(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Done.\n' + validSpecWriterChecklist()), ctx).problems).toEqual([
      'PRV-001/S9 was taken off retired; a retired number stays retired',
    ]);
  });
});

describe('X99 a tombstone may point at a tombstone; the chain ends at a current unit', () => {
  const invs = (third: string) => `# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nDecisions: ADR-001\n\n### INV-002: Widgets are blue\nStatus: deprecated · Superseded by: INV-003\nOld.\n\n### INV-003: Widgets are green\n${third}\nOld too.\n`;
  it('a chain that ends at an active unit is fine', () => {
    expect(lint({ 'core/invariants.md': invs('Status: deprecated · Superseded by: INV-001') })).toEqual([]);
  });
  it('a cycle is refused', () => {
    expect(lint({ 'core/invariants.md': invs('Status: deprecated · Superseded by: INV-002') }).filter((x) => x.startsWith('L016'))).toEqual([
      'L016 INV-002: INV-002 is superseded in a cycle: INV-002 → INV-003 → INV-002',
      'L016 INV-003: INV-003 is superseded in a cycle: INV-003 → INV-002 → INV-003',
    ]);
  });
});

describe('X100 invariants and glossary may be split into files', () => {
  it('core/invariants/*.md and core/glossary/*.md are read', () => {
    const { spec } = baseWith({
      'core/invariants/security.md': '# Security\n\n### INV-002: Sizes are never negative\nNo widget has a negative size.\n',
      'core/glossary/widgets.md': '# Widgets\n\n### Gizmo\nA small widget.\n',
    });
    expect(spec.invariants.map((i) => i.id)).toEqual(['INV-001', 'INV-002']);
    expect(spec.terms.map((t) => t.term)).toContain('Gizmo');
    // INV-002 is not used yet: nothing references it (L012), and no scenario shows it (L025).
    expect(lintSpec(spec, {}).filter((f) => f.rule !== 'L012' && f.rule !== 'L025')).toEqual([]);
  });
});

describe('X101 Code: names the code entry point, and gaps checks it', () => {
  const contracts = ALPHA(NAME_SIZE, '\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nCode: Factory.makeWidget(size)\nOutput: alpha.Widget\n\n#### alpha.MakeWidget.size\nThe size. Type: int\n');
  const alp = feature(ALP_FM.replace('emits:', 'provides: [alpha.MakeWidget]\nemits:'), ALP_S1.replace('a widget of size 2', 'a widget of size 2 through alpha.MakeWidget'));
  it('is parsed, kept out of the summary, and checked against the code', () => {
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': contracts, [ALP_PATH]: alp });
    const op = spec.contracts.find((c) => c.id === 'alpha.MakeWidget');
    expect([op?.code?.symbol, op?.summary]).toEqual(['Factory.makeWidget', 'Makes one widget.']);
    expect(findGaps(spec, index, null, [{ path: 'src/factory.ts', text: 'export class Factory { makeWidget(size: number) {} }' }]).codeNotFound).toEqual([]);
    expect(findGaps(spec, index, null, [{ path: 'src/factory.ts', text: 'export class Factory { build(size: number) {} }' }]).codeNotFound).toEqual([
      { id: 'alpha.MakeWidget', code: 'Factory.makeWidget' },
    ]);
  });
  it('prose "In code:" is format 1', () => {
    const f = lint({ 'modules/alpha/contracts.md': contracts.replace('Makes one widget.\nCode: Factory.makeWidget(size)', 'Makes one widget. In code: `Factory.makeWidget(size)`.'), [ALP_PATH]: alp });
    expect(f.filter((x) => x.startsWith('L001'))).toEqual(['L001 alpha.MakeWidget: "In code:" is format 1; write it as its own line, "Code: <symbol>"']);
  });
});

describe('X102 one spelling for a decision link', () => {
  it('invariants take Decisions:; Why: is refused', () => {
    const f = lint({ 'core/invariants.md': '# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nWhy: ADR-001\n' });
    expect(f.filter((x) => !x.startsWith('L012'))).toEqual(['L001 INV-001: "Why:" is format 1; write "Decisions: ADR-001"']);
  });
});

describe('X103 graph consumers agree on what a unit needs', () => {
  it('gaps counts a type used by a member as used', () => {
    const contracts = ALPHA(NAME_SIZE.replace("The widget's size. Type: number", "The widget's size. Type: alpha.Size"), '\n### alpha.Size\nKind: type · Status: active\nA size. Type: int\n');
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': contracts });
    expect(findGaps(spec, index, null).unusedContracts).toEqual([]);
  });

  it('the gate refuses work on a feature that uses a draft contract', () => {
    const contracts = ALPHA(NAME_SIZE).replace('Kind: entity · Status: active', 'Kind: entity · Status: active · Draft: src/widget.ts:3');
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': contracts });
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [BET-001]');
    expect(gateTicket(spec, index, 'TASK-900', t, []).blockers.map((b) => `${b.kind} ${b.id}`)).toEqual(['draft alpha.Widget']);
  });

  it('a brief that quotes one member keeps its contract head, and quotes the errors an operation returns', () => {
    const contracts = ALPHA(NAME_SIZE, '\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nOutput: alpha.Widget | alpha.TooSmall\n\n#### alpha.MakeWidget.size\nThe size. Type: int\n\n### alpha.TooSmall\nKind: error · Status: active\nThe size is below 1.\n');
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.Widget.size is 2\nWhen the user orders it through alpha.MakeWidget\nThen beta.Order.total is 20',
    );
    const { spec, index, tickets } = baseWith({ 'modules/alpha/contracts.md': contracts, [BET_PATH]: bet });
    const text = buildBrief({ spec, index, tickets, role: 'implementer', id: 'BET-001/S1' });
    expect(text).toContain('### alpha.Widget\nKind: entity · Status: active\nOne widget.\n\n#### alpha.Widget.size');
    expect(text).toContain('### alpha.TooSmall\nKind: error');
  });
});

describe('X104 a reworded scenario is not a changed behaviour', () => {
  it('PIP-007/S8 A new scenario title over the same steps is a rewording', () => {
    const before = baseWith().index;
    const after = baseWith({ [ALP_PATH]: feature(ALP_FM, ALP_S1.replace('S1: Widget made', 'S1: A widget is made'), '- R1: Every widget has a size (INV-001)') }).index;
    const d = specDelta('main', before, after);
    expect(d.changed).not.toContain('ALP-001/S1');
    expect(d.reworded).toEqual(['ALP-001/S1']);
  });
});
