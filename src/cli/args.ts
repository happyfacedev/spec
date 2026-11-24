export type Format = 'text' | 'json';

export interface Args {
  readonly command: string | null;
  readonly positionals: readonly string[];
  readonly root: string | null;
  readonly tickets: string | null;
  readonly format: Format;
  readonly files: readonly string[];
  readonly ci: boolean;
  readonly depth: number | null;
  readonly base: string | null;
  readonly name: string | null;
  /** init: stack defaults to prefill the project config. */
  readonly stack: string | null;
  /** config set: write delegation under config.local.json. */
  readonly local: boolean;
  /** upgrade: source directory containing spec and spec.cjs. */
  readonly from: string | null;
  /** verify-history: the first-parent range starts after this ref. */
  readonly since: string | null;
  readonly bypassStatus: boolean;
  readonly bypassCancel: boolean;
  readonly approvedByPerson: boolean;
  /** brief: the whole argument text a skill was loaded with. */
  readonly query: string | null;
  /** brief: the argument text arrives on standard input. */
  readonly stdin: boolean;
  /** next: choose a harness, or infer one from the session environment. */
  readonly harness: string | null;
  /** next: start every ticket in the current plan wave. */
  readonly start: boolean;
  /** next: list safe work without task or brief text. */
  readonly summary: boolean;
  /** next: explicitly restart a stage after the session confirms its delegate stopped. */
  readonly restart: boolean;
  /** ticket advance: the final message to validate instead of the stored report. */
  readonly reportFile: string | null;
  readonly report: string | null;
  /** ticket advance: the role's transcript (JSONL), where the harness reports the stage's model and cost. */
  readonly transcript: string | null;
  /** ticket answer: the role whose stage runs next; "" when --back had no role. */
  readonly back: string | null;
  /** ticket close: the ticket whose work made the closed one redundant. */
  readonly supersededBy: string | null;
  /** init: compare the installed role prompts with this version's, and replace them with --yes. */
  readonly updateRoles: boolean;
  /** init: opt in to project-local background agent edits. */
  readonly acceptEdits: boolean;
  readonly yes: boolean;
  /** upgrade: permit replacing a newer project CLI with an older source. */
  readonly force: boolean;
  /** ticket new: validate and gate, but save nothing. */
  readonly dryRun: boolean;
  /** gaps: skip running the tests. */
  readonly noTests: boolean;
  readonly version: boolean;
  readonly help: boolean;
  readonly errors: readonly string[];
}

const VALUE_OPTS = new Set(['--root', '--tickets', '--format', '--base', '--name', '--stack', '--query', '--transcript', '--from', '--harness', '--report-file', '--report', '--since', '--superseded-by']);

export function parseArgs(argv: readonly string[]): Args {
  const positionals: string[] = [];
  const errors: string[] = [];
  const values = new Map<string, string>();
  const files: string[] = [];
  let back: string | null = null;
  let ci = false;
  let updateRoles = false;
  let acceptEdits = false;
  let yes = false;
  let force = false;
  let stdin = false;
  let start = false;
  let summary = false;
  let restart = false;
  let dryRun = false;
  let noTests = false;
  let local = false;
  let version = false;
  let help = false;
  let bypassStatus = false;
  let bypassCancel = false;
  let approvedByPerson = false;
  let depthValue: string | undefined;
  let depthGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    const eq = a.indexOf('=');
    const [flag, inline] = a.startsWith('--') && eq > 0 ? [a.slice(0, eq), a.slice(eq + 1)] : [a, null];
    if (VALUE_OPTS.has(flag)) {
      const v = inline ?? argv[++i];
      if (v === undefined || (inline === null && v.startsWith('--')) || (flag === '--report-file' && v === '')) errors.push(`${flag} needs a value`);
      else values.set(flag, v);
    } else if (flag === '--back') {
      // A missing role is a usage error of `ticket answer`, reported there with its own usage line.
      const next = argv[i + 1];
      back = inline ?? (next !== undefined && !next.startsWith('--') ? argv[++i] ?? '' : '');
    } else if (flag === '--depth') {
      // Judged after the loop: only impact takes a depth; any other command ignores it.
      const next = argv[i + 1];
      depthValue = inline ?? (next !== undefined && !next.startsWith('--') ? argv[++i] : undefined);
      depthGiven = true;
    } else if (flag === '--files') {
      if (inline !== null) files.push(...inline.split(',').filter((s) => s !== ''));
      while (inline === null && i + 1 < argv.length && !(argv[i + 1] ?? '').startsWith('--')) files.push(argv[++i] ?? '');
    } else if (flag === '--ci') ci = true;
    else if (flag === '--update-roles') updateRoles = true;
    else if (flag === '--accept-edits') acceptEdits = true;
    else if (flag === '--yes') yes = true;
    else if (flag === '--force') force = true;
    else if (flag === '--stdin') stdin = true;
    else if (flag === '--start') start = true;
    else if (flag === '--summary') summary = true;
    else if (flag === '--restart') restart = true;
    else if (flag === '--dry-run') dryRun = true;
    else if (flag === '--no-tests') noTests = true;
    else if (flag === '--local') local = true;
    else if (flag === '--status') bypassStatus = true;
    else if (flag === '--cancel') bypassCancel = true;
    else if (flag === '--approved-by-person') approvedByPerson = true;
    else if (flag === '--version' || flag === '-v') version = true;
    else if (flag === '--help' || flag === '-h') help = true;
    else if (a.startsWith('--')) errors.push(`unknown option ${a}`);
    else positionals.push(a);
  }
  const fmt = values.get('--format') ?? 'text';
  if (fmt !== 'text' && fmt !== 'json') errors.push(`--format is text or json, not ${fmt}`);
  let depth: number | null = null;
  if (depthGiven && positionals[0] === 'impact') {
    if (depthValue === undefined) errors.push('--depth needs a value');
    else {
      depth = Number(depthValue);
      if (!Number.isInteger(depth) || depth < 1) errors.push('--depth is a whole number of 1 or more');
    }
  }
  return {
    command: positionals[0] ?? null,
    positionals: positionals.slice(1),
    root: values.get('--root') ?? null,
    tickets: values.get('--tickets') ?? null,
    format: fmt === 'json' ? 'json' : 'text',
    files,
    ci,
    depth,
    base: values.get('--base') ?? null,
    name: values.get('--name') ?? null,
    stack: values.get('--stack') ?? null,
    local,
    from: values.get('--from') ?? null,
    since: values.get('--since') ?? null,
    bypassStatus,
    bypassCancel,
    approvedByPerson,
    query: values.get('--query') ?? null,
    harness: values.get('--harness') ?? null,
    start,
    summary,
    restart,
    reportFile: values.get('--report-file') ?? null,
    report: values.get('--report') ?? null,
    transcript: values.get('--transcript') ?? null,
    supersededBy: values.get('--superseded-by') ?? null,
    back,
    updateRoles,
    acceptEdits,
    yes,
    force,
    stdin,
    dryRun,
    noTests,
    version,
    help,
    errors,
  };
}

