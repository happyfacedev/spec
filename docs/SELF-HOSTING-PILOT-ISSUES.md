# Pilot issues: spec building spec (PROP-008 first)

Each issue: what happened, why (from the code), risk, best fix, and how it lands (ticket on spec itself, or a local fix already made).

## Status (2026-10-29)

| # | Issue | Status |
| --- | --- | --- |
| I1 | setup symlink counted as a role's change | Fixed in b90b8c7 (setup snapshot), plus `.gitignore` in 3482304 and a WORKFLOW note |
| I2 | bounce limit loses the stage | Fixed in b90b8c7: the refused report is kept, and advance blocks on a question |
| I3 | dead stage "running" forever | Fixed in b90b8c7: run records, "stopped", `--restart` (stash first; with no IDs, only dispatched runs) |
| I4 | crash called "needs a person" | Fixed in b90b8c7: a "Stopped mid-stage:" heading |
| I5 | untrusted worktrees ignore settings permissions | Documented in WORKFLOW.md (b90b8c7) |
| I6 | base moves under running tickets | Fixed by hand (ADR-002): every stage start merges the base into the ticket's branch |
| I7 | stub check matches the tool's own code | Fixed in b90b8c7: only markers the branch added count |
| I8 | foreign IDs in test names | Fixed in b90b8c7: only this spec's prefixes claim scenarios. The three test renames from PROP-008's tester are left for its reviewer |
| I9 | the pipeline can't fix its own blocking checks | ADR-001 records the bootstrap procedure. Bundle rebuilt and copied |
| I10 | merges don't refresh the bundled CLI | Fixed by hand (ADR-002): `afterMerge` in this repo's config rebuilds and copies it after every merge |
| I11 | no cap on parallel tickets | Open. Practice: batches of about 5. Ticket for `maxParallel` |
| I12 | run log shows only the overseer's summary | Open, low. Ticket |
| I13 | one refused command ends Bash use (Haiku) | Fixed in roles and config (6136eae). Ticket to derive it from `dispatchCommand` |
| I14 | tester skips lint; implementer can't fix tests | Fixed in the tester role (6136eae). Ticket for `checkCommands` |
| I15 | `''` convention misread as single quotes | Convention clarified. Ticket for `\"` in quoted values |
| I16 | no way back to the tester | Open. Worked around with commits by a person (ab716c3, c67ed31, e3e845b). Ticket for `answer --back tester` |
| I17 | blocked implementer reverts finished work | Fixed by hand (ADR-002): `ticket advance` stashes a blocked stage's work, and its next start restores it |

Pilot result: PROP-008 merged (627f373) after 3 runs. Stages took about 2–4 minutes each on Sonnet 5.5 medium.

## I1 · The recommended node_modules symlink makes every stage fail its path check
- **Seen:** run 1. The spec-writer was refused at finish: the worktree's `node_modules` (a symlink made by `worktreeSetup`) counted as an untracked change outside spec files.
- **Why:** check-report lists changed paths with `git status --untracked-files=all` and `ls-files --others --exclude-standard` (`src/io/git.ts:80,105`). `.gitignore` had `node_modules/`; a trailing slash matches directories only, and a symlink is a file. WORKFLOW.md recommends exactly this symlink.
- **Risk:** high. It fails every stage of every ticket in any repo with a dir-only ignore, and the failure looks like a role breaking its rules.
- **Fixed locally:** `.gitignore` is now `node_modules` (commit 3482304).
- **Best fix in spec:** `spec worktree add` records the untracked paths `worktreeSetup` creates (a snapshot right after setup, stored under `.git/spec/setup/<ID>`), and check-report leaves those paths out of every role's path rules. Setup output belongs to no role. Also warn in WORKFLOW.md about the slash. → ticket.

