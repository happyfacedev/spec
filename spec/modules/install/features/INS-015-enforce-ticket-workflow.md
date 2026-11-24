---
id: INS-015
title: Enforce the ticket workflow across edits and commits
module: install
status: active
---
## Intent
Once spec is set up, editing governed files on the base branch, committing them, and later verifying base history all require a ticket or a recorded emergency bypass. Ticket worktrees stay confined to their own root.

## Behaviour
### S1: A governed edit on the base branch is refused
Given the checkout is on the configured base branch and enforcement is enabled
And the target is matched by codeGlobs, testGlobs or protectedGlobs, or is under the spec root, the tickets directory or ".spec/bin/"
When the before-edit hook receives an Edit, Write, MultiEdit or NotebookEdit payload for that file
Then it returns permissionDecision "deny"
And its reason names /spec:feature, /spec:change, /spec:bug and `spec bypass`
And the guard covers codeGlobs, testGlobs, protectedGlobs, the spec root, the tickets directory and the pinned CLI in ".spec/bin/" (R1)
And a non-governed file is allowed silently

### S2: A ticket worktree cannot edit another checkout
Given the session cwd is inside a ticket worktree
When the before-edit hook targets a file inside that worktree
Then the edit is allowed
And when it targets a file outside that worktree, the edit is denied

### S3: Git hooks use the common git directory and preserve existing hooks
Given a repository is initialized or upgraded
When spec installs its Git hooks
Then pre-commit and commit-msg are installed in the common git directory's hooks folder
And an existing spec-managed hook that serves this same project path is updated, as INS-018/R1 says
And an existing non-spec hook is kept and the one line to add is reported

### S4: Only a ticket or bypass commit can change governed base-branch files
Given a base-branch commit stages governed files
When pre-commit runs without a fresh staged-set token or an active bypass with its ADR staged
Then it refuses the commit
And commits on a ticket branch are allowed
And a `spec merge` commit uses a one-time merge-purpose token, carries `Spec-Ticket: <ID>`, and is allowed

### S5: History verification checks first-parent commits after its baseline
Given `spec verify-history` runs on the configured base branch
When a first-parent commit after `--since` or enforceSince touches governed files
Then it passes when the commit has `Spec-Ticket: <ID>`
And it also passes when it has `Spec-Bypass: ADR-NNN` for a decision in this spec, or is a role-prompt update commit with `Spec-Roles: <version>` as INS-005/R5 says
And otherwise it lists the offender and exits 1
And `--format json` returns the same offenders as JSON

### S6: A bypass is recorded, short-lived and consumed by a commit
Given a person runs `spec bypass "<reason>"`
When the bypass opens
Then spec writes the next free ADR under decisions with title "Bypass: <reason>", the date and git user.name
And before-edit and pre-commit allow its one commit
And commit-msg adds `Spec-Bypass: ADR-NNN` and consumes the bypass
And `spec bypass --status` and `--cancel` inspect and cancel it
And it expires after one commit or one hour
And it is inactive at its exact `expiresAt` timestamp (R2)

### S7: Enforcement layers can be disabled independently
Given config.json omits `enforce`
When the CLI reads it
Then edit, commit and history enforcement are enabled
And a project may set any of `enforce.edits`, `enforce.commits` or `enforce.history` to false (R3)

### S8: Setup documents the workflow and establishes a history baseline
Given `spec init` or `spec upgrade` runs in a repository
When it updates setup files
Then it adds the same marked workflow rules to CLAUDE.md and AGENTS.md, creating either file when absent
And a second run updates the block without duplicating it
And init or upgrade initializes a missing enforceSince to the current HEAD
And it tells the person to open a bypass before committing governed setup files; an agent may proceed only after the person approves it in-session

### S9: Spec-originated base commits use a one-time project marker
Given a spec command must commit governed files on the base branch
When it writes a one-time spec-owned marker under the common Git directory and commits immediately
Then pre-commit accepts only a fresh marker younger than 60 seconds whose purpose matches the staged paths
And pre-commit consumes the marker
And ticket filing commits carry `Spec-Ticket: <ID>` and touch only `tickets/<ID>.md`, and a `spec ticket combine` commit carries `Spec-Ticket: <INTO>` and its marker matches exactly the named tickets' files, and a `spec ticket close <ID> --superseded-by <SUPERSEDING>` commit carries `Spec-Ticket: <SUPERSEDING>` and its combine marker matches exactly `tickets/<ID>.md`, and a `spec init --update-roles --yes` commit carries `Spec-Roles: <version>`, its marker matches exactly the role prompts it wrote, and pre-commit also requires each staged one's sha256 to be listed for its role under <version> in the pinned CLI's shipped-prompt manifest (R4, R6)
And the marker is not a security boundary; CI history verification and review are the enforcement
And no environment variable can grant an equivalent exemption (R4)

