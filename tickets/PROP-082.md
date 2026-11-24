---
id: PROP-082
type: proposal
title: Over budget, a brief's Features in scope quotes the changed scenarios in full and lists the rest by title
status: done
stage: null
touches: [PIP-013, PIP-012]
violates: []
depends_on: [PROP-078]
changed: [PIP-012/S7, PIP-013, PIP-013/R2, PIP-013/R3, PIP-013/R5, PIP-013/R6, PIP-013/S3, PIP-013/S4, PIP-013/S5, PIP-013/S8, PIP-013/S9, PIP-013/S10, PIP-013/S11]
questions: []
history:
  - at: 2026-11-01T00:21:08.379Z
    role: spec-writer
    result: done
    summary: Over budget, briefs keep changed/cited scenarios and rules whole, list the rest by ID and title, trim contracts
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-013/S11, PIP-013/S6, PIP-013/S3, PIP-012/S7]
        reason: "spec impact PROP-082 reaches INS-012, PIP-014, PIP-015 and PIP-016. PIP-014: what the branch changed stays whole and its New in the spec group is never cut (S11). PIP-016: the diff is never counted or cut (S6, S11). INS-012 and PIP-015 call the same brief, and a brief that fits is unchanged (S3). PIP-015's search brief has no budget cut"
      - item: C2
        outcome: scenarios
        ids: [PIP-013/S11]
        reason: With no git repository or no base branch, nothing counts as changed, and the brief is otherwise complete
      - item: C3
        outcome: na
        ids: []
        reason: A brief is one read of the spec and ticket files in one process, with no state shared across an await or a process; PIP-012/R1 already makes it deterministic
      - item: C4
        outcome: na
        ids: []
        reason: Ticket text can only keep more scenarios whole by naming their IDs. It never drops anything required (PIP-013/R3), and budgets come from the project's own config as before
      - item: C5
        outcome: scenarios
        ids: [PIP-013/S11, PIP-013/S10]
        reason: With an unknown base or a bare feature ID, nothing counts as kept. Each scenario still keeps its ID and title line, and the over-budget warning remains
      - item: C6
        outcome: scenarios
        ids: [PIP-013/S3, PIP-013/S6, PIP-013/S7, PIP-012/S20]
        reason: "A brief that fits after the first five cuts is unchanged (S3). Neighbours are still cut first (S7), the diff is untouched (S6) and the case checklist stays whole (PIP-012/S20). Measured: BUG-002 tester 14,578 B and implementer 17,412 B fit; PROP-077 implementer, spec-review and reviewer fit"
      - item: C8
        outcome: na
        ids: []
        reason: "No other tool or service is involved: git merge-base behaviour is already specified in PIP-014/R1"
    assumed:
      - new: Do the spec-review and reviewer briefs, and the spec-writer's, follow the same rule?
        value: Yes. All roles use the same seven steps. The spec delta and the reviewer's diff are never counted or cut, so those reviews still see every change whole
      - new: In which order does step 6 take features?
        value: From the first, in the order Features in scope lists them (the ticket's 'in feature order')
      - new: What counts as the ticket citing a scenario or rule?
        value: Its full ID anywhere in the ticket file, plus a rule that a kept scenario cites. A bare feature ID keeps nothing
      - new: What counts as changed for roles without New in the spec (spec-writer, spec-review)?
        value: The same branch comparison as PIP-014/R1, whether or not the group is shown
      - new: Do steps 4 and 5 also spare cited or changed units?
        value: Yes, because nothing the ticket changed or cites is ever cut. Step 4 spares ticket-cited or branch-changed contracts, and step 5 keeps kept rules
      - new: Shape of a cut feature
        value: One hint line per feature, 'Listed by title to fit the budget; run `spec show <ID>` for the full text:', then '- <ID> <title>' for each scenario, with a rule's title being its first sentence
      - new: Which contracts survive step 7?
        value: Those a kept unit names, the ticket cites or the branch changed, plus the types and errors they use (PIP-012/R5)
    duration_s: 601
  - at: 2026-11-01T00:27:05.987Z
    role: spec-review
    result: done
    summary: Changed and cited units stay whole; other scenarios remain discoverable by ID, title and spec show
    verdict: approve
    assumed: []
    duration_s: 355
  - at: 2026-11-01T00:53:26.359Z
    role: tester
    result: done
    summary: Over-budget brief tests for steps 4-7 and changed/cited units; 13 fail now, old step-5 and S4-quoting tests updated
    verdict: null
    mutations:
      - scenario: PIP-012/S7
        wrong: lists every scenario and rule of an in-scope feature by title, including the ones the ticket's touches name
      - scenario: PIP-013/S3
        wrong: turns scenarios into title lines before decisions lose their Consequences
      - scenario: PIP-013/S4
        wrong: runs step 6 or 7 before step 5, or does steps 6 and 7 for every feature at once, or step 5 still drops a rule the ticket cites or the branch changed
      - scenario: PIP-013/S4
        wrong: step 4 and 7 cut a contract to (title only) although the ticket touches it or the branch changed it
      - scenario: PIP-013/S5
        wrong: at a tiny budget keeps the steps of every scenario, or drops a scenario's line altogether
      - scenario: PIP-013/S8
        wrong: lists the violated scenario PRV-002/S3 or the rule R2 it cites by title, or leaves the other scenarios and R1 out of the list
      - scenario: PIP-013/S9
        wrong: cuts the types ProviderId and DeliveryMeta that a kept scenario's contracts use, or keeps FallbackTriggered whole although only a listed scenario names it
      - scenario: PIP-013/S10
        wrong: lists the scenarios of every feature at once instead of the first feature alone, or keys a bare feature ID as keeping its scenarios
      - scenario: PIP-013/S11
        wrong: finds the branch's changes only for the tester, implementer and reviewer, so the spec-writer and spec review lose the scenario, or counts changes with no repository or base branch
    assumed:
      - new: Does step 4 spare the types and errors a kept contract uses?
        value: Yes. PIP-013/S9 quotes conversation.DeliveryMeta and providers.ProviderId whole after every cut, and step 4 runs before step 7, so step 4 must not cut them; today it does.
      - new: Which budgets do the S8 and S10 tests use?
        value: "Measured on today's code: tester BUG-301 is about 1210 tokens after five cuts (budget 1100); implementer TASK-101 is about 1975 after five cuts and 1760 with only PRV-001 listed (budget 1900)."
      - new: What counts as the ticket citing a contract?
        value: A contract in its touches (PROP-201 touches providers.ProviderId); a delta with the contract in changed counts as the branch changing it.
    duration_s: 1578
  - at: 2026-11-01T01:02:04.722Z
    role: implementer
    result: blocked
    summary: Steps 4-7 and branch delta done; 4 tests wrong, PROP-060 tester brief 123,638 B (was 201,222)
    verdict: null
    blockers:
      - text: "tests/core/brief-scenarios.test.ts 'PIP-012/S7 ... over budget' expects '### PRV-002: ...\\nFile: ' at budget 1; PIP-013/S5 says only the first feature keeps its File line once every cut is made"
        cites: [PIP-012/S7, PIP-013/S5]
        tests: true
      - text: tests/core/neighbours.test.ts and tests/cli/brief-changed.test.ts PIP-013/S11 assert the brief does not contain '- PRV-001/S4 Streams from gemini', but the tester, implementer and reviewer 'New in the spec' group prints '- PRV-001/S4 Streams from gemini (added)' (PIP-012/S2); assert on the line end or on the Features in scope group
        cites: [PIP-013/S11]
        tests: true
      - text: tests/cli/brief-changed.test.ts 'Without the base branch' runs 'git branch -m trunk', which renames the ticket branch and leaves main in place, so the merge base is found and PRV-001/S4 counts as changed; it must rename main ('git branch -m main trunk')
        cites: [PIP-013/S11]
        tests: true
    assumed:
      - new: Where does the 'Listed by title' hint go in a feature?
        value: At the end of the feature's section, after kept scenarios, rules and any other sections, with scenario lines then rule lines
      - new: What does step 5 do to a feature with no kept rule?
        value: Drops its Rules section, for every role, tester and spec-review included
      - new: Does the branch delta apply to bugs and tasks?
        value: No. briefFor computes it for proposals only, for every role; a bug or task changes no spec
    duration_s: 516
  - at: 2026-11-01T01:10:29.163Z
    role: tester
    result: done
    summary: Fixed the three test blockers (S5 File line, S11 line check, base-branch rename); full suite 1836 pass
    verdict: null
    mutations:
      - scenario: PIP-012/S7
        wrong: lists every scenario and rule of an in-scope feature by title, including the ones the ticket's touches name
      - scenario: PIP-013/S11
        wrong: finds the branch's changes only for the tester, implementer and reviewer, so the spec-writer and spec review lose the scenario, or counts changes with no repository or base branch
    passed: true
    assumed: []
    duration_s: 490
  - at: 2026-11-01T01:16:47.087Z
    role: reviewer
    result: done
    summary: Steps 6–7 preserve kept units; step 5 correctly drops empty later-feature Rules sections for every role
    verdict: approve
    assumed: []
    duration_s: 376
---
Measured on this repo (SELF-HOSTING P44b). `spec brief tester PROP-060` is 193,943 bytes after PROP-078, about 48,000 tokens against a tester budget of 4,000. By group: Features in scope 130,049 bytes, Contracts 36,445, Ticket 18,002, everything else under 4,000 each. Features in scope quotes every scenario and rule of every feature in the ticket's scope, and PIP-013 never cuts scenarios because they are required. So a ticket that touches ten features hands each stage the full text of all ten. The first live spec reviewer called such a brief oversized. Change: when a brief is over budget after today's cuts, Features in scope keeps in full the scenarios and rules the ticket's spec stage changed (the 'New in the spec' set) and the ones the ticket cites. Every other scenario and rule of an in-scope feature becomes one line, '<ID> <title>', with the `spec show` hint, cut in feature order until the brief fits. Contracts that no kept scenario names are cut the same way. Nothing the ticket changed or cites is ever cut.
