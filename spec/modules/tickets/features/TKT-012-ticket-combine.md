---
id: TKT-012
title: Combine tickets, or close one that another made redundant
module: tickets
status: active
writes: [tickets.Ticket.status, tickets.Ticket.absorbed_into, tickets.Ticket.touches, tickets.Ticket.violates, tickets.Ticket.depends_on, tickets.Ticket.questions, tickets.Ticket.body]
provides: [tickets.TicketCombine, tickets.TicketClose]
invariants: [INV-012]
---
## Intent
Two tickets often turn out to be one piece of work. `spec ticket combine` folds them into one ticket without losing anything: the ticket that goes on takes over the others' words, scope and open questions, and each absorbed ticket keeps its file and ID, marked with where its work went, so the ID is never handed out again and anyone who looks it up finds the ticket that carries it. Only tickets no work has started on are combined. An absorbed ticket is finished: nothing plans, queues or runs it again. A ticket that work has started on can still turn out redundant, because another ticket did its work and merged. `spec ticket close <ID> --superseded-by <ID>` retires it the same way: its file on the base branch is marked absorbed into the ticket that made it redundant, and that mark outranks every other copy, so the ticket leaves the queue and no stage starts on it again. It deletes nothing: its worktree, branch, history and blocked stash stay as they were, and the command names each with the command a person runs to remove it.

## Behaviour
### S1: One ticket folded into another
Given "PROP-201" is an open proposal with no history, tickets.Ticket.title "Add a fake provider", tickets.Ticket.touches ["SET-001"], an open preference Q1 and the body "Add it."
And "PROP-202" is an open proposal with no history, tickets.Ticket.title "List providers", tickets.Ticket.touches ["SET-001", "UI-002"], an open blocker question Q1 "Which order?", an answered question Q2 and the body "List them."
When the developer runs `spec ticket combine PROP-201 PROP-202` through tickets.TicketCombine
Then the saved "PROP-201" has tickets.Ticket.touches ["SET-001", "UI-002"], and tickets.Ticket.questions Q1 as before then Q2, the blocker "Which order?", unanswered (R2)
And its tickets.Ticket.body is "Add it.", then the line "From PROP-202: List providers", then "List them." (R2)
And the saved "PROP-202" has tickets.Ticket.status "absorbed" and tickets.Ticket.absorbed_into "PROP-201", and every other key and its body as before (R3)
And cli.CommandResult.stdout starts "PROP-202 absorbed into PROP-201 (added UI-002; PROP-202#Q1 → PROP-201#Q2)", a blank line, then the gate on "PROP-201", starting "PROP-201: not ready" (R6)
And cli.CommandResult.exitCode is 0

### S2: Several tickets, and what each one adds
Given "BUG-301" is an open bug with no history and tickets.Ticket.violates ["PRV-002/S3"], and "BUG-303" and "BUG-304" are open bugs with no history, "BUG-303" violating "PRV-002/S3" and depending on "TASK-101", "BUG-304" violating "PRV-002/S4" and depending on "BUG-301"
When the developer runs `spec ticket combine BUG-301 BUG-303 BUG-304 --format json` through tickets.TicketCombine
Then cli.CommandResult.stdout is a tickets.CombineResult with tickets.CombineResult.ticket "BUG-301" and tickets.CombineResult.absorbed, in order: tickets.AbsorbedTicket.id "BUG-303" with tickets.AbsorbedTicket.added ["TASK-101"] and an empty tickets.AbsorbedTicket.questions, then "BUG-304" with added ["PRV-002/S4"] (R2, R6)
And the saved "BUG-301" has tickets.Ticket.violates ["PRV-002/S3", "PRV-002/S4"] and tickets.Ticket.depends_on ["TASK-101"], never itself (R2)
And its body holds a "From BUG-303: <title>" line before a "From BUG-304: <title>" line (R2)
And tickets.CombineResult.gate is the gate on "BUG-301"

### S3: Committed together
Given the tickets are files in a git repository on its base branch with a clean working tree
When the developer runs `spec ticket combine PROP-201 PROP-202 PROP-205` through tickets.TicketCombine
Then the newest commit has the subject "PROP-201: combine PROP-202, PROP-205" and holds only "tickets/PROP-201.md", "tickets/PROP-202.md" and "tickets/PROP-205.md" (R5)
And `git status --porcelain` prints nothing
But on any other branch, with "main" checked out in another worktree, the command fails with tickets.NotOnBaseBranch, and cli.CommandResult.stderr starts "file tickets from main: run spec ticket combine in " and nothing is written (R5)

