---
name: run
description: Drive every ticket in {project} that can start now through its spec, spec review, test, implementation and review stages, then merge it. Use when the user asks to run ready spec tickets.
argument-hint: [ticket IDs]
---
# /run: drive ready tickets through spec

Treat this command as the user's approval to start every ticket the CLI says can start. Do not ask for approval a second time.

Choose the harness explicitly: `astro` if the `mcp__agents__delegate` tool exists in this session, otherwise `claude-code`.

1. List the safe current wave with `{cli} next --summary --harness <harness> --format json` (no ticket ID). This lists only ticket, action, role, worktree and model; it contains no task or brief. Explain tickets that are waiting or blocked; one listed as `waiting` has every model of its role marked unavailable, and a request for it names them. If no ticket can start, report that and stop.
2. On Claude Code, when `{cli} hook claude-code before-agent` with empty stdin exits 0 (Stage requests, below): do not use `--start`. Send one stage request, `spec:<ID>`, per listed ticket that can start, and drive each as Driving a ticket says. Send them in parallel with `run_in_background=true` only when `editMode` allows it; otherwise one at a time in the foreground, so each ticket's stage starts only with its own request, after the call before it returns.
3. Otherwise (Astro, or a CLI that fails that command with `unknown hook event before-agent`), run `{cli} next --start --harness <harness> --format json` to create worktrees and start the current safe wave. This returns full delegate entries with tasks. Use only those entries; do not invent tickets or override the plan. Start several returned delegates in parallel (Astro: `background=true`; Claude Code: `run_in_background=true` only when `editMode` allows it, see Edit mode below; otherwise delegate them one at a time in the foreground).
4. Use the started entries directly: each full delegate entry is the first input to Driving a ticket below. Do not call `next <ID>` before its first delegation: `--start` already marked the stage running. Keep advancing a ticket after its report is accepted while other delegates continue. Ask and record every question returned by a later `next`.
5. When all tickets are merged or waiting, report the outcome and any blockers. Run the command again only when the user asks or a dependency has been resolved.

{drive}
