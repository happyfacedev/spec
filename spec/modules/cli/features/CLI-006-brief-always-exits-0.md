---
id: CLI-006
title: spec brief always exits 0
module: cli
status: active
---
## Intent
A Claude Code skill injects `spec brief` into a prompt, and a command that exits non-zero aborts the skill. So `spec brief` never fails as a process: every problem the CLI would report on stderr with exit 2 is printed on stdout instead, with exit 0, where the agent reading the brief sees it.

## Behaviour
### S1: A malformed command line
Given the chat-mini fixture spec is the spec root
When the developer runs `spec brief --format xml` through cli.Run
Then cli.CommandResult.stdout is "--format is text or json, not xml", an empty line, then the usage text
And cli.CommandResult.stderr is empty and cli.CommandResult.exitCode is 0 (R1)

### S2: An unknown option
Given the chat-mini fixture spec is the spec root
When the developer runs `spec brief --bogus` through cli.Run
Then cli.CommandResult.stdout starts with "unknown option --bogus" and cli.CommandResult.exitCode is 0 (R1)

### S3: No spec root
Given no spec root can be found
When the developer runs `spec brief` through cli.Run
Then cli.CommandResult.stdout is "no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json", an empty line, then the usage text
And cli.CommandResult.stderr is empty and cli.CommandResult.exitCode is 0 (R1)

### S4: A spec root that does not exist
Given no folder /nonexistent exists
When the developer runs `spec brief implementer "TASK-101" --root /nonexistent` through cli.Run
Then cli.CommandResult.stdout starts with "spec root /nonexistent does not exist" and cli.CommandResult.exitCode is 0 (R1)

### S5: A failure inside the tool
Given the chat-mini fixture spec is the spec root, and the tool fails unexpectedly with the error "Error: boom" while running `spec brief`
When the developer runs `spec brief implementer "TASK-101"` through cli.Run
Then cli.CommandResult.stdout starts with "spec brief failed: Error: boom"
And cli.CommandResult.stderr is empty and cli.CommandResult.exitCode is 0 (R1)
And cli.CommandResult.stdout does not hold "spec: internal error:"

### S6: A skill.json that is not JSON
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec and /p/.claude/skills/x-spec/skill.json holds "nope", which is not JSON
When the developer runs /p/.claude/skills/x-spec/scripts/spec `brief implementer "TASK-101"` through cli.Run
Then cli.CommandResult.stdout starts with "/p/.claude/skills/x-spec/skill.json is not valid JSON"
And cli.CommandResult.stderr is empty and cli.CommandResult.exitCode is 0 (R1)

## Rules
- R1: `spec brief` exits 0 whatever goes wrong; a problem other commands print on stderr is printed on its stdout.

## Out of scope
- What the brief holds, and what it says about an unknown role or ticket: pipeline
