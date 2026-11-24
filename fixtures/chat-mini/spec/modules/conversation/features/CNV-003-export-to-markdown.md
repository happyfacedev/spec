---
id: CNV-003
title: Export a conversation to Markdown
module: conversation
status: active
observes: [settings.ApiKey]
invariants: [INV-002]
---
## Intent
Let the user save a conversation as Markdown text, with the text of every message and nothing secret.

## Behaviour
### S1: Text exported
Given the conversation holds the messages "Hi" and "Hello there"
When the user exports it to Markdown
Then the export is the content of each conversation.Message in order, separated by one blank line
And the export is exactly "Hi\n\nHello there\n"

### S2: No key material in export
Given each conversation.Message was sent to a provider whose settings.ApiKey is "sk-claude-secret"
When the user exports it to Markdown
Then the export does not contain "sk-claude-secret" (INV-002)

## Rules
None

## Out of scope
- Headings, roles and styling in the export
