# Invariants

One `### INV-<NNN>: <title>` per rule that always holds, with a few lines, an `Applies to:` line naming the contracts or members it constrains, and an optional `Decisions: ADR-<NNN>` line. A scenario that checks one cites it in a step, for example `Then no log line holds the key (INV-002)`; every invariant is shown by one. For a large spec, split them into `core/invariants/*.md`.
