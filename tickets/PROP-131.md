---
id: PROP-131
type: proposal
title: Each stage takes the first available model and effort from an ordered list
status: done
stage: null
touches: [FMT-015, INS-001, format.Config.delegation, PIP-017, CLI-007, CLI-008, INS-008, INS-014, INS-020, cli.Next.model, cli.Next.missingModels, cli.Detection.missingModels]
violates: []
depends_on: []
changed: [CLI-001/S1, CLI-007/R18, CLI-007/R19, CLI-007/S21, CLI-007/S22, CLI-007/S23, CLI-007/S24, CLI-008/R4, CLI-008/R5, CLI-008/R9, CLI-008/R13, CLI-008/S1, CLI-008/S7, CLI-008/S12, CLI-008/S39, FMT-015/R3, FMT-015/R7, FMT-015/R8, FMT-015/R9, FMT-015/S12, FMT-015/S13, FMT-015/S14, INS-008/R2, INS-008/S5, INS-008/S6, INS-008/S7, INS-014/R6, INS-014/R17, INS-014/S23, INS-014/S38, INS-020/R1, INS-020/R14, INS-020/R19, INS-020/S16, INS-020/S25, INS-020/S26, INV-017, INV-019, INV-020, PIP-017/R8, PIP-017/S10, cli.ConfigSet, cli.ConfigSet.key, cli.ConfigSet.local, cli.ConfigWrite, cli.ConfigWrite.value, cli.Detection, cli.Detection.models, cli.Next, cli.Next.effort, cli.Next.skipped, cli.NextSummary, cli.NextSummary.action, cli.RoleModel, cli.RoleModel.effort, cli.RoleModel.model, cli.RoleModel.role, cli.RoleModel.skipped, cli.SkippedModel, cli.SkippedModel.model, cli.SkippedModel.reason, format.Config, format.Config.delegation, format.Effort, format.LocalConfig, format.LocalConfig.delegation, format.LocalConfig.unavailableModels, format.ModelChoice, format.ModelChoice.effort, format.ModelChoice.model, install.AgentToolInput, install.AgentToolInput.effort]
questions:
  - id: Q1
    kind: preference
    text: What happens when no model in a role's list is available?
    default: The stage does not start; the person is told which models were tried and why each was skipped
    cites: [CLI-007]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: What happens when a model that looked available is refused at launch?
    default: The stage is offered again with the next model in its list, and the skipped model and reason are reported; nothing is recorded as the role's report
    cites: [CLI-007]
    answer: null
    raised_by: null
  - id: Q3
    kind: preference
    text: Is a model on another provider's CLI allowed to run a stage from a Claude Code session?
    default: Yes, through that provider's installed and logged-in CLI in the ticket worktree, with the same task, role file scope and report checks; this narrows X139, which removed headless dispatch
    cites: [PIP-017]
    answer: "No, for now: a stage in a Claude Code session uses only Claude models (person, 2026-11-23). Claude-only lists: spec-writer opus medium; spec-review sonnet high; tester sonnet high, then haiku high; implementer opus medium, then haiku high; reviewer sonnet high. Codex and Copilot come back later."
    raised_by: null
