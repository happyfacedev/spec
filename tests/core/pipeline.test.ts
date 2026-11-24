import { describe, expect, it } from 'vitest';
import { nextStage } from '../../src/core/pipeline';
import type { HistoryEntry, Role } from '../../src/core/schemas';
import { SPEC_REVIEW } from '../helpers';

const h = (role: Role, result = 'done', verdict: 'approve' | 'changes' | null = null): HistoryEntry => ({ at: 't', role, result: result as HistoryEntry['result'], summary: '', verdict, assumed: [] });

describe('nextStage', () => {
  it('walks each pipeline in order', () => {
    expect(nextStage('proposal', [])).toEqual({ stage: 'spec-writer' });
    // The spec review follows the spec-writer, and the tester follows its approval, before any code changes.
    expect(nextStage('proposal', [h('spec-writer')])).toEqual({ stage: SPEC_REVIEW });
    const approved = [h('spec-writer'), h(SPEC_REVIEW, 'done', 'approve')];
    expect(nextStage('proposal', approved)).toEqual({ stage: 'tester' });
    expect(nextStage('proposal', [...approved, h('tester')])).toEqual({ stage: 'implementer' });
    expect(nextStage('proposal', [...approved, h('tester'), h('implementer')])).toEqual({ stage: 'reviewer' });
    expect(nextStage('bug', [])).toEqual({ stage: 'tester' });
    expect(nextStage('bug', [h('tester')])).toEqual({ stage: 'implementer' });
    expect(nextStage('task', [h('implementer')])).toEqual({ stage: 'reviewer' });
  });

  it('approve finishes; a blocked stage resumes itself', () => {
    expect(nextStage('task', [h('implementer'), h('reviewer', 'done', 'approve')])).toEqual({ done: true });
    expect(nextStage('task', [h('implementer', 'blocked')])).toEqual({ stage: 'implementer' });
  });

  it('changes goes back to the implementer and then straight to review, at most twice', () => {
    const one = [h('spec-writer'), h('tester'), h('implementer'), h('reviewer', 'done', 'changes')];
    expect(nextStage('proposal', one)).toEqual({ stage: 'implementer' });
    expect(nextStage('proposal', [...one, h('implementer')])).toEqual({ stage: 'reviewer' });
    const two = [...one, h('implementer'), h('reviewer', 'done', 'changes')];
    expect(nextStage('proposal', two)).toEqual({ stage: 'implementer' });
    const three = [...two, h('implementer'), h('reviewer', 'done', 'changes')];
    expect(nextStage('proposal', three)).toHaveProperty('blocked');
  });

  it('PIP-001/S11 A reopened stage runs next, and the pipeline continues from it', () => {
    const reopened = [h('spec-writer'), h('tester'), h('implementer', 'blocked'), h('tester', 'reopened')];
    expect(nextStage('proposal', reopened)).toEqual({ stage: 'tester' });
    const testerDone = [...reopened, h('tester')];
    expect(nextStage('proposal', testerDone)).toEqual({ stage: 'implementer' });
    expect(nextStage('proposal', [...testerDone, h('implementer')])).toEqual({ stage: 'reviewer' });
  });

  it('PIP-001/S12 A reopened stage after a round of changes', () => {
    const history = [h('implementer'), h('reviewer', 'done', 'changes'), h('implementer'), h('implementer', 'reopened')];
    expect(nextStage('task', history)).toEqual({ stage: 'implementer' });
    const fixed = [...history, h('implementer')];
    expect(nextStage('task', fixed)).toEqual({ stage: 'reviewer' });
    // The earlier "changes" still count: two more make three, and the third blocks the ticket.
    const second = [...fixed, h('reviewer', 'done', 'changes'), h('implementer')];
    expect(nextStage('task', second)).toEqual({ stage: 'reviewer' });
    expect(nextStage('task', [...second, h('reviewer', 'done', 'changes')])).toHaveProperty('blocked');
  });
});
