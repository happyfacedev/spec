---
id: PROP-019
type: proposal
title: brief searches free text unless the first word is exactly a role
status: done
stage: null
touches: [PIP-015]
violates: []
depends_on: []
changed: [PIP-015, PIP-015/R4, PIP-015/S1, PIP-015/S2, PIP-015/S3, PIP-015/S4, PIP-015/S5, PIP-015/S6, PIP-015/S7, PIP-015/S8, PIP-015/S9, PIP-015/S10, PIP-015/S11, PIP-015/S12, PIP-015/S13, PIP-015/S14, PIP-015/S15, PIP-015/S16, PIP-015/S17, PIP-015/S18, PIP-015/S19, PIP-015/S20]
questions:
  - id: Q1
    kind: blocker
    text: "Unknown: is a query whose first word is a unit or module searched, as the PIP-015#Q1 answer says (search unless the first word is exactly a role name), or refused, as PIP-015/R4 says (neither exactly a role nor a unit)? The diff refuses it: on the real spec, 'tickets can be answered' prints 'Unknown role tickets.' and 'PIP-015/S6 what happens' prints 'Unknown role PIP-015/S6.'. The base code searched both, since its unit check ran only without a second argument. The spec-writer's default 'as today' holds only for a lone unit ID."
    default: null
    cites:
      - PIP-015
      - PIP-015/R4
      - PIP-015/S6
    answer: "Search it. With a query, only a first word that is exactly a role name is not searched; a unit, module, term or anything else as the first word starts a search. Exception (from review 2): when the query holds no word beyond the first argument itself, as the skill sends a lone ID (brief PIP-015/S3 --query PIP-015/S3), the unit or ticket is shown as stored, so S3 holds on the skill path. Add a scenario for a lone unit ID and a lone ticket ID passed this way."
    raised_by: reviewer
