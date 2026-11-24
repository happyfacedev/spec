---
id: PROP-064
type: proposal
title: lint refuses a scenario, rule or lint-rule ID reused with a different meaning than on the base branch
status: done
stage: null
touches: [LNT-001, FMT-003, FMT-004]
violates: []
depends_on: []
changed: [CLI-001/S1, FMT-003/S1, FMT-003/S2, FMT-003/S3, FMT-003/S4, FMT-003/S5, FMT-003/S6, FMT-003/S7, FMT-003/S8, FMT-003/S9, FMT-003/S10, FMT-004, FMT-004/S1, FMT-004/S2, FMT-004/S3, FMT-004/S4, FMT-004/S5, FMT-004/S9, INV-001, INV-007, LNT-018, LNT-018/R1, LNT-018/R2, LNT-018/R3, LNT-018/R4, LNT-018/R5, LNT-018/S1, LNT-018/S2, LNT-018/S3, LNT-018/S4, LNT-018/S5, LNT-018/S6, lint.Lint, lint.Lint.base, lint.Lint.ci, lint.RuleCode]
questions:
  - id: Q1
    kind: blocker
    text: "tests/core/lint-cases.test.ts fails 'L035 id-reuse: missing lint case for L035' now that L035 is in the rule table (LNT-018 asks for it). L035 needs git, so lintSpec cannot produce it from a spec overlay: the fix is a PENDING entry (L035: 'CLI level: tests/cli/lint-base.test.ts') in that test file, which the tester owns. npm run check passes otherwise (125 of 126 test files; typecheck, lint and build ok). Its changes are kept in git stash \"PROP-064 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [LNT-018, LNT-001, INV-007]
    answer: "Yes: the tester adds the L035 PENDING entry and the INV-007 rule-table test."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: 'git stash "PROP-064 implementer: blocked" does not apply to ticket/PROP-064: it conflicts in .spec/bin/spec.cjs, plugin/scripts/spec.cjs. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: "Restored by hand: the stash now holds only the non-generated files (including the two untracked ones); rebuild bundles after it applies."
    raised_by: implementer
