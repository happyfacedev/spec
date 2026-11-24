---
id: FMT-015
title: Configure a model for each harness role
module: format
status: active
---

## Intent
A project can select a model independently for each stage role and harness, and for Claude Code an ordered list of models with a reasoning effort each, best first. A gitignored local config can override those selections without changing the shared project config.

## Behaviour
### S1: Delegation models are optional
Given config.json has no "delegation"
When the CLI reads it
Then format.Config.delegation is not set (R1)

### S2: A model is selected by harness and role
Given config.json has `delegation: { "claude-code": { "implementer": "sonnet" }, "astro": { "implementer": "opus" }, "custom-harness": { "implementer": "custom" } }`
When `spec next TASK-101 --harness astro --format json` prepares the implementer
Then cli.Next.model is "opus" (R2)
And editing the `delegation` model map does not change the spec version (R2)
And the arbitrary "custom-harness" key is accepted

### S3: Local delegation overrides only its matching role
Given config.json sets the "claude-code" implementer model to "sonnet"
And config.local.json sets it to "opus" and also contains unrelated keys
When the CLI reads the config
Then cli.Next.model is "opus"
And the unrelated local keys do not affect project config, and changing local delegation does not change the spec version (R3)

### S4: An invalid delegation shape is a lint finding
Given config.json has a delegation role "wizard" or a model that is not text
When `spec lint` runs
Then it reports the config schema finding on config.json (R4)
And a malformed config.local.json delegation reports the config schema finding on config.local.json

### S5: Local configuration is ignored by git
Given `spec init` writes `spec/.gitignore`
When the project reads it
Then it ignores `config.local.json` under the spec folder (R3)

### S6: An unknown harness is accepted with a warning
Given `config.json` selects allowed `sonnet` for the known harness "claude-code" and a free-form role name for "custom-harness"
When `spec lint` runs
Then the custom harness model remains usable and lint reports warning "L029" only for the unknown harness (R5)

### S7: A partially configured harness warns for missing roles
Given `config.json` sets any role under "astro" but omits at least one other stage role
When `spec lint` runs
Then lint reports warning "L030" for each missing role under that harness (R6)
And a harness with all four stage roles has no L030 warnings

### S8: An unsupported Claude Code model in shared config warns
Given `config.json` stores a `claude-code` role model outside `sonnet`, `opus`, `haiku` and `fable`
When `spec lint` runs
Then it reports warning "L032" for that stored model, not a schema error (R7)

### S9: An unsupported Claude Code model in local config warns
Given `config.local.json` overrides a `claude-code` role with a model outside `sonnet`, `opus`, `haiku` and `fable`
When `spec lint` runs
Then it reports warning "L032" for that stored model (R7)

### S10: Astro delegate role names remain free-form
Given `config.json` stores any non-empty text as an Astro role value
When `spec lint` runs
Then it does not report warning "L032" for that value (R7)

### S11: The spec review takes its own model or the reviewer's
Given config.json has `delegation: { "claude-code": { "spec-writer": "opus", "tester": "sonnet", "implementer": "sonnet", "reviewer": "opus" } }`
When `spec lint` runs, and `spec next PROP-201 --harness claude-code --format json` prepares the "spec-review" stage
Then lint reports no L001 and no L030, and cli.Next.model is "opus", the reviewer's (R1, R6)
And with "spec-review": "sonnet" added under "claude-code", lint still reports no finding for it and cli.Next.model is "sonnet" (R1)
And `spec config set delegation.claude-code.spec-review sonnet` through cli.ConfigSet stores it, as for every stage role (R1)

