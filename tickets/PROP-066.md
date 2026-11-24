---
id: PROP-066
type: proposal
title: spec init writes a project marker in the common git dir; the edit guard and pull hook use it
status: done
stage: null
touches: [INS-015, INS-016]
violates: []
depends_on: []
changed: [INS-016, INS-016/R10, INS-016/R11, INS-016/R13, INS-016/S8, INS-016/S10, INS-016/S11]
questions:
  - id: Q1
    kind: blocker
    text: 'The INS-016/S10 test (tests/cli/enforcement.test.ts:1004-1010) removes spec/config.json, then expects a Write to src/new.ts to be denied by the marker alone. With no config, ws.config is null and codeGlobs is empty, so src/new.ts is not governed and the hook allows it before it checks ownership. With the marker present, a governed spec/ path is denied (checked by hand). The brief does not say what is governed when config.json is missing, and making src/** governed by default is new behaviour I will not invent. Ruling needed: either the test deletes something other than config.json or targets a spec/ path, or the spec states default governed globs when config.json is absent. Its changes are kept in git stash "PROP-066 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites: [INS-016/S10, INS-016/R10, INS-016/R13, INS-015/R1]
    answer: "The test is wrong: with config.json gone no globs apply. The tester makes S10's marker-only case target a spec/ path (governed without config), or keeps config.json and removes the other ownership evidence instead. No default globs are added."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: 'git stash "PROP-066 implementer: blocked" does not apply to ticket/PROP-066: it conflicts in .spec/bin/spec.cjs, plugin/scripts/spec.cjs. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: Re-stashed without the two generated bundles; the implementer rebuilds them.
    raised_by: implementer
history:
  - at: 2026-10-31T14:12:10.233Z
    role: spec-writer
    result: done
    summary: INS-016 gains a project marker (S10, R10, R13) and a pull hook that does not re-validate history (S11, R11)
    verdict: null
    assumed:
      - new: Does spec upgrade also write the marker for projects initialised before this change?
        value: yes, whenever the project is in a Git repository (R10, S10)
      - new: Which path is the marker keyed by?
        value: the project path relative to the work-tree root with symlinks resolved, so it is shared across linked worktrees and survives moving the repository; the hash and file contents are not pinned
      - new: Should the pull hook still refuse in a shallow repo or with an unresolvable enforceSince once it stops calling verify-history?
        value: yes, fail closed with 'could not validate incoming history', as today
      - new: Does the pull hook collect used IDs from side histories of older pulls too?
        value: no, first-parent commits only, as R11 already said
      - new: What does spec init do outside a Git repository?
        value: writes no marker and does not fail
    duration_s: 327
  - at: 2026-10-31T14:41:35.597Z
    role: tester
    result: done
    summary: Added INS-016 S10 (marker) and S11 (pull hook used IDs) tests; S10 fails now, S8 tests kept; lint and typecheck clean
    verdict: null
    assumed:
      - new: How is S11 'history cannot validate' simulated?
        value: older local commits made with --no-verify (invalid ticket merge, unknown ticket trailer, forged bypass trailer)
      - new: How is S11 shallow / unresolvable enforceSince driven?
        value: pull --no-commit, then write .git/shallow or a bad enforceSince in the working-tree config, then git commit
      - new: What does a marker look like to the tests?
        value: any entry under <git-common>/spec/projects/; tests count entries (exactly one) and do not read the name or content
    duration_s: 1762
  - at: 2026-10-31T14:52:27.742Z
    role: implementer
    result: blocked
    summary: Marker and pull-hook code done; S10 test removes config.json then expects src/new.ts denied, which has no governed glob
    verdict: null
    assumed:
      - new: What is the marker file name and content?
        value: "sha256 of the project path relative to the work-tree root ('.' for the root), first 32 hex chars, containing {path: <rel>}; write errors are swallowed"
      - new: Where is the marker checked?
        value: in projectOwnsGitRoot, against the realpath of ws.projectRoot relative to the target Git toplevel
    duration_s: 649
  - at: 2026-10-31T14:52:31.118Z
    role: tester
    result: reopened
    summary: reopened by PROP-066#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T15:18:18.248Z
    role: tester
    result: done
    summary: S10 marker-only edit now targets a governed spec/ path; S10 tests fail on missing marker only; lint, typecheck clean
    verdict: null
    assumed:
      - new: Which governed path does the marker-only case edit?
        value: spec/modules/install/_module.md, governed without config, for the copy and original project
    duration_s: 1543
  - at: 2026-10-31T15:25:32.233Z
    role: implementer
    result: done
    summary: Project marker written by init and upgrade and counted as ownership; pull hook checks only incoming commits; npm run check passes
    verdict: null
    assumed:
      - new: What is the marker file name and content?
        value: "sha256 of the project path relative to the work-tree root ('.' for the root), first 32 hex chars, containing {path: <rel>}; write errors are swallowed"
    duration_s: 406
  - at: 2026-10-31T15:41:26.131Z
    role: reviewer
    result: done
    summary: Request S11 validation-error regression coverage; runtime trust-boundary checks pass
    verdict: changes
    findings:
      - cites: [INS-016/S11, INS-016/R11]
        text: tests/cli/enforcement.test.ts:1117-1130 labels its case as older history that cannot validate, but the unknown ticket and invalid side trailer produce offenders, not verifyHistory.error. The baseline pull hook already accepts that history; reinstating the removed verifyHistory call therefore passes every S11 case. Add an older-only validation-error regression using the existing failGit helper to fail an older merge's merge-tree check while incoming documentation remains clean. Assert verify-history returns an error and the installed pull hook still accepts the incoming merge. This should fail with the baseline implementation and pass with this change; the implementation already passed an equivalent manual probe.
        tests: true
    assumed: []
    duration_s: 952
  - at: 2026-10-31T16:00:58.674Z
    role: tester
    result: done
    summary: Added INS-016/S11/S6, an older merge-tree failure is a history error and the installed pull hook still accepts a clean pull
    verdict: null
    assumed:
      - new: Is the baseline failure of the new test verified?
        value: no, not run on baseline; it should fail there because the old hook re-validates history and hits the merge-tree error
    duration_s: 1169
  - at: 2026-10-31T16:12:51.310Z
    role: implementer
    result: done
    summary: No code change needed; S11 validation-error test (S11/S6) passes; npm run build and npm run check green.
    verdict: null
    assumed: []
    duration_s: 707
  - at: 2026-10-31T16:19:23.746Z
    role: reviewer
    result: done
    summary: S11/S6 covers the older validation-error regression; all six S11 tests and lint pass
    verdict: approve
    assumed: []
    duration_s: 385
---
From the S3 final review (U2, U3). (1) A subfolder project whose parent repo has no commits and an external core.hooksPath counts as not owning the repo until something is committed, so the before-edit guard allows governed edits in that window (B3). `spec init` writes a small marker into `<common-dir>/spec/projects/<hash of project path>` whatever hooksPath is, and `projectOwnsGitRoot` (src/cli/enforcement.ts:196-224) checks it. (2) Every pull merge re-scans history back to enforceSince through verifyHistory (src/cli/enforcement.ts:802-826); the pull hook only needs the used ticket and bypass IDs — collect them without re-validating every commit.
