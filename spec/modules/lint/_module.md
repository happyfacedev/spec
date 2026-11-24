---
id: lint
prefix: LNT
domain: authoring
status: active
---
Checks a spec and its tickets and reports each problem with a stable code and its fix.

## Owns
- `spec lint`, `spec lint --files <paths>`, `spec lint --ci`, `spec lint --base <ref>`
- Every lint rule, L001 to L037, and its severity
- The freshness checks `--ci` adds: `index.md` and code pointers
- The comparison with the base branch: IDs a branch reuses or drops

## Non-goals
- What the files mean: format
- Checks on a finished stage: pipeline (`check-report`)
