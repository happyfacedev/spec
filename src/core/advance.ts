// `spec ticket advance`: what recording one finished stage does to the ticket. Pure; the caller
// writes the ticket, runs build and commits.
import { compareIds } from './ids';
import type { Ticket } from './model';
import { isBuildStage, laneOf, nextStage } from './pipeline';
import type { HistoryEntry, Lane, Question, Report, Role, TicketFrontmatter } from './schemas';
import type { TicketPatch } from './ticket-edit';

export interface AdvancePlan {
  readonly patch: TicketPatch;
  readonly next: Role | null;
  readonly status: TicketFrontmatter['status'];
  readonly commitMessage: string;
}

/** What a stage's recording adds to its history entry: how long it took, and the harness's model and cost. */
export interface Measured {
  readonly duration_s: number;
  readonly model?: string;
  readonly cost_usd?: number;
  /** How many of the stage's reports were refused at intake; left out when none was (PIP-018/R7). */
  readonly refusals?: number;
}

/** What the CLI knows about the stage that the report alone does not say. */
export interface AdvanceOptions {
  /** The report is a hand-off to the tester (PIP-008/R13): its work is committed, no question is raised. */
  readonly handoff?: boolean;
  /** Why a report that asked for a hand-off was refused; each is added to the last question. */
  readonly notHanded?: readonly string[];
  /** A done tester stage that follows a hand-off: whether the combined tree passes every done-implementer check (PIP-008/R14). */
  readonly passed?: boolean;
  /** The CLI found, from git and its own test run, that the ticket needs a stage its light lane skips (PIP-021/R5 to R7). */
  readonly widen?: boolean;
}

/**
 * The lane the new record holds (PIP-021/R2 to R4, R8): the first record keeps the light lane the ticket started in; any record
 * holds "full" when it moves the ticket out of a light lane, because the report asked for it, the CLI found a gap, or a reviewer's
 * changes carry a spec or tests mark. Left out otherwise; a stage can only widen a lane.
 */
function recordedLane(ticket: Ticket, report: Report, widen: boolean): Lane | undefined {
  const d = ticket.data;
  const before = laneOf(d.type, d.lane, d.history);
  if (before === 'full') return undefined;
  const marked = report.role === 'reviewer' && report.result === 'done' && report.verdict === 'changes' && report.findings.some((f) => f.spec === true || f.tests === true);
  if (report.lane === 'full' || widen || marked) return 'full';
  return d.history.length === 0 ? before : undefined;
}

/** The lane of a first record that holds no report (an invalid one): the light lane the ticket starts in, so it is fixed (PIP-021/R2). */
const firstLane = (ticket: Ticket): Lane | undefined => {
  const lane = laneOf(ticket.data.type, ticket.data.lane, ticket.data.history);
  return ticket.data.history.length === 0 && lane !== 'full' ? lane : undefined;
};

function nextQuestionNumber(qs: readonly Question[]): number {
  return Math.max(0, ...qs.map((q) => Number(q.id.slice(1)))) + 1;
}

const blockerQuestion = (n: number, text: string, cites: readonly string[] | undefined, raisedBy: string, kind: Question['kind'] = 'blocker'): Question => ({
  id: `Q${n}`,
  kind,
  text,
  default: null,
  cites: [...(cites ?? [])],
  answer: null,
  raised_by: raisedBy,
});

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A commit subject of at most 120 characters; the ticket history keeps the full summary. */
const subject = (s: string) => (s.length <= 120 ? s : `${s.slice(0, 119).trimEnd()}…`);

/**
 * Records a checked report. Blockers become blocker questions, so the gate refuses until answered.
 * `specChanged`: units the stage changed in the spec, read from the tree; merged like `changed`.
 */
