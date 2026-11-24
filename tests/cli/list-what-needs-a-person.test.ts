// ADP-002: spec gaps lists what still needs a person: each draft with its title and sources, each open
// question, each module without features, each contract no feature uses. Each test edits a copy of a
// fixture spec, then runs the CLI on it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FIXTURE, LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const CNV_002 = 'modules/conversation/features/CNV-002-stop-a-reply.md';
const CNV_003 = 'modules/conversation/features/CNV-003-export-to-markdown.md';
const PRV_002 = 'modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
const CONVERSATION = 'modules/conversation/_module.md';
const CONTRACTS = 'modules/conversation/contracts.md';
const INVARIANTS = 'core/invariants.md';
const ALPHA_CONTRACTS = 'modules/alpha/contracts.md';
const BILLING = 'modules/billing/_module.md';
const INV_002 = '### INV-002: API keys never appear in logs, exports or error messages\n';
const CONVERSATION_DESCRIPTION = 'Owns the messages of a conversation: sending a message to the active provider, stopping a reply mid-stream, and exporting a conversation to Markdown.\n';

/** Copies the report file to {report}. */
const COPY_REPORT = 'cat test-report.json > "{report}"';
/** The vitest JSON report the test command copies: one passed test per name. */
const vitestReport = (names: readonly string[]) => JSON.stringify({ testResults: [{ assertionResults: names.map((title) => ({ title, status: 'passed' })) }] });

/** Chat-mini's scenarios, one test each. */
const EVERY_SCENARIO = [
  'CNV-001/S1 Send to active provider',
  'CNV-001/S2 Active provider disabled',
  'CNV-002/S1 Partial reply kept',
  'CNV-002/S2 Stop reason recorded',
  'CNV-003/S1 Text exported',
  'CNV-003/S2 No key material in export',
  'PRV-001/S1 Streams tokens',
  'PRV-001/S2 Provider rate-limits',
  'PRV-001/S3 The key never reaches the log',
  'PRV-002/S1 Fallback enabled',
  'PRV-002/S2 Fallback disabled',
  'PRV-002/S3 Fallback provider also rate-limits',
  'PRV-002/S4 Fallback provider not enabled',
  'PRV-003/S1 Usage recorded at the end of a reply',
  'SET-001/S1 Enable',
  'SET-001/S2 Disable stops new messages to it',
  'SET-001/S3 Enable without a key',
  'SET-002/S1 Add a key',
  'SET-002/S2 Delete a key',
];

const BILLING_MODULE = '---\nid: billing\nprefix: BIL\ndomain: money\nstatus: active\n---\nBills each conversation by its tokens.\n\n## Owns\n- Invoices\n\n## Non-goals\nNone\n';

