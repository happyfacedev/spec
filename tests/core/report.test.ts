import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { planAdvance, planInvalid } from '../../src/core/advance';
import type { Finding } from '../../src/core/findings';
import type { Ticket } from '../../src/core/model';
import { APPROVAL_GAP_WORDS, type StageContext, approvalGap, checkReport, extractReport } from '../../src/core/report';
import { ROLES, type Report } from '../../src/core/schemas';
import type { TestRun } from '../../src/core/test-report';
import { loadFixture, ticketOf } from '../helpers';

const fx = loadFixture();

const Case = z.strictObject({
  name: z.string(),
  ticket: z.string(),
  stage: z.enum(ROLES).nullable(),
  paths: z.array(z.string()).default([]),
  tests: z.union([z.enum(['pass', 'fail', 'none']), z.array(z.object({ name: z.string(), status: z.enum(['passed', 'failed', 'skipped']) }))]).default('none'),
  lint_errors: z.number().default(0),
  /** Scenarios the ticket's branch added or changed in the spec. */
  new_scenarios: z.array(z.string()).default([]),
  /** Tester stages: this stage's code changes, as hunks. */
  code_changes: z.array(z.object({ path: z.string(), hunks: z.array(z.object({ removed: z.array(z.string()).default([]), added: z.array(z.string()).default([]) })) })).default([]),
  /** Implementer stages: code files that still hold SPEC-STUB. */
  stubs_left: z.array(z.string()).default([]),
  message: z.string(),
  expect: z.array(z.string()),
});
const corpus = z.array(Case).parse(parse(readFileSync(join(import.meta.dirname, 'report-corpus.yaml'), 'utf8')));

const visibleNames = fx.spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
const testRun = (t: z.infer<typeof Case>['tests']): TestRun | null => {
  if (t === 'none') return null;
  if (t === 'pass') return { exitCode: 0, tests: visibleNames.map((name) => ({ name, status: 'passed' })), error: null };
  if (t === 'fail') return { exitCode: 1, tests: [{ name: 'PRV-001/S1 Streams tokens', status: 'failed' }], error: null };
  return { exitCode: t.some((x) => x.status === 'failed') ? 1 : 0, tests: t, error: null };
};

function inStage(id: string, stage: z.infer<typeof Case>['stage']): Ticket {
  const t = ticketOf(fx.tickets, id);
  return { ...t, data: { ...t.data, status: stage ? 'in_progress' : 'open', stage } };
}

const lintError: Finding = { rule: 'L008', severity: 'error', file: 'modules/x.md', line: 3, id: 'PRV-001', message: 'broken', fix: 'fix' };

describe('check-report corpus', () => {
  it('has at least 20 cases, valid and invalid', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(20);
    expect(corpus.filter((c) => c.expect.length === 0).length).toBeGreaterThanOrEqual(5);
  });
  for (const c of corpus) {
    it(c.name, () => {
      const ctx: StageContext = {
        spec: fx.spec,
        index: fx.index,
        ticket: inStage(c.ticket, c.stage),
        role: c.stage ?? 'implementer',
        changedPaths: c.paths,
        specPrefix: 'spec',
        ticketsPrefix: 'tickets',
        codeGlobs: ['src/**'],
        testGlobs: ['tests/**'],
        protectedGlobs: ['tests/SET-002.test.ts'],
        lint: Array.from({ length: c.lint_errors }, () => lintError),
        tests: testRun(c.tests),
        newScenarios: c.new_scenarios,
        removed: [],
        unretired: [],
        specChanged: [],
        codeChanges: c.code_changes,
        stubsLeft: c.stubs_left,
      };
      const r = checkReport(c.message, ctx);
      expect(r.problems.length, r.problems.join('\n')).toBe(c.expect.length);
      c.expect.forEach((want, i) => {
        expect(r.problems[i]).toContain(want);
      });
      expect(r.ok).toBe(c.expect.length === 0);
    });
  }
});