## I2 · After 3 bounces a stage finishes with no report, and the ticket is stranded
- **Seen:** run 1. The spec-writer was bounced (because of I1), then allowed to finish. `ticket advance` had no stored report and asked for it on stdin. The overseer could not supply it, and the stage was lost.
- **Why:** before-finish returns "nothing" once `n > MAX_BOUNCES` (`src/adapters/claude-code/hooks.ts:109`), so the role ends without a saved report. The overseer may run only single commands (`Bash(spec ticket advance *)`), so it cannot pipe a report on stdin. One attempt was also refused by Claude Code's Bash safety check on the quoting.
- **Risk:** high. Any stage that keeps failing its check ends the same way: silently stranded, with the ticket left `in_progress` and no question for a person.
- **Best fix in spec:** at the bounce limit, record the failure as `ticket advance` does for an invalid report. The ticket goes `blocked`, with a question listing the check's problems, so the gate shows it and `spec ticket answer` resumes it at the same stage. Also let `ticket advance` take `--report <file>`, so an overseer can pass a report without stdin. → ticket.

## I3 · A stage that dies leaves the ticket "running" forever
- **Seen:** retry 1. orchestrate answered "already running (stage spec-writer)", although nothing ran.
- **Why:** "running" is only `status: in_progress` in the live ticket file (`src/cli/worktree.ts:141`, `src/cli/tickets.ts`). No process or lock is checked. No command restarts a stage.
- **Risk:** medium-high. Every crash, timeout, kill or I2 case needs a hand edit of the ticket file, which the workflow forbids.
- **Worked around locally:** reverted the uncommitted `ticket start` change in the worktree (no history entry existed).
- **Best fix in spec:** dispatch writes a run record (pid, start time, log) under `.git/spec/runs/<ID>.json` and clears it on exit. plan counts a ticket as running only while that pid is alive; otherwise it is `stopped`, shown with its log, and `spec dispatch`/`orchestrate` restart it at the same stage, discarding the dead stage's uncommitted changes outside the tickets folder. → ticket.

## I4 · orchestrate calls a crashed stage "needs a person"
- **Seen:** run 1 summary: "PROP-008: in_progress: it needs a person". Nothing asked a person anything.
- **Risk:** low-medium. It sends a person looking for a question that doesn't exist.
- **Best fix in spec:** report `stopped mid-stage (<stage>)`, the dispatch exit code and the last lines of the log; keep "needs a person" for open blockers. Lands with I3. → same ticket as I3.

## I5 · The workspace is untrusted, so settings permissions are ignored
- **Seen:** every run: "Ignoring 3 permissions.allow entries from .claude/settings.json: this workspace has not been trusted".
- **Why:** Claude Code trusts per folder, and each ticket worktree is a new folder that was never trusted.
- **Risk:** low today, because `dispatchCommand` passes everything as `--allowedTools`, which still applies. It becomes a risk if anyone relies on settings.json for the headless runs.
- **Best fix:** document that `dispatchCommand` must carry every permission itself, and have `spec init` say so. No code change. → docs, with the I1 ticket.

## I7 · The implementer can never finish in a repo whose code mentions SPEC-STUB
- **Seen:** retry 2. The implementer's work was done (481 tests pass, typecheck and lint clean), but it was refused with "SPEC-STUB is still in README.md, docs/…, src/core/stubs.ts, src/generated/assets.ts…". The ticket is now blocked as PROP-008#Q1.
- **Why:** the implementer check greps every code file for the marker text (`src/cli/report.ts:43`, `filesContaining(…, STUB_MARKER, codeGlobs)`). In spec's own repo, the code that implements stubs, and the role prompts and docs that describe them, contain the word. The same happens in any repo that documents the marker or vendors spec.
- **Risk:** high for this repo: no implementer stage can ever pass, so no ticket merges. Low elsewhere.
- **Best fix in spec:** count only stub lines the ticket's branch added. That is the added lines holding the marker in the diff from the merge base of the base branch to the worktree, which the tester check already parses as hunks (`unmarkedChanges`). Text that was on the base branch before the ticket is never a stub of this ticket.
- **Constraint:** this cannot go through the pipeline. The fix's own implementer stage would be judged by the current bundled CLI and refused the same way (see I9).

