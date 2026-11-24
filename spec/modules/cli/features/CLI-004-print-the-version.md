---
id: CLI-004
title: Print the version
module: cli
status: active
---
## Intent
`spec --version` says which CLI is running, so a person or a script can tell an installed copy from the one in their checkout. It works anywhere, with or without a spec, and the bundled CLI runs the same in any repository it is copied into.

## Behaviour
### S1: The bundled CLI prints its package version
Given the CLI is built from a package whose version is "0.1.0"
When the developer runs `spec --version` with cli.Options.version through cli.Run
Then cli.CommandResult.stdout is exactly "spec 0.1.0" and a newline
And cli.CommandResult.stderr is empty and cli.CommandResult.exitCode is 0

### S2: Run from source, the version is 0.0.0-dev
Given the CLI runs from its source rather than the bundle
When the developer runs `spec --version` through cli.Run
Then cli.CommandResult.stdout is exactly "spec 0.0.0-dev" and a newline

### S3: -v is the same as --version
Given no spec root can be found
When the developer runs `spec -v` through cli.Run
Then cli.CommandResult.stdout is "spec " then the version and a newline, and cli.CommandResult.exitCode is 0 (R1)

### S4: --version needs no spec root
Given no spec root can be found
When the developer runs `spec --version` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stderr is empty (R1)

### S5: --version wins over a command
Given the chat-mini fixture spec is the spec root
When the developer runs `spec lint --version` through cli.Run
Then cli.CommandResult.stdout is only "spec " then the version and a newline, and no lint finding is printed (R1)

### S6: --version wins over --help
Given no spec root can be found
When the developer runs `spec --help --version` through cli.Run
Then cli.CommandResult.stdout is only "spec " then the version and a newline, not the usage text (R1)

### S7: --version wins over a malformed command line
Given no spec root can be found
When the developer runs `spec --version --bogus` through cli.Run
Then cli.CommandResult.stdout is "spec " then the version and a newline, and cli.CommandResult.exitCode is 0 (R1)

### S8: The bundled CLI runs under any package.json type
Given the bundled CLI is copied to <repo>/.spec/bin/spec in three repositories whose package.json "type" is "module", "commonjs", and absent
When the developer runs `spec --version` in each through cli.Run
Then each cli.CommandResult.stdout matches "spec <major>.<minor>.<patch>" and a newline

### S9: The bundled CLI runs through a symlink
Given /bin-dir/spec is a symlink to an installed bundled CLI
When the developer runs /bin-dir/spec `--version` through cli.Run
Then cli.CommandResult.stdout starts with "spec "

## Rules
- R1: With `--version` or `-v` anywhere on the line, the CLI prints `spec <version>` and exits 0, and does nothing else.

## Out of scope
- Comparing the installed version with the one in the checkout: install (`spec init --update-roles`)
