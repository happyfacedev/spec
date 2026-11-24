# Process ledger

One row per ticket or workstream: how many passes it took to get right, and why. The goal is one review
round. A ticket with more than one round gets a retro before the next ticket starts, and at least one
process change (role prompt, checklist, pipeline), made spec-first. Classes C1–C9 are defined once, in
`spec/core/conventions.md` (Finding classes); [RETRO-PLUGIN-WORK.md](RETRO-PLUGIN-WORK.md) holds the
retro that first named them.

Counts before 2026-10-31 are from the lead's records of that session (blind reviewer verdicts and lead
full-suite runs), not from tooling. From PROP-063 on, `spec stats` produces them from ticket history
(next section).

## Reading `spec stats`

`spec stats [<TICKET>...] [--since YYYY-MM-DD] [--format json]` reads each ticket's history and
questions and changes nothing. Without IDs it measures every ticket with at least one recorded stage; a
running stage is not counted until it is recorded. `--since` keeps tickets whose first stage was recorded
on or after that UTC day. An unknown ID or a bad date exits 2.

One row per ticket:

| Column | Meaning |
| --- | --- |
| stages | `<stages>/<minimum>`: stages that ran (done or blocked) against the fewest the type needs: 5 for a proposal, 3 for a bug, 2 for a task (4 for a proposal recorded before the spec review existed). Anything above the minimum is churn; the other columns say where it came from |
| time | Sum of recorded `duration_s` values for the ticket's stages, formatted `hours:mm:ss` (hours are not padded); `-` when no stage has a duration. A missing duration is never estimated as zero |
| timed | `<stages with a duration>/<stages>`; a stage with no duration does not contribute to time |
| blocked | stages that ended blocked, an invalid report included |
| reopened | times `ticket answer --back` sent a role back; a reopened entry is not a stage |
| refused | reports refused at intake (the 3-attempt budget of PIP-018), summed over the stages |
| answered | questions a person answered |
| spec review, review | each review's verdicts in order, e.g. `changes, changes, approve`; `-` when it never ran |
| findings | findings of both reviews per class (`C1 2, C4 1`). `unclassified` is a finding with no class, or one outside C1–C9 and `other`, as in a history recorded before classes existed |

The totals under the table:

- `total:` summarizes ticket, stage, minimum, blocked, reopened, refused and answered counts. It does not estimate or add time.
- `spec review:` and `review:` give the mean rounds to approve and the share approved in one round. A
  ticket counts only when its **latest** verdict is `approve`, and every verdict is a round, so a review
  that ran again after an approval (a reviewer finding marked `spec: true`) counts all of its rounds. A
  ticket still on `changes` is in neither number. The goal is 1.0 rounds and 100%.
- `findings:` is the class mix across the tickets. The classes are the ones in the table below; a class
  that keeps coming back is the next process change's target.

When at least one measured ticket has a stage, a per-role table follows the totals after a blank line:

| Column | Meaning |
| --- | --- |
| role | Stage role, in pipeline order: spec-writer, spec-review, tester, implementer, reviewer. Only roles with a stage in the measured tickets appear |
| stages | Number of that role's done or blocked history entries |
| time | Sum of recorded durations for the role, formatted `hours:mm:ss`; `-` when none is recorded |
| median | Median of that role's recorded durations (the middle value, or the mean of the middle pair rounded down); `-` when none is recorded |
| timed | `<stages with a duration>/<stages>`; unmeasured stages add no time |
| cost | Sum of recorded costs, shown as `$<amount>` rounded from the sum's shortest decimal text to cents, with a half cent rounded up; `-` when no stage reported a cost |
| costed | `<stages with a cost>/<stages>`; costs are shown only for stages that reported one, never estimated |

The JSON output carries the unrounded role cost sums. A measured ticket with no stage has no role row; if no measured ticket has a stage, the role table and its preceding blank line are omitted.

The rule this serves: a ticket with more than one review round gets a retro and at least one process
change, made spec-first, before the next ticket. Put its row here, with the `spec stats` counts, and the
change in Process changes.

**Ticket IDs in this file are the plugin-integration branch's.** When it merged into `main` (which had
used PROP-050–059 meanwhile), its tickets were renumbered: PROP-050 → PROP-060, 051 → 061, 052 → 062,
053 → 063, 054 → 064, 055 → 065, 056 → 066. Lint rules S3 added as L029/L030 are L033/L034 on main (D19).
D18 is delivered on main by PROP-058 (a finding marked `tests: true` routes to the tester first).

## Rounds

