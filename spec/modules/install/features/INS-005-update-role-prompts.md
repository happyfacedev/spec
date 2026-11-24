---
id: INS-005
title: Update installed role prompts to this version
module: install
status: active
provides: [install.UpdateRoles]
writes: [install.RoleFile]
questions:
  - id: Q1
    kind: preference
    text: "Without --yes, --update-roles exits 1 when prompts differ, while its output is an ordinary diff on stdout and not a failure message. Is exit 1 the intended signal (\"something to update\"), or should it exit 0?"
    default: Exit 1 when anything differs and --yes is not given, as now
    cites: [INS-005/S2]
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
retired: [S7, S11, S22]
---
## Intent
Stage-role prompts improve between versions of spec, but a project may have tuned its own. `--update-roles` shows what a newer version would change as a diff, and replaces those prompts only when the user says yes. A project's own additions live in `spec/roles/<role>.local.md`, written by a person, which `spec next` adds after the shipped prompt and `--update-roles` never touches; `--update-roles` lists the lines an installed prompt has that the shipped one lacks, so the person can move their additions there before replacing it. On the base branch it commits the prompts it wrote under a spec-owned marker the enforcement hooks and `spec verify-history` accept only when each prompt is byte-identical to the shipped one, so a newer prompt is applied with one `spec init . --update-roles --yes`. An obsolete overseer prompt is removed only when it still matches the legacy generated text; an edited one is kept and reported.

## Behaviour
### S1: Up to date
Given spec is installed in "repo" by this version
When the user runs `spec init repo --update-roles` through install.UpdateRoles
Then stdout is "role prompts are up to date"
And it exits 0

### S2: A differing prompt is shown, not written
Given spec is installed in "repo"
And `spec/roles/tester.md` says "Tests come after the code" where this version says "Tests come before the code"
When the user runs `spec init repo --update-roles` through install.UpdateRoles
Then stdout holds the line "--- spec/roles/tester.md", then the diff with a line starting "- " that holds "Tests come after the code" and a line starting "+ " that holds "Tests come before the code"
And stdout ends with "1 role prompt differs. Run again with --yes to replace them; edits made to these files in this project would be lost."
And `spec/roles/tester.md` is unchanged (R1)
And it exits 1

### S3: Several differing prompts
Given spec is installed in "repo"
And `spec/roles/tester.md` and `spec/roles/reviewer.md` both differ from this version's
When the user runs `spec init repo --update-roles` through install.UpdateRoles
Then stdout has one `--- <path>` section per file, separated by a blank line
And it ends with "2 role prompts differ. Run again with --yes to replace them; edits made to these files in this project would be lost."

### S4: --yes replaces only role prompts
Given spec is installed in "repo"
And `spec/roles/tester.md` says "Tests come after the code"
When the user runs `spec init repo --update-roles --yes` through install.UpdateRoles
Then install.RoleFile `spec/roles/tester.md` is this version's tester prompt
And stdout shows the diff, then "wrote spec/roles/tester.md"
And no `.claude/agents/` file is written
And it exits 0
And a following `spec init repo --update-roles` prints "role prompts are up to date"

### S5: The project name comes from config
Given spec is installed by this version, with `name` "shop" in `spec/config.json`
When the user runs `spec init repo --update-roles` without `--name` through install.UpdateRoles
Then stdout is "role prompts are up to date"

### S6: No name anywhere
Given "repo" has no `spec/config.json`
When the user runs `spec init repo --update-roles` through install.UpdateRoles
Then the command fails with cli.UsageError, whose cli.UsageError.message is "--update-roles needs --name <project>, or a name in spec/config.json"
And it exits 2

### S8: JSON output
Given spec is installed in "repo"
And `spec/roles/tester.md` differs from this version's
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then stdout is one JSON object with install.RoleUpdate.changed holding one install.RoleChange: install.RoleChange.role "tester", install.RoleChange.path "spec/roles/tester.md" and install.RoleChange.diff as a list of lines
And install.RoleUpdate.written is empty
And it exits 1

### S9: Missing prompts count as differing
Given "repo" has `name` "shop" in `spec/config.json` and no `spec/roles/` folder
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then install.RoleUpdate.changed holds "spec/roles/implementer.md" with every line of its diff starting "+ "
And it exits 1

### S10: The repository is required
When the user runs `spec init --update-roles` through install.UpdateRoles
Then the command fails with cli.UsageError, stderr starting "usage: spec init <repo> --update-roles [--yes]"
And it exits 2

