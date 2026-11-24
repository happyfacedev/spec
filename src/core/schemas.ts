// zod schemas: the single source for unit, ticket and config types and their validation.
// ID-shaped fields carry an `id-format:` message so their failures map to L002, not L001.
import { isMap, isScalar, isSeq } from 'yaml';
import { z } from 'zod';
import { PATTERNS, classifyId, isFeatureId } from './ids';
import { isRecordedCost, isRecordedModel } from './transcript';
import { isProjectRelativeGlob } from './glob';

export const ID_FORMAT = 'id-format:';

const idOf = (kind: string, test: (s: string) => boolean) =>
  z.string().refine(test, { error: `${ID_FORMAT}${kind}` });

export const featureId = idOf('feature', isFeatureId);
export const scenarioId = idOf('scenario', (s) => classifyId(s) === 'scenario');
export const contractRef = idOf('contract', (s) => PATTERNS.contract.test(s));
export const invariantId = idOf('invariant', (s) => PATTERNS.invariant.test(s));
export const decisionId = idOf('decision', (s) => PATTERNS.decision.test(s));
export const screenId = idOf('screen', (s) => PATTERNS.screen.test(s));
export const moduleId = idOf('module', (s) => PATTERNS.module.test(s));
export const prefixId = idOf('prefix', (s) => PATTERNS.prefix.test(s));
export const ticketId = idOf('ticket', (s) => PATTERNS.ticket.test(s));
export const questionId = idOf('question', (s) => PATTERNS.question.test(s));
export const retiredNumber = idOf('retired scenario or rule number (S<n> or R<n>)', (s) => PATTERNS.retired.test(s));

/** The spec format this CLI reads and writes. A spec names its format in config.json `formatVersion`. */
export const FORMAT_VERSION = 2;

const UNIT_KINDS = new Set(['feature', 'scenario', 'rule', 'contract', 'field', 'invariant', 'decision', 'screen']);
/** Any spec unit a ticket or question may point at. */
export const unitId = idOf('unit', (s) => UNIT_KINDS.has(classifyId(s) ?? ''));

/** YAML `key:` with no value parses as null; treat it as an empty list. */
const list = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);

const nullable = <T extends z.ZodType>(t: T) =>
  t.nullish().transform((v) => v ?? null);

const scalarText = z.union([z.string(), z.number(), z.boolean()]).transform(String);

/**
 * `active`: current. `deprecated`: still served and still tested, but not for new use (links to it
 * warn). `removed`: a tombstone that keeps the ID from reuse; nothing current may link to it.
 */
export const STATUSES = ['active', 'deprecated', 'removed'] as const;
export const status = z.enum(STATUSES);
export type Status = z.infer<typeof status>;

export const STAGE_ROLES = ['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer'] as const;
export type StageRole = (typeof STAGE_ROLES)[number];
export const ROLES = STAGE_ROLES;
export type Role = StageRole;

/** The stages a ticket runs (PIP-021): "full" runs every stage of its type; the light lanes are for proposals only. */
export const LANES = ['full', 'docs', 'tests', 'build'] as const;
export type Lane = (typeof LANES)[number];

/** The model aliases Claude Code's Agent tool takes. */
export const CLAUDE_CODE_MODELS = ['sonnet', 'opus', 'haiku', 'fable'] as const;

/** Claude Code reasoning effort levels (format.Effort). */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

const ModelChoiceSchema = z.strictObject({ model: z.string().trim().min(1), effort: z.enum(EFFORTS).optional() });
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;

const ModelListSchema = z
  .array(ModelChoiceSchema)
  .min(1)
  .refine((choices) => new Set(choices.map((choice) => choice.model)).size === choices.length, { error: 'names a model more than once' });

const DelegationSettingSchema = z.union([z.string().trim().min(1), ModelListSchema], {
  error: `must be a model name, or a list of { "model", "effort"? } entries whose effort is ${EFFORTS.join(', ')}`,
});
/** One role's setting: a model name, or a list of models, best first (FMT-015/R8). */
export type DelegationSetting = z.infer<typeof DelegationSettingSchema>;

