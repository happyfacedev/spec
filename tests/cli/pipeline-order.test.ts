// PIP-001: each ticket type's stages in a fixed order.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { planAdvance } from '../../src/core/advance';
import type { Ticket } from '../../src/core/model';
import { nextStage } from '../../src/core/pipeline';
import type { HistoryEntry, Report, Role } from '../../src/core/schemas';
import { gitFixture, loadFixture, SPEC_REVIEW, ticketOf } from '../helpers';

const fx = gitFixture('spec-order');
const loaded = loadFixture();
afterAll(() => {
  fx.cleanup();
});

const NOW = '2026-10-27T12:00:00.000Z';
const h = (role: Role, result: 'done' | 'blocked' = 'done', verdict: 'approve' | 'changes' | null = null): HistoryEntry => ({ at: 't', role, result, summary: '', verdict, assumed: [] });
const report = (r: Partial<Report>): Report => ({ role: 'implementer', ticket: 'X', result: 'done', summary: 'ok', changed: [], assumed: [], blockers: [], verdict: null, findings: [], ...r });

/** A fixture ticket with the given history, its stage running. */
function running(id: string, stage: Role, history: HistoryEntry[]): Ticket {
  const t = ticketOf(loaded.tickets, id);
  return { ...t, data: { ...t.data, status: 'in_progress', stage, history } };
}

const entry = (role: string, result: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: ${result}, summary: x, verdict: ${verdict}, assumed: [] }`;
/** Rewrites a fixture ticket's history (and status), answered questions included. */
function setHistory(id: string, status: string, history: string[]): void {
  const file = join(fx.repo, 'tickets', `${id}.md`);
  const text = readFileSync(file, 'utf8');
  const withHistory = text.replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`).replace(/^status: .*$/m, `status: ${status}`);
  writeFileSync(file, withHistory);
}

