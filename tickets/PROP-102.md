---
id: PROP-102
type: proposal
title: An XML test report with no JUnit test cases is not a test result
status: done
stage: null
touches: [PIP-010]
violates: []
depends_on: [PROP-101]
changed: [PIP-009, PIP-010/R3, PIP-010/S6, PIP-010/S12, PIP-010/S13, PIP-010/S14, PIP-023, PIP-023/R1, PIP-023/S1, PIP-023/S2, PIP-023/S3, PIP-023/S4, pipeline.NoTestResults]
questions: []
history:
  - at: 2026-11-01T17:28:39.272Z
    role: spec-writer
    result: done
    summary: XML that is not a complete JUnit report gives pipeline.NoTestResults; an empty complete JUnit report is a valid zero-test run.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13, PIP-010/S14, ADP-003/S4, PIP-006/S16]
        reason: spec impact reaches pipeline.NoTestResults; ADP-003/S4 and PIP-006/S16 do not involve XML reports and stay true. The new scenarios add NoTestResults causes only for malformed XML.
      - item: C2
        outcome: na
        ids: []
        reason: "No path, install layout, platform or upgrade axis: the change reads the report text only."
      - item: C3
        outcome: na
        ids: []
        reason: One report is read once after the test command ends; no state is shared across an await or process boundary.
      - item: C4
        outcome: na
        ids: []
        reason: The report is the project's own test command output. A forged report is no new risk, and an unreadable XML report now refuses instead of passing (INV-002).
      - item: C5
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13]
        reason: Non-JUnit XML and XML cut off before its root closes are refused with pipeline.NoTestResults.
      - item: C6
        outcome: scenarios
        ids: [PIP-010/S6, PIP-010/S10, PIP-010/S14]
        reason: A complete JUnit report reads exactly as before, and a zero-test JUnit report stays a zero-test run, as an empty vitest or jest report is.
      - item: C8
        outcome: na
        ids: []
        reason: No new fact about another tool; JUnit's root is testsuites or testsuite, as S6 already shows.
    documents: [PIP-010/S14]
    assumed:
      - new: What does an empty but valid JUnit report (a testsuite with zero testcases) mean?
        value: "A valid run of zero tests with no error, as an empty vitest or jest JSON report is today (checked on the current build: exit 0, tests [], error null). Later stages' no-test-covers checks catch missing coverage."
      - new: What counts as JUnit XML?
        value: Root element testsuites or testsuite, closed. Anything else (an HTML page, a different root, a truncated file) gets one reason, 'the XML test report is not a complete JUnit report'.
    duration_s: 182
  - at: 2026-11-01T17:31:33.175Z
    role: spec-review
    result: done
    summary: Zero-test validity leaves implementer stages accepting changed scenarios without any tests running.
    verdict: changes
    findings:
      - cites: [PIP-010/S14, PIP-010/R3, PIP-006/R1, PIP-006/R5]
        text: "S14 explicitly accepts an empty JUnit report, but the claimed later no-test-covers safeguard does not protect implementer stages: PIP-006/R1 checks coverage only for testers, while R5 accepts an implementer's exit-0 run with no failed tests. After a successful tester stage, an implementer whose test discovery stops finding tests can therefore pass with tests [], error null, even when scenarios changed. Resolve this interaction before declaring zero tests valid: retain parser-level validity only with an implementer safeguard for expected scenarios, or revise the zero-test decision. Cover that implementer case explicitly."
        class: C5
    assumed: []
    duration_s: 171
  - at: 2026-11-01T17:34:49.179Z
    role: spec-writer
    result: done
    summary: Non-JUnit XML is no result; an empty JUnit report is zero tests, but an implementer needs a test per delivered scenario.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13, PIP-010/S14, ADP-003/S4, PIP-006/S16, PIP-006/S8, PIP-023/S1]
        reason: spec impact reaches pipeline.NoTestResults; ADP-003/S4 and PIP-006/S16 involve no XML report and stay true. PIP-006/S8 (implementer needs a passing run) is unchanged, and PIP-023 adds the coverage check beside it.
      - item: C2
        outcome: na
        ids: []
        reason: "No path, install layout, platform or upgrade axis: the change reads the report text and the run's test names only."
      - item: C3
        outcome: na
        ids: []
        reason: One report is read once after the test command ends; no state is shared across an await or process boundary.
      - item: C4
        outcome: na
        ids: []
        reason: The report is the project's own test command output. A forged report is no new risk, and an unreadable XML report now refuses instead of passing.
      - item: C5
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13, PIP-023/S1, PIP-023/S2]
        reason: Non-JUnit XML and XML cut off before its root closes are refused with pipeline.NoTestResults; a zero-test run cannot carry an implementer stage whose scenarios have no test.
      - item: C6
        outcome: scenarios
        ids: [PIP-010/S6, PIP-010/S10, PIP-010/S14, PIP-023/S3, PIP-023/S4]
        reason: A complete JUnit report reads as before, a zero-test JUnit report stays a zero-test run, and an implementer run that covers its scenarios, or a task naming none, is accepted as before.
      - item: C8
        outcome: na
        ids: []
        reason: No new fact about another tool; JUnit's root is testsuites or testsuite, as S6 already shows.
    documents: [PIP-010/S14]
    assumed:
      - new: What does an empty but valid JUnit report (a testsuite with zero testcases) mean?
        value: "A valid run of zero tests with no error, as an empty vitest or jest JSON report is today (checked on the current build: exit 0, tests [], error null). The implementer stage no longer passes on it when its ticket has scenarios (PIP-023/R1)."
      - new: What counts as JUnit XML?
        value: Root element testsuites or testsuite, closed. Anything else (an HTML page, a different root, a truncated file) gets one reason, 'the XML test report is not a complete JUnit report'.
      - new: Which scenarios must an implementer's run cover, and what of the reviewer?
        value: Those the ticket violates and those its branch added or changed, with the tester's problem text; a task naming none needs none. The reviewer's done report runs no tests (PIP-006/S10), and an implementer stage must pass first, so no reviewer-side check is added. PIP-006 is at its 250-line budget, so the check is a new feature, PIP-023, which says it applies besides PIP-006/R5.
    duration_s: 191
  - at: 2026-11-01T17:36:39.545Z
    role: spec-review
    result: done
    summary: PIP-023 closes the zero-test implementer gap; light lanes and hand-offs retain coverage guards.
    verdict: approve
    assumed: []
    duration_s: 106
  - at: 2026-11-01T18:32:22.904Z
    role: tester
    result: done
    summary: Tests for PIP-010/S12-S14 and PIP-023/S1-S4; S12, S13, S1, S2 fail on assertions, S14, S3, S4 pass now
    verdict: null
    mutations:
      - scenario: PIP-010/S12
        wrong: reads any text starting with '<' as JUnit and returns zero tests for an HTML page
      - scenario: PIP-010/S13
        wrong: accepts a testsuites root that is never closed and returns the testcases found so far
      - scenario: PIP-010/S14
        wrong: treats a complete JUnit report with no testcase as pipeline.NoTestResults
      - scenario: PIP-023/S1
        wrong: checks no coverage for an implementer stage, so a run with no tests passes
      - scenario: PIP-023/S2
        wrong: checks only added or changed scenarios and ignores the scenarios a bug violates
      - scenario: PIP-023/S3
        wrong: counts only a failing or skipped test as covering, so a passing test is refused
      - scenario: PIP-023/S4
        wrong: demands a test for every in-scope scenario of a task that names none
    assumed: []
    duration_s: 3325
  - at: 2026-11-01T19:04:52.505Z
    role: implementer
    result: done
    summary: XML counts as JUnit only with a closed testsuites/testsuite root; an implementer run needs a test per delivered scenario; bundles rebuilt
    verdict: null
    assumed: []
    duration_s: 1946
    refusals: 1
  - at: 2026-11-01T19:06:41.866Z
    role: reviewer
    result: done
    summary: Coverage guards hold, but JUnit validation rejects trailing comments and accepts extra documents.
    verdict: changes
    findings:
      - cites: [PIP-010/R3, PIP-010/S6]
        text: 'src/core/test-report.ts:125 rejects a complete JUnit document followed by a legal XML comment: <testsuite><testcase name="works"/></testsuite><!-- end --> returns NoTestResults. Accept legal trailing XML comments and processing instructions; add regression coverage.'
        tests: true
        class: C6
      - cites: [PIP-010/R3, pipeline.NoTestResults]
        text: src/core/test-report.ts:125 accepts multiple root documents, and a self-closing first root bypasses suffix validation entirely. <testsuite/><testsuite><testcase name="incomplete"/> returns a passing test from the truncated second document. Validate one complete JUnit document and reject extra roots or truncated suffixes; add regression coverage.
        tests: true
        class: C5
    assumed: []
    duration_s: 105
  - at: 2026-11-01T19:26:59.328Z
    role: tester
    result: done
    summary: Regressions for JUnit trailing comment/PI (S6) and extra or truncated roots (S13); four tests fail on assertions now
    verdict: null
    mutations:
      - scenario: PIP-010/S6
        wrong: requires the report to end at the closing root tag, so a trailing comment or processing instruction gives NoTestResults
      - scenario: PIP-010/S13
        wrong: validates only the text after the first root's close, so a self-closing first root or a second complete root lets extra or truncated documents pass
    assumed: []
    duration_s: 1213
  - at: 2026-11-01T19:38:02.067Z
    role: implementer
    result: done
    summary: XML is JUnit only as one complete testsuites/testsuite document; a second or truncated root is refused; an implementer run needs a test per delivered scenario; bundles rebuilt
    verdict: null
    assumed: []
    duration_s: 658
  - at: 2026-11-01T19:44:19.030Z
    role: reviewer
    result: done
    summary: Both XML findings resolved; 37 tests and representative JUnit probes pass.
    verdict: approve
    assumed: []
    duration_s: 374
    refusals: 1
---
Found by PROP-101's reviewer. PIP-010/R3 reads any report text starting with '<' as JUnit XML, and parseTestReport (src/core/test-report.ts) returns the testcases it finds. XML that is not a JUnit report (a different root, an HTML error page, a truncated file) therefore reads as zero tests, and an implementer stage whose test command exits 0 can pass with no real test result, against INV-002's intent. Make a report whose XML holds no JUnit testsuite/testcase structure a report with no results (pipeline.NoTestResults, with a clear error), and decide what an empty but valid JUnit report (a testsuite with zero testcases) means. After PROP-101, such a run is a 'check that could not run' rather than an accepted stage.
