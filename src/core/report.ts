// `spec check-report <role> <TICKET>`: validates a finished stage. Pure: git state, lint findings
// and test results arrive as data, gathered by the caller.
import { parse as parseYaml } from 'yaml';
import { type Finding, countErrors } from './findings';
import { scopeQuestions } from './gate';
import { matchesAny } from './glob';
import type { Spec, Ticket } from './model';
import { parseMarkdown } from './markdown';
import { MAX_HANDOFFS, implementerRan, isBuildRecord, isBuildStage, isHandoff, pipelineOf, testerOwnsTests } from './pipeline';
import { type FileHunks, STUB_MARKER, unmarkedChanges } from './stubs';
import { CASE_ITEMS, CHECKLIST_LABELS, type ChecklistItem, type HistoryEntry, type Mutation, type Report, ReportSchema, type Role } from './schemas';
import { classifyId, sortIds } from './ids';
import { owningFeature, ticketScope } from './scope';
import { type TestRun, claimedScenario, coversScenario } from './test-report';
import { scenariosShowing } from './impact';
import { type UnitIndex, statusOf } from './units';

export interface ReportCheck {
  ok: boolean;
  problems: string[];
  report: Report | null;
  /** Set by `ticket advance` for a done tester stage that follows a hand-off (PIP-008/R14). */
  passed?: boolean;
}

/**
 * The report body with its one-line unquoted `summary:` quoted, or null when there is nothing to
 * recover: no such line, a value that starts a quote, block, flow, anchor, alias or tag, or a line
 * that continues on the next one.
 */
