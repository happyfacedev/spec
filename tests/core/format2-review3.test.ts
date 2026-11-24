// Format 2, review round 3 (DECISIONS X105–X113): each accepted proposal, first as a failing test.
import { describe, expect, it } from 'vitest';
import { findGaps } from '../../src/core/adopt';
import { specDelta } from '../../src/core/delta';
import { gateTicket } from '../../src/core/gate';
import { computeImpact } from '../../src/core/impact';
import { lintSpec } from '../../src/core/lint';
import { type StageContext, checkReport } from '../../src/core/report';
import { baseWith, loadFixture, report, syntheticTicket, ticketOf, validSpecWriterChecklist } from '../helpers';

const lint = (files: Record<string, string | null> = {}) => {
  const { spec, tickets } = baseWith(files);
  return lintSpec(spec, { tickets }).map((f) => `${f.rule} ${f.severity === 'warning' ? 'w' : 'e'} ${f.id ?? '-'}: ${f.message}`);
};

const contracts = (widget: string, extra = '') =>
  `# alpha contracts\n\n### alpha.Widget\nKind: entity · Status: active\nOne widget.\n\n${widget}\n\n### alpha.WidgetMade\nKind: event · Status: active\nA widget was made.\n\n#### alpha.WidgetMade.name\nThe new widget's name. Type: string\n${extra}`;
const NAME_SIZE = "#### alpha.Widget.name\nThe widget's name. Type: string\n\n#### alpha.Widget.size\nThe widget's size. Type: number";
const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const feature = (fm: string, behaviour: string, rules = 'None') => `---\n${fm}\n---\n## Intent\nMake a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\n${rules}\n\n## Out of scope\nNone\n`;
const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (R1)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';
const R1 = '- R1: Every widget has a size (INV-001)';

describe('base', () => {
  it('the base spec lints with no findings', () => {
    expect(lint()).toEqual([]);
  });
});

describe('X105 a member may be absent (T?), apart from null', () => {
  it('T? and (A | B)? are accepted on members; decimal is a primitive', () => {
    const c = contracts("#### alpha.Widget.name\nThe widget's name. Type: string?\n\n#### alpha.Widget.size\nThe widget's size. Type: (decimal | null)?");
    expect(lint({ 'modules/alpha/contracts.md': c })).toEqual([]);
  });
  it('a bare union before ? is ambiguous, and only a member may be optional', () => {
    const c = contracts("#### alpha.Widget.name\nThe widget's name. Type: string | null?\n\n#### alpha.Widget.size\nThe widget's size. Type: number", '\n### alpha.Size\nKind: type · Status: active\nA size. Type: int?\n');
    expect(lint({ 'modules/alpha/contracts.md': c }).filter((x) => x.startsWith('L022'))).toEqual([
      'L022 e alpha.Widget.name: "string | null?" is not a spec type: ? makes the whole type optional; write (string | null)?',
      'L022 e alpha.Size: "int?" is not a spec type: only a member may be optional (?)',
    ]);
  });
});

describe('X106 active, deprecated (still served), removed (tombstone)', () => {
  const widget = (status: string) => contracts(NAME_SIZE.replace("#### alpha.Widget.size\n", `#### alpha.Widget.size\nStatus: ${status} · Superseded by: alpha.Widget.name\n`));
  it('a link to a deprecated unit is a warning; to a removed one, an error', () => {
    expect(lint({ 'modules/alpha/contracts.md': widget('deprecated') }).filter((x) => x.startsWith('L005'))).toEqual([
      'L005 w BET-001: active BET-001 reads alpha.Widget.size, which is deprecated',
      'L005 w BET-001/S1: active BET-001/S1 cites alpha.Widget.size, which is deprecated',
    ]);
    expect(lint({ 'modules/alpha/contracts.md': widget('removed') }).filter((x) => x.startsWith('L005'))).toEqual([
      'L005 e BET-001: active BET-001 reads alpha.Widget.size, which is removed',
      'L005 e BET-001/S1: active BET-001/S1 cites alpha.Widget.size, which is removed',
    ]);
  });
  it('a deprecated feature is still served: impact reaches it, and the gate lets a bug fix it', () => {
    const bet = (status: string) => baseWith({ [BET]: lintFeatureBet(status) });
    const dep = bet('deprecated');
    expect(computeImpact(dep.spec, dep.index, 'alpha.Widget.size', null).reverify.map((x) => x.id)).toEqual(['BET-001']);
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [BET-001]');
    expect(gateTicket(dep.spec, dep.index, 'TASK-900', t, []).blockers).toEqual([]);
    const rem = baseWith({ [BET]: removedBet });
    expect(gateTicket(rem.spec, rem.index, 'TASK-900', t, []).blockers.map((b) => `${b.kind} ${b.id}`)).toEqual(['removed BET-001']);
  });
  it('a removed feature holds no scenarios: they are retired, and Behaviour may be None', () => {
    // beta.Order loses its only writer, so it is an orphan now: true, and only a warning.
    expect(lint({ [BET]: removedBet }).filter((x) => !x.startsWith('L012'))).toEqual([]);
    expect(lint({ [BET]: lintFeatureBet('removed') }).filter((x) => x.startsWith('L006'))).toEqual(['L006 e BET-001: removed BET-001 still holds S1; retire it (retired: [S1]) and write None under ## Behaviour']);
  });
  it('a removed unit may point at a removed one; a deprecated unit points at a live replacement', () => {
    const invs = '# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nDecisions: ADR-001\n\n### INV-002: Old\nStatus: removed · Superseded by: INV-003\nOld.\n\n### INV-003: Older\nStatus: removed\nGone, with no replacement.\n';
    expect(lint({ 'core/invariants.md': invs })).toEqual([]);
    const dep = invs.replace('Status: removed · Superseded by: INV-003', 'Status: deprecated · Superseded by: INV-003');
    expect(lint({ 'core/invariants.md': dep }).filter((x) => x.startsWith('L016'))).toEqual(['L016 e INV-002: deprecated INV-002 is superseded by INV-003, which is removed; point it at the unit that replaces it now']);
  });
});

