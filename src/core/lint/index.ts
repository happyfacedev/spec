import { type Finding, type RuleId, normalizeFindings } from '../findings';
import type { Spec, TicketSet } from '../model';
import { buildIndex } from '../units';
import {
  type RuleContext,
  configRule,
  deprecated,
  generatedFresh,
  glossary,
  granularity,
  idUnique,
  invariantShown,
  memberDrafts,
  modulePrefix,
  orphan,
  proseRefs,
  questionKind,
  refActive,
  refResolves,
  ruleShown,
  size,
  stepsMatchLinks,
  ticketSchema,
  typeRefs,
} from './rules';

export interface LintOptions {
  readonly tickets?: TicketSet | null;
  /** Adds the generated index freshness rule L017. */
  readonly ci?: boolean;
  /** Limits per-file rules to these paths. */
  readonly files?: readonly string[] | null;
  readonly budgets?: Readonly<Record<string, number>>;
}

/** Rules whose findings belong to one file; `--files` limits these. */
export const PER_FILE_RULES: ReadonlySet<RuleId> = new Set(['L001', 'L002', 'L006', 'L007', 'L008', 'L010', 'L011', 'L020']);

export function lintSpec(spec: Spec, opts: LintOptions = {}): Finding[] {
  const index = buildIndex(spec);
  const tickets = opts.tickets ?? null;
  const ctx: RuleContext = { spec, index, tickets, budgets: opts.budgets ?? {} };
  const all: Finding[] = [
    ...spec.parseFindings,
    ...configRule(ctx),
    ...idUnique(ctx),
    ...refResolves(ctx),
    ...refActive(ctx),
    ...stepsMatchLinks(ctx),
    ...granularity(ctx),
    ...questionKind([...index.questions, ...(tickets?.tickets.flatMap((t) => t.questions) ?? [])]),
    ...size(ctx),
    ...orphan(ctx),
    ...ruleShown(ctx),
    ...invariantShown(ctx),
    ...proseRefs(ctx),
    ...modulePrefix(ctx),
    ...deprecated(ctx),
    ...(opts.ci ? generatedFresh(ctx) : []),
    ...glossary(ctx),
    ...ticketSchema(ctx),
    ...typeRefs(ctx),
    ...memberDrafts(ctx),
  ];
  const files = opts.files ? new Set(opts.files) : null;
  const kept = files ? all.filter((f) => !PER_FILE_RULES.has(f.rule) || files.has(f.file)) : all;
  return normalizeFindings(kept);
}
