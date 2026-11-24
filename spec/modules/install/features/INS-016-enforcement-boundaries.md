---
id: INS-016
title: Harden ticket history and Git context enforcement
module: install
status: active
invariants: [INV-010, INV-011, INV-014]
---
## Intent
History verification validates the provenance of ticket completion and imported pull history, while edit enforcement distinguishes an absent Git checkout from a broken worktree and correctly accounts for project repositories before their first commit. A path is governed by its place in the tree, not by where a symlink points, and the pinned CLI is governed like the code it checks. A shell command that plainly writes a file tracked in a ticket worktree is refused, so a stage changes files through the edit tools that spec's checks see. That check fails open: a pinned CLI that errors on a shell command never blocks it.

## Behaviour
### S1: Ticket completion is carried by its branch
Given a governed two-parent base merge cites `Spec-Ticket: <ID>`
When history verifies the merge
Then the merge ticket file exactly matches the second parent's done ticket and was not done at the first parent
And every governed side commit independently validates and carries the same `Spec-Ticket: <ID>`
And a missing, different or invalid side trailer, a merge-edited ticket file or a reused ticket makes the merge an offender (R1)

### S2: A trailerless pull merge validates incoming governed history
Given `git pull` creates a two-parent base merge without a ticket or bypass trailer
When history verifies the incoming side history
Then it accepts ticket-file-only commits, valid ticket completion merges with same-ticket side commits, and valid one-use bypass commits
And it rejects missing, unknown, mismatched or reused ticket/bypass evidence and any incoming governed commit without valid evidence
And with hooks installed, pre-merge-commit validates only the incoming `HEAD..MERGE_HEAD` range and allows a trailerless pull only when this same incoming history validates
And an unrelated older first-parent offender does not prevent a clean incoming pull, while `spec verify-history` continues to report that offender (R11)
And `git pull --rebase` is unsupported because it rewrites completion-merge evidence (R2, R6)

### S3: Edit enforcement distinguishes no Git from failed checks
Given a before-edit hook checks a governed file
When there is no Git repository or the repository is bare
Then it allows the edit because there is no editable base and session-start emits no hook-health warning
When a Git worktree exists but a Git check fails
Then it denies the edit with the check error
And a detached HEAD at the configured base tip is denied while one away from that tip is allowed
And a Git toplevel unrelated to this project is treated as no Git and allows the edit (R3, R7)
And `CI=1` does not disable `spec verify-history`

### S4: Upgrade warns when afterMerge lacks generated globs
Given `spec/config.json` sets `afterMerge` and has empty `generatedGlobs`
When `spec upgrade` runs
Then it warns that history authorizes only afterMerge commits touching generated paths
And it is quiet when `afterMerge` is absent or `generatedGlobs` is non-empty (R4)

### S5: Merge commits add no ungenerated governed content
Given a governed two-parent pull or ticket merge
When history compares the merge result with a clean merge of its parents
Then each changed non-generated governed path must equal the clean merge result
And extra files and hand-resolved conflicts are offenders with a bypass instruction
And differences in generated paths are allowed
And a valid one-use bypass ADR added in the merge commit authorizes otherwise non-clean governed content (R5)
And on older Git, an incoming-only path must match parent two while a path changed by both parents needs a bypass (R5)
And a failed merge-tree check returns a history error rather than a clean result

### S6: Bash writes are checked at commit, not edit time
Given Claude Code is in `acceptEdits` permission mode and a filesystem Bash command writes a governed path on the base branch
When the before-edit hook does not see that shell write
Then with Git hooks installed, pre-commit refuses a commit containing the staged governed change
And merge hooks and `spec verify-history` remain the guard if a commit hook is bypassed (R8)
And the before-edit hook, given that Bash command with the base checkout as its cwd, emits nothing and the command runs (R8)

### S7: Renames retain governed path evidence
Given a governed source path is renamed to a path outside all governed globs
When a ticket merge or trailerless pull merge imports that rename
Then history treats the old governed path as changed, even when Git would report a rename
And the merge is not accepted merely because its destination is not governed
And the installed merge hook and history verifier make the same governed-path decision (R9)
And reviewer diffs expose the old governed source removal instead of only the non-governed destination (R9)

