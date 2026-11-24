---
id: PIP-017
title: Build a self-contained task for the next stage
module: pipeline
status: active
---

## Intent
A task from `spec next` gives a generic subagent everything needed to perform one stage. It carries the expanded project role prompt, an explicit worktree and CLI path, the existing budgeted brief, and the report form.

## Behaviour
### S1: The delegated task includes its role prompt and report form
Given "TASK-101" is ready for the "implementer" stage
When `spec next TASK-101 --format json` prepares its task
Then the task includes the expanded implementer prompt, its ticket brief, and the report block form (R1)

### S2: The worktree and CLI path are explicit
Given "TASK-101" is prepared for its "implementer" stage
When the task is returned
Then it tells the subagent the absolute worktree folder and to work only inside it, giving file tools absolute paths there
And it says each shell command starts in the project root and a cd does not carry over, so the subagent never runs cd, alone or joined to another command (R2)
And it gives the CLI as ".spec/bin/spec --root <absolute spec root inside that worktree>", a command relative to the project root, never the absolute path of a CLI inside the worktree (R2)
And it says to run the tests only through that CLI's "test", which runs the project's test command in the worktree, and that the subagent never commits, since recording the stage commits it (R2)
And it says to look at the worktree's git state only as "git -C <absolute worktree> status", "diff" or "log" (R2)
And it says to give any other project command the worktree through that command's own directory option or path argument, written after the command words its allow rule names, so that a rule such as "Bash(dart format *)" still matches the whole command text (R2, R15)

### S3: The task uses the existing brief budget
Given a role's brief exceeds its configured budget
When `spec next` prepares the task
Then the brief is the same budgeted brief returned by `spec brief` (R3)

### S4: One path function supplies the CLI path
Given a delegated role prompt contains commands beginning with `spec`
When `spec next` builds the task
Then it substitutes the project CLI path in those commands and uses the same path in the worktree block (R2)

### S5: The inlined brief and report appear only once
Given the expanded role prompt asks for a brief when none is supplied and ends in a report block
When `spec next` prepares a task with an inlined brief
Then it says "Your brief is below; do not run brief again"
And the task contains exactly one report block with this ticket and role (R1)

### S6: The main session's advance command stays outside the task
Given `spec next` prepares a delegated stage
When it returns the task and execution context
Then cli.Next.advance gives the main session the project-root-relative `.spec/bin/spec ticket advance` command with `--report-file` and an absolute report-file path already filled in, and running it records the report into the ticket worktree
And that report-file path is a file directly inside the ticket worktree parent, outside every ticket worktree, and its name holds the ticket ID and the role (R4)
And the Working folder block names that same report-file path as the file to save the final report to, and says the main session records the stage (R16)
And the task does not mention `ticket advance` and holds no advance command, so a subagent cannot record its own stage (R4, R16)

### S7: The spec-writer's task asks for the case checklist
Given "PROP-201" is ready for its "spec-writer" stage and "spec/roles/spec-writer.md" is this version's spec-writer prompt
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task says to work through every item of the brief's "## Case checklist" before finishing and report each under checklist:, and to end blocked, with a blocker marked external: true, on an external fact it could not verify (R5)
And the task holds that instruction exactly once: "Work through every item of the brief's case checklist before finishing" appears one time, and the sentence of S8 is not added (R5, R6)
And the task's one report block holds a "checklist:" line after its "documents:" line (R1, R5)

### S8: A spec-writer prompt that predates the checklist gets the instruction added
Given "PROP-201" is ready for its "spec-writer" stage and "spec/roles/spec-writer.md" says "checklist:" nowhere outside its report block, with or without backticks
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task ends with the paragraph "Work through every item of the brief's case checklist before finishing, and report each under checklist:. If you could not verify an external fact, end blocked with a blocker marked external: true." after a blank line (R6)
And the task's brief still holds "## Case checklist" (R5)
But a prompt for any other role gets no such paragraph (R6)

### S9: A spec-writer report form without documents or checklist gets them
Given "PROP-201" is ready for its "spec-writer" stage and the report block of "spec/roles/spec-writer.md" has a "changed: []" line and no "documents:" or "checklist:" line
When `spec next PROP-201 --format json` prepares its task
Then the task's one report block holds "documents: []" on the line after its "changed:" line, and "checklist: []" on the line after that (R6)
And a form that has "documents:" but no "checklist:" gets only "checklist: []", on the line after its "documents:" line, and a form that has both is left as it is (R6)
But the report form of any other role gets neither line (R6)

