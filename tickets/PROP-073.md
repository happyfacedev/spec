---
id: PROP-073
type: proposal
title: CLI-001/S1's usage text matches the commands the CLI prints
status: absorbed
absorbed_into: PROP-063
stage: null
touches: [CLI-001]
violates: []
depends_on: [PROP-064]
changed: []
questions: []
history: []
---
Found by PROP-064's tester: after the S3 merge, the usage text the CLI prints lists `bypass`, `verify-history` and `hook git`, but CLI-001/S1's quoted usage text does not, and tests/cli/usage.test.ts follows the code. Behaviour stays as it is; bring the scenario's text in line with what `spec --help` prints today (after PROP-064 adds `--base` to lint).
