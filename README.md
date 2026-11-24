# spec — a project specification and Claude Code plugin

A project specification stored as a graph of small units with stable IDs, plus the `spec` CLI that
lints it, computes the reach of any change, refuses work without a clear path, builds a small
brief for each role, and checks and records every stage. The core is harness-neutral; the Claude Code
plugin provides hooks, while the session-driven `/spec:run` workflow delegates through Claude Code
or Astro.

## Install and use

spec is listed in the happyface marketplace (happyfacedev/happyface-plugins), which lists every
happyface plugin. Add it once and install spec:

```text
/plugin marketplace add happyfacedev/happyface-plugins
/plugin install spec@happyface
```

A project whose `.claude/settings.json` registers the happyface marketplace (`spec init` and
`spec upgrade` add it) offers it once you trust the project; then
`claude plugin install spec@happyface --scope project` installs spec for that project.

Claude Code updates a plugin only when auto-update is on, and it is off for this marketplace by
default: turn on auto-update once under /plugin > Marketplaces > happyface, or ask an admin to set
`autoUpdate` in managed settings. The plugin has no version, so every push reaches you.

Then open a repository and ask Claude: "set up spec on this repo". The setup flow detects the current
repository, installs spec and helps you build its initial specification. See
[the setup guide](plugin/skills/spec/SKILL.md).

**Status (2026-11-10).** The CLI supports the commands listed below and in `spec --help`.
The session prepares work with `spec next`; `/spec:run` delegates its tasks through Astro when the
Astro delegation tool is available, or through Claude Code otherwise. The session records stage
reports with `spec ticket advance` and merges explicitly with `spec merge` (DECISIONS X137, X139).

**Historical validation snapshot (October 2026).** M0–M8 and format 2 had been completed, followed
by test-first pipelines and parallel tickets. At that point, 24 role and command evals passed 120/120
trials each on Claude Code with claude-haiku-5-5 and on Codex with gpt-6-luna; 16 spec probes
answered as the spec decided; PROP-201 went from its ticket ID to a green branch through real Claude
Code; and two independent tickets ran in separate worktrees and merged clean. These are dated
results, not current evaluation claims.

- [docs/WORKFLOW.md](docs/WORKFLOW.md): day-to-day use on any stack.
- [docs/FORMAT.md](docs/FORMAT.md): the spec format (format 2), and how to migrate from format 1.
- [docs/TICKETS.md](docs/TICKETS.md): the ticket format, and the protocol that links any tracker.
- [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md): dated findings from spec specifying and building
  itself, including the 2026-11-10 review.
- [RESULTS.md](RESULTS.md): what each milestone showed. [DECISIONS.md](DECISIONS.md): every
  deviation from the handoff, and every decision since.

## Use

```sh
npm install
npm run check                      # typecheck, eslint, vitest, build

R=fixtures/chat-mini/spec
./dist/spec lint --ci --root $R    # validate spec + tickets; exit 1 on errors
./dist/spec build --root $R        # write index.md (committed) and _generated/graph.json (not)
./dist/spec show PRV-002/S3 --root $R
./dist/spec find fallback --root $R
npm run spec -- lint --root $R     # same CLI from source, no build
```

The root comes from `--root`, then `SPEC_ROOT`, then an older skill folder pointer, a project `.spec/bin/spec` launcher, or the nearest `spec/config.json` above `CLAUDE_PROJECT_DIR` (or the current directory), bounded by the Git top-level (or an ancestor `CLAUDE_PROJECT_DIR`).
Every command takes `--format json` and prints one JSON document, except `brief` and `hook`, which print text.

| Command | State |
| --- | --- |
| `build`, `lint`, `show`, `find` | done (M1) |
| `impact` | done (M2) |
| `gate`, `queue`, `ticket start` | done (M3) |
| `brief` | done (M4) |
| `check-report`, `ticket advance [--report-file|--report -]` | done (M5) |
| `hook claude-code`, `init`, `upgrade`, `test` | done (M6) |
| `plan`, `next`, `worktree`, `ticket answer` | done (after the PoC) |
| `ticket new`, `merge`, `gaps`, `confirm`, `bypass`, `verify-history` | done; behind the `/spec:spec-init`, `/spec:feature`, `/spec:change`, `/spec:bug` commands |

## Layout

```text
src/core/        pure: ids, schemas, markdown, parse/, units, graph, lint/, show, find
src/io/          file loading, root resolution, workspace, git, ticket stores
examples/ticket-adapters/  a complete tracker adapter to copy
src/cli/         argument parsing, commands, output
scripts/build.ts esbuild → dist/spec.cjs + dist/spec launcher; also writes the committed plugin bundle and skills
plugin/          Claude Code plugin manifest, hooks, skills and scripts/spec + spec.cjs
.spec/bin/       committed pinned CLI for this repository and every installed project
fixtures/chat-mini/spec/                       the fixture spec
fixtures/chat-mini/tickets/                    the fixture tickets
fixtures/chat-mini/src, tests/                 the sample app: one visible test per scenario
fixtures/dart-mini/                            a plain Dart sample: test-first with SPEC-STUB stubs
evals/hidden/chat-mini/                        hidden tests (never shown to a role)
evals/reference/                               reference patches per ticket stage
tests/fixture-app.test.ts                      keeps the sample verifiable (scenario ↔ test, BUG-301)
tests/core/      unit, fixture snapshot and lint-case tests
tests/cli/       CLI wiring through run()
tests/dist.test.ts  the bundle under every package.json "type"
```

`src/core` has no file system, process, network or clock access; ESLint enforces it.

## Evals (live, through headless Claude Code)

```sh
npx tsx evals/runner.ts [--case <substring>] [--trials n] [--parallel 4]   # layer 3: role evals
npx tsx evals/runner.ts --harness codex --effort max                       # the same cases on Codex (gpt-6-luna)
npx tsx evals/probes.ts                                                    # spec clarity probes
evals/e2e/run.sh                                                           # layer 4: session task-handoff smoke
npx tsx evals/record/record-hooks.ts                                       # re-record raw hook payloads
npm run bench 40 50                                                        # scale benchmark (offline)
```

They use `claude -p` with claude-haiku-5-5 (`--model` to change it) and the operator's Claude Code
login. Results go to `evals/results/`, which git ignores. Cases are in `evals/cases/<role>/`, hidden
tests in `evals/hidden/`, reference stages in `evals/reference/`, and reviewer diffs in
`evals/diffs/`.

## Lint cases

`tests/core/lint-cases/_base/` is a minimal spec with zero findings. Each `L0xx/` overlays one
breaking change and holds the reviewed findings in `expected.json`. After changing a rule, run
`npx vitest run -u`, then review the `expected.json` diff like code.
