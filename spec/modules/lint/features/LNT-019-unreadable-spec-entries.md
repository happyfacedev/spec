---
id: LNT-019
title: Report a spec entry that cannot be read (L037)
module: lint
status: active
writes: [lint.Report.findings]
invariants: [INV-007]
---
## Intent
A symlink under the spec root whose target does not exist cannot be read, and the spec is not the whole picture until someone finds it. Lint reports such an entry as one error that names its path and says it cannot be read, so the person has one clear finding to fix before anything else. Each scenario starts from the base spec of LNT-001, with the symlink added at "modules/alpha/broken.md".

## Behaviour
### S1: A symlink under the spec whose target is missing
Given the base spec of LNT-001 with "modules/alpha/broken.md" as a symlink to a file that does not exist
When the developer runs lint.Lint
Then lint.Report.findings is exactly: error "L037" at "modules/alpha/broken.md" line 1, id null, message "modules/alpha/broken.md cannot be read: its symlink target does not exist", fix "point the symlink at an existing file, or remove it" (R1)
And cli.CommandResult.exitCode is 1

### S2: The other commands work on the same tree
Given the base spec of LNT-001 with "modules/alpha/broken.md" as a symlink to a file that does not exist
When the developer runs spec queue through tickets.Queue
Then cli.CommandResult.stdout starts with "# Queue · spec@" and cli.CommandResult.exitCode is 0 (R1)
When the developer runs spec show on "ALP-001" through graph.Show
Then cli.CommandResult.stdout starts with "modules/alpha/features/ALP-001-make-a-widget.md:1", a blank line, and the feature's whole file from its "---" line on (R1)
And graph.ShownUnit.id is "ALP-001", graph.ShownUnit.type is "feature", and cli.CommandResult.exitCode is 0

## Rules
- R1: A symlink under the spec root whose target does not exist, or any other entry under it that cannot be read, is one L037 error at its own path. The loader skips the entry rather than reading it, so the other commands work on the tree and only lint reports the entry, and the message says it cannot be read.

## Out of scope
- Symlinks in the ticket store, which is not under the spec root
- What the rules of LNT-001 to LNT-018 check: their own features