## I8 · Tests that mention other specs' IDs must be renamed
- **Seen:** retry 2. The tester renamed three existing test titles (`tests/core/fixture.test.ts`, `ids.test.ts`, `test-report.test.ts`). For example "PRV-002/S3 is the BUG-301 scenario…" became "the BUG-301 scenario…", and "%s is a %s" became "classifyId: case %# is a %s". Those tests name fixture IDs (chat-mini's PRV-…) as data, and the check said they name scenarios this spec doesn't have.
- **Why:** the tester check reads any feature-shaped ID at the start of a test name as a scenario claim (`src/core/report.ts:243`, `scenarioOfTest`), whatever its prefix. Lint's L026 already ignores IDs whose prefix is not one of this spec's.
- **Risk:** medium. It forces edits to unrelated tests, and the renames make them worse (`case %#` hides the ID under test). Any repo that tests with example IDs hits it.
- **Best fix in spec:** apply L026's rule. A test name claims a scenario only when its prefix belongs to one of this spec's modules. Then revert the three renames in PROP-008's branch, or let its reviewer judge them.
- **Constraint:** like I7, best landed outside the pipeline (a tester stage on it would trip it).

## I9 · The pipeline cannot fix the checks that block it
- **Why:** every stage is judged by the bundled CLI copy in `.claude/skills/spec-spec/scripts/`, frozen at install. A fix to a check in `src/` only takes effect after `npm run build` and copying `dist/spec.cjs` over the bundled copy. And a ticket whose own stages are blocked by the bug it fixes can never run.
- **Risk:** structural, for spec developing spec. Any check bug that blocks a stage needs a bootstrap fix: by hand, on main, with tests, then rebuild and copy the bundle.
- **Best fix:** a documented bootstrap procedure for this repo. Fix in `src/` with tests, `npm run check`, update the spec scenarios it changes in the same commit, rebuild, copy the bundle, commit, then resume the tickets. Record each bootstrap change as an ADR, so the spec shows why it changed outside a ticket.

## I10 · Merging a ticket doesn't update the bundled CLI the pipeline runs
- **Seen:** after PROP-008 merged, `.claude/skills/spec-spec/scripts/spec.cjs` is still the bootstrap build (b90b8c7). Every later stage is judged by that copy, not by the merged code.
- **Risk:** medium, and it grows with every ticket that changes a check or a command the pipeline uses (PROP-016 review rounds, PROP-018 test-name matching, PROP-019 brief, PROP-023 to 027 worktree/merge/orchestrate). Their fixes don't apply to the tickets that run after them until the bundle is refreshed. Refreshing mid-batch also changes the rules under tickets already running.
- **Best fix:** between batches (never during one), run `npm run build`, copy `dist/spec.cjs` over the bundled copy, run `spec lint --ci`, and commit "bundle: refresh after <IDs>". Longer term, a config hook (`afterMerge`) that runs this for repos that ship spec itself. → practice now, ticket later.

## I11 · No limit on how many tickets run at once
- **Seen:** `spec plan` puts all 27 remaining tickets under "Start now, in parallel". `orchestrate` would start 27 headless Claude Code sessions at once, each spawning subagents.
- **Risk:** high for cost and rate limits. Sessions refused by rate limits die mid-stage (now recoverable with `--restart`, but it wastes runs).
- **Best fix in spec:** a `maxParallel` config key (and an `orchestrate --max <n>` flag) that caps one wave and keeps the rest for the next wave. Until then, run orchestrate with explicit ticket IDs in batches of about 5. → ticket.

## I12 · The run log shows only the overseer's final message
- **Seen:** each `.git/spec/runs/<ID>-<time>.log` holds the trust warning and the overseer's summary. What each role did is only in the stage commits and the ticket history, and the role transcripts are not linked.
- **Risk:** low. Debugging a failed stage means guessing (run 1 had to infer I1 from the overseer's summary).
- **Best fix:** have dispatch pass `--output-format stream-json` (or `--verbose`) to the log, or record each subagent's transcript path in the ticket history. → ticket, low priority.

## I13 · One refused command makes a role give up on Bash entirely
- **Seen:** batch 1 (Haiku 5.5 xhigh). The implementers of PROP-003 and PROP-020 reported "Bash is denied for this session", changed nothing and blocked. Their transcripts show only two kinds of command refused: a bare `spec show …` (not the allowed full path) and `git -C <path> status`/`log` (not in `--allowedTools`). The tester stages before them did the same and skipped running the tests.
- **Why:** permission rules match each command, so only those commands were refused. Claude Code's refusal text reads like a blanket denial, and Haiku took it as one.
- **Risk:** high on smaller models: stages finish without verifying, or block for nothing.
- **Fixed locally (6136eae):** each stage role now says to write spec as its full path, that a refused command is refused on its own, and lists the allowed forms. `dispatchCommand` now allows read-only git (`git status*`, `git diff*`, `git log*`, `git show*`).
- **Best fix in spec:** have `compile-roles` write the project's real allowed commands into each agent (from `dispatchCommand`), and have the shared rules carry the "refused alone" sentence. → ticket.

## I14 · The tester never runs lint, and the implementer may not fix test files
- **Seen:** batch 1, PROP-001. The tester's new test file had 8 `no-confusing-void-expression` errors. The implementer's work passed every test, but `npm run lint` failed in a file only the tester may change, so the implementer blocked.
- **Risk:** medium. Any lint or type error in test files deadlocks the ticket at the implementer: the stage that could fix it is over, and the stage that is running may not.
- **Fixed locally (6136eae):** the tester role now runs `npm run lint` and `npm run typecheck` and fixes its own files before finishing. PROP-001 was unblocked by a separate commit by a person on its branch (ab716c3, `eslint --fix`, no behaviour change), visible to its reviewer.
- **Best fix in spec:** a `checkCommands` config (for example lint and typecheck) that check-report runs for the tester and the implementer, and that refuses a tester stage whose test files fail them. That makes it a check rather than a request in a prompt. → ticket.

## I15 · The `''` convention reads as single quotes
- **Seen:** batch 1, PROP-020. TKT-004/S14 wrote the message as `listed ''notes''`, meaning `listed "notes"` by the convention. The tester read it as single quotes, the implementer then found test and scenario disagreeing, and blocked.
- **Risk:** medium. Every scenario that quotes output containing double quotes is open to this.
- **Fixed locally:** conventions.md now spells out that `''` is one double-quote character, with an example (main). PROP-020's test was corrected by a commit by a person (e3e845b).
- **Best fix in spec:** let quoted values in steps carry `\"`, so lint's cite scanner treats an escaped quote as part of the value. Then retire the `''` convention. → ticket.

## I16 · No way back to the tester when its tests are wrong
- **Seen:** PROP-001, PROP-003 and PROP-020. The implementer correctly stops when a test is wrong (lint errors in a test, or a test that contradicts its scenario). But answering the question resumes the implementer, which still may not touch tests. The only way out was a commit by a person on the ticket branch.
- **Risk:** medium-high. Every wrong test needs a person to edit code by hand, which is what the pipeline exists to avoid.
- **Best fix in spec:** `spec ticket answer <ID> <Q> <text> --back tester` (also allowed on blockers raised by the reviewer). It sets the next stage to the tester, whose brief then includes the answered question, so the tester fixes its own tests and the pipeline continues tester → implementer → reviewer. → ticket.

## I17 · A blocked implementer throws its finished work away
- **Seen:** PROP-001 and PROP-003. Code that passed every test was reverted when the stage blocked on a test-file problem, so the resumed implementer had to redo it.
- **Why:** the shared rule "When you are blocked, revert your uncommitted changes before you report."
- **Risk:** low (cost only).
- **Best fix:** when blocked, `git stash push -m "<ID> <role>: blocked"` instead of reverting, and say so in the report. The next run of the same stage pops it first. → part of the I16 ticket.

## I6 · The base branch moves while tickets run
- **Seen:** I committed the I1 fix on main during the pilot, and had to fast-forward the pilot's worktree by hand.
- **Risk:** medium. A ticket branched before a fix runs without it. Merge catches conflicts and test failures, but not setup or config fixes the run needed.
- **Best fix:** none needed in code. As practice: land infra fixes before dispatching, and restart (I3) the tickets that started before.
