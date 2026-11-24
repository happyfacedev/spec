---
id: ADR-001
title: Fix the checks that block spec's own pipeline by hand, outside a ticket
status: accepted
---
## Decision
A fix to a check that stops spec's own pipeline from running is made by hand on the base branch, not through a ticket: a bootstrap change. The first one fixes six problems found in the first pilot on this repository, which ran PROP-008:

- `check-report` counts a `SPEC-STUB` marker only where the ticket's branch added it (PIP-006).
- A test name claims a scenario only with one of this spec's prefixes, in `check-report` and in `spec gaps` (PIP-006, ADP-003).
- What a new worktree's setup made is no role's change (WSP-001, PIP-005).
- A role refused at the bounce limit leaves its final message for `ticket advance`, which blocks the ticket on a question (INS-011).
- `spec dispatch` and `spec orchestrate` tell a ticket whose stage died from one that runs, report it as stopped mid-stage, and restart it with `--restart` (WSP-005, WSP-008).

The procedure, every time:
1. Change the code under `src/` with tests, and the spec scenarios it changes, in the same change.
2. Run `npm run check`, and `spec lint --ci` with the bundled CLI.
3. Have a person review it; then rebuild with `npm run build` and copy `dist/spec` and `dist/spec.cjs` over `.claude/skills/spec-spec/scripts/`.
4. Commit on the base branch, then restart the tickets that were running (`spec orchestrate --restart`), so they run with the fix.
5. Record each bootstrap change as a decision like this one, cited by the features it changed.

## Consequences
- The spec shows why these features changed with no ticket in their history.
- No spec-writer, tester or reviewer stage checked this change; the person's review and the project's own checks stand in for them.
- Tickets that started before the fix do not have it until they are restarted.
- A bootstrap change is the exception: anything a running pipeline can deliver still goes through a ticket.

## Context
Every stage is judged by the CLI copy bundled in `.claude/skills/spec-spec/scripts/`, frozen when it was installed. A fix to a check in `src/` takes effect only once it is built and copied over that copy. A ticket that fixes a check its own stages trip can therefore never finish: in the pilot, the implementer of PROP-008 was refused because the code that implements stubs, and the docs that describe them, mention `SPEC-STUB`, and its tester had to rename tests that name the chat-mini fixture's scenarios. A stage that died left its ticket "running" forever, and one refused three times was lost with no question for a person.

## Alternatives
- File each fix as a ticket: rejected, its own stages would be judged by the broken checks and refused the same way.
- Edit the bundled CLI copy by hand: rejected, the copy would no longer match any source, and the next install would undo it.
- Turn the failing checks off for this repository: rejected, they hold every other ticket to test first and to its role's files.
