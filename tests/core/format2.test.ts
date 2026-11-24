// Format 2: the structural changes from the spec-structure review (DECISIONS X86–X93). Each test
// overlays the minimal lint-case spec (lint-cases/_base) with the files that show one rule.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { specDelta } from '../../src/core/delta';
import { RULES } from '../../src/core/findings';
import { buildGraph } from '../../src/core/graph';
import { computeImpact } from '../../src/core/impact';
import { renderIndex } from '../../src/core/index-md';
import { lintSpec } from '../../src/core/lint';
import { parseSpec } from '../../src/core/parse/spec';
import { parseTickets } from '../../src/core/parse/tickets';
import { type StageContext, checkReport } from '../../src/core/report';
import { type SourceFile, sourceFromText } from '../../src/core/source';
import { scenarioOfTest } from '../../src/core/test-report';
import { buildIndex } from '../../src/core/units';
import { loadDir } from '../../src/io/fs';
import { loadFixture, report, ticketOf, validSpecWriterChecklist, validTesterMutations } from '../helpers';

const BASE = join(import.meta.dirname, 'lint-cases/_base');

/** The base spec with files replaced, added, or (null) removed. */
function specWith(files: Record<string, string | null> = {}) {
  const byPath = new Map<string, SourceFile>(loadDir(join(BASE, 'spec')).map((f) => [f.path, f]));
  for (const [path, text] of Object.entries(files)) {
    if (text === null) byPath.delete(path);
    else byPath.set(path, sourceFromText(path, text));
  }
  const spec = parseSpec([...byPath.values()]);
  return { spec, index: buildIndex(spec) };
}

function lint(files: Record<string, string | null> = {}, ci = false) {
  const { spec } = specWith(files);
  return lintSpec(spec, { tickets: parseTickets(loadDir(join(BASE, 'tickets'), BASE)), ci });
}

const brief = (fs: ReturnType<typeof lint>) => fs.map((f) => `${f.rule} ${f.id ?? '-'}: ${f.message}`);

const CONFIG = (extra: string) => `{ ${extra} "testCommand": "npx vitest run" }\n`;

const ALPHA_CONTRACTS = (extra = '') => `# alpha contracts

### alpha.Widget
Kind: entity · Status: active
One widget.

#### alpha.Widget.name
The widget's name. Type: string

#### alpha.Widget.size
The widget's size. Type: number

### alpha.WidgetMade
Kind: event · Status: active
A widget was made.

#### alpha.WidgetMade.name
The new widget's name. Type: string
${extra}`;

const feature = (fm: string, steps: string, extra = '') => `---
${fm}
---
## Intent
Make a widget when the user asks for one.

## Behaviour
${steps}

## Rules
${extra || 'None'}

## Out of scope
None
`;

const ALP_FM = 'id: ALP-001\ntitle: Make a widget\nmodule: alpha\nstatus: active\nwrites: [alpha.Widget]\ninvariants: [INV-001]\ndecisions: [ADR-001]\nui: [UI-001]';
const ALP_S1 = '### S1: Widget made\nGiven no widget exists\nWhen the user makes a widget of size 2\nThen alpha.Widget holds a widget of size 2 (INV-001)\nAnd alpha.WidgetMade is emitted\nAnd UI-001 is shown';
const ALP_PATH = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET_PATH = 'modules/beta/features/BET-001-order-a-widget.md';

describe('format 2: the base spec', () => {
  it('lints clean', () => {
    expect(brief(lint())).toEqual([]);
  });
});

describe('format 2: formatVersion', () => {
  it('a config without formatVersion is refused, with the migration as the fix', () => {
    const f = lint({ 'config.json': CONFIG('') });
    expect(brief(f)).toEqual(['L001 -: config.json has no formatVersion; this spec CLI reads format 2']);
  });

  it('a newer format asks for a newer CLI', () => {
    expect(brief(lint({ 'config.json': CONFIG('"formatVersion": 3,') }))).toEqual(['L001 -: config.json is format 3, newer than this spec CLI (format 2)']);
  });

  it('format 2 is accepted', () => {
    expect(lint({ 'config.json': CONFIG('"formatVersion": 2,') })).toEqual([]);
  });
});