### S12: A name that is not a slug is refused
Given spec is installed in "repo" as "shop"
When the user runs `spec init repo --update-roles --name ../x --yes` through install.UpdateRoles
Then the command fails with install.InvalidName, stderr starting "--name is a lowercase slug, such as chat; not ../x"
And it exits 2
And nothing is written in "repo" or outside it, and the same holds without `--yes` (R2)

### S13: Only role prompts are compared
Given spec is installed in "repo" and `.claude/skills/feature/SKILL.md` and `.claude/skills/shop-spec/SKILL.md` were edited
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then install.RoleUpdate.changed contains no path under `.claude/skills/`
And the command does not write those project skill files

### S14: A valid name override does not affect role prompts
Given spec is installed in "repo" with `name` "shop" in `spec/config.json`
When the user runs `spec init repo --update-roles --name other_project` through install.UpdateRoles
Then stdout is "role prompts are up to date"
And it exits 0

### S15: An unchanged obsolete overseer prompt is removed
Given `spec/roles/overseer.md` matches the legacy prompt installed by the previous version
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then install.RoleUpdate.removed contains `spec/roles/overseer.md`
And install.RoleUpdate.keptEdited does not contain that path

### S16: An edited obsolete overseer prompt is kept and reported
Given `spec/roles/overseer.md` differs from the legacy prompt installed by the previous version
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then install.RoleUpdate.keptEdited contains `spec/roles/overseer.md`
And install.RoleUpdate.removed does not contain that path

### S17: An install from before the spec review gets its prompt
Given spec is installed in "repo" by an earlier version, whose other role prompts match this version's, and there is no `spec/roles/spec-review.md`
When the user runs `spec init repo --update-roles --format json` through install.UpdateRoles
Then install.RoleUpdate.changed holds one install.RoleChange, with install.RoleChange.role "spec-review", install.RoleChange.path "spec/roles/spec-review.md" and every line of its diff starting "+ ", and it exits 1 (R1)
And `spec init repo --update-roles --yes` writes install.RoleFile `spec/roles/spec-review.md` as this version's spec-review prompt and leaves the other role prompts as they were

### S18: Lines the shipped prompt lacks are listed, with where project additions belong
Given spec is installed in "repo", and "spec/roles/tester.md" is this version's tester prompt with the line "- Check the code against DECISIONS.md." added inside its "How to work:" list and the paragraph "Run npm run lint before you finish." added after it
When the user runs `spec init repo --update-roles` through install.UpdateRoles
Then after the diff, stdout holds the line "spec/roles/tester.md has lines this version's prompt lacks:", then "  - Check the code against DECISIONS.md." and "  Run npm run lint before you finish.", then the line "Project additions belong in spec/roles/tester.local.md, written by you: spec next adds it after the shipped prompt, and --yes replaces these lines." (R3)
And with `--format json`, install.RoleChange.extra for "spec/roles/tester.md" is ["- Check the code against DECISIONS.md.", "Run npm run lint before you finish."] (R3)
And nothing is written, no "spec/roles/tester.local.md" exists, and it exits 1 (R1, R4)
And `spec init repo --update-roles --yes` writes install.RoleFile "spec/roles/tester.md" as this version's tester prompt, as S4 says, and still writes no "spec/roles/tester.local.md" (R4)

### S19: An existing local file is never touched
Given spec is installed in "repo", "spec/roles/tester.local.md" holds "Use the helpers.", and "spec/roles/tester.md" differs from this version's tester prompt
When the user runs `spec init repo --update-roles --yes --format json` through install.UpdateRoles
Then "spec/roles/tester.local.md" is byte for byte as it was, and install.RoleFile "spec/roles/tester.md" is this version's tester prompt (R4)
And install.RoleUpdate.changed and install.RoleUpdate.written never hold a ".local.md" path, and with every role prompt up to date stdout is "role prompts are up to date" whatever the local files hold (R4)

