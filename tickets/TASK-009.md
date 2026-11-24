---
id: TASK-009
type: task
title: SELF-HOSTING has an entry for every finding number a ticket cites
status: done
stage: null
touches: [INS-014]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-11T12:26:35.976Z
    role: implementer
    result: done
    summary: Added reconstructed findings and corrected citations and batch 8 measurements
    verdict: null
    assumed: []
    duration_s: 698
    refusals: 1
  - at: 2026-11-11T12:28:03.779Z
    role: reviewer
    result: done
    summary: "Approved: P39, P43, P44b match their tickets and are marked reconstructed; INS-014 and merge facts hold"
    verdict: approve
    findings:
      - cites: [INS-014/S15]
        text: "Follow-up: docs/SELF-HOSTING.md P44b gives PROP-060's tester brief as 193,943 bytes after PROP-078 (PROP-082's ticket text), while the Briefs bullet just above it says a 200 KB brief and PROP-082's own implementer record says 201,222 bytes; the ticket gives no moment for either figure, so a reader may think they conflict. One clause naming them as separate measurements would settle it."
        class: C9
      - cites: [INS-014/S15]
        text: "Follow-up: the edit to the P42 bullet drops its lead-in 'implementers blocked on test-side defects'; the new P39 entry now carries that story, so nothing is wrong, but the bullet no longer names its subject."
        class: C9
    assumed: []
    duration_s: 80
---
Follow-up from TASK-005's review (2026-11-10). Three finding numbers are cited by tickets and appear nowhere in docs/SELF-HOSTING.md: P39 (cited by PROP-076), P43 (PROP-083) and P44b (PROP-082). They were already missing before TASK-005. Every other P, I, A and R number a ticket cites is present. What I want: a one-line entry for each of the three under the batch it belongs to, written from what the citing ticket and its history say the finding was, and marked as reconstructed from that ticket; if a ticket does not say enough to state the finding, say so in the entry rather than guessing. No behaviour changes.
