# Conventions

## Scenario style

A scenario is one paragraph of step lines. Every line starts with Given, When, Then, And or But. Each scenario has at least one When and at least one Then. Each Then states a value a test can check.

Steps write contract and screen IDs verbatim, and so link the feature to what it reads, calls, consumes and emits. The frontmatter lists only `writes`, `provides` and `observes`, each written in at least one step. A quoted string is data, never an ID: `Then the export is "vendor.Cancelled"` names no contract.

This spec is about specs, so its steps are full of example IDs, file paths and command lines. Write each of them inside double quotes, on one line: `When the developer runs "spec show \"PRV-002/S3\""` is better written `When the developer runs spec show on "PRV-002/S3"`. Backticks and fenced blocks do not stop an ID from being a cite. Inside a quoted value, write an inner double quote as `''`: two single quotes stand for one double-quote character, never for single quotes, so `"listed ''notes''"` means the output `listed "notes"`. Write a value that changes from run to run as a placeholder in angle brackets: `<time>`, `<abbreviated HEAD>`, `<major>.<minor>.<patch>`.

## Member names

This product's interface is its files and its output, so a member is named exactly as a user writes or reads it there: `tickets.Ticket.depends_on` (a YAML key), `format.Config.testCommand` (a JSON key), `lint.Finding.rule`. A command-line flag is written in lowerCamel, since an ID cannot hold a hyphen: `--no-tests` is `adopt.Gaps.noTests`, `--dry-run` is `tickets.TicketNew.dryRun`. A member with no spelling in any file or output uses lowerCamel too. A member ID never changes.

## Finding classes

Every finding of a review, the reviewer's or the spec review's, names the class of case it is about, as `class:` in the report. The classes are defined here once; the review prompts, `check-report` and `spec stats` use the same list.

- C1 neighbours: the change breaks or ignores a feature next to it.
- C2 environment axes: a path form, install layout, version, platform or older state the change does not handle.
- C3 concurrency and ordering: two things happen at once, or in another order, and the change does not say what then.
- C4 trust boundaries: input that crosses a boundary is trusted without saying who may set it.
- C5 fail closed: unknown, missing or unverifiable input is let through.
- C6 preserved behaviour: behaviour on an unchanged path changes.
- C7 tests that cannot fail: a test passes whatever the code does.
- C8 external facts: a fact about another tool or service is assumed, not verified.
- C9 text and docs: a message, prompt or document is wrong or stale.
- other: none of these.

## Error model

A command that fails because of the user's input prints a message on stderr that says what to do next, and exits non-zero: 1 when the command ran and found a problem (a lint error, a refused gate), 2 when the command line itself is wrong. A failure inside the tool itself prints `spec: internal error:` and exits 2. There are two exceptions. `spec brief` always exits 0 and prints its failure on stdout, because a failing injected command aborts a Claude Code skill. `spec hook` exits 2 to tell Claude Code to block the tool call, as the harness's hook protocol requires.

A lint finding has a stable rule code (`L004`), a file and line, and a severity (error or warning). `spec lint` exits 1 when any finding is an error, with or without `--ci`; `--ci` adds checks, it does not change what fails.

Each failure a scenario checks is a `Kind: error` contract, and the step that fails with it names it: "Then the command fails with cli.UnknownCommand". A wrong command line is `cli.UsageError` in every module.
