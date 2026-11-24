---
id: PROP-060
type: proposal
title: A spec review stage attacks the spec change before any test is written
status: done
stage: null
touches: [PIP-001, PIP-002, PIP-007, PIP-012, PIP-017]
violates: []
depends_on: []
changed: [FMT-015/R1, FMT-015/R6, FMT-015/S11, INS-001/S14, INS-001/S20, INS-001/S29, INS-005/S17, INV-003, PIP-001/R1, PIP-001/R7, PIP-001/S1, PIP-001/S14, PIP-001/S20, PIP-001/S21, PIP-001/S22, PIP-001/S23, PIP-001/S24, PIP-002/R8, PIP-002/S9, PIP-002/S30, PIP-002/S31, PIP-004/S13, PIP-004/S14, PIP-004/S19, PIP-007/R9, PIP-007/S19, PIP-007/S20, PIP-007/S21, PIP-012/R8, PIP-012/R11, PIP-012/R12, PIP-012/S2, PIP-012/S22, PIP-012/S23, PIP-017/R7, PIP-017/R8, PIP-017/S10, PIP-017/S11, TKT-001/S18, TKT-006, cli.Next, cli.Next.missingModels, cli.Next.model, format.Config, format.Config.budgets, format.StageRole, pipeline.Report, pipeline.Report.findings, pipeline.Report.verdict, pipeline.Role, pipeline.StageRecord, pipeline.StageRecord.checklist, pipeline.StageRecord.findings, pipeline.StageRecord.verdict, pipeline.UnknownRole, pipeline.Verdict]
questions:
  - id: Q1
    kind: blocker
    text: "Twenty tests still run a proposal from the spec-writer straight to the tester, or expect the old texts, which PIP-001/S1 changes: tests/cli/test-first.test.ts (5), tests/cli/dart-test-first.test.ts (5), tests/cli/documents.test.ts (3), tests/cli/mutations.test.ts S2 and S4, tests/cli/check-commands.test.ts S19 and S20, tests/cli/advance-scope.test.ts PIP-008/S19, tests/cli/failure-kind.test.ts (suite fails at start), tests/core/pipeline.test.ts 'walks each pipeline in order', tests/core/report.test.ts PIP-004/S13 (expects 'only the reviewer sets verdict'). Each now gets 'the next stage is spec-review' or the new message. They need a spec-review step (or the new text) and are the tester's to change"
    default: null
    cites: [PIP-001/S1, PIP-001/S23, PIP-004/S13]
    answer: "Yes: the tester fixes this as the blocker describes."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: tests/cli/report-checklist.test.ts PIP-007/S19 and S20 cite PRV-001/S4 as an existing ID, but chat-mini has no PRV-001/S4 until evals/reference/PROP-201.spec-writer.patch is applied (checklistFixture applies it; the new 'the spec review' tests do not). A spec review citing a missing ID is refused by PIP-007/R9, so they cannot pass until the fixture applies the patch
    default: null
    cites: [PIP-007/S19, PIP-007/S20]
    answer: "Yes: the tester fixes this as the blocker describes."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: tests/core/spec-review-brief.test.ts PIP-012/S23 first test asserts indexOf('Spec review findings') < indexOf('Assume unless told otherwise'), but PROP-201 has no preferences so the Assume group is absent (-1) and the assertion cannot hold. The group order itself is right (Review findings, Spec review findings, then Assume when present)
    default: null
    cites: [PIP-012/S23]
    answer: "Yes: the tester fixes this as the blocker describes."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: "tests/cli/pipeline-order.test.ts PIP-001/S23 sets PROP-202's history with a replace of 'history: []', but PROP-202 in chat-mini has no such line, so its history stays empty and the next stage is spec-writer. Use PROP-201 or another ticket with 'history: []'"
    default: null
    cites: [PIP-001/S23]
    answer: "Yes: the tester fixes this as the blocker describes."
    raised_by: implementer
  - id: Q5
    kind: blocker
    text: 'npm run typecheck and npm run lint fail only in tests/core/brief.test.ts: line 12 types GROUPS as Record<StageRole, string[]> with four keys (format.StageRole now has spec-review), and line 42 indexes BUDGETS with a StageRole. BUDGETS keeps four roles for PIP-013/S1, so line 42 cannot compile either way unless the test changes. Its changes are kept in git stash "PROP-060 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites: [PIP-013/S1, PIP-012/S2]
    answer: "Yes: the tester fixes tests/core/brief.test.ts for the five-role StageRole (BUDGETS keeps four roles per PIP-013/S1)."
    raised_by: implementer
