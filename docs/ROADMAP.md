# Roadmap: session-driven spec workflow

## Current operation (2026-11-10)

The plugin provides `/spec:spec-init`, `/spec:feature`, `/spec:change`, `/spec:bug` and
`/spec:run` skills. The main session prepares stages with `spec next` and delegates each returned
task; `/spec:run` selects Astro when the Astro delegation tool is available, or Claude Code
otherwise. It records reports with `spec ticket advance`, then merges explicitly with
`spec merge` (DECISIONS X137, X139). Astro uses this session-delegation path rather than a separate
Astro hook adapter.

## Historical roadmap proposal (2026-10-27)

The sections below preserve that dated proposal; where they overlap, Current operation above is the
authoritative description of today's workflow.

Goal: once a project has a spec, Alex states what he wants and the system does the rest. The spec
documents always change first, then the implementation.

**Status (Oct 27, historical snapshot).**
- **Built and evaluated:** `/spec:spec-init`, `/spec:feature`, `/spec:change`, `/spec:bug`, manual `spec next` delegation and explicit merge, and drafts (DECISIONS X83–X85).
- **Not built at that date:** a separate Astro adapter (§4).

## The rule every command follows

Spec first, then code. Every change becomes a ticket. A proposal starts with the spec-writer, a
bug with the tester, and a task with the implementer. None of these commands bypasses the
pipeline (gate → stages → check → commit). They only make it easier to start.

## 1. Starting a spec

Two entry points, one shared loop: **draft → review with Alex → close gaps → lint clean.**

### 1a. `/spec:spec-init`: a new project, from Alex's description

- An interview skill. It asks about one part at a time, in the order the spec needs it:
  1. purpose and actors (`core/overview.md`)
  2. modules and what each owns (`_module.md`)
  3. features and their scenarios, with concrete values a test can check
  4. contracts between modules
  5. invariants, decisions and screens
  6. glossary terms
- **It writes as it goes.** Each answer becomes spec files at once, `spec lint` runs on them, and
  the next question targets what lint or the graph says is missing: a scenario without a Then, a
  contract nobody writes, an undefined term.
- **It knows when to stop.** A coverage checklist per part. It never invents behaviour: an
  unknown becomes a question, written as a blocker or a preference with a default.
- **Hands it over.** It ends with `spec lint --ci` clean and a first set of tickets.

### 1b. `/spec:spec-init`: an existing project, from its code, docs and other documents

- **Pass 1, draft from evidence.** Agents read the code, tests, README and docs, plus any
  documents Alex points to. They draft modules, features, scenarios and contracts. Every drafted
  unit records where it came from (file:line, a doc). Existing tests are matched to scenarios.
- **Pass 2, confirm with Alex.** Unit by unit: "the code does X; is X intended?" Each answer
  marks the unit confirmed, corrects it, or turns it into a bug ticket (the code is wrong) or a
  proposal (the behaviour should change).
- **Gaps** become questions: code with no scenario, scenarios with no test, contradictions
  between docs and code. The loop repeats until no question is open.
- **Needs from the format:** a draft or confirmed state per unit, and where it came from. That is
  likely the first format change.

## 2. Day-to-day commands

All of them take an ID or a description. With a description, they first find what it touches
(`spec find`, impact) and propose the IDs; Alex confirms.

| Command | Makes | Pipeline | Asks Alex |
| --- | --- | --- | --- |
| `/spec:feature` | a proposal: new behaviour | spec-writer → spec-review → tester → implementer → reviewer | what it does, its open questions (blocker or preference) |
| `/spec:change` | a proposal: changed behaviour of existing units | same as `/spec:feature` | which units, what changes, what must still hold |
| `/spec:bug` | a bug: names the scenario the code breaks | tester → implementer → reviewer | which scenario; if none fits, it is not a bug but a `/spec:feature` |
| `/task` (maybe) | a task: no behaviour change | implementer → reviewer | what to restructure |

- Each command writes the ticket, shows its reach (`spec impact`) and the gate's answer. On "go",
  the main session then drives its stages with `spec next` and harness delegation.
- One interview pattern serves all of them: ask until the ticket passes the gate. Unknowns that
  could change behaviour are blockers; cheap ones are preferences with a default.

## 3. Session-driven stages and parallel tickets (historical proposal; superseded by Current operation above)

The main session runs `spec next <ID>` and delegates the returned task to the named role and model.
It records each final message with `spec ticket advance <ID> --report-file <path>` and runs
`spec merge <ID>` when the stages are done. With no ID, `spec next` lists every ticket startable in
the current plan wave; `spec next --start` creates each worktree and starts its stage. The session
can delegate each returned task in its worktree in the background, then ask `spec next` again after
reports are recorded.

## 4. Later: the Astro harness (historical proposal; superseded by Current operation above)

The core remains harness-neutral: the CLI returns a role prompt and task for any harness to run. Claude Code's active hooks add session-start context and lint after edits. Astro tickets could also be a tracker behind the ticket protocol (docs/TICKETS.md).

## Historical order and validation (2026-10-27)

| # | Item | How we validate it |
| --- | --- | --- |
| 1 | `/spec:feature`, `/spec:bug`, `/spec:change` | Evals: a description in, a ticket that passes the gate out, no invented behaviour. A live run from a sentence to a merged branch. |
| 2 | `/spec:spec-init` | A scripted "Alex" answering from a hidden reference spec. Score how much of it the interview recovers, and how much it invents (must be none). |
| 3 | `/spec:spec-init` | Run on chat-mini with its spec deleted. Compare the draft with the real spec; measure questions asked, gaps found, behaviour invented. Then a real project of Alex's. |
| 4 | `spec next` | A session gets startable tasks, delegates them in separate worktrees and records reports before merging. |
| 5 | Astro hook adapter (superseded by session delegation above) | The hook layer-2 cases and the role evals, run through Astro. |

The proposal prioritized command group 1 because it reused the existing pipeline; its interview
pattern informed the command skills listed in Current operation above.

## Decided (Alex, Oct 27)

- **One `/spec:spec-init`.** It detects whether the project has code. With none it interviews
  (1a); with code it drafts from the evidence first (1b).
- **Interview depth: ask Alex.** At the start, `/spec:spec-init` asks whether to draft fast and refine
  later through tickets, or to cover everything up front.
- **Sources (recommended, Alex unsure).** A drafted unit carries `sources:` (file:line or a doc)
  only while it is a draft. Confirming it drops them. Pointers into code go stale, and tests
  already tie scenarios to code.
- **Merging is automatic (historical proposal, superseded by DECISIONS X139).** A ticket merges
  into the base branch when the reviewer approves and the tests pass on the merged result.
  Dependents then start.
- **No `/task` (recommended, Alex unsure).** `/spec:change` asks whether behaviour changes: yes makes
  a proposal, no makes a task. The command set stays small: `/spec:spec-init`, `/spec:feature`, `/spec:change`,
  `/spec:bug`.