describe('format 2: identity', () => {
  it('a feature keeps its ID when it moves to another module', () => {
    const moved = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: alpha\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20',
    );
    expect(brief(lint({ [BET_PATH]: null, 'modules/alpha/features/BET-001-order-a-widget.md': moved }))).toEqual([]);
  });

  it('a feature prefix no module registers is refused', () => {
    const f = lint({ [ALP_PATH]: null, 'modules/alpha/features/ZZZ-001-make-a-widget.md': feature(ALP_FM.replace('ALP-001', 'ZZZ-001'), ALP_S1) });
    expect(brief(f).filter((m) => m.startsWith('L014'))).toEqual(['L014 ZZZ-001: ZZZ-001 has prefix ZZZ, which no module registers']);
  });

  it('invariant, decision and screen numbers go past 999', () => {
    const invariants = '# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nDecisions: ADR-001\n\n### INV-1000: Widgets are counted\nEvery widget is counted.\n';
    const f = lint({ 'core/invariants.md': invariants, [ALP_PATH]: feature(ALP_FM.replace('[INV-001]', '[INV-001, INV-1000]'), ALP_S1.replace('(INV-001)', '(INV-001, INV-1000)')) });
    expect(brief(f)).toEqual([]);
  });

  it('a field name may use underscores, as Python and Go code does', () => {
    const contracts = ALPHA_CONTRACTS().replace('alpha.Widget.size\n', 'alpha.Widget.size_cm\n');
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size_cm is 2\nWhen the user orders it\nThen beta.Order.total is 20',
    );
    expect(brief(lint({ 'modules/alpha/contracts.md': contracts, [BET_PATH]: bet }))).toEqual([]);
  });

  it('a retired scenario or rule number is never used again', () => {
    const f = lint({ [ALP_PATH]: feature(`${ALP_FM}\nretired: [S1, R1]`, ALP_S1, '- R1: Every widget has a size (INV-001)') });
    expect(brief(f)).toEqual([
      'L003 ALP-001/S1: ALP-001/S1 is retired; its number is never used again',
      'L003 ALP-001/R1: ALP-001/R1 is retired; its number is never used again',
      'L023 ALP-001/R1: no scenario of ALP-001 shows ALP-001/R1',
    ]);
  });

  it('retired takes scenario and rule numbers only', () => {
    expect(brief(lint({ [ALP_PATH]: feature(`${ALP_FM}\nretired: [S0x]`, ALP_S1) })).map((m) => m.slice(0, 4))).toEqual(['L002']);
  });

  it('a unit can be retired without a replacement', () => {
    const invariants = '# Invariants\n\n### INV-001: A widget always has a size\nNo widget is stored without a size.\nDecisions: ADR-001\n\n### INV-002: Widgets are blue\nStatus: deprecated\nWidgets used to be blue.\n';
    expect(brief(lint({ 'core/invariants.md': invariants }))).toEqual([]);
  });
});