### S10: The spec review is delegated like any other stage
Given "PROP-201" has a done "spec-writer" stage, so its next stage is "spec-review", and "spec/roles/spec-review.md" is this version's spec-review prompt
When `spec next PROP-201 --format json` prepares its task
Then the output has action "delegate" and role "spec-review", and the task holds the expanded spec-review prompt, the Working folder block, the brief of `spec brief spec-review PROP-201` and one report block with "role: spec-review", "ticket: PROP-201", a "verdict:" line and a "findings:" line (R1, R7)
And the role prompt says to read the spec delta and the neighbours' scenarios in the brief, to check the delta against each of C1 to C6 and C8 and the spec-writer's answer to it, to change no file but the report file (R17), and to report verdict approve or changes with findings that each cite the IDs they are about (R7)
And it says to judge in proportion: "changes" only for a case a user would plausibly hit that the delta leaves unstated, or for a scenario it gets wrong; a minor case goes on an approval as a finding whose text starts "Follow-up:"; and every finding goes in one report (R7)
And cli.Next.model is the harness's `delegation.<harness>.spec-review` model, or, when that is not set, its `delegation.<harness>.reviewer` model, and cli.Next.effort is from the same setting (R8)

### S11: A project installed before the spec review still delegates it
Given "PROP-201" is ready for its "spec-review" stage and "spec/roles/spec-review.md" does not exist, as in a project installed by an earlier version
When `spec next PROP-201 --format json` prepares its task
Then the task holds this version's spec-review prompt, as `spec init` would install it, and the project's files are unchanged (R8)
But when "spec/roles/spec-review.md" exists and is not a valid role file, cli.Next.action is "error" with the blocker "no valid spec/roles/spec-review.md prompt" (R8)
And with neither `delegation.<harness>.spec-review` nor `delegation.<harness>.reviewer` set, the text header says `model: (not set — choose one for spec-review)` and cli.Next.missingModels names "reviewer", not "spec-review" (R8)

### S12: The tester's task tells it to update the tests a changed behaviour replaces
Given "PROP-201" is ready for its "tester" stage and "spec/roles/tester.md" is this version's tester prompt
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task says that for each changed scenario or rule, the tester searches the existing tests for the behaviour the change replaces, updates those tests in the same stage, lists their scenario IDs under changed, and names under assumed any it could not decide (R9)

### S13: The review tasks ask each finding for its class
Given "PROP-201" is ready for its "reviewer" stage and "spec/roles/reviewer.md" is this version's reviewer prompt
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task holds, exactly once, "Give each finding a class, as class: <class>: C1 neighbours, C2 environment axes, C3 concurrency and ordering, C4 trust boundaries, C5 fail closed, C6 preserved behaviour, C7 tests that cannot fail, C8 external facts, C9 text and docs, or other." (R10)
And the same holds for the task of a "spec-review" stage built from this version's spec-review prompt (R10)
But when the project's reviewer or spec-review prompt says "class:" nowhere, as one installed by an earlier version, the task's role prompt ends with that sentence as its own paragraph after a blank line, and the project's role file is unchanged (R10)
And the task of a spec-writer, tester or implementer stage holds no such sentence (R10)

### S14: A project's own additions follow the shipped role prompt
Given "PROP-201" is ready for its "tester" stage, "spec/roles/tester.md" is this version's tester prompt, and install.LocalRoleFile "spec/roles/tester.local.md" holds "Follow the patterns of the existing tests." and "Run `spec test` before you finish."
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task ends with those two paragraphs, after a blank line, after the shipped prompt's own text and after any paragraph R6 or R10 adds, and before the Working folder block (R1, R11)
And "spec test" in that text is written with the project CLI path, as in the shipped text (R2, R11)
And the task holds one report block, the one from "spec/roles/tester.md" (R1)
And with no "spec/roles/tester.local.md", or one that holds only blank lines, the task is the same as before this file existed (R11)
But when "spec/roles/tester.local.md" exists and cannot be read as a file, such as a folder, cli.Next.action is "error" with the blocker "cannot read spec/roles/tester.local.md" (R11)

### S15: The spec-writer's task prefers properties to computed values
Given "PROP-201" is ready for its "spec-writer" stage and "spec/roles/spec-writer.md" is this version's spec-writer prompt
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task says to state what it can derive by hand (an order, a membership, a count) as a property rather than pin a value that non-trivial logic computes (R12)
And it says that when a scenario does pin such a value, the spec-writer works it out from the scenario's Givens, by running the project's current build on them when it can, and names under assumed any pinned value it could not work out (R12)
And the task holds that instruction exactly once (R12)

