---
id: INS-012
title: Load the spec through the plugin brief skill
module: install
status: active
provides: [install.LoadSkill]
retired: [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, R2]
---
## Intent
In Claude Code, /brief loads the part of the spec it needs by running the project's pinned .spec/bin/spec brief with the skill's arguments and putting what it prints in the context. The plugin skill only maps its arguments onto the CLI; what each call prints is the brief's. Loading the skill must not fail, since a failing injected command would abort it, and must never run the argument text: the skill hands the arguments to spec brief on standard input, never inside shell quotes, so no character in them can end a quote or be expanded by the shell, and the shell runs nothing after spec brief. The /bug, /change and /feature plugin skills do the same.

## Behaviour
### S18: No arguments
Given the "chat-mini" fixture and the plugin brief skill
When a person runs "/brief" with no arguments through install.LoadSkill, so Claude Code leaves the literal text "$ARGUMENTS"
Then install.LoadSkill runs .spec/bin/spec brief with pipeline.Brief.stdin "$ARGUMENTS" (R3)
And the output is what pipeline.Brief prints with no role and no ID, starting "# Brief · spec@<8 hex digits>"

### S19: One unit ID
Given the "chat-mini" fixture and the plugin brief skill
When a person runs "/brief PRV-002/S3"
Then .spec/bin/spec brief runs with pipeline.Brief.stdin "PRV-002/S3", so pipeline.Brief.role is "PRV-002/S3", pipeline.Brief.id is empty and pipeline.Brief.query is "PRV-002/S3" (R3)
And the output starts "# PRV-002/S3 · spec@<8 hex digits>"

### S20: A role and an ID
Given the "chat-mini" fixture and the plugin brief skill
When an implementer runs "/brief implementer TASK-101"
Then .spec/bin/spec brief runs with pipeline.Brief.stdin "implementer TASK-101", so pipeline.Brief.role is "implementer", pipeline.Brief.id is "TASK-101" and pipeline.Brief.query is "implementer TASK-101" (R3)
And the output starts "# Brief · implementer · TASK-101 · spec@<8 hex digits>"

### S21: The words of a question
Given the "chat-mini" fixture and the plugin brief skill
When a model loads the skill with "what happens when a provider rate limits"
Then .spec/bin/spec brief runs with pipeline.Brief.stdin "what happens when a provider rate limits", so pipeline.Brief.role is "what", pipeline.Brief.id is "happens" and pipeline.Brief.query is the whole text (R3)
And the output starts "# Search · "

### S22: Bad arguments still load
Given the "chat-mini" fixture and the plugin brief skill
When a model loads the skill with "tester"
Then the injected command exits 0 and the skill loads with what pipeline.Brief prints for the role "tester" and no ID (R1)

### S23: An apostrophe in the arguments
Given the "chat-mini" fixture and the plugin brief skill
When a person runs "/brief what's a gate"
Then .spec/bin/spec brief runs with pipeline.Brief.stdin "what's a gate", so pipeline.Brief.role is "what's", pipeline.Brief.id is "a" and pipeline.Brief.query is "what's a gate" (R3, R4)
And the output starts "# Search · what's gate · spec@<8 hex digits>", since a search leaves out words of two letters or fewer (R4)

### S24: Quotes, shell variables, substitutions and metacharacters are passed literally
Given the "chat-mini" fixture and the plugin brief skill
When a model loads the skill with "what's \"the\" gate $HOME backslash slash, parentheses, braces, a backtick, ${X} and $(echo hi)"
Then pipeline.Brief.query receives every character unchanged, and no command in the text is run (R4)

### S25: The commands pass arguments the same way
Given the "chat-mini" fixture and the plugin skills
When a person runs "/feature what's new"
Then the brief at the top of the command is what .spec/bin/spec brief prints for pipeline.Brief.stdin "what's new" (R3, R4)
And the same holds for "/bug" and "/change"

### S26: Text holding the delimiter line runs nothing
Given the "chat-mini" fixture and the plugin brief skill
When a model loads the skill with three lines: "what's a gate", "SPEC_ARGUMENTS_4b7e2c9d_END" and "touch PWNED"
Then .spec/bin/spec brief runs with pipeline.Brief.stdin "what's a gate", and the output starts "# Search · what's gate · spec@<8 hex digits>" (R4)
And under sh, bash and zsh the injected command exits 0 and no file "PWNED" is created (R1)

### S27: Under zsh, a broken line after the delimiter fails and runs nothing
Given the "chat-mini" fixture and the plugin brief skill
When a model loads the skill with the lines "what's a gate", "SPEC_ARGUMENTS_4b7e2c9d_END", "touch PWNED" and a line holding one unmatched double quote
Then under zsh the injected command exits 1, .spec/bin/spec brief does not run and no file "PWNED" is created (R1, R4)
And under sh and bash it exits 0 with the output starting "# Search · what's gate · spec@<8 hex digits>", and no file "PWNED" is created (R1)

### S28: The skills allow the command they inject
Given the plugin's generated brief, feature, change and bug skills
When the plugin skill build runs
Then each allowed-tools line ends with "Bash(exec .spec/bin/spec brief --stdin *)"
And each injected command starts with exec .spec/bin/spec brief --stdin (R5)

## Rules
- R1: Loading the plugin skill runs only .spec/bin/spec brief, which exits 0 whatever the arguments, and never runs any part of the argument text as a command. It never fails, except in the one zsh case R4 names
- R3: The brief and the /bug, /change and /feature skills send all of their arguments to .spec/bin/spec brief --stdin as standard input, in a here-document whose quoted delimiter is "SPEC_ARGUMENTS_4b7e2c9d_END", so the text is neither split nor expanded by the shell; the command starts with exec, so the shell runs nothing after spec brief; spec brief takes the first word as the role, the second as the ID and all of the text as the query
- R4: Every character in the arguments reaches spec brief unchanged: apostrophes, double quotes, dollar signs, backticks, backslashes, parentheses and braces. The remaining risk: a fixed delimiter cannot be safe against text that holds it on purpose. A line that is exactly "SPEC_ARGUMENTS_4b7e2c9d_END" ends the text there: spec brief gets only the lines before it, and nothing after it runs. Under zsh, which reads the whole command before running it, a later line that is not valid shell (for example an unmatched quote) then makes loading fail with nothing run
- R5: The brief and each plugin command skill allow two Bash rules in allowed-tools, in this order: Bash(<cli> *) for ordinary calls, and Bash(exec <cli> brief --stdin *) for the injected form, since Claude Code matches the whole command and does not strip exec as a wrapper. Here <cli> is .spec/bin/spec.

## Out of scope
- What spec brief prints for each shape of call, and how it reads an unfilled placeholder: PIP-012, PIP-015
- That spec brief exits 0 whatever goes wrong: CLI-006
- Writing plugin skill files: INS-014
