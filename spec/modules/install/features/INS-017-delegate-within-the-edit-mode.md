---
id: INS-017
title: Delegate within the project's edit mode
module: install
status: active
writes: [install.PluginPackage]
invariants: [INV-008]
---
## Intent
Background Claude Code subagents cannot answer a permission prompt, so in any mode but `acceptEdits` they cannot edit their ticket worktree and a background wave ends in blocked reports. The setup and ticket-driving skills read the mode `spec detect` reports, ask about it only when it is not already accepted, and otherwise run stages in the foreground, where Claude Code passes each prompt to the person.

## Behaviour
### S1: Setup skips the edit-mode question when edits are already accepted
Given a Claude Code project whose cli.Detection.editMode is "acceptEdits"
When the setup skill describes edit permissions in its first phase
Then it does not ask about `acceptEdits` and does not run `spec init` with `--accept-edits` (R1)
And it still states whether hooks guard the base branch, as INS-014/S31 and INS-014/S32 describe
And when cli.Detection.editMode is any other value, it asks before setting `acceptEdits`, as INS-014/S31 describes (R1)

### S2: Driving warns before backgrounding subagents that cannot edit
Given the shared Driving a ticket fragment and the run command template
When the repository is built
Then install.PluginPackage.skills has run, feature, change and bug skills that, on Claude Code, run `.spec/bin/spec detect --format json` before their first delegation and read cli.Detection.editMode (R2)
And when it is not "acceptEdits", they warn the person that background subagents cannot edit ticket worktrees in that mode, offer `.spec/bin/spec init . --name <config name> --accept-edits`, and delegate every stage of that run in the foreground, one at a time, without `run_in_background` (R2)
And they run that init only after the person agrees, and never write `permissions.defaultMode` any other way (INV-008)
And when it is "acceptEdits", or the harness is Astro, they delegate parallel work in the background without the warning (R2)

### S3: A foreground wave keeps its other stages waiting their turn
Given `spec next --summary` on Claude Code listed TASK-101 and TASK-103 and cli.Detection.editMode is "default"
When the run skill delegates TASK-101 in the foreground with the stage request "spec:TASK-101" (INS-020/S15)
Then TASK-103's stage is not started until its own request "spec:TASK-103" follows, after TASK-101's call returns (R2, R3)
And when the project CLI refuses the before-agent event, so the run starts both with `--start` and relays them, TASK-103's stage stays running and is delegated next with its started entry, without `next TASK-103` and without `--restart` (R2, R3)
And when the person accepts `--accept-edits` during the run, the rest of that run still delegates in the foreground (R3)

## Rules
- R1: When cli.Detection.editMode is "acceptEdits", setup skips its edit-mode question; for any other value it asks as INS-014 R14 describes.
- R2: On Claude Code, the shared ticket-driving instructions read `editMode` from `spec detect --format json` before the first delegation. Only "acceptEdits" lets them run subagents in the background; any other value makes them warn the person, offer `spec init . --name <config name> --accept-edits`, and run every stage of that run in the foreground, one at a time. Astro delegation is unaffected.
- R3: In a foreground run that sends stage requests, each ticket's stage starts only with its own request, one at a time; in one that relays, stages started by `spec next --start` and waiting for a foreground delegate stay running and are delegated from their started entries. A mode the person accepts during a run applies from the next run.

## Out of scope
- Which mode Claude Code actually applies: Claude Code
- Writing the mode: INS-003