history:
  - at: 2026-10-31T14:06:22.516Z
    role: spec-writer
    result: done
    summary: "New LNT-018 (L035): lint --base/--ci reports IDs a branch reuses or drops against its base; INV-007 for lint codes"
    verdict: null
    documents: [LNT-018/S5]
    assumed:
      - new: How is a reused ID told apart from a renamed one, given the ticket's 'wording-only title edit declared by the ticket's changed list' cannot be judged by a tool and changed is filled by the CLI?
        value: "Three-way comparison: an ID the merge base already has is one unit on both sides, so any change or rename is a change (governed by PIP-007); an ID the merge base lacks that the base tip and the working tree define differently (scenario title, rule text, other unit text, whitespace ignored) is a reuse, L035 error (LNT-018/R1, R2)."
      - new: Which units does the comparison cover?
        value: Every spec unit; messages name titles for scenarios and rules, and say 'defined differently' for others (LNT-018/S2).
      - new: "Lint rule codes are the CLI's own, not spec units: how does lint see their meaning?"
        value: "INV-007 with Shown by: a CI test comparing each code's name in the rule table with the base branch's; spec lint itself does not read the CLI source."
      - new: The ticket says spec-writer and spec-review checklists reference the check; there is no spec-review role.
        value: "Not pinned in the spec: role prompt wording is left to the implementer; the spec states the lint behaviour the prompts can point at."
      - new: Where is a dropped unit reported, and with which code?
        value: L035 at line 1 of its feature's file (scenario or rule) or of the file that held it (other units) (LNT-018/R3).
      - new: --ci without git or without the base branch
        value: compares nothing and reports nothing, so existing --ci scenarios outside git are unchanged (LNT-018/R4).
      - new: Base with no merge base in common with HEAD
        value: compared as if the merge base held no units; not pinned by a scenario.
    duration_s: 445
  - at: 2026-10-31T14:54:49.417Z
    role: tester
    result: done
    summary: LNT-018 S1-S6 tests (S5 passes now), CLI-001/S1 usage updated, FMT-003 and FMT-004 scenarios newly covered
    verdict: null
    assumed:
      - new: How are the spec's doubled apostrophes in L035 messages read?
        value: As YAML-style escapes of one apostrophe, so messages are tested with single quotes
      - new: Is INV-007 tested here?
        value: No. It has no scenario, so its CI rule-table comparison test is left to the implementer
    duration_s: 816
  - at: 2026-10-31T15:25:34.901Z
    role: implementer
    result: blocked
    summary: L035 built and LNT-018 S1-S6 pass; tests/core/lint-cases.test.ts needs an L035 entry only the tester may add
    verdict: null
    assumed:
      - new: May the implementer add the INV-007 rule-table test in tests/?
        value: "No: on a proposal the tester owns tests/, so the CI test comparing each code's name in RULES with the base branch's is not added; the tester should add it"
      - new: What does a dropped unit's fix and the comparison of a feature or contract cover?
        value: A feature is compared by title, module and intent and a contract by its own text without its members, since their scenarios, rules and members are units of their own; every dropped unit is reported, a dropped feature's scenarios and rules too
      - new: --base given outside a git repository
        value: Refused with exit 2 as '--base <ref> is not a commit in this repository'; only --ci compares nothing outside git
    duration_s: 1842
  - at: 2026-10-31T15:25:36.272Z
    role: tester
    result: reopened
    summary: reopened by PROP-064#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T15:32:52.767Z
    role: tester
    result: done
    summary: L035 added to the lint-cases PENDING list; INV-007 rule-table test added in tests/core/rule-codes.test.ts
    verdict: null
    assumed:
      - new: What does the INV-007 test do when the base branch is missing (shallow clone, fresh repo)?
        value: It returns without comparing, as LNT-018/R4 does for --ci
    duration_s: 435
  - at: 2026-10-31T16:07:18.255Z
    role: implementer
    result: done
    summary: lint --base/--ci report reused and dropped IDs as L035; usage, rule table and workflow doc updated; check passes
    verdict: null
    assumed:
      - new: What does the comparison cover for a feature or a contract, and which dropped units are reported?
        value: A feature is compared by title, module and intent and a contract by its own text without its members, since scenarios, rules and members are units of their own; every dropped unit is reported, a dropped feature's scenarios and rules too
      - new: --base given outside a git repository
        value: Refused with exit 2 as '--base <ref> is not a commit in this repository'; only --ci compares nothing outside git
      - new: Base with no merge base in common with HEAD
        value: Compared as if the merge base held no units
    duration_s: 1760
  - at: 2026-10-31T16:22:50.801Z
    role: reviewer
    result: done
    summary: L035 scenarios work, but feature text collisions are missed and the rule-code check skips PR CI
    verdict: changes
    findings:
      - cites: [LNT-018/R1, INV-001]
        text: src/core/lint/base.ts:16-18 compares features only by title, module and intent, although R1 requires other units to be compared by text. Two branches adding ALP-002 with identical title/intent/scenario titles but different provides declarations (alpha.Sell versus alpha.Paint) produce no L035; reproduced with parsed feature indexes. Feature frontmatter and Out of scope differences are silently ignored. Compare the feature's text as specified and add a regression test for this collision.
        tests: true
      - cites: [INV-007]
        text: tests/core/rule-codes.test.ts:18-20 silently passes when the local base branch is absent. The PR job in .github/workflows/ci.yml:15 uses actions/checkout defaults (a shallow detached PR merge checkout, without local main), so the new invariant's comparison never runs in PR CI, precisely where concurrent rule-code collisions must be caught before merging. Make the CI checkout provide the base ref and make the test actually compare it; do not silently treat that CI setup failure as success.
        tests: true
    assumed: []
    duration_s: 928
  - at: 2026-10-31T16:32:44.844Z
    role: tester
    result: done
    summary: Feature link-collision regression test (fails now); INV-007 test fails under CI when base is unreadable
    verdict: null
    assumed:
      - new: Which feature field differs in the collision test?
        value: writes (alpha.Widget vs alpha.WidgetMade), since provides needs an operation contract; src/core/lint/base.ts meaning() ignores all link fields
      - new: Who changes the CI workflow?
        value: The implementer must make the PR job in .github/workflows/ci.yml fetch the base (fetch-depth 0 or fetching the base ref), or the INV-007 test now fails there
    duration_s: 590
  - at: 2026-10-31T16:43:30.632Z
    role: implementer
    result: done
    summary: L035 compares a feature by its text with links; CI fetches the full base history and a local main; check passes
    verdict: null
    assumed:
      - new: What does the comparison cover for a contract, and which dropped units are reported?
        value: A contract is compared by its own text without its members, which are units of their own; every dropped unit is reported, a dropped feature's scenarios and rules too
      - new: --base given outside a git repository
        value: Refused with exit 2 as '--base <ref> is not a commit in this repository'; only --ci compares nothing outside git
      - new: Base with no merge base in common with HEAD
        value: Compared as if the merge base held no units
      - new: Which CI jobs fetch the base?
        value: "Only the check job, which runs the tests: fetch-depth 0 and git fetch origin main:main when no local main exists. runtime-node20 runs no tests and its lint --ci compares nothing without a local main, so it is unchanged"
    duration_s: 642
  - at: 2026-10-31T16:44:56.891Z
    role: reviewer
    result: done
    summary: "Both findings resolved: feature text and links are compared, and PR CI supplies and requires the base branch"
    verdict: approve
    assumed: []
    duration_s: 84
---
From the S2b review (docs/PROCESS-LEDGER.md): a change reused scenario IDs (INS-007/S5, LNT-003/S10-S12, WSP-006/S14) and a lint rule ID (L027) for different behaviour, against FORMAT.md's rule that an ID is never reused. Nothing caught it until a human-style review.

`spec lint --base <ref>` (and `--ci`, which uses the configured base branch) compares every scenario, rule and contract ID that exists on both the base and the working tree: when its title changed and the old title is not a wording-only edit (the change must be declared by the ticket's `changed` list or the unit's `retired`/`superseded_by`), lint reports an error naming the base title and the new one. A scenario removed on the working tree must appear in the unit's `retired` list. Lint rule IDs: the rule table records each ID's meaning; changing it is an error. The spec-writer and spec-review checklists reference the check.