| Work | Went spec-first | Review rounds to approve | Full-suite failures before approve | Process change made |
| --- | --- | --- | --- | --- |
| AST-2 delegate `worktree` | no (Astro BDD, lead brief) | 4 blind + 1 lead | 7 regressions (1 run) | — (backfilled into this ledger) |
| AST-3 command hooks | no (Astro BDD, lead brief) | 5 blind + 1 lead | 22 regressions (1 run) | — |
| AST-4 worktree in pane | no (Astro BDD, lead brief) | 2 blind | 0 | — |
| AST-5 hook trust UI | no (Astro BDD, lead brief) | 4 blind | 11 contract failures (1 run) | — |
| S1 plugin + `.spec/bin` | no (lead brief) | 5 blind | 0 | — |
| S2a `spec next` | no (lead brief) | 2 blind + polish | 0 | — |
| S2b remove dispatch | round 1 no; round 2 **yes** | **2** (round 1 changes: 10 findings; round 2 spec-first → approve, 2 low follow-ups incl. 1 C6 regression no scenario named) | 0 | PROP-054: lint refuses reused IDs; review briefs must carry the class definitions (reviewer couldn't classify) |
| **PROP-051** checklist (first ticket through spec's own pipeline) | **yes (pipeline)** | review 1: changes (4: 2 behaviours the implementer added that no scenario states, 1 test with one branch of an "any kind" rule, 1 prompt duplication) → back to spec-writer | 3 implementer blocks before review, all from tester errors / integration (D11, D12, D15, D16) | implementer added unspecified behaviour (role says never) — reviewer caught it; spec-review stage (PROP-050) + tester sweep rule target the rest |
| S3 enforcement — **approved round 7** (findings per round 19 → 9 → 4 → 3 → 3 → 3 → 0 blocking) | round 1 no; round 2 **yes** (19 findings, scenario → test → fix each) | 1 blind: changes (19: C4 ×4, C6 ×4, C8 ×3, C5 ×3, C3 ×2, C2 ×2, C1 ×2, C7, C9; 1 critical: ticket new blocked by its own hook); round 2 spec-first | 0 | reviewer used probes (scratch tests) — make "probe the change in a scratch repo" a spec-review step |
| S4 setup flow | round 1 no; rounds 2–5 yes | round 1: 15 findings; round 2: 7 (N1 stdin hang = D4 root cause); round 3: 5 (F1 second registry reader, F2 open question shipped); round 4: 6 (G1 C4 team-wide acceptEdits, G3 repeat of "decision in some readers"); round 5 running | — | skill text drift tests; C8 facts verified live (17 runs); "every reader" rule — G3 shows it must be enforced by tooling, not prose |

## Findings by class (blind reviews, plugin work)

| Class | Count | Catchable by a spec step? |
| --- | --- | --- |
| C1 neighbours | 9 | yes: `spec impact` + neighbour scenarios |
| C2 environment axes | 8 | yes: checklist |
| C3 concurrency/ordering | 7 | yes: checklist |
| C4 trust boundaries | 9 | yes: invariant per boundary input |
| C5 failing open | 5 | yes: convention + scenario |
| C6 preserved behaviour | 6 | yes: "preserved" scenarios |
| C7 tests that can't fail | 3 | yes: tester mutation rule |
| C8 external facts | 5 | yes: question or spike |
| C9 text/docs | 4 | partly: reviewer doc check |

Every major finding fell in C1–C8. None needed information that wasn't available before coding.

## Dogfood findings (running S5 through the pipeline)

| # | Seen | Class | Effect | Fix |
| --- | --- | --- | --- | --- |
| D1 | `spec next` in a linked worktree used as the base read `delegation` from the main worktree, not the base checkout's `config.local.json` → `model: null` | C2 | lead picked models by hand | ticket after S5 |
| D2 | the delegated task is ~44k chars, mostly brief (PROP-051, spec-writer) | token economy | heavy subagent context | measure per role in `spec stats`; budget review |
| D3 | the running Astro build predates AST-2: delegate has no `worktree` field | deployment | subagent told to `cd` | ship AST-2 |
| D4 | `ticket advance --report-file` hung for 2h11m. Root cause (found by the S4 reviewer, not by me): `run.ts` reads stdin unconditionally and the harness shell keeps stdin open; with `</dev/null` it took 1.6 s. My first diagnosis ("slow checks under load") was wrong | C8 (S2a bug) | ~2 h of PROP-051 pipeline time lost | fix in S4 round 3; lesson: when a step hangs, check what it waits on before blaming load |
| D6 | PROP-051 tester task is 116,760 chars (spec-writer's was 43,737): the tester brief carries every changed feature + contracts | token economy | heavy subagent context | brief budgets per role (PIP-013) need a hard cap; measure per stage in `spec stats` |
| D7 | lead re-ran `ticket advance --format json` only to read the problems → it counted as attempt 2 of 3 | lead error + tool gap | one bounce wasted | diagnose with `check-report` (non-counting); consider `advance --dry-run` |
| D8 | PROP-051 tester refused: 45 old scenarios in touched features (TKT-001/007, PIP-007/017) lack ID-named tests + 4 orphan test names left by S1 | integration debt surfaced by the pipeline's own check | tester must rename tests the ticket didn't write | `lint --ci` should report scenario↔test name gaps repo-wide so debt is paid before tickets inherit it |
| D9 | `check-report` said "report ok" for a tester report listing 45 pre-existing scenarios as `changed`; `advance`'s test-first check would refuse it (their tests pass). The non-counting check doesn't run the counting check's semantics | tool gap (C7) | lead had to catch it by reading; last attempt at risk | `advance --dry-run` that runs every check without recording or counting; tester prompt: `changed` = scenarios whose behaviour the spec diff changed |
| D10 | PROP-051 tester listed unchanged scenarios as `changed` and one renamed test for an unchanged scenario (PIP-007/S10) fails on current code; caught only because the lead ran `spec test <ID>` per scenario | C7 + role prompt gap | last attempt at risk | the tester prompt and `advance --dry-run` should run exactly this per-ID red/green check; `changed` derived from the spec diff, not typed by hand |
| D11 | PROP-051 implementer blocked (correctly, citing the spec): a tester test contradicted TKT-007/S16, and older tests still built spec-writer reports without the new checklist — the tester never swept tests superseded by a new rule | C6/C7 (tester) | one implementer stage wasted; ticket sent `--back tester` | tester checklist: grep every test that builds the data the rule now constrains and update it (named in the report); the S5 spec-review stage should list "existing tests this rule supersedes" |
| D12 | PROP-051 implementer blocked a 2nd time: the tester's fix of one assertion (line 89) broke its neighbour (line 111) in the same test — fixture changed to satisfy one clause of TKT-007/S16 now violates "nothing else stops it" | C1 within a test | 2nd implementer stage wasted | tester rule: after changing a fixture, re-check every assertion that uses it against its scenario; the spec-review stage should flag scenarios whose clauses need separate fixtures |
| D13 | full `npm run check` on plugin-integration after the S4 merge: 3 failures (WSP-006/S5, PIP-018/S1, TKT-005/S21) that pass 64/64 in isolation; other suites ran concurrently | test infra (load-sensitive timeouts) | a false red on the integration branch | `advance`/`merge` run the suite too — a flaky test can refuse a correct stage; track flaky IDs and give git-heavy tests load-tolerant timeouts |
| D14 | lead error: after `ticket answer --back tester` I delegated the tester without running `spec next`, so no stage was started; the work happened outside a stage | lead error (procedure) | the tester's work had to be stashed and replayed | the driving loop text already says "loop `next` after an answer"; I skipped it — follow the loop exactly; `ticket answer --back` could print "now run `spec next <ID>`" |
| D15 | starting PROP-051's tester stage synced the ticket branch with plugin-integration (which gained S4 meanwhile) → conflict in tests/cli/next.test.ts: S4 changed PIP-017 behaviour (relative paths) while PROP-051's tester had renamed PIP-017 tests with old assertions | C1 across tickets (integration while in flight) | ticket blocked for a person-merge | merging a workstream into the base while a ticket that touches the same feature is in flight forces a re-test; `spec plan` should have flagged S4 ↔ PROP-051 (both touch PIP-017) — S4 bypassed the ticket system |
| D16 | restoring the implementer's blocked-stage stash conflicted only in generated bundles; the pipeline said "apply by hand, then answer", but after applying, `next` refused to start ("uncommitted changes") — the manual path dead-ends | tool gap (C1: stash restore ignores generatedPaths; C6: the documented recovery doesn't work) | lead re-stashed without generated files to let `next` restore it | stash restore should take the branch side for generated paths (like merge), and the "apply by hand" path should be startable |
| D17 | PROP-051 reviewer report refused: invalid YAML (unquoted `: ` in summary); the reviewer never validated its own block | role prompt gap (all roles) | one attempt used | every role's prompt: "write your report block to a file and run `check-report <role> <ticket>` before finishing"; the report form could quote free-text fields |
| D18 | reviewer `changes` with a code finding that also asks for a new test → `next` routed straight to the implementer, who may not change tests | pipeline routing gap (C1) | the requested test can't be added in this loop | a review finding that needs a test (or any finding with no `spec: true`) should route through the tester first when it names a missing test; or findings carry `test: true` like `spec: true` |
| D19 | merging S3 after S4: both branches introduced lint rule IDs L029–L032 with different meanings (parallel branches allocate the same "next free" IDs) — the reuse PROP-054 targets, across branches | C1 across tickets | renumbering during integration | ID allocation must be visible across branches (plan/lint compares open ticket branches), or IDs are allocated at merge time |
| D5 | PROP-051 spec-writer applied the new checklist to its own change and reached 4 neighbour features `spec impact` didn't list at depth 1 (TKT-007, TKT-001, ADP-002, PIP-008) by running impact on the new contracts | C1 (tool) | spec-writer had to discover neighbours manually | impact should follow contracts the delta adds |

## External facts verified (C8)

| Fact (Claude Code 2.1.311, 2026-10-31) | Result | Consequence |
| --- | --- | --- |
| `${CLAUDE_PLUGIN_ROOT}` in a skill `!` pre-run line | denied (variable in command) | setup skill finds the plugin via installed_plugins.json instead |
| absolute plugin CLI path allowed by skill `allowed-tools` | needs approval | the person approves once during setup |
| plugin hooks via the plugin's hooks.json | SessionStart ran | hooks are a valid enforcement layer in Claude Code |
| subagent `cd` into a sibling worktree | only with `additionalDirectories` | `init` writes it |
| relative `.spec/bin/spec` after `cd` matches `Bash(.spec/bin/spec *)` | yes; absolute path no | tasks and `advance` use relative paths |
| project settings in an untrusted folder (headless) | ignored | the person accepts the trust prompt once |

| subagent Edit/Write in a sibling worktree, mode `default` | denied | setup asks for `defaultMode: acceptEdits` |
| same, mode `acceptEdits` | allowed, scoped | — |
| broad `Edit`/`Write` allow rules | allowed, **including a write outside the project** | never used |
| Agent tool `model` values | only sonnet, opus, haiku, fable | `config set` restricts claude-code to these |

| `acceptEdits`: subagent write outside project + worktrees | denied (inside the worktree allowed) | acceptEdits is the scoped choice |
| `defaultMode` in `.claude/settings.local.json` | takes effect | the personal opt-in goes there, not in the committed settings |

Cost of the spikes: 20 headless Haiku runs. Two of the S4 design assumptions were wrong; both would have shipped untested.

## Process changes

| Date | Change | Ticket | Target classes | Result (rounds on the next tickets) |
| --- | --- | --- | --- | --- |
| 2026-10-31 | Spec review stage before tests | S5-T1 | C1–C8 | pending |
| 2026-10-31 | Spec-writer checklist in the report | S5-T2 | C1–C6, C8 | pending |
| 2026-10-31 | Tester mutation rule; neighbours in briefs | S5-T3 | C1, C7 | pending |
| 2026-10-31 | `spec stats` + finding classes | S5-T4 (PROP-053) | measurement | pending |
| 2026-10-31 | Lint refuses reused scenario/rule IDs vs base | PROP-054 | ID hygiene (S2b) | pending |
| 2026-10-31 | Review findings fixed spec-first (scenario → failing test → fix) | lead rule | all | S2b: approved in round 2. S3 round 2: 13/19 fixed, 4 partly, 2 new highs (one a regression from a fix) |
| 2026-10-31 | Per fix: also list the fix's C1 neighbours and C5 fail-open cases; one test per branch of an "or/and" clause | lead rule (from S3 round 2: S11 half-tested, F13 fix failed open) | C1, C5, C7 | S3 round 3 + S4 round 3: neighbours noted per fix; S4 still missed a second reader of the same data (F1) |
| 2026-10-31 | Neighbour rule, sharper: when a fix changes how a data source is read or written (registry, config key, report), grep every reader/writer of that source and cover each | lead rule (S4 round 3 F1) | C1 | applied from S4 round 4 |
| 2026-10-31 | Open external questions never ship in user-facing text; they block the ticket until verified live (cheap headless spike) | lead rule (S4 round 3 F2) | C8 | applied from S4 round 4 |
| 2026-10-31 | A fail-closed change lists where the check legitimately cannot run (no git, detached, CI) and tests those | lead rule (S3 round 3 R3: no-git projects locked out) | C2, C5 | applied from S3 round 4 |
| 2026-10-31 | A weakened or rewritten test is called out in the commit body and reviewed; never relax a scenario to fit the code | lead rule (S3 round 3 R1: rule R13 + test rewritten → forged merges pass) | C7 | applied from S3 round 4 |
| 2026-10-31 | Reviewer probes must complete the action they claim to test (a refused merge doesn't prove the accepted path) | lead rule (S3 round 2 F10 false "fixed") | C7 (review) | S3 round 4 review ran probes to completion → found S1 (merge-commit content unchecked) |
| 2026-10-31 | A test claiming real behaviour runs with the real environment on (hooks installed, real clones); never disable the thing under test | lead rule (S3 round 4 S2: "real pull" tests ran with hooks off) | C7 | S3 round 5: pull tests real; review confirmed |
| 2026-10-31 | Diff readers cover renames and copies; environment cases always include the repo's legitimate states (no commits, between init and setup commit, history with old offenders, older git) | lead rule (S3 round 5 T1–T3) | C2, C8 | applied from S3 round 6; belongs in the spec-writer checklist C2 text (PROP-051 follow-up) |
