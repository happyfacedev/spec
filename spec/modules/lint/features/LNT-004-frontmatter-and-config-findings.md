---
id: LNT-004
title: Report broken frontmatter and config (L001)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
L001 is the schema rule: a file lint cannot read as the format says, a frontmatter key that is missing, unknown or of the wrong kind, and a `config.json` that is missing, invalid or of another format version. Each scenario starts from the base spec of LNT-001 and runs lint.Lint; a finding is given as its severity, rule, file, line and unit, then its message and fix. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A status that is not one of the statuses
Given the base spec with "status: live" on line 5 of the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 5, id "ALP-001" (R1)
And its message is "status: Invalid option: expected one of ''active''|''deprecated''|''removed''"
And its fix is "use one of: active, deprecated, removed"

### S2: An unknown frontmatter field
Given the base spec with "owner: bob" on line 6 of the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 6, id "ALP-001", message "unknown field owner in feature", fix "remove owner or fix its spelling" (R1)

### S3: A required field is missing
Given the base spec with the "title" line removed from the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 1, id "ALP-001", message "feature is missing required field title", fix "add title to the frontmatter" (R1)

### S4: A file with no frontmatter
Given the base spec with the frontmatter block removed from "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 1, id null, message "feature has no YAML frontmatter", fix "start the file with a --- frontmatter block" (R1)
And it also holds the "L008" error the lost "ui" link causes, on line 10, since the scenario still shows the screen

### S5: Frontmatter that is not valid YAML
Given the base spec with "title: [Make" on line 4 of the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds an error "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 4, id null, whose message starts with "invalid YAML: " and whose fix is "fix the YAML syntax" (R1)

### S6: No config.json
Given the base spec without "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "the spec has no config.json", fix "add config.json; spec init writes a starter" (R1)

### S7: config.json is not JSON
Given the base spec with "{" as the whole of "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly one error "L001" at "config.json" line 1, id null, whose message starts with "config.json is not valid JSON: " and whose fix is "fix the JSON syntax" (R1)

### S8: A config value of the wrong type
Given the base spec with "baseBranch": 3 in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json baseBranch: Invalid input: expected string, received number", fix "match the config schema in the README" (R1)

### S9: An unknown config key
Given the base spec with "extra": 1 in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, fix "match the config schema in the README" (R1)
And its message is "config.json (root): Unrecognized key: ''extra''"

### S10: config.json has no formatVersion
Given the base spec without "formatVersion" in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json has no formatVersion; this spec CLI reads format 2" (R1)
And its fix is "migrate the spec to format 2 (docs/FORMAT.md, ''From format 1''), then add ''formatVersion'': 2"

### S11: An older format version
Given the base spec with "formatVersion": 1 in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json is format 1; this spec CLI reads format 2", fix "migrate the spec (docs/FORMAT.md), then set ''formatVersion'': 2" (R1)

### S12: A newer format version
Given the base spec with "formatVersion": 3 in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json is format 3, newer than this spec CLI (format 2)", fix "update the spec CLI" (R1)

### S13: No test command
Given the base spec without "testCommand" in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json testCommand: Invalid input: expected string, received undefined", fix "match the config schema in the README" (R1)

### S14: A project name that is not a slug
Given the base spec with "name": "My App" in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json name: Invalid string: must match pattern /^[a-z][a-z0-9_-]*$/", fix "match the config schema in the README" (R1)

### S15: A budget of zero
Given the base spec with "budgets" set to "{ ''size.feature'': 0 }" in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json budgets.size.feature: Too small: expected number to be >0", fix "match the config schema in the README" (R1)

### S16: A command store without its command
Given the base spec with "tickets" set to "{ ''adapter'': ''command'' }" in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "config.json" line 1, id null, message "config.json tickets: Invalid input", fix "match the config schema in the README" (R1)

### S17: An unknown field in a module
Given the base spec with "depends_on: [alpha]" on line 6 of the frontmatter of "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/beta/_module.md" line 6, id "beta", message "unknown field depends_on in module", fix "remove depends_on or fix its spelling" (R1)

## Rules
- R1: Every L001 finding about frontmatter or config.json is an error

## Out of scope
- Which keys each frontmatter and config.json may hold: format
- A ticket's frontmatter: its findings carry L020 (LNT-014)
