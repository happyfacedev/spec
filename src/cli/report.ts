// check-report and ticket advance: the end of a stage. Both read the role's final message from a --report-file, else stdin.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { type Measured, planAdvance, planInvalid } from '../core/advance';
import { finishReport, MAX_BOUNCES } from '../core/finish-report';
import { isRecordedCost, isRecordedModel, type StageUsage, readUsage } from '../core/transcript';
import { EMPTY_DELTA, deltaScenarios, deltaUnits } from '../core/delta';
import { PATTERNS, classifyId } from '../core/ids';
import { lintSpec } from '../core/lint';
import type { Ticket } from '../core/model';
import { isBuildStage, laneOf } from '../core/pipeline';
import { type ReportCheck, type StageContext, checkReport, couldNotRun, extractReport, followsHandoff, givesUpBuild, handoffCandidate, handoffProblems, hasReportBlock, needsTests, noResults, proofProblems, renderReportCheck, treePasses } from '../core/report';
import { ROLES, type Role } from '../core/schemas';
import { type TestRun, coversScenario } from '../core/test-report';
import { scopeGaps, ticketScope } from '../core/scope';
import { buildIndex } from '../core/units';
import { toPosix } from '../io/fs';
import { matchesAny } from '../core/glob';
import { filesAddingStubs } from '../core/stubs';
import { addedLinesSince, changedPaths, git, isRepo, mergeBase, uncommittedHunks } from '../io/git';
import { makeProofFolder, removeProofFolder, writeProofTree } from '../io/proof-tree';
import { bumpReportRefusal, clearReport, clearSavedReport, loadReport, loadReportRefusals, loadTranscriptPath, saveReport } from '../io/report-store';
import { forgetStageStartModel, loadSetupPaths, loadStageStartRecord } from '../io/ticket-state';
import { checkCommandProblems } from '../io/check-commands';
import { blockedStashName, stageExcludes, stashStage } from '../io/stash';
import { projectGlobs } from './generated';
import { withTicketTrailer } from '../io/ticket-git';
import { runTestCommandWithTurn, testRunLocation, testRunTicket, withInterruptCleanup } from '../io/test-run-turn';
import { type KeptRun, type RunContext, dropTestRun, keepTestRun, readTestRun, reusable, runContext } from '../io/test-run-store';
import { lockPath, waitForLock } from '../io/lock';
import { loadWorkspace, type Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { writeGenerated } from './commands';
import { type Out, json, ok, usageError } from './output';
import { takenNumberProblems } from './lint-base';
import { ticketDelta } from './spec-delta';
import { worktreeProjectPath } from './worktree';

const fail = (message: string): Out => ({ stdout: '', stderr: `${message}\n`, code: 1 });

/** Whole seconds between two ISO timestamps; 0 when either is missing or unreadable. */
function secondsBetween(from: string | null, to: string): number {
  const a = from === null ? Number.NaN : Date.parse(from);
  const b = Date.parse(to);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.max(0, Math.round((b - a) / 1000));
}

/** The model a stage start record holds, when the record is this ticket's running stage's (PIP-025/R2). */
export function rememberedModel(ticket: Ticket, role: Role, start: ReturnType<typeof loadStageStartRecord>): string | undefined {
  if (start === null || start.stage !== role || !isRecordedModel(start.model)) return undefined;
  if (typeof start.entries !== 'number' || !Number.isInteger(start.entries) || start.entries !== ticket.data.history.length) return undefined;
  return start.model;
}

/** The model and cost the harness reported in the transcript given with --transcript; nothing when it is missing or unreadable. */
function readTranscriptUsage(path: string | null): StageUsage {
  if (path === null) return {};
  try {
    return readUsage(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

/** How a check treats the kept test run (PIP-008/R12): check-report keeps its run; advance reuses one and says when it was made. */
export interface TestRunUse {
  mode: 'check' | 'advance';
  /** The time a fresh run is kept with. */
  at: string;
  /** Advance only: whether a reused run is said on stderr. */
  saysReuse?: boolean;
  /** Called just before a fresh test run starts (PIP-004/R12). */
  beforeRun?: () => void;
  command: 'spec check-report' | 'spec ticket advance';
  stderr?: (text: string) => void;
  notices?: string;
}

/** Puts a line on stderr at once, or with the notices that lead the result's stderr when there is no live one. */
function say(use: TestRunUse, text: string): void {
  if (use.stderr) use.stderr(text);
  else use.notices = `${use.notices ?? ''}${text}`;
}

interface StageRun {
  readonly tests: TestRun;
  /** The context the run was made in; null when it has none. */
  readonly context: RunContext | null;
}

/** The project's test run on the stage's tree: the kept run of the same tree when advance may reuse it, else a fresh one (PIP-008/R12). */
async function testsFor(ws: Workspace, ticket: Ticket, role: Role, reuse?: TestRunUse): Promise<StageRun> {
  if (!ws.config) return { tests: { exitCode: null, tests: [], error: 'config.json has no testCommand' }, context: null };
  // PIP-008/R12: every check first deletes the kept run, then keeps the run it checked.
  const root = ws.projectRoot;
  const command = ws.config.testCommand;
  const context = reuse && isRepo(root) ? runContext(root, ws.specRoot, ticket.id, role, command) : null;
  const kept = reuse?.mode === 'advance' ? readTestRun(root, ticket.id) : null;
  if (reuse) dropTestRun(root, ticket.id);
  let at = reuse?.at ?? '';
  let tests: TestRun;
  if (kept && context && reusable(kept, context)) {
    tests = kept.run;
    at = kept.at;
    if (reuse?.saysReuse === true) say(reuse, `tests: reused the test run made at ${kept.at} on this tree\n`);
  } else {
    const execution = await runTestCommandWithTurn(root, command, '', {
      command: reuse?.command ?? 'spec check-report',
      maxTestRuns: ws.config.maxTestRuns ?? 1,
      ticket: testRunTicket(ws.ticketGit.current),
      location: testRunLocation(root, ws.ticketGit.current),
      ...(reuse?.stderr ? { stderr: reuse.stderr } : {}),
      ...(reuse?.beforeRun ? { beforeStart: reuse.beforeRun } : {}),
    });
    if (reuse && !reuse.stderr) reuse.notices = `${reuse.notices ?? ''}${execution.stderr}`;
    tests = execution.run;
  }
  if (reuse) keepTestRun(root, ticket.id, context, at, tests);
  return { tests, context };
}

/** The proof tree's own name for a check that could not run (PIP-024/R5). */
const BEFORE_BUILD = 'on the code before the build: ';

const noProof = (reason: string): TestRun => ({ exitCode: null, tests: [], error: reason });

/** The project root in the repository's primary worktree, which a ticket's worktree is set up from (WSP-001/R2). */
function mainProjectRoot(ws: Workspace): string {
  const listed = ws.ticketGit.primaryWorktree ?? /^worktree (.+)$/m.exec(git(ws.projectRoot, ['worktree', 'list', '--porcelain']).stdout)?.[1];
  if (listed === undefined) return ws.projectRoot;
  const main = join(listed, git(ws.projectRoot, ['rev-parse', '--show-prefix']).stdout.trim());
  return existsSync(main) ? resolve(main) : ws.projectRoot;
}

/** PIP-024/R2, R4: the project's tests on a build stage's proof tree, a folder of its own that is removed however the run ends. */
async function proofRun(ws: Workspace, ticket: Ticket, context: RunContext, base: string, use: TestRunUse): Promise<TestRun> {
  const config = ws.config;
  if (!config) return noProof('config.json has no testCommand');
  let dir: string;
  try {
    dir = makeProofFolder();
  } catch (err) {
    return noProof(`the proof tree could not be made: ${err instanceof Error ? (err.message.split('\n')[0] ?? '') : String(err)}`);
  }
  const remove = () => { removeProofFolder(dir); };
  try {
    const set = await withInterruptCleanup(remove, async (shell): Promise<{ project: string } | { error: string }> => {
      const written = writeProofTree(dir, {
        projectRoot: ws.projectRoot,
        tree: context.tree,
        base,
        testGlobs: config.testGlobs,
        specPrefix: toPosix(relative(ws.projectRoot, ws.specRoot)),
        ticketsPrefix: ws.ticketsRel,
        setupPaths: loadSetupPaths(ws.projectRoot, ticket.id),
      });
      if ('error' in written || !config.worktreeSetup) return written;
      const s = await shell(written.project, config.worktreeSetup, { ...process.env, SPEC_MAIN_ROOT: mainProjectRoot(ws), SPEC_TICKET: ticket.id });
      if (s.error === null && s.status === 0) return written;
      const output = `${s.stderr}${s.stdout}`.trim() || (s.error ?? `exit ${s.status ?? '?'}`);
      return { error: `worktreeSetup failed: ${output.split('\n').slice(-3).join(' | ')}` };
    });
    if ('error' in set) return noProof(set.error);
    const execution = await runTestCommandWithTurn(set.project, config.testCommand, '', {
      command: use.command,
      maxTestRuns: config.maxTestRuns ?? 1,
      ticket: testRunTicket(ws.ticketGit.current),
      location: testRunLocation(ws.projectRoot, ws.ticketGit.current),
      repositoryRoot: ws.projectRoot,
      ...(use.stderr ? { stderr: use.stderr } : {}),
      beforeStart: () => { say(use, 'tests: running the proof run on the code before the build\n'); },
      onEnd: remove,
    });
    if (!use.stderr) use.notices = `${use.notices ?? ''}${execution.stderr}`;
    return execution.run;
  } finally {
    remove();
  }
}

/**
 * PIP-024: what the proof run of an otherwise accepted build stage finds. `kept` is the proof run an earlier check kept, which
 * advance reuses on the same trees (R6). A run with no results is the problem of a check that could not run (R5).
 */
async function proofOf(ws: Workspace, ticket: Ticket, ctx: StageContext, context: RunContext | null, kept: KeptRun | null, use: TestRunUse): Promise<string[]> {
  const base = mergeBase(ws.projectRoot, ws.config?.baseBranch ?? 'main', 'HEAD');
  if (ctx.deltaUnknown === true || base === null) return [noResults(`${BEFORE_BUILD}the spec at the merge base of HEAD and ${ws.config?.baseBranch ?? 'main'} cannot be read`)];
  if (ctx.newScenarios.length === 0) return [];
  if (context === null) return [noResults(`${BEFORE_BUILD}git could not write the stage's tree`)];
  const now: RunContext = { ...context, base, worktreeSetup: ws.config?.worktreeSetup ?? '' };
  let run: TestRun;
  let at = use.at;
  if (kept && reusable(kept, now)) {
    run = kept.run;
    at = kept.at;
    if (use.saysReuse === true) say(use, `tests: reused the proof run made at ${kept.at} on this tree\n`);
  } else run = await proofRun(ws, ticket, context, base, use);
  if (run.error !== null) return [noResults(`${BEFORE_BUILD}${run.error}`)];
  const problems = proofProblems(ticket, ctx.newScenarios, run);
  if (problems.length === 0) keepTestRun(ws.projectRoot, ticket.id, now, at, run, 'proof');
  return problems;
}

/** Validates a stage's final message against the working tree, running the tests when needed. */
export async function checkStage(ws: Workspace, ticket: Ticket, role: Role, message: string, reuse?: TestRunUse): Promise<ReportCheck> {
  const parsed = extractReport(message).report;
  // A build stage that gives up its lane is checked as a blocked report is (PIP-021/R10).
  const done = parsed?.result === 'done' && !givesUpBuild(ticket, role, parsed);
  const build = isBuildStage(ticket.data, role);
  // Read before the whole-tree run drops what an earlier check kept.
  const keptProof = done && build && reuse?.mode === 'advance' ? readTestRun(ws.projectRoot, ticket.id, 'proof') : null;
  const run = done && needsTests(role) ? await testsFor(ws, ticket, role, reuse) : null;
  const tests = run?.tests ?? null;
  const ctx = stageContext(ws, ticket, role, done, tests);
  const c = checkReport(message, ctx);
  if (done && build && c.ok && reuse) {
    const problems = await proofOf(ws, ticket, ctx, run?.context ?? null, keptProof, reuse);
    return problems.length === 0 ? c : { ...c, ok: false, problems };
  }
  // PIP-008/R14: a done tester stage after a hand-off records whether the combined tree passes every done-implementer check.
  if (reuse?.mode === 'advance' && c.ok && role === 'tester' && c.report?.result === 'done' && followsHandoff(ticket.data.history)) {
    const stubs = stubsLeftIn(ws, ticket);
    const commands = ws.config?.checkCommands ? checkCommandProblems(ws.projectRoot, ws.config.checkCommands, 'implementer', ctx.testGlobs) : [];
    return { ...c, passed: treePasses(tests, stubs, commands) };
  }
  return c;
}

/** PIP-008/R13: what stops a blocked implementer report from handing its work to the tester; empty when nothing does. */
export function handoffBlocks(ws: Workspace, ticket: Ticket): string[] {
  return handoffProblems(stageContext(ws, ticket, 'implementer', true, null));
}

/**
 * Code files where a SPEC-STUB marker the ticket's branch added is still there: counted only where this branch
 * added them, so the marker's own code and docs never count.
 */
function stubsLeftIn(ws: Workspace, ticket: Ticket): string[] {
  const root = ws.projectRoot;
  if (!isRepo(root)) return [];
  const setup = new Set(loadSetupPaths(root, ticket.id));
  const testGlobs = ws.config?.testGlobs ?? [];
  const added = addedLinesSince(root, ws.config?.baseBranch ?? 'main', ws.config?.codeGlobs ?? []);
  return filesAddingStubs(added.filter((f) => !matchesAny(f.path, testGlobs) && !setup.has(f.path)));
}

/**
 * PIP-021/R5 to R7: whether a done stage of a ticket in a light lane leaves the ticket needing a stage its lane skips, read from
 * git and the CLI's own test run, never from the report. Whatever it cannot establish counts as a gap.
 */
async function laneWidens(ws: Workspace, ticket: Ticket, role: Role, use: TestRunUse): Promise<boolean> {
  const d = ticket.data;
  const lane = laneOf(d.type, d.lane, d.history);
  if (lane === 'full' || !isRepo(ws.projectRoot)) return false;
  // The run is the CLI's own, on this tree; a reused one is said by the stage's own check only.
  const probe: TestRunUse = { ...use, mode: 'advance', at: use.at, saysReuse: false };
  if (lane === 'docs' && role === 'spec-writer') {
    const { tests } = await testsFor(ws, ticket, role, probe);
    use.notices = probe.notices;
    if (tests.error !== null || tests.exitCode !== 0 || tests.tests.some((t) => t.status === 'failed')) return true;
    const delta = ticketDelta(ws);
    if (delta === null) return true;
    const scenarios = [...delta.added, ...delta.changed, ...delta.reworded].filter((id) => classifyId(id) === 'scenario');
    return scenarios.some((id) => !tests.tests.some((t) => t.status === 'passed' && coversScenario(t.name, id)));
  }
  if (lane === 'tests' && role === 'spec-writer') {
    const setup = new Set(loadSetupPaths(ws.projectRoot, ticket.id));
    const specPrefix = toPosix(relative(ws.projectRoot, ws.specRoot));
    return changedPaths(ws.projectRoot).some((p) => !setup.has(p) && (p === specPrefix || p.startsWith(`${specPrefix}/`)));
  }
  if (lane === 'tests' && role === 'tester') {
    const { tests } = await testsFor(ws, ticket, role, probe);
    use.notices = probe.notices;
    const commands = ws.config?.checkCommands ? checkCommandProblems(ws.projectRoot, ws.config.checkCommands, 'implementer', ws.config.testGlobs) : [];
    return !treePasses(tests, stubsLeftIn(ws, ticket), commands);
  }
  return false;
}

/**
 * The facts of the working tree a report is checked against. `done` gathers what only a finishing stage
 * needs: the spec delta, the code changes, the stubs left and the check commands.
 */
function stageContext(ws: Workspace, ticket: Ticket, role: Role, done: boolean, tests: TestRun | null): StageContext {
  // A proposal's tester answers for the scenarios its branch added or changed: they must start red.
  // The spec-writer answers for what its branch removed: retired, or kept as a tombstone.
  // The implementer answers for them too: each needs a test in its run (PIP-023/R1).
  const delta = done && (role === 'tester' || role === 'spec-writer' || role === 'implementer') && ticket.data.type === 'proposal' ? ticketDelta(ws) : null;
  const repo = isRepo(ws.projectRoot);
  // What the worktree's setup made (a node_modules link) belongs to no role.
  const setup = new Set(repo ? loadSetupPaths(ws.projectRoot, ticket.id) : []);
  const paths = repo ? changedPaths(ws.projectRoot).filter((p) => !setup.has(p)) : [];
  const codeGlobs = ws.config?.codeGlobs ?? [];
  const testGlobs = ws.config?.testGlobs ?? [];
  // The tester's code changes, to check that each is a marked stub.
  const codePaths = paths.filter((p) => matchesAny(p, codeGlobs) && !matchesAny(p, testGlobs));
  const codeChanges = repo && role === 'tester' && done ? uncommittedHunks(ws.projectRoot, codePaths) : [];
  const stubsLeft = role === 'implementer' && done ? stubsLeftIn(ws, ticket) : [];
  return {
    spec: ws.spec,
    index: buildIndex(ws.spec),
    ticket,
    role,
    changedPaths: paths,
    specPrefix: toPosix(relative(ws.projectRoot, ws.specRoot)),
    ticketsPrefix: ws.ticketsRel,
    codeGlobs,
    testGlobs,
    protectedGlobs: ws.config?.protectedGlobs ?? [],
    lint: lintSpec(ws.spec, { tickets: ws.tickets, budgets: ws.config?.budgets ?? {} }),
    tests,
    newScenarios: delta && (role === 'tester' || role === 'implementer') ? deltaScenarios(delta) : [],
    deltaUnknown: done && delta === null && isBuildStage(ticket.data, role),
    removed: delta && role === 'spec-writer' ? delta.removed : [],
    unretired: delta && role === 'spec-writer' ? delta.unretired : [],
    specChanged: delta && role === 'spec-writer' ? [...delta.added, ...delta.changed] : [],
    specAdded: delta && role === 'spec-writer' ? delta.added : [],
    takenNumbers: delta && role === 'spec-writer' && repo ? takenNumberProblems(ws, ticket.id) : [],
    codeChanges,
    stubsLeft,
    checkProblems:
      done && (role === 'tester' || role === 'implementer') && ws.config?.checkCommands
        ? checkCommandProblems(ws.projectRoot, ws.config.checkCommands, role, testGlobs)
        : [],
  };
}

function findTicket(ws: Workspace, id: string | undefined): Ticket | Out {
  if (!id || !PATTERNS.ticket.test(id)) return usageError(`Unknown ${id ?? '(none)'}.`, USAGE);
  return ws.tickets.tickets.find((t) => t.id === id) ?? usageError(`Unknown ${id}.`, USAGE);
}

/** spec test [<scenario ID>]: the project's test command, one line per test. */
export async function cmdTest(ws: Workspace, args: Args, write?: (text: string) => void): Promise<Out> {
  const filter = args.positionals[0] ?? '';
  if (filter !== '' && !PATTERNS.scenario.test(filter)) return usageError(`Unknown ${filter}. spec test takes a scenario ID, or nothing for every test.`, USAGE);
  if (!ws.config) return fail('config.json has no testCommand');
  const execution = await runTestCommandWithTurn(ws.projectRoot, ws.config.testCommand, filter, {
    command: 'spec test',
    maxTestRuns: ws.config.maxTestRuns ?? 1,
    ticket: testRunTicket(ws.ticketGit.current),
    location: testRunLocation(ws.projectRoot, ws.ticketGit.current),
    ...(write ? { stderr: write } : {}),
  });
  const run = execution.run;
  const passed = run.tests.filter((t) => t.status === 'passed').length;
  const failed = run.tests.filter((t) => t.status === 'failed').length;
  const skipped = run.tests.filter((t) => t.status === 'skipped').length;
  const code = run.error === null && run.exitCode === 0 && failed === 0 ? 0 : 1;
  // PIP-006/R12: the failed-file and output-tail diagnostics belong to the implementer's problem text only.
  const out = args.format === 'json'
    ? json({ exitCode: run.exitCode, tests: run.tests, error: run.error }, code)
    : run.error !== null
      ? { stdout: '', stderr: `spec test: ${run.error}\n`, code: 1 }
      : (() => {
          const lines = run.tests.map((t) => `${t.status === 'passed' ? 'PASS' : t.status === 'failed' ? 'FAIL' : 'SKIP'} ${t.name}`);
          lines.push(`${passed} passed, ${failed} failed, ${skipped} skipped (exit ${run.exitCode ?? '?'})`);
          return ok(`${lines.join('\n')}\n`, code);
        })();
  return execution.stderr === '' ? out : { ...out, stderr: `${execution.stderr}${out.stderr}` };
}

/** PIP-004/R10, R11: the final message in a `--report-file`, read as `ticket advance` reads it; an Out when the path cannot be read. */
function readReportFile(root: string, path: string): string | Out {
  const file = resolve(root, path);
  if (!existsSync(file)) return { stdout: '', stderr: `${path} does not exist\n`, code: 2 };
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    const why = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return { stdout: '', stderr: `${path} cannot be read: ${why}\n`, code: 2 };
  }
}

/**
 * `write` puts a line on stderr at once; without it (a caller that has no live stderr) the notice leads the result's stderr.
 */
export async function cmdCheckReport(ws: Workspace, args: Args, stdin: string, now: () => string = () => new Date().toISOString(), write?: (text: string) => void): Promise<Out> {
  const [role, id] = args.positionals;
  if (!role || !(ROLES as readonly string[]).includes(role)) return usageError(`Unknown role ${role ?? '(none)'}. Roles: ${ROLES.join(', ')}`, USAGE);
  const ticket = findTicket(ws, id);
  if ('code' in ticket) return ticket;
  let message = stdin;
  if (args.reportFile !== null) {
    const read = readReportFile(ws.projectRoot, args.reportFile);
    if (typeof read !== 'string') return read;
    message = read;
  }
  // PIP-004/R12: the caller sees why it waits, before the tests start.
  let notice = '';
  const beforeRun = () => {
    const line = 'tests: running the test command\n';
    if (write) write(line);
    else notice = line;
  };
  const use: TestRunUse = { mode: 'check', at: now(), beforeRun, command: 'spec check-report', ...(write ? { stderr: write } : {}) };
  const c = await checkStage(ws, ticket, role as Role, message, use);
  const code = c.ok ? 0 : 1;
  const out = args.format === 'json' ? json(c, code) : ok(renderReportCheck(c), code);
  const extra = `${notice}${use.notices ?? ''}`;
  return extra === '' ? out : { ...out, stderr: `${extra}${out.stderr}` };
}

/**
 * The finished stage's message: a report file from the main session; else bare report YAML on stdin
 * (a copy that lost its fence). Null when there is none, so
 * a transport slip is refused without touching the ticket.
 */
function stageMessage(ws: Workspace, ticket: string, stdin: string): string | null {
  if (hasReportBlock(stdin)) return stdin;
  const stored = loadReport(ws.projectRoot, ticket);
  if (stored !== null) return stored;
  const wrapped = `\`\`\`report\n${stdin.trim()}\n\`\`\`\n`;
  return stdin.trim() !== '' && extractReport(wrapped).report ? wrapped : null;
}

/** Shared report intake path for main-session `ticket advance --report-file`. */
async function intakeReport(ws: Workspace, ticket: Ticket, role: Role, message: string, transcript: string | null, use: TestRunUse): Promise<ReturnType<typeof finishReport>> {
  // PIP-022/R1: the stored report is consumed only once the check's result is known; a check that could not run
  // touches nothing, so a report another advance stored or consumed meanwhile is never undone.
  const stored = { consumed: false };
  const consume = () => {
    clearSavedReport(ws.projectRoot, ticket.id);
    stored.consumed = true;
  };
  const named = extractReport(message).report?.ticket ?? null;
  const bound = role === ticket.data.stage && ticket.data.status === 'in_progress' ? ticket.id : null;
  const target = named !== null && (bound === null || named === bound) ? ws.tickets.tickets.find((t) => t.id === named) : undefined;
  const prepared = target ? await checkStage(ws, target, role, message, use) : null;
  const result = finishReport(role, message, transcript, ticket.id, {
    current: (stage) => (stage === role && ticket.data.status === 'in_progress' && ticket.data.stage === role ? ticket.id : null),
    running: (id) => {
      const current = ws.tickets.tickets.find((t) => t.id === id);
      return current?.data.status === 'in_progress' ? current.data.stage : null;
    },
    checkReport: (stage, id, final, path) => {
      const current = ws.tickets.tickets.find((t) => t.id === id);
      if (!current) {
        consume();
        return { ok: false, problems: [`the report names ${id}, which is not a ticket`], report: null };
      }
      const checked = prepared ?? { ok: false, problems: ['the report check did not run'], report: null };
      if (couldNotRun(checked, ws.config !== null) === null) {
        consume();
        if (checked.ok) saveReport(ws.projectRoot, id, final, path);
      }
      return checked;
    },
    bounce: () => bumpReportRefusal(ws.projectRoot, ticket.id, role),
    keepRefused: (_stage, id, final, path) => {
      if (!stored.consumed) consume();
      saveReport(ws.projectRoot, id, final, path);
    },
    couldNotRun: (check) => couldNotRun(check, ws.config !== null) !== null,
  }, true);
  // A report refused before any check (no ticket named, wrong ticket) consumes the stored one as a refused report does.
  if (!stored.consumed && result.unchecked !== true) clearSavedReport(ws.projectRoot, ticket.id);
  return result;
}

/** PIP-022/R1: the answer of a check that could not run: nothing is recorded, no refusal is counted, exit 3. */
function checkCouldNotRun(ticket: Ticket, role: Role, c: ReportCheck, reason: string, format: Args['format']): Out {
  if (format === 'json') return json({ ticket: ticket.id, next: null, status: ticket.data.status, problems: c.problems }, 3);
  return { stdout: '', stderr: `the check could not run: the test command gave no results: ${reason}\nNothing was recorded and no refusal was counted; ${ticket.id} still has its ${role} stage running.\nRun the same command again.\n`, code: 3 };
}

/** How long an advance waits for another advance of the same ticket: long enough for its full test run. */
const ADVANCE_LOCK_WAIT_MS = 60 * 60_000;

/** Records the stage that just finished, builds, commits, and names the next stage. */
export async function cmdAdvance(ws: Workspace, args: Args, stdin: string, now: () => string, reportRoot = ws.projectRoot, redirected = false, write?: (text: string) => void): Promise<Out> {
  const use: TestRunUse = { mode: 'advance', at: now(), saysReuse: true, command: 'spec ticket advance', ...(write ? { stderr: write } : {}) };
  const out = await advanceStage(ws, args, stdin, now, use, reportRoot, redirected);
  // PIP-008/R12: a reused run is said first on stderr; stdout does not change.
  const notices = use.stderr ? '' : use.notices ?? '';
  return notices === '' ? out : { ...out, stderr: `${notices}${out.stderr}` };
}

async function advanceStage(ws: Workspace, args: Args, stdin: string, now: () => string, use: TestRunUse, reportRoot: string, redirected: boolean): Promise<Out> {
  const ticket = findTicket(ws, args.positionals[1]);
  if ('code' in ticket) return ticket;
  if (redirected && ws.ticketGit.current !== ticket.id) {
    return fail(`${ticket.id} was redirected to ${ws.projectRoot}, but this worktree does not own ticket/${ticket.id} (it may be detached or on another branch); check out ticket/${ticket.id} there before advancing`);
  }
  if (ws.ticketGit.current !== ticket.id && ws.ticketGit.worktrees.has(ticket.id)) {
    const project = worktreeProjectPath(ws, ticket.id);
    const spec = resolve(project, relative(ws.projectRoot, ws.specRoot));
    const live = await loadWorkspace(spec, null, project);
    return advanceStage(live, args, stdin, now, use, reportRoot, true);
  }
  const role = ticket.data.stage;
  if (ticket.data.status !== 'in_progress' || role === null) return fail(`${ticket.id} has no stage running; spec ticket start begins one`);
  if (!isRepo(ws.projectRoot)) return fail(`${ws.projectRoot} is not a git repository`);
  const hasReportInput = args.reportFile !== null || args.report !== null;
  if (args.reportFile !== null && args.report !== null) return usageError('use either --report-file or --report, not both', USAGE);
  if (args.report !== null && args.report !== '-') return usageError('ticket advance --report takes only - for stdin', USAGE);
  let message: string | null;
  let c: ReportCheck;
  let intake: ReturnType<typeof finishReport> | null = null;
  if (hasReportInput) {
    if (args.reportFile !== null) {
      const file = resolve(reportRoot, args.reportFile);
      if (!existsSync(file)) return fail(`${args.reportFile} does not exist`);
      message = readFileSync(file, 'utf8');
    } else message = stdin;
    intake = await intakeReport(ws, ticket, role, message, args.transcript, use);
    c = intake.check;
    if (intake.unchecked === true) return checkCouldNotRun(ticket, role, c, couldNotRun(c, true) ?? '', args.format);
    if (!c.ok && !intake.kept) {
      const attempt = intake.attempt ?? 1;
      if (args.format === 'json') return json({ ticket: ticket.id, next: null, status: 'in_progress', problems: c.problems, attempt }, 1);
      return fail(`report refused (attempt ${attempt} of ${MAX_BOUNCES}):\n${c.problems.map((p) => `- ${p}`).join('\n')}\n${ticket.id} still has its ${role} stage running`);
    }
  } else {
    message = stageMessage(ws, ticket.id, stdin);
    if (message === null) {
      return usageError(`no report for the ${role} stage of ${ticket.id}: pass the role's final message on stdin. Nothing was recorded; the stage is still running.`, USAGE);
    }
    c = await checkStage(ws, ticket, role, message, use);
    const reason = couldNotRun(c, ws.config !== null);
    if (reason !== null) return checkCouldNotRun(ticket, role, c, reason, args.format);
  }
  // One advance records a ticket's stage at a time, in any tree; the checks before it may overlap. One that finds the
  // stage recorded meanwhile records nothing, so a stage is recorded once (INS-020/R10).
  const lockFile = lockPath(ws.projectRoot, join('advance', `${ticket.id}.lock`));
  const lock = lockFile === null ? null : await waitForLock(lockFile, ADVANCE_LOCK_WAIT_MS);
  if (lockFile !== null && lock !== null && !lock.ok) return fail(`another ticket advance of ${ticket.id} (pid ${String(lock.holder ?? '?')}) holds ${lockFile}; nothing was recorded, the stage is still running`);
  try {
    const live = await ws.store.get(ticket.id);
    if (live !== null && (live.data.status !== 'in_progress' || live.data.stage !== role || live.data.history.length !== ticket.data.history.length)) {
      return fail(`${ticket.id} has no stage running; spec ticket start begins one`);
    }
    return await recordStage(ws, args, ticket, role, c, intake, hasReportInput, now, use);
  } finally {
    if (lock?.ok) lock.release();
  }
}

/** The checked stage's record, build and commit, under the ticket's advance lock. */
async function recordStage(ws: Workspace, args: Args, ticket: Ticket, role: Role, c: ReportCheck, intake: ReturnType<typeof finishReport> | null, hasReportInput: boolean, now: () => string, use: TestRunUse): Promise<Out> {
  // The finish hook keeps the role's transcript with its report; --transcript wins.
  const transcript = args.transcript ?? (hasReportInput ? null : loadTranscriptPath(ws.projectRoot, ticket.id));
  clearReport(ws.projectRoot, ticket.id);
  // The spec-writer's changes are read from the tree, not only from its report: later stages scope
  // their briefs by the ticket's changed units, so a unit the report forgot must still count.
  const specChanged = c.ok && c.report?.result === 'done' && role === 'spec-writer' ? deltaUnits(ticketDelta(ws) ?? EMPTY_DELTA) : [];
  // Every feature the gate's scope rule requires for what the stage changed joins `changed`.
  let scopeAdded: string[] = [];
  if (c.ok && c.report?.result === 'done' && role === 'spec-writer') {
    const changed = [...ticket.data.changed, ...c.report.changed, ...specChanged];
    const scope = ticketScope({ touches: ticket.data.touches, violates: ticket.data.violates, changed });
    scopeAdded = scopeGaps(ws.spec, scope).map((g) => g.id);
  }
  const at = now();
  const refusals = loadReportRefusals(ws.projectRoot, ticket.id, role);
  const stageStart = loadStageStartRecord(ws.projectRoot, ticket.id);
  const usage = readTranscriptUsage(transcript);
  const model = isRecordedModel(usage.model) ? usage.model : rememberedModel(ticket, role, stageStart);
  const measured: Measured = {
    duration_s: secondsBetween(stageStart?.stage === role ? stageStart.started : null, at),
    ...(model === undefined ? {} : { model }),
    ...(isRecordedCost(usage.cost_usd) ? { cost_usd: usage.cost_usd } : {}),
    ...(refusals > 0 ? { refusals } : {}),
  };
  // A blocked stage's work is kept for the next run of that stage, never reverted (H1): the CLI
  // stashes it, so a role never has to, and the tree is clean for whatever starts next.
  let stash: string | null = null;
  // PIP-008/R13: an implementer blocked only on tests hands its committed work to the tester, unless its changes
  // fail a check a done implementer stage gets other than the tests; then it is an ordinary block.
  let handoff = false;
  let notHanded: string[] = [];
  if (c.ok && c.report && handoffCandidate(ticket, c.report)) {
    notHanded = handoffBlocks(ws, ticket);
    handoff = notHanded.length === 0;
  }
  const givesUp = c.ok && c.report !== null && givesUpBuild(ticket, role, c.report);
  if (!c.ok || (c.report?.result === 'blocked' && !handoff) || givesUp) {
    const name = blockedStashName(ticket.id, role, ticket.data);
    const s = stashStage(ws.projectRoot, ws.ticketsRel, ticket.id, name, projectGlobs(ws));
    if ('error' in s) return fail(`${s.error}; nothing was recorded, the stage is still running`);
    if (s.stashed) stash = name;
  }
  const widen = c.ok && c.report?.result === 'done' ? await laneWidens(ws, ticket, role, use) : false;
  const plan = c.ok && c.report ? planAdvance(ticket, c.report, at, [...specChanged, ...scopeAdded], measured, stash, { handoff, notHanded, ...(widen ? { widen } : {}), ...(c.passed === undefined ? {} : { passed: c.passed }) }) : planInvalid(ticket, role, c.problems, at, measured, stash);
  const updated = await ws.store.update(ticket.id, plan.patch, plan.commitMessage || `${ticket.id} ${role}: invalid report`);
  if (!updated.ok) return fail(updated.error);
  const result = { ticket: ticket.id, next: plan.next, status: plan.status, problems: c.problems, ...(stash === null ? {} : { stash }), ...(intake?.attempt === null || intake?.attempt === undefined ? {} : { attempt: intake.attempt }) };
  const stashLine = stash === null ? '' : `stash: ${stash}\n`;
  if (!c.ok) {
    if (stageStart !== null) forgetStageStartModel(ws.projectRoot, ticket.id, stageStart.stage, stageStart.started);
    // Nothing is committed: the stage's changes wait in the stash for the next run of the stage.
    const attemptLine = intake?.attempt === null || intake?.attempt === undefined ? '' : `report refused (attempt ${intake.attempt} of ${MAX_BOUNCES})\n`;
    return args.format === 'json' ? json(result, 1) : { stdout: '', stderr: `${attemptLine}${renderReportCheck(c)}${ticket.id} is blocked; nothing was committed.\n${stashLine}`, code: 1 };
  }
  const built = await writeGenerated(ws);
  if (!built.ok) return fail(`build failed after the ${role} stage: ${built.errors.join('; ')}`);
  // Only this ticket's file: another ticket's uncommitted edit must not ride along, and neither does
  // what the worktree's setup made (PIP-008/R6). A tracker's tickets are not in the repository; the
  // store has already saved this one.
  const add = git(ws.projectRoot, ['add', '-A', '--', '.', ...stageExcludes(ws.projectRoot, ws.ticketsRel, ticket.id)]);
  const addTicket = ws.ticketsInRepo ? git(ws.projectRoot, ['add', '--', ticket.file]) : add;
  if (add.code !== 0 || addTicket.code !== 0) return fail(`git add failed: ${add.stderr.trim() || addTicket.stderr.trim()}`);
  // Every stage leaves a commit, even one that changed nothing: with a tracker, no ticket file
  // rides along, and the branch must still show each stage.
  const commit = git(ws.projectRoot, ['commit', '-q', '--allow-empty', '-m', withTicketTrailer(plan.commitMessage, ticket.id)]);
  if (commit.code !== 0) return fail(`git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`);
  if (stageStart !== null) forgetStageStartModel(ws.projectRoot, ticket.id, stageStart.stage, stageStart.started);
  if (args.format === 'json') return json(result);
  const scopeLine = scopeAdded.length > 0 ? `scope: added ${scopeAdded.join(', ')} to changed\n` : '';
  const handedLine = notHanded.length === 0 ? '' : `not handed to the tester: ${notHanded.join('; ')}\n`;
  return ok(`${plan.commitMessage}\n${plan.next ? `next: ${plan.next}` : `status: ${plan.status}`}\n${scopeLine}${handedLine}${stashLine}`);
}