function recoverSummary(body: string): string | null {
  const lines = body.split('\n');
  const at = lines.findIndex((l) => /^summary:[ \t]+\S/.test(l));
  if (at < 0) return null;
  const value = (lines[at] ?? '').replace(/^summary:[ \t]+/, '').trimEnd();
  if (/^["'|>[{&*!]/.test(value)) return null;
  const next = lines[at + 1];
  if (next !== undefined && /^[ \t]+\S/.test(next)) return null;
  return lines.map((l, i) => (i === at ? `summary: ${JSON.stringify(value)}` : l)).join('\n');
}

/** The single fenced block with info string `report`, parsed and schema-checked. */
export function extractReport(message: string): { report: Report | null; problems: string[] } {
  const blocks = parseMarkdown(message).blocks.filter((b) => b.type === 'code' && /^ {0,3}(`{3,}|~{3,})\s*report\s*$/.test(b.raw.split('\n')[0] ?? ''));
  if (blocks.length === 0) return { report: null, problems: ['the final message has no ```report block; end with exactly one'] };
  if (blocks.length > 1) return { report: null, problems: [`the final message has ${blocks.length} report blocks; end with exactly one`] };
  const lines = (blocks[0]?.raw ?? '').split('\n');
  const closed = lines.length > 1 && /^ {0,3}(`{3,}|~{3,})\s*$/.test(lines[lines.length - 1] ?? '');
  const body = lines.slice(1, closed ? -1 : undefined).join('\n');
  let raw: unknown;
  try {
    raw = parseYaml(body);
  } catch (e) {
    // PIP-003/R7: only when the YAML fails, an unquoted one-line summary is read as the text after "summary:".
    const recovered = recoverSummary(body);
    try {
      if (recovered === null) throw e;
      raw = parseYaml(recovered);
    } catch {
      return { report: null, problems: [`the report is not valid YAML: ${(e instanceof Error ? e.message : String(e)).split('\n')[0] ?? ''}`] };
    }
  }
  const r = ReportSchema.safeParse(raw);
  if (!r.success) {
    // A key of a finding is named in the message ("report findings: spec: ..."), not in the path (PIP-003/S12).
    const problem = (i: (typeof r.error.issues)[number]) => {
      const msg = i.message.replace(/^id-format:/, 'not a valid ');
      const [head, ...rest] = i.path.map(String);
      if (head === 'findings' && rest.length > 1) return `report findings: ${rest.slice(1).join('.')}: ${msg}`;
      if ((head === 'blockers' || head === 'checklist') && rest.length > 1) return `report ${head}.${rest[0]}: ${msg}`;
      if (head === 'mutations' && rest.length > 1) return `report mutations.${rest[0]}: ${rest.slice(1).join('.')}: ${msg}`;
      return `report ${i.path.map(String).join('.') || '(root)'}: ${msg}`;
    };
    return { report: null, problems: r.error.issues.map(problem) };
  }
  return { report: r.data, problems: [] };
}

/** True when the message holds at least one fenced `report` block, valid or not. */
export function hasReportBlock(message: string): boolean {
  return parseMarkdown(message).blocks.some((b) => b.type === 'code' && /^ {0,3}(`{3,}|~{3,})\s*report\s*$/.test(b.raw.split('\n')[0] ?? ''));
}

export interface StageContext {
  readonly spec: Spec;
  readonly index: UnitIndex;
  readonly ticket: Ticket;
  readonly role: Role;
  /** Uncommitted paths against HEAD, project-root-relative. */
  readonly changedPaths: readonly string[];
  /** Spec root relative to the project root, e.g. `spec`. */
  readonly specPrefix: string;
  readonly ticketsPrefix: string;
  readonly codeGlobs: readonly string[];
  readonly testGlobs: readonly string[];
  readonly protectedGlobs: readonly string[];
  /** Lint findings on the working tree (spec and tickets). */
  readonly lint: readonly Finding[];
  /** The test command's results; required for implementer and tester stages that finish. */
  readonly tests: TestRun | null;
  /** Scenarios the ticket's branch added or changed in the spec (see delta.ts); empty when none. */
  readonly newScenarios: readonly string[];
  /** Build stages: the spec could not be compared with the merge base, so what the branch added or changed is not known. */
  readonly deltaUnknown?: boolean;
  /** Units the ticket's branch removed from the spec (see delta.ts); empty when none. */
  readonly removed: readonly string[];
  /** Retired numbers the ticket's branch took off a feature's `retired` list (see delta.ts). */
  readonly unretired: readonly string[];
  /** Spec-writer stages: units the ticket's branch added or changed (see delta.ts). */
  readonly specChanged: readonly string[];
  /** Spec-writer stages: the numbers another ticket in flight also added with different text (PIP-007/R10), one problem each, already worded. */
  readonly takenNumbers?: readonly string[];
  /** Spec-writer stages: units the ticket's branch added, compared with the merge base (PIP-006/R11). */
  readonly specAdded?: readonly string[];
  /** Tester stages: this stage's changes to code files, hunk by hunk (see stubs.ts). */
  readonly codeChanges: readonly FileHunks[];
  /** Implementer stages: code files where a SPEC-STUB marker the ticket's branch added is still there. */
  readonly stubsLeft: readonly string[];
  /** Problems from format.Config.checkCommands, already worked out by the caller (PIP-006/R7). */
  readonly checkProblems?: readonly string[];
}

/**
 * Words that, in an approving reviewer's summary or findings, name something not delivered (I31).
 * A cheap tripwire, matched without regard to case: an approval that holds every item names no gap.
 */
export const APPROVAL_GAP_WORDS: readonly string[] = ['does not', "doesn't", 'not implemented', 'missing', 'TODO'];

/**
 * The first gap word in an approving report's summary or findings, or null.
 * A finding whose text starts with "Follow-up:" is optional by definition and is not checked (PIP-004/R5).
 */
export function approvalGap(report: Pick<Report, 'summary' | 'findings'>): string | null {
  const findings = report.findings.map((f) => f.text).filter((t) => !t.trimStart().startsWith('Follow-up:'));
  const text = [report.summary, ...findings].join('\n').toLowerCase();
  return APPROVAL_GAP_WORDS.find((w) => text.includes(w.toLowerCase())) ?? null;
}

const under = (path: string, prefix: string) => prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));

/** The stages whose `done` needs a test run, so the caller knows when to run the test command. */
export const needsTests = (role: Role): boolean => role === 'implementer' || role === 'tester';

/** PIP-021/R10: a build stage's report that asks for the full lane gives up the stage, done or blocked: no test or check command runs. */
export const givesUpBuild = (ticket: Ticket, role: Role, report: Pick<Report, 'lane'>): boolean => report.lane === 'full' && isBuildStage(ticket.data, role);

export function checkReport(message: string, ctx: StageContext): ReportCheck {
  const { report, problems } = extractReport(message);
  if (!report) return { ok: false, problems, report: null };
  const p: string[] = [];
  const { ticket, role } = ctx;
  const build = isBuildStage(ticket.data, role);

  // 1. Role and ticket match the ticket's current stage.
  if (report.role !== role) p.push(`the report says role ${report.role}, but this stage is ${role}`);
  if (report.ticket !== ticket.id) p.push(`the report is for ${report.ticket}, but this stage is for ${ticket.id}`);
  if (ticket.data.stage !== role || ticket.data.status !== 'in_progress') {
    p.push(`${ticket.id} is not in stage ${role} (status ${ticket.data.status}, stage ${ticket.data.stage ?? 'none'}); stages begin with spec ticket start`);
  }

  // Ticket files are written by ticket start and advance, so path checks ignore them.
  const paths = ctx.changedPaths.filter((x) => !under(x, ctx.ticketsPrefix));

  // 2. blocked has a blocker; done has none. A blocked stage's changes are ticket advance's to keep.
  if (report.result === 'blocked') {
    if (report.blockers.length === 0) p.push('result blocked needs at least one blocker: { text, cites }');
  } else if (report.blockers.length > 0) {
    p.push('result done cannot list blockers; report blocked, or move them to assumed if they have a safe default');
  }

  // PIP-004/R9: only an implementer on a proposal or a bug marks a blocker tests, and never with external.
  for (const b of report.blockers) {
    if (b.tests !== true) continue;
    if (role !== 'implementer') p.push('only the implementer marks a blocker tests: true');
    else if (ticket.data.type === 'task') p.push('a task has no tester stage: fix the test in this stage, and drop tests: true from the blocker');
    else if (build) p.push('the build lane has no tester stage: fix the test in this stage, and drop tests: true from the blocker');
    else if (b.external === true) p.push('a blocker is marked tests or external, not both');
  }

  // 3. Every ID resolves; every assumed question is an open preference in scope.
  // The ticket itself and its questions are fair to cite (a live trial was bounced for citing TASK-102).
  const resolves = (id: string) => ctx.index.byId.has(id) || ctx.spec.terms.some((t) => t.term === id) || id === ticket.id || id.startsWith(`${ticket.id}#Q`);
  for (const id of report.changed) if (!resolves(id)) p.push(`changed lists ${id}, which does not exist`);
  for (const b of report.blockers) for (const id of b.cites) if (!resolves(id)) p.push(`a blocker cites ${id}, which does not exist`);
  if (role !== 'spec-review') for (const f of report.findings) for (const id of f.cites) if (!resolves(id)) p.push(`a finding cites ${id}, which does not exist`);
  const prefs = new Set(scopeQuestions(ctx.index, ticket).filter((q) => q.kind === 'preference').map((q) => `${q.owner}#${q.id}`));
  for (const a of report.assumed) if ('question' in a && !prefs.has(a.question)) p.push(`assumed ${a.question} is not an open preference of ${ticket.id}`);

  if (role !== 'reviewer' && role !== 'spec-review' && (report.verdict !== null || report.findings.length > 0)) p.push('only the reviewer and the spec review set verdict and findings');
  if (role === 'spec-review') {
    // PIP-007/R9: every finding goes back to the spec-writer, so each cites a unit or question that exists and carries no mark.
    if (report.findings.some((f) => f.cites.length === 0)) p.push('each spec-review finding cites at least one ID');
    for (const f of report.findings) for (const id of f.cites) if (!unitOrQuestionExists(id, ctx)) p.push(`spec-review finding cites ${id}, which does not exist`);
    if (report.findings.some((f) => f.spec === true || f.tests === true)) p.push('spec-review findings take no spec or tests mark: every one goes back to the spec-writer');
    // INV-003: the spec review changes nothing, whether it finishes or blocks.
    if (paths.length > 0) p.push(`the spec-review edits no files; revert ${paths.join(', ')}`);
  }
  // PIP-004/R6: an approval, or a stage with no verdict, names no gap in the spec, done or blocked.
  if (role === 'reviewer' && report.verdict !== 'changes' && report.findings.some((f) => f.spec === true)) p.push('a finding marked spec: true needs verdict changes');
  if (role === 'reviewer' && report.verdict !== 'changes' && report.findings.some((f) => f.tests === true)) p.push('a finding marked tests: true needs verdict changes');
  // PIP-004/R8: every finding of a review names its class, whatever the verdict.
  if (role === 'reviewer' || role === 'spec-review') {
    for (const f of report.findings) if (f.class === undefined) p.push(`finding "${f.text.slice(0, 60)}" has no class; add class: one of C1 to C9, or other`);
  }
  if (role !== 'spec-writer' && (report.checklist?.length ?? 0) > 0) p.push(`only the spec-writer gives a checklist; leave it out of the ${role}'s report`);
  // PIP-019/R1, R5: only the tester, and a build stage, lists mutations, whatever the result.
  const mutations = report.mutations ?? [];
  if (role !== 'tester' && !build && mutations.length > 0) p.push(`only the tester lists mutations; leave them out of the ${role}'s report`);

  if (report.result === 'done' && !givesUpBuild(ticket, role, report)) {
    // 4. Lint is clean, and the changed paths fit the role.
    // A spec review that left files changed is refused for them alone (PIP-007/S21); on a clean tree lint must be clean (PIP-004/R4).
    const errors = role === 'spec-review' && paths.length > 0 ? [] : ctx.lint.filter((f) => f.severity === 'error');
    if (countErrors(errors) > 0) p.push(`lint is not clean: ${errors.slice(0, 5).map((f) => `${f.file}:${f.line} ${f.rule} ${f.message}`).join('; ')}${errors.length > 5 ? `; and ${errors.length - 5} more` : ''}`);
    const spec = paths.filter((x) => under(x, ctx.specPrefix));
    const tests = paths.filter((x) => matchesAny(x, ctx.testGlobs));
    if (role === 'implementer') p.push(...implementerPathProblems(ctx, paths));
    if (role === 'spec-writer') {
      const other = paths.filter((x) => !under(x, ctx.specPrefix));
      if (other.length > 0) p.push(`the spec-writer changes spec files only; revert ${other.join(', ')}`);
    }
    if (role === 'tester') {
      // On a proposal, code may change only by stubs, so tests against new code can compile.
      const stubbable = ticket.data.type === 'proposal';
      const code = stubbable ? paths.filter((x) => !tests.includes(x) && matchesAny(x, ctx.codeGlobs)) : [];
      const other = paths.filter((x) => !tests.includes(x) && !code.includes(x));
      if (other.length > 0) p.push(`the tester changes test files only${stubbable ? `, and code only to add stubs marked ${STUB_MARKER}` : ''}; revert ${other.join(', ')}`);
      for (const u of unmarkedChanges(ctx.codeChanges.filter((f) => code.includes(f.path)))) {
        p.push(`${u.path} changes code without the ${STUB_MARKER} marker ("${u.line.slice(0, 80)}"); the tester adds only stubs that throw, each marked ${STUB_MARKER} — revert anything else`);
      }
    }
    if (role === 'reviewer' && paths.length > 0) p.push(`the reviewer edits no files; revert ${paths.join(', ')}`);
    if (ticket.data.type === 'task' && spec.length > 0 && role !== 'implementer') p.push(`a task changes no spec file in any stage; revert ${spec.join(', ')}`);
    p.push(...protectedProblems(ctx, paths));
    if (role === 'spec-writer' && ticket.data.type !== 'proposal') p.push(`only proposals change the spec; ${ticket.id} is a ${ticket.data.type}`);
    if (role === 'spec-writer') p.push(...removalProblems(ctx), ...ruleProblems(ctx), ...(ctx.takenNumbers ?? []));
    // PIP-006/R11: only a spec-writer lists documents, and only scenarios its branch added.
    const documents = report.documents ?? [];
    if (role !== 'spec-writer' && documents.length > 0) p.push(`only the spec-writer lists documents; leave it out of the ${role}'s report`);
    if (role === 'spec-writer') {
      for (const id of documents) {
        if (!(ctx.specAdded ?? []).includes(id)) p.push(`documents lists ${id}, which this branch did not add; list only new scenarios whose behaviour the current build already has`);
      }
      if (ticket.data.type !== 'task') p.push(...checklistProblems(report.checklist ?? [], ctx));
    }

    // 5. Tests.
    if (needsTests(role)) p.push(...testProblems(ctx, role), ...(ctx.checkProblems ?? []));
    if (role === 'tester' || build) p.push(...mutationProblems(mutations, ctx));

    // 6. Reviewer verdict.
    if (role === 'reviewer') {
      if (report.verdict === null) p.push('the reviewer sets verdict: approve or changes');
      if (report.verdict === 'changes' && report.findings.length === 0) p.push('verdict changes needs at least one finding: { cites, text }');
      for (const f of report.findings) if (f.cites.length === 0) p.push(`finding "${f.text.slice(0, 60)}" cites no ID`);
      if (report.verdict === 'approve' && approvalGap(report) !== null) p.push('an approval names a gap; give changes, or reword if it is not one');
    }
    // 6b. Spec review verdict: no gap-word check, that stays the reviewer's (PIP-004/R5).
    if (role === 'spec-review') {
      if (report.verdict === null) p.push('the spec-review sets verdict: approve or changes');
      if (report.verdict === 'changes' && report.findings.length === 0) p.push('verdict changes needs at least one finding: { cites, text }');
    }
  }
  return { ok: p.length === 0, problems: p, report };
}

/** The paths of a done implementer stage that break PIP-005's rules: spec files, tests on a ticket with a tester, and a SPEC-STUB left in code. */
function implementerPathProblems(ctx: StageContext, paths: readonly string[]): string[] {
  const out: string[] = [];
  const spec = paths.filter((x) => under(x, ctx.specPrefix));
  const tests = paths.filter((x) => matchesAny(x, ctx.testGlobs));
  if (spec.length > 0) out.push(`the implementer never changes spec files; revert ${spec.join(', ')}`);
  if (testerOwnsTests(ctx.ticket.data.type) && !isBuildStage(ctx.ticket.data, 'implementer') && tests.length > 0) {
    out.push(`on a ${ctx.ticket.data.type} the tests are the tester's and the implementer changes code only; revert ${tests.join(', ')}, or report a blocker that cites the scenario whose test is wrong`);
  }
  if (ctx.stubsLeft.length > 0) out.push(`${STUB_MARKER} is still in ${ctx.stubsLeft.join(', ')}; replace every stub with the real code`);
  return out;
}

function protectedProblems(ctx: StageContext, paths: readonly string[]): string[] {
  const guarded = paths.filter((x) => matchesAny(x, ctx.protectedGlobs));
  return guarded.length > 0 ? [`protected files may not change: revert ${guarded.join(', ')}`] : [];
}

/** Ticket files are written by the CLI, so path checks ignore them. */
const stagePaths = (ctx: StageContext): string[] => ctx.changedPaths.filter((x) => !under(x, ctx.ticketsPrefix));

/**
 * PIP-008/R13: a blocked implementer report on a proposal or bug is a candidate for a hand-off to the tester
 * when every blocker is marked tests and the history holds fewer than two hand-offs.
 */
export function handoffCandidate(ticket: Ticket, report: Report): boolean {
  if (report.role !== 'implementer' || report.result !== 'blocked' || !pipelineOf(ticket.data.type, ticket.data.lane, ticket.data.history).includes('tester')) return false;
  if (report.blockers.length === 0 || !report.blockers.every((b) => b.tests === true)) return false;
  return ticket.data.history.filter(isHandoff).length < MAX_HANDOFFS;
}

/**
 * What stops a hand-off (PIP-008/R13): the checks a done implementer stage gets except the tests, which are
 * known to be wrong: the path rules, the SPEC-STUB check and the project's check commands.
 */
export function handoffProblems(ctx: StageContext): string[] {
  const paths = stagePaths(ctx);
  return [...implementerPathProblems(ctx, paths), ...protectedProblems(ctx, paths), ...(ctx.checkProblems ?? [])];
}

/** PIP-008/R14: the last implementer or reviewer stage of the history (a reopened entry is not a stage) is a hand-off. */
export function followsHandoff(history: readonly HistoryEntry[]): boolean {
  const stage = history.findLast((h) => (h.role === 'implementer' || h.role === 'reviewer') && h.result !== 'reopened');
  return stage !== undefined && isHandoff(stage);
}

/**
 * PIP-008/R14: whether the combined tree, the implementer's committed code with the tester's tests, passes every
 * check a done implementer stage gets: the test run, the check commands and no SPEC-STUB left. The path rules do not
 * apply: the tester's own changes are tests.
 */
export function treePasses(run: TestRun | null, stubsLeft: readonly string[], checkProblems: readonly string[]): boolean {
  const testsPass = run !== null && run.error === null && run.exitCode === 0 && !run.tests.some((t) => t.status === 'failed');
  return testsPass && stubsLeft.length === 0 && checkProblems.length === 0;
}

/** A question of the ticket or of a spec unit, by its `<owner>#Q<n>` ID. */
function findQuestion(id: string, ctx: StageContext) {
  const match = /^([^#\s]+)#(Q\d+)$/.exec(id);
  if (!match) return null;
  const [, owner, questionId] = match;
  if (owner === ctx.ticket.id) return ctx.ticket.questions.find((q) => q.id === questionId) ?? null;
  return ctx.index.questions.find((q) => q.owner === owner && q.id === questionId) ?? null;
}

const unitOrQuestionExists = (id: string, ctx: StageContext): boolean => ctx.index.byId.has(id) || findQuestion(id, ctx) !== null;

function checklistProblems(checklist: readonly ChecklistItem[], ctx: StageContext): string[] {
  const out: string[] = [];
  const counts = new Map<string, number>();
  for (const entry of checklist) counts.set(entry.item, (counts.get(entry.item) ?? 0) + 1);
  for (const item of CASE_ITEMS) {
    const count = counts.get(item) ?? 0;
    if (count === 0) out.push(`the checklist has no entry for ${item} (${CHECKLIST_LABELS[item]}); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply`);
    else if (count > 1) out.push(`the checklist has ${count} entries for ${item}; give one`);
  }

  for (const entry of checklist) {
    if (entry.outcome === 'na') {
      if (!entry.reason?.trim()) out.push(`checklist ${entry.item} is na without a reason; say why it does not apply`);
      continue;
    }
    if (entry.ids.length === 0) {
      out.push(`checklist ${entry.item} is ${entry.outcome} but cites no ID; cite what covers it`);
      continue;
    }
    for (const id of entry.ids) {
      const question = findQuestion(id, ctx);
      const unit = ctx.index.byId.get(id);
      if (!unit && !question) {
        out.push(`checklist ${entry.item} cites ${id}, which does not exist`);
        continue;
      }
      const fits = entry.outcome === 'question'
        ? question !== null
        : unit !== undefined && classifyId(id) === (entry.outcome === 'scenarios' ? 'scenario' : 'invariant');
      if (!fits) {
        const kind = entry.outcome === 'scenarios' ? 'a scenario' : entry.outcome === 'invariant' ? 'an invariant' : 'a question';
        out.push(`checklist ${entry.item} cites ${id}, which is not ${kind}`);
        continue;
      }
      if (entry.item === 'C8' && entry.outcome === 'question' && question?.answer === null) {
        out.push(`checklist C8 cites ${id}, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true`);
      }
    }
  }
  return out;
}

/**
 * IDs are never reused, so nothing leaves the spec silently. A scenario or rule leaves its feature
 * by being listed in `retired`; every other unit stays as a tombstone (`status: removed`).
 */
function removalProblems(ctx: StageContext): string[] {
  const out: string[] = ctx.unretired.map((id) => {
    const k = classifyId(id);
    if (k === 'scenario' || k === 'rule') return `${id} was taken off retired; a retired number stays retired`;
    const now = ctx.index.byId.get(id);
    return `${id} was removed and is ${now ? statusOf(now, ctx.index.byId) : 'back'} again; a removed ID is never reused, so give the new unit a new ID`;
  });
  for (const id of ctx.removed) {
    const k = classifyId(id);
    if (k === 'scenario' || k === 'rule') {
      const owner = owningFeature(id) ?? '';
      const f = ctx.spec.features.find((x) => x.id === owner);
      const no = id.slice(id.indexOf('/') + 1);
      if (f && !f.retired.some((r) => r.id === no)) out.push(`${id} was removed; add ${no} to retired in ${owner}, so its number is never reused`);
      // A scenario of a removed feature is reported with its feature, below.
    } else if (!(k === 'field' && ctx.removed.includes(id.split('.').slice(0, 2).join('.')))) {
      out.push(`${id} was removed; keep it as a tombstone with status: removed instead`);
    }
  }
  return out;
}

/**
 * A rule is shown by the scenarios that cite it. A rule that changes while none of them does
 * leaves them showing the old rule, and no test goes red for the new one.
 */
function ruleProblems(ctx: StageContext): string[] {
  const out: string[] = [];
  const changed = new Set(ctx.specChanged);
  for (const id of ctx.specChanged) {
    const k = classifyId(id);
    if (k !== 'rule' && k !== 'invariant' && k !== 'screen') continue;
    // An invariant is shown through the rules that cite it as well (X116). A screen is shown by
    // the scenarios that cite it; only a change to its states or copy gets here (X133).
    const showing = k === 'rule' ? (ctx.spec.features.find((x) => x.id === owningFeature(id))?.scenarios ?? []).filter((s) => s.cites.some((c) => c.id === id)).map((s) => s.id) : scenariosShowing(ctx.spec, id);
    if (showing.length > 0 && !showing.some((s) => changed.has(s))) {
      out.push(`${id} changed, but no scenario that shows it did (${showing.join(', ')}); change them to show the new ${k}, or add one`);
    }
  }
  return out;
}

/** Scenarios a stage answers for: every scenario of every feature in the ticket's scope. */
export function inScopeScenarios(spec: Spec, ticket: Ticket): string[] {
  const features = new Set(ticketScope(ticket.data).units.map(owningFeature).filter((f): f is string => f !== null));
  return spec.features.filter((f) => features.has(f.id)).flatMap((f) => f.scenarios.map((s) => s.id));
}

const NO_RESULTS = 'the test command gave no results: ';

/**
 * PIP-022/R1: why the check could not run, or null. It could not when the test run gave no results and that is the
 * report's only problem; `hasTestCommand` is false when the project sets no testCommand, which is refused as ever.
 */
export function couldNotRun(check: ReportCheck, hasTestCommand: boolean): string | null {
  const [only] = check.problems;
  if (check.ok || !hasTestCommand || check.problems.length !== 1 || only === undefined || !only.startsWith(NO_RESULTS)) return null;
  return only.slice(NO_RESULTS.length);
}

/** PIP-006/R10: the scenarios the latest done spec-writer stage documented as today's behaviour. */
const documentedScenarios = (ticket: Ticket): ReadonlySet<string> => new Set(ticket.data.history.findLast((h) => h.role === 'spec-writer' && h.result === 'done')?.documents ?? []);

/** PIP-006/R1, R4: a test for every scenario in scope, and none named after a scenario the spec does not have. */
function testNameProblems(ctx: StageContext, run: TestRun): string[] {
  const out: string[] = [];
  const required = [...new Set([...inScopeScenarios(ctx.spec, ctx.ticket), ...ctx.newScenarios])];
  for (const s of required) {
    if (!run.tests.some((t) => coversScenario(t.name, s))) out.push(`no test covers ${s}; name it "${s} <scenario title>"`);
  }
  // A test named after a scenario the spec does not have (removed, or mistyped) checks nothing the
  // spec says; whoever owns the tests removes it.
  const prefixes = new Set(ctx.spec.modules.map((m) => m.prefix));
  for (const t of run.tests) {
    const s = claimedScenario(t.name, prefixes);
    if (s !== null && !ctx.index.byId.has(s) && !ctx.newScenarios.includes(s)) out.push(`test "${t.name}" names ${s}, which is not in the spec; delete or rename it`);
  }
  return out;
}

/** The problem of a check that has no test results: a check that could not run (PIP-022/R1) when it is the only one. */
export const noResults = (reason: string): string => `${NO_RESULTS}${reason}`;

/**
 * PIP-024/R3: what a build stage's proof run, its test files on the code before the build, does not show: each scenario the
 * branch added or changed fails there, on an assertion alone, and each documented one passes. No other test's result counts.
 */
export function proofProblems(ticket: Ticket, newScenarios: readonly string[], run: TestRun): string[] {
  const out: string[] = [];
  const documented = documentedScenarios(ticket);
  const files = (run.failedFiles ?? []).slice(0, 5).map((f) => `${f.name}: ${f.message}`).join('; ');
  const where = files === '' ? '' : ` (${files})`;
  for (const s of sortIds(new Set(newScenarios))) {
    const own = run.tests.filter((t) => coversScenario(t.name, s));
    const failed = own.filter((t) => t.status === 'failed');
    if (documented.has(s)) {
      for (const t of failed) {
        out.push(`the test "${t.name}" fails on the code before the build, but the spec-writer listed ${s} under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites ${s}`);
      }
      if (failed.length === 0 && !own.some((t) => t.status === 'passed')) {
        out.push(`no test of ${s} passes on the code before the build${own.length === 0 ? where : ''}, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass`);
      }
      continue;
    }
    if (own.length === 0) out.push(`no test of ${s} ran on the code before the build${where}; write one that fails there on what it asserts, or report with lane: full`);
    else if (failed.length === 0) out.push(`no test of ${s} fails on the code before the build; write one that fails there on what it asserts`);
    for (const t of failed) {
      if (t.failureKind === 'error') {
        out.push(`on the code before the build, the test "${t.name}" fails with an error, not an assertion: ${t.firstErrorLine ?? ''}; make it fail on what it asserts, or report with lane: full`);
      } else if (t.failureKind === undefined) {
        out.push(`on the code before the build, the test report does not say whether the test "${t.name}" failed on an assertion; make the report tell them apart, or report with lane: full`);
      }
    }
  }
  // One problem per test, also when a test covers several scenarios.
  return [...new Set(out)];
}

function testProblems(ctx: StageContext, role: Role): string[] {
  const run = ctx.tests;
  if (!run) return ['the test command was not run'];
  if (run.error !== null) return [noResults(run.error)];
  const failed = run.tests.filter((t) => t.status === 'failed');
  if (role === 'implementer') {
    const out: string[] = [];
    if (run.exitCode !== 0 || failed.length > 0) {
      const names = [...failed.map((t) => t.name), ...(run.failedFiles ?? []).map((f) => `${f.name}: ${f.message}`)].slice(0, 5);
      const tail = run.outputTail ?? [];
      const detail =
        names.length > 0
          ? names.join('; ')
          : tail.length > 0
            ? `the test report names no failed test or file; the test output ends: ${tail.join(' | ')}`
            : 'the test report names no failed test or file, and the test command printed nothing';
      out.push(`tests fail (exit ${run.exitCode ?? '?'}): ${detail}`);
    }
    // PIP-024/R1: a build stage wrote the tests, so they are held as a tester's are; its scenarios include PIP-023's.
    if (isBuildStage(ctx.ticket.data, role)) return [...out, ...testNameProblems(ctx, run)];
    // PIP-023/R1: a proposal or a bug needs a test, of any status, for each scenario it violates, adds or changes.
    // A task names none.
    if (ctx.ticket.data.type !== 'task') {
      for (const s of sortIds(new Set([...ctx.ticket.data.violates, ...ctx.newScenarios]))) {
        if (!run.tests.some((t) => coversScenario(t.name, s))) out.push(`no test covers ${s}; name it "${s} <scenario title>"`);
      }
    }
    return out;
  }
  // Tester: one test per in-scope scenario, written before the code. On a bug, each violated
  // scenario's test fails now. On a proposal, the new behaviour as a whole is red: at least one
  // test of the scenarios it adds or changes fails. (Per scenario would be too strict: a scenario
  // can already hold at runtime, as PROP-201's SET-001/S4 does.)
  const out = testNameProblems(ctx, run);
  // PIP-006/R9: test-first applies only before the implementer's first stage, whatever its result; a build stage's counts only done in its lane.
  const testFirst = !implementerRan(ctx.ticket.data.type, ctx.ticket.data.history);
  if (ctx.ticket.data.type === 'bug' && testFirst) {
    for (const s of ctx.ticket.data.violates) {
      const covering = run.tests.filter((t) => coversScenario(t.name, s));
      if (covering.length > 0 && !covering.some((t) => t.status === 'failed')) out.push(`the test for ${s} passes on the current code; a bug's test must fail before the fix`);
    }
  }
  // PIP-006/R10: scenarios a done spec-writer stage documented as today's behaviour must pass, before or after the implementer.
  // Only the latest done spec-writer stage's list counts.
  const documented = documentedScenarios(ctx.ticket);
  for (const s of documented) {
    const own = run.tests.filter((x) => coversScenario(x.name, s));
    // PIP-006/R9, R10: once an implementer stage exists the scenario is checked like any test-first one.
    if (!testFirst) continue;
    for (const t of own.filter((x) => x.status === 'failed')) {
      out.push(`the test "${t.name}" fails, but the spec-writer listed ${s} under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites ${s}`);
    }
    // A documented scenario with tests needs one that ran and passed; a failure is reported above.
    if (own.length > 0 && !own.some((x) => x.status === 'passed' || x.status === 'failed')) {
      out.push(`no test of ${s} passes, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass`);
    }
  }
  if (ctx.ticket.data.type === 'proposal' && ctx.newScenarios.length > 0) {
    const covering = run.tests.filter((t) => ctx.newScenarios.some((s) => coversScenario(t.name, s)));
    // PIP-006/R3: documented scenarios are left out of those that must start red.
    const undocumented = ctx.newScenarios.filter((s) => !documented.has(s));
    const redCovering = run.tests.filter((t) => undocumented.some((s) => coversScenario(t.name, s)));
    if (testFirst && undocumented.length > 0 && redCovering.length > 0 && !covering.some((t) => t.status === 'failed')) {
      out.push(`every test of the new or changed scenarios (${undocumented.join(', ')}) passes on the current code; tests come before the code, so at least one must fail until the implementer's change`);
    }
    // PIP-006/R8: a new test fails on what it asserts; a stub's error is the stub's.
    for (const t of covering) {
      if (t.status === 'failed' && t.failureKind === 'error' && !(t.firstErrorLine ?? '').includes(STUB_MARKER)) {
        out.push(`the test "${t.name}" fails with an error, not an assertion: ${t.firstErrorLine ?? ''}; make it fail on what it asserts`);
      }
    }
  }
  return out;
}

/**
 * PIP-019/R1: a done tester report on a proposal or a bug names a wrong implementation for every scenario
 * the ticket changes (a proposal's added or changed ones, a bug's violated ones), and none for a scenario
 * the spec lacks. A scenario the branch just added counts as in the spec, as in PIP-006/R4.
 */
function mutationProblems(mutations: readonly Mutation[], ctx: StageContext): string[] {
  const out: string[] = [];
  const type = ctx.ticket.data.type;
  if (type !== 'task') {
    const changed = type === 'bug' ? ctx.ticket.data.violates : ctx.newScenarios;
    // An earlier round names one when a done tester or build stage holds it, and, on a proposal, no done spec-writer stage came after it.
    const history = ctx.ticket.data.history;
    const reset = type === 'proposal' ? history.findLastIndex((h) => h.role === 'spec-writer' && h.result === 'done') : -1;
    const earlier = new Set(history.filter((h, i) => i > reset && h.result === 'done' && (h.role === 'tester' || (isBuildRecord(type, history, i) && h.lane !== 'full'))).flatMap((h) => (h.mutations ?? []).map((m) => m.scenario)));
    for (const id of sortIds(new Set(changed))) {
      if (!earlier.has(id) && !mutations.some((m) => m.scenario === id)) {
        out.push(`the report names no wrong implementation for ${id}; add { scenario: ${id}, wrong: "<a plausible wrong implementation its test fails against>" } under mutations`);
      }
    }
  }
  for (const id of new Set(mutations.map((m) => m.scenario))) {
    if (!(classifyId(id) === 'scenario' && (ctx.index.byId.has(id) || ctx.newScenarios.includes(id)))) {
      out.push(`mutations names ${id}, which is not in the spec; name a scenario your tests cover`);
    }
  }
  return out;
}

export function renderReportCheck(c: ReportCheck): string {
  if (c.ok) return 'report ok\n';
  return `report rejected:\n${c.problems.map((x) => `- ${x}`).join('\n')}\n`;
}
