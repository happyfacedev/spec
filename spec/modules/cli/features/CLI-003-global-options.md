---
id: CLI-003
title: Read the global options
module: cli
status: active
questions:
  - id: Q1
    kind: preference
    text: The README says every command takes `--format json`, but `spec brief` and `spec hook` accept it and still print text. Should those commands print JSON, or should the README name the commands that do?
    default: Keep the code; correct the README.
    cites: []
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q2
    kind: preference
    text: '`--depth` is checked on every command line, so `spec lint --depth 0` fails although lint takes no depth, while other options a command does not use are ignored. Should `--depth` be checked only by `spec impact`?'
    default: Keep checking it everywhere.
    cites: []
    answer: 'Check --depth only on impact (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
A few options mean the same for every command: where the spec is, where the tickets are, and whether output is text or JSON. The CLI reads them once, in one way, and refuses a malformed command line with exit 2 and the usage before any command runs, so a script never acts on a misread flag.

## Behaviour
### S1: Text is the default format
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint` without --format through cli.Run
Then cli.CommandResult.stdout is text whose last line is "0 errors, 1 warning", not JSON

### S2: --format json prints one JSON document
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --format json`, giving cli.Options.format, through cli.Run
Then cli.CommandResult.stdout parses as one JSON document with the keys "spec" and "findings"
And cli.CommandResult.exitCode is 0

### S3: An option's value may follow an equals sign
Given the chat-mini fixture spec is at fixtures/chat-mini/spec
When the developer runs `spec lint --format=json --root=fixtures/chat-mini/spec` through cli.Run
Then cli.CommandResult.stdout is the same as for `spec lint --format json --root fixtures/chat-mini/spec` (R1)

### S4: The last --format wins
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --format json --format text` through cli.Run
Then cli.CommandResult.stdout is text whose last line is "0 errors, 1 warning" (R1)

### S5: A format other than text or json
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --format xml` with cli.Options.format through cli.Run
Then the command fails with cli.InvalidFormat
And cli.CommandResult.stderr is "--format is text or json, not xml", an empty line, then the usage text
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2 (R2)

### S6: Format values are case-sensitive
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --format JSON` through cli.Run
Then the command fails with cli.InvalidFormat
And cli.CommandResult.stderr starts with "--format is text or json, not JSON" (R2)

### S7: An unknown option
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --bogus` through cli.Run
Then the command fails with cli.UnknownOption
And cli.CommandResult.stderr is "unknown option --bogus", an empty line, then the usage text
And cli.CommandResult.exitCode is 2 (R2)

### S8: An option with no value
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --root` through cli.Run
Then the command fails with cli.MissingValue
And cli.CommandResult.stderr starts with "--root needs a value" and cli.CommandResult.exitCode is 2 (R2)

### S9: A following option is never taken as a value
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --root --ci` through cli.Run
Then the command fails with cli.MissingValue
And cli.CommandResult.stderr starts with "--root needs a value" (R2)

### S10: --tickets with no value
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --tickets` through cli.Run
Then the command fails with cli.MissingValue
And cli.CommandResult.stderr starts with "--tickets needs a value" and cli.CommandResult.exitCode is 2

### S11: A depth that is not a whole number of 1 or more
Given the chat-mini fixture spec is the spec root
When the developer runs `spec impact "PRV-001" --depth 0` through cli.Run
Then the command fails with cli.InvalidDepth
And cli.CommandResult.stderr starts with "--depth is a whole number of 1 or more" and cli.CommandResult.exitCode is 2 (R2)

### S12: Every problem on the line is reported, one per line
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --bogus --format xml` through cli.Run
Then cli.CommandResult.stderr starts with these two lines, then an empty line and the usage text:
```text
unknown option --bogus
--format is text or json, not xml
```
And cli.CommandResult.exitCode is 2 (R2)

### S13: Command-line errors are text even with --format json
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --format json --bogus` through cli.Run
Then cli.CommandResult.stderr starts with "unknown option --bogus" and cli.CommandResult.stdout is empty (R2)

### S14: --tickets names the ticket folder
Given the chat-mini fixture spec is the spec root, whose tickets/ folder holds "BUG-302" with lint warning L020
And /t is an empty folder
When the developer runs `spec lint --tickets /t` with cli.Options.tickets through cli.Run
Then cli.CommandResult.stdout is "lint clean" and cli.CommandResult.exitCode is 0 (R3)

### S15: A --tickets folder that does not exist holds no tickets
Given the chat-mini fixture spec is the spec root and no folder /none exists
When the developer runs `spec lint --tickets /none` through cli.Run
Then cli.CommandResult.stdout is "lint clean" and cli.CommandResult.exitCode is 0 (R3)

### S16: --tickets replaces a tracker command
Given a copy of the chat-mini fixture spec whose "config.json" sets tickets to {"adapter": "command", "command": "node tools/tickets.mjs"}
And /t holds only a copy of the fixture ticket "TASK-101.md"
When the developer runs `spec queue --tickets /t` through cli.Run
Then "node tools/tickets.mjs" is never run
And cli.CommandResult.stdout holds "## Ready (1)" and "- TASK-101 task · next implementer · Extract provider selection into its own module" (R3)

### S17: A relative --tickets is resolved against the working folder
Given the chat-mini fixture spec is the spec root, cli.Run.cwd is /w, and /w/t is an empty folder
When the developer runs `spec lint --tickets t` through cli.Run
Then cli.CommandResult.stdout is "lint clean" (R3)

### S18: A depth on a command that does not take one is ignored
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --depth 0` through cli.Run
Then cli.CommandResult.stdout is the same as for `spec lint` and cli.CommandResult.exitCode is 0 (R4)

## Rules
- R1: An option's value is the next word or follows `=`; given twice, the last one wins.
- R2: A malformed command line (an unknown option, a missing value, a bad `--format`, or a bad `--depth` for `impact`) is refused before any command runs: every problem on its own line on stderr, an empty line, the usage text, nothing on stdout, exit 2.
- R4: `--depth` is checked only by `impact`; any other command accepts it and ignores it.
- R3: `--tickets <dir>` makes the command read ticket files from that folder, resolved against the working folder, in place of the store `config.json` names; a folder that does not exist holds no tickets.

## Out of scope
- The JSON each command prints: the module that owns the command
- Options only one command takes (`--files`, `--ci`, `--base`, `--name`, `--query`, `--update-roles`, `--yes`, `--dry-run`, `--no-tests`): the module that owns the command
- What `--depth` does on `impact`: the module that owns each command
- The ticket store `config.json` names: tickets