### S16: The spec review recomputes the values a scenario pins
Given "PROP-201" is ready for its "spec-review" stage, "spec/roles/spec-review.md" is this version's spec-review prompt, and the delta holds a scenario whose Then pins a footprint that non-trivial logic computes from its Givens
When `spec next PROP-201 --format json` prepares its task
Then the role prompt in the task says to recompute each value a scenario in the delta pins that non-trivial logic computes, from that scenario's Givens, and to compare it with the pinned value (R13)
And it says that a pinned value which does not match the recomputed one is a reason for verdict changes, with a finding that cites the scenario and, like every finding, a class (R10, R13)
And it says that a value it could not recompute goes in a finding whose text starts "Follow-up:" (R13)
And it says that a value it can derive by hand, or a property such as an order or a count, needs no recomputation (R13)
And the task holds that instruction exactly once (R13)

### S17: A project's older prompts are not extended with the computed-value rules
Given "PROP-201" is ready for its "spec-writer" stage and "spec/roles/spec-writer.md" says nothing about pinned computed values, as one installed by an earlier version, and the same holds for "spec/roles/spec-review.md" at the "spec-review" stage
When `spec next PROP-201 --format json` prepares each of these tasks
Then the role prompt in the task is the project's prompt, with only what R6, R10 and R11 add, and holds no sentence of S15 or S16 (R12, R13)
And the project's role files are unchanged, and `spec init repo --update-roles --yes` is how a project gets this version's prompts (R12, R13)
But the task of a tester, implementer or reviewer stage built from this version's prompts holds neither sentence (R12, R13)

### S18: Every stage's task says to change files with the edit tools
Given "PROP-201" is ready for each of its stages in turn, and each of "spec/roles/spec-writer.md", "spec/roles/spec-review.md", "spec/roles/tester.md", "spec/roles/implementer.md" and "spec/roles/reviewer.md" is this version's prompt for its role
When `spec next PROP-201 --format json` prepares each stage's task
Then the role prompt in the task holds, exactly once, "Change files only with your edit tools, never through the shell: no output redirection, heredoc, tee, sed -i or perl -pi into a file. Shell writes skip spec's checks and leave no diff in the session." (R14)
But when the project's prompt for a role predates this rule and says nothing of it, the task's role prompt is the project's prompt with only what R6, R10 and R11 add, and the project's role file is unchanged (R14)

### S19: A stage's commands and report file fit the permissions setup already grants
Given "TASK-101" is ready for its "implementer" stage in a project that has ".spec/bin/spec.cjs", whose ticket worktree parent is "../shop.worktrees", and whose folder's absolute path holds a space
When `spec next TASK-101 --format json` prepares its task
Then every CLI command the task names, in the role prompt, a local role file's text and the Working folder block, starts with ".spec/bin/spec ", so it matches the allow rule "Bash(.spec/bin/spec *)" from the project root (R2, R15)
And the `--root` value is quoted so the shell reads it as one argument, and the task holds no "cd " command (R2, R15)
And cli.Next.advance starts with ".spec/bin/spec ticket advance TASK-101 --report-file ", and its report-file path, quoted the same way, lies inside the folder that install.LocalClaudeSettings lists in `permissions.additionalDirectories` (R4, R15)

### S20: A pointer-layout project gets its own launcher in the same form until it upgrades
Given "TASK-101" is ready for its "implementer" stage in a project with a valid old "skill.json" pointer and the skill-local launcher ".claude/skills/spec/scripts/spec", but no ".spec/bin/spec.cjs"
When `spec next TASK-101 --format json` prepares its task
Then the task's CLI is ".claude/skills/spec/scripts/spec --root <absolute spec root inside that worktree>", relative to the project root, and the task still never asks for cd (R2)
And cli.Next.advance starts with ".claude/skills/spec/scripts/spec ticket advance TASK-101 --report-file " and names a report file inside the ticket worktree parent (R4)
And after `spec upgrade` installs ".spec/bin/spec.cjs", the same command gives the task CLI and cli.Next.advance starting with ".spec/bin/spec " (R2, R15, INS-014/S16)