describe('format 2: removals are visible', () => {
  it('the delta lists the units a change removed', () => {
    const before = specWith().index;
    const after = specWith({ [ALP_PATH]: feature(ALP_FM, ALP_S1.replace('S1:', 'S2:')) }).index;
    const d = specDelta('main', before, after);
    expect(d.removed).toEqual(['ALP-001/R1', 'ALP-001/S1']);
    expect(d.added).toEqual(['ALP-001/S2']);
  });

  it('test names map to the scenario they cover, in every naming style', () => {
    expect(scenarioOfTest('PRV-002/S1 Fallback enabled')).toBe('PRV-002/S1');
    expect(scenarioOfTest('PRV-002 S1 Fallback enabled')).toBe('PRV-002/S1');
    expect(scenarioOfTest('test_PRV_002_S1_fallback')).toBe('PRV-002/S1');
    expect(scenarioOfTest('TestPRV_002_S12Fallback')).toBe('PRV-002/S12');
    expect(scenarioOfTest('adds two numbers')).toBeNull();
  });

  const fx = loadFixture();
  const ctx = (role: StageContext['role'], over: Partial<StageContext>): StageContext => {
    const t = ticketOf(fx.tickets, 'PROP-201');
    return {
      spec: fx.spec,
      index: fx.index,
      ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: role } },
      role,
      changedPaths: [],
      specPrefix: 'spec',
      ticketsPrefix: 'tickets',
      codeGlobs: ['src/**'],
      testGlobs: ['tests/**'],
      protectedGlobs: [],
      lint: [],
      tests: null,
      newScenarios: [],
      removed: [],
      unretired: [],
      specChanged: [],
      codeChanges: [],
      stubsLeft: [],
      ...over,
    };
  };
  const done = (role: string) => report(`role: ${role}\nticket: PROP-201\nresult: done\nsummary: Done.${role === 'spec-writer' ? '\n' + validSpecWriterChecklist() : ''}`);

  it('PIP-007/S1 A removed scenario is retired', () => {
    const r = checkReport(done('spec-writer'), ctx('spec-writer', { changedPaths: ['spec/modules/settings/features/SET-001-enable-providers.md'], removed: ['SET-001/S3'] }));
    expect(r.problems).toEqual(['SET-001/S3 was removed; add S3 to retired in SET-001, so its number is never reused']);
  });

  it('PIP-007/S2 Any other removed unit stays as a tombstone', () => {
    const r = checkReport(done('spec-writer'), ctx('spec-writer', {
      changedPaths: ['spec/modules/conversation/features/CNV-002-stop-a-reply.md'],
      removed: ['CNV-009', 'CNV-009/S1', 'conversation.Message', 'conversation.Message.meta'],
    }));
    expect(r.problems).toEqual([
      'CNV-009 was removed; keep it as a tombstone with status: removed instead',
      'conversation.Message was removed; keep it as a tombstone with status: removed instead',
    ]);
  });

  it('tester: a test named after a scenario the spec does not have is refused', () => {
    const names = fx.spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
    const tests = [...names.map((name) => ({ name, status: 'failed' as const })), { name: 'PRV-001/S9 Removed long ago', status: 'passed' as const }];
    const r = checkReport(report('role: tester\nticket: PROP-201\nresult: done\nsummary: Done.\n' + validTesterMutations('PRV-001/S1')), ctx('tester', { changedPaths: ['tests/PRV-001.test.ts'], tests: { exitCode: 1, tests, error: null }, newScenarios: ['PRV-001/S1'] }));
    expect(r.problems).toEqual(['test "PRV-001/S9 Removed long ago" names PRV-001/S9, which is not in the spec; delete or rename it']);
  });
});