### S4: Tickets that may not be combined
Given "PROP-201" is open with no history, "PROP-206" is blocked, "PROP-207" is open with a done spec-writer stage in its history, "PROP-208" is absorbed into "PROP-201", "TASK-101" is an open task, "PROP-209" is open with no history and has its own worktree on "ticket/PROP-209", and "PROP-210" is open with no history
When the developer runs `spec ticket combine` through tickets.TicketCombine with each line below
Then the command fails with tickets.CombineRefused, cli.CommandResult.stderr is the line below and a newline, cli.CommandResult.exitCode is 1, and no ticket file changes (R1):
| command | stderr |
| "spec ticket combine PROP-201 PROP-201" | "PROP-201 cannot absorb itself" |
| "spec ticket combine PROP-201 PROP-206" | "PROP-206 is blocked: only open tickets are combined" |
| "spec ticket combine PROP-206 PROP-201" | "PROP-206 is blocked: only open tickets are combined" |
| "spec ticket combine PROP-201 PROP-208" | "PROP-208 is absorbed: only open tickets are combined" |
| "spec ticket combine PROP-201 PROP-207" | "PROP-207 has recorded stages: only tickets no stage has run on are combined" |
| "spec ticket combine PROP-201 TASK-101" | "PROP-201 is a proposal and TASK-101 is a task: only tickets of one type are combined" |
| "spec ticket combine PROP-201 PROP-209" | "PROP-209 has a worktree on ticket/PROP-209: remove it first" |
| "spec ticket combine PROP-210 PROP-201" | "PROP-201 has absorbed PROP-208: combine into PROP-201 instead" |
And `spec ticket combine PROP-201 PROP-206 PROP-207` prints both problems, one per line, and changes nothing (R1)
And `spec ticket combine PROP-201 PROP-210 PROP-206` leaves "PROP-210" open, as it was (R1)

### S5: Unknown tickets and missing arguments
Given the store holds "PROP-201", "PROP-202", "PROP-205" and "PROP-206"
When the developer runs `spec ticket combine PROP-201 PROP-20` through tickets.TicketCombine
Then the command fails with tickets.UnknownTicket, and cli.CommandResult.stderr starts "Unknown PROP-20. Did you mean PROP-201?"
And cli.CommandResult.exitCode is 2
And `spec ticket combine PROP-201` fails with cli.UsageError, its stderr starting "usage: spec ticket combine <INTO> <FROM>...", and exit code 2

### S6: An absorbed ticket is never gated or started
Given "PROP-202" is absorbed into "PROP-201"
When the developer runs `spec gate PROP-202` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "absorbed", id "PROP-201", text "PROP-202 was absorbed into PROP-201; its work goes on there" (R4)
And cli.CommandResult.exitCode is 1
And `spec ticket start PROP-202 spec-writer` fails and starts no stage (R4)

### S7: A ticket that depends on an absorbed ticket
Given "PROP-202" is absorbed into "PROP-201", and the open task "TASK-930" depends on "PROP-202"
When the developer runs `spec gate TASK-930` through tickets.Gate
Then tickets.GateResult.blockers holds kind "unresolved", id "PROP-202", text "depends_on PROP-202, which was absorbed into PROP-201: depend on PROP-201 instead" (R4)

### S8: A moved question that cites its own ticket
Given "PROP-901" is an open proposal with no history, tickets.Ticket.touches ["TKT-012"], and an open blocker question Q1 "Which order?" with tickets.Question.cites ["PROP-901", "TKT-012"]
And "PROP-902" is an open proposal with no history, tickets.Ticket.touches ["TKT-001"] and the body "Into."
When the developer runs `spec ticket combine PROP-902 PROP-901` through tickets.TicketCombine
Then the saved "PROP-902" has tickets.Ticket.questions Q1 with the text "Which order?", still open, and tickets.Question.cites ["PROP-902", "TKT-012"] (R7)
And `spec gate PROP-902` names the blocker kind "question" with id "PROP-902#Q1" and no "schema" blocker (R7)