### S8: An initialized project is its own repository before its first commit
Given Git metadata exists at the project root or identifies the project by its project marker, installed spec hook/bypass state, a resolvable `enforceSince`, or a working-tree `spec/config.json` within a repository that already tracks files under this project path
When a governed edit is checked on the configured base branch before any commit, or after `spec init` but before its setup commit
Then the edit is denied unless a bypass is active
And an unrelated parent repository that tracks no files under a copied project's path is treated as no Git and allows the edit (R10)
And a configured `enforceSince` that cannot resolve is not evidence that the repository belongs to this project (R10)

### S9: A ticket run through the pipeline and merged with spec merge leaves history clean
Given a repository on "main" at the commit "<start>", once with spec's git hooks installed and once without, and an open task "TASK-103"
And "TASK-103" runs through `spec ticket start` and `spec ticket advance`: a done implementer stage that adds "src/fallback.ts", then a blocked reviewer stage
And its question is answered by `spec ticket answer TASK-103 Q1` run on "main" while no worktree has "ticket/TASK-103" checked out
And "main" then gains the ticket-file-only commit of `spec ticket new`, so the next `spec ticket start TASK-103 reviewer` syncs the branch with "main", and that reviewer stage is approved
When `spec merge TASK-103` merges it and `spec verify-history --since <start>` runs
Then each commit of "ticket/TASK-103" that "main" lacked before the merge carries exactly one trailer line "Spec-Ticket: TASK-103": the stage commits "TASK-103 implementer: …" and "TASK-103 reviewer: …", the answer commit "TASK-103: answer Q1", and the sync "TASK-103: sync with main" (R12)
And `spec verify-history` prints "history clean (<n> first-parent commits checked on main)" and exits 0 (R12)
But when one more commit that changes "src/fallback.ts" is made by hand on "ticket/TASK-103" with `git commit --no-verify` and no trailer before the merge, `spec verify-history` lists it with "invalid side commit: side commit must carry exactly Spec-Ticket: TASK-103 and cite the same ticket TASK-103" and exits 1, as it lists every governed side commit that lacks the trailer (R1, R12)

### S10: spec init records the project in the common Git directory
Given a project folder "app" inside a parent repository that has no commits and whose `core.hooksPath` points outside the common Git directory
When `spec init` runs in "app" and the before-edit hook then checks a governed file of "app" on the configured base branch
Then a project marker for "app" exists under "<git-common>/spec/projects/" and no file in that hooksPath was changed
And the edit is denied unless a bypass is active, both before the parent's first commit and before the setup commit (R10)
And `spec upgrade` writes the marker for an initialized project that lacks one, and running init or upgrade again leaves exactly one marker for the project (R10)
And the marker is keyed by the project's path relative to the work-tree root with symlinks resolved, so a copy of the project at another path in the same repository is not identified by it (R10, R13)
And without the marker, the other ownership evidence of R10 still applies, and a marker never allows an edit that its absence would deny (R13)

### S11: The pull hook reads earlier IDs without re-validating history
Given Git hooks are installed and a trailerless `git pull` merge into the base branch is pending
And first-parent history since `enforceSince` holds older commits that `spec verify-history` reports as offenders or cannot validate
When pre-merge-commit checks the pull
Then it validates only the incoming `HEAD..MERGE_HEAD` range and does not re-validate the older first-parent commits (R11)
And every bypass ID an older first-parent commit cites, and every ticket ID an older two-parent first-parent commit cites, counts as used whether or not that commit is valid, so an incoming commit that reuses one is refused (R11)
And an older commit that history cannot validate does not block a clean incoming pull (R11)
But in a shallow repository, or when `enforceSince` does not resolve, it refuses the pull with "could not validate incoming history" (R11)

### S12: A staged symlink is governed by where it sits, and may not point outside the project
Given "repo" is on its base branch "main" with the hooks `spec init` installs and enforcement on, and "/elsewhere/notes.md" is a file outside the project
When a person stages "spec/leak.md" as a symlink to "/elsewhere/notes.md", or "tickets/LINK.md" as a symlink to "../../elsewhere/notes.md", and commits it
Then pre-commit refuses the commit and exits 1, and stderr starts "spec refused this base-branch commit:" and names the symlink's path and that it points outside the project (R14)
And it is refused the same way with an active bypass whose ADR is staged with it, and when `spec merge` brings it from a ticket branch (R14)
And when it is committed anyway, as with `git commit --no-verify`, `spec verify-history` lists that commit as an offender whatever its trailer, and exits 1 (R14, INV-011)
And a symlink "spec/readme-link.md" to "../README.md", inside the project, is refused without a ticket or bypass exactly as a plain file under "spec/" is, and is committed with a bypass (R14)
And a symlink outside the governed paths, such as "notes/link.md" to "/elsewhere/notes.md", is committed as before, and before-edit still denies a Write through a non-governed symlink to "spec/config.json" on the base branch (R14)
And before-edit denies a Write to "spec/leak.md" on the base branch, though the file it resolves to is outside the project (R14)
And a project opened through a symlinked folder, such as "/tmp" on macOS, governs the same paths (R14)

