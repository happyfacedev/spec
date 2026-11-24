---
id: PROP-072
type: proposal
title: Stack detection ignores manifests under test fixtures and nested sample projects
status: done
stage: null
touches: [CLI-008]
violates: []
depends_on: []
changed: [CLI-008, CLI-008/R3, CLI-008/R12, CLI-008/S36, CLI-008/S37, CLI-008/S38]
questions: []
history:
  - at: 2026-10-31T15:31:45.763Z
    role: spec-writer
    result: done
    summary: Stack detection skips fixture/test/example folders and config testGlobs; init and upgrade rules follow (CLI-008 R12)
    verdict: null
    assumed:
      - new: "Which manifests count as fixtures or samples: only workspace members, or skipped folders?"
        value: skip folders named fixtures, __fixtures__, test, tests, __tests__, testdata, example, examples, sample or samples (any case) plus config testGlobs matches; workspace-only detection would break the undeclared apps/mobile case in S10
      - new: Does upgrade remove stack rules an earlier upgrade added for a fixture?
        value: no; init and upgrade never remove existing allow rules (INS-003 R3)
    duration_s: 164
  - at: 2026-10-31T15:54:50.990Z
    role: tester
    result: done
    summary: Added failing tests for CLI-008 S36, S37, S38 in detect-config.test.ts; lint and typecheck clean
    verdict: null
    assumed:
      - new: How does S38 run upgrade 'once its spec is installed'?
        value: run init first, reset .claude/settings.json to the go rule, then run upgrade . --from plugin/scripts
    duration_s: 1383
  - at: 2026-10-31T16:11:52.831Z
    role: implementer
    result: done
    summary: Stack detection skips fixture/test/example folders and spec/config.json testGlobs matches (CLI-008 R12)
    verdict: null
    assumed: []
    duration_s: 1018
  - at: 2026-10-31T16:15:42.734Z
    role: reviewer
    result: done
    summary: Approve; shared stack detection and tests satisfy CLI-008 R3, R12 and S36–S38.
    verdict: approve
    assumed: []
    duration_s: 227
---
Seen running `spec upgrade` in this repository (decision D6): it added `Bash(dart test *)`, `Bash(dart analyze*)` and `Bash(dart run build_runner *)` to `.claude/settings.json`, because stack detection found `fixtures/dart-mini/pubspec.yaml`. spec is a Node project; the Dart manifest belongs to a test fixture. Detection should read the project's own manifests (the project root, and workspace members the root manifest declares), not every manifest below it, or at least skip folders under the config's testGlobs. Upgrade on this repository then adds only the Node rules.