history:
  - at: 2026-10-31T17:39:31.926Z
    role: spec-writer
    result: done
    summary: Proposals run spec-writer → spec-review → tester; changes loop to the spec-writer, capped at 3 rounds
    verdict: null
    assumed:
      - new: The ticket says proposals and bugs, but a bug has no spec-writer stage or spec delta. Does a bug get a spec review?
        value: "No: only proposals get it; bugs keep tester → implementer → reviewer (PIP-001/S24). Adding it later is easy"
      - new: How does the light lane interact with the spec review?
        value: "Today's build has no light lane (no type, flag or config; P35 landed only as reviewer prompt wording in 4b9e501). Tasks skip the spec review, and every proposal gets it however small, held to a proportionate bar: changes only for a plausible missed case, minor ones as Follow-up findings on an approval (PIP-017/R7)"
      - new: What are the stage, role, prompt file and model key called?
        value: "spec-review everywhere: stage and role spec-review, roles/spec-review.md, delegation.<harness>.spec-review"
      - new: Which model runs the spec review when delegation.<harness>.spec-review is unset?
        value: The same harness's reviewer model. spec-review is never in missingModels and never an L030, so four-role configs keep working
      - new: What does spec next do in a project with no spec/roles/spec-review.md?
        value: It uses this version's bundled prompt without writing it. Today a missing role file gives the error no valid spec/roles/<role>.md prompt, and an invalid file still does
      - new: May spec-review findings carry the spec or tests marks?
        value: "No: check-report refuses them, since every spec-review finding goes back to the spec-writer"
      - new: Do spec-review and reviewer rounds share the limit of 3?
        value: "No: they are counted apart, each with its own overseer question; the spec one reads: the spec-review asked for changes 3 times; a person must decide. How should <ID> proceed?"
      - new: In what order does the unknown-role message list roles?
        value: "Pipeline order: spec-writer, spec-review, tester, implementer, reviewer. Today's build prints spec-writer, tester, implementer, reviewer, while the spec said spec-writer, implementer, tester, reviewer"
      - new: What brief budget does the spec review get?
        value: 10000 tokens, like the spec-writer's; the spec delta is neither counted nor cut, like the reviewer's diff
      - new: Does the approval gap-word check (PIP-004/R5) apply to spec-review approvals?
        value: "No: it stays a reviewer-only check"
      - new: Where does a proposal recorded before the upgrade with a done spec-writer as its last stage go?
        value: To the spec review; one already past the spec-writer never goes back for one (PIP-001/S23)
    duration_s: 510
  - at: 2026-10-31T18:02:06.357Z
    role: tester
    result: done
    summary: Failing tests for every spec-review scenario; expected texts for the new role list updated
    verdict: null
    mutations:
      - scenario: FMT-015/S11
        wrong: the spec review's model ignores the harness's reviewer model and reports null, or spec-review is rejected as an unknown delegation role
      - scenario: INS-001/S14
        wrong: init skips spec/roles/spec-review.md or writes it after the other role prompts
      - scenario: INS-001/S20
        wrong: the spec-review prompt is installed without frontmatter or with {shared} left unexpanded
      - scenario: INS-001/S29
        wrong: update-roles leaves spec-review out of the changed role list
      - scenario: INS-005/S17
        wrong: update-roles treats a missing spec-review.md as up to date, or --yes also rewrites the other role prompts
      - scenario: PIP-001/S1
        wrong: a proposal goes from spec-writer straight to the tester
      - scenario: PIP-001/S14
        wrong: after a spec-gap round the spec-writer is followed by the tester, skipping the spec review
      - scenario: PIP-001/S20
        wrong: a spec review that asks for changes goes on to the tester, or drops its findings from the record
      - scenario: PIP-001/S21
        wrong: the spec review blocks on the second changes, or never blocks on the third
      - scenario: PIP-001/S22
        wrong: spec-review and reviewer changes share one counter
      - scenario: PIP-001/S23
        wrong: a proposal whose last done stage is a spec-writer without a spec-review goes to the tester
      - scenario: PIP-001/S24
        wrong: bugs and tasks accept the spec-review stage
      - scenario: PIP-002/S9
        wrong: the unknown-role message omits spec-review or lists it out of pipeline order
      - scenario: PIP-002/S30
        wrong: an answered question about the reviewer's rounds also grants a spec round, or one answer grants two
      - scenario: PIP-002/S31
        wrong: start accepts the tester while the spec review is the next stage
      - scenario: PIP-004/S13
        wrong: check-report still refuses a spec-review verdict, or keeps the old message that names only the reviewer
      - scenario: PIP-004/S19
        wrong: the refusal message for other roles still says only the reviewer sets verdict and findings
      - scenario: PIP-007/S19
        wrong: a done spec-review report with no verdict, or changes without findings, is accepted
      - scenario: PIP-007/S20
        wrong: a spec-review finding with a spec or tests mark, no cites or a missing ID is accepted
      - scenario: PIP-007/S21
        wrong: check-report lets the spec review leave uncommitted spec files
      - scenario: PIP-012/S2
        wrong: the spec-review brief lacks the checklist and delta groups or places them after Neighbours
      - scenario: PIP-012/S22
        wrong: the delta is cut by the budget or includes generated files, or the checklist is listed in report order
      - scenario: PIP-012/S23
        wrong: spec-review findings are shown to the tester and implementer, or not to the spec review after the spec-writer's round
      - scenario: PIP-017/S10
        wrong: next delegates the spec review with the tester's prompt or no verdict and findings lines in the report block
      - scenario: PIP-017/S11
        wrong: next fails on a missing spec/roles/spec-review.md, or lists spec-review in missingModels
    assumed:
      - new: TKT-006 is in the ticket's changed list but its spec file is unchanged and it has no changed scenario. Does it need a mutation?
        value: No mutation for it. Added a --back spec-review test under TKT-006/S15 and updated the unknown-role text in TKT-006/S19
      - new: Role is a type of the code under test and does not hold spec-review yet; how do the tests name it?
        value: tests/helpers.ts exports SPEC_REVIEW, parsed from JSON, so the tests typecheck now and stay valid once Role holds it. No SPEC-STUB was needed
      - new: Existing tests whose expected text follows from the spec-review role (INS-005/S9, TKT-001/S18 role list, init.test.ts role loops, INS-001/S15 count)?
        value: Updated them to the five roles in pipeline order
      - new: The brief has no delta contract; how do tests supply the spec delta?
        value: "Through git: a ticket branch that commits a spec change, run via spec brief spec-review. The fixture's feature file is PRV-001-stream-a-reply.md, not the PRV-001-stream.md of the scenario text"
    duration_s: 1353
  - at: 2026-10-31T18:19:04.385Z
    role: implementer
    result: blocked
    summary: Spec review is built (pipeline, report checks, brief, next, init, prompt, docs); 24 tests still fail, all from test-side defects
    verdict: null
    assumed:
      - new: What does the spec review's Features in scope hold? The brief only lists the group
        value: Scenarios and rules, as the tester gets them. PIP-012/S22 needs 2000 delta lines appended to a feature's Out of scope section to cause no warning, and the delta is the place for that text
      - new: Does check-report lint a spec-review stage?
        value: No. It changes no file, so a lint error could only come from an edit already reported; PIP-007/S21 wants that edit as the only problem
      - new: Does the spec-review default budget go in BUDGETS?
        value: "No: BUDGETS keeps its four roles because PIP-013/S1 pins that table, and spec-review's 10000 is a separate default; brief.spec-review still overrides it"
      - new: Does the Usage line of spec brief name spec-review?
        value: "No: PIP-015 pins it with four roles and was not changed, so the line and the argument-hint in the brief skill stay as they were"
      - new: Which IDs may a spec-review finding cite?
        value: A unit of the spec or a question of the ticket or of a unit (the ID check the spec-writer's checklist uses); not a glossary term or the ticket ID alone
      - new: Do old Claude Code agent files include spec-review?
        value: "No: legacy agent cleanup keeps its four roles, since no old install compiled a spec-review agent"
    duration_s: 1016
  - at: 2026-10-31T18:19:12.480Z
    role: tester
    result: reopened
    summary: reopened by PROP-060#Q5
    verdict: null
    assumed: []
  - at: 2026-10-31T18:31:07.410Z
    role: tester
    result: done
    summary: Old-order tests get a spec-review step; fixtures, order assertion, history ticket and Role types fixed
    verdict: null
    mutations:
      - scenario: FMT-015/S11
        wrong: the spec review's model ignores the harness's reviewer model and reports null, or spec-review is rejected as an unknown delegation role
      - scenario: INS-001/S14
        wrong: init skips spec/roles/spec-review.md or writes it after the other role prompts
      - scenario: INS-001/S20
        wrong: the spec-review prompt is installed without frontmatter or with {shared} left unexpanded
      - scenario: INS-001/S29
        wrong: update-roles leaves spec-review out of the changed role list
      - scenario: INS-005/S17
        wrong: update-roles treats a missing spec-review.md as up to date, or --yes also rewrites the other role prompts
      - scenario: PIP-001/S1
        wrong: a proposal goes from spec-writer straight to the tester
      - scenario: PIP-001/S14
        wrong: after a spec-gap round the spec-writer is followed by the tester, skipping the spec review
      - scenario: PIP-001/S20
        wrong: a spec review that asks for changes goes on to the tester, or drops its findings from the record
      - scenario: PIP-001/S21
        wrong: the spec review blocks on the second changes, or never blocks on the third
      - scenario: PIP-001/S22
        wrong: spec-review and reviewer changes share one counter
      - scenario: PIP-001/S23
        wrong: a proposal whose last done stage is a spec-writer without a spec-review goes to the tester
      - scenario: PIP-001/S24
        wrong: bugs and tasks accept the spec-review stage
      - scenario: PIP-002/S9
        wrong: the unknown-role message omits spec-review or lists it out of pipeline order
      - scenario: PIP-002/S30
        wrong: an answered question about the reviewer's rounds also grants a spec round, or one answer grants two
      - scenario: PIP-002/S31
        wrong: start accepts the tester while the spec review is the next stage
      - scenario: PIP-004/S13
        wrong: check-report still refuses a spec-review verdict, or keeps the old message that names only the reviewer
      - scenario: PIP-004/S19
        wrong: the refusal message for other roles still says only the reviewer sets verdict and findings
      - scenario: PIP-007/S19
        wrong: a done spec-review report with no verdict, or changes without findings, is accepted
      - scenario: PIP-007/S20
        wrong: a spec-review finding with a spec or tests mark, no cites or a missing ID is accepted
      - scenario: PIP-007/S21
        wrong: check-report lets the spec review leave uncommitted spec files
      - scenario: PIP-012/S2
        wrong: the spec-review brief lacks the checklist and delta groups or places them after Neighbours
      - scenario: PIP-012/S22
        wrong: the delta is cut by the budget or includes generated files, or the checklist is listed in report order
      - scenario: PIP-012/S23
        wrong: spec-review findings are shown to the tester and implementer, or not to the spec review after the spec-writer's round
      - scenario: PIP-017/S10
        wrong: next delegates the spec review with the tester's prompt or no verdict and findings lines in the report block
      - scenario: PIP-017/S11
        wrong: next fails on a missing spec/roles/spec-review.md, or lists spec-review in missingModels
    assumed:
      - new: How do the 20 old-order tests move a proposal past the spec-writer?
        value: A shared helper approveSpecReview in tests/helpers.ts starts the spec-review stage and advances it with an approving report; tests that write history by hand add a done spec-review entry with verdict approve; the Dart test cannot run here (no Dart) and was edited the same way
      - new: The report corpus holds the PIP-004/S13 expectation, not tests/core/report.test.ts. Where is it changed?
        value: "In tests/core/report-corpus.yaml: the case name and its expected problem now use the new text"
      - new: tests/core/brief.test.ts snapshots and BUDGETS cover four roles (PIP-013/S1). How does it typecheck with five StageRoles?
        value: Its role table and role list are typed Exclude<StageRole, 'spec-review'>; the spec review's brief is tested in spec-review-brief.test.ts and brief-spec-review.test.ts
      - new: "Which ticket carries the pre-spec-review history in PIP-001/S23, since PROP-202 has no history: [] line?"
        value: PROP-205, which the scenario names and has the line
      - new: TKT-006 is in the ticket's changed list but has no changed scenario. Does it need a mutation?
        value: No mutation for it; the --back spec-review test stays under TKT-006/S15
      - new: How were the tests checked against the implementer's code, which is stashed?
        value: "Not applied in this tree: a copy of the worktree outside the repo got the stash's diff and its roles/spec-review.md. Typecheck and lint were clean there, and the full suite passed except dist.test.ts INS-014/S15, which needs a git repository the copy lacks. The copy is deleted"
    duration_s: 714
  - at: 2026-10-31T18:40:30.449Z
    role: implementer
    result: done
    summary: "Spec review stage: pipeline, report checks, brief groups, delegation, prompt and docs; npm run check passes (1735 tests)"
    verdict: null
    assumed:
      - new: What does the spec review's Features in scope hold? The brief only lists the group
        value: Scenarios and rules, as the tester gets them. PIP-012/S22 needs 2000 delta lines appended to a feature's Out of scope section to cause no warning, and the delta is the place for that text
      - new: Does check-report lint a spec-review stage?
        value: No. It changes no file, so a lint error could only come from an edit already reported; PIP-007/S21 wants that edit as the only problem
      - new: Does the spec-review default budget go in BUDGETS?
        value: "No: BUDGETS keeps its four roles because PIP-013/S1 pins that table, and spec-review's 10000 is a separate default; brief.spec-review still overrides it"
      - new: Does the Usage line of spec brief name spec-review?
        value: "No: PIP-015 pins it with four roles and was not changed, so the line and the argument-hint in the brief skill stay as they were"
      - new: Which IDs may a spec-review finding cite?
        value: A unit of the spec or a question of the ticket or of a unit (the ID check the spec-writer's checklist uses); not a glossary term or the ticket ID alone
      - new: Do old Claude Code agent files include spec-review?
        value: "No: legacy agent cleanup keeps its four roles, since no old install compiled a spec-review agent"
    duration_s: 561
  - at: 2026-10-31T18:45:40.481Z
    role: reviewer
    result: done
    summary: Fix checklist citation churn, restore spec-review lint checks, and align the ticket-role diagnostic scenario
    verdict: changes
    findings:
      - cites: [PIP-017/R7, PIP-017/S10, PIP-007/R6]
        text: roles/spec-review.md:12 calls a checklist answer a finding when its cited units are absent from the delta. Valid C6 preservation answers can cite existing unchanged scenarios, which need not appear even as diff context. This creates findings on clean proposals despite the proportionate bar. Resolve checklist citations against the current spec/brief and judge their coverage; do not require the cited units to appear in the diff.
      - cites: [PIP-004/R4, PIP-004/S14]
        text: "src/core/report.ts:163 discards all lint errors for a done spec-review, contrary to R4. A read-only reproduction with no changed paths and one lint error returns ok: true and problems: []. Changing no files does not establish that committed spec and tickets are lint-clean. Restore lint rejection and add a regression covering a clean-tree spec-review with lint errors; current tests omit that case."
        tests: true
      - cites: [TKT-001/S18, pipeline.Role]
        text: spec/modules/tickets/features/TKT-001-ticket-file.md:112 still specifies a four-role history-validation message and fix, but the expanded role schema emits five roles. tests/cli/ticket-unknown-keys.test.ts:113 was updated to expect spec-review without updating this scenario. Amend S18 to describe the new diagnostic so the test and spec agree.
        spec: true
    assumed: []
    duration_s: 308
  - at: 2026-10-31T18:47:20.348Z
    role: spec-writer
    result: done
    summary: Spec review stage added between spec-writer and tester; TKT-001/S18 now lists the five roles
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-004/S13, PIP-007/S21, PIP-012/S22, PIP-001/S23, PIP-002/S31, PIP-017/S11, FMT-015/S11, INS-005/S17]
        reason: "PIP-004 verdict check (S13), PIP-005 path rules via INV-003 (PIP-007/S21), PIP-013/014/016 briefs (PIP-012/S22: delta uncounted, own budget), tickets' histories and gate (PIP-001/S23, PIP-002/S31), CLI-007 missingModels (PIP-017/S11), FMT-015 and LNT L030 (FMT-015/S11), INS-001/INS-005 role files (INS-005/S17). GRF-*, TKT-*, WSP-*, PIP-003/006/008/011/015/019 reach this only through shared errors and ticket fields whose shape is unchanged."
      - item: C2
        outcome: scenarios
        ids: [PIP-001/S23, PIP-017/S11, INS-005/S17, FMT-015/S11]
        reason: "Upgrades from every older state: in-flight histories, installs with no spec/roles/spec-review.md, four-role delegation configs. No path or platform input is new."
      - item: C3
        outcome: scenarios
        ids: [PIP-002/S31, PIP-001/S20]
        reason: While the spec review runs, a tester start is refused; the per-ticket start lock (PIP-002/S26) is unchanged.
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: "The spec-review model's report is less trusted: it changes no file (INV-003, PIP-007/S21), its verdict and cites are checked (PIP-007/S19, S20), and the CLI, not the model, picks the next stage from the history (PIP-001/R7)."
      - item: C5
        outcome: scenarios
        ids: [PIP-007/S19, PIP-007/S20, PIP-017/S11, PIP-001/S24, PIP-002/S9]
        reason: Missing verdict, empty or unknown cites, marked findings, an invalid role file, spec-review on a bug or task, and an unknown role are each refused.
      - item: C6
        outcome: scenarios
        ids: [PIP-001/S24, PIP-001/S22, PIP-012/S23, FMT-015/S11, TKT-001/S18]
        reason: Bugs and tasks run as before; reviewer rounds are counted as before; tester/implementer/reviewer briefs do not change; four-role configs still lint clean; a known field keeps its role check beside an unknown one (TKT-001/S18), whose role list now has five roles.
      - item: C8
        outcome: na
        ids: []
        reason: "No fact about another tool or service: harness keys and model names are the ones FMT-015 already has."
    assumed:
      - new: The ticket says proposals and bugs, but a bug has no spec-writer stage or spec delta. Does a bug get a spec review?
        value: "No: only proposals get it; bugs keep tester → implementer → reviewer (PIP-001/S24). Adding it later is easy"
      - new: How does the light lane interact with the spec review?
        value: "Today's build has no light lane (no type, flag or config; P35 landed only as reviewer prompt wording in 4b9e501). Tasks skip the spec review, and every proposal gets it however small, held to a proportionate bar: changes only for a plausible missed case, minor ones as Follow-up findings on an approval (PIP-017/R7)"
      - new: What are the stage, role, prompt file and model key called?
        value: "spec-review everywhere: stage and role spec-review, roles/spec-review.md, delegation.<harness>.spec-review"
      - new: Which model runs the spec review when delegation.<harness>.spec-review is unset?
        value: The same harness's reviewer model. spec-review is never in missingModels and never an L030, so four-role configs keep working
      - new: What does spec next do in a project with no spec/roles/spec-review.md?
        value: It uses this version's bundled prompt without writing it. Today a missing role file gives the error no valid spec/roles/<role>.md prompt, and an invalid file still does
      - new: May spec-review findings carry the spec or tests marks?
        value: "No: check-report refuses them, since every spec-review finding goes back to the spec-writer"
      - new: Do spec-review and reviewer rounds share the limit of 3?
        value: "No: they are counted apart, each with its own overseer question; the spec one reads: the spec-review asked for changes 3 times; a person must decide. How should <ID> proceed?"
      - new: In what order does the unknown-role message list roles?
        value: "Pipeline order: spec-writer, spec-review, tester, implementer, reviewer. Today's build prints spec-writer, tester, implementer, reviewer, while the spec said spec-writer, implementer, tester, reviewer"
      - new: What brief budget does the spec review get?
        value: 10000 tokens, like the spec-writer's; the spec delta is neither counted nor cut, like the reviewer's diff
      - new: Does the approval gap-word check (PIP-004/R5) apply to spec-review approvals?
        value: "No: it stays a reviewer-only check"
      - new: Where does a proposal recorded before the upgrade with a done spec-writer as its last stage go?
        value: To the spec review; one already past the spec-writer never goes back for one (PIP-001/S23)
    duration_s: 98
  - at: 2026-10-31T18:50:31.801Z
    role: spec-review
    result: done
    summary: Approved the spec-review stage, with a follow-up on brief-role discoverability
    verdict: approve
    findings:
      - cites: [PIP-017/S10, PIP-015/S22, PIP-015/R6]
        text: "Follow-up: PIP-017/S10 adds a fifth delegated stage, but PIP-015/S22 and R6 still require brief and skill hints to advertise only the four older roles. Include spec-review in those hints so a person inspecting or rerunning its brief can discover it. Automatic delegation already supplies the command, so this need not hold this proposal."
    assumed: []
    duration_s: 190
  - at: 2026-10-31T19:00:34.852Z
    role: tester
    result: done
    summary: PIP-004/S14 clean-tree spec-review lint regression added; it fails now (report.ts:163 skips lint)
    verdict: null
    mutations:
      - scenario: PIP-004/S14
        wrong: a done spec-review skips lint errors, as report.ts:163 does now
      - scenario: TKT-001/S18
        wrong: the history role diagnostic still lists four roles, or lists five out of pipeline order
      - scenario: FMT-015/S11
        wrong: the spec review's model ignores the harness's reviewer model and reports null, or spec-review is rejected as an unknown delegation role
      - scenario: INS-001/S14
        wrong: init skips spec/roles/spec-review.md or writes it after the other role prompts
      - scenario: INS-001/S20
        wrong: the spec-review prompt is installed without frontmatter or with {shared} left unexpanded
      - scenario: INS-001/S29
        wrong: update-roles leaves spec-review out of the changed role list
      - scenario: INS-005/S17
        wrong: update-roles treats a missing spec-review.md as up to date, or --yes also rewrites the other role prompts
      - scenario: PIP-001/S1
        wrong: a proposal goes from spec-writer straight to the tester
      - scenario: PIP-001/S14
        wrong: after a spec-gap round the spec-writer is followed by the tester, skipping the spec review
      - scenario: PIP-001/S20
        wrong: a spec review that asks for changes goes on to the tester, or drops its findings from the record
      - scenario: PIP-001/S21
        wrong: the spec review blocks on the second changes, or never blocks on the third
      - scenario: PIP-001/S22
        wrong: spec-review and reviewer changes share one counter
      - scenario: PIP-001/S23
        wrong: a proposal whose last done stage is a spec-writer without a spec-review goes to the tester
      - scenario: PIP-001/S24
        wrong: bugs and tasks accept the spec-review stage
      - scenario: PIP-002/S9
        wrong: the unknown-role message omits spec-review or lists it out of pipeline order
      - scenario: PIP-002/S30
        wrong: an answered question about the reviewer's rounds also grants a spec round, or one answer grants two
      - scenario: PIP-002/S31
        wrong: start accepts the tester while the spec review is the next stage
      - scenario: PIP-004/S13
        wrong: check-report still refuses a spec-review verdict, or keeps the old message that names only the reviewer
      - scenario: PIP-004/S19
        wrong: the refusal message for other roles still says only the reviewer sets verdict and findings
      - scenario: PIP-007/S19
        wrong: a done spec-review report with no verdict, or changes without findings, is accepted
      - scenario: PIP-007/S20
        wrong: a spec-review finding with a spec or tests mark, no cites or a missing ID is accepted
      - scenario: PIP-007/S21
        wrong: check-report lets the spec review leave uncommitted spec files
      - scenario: PIP-012/S2
        wrong: the spec-review brief lacks the checklist and delta groups or places them after Neighbours
      - scenario: PIP-012/S22
        wrong: the delta is cut by the budget or includes generated files, or the checklist is listed in report order
      - scenario: PIP-012/S23
        wrong: spec-review findings are shown to the tester and implementer, or not to the spec review after the spec-writer's round
      - scenario: PIP-017/S10
        wrong: next delegates the spec review with the tester's prompt or no verdict and findings lines in the report block
      - scenario: PIP-017/S11
        wrong: next fails on a missing spec/roles/spec-review.md, or lists spec-review in missingModels
    assumed:
      - new: Mutations for scenarios this round did not touch?
        value: carried over from the previous tester round (PROP-060-tester2) unchanged; check-report asks for one per changed scenario on every tester round
    duration_s: 601
  - at: 2026-10-31T19:12:36.607Z
    role: implementer
    result: done
    summary: Spec-review prompt resolves checklist cites against the current spec; check-report rejects lint errors for a spec review on a clean tree
    verdict: null
    assumed:
      - new: PIP-004/S14 wants lint errors refused for a spec review on a clean tree, while PIP-007/S21 wants an edited file to be its only problem. How do both hold?
        value: Lint errors are refused for a done spec-review unless it left changed files; then only the edit problem is reported. Warnings never refuse it
    duration_s: 714
  - at: 2026-10-31T19:16:37.823Z
    role: reviewer
    result: done
    summary: "All three findings resolved: checklist citations, spec-review lint enforcement and five-role diagnostic"
    verdict: approve
    assumed: []
    duration_s: 239
---
From docs/RETRO-PLUGIN-WORK.md: every piece of the plugin work needed 3-5 rounds of code review because nobody listed the cases the change must handle before code existed. Reviewers found them afterwards.

Add a stage `spec-review` between `spec-writer` and `tester` for proposals and bugs (not tasks). The spec-reviewer reads the spec delta (what the spec-writer changed), the scenarios of every feature the change reaches at depth 1 (`spec impact`), and checks it against the checklist below. It changes no files. Its report is `verdict: approve | changes` with findings that each cite unit IDs. `changes` sends the ticket back to the spec-writer with the findings in its brief (the spec-writer stage runs again); `approve` lets the tester start. The bounce limit (3) applies to the spec-writer/spec-review loop; after it the ticket blocks on a question for a person.

Checklist (each item ends as scenarios, an invariant, a question, or `not applicable: <reason>` in the spec-writer's report):
- C1 neighbours: every feature `spec impact` lists has a scenario for the interaction, or a reason it is unaffected.
- C2 environment axes: paths (symlinks, non-canonical), install layouts/versions and upgrades from every older state, platforms.
- C3 concurrency and ordering: shared state touched across an await or process boundary; a second request while the first is in progress.
- C4 trust boundaries: each input from a less-trusted party (model, repo, worker, user file): who sets it, what a forged value does, which side decides.
- C5 fail closed: unknown, missing or unverifiable input is refused, and a scenario says so.
- C6 preserved behaviour: what must behave exactly as before, as scenarios on the unchanged path.
- C8 external facts: every fact about another tool is cited (where verified) or is an open question.

The spec-review role prompt is a new file in roles/ (and spec/roles/ via init/update-roles). `spec next` delegates it like the other roles; its model key is `spec-review` in `delegation`.
