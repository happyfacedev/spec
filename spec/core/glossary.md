# Glossary

One `### <Term>` per shared word: one line that defines it, then an optional `Aliases: a, b` line.

### Unit
Anything in the spec with its own ID: a module, feature, scenario, rule, contract, member, invariant, decision or screen.

### Spec root
The `spec/` folder of a project, where `config.json` belongs; the CLI finds it from `--root`, `SPEC_ROOT`, an older skill pointer, the `.spec/bin/spec` launcher or the nearest `spec/config.json` above `CLAUDE_PROJECT_DIR` or cwd, and accepts any explicit existing folder (lint then reports a missing `config.json`).

### Tombstone
A unit with status removed, kept so its ID is never reused.

### Derived link
A link from a feature to a contract that the CLI reads from the feature's steps rather than its frontmatter: reads, calls, consumes, emits.

### Stage
One role's turn on a ticket, ending in a report that `check-report` validates and `ticket advance` records and commits.

### Brief
The part of the spec, the ticket and the diff one role needs for one stage, printed by `spec brief`.

### Gate
The check that decides whether a ticket may start, with a fix for each reason it may not.

### Reach
What a change touches: the units it edits, the units to re-verify and the scenarios affected, as `spec impact` prints them.
Aliases: impact

### Draft
A unit written from code or docs and not yet confirmed by a person; it carries its sources until `spec confirm`.

### Worktree
The separate git checkout, on branch `ticket/<ID>`, that one ticket runs in.

### Harness
The agent runtime spec plugs into, such as Claude Code: it loads the skill, runs the hooks and runs the agents.

### Base branch
The branch tickets start from and merge into: `baseBranch` in the config, `main` by default.

### Live copy
A ticket's newest text, wherever it is: another worktree, an unmerged branch tip or a tracker. Every tree reads it.
Aliases: live state

### Wave
A group of tickets the plan can start together.

### Scope
What a ticket works on: its `touches`, `violates` and `changed`, plus the features that own any scenario or rule named there.

### Cite
An ID written in a step, its data, or a rule, which makes a link. A quoted string is never a cite.

### Finding
One problem lint reports, with its rule code, file, line, severity and fix.

### Base spec
The minimal spec with zero findings that every lint rule's scenarios start from and change one thing in.

### Stub
A declaration the tester adds on a proposal so its tests compile, marked `SPEC-STUB` and replaced by the implementer.

### Build stage
The implementer's stage on a proposal in the build lane, which writes the tests and the code together.

### Proof run
The run of a build stage's test files on the code as it was before the build, which shows its tests fail first.

### Report block
The fenced `report` block a role ends its final message with, which `check-report` validates.

### Review round
One reviewer verdict of "changes", which sends the ticket back to the implementer.

### Bounce
One report refusal that lets the stage role fix its report before the CLI stops accepting reports.

### Bundled CLI
The project-pinned CLI at `.spec/bin/spec`, with its CommonJS bundle at `.spec/bin/spec.cjs`.
Aliases: launcher

### Spec version
"spec@" and the first 8 hex digits of a SHA-256 over the authored spec files, printed in every JSON output.

### Code pointer
A contract's `Code:` line, naming the symbol that implements it.

### Draft marker
`draft: true` with `sources:` on a frontmatter unit, or `· Draft: <sources>` on a status line.