### S9: A moved question that cites a FROM question
Given "PROP-901" is an open proposal with no history, tickets.Ticket.touches ["TKT-012"], an open blocker question Q1 "Which order?" with tickets.Question.cites ["PROP-901"], an open blocker question Q2 "Which name?" with tickets.Question.cites ["PROP-901#Q1"], an answered blocker question Q3 "Which old?", and an open blocker question Q4 "Which version?" with tickets.Question.cites ["PROP-901#Q3"]
And "PROP-902" is an open proposal with no history, tickets.Ticket.touches ["TKT-001"] and the body "Into."
When the developer runs `spec ticket combine PROP-902 PROP-901` through tickets.TicketCombine
Then cli.CommandResult.exitCode is 0, and the saved "PROP-902" has tickets.Question.cites ["PROP-902"] on Q1 "Which order?", ["PROP-902#Q1"] on Q2 "Which name?" and [] on Q3 "Which version?" (R7, R8)
And `spec gate PROP-902` names the blocker kind "question" for "PROP-902#Q1", "PROP-902#Q2" and "PROP-902#Q3" and no "schema" blocker (R8)

### S10: Committed through the installed enforcement hooks
Given `spec init` installed the pre-commit and commit-msg hooks with enforcement on, "PROP-201" and "PROP-202" are open proposals with no history committed by `spec ticket new`, and "notes.txt" is staged on the base branch
When the developer runs `spec ticket combine PROP-201 PROP-202` through tickets.TicketCombine
Then cli.CommandResult.exitCode is 0, and the newest commit has the subject "PROP-201: combine PROP-202", ends with the trailer line "Spec-Ticket: PROP-201", and holds only "tickets/PROP-201.md" and "tickets/PROP-202.md" (R5)
And "notes.txt" is still staged and not in that commit (R5)
And `spec verify-history` on that history prints a line starting "history clean" and exits 0 (R5)
But while another spec-owned commit of the same repository is in progress, the command fails with tickets.CommitRefused and every ticket file is as it was (R5)

### S11: A blocked ticket that another ticket made redundant
Given `spec init` installed the enforcement hooks, "main" is the base branch and is checked out in "/work/app", and "PROP-063" is done and merged into "main"
And "PROP-073" is blocked on its open question Q1, with two records in tickets.Ticket.history, its worktree at "/work/app.worktrees/PROP-073" on "ticket/PROP-073", whose tip "44f149c" is 2 commits ahead of "main", and "git stash list" holds "PROP-073 tester: blocked" at "9c1d2e3"
And "/work/app/tickets/PROP-073.md" still says status open, with no history, as "main" has it
When the developer runs `spec ticket close PROP-073 --superseded-by PROP-063` in "/work/app" through tickets.TicketClose
Then cli.CommandResult.exitCode is 0, and in "/work/app/tickets/PROP-073.md" the status line reads "status: absorbed" and the line "absorbed_into: PROP-063" is added, and every other byte is as before (R10)
And the newest commit on "main" has the subject "PROP-063: close PROP-073 as superseded", ends with the trailer line "Spec-Ticket: PROP-063", and holds only "tickets/PROP-073.md" (R11)
And cli.CommandResult.stdout is these lines (R12):
| line |
| "PROP-073 absorbed into PROP-063 (closed; nothing was removed)" |
| "kept worktree /work/app.worktrees/PROP-073: spec worktree remove PROP-073 removes it" |
| "kept branch ticket/PROP-073 at 44f149c, with 2 commits not on main and the 2 recorded stages of PROP-073: git branch -D ticket/PROP-073 discards them" |
| "kept stash ''PROP-073 tester: blocked'' at stash@{0} (9c1d2e3): when git rev-parse --short stash@{0} still prints 9c1d2e3, git stash drop stash@{0} discards it" |
And the worktree, "ticket/PROP-073" at "44f149c", the worktree's copy of "tickets/PROP-073.md" and the stash are all as they were (R12, INV-012)
And from "/work/app" and from any worktree, tickets.Ticket.status read for "PROP-073" is "absorbed", `spec gate PROP-073` has the one blocker of kind "absorbed" naming "PROP-063", and `spec queue` lists "PROP-073" in no group (R4, WSP-004/R1)
And after `spec worktree remove PROP-073` and `git branch -D ticket/PROP-073`, or after "ticket/PROP-073" is made again at "44f149c", "PROP-073" still reads "absorbed" (WSP-004/R1)
And `spec verify-history` on that history prints a line starting "history clean" and exits 0 (R11, INS-015/R6)
But with `--format json`, cli.CommandResult.stdout is a tickets.CloseResult with tickets.CloseResult.ticket "PROP-073", tickets.CloseResult.absorbedInto "PROP-063", tickets.CloseResult.worktree "/work/app.worktrees/PROP-073", tickets.CloseResult.branch "ticket/PROP-073", tickets.CloseResult.tip "44f149c", tickets.CloseResult.unmerged 2, tickets.CloseResult.stashes one tickets.KeptStash with tickets.KeptStash.name "PROP-073 tester: blocked", tickets.KeptStash.ref "stash@{0}" and tickets.KeptStash.commit "9c1d2e3", and tickets.CloseResult.cleanup the three commands of the text, in its order (R12)

