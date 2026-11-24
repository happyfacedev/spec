---
id: PROP-054
type: proposal
title: spec ticket answer keeps the comments in the ticket it rewrites
status: absorbed
absorbed_into: PROP-052
stage: null
touches: [TKT-002]
violates: []
depends_on: [PROP-051]
changed: []
questions: []
history: []
---
Candidate bug from PROP-051's review, already on main before that ticket. `spec ticket answer` loses comments in the ticket file when it rewrites the answered question, though TKT-002 says rewrites keep the file's comments and spacing. A comment anywhere in the frontmatter, including inside or after the answered question's record, survives an answer exactly where it was.

Also from PROP-051 (merged without them under the proportionate review bar): add raw-text tests that a single- or double-quoted `questions`/`history` key with a commented flow list keeps its flow style and comments on `ticket answer` and on a stage append. PROP-051's code handles them; only the tests are owed.
