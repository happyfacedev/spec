#!/bin/sh
# Layer 4: session task handoff through real Claude Code. See run.ts for the checks.
cd "$(dirname "$0")/../.." && exec npx tsx evals/e2e/run.ts "$@"
