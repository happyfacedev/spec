// PIP-004: check a finished stage's report. Core checks run on a built context; S1..S3 and S17 run the CLI.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Finding } from '../../src/core/findings';
import { type StageContext, checkReport } from '../../src/core/report';
import type { Role } from '../../src/core/schemas';
import type { TestRun } from '../../src/core/test-report';
import { gitFixture, loadFixture, report, SPEC_REVIEW, ticketOf, validSpecWriterChecklist } from '../helpers';

const fx = loadFixture();
const names = fx.spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
const PASS: TestRun = { exitCode: 0, tests: names.map((name) => ({ name, status: 'passed' })), error: null };
const lintError = (n: number): Finding => ({ rule: 'L008', severity: 'error', file: 'modules/x.md', line: n, id: 'PRV-001', message: `broken ${n}`, fix: 'fix' });

function check(id: string, stage: Role | null, message: string, o: Partial<StageContext> & { status?: 'open' | 'in_progress' } = {}) {
  const t = ticketOf(fx.tickets, id);
  const { status, ...ctx } = o;
  const ticket = { ...t, data: { ...t.data, status: status ?? (stage ? 'in_progress' : 'open'), stage } };
  return checkReport(message, {
    spec: fx.spec,
    index: fx.index,
    ticket,
    role: stage ?? 'implementer',
    changedPaths: [],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: ['src/**'],
    testGlobs: ['tests/**'],
    protectedGlobs: ['tests/SET-002.test.ts'],
    lint: [],
    tests: PASS,
    newScenarios: [],
    removed: [],
    unretired: [],
    specChanged: [],
    codeChanges: [],
    stubsLeft: [],
    ...ctx,
  });
}

const impl = (extra = '', ticket = 'TASK-101') => report(`role: implementer\nticket: ${ticket}\nresult: done\nsummary: ok\n${extra}`);
const blocked = (cites: string, ticket = 'TASK-102') => report(`role: implementer\nticket: ${ticket}\nresult: blocked\nsummary: stuck\nblockers: [{ text: needs a field, cites: [${cites}] }]`);
const reviewer = (extra: string) => report(`role: reviewer\nticket: TASK-101\nresult: done\nsummary: ok\n${extra}`);

const repo = gitFixture('spec-report-cli');
afterAll(() => {
  repo.cleanup();
});