const lintFeatureBet = (status: string) =>
  feature(
    `id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: ${status}\nwrites: [beta.Order.total]`,
    '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20',
  );
const removedBet = feature('id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: removed\nretired: [S1]', 'None');

describe('X107 a step cites the rule it shows', () => {
  it('a rule no scenario cites is a warning', () => {
    expect(lint({ [ALP]: feature(ALP_FM, ALP_S1.replace(' (R1)', ''), R1) }).filter((x) => x.startsWith('L023'))).toEqual(['L023 w ALP-001/R1: no scenario of ALP-001 shows ALP-001/R1']);
  });
  it('both (R1) and the full ID cite it', () => {
    const { spec } = baseWith({ [ALP]: feature(ALP_FM, ALP_S1.replace('(R1)', '(ALP-001/R1)'), R1) });
    expect(spec.features.find((f) => f.id === 'ALP-001')?.scenarios[0]?.cites.map((c) => c.id)).toContain('ALP-001/R1');
  });
  it('PIP-007/S5 A changed rule needs a changed scenario', () => {
    const before = baseWith().index;
    const after = baseWith({ [ALP]: feature(ALP_FM, ALP_S1, '- R1: Every widget has a size of at least 2 (INV-001)') });
    const d = specDelta('main', before, after.index);
    const fx = loadFixture();
    const t = ticketOf(fx.tickets, 'PROP-201');
    const ctx: StageContext = {
      spec: after.spec,
      index: after.index,
      ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'spec-writer' } },
      role: 'spec-writer',
      changedPaths: [`spec/${ALP}`],
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
    expect(checkReport(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Done.\n' + validSpecWriterChecklist('ALP-001/S1')), ctx).problems).toEqual([
      'ALP-001/R1 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new rule, or add one',
    ]);
  });
});

describe('PIP-007 stage comparisons', () => {
  it('PIP-007/S9 A rule nothing shows may change alone', () => {
    const before = baseWith().index;
    const after = baseWith({ [ALP]: feature(ALP_FM, ALP_S1, R1 + '\n- R2: A rule no scenario cites') });
    const delta = specDelta('main', before, after.index);
    const fixture = loadFixture();
    const t = ticketOf(fixture.tickets, 'PROP-201');
    const context: StageContext = {
      spec: after.spec,
      index: after.index,
      ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'spec-writer' } },
      role: 'spec-writer',
      changedPaths: ['spec/' + ALP],
      specPrefix: 'spec',
      ticketsPrefix: 'tickets',
      codeGlobs: [],
      testGlobs: [],
      protectedGlobs: [],
      lint: [],
      tests: null,
      newScenarios: [],
      removed: delta.removed,
      unretired: delta.unretired,
      specChanged: [...delta.added, ...delta.changed],
      codeChanges: [],
      stubsLeft: [],
    };
    expect(delta.added).toContain('ALP-001/R2');
    expect(checkReport(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Changed an unshown rule\n' + validSpecWriterChecklist('ALP-001/S1')), context).problems).toEqual([]);
  });

  it('PIP-007/S10 Only a proposal is compared', () => {
    const base = baseWith();
    const fixture = loadFixture();
    const roles: StageContext['role'][] = ['spec-writer', 'tester', 'implementer', 'reviewer'];
    const cases: { id: string; role: StageContext['role'] }[] = [
      ...['BUG-301', 'TASK-101'].flatMap((id) => roles.map((role) => ({ id, role }))),
      { id: 'PROP-201', role: 'implementer' },
      { id: 'PROP-201', role: 'reviewer' },
    ];
    for (const item of cases) {
      const t = ticketOf(fixture.tickets, item.id);
      const context: StageContext = {
        spec: base.spec,
        index: base.index,
        ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: item.role } },
        role: item.role,
        changedPaths: [],
        specPrefix: 'spec',
        ticketsPrefix: 'tickets',
        codeGlobs: [],
        testGlobs: [],
        protectedGlobs: [],
        lint: [],
        tests: null,
        newScenarios: [],
        removed: [],
        unretired: [],
        specChanged: [],
        codeChanges: [],
        stubsLeft: [],
      };
      const verdict = item.role === 'reviewer' ? '\nverdict: approve' : '';
      const message = report('role: ' + item.role + '\nticket: ' + item.id + '\nresult: done\nsummary: No comparison for this stage' + verdict);
      expect(checkReport(message, context).problems.filter((problem) => problem.includes('was removed') || problem.includes('changed, but no scenario'))).toEqual([]);
    }
  });
});