describe('format 2: the data layer', () => {
  it('types and errors are contracts; members work under every kind', () => {
    const contracts = ALPHA_CONTRACTS(`
### alpha.Size
Kind: type · Status: active
A widget size, in whole centimetres. Type: number

### alpha.TooSmall
Kind: error · Status: active
The requested size is below 1, so no alpha.Widget is made.

#### alpha.TooSmall.size
The size asked for. Type: alpha.Size
`).replace('The widget\'s size. Type: number', "The widget's size. Type: alpha.Size");
    const alp = feature(ALP_FM, `${ALP_S1}\n\n### S2: Too small\nGiven no widget exists\nWhen the user makes a widget of size 0\nThen making fails with alpha.TooSmall`);
    const { spec, index } = specWith({ 'modules/alpha/contracts.md': contracts, [ALP_PATH]: alp });
    expect(brief(lintSpec(spec, {}))).toEqual([]);
    expect(spec.contracts.map((c) => `${c.id}:${c.kind}`)).toEqual(['alpha.Size:type', 'alpha.TooSmall:error', 'alpha.Widget:entity', 'alpha.WidgetMade:event', 'beta.Order:entity']);
    // Only type expressions link: the error's description names alpha.Widget, which is not a dependency.
    const uses = index.links.filter((l) => l.kind === 'uses').map((l) => `${l.from} → ${l.to}`);
    expect(uses).toEqual(['alpha.TooSmall.size → alpha.Size', 'alpha.Widget.size → alpha.Size']);
  });

  it('a change to a type reaches every feature that uses a contract typed by it', () => {
    const contracts = ALPHA_CONTRACTS('\n### alpha.Size\nKind: type · Status: active\nA widget size. Type: number\n').replace("The widget's size. Type: number", "The widget's size. Type: alpha.Size");
    const { spec, index } = specWith({ 'modules/alpha/contracts.md': contracts });
    const i = computeImpact(spec, index, 'alpha.Size', null);
    expect(i.mustChange.map((x) => `${x.id} via ${x.via.join('; ')}`)).toEqual(['ALP-001 via writes alpha.Widget (whole) (uses alpha.Size)']);
    expect(i.reverify.map((x) => `${x.id} via ${x.via.join('; ')}`)).toEqual(['BET-001 via reads alpha.Widget.size (uses alpha.Size)']);
  });

  it('Payload and Input lists are replaced by members', () => {
    const contracts = ALPHA_CONTRACTS().replace("#### alpha.WidgetMade.name\nThe new widget's name. Type: string\n", 'Payload:\n- name: string\n');
    expect(brief(lint({ 'modules/alpha/contracts.md': contracts }))).toEqual([
      'L001 alpha.WidgetMade: "Payload:" lists are format 1; write each member as "#### alpha.WidgetMade.<member>" with a Type: line',
    ]);
  });

  it('a link must suit the contract kind', () => {
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [alpha.WidgetMade, beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20',
    );
    expect(brief(lint({ [BET_PATH]: bet })).filter((m) => m.startsWith('L004'))).toEqual(['L004 BET-001: BET-001 writes alpha.WidgetMade, which is an event']);
  });

  it('an operation is provided by one feature and called by others', () => {
    const contracts = ALPHA_CONTRACTS('\n### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nOutput: alpha.Widget\n\n#### alpha.MakeWidget.size\nThe size to make. Type: number\n');
    const alp = feature(ALP_FM.replace('writes: [alpha.Widget]', 'writes: [alpha.Widget]\nprovides: [alpha.MakeWidget]'), ALP_S1.replace('When the user makes a widget of size 2', 'When the user makes a widget of size 2 through alpha.MakeWidget'));
    const bet = feature(
      'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active\nwrites: [beta.Order.total]',
      '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it, which calls alpha.MakeWidget\nThen beta.Order.total is 20',
    );
    const { spec, index } = specWith({ 'modules/alpha/contracts.md': contracts, [ALP_PATH]: alp, [BET_PATH]: bet });
    expect(brief(lintSpec(spec, {}))).toEqual([]);
    const i = computeImpact(spec, index, 'alpha.MakeWidget', null);
    expect(i.mustChange.map((x) => x.id)).toEqual(['ALP-001']);
    expect(i.reverify.map((x) => x.id)).toEqual(['BET-001']);
  });

  it('a bare type name is flagged: qualify a known one, define an unknown one', () => {
    const contracts = ALPHA_CONTRACTS('\n### alpha.Size\nKind: type · Status: active\nA widget size. Type: number\n')
      .replace("The widget's size. Type: number", "The widget's size. Type: Size")
      .replace("The widget's name. Type: string", "The widget's name. Type: Label[] | \"none\"");
    expect(brief(lint({ 'modules/alpha/contracts.md': contracts })).filter((m) => m.startsWith('L022'))).toEqual([
      'L022 alpha.Widget.name: "Label[] | "none"" is not a spec type: Label is not defined; add it as a type contract and write <module>.Label',
      'L022 alpha.Widget.size: "Size" is not a spec type: Size is written bare; write alpha.Size',
    ]);
  });
});

describe('format 2: no duplicated facts', () => {
  it('the overview lists no modules, and rule L015 is retired', () => {
    expect(Object.keys(RULES)).not.toContain('L015');
    expect(brief(lint({ 'core/overview.md': '# base\n\n## Purpose\nA minimal spec.\n' }))).toEqual([]);
  });

  it('a module declares no depends_on: it is derived from contract use', () => {
    const beta = '---\nid: beta\nprefix: BET\ndomain: sell\ndepends_on: [alpha]\nstatus: active\n---\nTakes orders for widgets.\n\n## Owns\n- Orders\n\n## Non-goals\nNone\n';
    expect(brief(lint({ 'modules/beta/_module.md': beta })).map((m) => m.slice(0, 4))).toEqual(['L001']);
    const g = buildGraph(specWith().spec);
    expect(g.edges.filter((e) => e.kind === 'depends_on')).toEqual([{ from: 'beta', to: 'alpha', kind: 'depends_on' }]);
  });

  it('index.md carries no spec hash, and --ci does not ask for a committed graph.json', () => {
    const index = renderIndex(specWith().spec);
    expect(index).not.toMatch(/spec@/);
    expect(brief(lint({ 'index.md': index }, true))).toEqual([]);
    // index.md changes only when a module or feature title does, not with every edit.
    expect(renderIndex(specWith({ 'core/glossary.md': '# Glossary\n\n### Widget\nA thing made.\n' }).spec)).toBe(index);
  });
});