### S12: An open ticket in an older shape, with only a branch left
Given "PROP-074" is open, and its file on "main" was written before tickets had the keys "stage" and "history", with neither key in it
And "ticket/PROP-074" exists with its tip "5b6c7d8" on "main" already, no worktree has it checked out, and no stash is named for "PROP-074"
When the developer runs `spec ticket close PROP-074 --superseded-by PROP-063` through tickets.TicketClose
Then cli.CommandResult.exitCode is 0, the status line of "tickets/PROP-074.md" reads "status: absorbed", it gains the line "absorbed_into: PROP-063", and every other byte of it is unchanged, with no "stage" or "history" key added (R10, TKT-002/R1)
And cli.CommandResult.stdout is "PROP-074 absorbed into PROP-063 (closed; nothing was removed)", then "kept branch ticket/PROP-074 at 5b6c7d8, every commit on it on main: git branch -d ticket/PROP-074 removes it" (R12)
And `spec lint` reports no problem with "tickets/PROP-074.md" (TKT-001/R12)
And with a stash "PROP-074 build: blocked" in "git stash list", which a build stage left, stdout has one "kept stash" line naming it as S11's does (R12)
But when the ticket has neither branch nor worktree nor stash, the only line is the first one, and tickets.CloseResult.cleanup is empty (R12)
And when its status line was written `status: "open"` (or single-quoted), it reads `status: "absorbed"` (or single-quoted) afterwards, quotes kept, and the close commit passes `spec verify-history` (R10, INS-015/R6)

### S13: Tickets that may not be closed
Given "PROP-201" is open with tickets "PROP-208" absorbed into it, "PROP-205" has its tester stage running, "PROP-206" is done, "PROP-063" is done, and "PROP-210" is blocked
And "PROP-212" is blocked with no branch, and "tickets/PROP-212.md" on "main" has an uncommitted answer to its Q1, staged or not
When the developer runs `spec ticket close` through tickets.TicketClose with each line below
Then the command fails with tickets.CloseRefused, cli.CommandResult.stderr is the line below and a newline, cli.CommandResult.exitCode is 1, and no ticket file, worktree, branch or stash changes (R9, INV-012):
| command | stderr |
| "spec ticket close PROP-205 --superseded-by PROP-063" | "PROP-205 has its tester stage running: only open or blocked tickets are closed" |
| "spec ticket close PROP-206 --superseded-by PROP-063" | "PROP-206 is done: only open or blocked tickets are closed" |
| "spec ticket close PROP-208 --superseded-by PROP-063" | "PROP-208 is absorbed: only open or blocked tickets are closed" |
| "spec ticket close PROP-210 --superseded-by PROP-210" | "PROP-210 cannot be superseded by itself" |
| "spec ticket close PROP-210 --superseded-by PROP-208" | "PROP-208 is absorbed into PROP-201: close PROP-210 as superseded by PROP-201 instead" |
| "spec ticket close PROP-201 --superseded-by PROP-063" | "PROP-201 has absorbed PROP-208: only a ticket nothing was absorbed into is closed" |
| "spec ticket close PROP-212 --superseded-by PROP-063" | "tickets/PROP-212.md has uncommitted changes: ask the person whether to open a bypass with spec bypass, commit that file with its ADR, then close PROP-212; an approved agent must use --approved-by-person" |
And the uncommitted answer in "tickets/PROP-212.md" is still there, staged or not as it was (R9)
But a staged "notes.txt" alone does not stop a close: it stays staged and out of the close commit (R11)
And `spec ticket close PROP-210 --superseded-by PROP-29` fails with tickets.UnknownTicket, its stderr starting "Unknown PROP-29.", and exit code 2
And `spec ticket close PROP-210` fails with cli.UsageError, its stderr starting "usage: spec ticket close <TICKET> --superseded-by <ID>", and exit code 2
And in a ticket's worktree, the command fails with tickets.NotOnBaseBranch, and cli.CommandResult.stderr starts "file tickets from main: run spec ticket close in /work/app" (R11)
And with tickets.StoreConfig a tickets.CommandStore, a tickets.FilesStore whose tickets.FilesStore.dir "../tickets" is outside the repository, or a project in no git repository, the command fails with tickets.CloseRefused, exit code 1, and cli.CommandResult.stderr "spec ticket close needs tickets as files in this git repository" then, after "; ", "this project keeps them in a tracker", "../tickets is outside it" or "/work/app is in no git repository", and no ticket, file or git state changes (R14)

