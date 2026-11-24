---
id: LNT-003
title: Check generated index, code pointers and legacy config in CI
module: lint
status: active
retired: [S4, S5, S6, S10, S11, S12, S13, S14, R2, R5]
writes: [lint.Report.findings]
decisions: [ADR-002]
---
## Intent
CI runs `spec lint --ci` to catch a stale `index.md` and `Code:` pointers whose symbols the code no longer holds. The legacy `dispatchCommand` and `models` keys are accepted but lint warns that the session drives stages with `spec next`, and the legacy `generatedGlobs` is accepted but lint warns that `generated` replaces it.

## Behaviour
### S1: index.md is missing
Given the base spec of LNT-001, which has no "index.md" and has a complete delegation block for all four stage roles
When the developer runs lint.Lint with lint.Lint.ci
Then lint.Report.findings is exactly: error "L017" at "index.md" line 1, id null (R1)
And its message is "index.md is missing"
And its fix is "run spec build and commit the result"

### S2: Plain lint does not check index.md
Given the base spec of LNT-001, which has no "index.md"
When the developer runs lint.Lint without "--ci"
Then lint.Report.findings is empty (R4)

### S3: index.md is stale
Given the base spec after "spec build", with the title of "ALP-001" then changed to "Make one widget" and a complete delegation block for all four stage roles
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is exactly: error "L017" at "index.md" line 1, id null, message "index.md is stale", fix "run spec build and commit the result" (R1)

### S7: A Code: line whose symbol the code still holds
Given the base spec after "spec build", with a complete delegation block for all four stage roles, "codeGlobs": ["src/**"], "Code: Widget.make" on line 6 of "modules/alpha/contracts.md" under "alpha.Widget", and "src/widget.ts" holding a class "Widget" with a method "make"
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is empty

### S8: A Code: line whose symbol the code no longer holds
Given the spec of S7, with the method in "src/widget.ts" renamed to "build" and "Widget.make" written in "tests/w.ts", which "testGlobs" covers
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is exactly: warning "L024" at "modules/alpha/contracts.md" line 6, id "alpha.Widget" (R3)
And its message is "Code: Widget.make is not in the code"
And its fix is "update the Code: line to where the code implements it now, or restore the code"
And cli.CommandResult.exitCode is 0

### S9: No code globs, no code check
Given the spec of S8 with "codeGlobs": []
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is empty (R3)

### S15: Legacy dispatch keys warn on plain lint
Given config.json holds `"dispatchCommand": "claude -p {ticket}"`, `"models": { "small": "sonnet", "large": "opus", "threshold": 4 }`, and a fresh `index.md`
When the developer runs `spec lint`
Then lint.Report.findings includes warning "L028" at "config.json" line 1 for `dispatchCommand` with message "dispatchCommand is ignored since X139; the session drives stages with spec next" and fix "remove dispatchCommand from config.json"
And it includes warning "L028" at "config.json" line 1 for `models` with message "models is ignored since X139; the session drives stages with spec next" and fix "remove models from config.json" (R6)
And cli.CommandResult.exitCode is 0

### S16: CI also warns about both ignored legacy keys
Given config.json holds `"dispatchCommand": "claude -p {ticket}"`, `"models": { "small": "sonnet", "large": "opus", "threshold": 4 }`, a complete delegation block for all four stage roles, and a fresh `index.md`
When the developer runs `spec lint --ci`
Then lint.Report.findings includes the same two warnings as S15 and no error (R6)
And cli.CommandResult.exitCode is 0

### S17: No legacy keys, no warning
Given config.json has neither `dispatchCommand` nor `models`
When the developer runs lint.Lint
Then lint.Report.findings contains no "L028"

### S18: A custom harness is accepted with a warning
Given config.json delegates to a non-empty unknown harness key
When the developer runs `spec lint`
Then lint.Report.findings contains warning "L029" naming that harness and no schema error (R7)

### S19: A partially selected harness warns about missing roles
Given config.json selects any model for harness "astro" but omits one or more stage roles
When the developer runs `spec lint`
Then lint.Report.findings contains warning "L030" for each missing stage role (R8)

### S20: CI warns for every missing role under a configured harness
Given config.json has formatVersion 2 and selects only the implementer model under "astro"
When the developer runs `spec lint --ci`
Then lint.Report.findings contains L030 warnings for spec-writer, tester and reviewer and no error (R8)

### S21: CI warns when a current-format project has no delegation block
Given config.json has formatVersion 2 and no `delegation` key
When the developer runs `spec lint --ci`
Then lint.Report.findings contains one warning "L031" whose message mentions local-only teams using config.local.json and no error (R9)

### S22: An older format without delegation is not given the new setup warning
Given config.json has formatVersion 1 and no `delegation` key
When the developer runs `spec lint --ci`
Then lint.Report.findings contains no "L031" (R9)

### S23: An unspecified format version without delegation is not given the new setup warning
Given config.json has no formatVersion and no `delegation` key
When the developer runs `spec lint --ci`
Then lint.Report.findings contains no "L031" (R9)