### S13: The pinned CLI changes on the base branch only through a ticket or a bypass
Given "repo" is on its base branch "main" with the hooks `spec init` installs, enforcement on and enforceSince at its setup commit
When a person commits a change to ".spec/bin/spec.cjs" without a ticket or a bypass
Then pre-commit refuses the commit, naming ".spec/bin/spec.cjs" among the staged governed paths, and exits 1 (R15)
And when it is committed anyway, as with `git commit --no-verify`, `spec verify-history` lists that commit as an offender and exits 1, as it does for a commit that removes ".spec/bin/spec.cjs" or one made before this version that changed ".spec/bin/" without a trailer, such as a plain commit of `spec upgrade`'s files (R15)
And `spec verify-history` gives that verdict by reading each commit's ".spec/bin/" as data and running none of it, so a later honest CLI lists the commit even when the CLI it installed would call itself clean (INV-010)
And the same change committed with an active bypass whose ADR is staged with it is accepted by pre-commit and by `spec verify-history` (R15)
And on a ticket branch a commit that changes only ".spec/bin/", such as an implementer's rebuilt bundle, is allowed and commit-msg adds `Spec-Ticket: <ID>`, so the ticket's `spec merge` that carries it is accepted by `spec verify-history` (R15)
And a ticket-filing, combine or `Spec-Roles` commit that also changes ".spec/bin/" is an offender (R15)
And `spec upgrade` that replaces ".spec/bin/" on the base branch commits nothing, and install.UpgradeResult.notes holds "setup wrote governed files; ask the person whether to open a bypass before committing them; an approved agent must use --approved-by-person" (R15)

### S14: A shell command that writes a file tracked in a ticket worktree is refused
Given the project root "<root>" is the base checkout on "main", "PROP-201" has its worktree "<wt>" on "ticket/PROP-201", edit enforcement is on, and "src/app.ts" is tracked in that worktree's Git index
When the before-edit hook receives a Claude Code payload with tool_name "Bash", cwd "<root>", as a delegated stage's commands start in the project root (PIP-017/R2), and a tool_input.command that is any one of "cat > <wt>/src/app.ts <<''EOF''" with its heredoc, "echo x >> <wt>/src/app.ts", "npm test 2> <wt>/src/app.ts", "printf x | tee -a <wt>/src/app.ts", "sed -i '''' ''s/a/b/'' <wt>/src/app.ts", "sed -i.bak -e ''s/a/b/'' <wt>/src/app.ts" or "perl -pi -e ''s/a/b/'' <wt>/src/app.ts"
Then it returns permissionDecision "deny" with the reason "spec refused this shell command: it writes the tracked file src/app.ts; change files with your edit tools (Edit or Write), not the shell" (R16)
And a command of several parts, such as "npm test --prefix <wt> && echo done > <wt>/src/app.ts" or "npm test; FOO=1 sed -i '''' ''s/a/b/'' <wt>/src/app.ts", is refused the same way for the part that writes (R16)
And an Astro payload with astro_tool_name "mcp__astro__bash" and the same command in astro_tool_input.command is refused the same way (R16)
And a payload whose cwd is "<wt>" with the command "echo x > src/app.ts", or "<wt>/src" with "echo x > app.ts", is refused the same way and names "src/app.ts", the path from the worktree root (R16)
And a worktree reached through a symlinked folder, such as "/tmp" on macOS, gives the same verdict (R16)