### S10: An open bypass permits setup edits on the base branch
Given the person opens a bypass from the base branch
When the ADR is written and the bypass state is active
Then before-edit allows governed setup edits on the base branch until the one commit is consumed or the hour expires
And the bypass ADR already exists when the edit is allowed (R5)

### S11: History accepts only ticket-backed commits
Given `spec verify-history` examines a governed first-parent commit
When it has `Spec-Ticket: <ID>`
Then the ticket file exists in that commit and is either the only touched path, the ticket a combine commit folds others into, or belongs to a two-parent merge / its afterMerge child with ticket status done
And an unknown or unrelated ticket trailer is an offender, as is a `Spec-Roles: <version>` commit that touches anything but stage-role prompts whose sha256 the running CLI's shipped-prompt manifest lists for that role under <version>, such as a `<role>.local.md`, an edited `reviewer.md` or a version the manifest does not know (R6)
But a `Spec-Ticket: PROP-201` commit that also touches a non-ticket path, a ticket not absorbed into "PROP-201" in that commit, or one already absorbed before it, is an offender and exits 1, and a `Spec-Ticket: PROP-063` commit that touches only "tickets/PROP-073.md" is accepted when "PROP-073" was open or blocked with stage null at its parent and only its status became "absorbed" and "absorbed_into: PROP-063" was added, with "PROP-063" in that commit and not absorbed, a quoted `status: "open"` becoming `status: "absorbed"` with its quotes kept; it is an offender when "PROP-073" was in_progress, done or absorbed at its parent, stays blocked, or loses or gains any other byte, such as a history record or the quote marks of its status, or "PROP-063" is missing or absorbed (R6)

### S12: History accepts only a new, single-use bypass ADR
Given a governed first-parent commit has `Spec-Bypass: ADR-NNN`
When its decision file is added in that same commit with front matter `kind: bypass`
Then it is accepted only if no earlier first-parent commit cited that ADR
And a pre-existing, non-bypass, missing or reused ADR is an offender (R7)

### S13: Agent bypasses require a person's approval
Given a bypass is requested in an agent context
When `enforce.bypass` is not `person`
Then it is refused unless `--approved-by-person` is supplied
And the ADR records the agent harness, the approval-in-session statement and Git user
And `enforce.bypass: person` refuses every agent-context request
And a terminal request without agent signals records the Git user and says no agent environment was detected (R8)

### S14: Bypass state is scoped to one governed base-branch commit
Given a bypass is active on the base branch
When a ticket-worktree commit or a base commit without governed paths runs commit-msg
Then neither commit receives `Spec-Bypass` and the bypass remains active
And a governed base commit is allowed only when its bypass ADR is staged with it
And bypass cannot be opened from a ticket worktree (R9)

### S15: Git hooks respect a project hooksPath
Given `core.hooksPath` points inside the work tree, such as `.husky`
When init or upgrade installs enforcement hooks
Then it leaves that directory and its hooks untouched
And reports the exact CLI integration line for each hook file (R10)

### S16: Installed hooks resolve the pinned CLI from the project subdirectory
Given the project is nested in a monorepo
When a Git hook runs from the checkout root
Then it resolves the pinned CLI relative to the project path recorded at installation
And if that CLI is missing it warns and exits successfully without blocking the commit (R11)

### S17: History verification uses an explicit or discoverable base
Given `spec verify-history` runs in a full or shallow checkout
When `--base <ref>` is supplied or the configured base is unavailable
Then it checks that ref, otherwise `origin/<base>`, otherwise `HEAD`
And in a shallow repository it fails with an instruction to fetch full history using `fetch-depth: 0` (R12)

### S18: A ticket completion merge validates every governed side commit
Given a governed two-parent base merge cites `Spec-Ticket: <ID>`
When history verifies its second-parent side history
Then the merge ticket exactly matches the second parent's done copy and was not done at the first parent
And every governed side commit independently validates and carries the same `Spec-Ticket: <ID>`
And a missing, different, invalid or reused ticket trailer makes the merge an offender (R13)

