// The fixed pipeline per ticket type, and the next stage given a ticket's history.
import type { HistoryEntry, Lane, Question, Role, TicketType } from './schemas';

/** Behaviour changes are test-first: the tester writes failing tests before the implementer starts. */
export const PIPELINES: Readonly<Record<TicketType, readonly Role[]>> = {
  proposal: ['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer'],
  bug: ['tester', 'implementer', 'reviewer'],
  task: ['implementer', 'reviewer'],
};

/** The stages of a proposal in a light lane (PIP-021/R1): the reviewer runs in every lane. */
export const LIGHT_PIPELINES: Readonly<Record<Exclude<Lane, 'full'>, readonly Role[]>> = {
  docs: ['spec-writer', 'spec-review', 'reviewer'],
  tests: ['spec-writer', 'tester', 'reviewer'],
  build: ['spec-writer', 'spec-review', 'implementer', 'reviewer'],
};

/**
 * The lane a ticket runs in (PIP-021/R2, R3). The frontmatter lane counts only while the history is empty; after that the
 * first record's lane does, until a record holds "full". Only a proposal has a light lane.
 */
export function laneOf(type: TicketType, frontmatter: Lane | undefined, history: readonly HistoryEntry[]): Lane {
  if (type !== 'proposal') return 'full';
  const first = history[0];
  const started = first === undefined ? frontmatter : first.lane;
  if (started === undefined || started === 'full') return 'full';
  return history.some((h) => h.lane === 'full') ? 'full' : started;
}

/** A stage of the implementer while its ticket is in the build lane: it writes the tests and the code (PIP-021/R9). */
export const isBuildStage = (ticket: { readonly type: TicketType; readonly lane?: Lane | undefined; readonly history: readonly HistoryEntry[] }, role: Role): boolean =>
  role === 'implementer' && laneOf(ticket.type, ticket.lane, ticket.history) === 'build';

/** Whether the history's record at `i` is a build stage's: the ticket was in the build lane when that stage ran. */
export const isBuildRecord = (type: TicketType, history: readonly HistoryEntry[], i: number): boolean =>
  i > 0 && history[i]?.role === 'implementer' && laneOf(type, undefined, history.slice(0, i)) === 'build';

/**
 * Whether the implementer has run, so test first no longer binds a tester stage (PIP-006/R9): any record of it, except that a
 * build stage's counts only when it ended done in its lane; any other left no code on the branch (PIP-021/R10).
 */
export const implementerRan = (type: TicketType, history: readonly HistoryEntry[]): boolean =>
  history.some((h, i) => h.role === 'implementer' && (!isBuildRecord(type, history, i) || (h.result === 'done' && h.lane !== 'full')));

/** The stages of a ticket's lane, in order. */
export function pipelineOf(type: TicketType, frontmatter: Lane | undefined, history: readonly HistoryEntry[]): readonly Role[] {
  const lane = laneOf(type, frontmatter, history);
  return lane === 'full' ? PIPELINES[type] : LIGHT_PIPELINES[lane];
}

/** In a pipeline with a tester stage, the tests are the tester's: the implementer changes code only. */
export const testerOwnsTests = (type: TicketType): boolean => PIPELINES[type].includes('tester');

/** Reviewer "changes" sends the ticket back to the implementer at most this many times. */
export const MAX_REVIEW_ROUNDS = 2;

/** Spec-review "changes" sends the proposal back to the spec-writer at most this many times; counted apart from the reviewer's (PIP-001/R7). */
export const MAX_SPEC_ROUNDS = 2;

export type Next = { stage: Role } | { done: true } | { blocked: string };

/** An answered blocker question carrying the legacy `raised_by: overseer` attribution grants one more round (PIP-002/R8). */
const answeredRoundQuestions = (questions: readonly Question[], who: 'reviewer' | 'spec-review'): number =>
  questions.filter((q) => q.kind === 'blocker' && q.raised_by === 'overseer' && q.answer !== null && q.text.startsWith(`the ${who} asked for changes `)).length;

/** An implementer record that handed its work to the tester: blocked, with its blockers kept (PIP-008/R13). */
export const isHandoff = (h: HistoryEntry): boolean => h.role === 'implementer' && h.result === 'blocked' && (h.blockers?.length ?? 0) > 0;

/** How many hand-offs a ticket may take before a test blocker needs a person (PIP-008/R13). */
export const MAX_HANDOFFS = 2;

export function nextStage(type: TicketType, history: readonly HistoryEntry[], questions: readonly Question[] = [], lane?: Lane): Next {
  const pipeline = pipelineOf(type, lane, history);
  const last = history[history.length - 1];
  if (!last) return { stage: pipeline[0] ?? 'implementer' };
  // A build stage that gave up its lane, done or blocked, is followed by the tester (PIP-021/R10).
  if (last.lane === 'full' && isBuildRecord(type, history, history.length - 1)) return { stage: 'tester' };
  // PIP-001/R8: a hand-off runs the tester; its passed decides between the reviewer and the implementer.
  if (pipeline.includes('tester')) {
    if (isHandoff(last)) return { stage: 'tester' };
    if (last.role === 'tester' && last.result === 'done' && last.passed === true) return { stage: 'reviewer' };
  }
  // A blocked stage resumes where it stopped once its blocker is answered.
  // A reopened stage (`ticket answer --back`) runs next, the same way.
  if (last.result === 'blocked' || last.result === 'reopened') return { stage: last.role };
  const rounds = history.filter((h) => h.role === 'reviewer' && h.verdict === 'changes').length;
  const specRounds = history.filter((h) => h.role === 'spec-review' && h.verdict === 'changes').length;
  if (last.role === 'spec-review' && last.verdict === 'changes') {
    if (specRounds > MAX_SPEC_ROUNDS + answeredRoundQuestions(questions, 'spec-review')) return { blocked: `the spec-review asked for changes ${specRounds} times; a person must decide` };
    return { stage: 'spec-writer' };
  }
  if (last.role === 'reviewer') {
    if (last.verdict !== 'changes') return { done: true };
    if (rounds > MAX_REVIEW_ROUNDS + answeredRoundQuestions(questions, 'reviewer')) return { blocked: `the reviewer asked for changes ${rounds} times; a person must decide` };
    // A finding that names a gap in the spec goes back to the first stage that can fix it (PIP-001/R5).
    if (last.findings?.some((f) => f.spec === true)) {
      const back = pipeline.find((r) => r === 'spec-writer' || r === 'tester');
      if (back) return { stage: back };
    }
    // A finding that asks only for tests goes to the tester first; a task has no tester stage (PIP-001/R6).
    if (last.findings?.some((f) => f.tests === true) && pipeline.includes('tester')) return { stage: 'tester' };
    return { stage: 'implementer' };
  }
  // After a review round the fix goes straight back to review.
  if (last.role === 'implementer' && rounds > 0) return { stage: 'reviewer' };
  const after = pipeline[pipeline.indexOf(last.role) + 1];
  return after ? { stage: after } : { done: true };
}