### S21: Every stage's task says to save the final report and check it before finishing
Given "PROP-201" is ready for each of its stages in turn, and each of "spec/roles/spec-writer.md", "spec/roles/spec-review.md", "spec/roles/tester.md", "spec/roles/implementer.md" and "spec/roles/reviewer.md" is this version's prompt for its role
When `spec next PROP-201 --format json` prepares each stage's task
Then the role prompt in the task says, exactly once, to save the final report to the report file the Working folder block names, to run `spec check-report` for that role and "PROP-201" with that file as its input until it prints "report ok", and then to end the final message with the report block (R17)
And that `spec check-report` command is written with the project CLI path, as every `spec` command in the role prompt is (S4, R2, R15)
And for the reviewer and the spec review, which change no file, the task still allows saving that report file and no other, and the Working folder block names it as the one file outside the worktree a stage may write (R2, R17)
But when the project's prompt for a role predates this rule and says nothing of it, the task's role prompt is the project's prompt with only what R6, R10 and R11 add, the Working folder block still names the report file, and the project's role file is unchanged (R17)

### S22: A build stage's task is the implementer's, with mutations in its form
Given "PROP-215" in the build lane is ready for its "implementer" stage, and "spec/roles/implementer.md" is this version's implementer prompt
When `spec next PROP-215 --format json` prepares its task
Then cli.Next.role is "implementer", cli.Next.model is the implementer's, and the task's brief starts with the build lane's rule (PIP-012/S30) (R1, R18)
And the role prompt says that when the brief's rule names the build lane, the implementer writes the tests too, and its own rules that the tests are the tester's and that no test file changes do not hold (R18)
And the task's one report block holds "mutations: []" on the line after its "changed:" line (R18)
But with a project prompt that predates the build lane, the role prompt is the project's with only what R6, R10 and R11 add, its file is unchanged, and the report block holds the "mutations: []" line all the same (R18)
And an implementer task outside the build lane, such as one for "TASK-101" or "PROP-201", holds no "mutations:" line in its report block (R18)

## Rules
- R18: A build stage (PIP-021/R9) is delegated as an implementer stage: the implementer's prompt, model and report form, in which `spec next` puts "mutations: []" after the "changed:" line when the form has none. This version's implementer prompt says what S22 says; an older project prompt gets nothing added, since the brief's rule says that it may change test files and name mutations (PIP-012/R16). This version's reviewer prompt is as PIP-019/R4 says.
- R10: This version's reviewer and spec-review prompts ask for a class on every finding and list the finding classes in the one sentence of S13. For those two roles only, when a project's prompt says "class:" nowhere, `spec next` appends that sentence to the role prompt as its own paragraph; the project's role file is never changed.
- R5: This version's spec-writer prompt asks for the brief's case checklist (PIP-012/R9) and an external blocker for an unverified external fact, and its report block form holds a checklist: key. The brief carries the checklist whatever the project's own prompt says, and a task built from this version's prompt holds the instruction once.
- R6: Only for the spec-writer, `spec next` makes a project's older prompt ask for what check-report needs: when the prompt says "checklist:" nowhere outside its report block, in backticks or not, it appends the checklist paragraph of S8 to the role prompt; when its report form has no "documents:" line it inserts "documents: []" after the "changed:" line, and when it has no "checklist:" line it inserts "checklist: []" after the "documents:" line. The project's role file itself is never changed.
- R1: The task order is expanded role prompt, Working folder block, existing role-and-ticket brief, then the report block form.
- R2: CLI path is supplied by one function; the task names its absolute worktree, says to work only there with absolute paths (the report file of R4 and R17 is the one file outside it that a stage writes), says a cd does not carry over between shell commands so it never runs cd, and gives the CLI as the project's own relative CLI with `--root` set to the absolute spec root inside that worktree, so every command it runs acts on the worktree. The project's own CLI is `.spec/bin/spec`, or, in a pointer-layout project without `.spec/bin/spec.cjs`, its skill-local launcher until `spec upgrade` installs `.spec/bin/spec` (INS-014/S16). Only some commands need the worktree named: tests run through the CLI's `test`; the subagent never commits, because recording the stage commits it; it reads git state only with `git -C <absolute worktree>` and a read-only subcommand (status, diff, log); any other project command gets the worktree through its own directory option or path argument placed after the command words its allow rule names, never through cd.
- R3: The role brief is produced by the existing brief builder and obeys its configured and default budgets.
- R4: The main session receives `cli.Next.advance` as a relative `.spec/bin/spec ticket advance` command (the pointer-layout launcher in its place, as R2 says) to run from the project root, outside the task, with `--report-file` and an absolute report path filled in: a file directly inside the ticket worktree parent, named for the ticket and the role, so it is never inside a ticket worktree. The subagent saves its final report there (R16); the main session makes sure the file holds the subagent's final message, writing it there when it does not, and runs the command as given; the CLI records the report into the ticket worktree. Text output places the command in the header.
- R15: In a Claude Code session whose personal settings list the ticket worktree parent (INS-003/R5) and whose project settings allow `Bash(.spec/bin/spec *)` (INS-003/R2), a delegated stage needs no approval in acceptEdits mode: every CLI command in the task and in cli.Next.advance starts with `.spec/bin/spec `, any path in it that holds a space or another shell character is quoted, and the report file is inside the worktree parent, where acceptEdits approves writes. The task never asks for cd. Default edit mode is unchanged: it still asks before writes. A Bash rule matches the whole command text, so a project command's own allow rule covers its worktree form only when that form keeps the rule's leading words; a command with no directory option or path argument, and read-only git, get whatever approval Claude Code gives them, which spec does not promise. A pointer-layout project's launcher matches no rule spec writes, so its stages ask for the CLI until `spec upgrade`.