export const DelegationSchema = z
  .record(
    z.string().trim().min(1),
    z.partialRecord(z.enum(STAGE_ROLES), DelegationSettingSchema),
  )
  .superRefine((delegation, ctx) => {
    for (const [harness, roles] of Object.entries(delegation)) {
      if (harness === 'claude-code') continue;
      for (const [role, setting] of Object.entries(roles)) {
        if (Array.isArray(setting)) ctx.addIssue({ code: 'custom', path: [harness, role], message: 'a list of models is accepted only under claude-code' });
      }
    }
  });
export type Delegation = z.infer<typeof DelegationSchema>;
/** config.local.json: other keys are ignored (format.LocalConfig). */
export const LocalConfigSchema = z.looseObject({
  delegation: DelegationSchema.optional(),
  unavailableModels: z.partialRecord(z.enum(CLAUDE_CODE_MODELS), z.boolean()).optional(),
});

export const QUESTION_KINDS = ['blocker', 'external', 'preference'] as const;

const questionShape = {
  id: questionId,
  kind: z.enum(QUESTION_KINDS),
  text: z.string().min(1),
  default: nullable(scalarText),
  cites: list(unitId),
  answer: nullable(scalarText),
  raised_by: nullable(z.string()),
};
export const QuestionSchema = z.strictObject(questionShape);
export type Question = z.infer<typeof QuestionSchema>;
/**
 * A question inside a ticket: a key this spec does not know is kept and ignored (TKT-001/R9), and
 * its cites may name a ticket, which the ticket check limits to the question's own (TKT-001/R6).
 */