history:
  - at: 2026-11-23T16:17:53.757Z
    role: spec-writer
    result: done
    summary: Claude Code roles take an ordered model and effort list; the session reports a refused launch
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [CLI-001/S1, PIP-017/S10, PIP-025/S1, FMT-002/S1, INS-010/S1, INS-014/S38]
        reason: Impact run; the remembered model stays the alias, and config, hooks and intake are otherwise unchanged
      - item: C2
        outcome: scenarios
        ids: [FMT-015/S12, INS-014/S23, INS-020/S25, INS-008/S7]
        reason: Single text, local override, Claude Code too old for effort, Astro session
      - item: C3
        outcome: scenarios
        ids: [CLI-007/S24, INS-020/S6]
        reason: The list changes while a stage runs; simultaneous requests start once. A refusal is stored nowhere
      - item: C4
        outcome: invariant
        ids: [INV-019]
        reason: Model and effort come from the config, bounded by its schema, never from the call
      - item: C5
        outcome: scenarios
        ids: [FMT-015/S13, CLI-007/S23, CLI-007/S24, CLI-008/S39]
        reason: Malformed lists, no model left and unfitting refusals are refused
      - item: C6
        outcome: scenarios
        ids: [FMT-015/S2, FMT-015/S11, CLI-007/S18, INS-020/S1, INS-020/S5, INS-008/S1]
        reason: Single-model settings and a role without a model behave as before
      - item: C8
        outcome: scenarios
        ids: [INS-020/S25, INS-020/S26, INS-014/S23, CLI-007/S22]
        reason: "updatedInput model and effort: driving session's live run, Claude Code 2.1.312, 2026-11-23. Effort from 2.1.292 and its precedence: code.claude.com/docs/en/sub-agents.md; levels: model-config.md. Not verified: an unknown effort on an older version (out of scope in INS-020; setup proposes no effort there) and what a refused launch looks like (no step reads it; the main session says so with --refused)"
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models were tried and why each was skipped
      - question: PROP-131#Q2
        value: The stage is offered again with the next model, the skipped model and reason are reported, and no report is recorded
      - new: How does the main session say that a launch was refused?
        value: spec next <ID> --restart --refused <model>; it adds one line to the CLI-001 usage
      - new: Is a refused model remembered for later stages?
        value: No; each later stage starts with the first entry again
      - new: Which command reports the choice per role?
        value: spec detect, in cli.Detection.models; no new command
      - new: Are lists allowed under Astro or other harnesses?
        value: No, one text as before; a list there is an L001 finding
      - new: What does a teammate on Claude Code before 2.1.292 get?
        value: Unverified and out of scope; a local setting of one model text sends no effort
    duration_s: 282
    model: claude
  - at: 2026-11-23T16:21:32.111Z
    role: spec-review
    result: done
    summary: "Refused-launch path can strand a stage: the hook-chosen model is invisible to the session, --refused is unchecked"
    verdict: changes
    findings:
      - cites: [INS-020/S26, INS-020/R1, INS-020/R14, INS-020/S4, CLI-007/R18]
        text: "A refused launch on the hook path can strand the stage, and no scenario closes it. The session's own call is only `spec:TASK-101`; the hook rewrites model and effort in updatedInput (R1), so nothing the session sent or received names the model that was launched. S26 tells it to run `--restart --refused <model>` but never says where it learns <model> (no hook message, no `spec detect` field, no command shows the stage start record). Meanwhile the natural move, sending `spec:TASK-101` again, is denied by S4 as `already has its implementer stage running; do not delegate it again`, and S4 tells the main agent to wait for a subagent that does not exist. S26's Given (`no subagent running it`, `the session saw it refused`) assumes away exactly what has to be shown: how the session learns the refused model, and that a refused first launch is told apart from a running stage. Needs a scenario for the first launch through the hook: either the allow decision or the running denial carries the chosen model (the denial text can say which model this stage was started on and name the `--restart --refused` route), or the skill derives it from a stated source."
        class: C3
      - cites: [INS-020/S26, INS-020/S15, INS-020/R14, INS-014/S26, CLI-007/R10]
        text: S26's trigger is not testable and rests on an external fact that is not verified. Its Given is that an Agent call `returned that its model could not be used`; the writer's own C8 answer says what a refused launch looks like was not checked and that no step reads it. The skill text a tester can assert therefore has no condition for 'refused for its model' versus any other Agent failure (a tool error, a permission denial, an effort or input problem), and S26 does not say the skill must confirm no subagent is running before `--restart --refused`, which CLI-007/R10 and INS-014/R9 require for every restart. A background launch (S1 passes run_in_background true) that errors late would then get a second subagent in the same worktree. Also S26 says to call Agent with task, model and effort only; S15 delegates with a general-purpose subagent and background or foreground by cli.Detection.editMode (INS-017/S2). Say that the retried call keeps those, or the retry runs in a different mode from the first launch. Make the refusal signature an open question or a stated assumption, and add the confirm-no-subagent step.
        class: C8
      - cites: [CLI-007/R18, CLI-007/S22, CLI-007/S24, INV-017]
        text: "`--refused <model>` is checked only for membership in the list (S24), never against the model the stage was started on, which the stage start record already holds (R17). So a stale or mistaken value is accepted: with opus, sonnet, haiku and the stage on opus, `--refused sonnet` skips opus (`before the refused model`) and sonnet and starts haiku, a model that was never refused; `--refused opus` repeated while the stage runs on haiku restarts it on haiku again and stashes its work. The value comes from the session, and a delegated worker running `spec next <ID> --restart --refused <model>` could move its own stage to a cheaper entry (check the INS-014/R2 recursion guard covers --restart). Because the restart writes the chosen model to the start record, the wrong model is then recorded for the stage (PIP-025). Say that `--refused` must name the model the stage was started on, or state what happens otherwise, with a scenario for the mismatch next to S24."
        class: C4
      - cites: [CLI-007/S23, CLI-007/S24, CLI-007/R18, CLI-007/R17, INS-020/S26]
        text: "Two end states leave the stage in progress with no subagent, and neither says what the session does next. (a) S23: `no model left` is reported with opus as `before the refused model`, which misstates why opus was skipped (it was refused in S22; spec just does not remember). Q1 promises the person is told why each model was skipped. The stage start record also still says haiku although nothing ran (S23: 'as they were'). A plain `--restart` after S23 selects opus again (S22 last line), so the loop repeats until the person edits the list. S26 covers only the 'no model left' text and stop. (b) S24: exit 1 `opus is not in the implementer's list` has no skill instruction at all, and a stage that was started on a list that changed mid-run is exactly the case the refusal is for. Add the skill's instruction for both, name the plain `--restart` route for (b), and fix the reason wording in S23 (for example name that the earlier models were already refused)."
        class: C5
      - cites: [INS-020/S25, INS-020/R1, INS-014/S23, INV-019, CLI-007/S22]
        text: "A shared list that carries effort, used by a teammate on Claude Code before 2.1.292, is declared out of scope (`an effort given to a version before 2.1.292: Claude Code`), but it feeds straight into the refused path. If that version rejects an unknown `effort` key in the Agent input, the launch fails for a reason that is not the model; the session reads it as a refusal, runs `--refused opus`, gets haiku with `effort high` too, fails again and reaches S23 with the false reason `refused at launch` on both. INS-014/S23 only proposes effort-free lists on the setup machine, so a teammate with an older Claude Code gets effort from the shared file and has to know to override every role locally with a one-model text. No scenario shows that teammate. Add one: what the hook does, or what the session is told, when the installed Claude Code is older (for example `claude --version` is checked once at the hook, or the session-start line says effort is ignored), or record it as an open question for the person."
        class: C2
      - cites: [FMT-015/R3, FMT-015/S12, FMT-015/S3, INS-014/S38, CLI-007/R18]
        text: "Follow-up: config.local.json over lists is well defined only in the cases S12 shows (a local text replaces a shared list, role by role). Not stated: a local list over a shared text or list, whether a local setting that holds no valid model (all L032) replaces a valid shared list and leaves the role missing (R7 says a role is missing when its setting holds none, not which setting), and which of the two files `--refused` and L030 judge. Also for a spec review that falls back to the reviewer's list (PIP-017/R8): when its own list is used up by a refusal, or it has none and the stage runs on the reviewer's list, `same list` in R18 and the `not in the list` check of S24 are ambiguous."
        class: C1
      - cites: [FMT-015/R8, FMT-015/S13, FMT-002/S1, CLI-001/S1]
        text: "Follow-up: a project whose shared config.json holds lists while a teammate's pinned CLI predates them (a worktree or branch with an older .spec/bin, or a merge of the config without the pin) hits the old schema's L001 on every command, since format.Config accepts no unknown shapes and the format version stays 2. The hook fails closed for a stage request (INS-020/R17) and is silent for others (R11), so nothing is unsafe, but no scenario or message tells that teammate to run `spec upgrade`. File as a follow-up for an upgrade hint in the L001 text when the value is a list."
        class: C2
      - cites: [INS-014/S23, FMT-015/S12, format.Effort, INS-020/S25]
        text: "Follow-up: which models accept which efforts is not cited. S12 pins `sonnet` with `max`, INS-014/S23 proposes `haiku high`, and format.Effort accepts xhigh and max for every alias. If a model rejects a level at launch, every list entry that carries it is refused, the same failure as the older-Claude-Code case above. Verify against model-config.md before the tester pins them."
        class: C8
      - cites: [CLI-007/R18, CLI-007/S22, CLI-008/R13]
        text: "Follow-up: `--restart --refused` under the Astro harness or with no harness (roles are one text there) is not specified; it will reach `no usable entry` or `not in the list` by accident. Say it is a usage error, as `--refused` without `--restart` is. A refusal is not remembered, so in a wave every ticket's stage retries from the first entry; this is the stated preference, but a person without access to the first model pays one failed launch per stage."
        class: C6
    assumed: []
    duration_s: 213
    model: claude
  - at: 2026-11-23T16:24:57.053Z
    role: spec-writer
    result: done
    summary: A per-machine mark replaces --refused; the running denial names the model; effort needs a known version
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [CLI-001/S1, INS-007/S11, PIP-017/S10, PIP-025/S1, FMT-002/S1, INS-010/S1, INS-017/S2, INS-014/S38]
        reason: Impact run this round. CLI-001 is reached only through its round 1 change and is back to its base text; the remembered model stays the alias
      - item: C2
        outcome: scenarios
        ids: [FMT-015/S12, FMT-015/S14, CLI-007/S24, INS-020/S25, INS-008/S7]
        reason: Single text, local over shared, older or unknown Claude Code, Astro
      - item: C3
        outcome: scenarios
        ids: [CLI-007/S22, INS-020/S6, INS-020/S26]
        reason: A model is marked while its stage is in progress; simultaneous requests; a request after a failed launch
      - item: C4
        outcome: invariant
        ids: [INV-020, INV-019, INV-017]
        reason: Forged marks or version text, the call's own model and effort, and the start record's model shown in the denial
      - item: C5
        outcome: scenarios
        ids: [FMT-015/S13, FMT-015/S14, CLI-007/S23, CLI-007/S24, CLI-008/S39, INS-020/S26]
        reason: Malformed settings, all models marked, unknown version, start record that names no valid model
      - item: C6
        outcome: scenarios
        ids: [FMT-015/S2, FMT-015/S11, CLI-007/S18, INS-020/S1, INS-020/S5, INS-020/S22, INS-008/S1]
        reason: Single-model settings, roles without a model and the running denial keep their behaviour
      - item: C8
        outcome: scenarios
        ids: [CLI-007/S24, INS-020/S25, INS-020/S26, FMT-015/S12]
        reason: "updatedInput with model and effort: driving session's live run on Claude Code 2.1.312. Effort from 2.1.292: code.claude.com/docs/en/sub-agents.md. All five levels on Opus, Sonnet and Haiku 5.5 and Fable, and an unsupported level lowered: model-config.md. The output of claude --version: run here, 2.1.312 (Claude Code). What a refused launch looks like and what an older version does with effort were not verified; no step depends on either"
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report
      - new: How is a model marked?
        value: config set unavailableModels.<model> true --local, and false to unmark
      - new: How long may claude --version take?
        value: 3 seconds, then the version counts as unknown
      - new: Which command reports the choice per role?
        value: spec detect, in cli.Detection.models
      - new: What does a teammate whose pinned CLI predates lists see?
        value: The older CLI's L001; an already released CLI cannot be changed
    duration_s: 200
    model: claude
  - at: 2026-11-23T16:28:04.123Z
    role: spec-review
    result: done
    summary: Restart path now closes; S12 ignores the effort version rule and INV-019 overclaims about effort
    verdict: changes
    findings:
      - cites: [FMT-015/S12, CLI-007/R19, CLI-007/S24, CLI-008/S39]
        text: S12 pins effort values (tester 'high', reviewer and spec review 'max') with no Given about the installed Claude Code. Under CLI-007/R19 effort is given only when `claude --version` prints 2.1.292 or later, and otherwise cli.Next.effort is null. S21, S25, S39 and INS-008/S7 all gained that Given; S12 did not. As written the scenario passes or fails with whatever `claude` is on the tester's PATH, and a tester must either fake the version or guess. Add the version Given to S12.
        class: C7
      - cites: [INV-019, INS-020/S25, INS-020/R1, CLI-007/R19]
        text: "INV-019 now says the hook replaces effort only when the role's entry sets one and that 'the model and effort come from the project's config, never from the call'. That is false for effort in two cases the delta itself pins: a role set as one text (S25 second And: updatedInput keeps the effort the call gave, since the hook replaces effort only when cli.Next.effort is set) and a Claude Code of unknown version (S25 third And: no effort from the list, so the call's own effort, if any, is still passed back unchanged under R1's 'whole input unchanged'). The call's effort is then an input from the less trusted party that is passed through, not one spec chooses. Either narrow the sentence to the model plus the effort of a list entry that is sent, and say that any other effort the call carries is passed back as given like every other key, or make R1 drop the call's effort when spec selects none; and say which in S25's third And."
        class: C4
      - cites: [CLI-007/S22, CLI-007/R18, INS-020/S26, INS-008/S7, CLI-008/R13]
        text: "Follow-up: a mark stays until someone unmarks it, and S26 has the session set it after Claude Code's own error said the model cannot be used. A transient failure that fits that wording (a usage limit on opus, an outage) then leaves every later stage on the next entry with nothing to remind the person: the session-start line (INS-008/S7) names only the model selected, and 'none available' only when every entry is marked, and the denial of S4 and S26 names a mark only for a running stage. cli.Detection.models.skipped does carry 'marked unavailable', so `spec detect` shows it. Consider showing a marked model on the Models line, and having the skill tell the person how to unmark it (S26 already says to tell the person the model skipped and why)."
        class: C5
      - cites: [INS-020/S26, INS-020/R19, INV-017, INV-020, CLI-007/S16]
        text: "Follow-up: S26 gives the session the mark and restart commands but is loose in two places a tester will meet. (a) It says to run `config set unavailableModels.opus true --local` 'only when Claude Code's own error said that model cannot be used'; it does not say the model in that error must be the one the denial names (the start record is data any local process can write, INV-017), so a stale or forged record could get a different model marked. State that the skill marks the model the error names, and only when it is the denial's. (b) After the restart it does not say to call Agent with the returned task, model and effort; S16 and R14 do, so one sentence pointing at S16 is enough. The restart path itself checks out end to end: the first denial names the started model, the plain restart takes the next unmarked entry and rewrites the start record (CLI-007/S22, R17), a failed second launch is named from that record by the next request, and S23 leaves the stage, its record and kept report as they were. The earlier blocking findings on the unknown refused model, the unchecked --refused value, the dead ends and the older Claude Code are closed by this design."
        class: C3
      - cites: [CLI-007/R19, CLI-007/S24, INV-020, INS-008/R2]
        text: "Follow-up: the version is read from whatever `claude` is first on the PATH of the hook or shell, not from the Claude Code session that will launch the subagent (a desktop or IDE session, a second install, a PATH the hook does not inherit). INV-020 says the value proves nothing and the fail-safe is no effort, so nothing is unsafe, but a session on 2.1.292 or later can be told effort was not sent, and an older one can be sent it. Say this is the accepted reading. Also say the 3-second wait is once per process: a `spec next --start` listing of several tickets, the hook and the session-start line each run it."
        class: C2
      - cites: [INV-017]
        text: "Follow-up: in INV-017 the edit turned 'in the ticket file and in the history records briefs show' into 'in the ticket file in the history records briefs show' (the 'and' was dropped), and its 'Shown by' line does not cite INS-020/S26, the scenario that shows the denial naming a model only when the start record holds a Claude Code alias."
        class: C9
    assumed: []
    duration_s: 182
    model: claude
  - at: 2026-11-23T16:29:47.866Z
    role: spec-writer
    result: done
    summary: "Round 2 findings: version Given in S12, one statement on effort, and tighter marking of unavailable models"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [CLI-001/S1, INS-007/S11, PIP-017/S10, PIP-025/S1, FMT-002/S1, INS-010/S1, INS-017/S2, INS-014/S38]
        reason: "Impact run in the previous round, not again: this round only edits text of units it already covered, and adds none. CLI-001 holds its base text; the remembered model stays the alias"
      - item: C2
        outcome: scenarios
        ids: [FMT-015/S12, FMT-015/S14, CLI-007/S24, INS-020/S25, INS-008/S7]
        reason: Single text, local over shared, older or unknown Claude Code read from the PATH, Astro
      - item: C3
        outcome: scenarios
        ids: [CLI-007/S22, INS-020/S6, INS-020/S26]
        reason: A model is marked while its stage is in progress; simultaneous requests; a request after a failed launch
      - item: C4
        outcome: invariant
        ids: [INV-020, INV-019, INV-017]
        reason: Forged marks or version text, the call's own effort passed back as given, and the start record's model shown in the denial
      - item: C5
        outcome: scenarios
        ids: [FMT-015/S13, FMT-015/S14, CLI-007/S23, CLI-007/S24, CLI-008/S39, INS-020/S26]
        reason: Malformed settings, all models marked, unknown version, an error that does not name the denial's model
      - item: C6
        outcome: scenarios
        ids: [FMT-015/S2, FMT-015/S11, CLI-007/S18, INS-020/S1, INS-020/S5, INS-020/S22, INS-008/S1]
        reason: Single-model settings, roles without a model and the running denial keep their behaviour
      - item: C8
        outcome: scenarios
        ids: [CLI-007/S24, INS-020/S25, INS-020/S26, FMT-015/S12]
        reason: "updatedInput with model and effort: driving session's live run on Claude Code 2.1.312. Effort from 2.1.292: code.claude.com/docs/en/sub-agents.md. Levels, and an unsupported level lowered: model-config.md. The output of claude --version: run in round 1, 2.1.312 (Claude Code). What a refused launch looks like and what an older version does with effort were not verified; spec parses no launch error, and the session marks only on an error that names the model"
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report
      - new: Which Claude Code version decides whether effort is sent?
        value: The one claude --version on the PATH prints within 3 seconds, at most once per command
      - new: What happens when a launch error does not name the denial's model?
        value: Nothing is marked and the failure goes to the person
    duration_s: 99
    model: claude
  - at: 2026-11-23T16:30:59.825Z
    role: spec-review
    result: done
    summary: Round 2 findings fixed; the round 3 wording edits open no new case
    verdict: approve
    assumed: []
    duration_s: 67
    model: claude
  - at: 2026-11-23T17:00:33.288Z
    role: tester
    result: done
    summary: Model-list tests for CLI-007, FMT-015, CLI-008, INS-008, INS-014, INS-020, PIP-017 and INV-019/020; all new ones fail now
    verdict: null
    mutations:
      - scenario: CLI-007/S21
        wrong: selects the last entry of the list, or leaves the effort out of cli.Next and the text header
      - scenario: CLI-007/S22
        wrong: a restart ignores the local mark and starts on the marked opus again, or leaves the stage start record on opus
      - scenario: CLI-007/S23
        wrong: falls back to a marked model, or starts the stage or the restart when every model is marked
      - scenario: CLI-007/S24
        wrong: sends the effort without checking the claude version, or runs claude once per ticket of a --start
      - scenario: FMT-015/S12
        wrong: uses only the first entry even when it is unsupported, or merges a local list into the shared one instead of replacing it
      - scenario: FMT-015/S13
        wrong: accepts an empty list, a model named twice or an unknown effort in config.json or config.local.json
      - scenario: FMT-015/S14
        wrong: reads unavailableModels from the shared config, or lets a marked spec review take the reviewer's model
      - scenario: CLI-008/S39
        wrong: config set accepts an opus-4 list under --force, or an unavailableModels mark without --local
      - scenario: CLI-008/S7
        wrong: config set --local accepts a key other than delegation and unavailableModels
      - scenario: INS-008/S7
        wrong: prints the Models line in an Astro session, or leaves the skipped models out of it
      - scenario: INS-014/S23
        wrong: setup proposes one model per role and no effort
      - scenario: INS-014/S38
        wrong: the driving skills never pass entry.effort
      - scenario: INS-020/S16
        wrong: the restart gives no effort, or the skills leave entry.effort out
      - scenario: INS-020/S25
        wrong: the hook sends the call's own effort instead of the list's, or drops the call's effort when the list has none
      - scenario: INS-020/S26
        wrong: the running denial names a model from a start record that is not this stage's alias, or omits the mark command for the alias
      - scenario: PIP-017/S10
        wrong: the spec review takes the reviewer's model but not the reviewer's effort, or ignores a mark on the reviewer's first entry
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each (CLI-007/S23, INS-020/S26)
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report (CLI-007/S22)
      - new: "Where does the code find claude --version: the run's env PATH or the process PATH?"
        value: Tests put the fake claude first on both, so either reading works
      - new: Does cli.Detection.models always appear in detect JSON, as an empty list with no harness?
        value: "Yes: the CLI-008/S1 test now expects models: [] in the exact detect output"
      - new: What is 'a config that cannot be read' in INS-008/S7?
        value: A config.json that is not JSON; the test only checks that no Models line is printed
      - new: How are the skills' wording for effort, marks and the starting lists pinned?
        value: "Loosely: entry.effort, unavailableModels, marked unavailable and per-role regexes for the lists; no other wording"
      - new: Is the kept report of CLI-007/S23 checked?
        value: "No: the test checks the stage, its worktree and its start record unchanged, not a kept refused report"
      - new: Which tests cover INV-017, INV-019 and INV-020, which have no scenarios?
        value: INS-020/S26 (INV-017), the INV-019 test in stage-hooks.test.ts, now with a call effort passed back, and a new INV-020 test; mutations are named under their scenarios
      - new: "INS-008/S5 and S6 had no test: do they document current behaviour?"
        value: "Yes: both tests pass on the current code"
      - new: Does CLI-001/S1 need a new test?
        value: "No: the usage text in the spec is unchanged from main, so the existing test stays"
    duration_s: 1768
    model: claude
  - at: 2026-11-23T17:16:41.857Z
    role: implementer
    result: blocked
    summary: Model lists, marks and effort are implemented; one test pins the old number of detect text lines
    verdict: null
    blockers:
      - text: The test for CLI-008/S12 expects split('\n') of the text to have length 9 (eight lines). The scenario says stdout has one line for each detection field, and this ticket adds the field cli.Detection.models, so the text has nine lines and the length is 10.
        cites: [CLI-008/S12, cli.Detection.models]
        tests: true
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report
      - new: What does the one stderr line of CLI-007/R19 say when selected entries of one command set different efforts?
        value: One line naming each effort once, separated by commas
      - new: Does a summary listing check the Claude Code version?
        value: "No: cli.NextSummary shows no effort, so claude is not run"
      - new: What is the exit code of a listing that holds a ticket waiting on marked models?
        value: 1, as for a listed ticket that cannot be prepared
      - new: Where does detect say that an effort was not sent?
        value: On stderr, in the line CLI-007/S24 gives; stdout stays the detection alone
      - new: What does a local config with one malformed key apply?
        value: Nothing from that file until it is fixed, as before; lint reports it
    duration_s: 963
    model: claude
  - at: 2026-11-23T17:29:51.682Z
    role: tester
    result: done
    summary: CLI-008/S12 test now expects ten lines (one per detection field, models included) and the models line
    verdict: null
    mutations:
      - scenario: CLI-008/S12
        wrong: detect text omits the models field's line, or prints it over several lines
    passed: true
    assumed:
      - new: What does the text line of cli.Detection.models hold with no active harness?
        value: "'models: none', since CLI-008/R13 says detect reports none; the spec states no other content of the line, so none is pinned"
    duration_s: 774
    model: claude
  - at: 2026-11-23T17:37:37.397Z
    role: reviewer
    result: done
    summary: Code meets the spec; the skill-text test and the S23 restart test would miss a wrong instruction or a cleared kept report
    verdict: changes
    findings:
      - cites: [INS-020/S26]
        text: "tests/dist.test.ts 'INS-020/S26 Command skills close a failed launch...' would pass with the whole failed-launch bullet of templates/commands/_drive.md deleted, and with a bullet that marks a model on any failure or on a usage limit. Every assertion is met by other text: 'unavailableModels', 'marked unavailable' and 'unavailableModels.<model> false' come from the all-marked bullet, '--local' and 'next <ID> --restart' from older bullets, 'confirm no subagent is still running' from the Relay text. No test checks that the skill marks only when Claude Code's own error names the same model, or that it says to mark nothing and go to the person for another model, none, a usage limit, an outage or any other failure. Assert those clauses in each of feature, change, bug and run, in the failed-launch bullet itself."
        tests: true
        class: C7
      - cites: [CLI-007/S23]
        text: The restart half of tests/cli/model-lists-next.test.ts 'CLI-007/S23' checks the stage start record, the ticket and the worktree count, but never makes a kept refused report or refusal count before the restart, though S23 says the kept report is as it was. A change that clears them before the marked check, for example by running restartTicketStage first, still passes. The code is right (src/cli/next.ts calls markedBlockers before startEntry), only the test is missing. Give the running ticket a kept report and refusal count first, as CLI-007/S11 does, and compare both after the refused restart.
        tests: true
        class: C7
      - cites: [CLI-008/R13, CLI-007/R18, FMT-015/R9]
        text: "Follow-up: `spec detect` run inside a ticket worktree reads that worktree's config.local.json, which does not exist there, so it shows no marks and no local lists, while `spec next` reads the main checkout's (primaryWorkspace) and skips the marked models. Local delegation overrides already behaved this way on the base branch. A `config set ... --local` run with the worktree's root writes only that worktree's file, so a delegated worker cannot change the main checkout's choice, but it does edit the worktree's spec/.gitignore."
        class: C2
      - cites: [CLI-007/R19, CLI-007/S24]
        text: "Follow-up: the 'does not end within 3 seconds' test uses `exec sleep 30`, which leaves no child. I ran the shipped spawnSync options (timeout 3000, SIGKILL, piped stdout) against a `claude` that leaves a `sleep` child holding stdout and then hangs: it returned after 3003 ms with ETIMEDOUT, so the bound holds. A test with a lingering child would pin that. A missing `claude`, a directory or a script that fails all end as 'effort not sent' through the error or non-zero status branch."
        class: C7
    assumed: []
    duration_s: 460
    model: claude
  - at: 2026-11-23T17:47:45.750Z
    role: tester
    result: done
    summary: S26 skill test checks the failed-launch bullet's own clauses; S23 restart test keeps a refused report and two refusals
    verdict: null
    mutations:
      - scenario: INS-020/S26
        wrong: the failed-launch bullet of the driving skills is deleted, or marks a model on a usage limit, an outage or an error that names another model
      - scenario: CLI-007/S23
        wrong: a restart refused for marked models first clears the kept refused report and the refusal count
    assumed:
      - new: How is the failed-launch bullet found in a built skill?
        value: As the line that gives `unavailableModels.<model> true --local`; its clauses are matched loosely a sentence at a time, and the test runs the matcher on copies with the bullet deleted or altered to prove it fails on them
    duration_s: 603
    model: claude
  - at: 2026-11-23T17:56:03.697Z
    role: implementer
    result: done
    summary: "No code change needed: the committed code passes the tester's stricter tests and the bundles match a build"
    verdict: null
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report
      - new: What does the one stderr line of CLI-007/R19 say when selected entries of one command set different efforts?
        value: One line naming each effort once, separated by commas
      - new: Does a summary listing check the Claude Code version?
        value: "No: cli.NextSummary shows no effort, so claude is not run"
      - new: What is the exit code of a listing that holds a ticket waiting on marked models?
        value: 1, as for a listed ticket that cannot be prepared
      - new: Where does detect say that an effort was not sent?
        value: On stderr, in the line CLI-007/S24 gives; stdout stays the detection alone
      - new: What does a local config with one malformed key apply?
        value: Nothing from that file until it is fixed, as before; lint reports it
      - new: Are the reviewer's two follow-up findings part of this ticket?
        value: "No: they are left for a later ticket, and no code changed for them"
    duration_s: 493
    model: claude
  - at: 2026-11-23T18:02:34.914Z
    role: reviewer
    result: done
    summary: S26 skill test now fails for each wrong bullet; the S23 restart test seeds the kept report in a store the restart never clears
    verdict: changes
    findings:
      - cites: [CLI-007/S23]
        text: "The strengthened restart check in tests/cli/model-lists-next.test.ts 'CLI-007/S23' still passes for the mutation 'a restart refused for marked models first clears the kept report and the refusal count'. It seeds the report and refusals with saveReport and bumpReportRefusal on running.repo, the main checkout. The store is under `git rev-parse --git-dir` (src/io/report-store.ts storeDir), which in a linked worktree is <main>/.git/worktrees/TASK-101, not <main>/.git. The stage here was started by `spec next`, so it has a worktree, and the restart works on that worktree's workspace (startEntry takes workspaceAt the worktree, so restartTicketStage clears under the worktree's git dir). A report kept by a refused `ticket advance` also lands there, since advanceStage re-roots into the worktree. A restart that cleared the kept report first would clear the worktree's store and leave the main store, which the test reads, untouched. Verified with git: in a linked worktree rev-parse --git-dir gives <main>/.git/worktrees/<name>. CLI-007/S11 works only because its ticket has no worktree. Seed the kept report and the refusals under the worktree's own root (worktreeOf(running, 'TASK-101')) and read them back there, keeping the 'as they were' assertions."
        tests: true
        class: C7
      - cites: [CLI-008/R13, CLI-007/R18, FMT-015/R9]
        text: "Follow-up: `spec detect` run inside a ticket worktree reads that worktree's config.local.json, which does not exist there, so it shows no marks and no local lists, while `spec next` reads the main checkout's (primaryWorkspace) and skips the marked models. Local delegation overrides already behaved this way on the base branch. A `config set ... --local` run with the worktree's root writes only that worktree's file, so a delegated worker cannot change the main checkout's choice, but it does edit the worktree's spec/.gitignore."
        class: C2
      - cites: [CLI-007/R19, CLI-007/S24]
        text: "Follow-up: the 'does not end within 3 seconds' test uses `exec sleep 30`, which leaves no child. The shipped spawnSync options returned at 3003 ms against a `claude` that leaves a `sleep` child holding stdout and then hangs, so the bound holds; a test with a lingering child would pin that."
        class: C7
    assumed: []
    duration_s: 386
    model: claude
  - at: 2026-11-23T18:11:42.221Z
    role: tester
    result: done
    summary: S23 restart test seeds and reads the kept report and refusals at the stage's worktree root, and shows the clearing functions empty them
    verdict: null
    mutations:
      - scenario: CLI-007/S23
        wrong: a restart refused for marked models first clears the kept refused report and the refusal count of the stage's worktree store
    assumed:
      - new: How is it shown that the two kept-state assertions can fail?
        value: "I did it inside the test, not in a scratch copy of it: after the real assertions it calls clearSavedReport and clearReportRefusals on that same worktree root and asserts the report is then null and the refusals 0; it also asserts the main checkout's store holds no report, so the two stores are told apart"
    duration_s: 542
    model: claude
  - at: 2026-11-23T18:20:14.576Z
    role: implementer
    result: done
    summary: "No code change needed: the corrected CLI-007/S23 restart test passes and the bundles match a build"
    verdict: null
    assumed:
      - question: PROP-131#Q1
        value: The stage does not start; the person is told which models are marked unavailable and how to unmark each
      - question: PROP-131#Q2
        value: The session marks the model on this machine and restarts the stage on the next entry; nothing is recorded as the role's report
      - new: What does the one stderr line of CLI-007/R19 say when selected entries of one command set different efforts?
        value: One line naming each effort once, separated by commas
      - new: Does a summary listing check the Claude Code version?
        value: "No: cli.NextSummary shows no effort, so claude is not run"
      - new: What is the exit code of a listing that holds a ticket waiting on marked models?
        value: 1, as for a listed ticket that cannot be prepared
      - new: Where does detect say that an effort was not sent?
        value: On stderr, in the line CLI-007/S24 gives; stdout stays the detection alone
      - new: What does a local config with one malformed key apply?
        value: Nothing from that file until it is fixed, as before; lint reports it
      - new: Are the reviewer's two follow-up findings part of this ticket?
        value: "No: they are left for a later ticket, and no code changed for them"
    duration_s: 507
    model: claude
  - at: 2026-11-23T18:21:12.703Z
    role: reviewer
    result: done
    summary: The CLI-007/S23 restart test now reads the worktree's own store and would fail a restart that clears it; all items hold
    verdict: approve
    findings:
      - cites: [CLI-008/R13, CLI-007/R18, FMT-015/R9]
        text: "Follow-up: `spec detect` run inside a ticket worktree reads that worktree's config.local.json, which does not exist there, so it shows no marks and no local lists, while `spec next` reads the main checkout's (primaryWorkspace) and skips the marked models. Local delegation overrides already behaved this way on the base branch. A `config set ... --local` run with the worktree's root writes only that worktree's file, so a delegated worker cannot change the main checkout's choice, but it does edit the worktree's spec/.gitignore."
        class: C2
      - cites: [CLI-007/R19, CLI-007/S24]
        text: "Follow-up: the 'does not end within 3 seconds' test uses `exec sleep 30`, which leaves no child. The shipped spawnSync options returned at 3003 ms against a `claude` that leaves a `sleep` child holding stdout and then hangs, so the bound holds; a test with a lingering child would pin that."
        class: C7
    assumed: []
    duration_s: 53
    model: claude