describe('extractReport', () => {
  it('reads a tilde fence and ignores other code blocks', () => {
    const msg = '```ts\nconst x = 1;\n```\n~~~report\nrole: tester\nticket: BUG-301\nresult: done\nsummary: ok\n~~~\n';
    expect(extractReport(msg).report?.role).toBe('tester');
  });
});

describe('planAdvance', () => {
  const report = (r: Partial<Report>): Report => ({ role: 'implementer', ticket: 'TASK-101', result: 'done', summary: 'Did it\nwell', changed: [], assumed: [], blockers: [], verdict: null, findings: [], ...r });
  const t = inStage('TASK-101', 'implementer');

  it('done: records history, merges changed, names the next stage', () => {
    const p = planAdvance(t, report({ changed: ['PRV-002/S1', 'PRV-001/S1'] }), '2026-10-27T12:00:00.000Z');
    expect(p).toMatchObject({ next: 'reviewer', status: 'open', commitMessage: 'TASK-101 implementer: Did it well' });
    expect(p.patch.changed).toEqual(['PRV-001/S1', 'PRV-002/S1']);
    expect(p.patch.stage).toBeNull();
    expect(p.patch.history?.at(-1)).toMatchObject({ role: 'implementer', result: 'done', summary: 'Did it well' });
  });

  it('blocked: each blocker becomes a blocker question raised by the role', () => {
    const p = planAdvance(t, report({ result: 'blocked', blockers: [{ text: 'Needs a meta field', cites: ['conversation.Message.meta'] }] }), 'now');
    expect(p.status).toBe('blocked');
    expect(p.patch.questions).toEqual([{ id: 'Q1', kind: 'blocker', text: 'Needs a meta field', default: null, cites: ['conversation.Message.meta'], answer: null, raised_by: 'implementer' }]);
  });

  it('a third "changes" verdict blocks the ticket on a person', () => {
    const changes = { at: 't', role: 'reviewer' as const, result: 'done' as const, summary: '', verdict: 'changes' as const, assumed: [] };
    const impl = { ...changes, role: 'implementer' as const, verdict: null };
    const rv = { ...t, data: { ...t.data, stage: 'reviewer' as const, history: [impl, changes, impl, changes, impl] } };
    const p = planAdvance(rv, report({ role: 'reviewer', verdict: 'changes', findings: [{ cites: ['PRV-001/S1'], text: 'x' }] }), 'now');
    expect(p.status).toBe('blocked');
    expect(p.patch.questions?.at(-1)).toMatchObject({ kind: 'blocker', raised_by: 'overseer' });
  });

  it('approve finishes the ticket', () => {
    const rv = { ...t, data: { ...t.data, stage: 'reviewer' as const, history: [{ at: 't', role: 'implementer' as const, result: 'done' as const, summary: '', verdict: null, assumed: [] }] } };
    expect(planAdvance(rv, report({ role: 'reviewer', verdict: 'approve' }), 'now')).toMatchObject({ status: 'done', next: null });
  });

  it('an invalid report blocks the ticket with the problems as a question', () => {
    const p = planInvalid(t, 'implementer', ['tests fail'], 'now');
    expect(p.status).toBe('blocked');
    expect(p.patch.questions?.at(-1)?.text).toMatch(/invalid report: tests fail/);
  });
});

describe('PIP-004/S18 the approval tripwire', () => {
  const approval = (summary: string, findings: string[] = []) => ({ summary, findings: findings.map((text) => ({ cites: ['PRV-001/S3'], text })) });

  it('PIP-004/S18 each word in the one list trips it, in the summary or a finding, whatever its case', () => {
    expect(APPROVAL_GAP_WORDS).toEqual(['does not', "doesn't", 'not implemented', 'missing', 'TODO']);
    for (const w of APPROVAL_GAP_WORDS) {
      expect(approvalGap(approval(`The diff ${w} hold`))).toBe(w);
      expect(approvalGap(approval('Clean', [`it ${w.toUpperCase()} hold`]))).toBe(w);
    }
  });

  it('PIP-004/S18 an approval that names no gap passes', () => {
    expect(approvalGap(approval('Every checklist item holds; behaviour unchanged'))).toBeNull();
  });
});
