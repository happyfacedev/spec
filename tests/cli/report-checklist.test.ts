// PROP-051: report checklist shape, ownership, and done spec-writer checklist validation.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, loadFixture, report, validTesterMutations } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => { for (const fx of fixtures) fx.cleanup(); });

const testNames = loadFixture().spec.features.flatMap((feature) => feature.scenarios.map((scenario) => scenario.id + ' ' + scenario.title));
const complete = [
  { item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] },
  { item: 'C2', outcome: 'na', reason: 'No environment-specific behavior applies.' },
  { item: 'C3', outcome: 'na', reason: 'No shared state crosses an await or process boundary.' },
  { item: 'C4', outcome: 'invariant', ids: ['INV-002'] },
  { item: 'C5', outcome: 'na', reason: 'No unknown input is accepted.' },
  { item: 'C6', outcome: 'na', reason: 'There is no unchanged path to preserve.' },
  { item: 'C8', outcome: 'question', ids: ['PROP-201#Q1'] },
];
const checklist = (entries: readonly object[]) => 'checklist: ' + JSON.stringify(entries);
const done = (id: string, role: string, extra = '') => report('role: ' + role + '\nticket: ' + id + '\nresult: done\nsummary: Done\n' + extra);
const blocked = (id: string, role: string, extra = '') => report('role: ' + role + '\nticket: ' + id + '\nresult: blocked\nsummary: Waiting\n' + extra);
const externalAnswered = '  - id: Q1\n    kind: external\n    text: Is the provider API verified?\n    default: null\n    cites: []\n    answer: verified in a spike\n    raised_by: null';
const validAnswered = '  - id: Q1\n    kind: blocker\n    text: Is the provider API verified?\n    default: null\n    cites: []\n    answer: verified in a spike\n    raised_by: null';
const externalOpenBlockerAndPreference = externalAnswered.replace('answer: verified in a spike', 'answer: null') + '\n  - id: Q2\n    kind: blocker\n    text: Which provider boundary is verified?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n  - id: Q3\n    kind: preference\n    text: Which order is preferred?\n    default: alphabetical\n    cites: []\n    answer: null\n    raised_by: null';

function setStage(dir: string, id: string, role: string) {
  const path = join(dir, 'tickets/' + id + '.md');
  const text = readFileSync(path, 'utf8')
    .replace(/^status: (?:open|blocked|in_progress)$/m, 'status: in_progress')
    .replace(/^stage: (?:null|\w[\w-]*)$/m, 'stage: ' + role);
  writeFileSync(path, text);
}

function addQuestions(dir: string, questions: string) {
  const path = join(dir, 'tickets/PROP-201.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace('questions: []', 'questions:\n' + questions));
}

function fixture(prefix: string, stages: Record<string, string> = {}, failedTest: string | null = null): Fx {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const configPath = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(configPath, JSON.stringify({ ...config, testCommand: 'cp test-report.json "{report}"' }, null, 2) + '\n');
      const assertionResults = testNames.map((title) => ({
        title,
        status: title === failedTest ? 'failed' : 'passed',
        ...(title === failedTest ? { failureMessages: ['AssertionError: expected a failing scenario'] } : {}),
      }));
      writeFileSync(join(dir, 'test-report.json'), JSON.stringify({ testResults: [{ assertionResults }] }));
      for (const [id, role] of Object.entries(stages)) setStage(dir, id, role);
    },
  });
  fixtures.push(fx);
  return fx;
}

async function check(fx: Fx, id: string, role: string, message: string) {
  const out = await fx.spec(message, 'check-report', role, id, '--format', 'json');
  return { out, value: JSON.parse(out.stdout) as { ok: boolean; problems: string[]; report: Record<string, unknown> | null } };
}

