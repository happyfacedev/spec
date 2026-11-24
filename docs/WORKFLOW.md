# Working with the spec

How a team keeps a project's spec current and lets agents build from it. In Claude Code, plugin skills are namespaced (for example `/spec:feature`); CLI commands assume the session is at the project root, where the pinned CLI is `.spec/bin/spec`.

## Install in any project

The happyface marketplace (happyfacedev/happyface-plugins) lists spec as `spec@happyface`. Add it once and install:

```text
/plugin marketplace add happyfacedev/happyface-plugins
/plugin install spec@happyface
```

A project whose `.claude/settings.json` registers the happyface marketplace (init and upgrade add it to `extraKnownMarketplaces`) offers it once you trust the project; then `claude plugin install spec@happyface --scope project` installs spec for that project. Claude Code leaves auto-update off for this marketplace: turn on auto-update once under /plugin > Marketplaces > happyface, or ask an admin to set `autoUpdate` in managed settings. The plugin has no version, so each push is a new version.

Then ask Claude to set up spec in the project. The plugin provides the skills and hooks. In Claude Code, setup reads `~/.claude/plugins/installed_plugins.json`, keeps `spec@happyface` entries scoped to the user or whose `projectPath` resolves to this repository (or `spec@spec` entries when no `spec@happyface` entry is eligible), chooses the eligible entry with the latest `lastUpdated` (falling back to `installedAt`), and runs `"<installPath>/scripts/spec" init . --name <slug> --stack <stack>` in the current repository. This is the same registry selection used by `spec upgrade`. On Astro without a Claude Code plugin install, ask for the spec CLI path. Init and upgrade install common-directory Git hooks without replacing existing hooks, and add the workflow rules to `CLAUDE.md` and `AGENTS.md`. If setup writes governed files on an existing Git branch, init reports that the first setup commit needs an explicit `spec bypass "initial spec setup"`; it never pre-opens a bypass.

This writes the spec at `<repo>/spec/`: config, core files, role prompts and the generated index. It copies the pinned CLI to `<repo>/.spec/bin/` and merges CLI permissions, `enabledPlugins` (`spec@happyface`, moving an older `spec@spec` with its value) and the `happyface` entry of `extraKnownMarketplaces` into `.claude/settings.json`. Hooks and command skills come from the plugin, not project settings. The spec stays outside `.claude/`. Accept Claude Code's project trust prompt once in an interactive session; otherwise headless runs ignore those project settings until then. Background ticket subagents cannot prompt for Edit/Write; if approved, run init with `--accept-edits` to set personal `.claude/settings.local.json` `permissions.defaultMode` to `acceptEdits`. This also changes your own main session in this project and keeps edits within the project and worktrees. When `.spec/bin/spec verify-history` exists, the before-edit and Git hooks guard the base branch; otherwise base-branch edits are not blocked, so ask before editing there. Never add bare `Edit` or `Write` allow rules.

Then edit `spec/config.json` for the stack. The test command must write
a JSON (vitest/jest) or JUnit XML report to `{report}`. `{filter}` is a scenario ID, or empty for
all tests.

| Stack | `testCommand` |
| --- | --- |
| vitest | `npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"` |
| jest | `npx jest -t "{filter}" --json --outputFile="{report}"` |
| Dart | `dart test --reporter json --name "{filter}" > "{report}"` |
| Flutter | `flutter test --machine --plain-name "{filter}" > "{report}"` |
| pytest | `pytest -k "{filter}" --junitxml="{report}"` (name tests `test_PRV_002_S1_…`) |
| Go | `go test ./... -run "{filter}" -v 2>&1 \| go-junit-report > "{report}"` (name tests `TestPRV_002_S1…`) |

Also set `codeGlobs`, `testGlobs` and `protectedGlobs`, the paths each role may change.
If your build has generated files that should never merge as text, add project-relative POSIX globs
to `generated.globs`; a conflict takes the ticket branch's copy. Add `generated.command` (for example
`npm run build --silent`) to rebuild them after such a conflict; without it nothing is rebuilt. The
older `generatedGlobs` key still works, read as `generated.globs` without a command, and lint warns
L036 about it. Upgrade the pinned CLI before adding either key: older pinned versions reject unknown
config keys. Do not list hand-written files or paths containing `.` or `..` segments.

