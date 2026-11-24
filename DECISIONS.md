# Decisions and deviations

Every deviation from the handoff ("Spec Skill PoC Handoff", Oct 27, 2026) and every choice it left
open: what changed, why, and what it affects. Settled decisions D1–D18 are unchanged unless listed.

## Toolchain and packaging

**X1. Dev toolchain needs Node 22.12+; the bundled CLI targets Node 20.**
vitest 5 requires Node `^22.12 || ^24 || >=26`, and eslint 10 requires `^20.19 || ^22.13 || >=24`.
The handoff's "Node 20 or later" is kept for what users run: `dist/` is built with `target: node20`.
CI runs the checks on Node 22 and 24, then smoke-tests the bundle on Node 20 (`runtime-node20` job).
Affects: `engines` in package.json, CI matrix.

**X2. `dist/spec` is a 3-line Node launcher plus the bundle `dist/spec.cjs`, not one file.**
- **Why two files.** An extensionless JS file takes its module type from the nearest
  `package.json`. A CommonJS bundle crashed under `"type": "module"` (`require is not defined`,
  seen in this repo), and an ESM bundle would crash under `"type": "commonjs"`. The bundle is
  therefore `.cjs`, which is CommonJS everywhere.
- **The launcher.** It contains no `import` or `require` syntax, so it is valid under either
  module type. It loads `spec.cjs` beside its real path (symlinks resolved) using
  `process.getBuiltinModule('node:module').createRequire`, and turns on Node's compile cache
  first.
- **Why not `sh`.** A first `sh` launcher cost 33 ms on macOS (`/bin/sh` start-up plus a `dirname`
  call). With the Node launcher, `brief` went from a 172 ms median to 149 ms.
- **Tests.** `tests/dist.test.ts` runs the bundle under `module`, `commonjs`, no type, and via a
  symlink.
- **Requirements.** Node 20.16+ or 22.3+, for `process.getBuiltinModule`. No shell is needed, so
  Windows works too, although the PoC targets macOS (Alex, Oct 27).
- **Affects.** `spec init` originally copied both files into `<skill>/scripts/`; that project destination is superseded by X138. Older skill installs still resolve. The plugin uses `plugin/scripts/spec`; each installed project uses `.spec/bin/spec`. Older skill copies keep their original launcher location.

**X3. TypeScript 5.9, not 7.** typescript-eslint 8.72 supports TypeScript `<6.1`. Revisit when
typescript-eslint supports 7.

**X4. The repository root is this directory (`spec/`),** not a `spec-skill/` subfolder. The layout
below the root follows the handoff.

## Spec format

**X5. The overview lists modules under `## Modules`, one bullet each, starting with the module ID.**
L015 needs a machine-checkable list ("names exactly the module folders"). Format:
``- `providers` — one line``. Other sections of `core/overview.md` stay free text.

**X6. Units without frontmatter carry status on a meta line.**
- Contracts: `Kind: <kind> · Status: <status>` may add ` · Superseded by: <ID>`.
- Fields and invariants: an optional first line `Status: deprecated · Superseded by: <ID>`.
Without it, a field inherits its entity's status and an invariant is active. This makes tombstones
(D11, L016) possible for every unit type.

**X7. ADR `status: superseded` counts as deprecated** for L005 and L016. `accepted` counts as active.
`supersedes` accepts one ID or a list.

**X8. A YAML key with no value (`reads:`) is an empty list.**

## Lint

**X9. L020 reports type-required fields as warnings; the gate refuses them.**
The handoff asks for both "the fixture passes `spec lint`" and the fixture ticket BUG-302, which has
no `violates` and must be refused by the gate. If L020 made that an error, the fixture could never
lint clean. So lint warns on the type's required fields (`violates ≥ 1`, `touches ≥ 1`, prefix
matches type) and errors on everything else in the ticket schema. The gate (M3) runs the same check,
`ticketTypeProblems()`, and refuses. Affects: CI does not fail on a ticket the gate is there to refuse.
Confirmed by Alex, Oct 27.

**X10. L008 also checks screens:** a UI ID in a step must be in `ui:`, and every `ui:` entry must be
cited by a step. Without this, `impact` on a screen could flag no scenarios (D4).

**X11. Where malformed parts are reported.**
- A duplicate rule number is L003, since rule IDs are units.
- A duplicate scenario number is L007, as the handoff states.
- A malformed `- R<n>:` line, or text in Rules that is not a list, is L006.
- A malformed `### S<n>:` heading, or non-step content in a scenario, is L007.

**X12. The format is strict.** An unexpected `##` section is L006. A `.md` file outside the known
places is L002. A module folder without `_module.md` is L001.

**X13. With invalid frontmatter, the parser keeps only well-formed IDs** for links, so one typo gives
one finding instead of cascading into L004 and L008.

**X14. `--files` limits these per-file rules:** L001, L002, L006, L007, L008, L010, L011, L020.
Cross-file rules (L003–L005, L009, L012–L019) always run on the whole spec.

**X15. Budget overrides.** `config.json` `budgets` uses `size.<unit>` keys (`size.feature`,
`size.contracts`, `size.invariant`, `size.adr`, `size.glossary`, `size.skill`) for L011, and will
use `brief.<role>` for brief budgets (M4). Line counts include the heading. A trailing newline is
not a line. The warning starts at `ceil(80% of the limit)`.

**X16. L012 counts every link except `superseded_by`,** including rule, question and `Why:` cites.
A contract is used when the contract or any of its fields is referenced.

## Graph, build and CLI

**X17. The spec version hashes every authored spec file.**
- **Included.** Everything under the spec root, SKILL.md and config.json among them; config.json
  holds the brief budgets.
- **Excluded.** `index.md`, `_generated/`, `scripts/`, dotfiles and, since M6, `roles/`.
- **Why roles are out.** Briefs never depend on the role prompts, and L021 already tracks whether
  the compiled agents match them. With roles in the hash, every prompt edit would churn every
  snapshot.
- **Encoding.** Each pair is `path NUL content NUL`, so different file sets cannot collide.

**X18. `graph.json` adds to the handoff's example shape.**
- Nodes for modules, rules and fields, and `kind` on contracts.
- Edges for `depends_on`, `why`, `supersedes`, `superseded_by`, and rule and question cites.
- Scenario cites stay in `scenarios[]`, as in the example.
- Feature edge kinds use the frontmatter field names (`invariants`, `decisions`, `ui`).

**X19. `build` writes nothing when parsing finds errors** (exit 1). It writes a file only when its
content changed.

**X20. Finding paths depend on the file.** Spec files are relative to the spec root. Tickets are
relative to the project root (`tickets/PROP-201.md`).

**X21. Project root.** If the spec root is `<p>/.claude/skills/<name>/`, the project root is `<p>`.
Otherwise it is the nearest git root, and failing that, the spec root's parent. `config.json` paths
(the ticket dir) resolve against it. This keeps the fixture self-contained inside this repo.

**X22. `show` with an unknown or malformed ID exits 2** (usage error) with "Unknown X. Did you mean
Y?". It suggests only near typos (edit distance ≤ max(2, len/3)), so shell junk gets no suggestion.

**X23. Commands land milestone by milestone.** Until a command exists it prints "not built yet" with
its milestone and exits 2. `brief` exits 0, as D17 requires.

## Impact (M2)

**X28. Impact on a feature.** `changed` holds the feature. `mustChange` lists the contracts it
writes or emits, each with via `<feature> <kind> <ref>`, flagged with the feature's own scenarios
that cite that contract. `reverify` lists the consumers of those outputs. A scenario or rule
target is treated as its feature.

**X29. Impact on an invariant or ADR reaches every citation, not only frontmatter.** That
includes features whose rules, scenarios or questions cite it (for example
`PRV-002/R1 cites INV-001`). For an ADR it also includes the contract sections and invariants
(`Why:`) that cite it. Contract and invariant items carry no scenarios.

**X30. Two smaller rules.**
- Deprecated features never enter a ring: they are tombstones.
- A feature that both writes and reads a target sits in the inner ring, with both links in `via`.

**X31. Impact output adds `unresolved`:** the ticket IDs that name no unit. They are reported,
not dropped. The field is always present, so the output shape is fixed.

**X32. `--depth n` (n > 1) adds `depth` to every re-verify item.**
- Each deeper item's via ends in `(from <feature>)`.
- An item already reached at a shallower depth, or in the inner ring, or changed, is not added
  again. Paths at the same depth are all listed.
- Inner-ring items carry no depth.

**X33. A scenario or rule in `touches` or `changed` puts its feature in scope.** This applies to
impact's `changed` and to the scope-gap rule, so `touches: [SET-001/S3]` covers SET-001. One rule,
`src/core/scope.ts`, serves both impact and the gate.

**X34. `impact` exits 0 even when it reports scope gaps.** It describes reach. `gate` is the check
that fails (exit 1).

## Questions, tickets, gate (M3)

**X35. Gate blocker kinds.** The kinds are `schema`, `unresolved`, `deprecated`, `question` and
`scope_gap`, sorted in that order, then by ID.
- Each blocker's text ends in its fix (`<message>: <fix>`), the same style as the handoff's
  scope-gap example.
- Preferences also carry their question text, so a brief can show it.

**X36. Gate condition 1 includes the ticket's question kinds (L010).** A preference with no
default has nothing to proceed on, so it blocks.

**X37. Which questions are in scope.** The ticket's own questions, the questions of every unit
named in `touches`, `violates` or `changed`, and those of the features that own a named scenario
or rule. A question with an `answer` never blocks.

**X38. The ticket store is async, and `update` returns a result.**
- `TicketStore.list`, `get` and `update` return promises, so a network tracker can implement the
  same interface.
- `update` returns a result value instead of throwing. It checks that the patched file still
  parses before writing it.

**X39. Ticket edits are minimal.**
- A scalar field (`status`, `stage`) changes on its own line; spacing and comments are kept.
- Lists and records (`changed`, `questions`, `history`) go through the YAML document. ID lists
  are written on one line, records as blocks.
- The body is never touched.

**X40. `ticket start` checks before it changes anything.**
- It re-runs the gate. It checks that the role is in the ticket type's pipeline and is the next
  stage according to the history.
- It refuses to switch branches over uncommitted changes outside the tickets dir.
- It is idempotent for the stage already running.

**X41. History entries can carry a reviewer `verdict`.** `nextStage` reads it:
- a blocked stage resumes itself;
- `changes` sends the ticket to the implementer, then straight back to review;
- a third `changes` blocks the ticket (`MAX_REVIEW_ROUNDS` = 2).

**X42. Queue.**
- Ready entries show the next stage. A ticket with `status: blocked` that now passes the gate is
  listed as ready, to resume.
