---
id: PROP-071
type: proposal
title: "One generated key: its rebuild command is optional, and generatedGlobs is folded into it"
status: done
stage: null
touches: [FMT-002, WSP-009, WSP-006]
violates: []
depends_on: []
changed: [FMT-002, FMT-002/R8, FMT-002/R9, FMT-002/R12, FMT-002/S1, FMT-002/S17, FMT-002/S19, FMT-002/S22, INS-001, LNT-003, LNT-003/R11, LNT-003/R12, LNT-003/S26, LNT-003/S27, LNT-003/S28, PIP-002, PIP-002/R6, PIP-002/S24, WSP-006, WSP-006/R2, WSP-006/R4, WSP-006/S5, WSP-009, WSP-009/R1, WSP-009/R2, WSP-009/R4, WSP-009/S4, format.Config, format.Config.generated, format.Config.generatedGlobs, format.GeneratedConfig, format.GeneratedConfig.command, format.GeneratedConfig.globs, lint.RuleCode]
questions:
  - id: Q1
    kind: blocker
    text: syncing ticket/PROP-071 with main conflicts in spec/modules/lint/_module.md, spec/modules/lint/contracts.md; a person must merge
    default: null
    cites: []
    answer: "Merged main by hand: kept L035 (LNT-018) and L036 (this ticket) in lint.RuleCode and the module's Owns list."
    raised_by: tester
history:
  - at: 2026-10-31T15:37:15.788Z
    role: spec-writer
    result: done
    summary: generated.command is optional; generatedGlobs is a deprecated alias read as generated.globs and warned by L036
    verdict: null
    assumed:
      - new: When both generated (with a command) and generatedGlobs are set, does a conflict only under generatedGlobs run the command?
        value: "no: generatedGlobs paths take one side without the command, as today (WSP-009/R4, S4)"
      - new: Must generated.globs follow generatedGlobs' project-relative glob rule?
        value: yes; today generated.globs accepts ../x/** and lints clean, now L001 (FMT-002/R8)
      - new: L034 text once generatedGlobs is deprecated
        value: message 'afterMerge is configured but generated is not set; history only authorizes its generated-path commits', fix 'set generated.globs to the project-relative patterns written by afterMerge, or remove afterMerge'
      - new: Does an empty generatedGlobs [] warn L036?
        value: no; only a non-empty one (LNT-003/R12)
      - new: L036 wording
        value: message 'generatedGlobs is replaced by generated; it is read as generated.globs without a command', fix 'move its globs into generated.globs and remove generatedGlobs', at config.json line 1
    duration_s: 383
  - at: 2026-10-31T17:10:24.128Z
    role: tester
    result: done
    summary: Failing tests for generated.command optional, generatedGlobs alias and L036 across FMT-002, WSP-009, WSP-006, LNT-003, PIP-002
    verdict: null
    mutations:
      - scenario: FMT-002/S1
        wrong: "defaults generated to { globs: [] } instead of leaving it unset"
      - scenario: FMT-002/S17
        wrong: still requires generated.command, or accepts ../outside/** in generated.globs, or an empty command
      - scenario: FMT-002/S19
        wrong: generatedGlobs lints clean with no L036 warning, or the L001 on generatedGlobs is lost
      - scenario: FMT-002/S22
        wrong: history enforcement counts only generated.globs with a command, so a no-command or generatedGlobs afterMerge commit is refused
      - scenario: WSP-009/S4
        wrong: a generated config without a command runs a fallback command or leaves the conflict for a person
      - scenario: WSP-009/S4
        wrong: a conflict only under generatedGlobs runs the generated command, or the command never runs when generated globs conflict too
      - scenario: WSP-006/S5
        wrong: a generated config without a command refuses the merge instead of taking the branch side
      - scenario: LNT-003/S27
        wrong: L034 keeps the old generatedGlobs wording or still warns when generated is set without a command
      - scenario: LNT-003/S28
        wrong: L036 is missing, fires for an empty generatedGlobs, fires twice, or only in --ci
      - scenario: PIP-002/S24
        wrong: the sync keeps the branch copy or rebuilds a generated file with no command
    assumed:
      - new: How does a no-command generated path read in WSP-009/S4 when no command can be observed to run?
        value: asserted by the merged file content equal to the branch side and the tests snapshot, not by a run log
      - new: Which member names does L001 cite for FMT-002/S17?
        value: config.json generated.globs, generated.globs.0 and generated.command, as the schema path prints them
      - new: FMT-002/S22 and WSP-009/S4 legacy variants pass on the current code
        value: kept as tests of behaviour the spec still states; the failing ones are the no-command and L036 cases
    duration_s: 1239
  - at: 2026-10-31T17:23:30.579Z
    role: implementer
    result: done
    summary: generated.command is optional, generated.globs gets the project-relative check, generatedGlobs is read as generated.globs without a command with an L036 warning, and L034 reads both keys under its new wording
    verdict: null
    assumed:
      - new: Does spec upgrade keep its old afterMerge note, which says generatedGlobs is empty?
        value: yes; INS-016/S4 and its unchanged test expect that wording, and only the lint L034 text is reworded (LNT-003/S27), so the two now use separate messages
    duration_s: 784
  - at: 2026-10-31T17:27:33.334Z
    role: reviewer
    result: done
    summary: D3 delivered across config, lint, merge/sync and history; mutation spot-checks hold
    verdict: approve
    assumed: []
    duration_s: 241
---
Decision D3 (2026-10-31). The plugin integration left two keys for one idea: `generated` (globs plus a rebuild command, WSP-009) and `generatedGlobs` (take one side of a conflict, no rebuild, FMT-002/R9). Make `generated.command` optional: without it, a conflict under `generated.globs` takes one side as `generatedGlobs` does today; with it, the files are rebuilt as WSP-009 says. `generatedGlobs` stays accepted for old configs, is read as `generated.globs` without a command, and lint warns that it is replaced by `generated` (a new warning, like L028 for legacy dispatch keys). Keep S3's history rules working: every generated path still counts as generated for enforcement, and L034's afterMerge check reads the merged key.
