---
id: CLI-005
title: Exit codes and internal errors
module: cli
status: active
retired: [S8]
questions:
  - id: Q1
    kind: preference
    text: Exit 2 means both "the command line was wrong" and "the tool itself failed", so a script cannot tell a typo from a bug by the code alone. Should an internal error get its own exit code?
    default: 'Keep exit 2 for both; the "spec: internal error:" prefix tells them apart.'
    cites: []
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q2
    kind: preference
    text: '`spec hook` exits 2 to tell Claude Code to block an edit, which is neither a usage error nor an internal error. Should the shared exit-code rule name this exception, as it names `spec brief`?'
    default: Name it as an exception owned by install.
    cites: []
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q3
    kind: preference
    text: A `skill.json` that is not JSON makes every command fail as an internal error with a stack trace, though it is the user's file. Should it be a usage error naming the file instead?
    default: Keep it an internal error.
    cites: []
    answer: 'Change requested in review (2026-10-29): Report it as a user error that names the file.'
    raised_by: null
---
## Intent
Every command answers the shell the same way, so scripts and agents can act on the exit code alone: 0 when it did what was asked, 1 when it ran and found a failure, 2 when the command line was wrong or the tool broke. A failure inside the tool is marked as such and never passed off as a problem in the user's input.

## Behaviour
### S1: A command that succeeds exits 0
Given the chat-mini fixture spec is the spec root, with no lint errors and one warning
When the developer runs `spec lint` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stderr is empty (R1)

### S2: A command that runs and finds a failure exits 1
Given /empty is an existing empty folder
When the developer runs `spec lint --root /empty` through cli.Run
Then cli.CommandResult.stdout ends with "1 error, 0 warnings"
And cli.CommandResult.exitCode is 1 (R1)

### S3: A wrong command line exits 2 with the usage
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --bogus` through cli.Run
Then cli.CommandResult.exitCode is 2 and cli.CommandResult.stdout is empty
And cli.CommandResult.stderr ends with the usage text, after an empty line (R1, R2)

### S4: A failure inside the tool
Given the chat-mini fixture spec is the spec root, and the tool fails unexpectedly with the error "Error: boom" while running `spec lint`
When the developer runs `spec lint` through cli.Run
Then the command fails with cli.InternalError
And cli.CommandResult.stderr starts with "spec: internal error: Error: boom"
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2 (R3)

### S5: An internal error carries its stack trace
Given the failure of S4
When the developer runs `spec lint` through cli.Run
Then the lines of cli.CommandResult.stderr after the first start with "    at " (R3)

### S6: A skill.json that is not JSON is a user error naming the file
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec and /p/.claude/skills/x-spec/skill.json holds "nope", which is not JSON
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` without --root or SPEC_ROOT through cli.Run
Then the command fails with cli.InvalidSkillPointer, whose cli.InvalidSkillPointer.file is "/p/.claude/skills/x-spec/skill.json"
And cli.CommandResult.stderr starts with "/p/.claude/skills/x-spec/skill.json is not valid JSON", and ends with the usage text, after an empty line (R2, R4)
And cli.CommandResult.stderr does not hold "internal error" or "    at "
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2 (R1, R4)

### S7: --root or SPEC_ROOT makes a broken skill.json irrelevant
Given the installation of S6, whose "skill.json" is not JSON, and the chat-mini fixture spec is at /p/spec
When the developer runs /p/.claude/skills/x-spec/scripts/spec `lint --root /p/spec` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stderr is empty (R4)

### S9: A hook with no resolvable spec root is silent
Given no spec/config.json exists above cwd and no --root, SPEC_ROOT or launcher is set
When the developer runs `spec hook claude-code session-start` through cli.Run with an empty JSON payload
Then cli.CommandResult.stdout and cli.CommandResult.stderr are empty
And cli.CommandResult.exitCode is 0 (R1)

## Rules
- R1: Exit 0 means the command did what was asked; 1 that it ran and found a failure (lint errors, a blocked stage, failing tests); 2 that the command line was wrong (bad options, an unknown command or ID, no spec root for a non-hook command) or that the tool itself failed. A non-hook command also exits 2 for an invalid old skill.json pointer (R4). Two commands are exceptions: spec brief always exits 0, and spec hook exits 2 only to tell the harness to block a tool call; a hook with no resolvable root exits 0 silently (INS-007). `spec brief` always exits 0 (CLI-006).
- R2: A wrong command line prints its message, an empty line and the usage text on stderr, and nothing on stdout.
- R3: A failure inside the tool prints "spec: internal error: " then the error and its stack trace on stderr, and exits 2.
- R4: For a non-hook command, a `skill.json` that is not valid JSON is the user's file and not a failure of the tool: the CLI prints its absolute path and "is not valid JSON", an empty line and the usage text on stderr, with no stack trace and nothing on stdout, and exits 2. A hook treats the same unresolved pointer silently and exits 0 (INS-007). A `--root` or `SPEC_ROOT` makes the file unread.

## Out of scope
- Which failures each command reports, and with which code: the module that owns the command
- The exit codes `spec hook` returns to the harness: install
