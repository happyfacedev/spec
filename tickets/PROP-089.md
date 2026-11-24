---
id: PROP-089
type: proposal
title: spec ticket close retires a started ticket that another one made redundant
status: done
stage: null
touches: [TKT-012]
violates: []
depends_on: []
changed: [CLI-001/S1, INS-015/R4, INS-015/R6, INS-015/S9, INS-015/S11, INV-012, PIP-002, PIP-008, TKT-002/R1, TKT-002/S13, TKT-005, TKT-006, TKT-012, TKT-012/R9, TKT-012/R10, TKT-012/R11, TKT-012/R12, TKT-012/R13, TKT-012/R14, TKT-012/S11, TKT-012/S12, TKT-012/S13, TKT-012/S14, WSP-004, WSP-004/R1, WSP-004/S8, tickets.CloseRefused, tickets.CloseResult, tickets.CloseResult.absorbedInto, tickets.CloseResult.branch, tickets.CloseResult.cleanup, tickets.CloseResult.stashes, tickets.CloseResult.ticket, tickets.CloseResult.tip, tickets.CloseResult.unmerged, tickets.CloseResult.worktree, tickets.CommitRefused, tickets.KeptStash, tickets.KeptStash.commit, tickets.KeptStash.name, tickets.KeptStash.ref, tickets.NotOnBaseBranch, tickets.Ticket, tickets.Ticket.absorbed_into, tickets.TicketClose, tickets.TicketClose.supersededBy, tickets.TicketClose.ticket, tickets.TicketStatus]
questions: []
history:
  - at: 2026-11-01T04:20:54.654Z
    role: spec-writer
    result: done
    summary: spec ticket close retires an open or blocked ticket as absorbed, keeps history, names what it removes
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-012/S11, TKT-012/S12, TKT-012/S14, TKT-001/S27, TKT-007/S9, TKT-010/S12, PIP-002/S26, WSP-004/S1, WSP-004/S2, TKT-002/S13, CLI-001/S1]
        reason: The closed ticket reuses the absorbed state, so gate (TKT-012/R4), queue (TKT-010/R6), plan (TKT-011/R1) and lint (TKT-001/R12) treat it as they treat a combined ticket. S11 checks the gate and queue, and S12 checks lint. The live copy is read as WSP-004/R1 says (S11 reads it from the worktree, S12 from the branch). The start lock is PIP-002/R7's own (S14). TKT-002/R1 and CLI-001/S1's usage text changed with it. GRF, INS-002/3/4/10, PIP-001/004/008 and WSP-007/009 do not read or write anything close changes.
      - item: C2
        outcome: scenarios
        ids: [TKT-012/S12]
        reason: "Older ticket shape with no stage or history key: only the status line and absorbed_into change, no keys are added, and lint passes. A branch with no worktree, and a ticket with neither, are covered. Paths are printed as the worktree list has them. The pinned CLI that commits is the same one whose hooks and verify-history check the commit, so no version mix arises. Platforms do not apply because this is git only."
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S14]
        reason: Close holds the ticket's start lock (PIP-002/R7) until it has committed, so a start racing it is refused either way. Another spec-owned commit in progress gives tickets.CommitRefused, and nothing is removed.
      - item: C4
        outcome: invariant
        ids: [INV-012]
        reason: "Only someone on the base checkout can close a ticket. It refuses a running stage and uncommitted worktree work. It names each removed branch tip and stash with the command that brings it back, so unmerged branch commits are never lost silently. The Spec-Ticket trailer is not trusted alone: verify-history accepts a close commit only if every touched ticket file becomes absorbed into the cited ticket there, was not absorbed at its parent, and the cited ticket exists and is not absorbed."
      - item: C5
        outcome: scenarios
        ids: [TKT-012/S13]
        reason: "Unknown ticket (exit 2), missing --superseded-by (usage error), superseder absorbed, self, running, done or absorbed ticket, ticket with tickets absorbed into it, uncommitted worktree changes, and not on base: each is refused and nothing changes."
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S1, TKT-012/S3, TKT-012/S4, TKT-012/S10, TKT-002/S13, INS-015/S11]
        reason: The combine rules R1-R8 and their scenarios are unchanged. The combine history check keeps its rule, and the close commit gets its own clause beside it.
      - item: C8
        outcome: scenarios
        ids: [TKT-012/S11]
        reason: "Checked in a scratch repo with git: after git worktree remove --force, git branch -D and git stash drop, git branch <name> <short tip> brings the branch back and git stash apply <short hash> brings the dropped stash back, new files included, until gc prunes them."
    assumed:
      - new: May the superseding ticket be in any status?
        value: Any status but absorbed; done is the usual case (PROP-063)
      - new: Which ticket does the close commit's trailer cite?
        value: "The superseding one, Spec-Ticket: <SUPERSEDING>, under the combine marker bound to tickets/<ID>.md only, as combine cites INTO"
      - new: Does close need --force to delete a branch with commits not on base?
        value: "No: it deletes it and prints the tip and the git branch command that restores it"
      - new: What if the ticket's worktree has uncommitted work outside the tickets folder?
        value: Refuse with tickets.CloseRefused; a person commits or discards it first
    duration_s: 504
  - at: 2026-11-01T05:17:53.655Z
    role: spec-review
    result: done
    summary: Close needs stronger authorization, loss protection, and terminal-state handling
    verdict: changes
    findings:
      - cites: [TKT-012/S11, TKT-012/R12, INV-012, INS-003/S9]
        text: R12 deletes unmerged branch commits and blocked work on an ordinary close, with no informed opt-in before deletion. The CLI is already agent-allowlisted; being on base is not a person's approval. Recovery hashes printed afterward are only temporary, unreferenced objects subject to pruning. Require explicit authorization for discarding unmerged work, or retain durable recovery refs; add coverage distinguishing this from deleting an already-merged branch. The C4 checklist's INV-012 does not cover this boundary.
        class: C4
      - cites: [INS-015/R6, INS-015/S11, TKT-012/R9, TKT-012/R10, INV-012]
        text: The new close history clause accepts a forged single-parent commit that changes a running ticket to absorbed into any existing non-absorbed ticket and cites that superseder. It checks neither the permitted source transition nor retained history, and requires no person-approved exception. Thus a worker can bypass close's running-stage refusal and erase history while verify-history reports clean. Define and test the authorization/content boundary for this new exemption, including rejection of forged live-ticket absorption; a final absorbed status and trailer alone are insufficient.
        class: C4
      - cites: [TKT-012/R9, TKT-012/R10, TKT-012/R12, PIP-008/S15, INV-012]
        text: R9 exempts the entire tickets folder from the dirty-worktree refusal, but R10 preserves only the ticket being closed. Another ticket's uncommitted answer or edit can remain there after a stage (PIP-008/S15); removing this worktree destroys that edit, which neither the branch tip nor the blocked stash contains. Specify refusal or preservation of other uncommitted ticket files and cover it before allowing worktree removal.
        class: C4
      - cites: [TKT-012/R12, TKT-012/R13, TKT-012/S14, WSP-004/R1, TKT-012/R4]
        text: A failed worktree removal or branch deletion leaves the old open/blocked live copy authoritative under WSP-004/R1, despite R12 saying the ticket stays closed. The same stale-copy window exists if the start lock is released at the commit before cleanup, and restoring the printed branch tip also revives that live copy. Specify how absorbed remains authoritative across cleanup failures and recovery, and cover a start between commit and cleanup; S14 currently checks only lock contention and the fully cleaned result.
        class: C3
      - cites: [TKT-012/S11, TKT-012/R12, tickets.CloseResult.stashes, INV-012]
        text: The JSON close result returns dropped stashes only by name, unlike text output's hashes and recovery commands. Once dropped, the name no longer identifies a stash that git stash apply can recover. Include each removed stash's recoverable object ID in JSON and cover recovery from that output; INV-012's recovery promise must also hold for agent/script callers using --format json.
        class: C4
      - cites: [TKT-012/R10, TKT-012/R11, TKT-012/R12, TKT-012/S12, TKT-004/S2, TKT-003/R1]
        text: Close has no defined outcome for the supported command store, a files store outside the repository, or a non-Git project. R10 assumes a base-branch file, R11 defines a commit only for repository files, and R12 permits cleanup only after that commit. The C2 checklist's older-shape scenario does not settle these layouts. State and cover either their save/cleanup behavior or an explicit refusal before any ticket or Git state changes.
        class: C2
    assumed: []
    duration_s: 255
  - at: 2026-11-01T05:26:40.323Z
    role: spec-writer
    result: done
    summary: spec ticket close marks a ticket absorbed on base and deletes nothing; verify-history checks the exact transition
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-012/S11, TKT-012/S12, TKT-012/S14, WSP-004/S8, WSP-004/S1, WSP-004/S2, TKT-001/S27, TKT-007/S9, TKT-010/S12, PIP-002/S26, TKT-002/S13, CLI-001/S1, WSP-002/S4]
        reason: WSP-004/R1 now reads a ticket whose base-tip copy is absorbed from base. Every other ticket reads as before (WSP-004/S1, S2 unchanged), and S8 covers the closed one from the main tree, its own worktree and an older worktree. Gate, queue, plan and lint treat it as a combined ticket (TKT-012/R4, TKT-010/R6, TKT-001/R12). The start lock is PIP-002/R7's own. Close removes nothing, so WSP-002 (worktree remove refuses uncommitted work) is the person's later step, unchanged. GRF, INS-002/3/4/10, PIP-001/004/008 and WSP-007/009 do not read or write anything close changes.
      - item: C2
        outcome: scenarios
        ids: [TKT-012/S12, TKT-012/S13]
        reason: "Older shape with no stage or history key: only the status line changes and absorbed_into is added (S12). The command store, a files store outside the repository and a project in no git repository are all refused before anything is read or changed (S13, R14). A worktree branched from main before the close still reads the ticket absorbed (WSP-004/S8). The hooks, marker and verify-history come from the same pinned CLI that commits."
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S14, WSP-004/S8]
        reason: The close holds the start lock from its checks to its commit. A start already holding the lock refuses the close. A start after the commit reads the base absorbed copy and is refused. Since nothing is cleaned up afterwards, there is no window between commit and cleanup. Another spec-owned commit in progress gives CommitRefused, and the ticket still reads blocked.
      - item: C4
        outcome: invariant
        ids: [INV-012]
        reason: "Close deletes nothing: worktree, branch, commits, history and stash stay, and only a person running the printed commands removes them, so no destructive authorization is needed. The trailer alone is not trusted: verify-history accepts a close commit only if each touched ticket's base copy was open or blocked with stage null at the parent and differs only by status becoming absorbed and an added absorbed_into naming the cited, existing, non-absorbed ticket. Any lost history record, other byte, or in_progress, done or absorbed source makes it an offender (INS-015/R6, INS-015/S11). A stage running on a branch is not visible in base content. INV-012 states that a forged close of such a ticket touches only the base copy, keeps branch, commits and history, and is undone by a revert."
      - item: C5
        outcome: scenarios
        ids: [TKT-012/S13]
        reason: Unknown ticket (exit 2), missing --superseded-by (usage), a running, done or absorbed ticket, self, an absorbed superseder, a ticket others are absorbed into, not on base, and unsupported stores are all refused with nothing changed.
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S1, TKT-012/S3, TKT-012/S4, TKT-012/S10, TKT-002/S13, INS-015/S11, WSP-004/S1, WSP-004/S5]
        reason: Combine R1-R8 and their scenarios are unchanged, and the combine history clause is unchanged. A ticket that is not absorbed on base reads and writes exactly as before under WSP-004.
      - item: C8
        outcome: scenarios
        ids: [TKT-012/S11]
        reason: "The git facts the printed commands rely on were checked with git in a scratch repo in round 1: git branch -D deletes a branch with unmerged commits, git stash drop takes a stash@{n} ref, and git worktree remove refuses a tree with uncommitted changes (also stated in WSP-002/S4). Nothing is removed by the close itself."
    assumed:
      - new: May the superseding ticket be in any status?
        value: Any status but absorbed; done is the usual case (PROP-063)
      - new: Which ticket does the close commit's trailer cite?
        value: "The superseding one, Spec-Ticket: <SUPERSEDING>, under the combine marker bound to tickets/<ID>.md only"
      - new: Where do the closed ticket's history and questions stay?
        value: On its branch and worktree, untouched; the base copy changes only status and absorbed_into, so verify-history can check the change exactly
      - new: How is the absorbed state kept authoritative while the branch and worktree still hold an older copy?
        value: "WSP-004/R1: a ticket whose base-tip copy is absorbed is read from base in every tree"
      - new: Does close support the command store, a files store outside the repository, or a project with no git?
        value: "No: it refuses them up front with tickets.CloseRefused"
    duration_s: 523
  - at: 2026-11-01T06:12:37.270Z
    role: spec-review
    result: done
    summary: Exact-transition close needs a safe outcome for an already-edited base ticket
    verdict: changes
    findings:
      - cites: [TKT-012/R9, TKT-012/R10, TKT-012/R11, TKT-012/S13, INS-015/R6, TKT-006/S1]
        text: The new exact-transition check compares with the committed parent, but close has no refusal or safe handling for pre-existing staged or unstaged edits to its target ticket on base. Answering a question on a ticket with no branch can leave exactly such an edit. R10 preserves those bytes and R11 commits that file, so an otherwise permitted close also commits the answer or body edit and then fails verify-history's two-key-only rule. Define and cover this case while preserving the person's edits; refusing a dirty target before writing is the smallest safe fix. Unrelated staged files should remain supported.
        class: C5
      - cites: [TKT-012/R12, TKT-012/S11, tickets.KeptStash.ref, tickets.KeptStash.commit]
        text: "Follow-up: The printed git stash drop stash@{n} command uses a positional reference. If another ticket stashes work before the person runs cleanup, that reference can identify a different stash. Add guidance to revalidate the printed commit hash against the current stash reference before dropping it. Close itself keeps all work, so this is manual-cleanup hardening rather than a blocker to the non-destructive design."
        class: C3
    assumed: []
    duration_s: 121
  - at: 2026-11-01T06:13:57.707Z
    role: spec-writer
    result: done
    summary: close refuses a target ticket file with uncommitted edits; kept-stash cleanup checks the stash commit before dropping
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-012/S11, TKT-012/S12, TKT-012/S14, WSP-004/S8, WSP-004/S1, WSP-004/S2, TKT-001/S27, TKT-007/S9, TKT-010/S12, PIP-002/S26, TKT-002/S13, CLI-001/S1, WSP-002/S4]
        reason: WSP-004/R1 reads a ticket whose base-tip copy is absorbed from base. Every other ticket reads as before. Gate, queue, plan and lint treat a closed ticket as a combined one. The start lock is PIP-002/R7's own. Close removes nothing, so WSP-002 is the person's later step, unchanged. The other neighbours do not read or write anything close changes.
      - item: C2
        outcome: scenarios
        ids: [TKT-012/S12, TKT-012/S13]
        reason: "Older shape with no stage or history key: only the status line changes and absorbed_into is added. The command store, a files store outside the repository and a project with no git are refused before anything changes (R14). A worktree branched before the close still reads the ticket absorbed (WSP-004/S8)."
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S14, TKT-012/S11, WSP-004/S8]
        reason: "The start lock is held from the checks to the commit, and a later start reads absorbed and is refused. Another spec-owned commit in progress gives CommitRefused. A stash list that shifts after the close is guarded: the printed cleanup says to drop stash@{n} only while git rev-parse --short stash@{n} still prints the kept stash's commit (R12, S11)."
      - item: C4
        outcome: invariant
        ids: [INV-012]
        reason: Close deletes nothing, and its commit changes only status and absorbed_into of an open or blocked base copy, which verify-history checks from the commit's content, not its trailer (INS-015/R6). The target file's own uncommitted edits are refused, never committed, so the commit stays within that two-key rule (R9).
      - item: C5
        outcome: scenarios
        ids: [TKT-012/S13]
        reason: "Refused with nothing changed: unknown ticket, missing option, running, done or absorbed ticket, self, absorbed superseder, a ticket others are absorbed into, not on base, unsupported stores, and a target ticket file with any uncommitted change, staged or not. That edit is left as it was, and the message names the file and says to commit it through spec ticket answer or a ticket. An unrelated staged file still lets the close run and stays out of its commit."
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S1, TKT-012/S3, TKT-012/S4, TKT-012/S10, TKT-002/S13, INS-015/S11, WSP-004/S1, WSP-004/S5]
        reason: Combine and its history clause are unchanged, and tickets that are not absorbed on base read and write as before.
      - item: C8
        outcome: scenarios
        ids: [TKT-012/S11]
        reason: "Checked with git in a scratch repo in round 1: git branch -D deletes a branch with unmerged commits, and git stash drop takes a stash@{n} ref. git rev-parse --short on a stash ref prints its abbreviated commit, standard git behaviour also used for the stash hashes the CLI already prints. git worktree remove refusing uncommitted work is WSP-002/S4."
    assumed:
      - new: May the superseding ticket be in any status?
        value: Any status but absorbed; done is the usual case (PROP-063)
      - new: Which ticket does the close commit's trailer cite?
        value: "The superseding one, Spec-Ticket: <SUPERSEDING>, under the combine marker bound to tickets/<ID>.md only"
      - new: Where do the closed ticket's history and questions stay?
        value: On its branch and worktree, untouched; the base copy changes only status and absorbed_into
      - new: How is the absorbed state kept authoritative while older copies exist?
        value: "WSP-004/R1: a ticket whose base-tip copy is absorbed is read from base in every tree"
      - new: Does close support the command store, a files store outside the repository, or a project with no git?
        value: "No: it refuses them up front with tickets.CloseRefused"
    duration_s: 78
  - at: 2026-11-01T06:15:00.808Z
    role: spec-review
    result: done
    summary: Both review fixes are covered; the non-destructive close is ready for tests
    verdict: approve
    findings:
      - cites: [TKT-012/S13, TKT-006/R1, WSP-004/R2]
        text: "Follow-up: S13's dirty-target diagnostic suggests committing through spec ticket answer, but an answer made on base with no ticket branch stays uncommitted. Point this message to a valid authorized commit workflow; repeating answer can leave the same close refusal. The refusal itself safely preserves the edit."
        class: C9
    assumed: []
    duration_s: 61
  - at: 2026-11-01T06:34:17.349Z
    role: tester
    result: done
    summary: Tests for spec ticket close (TKT-012 S11-S14, INS-015 S9/S11, WSP-004/S8, TKT-002/S13, CLI-001/S1); they fail until close exists
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: the usage text lacks the ticket close line or the --superseded-by option line
      - scenario: TKT-012/S11
        wrong: close removes the worktree, branch or stash, or prints no cleanup line for one of them
      - scenario: TKT-012/S11
        wrong: close prints a stash drop command without the git rev-parse --short guard, or a wrong unmerged and stage count
      - scenario: TKT-012/S11
        wrong: close commits under the closed ticket's trailer instead of Spec-Ticket of the superseding ticket, or commits more than tickets/PROP-073.md
      - scenario: TKT-012/S11
        wrong: a tree whose worktree copy says blocked still reads the ticket blocked after the close, or reads it open again once the branch is deleted
      - scenario: TKT-012/S11
        wrong: the JSON result leaves out the stashes, the tip, the unmerged count or the cleanup commands
      - scenario: TKT-012/S12
        wrong: close rewrites an older-shape file by adding stage or history keys, or reformats its status comment
      - scenario: TKT-012/S12
        wrong: a ticket with no branch, worktree or stash still prints a kept line or a non-empty cleanup
      - scenario: TKT-012/S12
        wrong: a branch already on main is told to be discarded with git branch -D
      - scenario: TKT-012/S13
        wrong: close takes a ticket with a stage running in its own worktree because only the base copy is checked
      - scenario: TKT-012/S13
        wrong: close takes a done or absorbed ticket, a ticket others are absorbed into, itself or an absorbed ticket as superseder
      - scenario: TKT-012/S13
        wrong: close commits a target file that has an uncommitted edit, staged or not, or drops the edit
      - scenario: TKT-012/S13
        wrong: close commits an unrelated staged file along with the ticket, or refuses because one is staged
      - scenario: TKT-012/S13
        wrong: close runs in a ticket's worktree, with the command store, a store outside the repository or no git, instead of refusing
      - scenario: TKT-012/S13
        wrong: close stops at the first problem instead of printing every problem
      - scenario: TKT-012/S14
        wrong: close ignores a start that holds the ticket's start lock
      - scenario: TKT-012/S14
        wrong: close releases the start lock before it commits, so a start runs on the ticket meanwhile
      - scenario: TKT-012/S14
        wrong: close leaves the file changed when another spec commit is in progress, instead of failing with CommitRefused
      - scenario: TKT-002/S13
        wrong: close rewrites the status line without its comment, or touches the superseding ticket's file or another key
      - scenario: INS-015/S9
        wrong: close commits without the combine marker bound to the one ticket file, or its commit holds other staged tickets
      - scenario: INS-015/S9
        wrong: close leaves the one-time marker unused, or a second trailer on the commit
      - scenario: INS-015/S11
        wrong: verify-history lists a genuine close commit of an open or blocked ticket as an offender
      - scenario: INS-015/S11
        wrong: verify-history accepts a close commit whose ticket was running, done or absorbed at its parent, stays blocked, or changes another byte
      - scenario: INS-015/S11
        wrong: verify-history accepts a close whose superseding ticket is missing, absorbed or not the one absorbed_into names, or one that also touches a non-ticket path
      - scenario: WSP-004/S8
        wrong: a tree whose own copy of the closed ticket is old or blocked reads that copy instead of the absorbed copy at the tip of main
    assumed:
      - new: Does a live copy running a stage in the ticket's own worktree get the same refusal line as one on base?
        value: "Yes: the S13 line 'PROP-213 has its tester stage running: only open or blocked tickets are closed' (R9 reads the live copy)"
      - new: Which strings are tickets.CloseResult.cleanup?
        value: "The commands of the text lines: spec worktree remove PROP-073, git branch -D ticket/PROP-073, git stash drop stash@{0}"
      - new: Does a start that waits on the close's lock fail with a given stderr?
        value: Only that it exits non-zero and leaves the ticket absorbed and its worktree file as it was; the stderr is not checked
    duration_s: 1154
  - at: 2026-11-01T06:46:23.092Z
    role: implementer
    result: blocked
    summary: spec ticket close is built; one test (TKT-012/S11) compares main's moving HEAD in worktree list, so it cannot pass
    verdict: null
    blockers:
      - text: the test for TKT-012/S11 compares keptState(fx, tree) before and after the close, and keptState.trees is the whole `git worktree list --porcelain`, which includes main's own `HEAD <sha>`; the close commit moves main's HEAD, so the check cannot pass for any correct close (R11 requires the commit). It must leave out main's HEAD line and compare only the kept worktree. With that one line filtered out in a scratch copy, the whole S11 test passed.
        cites: [TKT-012/S11]
        tests: true
    assumed:
      - new: What does close print when the base copy of the ticket is not open or blocked with stage null, though its live copy is?
        value: "<ID> is <status> on <base>: only open or blocked tickets are closed (or '... has its <stage> stage running on <base>: ...'); printed only when the live copy gave no problem and the file has no uncommitted change"
      - new: How does a start that waited on the close's lock behave?
        value: startTicket re-reads the ticket after taking the lock and refuses when it is absorbed, so the stale gate cannot start a stage
      - new: How many recorded stages does the kept-branch line count?
        value: The length of the live copy's history, read under the lock before the commit
    duration_s: 724
  - at: 2026-11-01T06:57:26.386Z
    role: tester
    result: done
    summary: TKT-012/S11 compares only the kept worktree's own entry, not main's HEAD line; full suite passes
    verdict: null
    mutations:
      - scenario: TKT-012/S11
        wrong: close removes or moves the kept worktree, so its entry (path, HEAD or branch) is gone or different
    passed: true
    assumed: []
    duration_s: 652
  - at: 2026-11-01T07:03:06.960Z
    role: reviewer
    result: done
    summary: Close history verification exempts the whole status line, allowing retained history to be erased
    verdict: changes
    findings:
      - cites: [INS-015/R6, INS-015/S11, INV-012, TKT-012/R10]
        text: "src/cli/enforcement.ts:1084-1090 exempts the entire first status: line instead of only its scalar value. In valid flow-style frontmatter, a line can contain status: open, stage: null, history: [record], together. Changing it to status: absorbed, stage: null, history: [], and adding absorbed_into: TASK-900 as the final mapping entry passes the actual verifyHistory function with no offenders, despite deleting a history record; both blobs parse without errors. Even ordinary block YAML can change or remove the status comment undetected. Validate the exact scalar edit and frontmatter insertion while preserving all other bytes, including comments and other keys on that line. Add forged flow-map history-deletion and status-comment fixtures to INS-015/S11; its current rejection cases do not cover this bypass."
        tests: true
        class: C4
    assumed: []
    duration_s: 338
  - at: 2026-11-01T07:15:30.113Z
    role: tester
    result: done
    summary: "INS-015/S11 forged-close fixtures: a flow-style status line that deletes a history record, and a changed or removed status comment"
    verdict: null
    mutations:
      - scenario: INS-015/S11
        wrong: verify-history exempts the whole status line, so a flow-style line holding stage and history can lose a history record in a close commit
      - scenario: INS-015/S11
        wrong: verify-history exempts the whole status line, so a close commit can change or remove the status line's comment
      - scenario: INS-015/S11
        wrong: verify-history rejects a genuine close that keeps the status comment
    assumed: []
    duration_s: 741
  - at: 2026-11-01T07:26:55.000Z
    role: implementer
    result: done
    summary: verify-history accepts a close only if the child equals the parent but for the status scalar and one absorbed_into line, other keys deep-equal
    verdict: null
    assumed: []
    duration_s: 683
  - at: 2026-11-01T07:29:31.737Z
    role: reviewer
    result: done
    summary: C4 bypass fixed; exact scalar and parsed-key checks reject the forged transitions
    verdict: approve
    findings:
      - cites: [INS-015/S11, TKT-012/R11]
        text: 'Follow-up: src/cli/enforcement.ts:1094-1098 rejects quote normalization performed by src/core/ticket-edit.ts:29-33. For a hand-authored status: "open" (or single-quoted) parent, patchTicketText produces status: absorbed without quotes, and verifyHistory rejects that command-generated close despite the comment and other keys staying unchanged. This unusual-quoting compatibility edge is not a remaining C4 bypass; align writer/verifier quote handling and add a regression in a separate ticket.'
        class: C6
    assumed: []
    duration_s: 154
---
Measured on this repo (SELF-HOSTING P49). PROP-073 (bring CLI-001/S1's usage text up to date) is blocked on a question, and PROP-063 did the same work and merged. `spec ticket combine` folds only never-started open tickets with no worktree, so nothing can retire PROP-073: it stays under 'Needs a person' in `spec plan` forever. Change: `spec ticket close <ID> --superseded-by <ID>` takes a ticket that is open or blocked, but not one with a stage running. It records it as absorbed into the other ticket with its history kept, removes its worktree and branch, and drops its blocked stash, saying what it removed. It commits under the ticket-filing marker the hooks accept.