### S14: A close that races a start, or another spec commit
Given "PROP-210" is blocked with its worktree on "ticket/PROP-210", and "PROP-063" is done
When `spec ticket start PROP-210 implementer` holds the start lock of "PROP-210" while the developer runs `spec ticket close PROP-210 --superseded-by PROP-063` through tickets.TicketClose
Then the close fails with tickets.CloseRefused, cli.CommandResult.stderr is "PROP-210 is being started by another process; try again once it ends", the exit code is 1, and nothing changes (R13)
And while the close holds that lock, the start fails with pipeline.StageRefused, and a start that takes the lock once the close has committed reads "PROP-210" as "absorbed" and is refused by its "absorbed" blocker, its worktree as it was (R4, R13, WSP-004/R1)
But while another spec-owned commit of the same repository is in progress, the close fails with tickets.CommitRefused, "tickets/PROP-210.md" is as it was, and "PROP-210" still reads "blocked" (R11)

### S15: A dirty target cleared by following the advice
Given the enforcement hooks are installed, and "PROP-212" and "PROP-063" are as in S13, with the answer to Q1 in "tickets/PROP-212.md" uncommitted on "main"
When the developer runs `spec ticket close PROP-212 --superseded-by PROP-063` through tickets.TicketClose
Then the command fails with tickets.CloseRefused and cli.CommandResult.stderr is the "PROP-212" line of S13 (R9)
And a hand commit of "tickets/PROP-212.md" with the trailer "Spec-Ticket: PROP-212" is refused by pre-commit, and a second close is refused with the same line (R9, INS-015/S4)
But once a person has run `spec bypass`, or an agent the person approved has run it with `--approved-by-person` (INS-015/S13), and committed "tickets/PROP-212.md" with the bypass ADR it wrote, that commit holds only those two files and carries the trailer "Spec-Bypass: <ADR>" of that ADR (INS-015/S6, INS-015/S12)
And the developer's next `spec ticket close PROP-212 --superseded-by PROP-063` through tickets.TicketClose exits 0, "tickets/PROP-212.md" reads tickets.Ticket.status "absorbed" with tickets.Ticket.absorbed_into "PROP-063" and its answer to Q1 kept, and the close commit holds only that file under the subject "PROP-063: close PROP-212 as superseded" (R9, R10, R11)
And `spec verify-history` over both commits prints a line starting "history clean" and exits 0 (INS-015/R6)