## The spec, in one minute

- One file per feature. Behaviour is written as `### S<n>:` scenarios with Given / When / Then
  steps. Every Then states a value a test can check.
- Features connect only through contracts (`<module>.<Name>`, members `<module>.<Name>.<member>`):
  entities, events, operations, types and errors. Steps name contracts verbatim, and that links
  them: an entity or type is read, an operation called, an event or error consumed in a Given or
  When and emitted in a Then. The frontmatter lists only what a step cannot say: what the feature
  `writes`, the operations it `provides`, and what its tests only set up or check (`observes`).
- A type the spec defines is written `<module>.<Name>`, so a change to it reaches everything it
  shapes.
- Invariants (`INV-`) always hold. Decisions (`ADR-`) record why. Screens (`UI-`) are text.
- IDs are never reused. A removed scenario or rule is listed in `retired:`; any other unit stays
  as a tombstone with `status: removed`. `status: deprecated` means still served, not for new use.
- The spec holds current truth only. Planned work lives in tickets.
- [FORMAT.md](FORMAT.md) has the whole format, and how to migrate a format 1 spec.

## Day to day, in Claude Code

| You type | It does |
| --- | --- |
| `/spec:spec-init` | builds the spec with you. With no code, it interviews you. With code, it drafts the spec from the code and docs, then confirms each part with you (`spec gaps`, `spec confirm`). |
| `/spec:feature <what>` | asks until the new behaviour is clear, files a proposal, and starts it on your yes |
| `/spec:change <what>` | the same for changed behaviour; if nothing behaves differently, a task |
| `/spec:bug <what>` | finds the scenario the code breaks and files a bug; if no scenario covers it, it says it is a feature |

Everything below is what these commands do for you.

## The loop

1. **Write a ticket** in `tickets/<ID>.md`, or in your tracker (see below):
   - a `proposal` changes behaviour;
   - a `bug` names the scenario it violates;
   - a `task` changes no behaviour.
   List what it touches, and in `depends_on` any ticket that must land first. Write each open
   question as a `blocker` (it could change behaviour) or a `preference` (it has a cheap default).
2. **See its reach.** `spec impact <ID>` lists what must change, what must be re-verified and
   which scenarios are affected. `spec gate <ID>` says whether it may start.
3. **Prepare a stage for the session.** Run `spec next <ID> --harness <name>`. It starts the next
   stage in the ticket worktree and returns the task, brief, model and report path. Delegate that
   task to the harness using the returned model:
   - proposal: spec-writer → spec-review → tester → implementer → reviewer
   - bug: tester → implementer → reviewer
   - task: implementer → reviewer
   The spec review (proposals only) attacks the spec-writer's change before any test is written. It
   reads the brief's spec delta, the spec-writer's checklist and the neighbouring features, changes no
   file, and reports `verdict: approve | changes` with findings that each cite existing IDs. `changes`
   sends the proposal back to the spec-writer, with the findings in its brief, and then to the spec
   review again; after 3 rounds of `changes` the ticket blocks on a question for a person, and
   answering it grants one more round. These rounds are counted apart from the reviewer's. The spec
   review runs on `delegation.<harness>.spec-review`, else on that harness's reviewer model, so it is
   never in `missingModels`. A proposal recorded before the spec review existed, whose last done stage
   is the spec-writer, goes to the spec review next. `roles/spec-review.md` holds its prompt; a
   project without `spec/roles/spec-review.md` uses the one this version ships, and
   `spec init --update-roles` installs it.
   The tester's tests must fail before the code changes, and only the tester changes them. In a
   compiled language the tester adds stubs that throw, marked `SPEC-STUB`, so its tests compile;
   the implementer replaces every one.