export function planAdvance(ticket: Ticket, report: Report, at: string, specChanged: readonly string[] = [], measured: Measured = { duration_s: 0 }, stash: string | null = null, options: AdvanceOptions = {}): AdvancePlan {
  const d = ticket.data;
  const handoff = options.handoff === true && report.result === 'blocked';
  const lane = recordedLane(ticket, report, options.widen === true);
  const build = isBuildStage(d, report.role);
  // A done build stage that stays in its lane keeps its mutations as a tester's are (PIP-021/R9, R10).
  const namesMutations = report.role === 'tester' || (build && lane !== 'full');
  const entry: HistoryEntry = { at, role: report.role, result: report.result, summary: oneLine(report.summary), verdict: report.verdict, ...((report.role === 'reviewer' || report.role === 'spec-review') && report.findings.length > 0 ? { findings: report.findings } : {}), ...(report.role === 'spec-writer' && report.result === 'done' && report.checklist !== undefined && report.checklist.length > 0 ? { checklist: report.checklist } : {}), ...(report.role === 'spec-writer' && report.result === 'done' && report.documents !== undefined && report.documents.length > 0 ? { documents: report.documents } : {}), ...(namesMutations && report.result === 'done' && report.mutations !== undefined && report.mutations.length > 0 ? { mutations: report.mutations } : {}), ...(handoff ? { blockers: report.blockers } : {}), ...(report.role === 'tester' && report.result === 'done' && options.passed !== undefined ? { passed: options.passed } : {}), ...(lane === undefined ? {} : { lane }), assumed: report.assumed, ...measured };
  const history = [...d.history, entry];
  const questions = [...d.questions];
  let n = nextQuestionNumber(questions);
  // A hand-off raises no question (PIP-008/R13).
  const blockers = report.result === 'blocked' && !handoff ? report.blockers : [];
  // The last question it adds says where the stage's work is kept, and why a hand-off was refused.
  const problems = options.notHanded ?? [];
  const noted = (text: string) => {
    const kept = stash === null ? text : `${/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`}${stashNote(report.role, stash, build ? lane ?? 'build' : undefined)}`;
    return problems.length === 0 ? kept : `${/[.!?]$/.test(kept.trim()) ? kept.trim() : `${kept.trim()}.`} Not handed to the tester: ${problems.join('; ')}`;
  };
  blockers.forEach((b, i) => questions.push(blockerQuestion(n++, i === blockers.length - 1 ? noted(b.text) : b.text, b.cites, report.role, b.external === true ? 'external' : 'blocker')));
  const changed = report.result === 'done' ? [...new Set([...d.changed, ...report.changed, ...specChanged])].sort(compareIds) : [...d.changed];

  const next = nextStage(d.type, history, d.questions, d.lane);
  let status: TicketFrontmatter['status'];
  let nextRole: Role | null = null;
  if (report.result === 'blocked' && !handoff) status = 'blocked';
  else if ('done' in next) status = 'done';
  else if ('blocked' in next) {
    status = 'blocked';
    questions.push(blockerQuestion(n, `${next.blocked}. How should ${ticket.id} proceed?`, [], 'overseer'));
  } else {
    status = 'open';
    nextRole = next.stage;
  }
  return {
    patch: { status, stage: null, changed, questions, history },
    next: nextRole,
    status,
    commitMessage: subject(`${ticket.id} ${report.role}: ${oneLine(report.summary)}`),
  };
}

/** The ticket's questions with one more blocker attribution, numbered after the highest. */
export const withBlocker = (qs: readonly Question[], text: string, raisedBy: string): Question[] => [...qs, blockerQuestion(nextQuestionNumber(qs), text, [], raisedBy)];

/**
 * What a blocked stage's question says about the work it left: where it is kept, or nothing. `lane` is a build stage's:
 * only the next build stage gets its work back, and none once its record left the lane (PIP-021/R11).
 */
export const stashNote = (role: Role, stash: string | null, lane?: Lane): string => {
  if (stash === null) return '';
  const back = lane === 'full' ? 'no later stage gets them back' : `the next ${lane === 'build' ? 'build' : role} stage gets them back`;
  return ` Its changes are kept in git stash "${stash}"; ${back}.`;
};

/**
 * A report that failed its checks still ends the stage: the ticket blocks on a person. `stash`
 * names where the stage's changes were kept, or null when it left none.
 */
export function planInvalid(ticket: Ticket, role: Role, problems: readonly string[], at: string, measured: Measured = { duration_s: 0 }, stash: string | null = null): AdvancePlan {
  const d = ticket.data;
  const text = `The ${role} stage ended with an invalid report: ${problems.join('; ')}.${stashNote(role, stash, isBuildStage(d, role) ? 'build' : undefined)} Answer to resume.`;
  const questions = withBlocker(d.questions, text, role);
  const lane = firstLane(ticket);
  const history = [...d.history, { at, role, result: 'blocked' as const, summary: 'invalid report', verdict: null, ...(lane === undefined ? {} : { lane }), assumed: [], ...measured }];
  return { patch: { status: 'blocked', stage: null, questions, history }, next: null, status: 'blocked', commitMessage: '' };
}
