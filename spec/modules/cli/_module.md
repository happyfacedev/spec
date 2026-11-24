---
id: cli
prefix: CLI
domain: platform
status: active
---
How every `spec` command is invoked and answers: finding the spec root, global options, output formats, usage text and exit codes.

## Owns
- Root resolution: `--root`, `SPEC_ROOT`, older skill pointer, project `.spec/bin/spec` launcher, then nearest `spec/config.json` above `CLAUDE_PROJECT_DIR` or cwd
- Global options: `--root`, `--tickets`, `--format text|json`, `--version`
- Usage text, unknown commands and the exit codes every command shares
- `spec detect`: the current repository's setup state and stack defaults
- `spec config set`: supported, schema-validated project config edits
- `spec next [<TICKET>] [--start] [--harness <name>]`: tasks the main session can delegate

## Non-goals
- What any single command does: that belongs to the module that owns the command