### S15: Build, test and temporary writes for a ticket worktree still run
Given the project root "<root>" is the base checkout, "PROP-201" has its worktree "<wt>", edit enforcement is on, "src/app.ts" is tracked in "<wt>", "dist/" is ignored and "notes.tmp" is untracked
When the before-edit hook receives a Bash payload with cwd "<root>" whose command writes only an ignored, untracked or outside path, such as "npm run build --prefix <wt> > <wt>/dist/build.log", "npx vitest run --root <wt> 2>&1 | tee <wt>/dist/test.txt", "cat > /tmp/x.txt <<''EOF''", "npm test > /dev/null 2>&1", "sed -i '''' ''s/a/b/'' <wt>/notes.tmp" or "cat <wt>/src/app.ts > <wt>/notes.tmp"
Then it emits nothing and the command runs (R17)
And a command that names "<wt>/src/app.ts" without writing it emits nothing, such as "sed ''s/a/b/'' <wt>/src/app.ts", "grep ''>'' <wt>/src/app.ts", "echo ''x > <wt>/src/app.ts''" or "wc -l < <wt>/src/app.ts" (R16, R17)
And a write whose target it cannot resolve emits nothing: a target holding "$", a backtick, "~" or a glob character, such as "echo x > $FILE", and a relative target after a "cd" or "pushd" in the same command, such as "cd <wt> && echo x > src/app.ts" (R17)
And a write inside a nested shell or interpreter emits nothing, such as "bash -c ''echo x > <wt>/src/app.ts''", or a script such as "node <wt>/scripts/gen.js" that writes "<wt>/src/app.ts" (R17)
And when the check itself fails, as when Git cannot list the worktree's tracked files, or the payload has no command, it emits nothing and the command runs (R17)

### S16: A write outside every ticket worktree, or without edit enforcement, runs as before
Given the project root "<root>" is the base checkout, "PROP-201" has its worktree "<wt>", and "src/app.ts" is tracked in both
When the before-edit hook receives a Bash payload with cwd "<root>" and the command "echo x > src/app.ts", which writes the base checkout's file, or a payload whose cwd lies in no Git repository with the command "echo x > /elsewhere/app.ts"
Then it emits nothing and the command runs, and on the base branch the Git hooks remain the commit guard (R8, R18)
And with `enforce.edits` false, the command "echo x > <wt>/src/app.ts" from cwd "<root>" emits nothing and runs (R18)
And the plugin runs its before-edit hook for the Bash tool as well as for Edit, Write, MultiEdit and NotebookEdit (R18)
And a project whose pinned CLI predates this check emits nothing for a Bash payload, as before (R18, INS-015/R17)
And a refusal stops only that one Bash call: the next Bash call or edit in the session is checked on its own (R16, INV-014)

### S17: A failing pinned CLI does not block a shell command
Given the plugin's launcher delegates a before-edit hook to the project's pinned CLI, which exits 1 with "cannot load workspace" on stderr, as an older pinned CLI can when it errors while loading its workspace
When the hook receives a Claude Code payload with tool_name "Bash" and a command, or an Astro payload with astro_tool_name "mcp__astro__bash" and the same command
Then the launcher emits nothing on stdout and stderr and exits 0, and the command runs (R19)
But when the same pinned CLI fails the same way for a payload with tool_name "Edit", "Write", "MultiEdit" or "NotebookEdit", the launcher exits 1 and prints the pinned CLI's stderr, as before (R19)
And a payload that is not plainly a shell payload keeps the failure, such as one that is not valid JSON, one with no tool name, one with tool_name "Edit" and astro_tool_name "mcp__astro__bash", or one with tool_name "bash" (R19)
And the same failure on a hook event other than before-edit keeps the failure (R19)
And a refusal the pinned CLI gives with exit 0 for a shell payload, as in S14, reaches the caller unchanged (R16, R19)

