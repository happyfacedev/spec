---
id: PROP-005
type: proposal
title: Usage text lists -h, --help and -v
status: done
stage: null
touches: [CLI-001]
violates: []
depends_on: []
changed: [CLI-001/S1, CLI-001/S2, CLI-001/S3, CLI-001/S4, CLI-001/S5, CLI-001/S6, CLI-001/S7, CLI-001/S8, CLI-001/S9, CLI-001/S10, CLI-001/S11]
questions: []
history:
  - at: 2026-10-29T17:38:54.078Z
    role: spec-writer
    result: done
    summary: CLI-001 S1 usage text now lists -h, --help and -v, --version in the options section; lint has 0 errors
    verdict: null
    assumed:
      - new: What text does the -h, --help usage line print, and in what order do the two new option lines go?
        value: print the usage, listed before -v, --version (print the version)
    duration_s: 96
  - at: 2026-10-29T17:48:47.213Z
    role: tester
    result: done
    summary: CLI-001 tests in tests/cli/usage.test.ts; S1-S6 fail on the old usage text, S7-S11 pass; lint, typecheck clean
    verdict: null
    assumed:
      - new: CLI-001/S7 says stderr does not hold 'spec root', but the usage S6 requires names the --root option's spec root; checked the message line before the usage
        value: message line is exactly 'unknown command nope'
      - new: Does CLI-001/S1's usage text end with a newline after the last option line?
        value: yes, as the code prints it
    duration_s: 589
  - at: 2026-10-29T17:56:34.446Z
    role: implementer
    result: done
    summary: Usage lists -h, --help and -v, --version under options; 887 tests, typecheck and lint pass
    verdict: null
    assumed: []
    duration_s: 463
  - at: 2026-10-29T18:01:29.082Z
    role: reviewer
    result: done
    summary: "approve: usage lists -h/--help, -v/--version (CLI-001/S1). Candidate bug: spec lint --root --help refused, not usage"
    verdict: approve
    assumed:
      - new: CLI-001/S7 says stderr does not hold 'spec root', but S6 prints the S1 usage, which holds it
        value: read as the message line only; the usage text stays exactly as S1 gives it
      - new: Does CLI-001/R1 'whatever else the line holds' cover --help taken as a value, as in spec lint --root --help?
        value: no; CLI-003/S9 holds (refused, exit 2); pre-existing on main, so a candidate bug, not a finding
    duration_s: 291
---
Review 2026-10-29, CLI-001#Q1: the options section of the usage text lists -h/--help and -v alongside --version.
