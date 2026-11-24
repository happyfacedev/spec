---
id: PROP-108
type: proposal
title: check-report takes --report-file, as ticket advance does
status: done
stage: null
touches: [PIP-004, CLI-001]
violates: []
depends_on: []
changed: [CLI-001, CLI-001/R4, CLI-001/S1, CLI-001/S16, PIP-004, PIP-004/R10, PIP-004/R11, PIP-004/R12, PIP-004/S24, PIP-004/S25, PIP-004/S26, PIP-004/S27, PIP-004/S28, pipeline.CheckReport, pipeline.CheckReport.message, pipeline.CheckReport.reportFile, pipeline.UnreadableReportFile, pipeline.UnreadableReportFile.path]
questions: []
history:
  - at: 2026-11-01T21:01:57.144Z
    role: spec-writer
    result: done
    summary: check-report takes --report-file like ticket advance; unreadable path refused (exit 2); tests-running notice on stderr; stdin unchanged
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [CLI-001/S16, CLI-001/S12, PIP-004/S1, PIP-004/S2, PIP-004/S3, PIP-004/S27]
        reason: impact reaches PIP-018 and CLI-001, which are unchanged; advance with --report-file behaves as before (CLI-001/S12), and the usage text changed only in the two check-report lines
      - item: C2
        outcome: scenarios
        ids: [PIP-004/S24, PIP-004/S26]
        reason: a relative path is read from the project root as PIP-018/R1 says, and an absolute path gives the same result; a folder path is refused without an internal error; no platform or install axis is touched
      - item: C3
        outcome: scenarios
        ids: [PIP-004/S24, PIP-004/S25, CLI-001/S16, PIP-004/S28]
        reason: while stdin stays open and never closes, a file check still returns; a long test run says on stderr that it is running
      - item: C4
        outcome: scenarios
        ids: [PIP-004/S4, PIP-004/S5]
        reason: the file is read-only input from the caller, with the same trust as stdin; a forged role or ticket in it is refused exactly as on stdin, and check-report changes nothing
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S26]
        reason: a path that names no file, or one that cannot be read, is refused before any check, with exit 2 and nothing on stdout
      - item: C6
        outcome: scenarios
        ids: [PIP-004/S27, PIP-004/S1, PIP-004/S2, PIP-004/S3, CLI-001/S16]
        reason: without --report-file, stdin, stdout, JSON and exit codes are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no external tool or service is involved; today's behaviour was observed by running the project's current build on ticket advance (missing path: '<path> does not exist', exit 1; folder path: internal error, exit 2; both options: usage error) and on check-report (ignores --report-file and waits on stdin)"
    assumed:
      - new: Exit code and message when check-report is given a missing --report-file path
        value: stderr '<path> does not exist', stdout empty, exit 2 (usage-class failure, so it cannot be mistaken for exit 1, a refused report); ticket advance exits 1 for the same case today and is not changed
      - new: What check-report can wait on
        value: "only the project's test command for a done tester or implementer report; the notice is the stderr line 'tests: running the test command'. I found no lock that check-report takes, and no stdin-open notice is specified"
      - new: Message for a --report-file path that exists but cannot be read, such as a folder
        value: stderr starts with the path, with no 'internal error' and no stack trace; exact wording left to the implementer; exit 2
      - new: Whether check-report accepts '--report -' as advance does
        value: no; not asked for. The option is ignored and stdin is read, as today
    duration_s: 446
  - at: 2026-11-01T21:04:28.324Z
    role: spec-review
    result: done
    summary: Approved report-file input, failure handling, stderr notice and preserved stdin behaviour
    verdict: approve
    findings:
      - cites: [PIP-004/S26, pipeline.UnreadableReportFile, PIP-018/R1]
        text: "Follow-up: Document the intentional absent-path status difference for callers using both commands: check-report exits 2 before validation, while ticket advance retains its observed exit 1. Shared file resolution and precedence remain the compatibility promise."
        class: C9
    assumed: []
    duration_s: 146
  - at: 2026-11-01T21:50:44.309Z
    role: tester
    result: done
    summary: Tests for check-report --report-file (S24-S28), CLI-001/S16 and the changed S1 usage text; red on assertions
    verdict: null
    mutations:
      - scenario: PIP-004/S24
        wrong: reads the file but still waits for stdin to close before checking
      - scenario: PIP-004/S24
        wrong: resolves a relative --report-file against the current folder, not the project root
      - scenario: PIP-004/S25
        wrong: reads stdin and ignores --report-file, as check-report does today
      - scenario: PIP-004/S26
        wrong: a missing path prints the report-block problem or exits 1 instead of '<path> does not exist' and exit 2
      - scenario: PIP-004/S26
        wrong: a folder path surfaces an internal error with a stack trace
      - scenario: PIP-004/S27
        wrong: without --report-file, check-report stops reading stdin
      - scenario: PIP-004/S28
        wrong: writes the tests notice only after the test run ends, or not at all
      - scenario: PIP-004/S28
        wrong: writes the tests notice for a blocked, reviewer or spec-writer report that runs no test
      - scenario: CLI-001/S1
        wrong: the usage text keeps the old check-report line and the old --report-file option line
      - scenario: CLI-001/S16
        wrong: check-report --report-file still waits for stdin to close
    assumed:
      - new: How S28 observes 'written before the tests start'
        value: child process with a test command that sleeps 2s; the first stderr byte must arrive more than 1s before the exit
      - new: Where the report file sits in tests
        value: under .git/ (no check counts it as a tree change), as the advance tests do; the spec's reports/ folder name does not change the behaviour
    duration_s: 2773
  - at: 2026-11-01T21:56:27.352Z
    role: implementer
    result: blocked
    summary: check-report --report-file done; S24-S27, CLI-001/S16, usage pass; S28 test starts TASK-103 at reviewer, refused
    verdict: null
    blockers:
      - text: "the test for PIP-004/S28 (tests/cli/check-report-file.test.ts:237) starts TASK-103 directly in its reviewer stage with stage('TASK-103','reviewer'); ticket start refuses it (exit 1), as TASK-103 has no implementer stage yet (PIP-001: the next stage is implementer), so the test fails in its own setup before the done-reviewer check and the spec-writer check run. It must first run TASK-103's implementer stage and advance it (as advance-could-not-run.test.ts:422-425 does), or use a ticket already at reviewer"
        cites: [PIP-004/S28, PIP-001]
        tests: true
    assumed:
      - new: Message for a --report-file path that exists but cannot be read
        value: "<path> cannot be read: <first line of the system error>, stdout empty, exit 2"
      - new: Where the tests notice goes when the caller gives no live stderr (in-process run)
        value: "it leads the result's stderr, as advance's 'tests: reused' line does; the real process writes it at once"
    duration_s: 339
  - at: 2026-11-01T22:03:52.182Z
    role: tester
    result: done
    summary: Fixed the S28 test so TASK-103 reaches its reviewer stage through the implementer; check-report-file tests all pass
    verdict: null
    mutations:
      - scenario: PIP-004/S24
        wrong: reads the file but still waits for stdin to close before checking
      - scenario: PIP-004/S24
        wrong: resolves a relative --report-file against the current folder, not the project root
      - scenario: PIP-004/S25
        wrong: reads stdin and ignores --report-file, as check-report did before
      - scenario: PIP-004/S26
        wrong: a missing path prints the report-block problem or exits 1 instead of '<path> does not exist' and exit 2
      - scenario: PIP-004/S26
        wrong: a folder path surfaces an internal error with a stack trace
      - scenario: PIP-004/S27
        wrong: without --report-file, check-report stops reading stdin
      - scenario: PIP-004/S28
        wrong: writes the tests notice only after the test run ends, or not at all
      - scenario: PIP-004/S28
        wrong: writes the tests notice for a blocked, reviewer or spec-writer report that runs no test
      - scenario: CLI-001/S1
        wrong: the usage text keeps the old check-report line and the old --report-file option line
      - scenario: CLI-001/S16
        wrong: check-report --report-file still waits for stdin to close
    passed: true
    assumed:
      - new: How S28 observes 'written before the tests start'
        value: child process with a test command that sleeps 2s; the first stderr byte must arrive more than 1s before the exit
      - new: Where the report file sits in tests
        value: under .git/ (no check counts it as a tree change), as the advance tests do; the spec's reports/ folder name does not change the behaviour
    duration_s: 432
  - at: 2026-11-01T22:06:01.605Z
    role: reviewer
    result: done
    summary: "Changes requested: stream delegated test notices and reject empty report-file values as usage errors"
    verdict: changes
    findings:
      - cites: [PIP-004/S28, PIP-004/R12]
        text: "src/cli/run.ts:125-139 delegates plugin commands with spawnSync and piped stderr, returning the captured output only after the pinned CLI exits. Consequently the new tests-running notice reaches plugin callers after the tests finish, contrary to R12's live timing requirement. Forward delegated stderr live while preserving one JSON document on stdout and avoiding duplicate stderr. Add a plugin-to-pinned-launcher timing case: tests/cli/check-report-file.test.ts:97 launches src/cli/main.ts directly, so its S28 timing assertions pass despite this failure on the normal plugin path."
        tests: true
        class: C3
      - cites: [PIP-004/R11, CLI-003/R2]
        text: src/cli/args.ts:93-96 accepts an empty string for --report-file (both --report-file= and --report-file with an empty quoted value), and line 162 preserves it. src/cli/report.ts:227 then resolves it to the project directory and reports a filesystem read failure rather than the required option-without-value usage error. Reject the empty value before command execution with the needs-a-value diagnostic, usage text, empty stdout and exit 2. Add coverage for both empty-value spellings; S26 currently covers absent paths and directories only.
        tests: true
        class: C5
    assumed: []
    duration_s: 128
  - at: 2026-11-01T22:16:40.311Z
    role: tester
    result: done
    summary: Added S28 plugin-launcher stderr timing test and S26 empty --report-file value tests; both red on assertions
    verdict: null
    mutations:
      - scenario: PIP-004/S26
        wrong: an empty --report-file value (--report-file= or --report-file '') is read as a path and fails with a filesystem error instead of '--report-file needs a value' and exit 2
      - scenario: PIP-004/S26
        wrong: an empty --report-file value is taken as no file, so the report is read from stdin and checked
      - scenario: PIP-004/S28
        wrong: the plugin launcher buffers the pinned CLI's stderr until it exits, so the tests notice reaches the caller only after the run
      - scenario: PIP-004/S28
        wrong: through the launcher, stdout gets the notice or other text, so --format json is no longer one ReportCheck
    assumed:
      - new: Which launcher the S28 plugin test runs
        value: plugin/scripts/spec from this repo, started on a gitFixture project whose .spec/bin holds the repo's plugin/scripts copy (installPinnedCli), so the launcher defers to that pinned CLI
    duration_s: 636
  - at: 2026-11-01T22:28:12.394Z
    role: implementer
    result: done
    summary: Plugin launcher streams the pinned CLI's stderr live (non-hook); empty --report-file refused as needs a value
    verdict: null
    assumed:
      - new: Which delegated commands stream stderr live
        value: every command except hook; a hook's stderr stays captured because the fail-open decisions (INS-016/R19) and the unknown-hook-event check read it
    duration_s: 690
  - at: 2026-11-01T22:29:38.033Z
    role: reviewer
    result: done
    summary: "Approved: delegated notices stream live, empty report-file values are refused, and launcher capture stays intact"
    verdict: approve
    assumed: []
    duration_s: 84
---
Self-hosting finding P77, decided by the person on 2026-11-01. The shipped role prompts (PROP-103) tell every stage to save its report to the named file and run `spec check-report <role> <ID>` until 'report ok'. check-report reads only stdin and silently ignores `--report-file`: `spec check-report reviewer PROP-107 --report-file reports/PROP-107-r.md` answers 'the final message has no ```report block' even though the file holds a valid report. Three subagents could not run the check the prompts ask for. Make check-report accept `--report-file <path>` with the same meaning and precedence as `ticket advance --report-file` (PIP-018/R1), and refuse an unknown or unreadable path with a clear error. Keep stdin as before. If check-report can wait on something (a lock, a test run), it says so on stderr so a caller is not left guessing.
