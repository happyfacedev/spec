# Retrospective: the plugin and session-delegation work (2026-10-30/31)

The work: spec as a Claude Code plugin (S1), session-driven delegation (S2a), removal of headless dispatch
(S2b), enforcement (S3), the setup flow (S4), and four Astro tickets that let spec run in Astro (AST-2
delegate `worktree`, AST-3 hooks, AST-4 worktree display, AST-5 hook trust UI).

**What went wrong with the process.** None of this went spec-first. The lead wrote briefs straight to
implementers, and spec units were updated alongside the code. Every piece then needed 3–5 rounds of blind
cross-lab review. The reviewers did the work the pipeline is meant to do before any code: list the cases
the change must handle. A spec that leaves those cases out is incomplete, so the target is one review
round per ticket. More rounds than that means the spec step failed to force the cases out.

## Findings by class

Each class lists the review findings that fell in it, and the step that should have caught it.

### C1 · Interaction with neighbouring features (9)
- AST-2 × AST-3: hook payload cwd vs command cwd vs trust lookup for a child in a worktree.
- S1 × S2a: `spec next` named `.spec/bin/spec` in pointer-layout legacy projects; `spec:brief` used as a
  CLI path segment.
- S1 `generatedPaths` made every project's `plugin/` folder "generated", so user merge conflicts there
  were resolved silently.
- AST-4: a continuation's `subagent_start` omits the worktree, and the new "clear on omit" rule wiped it.
- AST-5: workspace workers' notices routed to the desktop's trust store.
- AST-2: http-chat parents never wired the subagent lister, so continuation scope was missed there only.
- **Should have caught it:** the spec-writer, by running `spec impact` on the change and writing one
  scenario per affected neighbour; the brief, by carrying neighbouring scenarios.

### C2 · Environment variants not listed (8)
- Non-canonical paths: macOS `/var` vs `/private/var`, symlinked project dirs, `CLAUDE_PROJECT_DIR`.
- Install layouts: in-skill, pointer (`skill.json`), new (`.spec/bin`); old configs with removed keys.
- Old Claude/Astro settings still calling removed hooks; older pinned CLIs rejecting new config keys.
- Coarse-timestamp filesystems for change detection.
- **Should have caught it:** a spec-writer checklist naming the axes (paths, layouts/versions,
  platforms, upgrade from every older state).

### C3 · Concurrency and ordering (7)
- Hook reload window: concurrent callers saw "no hooks" while a reload was pending.
- Claude CLI runs PreToolUse callbacks in parallel; splitting one callback let a hook run beside a gate.
- Lifecycle tests broken by an added `await` (microtask) on a path that did not need it.
- Stale context after awaits (mode change, session retired).
- TOCTOU between validation and spawn; a 1 s throttle letting an edited script run under old trust.
- Two `spec next` racing on one ticket.
- **Should have caught it:** a scenario per shared state touched across an `await` or a process
  boundary: "while X is in progress, a second Y …".

### C4 · Trust boundaries (9)
- Model-chosen worktree used as the permission scope (deny rules sidestepped).
- Hook `updatedInput` combined with an earlier `allow` (rewritten command ran unapproved).
- Project settings enabling a user-installed plugin's hooks without trust.
- Trust hash not covering referenced scripts; bare words, dotfiles and directories skipped.
- An untrusted repo's `disableAllHooks` turning off the operator's own guard hooks.
- A worker able to supply `projectRoot` for the owner's Settings.
- The subagent task telling the subagent to run the main session's `ticket advance`.
- **Should have caught it:** an invariant per input that crosses a trust boundary: who can set it, what
  happens if it is forged, and which side decides.

### C5 · Failing open (5)
- Unresolvable path tokens skipped instead of refused; missing interpreter operands accepted.
- `hasHooks` returning false while not initialized.
- Hook errors exiting 2 (= block) after a spawn failure; hook output not valid JSON after an appended
  hint.
- **Should have caught it:** a convention: unknown, missing or unverifiable input fails closed, and the
  scenario says so.

### C6 · Behaviour that must not change (6)
- The no-hooks path drifted from main (extra awaits, interrupt checks).
- Removing dispatch removed nothing needed only because a reviewer checked; old hooks must exit 0.
- The upgrade command was a no-op from the project copy (it compared itself to itself).
- **Should have caught it:** "Preserved" scenarios in every change: what must behave exactly as before,
  tested on the unchanged path.

### C7 · Tests that cannot fail (3)
- A plugin staleness test that built and compared the build with itself.
- A dedupe test asserting the buggy behaviour; a "clear on omit" test asserting the bug.
- **Should have caught it:** the tester rule: every test must fail against a named plausible wrong
  implementation (a mutation the tester states).

### C8 · Unverified assumptions about external tools (5)
- Which env vars Astro sets (`ASTRO_HOOK`, `SHELL_PROMPT` were wrong).
- Whether Claude Code expands `${CLAUDE_PLUGIN_ROOT}` in skill text and hook context; whether a
  compound `!` line matches `allowed-tools`; whether callbacks run in parallel.
- Whether worker frames can be trusted.
- **Should have caught it:** the spec-writer marks every external fact as a question or cites where it
  was verified; unverified facts block the ticket (or a spike answers them).

### C9 · Text and docs (4)
- `replaceAll('/feature')` corrupting `modules/<module>/features/`.
- Docs stating rules broader or narrower than the code.
- **Should have caught it:** reviewer check that docs match scenarios; scenarios for text rewrites
  include a near-miss input.

## Process changes (S5)

1. **Spec-first, always.** Every change, including the tool's own, starts as a ticket and spec units;
   the lead never briefs implementers directly.
2. **Spec-writer checklist** (role prompt), one line per class C1–C8: run `spec impact`, list
   environment axes, concurrency, trust boundaries, fail-closed, preserved behaviour, external facts.
   Each item ends as scenarios, an invariant, a question, or "not applicable: <reason>".
3. **Spec review stage** between spec-writer and tester: a reviewer attacks the spec delta with the same
   checklist and the neighbours' scenarios. Findings go back to the spec-writer as scenarios. Code
   review then checks code against an already-reviewed spec.
4. **Tester mutation rule:** each test names the wrong implementation it would catch; no test compares
   generated output with itself.
5. **External facts:** unverified facts become ticket questions; the gate blocks until answered.
6. **Briefs carry neighbours:** depth-1 impact scenarios are in every role's brief.

**How we measure it:** tickets through the new pipeline should pass code review in one round. The
remaining review findings on S3/S4 are fed back spec-first (finding → scenario → failing test → fix).