- Ticket files that do not parse are listed under Blocked.
- The 10,000-character cap is exact: binary search on how many tickets fit, then a line saying
  how many were left out (V10's fallback, built in).

**Open for M5.** `ticket start` leaves the ticket file uncommitted. If another ticket starts first,
git carries that edit onto the other branch. So `ticket advance` must commit only its own ticket
file from the tickets dir.

## Briefs (M4)

**X43. Embedding, so a brief keeps one clean outline.**
- **Headings.** Quoted spec content has every heading pushed down two levels: a feature's
  `## Intent` becomes `#### Intent` under `### PRV-002: …`, inside the `## Features in scope`
  group.
- **Features.** A feature's frontmatter is quoted as a `yaml` fence, with its file path.
- **Tickets.** The ticket sits in a fence longer than any backtick run inside it, so ticket text
  can never close the data block early.

**X44. The Ticket group states the ticket type's rule.**
- Proposal: the spec changes first.
- Bug: make the violated scenarios true again; the spec does not change.
- Task: no behaviour or spec change; stop and cite the unit if one is needed.
This rule decides "stop and report" in eval cases 5 and 6, so it travels with the ticket instead
of living only in the role prompt.

**X45. Scope and order.**
- **Ticket briefs.** Scope is the ticket's scope features, in ticket order: touches, then
  violates, then changed. The first is the "first in scope" for shrinking.
- **Unit-ID briefs.** Scope is impact's changed and inner-ring features.
- **Contracts.** A contract cited whole is quoted whole. Otherwise only the cited field sections
  are quoted.
- **Order.** Every other group is in natural ID order.

**X46. Two group contents beyond the handoff's table.**
- The reviewer checklist also lists the in-scope invariants, which a reviewer must cite (eval
  case 11).
- The spec-writer's Conventions group has built-in scenario-format rules, plus the "Scenario…"
  section of `core/conventions.md`, if there is one.

**X47. The overseer brief fits its budget.** It embeds the queue, cut to whatever the 3,000-token
budget leaves. Its blocked-ticket rules rely on `ticket advance` recording a stage's blockers as
ticket questions, because the overseer has no `edit` capability.

**X48. Bad input always gets a hint on the first line, then the usage line, exit 0.** This covers
an unknown role or ID, a missing ID, a missing spec root and bad options. The skill's empty
`'$0' '$1'` gives the module map, the queue and the usage line. Budgets are overridden with
`config.budgets["brief.<role>"]`.

## Reports, check-report, ticket advance (M5)

**X51. Test results come from any stack.**
- **Formats.** vitest/jest JSON, or JUnit XML, detected from the content. JUnit XML is what
  pytest `--junitxml`, Go (go-junit-report), Gradle/Maven, .NET and most CI runners write.
- **Coverage.** A test covers a scenario when its name starts with `PRV-002/S1 ` (the handoff's
  rule). For stacks whose test names must be identifiers, it also covers it when the name, after
  an optional `test`/`Test` prefix, starts with `PRV_002_S1` and is not followed by a digit:
  `test_PRV_002_S1_fallback` and `TestPRV_002_S1Fallback` both count, and S10 never counts for
  S1.

**X52. check-report path rules.**
- They apply to the stage that is running, not to the role the report claims.
- Ticket files are ignored. Spec paths are those under the spec root.
- A task allows no spec change in any stage.
- A spec-writer stage is valid on proposals only ("the only type that may change spec files").
- Rules 4–6 run on `done` only.

**X53. The tester's in-scope scenarios** are all the scenarios of every feature in the ticket's
scope, not only the changed ones. Main lacks the PRV-002/S3 test on purpose, so a BUG-301 tester
must add it.

**X54. What `ticket advance` records.**
- **A done stage.** It appends a history entry with the stage's `assumed` defaults, so the
  overseer can report them. It merges `changed`, sets `status: open` and `stage: null`, and names
  the next stage.
- **A blocked stage.** Each blocker becomes a blocker question with `raised_by` set to the role,
  so the gate refuses the ticket until a person answers it. That is how the overseer, which has no
  `edit` capability, "copies new blockers onto the ticket".
- **A third `changes` verdict.** It adds a blocker question raised by the overseer.
- **An invalid report.** The ticket blocks on a question that lists the problems. Nothing is
  committed: the stage's changes stay in the tree for a person to review.

**X55. Commits contain exactly one ticket's work.** The commit is
`git add -A -- . ':(exclude)<tickets dir>'` plus this ticket's own file. Another ticket's
uncommitted edit, left behind by its `ticket start`, never rides along (the M3 open item).

**X56. The test command runs in `/bin/sh`.** It is the project's own command. Only a validated
scenario ID (or nothing) and a temp path are substituted into it. It times out after 10 minutes.
`run()` takes stdin and the clock as inputs, so tests are deterministic. Stdin is read only by
`check-report` and `ticket advance`, and an interactive terminal counts as empty.

## Roles and the Claude Code adapter (M6)

**X57. Role files are templates sharing one block of rules.**
- `roles/<role>.md` in this repo share `roles/_shared.md` through `{shared}`, `{role}` and
  `{changed}` placeholders, so the shared rules are written once.
- `spec init` writes each one expanded and self-contained into `<skill>/roles/`, which is what
  any harness reads. Their frontmatter is `role`, `description` and `capabilities`.
- `roles/` and `templates/` are embedded into `src/generated/assets.ts` by
  `scripts/gen-assets.ts` (run by the build). That keeps `dist/spec` free of files beside it and
  works the same under tsx, vitest and esbuild. A test fails when the embedded copy is stale.

**X58. Compiled agents.**
- **Permission rules.** Each spec subcommand gets its own rule, such as
  `Bash(<spec> brief *)`, instead of the handoff's `brief|show|…` alternation, which is not a
  permission-rule syntax.
- **Path line.** Each agent body starts by saying where `spec` is in this project.
- **Fallback line.** Stage roles end with the handoff's "invoke the skill" fallback; the overseer
  has none.

**X59. `spec test [<scenario ID>]` is a new command.** It runs `config.json`'s `testCommand` and
prints one PASS, FAIL or SKIP line per test. Roles use it to run tests without knowing the stack
or the command's placeholders.

**X60. Hook behaviour.**
- **before-delegate.** A spec role delegated with no ticket ID in the prompt is denied. Delegation
  carries the ticket ID (D13). A non-role `subagent_type` passes through untouched.
- **after-edit.** Exits 2 only on lint errors. Warnings never bounce a role.
- **before-finish.**
  - It reads `last_assistant_message`, falling back to the last assistant text in
    `agent_transcript_path` or `transcript_path`.
  - It takes the ticket from the report's `ticket` field.
  - Its bounce counter lives in `$TMPDIR/spec-bounces/<agent_id>`, and the fourth attempt
    finishes.
- **Bad hook input.** Input that is not JSON exits 1, which Claude Code treats as a non-blocking
  error.

**X61. `spec init` also builds `_generated/` and `index.md`,** so a new install passes
`lint --ci` straight away.
- It copies `scripts/spec` and `spec.cjs` from beside the running launcher.
- It never overwrites a file. Agent files are written only when missing;
  `spec compile-roles claude-code` refreshes them.
- `settings.json` is merged: existing hooks, permissions and other keys are kept.

**X62. Path containment compares real paths.** macOS reports the temp dir as `/var/…` to one
caller and `/private/var/…` to another. Before this fix, a hook's absolute `file_path` never
looked "inside" the spec root and edits were not linted.

**X63. The fixture has the skill installed** by `spec init` (roles, agents, settings). Its
`scripts/` folder is git-ignored and copied in from `dist/` by the tests, so it always matches the
code under test.

## Verify before relying on it: answers

Recorded with `evals/record/record-hooks.ts` (Claude Code 2.1.311, claude-haiku-5-5, Oct 27).
Raw payloads went to `evals/record/out/` (git-ignored). Four of them are layer-2 cases with
`"source": "recorded"`.

| # | Answer | Evidence |
| --- | --- | --- |
| V1 | `Agent` | Every delegation's PreToolUse had `tool_name: "Agent"`. The matcher keeps `Task` for older versions. |
| V2 | `description`, `prompt`, `subagent_type` | `tool_input` keys of the recorded delegations. |
| V3 | Yes, `updatedInput` replaces the prompt | The implementer's transcript starts with `TASK-101\n\n# Brief · implementer · TASK-101 · spec@e47c5d9a`. |
| V4 | Yes | Three PostToolUse events for edits inside the implementer subagent, carrying `agent_id` and `agent_type`. |
| V5 | Yes | SubagentStop carries `agent_type`, `agent_id`, `last_assistant_message` and `agent_transcript_path`, plus `background_tasks` and `session_crons`. |
| V6 | Quoting holds | `/chat-spec implementer x'; touch <canary>; '` printed "Unknown …" from `spec brief`, and the canary file was never created. |
| V7 | Moot | `brief` exits 0 on every input, including internal errors. Not tested against a missing binary. |
| V8 | Partly | The injected command ran with no prompt in `-p` mode. The session also passed `--allowedTools Bash(<spec> *)`, so this does not prove that SKILL.md's `allowed-tools` alone pre-approves it. |
| V9 | Confirmed | `claude --help` lists `-p`, `--agent`, `--model`, `--permission-mode`, `--output-format stream-json`, `--include-hook-events` and `--settings`. |
| V10 | Not tested | The queue caps itself at 10,000 characters exactly (M3), so the fallback is built in. |

**Also learned from the session**
- **Subagents run in the background.** The `-p` session continues each time one reports back.
  The whole pipeline ran in one process: four turns, 2.5 minutes.
- **Main-session PreToolUse events carry `agent_type`,** for example `"overseer"`. So does
  SessionStart.

**X64. Evals run through headless Claude Code, not the Messages API** (Alex, Oct 27).
- **Why.** No API key is set. Claude Code is logged in on the Max plan.
- **How.** Each trial is `claude -p --agent <role> --model claude-haiku-5-5`, in a throwaway copy
  of the fixture with the real hooks.
- **Effect on fidelity.** Every eval also exercises the real adapter. What the handoff's
  harness-free runner would have stubbed is real here.
- **What the runner still does.** As the handoff says, it runs before-delegate (gate and
  `ticket start`) for role trials. It sends the ticket ID plus the brief as the first message, and
  runs check-report after the session, resuming it with the problems at most 3 times.
- **Usage and cost** come from Claude Code's `stream-json` result events.

**X65. Report summaries.** Roles are asked for at most 120 characters. The schema accepts up to
500, because a real haiku report was bounced only for being 215 characters long. The commit
subject is cut to 120 characters; the history keeps the full summary.

**X66. Installed role prompts are never overwritten.** `spec init` keeps a project's own roles,
since the project may have tuned them. To pick up new prompts, delete `<skill>/roles/` and
`.claude/agents/`, then re-run `init`; that is what this repo does for the fixture. A
`spec init --update-roles` that shows a diff first is a candidate for after the PoC.

## Evals (M7, M8)

**X67. How the runner fills the harness's role** (with X64: headless Claude Code).
- **Role trials.** The role is the main session (`--agent <role>`). The runner does
  before-delegate itself: gate, `ticket start`, then the ticket ID plus the brief as the first
  message. After the session it runs check-report, and resumes the session with the problems at
  most 3 times.
- **Overseer trials.** These run the real hooks. The four stage agents are replaced with stand-ins
  that run one command: it applies the reference patch keyed `<TICKET>/<role>` and prints the
  canned report. That is the handoff's mock design, inside the real harness.
- **Setup stages.** They replay through the real `ticket start` and `ticket advance`. A
  `force: true` stage is recorded without check-report; it exists for diffs that are wrong on
  purpose, such as the reviewer's key-logging diff, which the implementer check would rightly
  refuse.
- **Isolation.** Every session uses `--setting-sources project` and `--strict-mcp-config`, so the
  operator's own settings, hooks and MCP servers never take part.

**X68. The eval allow-list is a project's normal one,** learned from the first run.
- **Why.** Roles run the bundled CLI as bare `spec`, by relative path or by absolute path, and
  only the relative form matched. They were also refused `git checkout --` (needed to revert when
  blocked) and the project's own `npx vitest`. The roles then correctly blocked or reverted,
  which measured the harness, not the roles.
- **The allow-list now.** It allows the CLI by every path form, read-only git, `git checkout --`
  and `git restore`, and the test command. The skill's `scripts/` is on `PATH`.
- **Compiled agents.** They write the full CLI path into every `spec …` command, so the model has
  no ambiguous form to choose from.

**X69. Assets are tested like code.** `tests/fixture-app.test.ts` checks that:
- every reference patch and diff applies to main;
- each hidden test fails before its reference stages and passes after;
- the clean refactor keeps every behaviour, BUG-301 included;
- the key-logging diff is caught by PRV-001/S3.
A broken asset therefore fails `npm test`, not an eval run.

**X70. Operation contracts name their code entry point,** for example
`settings.PickerProviders`, "In code: `ChatApp.pickerProviders()`". Hidden tests need a stable
API, and the spec is the source of truth for it. This is used only in the PROP-202 and PROP-205
reference stages, so main's spec, and every snapshot, stays as it was.

**X71. Probes use the implementer brief alone,** in a fresh `claude -p` session with every tool
disallowed, in an empty directory. Two of the 16 probes ask about behaviour the spec puts out of
scope; their correct answer is "Not specified by the spec". They check that the model does not
invent behaviour.

**X72. The spec lives at `<project>/spec/`, outside `.claude/`. The skill folder is only the
Claude Code adapter.**
- **The handoff's rule.** "The spec folder is the skill folder."
- **Why it changed.** The first eval pass showed that Claude Code refuses writes under `.claude/`
  even in `acceptEdits` mode. Tested on 2.1.311 with five allow-rule forms (`Edit(.claude/…)`,
  `Edit(./.claude/…)`, `Edit(//<abs>/.claude/…)`, a bare `Edit`, and `--add-dir`). Only
  `bypassPermissions` allowed the edit. So a spec-writer could never edit the spec, and correctly
  reported blocked. The handoff asks for a settled choice that fails in practice to be recorded
  before it is changed; this is that record.
- **The new layout.**
  - `.claude/skills/<name>-spec/` holds `SKILL.md`, `skill.json` (`{ "specRoot": "spec" }`) and
    `scripts/spec`.
  - `spec/` holds `config.json`, `core/`, `modules/`, `ui/`, `decisions/`, `roles/`,
    `_generated/` and `index.md`.
- **How the CLI finds the spec.** `--root`, then `SPEC_ROOT`, then the running script's
  `skill.json`, then an older install whose spec sits inside the skill folder. Older installs
  still resolve; `tests/dist.test.ts` covers both layouts.
- **Why it is also better.** The spec is now harness-neutral in place, as D16 asks: any harness
  reads `spec/`, and only the adapter lives in Claude Code's folder.
- **Where the skill name comes from.** `config.json`'s new `name`. The skill is `<name>-spec`.
- **Proof it changed nothing else.** All 40 affected snapshots changed only in their spec version.

**X73. The project root is the spec root's parent,** unless config.json sets `projectRoot`
(relative to the spec root). Older installs keep `<project>/.claude/skills/<name>/` → `<project>`.
- **Why not the nearest git root.** A git-root search found the wrong project once this repo
  became a git repository: the fixture's tickets were looked for at this repo's root.
- **Also in this change.** `spec init` adds `Bash(<cli> *)` allow rules to `settings.json`, so
  agents are never prompted for the project's own CLI.

**X74. `ticket advance` no longer needs the overseer to copy the report.**
- **Where it gets the report.** When the before-finish point accepts a report, it stores it at
  `.git/spec/reports/<TICKET>.md`, never committed. With empty stdin, `advance` reads that.
- **The order.** A fenced report on stdin wins. Then the stored report. Then bare report YAML on
  stdin, which is a copy that lost its fence.
- **Missing is not invalid.** With no report at all, `advance` exits 2 and changes nothing, so the
  stage keeps running and the call can be retried. Only a report that parses but fails its checks
  blocks the ticket.
- **Why.** In 2 of 5 overseer/skips-not-ready trials, haiku pasted the report without its fence.
  The old `advance` treated that as an invalid report, blocked the ticket and committed nothing, so
  a valid stage was lost to a transport slip. The overseer prompt now just says
  `spec ticket advance <ID>`.

**X75. A Then step that states a whole value says "is"; "records" means "includes".**
- **The trigger.** PRV-002/S3 said meta "records stopReason … and retryAfterMs = 800". Two haiku
  testers asserted that the meta object equals exactly that. But the fallback in its Given also
  records `fallbackFrom` (S1), so the correct fix failed their test.
- **The spec fix.** S3 now states the whole value: "meta is fallbackFrom = "claude", stopReason =
  "rate_limited" and retryAfterMs = 800".
- **The tester prompt fix.** Check each stated value. Assert that nothing else is there only when
  the step says what the whole value is.

## Scale

**X49. Markdown is read by a block scanner in `src/core/markdown.ts`; remark is the test oracle.**
- **The handoff's rule.** It says Markdown is parsed with remark-parse and remark-frontmatter, so
  that code fences are handled correctly.
- **Why it changed.** At the target size, a generated 697k-token spec (2,000 features), remark
  took 745 ms of a 1,067 ms parse. Every command parses every file, and the `after-edit` hook runs
  on every edit. The spec format only needs block structure: frontmatter, ATX and setext
  headings, paragraphs, lists, fences, quotes, HTML and indented code.
- **What replaced it.** A block scanner gives the same output in 15 ms.
- **How it is kept honest.** `tests/core/markdown.test.ts` requires the same blocks as remark
  (type, lines, offsets, depth) on every Markdown file in the repo (111, briefs included) and on
  20 edge cases. Fences hide headings, setext headings, loose lists, lazy quotes, HTML comments,
  unclosed fences and trailing whitespace are all covered. All other snapshots stayed
  byte-identical when the scanner went in.
- **Dependencies.** remark, remark-frontmatter and unified are now dev dependencies.
- **Result.** At 697k tokens one CLI call went from 1.3–1.4 s to 0.5–0.65 s. The fixture brief
  went from 149 ms to 125 ms.

**X50. Smaller speed-ups, none of which changes a result.**
- Node's compile cache, through the launcher.
- `child_process` loaded on first use.
- The glossary is pre-filtered by each text's word set before any regex runs: `graph.json` went
  from 340 ms to 152 ms at scale.
- ID chunks are cached for natural sorting: building the index went from 101 ms to 53 ms.
- `npm run bench [modules] [features]` regenerates the benchmark spec and prints every stage.

## Tests

**X24. Lint cases overlay a shared base.** `tests/core/lint-cases/_base/` is a minimal spec that
produces zero findings. Each `<rule>/` holds `case.json`, the overlay files, and the reviewed
`expected.json` (a vitest file snapshot). The test fails when a rule has no case. L021 is skipped
until `compile-roles` exists (M6).

## The chat-mini sample

**X25. The sample is built to be easy, testable and verifiable** (Alex, Oct 27). It is a test bed
for the spec system, not a product, so every behaviour in it is checked by a machine:
- **Concrete values.** Providers are `claude`, `gpt` and `mistral` (`ProviderId` is defined in
  `providers.ProviderConfig`), and every Then step states an exact value a test can assert.
- **Every rule is shown by a scenario.** Rules that only repeated a linked invariant were removed:
  CNV-001/R1, CNV-003/R1, PRV-001/R1, SET-001/R2 and SET-002/R1. The invariant is still linked in
  frontmatter and lands in every brief.
- **One visible test per scenario,** named `<ScenarioID> <title>` in `tests/<FeatureID>.test.ts`.
  The only exception is the planted gap PRV-002/S3.
- **`tests/fixture-app.test.ts` enforces all of the above.** It also checks BUG-301 both ways: the
  hidden PRV-002/S3 test fails on main and passes after
  `evals/reference/BUG-301.implementer.patch`.

**X26. Changes to the handoff's chat-mini tables.**
- **Added scenarios.**
  - PRV-001/S3, "The key never reaches the log": a test for INV-002 in logs. It is also the
    surface that the `logs-api-key` reviewer diff (eval case 11) breaks.
  - PRV-002/S4, "Fallback provider not enabled": shows PRV-002/R1 (INV-001 for the fallback).
  - SET-001/S3, "Enable without a key": shows SET-001/R1 ("a provider needs an API key"). It also
    gives SET-001's `reads: [settings.ApiKey]` from the handoff a purpose.
- **CNV-001 also links INV-002:** S2 checks that the error text holds no key.
- **Concrete outcomes.** "A retry-after notice" is now `stopReason = "rate_limited"` plus
  `retryAfterMs`. The export is each message's content separated by one blank line. PRV-003 no
  longer claims "the counts cover that reply only".
- **UI-001 has no close button or Closed state:** nothing would test it.

**X27. chat-mini runs without its own install.** Its tsconfig and vitest config resolve
TypeScript and vitest from this repo's `node_modules`. Tests that run it copy it to a temp dir and
symlink `node_modules`; the M7 eval runner will do the same. The root `typecheck` also checks
chat-mini.

## After the PoC: Alex's answers (Oct 27)

**X76. Proposals are test-first: spec-writer → tester → implementer → reviewer** (Alex: "we do
BDD, so tests must be made before the implementer").
- **The tester writes tests against the new spec, before any code changes.** On a proposal, the
  scenarios the ticket's branch added or changed must start red: at least one of their tests fails
  when the tester finishes. One per scenario would be too strict, because a new scenario can
  already hold at runtime. PROP-201's SET-001/S4 does: only the `ProviderId` type forbids
  enabling gemini.
- **The CLI computes what is new.** It compares the spec in the working tree with the spec at the
  merge base of the base branch, unit by unit (`src/core/delta.ts`, `filesAt` in `src/io/git.ts`).
  No role copies the list. `ticket advance` merges the spec-writer's changes into the ticket's
  `changed` even when its report left some out, because later briefs scope by `changed`.
- **Briefs say it.** The tester, implementer and reviewer briefs of a proposal list what is new in
  the spec, each with what that role does about it.
- **The tests are the tester's.** On a proposal or a bug, an implementer that changes a test file
  is refused. If a test contradicts its scenario, the implementer reports a blocker that cites the
  scenario. On a task, the implementer may still move tests with the code they cover.
- **Evidence.** Each proposal's reference tester patch fails before its implementer patch and
  passes after it (`tests/fixture-app.test.ts`). PROP-201 runs the whole test-first pipeline
  through the CLI (`tests/cli/test-first.test.ts`). The M8 run checks for red tests at the
  tester's commit.
- **Compiled languages** need stubs, so that a test against code that does not exist yet
  compiles: X82.

**X77. Tickets can live in any tracker, through a two-operation protocol** (Alex: "we need to be
agnostic … keep it simple, so that we can link to any setup").
- **The format is the interface.** Every store holds tickets in the ticket file format. An
  adapter only moves text: `<command> list` prints `{"tickets":[{"id","text"}]}`, and
  `<command> put <ID>` saves `{"id","text","previous","note"}` (docs/TICKETS.md).
- **Why text, not fields.** An adapter that maps fields has to know the schema and follow its
  changes. One that keeps the whole text in an issue body needs about 30 lines. Field mapping
  is still possible, inside the adapter.
- **`previous`** lets an adapter refuse a write that would overwrite someone else's edit. A
  refusal or a non-zero exit stops the CLI and changes nothing.
- **`files` is the default and stays built in.** `examples/ticket-adapters/json-file.mjs` is a
  complete adapter, and the tests run the CLI through it.
- **Every stage is a commit, even an empty one** (`--allow-empty`). With a tracker no ticket file
  rides along, and the branch must still show each stage.

**X78. Every tree reads a ticket's live state** (files store). A ticket runs on `ticket/<ID>`,
often in its own worktree, so the copy of its file on `main` goes stale. That was the stale-queue
problem in M7.
- **Reads.** A ticket whose branch is checked out in another worktree is read from that worktree's
  file, because its running stage is not committed yet. An unmerged branch that no tree has
  checked out is read from its tip. This costs four git calls plus one `cat-file --batch`.
- **Writes go where the live copy is:** that worktree's file, or a commit onto the branch through
  a temporary index and a compare-and-swap `update-ref`. No working tree is touched.
- **`spec ticket answer <ID> <Q> <text>`** uses this, so a person answers a blocker from any
  tree. A blocked ticket goes back to `open`, and the gate decides if it is ready.

**X79. Which tickets may run at the same time** (Alex: "if they touch similar files, that's
fine, if they depend on one another, that's not fine").
- **Two tickets conflict when** one `depends_on` the other, or when a proposal changes a shared
  unit (a contract, field, invariant, decision or screen) that the other ticket works on or that
  one of its features uses: as a producer, a consumer or a citer. Two tickets that change the
  same scenario or shared unit also conflict.
- **Not a conflict:** two tickets on the same feature, and so on the same files. Bugs and tasks
  change no spec, so they reach nothing that another ticket reads.
- **Why the reach stops at shared units.** Features connect only through contracts (D7). An
  earlier draft used each touched feature's whole impact. In the fixture, that let one ticket of
  seven start.
- **Waves, first fit.** In priority order (the order asked, else by ID), each ticket takes the
  earliest wave in which nothing it conflicts with runs. Running tickets hold wave 1.
  Independent work starts at once; between two conflicting tickets, the earlier one goes first.
- **A dependency is met** when its ticket is done and its branch is merged into the base branch,
  so a new worktree starts from its work. The gate refuses until then with a `dependency`
  blocker. The queue lists such tickets as Waiting, not Blocked: they clear by themselves.
- **`ticket start` enforces it.** It refuses a ticket that conflicts with any running ticket, in
  any tree. It also refuses a second ticket in a tree that runs one, and a ticket whose branch
  is checked out in another tree.

**X80. Parallel runs: one worktree and one headless session per ticket.**
- **`spec worktree add <ID>`** checks out `ticket/<ID>` beside the repository
  (`<repo>.worktrees/<ID>`, or config `worktrees`). It copies in the bundled CLI, which is often
  git-ignored, and runs config `worktreeSetup`, for example to link `node_modules`.
- **`spec dispatch <ID>…`** runs config `dispatchCommand` in the worktree of every asked ticket
  the plan lets start now, all at once. It names why the others wait, and logs each run under
  `.git/spec/runs/`.
- **Why one session per worktree.** Claude Code subagents share their session's working
  directory, and its own worktree isolation gives each subagent a fresh tree. A ticket's stages
  need one tree across four subagents.
- **Merging is a person's step.** Dependents start once the branches they wait for are merged.
  When two proposals both changed the spec, `_generated/` can conflict on merge; run
  `spec build` and commit, because it is rebuilt, never merged.
- **Evidence.** `evals/e2e/parallel.ts` ran BUG-301 and PROP-205 through real Claude Code at once,
  with overlapping runs of 73 s and 147 s. Each branch had red tests at its tester commit. Both
  merged into main cleanly, and main was green: 22 of 22 tests, hidden ones included.

**X81. The spec loads through Claude Code's own skill loader** (Alex: "as long as we can load the
spec via built in skill loader as well"). Checked live on 2.1.311:
- `/chat-spec`, `/chat-spec PRV-002/S3` and `/chat-spec implementer TASK-101` each inject the
  home brief, the unit, or the role brief, read from `spec/` outside `.claude/`.
- **A bug it found.** A missing `$0` or `$1` reaches the command as that literal text, not as an
  empty string. So `/chat-spec` alone used to print "Unknown role $0". `spec brief` now treats a
  bare placeholder as empty.
- **A model loading the skill itself** passes free text, for example "fallback provider also
  rate-limits". `spec brief` now searches with it (`--query '$ARGUMENTS'`) and shows the
  best-matching scenarios in full. That Skill tool call needs `Skill(<name>-spec)` allowed, and
  `spec init` now adds it. With it, haiku answered from the spec in 6 turns instead of 10.
- **Headless sessions ignored the project's allow rules** in this test: the CLI rule missed with
  `bashMiss:no-rule-match`. So `dispatchCommand` passes `--allowedTools`, as the evals always have.

**X83. The user's commands are skills that end in the CLI** (ROADMAP §2–3; Alex, Oct 27).
- **Five commands:** `/spec-init`, `/feature`, `/change`, `/bug` and `/orchestrate`. They are
  harness-neutral templates in `templates/commands/`. `spec init` installs them as Claude Code
  skills, and `--update-roles` keeps them current.
- **No `/task`.** `/change` asks whether behaviour changes: yes gives a proposal, no gives a task.
- **Each command loads the spec first.** Its skill injects `spec brief --query '$ARGUMENTS'`, so
  the model starts from what the spec says about the request.
- **Each command ends in one CLI call:** `spec ticket new <file>` (with `--dry-run` first) or
  `spec orchestrate`. The JSON goes in a file, because Claude Code refused a heredoc holding JSON
  ("brace with quote character").
- **Commands check for a ticket that already covers the request.** In the first eval run, `/bug`
  found BUG-301 and filed nothing; that is now part of every command.
- **Unattended,** open points become questions on the ticket, and nothing starts without a yes.

**X84. Merging is automatic, behind the same checks as every stage** (Alex: "merging
automatically").
- `spec merge <ID>` merges a done ticket into the base branch only if the merged result lints
  clean and passes every test. Otherwise the merge is undone, and a person decides.
- Conflicts only in `_generated/` are rebuilt, never merged by hand. Any other conflict is
  refused.
- `spec orchestrate` repeats plan → dispatch wave → merge, until nothing more can start. It ends
  with what merged and what waits for a person, with the reason.

**X85. Drafts: a unit drafted from evidence is not spec until a person confirms it** (ROADMAP 1b).
- **Representation.** A draft is a flag, not a status, so everything else (graph, impact, lint)
  treats it as current.
  - Frontmatter units get `draft: true` and `sources: [file:line, doc]`.
  - Contracts and invariants put `· Draft: <sources>` on their status line.
- **Sources live only while a unit is a draft.** `spec confirm <ID>` drops them, along with the
  flag, and changes nothing else (Alex was unsure; recommended because code pointers go stale).
- **The gate refuses any ticket that touches a draft,** so no work builds on spec nobody agreed
  to.
- **`spec gaps` drives `/spec-init`:** drafts with their sources, open questions, modules
  without features, unused contracts, and scenarios without a test.
- **Evidence.**
  - `tests/cli/adopt.test.ts`: drafts lint clean, gaps lists them, the gate refuses, and confirm
    clears them.
  - The eval `command/spec-init-adopt` deletes dart-mini's modules and has haiku draft them back
    from the code. Every unit was a draft with sources, and the model asked about negative prices
    and duplicate names rather than deciding them.

**X82. Test-first in compiled languages: stubs marked SPEC-STUB** (Alex: "yeah, we want
test-first").
- **The problem.** In Dart, Go, Rust, Java or Swift, a test that calls a method that does not
  exist yet does not compile. Nothing in that file runs, so there is no red test at all. In Dart
  the whole file shows as one failed "loading test/…" test.
- **The rule.** On a proposal, the tester may change code only to add stubs. A stub is the
  smallest declaration that compiles and throws, at the entry point the contract names, marked
  `SPEC-STUB` and the ticket ID, for example `throw UnimplementedError('SPEC-STUB PROP-101')`.
- **What the CLI enforces.**
  - check-report reads the tester's code changes as `git diff -U0` hunks, and refuses any hunk
    without the marker.
  - It refuses an implementer that leaves `SPEC-STUB` in any code file.
  - Bugs need no stubs: their code exists.
- **The marker is plain text,** so the rule works in every language, and `git grep` finds every
  stub left.
- **Dart and Flutter test reports.** The JSON event stream of `dart test --reporter json` and
  `flutter test --machine` is now read directly. Tests grouped by feature count, so a group
  "PRV-002" around a test "S1 …" covers PRV-002/S1. Checked on Flutter 3.47:
  `flutter test --machine --plain-name ""` writes only the event stream to stdout, and runs every
  test.
- **Evidence.**
  - `fixtures/dart-mini` is a plain Dart cart.
  - `tests/cli/dart-test-first.test.ts` runs PROP-101 through the CLI with real `dart test`:
    without the stub, the test file does not load; with it, only CRT-001/S3 fails; the
    implementer is refused until the stub is real code.
  - The live eval `tester/stubs-in-dart` has haiku do it unaided.

## Format 2: the spec-structure review (Oct 28)

Alex: the structure of the spec is the part that must be right, since every project is written in
it. Three independent reviews (Fable 5.1, Opus 5.5, GPT-6 Astra; Gemini was out of quota) all
judged the structure fundamentally right, and all found the same weak layer: the data model. These
are the changes that alter IDs or link meanings, so they land before any project adopts the
format. Each was first reproduced as a failing test (`tests/core/format2.test.ts`, 24 tests, all
red before the change). docs/FORMAT.md has the result and the migration.

**X86. The spec names its format: `formatVersion` in config.json, now 2.** Lint (L001) refuses a
spec with no version or an older one, with the migration as the fix, and a newer one with "update
the CLI". The config still loads either way, so every other command keeps working while the
spec is migrated.

**X87. An ID names a unit, not where it lives.**
- **Feature prefixes only number new features.** A feature keeps its ID when it moves to another
  module, so its tests, tickets and history stay valid. L014 now checks only that some module
  registers the prefix. Before, a move meant renumbering and renaming every test.
- **INV, ADR and UI take 3 or 4 digits,** like features. Free to widen now; awkward later.
- **A member name may use `_`** (`settings.ApiKey.created_at`), so it can match Python, Go or
  JSON names exactly.

**X88. Nothing leaves the spec silently.**
- **`retired: [S3, R2]` in a feature** lists removed scenario and rule numbers. Using one again
  is L003. Before, scenarios and rules could not be retired at all, so "never reuse a number"
  rested on memory, and deleting the highest scenario freed its number.
- **A tombstone may have no replacement** (L016). Some behaviour is simply removed.
- **The delta lists removed units.** check-report refuses a spec-writer stage that removed a
  scenario or rule without retiring it, or deleted any other unit instead of deprecating it.
- **Tests follow.** The tester's brief lists removed scenarios: "delete their tests".
  check-report refuses a tester stage that leaves a test named after a scenario the spec does
  not have, and `spec gaps` lists such tests. Before, an orphaned test passed forever.

**X89. Types and errors are contracts; every kind has members.**
- **Two new kinds:** `type` (a shared value shape, such as `providers.ProviderId`) and `error`
  (such as `settings.MissingApiKey`). Before, `ProviderId` lived inside a sentence of another
  contract, `MessageId` was used and never defined, and error values were bare words in steps.
- **`####` members under any kind,** not only entities: an event's payload members, an
  operation's inputs, an error's fields. Each is addressable and has a `Type:`. `Payload:` and
  `Input:` lists are format 1 (L001), so there is one way to write a member.

**X90. A type reference is a graph edge.**
- **A qualified name in a `Type:` or `Output:` expression is a `uses` link** from the member or
  contract to the type. Only type expressions link: an ID in a description is a pointer for the
  reader, not a dependency (Codex's point that a citation is not always a dependency).
- **Impact follows it.** Changing a type reaches every contract typed by it, then every feature
  using those, as if those contracts changed. `impact providers.ProviderId` now reaches SET-002
  through `settings.ApiKey.providerId`, which PROP-201's impact missed in format 1.
- **Scope gaps do not follow it.** Widening a type does not oblige every writer of a field of
  that type to change, so the gate stays as strict as before; the planner sees the full reach.
- **Briefs quote the types their contracts use,** so "Type: providers.ProviderId" arrives with
  its values. Briefs grew about 8%; the largest is 2,700 tokens.
- **L022 (warning) flags a bare capitalised name in a type expression:** "write it qualified" when
  the spec defines it, "define it" when it does not. Lower-case names and common built-ins
  (`String`, `List`, `DateTime`, …) are never flagged. It would have caught `MessageId` and
  dart-mini's `Line`.

**X91. A link says what a feature does with a contract, and lint checks the kind.**
`reads`/`writes` take entities and types, `emits`/`consumes` events and errors, and the new
`provides`/`calls` operations (L004). Before, dart-mini listed the operation `cart.AddItem` under
`writes`, which said nothing about who implements it. Impact treats `provides` as a producer and
`calls` as a consumer. We kept readable verbs instead of Opus's two-key `uses`/`produces`: the six
keys read as English in a PR, and the kind check removes the ambiguity that motivated merging them.

**X92. Only `index.md` is committed; `_generated/graph.json` is built on demand.**
`index.md` no longer carries the spec hash, so it changes only when a module or a feature's title
or status does. The graph held a hash and a line number per node, so every edit rewrote it and
every two parallel spec changes conflicted in it. No command reads it back. `spec init` writes
`spec/.gitignore`; L017 checks `index.md` only.

**X93. A fact is written once.**
- **Module `depends_on` is gone;** the graph derives module dependencies from the contracts
  features use. The hand-kept lists were unchecked, and cyclic in chat-mini.
- **The overview lists no modules;** L015 is retired. The two summaries of each module had
  already drifted apart in chat-mini; `index.md` shows each module's own first paragraph.
- **`core/conventions.md` no longer repeats the ID patterns.**

**X94. The evals run on Codex too** (Alex: trials on both haiku xhigh and Codex GPT-6 Luna max).
`evals/runner.ts --harness codex` runs every case through `codex exec`, with `--effort` for both
harnesses. Codex has no agents, skills or hooks, so the runner supplies them:
- **A role** is its installed prompt (`spec/roles/<role>.md`) at the top of the first message.
- **A command** (`/feature …`) is its skill file, expanded as Claude Code's loader would: the
  arguments filled in and each `!` line run.
- **The overseer delegates** by running a script that calls the same before-delegate and
  before-finish points through `spec hook`, so stages start and reports are stored as in Claude
  Code. A delegation is graded like an Agent call.
- **Reading files.** A note at the top says to read with the shell and edit with apply_patch,
  since the shared role rules name Claude Code's file tools and its one-command-per-call rule.
- **Isolation.** `--ignore-user-config --ignore-rules` and no login shell, so the user's Codex
  memories, rules and shell profile do not reach a trial. The sandbox is workspace-write plus
  `.git` (tickets commit) and vitest's cache folders.
- **Not comparable across harnesses:** Codex reports no cost, and its "turns" count commands and
  edits.

**Considered and not done, with the reason.**
- **One file per contract or invariant** (Fable). It splits a module's contracts across many
  files, where one page per module is the reading unit. The `contracts/*.md` split stays for
  large modules.
- **Two parallel proposals both adding `S4` to one feature** collide at merge. The format only
  needs X88's retirement record; handing out numbers across live branches is tooling, for later.
- **Impact treats a scenario without a citation as unaffected** (Codex: CNV-003/S2, "no key
  material in export", is missed when `conversation.Message` changes). That is impact's precision
  rule, not the format; a fix belongs with the tooling.
- **Additive, no migration later:** `Schema:` pointers to real OpenAPI or JSON Schema files,
  tables and examples inside scenarios, `Covers:` lines, invariants scoped by contract, a checked
  `Code:` pointer, and UI flows.

## Format 2, review round 2 (Oct 28)

The same four reviewers with the same brief, on format 2 (Gemini 4 Argon had no quota, so Gemini
3.8 Flash High stood in). All four: keep the structure, it is right; a short list of changes. A
change was accepted when it alters IDs or meanings (cheap only before adoption), fixes a defect a
reviewer reproduced, or had two or more reviewers and a low cost. Each was a failing test first:
`tests/core/format2-review2.test.ts`, 17 of 18 red before the change.

**X95. A member name may start with a capital** (Fable, Opus). `cart.Line.PriceCents`, as Go and
C# spell fields. X87's claim that members matched Go names was wrong until now.

**X96. One type language** (Opus, Gemini, Codex; Fable for named shapes only). `Type:` and
`Output:` are parsed (`src/core/types.ts`): primitives `string int number bool bytes date datetime
duration null`, literals, qualified references, `T[]`, `map<K, V>`, unions and parentheses.
- **Why.** A free-text type was read only for IDs. chat-mini wrote TypeScript, dart-mini Dart, so a
  spec shared by a Flutter app and a backend had two dialects; Codex showed that a member with no
  `Type:`, or `Type: typo[[<`, gave no finding at all.
- **No inline objects.** `conversation.Message.meta` was `{ fallbackFrom?: …, stopReason?: … }`:
  impact stopped at `meta` although two features write different keys. A keyed shape is now a
  `Kind: type` with members (`conversation.DeliveryMeta`), so each key has an ID.
- **Closed sets are literal unions,** `Type: "claude" | "gpt" | "mistral"`, not a sentence. Fable's
  `Values:` line is not needed.
- **Native spellings are refused with the portable form as the fix** (`List<int>` → `int[]`).
  L022 is now an error, and a member without a `Type:` is one too.
- **Fable's objection, and why it did not win.** Fable kept free text because models read prose
  types well. They do, but lint, impact and two-stack projects cannot; the grammar is small, and
  every refusal names its fix. If models struggle, the evals will show it.

**X97. A step cites the invariant it checks** (Gemini, Codex). `Then … (INV-002)`. Impact on the
invariant reaches only the citing scenarios; a feature that lists it but cites it nowhere still
has every scenario reached. A cited invariant must be in `invariants:` (L008). This also connects
CNV-003/S2, the export-secrecy check that named no contract, to INV-002.

Status: superseded · Superseded by: X116.

**X98. Retirement is append-only** (Codex, reproduced). The delta lists retired numbers taken off a
feature's list (`unretired`), and check-report refuses them. Before, removing `S9` from `retired`
and writing a new S9 passed lint and check-report.

**X99. A tombstone may point at a tombstone** (Codex). When B replaces A and C later replaces B, A
is not edited again: lint follows the chain, which must end at a current unit; a cycle is an
error. Before, every old tombstone had to be repointed: history kept as maintained copies.

**X100. `core/invariants/*.md` and `core/glossary/*.md`** (Fable, Gemini, Opus). Like
`contracts/*.md`: one file still works; a folder spreads parallel additions across files.

**X101. `Code:` names the code entry point, and `spec gaps` checks it** (Fable, Opus). The prose
`In code: …` that the tester relied on was not parsed and could not go stale visibly. `Code:
Cart.add(name, priceCents, quantity)` is its own line; gaps reports one whose last name no code
file contains. Prose `In code:` is format 1 (L001). Opus's alternative, contract IDs in code
comments checked by lint, solves the same problem from the code's side; it is additive and can
come later.

**X102. One spelling for a decision link** (Opus, Fable). Invariants take `Decisions:` like
contracts; `Why:` is format 1.

**X103. Graph consumers agree on what a unit needs** (Codex, reproduced; tooling).
- `spec gaps` counted `cart.Line` as unused although `cart.Cart.lines` is typed by it; a type used
  by a member is used.
- The gate let a ticket start on a feature whose contract was a draft; it now refuses drafts the
  scoped features link.
- A brief that quoted one member dropped its contract's head (kind, status, decisions, draft); the
  head now comes with it. A brief follows `uses` to errors too, so an operation arrives with how it
  fails.

**X104. A scenario's behaviour is its steps** (Fable). The delta compares scenarios by steps; a new
title over the same steps is "reworded", listed in briefs, but no red test is required for it.

**Fixtures.** Both samples omit empty link keys now, as FORMAT.md says (Opus, Fable: agents copy
what they see).

**Deferred, with the reason** (each additive, or one reviewer only):
- **Every `When` names an operation, with a lint rule** (Opus, Gemini). It would connect CNV-001
  to the streaming it starts, and give stubs a named entry point. It is also the heaviest change:
  chat-mini alone would need about eight new operations, and UI-driven apps would add ceremony to
  every scenario. `provides`/`calls` and `Code:` already let a project do it; whether to require
  it goes to the next review round.
- **`deprecated` (still served) versus `removed` (tombstone)** (Opus). A real gap for APIs in a
  migration window, but it changes the meaning of an existing status and only one reviewer
  raised it; next round.
- **Tables and data attached to steps** (Fable, Codex): additive, no migration later.
- **Screens linking the contracts they show, and navigation** (Fable, Gemini; Opus noted): additive.
- **External modules** (Fable), **rules cited by scenarios with coverage lint** (Fable),
  **`Applies to:` on invariants** (Opus, Codex): additive.
- **A unit-aware merge driver, `spec fmt`, an ID allocator across branches** (Opus): tooling.

**Rejected, with the reason:**
- **Derive `ui:` from the steps** (Gemini). The other three keep the frontmatter list with L008:
  it is the PR-visible summary, and screens reached by impact rely on it.
- **A contract defined outside the module its prefix names** (Codex). L019 keeps a module's
  contracts on its own page; Opus and Fable keep it, and a rename is mechanical.
- **Drop `module:` from features** (Opus). Fable argues it makes a quoted feature self-describing;
  L002 keeps it honest.
- **A second meta separator, default statuses** (Fable): cosmetic.

## Format 2, review round 3 (Oct 28)

Same reviewers, same brief, on X86–X104. All four: keep the structure. The same acceptance test as
round 2 (Opus put it well: whatever a `spec migrate` can apply mechanically is cheap at any time;
what a later migration would need a person to decide, unit by unit, must be settled now). Each
change was a failing test first: `tests/core/format2-review3.test.ts`, 16 of 17 red before.

**X105. Absent is not null: `T?`** (Opus, Fable, Codex). `T?` on a member means it may be left
out; `T | null` means it is there and may be null. Round 2's FORMAT.md conflated them, and the
fixture showed the cost: `DeliveryMeta`'s members were `| null` while the code made them optional
and PRV-002's test asserted they were absent. `?` covers the whole type, so `(A | B)?`; only a
member may be optional. `decimal` joins the primitives, and `Decimal` maps to it, not to `number`.

**X106. Three statuses: `active`, `deprecated` (still served), `removed` (tombstone)** (Opus in
rounds 2 and 3, Gemini, Codex; Fable's clean tombstone folded in). "Deprecated" meant a tombstone,
so an API in a migration window could not be described: a link to it was an error, impact dropped
it, the gate refused work on it.
- `deprecated`: stays in impact, briefs and tests; links to it warn (L005); the gate lets work start.
- `removed`: links to it are errors; the gate refuses it; a removed feature holds no scenarios, so
  their tests are flagged with no other change (Fable: Behaviour could not be None, so retired
  features kept serving dead scenarios).
- A tombstone's chain may end at a removed unit and is never edited (Codex); a deprecated unit's
  chain must reach a current one. A superseded ADR counts as removed.

**X107. A step cites the rule it shows** (Opus, Fable, Codex). `(R2)` or the full ID. A rule no
scenario cites is a warning (L023); a rule that changes while none of its scenarios does is refused
at the spec stage. Codex showed the gap: changing PRV-002/R2 to allow two fallbacks gave no lint
finding and no changed scenario, so no red test, while S3 still said "mistral is never called".

**X108. Features meet at operations** (Codex; Opus and Fable proposed more). An operation features
call and none provides is a warning (L012). chat-mini now models `providers.StreamReply` (CNV-001
calls, PRV-001 provides): `impact PRV-001` reached nothing in CNV-001 before, although sending a
message starts the stream. Its steps that set up an API key now cite `settings.ApiKey`, so a
change to the message shape reaches CNV-003/S2, the export-secrecy check Codex flagged in every
round. Not adopted: a rule that every `When` names an operation (Opus): Codex argued against it,
Fable wanted it as a warning only, and a screen action is a trigger too. Decided against, not
deferred.

**X109. Screens link what they show and call** (all four). `shows:` (entities, types, events,
errors) and `calls:` (operations), kind-checked; impact on such a contract, or on a feature that
produces it, reaches the screen. UI-001 now shows `providers.FallbackTriggered`. Navigation between
screens waits for a fixture that has more than one screen.

**X110. A step may carry a table or a fenced block** (Codex in rounds 2 and 3, Fable in round 2).
Under the step it belongs to; part of the scenario's substance (a change to it changes the
scenario), and its IDs are cites. Example rows get no IDs.

**X111. `requires:` is gone, and L013 with it** (Fable). Only the cycle check read it; X93's rule
"a fact is written once" says a fact nothing uses is not written at all. A feature that needs
another's result says so through the contract between them.

**X112. `Code:` needs its owner and its name in one file, and `spec lint --ci` checks it**
(Codex reproduced a comment satisfying it; Gemini). `Cart.add` is found when one code file holds
`Cart` and `add`. L024 (warning) runs at the CLI with `--ci`, like L021, since core reads no files.

**X113. The gate follows types to drafts** (Codex reproduced). A ticket on SET-002 was ready
although `settings.ApiKey.providerId` was typed by a drafted `providers.ProviderId`.

**Fixture corrections the reviews found:** `conversation.Message.id` (the code and the tests have
it; Opus, Fable), `RateLimited.retryAfterMs` is `int` like `DeliveryMeta.retryAfterMs` (Opus,
Fable), ADRs omit empty `supersedes` (Fable).

**Deferred** (additive): `Key:` identity lines (Opus, Fable), `Applies to:` on invariants (Opus,
Codex), `Aliases:` on contracts and member paths (Opus), screen navigation, external modules,
`Schema:` pointers (Codex), and the tooling: ID allocation across branches, a unit-aware merge
driver.

**Rejected, with the reason:**
- **Derive `reads`/`consumes`/`calls`/`ui` from the steps** (Opus). Fable, Gemini and Codex keep
  the verbs: they carry the edge's direction, which steps do not. Opus's example, SET-001
  "consuming" `conversation.ProviderDisabled` only because a step checks it, stands as what the
  scenario observes.
- **Contract IDs free of their module** (Codex, rounds 2 and 3). Opus and Fable keep the module in
  the ID for readable steps; a rename is mechanical. Two rounds, one reviewer.
- **Bare member headings, `#### active`** (Gemini). Full IDs stay greppable tokens everywhere.
- **Slug scenario IDs** (Gemini). Numbers plus allocation tooling.
- **L008 for decisions** (Gemini). An ADR shapes the whole feature, like an uncited invariant.

## Format 2, review round 4 (Oct 28)

Same brief, on X86–X113. Fable 5.1, Opus 5.5 and Codex gpt-6-astra reviewed; Gemini 4 Argon's
quota was spent, so Gemini 3.8 Flash took its place. All four: keep the structure. Fable: "close to
the best reasonable option"; Opus and Codex each named one semantic gap to settle before adoption,
and both named the same one. The acceptance test as before. Every claim below was reproduced in the
code before it was accepted; `tests/core/format2-review4.test.ts` was 16 of 17 red before.

**X114. `observes:`, and each verb is checked against where it is cited** (Opus, Codex). L008 made
every contract a step names appear under some verb, and nothing checked the verb, so the verbs
mixed "the code uses X" with "the test sets X up". Verified in chat-mini: CNV-001 and CNV-003
`read` `settings.ApiKey`, but no code of theirs touches a key (only `providers/stream.ts` and
`settings/providers.ts` do); SET-001 `consumed` `conversation.ProviderDisabled`, which only its
Then checks. The derived module graph was complete, 6 of 6 edges, two of them test setup. Opus
showed the harm: rewrite CNV-003's link as `writes` and lint stayed clean, while impact put CNV-003
under Must change and the gate refused an unrelated ticket.
- `observes` takes any kind and means: a scenario sets it up or checks it, the code does not use
  it. Impact re-verifies observers like readers, so test reach is unchanged (round 3 added those
  `reads` links for exactly that reach); the module graph leaves them out (now 4 edges).
- L008 checks the verb against the step that cites the contract (And and But take the keyword
  before): `writes`, `emits` in a Then; `consumes` in a Given or When; `provides` in the When;
  `calls` in the When or Then. Opus proposed `consumes` in a When only and `calls` in a Then only.
  `_base` consumes an event in a Given ("Given alpha.WidgetMade was emitted"), and round 2's
  operation test calls one in a When ("orders it through alpha.MakeWidget"), both honest, so both
  were widened. Across both fixtures and all four reference patches the check flags exactly
  SET-001, as Opus predicted by hand.
- The check reads every step's own text: a scenario's cites keep only an ID's first mention, which
  hid SET-002's Then behind its Given.

**X115. An invariant says what it applies to** (Fable, Opus, Codex; deferred in round 3).
`Applies to: settings.ApiKey.secret` makes an `applies` link (L004 checks it). Impact on a contract
reaches the invariants that apply to it, with the scenarios that show them: `impact
settings.ApiKey.secret` now lists INV-002 with CNV-001/S2, CNV-003/S2 and PRV-001/S3, the three
secrecy checks, whatever links the features carry. A brief that quotes the contract quotes the
invariant too, so the next feature that writes a quantity sees the constraint. Settled now because
X114 removes the workaround links that carried this reach.

**X116. Every invariant is shown by a scenario** (Opus, Codex). As rules (X107): a scenario shows
an invariant by citing it or a rule that cites it; one no scenario shows is a warning (L025); one
that changes while none of its scenarios does is refused at the spec stage. Codex reproduced the
gap: an invariant changed from "at least 1" to "at least 3" passed lint, the spec stage and the
tester stage with no scenario changed. dart-mini's INV-001 (money is whole cents) was shown by no
scenario; CRT-002/S1 now cites it.

**X117. One type per member; a literal is never a reference** (Opus, Codex). Two `Type:` lines on
one member linted clean, and a merge of two branches leaves exactly that. `Type: "vendor.Cancelled"`
made a `uses` link to a contract that does not exist, since references were read with the prose
regex; they now come from the type tokenizer.

**X118. Removed is final** (Codex reproduced). A removed type set back to `active` with new
contents passed lint and the spec stage. The delta now lists it with the unretired numbers, and
check-report refuses it: a new unit takes a new ID.

**X119. External modules** (Fable, Gemini; Codex as a per-contract `Origin:`; Opus). `external:
true` on `_module.md`: another system's contracts, as this product uses them. It holds no features
(L001); no feature provides or emits its contracts (L004); its operations need no provider here
(L012) and the module is not listed by `gaps` as missing features. Before, a call to a payment API
either warned forever or got a fictional provider feature. Module-level rather than per-contract:
the boundary is a system, and it keeps `<module>.<Name>` IDs meaning "who owns it".

**X120. An ID in prose must exist** (Opus). L026, a warning: an ID in a description, Out of scope,
a module or an ADR that names no unit. Still no link (X90). Ticket IDs, quoted literals and
headings are not checked.

**X121. A native type's fix never changes its meaning** (Codex). `Optional<T>` was answered with
`T?`, though Python's `Optional` is nullable; the fix now names both readings. `Set<T>` keeps its
uniqueness as a rule, and `void`/`undefined` say what `null` stands for.

**Deferred** (additive, or tooling): a `unit` output distinct from `null` (Codex; `Output: null`
alone cannot be mistaken for nullable data); members tied to `Code:` parameters (Opus; Codex holds
`Code:` is a binding hint, not a signature, and the two disagree); `Type:` on its own line (Opus;
mechanical later); member paths, `Stored:` entities, `json` primitive, schema bindings, screen
navigation, an `Output:` error tied to its provider's `emits`; the layout and merge tooling: one
file per contract by default, block-style YAML lists, ID
allocation across branches.

**Rejected, with the reason:**
- **Contracts that move module keep their ID** (Codex). Third round, one reviewer; Opus and Fable
  keep `<module>` meaning the owner, and a move is a tombstone plus a new ID.
- **Inline objects for one-off parameter bags** (Gemini). Reverses X96, which three reviewers
  backed: an inline key has no ID impact can follow.
- **YAML keys instead of the ` · ` meta line** (Gemini; Fable in round 2). Cosmetic, and every
  writer copies the line from an example.
- **`index.md` ignored by git** (Gemini). It is the browsable view in a PR, and `spec merge`
  already rebuilds it instead of merging it (X84), so its conflicts need no person.

## Format 2, review round 5 (Oct 28)

Same brief and reviewers (Gemini 3.8 Flash again), on X86–X121. All four: keep the structure.
- **Fable:** "fundamentally right and should be adopted as it stands"; only member naming to
  settle first.
- **Codex:** "right, with a few semantic changes", most of them additive.
- **Opus:** "right, with changes", and wants two of them settled before adoption.
- **Gemini:** mostly repeated proposals rejected earlier.

The proposals no longer agree with each other: where one reviewer asked for a rule, another
argued against it. Every claim below was reproduced first; `tests/core/format2-review5.test.ts`
was 5 of 5 red before.

**X122. Impact follows a feature's outputs through the types they shape** (Codex reproduced).
PRV-002 rewritten to write `conversation.DeliveryMeta.*` directly linted clean, but `impact
PRV-002` stopped reaching CNV-003, which reads `conversation.Message`: impact on a contract
followed `uses`, impact on a feature did not. Now both do.

**X123. A quoted string in a step is data** (Codex reproduced). `Then the exported text is
"vendor.Cancelled"` cited `vendor.Cancelled`. Quotes in steps and their tables or fences are now
values, as in types (X117) and prose (X120). Nothing in the fixtures or reference patches quoted
an ID it meant to cite.

**X124. An operation may pass an external error on** (Codex). X119 forbade `emits` of any
external contract, so an operation of this product that returns a declined charge to its caller
could not say so. Emitting an external error is allowed now; an external event or operation is
still the other system's to produce.

**X125. `Shown by:` on an invariant no scenario can show** (Fable; Opus raised the same gap). A
latency budget or an accessibility review warned under L025 forever. `Shown by: the load benchmark
in CI` says how it is checked instead, and silences L025.

**X126. One member casing per spec** (Fable, the one item Fable put before adoption). FORMAT.md
promised members "spelled as the code spells it", which a spec shared by a Dart client and a Go
backend cannot keep, and member IDs never change. The conventions template now sets lowerCamel,
and each stack maps it as it maps types. Documentation only: the fixtures already comply.

**X127. Two proposals on one feature run one after the other** (Fable; Opus and Gemini found the
same collision). Scenario numbers are allocated per feature, and the reference patches for
PROP-201 and PROP-202 both add `SET-001/S4`. The planner ran them apart only because PROP-201 also
changes a type. Bugs and tasks add no scenarios and still share features. WORKFLOW.md said
otherwise and is corrected, as are its brief-size claim (Codex) and FORMAT.md on tombstone
frontmatter and on `spec merge` rebuilding `index.md` (Fable). Gemini's claim that a conflict in
`index.md` stops `spec merge` is wrong: `src/cli/merge.ts` rebuilds it.

**Deferred** (additive, or tooling):
- **Format additions:**
  - member paths, `conversation.Message.meta.stopReason` (Opus, Codex; X122 fixed the traversal
    defect that came with it);
  - typed example attachments checked against their contract (Codex);
  - `Fails with:` on operations (Codex);
  - `Key:` and `Stored:` on entities (Opus, Fable);
  - screen navigation (Fable, Gemini);
  - member constraints (Gemini).
- **`Code:`:** Opus and Fable want opposite things. Opus wants it on every contract, with members
  checked against the code; Fable wants it to name a symbol only, possibly once per stack.
- **Tooling:**
  - ID reservation at `ticket start` (Opus);
  - contracts compared by substance in the delta (Fable);
  - a warning for answered questions left in spec units (Opus);
  - `features/removed/` (Opus).

**Rejected, with the reason:**
- **Every scenario names its trigger** (Opus, reopening X108). Opus's evidence is real: 13 of 19
  chat-mini scenarios start from an uncited When, and the reference patches add operations for new
  actions only. But no other reviewer backed it, Fable cited X108 against it, and a trigger is
  modelling the project can choose. The tester's stub rule does not depend on it.
- **One owner per contract, as a warning, and `## Owns` derived** (Opus). Fable considered and
  rejected the same warning: chat-mini would need an operation for every provider→message write,
  the ceremony X108 declined. `## Owns` is the only place a module's intent is written.
- **Relative member headings, block-style YAML lists, ASCII meta separators** (Gemini). Each was
  rejected in an earlier round. This round Fable and Opus reject block lists again, since two
  insertions at one point conflict either way.

## Format 2, review round 6 (Oct 28)

Same brief and reviewers, on X86–X127. All four: the structure is right.
- **Fable:** "adopt format 2 now", and none of its findings changes an ID or a link meaning.
- **Gemini:** "converged on the global optimum".
- **Codex:** "close to the best reasonable general-purpose foundation"; what remains is evidence
  and conformance, which is additive.
- **Opus:** right, with two format items to settle: `Code:` (accepted below) and a required
  `Key:` (deferred).

Everything below was reproduced first. `tests/core/format2-review6.test.ts` was 7 of 7 red before.

**X128. `Code:` names a symbol, never a signature** (Fable in round 5, Opus now; Codex calls it
a navigation hint, which a symbol satisfies). `providers.StreamReply` had a five-argument
`Code:` line and one member; dart-mini wrote AddItem's parameters twice. A `(` in `Code:` is now
L001, and the tester calls the symbol with the members as its arguments, in order. The fixtures,
the three reference patches that added `Code:` lines and the `spec-init` example drop their
parentheses. This settles round 5's deferred split between Opus and Fable.

**X129. A contract's shape fits its kind** (Fable and Codex reproduced; Codex's `cart.Line` with
both `Type: string` and its members linted clean). A `type` is a `Type:` expression or a record of
members, never both; an `entity`, `event` or `error` is its members; an `operation` is its
members and an `Output:` (L022). Both fixtures already comply.

**X130. A removed module holds no live units** (Fable reproduced: lint clean and the gate ready
with ALP-001 active in a removed module). A live feature or contract in a removed module is L005,
an error; in a deprecated module, a warning; the gate refuses work there.

**X131. One feature provides an operation** (Fable reproduced: two providers linted clean). A
warning under L012, because an operation can move between features through a deprecation window.

**X132. A prose ID counts only with this spec's prefix** (Fable). `SHA-256` and `ISO-8601` made
round 4's L026 warn. Feature-shaped names now count only with a registered module prefix.

**X133. A screen's states and copy are behaviour; its layout is not** (Opus and Codex: changing
UI-001's copy, while PRV-002/S1 kept the old literal, passed every stage). As rules (X107) and
invariants (X116): a screen whose states or copy change while no scenario citing it does is
refused at the spec stage. Codex warned against forcing scenario edits for visual changes, so a
change to `## Layout` alone is a rewording, listed in briefs, with nothing asked of the scenarios.

**Deferred** (additive, or tooling):
- **Format additions:**
  - `Key:` on entities (Opus wants it required now; Gemini wants it optional);
  - `Persistence:` or `Stored:` lines (Gemini, Opus);
  - member paths (Opus, Codex, Gemini, all agreeing they are additive);
  - typed example attachments and `Schema:` bindings (Codex, Gemini);
  - a `Shown by:` that names a registered check (Codex);
  - step continuation lines (Fable);
  - `navigates_to:` (Gemini; Fable argues a flow is a scenario citing screens, with no new key).
- **ID reservation across tickets** (Opus). Opus reproduced two proposals on different features
  both creating `PRV-004`: `plan` ran them together, git merged both files, and lint then found
  L003. Proposals that share a feature already wait (X127); this needs a reservation on the ticket.
- **Tooling:**
  - scenario-to-test coverage in `lint --ci` (Opus);
  - an identifier-safe `{filter}` for Go and pytest (Opus);
  - member casing as a config value lint checks (Opus);
  - `spec migrate` (Opus);
  - `spec fmt --fix` for frontmatter links (Gemini);
  - questions on contracts found by their `cites` (Fable).

**Rejected, with the reason:**
- **`Key:` required on every entity, now** (Opus). It changes what `entity` means, and Opus's
  argument is right that it would need a person per entity later. But only Opus asks for it now,
  Gemini proposes it as optional, and neither fixture shows a defect it would catch. Additive
  as optional.
- **Rejecting dotted references longer than a member** (Codex). Today `Message.meta.stopReason`
  in a step is read as a cite of `Message.meta`, which is broader and so safe. Opus points out
  that this is what keeps member paths additive.

**The reviews have converged.** Two rounds in a row, no reviewer has found a defect that needs a
format change a person would have to migrate unit by unit. Every remaining proposal is additive,
tooling, or contested between reviewers.

## Format 2, tested on real code (Oct 28)

The reviews were models reading docs. To check the format itself, it was used:
- **Real code:** `/spec-init` adopt mode on a slice of astro (the ticket lifecycle: TS engine and
  sidecar, Dart wire models, Flutter UI), once by Haiku xhigh and once by Codex luna max. An Opus
  auditor then checked both drafts against the code.
- **New products:** a full spec of "Grocer" written from scratch by both models. Grocer is a
  made-up brief with roles and permissions, offline sync, async Stripe webhooks, seven screens,
  non-functional requirements and a data migration.
- **Format judgment:** four eval cases that make a spec-writer use `observes`, `Applies to:`,
  `Shown by:` and an external module.

**X134. The steps state a feature's links; the frontmatter lists only `writes`, `provides` and
`observes`.**
- **Measured:** 416 hand-written links across seven specs (both fixtures, `_base`, both astro
  pilots, both Grocer specs). Verb was predicted from the contract's kind and the keyword of the
  steps citing it.
  - Only three verbs carry a fact no step position can: `writes` (a Then checks a write and a
    read alike), `provides` (implementing versus calling) and `observes` (test versus code).
  - With those written, the other four were predicted with no error.
  - Since X114 fixed each verb to a step position, writing them was typing that lint policed.
- **Derived:**
  - `reads`: any other entity or type a step names;
  - `calls`: any other operation;
  - `consumes`: an event or error a When names, or only a Given;
  - `emits`: one a Then names, with no When.
  - A contract the feature writes and also names in a Given or When is read as well
    (read-modify-write). Named only in a Then, it is the write being checked.
- **Checked:**
  - Removing 107 link lines from 61 features of the four real specs left lint identical.
  - Impact on every contract, feature and invariant (748 targets) was identical, or broader with
    a reason. Each broader case is a read the author left out, such as SET-001 reading
    `providers.ProviderConfig` before toggling it.
  - Narrower only where the steps cite a member and the hand-written link named the whole entity.
    That was the audit's complaint about Codex's draft.
  - Two first versions of the rule were wrong and caught by this comparison: a written member
    hid a read of the whole, and the read-then-write rule fired for events.
- **Agents:** on the prototype, the 22 existing cases passed (Haiku 110/110, Codex 109/110), and
  both models still chose `observes` correctly in every trial of the new case. Ported to the repo,
  the full suite of 26 cases passed 130/130 on both harnesses (RESULTS).
- **Reverses** round 3's rejection of deriving links. That rejection held because direction was
  not in the steps; X114 put it there.
- **Old specs:** a hand-written derived verb still works (a written link wins) and warns (L001).
  The four keys are deleted from the fixtures, `_base`, the lint cases and the reference patches.

**X135. What the pilots found missing from the instructions.**
- `/spec-init` gains complete examples: a `_module.md`, a screen, invariants with `Applies to:` and
  `Shown by:`, and questions in a unit's frontmatter. Without them both pilots learned module and
  screen shapes from lint errors, and put every open question on a separate ticket, where
  `spec gaps` does not count it.
- `/spec-init` now mentions step tables. Haiku's Grocer called a seven-transition step awkward
  because "the format has no table form"; it has had one since X110.
- It also gives the screen-flow convention: a flow is a scenario citing each screen. Haiku's
  Grocer had invented an `app` module for navigation.
- **The spec-writer role:**
  - names `Shown by:`: the non-functional case went from 0/5 to 5/5 on both models;
  - names external modules.
- L002's fix pointed at an ID-pattern section of `core/conventions.md` that format 2 removed. It
  now gives an example of each ID kind.

**X136. Eval cases for the format's judgment calls.** `spec-writer/observes-a-check` (SET-002's
scenario checks another feature's error), `invariant-applies`, `nonfunctional` and `external-api`.
Their graders (`links`, `new_invariant`, `external_module`, `lint_never`) were proven on a reference
answer and a wrong one each before any model ran. The first `external-api` ticket sent chat replies
to DeepL; agents blocked it because INV-001 forbids sending a conversation to anyone but an enabled
provider, which was the right call. It now uses an exchange-rate API on dart-mini.

**What the audit of the astro pilots found** (about 20 of 24 checked scenarios right in Haiku's
draft, 16 of 18 in Codex's; Haiku's adoptable after about a day's confirmation pass):
- **Fixed by X134:** "no link verb for an operation's result". When a step names an operation's
  output, lint demanded a link, and drafters wrote `writes` (false) or `observes` (a workaround).
  It is now a derived read.
- **Deferred, additive:**
  - `Code:` that names a dispatcher entry point with a selector, and may repeat for a host layer
    and a store layer. Both pilots pointed testers at handlers they cannot call.
  - Impact that reaches a screen through its features' `ui:` links, not only its `shows:`/`calls:`.
  - A lint hint for template text left in `core/*.md`.
- **Deferred, larger:** impact classified by kind of change, so a type's shape change makes its
  readers "must change", not "re-verify".

**X138. Claude Code is a repository plugin; each project pins its CLI at `.spec/bin/`.**
- **Layout.** This repository exposes a `spec` marketplace at `.claude-plugin/marketplace.json`
  and the plugin at `plugin/`. The plugin provides skills and hooks and commits its own launcher
  and bundle under `plugin/scripts/`.
- **Project install.** `spec init` copies the running launcher's pair into `.spec/bin/spec` and
  `.spec/bin/spec.cjs`, compiles agents against `.spec/bin/spec`, and merges CLI permission rules
  plus `enabledPlugins: { "spec@spec": true }` into `.claude/settings.json`. The plugin, not the
  project settings, supplies skills and hooks.
- **Why pin it.** A project can run `.spec/bin/spec lint --ci` in CI without Claude Code; Astro and
  other harnesses likewise need no plugin. `.spec/bin/spec` and `.spec/bin/spec.cjs` are committed
  in projects. The plugin CLI defers ordinary project commands to the pinned copy, so hooks use the
  version the project chose. A newer plugin session-start reports
  `spec plugin <new> is newer than this project's <old>: run .spec/bin/spec upgrade`.
- **This repository's own copy.** The self-hosted `.spec/bin/` is tracked; afterMerge never rewrites
  it, so merges do not dirty the base checkout. A normal build refreshes the root pair with plugin
  artifacts; commit the generated pair in the same CLI change.
- **Upgrade source order.** `spec upgrade [<repo>]` chooses `--from <dir>`, `$SPEC_PLUGIN_ROOT/scripts`,
  the running plugin launcher when it is not the target project's own `.spec/bin/`, the newest
  eligible `spec@spec` entry in `~/.claude/plugins/installed_plugins.json` (scope `user` or
  `projectPath` resolving to the target repo, ordered by `lastUpdated` with `installedAt` as fallback), then a non-plugin
  running launcher unless it is the target project's own copy. It reads versions by running launchers with
  `--version`. With no external source, it prints the absolute running launcher path and asks Claude
  to run it from a session. It refuses downgrades unless `--force` is given.
- **Old-layout migration.** `spec init` and `spec upgrade` recognize only skill folders with a
  `skill.json` containing `specRoot` or a `scripts/spec.cjs`. They remove old generated skills, hooks
  and permission rules only when their content matches the old generator. Edited or unknown files
  are retained and reported; migration preserves config formatting and recognizes the old bundle fingerprint.
- **Compatibility.** Before an old-layout project has `.spec/bin/spec.cjs`, plugin hooks are quiet
  except for a session-start migration instruction. Root resolution still checks older
  `.claude/skills/<slug>-spec/skill.json` pointers and skill folders with `config.json`.
- **Build reproducibility.** `npm run build -- --out <dir>` writes plugin artifacts to an isolated
  output directory without changing tracked files; tests compare that output byte-for-byte with
  the committed plugin package. A normal build refreshes the committed root pinned pair too.

## Session-driven pipeline

**X137. The main session drives pipeline stages through harness delegation.** `spec next` returns a
self-contained task and the main session delegates it with the configured role model; the final
message returns through `spec ticket advance --report-file` or stdin. This keeps each run visible in
the active session, works with any harness rather than only Claude Code's hooks, and permits a model
per role and harness. The `delegation` map and gitignored local override are excluded from the spec version because they select harness/models rather than authored behaviour. X139 removes headless dispatch and compiled agents.

**X139. Remove headless dispatch/orchestrate and compiled agents.** X137 makes the main session the
stage driver, so there is no need for the CLI to start `claude -p` or to compile per-project role
agents. For one or many tickets, `spec next` lists startable work (and `--start` prepares each
worktree); the session delegates each returned task, including several in the background, records
reports with `spec ticket advance --report-file`, and merges explicitly with `spec merge`.
`dispatchCommand` and the old size-based `models` selector stay accepted only for old config files and produce L028 warnings that they are ignored. The old
`before-delegate` and `before-finish` hooks silently no-op so settings from older pins remain safe;
new plugin installs keep only `session-start` and `after-edit`. Init/upgrade remove a legacy
`.claude/agents/<role>.md` only when its contents exactly match the legacy compiler, and report
edited files without deleting them. The overseer brief and role prompt are removed; `overseer` remains
only as a legacy `raised_by` ticket value. After the session confirms no subagent is still running, it
may recover an abandoned in-progress stage with `spec next <ID> --restart`; that clears any kept
refused report and resets the stage's refusal budget.

**X141. Setup inspects the current repository and stays session-driven.**
- `spec detect --format json` runs from the plugin CLI before a project spec exists. It reports empty/code/spec/legacy-spec state, dirty Git state, the default branch when known, detected stack manifests and their test/path/worktree defaults, and the supported current harness when known. It does not ask for a repository path.
- `spec init --stack` fills the project config from the same stack defaults; Node selects vitest or jest from `package.json`. Unsupported report formats get an explicitly failing placeholder until the user sets a compatible test command, rather than a silent no-tests success.
- `spec config set` permits only named setup keys and nested delegation models. It validates the resulting config and makes a minimal textual JSON edit so existing formatting and key order survive; `--local` can only write delegation to ignored `config.local.json`.
- Claude Code delegation defaults accept only sonnet, opus, haiku or fable; full model IDs and `inherit` are rejected. Astro model values are free-form delegate role names. A custom harness key requires `--force` and remains lint-warning eligible.
- Model setup is required, not advisory: `detect` and delegate entries report `missingModels` for every role without a model under the active harness, and setup asks for each default before continuing. Shared choices are written to config.json; personal choices use config.local.json. CI lint warns when a current-format spec has no configured harness entries and when any configured harness is incomplete; L031 points local-only teams to config.local.json.
- `/spec:run` lists the safe `spec next --summary` wave, starts only what the CLI returns, and uses the full tasks from `spec next --start` as the first delegate entries. Ticket skills pass an explicit `--harness`; the session records each subagent's final message and merges only after the CLI returns `merge`. There is no headless dispatch or `orchestrate` command.
- Claude Code settings add the actual worktree parent to `permissions.additionalDirectories`, plus `Skill` and the detected stack's test/build command rules, without removing existing permissions. `spec next` returns a relative project CLI for worktree use and a relative main-session advance command that runs from the project root.
- **Verified 2026-10-31, Claude Code 2.1.311 (headless, real plugin copy).** SessionStart ran and injected the queue. The setup `! printf` pre-run was denied, and an absolute plugin CLI invocation required approval; setup filters `spec@spec` records to scope `user` or `projectPath` resolving to this repository, chooses the newest eligible entry by `lastUpdated`, falling back to `installedAt`, and asks once to run `"<installPath>/scripts/spec"`. On Astro without a Claude Code plugin installation, setup asks the user for a CLI path. Headless Claude Code ignores project settings until the user accepts the project trust prompt in an interactive session. After trust, with `permissions.additionalDirectories: ["../<repo>.worktrees"]`, a subagent can `cd` into a ticket worktree and relative `.spec/bin/spec …` matches `Bash(.spec/bin/spec *)`; an absolute worktree CLI does not.
- **Verified 2026-10-31, Claude Code 2.1.311 (headless, background subagents). G1/G2:** In `default` permission mode, a general-purpose subagent in a sibling worktree with `permissions.additionalDirectories` was denied Edit and Write; `acceptEdits` allowed them. With `additionalDirectories: ["../<repo>.worktrees"]`, a Write in the ticket worktree was allowed, a Write outside the project/worktrees was denied, and reads outside the working directories were denied. `permissions.defaultMode: "acceptEdits"` in `.claude/settings.local.json` takes effect (verified via `--settings`; automatic loading assumes project trust). Bare `Edit`/`Write` allow rules also worked but permitted writes outside the project and worktrees, so never add them. This setting also changes the person's own main session in this project. Base-branch edits are guarded by hooks only when enforcement is installed (`.spec/bin/spec verify-history` exists); otherwise they are not blocked, so setup tells the person to ask before editing there.
- **Verified 2026-10-31, Claude Code 2.1.311 (Agent tool input validation). G2:** Agent `model` accepts only `sonnet`, `opus`, `haiku` or `fable`; full model IDs such as `claude-haiku-4-5`, `inherit` and `opus-4` are rejected. Setup and `config set` use exactly those four values for Claude Code; Astro model values remain delegate role names.

**X142. Background subagent edit permission was verified in Claude Code 2.1.311 on 2026-10-31.** See X141 G1/G2: `.claude/settings.local.json` `permissions.defaultMode: "acceptEdits"` permits sibling-worktree edits when the project is trusted, and writes outside the project and worktrees are denied; broad bare `Edit` and `Write` allow rules are unsafe because they permit writes outside those directories.

**X140. Spec enforces the ticket workflow at edits, commits and history, with a recorded one-commit bypass.**
- **Edit guard.** On the base branch, the before-edit hook denies changes to `codeGlobs`, `testGlobs`, `protectedGlobs`, the spec root and ticket directory, and points at `/spec:feature`, `/spec:change`, `/spec:bug`; a Git-check failure in a worktree denies governed paths with a message to fix spec or ask the person whether to open a bypass. A project without Git metadata or a bare repository has no editable base, so governed edits are allowed and session-start emits no hook-health warning. Detached HEAD is compared with the configured base tip. An unborn base branch at the project root and the interval after init but before its setup commit are still the project's base and deny governed edits. A nested project is identified by spec-managed hooks/bypass state in the common Git directory, a resolvable `enforceSince`, or a working config when the parent already tracks files under that project path; a parent tracking nothing under a copied project remains unrelated. In a ticket worktree, it confines edits to that tree. Astro and Claude Code path payloads use the same guard. Shell writes are not parsed; in Claude Code `acceptEdits`, filesystem Bash commands may write without an edit-time hook, so the installed commit/merge hooks and verify-history are the guard.
- **Git guard.** Init and upgrade install `pre-commit`, `pre-merge-commit` and `commit-msg` in Git's resolved hooksPath (normally the common hooks directory), preserving project-owned hooks. A base-branch commit touching governed files is refused unless it is a valid `spec merge`/afterMerge commit or has an active bypass ADR staged with it. Spec-owned commits use a one-time project marker in `<git-common>/spec/commit-token`, mode 0600, fresh for under 60 seconds and bound to purpose plus staged paths; the pre-commit hook consumes it. The marker is not a security boundary; CI history verification and review are the enforcement. There is no environment-variable merge marker. `ticket new` commits only `tickets/<ID>.md` with `Spec-Ticket: <ID>`.
- **History.** `spec verify-history [--since <ref>] [--base <ref>]` checks first-parent base commits after `enforceSince` (init records current HEAD); without `--base` it resolves the configured local base, `origin/<base>`, then HEAD, and rejects shallow clones (GitHub Actions needs `fetch-depth: 0`). A ticket trailer is valid only when its ticket file exists in that commit and the commit is a ticket-file-only filing/update, a two-parent merge that carries the ticket file unchanged from its second parent as done (it was not-done at parent one and is used by no earlier base merge), or that merge's same-ticket afterMerge child touching only generated paths. Every governed side commit in a ticket completion merge must independently carry the same `Spec-Ticket: <ID>`. Each governed path a two-parent merge changes from parent one must match `git merge-tree`, except generated paths; every diff reader used for enforcement, reviewer context or added-line reports disables rename/copy detection so a rename out of governed globs still includes its governed source. Git before 2.38 uses conservative parent-tree equality and requires a bypass when both parents changed. A valid bypass ADR added in that merge commit authorizes a deliberate hand resolution or extra content. A trailerless two-parent `git pull` merge is accepted only when every governed incoming commit independently validates as a ticket-only update, a ticket completion merge with same-ticket side commits, or a one-use bypass commit. Its hook validates only incoming commits; older first-parent offenders do not block a clean pull, but `spec verify-history` continues reporting them. Squash, fast-forward and `git pull --rebase` ticket delivery is unsupported because it rewrites completion evidence. History catches missing evidence and casual forgery; a fabricated side branch with forged trailers is left to review. `CI=1` does not disable `spec verify-history`. A bypass trailer is valid only for a `kind: bypass` ADR added in that same commit and not cited earlier on first-parent history. Upgrade and lint warn when `afterMerge` is configured with empty `generatedGlobs`; history only authorizes afterMerge commits touching generated paths. Projects can disable edits, commits or history; `enforce.bypass: "person"` is a workflow policy, not a security boundary.
- **Bypass.** `spec bypass "<reason>"` creates the next free accepted ADR under `decisions/`, reserving IDs used on local `ticket/*` branches. It cannot be opened from a ticket worktree. An agent needs `--approved-by-person` after the person approved in-session; the ADR records the harness and Git user. A terminal with no agent environment records `Opened by: <user> (no agent environment detected)`. The person-only policy and approval signal are process markers, not security boundaries; CI history verification and review are the enforcement. One bypass is active in the common Git directory, lasts until a governed base commit stages that ADR or one hour passes, and `--status`/`--cancel` inspect and clear it. Init and upgrade do not pre-open it.
- **Session context.** Session-start gives the main session three workflow lines and one line of queue counts, never the full queue (at most eight lines including plugin/migration hints). It is silent in subagents and ticket worktrees. Init and upgrade put the same marked rules in `CLAUDE.md` and `AGENTS.md` for harnesses without hooks.
- **This repository's integration.** To merge `plugin-integration` into `main`, use a `spec merge`-style two-parent merge with a bypass ADR for its governed side commits, or move `enforceSince` to the intended integration baseline before landing; do not squash or fast-forward the branch.

**Why.** Session-start's 10,000-character queue is redundant when the main session can ask for it and harmful to subagents; the only useful startup facts are the workflow and counts. Prompt instructions and spec-owned hooks/markers are process aids, not security boundaries; CI history verification and review are the enforcement. An emergency bypass must leave an auditable ADR and trailer and be short enough that it cannot silently become a permanent exception.

