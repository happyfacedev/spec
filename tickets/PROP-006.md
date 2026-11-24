---
id: PROP-006
type: proposal
title: A symlinked CLI finds its spec root, and the no-root message says what it needs
status: done
stage: null
touches: [CLI-002]
violates: []
depends_on: []
changed: [CLI-001, CLI-002, CLI-002/R1, CLI-002/R3, CLI-002/S1, CLI-002/S2, CLI-002/S3, CLI-002/S4, CLI-002/S5, CLI-002/S6, CLI-002/S7, CLI-002/S8, CLI-002/S9, CLI-002/S10, CLI-002/S11, CLI-002/S12, CLI-002/S13, CLI-002/S14, CLI-002/S15, CLI-002/S16, CLI-002/S17, CLI-002/S18, CLI-006, CLI-006/S3, cli.NoSpecRoot, cli.Run, cli.Run.launcher]
questions: []
history:
  - at: 2026-10-29T18:55:59.785Z
    role: spec-writer
    result: done
    summary: "CLI-002: follow the launcher's symlinks before the skill-folder search; no-root message names skill.json or config.json"
    verdict: null
    assumed:
      - new: wording of the no-spec-root message
        value: "no spec root: pass --root, set SPEC_ROOT, or run the bundled scripts/spec, which needs its skill folder to hold skill.json (with specRoot) or config.json"
      - new: how far symlinks are followed
        value: every link in the chain, to the final real file; a relative link target is resolved against its link's folder
      - new: does brief print the same no-spec-root message
        value: yes, the same text on stdout (CLI-006 R1), so CLI-006 S3 is updated to match
    duration_s: 218
  - at: 2026-10-29T19:10:44.337Z
    role: tester
    result: done
    summary: CLI-002 S1-S18 tests added; CLI-006/S3 now expects the new message; 3 new-scenario tests fail as expected
    verdict: null
    assumed:
      - new: "cli.Run.launcher has no Code: line; which RunEnv field do the tests pass it through?"
        value: scriptPath, the existing RunEnv field
      - new: Must a launcher exist on disk for its symlinks to be followed?
        value: Yes; the tests write an empty file at each launcher path
      - new: Exit code of a SpecRootMissing or NoSpecRoot failure where the scenario states none
        value: 2, as in CLI-002/S9 and S14
    duration_s: 884
  - at: 2026-10-29T19:30:22.353Z
    role: implementer
    result: done
    summary: A symlinked CLI finds its skill folder through the link; the no-root message names skill.json or config.json
    verdict: null
    assumed:
      - new: Are symlinked folders above the launcher's name followed too, or only the launcher's own links?
        value: Only the launcher's own links are followed; the folder path stays as typed, so macOS /var is not turned into /private/var (keeps CLI-005/S6 passing)
      - new: What does a symlink chain that loops give?
        value: No skill folder, so no spec root, after 40 links
    duration_s: 1177
  - at: 2026-10-29T19:35:16.318Z
    role: reviewer
    result: done
    summary: "Approve: CLI-002 S1-S18 and R1-R3 hold; CLI-006/S3 text updated; 905 tests, typecheck and lint pass"
    verdict: approve
    assumed:
      - new: Does R3 real file cover a symlinked folder above the launcher?
        value: No, only the launcher's own links are followed; a symlinked folder above it stays as typed (candidate follow-up if R3 means realpath)
      - new: Does a symlink loop find a spec root?
        value: No, after 40 links there is no real file, so cli.NoSpecRoot; no scenario covers it
    duration_s: 293
---
Review 2026-10-29. CLI-002#Q1: root resolution follows the launcher's symlink to the real file before looking for the skill folder. CLI-002#Q3: the no-spec-root message says the bundled CLI needs its skill folder to hold skill.json (with specRoot) or config.json.