### S24: An empty delegation map is treated as no configured harness
Given config.json has formatVersion 2 and `delegation: {}`
When the developer runs `spec lint --ci`
Then lint.Report.findings contains one warning "L031" whose message mentions local-only teams using config.local.json and no error (R9)

### S25: Invalid Claude Code models warn and count as missing
Given config.json has Claude Code models `claude-sonnet-5-5`, `inherit` and `opus-4` for three stage roles, and a valid model for the fourth
When the developer runs `spec lint --ci`
Then lint.Report.findings includes an L032 warning and an L030 missing-model warning for each invalid role, with no error

### S26: CI warns when Git enforcement hooks are missing
Given one or more of pre-commit, pre-merge-commit or commit-msg are absent or lack the spec integration line in Git's resolved hooksPath
When the developer runs `spec lint --ci`
Then lint.Report.findings includes one warning "L033" at "config.json" naming every missing hook and its integration fix
And when all three hooks are installed or integrated, it includes no "L033"
And cli.CommandResult.exitCode is 0 (R10)

### S27: Lint warns when afterMerge has no generated globs
Given config.json sets `afterMerge` and has neither `generated` nor a non-empty `generatedGlobs`
When the developer runs `spec lint` or `spec lint --ci`
Then lint.Report.findings includes one warning "L034" at "config.json" line 1 with message "afterMerge is configured but generated is not set; history only authorizes its generated-path commits" and fix "set generated.globs to the project-relative patterns written by afterMerge, or remove afterMerge" (R11)
And it includes no "L034" when `afterMerge` is absent
And it includes no "L034" when `generated` is set, with or without a command, or when `generatedGlobs` is non-empty, which is read as `generated` (R11)

### S28: A legacy generatedGlobs warns that generated replaces it
Given config.json holds `"generatedGlobs": ["plugin/generated/**"]` and a fresh `index.md`
When the developer runs `spec lint` or `spec lint --ci`
Then lint.Report.findings includes one warning "L036" at "config.json" line 1 with message "generatedGlobs is replaced by generated; it is read as generated.globs without a command" and fix "move its globs into generated.globs and remove generatedGlobs" (R12)
And cli.CommandResult.exitCode is 0
And it includes no "L036" when `generatedGlobs` is absent or holds no glob (R12)

### S29: A file Git ignores does not hold a Code: symbol
Given the spec of S7 in a Git work tree, with the method in "src/widget.ts" renamed to "build", and a class "Widget" with a method "make" only in "src/gen/widget.ts", which the project's ".gitignore" lists
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is exactly: warning "L024" at "modules/alpha/contracts.md" line 6, id "alpha.Widget" (R3)
And cli.CommandResult.exitCode is 0

### S30: A large ignored tree does not stop the CI check
Given the spec of S7 in a Git work tree whose ".gitignore" lists "build/", with "codeGlobs": ["src/**", "build/**"] and "build/" holding thousands of files that together are larger than the memory the command runs with
When the developer runs lint.Lint with "--ci"
Then lint.Report.findings is empty and cli.CommandResult.exitCode is 0 (R3)

## Rules
- R1: With --ci, an `index.md` that is missing or differs from what spec build would write is an L017 error
- R3: With --ci and non-empty code globs, each Code: line of a contract that is not removed, whose last two names no one code file holds together as words, is an L024 warning at that line; the code files are exactly those `spec gaps` checks (ADP-004/R1, ADP-004/R2): files under the code globs and outside the test globs that, in a Git work tree, Git lists as tracked or as untracked and not ignored, and, outside one or when Git cannot list files, that the walk reaches, which skips every folder named `node_modules` or `.git`; a file Git ignores is never read, so a large ignored tree does not stop the check
- R4: Without --ci, L017 and L024 are not reported; the L028 legacy-config warning is reported whenever `dispatchCommand` or `models` is set
- R6: The legacy `dispatchCommand` and `models` keys remain accepted for old config files but are ignored since X139; lint reports one L028 warning per present key with the session-driven `spec next` fix
- R7: Delegation to a non-empty harness other than `claude-code` or `astro` remains schema-valid and produces an L029 warning
- R8: If any role is selected under a harness, stage roles without a valid model produce L030 warnings in plain lint and CI; unsupported Claude Code model values also produce L032 warnings; a harness without any model entries is not warned
- R9: With `--ci`, formatVersion greater than or equal to the current format and no configured harness entries (delegation absent or empty) produces one L031 warning, not an error; its message and fix explain that local-only teams may use config.local.json; older or unspecified format versions remain backward-compatible without this warning
- R10: With `--ci`, lint reports one L033 warning when any required Git enforcement hook is absent or lacks its spec integration line; all three hook files must be present and integrated for no warning
- R11: L034 warns when config.json sets `afterMerge` but names no generated globs, reading `generated` and an old `generatedGlobs` as one key (FMT-002/R9); it is absent when afterMerge is unset or `generated` or a non-empty `generatedGlobs` names the files afterMerge writes
- R12: A non-empty legacy `generatedGlobs` stays accepted and produces one L036 warning, in plain lint and with --ci, that `generated` replaces it; an empty one produces none

## Out of scope
- Rebuilding index.md: graph (spec build)
- The same Code: check in spec gaps: adopt