describe('PIP-001 stage order', () => {
  it('PIP-001/S1 A proposal runs spec-writer, spec-review, tester, implementer, reviewer', async () => {
    const t = (stage: Role, history: HistoryEntry[], verdict: 'approve' | null = null) => planAdvance(running('PROP-201', stage, history), report({ role: stage, ticket: 'PROP-201', verdict }), NOW).next;
    expect(t('spec-writer', [])).toBe(SPEC_REVIEW);
    expect(t(SPEC_REVIEW, [h('spec-writer')], 'approve')).toBe('tester');
    expect(t('tester', [h('spec-writer'), h(SPEC_REVIEW, 'done', 'approve')])).toBe('implementer');
    expect(t('implementer', [h('spec-writer'), h(SPEC_REVIEW, 'done', 'approve'), h('tester')])).toBe('reviewer');
    expect(nextStage('proposal', [h('spec-writer')])).toEqual({ stage: SPEC_REVIEW });
    const refused = await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester');
    expect(refused.stderr).toContain('the next stage of PROP-201 is spec-writer, not tester');
    const review = await fx.spec('', 'ticket', 'start', 'PROP-201', SPEC_REVIEW);
    expect(review.stderr).toContain('the next stage of PROP-201 is spec-writer, not spec-review');
  });

  it('PIP-001/S2 A bug runs tester, implementer, reviewer', async () => {
    expect(nextStage('bug', [])).toEqual({ stage: 'tester' });
    expect(nextStage('bug', [h('tester')])).toEqual({ stage: 'implementer' });
    expect(nextStage('bug', [h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
    const refused = await fx.spec('', 'ticket', 'start', 'BUG-301', 'implementer');
    expect(refused.stderr).toContain('the next stage of BUG-301 is tester, not implementer');
  });

  it('PIP-001/S3 A task runs implementer, reviewer', async () => {
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'tester');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('tester is not a stage of a task: implementer → reviewer');
  });

  it('PIP-001/S4 Approve finishes the ticket', () => {
    const p = planAdvance(running('TASK-101', 'reviewer', [h('implementer')]), report({ role: 'reviewer', verdict: 'approve' }), NOW);
    expect(p.status).toBe('done');
    expect(p.next).toBeNull();
  });

  it('PIP-001/S5 A blocked stage resumes itself', async () => {
    const file = join(fx.repo, 'tickets/TASK-101.md');
    const text = readFileSync(file, 'utf8')
      .replace('questions: []', 'questions:\n  - id: Q1\n    kind: blocker\n    text: Which name?\n    default: null\n    cites: []\n    answer: select\n    raised_by: implementer')
      .replace(/^history: \[\]$/m, `history:\n${entry('implementer', 'blocked')}`);
    writeFileSync(file, text);
    expect(nextStage('task', [h('implementer', 'blocked')])).toEqual({ stage: 'implementer' });
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'reviewer');
    expect(out.stderr).toContain('the next stage of TASK-101 is implementer, not reviewer');
    fx.git('checkout', '--', 'tickets/TASK-101.md');
  });

  const one = [h('spec-writer'), h('tester'), h('implementer'), h('reviewer', 'done', 'changes')];

  it('PIP-001/S6 Changes go back to the implementer, then straight to review', () => {
    const p = planAdvance(running('PROP-201', 'reviewer', [h('spec-writer'), h('tester'), h('implementer')]), report({ role: 'reviewer', verdict: 'changes', findings: [{ cites: ['PRV-001/S1'], text: 'x' }] }), NOW);
    expect(p.next).toBe('implementer');
    expect(nextStage('proposal', [...one, h('implementer')])).toEqual({ stage: 'reviewer' });
  });

  it('PIP-001/S7 A second round of changes is allowed', () => {
    const p = planAdvance(running('PROP-201', 'reviewer', [...one, h('implementer')]), report({ role: 'reviewer', verdict: 'changes', findings: [{ cites: ['PRV-001/S1'], text: 'x' }] }), NOW);
    expect(p.next).toBe('implementer');
  });

  it('PIP-001/S8 A third round of changes blocks the ticket on a person', () => {
    const history = [h('implementer'), h('reviewer', 'done', 'changes'), h('implementer'), h('reviewer', 'done', 'changes'), h('implementer')];
    const p = planAdvance(running('TASK-101', 'reviewer', history), report({ role: 'reviewer', ticket: 'TASK-101', verdict: 'changes', findings: [{ cites: ['PRV-001/S1'], text: 'x' }] }), NOW);
    expect(p.status).toBe('blocked');
    expect(p.next).toBeNull();
    expect(p.patch.questions?.at(-1)).toMatchObject({
      kind: 'blocker',
      raised_by: 'overseer',
      text: 'the reviewer asked for changes 3 times; a person must decide. How should TASK-101 proceed?',
    });
  });

  it('PIP-001/S9 A ticket past its last stage cannot start again', async () => {
    setHistory('TASK-103', 'open', [entry('implementer', 'done'), entry('reviewer', 'done', 'approve')]);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-103', 'reviewer');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('TASK-103 has finished its pipeline');
  });

  describe('a finding that names a gap in the spec', () => {
    const gap = { cites: ['PRV-001/S3'], text: 'no scenario covers a second rate limit', spec: true };
    const code = { cites: ['PRV-001/R1'], text: 'select.ts ignores the rule' };
    const withFindings = (e: HistoryEntry, findings: unknown[]): HistoryEntry => ({ ...e, findings }) as HistoryEntry;
    const changes = (findings: unknown[]) => withFindings(h('reviewer', 'done', 'changes'), findings);
    const asReviewer = (ticket: string, findings: unknown[]) => report({ role: 'reviewer', ticket, verdict: 'changes', findings: findings as Report['findings'] });
    const prop = [h('spec-writer'), h('tester'), h('implementer')];

    it('PIP-001/S13 A finding that names a gap in the spec sends a proposal back to the spec-writer', async () => {
      const p = planAdvance(running('PROP-201', 'reviewer', prop), asReviewer('PROP-201', [gap, code]), NOW);
      expect(p.next).toBe('spec-writer');
      expect(p.status).toBe('open');
      expect(p.patch.history?.at(-1)).toMatchObject({ role: 'reviewer', verdict: 'changes', findings: [gap, code] });
      setHistory('PROP-201', 'open', [...prop.map((e) => entry(e.role, 'done')), entry('reviewer', 'done', 'changes').replace('assumed: [] }', `assumed: [], findings: [{ cites: [PRV-001/S3], text: "${gap.text}", spec: true }, { cites: [PRV-001/R1], text: "${code.text}" }] }`)]);
      const refused = await fx.spec('', 'ticket', 'start', 'PROP-201', 'implementer');
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('the next stage of PROP-201 is spec-writer, not implementer');
      const accepted = await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
      expect(accepted.code, accepted.stderr).toBe(0);
      fx.git('checkout', '-q', 'main');
      fx.git('checkout', '--', 'tickets/PROP-201.md');
    });

    it('PIP-001/S14 After that, the pipeline goes on from the spec-writer', () => {
      const back = [...prop, changes([gap, code])];
      const approved = h(SPEC_REVIEW, 'done', 'approve');
      expect(nextStage('proposal', [...back, h('spec-writer')])).toEqual({ stage: SPEC_REVIEW });
      expect(nextStage('proposal', [...back, h('spec-writer'), approved])).toEqual({ stage: 'tester' });
      expect(nextStage('proposal', [...back, h('spec-writer'), approved, h('tester')])).toEqual({ stage: 'implementer' });
      expect(nextStage('proposal', [...back, h('spec-writer'), approved, h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
      // The earlier changes count toward the limit of R3, whatever the findings say.
      const third = [h('implementer'), changes([code]), h('implementer'), changes([gap]), h('implementer')];
      const p = planAdvance(running('PROP-201', 'reviewer', [h('spec-writer'), approved, h('tester'), ...third]), asReviewer('PROP-201', [gap]), NOW);
      expect(p.status).toBe('blocked');
      expect(p.next).toBeNull();
    });

    it('PIP-001/S15 A bug goes back to the tester', () => {
      const p = planAdvance(running('BUG-301', 'reviewer', [h('tester'), h('implementer')]), asReviewer('BUG-301', [gap]), NOW);
      expect(p.next).toBe('tester');
      const back = [h('tester'), h('implementer'), changes([gap])];
      expect(nextStage('bug', [...back, h('tester')])).toEqual({ stage: 'implementer' });
      expect(nextStage('bug', [...back, h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
    });

    it('PIP-001/S16 A task has no earlier stage to go back to', () => {
      const p = planAdvance(running('TASK-101', 'reviewer', [h('implementer')]), asReviewer('TASK-101', [gap]), NOW);
      expect(p.next).toBe('implementer');
    });

    it('PIP-001/S17 Findings about the code still go to the implementer', () => {
      const none = planAdvance(running('PROP-201', 'reviewer', prop), asReviewer('PROP-201', [code, { ...code, cites: ['PRV-001/S1'] }]), NOW);
      expect(none.next).toBe('implementer');
      const off = planAdvance(running('PROP-201', 'reviewer', prop), asReviewer('PROP-201', [{ ...code, spec: false }]), NOW);
      expect(off.next).toBe('implementer');
      // Control: the same history with one finding marked as a gap does not.
      expect(planAdvance(running('PROP-201', 'reviewer', prop), asReviewer('PROP-201', [code, gap]), NOW).next).toBe('spec-writer');
    });
  });

  describe('a hand-off to the tester', () => {
    const blocker = { text: 'The test for PRV-001/S4 expects status 200; the scenario says 201', cites: ['PRV-001/S4'], tests: true };
    /** An implementer record that handed its work to the tester (PIP-008/R13), or one as earlier versions recorded a block. */
    const handoff = (): HistoryEntry => ({ ...h('implementer', 'blocked'), blockers: [blocker] });
    const tester = (passed?: boolean): HistoryEntry => ({ ...h('tester'), ...(passed === undefined ? {} : { passed }) });
    const approved = h(SPEC_REVIEW, 'done', 'approve');
    const prop = [h('spec-writer'), approved, h('tester')];
    const flow = (blockers: string) => entry('implementer', 'blocked').replace('assumed: [] }', `assumed: [], blockers: ${blockers} }`);
    const marked = '[{ text: "The test expects 200", cites: [PRV-001/S4], tests: true }]';

    it('PIP-001/S25 A hand-off runs the tester, then the reviewer when the tests pass', async () => {
      // After the hand-off the tester runs, not the implementer again.
      expect(nextStage('proposal', [...prop, handoff()])).toEqual({ stage: 'tester' });
      // The tester's passed decides: true goes to the reviewer; false to the implementer, and once that is done, the reviewer.
      expect(nextStage('proposal', [...prop, handoff(), tester(true)])).toEqual({ stage: 'reviewer' });
      expect(nextStage('proposal', [...prop, handoff(), tester(false)])).toEqual({ stage: 'implementer' });
      expect(nextStage('proposal', [...prop, handoff(), tester(false), h('implementer')])).toEqual({ stage: 'reviewer' });
      // A bug goes to the tester the same way.
      expect(nextStage('bug', [h('tester'), handoff()])).toEqual({ stage: 'tester' });
      expect(nextStage('bug', [h('tester'), handoff(), tester(true)])).toEqual({ stage: 'reviewer' });
      expect(nextStage('bug', [h('tester'), handoff(), tester(false)])).toEqual({ stage: 'implementer' });
      // After a round of reviewer changes the hand-off still runs the tester, and a pass still reaches the reviewer.
      const round = [...prop, h('implementer'), h('reviewer', 'done', 'changes'), handoff()];
      expect(nextStage('proposal', round)).toEqual({ stage: 'tester' });
      expect(nextStage('proposal', [...round, tester(true)])).toEqual({ stage: 'reviewer' });
      expect(nextStage('proposal', [...round, tester(false)])).toEqual({ stage: 'implementer' });

      // Through the CLI: start refuses the implementer, and accepts the tester.
      setHistory('PROP-201', 'open', [entry('spec-writer', 'done'), entry('spec-review', 'done', 'approve'), entry('tester', 'done'), flow(marked)]);
      const refused = await fx.spec('', 'ticket', 'start', 'PROP-201', 'implementer');
      fx.git('checkout', '--', 'tickets/PROP-201.md');
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('the next stage of PROP-201 is tester, not implementer');
      setHistory('BUG-301', 'open', [entry('tester', 'done'), flow(marked)]);
      const bug = await fx.spec('', 'ticket', 'start', 'BUG-301', 'implementer');
      fx.git('checkout', '--', 'tickets/BUG-301.md');
      expect(bug.code).toBe(1);
      expect(bug.stderr).toContain('the next stage of BUG-301 is tester, not implementer');

      // An implementer record with result blocked and no blockers, as every earlier version recorded, is followed by the implementer.
      expect(nextStage('proposal', [...prop, h('implementer', 'blocked')])).toEqual({ stage: 'implementer' });
      // A done tester record with no passed is followed by the implementer.
      expect(nextStage('proposal', [h('spec-writer'), approved, tester()])).toEqual({ stage: 'implementer' });
      expect(nextStage('proposal', [...prop, handoff(), tester()])).toEqual({ stage: 'implementer' });
    });
  });

  describe('the spec review', () => {
    const finding = { cites: ['PRV-001/S4'], text: 'no scenario covers a second rate limit' };
    const asSpecReview = (verdict: 'approve' | 'changes', findings: unknown[] = [finding]) => report({ role: SPEC_REVIEW, ticket: 'PROP-201', verdict, findings: findings as Report['findings'] });
    const sw = h('spec-writer');
    const changes = h(SPEC_REVIEW, 'done', 'changes');
    const approve = h(SPEC_REVIEW, 'done', 'approve');
    const reviewerChanges = (findings: unknown[] = []) => ({ ...h('reviewer', 'done', 'changes'), findings }) as HistoryEntry;

    it('PIP-001/S20 A spec review that asks for changes sends the proposal back to the spec-writer', async () => {
      const p = planAdvance(running('PROP-201', SPEC_REVIEW, [sw]), asSpecReview('changes'), NOW);
      expect(p.next).toBe('spec-writer');
      expect(p.status).toBe('open');
      expect(p.patch.history?.at(-1)).toMatchObject({ role: SPEC_REVIEW, verdict: 'changes', findings: [finding] });
      expect(nextStage('proposal', [sw, { ...changes, findings: [finding] }, sw])).toEqual({ stage: SPEC_REVIEW });
      expect(nextStage('proposal', [sw, changes, sw, approve])).toEqual({ stage: 'tester' });
      setHistory('PROP-201', 'open', [entry('spec-writer', 'done'), entry('spec-review', 'done', 'changes').replace('assumed: [] }', `assumed: [], findings: [{ cites: [PRV-001/S4], text: "${finding.text}" }] }`)]);
      const refused = await fx.spec('', 'ticket', 'start', 'PROP-201', 'tester');
      fx.git('checkout', '--', 'tickets/PROP-201.md');
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('the next stage of PROP-201 is spec-writer, not tester');
    });

    it('PIP-001/S21 A third round of spec review changes blocks the proposal on a person', () => {
      const second = planAdvance(running('PROP-201', SPEC_REVIEW, [sw, changes, sw]), asSpecReview('changes'), NOW);
      expect(second.next).toBe('spec-writer');
      expect(second.status).toBe('open');
      const p = planAdvance(running('PROP-201', SPEC_REVIEW, [sw, changes, sw, changes, sw]), asSpecReview('changes'), NOW);
      expect(p.status).toBe('blocked');
      expect(p.next).toBeNull();
      expect(p.patch.questions?.at(-1)).toMatchObject({
        kind: 'blocker',
        raised_by: 'overseer',
        text: 'the spec-review asked for changes 3 times; a person must decide. How should PROP-201 proceed?',
      });
    });

    it('PIP-001/S22 The spec review and the reviewer count their rounds apart', () => {
      const history = [sw, changes, sw, changes, sw, approve, h('tester'), h('implementer')];
      const reviewer = planAdvance(running('PROP-201', 'reviewer', history), report({ role: 'reviewer', ticket: 'PROP-201', verdict: 'changes', findings: [{ cites: ['PRV-001/S1'], text: 'x' }] }), NOW);
      expect(reviewer.next).toBe('implementer');
      expect(reviewer.status).toBe('open');
      // A reviewer finding that names a gap sends it back; the spec review's earlier two rounds still count.
      const gap = { cites: ['PRV-001/S3'], text: 'no scenario covers a second rate limit', spec: true };
      const back = planAdvance(running('PROP-201', 'reviewer', history), report({ role: 'reviewer', ticket: 'PROP-201', verdict: 'changes', findings: [gap] }), NOW);
      expect(back.next).toBe('spec-writer');
      const again = [...history, reviewerChanges([gap]), sw];
      expect(nextStage('proposal', again)).toEqual({ stage: SPEC_REVIEW });
      expect(nextStage('proposal', [...again, approve])).toEqual({ stage: 'tester' });
      const third = planAdvance(running('PROP-201', SPEC_REVIEW, again), asSpecReview('changes'), NOW);
      expect(third.status).toBe('blocked');
      expect(third.patch.questions?.at(-1)?.text).toBe('the spec-review asked for changes 3 times; a person must decide. How should PROP-201 proceed?');
      // The reviewer's rounds do not count toward the spec review's limit.
      const twoReviewerRounds = [sw, approve, h('tester'), h('implementer'), reviewerChanges(), h('implementer'), reviewerChanges(), h('implementer'), reviewerChanges([gap]), sw];
      const first = planAdvance(running('PROP-201', SPEC_REVIEW, twoReviewerRounds), asSpecReview('changes'), NOW);
      expect(first.next).toBe('spec-writer');
      expect(first.status).toBe('open');
    });

    it('PIP-001/S23 A proposal recorded before the spec review existed', async () => {
      expect(nextStage('proposal', [sw])).toEqual({ stage: SPEC_REVIEW });
      expect(nextStage('proposal', [sw, h('tester')])).toEqual({ stage: 'implementer' });
      expect(nextStage('proposal', [sw, h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
      // PROP-205, as an earlier version recorded it: one done spec-writer stage and nothing after.
      setHistory('PROP-205', 'open', [entry('spec-writer', 'done')]);
      const refused = await fx.spec('', 'ticket', 'start', 'PROP-205', 'tester');
      fx.git('checkout', '--', 'tickets/PROP-205.md');
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('the next stage of PROP-205 is spec-review, not tester');
    });

    it('PIP-001/S24 Bugs and tasks have no spec review', async () => {
      const bug = await fx.spec('', 'ticket', 'start', 'BUG-301', SPEC_REVIEW);
      expect(bug.code).toBe(1);
      expect(bug.stderr).toContain('spec-review is not a stage of a bug: tester → implementer → reviewer');
      const task = await fx.spec('', 'ticket', 'start', 'TASK-101', SPEC_REVIEW);
      expect(task.code).toBe(1);
      expect(task.stderr).toContain('spec-review is not a stage of a task: implementer → reviewer');
      expect(nextStage('bug', [])).toEqual({ stage: 'tester' });
      expect(nextStage('bug', [h('tester')])).toEqual({ stage: 'implementer' });
      expect(nextStage('task', [])).toEqual({ stage: 'implementer' });
      expect(nextStage('task', [h('implementer')])).toEqual({ stage: 'reviewer' });
    });
  });
});