describe('PIP-003 report checklist and external blockers', () => {
  it('PIP-003/S17 A spec-writer reports its case checklist', async () => {
    const fx = fixture('prop051-report-s14', { 'PROP-201': 'spec-writer' });
    const entries = [
      { item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] },
      { item: 'C2', outcome: 'na', reason: 'No path is read.' },
    ];
    const withChecklist = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(entries)));
    expect(withChecklist.value.report).toMatchObject({ checklist: [
      { item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'] },
      { item: 'C2', outcome: 'na', ids: [], reason: 'No path is read.' },
    ] });
    const withoutChecklist = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer'));
    expect(withoutChecklist.value.report).toMatchObject({ checklist: [] });
  }, 60_000);

  it('PIP-003/S15 A checklist entry outside its shape', async () => {
    const fx = fixture('prop051-report-s15', { 'PROP-201': 'spec-writer' });
    const invalid = [
      [{ item: 'C7', outcome: 'scenarios', ids: ['PRV-001/S4'] }],
      [{ item: 'C1', outcome: 'skip', ids: ['PRV-001/S4'] }],
      [{ outcome: 'scenarios', ids: ['PRV-001/S4'] }],
      [{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S4'], notes: 'hello' }],
    ];
    for (const entries of invalid) {
      const { value } = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(entries)));
      expect(value.report).toBeNull();
      expect(value.problems).toHaveLength(1);
      expect(value.problems[0]?.startsWith('report checklist.0: ')).toBe(true);
    }
  }, 60_000);

  it('PIP-003/S16 A blocker may mark an external fact', async () => {
    const fx = fixture('prop051-report-s16', { 'PROP-201': 'spec-writer' });
    const blocker = { text: 'Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?', cites: ['PROP-201'], external: true };
    const accepted = await check(fx, 'PROP-201', 'spec-writer', blocked('PROP-201', 'spec-writer', 'blockers: ' + JSON.stringify([blocker])));
    expect(accepted.value.report).toMatchObject({ blockers: [{ external: true }] });
    const invalid = [{ ...blocker, external: 'yes' }];
    const refused = await check(fx, 'PROP-201', 'spec-writer', blocked('PROP-201', 'spec-writer', 'blockers: ' + JSON.stringify(invalid)));
    expect(refused.value.problems).toHaveLength(1);
    expect(refused.value.problems[0]?.startsWith('report blockers.0: ')).toBe(true);
  }, 60_000);
});

