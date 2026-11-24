---
id: PROP-120
type: proposal
title: A recording that fails is undone whole, or says exactly what it left
status: open
stage: null
touches: [PIP-008]
violates: []
depends_on: [PROP-114]
changed: []
questions: []
history: []
---
Found on 2026-11-12 while PROP-114 was reviewed, and split out of it by its spec review. When spec ticket advance has rewritten the ticket and then cannot record the stage (the build of the generated files fails, git add fails, or the commit is refused, for example by a pre-commit hook or by spec's own git hooks), it exits 1 with 'git commit failed: ...' and leaves a half-recorded stage: the ticket file already says the stage is over (blocked or open), the saved report and its transcript are already deleted, the generated files are rebuilt, `git add -A` has staged the tree (git status shows MM for the ticket file, so a plain git commit by a person would commit the recorded stage), and a blocked stage's work is in the stash while nothing is committed. PIP-008/S18 states today's behaviour ('after the ticket was already updated'), so the code matches the spec; the behaviour is what should change. What I want: after such a failure everything is as it was before the command, so the same command can simply be run again once the cause is fixed: the ticket file (and the tracker's copy, where tickets live in a tracker), the index, the generated files, the saved report and its transcript and refusal count, and a blocked stage's stash applied back into the tree. Each part that cannot be put back is named on its own stderr line with the reason, and nothing is dropped that could not be restored (a stash that does not apply is kept). The spec review of PROP-114 named the cases a first draft of this missed, and they must be covered: changes the person had already staged before the command (putting the index back needs a record of it taken before); a hook that rewrites files, so the stash no longer applies cleanly; the ticket store refusing the write after the stash was made; a tracker whose copy changed in between and refuses the second write; the order of the undo steps and what a failure part-way leaves; and that the undo runs under the same locks as the recording. A draft of the scenarios exists on PROP-114's branch history as PIP-026 (S1 a commit a hook refuses, S2 a failed build, S3 the tracker case, S4 the 'not undone' lines); it is a starting point, not a decision.
