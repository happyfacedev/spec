// The parsed spec: every unit with its location, its outgoing links and the raw text briefs quote.
import type { Finding } from './findings';
import type { Question, Status, TicketFrontmatter } from './schemas';
import type { SourceFile } from './source';

export interface Loc {
  readonly file: string;
  readonly line: number;
}

/** A link as written, with the line it was written on. */
export interface Ref {
  readonly id: string;
  readonly line: number;
}

export const LINK_KINDS = ['reads', 'writes', 'emits', 'consumes', 'provides', 'calls', 'observes', 'invariants', 'decisions', 'ui'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const CONTRACT_LINKS = ['reads', 'writes', 'emits', 'consumes', 'provides', 'calls', 'observes'] as const;
export type ContractLink = (typeof CONTRACT_LINKS)[number];
export const PRODUCER_LINKS: readonly ContractLink[] = ['writes', 'emits', 'provides'];
/**
 * Links whose scenarios re-verify when the contract changes. `observes` is among them: the feature's
 * tests set the contract up or check it, though its code does not use it (X114).
 */
export const CONSUMER_LINKS: readonly ContractLink[] = ['reads', 'consumes', 'calls', 'observes'];
/** Links that say what the feature's code does; `observes` says only what its tests touch. */
export const CODE_LINKS: readonly ContractLink[] = ['reads', 'writes', 'emits', 'consumes', 'provides', 'calls'];

export const CONTRACT_KINDS = ['entity', 'event', 'operation', 'type', 'error'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** The contract kinds each feature link may point at (a member counts as its contract's kind). */
export const LINK_TARGET_KINDS: Readonly<Record<ContractLink, readonly ContractKind[]>> = {
  reads: ['entity', 'type'],
  writes: ['entity', 'type'],
  emits: ['event', 'error'],
  consumes: ['event', 'error'],
  provides: ['operation'],
  calls: ['operation'],
  observes: ['entity', 'event', 'operation', 'type', 'error'],
};

/** A type expression as written: the text after `Type:` or `Output:`, with its line. */
export interface TypeExpr {
  readonly expr: string;
  readonly line: number;
  /** Which line it came from: a value's type, or an operation's result. */
  readonly key?: 'Type' | 'Output';
}

export interface OwnedQuestion extends Question {
  readonly owner: string;
  readonly line: number;
  readonly file: string;
}

export interface Step extends Loc {
  readonly keyword: string;
  readonly text: string;
  /** A table or fenced block written under the step: data it states. Empty when none. */
  readonly attachment: string;
}

export interface Scenario extends Loc {
  readonly type: 'scenario';
  readonly id: string;
  readonly n: number;
  readonly title: string;
  readonly feature: string;
  readonly steps: readonly Step[];
  /** Contract, screen, invariant and rule IDs written in the steps, in order of first appearance. */
  readonly cites: readonly Ref[];
  readonly text: string;
}

export interface FeatureRule extends Loc {
  readonly type: 'rule';
  readonly id: string;
  readonly n: number;
  readonly feature: string;
  readonly text: string;
  readonly cites: readonly Ref[];
}

/** A unit drafted from evidence and not yet confirmed: its sources (maybe none). Null once confirmed. */
export type Draft = readonly string[] | null;

export interface Feature extends Loc {
  readonly type: 'feature';
  readonly id: string;
  readonly title: string;
  readonly module: string;
  readonly folderModule: string;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersededBy: Ref | null;
  readonly links: Readonly<Record<LinkKind, readonly Ref[]>>;
  /** Contracts whose link the steps state rather than the frontmatter (derive.ts). */
  readonly derived?: readonly string[];
  /** Retired scenario and rule numbers (`S3`, `R2`), each with its line. */
  readonly retired: readonly Ref[];
  readonly questions: readonly OwnedQuestion[];
  readonly intent: string;
  readonly scenarios: readonly Scenario[];
  readonly rules: readonly FeatureRule[];
  readonly text: string;
  /** Feature body (no frontmatter), used for glossary detection. */
  readonly body: string;
  readonly behaviourText: string;
  readonly rulesText: string;
  readonly lineCount: number;
}

/** A member of a contract: an entity's field, an event's or error's payload member, an operation's input. */
export interface ContractField extends Loc {
  readonly type: 'field';
  readonly id: string;
  readonly entity: string;
  readonly status: Status;
  readonly supersededBy: Ref | null;
  /** Line of a `· Draft:` marker on the member's status line, which lint refuses (ADP-001/R1); null when absent. */
  readonly draftLine: number | null;
  /** Other contracts named in the member's `Type:` expression. */
  readonly uses: readonly Ref[];
  readonly types: readonly TypeExpr[];
  readonly text: string;
}

export interface Contract extends Loc {
  readonly type: 'contract';
  readonly id: string;
  readonly kind: ContractKind;
  readonly homeModule: string;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersededBy: Ref | null;
  readonly summary: string;
  readonly decisions: readonly Ref[];
  /** `Code: Cart.add(name, quantity)`: where the code implements it. `symbol` is the part before `(`. */
  readonly code: { readonly text: string; readonly symbol: string; readonly line: number } | null;
  /** Other contracts named in the contract's own `Type:` or `Output:` expression (not its members'). */
  readonly uses: readonly Ref[];
  readonly types: readonly TypeExpr[];
  readonly fields: readonly ContractField[];
  /** The whole section, fields included. */
  readonly text: string;
  /** The section without its field subsections. */
  readonly headText: string;
}

export interface Invariant extends Loc {
  readonly type: 'invariant';
  readonly id: string;
  readonly title: string;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersededBy: Ref | null;
  /** The ADRs that explain it (`Decisions:` line). */
  readonly decisions: readonly Ref[];
  /** The contracts and members it constrains (`Applies to:` line): impact on them reaches it. */
  readonly applies: readonly Ref[];
  /** `Shown by:`: how it is checked when no scenario can show it (a benchmark, a review). */
  readonly shownBy: string | null;
  readonly text: string;
  readonly lineCount: number;
}

export interface Decision extends Loc {
  readonly type: 'decision';
  readonly id: string;
  readonly title: string;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersedes: readonly Ref[];
  readonly supersededBy: Ref | null;
  readonly questions: readonly OwnedQuestion[];
  readonly decisionText: string;
  readonly consequencesText: string;
  readonly text: string;
  readonly lineCount: number;
}

export interface Screen extends Loc {
  readonly type: 'screen';
  readonly id: string;
  readonly title: string;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersededBy: Ref | null;
  readonly image: string | null;
  /** Contracts it renders, and the operations its controls call. Impact on them reaches the screen. */
  readonly shows: readonly Ref[];
  readonly calls: readonly Ref[];
  readonly questions: readonly OwnedQuestion[];
  readonly text: string;
}

export interface Module extends Loc {
  readonly type: 'module';
  readonly id: string;
  readonly folder: string;
  readonly prefix: string;
  readonly domain: string;
  /** Another system's contracts, as this product uses them: no features, nothing here provides them. */
  readonly external: boolean;
  readonly status: Status;
  readonly draft: Draft;
  readonly supersededBy: Ref | null;
  readonly questions: readonly OwnedQuestion[];
  readonly responsibility: string;
  readonly text: string;
}

export interface Term extends Loc {
  readonly type: 'term';
  readonly term: string;
  readonly aliases: readonly string[];
  readonly aliasLine: number;
  readonly text: string;
  readonly lineCount: number;
}

export interface Spec {
  readonly version: string;
  readonly files: readonly SourceFile[];
  readonly skillName: string | null;
  readonly modules: readonly Module[];
  readonly features: readonly Feature[];
  readonly contracts: readonly Contract[];
  readonly invariants: readonly Invariant[];
  readonly decisions: readonly Decision[];
  readonly screens: readonly Screen[];
  readonly terms: readonly Term[];
  readonly conventionsText: string | null;
  /** Findings raised while parsing (L001, L002, L006, L007, L011 sizes of files). */
  readonly parseFindings: readonly Finding[];
}

export interface Ticket extends Loc {
  readonly id: string;
  readonly data: TicketFrontmatter;
  readonly questions: readonly OwnedQuestion[];
  readonly body: string;
  readonly text: string;
  readonly lineOf: (path: readonly PropertyKey[]) => number;
}

export interface TicketSet {
  readonly tickets: readonly Ticket[];
  readonly findings: readonly Finding[];
}

export type Unit = Module | Feature | Scenario | FeatureRule | Contract | ContractField | Invariant | Decision | Screen;
