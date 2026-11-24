---
id: PROP-015
type: proposal
title: A screen's wrong-kind link gets a fix that fits screens
status: done
stage: null
touches: [LNT-008]
violates: []
depends_on: []
changed: [LNT-008, LNT-008/R4, LNT-008/S1, LNT-008/S2, LNT-008/S3, LNT-008/S4, LNT-008/S5, LNT-008/S6, LNT-008/S7, LNT-008/S8, LNT-008/S9, LNT-008/S10, LNT-008/S11, LNT-008/S12, LNT-008/S13]
questions: []
history:
  - at: 2026-10-29T22:01:12.224Z
    role: spec-writer
    result: done
    summary: "LNT-008: a screen's wrong-kind link gets a fix that points at shows or calls (S11 changed, S13 added)"
    verdict: null
    assumed:
      - new: What fix does a screen's wrong-kind link get?
        value: list alpha.Widget under shows; calls takes operation contracts, and list alpha.MakeWidget under calls; shows takes entity or type or event or error contracts
      - new: Does a screen that shows an operation get the screen fix too?
        value: "Yes: it gets the calls fix (LNT-008/S13), since today it gets the feature's provides and observes advice"
    duration_s: 656
  - at: 2026-10-29T22:33:03.004Z
    role: tester
    result: done
    summary: "LNT-008: 13 CLI tests in one file; S11 and S13 fail on the screen fix text, the other 11 pass now"
    verdict: null
    assumed:
      - new: Where does S2's step go so the cite is on line 15 of BET-001?
        value: a new And line before the When, so the When moves to line 16
      - new: How does ALP-001 invoke beta.Pay in its When (S7)?
        value: "the When step gains 'through beta.Pay'; beta.Pay is an operation with Output: beta.Order"
      - new: Where does the Applies to line sit in core/invariants.md (S4, S10)?
        value: "line 6, after Decisions: ADR-001"
      - new: What do beta.Paid (S12) and alpha.MakeWidget (S13) look like?
        value: "beta.Paid is a one-line event; alpha.MakeWidget is an operation with Output: alpha.Widget"
    duration_s: 1910
  - at: 2026-10-29T22:53:25.455Z
    role: implementer
    result: done
    summary: "LNT-008: a screen's wrong-kind link now points at shows or calls; S11 and S13 pass, 1007 tests green"
    verdict: null
    assumed: []
    duration_s: 1222
  - at: 2026-10-29T22:58:08.880Z
    role: reviewer
    result: done
    summary: "LNT-008 verified in memory; feature fix text unchanged; real-spec lint matches base: 0 errors, 3 warnings"
    verdict: approve
    assumed: []
    duration_s: 283
---
Review 2026-10-29, LNT-008#Q1: for a screen, the L004 fix points at shows or calls instead of the feature's writes/observes advice.