4. **Record each stage from the main session.** Pass the delegate's final message to
   `spec ticket advance <ID> --report-file <path>`, using the CLI/worktree path returned by
   `next`. The report path is relative to the project root. Add `--transcript <path>` to record the
   delegate's model and cost too. If refused, send the problems back to
   that delegate and retry; otherwise run `spec next <ID>` for the next stage.
5. **When a stage is blocked,** answer or clarify the ticket's questions, then resume it with
   `spec next <ID>`; the same stage is returned. If a test was wrong, use
   `spec ticket answer <ID> <Q> <answer> --back tester` (or `--back spec-review`, `--back spec-writer`).
   If a delegate dies without reporting while the stage is in progress, first confirm no subagent is still running, then use `spec next <ID> --restart`; it stashes and restores the stage's uncommitted work before delegating again.
6. **Merge the finished branch** with `spec merge <ID>`. Spec and code changed together.

## Driving one ticket from your session

```sh
spec next BUG-301 --harness claude-code
```

Delegate the returned task in the worktree and model it names. When it finishes, write its final
message to a file and run the returned `ticket advance` command with `--report-file <path>`.
Repeat `spec next BUG-301` and `ticket advance` until `next` says `merge`, then run
`spec merge BUG-301`.

## Many tickets at once

```sh
spec next --harness claude-code          # lists tickets safe to start now, with each task and worktree
spec next --start --harness claude-code  # creates each worktree and starts every listed stage
```

`spec next` without an ID lists only tickets that can start in the current plan wave; it has no side
effects. `--start` creates the ticket worktrees and starts those stages. Delegate each returned task
in its own worktree in the background. As each finishes, pass its final message to that task's
`ticket advance --report-file` command; then call `spec next` again to see what became startable.
`maxParallel` caps how many tickets `next --start` begins at once.

- Tickets never run together when one depends on the other: through `depends_on`, or because a
  proposal changes a contract, invariant, decision or screen that the other's features use. Two
  proposals on one feature wait for each other too, since both would take the next scenario number.
- Each ticket gets `ticket/<ID>` in its own git worktree. Set `worktreeSetup` to install or link
  dependencies, for example `ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules`. What setup
  leaves untracked is recorded when the worktree is made and never counts as a role's change. Still
  ignore it in `.gitignore` as `node_modules`, not `node_modules/`: a trailing slash matches
  only folders, never the link.
- Every tree sees every ticket's live state, so `spec queue` and `spec plan` are right from
  anywhere.
- Each stage starts on the current base: when the base branch has moved, `spec ticket start` merges
  it into the ticket branch first (`<ID>: sync with <base>`). A conflict outside generated files
  blocks the ticket for a person.
- `spec merge <ID>` merges a finished branch when lint and every test pass on the merged result.
  Merge rebuilds the conflicted `index.md`; `_generated/` is not committed. One merge runs at a
  time per repository.
- Commit `.spec/bin/spec` and `.spec/bin/spec.cjs` with each project so CI and ticket worktrees
  have the same pinned CLI; an untracked local copy is copied into a new worktree. Use
  `.spec/bin/spec upgrade` after a plugin update when the pinned CLI should change; spec does not
  build your project.
- This repository's root `.spec/bin/` is tracked and is intentionally not refreshed by
  `afterMerge`. When changing the CLI here, build the plugin artifacts and update/commit the root
  pinned pair in the same change.

## Tickets in any tracker

Set `tickets` in `spec/config.json` to `{ "adapter": "command", "command": "…" }`. The command
speaks a two-operation protocol, `list` and `put`, and moves ticket text in and out of your
tracker. `docs/TICKETS.md` has the protocol, and `examples/ticket-adapters/json-file.mjs` is a
complete adapter to copy.

## Keeping the spec healthy

- `spec lint` runs on every edit, through the after-edit hook, and fixes are named per finding.
  `spec lint --ci` also checks that `index.md` is fresh and warns with L029 when Git enforcement hooks are absent or lack integration lines. A legacy `dispatchCommand` remains
  accepted but lint warns that the session now drives stages with `spec next`.
