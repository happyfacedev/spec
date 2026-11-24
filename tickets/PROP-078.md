---
id: PROP-078
type: proposal
title: A brief's Ticket group carries the latest record per role, not the whole stage history
status: done
stage: null
touches: [PIP-012, PIP-015]
violates: []
depends_on: [PROP-060]
changed: [INS-014/S6, PIP-012/R3, PIP-012/R13, PIP-012/S3, PIP-012/S24, PIP-012/S25, PIP-012/S26, PIP-015/R6, PIP-015/S3, PIP-015/S7, PIP-015/S10, PIP-015/S14, PIP-015/S22]
questions: []
history:
  - at: 2026-10-31T21:36:32.170Z
    role: spec-writer
    result: done
    summary: Brief Ticket group keeps latest done record per role, one line for the rest; spec-review listed in brief usage and hints
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S24, PIP-012/S17, PIP-012/S18, PIP-012/S22, PIP-013/S1, PIP-014/S1, PIP-016/S1, INS-012/S18]
        reason: Neighbours INS-012, PIP-013, PIP-014, PIP-016 read the history or the brief size, not the Ticket fence text; PIP-012/S24 pins that Reopened by, Assume, New in the spec and the checklist read the history as stored (R13)
      - item: C2
        outcome: na
        ids: []
        reason: No path, install layout or platform input is new; the cut applies to the ticket text only. Old tickets with any history shape are cut the same way (PIP-012/S25 for an empty one)
      - item: C3
        outcome: na
        ids: []
        reason: Brief is a read-only run with no state shared across an await or a process
      - item: C4
        outcome: scenarios
        ids: [PIP-012/S5]
        reason: Ticket text stays data in a fence it cannot close; history summaries are ticket text and sit inside the same fence (R3)
      - item: C5
        outcome: scenarios
        ids: [PIP-012/S25, PIP-015/S8]
        reason: An empty history gets no lines and no note; bad brief input is still a hint with exit 0
      - item: C6
        outcome: scenarios
        ids: [PIP-012/S1, PIP-012/S17, PIP-012/S18, PIP-015/S22]
        reason: Header, Reopened by, Review findings and the overseer brief behave as before
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service
    assumed:
      - new: How large is a brief for a long-history ticket today?
        value: "Measured with the current build: spec brief tester PROP-060 prints 205863 bytes (the ticket cited 214 KB); the history of that ticket is most of it. No size is pinned, only that the fence is shorter than the ticket file"
      - new: Which fields of the latest done record are kept?
        value: The record as stored (checklist, mutations, findings and assumed too); only earlier records and non-done records shrink to role, result and summary
      - new: Where does a reopened, blocked or earlier done record go?
        value: One line each (role, result, summary), in history order; the exact line layout is not pinned
      - new: In what order does the usage list the roles?
        value: "Pipeline order: spec-writer|spec-review|tester|implementer|reviewer, as the five-role unknown-role message already does; today's build prints the four-role line in both the usage and the skill hint"
      - new: "Is PIP-012/S25 a documents: scenario?"
        value: "No: the current build was not run on a ticket with an empty history to compare, so it keeps its failing test"
    duration_s: 129
  - at: 2026-10-31T21:37:51.057Z
    role: spec-review
    result: done
    summary: S24 has contradictory history assertions and does not exercise its promised reopened-stage preservation
    verdict: changes
    findings:
      - cites: [PIP-012/S24, PIP-012/R13]
        text: S24 requires no record of "first draft", then requires that same record as a line containing its summary. Distinguish the omitted full record from the retained summary so a tester can satisfy both assertions.
        class: C9
      - cites: [PIP-012/S24, PIP-012/R7, PIP-012/S17]
        text: S24 promises that a reopened stage still names its question, but its history ends with implementer blocked, not tester reopened. R7 only emits Reopened by while reopened is the last entry. Align the preservation assertion with a history that actually triggers it; the current fixture cannot demonstrate it without changing the preserved behaviour.
        class: C6
    assumed: []
    duration_s: 76
  - at: 2026-10-31T21:38:33.350Z
    role: spec-writer
    result: done
    summary: PIP-012/S24 separates the cut record from its kept line; the reopened check moves to new S26
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S24, PIP-012/S26, PIP-012/S17, PIP-012/S22, PIP-013/S1, PIP-014/S1, PIP-016/S1, INS-012/S18]
        reason: Neighbours read the history or the brief size, not the Ticket fence text; S26 pins Reopened by on a history that ends reopened
      - item: C2
        outcome: na
        ids: []
        reason: No path, install layout or platform input is new
      - item: C3
        outcome: na
        ids: []
        reason: Brief is a read-only run with no shared state
      - item: C4
        outcome: scenarios
        ids: [PIP-012/S5]
        reason: Ticket text stays data in a fence it cannot close
      - item: C5
        outcome: scenarios
        ids: [PIP-012/S25, PIP-015/S8]
        reason: An empty history gets no lines; bad brief input is still a hint with exit 0
      - item: C6
        outcome: scenarios
        ids: [PIP-012/S1, PIP-012/S17, PIP-012/S18, PIP-015/S22]
        reason: Header, Reopened by, Review findings and the overseer brief behave as before
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service
    assumed:
      - new: Where does the Reopened by check live now?
        value: In S26, whose history ends with a reopened entry as R7 requires; S24 no longer claims it
    duration_s: 41
  - at: 2026-10-31T21:39:07.855Z
    role: spec-review
    result: done
    summary: "Both prior findings resolved: S24 distinguishes retained summaries and S26 checks a history ending reopened"
    verdict: approve
    assumed: []
    duration_s: 33
  - at: 2026-10-31T21:46:02.084Z
    role: tester
    result: done
    summary: Tests for PIP-012 S3/S24/S25/S26 and PIP-015 S3/S7/S14/S22 fail now; 24 brief snapshots, usage and hint pins updated
    verdict: null
    mutations:
      - scenario: PIP-012/S3
        wrong: "the fence still prints the stored history key, as `history: []` or the full list"
      - scenario: PIP-012/S24
        wrong: keeps every record in full, so the first draft's assumed list and the blocked and reopened records stay in the fence
      - scenario: PIP-012/S24
        wrong: drops the non-latest records entirely instead of keeping one line of role, result and summary
      - scenario: PIP-012/S24
        wrong: keeps only the latest record of each role in full, but leaves out the `spec show PROP-201` note
      - scenario: PIP-012/S24
        wrong: cuts only done records and keeps blocked and reopened ones in full
      - scenario: PIP-012/S24
        wrong: also cuts the questions, so Q1's answer or the Assume group loses what the ticket stores
      - scenario: PIP-012/S25
        wrong: "an empty history still prints `history: []` or the `spec show` note"
      - scenario: PIP-012/S26
        wrong: cuts the history before Reopened by reads it, so the group is lost or loses its question line
      - scenario: PIP-012/S26
        wrong: keeps the earlier spec-writer record in full beside the latest one
      - scenario: PIP-015/S3
        wrong: the hint line still lists four roles, without spec-review
      - scenario: PIP-015/S7
        wrong: the no-match usage still lists four roles
      - scenario: PIP-015/S14
        wrong: the short-words usage still lists four roles
      - scenario: PIP-015/S22
        wrong: spec-review is listed last, after reviewer, or the skill argument hint keeps four roles, or overseer is advertised
    assumed:
      - new: Do the brief snapshots keep a `history:` line for a ticket with a stored empty history?
        value: "No: PIP-012/S24 and R13 say the fence holds no history key, so the `history: []` line is removed from the 24 snapshots; the PROP-202, BUG-302 and PROP-206 snapshots never had one"
      - new: How is a one-line record laid out?
        value: Not pinned; the tests only need the line to hold role, result and summary, and to be the only line with that summary
      - new: Does tests/core/lint-cases/_base/spec/SKILL.md need the five-role hint?
        value: "No: it is a lint fixture of its own, not the brief skill, so it is left as it is"
    duration_s: 412
  - at: 2026-10-31T22:00:53.295Z
    role: implementer
    result: done
    summary: Brief Ticket fence drops history for latest done per role plus one line each; usage and hint list spec-review
    verdict: null
    assumed:
      - new: Where do the kept records and the lines sit in the fence?
        value: "After the body: the latest done record of each role as YAML, then one '- role result: summary' line per other record, then a note naming spec show <ID>"
    duration_s: 889
  - at: 2026-10-31T22:08:40.789Z
    role: reviewer
    result: done
    summary: History cut fails on valid multiline YAML; INS-014/S6 still requires the four-role hint
    verdict: changes
    findings:
      - cites: [PIP-012/S24, PIP-012/R13]
        text: "src/core/brief.ts:278 removes only the history key and immediately following indented lines. In-memory briefs of tickets accepted without parse findings reproduce three failures: an unindented history sequence or a column-zero comment before the items retains the old records and their assumed lists alongside the compacted records; a multiline flow sequence with its closing bracket at column zero leaves that bracket in the frontmatter. Remove the complete history value while preserving the other fields and body, and add regression tests for these valid YAML layouts. The current S24 fixture covers only indented one-line records."
        tests: true
        class: C9
      - cites: [INS-014/S6, PIP-015/R6, PIP-015/S22]
        text: spec/modules/install/features/INS-014-package-as-claude-code-plugin.md:44 still requires the brief skill hint to list only spec-writer, tester, implementer and reviewer. The changed template, generated skill and tests/dist.test.ts:195 now include spec-review, as PIP-015/R6 and S22 require. Update INS-014/S6 to the same five-role contract so the implementation and its test do not contradict this checklist scenario.
        spec: true
        class: C9
    assumed: []
    duration_s: 466
  - at: 2026-10-31T22:09:29.408Z
    role: spec-writer
    result: done
    summary: INS-014/S6 names the five-role brief hint in pipeline order
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S24, PIP-012/S26, PIP-012/S17, PIP-012/S22, PIP-013/S1, PIP-014/S1, PIP-016/S1, INS-012/S18]
        reason: Neighbours read the history or the brief size, not the Ticket fence text; S26 pins Reopened by on a history that ends reopened
      - item: C2
        outcome: na
        ids: []
        reason: No path, install layout or platform input is new
      - item: C3
        outcome: na
        ids: []
        reason: Brief is a read-only run with no shared state
      - item: C4
        outcome: scenarios
        ids: [PIP-012/S5]
        reason: Ticket text stays data in a fence it cannot close
      - item: C5
        outcome: scenarios
        ids: [PIP-012/S25, PIP-015/S8]
        reason: An empty history gets no lines; bad brief input is still a hint with exit 0
      - item: C6
        outcome: scenarios
        ids: [PIP-012/S1, PIP-012/S17, PIP-012/S18, PIP-015/S22, INS-014/S6]
        reason: Header, Reopened by, Review findings and the overseer brief behave as before; the plugin brief skill hint lists the five roles in pipeline order
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service
    assumed:
      - new: Where does the Reopened by check live now?
        value: In S26, whose history ends with a reopened entry as R7 requires; S24 no longer claims it
    duration_s: 47
  - at: 2026-10-31T22:10:02.042Z
    role: spec-review
    result: done
    summary: INS-014/S6 now matches the five-role pipeline order required by PIP-015/R6 and S22
    verdict: approve
    assumed: []
    duration_s: 30
  - at: 2026-10-31T22:16:16.044Z
    role: tester
    result: done
    summary: PIP-012/S24 regression tests for unindented, column-0 comment and column-0 closing bracket history layouts, and a body holding history
    verdict: null
    mutations:
      - scenario: INS-014/S6
        wrong: the plugin's brief skill hint keeps four roles, or lists spec-review after reviewer
      - scenario: PIP-012/S3
        wrong: "the fence still prints the stored history key, as `history: []` or the full list"
      - scenario: PIP-012/S24
        wrong: keeps every record in full, so the first draft's assumed list and the blocked and reopened records stay in the fence
      - scenario: PIP-012/S24
        wrong: drops the non-latest records entirely instead of keeping one line of role, result and summary
      - scenario: PIP-012/S24
        wrong: keeps only the latest record of each role in full, but leaves out the `spec show PROP-201` note
      - scenario: PIP-012/S24
        wrong: cuts only done records and keeps blocked and reopened ones in full
      - scenario: PIP-012/S24
        wrong: also cuts the questions, so Q1's answer or the Assume group loses what the ticket stores
      - scenario: PIP-012/S25
        wrong: "an empty history still prints `history: []` or the `spec show` note"
      - scenario: PIP-012/S26
        wrong: cuts the history before Reopened by reads it, so the group is lost or loses its question line
      - scenario: PIP-012/S26
        wrong: keeps the earlier spec-writer record in full beside the latest one
      - scenario: PIP-015/S3
        wrong: the hint line still lists four roles, without spec-review
      - scenario: PIP-015/S7
        wrong: the no-match usage still lists four roles
      - scenario: PIP-015/S14
        wrong: the short-words usage still lists four roles
      - scenario: PIP-015/S22
        wrong: spec-review is listed last, after reviewer, or the skill argument hint keeps four roles, or overseer is advertised
      - scenario: PIP-012/S24
        wrong: removes only the key and the indented lines after it, so an unindented `- { ... }` history sequence stays in the frontmatter
      - scenario: PIP-012/S24
        wrong: stops at a column-0 comment after `history:`, leaving the comment and the old records in the fence
      - scenario: PIP-012/S24
        wrong: removes the lines of a multi-line flow history but leaves its closing `]` at column 0
      - scenario: PIP-012/S24
        wrong: removes everything from `history:` to the closing `---`, so the keys after the history (questions and their answers) are lost
      - scenario: PIP-012/S24
        wrong: "searches the whole ticket text instead of the frontmatter, so a body line `history: ...` and the lines after it are removed"
    assumed: []
    duration_s: 371
    refusals: 1
  - at: 2026-10-31T22:26:23.755Z
    role: implementer
    result: done
    summary: Brief cuts the whole history pair by its YAML source span, so any layout goes and other lines stay as stored
    verdict: null
    assumed: []
    duration_s: 606
  - at: 2026-10-31T22:27:49.479Z
    role: reviewer
    result: done
    summary: "Both findings resolved: complete YAML history removal is covered, and INS-014/S6 matches the five-role hint"
    verdict: approve
    assumed: []
    duration_s: 84
---
Measured on this repo (SELF-HOSTING P44). PROP-060's spec-review brief was 262 KB and its tester brief 214 KB. The `## Ticket` group pastes the whole ticket file into every stage's brief, about 360 lines of stage history with every record's assumed list. The first live spec-reviewer reported needing the prompt, the checklist, the delta and the neighbour expansions, "not the repeated full stage histories". Change: the Ticket group keeps the frontmatter fields other than history, the body, and every question with its answer. It keeps the latest done record of each role with its assumed list, and earlier records as one line each (role, result, summary). The full file stays one `spec show <ID>` away, and the brief says so. Also, from PROP-060's spec review: PIP-015/S22 and R6 list spec-review in the brief usage and skill argument hints, so a person can discover and rerun its brief.