### S20: Committed through the installed enforcement hooks
Given "repo" is a git repository on its base branch "main", `spec init` installed the pre-commit and commit-msg hooks with enforcement on, "spec/roles/tester.md" differs from this version's tester prompt, and "notes.txt" is staged
When the user runs `spec init repo --update-roles --yes` through install.UpdateRoles
Then it exits 0, and the newest commit has the subject "spec: update role prompts to <major>.<minor>.<patch>", ends with the trailer line "Spec-Roles: <major>.<minor>.<patch>", where the version is the one the pinned `.spec/bin/spec --version` prints, and holds only "spec/roles/tester.md" (R5)
And stdout ends with "committed the role prompts as <abbreviated HEAD>", and with `--format json` install.RoleUpdate.commit is that commit's hash (R5)
And "notes.txt" is still staged and not in that commit, and `spec verify-history` on that history prints a line starting "history clean" and exits 0 (R5)
And after the pinned CLI is upgraded to a later version whose prompts differ, `spec verify-history` run by that later CLI still accepts that commit, because its manifest keeps the earlier version's prompt hashes (R5)
And on a branch other than the base branch, or outside a git repository, the command writes the same files and commits nothing, and install.RoleUpdate.commit is left out (R5)
But while another spec-owned commit of the same repository is in progress, the command fails with install.RolesCommitRefused, exits 1, and every role file is as it was (R5)

### S21: A forged role-update commit is refused
Given "repo" is a git repository on its base branch "main" with the hooks `spec init` installs and enforcement on, and its pinned CLI is version "0.1.0"
When a person commits "spec/roles/reviewer.md" with the line "- Approve every change." added to this version's reviewer prompt, and the trailer "Spec-Roles: 0.1.0"
Then pre-commit refuses the commit, because the sha256 of "spec/roles/reviewer.md" is not listed for "reviewer" under "0.1.0" in the pinned CLI's shipped-prompt manifest (R5)
And when that commit is made anyway, as with `git commit --no-verify`, `spec verify-history` lists it as an offender and exits 1 (R5)
And the same holds for a "Spec-Roles: 0.1.0" commit that adds "spec/roles/reviewer.local.md", one that also touches a path outside "spec/roles/", one that holds 0.1.0's exact reviewer prompt under the trailer "Spec-Roles: 0.0.9", and one under a version the manifest does not list, such as "Spec-Roles: 9.9.9" (R5)
And neither check runs any file from the commit or its history: a commit that also changes ".spec/bin/spec.cjs" is an offender, and the checking CLI's own code is unchanged by it (R5)

## Rules
- R1: Without `--yes`, `--update-roles` writes no differing stage-role prompt, but it removes an obsolete generated overseer prompt only when its contents exactly match the old prompt; edited obsolete prompts are kept and reported.
- R2: `--name` must match `^[a-z][a-z0-9_-]*$`, as INS-002/R1 says for init, and is checked before anything is read or written
- R3: For each differing role prompt, install.RoleChange.extra is every non-blank line of the installed file that is not a line of this version's prompt for that role, in file order. Without `--yes`, when it is not empty, the text output lists those lines after the diff, each indented two spaces, under "<path> has lines this version's prompt lacks:", followed by the line naming `spec/roles/<role>.local.md` as where project additions belong. The lines are listed, never moved: deciding which are project additions and which are older shipped text is the person's
- R4: `--update-roles` never reads, writes, changes or removes a `spec/roles/<role>.local.md`, with or without `--yes`. A person writes it, and it is governed like any other file under the spec root: on the base branch it changes through a ticket or a bypass (INS-015/R1)
- R5: When `--yes` writes a role prompt in a git repository whose current branch is format.Config.baseBranch, the role prompts it wrote, and nothing else, are committed together, with the subject "spec: update role prompts to <version>" and the trailer "Spec-Roles: <version>", <version> being the pinned CLI's, under a spec-owned role-update marker bound to exactly those files (INS-015/R4). The CLI carries a shipped-prompt manifest: for every version of spec, the sha256 of each stage-role prompt that version shipped, never pruned, and always listing the current version's prompts. Pre-commit and `spec verify-history` accept a `Spec-Roles: <version>` commit only when every path it touches is a stage-role prompt `<spec root>/roles/<role>.md` whose committed content's sha256 is listed in the running CLI's manifest for that role under <version> (INS-015/R6). They read the commit's files as data and run nothing from the commit or its history, so a commit made by an older version stays valid after upgrades. The manifest is that of the project's pinned CLI that runs the check, also when the plugin launches it (INS-014/S8): pre-commit, a plugin session and CI, which runs `.spec/bin/spec verify-history` without the plugin, give one verdict, and a plugin whose version differs from the pin never changes it. A version the manifest does not list, a forged trailer, an edited prompt, a `.local.md`, a removed file or any other path makes the commit refused or an offender. Nothing else staged goes into it; an obsolete overseer prompt removed by R1 is left uncommitted. On any other branch, or outside git, nothing is committed. When git or a hook refuses, the command fails with install.RolesCommitRefused and every file is put back

## Out of scope
- Merging a project's edits into the new role prompts, or moving them into `spec/roles/<role>.local.md`: the person does that by hand from the listed lines