- `spec lint --base <ref>` (and `--ci`, against the configured base branch) compares the spec with the spec at the base and at the merge base of HEAD and the base (L035). An ID that your branch and the base each added after they parted, with different meanings, is an error: give yours a new ID. So is a unit your branch dropped without listing its number in `retired:` or keeping a tombstone. A `--base` git cannot resolve exits 2; `--ci` outside git, or without the base branch, compares nothing.
- The before-edit hook denies governed edits on the base branch, including an unborn project base and the interval after init before its setup commit. Use `/spec:feature`, `/spec:change` or `/spec:bug` to make a ticket; work in that ticket's worktree. The guard covers `codeGlobs`, `testGlobs`, `protectedGlobs`, the spec root and the tickets directory. It identifies nested projects from common-directory spec hook/bypass state, a resolvable `enforceSince`, or a working config under a project path the parent already tracks; a copied child whose parent tracks no project files remains unrelated. On a check failure it denies a governed edit and asks for spec to be fixed or the person asked about a bypass. It does not parse shell writes (including filesystem writes allowed by Claude Code `acceptEdits`); installed commit/merge hooks and `spec verify-history` are the guard.
- Init and upgrade install `pre-commit`, `pre-merge-commit` and `commit-msg` using Git's resolved hooksPath. A base-branch commit touching governed paths needs a purpose-bound, short-lived spec-owned marker or an active bypass with its ADR staged in the commit. Spec-owned commits use `<git-common>/spec/commit-token` (0600, under 60 seconds); they do not use an environment marker. These markers and person-only settings are not security boundaries; CI history verification and review are the enforcement. Ticket-branch commits are allowed.
- A bypass records a `kind: bypass` ADR: a person can open one at a terminal; an agent needs `--approved-by-person` only after the person approved in-session. `enforce.bypass: "person"` refuses agent requests. Bypasses cannot be opened from a ticket worktree, and their ADR must be staged with governed base changes; they last one commit or one hour. Inspect with `spec bypass --status`, cancel with `spec bypass --cancel`.
- `spec verify-history [--since <ref>] [--base <ref>]` checks first-parent base commits since `enforceSince`, validating ticket files/status and every governed second-parent side commit. Governed merge changes must match `git merge-tree` except generated paths; all enforcement, reviewer and added-line diff readers disable rename/copy detection so a rename out of governed globs still checks its old path. Git before 2.38 uses a conservative parent-tree fallback. A valid one-use bypass ADR added in the merge commit can authorize hand resolutions or extra content. Bypass trailers require an ADR added in the same commit and not cited earlier. Pull hooks validate only incoming history, so older offenders do not block an otherwise valid pull; `spec verify-history` still reports them. Squash, rebase and fast-forward delivery of ticket branches is refused: use `spec merge`. Without `--base`, spec resolves the configured base, `origin/<base>`, then HEAD; shallow clones need full history. Set `enforce.edits`, `enforce.commits` or `enforce.history` to `false` to disable that layer.
- `spec show <ID>` prints a unit with what uses it. `spec find <words>` searches.
- In Claude Code, `/spec:brief` loads the project brief through the plugin skill: with no arguments the
  module map and queue; with an ID, that unit; with a role and an ID, the role's brief; with the
  words of a question, the best-matching scenarios. If `.spec/bin/spec` is missing, the skill prints a one-line setup message; ask Claude to run `/spec:spec-init`.
- `spec impact <contract>` before changing a contract: field-level references keep the reach
  narrow.
- A behaviour no scenario describes is not a bug: write a proposal for it.

## CI

```sh
spec lint --ci         # the spec, the tickets, the generated index and code pointers
<your test command>    # tests are named after scenario IDs
```

For GitHub Actions history enforcement, fetch the full first-parent history and run:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- name: Verify spec history
  run: .spec/bin/spec verify-history --base "origin/${{ github.event.repository.default_branch }}"
```

Run the live evals (`evals/runner.ts`) when role prompts, the brief format or the CLI change. They
grade roles on the cheapest model, so stronger ones have margin.