### S12: A Claude Code role takes an ordered list of models
Given the installed Claude Code is 2.1.292 or later (CLI-007/R19), and config.json has format.Config.delegation `{ "claude-code": { "spec-writer": "opus", "tester": [{ "model": "sonnet", "effort": "high" }, { "model": "haiku", "effort": "high" }], "implementer": [{ "model": "opus" }], "reviewer": [{ "model": "opus-4" }, { "model": "sonnet", "effort": "max" }] } }`
When `spec next` with `--harness claude-code --format json` prepares each role's stage
Then the tester's cli.Next.model is "sonnet" and cli.Next.effort is "high" (R2, R8)
And the implementer's cli.Next.model is "opus" and cli.Next.effort is null (R8)
And the spec-writer's "opus", a text, means a list of one: cli.Next.model is "opus" and cli.Next.effort is null (R8)
And the reviewer's and the spec review's cli.Next.model is "sonnet" and cli.Next.effort is "max", since "opus-4" is not usable (R7, R8)
And `spec lint` reports warning "L032" for "opus-4" alone, no L030 for any role and no L001 (R6, R7)
And when config.local.json sets the tester to "opus", its whole list is replaced: cli.Next.model is "opus" and cli.Next.effort is null (R3)
And a local list likewise replaces a shared text or list, and a local "opus-4" over the shared tester list leaves the tester without a model, with L032 and L030 (R3, R7)

### S14: Models this machine cannot use are marked in the local config only
Given config.local.json has format.LocalConfig.unavailableModels `{ "opus": true, "sonnet": false }` and the claude-code implementer is opus, then haiku
When `spec next` with `--harness claude-code --format json` prepares the implementer
Then cli.Next.model is "haiku", and the spec version is unchanged (R3, R9)
And `spec lint` reports the config schema's L001 for "unavailableModels" in config.json, and on config.local.json for a key that is no alias or a value that is not true or false (R4, R9)
And a spec review whose own setting names only opus does not take the reviewer's model while opus is marked (R9)
And under "astro" the setting changes nothing (R9)

### S13: A malformed model list is a lint finding
Given the "claude-code" implementer in config.json is [], a list holding a text, an entry with no "model", one with an "effort" of "highest" or 3, one with another key, or a list naming "sonnet" twice; or the "astro" implementer is a list
When `spec lint` runs
Then each reports the config schema's L001 finding on config.json, and the same in config.local.json reports it there (R4, R8)

## Rules
- R1: `delegation`, when set, maps any non-empty harness name to stage-role model names; the stage roles are spec-writer, spec-review, tester, implementer and reviewer. The spec review's model, when not set, is the reviewer's of the same harness (PIP-017/R8).
- R2: `spec next` uses the selected harness's model for the stage role; absent a selection it asks the session to choose one. The model map is tooling config and does not change the spec version.
- R3: `spec/config.local.json` may override delegation and mark unavailable models (R9) only, is gitignored, does not override any other project configuration, and does not change the spec version. A role set there replaces that role's whole shared setting, even when it holds no valid model; `spec next` and L030 judge the result.
- R4: Invalid delegation shapes produce the config schema's L001 finding on the config file that contains them.
- R5: The supported harness keys are "claude-code" and "astro"; other non-empty harness keys remain accepted but each produces an L029 warning.
- R6: If any role is configured for a harness, lint warns with L030 for every missing spec-writer, tester, implementer or reviewer role; no L030 warning is emitted when all four are set. A missing spec-review role is never an L030, since the reviewer's model covers it.
- R7: Claude Code model strings outside `sonnet`, `opus`, `haiku` and `fable` are accepted in stored config for compatibility but each produces warning L032; Astro delegate role values remain free-form text. In a list, each such model warns and its entry is never chosen; a role missing a valid model is one whose setting holds none.
- R8: Under "claude-code" a role is one model text, or a list of one or more format.ModelChoice, best first, each model at most once; a text means a list of one with no effort. Under any other harness a role is one text. The first entry with a supported model that is not marked unavailable (R9) is the role's choice: spec knows no way to ask Claude Code whether a model is available before launch, and asks nothing. An effort is passed as written; Claude Code itself lowers a level a model does not support.
- R9: format.LocalConfig.unavailableModels marks Claude Code models this machine cannot use, until they are unmarked; the shared config cannot. Only "claude-code" selection reads it. It is not a missing model: no L030 or missingModels entry, and the spec review takes the reviewer's setting only when its own holds no supported model.

## Out of scope
- How harness names are detected: CLI
- Starting and describing a stage: pipeline
