---
id: PROP-112
type: proposal
title: A ticket done and merged on the base branch is read from there, whatever a leftover worktree says
status: done
stage: null
touches: [WSP-004]
violates: []
depends_on: []
changed: [WSP-004, WSP-004/R1, WSP-004/R2, WSP-004/S9, WSP-004/S10, WSP-004/S11, WSP-004/S12, WSP-004/S13, WSP-004/S14, WSP-004/S15, WSP-004/S16, WSP-004/S17, WSP-004/S18, workspace.BranchMoved]
questions:
  - id: Q1
    kind: preference
    text: Should spec worktree list mark a worktree whose ticket is done and merged on the base branch, so a person sees it can be removed?
    default: "No: out of scope here; this ticket only changes where the ticket is read from"
    cites: [WSP-004]
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: syncing ticket/PROP-112 with main conflicts in src/cli/worktree.ts; a person must merge
    default: null
    cites: []
    answer: "Merged by hand on the ticket branch (96fb1ab, PROP-112: sync with main): src/cli/worktree.ts keeps TASK-006's snapshot reuse and PROP-112's base-branch reads; the two generated bundles were rebuilt."
    raised_by: reviewer
history:
  - at: 2026-11-10T09:23:47.102Z
    role: spec-writer
    result: done
    summary: "WSP-004: a ticket done and merged on the base branch is read and written at the base tip; S9-S14 added"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-004/S5, WSP-004/S6, WSP-004/S10, WSP-004/S11, TKT-002/S3, TKT-002/S6]
        reason: spec impact reaches only TKT-002 (re-verify), which edits a ticket in one tree with no ticket branch; R1/R2 change only for tickets done and merged on the base branch, so its scenarios stay true unchanged
      - item: C2
        outcome: scenarios
        ids: [WSP-004/S9, WSP-004/S14]
        reason: three trees (main tree, the leftover worktree itself, a worktree made before the done commit); a configured base branch other than main; the upgrade case is the leftover worktree from an older state
      - item: C3
        outcome: scenarios
        ids: [WSP-004/S12, WSP-004/S7]
        reason: a commit onto the base branch for an update uses the same compare-and-swap and fails with workspace.BranchMoved when the branch moved
      - item: C4
        outcome: na
        ids: []
        reason: "no new input crosses a trust boundary: every copy is in the developer's own repository, and the committed base tip, already trusted for absorbed tickets, now decides over an uncommitted leftover file"
      - item: C5
        outcome: scenarios
        ids: [WSP-004/S14]
        reason: a base branch that does not exist holds no ticket, so nothing is read from it
      - item: C6
        outcome: scenarios
        ids: [WSP-004/S1, WSP-004/S3, WSP-004/S13]
        reason: a branch merged into base only because it has no commits of its own (S1, base says open) and a ticket done on an unmerged branch (S13) are read as before
      - item: C8
        outcome: na
        ids: []
        reason: "no new fact about another tool: the git behaviour used (worktrees, merged branches) is already relied on, and today's behaviour was checked by running the current build in a scratch repository"
    documents: [WSP-004/S13, WSP-004/S14]
    assumed:
      - question: PROP-112#Q1
        value: "No: out of scope here; this ticket only changes where the ticket is read from"
      - new: Where is an update (spec ticket answer) to a ticket read from the base tip written?
        value: In the file of the tree that has the base branch checked out, uncommitted; when no tree has it, as a new commit on the base branch with the Spec-Ticket trailer (R2, S10-S12); this also applies to absorbed tickets, which R2 already required to be written where they are read
      - new: Is a done ticket whose ticket/<ID> branch no longer exists read from the base tip?
        value: "No: R1 needs the branch merged into the base branch; without a branch no worktree can hold a stale copy, and it is read as today"
    duration_s: 258
  - at: 2026-11-10T09:26:32.447Z
    role: spec-review
    result: done
    summary: "WSP-004 delta leaves three plausible gaps: unmerged-branch half of R1, read-back of an uncommitted base write, WSP-003 list"
    verdict: changes
    findings:
      - cites: [WSP-004/R1, WSP-004/S9, WSP-004/S13]
        text: "R1 reads from the base tip only when the file there says done AND ticket/<ID> is merged into the base branch, but no scenario pins the second half. S9 has it merged, S13 has the base saying open, S1 has the base saying open: an implementation that reads a ticket from the base tip whenever the base file says done passes all of them. The case is plausible here, since the ticket text says IDs were renumbered, so main can hold a done ticket under an ID whose ticket/<ID> branch is another, unmerged piece of work (or a merged branch that later got new commits, e.g. a reopened stage). That in-flight copy in its worktree must still be read, as today. Needs a scenario: base tip says done, ticket/<ID> not merged into the base branch (commits main lacks), the checked-out worktree says in_progress, and queue/plan/answer read and write the worktree."
        class: C6
      - cites: [WSP-004/R1, WSP-004/R2, WSP-004/S10]
        text: "R1 says a ticket is read from the tip of the base branch, but R2 and S10 write an update to it uncommitted in the file of the tree that has the base branch checked out. A tip read cannot see an uncommitted edit, so after S10 the answer to Q1 is invisible: the question reads as open again, and a second `spec ticket answer PROP-051 Q2 ...` that builds the new file from the tip would drop the first answer. No scenario says what is read after the write, or that a second update keeps the first. Say which copy a tree that has the base branch checked out reads (its file, committed or not, as S4 does for a ticket branch, or the tip), and add a scenario for a read, and for a second update, after S10."
        class: C3
      - cites: [WSP-003/S9, WSP-003/R1, PROP-112#Q1, WSP-004/S9]
        text: WSP-003 (spec worktree list) shows each ticket's live status and already marks a done ticket whose branch is merged (WSP-003/R1). With R1 changed, the leftover worktree of S9 now lists as `PROP-051 done <path> (merged into main; ...)` instead of in_progress, which is what Q1 asks for. Q1's assumed default says no listing change and the C1 checklist does not name WSP-003. Either state this consequence in a WSP-004 or WSP-003 scenario (list in the S9 state), or say list keeps reading the worktree file; as written a tester can read it both ways and the Q1 default contradicts R1.
        class: C1
      - cites: [WSP-004/R1]
        text: "Follow-up: the spec-writer's assumption that a done ticket whose ticket/<ID> branch no longer exists is read as before has no scenario, and R1's \"merged into that branch\" can be read as met when there is no branch (TKT-009/R1 treats \"never had one\" as met). File a scenario: base says done, no ticket/<ID> branch, a stale copy elsewhere."
        class: C5
    assumed: []
    duration_s: 145
  - at: 2026-11-10T09:30:19.417Z
    role: spec-writer
    result: done
    summary: "WSP-004: base-branch tickets read from its checked-out file else tip; S15-S18 pin second update, unmerged, no branch, list"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-004/S5, WSP-004/S6, WSP-004/S10, WSP-004/S11, WSP-004/S18, TKT-002/S3, TKT-002/S6]
        reason: spec impact reaches TKT-002 (re-verify), which edits a ticket in one tree with no ticket branch, so its scenarios stay true; WSP-003 (spec worktree list) reads live status, so the leftover worktree of S9 now lists as done and merged under WSP-003/R1, pinned by S18
      - item: C2
        outcome: scenarios
        ids: [WSP-004/S9, WSP-004/S14, WSP-004/S17]
        reason: three trees (main tree, the leftover worktree itself, a worktree made before the done commit); a configured base branch other than main; the upgrade case is the leftover worktree from an older state, and a stale copy of a ticket with no branch
      - item: C3
        outcome: scenarios
        ids: [WSP-004/S12, WSP-004/S15, WSP-004/S7]
        reason: a second update after an uncommitted write to the base branch's tree keeps the first and both are read back (S15); a commit onto the base branch fails with workspace.BranchMoved when the branch moved (S12)
      - item: C4
        outcome: na
        ids: []
        reason: "no new input crosses a trust boundary: every copy is in the developer's own repository, and the committed base tip, already trusted for absorbed tickets, decides over an uncommitted leftover file"
      - item: C5
        outcome: scenarios
        ids: [WSP-004/S14, WSP-004/S17]
        reason: a base branch that does not exist holds no ticket; a done ticket with no ticket/<ID> branch is not treated as merged and is read as before
      - item: C6
        outcome: scenarios
        ids: [WSP-004/S1, WSP-004/S3, WSP-004/S13, WSP-004/S16, WSP-004/S17]
        reason: base says open with a merged branch (S1), done on an unmerged branch (S13), base says done but the branch has commits main lacks (S16), and no branch at all (S17) are read and written as before
      - item: C8
        outcome: na
        ids: []
        reason: "no new fact about another tool: the git behaviour used (worktrees, merged branches) is already relied on, and today's behaviour was checked by running the current build in a scratch repository"
    documents: [WSP-004/S13, WSP-004/S14, WSP-004/S16, WSP-004/S17]
    assumed:
      - question: PROP-112#Q1
        value: "No: out of scope here; this ticket only changes where the ticket is read from"
      - new: Does spec worktree list change for the leftover worktree of a ticket done and merged on the base branch?
        value: Its command is unchanged; it shows the ticket's live status, which is now done, so WSP-003/R1 already marks the row as merged (S18)
      - new: Which copy is read for a ticket read from the base branch?
        value: The file of the tree that has the base branch checked out, committed or not, else the branch tip; the choice of ticket is made from the tip (R1, S15)
      - new: Where is an update to a ticket read from the base branch written?
        value: In the file of the tree that has the base branch checked out, uncommitted; when no tree has it, as a new commit on the base branch with the Spec-Ticket trailer (R2, S10-S12, S15); this also applies to absorbed tickets
      - new: Is a done ticket whose ticket/<ID> branch does not exist read from the base branch?
        value: "No: R1 needs the branch to exist and be merged; it is read as today (S17)"
    duration_s: 210
  - at: 2026-11-10T09:32:06.693Z
    role: spec-review
    result: done
    summary: WSP-004 S15-S18 and the R1/R2 rewording close the three earlier gaps; two wording follow-ups remain
    verdict: approve
    findings:
      - cites: [WSP-004/S17, TKT-010/R2]
        text: 'Follow-up: S17 says the queue lists TASK-102 under "## Ready", but TKT-010/R2 heads each group `## <name> (<count>)`; S1 and S14 write the count ("## In progress (1)"). Write "## Ready (1)" (or the line the queue prints) so a test can match it.'
        class: C9
      - cites: [PROP-112#Q1, WSP-004/S18, WSP-003/R1]
        text: "Follow-up: Q1 asks whether `spec worktree list` should mark a done and merged worktree, and its default says no. S18 now pins that the row is marked, as a consequence of R1 changing the status list reads, with no change to the list command. The spec-writer's assumption explains this, but the question's default text still reads as the opposite; reword the Q1 default or answer it, so a later reader does not take S18 for a contradiction."
        class: C9
    assumed: []
    duration_s: 91
  - at: 2026-11-10T13:39:28.999Z
    role: tester
    result: done
    summary: Added WSP-004/S9-S18 tests; six proposal behaviors fail as expected on current code.
    verdict: null
    mutations:
      - scenario: WSP-004/S9
        wrong: A leftover ticket worktree takes precedence over a done ticket merged on the base branch.
      - scenario: WSP-004/S10
        wrong: Write the answer into the leftover ticket worktree instead of the checked-out base tree.
      - scenario: WSP-004/S11
        wrong: Write to the leftover worktree instead of committing the update on the unchecked-out base branch.
      - scenario: WSP-004/S12
        wrong: Commit to the base ref without comparing its tip to the tip read before the update.
      - scenario: WSP-004/S13
        wrong: Prefer an open status from the base tree over done on an unmerged ticket branch.
      - scenario: WSP-004/S14
        wrong: When the configured base branch is missing, read the stale main-tree file instead of the ticket worktree.
      - scenario: WSP-004/S15
        wrong: Build the second answer from the committed base tip and discard the first uncommitted answer.
      - scenario: WSP-004/S16
        wrong: Treat a done base ticket as authoritative even when its ticket branch has newer unmerged work.
      - scenario: WSP-004/S17
        wrong: Treat a done base copy as authoritative even though no ticket branch exists.
      - scenario: WSP-004/S18
        wrong: Use the stale in-progress status and omit the merged-into-base suffix from the worktree row.
    assumed:
      - question: PROP-112#Q1
        value: "No: out of scope here; this ticket only changes where the ticket is read from"
    duration_s: 1800
  - at: 2026-11-11T09:38:54.244Z
    role: implementer
    result: done
    summary: Reduced CLI-001/S14 Git processes from 104 to 15; WSP-004 behavior remains covered.
    verdict: null
    assumed:
      - question: PROP-112#Q1
        value: "No: out of scope here; this ticket only changes where the ticket is read from"
    duration_s: 71009
    refusals: 1
  - at: 2026-11-11T10:13:39.587Z
    role: reviewer
    result: done
    summary: "Approve: S1-S18, R1, R2 hold after batching and the TASK-006 merge; four follow-ups; full suite not run"
    verdict: approve
    findings:
      - cites: [WSP-004/R1]
        text: "Follow-up: ticketGitState (src/io/ticket-git.ts, mergedIds) takes a done-and-merged branch as a base-branch candidate only when a worktree has it or this tree has its file. A stale tree with neither (made before the ticket existed) reads the branch tip, not the base tip, as before PROP-112. No scenario names this, and spec merge requires the ticket done on its branch, so the tip text equals the base text unless the base tip was edited later (an answer written there after the merge). If R1 means every tree, drop the filter or say in R1 that a tree with no copy is outside it."
        class: C6
      - cites: [WSP-004/R1, WSP-004/S14]
        text: "Follow-up: the base tip is now found by matching %(refname:short) against format.Config.baseBranch among refs/heads/. That fails when a tag shares the branch's name, because the short name then prints as heads/main. mergedIntoBase is also taken from refs/heads/<base> only, where it used to be `git branch --merged <base>`, which accepted a remote-tracking name such as origin/main. Either case now reads as a base branch that does not exist (S14), so no ticket is read from it and worktree list and dependencies lose their merged marks. Use %(refname) and strip refs/heads/."
        class: C2
      - cites: [WSP-004/R2, WSP-004/S12]
        text: "Follow-up: commitToBranch (src/io/ticket-git.ts) now passes the commit message to commit-tree as one -m per paragraph. The S12 shim matches $6 on the bare subject, so production code was reshaped for a test. The stored message is equivalent, but runs of blank lines are collapsed and the form is not stated anywhere. Keep the test's shim match independent of how -m is split."
        class: C7
      - cites: [WSP-004/R1]
        text: "Follow-up: the FileTicketStore constructor (src/io/ticket-store.ts) now reads <projectRoot>/spec/config.json for baseBranch when no base is passed. The CLI always passes one, so only tests take this path, and a project whose spec root is not <projectRoot>/spec gets 'main' silently. Make the base argument required, or document the fallback."
        class: C9
    assumed: []
    duration_s: 359
---
Review of 2026-11-10. WSP-004/R1 reads a ticket from the worktree that has its branch checked out, committed or not; only an absorbed ticket is read from the base tip (WSP-004/S8). On this repository a leftover worktree still had ticket/PROP-051 checked out, a branch merged into main long ago, with an uncommitted ticket file saying status in_progress, stage implementer (written before the ticket IDs were renumbered). So spec queue and spec plan on main listed PROP-051, which is done on main, as running, under another ticket's title; the plan would have held every ticket touching its features; and spec ticket answer PROP-051 would have written into that worktree. What I want: a ticket whose branch is merged into the base branch and whose file at the base tip says done is read from the base tip in every tree, as an absorbed ticket is, wherever else a copy is. The leftover worktree's file is left as it is. A ticket that is done on its branch but not merged yet is read as today.