describe('PIP-004 reports that may not carry a checklist', () => {
  it('PIP-004/S21 Only the spec-writer gives a checklist', async () => {
    const fx = fixture('prop051-report-s20', {
      'TASK-101': 'implementer',
      'PROP-201': 'tester',
      'BUG-301': 'tester',
    }, 'PRV-002/S3 Fallback provider also rate-limits');
    const cases: { id: string; role: string; result: 'done' | 'blocked'; extra: string }[] = [
      { id: 'TASK-101', role: 'implementer', result: 'done', extra: '' },
      { id: 'PROP-201', role: 'tester', result: 'done', extra: validTesterMutations('PRV-001/S1') },
      { id: 'BUG-301', role: 'tester', result: 'done', extra: validTesterMutations('PRV-002/S3') },
      { id: 'PROP-201', role: 'tester', result: 'blocked', extra: 'blockers: [{ text: waiting, cites: [PROP-201] }]' },
      { id: 'TASK-101', role: 'reviewer', result: 'done', extra: 'verdict: approve' },
      { id: 'TASK-101', role: 'reviewer', result: 'blocked', extra: 'blockers: [{ text: waiting, cites: [TASK-101] }]' },
    ];
    for (const item of cases) {
      if (item.role === 'reviewer') setStage(fx.repo, item.id, item.role);
      const message = report('role: ' + item.role + '\nticket: ' + item.id + '\nresult: ' + item.result + '\nsummary: Ready\n' + item.extra + '\n' + checklist([{ item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S1'] }]));
      const { value } = await check(fx, item.id, item.role, message);
      expect(value.problems).toContain('only the spec-writer gives a checklist; leave it out of the ' + item.role + "'s report");
    }
  }, 60_000);
});

describe('PIP-007 checklist coverage', () => {
  const checklistFixture = (prefix: string, questions = validAnswered) => {
    const fx = fixture(prefix, { 'PROP-201': 'spec-writer' });
    addQuestions(fx.repo, questions);
    fx.apply('reference/PROP-201.spec-writer.patch');
    return fx;
  };

  it('PIP-007/S11 A complete checklist is accepted', async () => {
    const fx = checklistFixture('prop051-report-s11');
    const out = await fx.spec(done('PROP-201', 'spec-writer', checklist(complete)), 'check-report', 'spec-writer', 'PROP-201', '--format', 'json');
    expect(out.code).toBe(0);
    const value = JSON.parse(out.stdout) as { ok: boolean; problems: string[] };
    expect(value.ok).toBe(true);
    expect(value.problems.filter((problem) => problem.includes('checklist'))).toEqual([]);
  }, 60_000);

  it('PIP-007/S12 Every item is reported once', async () => {
    const fx = checklistFixture('prop051-report-s12');
    const missingC3 = complete.filter((item) => item.item !== 'C3');
    const missing = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(missingC3)));
    expect(missing.value.problems).toEqual(['the checklist has no entry for C3 (concurrency and ordering); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply']);
    const noChecklist = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer'));
    expect(noChecklist.value.problems).toEqual([
      'the checklist has no entry for C1 (neighbours); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C2 (environment axes); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C3 (concurrency and ordering); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C4 (trust boundaries); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C5 (fail closed); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C6 (preserved behaviour); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
      'the checklist has no entry for C8 (external facts); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply',
    ]);
    const duplicate = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist([...complete, complete[0] as object])));
    expect(duplicate.value.problems).toEqual(['the checklist has 2 entries for C1; give one']);
  }, 60_000);

  it('PIP-007/S13 Not applicable needs a reason', async () => {
    const fx = checklistFixture('prop051-report-s13');
    for (const reason of [undefined, '   ']) {
      const entries = complete.map((item) => item.item === 'C2' ? { ...item, ...(reason === undefined ? { reason: undefined } : { reason }) } : item);
      const { value } = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(entries)));
      expect(value.problems).toEqual(['checklist C2 is na without a reason; say why it does not apply']);
    }
  }, 60_000);

  it('PIP-007/S14 Any other outcome cites what covers it', async () => {
    const fx = checklistFixture('prop051-report-s14-rules');
    const cases = [
      { item: 'C1', replacement: { item: 'C1', outcome: 'scenarios', ids: [] }, expected: 'checklist C1 is scenarios but cites no ID; cite what covers it' },
      { item: 'C4', replacement: { item: 'C4', outcome: 'invariant', ids: ['PRV-001/S4'] }, expected: 'checklist C4 cites PRV-001/S4, which is not an invariant' },
      { item: 'C1', replacement: { item: 'C1', outcome: 'scenarios', ids: ['INV-002'] }, expected: 'checklist C1 cites INV-002, which is not a scenario' },
      { item: 'C8', replacement: { item: 'C8', outcome: 'question', ids: ['PRV-001/S4'] }, expected: 'checklist C8 cites PRV-001/S4, which is not a question' },
    ];
    for (const item of cases) {
      const entries = complete.map((entry) => entry.item === item.item ? item.replacement : entry);
      const { value } = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(entries)));
      expect(value.problems).toEqual([item.expected]);
    }
  }, 60_000);

  it('PIP-007/S15 A cited ID must exist', async () => {
    const fx = checklistFixture('prop051-report-s15-ids');
    const entries = complete.map((item) => item.item === 'C1'
      ? { ...item, ids: ['PRV-001/S9'] }
      : item.item === 'C8' ? { ...item, ids: ['PROP-201#Q7'] } : item);
    const { value } = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(entries)));
    expect(value.problems).toEqual([
      'checklist C1 cites PRV-001/S9, which does not exist',
      'checklist C8 cites PROP-201#Q7, which does not exist',
    ]);
  }, 60_000);

  it('PIP-007/S16 An unverified external fact holds the stage', async () => {
    const fx = checklistFixture('prop051-report-s16-checklist', externalOpenBlockerAndPreference);
    const message = done('PROP-201', 'spec-writer', checklist(complete));
    const open = await fx.spec(message, 'check-report', 'spec-writer', 'PROP-201', '--format', 'json');
    expect(open.code).toBe(1);
    const openResult = JSON.parse(open.stdout) as { problems: string[] };
    expect(openResult.problems).toEqual(['checklist C8 cites PROP-201#Q1, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true']);
    const openKinds = [
      { id: 'PROP-201#Q2', expected: 'checklist C8 cites PROP-201#Q2, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true' },
      { id: 'PROP-201#Q3', expected: 'checklist C8 cites PROP-201#Q3, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true' },
    ];
    for (const item of openKinds) {
      const citesOpenQuestion = complete.map((entry) => entry.item === 'C8' ? { item: 'C8', outcome: 'question', ids: [item.id] } : entry);
      const refused = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(citesOpenQuestion)));
      expect(refused.value.problems).toEqual([item.expected]);
    }
    const ticketPath = join(fx.repo, 'tickets/PROP-201.md');
    writeFileSync(ticketPath, readFileSync(ticketPath, 'utf8').replace('answer: null', 'answer: verified in a spike'));
    const answered = await check(fx, 'PROP-201', 'spec-writer', message);
    expect(answered.value.ok).toBe(true);
    expect(answered.value.problems).toEqual([]);
    const preference = complete.map((item) => item.item === 'C2' ? { item: 'C2', outcome: 'question', ids: ['PROP-201#Q3'] } : item);
    const defaulted = await check(fx, 'PROP-201', 'spec-writer', done('PROP-201', 'spec-writer', checklist(preference)));
    expect(defaulted.value.ok).toBe(true);
    expect(defaulted.value.problems).toEqual([]);
  }, 60_000);

  it('PIP-007/S17 A blocked spec-writer stage needs no checklist', async () => {
    const fx = fixture('prop051-report-s17', { 'PROP-201': 'spec-writer' });
    const blocker = 'blockers: [{ text: "Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?", cites: [PROP-201], external: true }]';
    const bare = await check(fx, 'PROP-201', 'spec-writer', blocked('PROP-201', 'spec-writer', blocker));
    expect(bare.value.ok).toBe(true);
    const ignored = await check(fx, 'PROP-201', 'spec-writer', blocked('PROP-201', 'spec-writer', blocker + '\nchecklist: [{ item: C1, outcome: scenarios, ids: [PRV-001/S9] }]'));
    expect(ignored.value.ok).toBe(true);
  }, 60_000);

  describe('the spec review', () => {
    const sr = (extra = '', result: 'done' | 'blocked' = 'done') => report('role: spec-review\nticket: PROP-201\nresult: ' + result + '\nsummary: Reviewed\n' + extra);
    const finding = (fields: string) => 'findings: [{ ' + fields + ' }]';
    const feature = 'spec/modules/providers/features/PRV-001-stream-a-reply.md';
    /**
     * PROP-201 in its spec-review stage, after a spec-writer stage whose work is committed: PRV-001/S4
     * and SET-001/S4 exist (chat-mini has them only once the reference patch is applied), and the
     * tree is clean.
     */
    const reviewed = (prefix: string) => {
      const fx = fixture(prefix, { 'PROP-201': 'spec-review' });
      fx.apply('reference/PROP-201.spec-writer.patch');
      fx.git('add', '-A');
      fx.git('commit', '-q', '-m', 'PROP-201 spec-writer: the spec change under review');
      return fx;
    };
    /** check-report for the spec review; a refused role is an assertion failure here, not a JSON error. */
    const review = async (fx: Fx, message: string) => {
      const out = await fx.spec(message, 'check-report', 'spec-review', 'PROP-201', '--format', 'json');
      expect(out.stdout, out.stderr).not.toBe('');
      return { value: JSON.parse(out.stdout) as { ok: boolean; problems: string[] } };
    };

    it('PIP-007/S19 The spec review sets a verdict, and changes cite what they are about', async () => {
      const fx = reviewed('prop060-report-s19');
      const none = await review(fx, sr());
      expect(none.value.problems).toEqual(['the spec-review sets verdict: approve or changes']);
      const empty = await review(fx, sr('verdict: changes'));
      expect(empty.value.problems).toEqual(['verdict changes needs at least one finding: { cites, text }']);
      const changes = await review(fx, sr('verdict: changes\n' + finding('cites: [PRV-001/S4], class: C1, text: "no scenario covers a second rate limit"')));
      expect(changes.value.ok).toBe(true);
      expect(changes.value.problems).toEqual([]);
      const approve = await review(fx, sr('verdict: approve\n' + finding('cites: [PRV-001/S4], class: C6, text: "Follow-up: a second rate limit is untested"')));
      expect(approve.value.ok).toBe(true);
      expect(approve.value.problems).toEqual([]);
    }, 60_000);

    it("PIP-007/S20 A spec review's finding cites IDs that exist, and carries no mark", async () => {
      const fx = reviewed('prop060-report-s20');
      const text = 'class: C1, text: "no scenario covers a second rate limit"';
      const cases = [
        { fields: 'cites: [], ' + text, expected: 'each spec-review finding cites at least one ID' },
        { fields: 'cites: [PRV-001/S9], ' + text, expected: 'spec-review finding cites PRV-001/S9, which does not exist' },
        { fields: 'cites: [PRV-001/S4], spec: true, ' + text, expected: 'spec-review findings take no spec or tests mark: every one goes back to the spec-writer' },
        { fields: 'cites: [PRV-001/S4], tests: true, ' + text, expected: 'spec-review findings take no spec or tests mark: every one goes back to the spec-writer' },
      ];
      for (const item of cases) {
        const { value } = await review(fx, sr('verdict: changes\n' + finding(item.fields)));
        expect(value.problems, item.fields).toEqual([item.expected]);
      }
      // The same rules hold under an approval.
      const approved = await review(fx, sr('verdict: approve\n' + finding('cites: [PRV-001/S9], class: C1, text: "Follow-up: x"')));
      expect(approved.value.problems).toContain('spec-review finding cites PRV-001/S9, which does not exist');
      const marked = await review(fx, sr('verdict: approve\n' + finding('cites: [PRV-001/S4], spec: true, class: C1, text: "Follow-up: x"')));
      expect(marked.value.problems).toContain('spec-review findings take no spec or tests mark: every one goes back to the spec-writer');
    }, 60_000);

    it('PIP-007/S21 The spec review changes nothing', async () => {
      const fx = fixture('prop060-report-s21', { 'PROP-201': 'spec-review' });
      const blocker = 'blockers: [{ text: "needs a ruling", cites: [PROP-201] }]';
      const messages = [sr('verdict: approve'), sr(blocker, 'blocked')];
      // Only the ticket file is uncommitted: no problem names a file.
      const ticketPath = join(fx.repo, 'tickets/PROP-201.md');
      writeFileSync(ticketPath, readFileSync(ticketPath, 'utf8') + '\nA note.\n');
      for (const message of messages) {
        const { value } = await review(fx, message);
        expect(value.problems.filter((problem) => problem.includes('edits no files'))).toEqual([]);
        expect(value.problems).toEqual([]);
      }
      // A spec file is uncommitted.
      const specPath = join(fx.repo, feature);
      writeFileSync(specPath, readFileSync(specPath, 'utf8') + '\nA stray line.\n');
      for (const message of messages) {
        const { value } = await review(fx, message);
        expect(value.problems).toEqual(['the spec-review edits no files; revert ' + feature]);
      }
    }, 60_000);
  });

  it('PIP-007/S18 Other stages are never asked for a checklist', async () => {
    const fx = fixture('prop051-report-s18', {
      'PROP-201': 'tester',
      'TASK-101': 'implementer',
      'BUG-301': 'tester',
    }, 'PRV-002/S3 Fallback provider also rate-limits');
    for (const item of [
      { id: 'PROP-201', role: 'tester', extra: validTesterMutations('PRV-001/S1') },
      { id: 'TASK-101', role: 'implementer', extra: '' },
      { id: 'BUG-301', role: 'tester', extra: validTesterMutations('PRV-002/S3') },
    ]) {
      const { value } = await check(fx, item.id, item.role, done(item.id, item.role, item.extra));
      expect(value.problems.filter((problem) => problem.includes('checklist'))).toEqual([]);
    }
  }, 60_000);
});
