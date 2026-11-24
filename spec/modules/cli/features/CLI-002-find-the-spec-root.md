---
id: CLI-002
title: Find the spec root
module: cli
status: active
questions:
  - id: Q1
    kind: preference
    text: Run through a symlink (say `/usr/local/bin/spec` linking to `<project>/.claude/skills/<name>/scripts/spec`), the CLI looks for the skill folder above the link, not above the file it links to, so it finds no spec root. The launcher already follows the link to load the CLI. Should root resolution follow it too?
    default: Keep looking above the path as typed; a symlinked CLI needs --root or SPEC_ROOT.
    cites: []
    answer: 'Change requested in review (2026-10-29): Follow the link first, then look for the spec folder. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
  - id: Q2
    kind: preference
    text: Any existing folder is accepted as the spec root, with or without `config.json`; the glossary defines the spec root as the folder holding `config.json`. Should the CLI refuse a root without `config.json` with its own message, rather than let the command run (lint then reports "the spec has no config.json")?
    default: Accept any existing folder.
    cites: []
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q3
    kind: preference
    text: The CLI now also finds a project .spec/bin/spec launcher and walks up to spec/config.json. Is the current no-root message accurate?
    default: Say the root can come from a project launcher or nearest spec/config.json.
    cites: []
    answer: 'Use the project launcher and nearest spec/config.json wording, as implemented.'
    raised_by: null
---
## Intent
Every command but `init` works on one spec, so the CLI first finds the spec root: from `--root`, then `SPEC_ROOT`, an older skill pointer, a project `.spec/bin/spec` launcher, or the nearest `spec/config.json` above `CLAUDE_PROJECT_DIR` (or cwd). A developer can still point any copy of the CLI at any spec.

## Behaviour
### S1: --root names the spec root
Given the chat-mini fixture spec is at fixtures/chat-mini/spec and SPEC_ROOT is unset
When the developer runs `spec find fallback --root fixtures/chat-mini/spec` from the repository, giving cli.Options.root, through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout lists "providers.FallbackTriggered" (R2)

### S2: --root wins over SPEC_ROOT
Given the chat-mini fixture spec is at fixtures/chat-mini/spec and cli.Run.SPEC_ROOT is "/nonexistent"
When the developer runs `spec find fallback --root fixtures/chat-mini/spec` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout lists "providers.FallbackTriggered" (R1)

### S3: SPEC_ROOT is used without --root, relative to the working folder
Given the chat-mini fixture spec is copied to /p/spec and cli.Run.cwd is /p
And cli.Run.SPEC_ROOT is "spec"
When the developer runs `spec find fallback` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout lists "providers.FallbackTriggered" (R1, R2)

### S4: SPEC_ROOT wins over the skill folder
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec with a "skill.json" whose cli.SkillPointer.specRoot is "spec", and the chat-mini fixture spec is at /p/spec
And cli.Run.SPEC_ROOT is "/nonexistent"
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` through cli.Run
Then the command fails with cli.SpecRootMissing
And cli.CommandResult.stderr starts with "spec root /nonexistent does not exist" (R1)

### S5: The skill folder's skill.json names the spec root, relative to the project
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec and the chat-mini fixture spec is at /p/spec
And /p/.claude/skills/x-spec/skill.json is {"specRoot": "spec"}
And cli.Run.SPEC_ROOT is unset and cli.Run.cwd is some other folder
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` through cli.Run, so cli.Run.launcher is that path
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R3)

### S6: Outside .claude/skills, skill.json is relative to the skill folder's parent
Given the CLI is at /p/tools/sk/scripts/spec and the chat-mini fixture spec is at /p/tools/spec
And /p/tools/sk/skill.json is {"specRoot": "spec"}
When the developer runs /p/tools/sk/scripts/spec `show "PRV-002/S3"` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R3)

### S7: An older install keeps the spec in the skill folder
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec with no "skill.json"
And the chat-mini fixture spec, with its "config.json", is copied into /p/.claude/skills/x-spec/
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R3)

