---
id: PROP-042
type: proposal
title: The skill passes arguments with an apostrophe intact, and pipeline.Brief.query says what R4 says
status: done
stage: null
touches: [INS-012, PIP-015]
violates: []
depends_on: []
changed: [INS-001/S4, INS-001/S11, INS-005/R2, INS-005/S7, INS-005/S11, INS-005/S12, INS-012, INS-012/R1, INS-012/R3, INS-012/R4, INS-012/R5, INS-012/S1, INS-012/S2, INS-012/S4, INS-012/S5, INS-012/S9, INS-012/S11, INS-012/S12, INS-012/S13, INS-012/S14, INS-012/S15, INS-012/S16, INS-012/S17, PIP-012, PIP-015, PIP-015/R5, PIP-015/S2, PIP-015/S21, install.LoadSkill, install.RoleChange, install.RoleChange.role, install.UpdateRoles, pipeline.Brief, pipeline.Brief.query, pipeline.Brief.stdin]
questions:
  - id: Q1
    kind: blocker
    text: tests/cli/config-and-install.test.ts INS-001/S4 still expects the old injected command with '$0' '$1' --query; the spec now requires the quoted SPEC_ARGUMENTS here-document, and tests/cli/load-skill.test.ts already holds the new INS-001/S4. The old test must be removed or updated.
    default: null
    cites:
      - INS-001/S4
      - INS-012/R3
    answer: "Right: the old INS-001/S4 test in tests/cli/config-and-install.test.ts must go or match the new here-document form; tests/cli/load-skill.test.ts holds the new one. The tester fixes it after the spec-writer's change for Q2."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: 'tests/cli/update-roles.test.ts INS-005/S11 expects update-roles to change only the five command skills; INS-012/S14 requires it to replace <name>-spec/SKILL.md too, so it now also lists .claude/skills/other-spec/SKILL.md. INS-005/S7 and S11 need the follow-up the spec-writer noted. Its changes are kept in git stash "PROP-042 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - INS-005/S11
      - INS-005/S7
      - INS-012/S14
    answer: "Right: INS-005/S7 and S11 must say --update-roles also compares and replaces <name>-spec/SKILL.md, as INS-012/S14 requires. Back to the spec-writer for that, then the tester updates both stale tests."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: 'git stash "PROP-042 implementer: blocked" does not apply to ticket/PROP-042: it conflicts in .claude/skills/spec-spec/scripts/spec.cjs. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: "Applied by hand: every stashed path except the generated bundle .claude/skills/spec-spec/scripts/spec.cjs, which main rebuilt and afterMerge rebuilds again on merge. Stash dropped. Resume."
    raised_by: implementer
