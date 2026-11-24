---
id: PROP-041
type: proposal
title: orchestrate's waiting lines name the ticket they wait for, and its syntax lines show --depth
status: done
stage: null
touches: [WSP-008]
violates: []
depends_on: []
changed: [WSP-008, WSP-008/R3, WSP-008/S22, WSP-008/S23, WSP-008/S24, WSP-008/S25, workspace.Orchestrate]
questions: []
history:
  - at: 2026-10-29T22:57:43.656Z
    role: spec-writer
    result: done
    summary: "Orchestrate names the ticket a held-back ticket waits for (after <ID>: …); syntax shows --max and --depth"
    verdict: null
    assumed:
      - new: "Does the after <ID>: form apply to every reason the plan gives for a held-back ticket, dependencies included, or only to conflicts?"
        value: "Every plan after reason, as spec plan writes it, so S23's depends-on reason gains after TASK-200:"
      - new: How are several after reasons joined in one orchestrate line?
        value: "One after <ID>: <reason> part per ticket, in the plan's order, joined by ; (today's bare reasons are joined the same way)"
      - new: Item 2 says match the usage text, which shows --depth but not --max; drop --max from the syntax?
        value: "Keep --max (it works, S19) and add --depth: [--restart] [--max <n>] [--depth <n>]; the usage text (CLI-001) is left as it is"
      - new: May the spec-writer change skills/spec/SKILL.md (item 3)?
        value: "No: it is a skill file, not a spec unit the brief names; left for the implementer to add the Not merged: section"
    duration_s: 256
  - at: 2026-10-29T23:10:31.082Z
    role: tester
    result: done
    summary: "Tests for WSP-008 S23 (updated), S24, S25: the after <ID>: prefix on orchestrate Not merged lines; they fail now"
    verdict: null
    assumed: []
    duration_s: 765
  - at: 2026-10-29T23:26:43.303Z
    role: implementer
    result: done
    summary: "Orchestrate's Not merged lines for held-back tickets now read 'after <ID>: <reason>'; Not merged added to SKILL.md"
    verdict: null
    assumed: []
    duration_s: 971
  - at: 2026-10-29T23:42:30.652Z
    role: reviewer
    result: done
    summary: "Fix skill depth-limit guidance; candidate bug: flaky dispatch timing (981ms >=900ms; isolated rerun passed)."
    verdict: changes
    assumed: []
    duration_s: 947
  - at: 2026-10-30T00:15:30.890Z
    role: implementer
    result: done
    summary: SKILL.md now tells the reader to rerun at once on depth-limit lines and to wait for the named ticket on after lines
    verdict: null
    assumed: []
    duration_s: 1978
  - at: 2026-10-30T00:25:20.311Z
    role: reviewer
    result: done
    summary: Depth-limit guidance matches S22/R3; follow-up changes only the skill bullet and ticket history.
    verdict: approve
    assumed: []
    duration_s: 589
---
Follow-ups from PROP-027's review and self-hosting finding P15.

1. Since PROP-027, a ticket held back by a conflict is listed with the bare reason (for example "both change WSP-008") and no longer names the ticket it waits for. Name it again: "after PROP-123: both change WSP-008", as spec plan writes it.
2. The orchestrate syntax in the workspace module's description and in workspace.Orchestrate shows --max but not --depth. Make both match the usage text, which names --depth once PROP-007 lands.
3. skills/spec/SKILL.md describes orchestrate's output without the Not merged: section; add it.
