---
id: INS-018
title: Keep Git hooks that serve another project
module: install
status: active
---
## Intent
One repository can hold more than one spec project, and all of them share the common Git directory's hooks. Each spec-managed hook records the one project path it serves. Init and upgrade update only the hooks that serve the project they run for, so setting up a nested or temporary project never silently moves commit enforcement away from the project that already uses the hooks. A hook whose project is gone serves nothing and may be taken over.

## Behaviour
### S1: A nested project's init keeps hooks that serve another project
Given the common Git directory's hooks folder holds spec-managed pre-commit, pre-merge-commit and commit-msg hooks that record the project path ".", the repository root
When "spec init" runs for a new project in the folder "tmp-probe" of that repository, or "spec upgrade" runs for a project there
Then each of the three hook files is left byte for byte unchanged and is not listed as written or updated
And for each it prints "note: kept .git/hooks/<hook>; it serves the spec project at ., not this project at tmp-probe; to repoint it, delete that file and run spec upgrade in tmp-probe", and with "--format json" the same text is in "notes"
And the run otherwise completes and exits 0, as it does when it keeps a non-spec hook (R1)
And the other way round, when the hooks record "tmp-probe" and that folder exists, init or upgrade of the project at "." keeps them and prints "note: kept .git/hooks/<hook>; it serves the spec project at tmp-probe, not this project at .; to repoint it, delete that file and run spec upgrade in ." (R1)
And each hook file is decided on its own: when pre-commit serves "." and commit-msg is absent, init in "tmp-probe" keeps pre-commit and writes commit-msg (R1)
And after the person deletes the three hook files and runs "spec upgrade" in "tmp-probe", the hooks record "tmp-probe" (R1)

### S2: A spec-managed hook whose project is gone may be taken over
Given the spec-managed hooks record the project path "gone-probe"
And no working tree of the repository, the main one or any linked worktree, has a "gone-probe" directory
When "spec init" or "spec upgrade" runs for the project at "."
Then it rewrites each hook to record "." and lists it as written: "wrote .git/hooks/<hook>" for init, "updated .git/hooks/<hook>" for upgrade
And it prints "note: took over .git/hooks/<hook> from the spec project at gone-probe, which no longer exists" (R2)
But when a linked worktree still has a "gone-probe" directory, the hooks are kept unchanged and reported as in S1 (R2)

### S3: A spec-managed hook with an unreadable project path is kept
Given a hook file carries the spec-managed marker but records no project path, an absolute one, or one with a ".." segment
When "spec init" or "spec upgrade" runs for the project at "tmp-probe"
Then that hook file is left byte for byte unchanged and is not listed as written or updated
And it prints "note: kept .git/hooks/<hook>; its spec project path cannot be read; to repoint it, delete that file and run spec upgrade in tmp-probe" (R2)
And init and upgrade read the hook file as text and never run it (R3)

### S4: Hooks for the same project are still updated however the project is named
Given the spec-managed hooks record the project path "tmp-probe"
When "spec init" or "spec upgrade" names that project as a relative path, an absolute path or a path through a symlink to it
Then each hook is rewritten, still records "tmp-probe" and is listed as written or updated
And no "kept" or "took over" note is printed for it (R1)

## Rules
- R1: Init and upgrade rewrite a spec-managed Git hook only when the project path it records, relative to the working tree root, is exactly this project's path ("." for the root); a spec-managed hook that records another existing project is kept unchanged and reported, naming both paths and how to repoint it by deleting the file and running `spec upgrade` in this project, the same way a non-spec hook is kept. Each hook file is decided on its own.
- R2: A spec-managed hook whose recorded project directory exists in no working tree of the repository serves nothing, so init and upgrade take it over and say so; a hook whose recorded path is missing, absolute or has a ".." segment cannot be checked, so it is kept and reported.
- R3: Init and upgrade read existing hook files as text and never run them; the recorded project path only decides whether a hook is kept, taken over or updated.

## Out of scope
- Where hooks are installed, a project hooksPath and what the hooks enforce: INS-015
- Which project owns a repository for edit enforcement: INS-016