### S19: A non-spec merge into base is guarded before merge commit
Given `spec init` or `spec upgrade` installs Git hooks
When a merge into the base branch stages governed paths without an authorized token or a staged bypass ADR
Then `pre-merge-commit` refuses it using the same rules as `pre-commit` (R14)

### S20: The edit guard reads Claude Code and Astro tool paths
Given a before-edit hook receives a Claude Code or Astro tool payload
When the tool is `Edit`, `Write`, `mcp__astro__edit` or `mcp__astro__write`
Then it checks `tool_input.file_path` or `astro_tool_input.file_path` and applies the same governed edit rules (R15)

### S21: Base detection follows the target checkout
Given an edit targets a governed file in a Git checkout
When the hook determines whether that checkout is the base branch
Then it queries the repository and branch containing the target file, not only the session cwd
And a detached HEAD exactly at the base tip is treated as base (R16)

### S22: A newer plugin keeps old pinned hooks silent and asks for upgrade
Given the plugin invokes a project pinned CLI that predates an enforcement hook
When that pinned CLI refuses an unknown Claude Code hook event
Then the plugin exits successfully and emits nothing for that event, except that a before-agent spec stage request is refused as INS-020/S20 says
And session-start says edit/commit/history enforcement needs `spec upgrade` (R17)

### S23: An edit-check failure denies governed paths only
Given the before-edit check errors for a candidate path
When that path is governed
Then it returns a deny with `spec could not check this edit: <error>; fix spec or ask the person for a bypass`
And an error while checking a non-governed path does not deny it (R18)

### S24: Bypass decisions reserve IDs used on ticket branches
Given a bypass is opened on the base branch
When local `ticket/*` refs contain decision IDs not present on base
Then the next free ADR number skips every ID found in those branch trees
And opening a bypass in the ticket worktree is refused (R19)

### S25: Init and upgrade preserve config formatting while setting enforceSince
Given a valid config.json has no `enforceSince`
When init or upgrade records the current HEAD as the history baseline
Then it inserts only the missing property and preserves all existing JSON text and formatting (R20)

### S26: A history ticket authorizes only its own one-time completion merge
Given a ticket is not done at the first parent of a governed two-parent base merge
When that merge carries the ticket's done state from its second parent and cites its ID
Then history accepts the merge only if its side commits cite that same ticket ID
And history rejects a ticket already done at the first parent or reused by another base merge
And history rejects a side commit that cites another ticket ID
And history accepts an afterMerge child only when it cites the same ticket and every changed path is generated by spec or `generatedGlobs`
And history rejects an afterMerge child that changes source or ticket paths (R6)
And a failed first-parent path diff returns a history error instead of a clean result
And a failed second-parent history walk returns a history error instead of a clean result

### S27: New governed paths are checked from their nearest existing ancestor
Given a governed target path may contain directories that do not exist yet
When before-edit checks that target on the base branch
Then it finds the repository from the nearest existing directory and denies the edit
And a Git check failure for a governed target is denied as a check error, not allowed (R16)

### S29: Ticket filing preserves unrelated staged changes
Given an unrelated path is already staged on the base branch
When `spec ticket new` commits its ticket using a pathspec
Then its marker matches the temporary index path set seen by the hook
And the ticket commit contains only `tickets/<ID>.md`
And the unrelated path remains staged for a later commit (R4)

### S30: An external core.hooksPath is never modified
Given `core.hooksPath` resolves outside the common Git directory's `hooks` folder
When init or upgrade installs enforcement hooks
Then it leaves every file in that hooksPath untouched
And it reports the exact CLI integration line for pre-commit, pre-merge-commit and commit-msg (R10)

### S31: Missing Git hook integration is visible in session-start and CI
Given the Git hooks are absent or their `core.hooksPath` files lack the reported spec integration lines
When the main session runs session-start or CI runs `spec lint --ci`
Then session-start adds one missing-hooks line and lint reports one L033 warning naming them
And neither warning appears when all three hooks are installed or integrated (R10)

### S32: Cancelling a bypass removes its uncommitted ADR
Given `spec bypass` created an ADR that has not been committed
When the person runs `spec bypass --cancel`
Then it removes the active state and uncommitted ADR (including a staged index entry) but preserves the ADR if it is already in HEAD (R2)

### S33: Spec-init asks for a bypass before authoring on the enforced base
Given spec-init is about to write initial spec files on an enforced base checkout
When no ticket worktree can hold the initial spec
Then it asks the person whether to open a bypass before writing any files
And it explains one-hour/one-commit expiry and asks the person to reopen if either ends the window before authoring is complete (R8)

