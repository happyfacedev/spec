---
id: PROP-119
type: proposal
title: The reviewer's brief leaves generated files out of its diff and lists an oversized diff by file
status: open
stage: null
touches: [PIP-016, PIP-013]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: What is the budget for the diff part of a reviewer's brief?
    default: The same token budget mechanism other briefs use (PIP-013), with a default the spec-writer picks from today's largest ordinary reviewer briefs, about 90 KB
    cites: [PIP-013]
    answer: null
    raised_by: null
history: []
---
Found on 2026-11-10 while driving tickets. The reviewer's brief inlines the branch's whole diff with no limit. TASK-003, which moved about 8,500 lines of tests between files, gave a reviewer task of 1,108,534 characters (17,788 lines). TASK-006 gave one of 1,890,095 characters, almost all of it the diff of the two generated, minified CLI bundles (.spec/bin/spec.cjs and plugin/scripts/spec.cjs), which format.Config.generated already names as generated. No reviewer can read that, and the session had to tell each reviewer by hand to read the first part of the task and take the diff from git. What I want: the diff in a reviewer's brief leaves out every path the project lists as generated, and the built-in generated paths, naming each with its line counts instead; and when what remains is over the reviewer brief's budget, the brief keeps the diff of the files that fit, largest reduction first being the files with the most lines, and lists every file left out with its line counts and the exact git command that prints its diff, with move detection, in the ticket's worktree. The reviewer must still be told the whole change is its to review, including what the brief only lists.
