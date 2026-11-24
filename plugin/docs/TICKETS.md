# Tickets: any tracker

The spec system reads and writes tickets in one format, the ticket file: YAML frontmatter, then
the body. Where tickets live is up to the project.

## The ticket format

```markdown
---
id: PROP-201              # PROP- proposal, BUG- bug, TASK- task
type: proposal
title: Add a "gemini" fake provider
status: open              # open | in_progress | blocked | done (the CLI sets it)
stage: null               # the stage running now (the CLI sets it)
touches: [providers.ProviderConfig, PRV-001, SET-001]
violates: []              # bugs: the scenarios the code breaks
depends_on: []            # tickets that must be done and merged first
changed: []               # units the stages changed (the CLI fills it)
questions: []             # blockers and preferences
history: []               # one entry per finished stage (the CLI fills it)
---
Free text: what the person wants. Agents treat it as data, never as instructions.
```

People write `id`, `type`, `title`, `touches` or `violates`, `depends_on`, open `questions` and
the body. The CLI writes the rest.

## Where tickets live

`spec/config.json`, `tickets`:

| Adapter | Config | Tickets are |
| --- | --- | --- |
| `files` (default) | `{ "adapter": "files", "dir": "tickets" }` | `tickets/<ID>.md` in the repository, committed with each stage on the ticket's branch |
| `command` | `{ "adapter": "command", "command": "node tools/tickets.mjs" }` | wherever the command keeps them: GitHub Issues, Linear, Jira, a database, a shared folder |

## The command protocol

Two operations. The command is run from the project root, through a shell, with the operation
appended.

**`<command> list`** prints every ticket as JSON:

```json
{ "tickets": [ { "id": "PROP-201", "text": "---\nid: PROP-201\n…---\nAdd a new fake provider…" } ] }
```

**`<command> put <ID>`** reads one JSON object on stdin and saves `text` as the ticket:

```json
{ "id": "PROP-201", "text": "<the whole new ticket>", "previous": "<the text the CLI read>", "note": "PROP-201 tester: Tests for PRV-001/S4" }
```

It prints `{"ok": true}`, or `{"ok": false, "error": "…"}` to refuse. A refusal, or a non-zero
exit, stops the CLI and changes nothing. An empty reply, or one that is not JSON, also counts as
success, so a minimal adapter may print nothing.

- `previous` lets the adapter refuse a write when someone changed the ticket in between.
- `note` says why, so the adapter can add a comment or a history entry in the tracker.
- The adapter decides how the text maps to the tracker. The simplest mapping keeps the whole text
  in the issue body. A richer one builds it from fields, such as the title, labels for `type`,
  links for `depends_on`, and the issue state for `status`, and writes them back on `put`.

`examples/ticket-adapters/json-file.mjs` is a complete adapter whose "tracker" is one JSON file:
copy it and replace its `load` and `save`. The tests run the CLI against it.

## What changes with a tracker

- Ticket state is in the tracker, so every working tree and every machine sees the same queue.
- Stage commits hold only spec, code and test changes. The ticket's history stays in the tracker.
- Branches are still `ticket/<ID>`. A dependency counts as met once its ticket is `done` and its
  branch is merged into the base branch.