## Rules
- R1: Governed paths are codeGlobs, testGlobs, protectedGlobs, the spec root, the tickets directory and the pinned CLI folder `.spec/bin/` under the project.
- R2: Bypass state lives in the common Git directory and expires after the next governed commit-msg hook or one hour; `--cancel` removes its uncommitted ADR and staged entry but never an ADR in HEAD.
- R3: Enforcement is enabled unless its corresponding config.enforce value is false.
- R4: A spec-owned base commit marker is bound to the exact path set visible in the hook's index (the pathspec subset for `git commit -- <pathspec>`): a ticket-filing marker to exactly `tickets/<ID>.md`, a combine marker to exactly the files of the tickets `spec ticket combine` named or of the one ticket `spec ticket close` retires, and a role-update marker to exactly the role prompts `spec init --update-roles --yes` wrote, each listed in the pinned CLI's shipped-prompt manifest (INS-005/R5); it is not a security boundary, and CI history verification plus review are the enforcement.
- R5: An active bypass permits base-branch edits; opening it writes the bypass ADR before marking the bypass active.
- R6: A ticket trailer is valid for a ticket-only update; a single-parent combine commit that touches only ticket files, the cited ticket's among them, where every other ticket it touches is absorbed into the cited ticket in that commit and was not absorbed at its parent; a single-parent close commit that touches only ticket files, not the cited ticket's, where each ticket it touches was open or blocked with stage null at its parent and differs from it only in its status, now "absorbed", and an added absorbed_into naming the cited ticket, which is in that commit and not absorbed; a two-parent merge that carries the unchanged done ticket from parent two while it is not-done at parent one and is its only base merge, or that merge's same-ticket afterMerge child touching only generated paths. A `Spec-Roles: <version>` trailer is valid only on a single-parent commit where every touched path is a stage-role prompt `<spec root>/roles/<role>.md` whose sha256 the running CLI's shipped-prompt manifest lists for that role under <version>; the commit's files are read as data and nothing from it or its history is run; an unknown version, a `.local.md`, a removed file or any other content makes it an offender (INS-005/R5).
- R7: A bypass trailer is evidence only for a bypass ADR added by that commit and only once on first-parent history.
- R8: Agents need `--approved-by-person` to open a bypass, unless forbidden by policy; ADRs record approval/identity, terminals record no agent environment, and spec-init asks for a person-approved bypass before base-checkout authoring, reopening it after one hour or commit consumption.
- R9: Bypass is a base-branch exception: it is not opened in or consumed by ticket worktrees, and the named ADR is part of the governed commit it authorizes.
- R10: Hook installation writes only to `<git-common>/hooks`; any other hooksPath is untouched and gets three integration lines, while session-start and lint --ci warn until all hooks are installed or integrated.
- R11: A Git hook locates the CLI from the project path relative to the active worktree root; a missing CLI is a warning, not a commit failure.
- R12: History verification targets an explicit base when given; otherwise it resolves the configured base, its origin-tracking ref, then HEAD, and requires non-shallow history.
- R13: A ticket-backed two-parent completion merge carries the ticket's exact second-parent contents, changes its status from not-done to done, and every governed side commit carries that same ticket trailer. Ticket branches use `spec merge`, not squash, rebase or fast-forward.
- R14: `pre-merge-commit` and `pre-commit` apply the same base-branch staged-path authorization rule.
- R15: The before-edit adapter normalizes Claude Code and Astro tool names and file-path payloads before asking the shared guard.
- R16: Base-branch edit enforcement uses the target's nearest existing directory; Git check failure denies governed edits, and detached HEAD equals base only at the configured base tip.
- R17: A newer plugin suppresses unknown hook-event failures from the pinned CLI and uses session-start to tell the person to upgrade enforcement support.
- R18: Errors in edit enforcement fail closed only when the candidate path is governed; the deny asks the person for a bypass instead of authorizing one automatically.
- R19: Bypass ADR numbers are unique across the base checkout and committed trees of every local `ticket/*` branch; bypass cannot be opened from those worktrees.
- R20: `enforceSince` initialization is a textual insertion/replacement in config.json, never a JSON reserialization.

## Out of scope
- Parsing shell commands for writes: INS-016 refuses plain shell writes to files tracked in a ticket worktree; for every other path the Git hooks are the commit guard.
- Ticket contents and their queue groups: tickets
