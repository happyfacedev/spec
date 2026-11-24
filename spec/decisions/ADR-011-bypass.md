---
id: ADR-011
title: "Bypass: Reconcile diverged main; local PROP-112..114 land as PROP-121..123"
kind: bypass
status: accepted
---
## Decision
Permit one commit outside a ticket for: Reconcile diverged main; local PROP-112..114 land as PROP-121..123

Date: 2026-11-22 · Git user: alexpavelm
Opened by: agent (Astro) after the person's approval in the session

## Consequences
- This exception is recorded and expires after one commit or one hour.

## Context
- A person chose to bypass the normal ticket workflow.
- Local main (32 commits, last 1516e22) and origin/main (122 commits, last 87d5cb0) diverged at cbd4657, and each side created PROP-112, PROP-113 and PROP-114 for different work. Origin's three keep their IDs; the local three are the same done tickets renumbered PROP-121 (code pointer checks read only files git does not ignore), PROP-122 (a nested project's init keeps the enclosing project's Git hooks) and PROP-123 (untracked files merge does not touch do not block spec merge).
- Hand resolutions: the `mergeLocked` signature in src/cli/merge.ts keeps origin's `write` parameter beside the local helpers; tests/helpers.ts imports the union of both sides; generated bundles and spec/index.md were rebuilt. The full suite (2181 tests) and `spec lint --ci` passed on the result.

## Alternatives
- Deliver the change through a ticket: not chosen for this emergency.