## Rules
- R1: A ticket completion merge carries the exact done ticket file from its second parent; the first parent is not done, and every governed side commit carries the same valid ticket trailer. Completion IDs are single-use. Missing evidence and casual forgery are detected; a fabricated side branch with forged trailers remains a review risk.
- R2: A trailerless two-parent pull merge is accepted only if all incoming governed commits independently validate as ticket-file-only, valid ticket completion (including same-ticket side commits), or one-use bypass commits. Squash, fast-forward and `git pull --rebase` delivery is unsupported.
- R3: No-Git and bare checkouts have no editable base and permit edits; broken Git checks in a worktree deny governed edits. Detached HEAD compares to the configured base tip, and CI does not disable history verification.
- R4: Upgrade warns when afterMerge is set while generatedGlobs is empty; no warning appears when afterMerge is absent or generatedGlobs is non-empty.
- R5: A two-parent merge may change governed content only to the clean merge-tree result, except generated paths, which may differ. A one-use bypass ADR added in the merge commit authorizes other mismatches. Git before 2.38 falls back to parent-two equality for incoming-only paths and refuses paths changed by both parents.
- R6: With Git enforcement hooks installed, pre-merge-commit permits a trailerless pull merge only when its incoming governed history and merge tree validate by the history rules.
- R7: The repository used to classify an edit must be the project's own repository, not an unrelated parent repository; a parent with no project marker is treated as no Git and allows the edit.
- R8: Before-edit refuses a shell write only when it plainly writes a file tracked in a ticket worktree (R16); a shell write to the base checkout or anywhere else is not checked at edit time, and with Git hooks installed, pre-commit and pre-merge-commit block governed base commits and verify-history catches commits that bypass hooks.
- R9: Every Git diff reader used for governance or code-change evidence disables rename/copy detection, so a rename is a removal of its governed source and an addition of its destination. Pull pre-merge checks, ticket-merge history checks and reviewer diffs include the old source path.
- R10: The project repository is its own when the project root is the Git toplevel, a project marker for this project's path exists under `<git-common>/spec/projects/`, spec-managed hooks or bypass state live in the common Git directory, `enforceSince` resolves to a commit there, or `spec/config.json` exists at the project-relative path while the parent repository already tracks files under that project path. This classification works before the initial commit and between init and the setup commit. A parent repository with no tracked files under a copied project's path is treated as unrelated even if that copy contains a working-tree config; an unresolved `enforceSince` alone does not identify a project. `spec init` and `spec upgrade` write the project marker whenever the project is in a Git repository, whatever `core.hooksPath` is.
- R11: A pre-merge hook validates only the incoming `HEAD..MERGE_HEAD` range. It collects previously used IDs from first-parent history since `enforceSince` without validating those commits: every bypass ID any of them cites and every ticket ID a two-parent one cites is used. An older commit that history cannot validate does not block a clean pull; a shallow repository or an unresolvable `enforceSince` refuses it. `spec verify-history` still reports old offenders, and invalid incoming governed commits remain refused.
- R12: Every commit spec makes on a ticket's branch carries exactly one trailer line "Spec-Ticket: <ID>" for that ticket, whether or not spec's git hooks are installed: each stage's commit, done or blocked (PIP-008/R1), the sync with the base (PIP-002/R6), and each commit the ticket store makes on the branch, such as an answer (WSP-004/R2), as the `spec merge` and afterMerge commits already do. So a ticket run through the pipeline and merged with `spec merge` passes `spec verify-history`. The check treats every side commit that changes a governed path alike, whoever made it: each one without that one trailer is listed; a side commit that changes no governed path is not checked.
- R13: The project marker is ownership evidence only: anyone who can write the common Git directory can create or delete it. A forged marker can only make governed edits denied, and a deleted one falls back to the other R10 evidence, so the marker never authorizes an edit; spec decides from the marker that matches this project's resolved path.
- R14: Pre-commit, pre-merge-commit, commit-msg and history verification classify a path by where it sits in the Git index or commit tree, relative to the project, never by where a symlink at that path points: a symlink entry under a governed path (INS-015/R1) is governed like any file there, and one outside them is not. The verdict comes from the entry's path and Git mode, so it is the same where Git stores symlinks as text files (`core.symlinks` false). Only the project root, the spec root and the tickets directory are resolved through symlinks, so a project reached through a symlinked folder keeps its governed paths. Before-edit treats a target as governed when the path it names or the file it resolves to is governed. A symlink entry under a governed path whose target, read from the tree as text and resolved from the link's own folder through that same tree's entries, is absolute, leaves the project or loops, is refused: pre-commit and pre-merge-commit refuse a base-branch commit that adds or changes one even with a merge token or an active bypass, and history verification lists a first-parent commit that adds or changes one, or a merge that brings one in, as an offender whatever its trailer.
- R15: The pinned CLI under `.spec/bin/` is governed (INS-015/R1) and changes on the base branch only through a ticket (side commits carrying `Spec-Ticket: <ID>`, its `spec merge` and its generated-only afterMerge child, where `.spec/bin/` counts as generated) or a bypass. No spec-owned marker or trailer authorizes it, and a ticket-filing, combine or `Spec-Roles` commit that touches it is invalid (INS-015/R6): `spec upgrade` writes `.spec/bin/` and commits nothing, and on the base branch it adds the setup-wrote-governed-files note (INS-015/S8). History verification reads `.spec/bin/` in each commit as data, runs none of it, and lists any first-parent commit after its baseline that adds, changes or removes a file there without valid ticket or bypass evidence as an offender, commits made before this rule existed included. Pre-commit runs the pinned CLI the working tree holds, which a change to `.spec/bin/` has already replaced, and only warns when it is missing (INS-015/R11); for `.spec/bin/` it is a convenience, and history verification run by a CLI other than the one under review, plus review, is the enforcement (INV-010).
- R16: When edit enforcement is on, before-edit reads the command of a Claude Code `Bash` payload (`tool_input.command`) or an Astro `mcp__astro__bash` payload (`astro_tool_input.command`) and denies it when it plainly writes a file tracked in a ticket worktree: a worktree of the Git repository that holds the payload's cwd with a `ticket/<ID>` branch checked out. The cwd may be the project root, where a delegated stage's commands start and from where they name the worktree by absolute path (PIP-017/R2), a ticket worktree, or a folder inside one. The command is split into simple commands at `;`, `&&`, `||`, `|`, `&` and newlines, with quoted text and heredoc bodies never split or read as operators; the command word is the first word that is not a `NAME=value` assignment. A simple command plainly writes a path when it has an output redirection (`>`, `>>`, `>|`, `&>`, `&>>`, or one of these after a file descriptor number) to that path, its command word is `tee` and the path is one of its other words, its command word is `sed` with an option `-i…` or `--in-place…` (alone or in a short-option cluster) and the path is one of its other words, or its command word is `perl` with an option cluster that holds `i` before any `e`, such as `-i`, `-pi` or `-i.bak`, and the path is one of its other words. A heredoc into a file is a redirection. A target is taken as written when absolute and resolved against the payload's cwd when relative, with symlinks in each worktree root and in the target's folder resolved; it is refused when it then lies inside a ticket worktree and is in that worktree's Git index. A relative target from the project root therefore names the base checkout's file, which this check leaves to the Git hooks (R8). The deny reason is "spec refused this shell command: it writes the tracked file <path>; change files with your edit tools (Edit or Write), not the shell", where <path> is the first such path, relative to the worktree root.
- R17: The check stays conservative: a missed write is preferred over refusing a build or test command. It never refuses a write to an ignored, untracked or outside path (`/dev/null` and temporary folders among them), a file-descriptor duplication such as `2>&1`, an input redirection, or a word that only names a tracked file. A target holding `$`, a backtick, `~`, `*`, `?` or `[`, and a relative target after a `cd` or `pushd` earlier in the same command, are not resolved and not refused. Nested shells (`bash -c`, `sh -c`, `eval`), interpreters and scripts are not looked into. When the payload has no command, or the check cannot run, as when Git cannot list the worktree's tracked files, the command is allowed.
- R18: The plugin runs before-edit for the Bash tool too. A Bash payload that writes no file tracked in a ticket worktree, or any Bash payload with `enforce.edits` false, is allowed as before, and a pinned CLI that predates R16 emits nothing for it, so an older project runs every Bash command as before until `spec upgrade`.
- R19: When the plugin's launcher runs a before-edit hook through the project's pinned CLI and that CLI exits non-zero, the launcher drops the failure (no stdout, no stderr, exit 0) only for a payload plainly of the shell tool: tool_name exactly "Bash", or astro_tool_name exactly "mcp__astro__bash", with no other tool name given. An older pinned CLI that cannot load its workspace therefore cannot block every shell command (INS-015/R17 does the same for an unknown hook event). The shell check fails open, as R17 says of a check that cannot run; an edit's failure is not dropped, because a failed edit check stands (INS-015/R18), and nothing is dropped when the payload cannot be read as a shell payload or the event is another one.

## Out of scope
- Hook installation and bypass lifecycle: INS-015
- Shell writes to files outside every ticket worktree: the Git hooks are the commit guard (R8)
- Writes from nested shells, interpreters and scripts (R17)