### S8: A skill.json without specRoot falls back to the skill folder
Given the chat-mini fixture spec is copied into /p/.claude/skills/x-spec/ and the CLI is at /p/.claude/skills/x-spec/scripts/spec
And /p/.claude/skills/x-spec/skill.json is {}
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R3)

### S9: skill.json pointing at a missing folder
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec
And /p/.claude/skills/x-spec/skill.json is {"specRoot": "missing"} and /p/missing does not exist
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` through cli.Run
Then the command fails with cli.SpecRootMissing
And cli.CommandResult.stderr starts with "spec root /p/missing does not exist" and cli.CommandResult.exitCode is 2

### S10: No skill folder holds anything
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec, the skill folder holds neither "skill.json" nor "config.json", no "spec/config.json" exists above cwd, and SPEC_ROOT is unset
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3"` without --root through cli.Run
Then the command fails with cli.NoSpecRoot
And cli.CommandResult.stderr is "no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json", an empty line, then the usage text
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2

### S11: Only a folder named scripts is looked above
Given the CLI is at /p/sk/bin/spec and the chat-mini fixture spec, with its "config.json", is copied into /p/sk/
When the developer runs /p/sk/bin/spec `show "PRV-002/S3"` without --root or SPEC_ROOT through cli.Run
Then the command fails with cli.NoSpecRoot and cli.CommandResult.exitCode is 2 (R3)

### S12: A symlinked CLI finds its skill folder through the link
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec with a "skill.json" whose cli.SkillPointer.specRoot is "spec", and the chat-mini fixture spec is at /p/spec
And /bin-dir/spec is a symlink to /p/.claude/skills/x-spec/scripts/spec
When the developer runs /bin-dir/spec `show "PRV-002/S3"` without --root or SPEC_ROOT through cli.Run, so cli.Run.launcher is /bin-dir/spec
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R1, R3)

### S13: Without a launcher or project spec there is no root
Given cli.Run.launcher is left out, --root is not given, SPEC_ROOT is unset, and no spec/config.json exists above cwd
When the developer runs `spec lint` through cli.Run
Then the command fails with cli.NoSpecRoot and cli.CommandResult.exitCode is 2

### S14: A root that does not exist
Given no folder /nonexistent exists
When the developer runs `spec lint --root /nonexistent` through cli.Run
Then the command fails with cli.SpecRootMissing
And cli.CommandResult.stderr is "spec root /nonexistent does not exist", an empty line, then the usage text
And cli.CommandResult.stdout is empty and cli.CommandResult.exitCode is 2

### S15: The first source found decides, even when its folder is missing
Given the CLI is installed with a "skill.json" that names an existing spec root, and cli.Run.SPEC_ROOT is "/nonexistent"
When the developer runs that CLI's `spec lint` through cli.Run
Then the command fails with cli.SpecRootMissing for "/nonexistent"; the skill folder is not tried (R1)

### S16: An empty --root or SPEC_ROOT counts as not given
Given the CLI is installed at /p/.claude/skills/x-spec/scripts/spec with a "skill.json" whose cli.SkillPointer.specRoot is "spec", and the chat-mini fixture spec is at /p/spec
And cli.Run.SPEC_ROOT is ""
When the developer runs /p/.claude/skills/x-spec/scripts/spec `show "PRV-002/S3" --root=` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R1)

### S17: The last --root wins
Given the chat-mini fixture spec is at fixtures/chat-mini/spec and no folder /nonexistent exists
When the developer runs `spec show "PRV-002" --root fixtures/chat-mini/spec --root=/nonexistent` through cli.Run
Then the command fails with cli.SpecRootMissing for "/nonexistent"

### S18: A root without config.json is still used
Given /empty is an existing empty folder
When the developer runs `spec lint --root /empty` through cli.Run
Then cli.CommandResult.stdout starts with "config.json:1 error L001: the spec has no config.json"
And cli.CommandResult.exitCode is 1