/** Replaces the one place `from` holds in a spec file; fails when the file does not hold it. */
function replaceIn(spec: string, file: string, from: string, to: string) {
  const path = join(spec, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`${file} does not hold ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}

/** Writes a spec file, making its folder first. */
function writeSpec(spec: string, file: string, text: string) {
  mkdirSync(dirname(join(spec, file)), { recursive: true });
  writeFileSync(join(spec, file), text);
}

/** A question in a unit's frontmatter, written under its `status:` line. */
function askIn(spec: string, file: string, q: { id: string; kind: 'blocker' | 'external' | 'preference'; text: string; answer: string | null }) {
  replaceIn(spec, file, 'status: active\n', `status: active\nquestions:\n  - id: ${q.id}\n    kind: ${q.kind}\n    text: ${q.text}\n    default: null\n    cites: []\n    answer: ${q.answer ?? 'null'}\n    raised_by: null\n`);
}

/** CNV-003 as /spec-init leaves it: drafted from the code and the README, under the title the scenarios use. */
function draftCnv003(spec: string) {
  replaceIn(spec, CNV_003, 'title: Export a conversation to Markdown\n', 'title: Export to Markdown\n');
  replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
}

/** INV-002 drafted with no sources, under the title the scenarios use. */
function draftInv002(spec: string) {
  replaceIn(spec, INVARIANTS, INV_002, '### INV-002: API keys never appear in logs\nStatus: active · Draft: yes\n');
}

/** Two open questions: a blocker on CNV-002 and a preference on the conversation module. */
function openTwoQuestions(spec: string) {
  askIn(spec, CNV_002, { id: 'Q2', kind: 'blocker', text: 'Stop twice?', answer: null });
  askIn(spec, CONVERSATION, { id: 'Q1', kind: 'preference', text: 'Keep export?', answer: null });
}

/**
 * A throwaway repo of `fixture`, with `edit` applied to its spec folder before the first commit. With
 * `tests`, the test command copies a report that names exactly those tests as passing.
 */
function repo(fixture: string, edit?: (spec: string) => void, tests?: readonly string[]): Fx {
  const fx = gitFixture('spec-adp-002', {
    fixture,
    setup: (dir) => {
      if (tests !== undefined) {
        const cfgPath = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
        writeFileSync(cfgPath, `${JSON.stringify({ ...cfg, testCommand: COPY_REPORT }, null, 2)}\n`);
        writeFileSync(join(dir, 'test-report.json'), vitestReport(tests));
      }
      edit?.(join(dir, 'spec'));
    },
  });
  made.push(fx);
  return fx;
}

interface Draft {
  id: string;
  title: string;
  sources: string[];
  file: string;
}
interface GapJson {
  spec: string;
  drafts: Draft[];
  questions: { id: string; kind: string; text: string }[];
  modulesWithoutFeatures: string[];
  unusedContracts: string[];
  scenariosWithoutTests: string[] | null;
  testsWithoutScenario: string[] | null;
  codeNotFound: { id: string; code: string }[] | null;
}
const gapJson = (stdout: string) => JSON.parse(stdout) as GapJson;

/** The lines under `## <title>` or `## <title> (<count>)`, up to the blank line that ends the section. */
function section(stdout: string, title: string): string[] {
  const lines = stdout.split('\n');
  const at = lines.findIndex((l) => l === `## ${title}` || l.startsWith(`## ${title} (`));
  expect(at).toBeGreaterThanOrEqual(0);
  return lines.slice(at + 1, lines.indexOf('', at + 1));
}

/** The last line of the output, without its newline. */
const lastLine = (stdout: string) => stdout.trimEnd().split('\n').at(-1);

describe('ADP-002 List what still needs a person', () => {
  it('ADP-002/S1 The sections, in order', async () => {
    const fx = repo(FIXTURE, draftCnv003);
    const out = await fx.spec('', 'gaps', '--no-tests');
    const { spec } = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(out.code).toBe(0);
    expect(out.stdout.startsWith(`# Gaps · ${spec}\n\n`)).toBe(true);
    expect(out.stdout.split('\n').filter((l) => l.startsWith('## '))).toEqual([
      '## Drafts to confirm (1)',
      '## Open questions (0)',
      '## Modules without features (0)',
      '## Contracts no feature uses (0)',
      '## Scenarios without a test',
    ]);
    expect(out.stdout).toContain('## Drafts to confirm (1)\n- CNV-003 Export to Markdown (from src/conversation/export.ts:3, README.md)\n\n');
    expect(out.stdout).toContain('## Open questions (0)\nNone\n\n');
    expect(out.stdout).toContain('## Modules without features (0)\nNone\n\n');
    expect(out.stdout).toContain('## Contracts no feature uses (0)\nNone\n\n');
    expect(out.stdout).toContain('## Scenarios without a test\nNot checked (no test run).\n');
  });

  it('ADP-002/S2 An empty section', async () => {
    const fx = repo(FIXTURE);
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(out.stdout).toContain('## Open questions (0)\nNone\n');
    expect(section(out.stdout, 'Open questions')).toEqual(['None']);
  });

  it('ADP-002/S3 A drafted unit and its sources', async () => {
    const fx = repo(FIXTURE, draftCnv003);
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Drafts to confirm')).toContain('- CNV-003 Export to Markdown (from src/conversation/export.ts:3, README.md)');
  });

  it('ADP-002/S4 A draft with no sources', async () => {
    const fx = repo(FIXTURE, draftInv002);
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Drafts to confirm')).toContain('- INV-002 API keys never appear in logs');
  });

  it('ADP-002/S5 A drafted module shows its description', async () => {
    const fx = repo(FIXTURE, (spec) => {
      replaceIn(spec, CONVERSATION, 'status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n');
      replaceIn(spec, CONVERSATION, CONVERSATION_DESCRIPTION, 'Owns the messages of a conversation.\n');
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Drafts to confirm')).toContain('- conversation Owns the messages of a conversation. (from README.md)');
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.drafts.find((d) => d.id === 'conversation')?.title).toBe('Owns the messages of a conversation.');
  });

  it('ADP-002/S6 A drafted contract shows its summary', async () => {
    const fx = repo(FIXTURE, (spec) => {
      replaceIn(spec, CONTRACTS, '### conversation.Usage\nKind: type · Status: active\n', '### conversation.Usage\nKind: type · Status: active · Draft: yes\n');
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Drafts to confirm')).toContain('- conversation.Usage The tokens one reply used.');
  });

  it('ADP-002/S7 Drafts in natural ID order', async () => {
    const fx = repo(FIXTURE, (spec) => {
      writeSpec(spec, 'modules/adopt/_module.md', '---\nid: adopt\nprefix: ADP\ndomain: setup\nstatus: active\n---\nBuilds a spec with a person.\n\n## Owns\n- Gaps\n\n## Non-goals\nNone\n');
      writeSpec(spec, 'modules/adopt/contracts.md', '# adopt contracts\n\n### adopt.Gap\nKind: type · Status: active · Draft: yes\nOne thing that still needs a person.\n');
      replaceIn(spec, PRV_002, 'status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n');
      replaceIn(spec, INVARIANTS, '### INV-001: A conversation goes only to enabled providers\n', '### INV-001: A conversation goes only to enabled providers\nStatus: active · Draft: yes\n');
      draftCnv003(spec);
    });
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.drafts.map((d) => d.id)).toEqual(['CNV-003', 'INV-001', 'PRV-002', 'adopt.Gap']);
  });

  it('ADP-002/S8 Open questions, blockers first', async () => {
    const fx = repo(FIXTURE, openTwoQuestions);
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(out.stdout).toContain('## Open questions (2)\n');
    expect(section(out.stdout, 'Open questions')).toEqual(['- CNV-002#Q2 blocker: Stop twice?', '- conversation#Q1 preference: Keep export?']);
  });

  it('ADP-002/S9 An answered question is not listed', async () => {
    const fx = repo(FIXTURE, (spec) => {
      askIn(spec, CNV_002, { id: 'Q1', kind: 'preference', text: 'Keep the stopped reply?', answer: 'done' });
    });
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.questions.map((q) => q.id)).not.toContain('CNV-002#Q1');
  });

  it('ADP-002/S10 A module without features', async () => {
    const fx = repo(FIXTURE, (spec) => {
      writeSpec(spec, BILLING, BILLING_MODULE);
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Modules without features')).toContain('- billing');
  });

  it('ADP-002/S11 An external module needs no features', async () => {
    const fx = repo(FIXTURE, (spec) => {
      writeSpec(spec, 'modules/pay/_module.md', '---\nid: pay\nprefix: PAY\ndomain: money\nstatus: active\nexternal: true\n---\nPaid by a service outside this spec.\n\n## Owns\n- Nothing\n\n## Non-goals\nNone\n');
    });
    expect((await fx.spec('', 'show', 'pay')).code).toBe(0);
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.modulesWithoutFeatures).not.toContain('pay');
  });

  it('ADP-002/S12 A contract no feature uses', async () => {
    const fx = repo(FIXTURE, (spec) => {
      writeSpec(spec, BILLING, BILLING_MODULE);
      writeSpec(spec, 'modules/billing/contracts.md', '# billing contracts\n\n### billing.Invoice\nKind: entity · Status: active\nOne invoice for the tokens of a conversation.\n');
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Contracts no feature uses')).toContain('- billing.Invoice');
  });

  it('ADP-002/S13 A type used only inside another contract is used', async () => {
    const fx = repo(LINT_BASE, (spec) => {
      replaceIn(spec, ALPHA_CONTRACTS, "The widget's size. Type: number", "The widget's size. Type: alpha.Size");
      replaceIn(spec, ALPHA_CONTRACTS, '### alpha.WidgetMade\n', '### alpha.Size\nKind: type · Status: active\nHow big a widget is.\n\n### alpha.WidgetMade\n');
    });
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.unusedContracts).toEqual([]);
  });

  it('ADP-002/S14 The total', async () => {
    const fx = repo(
      FIXTURE,
      (spec) => {
        draftCnv003(spec);
        draftInv002(spec);
        openTwoQuestions(spec);
      },
      [...EVERY_SCENARIO.filter((t) => !t.startsWith('PRV-002/S3 ')), 'CNV-001/S9 Ghost scenario'],
    );
    const out = await fx.spec('', 'gaps');
    expect(lastLine(out.stdout)).toBe('6 gaps.');
  });

  it('ADP-002/S15 One gap', async () => {
    const fx = repo(FIXTURE, draftCnv003);
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(lastLine(out.stdout)).toBe('1 gap.');
  });

  it('ADP-002/S16 No gaps', async () => {
    const fx = repo(FIXTURE, undefined, EVERY_SCENARIO);
    const out = await fx.spec('', 'gaps');
    expect(lastLine(out.stdout)).toBe('No gaps: every unit is confirmed, every question answered, every scenario tested.');
    expect(out.code).toBe(0);
  });

  it('ADP-002/S17 JSON output', async () => {
    const fx = repo(FIXTURE);
    const out = await fx.spec('', 'gaps', '--no-tests', '--format', 'json');
    expect(out.code).toBe(0);
    expect(`${JSON.stringify(JSON.parse(out.stdout) as unknown, null, 2)}\n`).toBe(out.stdout);
    expect(Object.keys(JSON.parse(out.stdout) as object)).toEqual(['spec', 'drafts', 'questions', 'modulesWithoutFeatures', 'unusedContracts', 'scenariosWithoutTests', 'testsWithoutScenario', 'codeNotFound']);
    expect(gapJson(out.stdout).drafts).toEqual([]);
  });

  it('ADP-002/S18 A drafted module with no description', async () => {
    const fx = repo(FIXTURE, (spec) => {
      writeSpec(spec, BILLING, '---\nid: billing\nprefix: BIL\ndomain: money\nstatus: active\ndraft: true\nsources: [README.md]\n---\n## Owns\n- Invoices\n\n## Non-goals\nNone\n');
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Drafts to confirm')).toContain('- billing (from README.md)');
    const g = gapJson((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout);
    expect(g.drafts.find((d) => d.id === 'billing')?.title).toBe('');
  });

  it('ADP-002/S19 An external question is listed with the blockers', async () => {
    const fx = repo(FIXTURE, (spec) => {
      replaceIn(spec, CNV_002, 'status: active\n', `status: active\nquestions:\n  - id: Q2\n    kind: blocker\n    text: Stop twice?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n  - id: Q3\n    kind: external\n    text: Does the export API page results?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n`);
      askIn(spec, CONVERSATION, { id: 'Q1', kind: 'preference', text: 'Keep export?', answer: null });
    });
    const out = await fx.spec('', 'gaps', '--no-tests');
    expect(section(out.stdout, 'Open questions')).toEqual([
      '- CNV-002#Q2 blocker: Stop twice?',
      '- CNV-002#Q3 external: Does the export API page results?',
      '- conversation#Q1 preference: Keep export?',
    ]);
  });
});
