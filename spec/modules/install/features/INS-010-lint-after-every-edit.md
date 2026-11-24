---
id: INS-010
title: Lint the spec after every edit
module: install
status: active
retired: [S10]
---
## Intent
Whoever edits a spec or ticket file, a person in Claude Code or an agent, learns at once what the edit broke and how to fix it, while the change is still in front of them.

## Behaviour
### S1: An edit that breaks a scenario
Given the "chat-mini" fixture where `spec/modules/providers/features/PRV-003-track-token-usage.md` has a scenario PRV-003/S1 with no When step
When Claude Code runs `spec hook claude-code after-edit` through install.Hook with tool_name "Edit" and install.ToolInput.file_path that file's absolute path
Then stdout is empty
And stderr starts "spec lint found problems after this edit:" and holds "L007 PRV-003/S1: scenario PRV-003/S1 has no When step"
And it exits 2, which Claude Code shows to the model

### S2: Each finding with its fix
Given an edited spec file with lint findings, at least one an error
When Claude Code runs the after-edit hook through install.Hook for it
Then stderr has, for every finding in that file, warnings included, the line `<file>:<line> <severity> <code>[ <unit ID>]: <message>` and under it `  fix: <fix>` (R1)

### S3: An edit that leaves the spec clean
Given the "chat-mini" fixture
When Claude Code runs the after-edit hook through install.Hook with tool_name "Write" and install.ToolInput.file_path the absolute path of `spec/core/glossary.md`
Then stdout is empty and it exits 0

### S4: Warnings alone do not interrupt
Given an edited spec file whose only lint findings are warnings
When Claude Code runs the after-edit hook through install.Hook for it
Then stdout and stderr are empty and it exits 0 (R1)

### S5: Only the edited file is checked
Given the "chat-mini" fixture with a lint error in a feature file that was not edited
When Claude Code runs the after-edit hook through install.Hook for `spec/core/glossary.md`
Then it exits 0 (R2)

### S6: Ticket files are checked too
Given a ticket file under the ticket store's folder with a lint error
When Claude Code runs the after-edit hook through install.Hook with install.ToolInput.file_path that ticket file
Then it exits 2 with the ticket's findings on stderr (R2)

### S7: Files outside the spec and tickets are not linted
Given the "chat-mini" fixture
When Claude Code runs the after-edit hook through install.Hook with tool_name "Edit" and install.ToolInput.file_path the absolute path of `src/app.ts`
Then stdout is empty and it exits 0 (R2)

### S8: A subagent's edit as Claude Code recorded it
Given the "chat-mini" fixture
When Claude Code runs the after-edit hook through install.Hook with an implementer's recorded `PostToolUse` payload, which carries `agent_id`, `agent_type` "implementer" and an edit of `src/conversation/chat.ts`
Then stdout is empty and it exits 0

### S9: Other tools and payloads without a path pass through
Given the "chat-mini" fixture
When Claude Code runs the after-edit hook through install.Hook with tool_name "Read", or with tool_name "Edit" and no install.ToolInput.file_path
Then stdout is empty and it exits 0

### S11: Registered on the edit tools by the plugin
Given the plugin hooks manifest
When Claude Code loads plugin/hooks/hooks.json
Then the PostToolUse group in install.PluginPackage.hooks has install.HookGroup.matcher "Edit|Write|MultiEdit"
And its install.HookCommand.command ends with "hook claude-code after-edit"

## Rules
- R1: The edit is reported only when its file has a lint error, and then every finding in that file is reported
- R2: Only the edited file is linted, and only when it is under the spec root or the ticket store's folder

## Out of scope
- The lint rules themselves: lint