---
People on one project have different providers. The person wants one ordered list of models per stage, shared by the project, and the first one available on this machine chosen automatically, shown at session start and used when a stage starts. Nobody is asked while some listed model is available.

The person's lists (2026-11-23), best first, model then reasoning effort:
- spec-writer: opus medium
- spec-review: gpt-6.1-sol high; sonnet 5.5 high
- tester: sonnet 5.5 high; gpt-6.1-sol high; haiku 5.5 high
- implementer: opus medium; gpt-6.1-sol high; haiku 5.5 high
- reviewer: gpt-6.1-sol high; sonnet 5.5 high
These are the defaults spec proposes at setup; a project may change them, and a person may override them locally. A project's existing single-model delegation setting keeps working and means a list of one.

A command reports, per role, the chosen model and effort and why earlier ones were skipped; session-start shows the same result briefly to the main session. The check sends no model request and is bounded in time; a failed or slow check never blocks a session. No credential is read into output.

Checked on 2026-11-23: codex-cli 0.162.0 has `codex debug models` (help: renders the raw model catalog as JSON); its local model cache lists gpt-6.1-sol with effort high; `codex login status` reports login. Claude Code 2.1.312 has `claude auth status`, but no model listing was found, so an alias there is only known to be usable when launched. Per https://code.claude.com/docs/en/sub-agents.md the Agent tool's model takes only the aliases sonnet, opus, haiku, fable, not a version, and effort can be passed per call from v2.1.292. So sonnet 5.5 and haiku 5.5 are requested as the sonnet and haiku aliases, and the version that ran is recorded when the harness reports it. Not checked: whether a PreToolUse hook may set effort through updatedInput, and whether a listed Codex model is always usable on the account. Verify before depending on either.

Copilot is not installed on the machine this was written on, so its model listing and login check are unverified: out of scope here, and a follow-up.