describe('check-report through the CLI', () => {
  it('PIP-004/S1 A valid stage', async () => {
    expect((await repo.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    mkdirSync(join(repo.repo, 'src/providers'), { recursive: true });
    writeFileSync(join(repo.repo, 'src/providers/select.ts'), 'export const select = 1;\n');
    const out = await repo.spec(impl('changed: [PRV-001/S1]'), 'check-report', 'implementer', 'TASK-101');
    expect(out.stdout.trim()).toBe('report ok');
    expect(out.code).toBe(0);
  }, 60_000);

  it('PIP-004/S2 A refused stage', async () => {
    const out = await repo.spec(impl('verdict: approve'), 'check-report', 'implementer', 'TASK-101');
    expect(out.stdout).toMatch(/^report rejected:\n(- .+\n?)+$/);
    expect(out.code).toBe(1);
  }, 60_000);

  it('PIP-004/S3 JSON output', async () => {
    const msg = impl('changed: [PRV-001/S1]');
    const out = await repo.spec(msg, 'check-report', 'implementer', 'TASK-101', '--format', 'json');
    const r = JSON.parse(out.stdout) as { ok: boolean; problems: string[]; report: { role: string; ticket: string; changed: string[] } };
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
    expect(r.report).toMatchObject({ role: 'implementer', ticket: 'TASK-101', changed: ['PRV-001/S1'] });
    expect(out.code).toBe(0);
  }, 60_000);

  it('PIP-004/S17 Unknown role or ticket', async () => {
    const role = await repo.spec('', 'check-report', 'boss', 'TASK-101');
    expect(role.stderr).toContain('Unknown role boss');
    expect(role.code).toBe(2);
    const ticket = await repo.spec('', 'check-report', 'implementer', 'TASK-999');
    expect(ticket.stderr.startsWith('Unknown TASK-999.')).toBe(true);
    expect(ticket.code).toBe(2);
  });
});

describe('check-report problems', () => {
  it('PIP-004/S4 The report names another role', () => {
    const r = check('TASK-101', 'implementer', report('role: tester\nticket: TASK-101\nresult: done\nsummary: ok'));
    expect(r.problems).toEqual(['the report says role tester, but this stage is implementer']);
  });

  it('PIP-004/S5 The report names another ticket', () => {
    const r = check('TASK-101', 'implementer', impl('', 'TASK-103'));
    expect(r.problems).toEqual(['the report is for TASK-103, but this stage is for TASK-101']);
  });

  it('PIP-004/S6 The ticket is not in that stage', () => {
    const r = check('TASK-101', null, impl());
    expect(r.problems).toEqual(['TASK-101 is not in stage implementer (status open, stage none); stages begin with spec ticket start']);
  });

  it('PIP-004/S7 Blocked needs a blocker', () => {
    const r = check('TASK-102', 'implementer', report('role: implementer\nticket: TASK-102\nresult: blocked\nsummary: stuck'));
    expect(r.problems).toEqual(['result blocked needs at least one blocker: { text, cites }']);
  });

  it('PIP-004/S9 Done lists no blockers', () => {
    const r = check('TASK-101', 'implementer', impl('blockers: [{ text: x, cites: [PRV-001] }]'));
    expect(r.problems).toContain('result done cannot list blockers; report blocked, or move them to assumed if they have a safe default');
  });

  it('PIP-004/S10 Every ID the report names exists', () => {
    expect(check('TASK-101', 'implementer', impl('changed: [PRV-001/S9]')).problems).toEqual(['changed lists PRV-001/S9, which does not exist']);
    expect(check('TASK-102', 'implementer', blocked('PRV-001/S9')).problems).toEqual(['a blocker cites PRV-001/S9, which does not exist']);
    const finding = check('TASK-101', 'reviewer', reviewer('verdict: changes\nfindings: [{ cites: [PRV-001/S9], text: bad, class: C1 }]'));
    expect(finding.problems).toEqual(['a finding cites PRV-001/S9, which does not exist']);
  });

  it('PIP-004/S11 A blocker may cite its own ticket and its questions', () => {
    expect(check('TASK-102', 'implementer', blocked('conversation.Message.meta, TASK-102')).ok).toBe(true);
    const withQuestion = ticketOf(fx.tickets, 'PROP-206');
    expect(withQuestion.data.questions.map((q) => q.id)).toContain('Q1');
    const r = check('PROP-206', 'spec-writer', report('role: spec-writer\nticket: PROP-206\nresult: blocked\nsummary: stuck\nblockers: [{ text: x, cites: [PROP-206#Q1] }]'));
    expect(r.problems).toEqual([]);
  });

  it('PIP-004/S12 An assumed question must be an open preference in scope', () => {
    const r = check('TASK-101', 'implementer', impl('assumed: [{ question: PROP-202#Q1, value: alphabetical }]'));
    expect(r.problems).toEqual(['assumed PROP-202#Q1 is not an open preference of TASK-101']);
    const own = check('PROP-202', 'spec-writer', report('role: spec-writer\nticket: PROP-202\nresult: done\nsummary: ok\nassumed: [{ question: PROP-202#Q1, value: alphabetical }]\n' + validSpecWriterChecklist()));
    expect(own.problems).toEqual([]);
  });

  it('PIP-004/S13 Only the reviewer and the spec review set a verdict or findings', () => {
    expect(check('TASK-101', 'implementer', impl('verdict: approve')).problems).toEqual(['only the reviewer and the spec review set verdict and findings']);
    // The tester's report is refused the same way.
    const tester = check('PROP-201', 'tester', report('role: tester\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: approve'));
    expect(tester.problems).toContain('only the reviewer and the spec review set verdict and findings');
    // A spec-review report with a verdict and findings gives no such problem.
    const specReview = check('PROP-201', SPEC_REVIEW, report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: changes\nfindings: [{ cites: [PRV-001/S3], text: "no scenario covers a second rate limit", class: C1 }]'));
    expect(specReview.problems.filter((p) => p.includes('set verdict and findings'))).toEqual([]);
    const approved = check('PROP-201', SPEC_REVIEW, report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: approve'));
    expect(approved.problems.filter((p) => p.includes('set verdict and findings'))).toEqual([]);
  });

  it('PIP-004/S14 Lint must be clean when done', () => {
    const msg = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: ok\n' + validSpecWriterChecklist());
    const one = check('PROP-201', 'spec-writer', msg, { lint: [lintError(3)] });
    expect(one.problems).toHaveLength(1);
    expect(one.problems[0]).toBe('lint is not clean: modules/x.md:3 L008 broken 3');
    const many = check('PROP-201', 'spec-writer', msg, { lint: [1, 2, 3, 4, 5, 6, 7].map(lintError) });
    expect(many.problems[0]).toBe(`lint is not clean: ${[1, 2, 3, 4, 5].map((n) => `modules/x.md:${n} L008 broken ${n}`).join('; ')}; and 2 more`);
    const warning = check('PROP-201', 'spec-writer', msg, { lint: [{ ...lintError(1), severity: 'warning' }] });
    expect(warning.problems).toEqual([]);
  });

  it('PIP-004/S14 Lint must be clean when done (spec review, clean tree)', () => {
    // A spec review changes no file: no changed path, and the committed spec still holds the lint error.
    const msg = report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: approve');
    const one = check('PROP-201', SPEC_REVIEW, msg, { lint: [lintError(3)] });
    expect(one.problems).toEqual(['lint is not clean: modules/x.md:3 L008 broken 3']);
    expect(one.ok).toBe(false);
    const warning = check('PROP-201', SPEC_REVIEW, msg, { lint: [{ ...lintError(1), severity: 'warning' }] });
    expect(warning.problems).toEqual([]);
  });

  it("PIP-004/S15 The reviewer's verdict", () => {
    expect(check('TASK-101', 'reviewer', reviewer('')).problems).toEqual(['the reviewer sets verdict: approve or changes']);
    expect(check('TASK-101', 'reviewer', reviewer('verdict: changes')).problems).toEqual(['verdict changes needs at least one finding: { cites, text }']);
    const text = 'stream.ts logs the key and also does a number of other things that go past sixty characters';
    const nocites = check('TASK-101', 'reviewer', reviewer(`verdict: changes\nfindings: [{ text: "${text}", class: C4 }]`));
    expect(nocites.problems).toEqual([`finding "${text.slice(0, 60)}" cites no ID`]);
  });

  it('PIP-004/S16 A reviewer asks for changes citing an invariant', () => {
    const r = check('TASK-101', 'reviewer', reviewer('verdict: changes\nfindings: [{ cites: [INV-002, PRV-001/S3], text: stream.ts logs the key, class: C4 }]'));
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  describe('PIP-004/S23 Only an implementer on a proposal or bug marks a blocker tests', () => {
    // The plain chat-mini spec has no PRV-001/S4; PRV-001/S3 stands in, as a blocker's cites must exist.
    const marked = (ticket: string, role: string, extra = '') =>
      report(`role: ${role}\nticket: ${ticket}\nresult: blocked\nsummary: Code done; one test is wrong\nblockers: [{ text: "The test expects status 200; the scenario says 201", cites: [PRV-001/S3], tests: true${extra} }]`);

    it('PIP-004/S23 a blocked implementer report on a proposal or a bug may mark a blocker tests', () => {
      const proposal = check('PROP-201', 'implementer', marked('PROP-201', 'implementer'));
      expect(proposal.problems).toEqual([]);
      expect(proposal.ok).toBe(true);
      expect(proposal.report?.blockers).toEqual([{ text: 'The test expects status 200; the scenario says 201', cites: ['PRV-001/S3'], tests: true }]);
      expect(check('BUG-301', 'implementer', marked('BUG-301', 'implementer'))).toMatchObject({ ok: true, problems: [] });
    });

    it('PIP-004/S23 on a task the same report is refused', () => {
      const r = check('TASK-101', 'implementer', marked('TASK-101', 'implementer'));
      expect(r.problems).toEqual(['a task has no tester stage: fix the test in this stage, and drop tests: true from the blocker']);
      expect(r.ok).toBe(false);
    });

    it("PIP-004/S23 a blocked tester, reviewer, spec-writer or spec-review report holding such a blocker is refused", () => {
      const only = 'only the implementer marks a blocker tests: true';
      expect(check('PROP-201', 'tester', marked('PROP-201', 'tester')).problems).toEqual([only]);
      expect(check('TASK-101', 'reviewer', marked('TASK-101', 'reviewer')).problems).toEqual([only]);
      expect(check('PROP-201', 'spec-writer', marked('PROP-201', 'spec-writer')).problems).toEqual([only]);
      expect(check('PROP-201', SPEC_REVIEW, marked('PROP-201', SPEC_REVIEW)).problems).toEqual([only]);
    });

    it('PIP-004/S23 a blocker marked both tests and external is refused', () => {
      const r = check('PROP-201', 'implementer', marked('PROP-201', 'implementer', ', external: true'));
      expect(r.problems).toEqual(['a blocker is marked tests or external, not both']);
      expect(r.ok).toBe(false);
    });

    it('PIP-004/R9 each blocker that breaks the rule gives one problem; false marks nothing', () => {
      const two = report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: stuck\nblockers: [{ text: a, cites: [PRV-001/S3], tests: true }, { text: b, cites: [PRV-001/S3] }, { text: c, cites: [PRV-001/S3], tests: true }]');
      expect(check('TASK-101', 'implementer', two).problems).toHaveLength(2);
      const off = report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: stuck\nblockers: [{ text: a, cites: [PRV-001/S3], tests: false }]');
      expect(check('TASK-101', 'implementer', off)).toMatchObject({ ok: true, problems: [] });
      // The mark is a boolean: anything else is refused as the report is read.
      const text = report('role: implementer\nticket: PROP-201\nresult: blocked\nsummary: stuck\nblockers: [{ text: a, cites: [PRV-001/S3], tests: "yes" }]');
      const r = check('PROP-201', 'implementer', text);
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]?.startsWith('report blockers.0: ')).toBe(true);
    });
  });

  it('PIP-004/S22 Every review finding names its class', () => {
    // The finding text is quoted in double quotes, as for a finding that cites no ID (R8).
    const noClass = 'finding "stream.ts logs the key" has no class; add class: one of C1 to C9, or other';
    const bare = check('TASK-101', 'reviewer', reviewer('verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: stream.ts logs the key }]'));
    expect(bare.problems).toEqual([noClass]);
    expect(bare.ok).toBe(false);
    // A spec-review report with a finding that has no class gives the same problem.
    const specReview = check('PROP-201', SPEC_REVIEW, report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: changes\nfindings: [{ cites: [PRV-001/S3], text: stream.ts logs the key }]'));
    expect(specReview.problems).toEqual([noClass]);
    // So does a "Follow-up:" finding on an approval, from either role.
    const followUp = 'finding "Follow-up: a second rate limit is untested" has no class; add class: one of C1 to C9, or other';
    const approvedReviewer = check('TASK-101', 'reviewer', reviewer('verdict: approve\nfindings: [{ cites: [PRV-001/S3], text: "Follow-up: a second rate limit is untested" }]'));
    expect(approvedReviewer.problems).toEqual([followUp]);
    const approvedSpecReview = check('PROP-201', SPEC_REVIEW, report('role: spec-review\nticket: PROP-201\nresult: done\nsummary: ok\nverdict: approve\nfindings: [{ cites: [PRV-001/S3], text: "Follow-up: a second rate limit is untested" }]'));
    expect(approvedSpecReview.problems).toEqual([followUp]);
    // Only the first 60 characters of a long text are quoted.
    const long = 'stream.ts logs the key and also does a number of other things that go past sixty characters';
    const longBare = check('TASK-101', 'reviewer', reviewer(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: "${long}" }]`));
    expect(longBare.problems).toEqual([`finding "${long.slice(0, 60)}" has no class; add class: one of C1 to C9, or other`]);
    // One problem per finding without a class; a finding that has one is not named.
    const mixed = check('TASK-101', 'reviewer', reviewer('verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: first, class: C4 }, { cites: [PRV-001/S3], text: second }, { cites: [PRV-001/S3], text: third }]'));
    expect(mixed.problems).toEqual([
      'finding "second" has no class; add class: one of C1 to C9, or other',
      'finding "third" has no class; add class: one of C1 to C9, or other',
    ]);
    // With a class on the finding, the report is accepted.
    const withClass = check('TASK-101', 'reviewer', reviewer('verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: stream.ts logs the key, class: C4 }]'));
    expect(withClass.ok).toBe(true);
    expect(withClass.problems).toEqual([]);
    // Every class of the conventions is accepted, and "other" too.
    for (const cls of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'other']) {
      const r = check('TASK-101', 'reviewer', reviewer(`verdict: changes\nfindings: [{ cites: [PRV-001/S3], text: x, class: ${cls} }]`));
      expect(r.problems, cls).toEqual([]);
    }  });
});