export const USAGE = `usage: spec <command> [options]

commands:
  detect [--format json]             inspect the current repository (no spec needed)
  init <repo> --name <project> [--stack <stack>] [--accept-edits]  install spec into a repo
  config set <key> <value> [--local] [--force] update project config without reformatting it
  init <repo> --update-roles [--yes]  diff the installed role prompts against this version's
  upgrade [<repo>] [--from <dir>] [--force]  update the project's pinned .spec/bin CLI
  build                               write index.md and _generated/graph.json
  lint [--files <paths>] [--ci] [--base <ref>]  validate the spec and every ticket
  show <ID>                           one unit as stored, plus its backlinks
  find <words>                        search IDs, titles and glossary terms
  impact <ID|TICKET> [--depth n]      reach of a change
  gate <TICKET>                       ready check for one ticket
  brief <role> [<ID>] [--base <ref>]  the brief for one role and one ticket or unit
  check-report <role> <TICKET> [--report-file <path>] validate a finished stage (report on stdin or in the file)
  test [<scenario ID>]                run the project's tests; one line per test
  queue                               tickets grouped as ready, waiting, blocked, in progress
  plan [<TICKET>...]                  which tickets can run in parallel now, and what waits for what
  stats [<TICKET>...] [--since <date>] stages against the minimum, blocks, reopens, refusals, answers, review rounds, finding classes and time per ticket; stages, time and cost per role
  next [<TICKET>] [--start|--restart] [--summary] [--harness <name>] prepare, list or restart a stage for the main session to delegate
  ticket new [<file.json>] [--dry-run] create a ticket with the next free ID (JSON from the file or stdin), and gate it
  ticket start <TICKET> <role>        begin a stage
  ticket advance <TICKET> [--report-file <path>|--report -] record a stage
  ticket answer <TICKET> <Q> <text>   answer one of a ticket's questions
  ticket combine <INTO> <FROM>...     fold open tickets into one; each FROM keeps its file, marked absorbed
  ticket close <TICKET> --superseded-by <ID> retire a ticket another one made redundant; deletes nothing
  worktree add|remove <TICKET>        a ticket's own git worktree; worktree list
  merge <TICKET>...                   merge done tickets when tests and lint still pass
  bypass "<reason>" [--approved-by-person] | --status | --cancel create or inspect a one-commit bypass
  verify-history [--since <ref>] [--base <ref>] check first-parent base history trailers
  gaps [--no-tests]                   drafts, open questions, modules without features, contracts no feature uses, scenarios without a test, tests for no scenario and code pointers not found: what /spec-init asks about
  confirm <ID>...                     a drafted unit, checked by a person, becomes ordinary spec
  hook <harness> <event>              harness adapter entry
  hook git <pre-commit|pre-merge-commit|commit-msg> Git hook entry point

options:
  --stack <name>       init defaults: flutter, dart, node, python, go, rust, other
  --accept-edits       init: set personal .claude/settings.local.json permissions.defaultMode to acceptEdits
  --local              config set: save the delegation model in ignored config.local.json
  --force              config set: allow an unknown harness; upgrade: allow downgrades
  --root <dir>         spec root (else SPEC_ROOT, launcher location, or nearest spec/config.json)
  --tickets <dir>      ticket store (else config.json tickets.dir)
  --format text|json   output format (default text)
  --harness <name>     delegation model key (else detected from the session)
  --start              start every ticket listed by spec next
  --summary            list safe work without task or brief text
  --restart            restart a stage when the session confirms no subagent is still running
  --report-file <path> ticket advance, check-report: read a subagent final message from a file
  --report -           ticket advance: read a subagent final message from stdin
  --superseded-by <ID> ticket close: the ticket whose work made it redundant
  -h, --help           print the usage
  -v, --version        print the version
`;
