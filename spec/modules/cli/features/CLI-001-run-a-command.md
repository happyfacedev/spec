---
id: CLI-001
title: Run a command, or print the usage
module: cli
status: active
provides: [cli.Run]
decisions: [ADR-001]
questions:
  - id: Q1
    kind: preference
    text: The usage text lists `--version` but not `-v`, `--help` or `-h`, which the CLI accepts. Should the options section list them?
    default: Leave the usage text as it is.
    cites: []
    answer: 'Change requested in review (2026-10-29): List all three in the options section. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
  - id: Q2
    kind: preference
    text: A word starting with a single dash, such as `-x`, is taken as a command or a positional argument, so `spec -x` says "unknown command -x" rather than "unknown option -x". Should single-dash words other than `-v` and `-h` be refused as unknown options?
    default: Keep taking them as positional words.
    cites: []
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
Every `spec` invocation starts the same way: the first word that is not an option names the command, and the options may sit anywhere on the line. With no command, or with `--help`, the CLI prints its usage and succeeds, so a person can always find out what it takes. A word that names no command is refused with the usage, before anything else is looked at.

## Behaviour
### S1: No command prints the usage
Given no spec root can be found
When the developer runs `spec` with no arguments through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stderr is empty
And cli.CommandResult.stdout is exactly the usage text (R1):
```text
usage: spec <command> [options]

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
```

### S2: --help prints the usage and runs no command
Given the chat-mini fixture spec is the spec root
When the developer runs `spec --help lint`, giving cli.Options.help, through cli.Run
Then cli.CommandResult.stdout is exactly the usage text of S1 and cli.CommandResult.exitCode is 0 (R1)
And no lint finding is printed

### S3: -h is the same as --help
Given no spec root can be found
When the developer runs `spec -h` through cli.Run
Then cli.CommandResult.stdout is exactly the usage text of S1 and cli.CommandResult.exitCode is 0 (R1)

### S4: Help wins over a bad option
Given no spec root can be found
When the developer runs `spec --help --bogus` through cli.Run
Then cli.CommandResult.stdout is exactly the usage text of S1 and cli.CommandResult.exitCode is 0 (R1)

### S5: Options alone print the usage
Given no spec root can be found
When the developer runs `spec --format xml` through cli.Run
Then cli.CommandResult.stdout is exactly the usage text of S1 and cli.CommandResult.exitCode is 0 (R1)
And cli.CommandResult.stderr is empty

### S6: An unknown command is refused with the usage
Given no spec root can be found
When the developer runs `spec nope` through cli.Run
Then the command fails with cli.UnknownCommand
And cli.CommandResult.stderr is "unknown command nope", an empty line, then the usage text of S1
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2 (R3)

### S7: An unknown command is refused before the root is looked for
Given no folder /nonexistent exists
When the developer runs `spec nope --root /nonexistent` through cli.Run
Then the command fails with cli.UnknownCommand
And cli.CommandResult.stderr starts with "unknown command nope" and does not hold "spec root" (R3)

### S8: A single-dash word is taken as the command
Given no spec root can be found
When the developer runs `spec -x` through cli.Run
Then the command fails with cli.UnknownCommand
And cli.CommandResult.stderr starts with "unknown command -x" and cli.CommandResult.exitCode is 2

### S9: Options may come before the command
Given the chat-mini fixture spec is at fixtures/chat-mini/spec
When the developer runs `spec --root fixtures/chat-mini/spec find fallback` through cli.Run
Then cli.CommandResult.stdout is the same as for `spec find fallback --root fixtures/chat-mini/spec` (R2)
And cli.CommandResult.exitCode is 0

### S10: An option the command does not use is ignored
Given the chat-mini fixture spec is the spec root
When the developer runs `spec find fallback --ci` through cli.Run
Then cli.CommandResult.stdout is the same as for `spec find fallback` and cli.CommandResult.exitCode is 0 (R2)

### S11: init runs without a spec root
Given no spec root can be found
When the developer runs `spec init` with no other arguments through cli.Run
Then the command fails with cli.UsageError, and cli.CommandResult.stderr starts with "usage: spec init <repo> --name <project>"
And cli.CommandResult.stderr does not hold "no spec root"

### S12: A report-file advance does not read stdin
Given TASK-101 has a running stage, `<report>` is a finished stage report, and stdin remains open
When the developer runs `spec ticket advance TASK-101 --report-file <report>` through cli.Run
Then cli.CommandResult returns without waiting for stdin to close and processes `<report>` (R4)

### S13: Brief without --stdin does not read stdin
Given a valid project spec and stdin remains open
When the developer runs `spec brief implementer TASK-101` through cli.Run
Then cli.CommandResult returns without waiting for stdin to close and prints the brief (R4)

### S14: Next does not read stdin
Given a valid project spec and stdin remains open
When the developer runs `spec next --summary --format json` through cli.Run
Then cli.CommandResult returns without waiting for stdin to close and prints the summary (R4)

### S15: Lint does not read stdin
Given a valid project spec and stdin remains open
When the developer runs `spec lint --ci` through cli.Run
Then cli.CommandResult returns without waiting for stdin to close and reports the lint result (R4)

### S16: A report-file check does not read stdin
Given TASK-101 has a running stage, `<report>` is a finished stage report, and stdin remains open
When the developer runs `spec check-report implementer TASK-101 --report-file <report>` through cli.Run
Then cli.CommandResult returns without waiting for stdin to close and checks `<report>` (R4)
And without `--report-file`, the same command reads the report from stdin (R4)

## Rules
- R1: With `--help`, `-h`, or no command, the CLI prints the usage on stdout and exits 0, whatever else the line holds. Only `--version` wins over it.
- R2: The first word that is not an option is the command, wherever the options sit; options a command does not use are accepted and ignored.
- R3: A word that names no command is refused with exit 2 before the spec root is looked for.
- R4: cli.Run reads stdin only for `hook`, `brief --stdin`, `ticket new` without a file argument, and `check-report` or `ticket advance` without `--report-file`; every other command returns without waiting for stdin to close.

## Out of scope
- What each command does with its own arguments: the module that owns the command
- `spec init` itself: install