- R7: This version's spec-review prompt (`roles/spec-review.md`, installed as `spec/roles/spec-review.md`) has the spec reviewer read the brief's spec delta and neighbours, check the delta against C1 to C6 and C8 and the spec-writer's answers, change no file but the report file (R17), and end with a report whose verdict is approve or changes and whose findings each cite IDs. It holds the review bar in proportion, as the reviewer's prompt does: every proposal gets the review, however small, but a small or clean delta is approved, with minor cases as "Follow-up:" findings, and every finding is given in one report.
- R8: The spec review's model and effort are those of `delegation.<harness>.spec-review`, else that harness's reviewer's (FMT-015/R8); the spec review is never listed in cli.Next.missingModels, since a reviewer model covers it. When the project has no `spec/roles/spec-review.md`, `spec next` uses the prompt this version ships, without writing it; a file that exists but is not a valid role prompt is an error, as for every role.
- R9: This version's tester prompt has the tester, for each changed scenario or rule in its brief, search the existing tests for the behaviour the change replaces (an old message text, a stage order, a default or a flag), update those tests in the same stage, list their scenario IDs under changed, and name under assumed any it could not decide.
- R11: When the project has `spec/roles/<role>.local.md` (install.LocalRoleFile) with any non-blank text, `spec next` adds that text, trimmed, as the last part of the role prompt, after a blank line and after any paragraph R6 or R10 adds, with its `spec` commands given the CLI path as R2 says; this applies also when the prompt itself is the shipped one R8 falls back to. The local file is never changed, and one that exists but cannot be read is an error naming it.
- R12: This version's spec-writer prompt has the spec-writer state what it can derive by hand (an order, a membership, a count) as a property, not as a pinned value that non-trivial logic computes; when a scenario does pin such a value, it works the value out from the scenario's Givens, by running the project's current build on them when it can, and names under assumed any value it could not work out. `spec next` adds nothing of this to an older project prompt, which only `spec init --update-roles` replaces.
- R13: This version's spec-review prompt has the spec reviewer recompute, from its Givens, each value that a scenario in the delta pins and that non-trivial logic computes, and compare it with the pinned value; a value that does not match is a reason for verdict changes, with a finding that cites the scenario and carries a class (R10), and a value it could not recompute goes in a "Follow-up:" finding. A value derivable by hand, and a property, need no recomputation. `spec next` adds nothing of this to an older project prompt.
- R14: This version's prompt for every stage role holds, among the rules shared by all roles, the sentence of S18, so a stage changes files only through the edit tools whose checks spec runs (INS-016/R16). `spec next` adds nothing of this to an older project prompt, which only `spec init --update-roles` replaces.
- R16: The Working folder block names the report file of R4 as the file the subagent saves its final report to, and says the main session records the stage. The task holds no advance command and never mentions `ticket advance`: only the main session records a stage, and its advance checks the report again (PIP-018), so a stage's own `check-report` records nothing.
- R17: This version's prompt for every stage role has the stage save its final report to the report file the task names, run `spec check-report <role> <ticket>` on it until it prints "report ok", and then end with the report block, so a report problem is fixed inside the stage and the main session's advance reuses the stage's test run on the same tree (PIP-008/R12). Saving the named report file, and only that file, is allowed for every role, including the reviewer and the spec review, which otherwise change no file: it lies outside the worktree (R4), so it is not a project-file change and R2's "work only inside the worktree" does not cover it. `spec next` adds nothing of this to an older project prompt, which only `spec init --update-roles` replaces.

## Out of scope
- Which stage runs next: PIP-001
- Harness model selection: format
