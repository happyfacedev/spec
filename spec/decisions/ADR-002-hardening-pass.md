---
id: ADR-002
title: Make spec's own pipeline run hands-off, by hand, with a scripted end-to-end test
status: accepted
---
## Decision
A second bootstrap change, made by hand on the base branch by the procedure of ADR-001. It closes the gaps that still needed a person in almost every one of the first 16 tickets, and adds a scripted end-to-end test that runs tickets through every stage with no model, so a pipeline regression fails `npm test`:

- `spec ticket advance` keeps a blocked stage's work: it stashes the stage's uncommitted changes as "<ID> <role>: blocked", outside the tickets folder and what setup made, and names the stash; no role stashes or reverts anything itself, and `check-report` no longer refuses a blocked stage that leaves changes (PIP-008, PIP-004, LNT-003).
- `spec ticket start` refuses any uncommitted change outside the tickets folder and setup output, whether or not it switches branches, then merges the base branch into a ticket branch that lacks its tip, then gives the stage its own stash back. A sync that conflicts in more than generated files, or a stash that does not apply, blocks the ticket on a question and leaves the tree as it was. One start of a ticket runs at a time, under a lock (PIP-002).
- The finish hook binds a run to the ticket whose stage runs in its tree, never to the ID its report names, and keeps the role's transcript with its report, so the stage's model and cost reach the history (INS-011, PIP-008).
- `spec merge` takes a repository-wide lock, and undoes a refused merge only while the base branch stands where this merge left it. It recompiles the agents and rebuilds a conflicted index, but no longer builds the bundled CLI: that is the project's `afterMerge`, which this repository sets (WSP-006).
- `spec orchestrate` plans again after every wave, plans a ticket held back by a running one again once something merged, and names every asked ticket the waves did not reach (WSP-008).
- Before its spec stage, a proposal's reach in the plan is one ring wider: the contracts its features read or write, and the features that read or write them or a contract it touches (TKT-011).
- `spec ticket new` files tickets on the base branch only, and saves nothing when git refuses the commit (TKT-005).
- After an independent review of this change: taking over a dead process's lock is atomic, under a takeover guard, so two contenders never both hold it (PIP-002, WSP-006). A refused merge moves the base branch back with `git reset --keep`, never `--hard`, so an edit made in the checkout meanwhile survives, and leaves the branch for a person when the move would overwrite one (WSP-006). Every change spec makes to the stash list runs under one repository-wide lock, and an entry is dropped only once its position is checked to hold it (PIP-002, PIP-008). What a worktree's setup made never rides in a stage's commit (PIP-008). A sync refuses a staged change by name rather than through git's message (PIP-002); an unstaged one never reached the sync commit.
- `check-report` refuses a reviewer's approval whose summary or findings name a gap, and the reviewer role says an approval names none (PIP-004).

`tests/e2e/` holds the scripted pipeline: `fake-roles.mjs` plays the overseer and every role from a JSON script, through the same hooks and commands a real run uses, and `pipeline-scripted.test.ts` runs seven cases through `spec orchestrate` in copies of chat-mini, each ending merged.

## Consequences
- The spec shows why these features changed with no ticket in their history.
- No spec-writer, tester or reviewer stage checked this change; the person's review, the project's own checks and the scripted pipeline stand in for them.
- Tickets that started before the change do not have it until they are restarted; once they are, every later stage syncs with the base, so roles, agents, config and the bundle a stage runs with are the base's.
- A proposal that has not had its spec stage waits for more tickets than before: in chat-mini, every pre-spec proposal now runs in its own wave.
- The bundled CLI in `.claude/skills/spec-spec/scripts/` is refreshed by `afterMerge` after every merge, one merge late for a change to merge itself, as I10 described.

## Context
After 16 merged tickets, most still needed one or two steps by a person. Roles had to stash their own work when blocked, which needed a permission (I26) and once stashed the ticket file with it (I27). A stage ran on a base that had moved under it (I6, I10, I24, I25). orchestrate stopped while a ticket held back by another could have started (I20), and left tickets out at the depth limit. A proposal's overlap showed only after its spec stage (I28). Model and cost never reached the history (I30), and a reviewer approved while noting the change did not deliver (I31). An audit found four ways to lose or misattribute work: a merge's undo could erase a concurrent merge, the finish hook trusted the ticket ID in a report, advance could commit unrelated dirt, and a stash that failed to apply was ignored. Each fix so far had been checked only by the next real run, and two of them caused new failures.

## Alternatives
- File each fix as a ticket: rejected, for the reason in ADR-001, and because several fixes change how the stages that would deliver them run.
- Keep the stash rule in the role prompts: rejected, a rule in a prompt needs a permission and a model that follows it; the CLI can do it every time.
- Rebase a ticket branch onto the base instead of merging: rejected, it rewrites commits other trees may hold and loses the stage history's order.
- Take over a dead lock by deleting and recreating it: rejected, two contenders that both saw the dead owner each delete the other's new lock and both hold it.
- Undo a refused merge with `git reset --hard`: rejected, it wipes whatever a person changed in the checkout while the tests ran.
- Test the pipeline only with real model runs: rejected, they are slow, cost money and are not repeatable; the scripted run catches the regressions and the real runs stay the acceptance test.