const ticketQuestionRef = idOf('ticket question (<ticket>#Q<n>)', (s) => /^[^#\s]+#Q\d+$/.test(s) && PATTERNS.ticket.test(s.slice(0, s.indexOf('#'))));
export const TicketQuestionSchema = z.looseObject({ ...questionShape, cites: list(z.union([unitId, ticketId, ticketQuestionRef])) });

/**
 * A unit drafted from evidence (code, docs) and not yet confirmed by a person, with where it came
 * from. Confirming drops both (`spec confirm`). Docs: ROADMAP 1b.
 */
const draftFields = {
  draft: z.boolean().default(false),
  sources: list(z.string().min(1)),
};

export const FeatureFrontmatter = z.strictObject({
  ...draftFields,
  id: featureId,
  title: z.string().min(1).max(80),
  module: moduleId,
  status,
  superseded_by: nullable(featureId),
  reads: list(contractRef),
  writes: list(contractRef),
  emits: list(contractRef),
  consumes: list(contractRef),
  provides: list(contractRef),
  calls: list(contractRef),
  /** Contracts the scenarios set up or check, though the feature's code does not use them. */
  observes: list(contractRef),
  invariants: list(invariantId),
  decisions: list(decisionId),
  ui: list(screenId),
  /** Scenario and rule numbers this feature removed: never used again, so tests and tickets stay unambiguous. */
  retired: list(retiredNumber),
  questions: list(QuestionSchema),
});
export type FeatureFrontmatter = z.infer<typeof FeatureFrontmatter>;

/** Module dependencies are not written: the graph derives them from the contracts features use. */
export const ModuleFrontmatter = z.strictObject({
  ...draftFields,
  id: moduleId,
  prefix: prefixId,
  domain: z.string().min(1),
  status,
  /** Another system's contracts, as this product uses them. */
  external: z.boolean().default(false),
  superseded_by: nullable(moduleId),
  questions: list(QuestionSchema),
});
export type ModuleFrontmatter = z.infer<typeof ModuleFrontmatter>;

export const DecisionFrontmatter = z.strictObject({
  ...draftFields,
  id: decisionId,
  title: z.string().min(1).max(80),
  status: z.enum(['accepted', 'superseded']),
  /** Marks emergency bypass records, which history verification treats as one-use evidence. */
  kind: z.literal('bypass').optional(),
  supersedes: z
    .union([decisionId, z.array(decisionId)])
    .nullish()
    .transform((v) => (v == null ? [] : typeof v === 'string' ? [v] : v)),
  superseded_by: nullable(decisionId),
  questions: list(QuestionSchema),
});
export type DecisionFrontmatter = z.infer<typeof DecisionFrontmatter>;

export const ScreenFrontmatter = z.strictObject({
  ...draftFields,
  id: screenId,
  title: z.string().min(1).max(80),
  status,
  image: nullable(z.string().min(1)),
  /** What the screen renders: entities, types, events, errors (and members). */
  shows: list(contractRef),
  /** The operations its controls invoke. */
  calls: list(contractRef),
  superseded_by: nullable(screenId),
  questions: list(QuestionSchema),
});
export type ScreenFrontmatter = z.infer<typeof ScreenFrontmatter>;

/** A default a stage applied: to a ticket preference, or to a question it met mid-work. */
export const Assumption = z.union([
  z.strictObject({ question: idOf('question', (s) => /^[^#\s]+#Q\d+$/.test(s)), value: scalarText }),
  z.strictObject({ new: z.string().min(1), value: scalarText }),
]);
export type Assumption = z.infer<typeof Assumption>;

/** The records inside a ticket's history keep any key this spec does not know (TKT-001/R9). */
const TicketAssumption = z.union([
  z.looseObject({ question: idOf('question', (s) => /^[^#\s]+#Q\d+$/.test(s)), value: scalarText, new: z.never().optional() }),
  z.looseObject({ new: z.string().min(1), value: scalarText, question: z.never().optional() }),
]);

const HistoryFindings = z.array(z.looseObject({ cites: z.array(z.string()), text: z.string().min(1), spec: z.boolean().optional(), tests: z.boolean().optional() }));

export const HistoryEntry = z.looseObject({
  at: scalarText,
  role: z.enum(ROLES),
  /** "reopened" is added by `spec ticket answer --back`: that role's stage runs again. */
  result: z.enum(['done', 'blocked', 'reopened']),
  summary: z.string(),
  /** Reviewer and spec-review stages only: the verdict decides whether the ticket loops back. */
  verdict: nullable(z.enum(['approve', 'changes'])),
  /** Reviewer and spec-review stages only: what the review found, kept whole for the stages that follow. */
  findings: HistoryFindings.optional(),
  /** Done spec-writer stages only: the scenarios it documented, which the tester's check and brief read. */
  documents: z.array(z.string()).optional(),
  /** Done spec-writer stages only: its checklist, kept whole so the spec review's brief can show it (PIP-012/R11). */
  checklist: z.array(z.looseObject({ item: z.string(), outcome: z.string(), ids: z.array(z.string()).optional(), reason: z.string().optional() })).optional(),
  /** Done tester stages, and done build stages that stay in their lane, only: the wrong implementations its report named, which the reviewer checks tests against. */
  mutations: z.array(z.looseObject({ scenario: z.string(), wrong: z.string() })).optional(),
  /** Implementer stages that handed their work to the tester only: the report's blockers, kept whole (PIP-008/R13). */
  blockers: z.array(z.looseObject({ text: z.string(), cites: z.array(z.string()).optional(), external: z.boolean().optional(), tests: z.boolean().optional() })).optional(),
  /** Done tester stages that follow a hand-off only: whether the combined tree passes every done-implementer check (PIP-008/R14). */
  passed: z.boolean().optional(),
  /** The first record holds the light lane the ticket started in; any record holds "full" when it moved the ticket out of one (PIP-021/R2, R3). */
  lane: z.enum(LANES).optional(),
  /** Defaults the stage applied, kept so the main session can report them. */
  assumed: list(TicketAssumption),
  /** Whole seconds from the stage's start to its recording; older entries have none. */
  duration_s: z.number().int().nonnegative().optional(),
  /** The model that ran the stage, when the harness reported it. */
  model: z.string().refine(isRecordedModel, { error: 'must be 1 to 100 printable ASCII characters' }).optional(),
  /** What the stage cost in US dollars, when the harness reported it. */
  cost_usd: z.number().refine(isRecordedCost, { error: 'must be finite, nonnegative and below 1000000' }).optional(),
  /** How many of the stage's reports were refused at intake, the refusal that blocked it included; left out when none was. */
  refusals: z.number().int().nonnegative().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

const anyId = idOf('ID', (s) => classifyId(s) !== null);

/** The finding classes, in class order; the conventions (spec/core/conventions.md) define each one. */
export const FINDING_CLASSES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'other'] as const;
export type FindingClass = (typeof FINDING_CLASSES)[number];
/** The short name each class goes by in the review prompts. */
export const FINDING_CLASS_LABELS: Readonly<Record<Exclude<FindingClass, 'other'>, string>> = {
  C1: 'neighbours',
  C2: 'environment axes',
  C3: 'concurrency and ordering',
  C4: 'trust boundaries',
  C5: 'fail closed',
  C6: 'preserved behaviour',
  C7: 'tests that cannot fail',
  C8: 'external facts',
  C9: 'text and docs',
};

/** One thing the reviewer found; `spec: true` marks a gap in the spec rather than in the code. */
const ReviewFindingSchema = z.strictObject({ cites: list(anyId), text: z.string().min(1), spec: z.boolean().optional(), tests: z.boolean().optional(), class: z.enum(FINDING_CLASSES).optional() });
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const CASE_ITEMS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C8'] as const;
export type CaseItem = (typeof CASE_ITEMS)[number];
export const CHECKLIST_LABELS: Readonly<Record<CaseItem, string>> = {
  C1: 'neighbours',
  C2: 'environment axes',
  C3: 'concurrency and ordering',
  C4: 'trust boundaries',
  C5: 'fail closed',
  C6: 'preserved behaviour',
  C8: 'external facts',
};
export const CHECKLIST_OUTCOMES = ['scenarios', 'invariant', 'question', 'na'] as const;
export type ChecklistOutcome = (typeof CHECKLIST_OUTCOMES)[number];

export const ChecklistItemSchema = z.strictObject({
  item: z.enum(CASE_ITEMS),
  outcome: z.enum(CHECKLIST_OUTCOMES),
  ids: list(z.string()),
  reason: z.string().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

/** A wrong implementation a test is written to catch (PIP-019/R2): one scenario, one non-empty line. */
export const MutationSchema = z.strictObject({
  scenario: z.string().min(1),
  wrong: z.string().min(1).regex(/^[^\r\n]*$/, 'must be one line'),
});
export type Mutation = z.infer<typeof MutationSchema>;

/** The one fenced `report` block a role ends its final message with. */
export const ReportSchema = z.strictObject({
  role: z.enum(ROLES),
  ticket: ticketId,
  result: z.enum(['done', 'blocked']),
  // Roles are asked for 120 characters; a longer summary is kept, not bounced (seen in a real session).
  summary: z.string().min(1).max(500),
  changed: list(unitId),
  assumed: list(Assumption),
  blockers: list(z.strictObject({ text: z.string().min(1), cites: list(anyId), external: z.boolean().optional(), tests: z.boolean().optional() })),
  verdict: nullable(z.enum(['approve', 'changes'])),
  findings: list(ReviewFindingSchema),
  /** Spec-writer only: scenarios it added that the current build already satisfies (PIP-006/R10). */
  documents: list(scenarioId),
  /** Spec-writer only: how it covered each item of the brief's case checklist (PIP-007). */
  checklist: list(ChecklistItemSchema),
  /** Tester only: a wrong implementation each changed scenario's test fails against (PIP-019). */
  mutations: list(MutationSchema),
  /** Any role: "full" when the stage found the ticket needs a stage its light lane skips; no report can make a lane lighter (PIP-021/R4). */
  lane: z.literal('full').optional(),
});
/** `documents`, `checklist` and `mutations` are always set by the parser; a report built by hand may leave them out. */
export type Report = Omit<z.infer<typeof ReportSchema>, 'documents' | 'checklist' | 'mutations'> & { documents?: string[]; checklist?: ChecklistItem[]; mutations?: Mutation[] };

export const TICKET_TYPES = ['proposal', 'bug', 'task'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TicketFrontmatter = z.looseObject({
  id: ticketId,
  type: z.enum(TICKET_TYPES),
  title: z.string().min(1).max(120),
  status: z.enum(['open', 'in_progress', 'blocked', 'done', 'absorbed']),
  /** Absorbed tickets only: the ticket they were combined into (TKT-001/R12). */
  absorbed_into: ticketId.optional(),
  stage: nullable(z.enum(ROLES)),
  touches: list(unitId),
  violates: list(scenarioId),
  /** Which stages the ticket runs; read only until the first stage is recorded (PIP-021/R2). Left out, "full". */
  lane: z.enum(LANES).optional(),
  /** Tickets whose work must be done and merged into the base branch before this one starts. */
  depends_on: list(ticketId),
  changed: list(unitId),
  questions: list(TicketQuestionSchema),
  history: list(HistoryEntry),
}).superRefine((ticket, ctx) => {
  ticket.questions.forEach((question, questionIndex) => {
    question.cites.forEach((id, citeIndex) => {
      if (PATTERNS.ticket.test(id.split('#')[0] ?? id) && id.split('#')[0] !== ticket.id) {
        ctx.addIssue({ code: 'custom', path: ['questions', questionIndex, 'cites', citeIndex], message: 'a ticket question may cite only its own ticket ID' });
      }
    });
  });
});
export type TicketFrontmatter = z.infer<typeof TicketFrontmatter>;

/** The keys the ticket schema knows, per record, for the L020 warning about the ones it does not. */
const TICKET_KEYS = new Set(Object.keys(TicketFrontmatter.shape));
const QUESTION_KEYS = new Set(Object.keys(questionShape));
const HISTORY_KEYS = new Set(Object.keys(HistoryEntry.shape));
const FINDING_KEYS = new Set(['cites', 'text', 'spec', 'tests', 'class']);
const ASSUMED_KEYS = new Set(['question', 'new', 'value']);
const BLOCKER_KEYS = new Set(['text', 'cites', 'external', 'tests']);

/** A key this spec does not know: its path as `lineOf` takes it, and as the warning writes it. */
export interface UnknownKey {
  readonly path: (string | number)[];
  readonly text: string;
}

/**
 * Every key a ticket's frontmatter has that the ticket schema does not know, in the order the YAML
 * mapping writes them (a plain JS object would list integer-like keys first).
 */
export function unknownTicketKeys(contents: unknown): UnknownKey[] {
  const out: UnknownKey[] = [];
  // Ticket keys are strings (TKT-001/R11): a ticket with another kind is refused before this runs.
  const keyOf = (pair: { key: unknown }): string => String(isScalar(pair.key) ? pair.key.value : pair.key);
  const records = (node: unknown, path: (string | number)[], text: string, known: Set<string>, nested: Record<string, Set<string>> = {}): void => {
    if (!isSeq(node)) return;
    node.items.forEach((rec, i) => {
      if (!isMap(rec)) return;
      for (const pair of rec.items) {
        const k = keyOf(pair);
        const at = [...path, i, k];
        const atText = `${text}[${i}].${k}`;
        if (!known.has(k)) out.push({ path: at, text: atText });
        else if (nested[k]) records(pair.value, at, atText, nested[k]);
      }
    });
  };
  if (!isMap(contents)) return out;
  for (const pair of contents.items) {
    const k = keyOf(pair);
    if (!TICKET_KEYS.has(k)) out.push({ path: [k], text: k });
    else if (k === 'questions') records(pair.value, [k], k, QUESTION_KEYS);
    else if (k === 'history') records(pair.value, [k], k, HISTORY_KEYS, { findings: FINDING_KEYS, assumed: ASSUMED_KEYS, blockers: BLOCKER_KEYS });
  }
  return out;
}

const TICKET_PREFIX: Record<TicketType, string> = { proposal: 'PROP', bug: 'BUG', task: 'TASK' };

/**
 * The type's required fields. Shared by L020 and the gate. Each problem is a message plus its fix.
 */
export function ticketTypeProblems(t: TicketFrontmatter): { message: string; fix: string }[] {
  const out: { message: string; fix: string }[] = [];
  if (!t.id.startsWith(`${TICKET_PREFIX[t.type]}-`)) {
    out.push({ message: `a ${t.type} ticket must have a ${TICKET_PREFIX[t.type]}- ID`, fix: `rename the ticket or set type to match ${t.id}` });
  }
  if (t.type === 'bug' && t.violates.length === 0) {
    out.push({
      message: 'a bug must name the scenario it violates; without one the behaviour is unspecified',
      fix: 'add the violated scenario IDs to violates, or turn the ticket into a proposal',
    });
  }
  if (t.type !== 'bug' && t.touches.length === 0) {
    out.push({ message: `a ${t.type} must touch at least one unit`, fix: 'add the units it changes to touches' });
  }
  if (t.type !== 'bug' && t.violates.length > 0) {
    out.push({ message: `only bugs may list violates`, fix: 'move the IDs to touches, or set type: bug' });
  }
  if (t.type !== 'proposal' && t.lane !== undefined && t.lane !== 'full') {
    out.push({ message: 'only a proposal may run in a light lane', fix: 'remove lane, or set lane: full' });
  }
  return out;
}

/** A glob naming project files: non-empty, POSIX, relative, with no `.` or `..` segment. */
const ProjectGlob = z.string().refine(isProjectRelativeGlob, { error: 'must be a non-empty project-relative POSIX glob without "." or ".." path segments' });

export const ConfigSchema = z.strictObject({
  /** The spec format the files are written in; lint (L001) compares it with FORMAT_VERSION. */
  formatVersion: z.number().int().positive().optional(),
  /** The project's name; its harness skill is `<name>-spec`. */
  name: z.string().regex(/^[a-z][a-z0-9_-]*$/).optional(),
  /** The project root, relative to the spec root. Default: the spec root's parent. */
  projectRoot: z.string().min(1).optional(),
  /**
   * Where tickets live. `files`: one Markdown file per ticket in `dir`. `command`: any tracker,
   * through a program that speaks the two-operation protocol in docs/TICKETS.md.
   */
  tickets: z
    .union([
      z.strictObject({ adapter: z.literal('files'), dir: z.string().min(1) }),
      z.strictObject({ adapter: z.literal('command'), command: z.string().min(1) }),
    ])
    .default({ adapter: 'files', dir: 'tickets' }),
  baseBranch: z.string().min(1).default('main'),
  /** Parallel tickets: each runs in a git worktree here, relative to the project root. */
  worktrees: z.string().min(1).optional(),
  /** Run in each new worktree (a shell command), e.g. to install or link dependencies. */
  worktreeSetup: z.string().min(1).optional(),
  /** Run in the project root on the base branch after each successful merge (a shell command). */
  afterMerge: z.string().min(1).optional(),
  /**
   * The project's own generated files. A conflict in one takes one side; when `command` is set it
   * then rebuilds them (WSP-009).
   */
  generated: z.strictObject({ globs: z.array(ProjectGlob).min(1), command: z.string().min(1).optional() }).optional(),
  /** Accepted for compatibility with older config files, but ignored since X139. */
  dispatchCommand: z.string().min(1).optional(),
  /** The most tickets `spec next` starts at once when called without an ID. Default: no cap. */
  maxParallel: z.number().int().positive().optional(),
  /** The most runs of the test command allowed at once across a repository's checkouts. */
  maxTestRuns: z.number().int().positive().optional(),
  /** Accepted for compatibility with old dispatch configs, but ignored since X139. */
  models: z.strictObject({ small: z.string().min(1), large: z.string().min(1), threshold: z.number().int().nonnegative() }).optional(),
  /** Models selected by harness and stage role for session-driven delegation. */
  delegation: DelegationSchema.optional(),
  /** Enforcement layers are on by default; projects may opt out layer by layer. */
  enforce: z.strictObject({
    edits: z.boolean().default(true),
    commits: z.boolean().default(true),
    history: z.boolean().default(true),
    bypass: z.literal('person').optional(),
  }).default({ edits: true, commits: true, history: true }),
  /** First base-branch commit checked by `spec verify-history`; omitted means all history. */
  enforceSince: z.string().min(1).optional(),
  testCommand: z.string().min(1),
  /** Shell commands check-report runs when a tester or implementer stage reports done. */
  checkCommands: z.array(z.string().min(1)).optional(),
  codeGlobs: z.array(z.string()).default([]),
  testGlobs: z.array(z.string()).default([]),
  protectedGlobs: z.array(z.string()).default([]),
  /** Deprecated: read as more `generated.globs` without a command; lint warns L036 (FMT-002/R9). */
  generatedGlobs: z.array(ProjectGlob).default([]),
  budgets: z.record(z.string(), z.number().int().positive()).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;