describe('X108 a called operation has a provider', () => {
  it('an operation some feature calls and none provides is a warning', () => {
    const c = contracts(NAME_SIZE, '\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nOutput: alpha.Widget\n');
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.Widget.size is 2\nWhen the user orders it through alpha.MakeWidget\nThen beta.Order.total is 20',
    );
    expect(lint({ 'modules/alpha/contracts.md': c, [BET]: bet }).filter((x) => x.startsWith('L012'))).toEqual(['L012 w alpha.MakeWidget: BET-001 calls alpha.MakeWidget, which no feature provides']);
  });
});

describe('X109 screens link the contracts they show and call', () => {
  it('impact on a contract a screen shows reaches the screen', () => {
    const ui = '---\nid: UI-001\ntitle: Widget card\nstatus: active\nshows: [alpha.Widget.size]\n---\n## Layout\nA card with the widget\'s name and size.\n\n## States\n- Made: the card is shown.\n';
    const { spec, index } = baseWith({ 'ui/UI-001-widget-card.md': ui });
    expect(lintSpec(spec, {})).toEqual([]);
    expect(computeImpact(spec, index, 'alpha.Widget.size', null).reverify.find((x) => x.id === 'UI-001')?.via).toEqual(['UI-001 shows alpha.Widget.size']);
  });
  it('a screen link must suit the kind', () => {
    const ui = '---\nid: UI-001\ntitle: Widget card\nstatus: active\ncalls: [alpha.Widget]\n---\n## Layout\nA card.\n\n## States\nNone\n';
    expect(lint({ 'ui/UI-001-widget-card.md': ui }).filter((x) => x.startsWith('L004'))).toEqual(['L004 e UI-001: UI-001 calls alpha.Widget, which is an entity']);
  });
});

describe('X110 a step may carry a table or a fenced example', () => {
  it('is part of the step, its IDs are cites, and a change to it changes the scenario', () => {
    const table = ALP_S1.replace('Then alpha.Widget holds a widget of size 2 (R1)', 'Then alpha.Widget holds (R1):\n| name | size |\n| w1 | 2 |');
    const { spec, index } = baseWith({ [ALP]: feature(ALP_FM, table, R1) });
    expect(lintSpec(spec, {})).toEqual([]);
    const after = baseWith({ [ALP]: feature(ALP_FM, table.replace('| w1 | 2 |', '| w1 | 3 |'), R1) }).index;
    expect(specDelta('main', index, after).changed).toContain('ALP-001/S1');
    const fence = ALP_S1.replace('And alpha.WidgetMade is emitted', 'And alpha.WidgetMade is emitted with:\n\n```json\n{ "name": "w1" }\n```\n');
    expect(lint({ [ALP]: feature(ALP_FM, fence, R1) })).toEqual([]);
  });
});

describe('X111 requires is gone', () => {
  it('is an unknown key', () => {
    const bet = lintFeatureBet('active').replace('writes: [beta.Order.total]', 'writes: [beta.Order.total]\nrequires: [ALP-001]');
    expect(lint({ [BET]: bet }).map((x) => x.slice(0, 4))).toEqual(['L001']);
  });
});

describe('X112 a Code: pointer needs its owner and its name in one file', () => {
  it('a word alone elsewhere does not count', () => {
    const c = contracts(NAME_SIZE, '\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nCode: Factory.makeWidget(size)\nOutput: alpha.Widget\n');
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': c });
    expect(findGaps(spec, index, null, [{ path: 'src/a.ts', text: '// makeWidget was removed years ago' }]).codeNotFound).toEqual([{ id: 'alpha.MakeWidget', code: 'Factory.makeWidget' }]);
    expect(findGaps(spec, index, null, [{ path: 'src/a.ts', text: 'class Factory {\n  makeWidget() {}\n}' }]).codeNotFound).toEqual([]);
  });
});

describe('X113 the gate follows types to drafts', () => {
  it('a feature whose contract is typed by a draft type is not ready', () => {
    const c = contracts(NAME_SIZE.replace("Type: number", 'Type: alpha.Size'), '\n### alpha.Size\nKind: type · Status: active · Draft: src/size.ts:1\nA size. Type: int\n');
    const { spec, index } = baseWith({ 'modules/alpha/contracts.md': c });
    const t = syntheticTicket('id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [BET-001]');
    expect(gateTicket(spec, index, 'TASK-900', t, []).blockers.map((b) => `${b.kind} ${b.id}`)).toEqual(['draft alpha.Size']);
  });
});