### S19: The project launcher resolves to project/spec
Given the CLI is installed at /p/.spec/bin/spec and the chat-mini fixture spec is at /p/spec
When the developer runs /p/.spec/bin/spec `show "PRV-002/S3"` without --root or SPEC_ROOT through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R1, R3)

### S20: Without a launcher, the nearest project config above cwd is used
Given the chat-mini fixture spec is at /p/spec and cli.Run.cwd is /p/src/nested
And cli.Run.launcher, --root, SPEC_ROOT and CLAUDE_PROJECT_DIR are unset
When the developer runs `spec show "PRV-002/S3"` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R1, R3)

### S21: CLAUDE_PROJECT_DIR is the fallback search start when set
Given the chat-mini fixture spec is at /cwd-project/spec
And /claude-project/spec/config.json exists without PRV-002/S3
And cli.Run.cwd is /cwd-project and cli.Run.CLAUDE_PROJECT_DIR is /claude-project
When the developer runs `spec show "PRV-002/S3"` without --root, SPEC_ROOT or a launcher through cli.Run
Then the command does not show "### S3: Fallback provider also rate-limits" from /cwd-project/spec (R1)

### S22: A hook with no resolvable spec root is silent and succeeds
Given no spec/config.json exists above cwd, --root and SPEC_ROOT are unset, and no launcher names a spec root
When Claude Code runs `spec hook claude-code session-start` through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout and cli.CommandResult.stderr are empty (INS-007)
### S23: A project launcher symlink keeps its .spec/bin root
Given /p/.spec/bin/spec is a symlink to /p/plugin/scripts/spec and the chat-mini fixture spec is at /p/spec
And cli.Run.cwd is some other folder
When the developer runs /p/.spec/bin/spec `show "PRV-002/S3"` without --root or SPEC_ROOT through cli.Run
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits" (R3)

### S24: A nested git repository does not inherit its parent spec
Given /parent/spec/config.json exists and /parent/nested is its own git repository without spec/config.json
When the developer runs `spec show "PRV-002/S3"` from /parent/nested without --root, SPEC_ROOT, CLAUDE_PROJECT_DIR or a launcher
Then cli.CommandResult fails with cli.NoSpecRoot and cli.CommandResult.exitCode is 2

### S25: A fixture spec remains the nearest root inside its repository
Given this repository has spec/config.json and fixtures/chat-mini/spec/config.json
And cli.Run.cwd is fixtures/chat-mini/src
When the developer runs `spec show "PRV-002/S3"` without --root, SPEC_ROOT, CLAUDE_PROJECT_DIR or a launcher
Then cli.CommandResult.exitCode is 0 and cli.CommandResult.stdout holds "### S3: Fallback provider also rate-limits"

## Rules
- R1: The spec root comes from `--root`, then non-empty `SPEC_ROOT`, an older skill pointer, the project `.spec/bin/spec` launcher, and the nearest `spec/config.json` above `CLAUDE_PROJECT_DIR` or cwd; the first applicable source decides.
- R2: A relative `--root` or `SPEC_ROOT` is resolved against the folder the command runs in.
- R3: The launcher's real file is the file its symlinks lead to. An older skill folder is parent of `scripts`; its `skill.json` names the root through `specRoot`, or the folder itself is used when it holds `config.json`. A launcher at `<project>/.spec/bin/spec` resolves to `<project>/spec`. The fallback search starts at `CLAUDE_PROJECT_DIR` when set, otherwise cwd, and walks upward to the nearest `spec/config.json` without crossing that start directory's Git top-level; when `CLAUDE_PROJECT_DIR` is an ancestor of cwd, it is the search boundary.

## Out of scope
- Writing `skill.json`: install (`spec init`)
- The project root a spec belongs to, and where its tickets live: format and tickets
- What a command reports about a spec without `config.json`: lint
