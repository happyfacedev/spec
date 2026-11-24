// Shared report intake for a role's final message from the main session.
import { extractReport, type ReportCheck } from './report';
import type { Role } from './schemas';

export const MAX_BOUNCES = 3;

export interface FinishReportOps {
  readonly current: (role: Role, named: string | null) => string | null;
  readonly running: (ticket: string) => Role | null;
  readonly checkReport: (role: Role, ticket: string, message: string, transcript: string | null) => ReportCheck;
  readonly bounce: (agentId: string) => number;
  readonly keepRefused: (role: Role, ticket: string, message: string, transcript: string | null) => void;
  /** PIP-022: whether a check that failed could not run, so it is no refusal and uses no attempt. */
  readonly couldNotRun?: (check: ReportCheck) => boolean;
}

export interface FinishReportResult {
  readonly bound: string | null;
  readonly check: ReportCheck;
  readonly attempt: number | null;
  readonly kept: boolean;
  /** The check could not run (PIP-022/R1): nothing was counted or kept. */
  readonly unchecked?: boolean;
}

/** Extract, bind and check one final message, then apply the harness-independent finish bookkeeping. */
export function finishReport(
  role: Role,
  message: string,
  transcript: string | null,
  agentId: string,
  ops: FinishReportOps,
  terminalOnThirdRefusal = false,
): FinishReportResult {
  const extracted = extractReport(message);
  const named = extracted.report?.ticket ?? null;
  const bound = ops.current(role, named);
  let check: ReportCheck;
  if (bound !== null && named !== null && named !== bound) check = { ok: false, problems: [`this run is ${bound}, the report names ${named}`], report: null };
  else if (bound === null && named !== null && ops.running(named) === role) check = { ok: false, problems: [`no ${role} stage runs in this tree, the report names ${named}`], report: null };
  else if (named !== null) check = ops.checkReport(role, named, message, transcript);
  else check = { ok: false, problems: extracted.problems, report: null };

  if (check.ok) return { bound, check, attempt: null, kept: false };
  if (named !== null && ops.couldNotRun?.(check) === true) return { bound, check, attempt: null, kept: false, unchecked: true };

  const attempt = ops.bounce(agentId);
  const kept = terminalOnThirdRefusal ? attempt >= MAX_BOUNCES : attempt > MAX_BOUNCES;
  if (kept && bound !== null) ops.keepRefused(role, bound, message, transcript);
  return { bound, check, attempt, kept };
}
