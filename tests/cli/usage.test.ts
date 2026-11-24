// CLI-001: a command line with no command, or with --help or -h, prints the usage; an unknown command is refused with it.
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE_SPEC, REPO, tempDir } from '../helpers';

// CLI-001/S1 quotes the usage text in full; the test holds the same text, not the code's copy of it.
const USAGE = `usage: spec <command> [options]

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

const empty = tempDir('spec-usage-');
afterAll(() => {
  rmSync(empty, { recursive: true, force: true });
});

/** A command line through cli.Run in `cwd`, with no SPEC_ROOT and no bundled script to find a root by. */
const cli = (cwd: string, argv: string[]) => run({ argv, env: {}, cwd, scriptPath: undefined });
/** A command line with no spec root to be found. */
const go = (...argv: string[]) => cli(empty, argv);

describe('CLI-001 Run a command, or print the usage', () => {
  it('CLI-001/S1 No command prints the usage', async () => {
    const out = await go();
    expect(out.code).toBe(0);
    expect(out.stderr).toBe('');
    expect(out.stdout).toBe(USAGE);
  });

  it('CLI-001/S2 --help prints the usage and runs no command', async () => {
    const out = await go('--help', 'lint', '--root', FIXTURE_SPEC);
    expect(out.stdout).toBe(USAGE);
    expect(out.code).toBe(0);
  });

  it('CLI-001/S3 -h is the same as --help', async () => {
    const out = await go('-h');
    expect(out.stdout).toBe(USAGE);
    expect(out.code).toBe(0);
  });

  it('CLI-001/S4 Help wins over a bad option', async () => {
    const out = await go('--help', '--bogus');
    expect(out.stdout).toBe(USAGE);
    expect(out.code).toBe(0);
  });

  it('CLI-001/S5 Options alone print the usage', async () => {
    const out = await go('--format', 'xml');
    expect(out.stdout).toBe(USAGE);
    expect(out.code).toBe(0);
    expect(out.stderr).toBe('');
  });

  it('CLI-001/S6 An unknown command is refused with the usage', async () => {
    const out = await go('nope');
    expect(out.stderr).toBe(`unknown command nope\n\n${USAGE}`);
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });

  it('CLI-001/S7 An unknown command is refused before the root is looked for', async () => {
    const out = await go('nope', '--root', '/nonexistent');
    expect(out.stderr.startsWith('unknown command nope')).toBe(true);
    // The usage that follows names the --root option's spec root; the message ahead of it must not.
    expect(out.stderr.split('\n\n')[0]).toBe('unknown command nope');
    expect(out.code).toBe(2);
  });

  it('CLI-001/S8 A single-dash word is taken as the command', async () => {
    const out = await go('-x');
    expect(out.stderr.startsWith('unknown command -x')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-001/S9 Options may come before the command', async () => {
    const before = await cli(REPO, ['--root', 'fixtures/chat-mini/spec', 'find', 'fallback']);
    const after = await cli(REPO, ['find', 'fallback', '--root', 'fixtures/chat-mini/spec']);
    expect(after.stdout).not.toBe('');
    expect(before.stdout).toBe(after.stdout);
    expect(before.code).toBe(0);
  });

  it('CLI-001/S10 An option the command does not use is ignored', async () => {
    const plain = await go('find', 'fallback', '--root', FIXTURE_SPEC);
    const withCi = await go('find', 'fallback', '--ci', '--root', FIXTURE_SPEC);
    expect(plain.stdout).not.toBe('');
    expect(withCi.stdout).toBe(plain.stdout);
    expect(withCi.code).toBe(0);
  });

  it('CLI-001/S11 init runs without a spec root', async () => {
    const out = await go('init');
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr.startsWith('usage: spec init <repo> --name <project>')).toBe(true);
    expect(out.stderr).not.toContain('no spec root');
  });
});
