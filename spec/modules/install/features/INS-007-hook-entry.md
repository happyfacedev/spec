---
id: INS-007
title: Run a harness hook
module: install
status: active
provides: [install.Hook]
retired: [S5, S6, S7, S8, S9, S10]
questions:
  - id: Q1
    kind: preference
    text: "An unknown harness or event exits 2, which Claude Code treats as blocking (for PreToolUse it refuses the tool call), while unreadable input exits 1 so the session goes on. Should a misconfigured hook also exit 1?"
    default: Keep exit 2 for an unknown harness or event, as now
    cites: [INS-007/S1, INS-007/S2]
    answer: 'Decided in review (2026-10-29): exit 1 with a message, so the session goes on.'
    raised_by: null
---
## Intent
Claude Code runs `spec hook claude-code <event>` at the seven active points install.HookEvent names, with the event's payload as JSON on stdin. The entry checks the harness and the event, reads the payload, and hands it to the point that handles it. A hook without a resolvable spec root is silent and succeeds because the user-wide plugin runs in every repository.

## Behaviour
### S1: Another harness is refused
Given a repository with spec installed
When Claude Code runs `spec hook other session-start` through install.Hook
Then the command fails with install.UnknownHarness, stderr starting "unknown harness other; supported: claude-code"
And it exits 1 (R1)

### S2: An unknown event is refused
Given a repository with spec installed
When Claude Code runs `spec hook claude-code nope` through install.Hook
Then the command fails with install.UnknownHookEvent, stderr starting "unknown hook event nope; events: session-start, before-edit, after-edit, before-agent, before-handback, subagent-start, subagent-stop"
And it exits 1 (R1)

### S3: A missing event is refused
Given a repository with spec installed
When Claude Code runs `spec hook claude-code` through install.Hook
Then the command fails with install.UnknownHookEvent, stderr starting "unknown hook event (none); events:"
And it exits 1 (R1)

### S4: Input that is not JSON
Given a repository with spec installed
When Claude Code runs `spec hook claude-code after-edit` through install.Hook with "nope" on stdin
Then the command fails with install.HookInputNotJson: stderr "spec hook: the hook input is not JSON" and stdout empty
And it exits 1 (R1)

### S11: No resolvable spec root is silent
Given no spec/config.json exists above cwd, --root and SPEC_ROOT are unset, and the launcher has no older skill pointer
When Claude Code runs `spec hook claude-code session-start` through install.Hook with "{}" on stdin
Then stdout and stderr are empty
And it exits 0 (R1)

### S12: An invalid old skill pointer is silent for hooks
Given the old skill.json pointer is not valid JSON and no explicit spec root is given
When Claude Code runs `spec hook claude-code session-start` through install.Hook with "{}" on stdin
Then stdout and stderr are empty
And it exits 0 (R1)

### S13: Removed hook events are silent no-ops
Given a repository with spec installed
When Claude Code runs `spec hook claude-code before-delegate` or `before-finish` through install.Hook with "nope" on stdin
Then stdout and stderr are empty
And it exits 0 (R1)

## Rules
- R1: An unknown harness, an unknown or missing active event, or an unreadable active-hook payload exits 1 with its message on stderr; removed `before-delegate` and `before-finish` events are silent no-ops. A hook with no resolvable spec root exits 0 with empty stdout and stderr.

## Out of scope
- What each point does: INS-008, INS-010, INS-015, INS-016 and INS-020
