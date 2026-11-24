import { compareIds, compareStrings } from './ids';

export const RULES = {
  L001: 'schema',
  L002: 'id-format',
  L003: 'id-unique',
  L004: 'ref-resolves',
  L005: 'ref-active',
  L006: 'sections',
  L007: 'scenario-grammar',
  L008: 'steps-match-links',
  L009: 'granularity',
  L010: 'question-kind',
  L011: 'size',
  L012: 'orphan',
  // L013 cycle is retired (X111): it checked `requires:`, which is gone.
  L014: 'module-prefix',
  // L015 overview-modules is retired (format 2): the module map is derived, not written twice.
  L016: 'deprecated',
  L017: 'generated-fresh',
  L018: 'glossary',
  L019: 'contract-home',
  L020: 'ticket-schema',
  // L021 agent freshness is retired by X139; rule IDs are never reused.
  L022: 'type-refs',
  L023: 'rule-shown',
  L024: 'code-pointer',
  L025: 'invariant-shown',
  L026: 'prose-refs',
  // L027 dispatch-ignored is retired after X139; rule IDs are never reused.
  L028: 'legacy-config-ignored',
  L029: 'unknown-harness',
  L030: 'missing-delegation-model',
  L031: 'delegation-required',
  L032: 'invalid-claude-code-model',
  L033: 'enforcement-hooks-missing',
  L034: 'after-merge-generated-globs',
  L035: 'id-reuse',
  L036: 'legacy-generated-globs',
  L037: 'unreadable-entry',
} as const;

export type RuleId = keyof typeof RULES;
export type Severity = 'error' | 'warning';

/** Errors are values: a rule, a location and a fix. */
export interface Finding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly id: string | null;
  readonly message: string;
  readonly fix: string;
}

export function finding(
  rule: RuleId,
  file: string,
  line: number,
  id: string | null,
  message: string,
  fix: string,
  severity: Severity = 'error',
): Finding {
  return { rule, severity, file, line, id, message, fix };
}

/** One L037 error per spec entry the loader skipped (LNT-019/R1). */
export function unreadableEntryFindings(entries: readonly { readonly path: string; readonly reason: string }[]): Finding[] {
  return entries.map((u) => finding(
    'L037',
    u.path,
    1,
    null,
    `${u.path} cannot be read: ${u.reason}`,
    u.reason === 'its symlink target does not exist' ? 'point the symlink at an existing file, or remove it' : 'make the entry readable, or remove it',
  ));
}

export function compareFindings(a: Finding, b: Finding): number {
  return (
    compareStrings(a.file, b.file) ||
    a.line - b.line ||
    compareStrings(a.rule, b.rule) ||
    compareIds(a.id ?? '', b.id ?? '') ||
    compareStrings(a.message, b.message)
  );
}

/** Sorted and deduplicated. */
export function normalizeFindings(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of [...findings].sort(compareFindings)) {
    const key = JSON.stringify(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export const countErrors = (fs: readonly Finding[]): number => fs.filter((f) => f.severity === 'error').length;
export const countWarnings = (fs: readonly Finding[]): number => fs.filter((f) => f.severity === 'warning').length;