history:
  - at: 2026-10-29T21:43:24.671Z
    role: spec-writer
    result: done
    summary: Skill and commands send arguments to spec brief --stdin via a quoted here-document; Brief.query says what R4 says.
    verdict: null
    assumed:
      - new: Does Claude Code replace $ARGUMENTS as plain text, with no escaping of its own, in both the inline command form and a fenced multi-line command block? Not verified; only the shell side was reproduced in bash.
        value: "Yes: the arguments land verbatim between the here-document lines, so every character reaches spec brief unchanged (INS-012/R4)"
      - new: Is a text containing a line that is exactly SPEC_ARGUMENTS worth handling?
        value: "No: it ends the here-document early and is named as the one text that cannot be sent (INS-012/R4)"
      - new: "Today the bare skill command breaks on an apostrophe. Reproduced in sh: '...what's a gate...' fails with unexpected EOF. Double quotes keep the apostrophe but drop the inner double quotes, expand $HOME and run backticks. Without quotes it also breaks."
        value: Use a quoted here-document on standard input, which passed all of apostrophe, double quote, dollar sign, backtick, backslash and parentheses unchanged under sh, bash and zsh
      - new: Should spec init --update-roles also replace the project's own <name>-spec/SKILL.md? Today it compares and replaces only the five command skills, and init never overwrites.
        value: Yes, as the ticket asks (INS-012/S14); INS-005/S7 and S11, which speak of five command skills, are not changed here and need that follow-up
      - new: Should INS-001/S4 and the pipeline module's Owns line, outside the ticket's touches, change too?
        value: INS-001/S4 changed because its one-line body would be false; the pipeline _module.md Owns line is left as it is
    duration_s: 527
  - at: 2026-10-30T00:41:55.788Z
    role: tester
    result: done
    summary: Tests for here-document skill args, real sh run of the injected command, brief --stdin, init and update-roles; all fail now.
    verdict: null
    assumed:
      - new: "How does the installed SKILL.md inject a multi-line command: a ```! fenced block or inline?"
        value: Tests accept a ```! block, else the inline !`...` form, and require a quoted SPEC_ARGUMENTS here-document with $ARGUMENTS on its own line
    duration_s: 785
  - at: 2026-10-30T00:51:12.335Z
    role: implementer
    result: blocked
    summary: Code done; two stale tests, INS-001/S4 and INS-005/S11, contradict the new spec and are the tester's to change.
    verdict: null
    assumed: []
    duration_s: 556
  - at: 2026-10-30T00:51:17.776Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-042#Q2
    verdict: null
    assumed: []
  - at: 2026-10-30T00:53:37.754Z
    role: spec-writer
    result: done
    summary: INS-005/S7, S11 and install.UpdateRoles, RoleChange.role now include .claude/skills/<name>-spec/SKILL.md
    verdict: null
    assumed:
      - new: Which install.RoleChange.role and which place in install.RoleUpdate.changed does the project's skill get?
        value: Its folder name, such as shop-spec, after the role prompts and before the command skills, as the implementer's stashed code does
    duration_s: 139
  - at: 2026-10-30T01:00:46.529Z
    role: tester
    result: done
    summary: INS-005/S7 and S11 updated for the project skill; the old INS-001/S4 test removed; new tests still fail as expected.
    verdict: null
    assumed: []
    duration_s: 428
  - at: 2026-10-30T01:10:43.286Z
    role: implementer
    result: done
    summary: Skill and commands pass arguments via a quoted here-document to brief --stdin; update-roles refreshes the skill; suite passes.
    verdict: null
    assumed: []
    duration_s: 553
  - at: 2026-10-30T01:24:19.289Z
    role: reviewer
    result: done
    summary: "Changes needed: delimiter collisions execute argument text; update-roles permits name-based path traversal."
    verdict: changes
    findings:
      - cites:
          - INS-012/R1
          - INS-012/R3
          - INS-012/R4
        text: templates/SKILL.md:8 and templates/commands/{bug,change,feature}.md:11 use a fixed delimiter. In sh, bash and zsh, an argument consisting of SPEC_ARGUMENTS sends empty stdin to brief and exits 127; a payload with before, SPEC_ARGUMENTS and printf DELIMITER_TAIL_REACHED on successive lines sends only before plus a newline, executes printf, then exits 127. R4 acknowledges truncation, but R1 still requires loading never to fail and to run only brief. Reconcile these guarantees and specify collision-safe argument transport with a delimiter-collision scenario; the current exception does not define or safely resolve execution of request text.
        spec: true
      - cites:
          - INS-002/R1
          - INS-005/S11
          - install.UpdateRoles.name
        text: src/cli/init.ts:113 adds a writable path using unchecked --name; the slug check at line 159 is bypassed by the update-roles return at line 155. An in-memory run of --update-roles --name ../../spec/roles/ --yes exits 0 and writes spec/roles/-spec/SKILL.md. Additional parent segments can place the new target outside the repository. This newly added write violates the project-name slug rule and can touch spec/roles beyond the allowed role prompts. Validate the name before either init mode constructs paths or writes, and add traversal regressions.
    assumed: []
    duration_s: 815
  - at: 2026-10-30T01:27:35.668Z
    role: spec-writer
    result: done
    summary: Skill execs spec brief with a long here-doc delimiter, so argument text never runs; update-roles validates --name
    verdict: null
    assumed:
      - new: How should the spec reconcile a fixed here-document delimiter with R1, given that text holding the delimiter line could run as shell commands?
        value: "Option (c), which combines (a) with exec: the command is exec spec brief --stdin with the quoted delimiter SPEC_ARGUMENTS_4b7e2c9d_END. Real runs of today's dist/spec under sh, bash, zsh and an eval wrapper: the old form ran the payload (touch PWNED) in all of them; with exec nothing after spec brief ran in any of them, and a collision only cuts the text at that line. The one remaining failure, named in R4: under zsh, which parses the whole command first, a broken line after the delimiter makes the load exit 1 with nothing run. Option (b) was rejected: the brief would no longer load into the context, and quoting would move to the agent, where the original apostrophe bug came from"
      - new: Does Claude Code run the fenced command block in a way that exec does not break, for example with a cwd capture after it?
        value: Assumed yes, not verified in Claude Code itself; an eval wrapper followed by && pwd -P exited 0 in sh, bash and zsh
      - new: Where does the --update-roles name check go?
        value: INS-005/R2 and S12, with install.InvalidName added to install.UpdateRoles' outputs; INS-002 is left as it is, and R2 cites INS-002/R1 for the slug
    duration_s: 196
  - at: 2026-10-30T01:34:23.860Z
    role: tester
    result: done
    summary: Tests moved to the exec form and new delimiter; added INS-012/S15 and S16 across sh, bash and zsh, and INS-005/S12.
    verdict: null
    assumed: []
    duration_s: 408
  - at: 2026-10-30T01:44:59.940Z
    role: implementer
    result: done
    summary: Injected command is now exec with delimiter SPEC_ARGUMENTS_4b7e2c9d_END; update-roles refuses a non-slug --name before reading or writing.
    verdict: null
    assumed: []
    duration_s: 635
  - at: 2026-10-30T01:59:06.300Z
    role: reviewer
    result: done
    summary: Shell and traversal fixes pass; exec-based skill injection lacks a matching documented permission rule.
    verdict: changes
    findings:
      - cites:
          - INS-001/S4
          - INS-001/S11
          - INS-012/R1
          - INS-012/R3
        text: "templates/SKILL.md:5 still allows Bash(${CLAUDE_SKILL_DIR}/scripts/spec *) but line 8 now starts exec; src/core/commands.ts:16 similarly emits bare-script rules for the three exec-based command skills, and all four installed copies retain them. Under Claude Code's documented whole-command wildcard matching these rules do not match the exec prefix; its fixed stripped-wrapper list does not include standalone exec (https://code.claude.com/docs/en/permissions#wrappers). Newline matching does not resolve this prefix mismatch. Live loader approval is unverified, so undocumented exec stripping cannot establish that the skills load. Reconcile INS-001's prescribed permissions with INS-012's mandatory exec command: explicitly authorize the exec brief --stdin form alongside ordinary CLI calls, update the generated and installed rules, and verify loader approval rather than only shell execution."
        spec: true
    assumed: []
    duration_s: 846
  - at: 2026-10-30T02:04:09.932Z
    role: spec-writer
    result: done
    summary: Skill and command skills also allow Bash(exec <cli> brief --stdin *); live loader approval left as an assumption
    verdict: null
    assumed:
      - new: Which rule text allows the exec form, and on which skills?
        value: Bash(exec <cli> brief --stdin *), with a space before the *, after the existing Bash(<cli> *) and comma-separated on the one allowed-tools line, on the main skill and all five command skills, so the code keeps one rule for every command skill
      - new: Does Claude Code approve the injected multi-line here-document command by Bash(exec <cli> brief --stdin *) without a prompt?
        value: Assumed yes, but this can be checked only in a live Claude Code session (INS-012/R5). The permissions docs say Bash rules match the whole command text with * standing for any text; that newlines are command separators; that only timeout, time, nice, nohup, stdbuf, command, builtin, noglob and bare xargs are stripped, so exec is not; that here-docs are not checked as redirect targets; and that exec wrappers such as watch, setsid, ionice and flock cannot be approved by a prefix rule. They do not say whether a here-document's body lines count as separate commands, or whether the exec builtin is one of those exec wrappers. Either would make the load prompt
      - new: Should the project settings allow list (INS-003) also get the exec rule?
        value: "No, not changed here: the ticket names only the skills' allowed-tools, and INS-003 is in the re-verify ring"
    duration_s: 302
  - at: 2026-10-30T02:10:29.221Z
    role: tester
    result: done
    summary: INS-001/S4 and S11 expect the two-rule allowed-tools line; INS-012/S17 added for the skill and three commands.
    verdict: null
    assumed: []
    duration_s: 379
  - at: 2026-10-30T02:20:07.842Z
    role: implementer
    result: done
    summary: Skill and all five command skills now allow both Bash(<cli> *) and Bash(exec <cli> brief --stdin *); assets and installed copies updated.
    verdict: null
    assumed: []
    duration_s: 578
  - at: 2026-10-30T02:28:11.697Z
    role: reviewer
    result: done
    summary: "Approved: permission rules align; 56 focused tests and shell, stdin and traversal checks pass."
    verdict: approve
    assumed: []
    duration_s: 483
---
Found by PROP-019's third review.

1. templates/SKILL.md and templates/commands/{bug,change,feature}.md wrap $ARGUMENTS in single quotes in the command they inject, so a question with an apostrophe ("what's a gate") breaks the shell command and the skill loads nothing. Pass the arguments so any text reaches spec brief unchanged, apostrophes and double quotes included, and installed skills get the fixed form on init and --update-roles.
2. The pipeline.Brief.query contract still says the query is searched when it names no role. Since PROP-019, R4 and S17-S20 say a lone unit, module, ticket or term given again as the query is shown. Make the contract say the same.
