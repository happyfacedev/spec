---
id: TASK-004
type: task
title: spec verify-history gives the same answer with far fewer git processes
status: done
stage: null
touches: [INS-016]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-11T10:51:58.165Z
    role: implementer
    result: done
    summary: Batched history reads cut Git starts from 5,424 to 260; pinned JSON verdict stayed unchanged.
    verdict: null
    assumed: []
    duration_s: 3565
  - at: 2026-11-11T11:17:50.062Z
    role: reviewer
    result: done
    summary: Batched verify-history changes offender subjects (wrapped subject, newline-named ADR) so behaviour is not preserved.
    verdict: changes
    findings:
      - cites: [INS-016/R1, INS-016/R5]
        text: "src/cli/enforcement.ts historyGit now answers `show -s --format=%s` with only the FIRST LINE of the message (commitFromObject: message.split(/\\r?\\n/, 1)[0]); git's %s joins the whole first paragraph with spaces. verify-history prints that subject in every offender (JSON `subject`, text line). Proved on a scratch clone: a trailerless governed commit with message 'multi line\\nsubject here\\n\\nbody' gives subject 'multi line subject here' with main's build and 'multi line' with the new code; a cmp of both modules in one process on the same repo reports DIFFERENT. A task must change no output. Fix: build the subject as git does (first paragraph, lines trimmed and joined by one space), and keep `.trim()` callers as before."
        class: C6
      - cites: [INS-016/R1, INS-016/R14]
        text: Tests do not pin the subject of an offender whose first message paragraph spans several lines, nor any path containing a newline, tab, quote or non-UTF-8 byte in a history check; the suite passed while the subject output changed. Add a verify-history test with a wrapped subject (expect the joined subject) and with a bypass ADR whose file name holds a newline.
        tests: true
        class: C7
      - cites: [INS-016/R1]
        text: "A bypass ADR whose path contains a newline is accepted by the old code and refused by the new. historyFile falls back to catFileBatch([`${revision}:${path}`]) for a path with \\n or \\r (prefetch skips them, the fallback does not); cat-file --batch reads one object per line, so `rev:dir/ADR-6666-x` + newline + `y.md` is read as two requests, the first object is 'missing', and bypassAdrAt sees isBypass=false. Scratch clone: commit with `spec/decisions/ADR-6666-x\\ny.md` (kind: bypass) + `Spec-Bypass: ADR-6666` -> old: no offender; new: 'Spec-Bypass ADR-6666 is not a bypass ADR'. It fails closed, but the result differs. Fix: in historyFile (and any other batch request) use `git show rev:path` when the path holds a line break, as the old code did."
        class: C6
      - cites: [INS-016/R1]
        text: "Follow-up: catFileBatch (src/io/git.ts) no longer advances `at` for a header that is neither '<oid> <type> <size>' nor '<x> missing' (for example '<spec> ambiguous'): it pushes null and `continue`s on the same line, so every later object in the batch reads as null and historyFile/prefetch store them as absent (code 1). The old catFiles skipped the header line and went on. Advance past the header line in that branch."
        class: C6
      - cites: [INS-016/R11]
        text: "Follow-up: priorHistoryContext (pre-merge hook) only needs message and parents of every first-parent commit since enforceSince, but each commit now goes through historyCommit, which spawns cat-file, diff-tree and a file prefetch per commit (about 3 processes against 2 before), because only verifyHistory preloads the range. The hook is therefore not faster and may be slower on a long enforceSince range. Preload the range in one batch there too, or read message and parents without diff-tree."
        class: C6
      - cites: [INS-016/R11]
        text: "Follow-up: commitFromObject throws 'git could not read commit' for a commit object with no blank line after its headers; the old `git show -s` printed an empty message for it. The new code turns such an old commit into a verify-history error ('history scan failed') or a refused pull instead of a normal verdict. Treat a missing blank line as an empty message."
        class: C5
    assumed: []
    duration_s: 1540
  - at: 2026-11-11T12:44:03.035Z
    role: implementer
    result: done
    summary: Restored exact Git subjects and path reads, batched prior hook metadata, and preserved pinned history JSON.
    verdict: null
    assumed: []
    duration_s: 5170
  - at: 2026-11-11T12:47:46.981Z
    role: reviewer
    result: done
    summary: Round-1 findings fixed; old and new verify-history and pre-merge hook give identical output on every probe.
    verdict: approve
    findings:
      - cites: [INS-016/R11]
        text: "Follow-up: tests/cli/enforcement-suite.ts 'INS-016/R11 batches prior metadata during the pre-merge hook' asserts zero `show` and zero `rev-list --parents` spawns, but historyGit already answers both from the cache without spawning, so those two assertions cannot fail; only `calls.length < 30` guards the batching. Assert on `cat-file` and `log` spawn counts, or tighten the bound."
        class: C7
    assumed: []
    duration_s: 212
---
Review of 2026-11-10. spec verify-history on this repository took 1 min 58 s for 105 first-parent commits (36 s user, 31 s system): about 1.1 s per commit, growing with every merge, and it is the check CI is meant to run on every push. The time is process spawning: src/cli/enforcement.ts runs several git commands per commit and per side commit. What I want: the same offenders, the same output and the same exit codes, from fewer git processes: read commit metadata, parents and changed paths for the whole range in batched calls, and read each commit or tree once however many checks need it. No cache between runs: a file saying which commits were already verified would be a new input an attacker could forge, and would need a proposal. No behaviour, scenario or message changes. Report the time before and after on this repository's history; the aim is under 20 s.
