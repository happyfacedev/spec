---
id: PROP-011
type: proposal
title: A second init prints one note for settings
status: done
stage: null
touches: [INS-004]
violates: []
depends_on: []
changed: [INS-004, INS-004/S1, INS-004/S2, INS-004/S3, INS-004/S4, INS-004/S5, INS-004/S6]
questions: []
history:
  - at: 2026-10-29T11:14:42.621Z
    role: spec-writer
    result: done
    summary: INS-004/S3 settings skip line drops "(exists)"; INS-004 answer loses stale clause; lint clean.
    verdict: null
    assumed:
      - new: install.Installation text-output sentence still says skipped <path> (exists); changing the contract pulls INS-001 into the must-change ring, which PROP-011 does not list
        value: contract prose left unchanged; INS-004/S3 states the settings line form
  - at: 2026-10-29T11:19:26.164Z
    role: tester
    result: done
    summary: INS-004 S1-S6 tests in init.test.ts; only INS-004/S3 fails, on the settings line still carrying "(exists)".
    verdict: null
    assumed:
      - new: "INS-004/S4: 'every other installed file is skipped' excludes the R1 exceptions spec/index.md and spec/_generated/graph.json"
        value: excluded, as R1 names them exceptions
      - new: "INS-004/S4: the settings skip is checked as a line starting 'skipped .claude/settings.json', not the exact S3 wording"
        value: prefix check, so S4 does not depend on the S3 change
      - new: "INS-004/S6: the failing spec is a stray spec/stray.md, which parses to L002 and so fails the build"
        value: one stray .md file in no known spec folder
      - new: The existing second-init test is renamed to INS-004/S1; its S2 check moves to its own test, and its JSON settings-skip assertion is kept under S1
        value: one test per scenario, existing coverage kept
  - at: 2026-10-29T11:23:14.485Z
    role: implementer
    result: done
    summary: INS-004/S3 settings skip line drops (exists); full suite 504/504 passes, typecheck and lint clean
    verdict: null
    assumed:
      - new: install.Installation text output says every skip is 'skipped <path> (exists)', but INS-004/S3 says the settings line has no (exists); the contract prose is not updated
        value: settings line follows INS-004/S3; the contract prose stays as the spec-writer recorded
      - new: "INS-004/S1 fails when run alone (spec test INS-004/S1): it reads spec/core/overview.md from the install made by the earlier test 'installs the skill...', which the -t name filter skips; the full spec test run passes 504/504"
        value: test left unchanged, since test files belong to the tester; the full run is the gate
  - at: 2026-10-29T11:25:28.952Z
    role: reviewer
    result: done
    summary: "approve: INS-004 S1-S6 and R1 hold in src/cli/init.ts; S1 test relies on an earlier install (non-blocking)."
    verdict: approve
    assumed:
      - new: spec show INS-004 was refused by the permission system; can the spec be read from its files instead?
        value: Yes; read spec/modules/install/features/INS-004-never-overwrite-on-a-second-init.md and contracts.md, which match the brief
      - new: Should the install.Installation text-output sentence in spec/modules/install/contracts.md be updated in this ticket?
        value: No; it is not on the checklist and INS-004/S3 with INS-004#Q1 govern the settings line; logged as a spec follow-up
      - new: Can the reviewer re-run the suite?
        value: "Not re-run: the build writes dist/ and generated assets; the implementer's 504/504 result is taken as the gate"
---
Review 2026-10-29, INS-004#Q1: the line reads "skipped .claude/settings.json (hooks already present)" without the extra "(exists)".
