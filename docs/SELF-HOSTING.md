# Spec process findings: spec specifying and building itself

This is the historical record of findings from drafting and running spec on its own repository. The numbered findings are kept so older ticket references still resolve. Statuses in batches 1–7 describe those runs, through 2026-11-02, not today's backlog; the 2026-11-10 review is recorded in batch 8. Each finding names its original evidence and proposed fix. The I-numbers are detailed in [SELF-HOSTING-PILOT-ISSUES.md](SELF-HOSTING-PILOT-ISSUES.md). A-numbers come from the drafting agents' reports, P-numbers from the process around them.

## Historical findings (batches 1–7, through 2026-11-02)

### Items previously parked (2026-10-31 snapshot)

These bullets record questions that were open at the time, not a current work queue. Batch 6 records the person's decisions on the plugin direction, the renumbering, and the PROP-046 scope question.

- **The plugin integration (2026-10-31): confirm the direction.** `main` now follows plugin-integration: spec ships as a Claude Code plugin with a pinned `.spec/bin` CLI, stages are driven from the session with `spec next`, and dispatch, orchestrate, the overseer role and compiled agents are gone (X139); S3 enforcement (X140) and the S4 setup flow (X141, X142) are in. Main's own tickets (PROP-025, 038, 039, 050–053, 055–059) were ported onto it; their overseer-only parts were dropped, including the old dispatch/orchestrate `--max` controls.
- **Renumbering to confirm.** plugin-integration's tickets PROP-050–056 are PROP-060–066 on main (main had used 050–059). Scenario and rule IDs both sides had added were renumbered on the plugin side: FMT-002 S19–S21 and R9–R11, WSP-006 S33–S34, LNT-003 S26–S27 and R10–R11, lint rules L033–L034 (S3's L029/L030), PIP-003/S17, PIP-004/S21, PIP-008/S27, PIP-012/S20, TKT-001/S29 (PROP-061's). docs/PROCESS-LEDGER.md keeps the old ticket IDs with a mapping note.
- **This repo pins its CLI (INS-014/S15).** `format.Config.afterMerge` remains an available option for projects that configure it (WSP-006/S18–S24 and R6; FMT-002/S16). This repository does not use `afterMerge` to refresh the pinned `.spec/bin`; that copy changes when someone runs `npm run build` or `spec upgrade`.
- **enforceSince moved under a bypass (ADR-003).** With plugin-integration's `enforceSince` (7613f7d), `spec verify-history` failed on every plugin, S3 and main commit merged by plain git (no `Spec-Ticket` or `Spec-Bypass` trailer); it also took 11 min 21 s on 52 commits (PROP-066 part 2 targets that). As X140 prescribes for landing, `enforceSince` is now the S3 merge on main (cd06fc3), in one commit under bypass ADR-003, opened by the agent on your standing approval to finalize. Confirm, or move it back. PROP-061, the first ticket merged through the pipeline with enforcement on, then showed that the pipeline's own stage, sync and answer commits carried no `Spec-Ticket` trailer, so every merged ticket failed the history check; PROP-070 fixed it (f228f8c), and `enforceSince` moved past the 35 earlier trailer-less commits under bypass ADR-004.
- **Spotlight (P78).** Indexing the many temporary git repositories the tests create took about 150% CPU and helped push test runs past their timeouts. Consider excluding `~/dev` and the temporary test folders from Spotlight.
- **Live checks (plugin):** done headless on Claude Code 2.1.312 (batch 6); re-check after Claude Code updates. The 2026-10-31 snapshot had not yet tested an interactive session.
- **A scope call to confirm or reverse (PROP-046).** Its second review found five edge cases, all from YAML anchors, aliases and non-string keys (numeric, boolean, null) in ticket files, which spec itself never writes. The overseer decided ticket files may not use them: lint reports each as an L020 error with a fix, and the gate refuses such a ticket. Unknown string keys are still kept and ignored. If anchors should be supported instead, file a proposal against TKT-001.

**Outcome recorded in batches 6–7.** The plugin direction, the renumbering and PROP-046's refusal of YAML anchors were kept. Batch 6 records a headless live plugin check; the earlier 2026-10-31 parked-list snapshot above said an interactive session had not yet been tested. Batch 7 records the Spotlight action to hide `~/dev` and TASK-001's cleanup of test repositories and child processes. This repository keeps its CLI pinned in `.spec/bin`; `format.Config.afterMerge` remains available to projects that configure it, but this repository does not use it to refresh the pinned CLI. Under INS-014/S15, the tracked `.spec/bin` copy changes through `npm run build` or `spec upgrade`.

### The six root causes (historical)

| # | Root cause | Findings | What it costs |
| --- | --- | --- | --- |
| R1 | The spec language can't say "this is literal output" | A1, A2, A3, A13, A16, I15 | Every scenario about output needs quoting tricks, and tests misread them |
| R2 | A CLI's surface (flags, exit codes, streams, env vars) has no first-class place | A4, A5, A6, A14, A15 | Scenarios state the most important facts in unlinked prose; impact misses them |
| R3 | A stage's lifecycle has holes: it can't die, overflow, or go back cleanly | I2, I3, I4, I16, I17 | Each hole needed a person to hand-edit tickets or tests |
| R4 | Rules that matter live only in role prompts, not in checks | I13, I14, P4 | Smaller models skip them (Haiku: lint, allowed commands) |
| R5 | The run environment leaks into role checks | I1, I5, I6, I10 | Correct stages are refused for files and permissions no role touched |
| R6 | spec hosting spec: the tool judges its own changes | I7, I8, I9 | Bugs in checks can only be fixed outside the pipeline (ADR-001) |

Plus scale and visibility (I11, I12, P8, P9) and the adoption flow (P1, P2, P3, P5, P6).

### Authoring findings (from the nine drafting agents; historical)

- **A1 · Backticks and fenced blocks are cites.** An ID inside `` `spec show X` `` or a fenced output block becomes a link. 6 of 9 agents hit it. Real command output that prints IDs trips L004. **Fix:** a `text` or `output` fence, and inline code, are data and never cites; lint stops scanning them.
- **A2 · A quoted value can't hold `"`.** Messages like `Unrecognized key: "owner"` had to be paraphrased or written with `''`, which then got misread (I15). **Fix:** `\"` inside quoted values; retire `''`.
- **A3 · Rules cite quoted IDs; steps don't.** `SHA-256` in a rule raised L004, but was ignored in prose. **Fix:** one quoting rule for steps, rules and step data.
- **A4 · Flags, env vars, exit codes and stdout/stderr can't be linked.** `--no-tests` can't be a member name, so it became `noTests`. `SPEC_MAIN_ROOT` and "exits 2" are prose. Impact never reaches the option scenarios. **Fix:** a `Kind: option` contract (`cli.Options.--root` style IDs, or `Flag: --root` lines on members), and `exit`/`stdout`/`stderr` as reserved Then words mapped to `cli.CommandResult` automatically.
- **A5 · Only one feature may `provide` an operation.** Six CLI features each implement a slice of `cli.Run`, and five hook features each implement a slice of `install.Hook`. All but one must "call" what they implement. **Fix:** let several features provide one operation when each names the slice (a member or a qualifier), and keep L012 for two features providing the same slice.
- **A6 · `Output:` doesn't fit commands.** Text versus JSON, partial success ("confirmed 3, refused 1, exit 1"), and line-oriented output have no shape. **Fix:** allow `Output:` per format (`Output (json): …`), and let error contracts carry an `Exit:` and a `Stream:`.
- **A7 · A question that cites a contract must be a blocker (L010).** A real preference about an error contract lost its cite. **Fix:** allow cites on preferences; keep "cites an invariant ⇒ blocker".
- **A8 · YAML errors are L001 with a parser message.** An unquoted `: ` gives "Nested mappings are not allowed". **Fix:** detect that case and say "quote the value".
- **A9 · Nothing detects two features specifying the same behaviour.** TKT-003 duplicated WSP-004, and INS-012 duplicated PIP-015. **Fix:** a lint warning when two features list the same `sources:` line or near-identical scenario steps, plus ownership up front (P2).
- **A10 · Observed links count toward L009 ("referenced as a whole").** **Fix:** count only links the feature's code uses.
- **A11 · No shared fixtures.** 17 lint features each restate "the base spec of LNT-001". **Fix:** a named fixture unit (`FIX-001`) that steps can cite as their Given.
- **A12 · No convention for values that vary** (`<time>`, `<abbreviated HEAD>`). Added to conventions.md here. **Fix:** make it part of FORMAT.md, and have lint accept `<…>` placeholders in quoted values.
- **A13 · Which IDs count as cites is hard to predict.** Foreign prefixes never count; our own prefixes and contract-shaped names do, quoted or not depending on where they are. **Fix:** follows from A1 and A3. One rule, stated in FORMAT.md, with `spec lint --explain-cites <file>`.
- **A14 · The usage text is quoted in full in CLI-001/S1.** Any command change rewrites a cli scenario. **Fix:** a scenario per command for its usage line, owned by that command's module.
- **A15 · An error contract per refusal line** (19 in workspace) just to name exact messages. **Fix:** with A6, a result line is a value of a type, not a new error contract each.
- **A16 · Example IDs in prose are checked (L026).** A spec about specs is full of them. **Fix:** inline code is data (A1).

### Pipeline findings (from the runs; historical; details in SELF-HOSTING-PILOT-ISSUES.md)

| # | Finding | Root | Status |
| --- | --- | --- | --- |
| I1 | setup symlink counted as a role's change | R5 | fixed (b90b8c7) |
| I2 | bounce limit lost the stage silently | R3 | fixed (b90b8c7) |
| I3 | dead stage "running" forever | R3 | fixed (b90b8c7, `--restart`) |
| I4 | crash reported as "needs a person" | R3 | fixed (b90b8c7) |
| I5 | worktrees are untrusted, settings permissions ignored | R5 | documented |
| I6 | base branch moves under running tickets | R5 | fixed by hand (ADR-002): each stage start syncs its branch with the base |
| I7 | stub check matched the tool's own code | R6 | fixed (b90b8c7) |
| I8 | foreign IDs in test names forced renames | R6 | fixed (b90b8c7) |
| I9 | the pipeline can't fix checks that block it | R6 | ADR-001 procedure |
| I10 | merges don't refresh the bundled CLI | R5/R6 | fixed by hand (ADR-002): this repo's `afterMerge` rebuilds and copies it |
| I11 | no cap on parallel tickets | scale | practice: batches of 5 |
| I12 | run log shows only the overseer's summary | visibility | open |
| I13 | one refused command made Haiku give up on Bash | R4 | fixed in roles and config (6136eae) |
| I14 | tester skipped lint; implementer may not fix tests | R4 | fixed in the tester role (6136eae) |
| I15 | `''` read as single quotes | R1 | convention clarified |
| I16 | no way back to the tester | R3 | open (3 commits by a person) |
| I17 | blocked implementer reverts finished work | R3 | fixed by hand (ADR-002): `ticket advance` stashes a blocked stage's work |
| I18 | `ticket new` folds titles over 80 characters into invalid YAML | bug | PROP-035 |

| I19 | a spec-writer's legitimate change widens scope, and the gate then stops the tester | R3 | open, ticket |
| I20 | orchestrate never retries a ticket that paused for a conflict that has since cleared | R3 | fixed by hand (ADR-002), with I20b: orchestrate plans again after each wave's merges |
| I21 | a flaky run-log test refused about half of all merges | R6 | fixed by hand (eb707ab) |
| I23 | a test failing on its own setup passes the test-first check | R4 | open, ticket |
| I24 | merge doesn't recompile agents | R5 | fixed (PROP-037); running tickets get them at their next stage start (ADR-002) |
| I25 | the committed bundled CLI conflicts on every merge that refreshes it | R5/R6 | fixed (PROP-037, ADR-002): never merged as text, rebuilt by `afterMerge`; a stage start's sync takes the base's copy |
| I22 | a ticket back at `open` no longer counts in the plan, so a later wave ran overlapping spec stages | R3 | open, ticket (high) |
| I26 | a new role rule (stash on block) needed a permission nobody checked | R4 | fixed by hand (ADR-002): the CLI stashes, so no role needs `git stash` |
| I27 | the role's stash on block also stashed the ticket's live state | R3 | fixed by hand (ADR-002): `ticket advance` stashes, never the tickets folder |
| I28 | overlap that shows only after a spec stage still ran in parallel | R3 | fixed by hand (ADR-002): before its spec stage a proposal's reach is one ring wider |
| I29 | a feature can be enabled in code and not in the project's config | process | open |
| I30 | model and cost per stage never reached the history | visibility | fixed by hand (ADR-002): the finish hook keeps the transcript for `ticket advance` |
| I31 | a reviewer approved while noting the change did not deliver | R4 | fixed by hand (ADR-002): the reviewer role, and a check-report tripwire |

Since ADR-002, `tests/e2e/pipeline-scripted.test.ts` runs tickets through every stage with a scripted stand-in for the model (`tests/e2e/fake-roles.mjs`), so a pipeline regression fails `npm test` rather than the next real run.

**I19.** PROP-028, 030, 031 and 033 each added a key to `format.Config`. INS-001 writes that contract, so the gate reported `scope_gap INS-001` before the tester. The ticket went back to `open` with no question, and only a person editing `touches` could move it on. **Fix:** after a spec-writer stage, `ticket advance` adds the units the gate's scope rule requires to the ticket's scope (`changed`), and records them in the commit. The rule is mechanical, so it needs no person.

**I20.** PROP-034's tester was refused because PROP-035 was running. PROP-035 merged in wave 1, but orchestrate listed PROP-034 as "waiting for a person" instead of starting it in wave 2. **Fix:** a ticket that ended `open` because it waited for another ticket is planned again in the next wave.

**I21.** WSP-005/S9 (the run log holds stdout and stderr) became flaky. PROP-032 changed logging, and its merge passed by luck. Afterwards `main` failed it 2 of 4 times, so every later merge was refused about half the time (PROP-034's was). **Cause:** dispatch resolved a run on the child's `close` and called `out.end()` without waiting for the log to flush, so a reader could miss the last chunk. **Fixed by hand (eb707ab, ADR-001):** resolve after the stream finishes; 6 of 6 runs pass. **Practice:** before calling a failure a regression or a flake, run the same tests several times on the base branch. **Fix in spec:** merge reruns a failing test once, and reports a test that fails, then passes, as flaky, with both results, instead of refusing silently.

**I23.** A test that fails on its own setup passes the test-first check. PROP-028's tests started a proposal at the tester stage with no spec-writer stage; PROP-034's built a bug ticket with no `violates`. Both failed "as expected" at the tester stage, but on a refused command, and only the implementer found out. **Fix:** for new scenarios, check-report accepts a failing test only when it fails on an assertion (vitest/jest `AssertionError`, JUnit `failure` rather than `error`). The tester role adds: make each new test fail on the Then it checks.

**I24.** Merge rebuilds `index.md` but not the compiled agents. When one branch changes role prompts and another changes `compile-roles` (PROP-034 and PROP-029), the merged agents are stale (L021) and merge refuses. **Fix:** merge recompiles agents like it rebuilds the index.

**I25.** The bundled CLI is a committed, generated file, so two branches that refresh it always conflict (PROP-034 against eb707ab). **Fix:** merge rebuilds it from the merged source (with I10's `afterMerge`, or as a built-in step for repos whose skill bundles spec), and never merges it as text.

**I22 (high).** The plan keeps two proposals on one feature apart only while one is in progress. PROP-028 dropped back to `open` after its spec-writer stage (I19), so wave 2 started PROP-030, and later waves started PROP-031 and PROP-033. Their spec-writers all added FMT-002/S14 and R5, and WSP-005/S22 onward collided with PROP-032. Merging them would conflict, or reuse IDs. **Recovered:** the first attempts of PROP-030, 031 and 033 are archived as `archive/PROP-0xx-spec-attempt-1`, and they will rerun one at a time. **Fix:** the plan counts any ticket whose branch holds a recorded stage and is not merged as in flight, whatever its status.

Filed as proposals on spec: PROP-028 (`checkCommands`, I14), PROP-029 (allowed commands in agents, I13), PROP-030 (`maxParallel`, I11), PROP-031 (model per size and cost per stage, P8, P9), PROP-032 (per-stage run log, I12), PROP-033 (`afterMerge`, I10), PROP-034 (`answer --back`, stash on block, I16, I17), PROP-035 (long titles, I18).

### Process findings (historical)

- **P1 · Confirming drafts unit by unit doesn't scale.** 326 drafts. We approved per module, with the open questions answered on a visual review page (the `decide` skill), which worked. **Fix:** `spec confirm --module <id>` (and `--all-from <file>`). `/spec-init` should end in a module-level review plus one question screen per open question, not a unit list.
- **P2 · Parallel drafting needs ownership first.** Three overlaps had to be reconciled afterwards. **Fix:** `/spec-init` writes an ownership table (command or behaviour → module) into each `_module.md` "Owns" before any drafting starts, and drafting agents get the table.
- **P3 · Draft reports overstate.** One agent miscounted scenarios (136 vs 126). Others made claims nobody has verified yet: the lint agent's "the L008 'not in the frontmatter' branch is dead code", for one. **Fix:** `spec gaps` reports counts. The skill says to verify counts and spot-check claims before confirming. Done here by hand.
- **P4 · Hand-written invariants and conventions were wrong against the code.** INV-002/003/004 and the error model were written from memory and corrected after drafting. **Fix:** draft invariants and conventions from code like features (with `sources:`), and never write them as the frame.
- **P5 · Drafting turned up real bugs.** Four were filed (PIP-002 dead end, ticket new ID reuse, plan double-listing, a plural). Drafting from code works as an audit. **Fix:** `/spec-init` should collect "the code looks wrong here" separately from questions, ready to become bug tickets.
- **P6 · The invariants weren't in the review and blocked three tickets at the gate.** **Fix:** the review covers every drafted unit kind; `spec gaps` lists core drafts first.
- **P7 · Bug versus proposal.** The spec states today's behaviour, so every "the code is wrong" became a proposal, not a bug. That's correct, but it means the bug flow never fired. **Fix:** when confirming, offer "confirm as it should be" (then file a bug) as the `/spec-init` skill already describes. The review page should offer it as a fifth answer.
- **P8 · One model for every ticket.** `dispatchCommand` is one string; we added `SPEC_MODEL`/`SPEC_EFFORT`. **Fix:** a ticket `size` or `model` field (or a reach threshold) that dispatch maps to a model, so small tickets go to Haiku and big ones to Sonnet without separate batches.
- **P9 · No cost or duration per stage.** We estimate from timestamps. **Fix:** dispatch records duration and the token/cost line from `claude -p --output-format json` in the run record and the ticket history.

- **P10 · A bug needs a violated scenario, but some bugs only break a contract or a rule.** `ticket new` refuses 81–120 character titles that `tickets.NewTicket.title` and TKT-005/R6 allow, and no scenario covers that range, so it had to be filed as a proposal (PROP-035). **Fix:** let a bug's `violates` name a rule or a contract member too. Its tester then adds the missing scenario, and the test must fail first, as for any bug.

### From batch 2 (run by hand, one subagent per stage, while `claude -p` could not log in)
- **P11 · A landed proposal leaves its question's answer stale.** Review answers say "until it lands, the spec states today's behaviour"; once it lands that is false, and no role may edit question answers. Seen on CLI-002, PIP-015, WSP-008. **Fix:** the spec-writer may rewrite the answer of a question its ticket resolves.
- **P12 · Tests drive the bare command; users come through the skill.** The skill always sends `--query '$ARGUMENTS'`, so a lone ID reached `spec brief` as both role and query. PIP-015's tests all passed while the skill path regressed; only the reviewer caught it. **Fix:** scenarios for behaviour reached through a skill or wrapper state that path too (now in the spec-writer role, see P14).
- **P13 · A `changes` verdict always goes to the implementer.** When the gap is a missing scenario, the implementer may not add it, so a person reopened the spec-writer by re-answering an old question with `--back`. **Fix:** PROP-040.
- **P14 · Spec-writers recalled today's behaviour instead of checking it.** Three "as today" defaults in PROP-019 were wrong (unit and module first words, skill path), and each reached review as a regression. **Fixed** in the spec-writer role (`63fcbb6`): run the current build on the exact case, through each way a user reaches it, before writing what it prints.
- **P15 · A spec-writer may not fix drift it finds outside its brief.** The orchestrate syntax in the workspace module lacks `--depth`. **Fix:** PROP-041; longer term, the spec-writer files such drift as a follow-up ticket (with I30).
- **P16 · No way to close a ticket.** Combining PROP-013 into PROP-012, PROP-026 into PROP-025 and PROP-054 into PROP-052 meant deleting the absorbed files. **Fixed:** PROP-038 (`spec ticket combine`, status `absorbed`); the three were restored as absorbed tickets. **Fix:** PROP-038 (`spec ticket combine`, status `absorbed`), PROP-039 (plan suggests combinations).
- **P17 · No ticket priority.** The plan orders by ID, so process tickets filed later (PROP-038–040) land in waves 4–5 behind feature tickets, and widely used members (`cli.CommandResult.exitCode`) make unrelated tickets look like they overlap. **Fix:** PROP-039 removes the false overlaps; a `priority` field is a candidate if order still matters after it.
- **P18 · The test-first check accepts an assertion on the wrong thing.** PROP-016's S8 test failed on `created: true` because its setup never made the branch, not on the round limit it tests; the check saw an assertion failure and passed it, and the implementer had to block. **Fix:** the tester shows, for each new test, that its failure message is about the behaviour the ticket changes; longer term, the check compares the failing assertion with the scenario's Then.
- **P19 · A tester rerun after a review round could never pass the test-first check.** The implementer's code is already on the branch, so tests of a scenario the code delivers pass and the tester is refused (PROP-012). **Fix (user decision):** INV-004 applies only before the ticket's first implementer stage; later tester rounds may leave new tests passing (PROP-040, PIP-006/R9, S26).
- **P20 · check-report and advance validate a report differently.** A blocker citing a ticket ID passed `check-report`, then `ticket advance` refused to store it ("not a valid unit ID"), so nothing was recorded. **Fix:** check-report validates `cites` with the same schema advance uses.
- **P21 · A ticket that changes the stage checks is judged by the old checks.** PROP-040 added INV-004's rerun rule, but its own later tester stage was checked by the bundled CLI from main, which still required a failing test; the overseer recorded that stage with the branch's own CLI (`npx tsx src/cli/main.ts ticket advance`). Same root as R6. **Fix:** for a ticket whose changed units include the pipeline's check rules, advance runs the branch's CLI, or the overseer is told to.
- **P22 · Wall-clock and default-timeout tests failed at random under load.** With five worktrees running the suite at once, WSP-005/S3 (two starts within 900 ms) and PIP-002/S15 (5 s vitest default) failed stage checks and a review. **Fixed** on main: S3 asserts overlap instead (`462d1d0`), and the suite's default timeout is 30 s (`ef0cac6`).
- **P23 · A failing suite with no failed assertion is not named.** When a test file or hook errors, the stage check says only "tests fail (exit 1): see the test output", and the report parser (`src/core/test-report.ts`) sees no failed test. **Fix:** name failed files and suite errors from the report, and keep the last lines of the test output in the question.
- **P24 · An implementer refreshed installed skills with `spec init . --update-roles --yes`, which also replaced this repo's tuned role prompts.** That is specified (INS-005/S4: `--yes` replaces tuned prompts; without it, a warning), so not a bug; the implementer restored them and nothing was lost. **Fix:** role briefs say never to run `--update-roles --yes` in the project itself; installed copies are refreshed by `afterMerge`.
- **P25 · The recovery message for a stash that does not apply contradicts the dirt check.** A4 says "a person must apply it by hand, then answer to resume", but A3 then refuses the start over the applied changes. What worked: apply every path except the conflicting one (here the generated bundle), stash again under the same name, then start. **Fix:** say that in the message, or have `ticket start` skip generated files (the bundle, agents, index) when it restores a stash.
- **P26 · A format change on main breaks lint on older running branches.** Every tree reads every ticket's live state, so after PROP-040 added `findings` to history records, PROP-044's older branch failed lint (L020) on PROP-023's and PROP-042's records, and its reviewer could not report done. Restarting the stage synced the branch and fixed it. **Fix:** PROP-046, the ticket schema keeps and ignores unknown fields.
- **P27 · Reviews check that the spec holds in the code, not that the code does nothing the spec leaves out.** PROP-023's last round added a per-ticket lock to `worktree add` with tests, but no rule in WSP-001; four reviews approved it, and PROP-045's spec-writer found the gap. **Fix:** the reviewer checklist asks whether the diff adds observable behaviour no scenario or rule states, and if so gives `changes` with `spec: true` (now that PROP-040 routes it); PROP-047 writes the lock into WSP-001.
- **P28 · A proposal that only documents existing behaviour has no route through the pipeline.** PROP-043's new GRF-010/S11 already held, so its test passed and INV-004 refused the tester; `--back implementer` is refused before any implementer stage, and a plain answer reruns the tester into the same refusal. PROP-043 is parked blocked (its S11 test committed by a person on its branch, 7677a07). **Fix:** PROP-048, an explicit `documents:` list the spec-writer fills after running the build, exempting exactly those scenarios.
- **P29 · Roles edit files through the shell despite the rule.** Three times (`sed -i` on a test file, a python rewrite, an `init --update-roles --yes` that rewrote role prompts) a role changed files outside its file tools; each said so in its report and each diff was right, but the rule is only prompt text. **Fix:** the allowed commands in `dispatchCommand` stop admitting in-place editors (`sed -i`, `perl -i`, `python -c`), and `check-report` could compare the stage's changed paths with the paths its file-tool calls touched, from the transcript.
- **P30 · Scratch copies filled the disk.** Roles that check today's behaviour on copies of fixtures or the repo (spec-writers under P14, testers proving mutations, reviewers comparing branch and base) leave those copies in the session scratchpad. This project's scratch reached 73 GB of folders (about 14 GB of real blocks, APFS clones), the disk hit 239 MB free, a merge failed with ENOSPC, and an implementer's full run showed 22 ENOSPC failures; the guarded undo (A1) still put main back cleanly. **Fix:** role prompts say to delete their scratch copies before reporting; the overseer clears a ticket's scratch when it merges; `spec merge` checks free space before it starts.
- **P31 · `src/generated/assets.ts` is generated but merged as source.** It is built from the role and skill templates, so two tickets that change templates always conflict in it (PROP-042 against PROP-048 and the reviewer rule); merge stopped for a person, who rebuilt it with `npm run build`. **Fix:** merge and the stage sync treat it as generated, as they treat agents, index.md and the bundle: take either side, then rebuild. **Fixed:** PROP-055 (`generated` in config.json, WSP-009); this repo lists `src/generated/**`.
- **P32 · A finding that needs only tests takes four stages.** The implementer fixes the code, blocks because it may not edit tests (its fix is stashed), the overseer answers `--back tester`, the tester adds the tests, and the implementer restarts to restore the stash. PROP-051 paid this twice, and PROP-016, 046 and 050 once each. **Fixed:** PROP-058, a finding marked `tests: true` routes a proposal or bug to the tester, then the implementer. Until it merged, the overseer had the implementer block at once so the tester went first (PROP-055, PROP-038), which saved one stage.
- **P33 · Every stage change runs the whole suite, twice.** `check-report` and then `ticket advance` each run all ~1270 tests, about 3 min 15 s alone and 5–10 min with four worktrees running suites on 12 cores (load average near 100). A cap of one worker in the chat-mini fixture's nested vitest runs was measured slower alone (11 s against 8 s on two files) and was not applied. **Fixed:** PROP-059. Its first design ran only the ticket's own scenarios in the tester's check (16 s against 188 s), but the review reproduced three ways it approved stages it should refuse (identifier-style test names never selected, errors lost when titles repeat, incomplete inventories), so it was withdrawn. Instead `ticket advance` reuses the test run `check-report` made, only when the spec root, ticket, role, test command and git tree all match (the second review found four ways the first cache could be reused wrongly; all fixed). Recording a stage now takes about 8 s instead of 3–6 min.
- **P34 · Agent shells give up at 2 minutes while a full check takes 3 to 6.** PROP-053's tester saw `check-report` "hang" four times; each was the suite still running when the shell timed out, and one copy kept running in the background. PROP-057's implementer hit the same. **Fix:** briefs that run the full suite ask for a timeout of at least 10 minutes; the overseer records the stage when the role cannot.
- **P35 · The review bar had no sense of proportion.** With "flawless" read as "no edge case open", the reviewer returned `changes` for every deviation it found, one per round: PROP-051 took three rounds for quoted keys and comment placement in a one-function fix, and a two-line usage change cost about an hour through four roles. The first review of a ticket caught real defects (security, races, schema holes); later rounds mostly found rare edge cases. **Fixed (the user agreed, 4b9e501):** `changes` only for a defect a user would plausibly hit or a scenario the code clearly breaks, every finding in one review, minor edge cases as follow-up notes on an approval; a light lane for small changes; the spec states behaviour, not byte-level formatting.
- **P29, again (six times in all):** testers on PROP-053 and PROP-052 used python, PROP-038's a shell heredoc; each said so and each result was right. Blocking editors in `dispatchCommand` would not reach agents run outside it (this session ran every stage through its own subagents), so no ticket was filed.
- **Status at the end of batch 4:** P16 (PROP-038), P17's false overlaps (PROP-039), P23 (PROP-057), P31 (PROP-055), P32 (PROP-058), P33 (PROP-059) and P35 are fixed; no ticket is open, and the pipeline is frozen for its own sake: its next test is a real product feature.
- **Codex Sol as reviewer:** from batch 3 every review ran on gpt-6.1-sol at max effort. It found real defects other reviewers had missed: a blocked report bypassing the `spec: true` check and a Markdown heading injected through a finding (PROP-040), and two setup-record safety bugs reproduced on fixtures (PROP-023).
- **Seen working in live runs:** H1 (a blocked stage's work stashed by advance and restored on restart, PROP-027 and PROP-007), H2 (stale branches synced with main at stage start, PROP-007), I19 (advance added a missed feature to a ticket's scope), PROP-036 with I19 (PROP-007 held until PROP-019 merged, as both changed PIP-015), B1 (`afterMerge` refreshed the bundled CLI after every merge), and reviewers refusing two regressions in PROP-019.

### Batch 5 (2026-10-31 to 11-01): monitoring the process and fixing it through the pipeline

Twenty-three tickets merged. The first ones were BUG-001, BUG-002, PROP-062, 064, 065, 066, 069, 071, 072 and 075. The process-fix tickets came after: PROP-060 (spec review), 063 (`spec stats`), 068, 074, 076, 077, 078, 079, 080, 081, 082, 083 and 084. PROP-063 made the measurement a command: `spec stats --since 2026-10-31` counts 239 stages for a minimum of 141 over 32 tickets, with 22 blocked, 19 reopened and 37 answered.

- **P39 (reconstructed from PROP-076):** Five of six churned tickets hit a loop where tests for changed behaviour surfaced after implementation, the implementer blocked, its code was stashed, and a person had to route the tester back without that code; clean tickets took 4 stages, churned tickets 7–10.
- **The dominant churn (P42, measured):** Old tests that encode replaced behaviour pass on the old code, so the tester could not see them. The implementer may not edit tests, so its code was stashed, a person answered with `--back tester`, the tester worked without the code, and the stash came back, often conflicting on bundles. This happened nine times, and the clean tickets took 4–5 stages against 7–16 for these. Fixed in two steps:
  - PROP-077: the tester sweeps the existing tests for the behaviour a change replaces.
  - PROP-076: an implementer blocker marked `tests: true` commits the code and hands the ticket to the tester, with no stash and no question. That hand-off is guarded by every done-implementer check except the tests, and capped at two.
  - Seen live on PROP-082 and PROP-084: implementer, tester, reviewer, no person involved.
  - Five implementer stages in a row then passed first time.
- **Spec review (PROP-060) earns its keep on security, and costs rounds on text.** It found real defects before any test was written:
  - PROP-063's metric flaw.
  - A forged-`tests: true` bypass in PROP-076.
  - Contradictions in PROP-078.
  - Three C4 holes in PROP-084's role-update design, one of them introduced by the orchestrator (P57).
  - Most of its other findings are C9 text consistency.
  - PROP-083 narrows a later round's review to the units the findings cite, but only after an approve, anchored on the committed approval.
- **P43 (reconstructed from PROP-083):** After spec review, a code-review finding marked `spec` could send a one-line spec fix through another full spec review (with the ticket's whole spec delta, roughly 100–260 KB), then tester, implementer and reviewer.
- **Collisions and footprints:**
  - P36, P51, P54: guesses made before the spec stage serialized the queue for hours, and a running ticket was held by one started after it. Fixed by PROP-081: before the spec stage the footprint is the touched features, no ticket is held by a later starter, and check-report refuses scenario or rule numbers another running spec stage took.
  - P38, P41, P47: lint-code and ID collisions between parallel branches. PROP-064 added L035; spec-writers widening scope collided twice before PROP-081.
- **Stash and restore:**
  - P25 and P37: generated bundles conflicted on restore, and the hand recovery lost untracked files. PROP-074 leaves generated files out of the stash and keeps new files.
  - PROP-080 does the same for `.spec/bin`.
- **Report friction:**
  - P53: an unquoted colon in a summary made the YAML invalid, five times. Fixed by PROP-080.
  - P45 and P56: mutations had to be re-listed on every tester round. Fixed by PROP-076's inheritance.
  - P50: check-report ran the full suite a third time per stage. Briefs now skip it, and advance reuses the run.
- **Briefs (P44, PROP-078, PROP-082).** Measure bytes per group before fixing size. The ticket history was 6%, not most, of a 200 KB brief. Over budget, briefs now keep the changed and cited scenarios and list the rest by title: PROP-060's tester brief went from 201 KB to 124 KB.
- **P44b (reconstructed from PROP-082):** After PROP-078, PROP-060's tester brief was 193,943 bytes (about 48,000 tokens versus a 4,000-token budget); Features in scope alone was 130,049 bytes because a ticket touching ten features received all their scenarios and rules.
- **Bootstrapping (P46, P52):**
  - A ticket that adds a role or a report key can't be merged or reported by `main`'s pinned CLI. It was merged with the branch's CLI.
  - Role prompts don't reach this repo until refreshed (P48). PROP-084 fixed that with `.local.md` and hash-checked `Spec-Roles` commits.
- **Closing the open candidates (11-01):**
  - PROP-085, absorbing PROP-086: governed paths by tree position, no escaping symlinks, `.spec/bin` governed.
  - PROP-087: an unreadable spec entry is L037, not a crash.
  - PROP-088 (P60): `documents:` ends at the first implementer stage.
  - PROP-089 (P49): `spec ticket close --superseded-by` is non-destructive and history-verified. It retired PROP-073 live in 12fec75.
  - PROP-090 (P61): the lock test orders holds by a counter, not a clock.
  - PROP-091: close keeps quoted statuses.

  Twenty-nine tickets merged in this batch. `spec stats` on the 15 tickets after the hand-off fix shows 4 reopened stages and 10 answered questions, against 15 and 28 on the 22 tickets before. Stages are still about 1.75× the minimum, now spent in review rounds, which found 12 C4 defects before merge.
- **Still open, as candidates:**
  - P40: a ticket that only aligns scenario text with existing behaviour has no test-first path (PROP-073).
  - P62: a test-only fix (PROP-090) still runs spec review, implementer and reviewer stages with nothing to change.
  - Wording follow-ups from reviews: TKT-011/S1's "asked before it by ID" should say first-fit backfilling; TKT-012/S13's dirty-target message points at `spec ticket answer`, which doesn't commit on base; PIP-003/R7's colon recovery could parse YAML first and keep inline comments.
  - P55: spec-writers pinned computed output of logic they couldn't run (PROP-081). Prefer properties, or recompute in spec review.
  - P58: subagents still sometimes write files through the shell. The new `.local.md` files say not to.
  - P60: `documents:` goes stale once code changes the behaviour (PROP-083).
- **Orchestrator lessons:**
  - P57: give the spec-writer the finding and its constraints, not a design.
  - P59: start the next stage only after reading advance's `next:` line.
  - P55: when a stage keeps failing, debug the test directly. One look at PROP-081's S22 found the PRV-001 writer that three rounds had missed.

### Batch 6 (2026-11-01): the person's /decide answers, then the open candidates

- **Decisions (11-01, through a /decide page):**
  - **Done by the agent:** run PROP-067's live check; remove the Dart allow rules (ADR-007, e4a6695); refresh this repo's role prompts (ADR-008 6538cd0, then 8b1c060 and 0206854 through `Spec-Roles`); file a light lane; rebuild `.spec/bin` after every CLI merge; run the plugin live checks.
  - **Kept as they are:** bugs skip spec review; fixtures are recognised by folder name; ADR-003 to ADR-006; the plugin direction; the renumbering; PROP-046's refusal of YAML anchors.
- **Live checks (Claude Code 2.1.312, headless, account 1):**
  - **C8 for PROP-067:** `.claude/settings.local.json` `additionalDirectories` alone lets a background subagent write in `../repo.worktrees`. A write outside it is refused, and without the file the write is denied. An untrusted workspace ignores `settings.json` allow rules and `additionalDirectories`.
  - **Plugin:** `/spec:spec` and `/spec:run` worked with no prompt. One full stage loop in acceptEdits mode found two approvals a person would have to click every stage: the worktree CLI and the report file. PROP-096 fixed both, and a rerun after its merge had 0 refused commands.
- **Merged (17 tickets):**
  - PROP-067: the worktrees folder goes only into personal settings.
  - PROP-092 and PROP-099: light lanes (`lane: docs | tests`), fixed at the first record.
  - PROP-093 (P55): spec review recomputes pinned values.
  - PROP-094 (P58): a Bash command that plainly writes a file tracked in a ticket worktree is refused, and the hook fails open when spec cannot load.
  - PROP-095: three wording follow-ups, including bypass advice that needs a person.
  - PROP-096: stages run `.spec/bin/spec --root <worktree>` and never `cd`; the report file goes in the worktrees folder.
  - PROP-097: INS-010/S10 corrected; INS-010 gets tests.
  - PROP-098 (P67): the new-ID guard covers invariants, decisions, features and screens. It refused PROP-101's INV-014 within the hour.
  - PROP-100 and PROP-107: `spec upgrade` delivers a rebuilt CLI at the same version, and replaces it atomically.
  - PROP-101 (P71): a test run that gives no results is "could not run", exits 3 and uses no attempt.
  - PROP-102: XML that is not one complete JUnit document is no result, and an implementer needs a test for each scenario it delivers.
  - PROP-103 (P69, P75): stages save their report and run `check-report` themselves; the task holds no advance command.
  - PROP-104 (P68): a held ticket keeps its place ahead of newer ones.
  - PROP-105: rule-named tests claim nothing; the launcher fails open for shell payloads.
  - PROP-106 (P74): the tester check reads absolute paths.
- **Measured:**
  - `spec stats` on the 17 tickets: 130 stages for a minimum of 85 (1.5×), 2 reopened, 3 answered, 12 refused.
  - Spec review took 1.6 rounds to approve, and review 1.4.
  - Findings before merge: C4 4, C5 9, C3 7. Among them: Bash blocked by a broken workspace, a disguised edit passing as Bash, a stored-report restore race, untrusted output authorising a hand-off, and two XML parser holes.
  - The light lane was not used in this batch.
- **What cost the most:**
  - P78: machine overload. The load average reached 40–50 on 12 cores, from Spotlight indexing the tests' temporary repositories, 3–4 full suites at once and two orphaned test scripts. Subagents' `check-report` hung, and a merge's test run hit ETIMEDOUT after 21 minutes. The fix in practice was one full-suite run at a time.
  - P75: a stage's own `check-report` lets advance reuse its test run, taking 13 s instead of 7–10 minutes.
  - P73 and P76 (orchestrator): hand-tidied reports cost attempts, so check them first. `spec next <ID>` already starts one ticket.
- **Still open, as candidates:**
  - P77: `check-report` ignores `--report-file` (stdin only) and gives no sign when it waits.
  - P79: a follow-up on an approve that describes a defect is refused as "an approval names a gap".
  - Sonnet subagents continued in the same session drop the report format unless the brief repeats it.
  - Tests should clean up the processes they spawn.
  - Reviewer follow-ups: XML doctype literals with `]`; concurrent `spec upgrade` and a rollback that fails itself; an empty `.spec/bin` after a failed fresh install.

### Batch 7 (2026-11-01 to 11-02): the second /decide

- **Decisions:**
  - **Done:** delete the old test folders (33,807 and then 3,737 `spec-*` folders older than an hour); make tests clean up; hide `~/dev` from Spotlight (the person's action); `check-report --report-file`; Follow-up findings exempt from the gap check; the XML doctype and rollback-failure follow-ups.
  - **Kept:** ADR-007 to ADR-009, and the headless plugin check.
- **Merged (6 tickets):**
  - PROP-108: `check-report --report-file`. A missing or empty path exits 2. A "tests: running the test command" notice goes to stderr, live through the plugin launcher too.
  - PROP-109: gap words are checked only in the summary and in non-Follow-up findings.
  - PROP-110: a quoted `]` in a JUnit DOCTYPE is read.
  - PROP-111: a failed rollback keeps the backup and says how to restore it.
  - TASK-001: tests remove their temp folders, including `<repo>.worktrees` siblings, and stop their children. This holds even on filtered runs, through a manifest and a global teardown, and `SPEC_KEEP_TMP=1` keeps the folders. A full suite now leaves one folder, where it used to leave hundreds.
- **Seen live:** PROP-101's "could not run" fired on a load timeout (PROP-110's advance). It recorded nothing and used no attempt, and the retry passed.
- **Lesson:** telling every subagent to run `check-report` brought back the overload, with three full suites at once. Only one stage at a time should run the full suite. The others run their own files and leave the full run to the session's advance.
- **Reviewer follow-ups left (optional):** concurrent `spec upgrade`; a child process started at module scope in a filtered-out test file is not stopped.

## Batch 8 (2026-11-10): CI, test time and stage-record review

These are measurements made during the 2026-11-10 review. The ticket status is the status recorded in each ticket file.

- **CI had not gone green:** the review recorded 129 failed runs out of 129. TASK-002, merged as `ddc6bc5`, fixed the dash-only `lockProbe` PID assertion in WSP-006/S8 and S30. The separate INS-012/S27 `zsh` fix is prepared as commit `3e5b665` on local branch `ci/green`; it is not yet merged or pushed.
- **The full suite took 14 min 25 s for 2,046 tests** before the test-fixture work. TASK-003, merged as `207dd39`, split the largest test files and introduced shared fixture templates, taking the suite from 865 s to about 570–600 s (596 s in the implementer run and 572 s in review). PIP-009/R2 sets a 10-minute test limit. In the driving session on 2026-11-10, `spec ticket advance` answered “the check could not run: the test command gave no results: spawnSync /bin/sh ETIMEDOUT” for TASK-002's implementer stage and PROP-112's tester stage, several times each. After TASK-003 merged and the pipeline ran with the real Git first on PATH, those same stages were recorded with full runs of 438 s and 449 s.
- **Git process spawning dominated suite time.** The TASK-006 measurements found about 70,000 git processes in one run (34 per test), including 24,276 requests for four fixed `rev-parse` facts. Each process start on this machine costs about 9 ms; `/usr/bin/git` is Apple's launcher and costs about 19 ms per call versus about 9 ms for the real binary. With the real Git first on PATH, a full run took about seven minutes. TASK-006 asks for each fixed Git fact to be queried once per command and for this repository's test run to put the real Git binary first on PATH. It was not merged when this entry was written (2026-11-10).
- **Since the 2026-11-10 measurement:** TASK-006 merged as `a7b073c`, and TASK-007 (which reads tickets' live state and a directory's fixed facts with fewer Git processes) merged as `c819127`. Git processes per full run fell from 69,794 at the start to 55,578 after TASK-006 and 48,217 after TASK-007; a full run now takes about 5.5–7 minutes, down from 14.4 minutes at the start.
- **History verification was also slow:** TASK-004 measured `spec verify-history` at 1 min 58 s for 105 first-parent commits. TASK-004 is open and asks for the same checks from fewer Git processes, with an under-20-second target.
- **Recorded effort and missing stage data:** PROP-114's review measured 146.5 agent-hours over 93 tickets, with 77% in tester and implementer stages. It found no model or `cost_usd` in any history record across 114 tickets; PROP-114 proposes recording selected models and reporting stage duration/cost.
- **No light lane had been used:** PROP-116 measured zero light-lane tickets among 109 measured tickets and proposes a `build` lane. PROP-115 separately proposes an optional narrower stage-test command; its review notes that tester and implementer stages run the full suite and that merge runs it again.

## Historical model notes
- **Sonnet 5.5 medium (pilot):** stages were correct first time once the environment was fixed. About 2–4 minutes per stage.
- **Haiku 5.5 xhigh (batch 1):** code correct in all five tickets (implementers reported 504–520 passing tests). But it gave up after a refused command (I13), skipped lint on its own tests (I14), and read `''` literally (I15). Merged 3 of 5 after fixes; 2 pending. Rules in prompts aren't enough for Haiku; they need to be checks (R4).

## Historical improvement order (2026-10-27, reviewed 2026-11-10)

The original order below is a dated recommendation, not the current backlog. Review on 2026-11-10 found that the stage-lifecycle work in item 2 and the `checkCommands` part of item 1 are done. The compiled-agent allowed-command mechanism from `dispatchCommand` was removed under X139. `maxParallel` from item 3 was delivered in PROP-030 and still caps `spec next` (CLI-007/R3); only its dispatch/orchestrate use was removed under X139. Its size-based model selector was removed under X139 and stage cost is not recorded; PROP-114 is open for the model/cost reporting gap.

`format.Config.afterMerge` remains an active, specified option (WSP-006/S18–S24 and R6; FMT-002/S16). This repository does not use it to refresh its pinned CLI (INS-014/S15). PROP-114 also says the claim that model selection is the biggest cost lever cannot be checked from existing records. Batch 8 records the measurements and open proposals.

1. **Checks over prompts (R4):** a `checkCommands` config run for tester and implementer (I14; done). The old compiled-agent allowed-command path from `dispatchCommand` (I13) was removed by X139. The historical claim that model selection is the biggest cost lever cannot be checked: PROP-114 found no model or cost in the recorded stage history.
2. **Stage lifecycle (R3):** `ticket answer --back <role>` (I16) and stash-not-revert (I17) are done; `spec ticket answer --back` and its reopened history entry remain supported.
3. **Scale (I11, P8, P9):** `maxParallel` was delivered in PROP-030 and still caps `spec next` (CLI-007/R3); only its dispatch/orchestrate use was removed under X139. The size-based model selector was removed under X139; per-stage cost is not recorded and PROP-114 is open to address the model/cost reporting gap.
4. **Literal output in the spec language (R1):** `text` fences and inline code as data, and `\"` in quoted values (A1, A2, A3, A13, A16, I15). This is the single biggest authoring win.
5. **CLI surface in the spec language (R2):** options and exit/stream as first-class (A4, A6), and multi-slice providers (A5).
6. **Adoption flow (P1, P2, P4, P6, P7):** module confirm, ownership first, invariants from code, and the decide-style review in `/spec-init`.
7. **Self-hosting (R6, I10):** `format.Config.afterMerge` remains an active, specified option for projects that configure it (WSP-006/S18–S24 and R6; FMT-002/S16). This repository's `afterMerge` does not rewrite its pinned CLI (INS-014/S15); the plugin build refreshes its manifest, marketplace version, launcher, bundle and generated skills (INS-014/R1), and INS-014/S14 compares that output without changing the repository.

At the time, the list grouped pipeline work in items 1–3, format work in items 4–5, adoption work in item 6, and self-hosting work in item 7.