history:
  - at: 2026-10-29T18:06:39.906Z
    role: spec-writer
    result: done
    summary: "PIP-015: near-role first words are searched; short-word-only queries give no matches"
    verdict: null
    assumed:
      - new: With an ID and a query, does a near-role first word still search, or keep the mistyped-role hint?
        value: searches, as the answer's rule reads; a mistyped role given with an ID now searches when a query is present
      - new: Does a unit ID as first word with a query get searched?
        value: no, a unit is still not searched, as today
      - new: What does a query of only short words print?
        value: 'the S7 output: the "No unit matches" line and the module list'
      - new: Should the answers keep the 'until it lands' sentence once the spec states the new behaviour?
        value: no, it is dropped because it would be false
    duration_s: 171
  - at: 2026-10-29T18:21:45.907Z
    role: tester
    result: done
    summary: PIP-015/S1-S14 tests in tests/cli/brief-entry-points.test.ts; S6, S8, S13, S14 fail as the spec requires
    verdict: null
    assumed:
      - new: "S6: is a glossary term a unit for the first argument, since S6 starts with the term fallback?"
        value: "no: Unit means anything with its own ID, so a term such as fallback starts a search"
      - new: "S8: may a Did you mean suffix follow the hint on the providers row?"
        value: "no: the first line equals the table text exactly"
      - new: "S4: how is the 800-character floor measured?"
        value: on the whole Queue section as printed
      - new: "S9: how is no file created checked?"
        value: /tmp/pwned is absent before and after the call
      - new: "S11: how is no spec root simulated?"
        value: an empty temporary directory as cwd, env {} and no scriptPath
    duration_s: 905
  - at: 2026-10-29T18:36:10.443Z
    role: implementer
    result: done
    summary: Free text is searched unless the first word is a role or unit; short-word queries match nothing
    verdict: null
    assumed:
      - new: Without a query, does a glossary term as the only argument still print the term, as before?
        value: yes, unchanged
      - new: Which header does a search print when its query has only short words?
        value: the query text as given
      - new: Should Did you mean suggest modules or questions?
        value: no, only units and tickets that brief answers
    duration_s: 843
  - at: 2026-10-29T18:43:54.916Z
    role: reviewer
    result: blocked
    summary: Tests, lint, typecheck pass; R4 and PIP-015#Q1 disagree on unit and module first words, so blocked.
    verdict: null
    assumed:
      - new: Is a glossary term a unit for R4, so that its first word starts a search?
        value: no, S6 searches the term fallback as a first word
      - new: Should a question ID such as PIP-015#Q1 be a Did you mean candidate for a bad unit ID?
        value: no, the diff leaves questions out and no scenario covers it
    duration_s: 464
  - at: 2026-10-29T18:51:09.811Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-019#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T18:53:14.714Z
    role: spec-writer
    result: done
    summary: "PIP-015: a unit or module first argument with a query is searched; R4, S15 and S16 say so"
    verdict: null
    assumed:
      - new: With a query, what does a first argument that is exactly a role name print?
        value: "unchanged from today: not a search, and the spec adds nothing for it"
    duration_s: 124
  - at: 2026-10-29T19:06:58.844Z
    role: tester
    result: done
    summary: S15 and S16 tests added; both fail, as the code shows the unit or module instead of searching. S1-S14 pass
    verdict: null
    assumed:
      - new: "S15 and S16: is the query passed as --query after the first argument, as the other query tests do?"
        value: yes
    duration_s: 824
  - at: 2026-10-29T19:23:36.610Z
    role: implementer
    result: done
    summary: A unit or module first word with a query is searched, not shown; full suite, typecheck and lint pass
    verdict: null
    assumed:
      - new: With a query, is a second argument (an ID) ignored when the first is not a role?
        value: ignored, as free-text search already ignored it
      - new: With a query and no ID, does an exact role name as the first argument still print its usage hint?
        value: "yes, unchanged: a role name is never searched"
    duration_s: 997
  - at: 2026-10-29T19:31:27.843Z
    role: reviewer
    result: done
    summary: "A unit, feature or ticket ID typed after the skill is searched, not shown: S3 breaks on the skill path"
    verdict: changes
    assumed:
      - new: Should a lone unit or ticket ID through the skill, whose query is that ID, show the unit or ticket as S3 and DECISIONS.md X81 say, or search as R4 says?
        value: show it as stored; the verdict treats the diff as breaking S3 on the skill path
    duration_s: 471
  - at: 2026-10-29T19:31:39.559Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-019#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T19:37:56.133Z
    role: spec-writer
    result: done
    summary: "PIP-015: a lone unit, module, ticket or term given again as the query is shown, not searched"
    verdict: null
    assumed:
      - new: Does a lone unit or ticket ID that the spec does not hold, given again as the query, get the exception?
        value: "no: it is searched, as R4's rule for a lone argument that matches nothing says"
      - new: Does the glossary term clause of R4 need its own scenario?
        value: "yes: S20 shows it, since every rule clause needs a scenario"
    duration_s: 368
  - at: 2026-10-29T19:48:05.985Z
    role: tester
    result: done
    summary: PIP-015/S17-S20 tests added; they fail as the spec requires, S1-S16 pass; lint and typecheck clean
    verdict: null
    assumed: []
    duration_s: 609
  - at: 2026-10-29T19:57:44.937Z
    role: implementer
    result: done
    summary: A lone unit, module, ticket or term repeated as the query is shown, not searched; all tests, typecheck, lint pass
    verdict: null
    assumed:
      - new: With an ID after it, does a lone unit repeated as the query still get the exception?
        value: "yes: it is shown as with no query, so the ID gives the Unknown role hint"
      - new: Does a query made only of the first argument, repeated, count as holding no word beyond it?
        value: "yes: every word of the query must equal the first argument"
    duration_s: 578
  - at: 2026-10-29T20:07:24.147Z
    role: reviewer
    result: done
    summary: "approve: skill-path lone IDs shown, free text searched, all checks pass; candidate bug: apostrophe in $ARGUMENTS"
    verdict: approve
    assumed:
      - new: Does the pipeline.Brief.query contract (searched when it names no role) override S17-S20 for a lone argument given again as the query?
        value: "no: R4 and S17-S20 govern, so the lone argument is shown; the contract wording is stale"
      - new: Is the bundled .claude/skills/spec-spec/scripts/spec.cjs the base for the skill-path comparison?
        value: "yes: it shows review as an unknown role and shows a unit or module first word with a query, as main does"
    duration_s: 579
---
Review 2026-10-29. PIP-015#Q1: a query whose first word is only close to a role ("review fallback rules") is searched, not refused as a mistyped role. PIP-015#Q2: words of one or two letters are still dropped, but a query made only of them answers with no matches instead of "Unknown role".