## Rules
- R1: Every ticket named must be open, with no history, and of one type, and INTO is not a FROM; a FROM named twice counts once. No ticket named may have a worktree of its own, so every live copy is on the base branch, and no FROM may have tickets absorbed into it, so every tickets.Ticket.absorbed_into keeps naming a ticket that is not absorbed; that last problem is printed only when INTO itself can absorb. Every problem found is printed, one per line, and nothing changes when any is found
- R2: INTO takes over, from each FROM in the order given: every ID in its touches, violates and depends_on that INTO does not list yet, added after INTO's own (never INTO or a FROM in depends_on, and an entry INTO already had that names a FROM is dropped); its open questions, numbered after INTO's, unanswered, with every other key kept; and its body, after INTO's, under the line "From <FROM>: <its title>". Answered questions stay only on the FROM
- R3: Each FROM gets tickets.TicketStatus "absorbed" and tickets.Ticket.absorbed_into INTO; nothing else in it changes, and its file stays in the store, holding its ID
- R4: An absorbed ticket is final. Its gate has the one blocker of kind "absorbed" naming INTO, so no brief is built for it and no stage starts; plan and queue leave it out. A ticket that depends on it is refused by the gate with an "unresolved" blocker naming the ticket to depend on instead
- R5: Each ticket is saved where its live copy is, INTO before any FROM. With the files store in a git repository, it runs only on format.Config.baseBranch, and the files it changes are committed together, with the subject "<INTO>: combine <FROM>, <FROM>" and the trailer "Spec-Ticket: <INTO>", under a spec-owned combine commit marker bound to exactly those files, so the installed enforcement hooks and `spec verify-history` accept it (INS-015/R4, INS-015/R6), and nothing else staged goes into it; when git or a hook refuses, the command fails with tickets.CommitRefused and every file is put back
- R6: The text output has one line per FROM, "<FROM> absorbed into <INTO> (added <IDs, or nothing>; <each moved question as <FROM>#Q<n> → <INTO>#Q<n>, or no open questions>)", then a blank line and the gate on INTO; the JSON output is a tickets.CombineResult. The command exits 0 whatever the gate says
- R7: A cite of FROM's own ID in a moved question becomes INTO's ID, in the same place in its list; the question's other cites stay as they are, so INTO passes TKT-001/R6
- R8: A cite of a FROM question, `<FROM>#Q<n>`, in a moved question becomes the `<INTO>#Q<m>` that question n was given, in the same place in its list. A cite of a FROM question that did not move (it was answered, or is not on FROM) is left out, since INTO has no question to name; FROM keeps its own question and cite
- R9: `spec ticket close` takes a ticket that is open or blocked, whatever its history, type or depends_on, and the ticket named by `--superseded-by`, which is another ticket in the store that is not absorbed, whatever its status. It refuses a ticket whose live copy (WSP-004/R1) has a stage running, is done or absorbed, or whose copy on the base branch is not open or blocked with stage null, one that other tickets are absorbed into, and one whose file on the base branch has any uncommitted change, staged or not, which it leaves as it is, so the close commit holds only its two keys. Its line names a path that clears the condition and passes the installed hooks: a bypass (INS-015/S6) that a person approves: the line tells the caller to ask the person whether to open it, and that an approved agent must pass `--approved-by-person`, since an agent's request without it is refused, and every agent request when `enforce.bypass` is `person` (INS-015/S13, INS-015/R8). The path is a bypass because the tickets folder is governed and a hand commit of the file, even with a "Spec-Ticket: <ID>" trailer, is refused without a fresh spec-owned marker or a bypass ADR staged with it (INS-015/S4, INS-015/R1); `spec ticket answer` and the close itself commit nothing of it. Every problem found is printed, one per line, and nothing changes when any is found (INV-012)
- R10: Only the ticket's file on the base branch changes: its status line becomes "absorbed", keeping its comment and the quote marks it was written with, and the line "absorbed_into: <SUPERSEDING>" is added; every other byte is kept (TKT-002/R1). Its history, questions and changes stay where its live copy holds them, on its branch or in its worktree, and the superseding ticket's file does not change. From then on the base branch's absorbed copy is the one every tree reads (WSP-004/R1)
- R11: The close runs only on format.Config.baseBranch and commits only that file, with the subject "<SUPERSEDING>: close <ID> as superseded" and the trailer "Spec-Ticket: <SUPERSEDING>", under the spec-owned combine commit marker bound to exactly that file, so the installed enforcement hooks and `spec verify-history` accept it (INS-015/R4, INS-015/R6), and nothing else staged goes into it; when git or a hook refuses, the command fails with tickets.CommitRefused and the file is put back
- R12: The close deletes nothing: the ticket's worktree, its branch `ticket/<ID>`, its stashes named "<ID> <role>: blocked" or "<ID> build: blocked" and every file in them stay as they were, for a person to remove. It prints "<ID> absorbed into <SUPERSEDING> (closed; nothing was removed)", then one line for each that exists, in this order: "kept worktree <path>: spec worktree remove <ID> removes it"; "kept branch ticket/<ID> at <short tip>, " then "with <n> commits not on <base> and the <m> recorded stages of <ID>: git branch -D ticket/<ID> discards them", or "every commit on it on <base>: git branch -d ticket/<ID> removes it"; and `kept stash "<name>" at <ref> (<short hash>): when git rev-parse --short <ref> still prints <short hash>, git stash drop <ref> discards it`, since another stash pushed or dropped since moves the entry to another `stash@{n}`. The JSON output is a tickets.CloseResult carrying the same tips, hashes and commands
- R13: A close holds the start lock of the ticket (PIP-002/R7) from its checks until it has committed, so no stage starts on the ticket while it is closed, and the close is refused while a start holds it. A start after the commit reads the ticket as absorbed and is refused
- R14: Close needs tickets as files inside the project's git repository. With the command store, a files store outside the repository, or no git repository, it is refused with tickets.CloseRefused before it reads or changes anything

## Out of scope
- Undoing a combine, or splitting a ticket: edit the ticket files
- Reopening a closed ticket: file a new ticket; its branch and stash are still there to take work from
- Removing a closed ticket's worktree, branch or stash: a person runs the commands the close printed
- Rewriting other tickets' depends_on: the gate names the ticket to depend on instead
