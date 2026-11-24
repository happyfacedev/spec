---
id: FMT-013
title: Define shared words in the glossary
module: format
status: active
---
## Intent
The glossary gives each word the project shares one meaning. A term is found by its name or any alias, in any case, and the CLI notes which features use it.

## Behaviour
### S1: A term is found by its name in any case
Given "core/glossary.md" has, from line 3, the heading "### Widget", the line "A small thing that alpha makes." and the line "Aliases: widgets"
When `spec show "widget"` runs
Then the output is "core/glossary.md:3", a blank line, and the three lines of the entry (R1)
And format.Term.term is "Widget"

### S2: A term is found by an alias
Given the term "Widget" has format.Term.aliases "widgets"
When `spec show "WIDGETS" --format json` runs
Then it prints "id" "Widget", "type" "term" and "status" null (R1)

### S3: The features that use a term
Given the term "Order" and the feature "BET-001" whose body says "Let the user order a widget once it is made"
And no other feature's body holds the word
When `spec build` writes "_generated/graph.json"
Then its "terms" entry for "Order" has "usedBy" ["BET-001"] (R2)

## Rules
- R1: Each "### <Term>" heading in core/glossary.md or core/glossary/*.md is a term: a definition, then an optional "Aliases: a, b" line. A term is looked up by its name or an alias, ignoring case.
- R2: A feature uses a term when its body holds the term or an alias as a whole word, in any case.

## Out of scope
- Glossary entry size: lint
