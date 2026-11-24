---
id: PROP-086
type: proposal
title: The pinned CLI under .spec/bin is a governed path
status: absorbed
absorbed_into: PROP-085
stage: null
touches: [INS-015]
violates: []
depends_on: [PROP-084]
changed: []
questions: []
history: []
---
Found by PROP-084's spec-writer. `.spec/bin/spec` and `.spec/bin/spec.cjs` are not governed paths by default (INS-015/R1), so a base-branch commit that changes the pinned bundle needs no ticket. Every self-hosted check, `verify-history` and `lint --ci` included, then runs whatever bundle is checked out. Change: `.spec/bin/**` is governed. Commits that change it go through a ticket, `spec upgrade` (under a spec-owned marker, as ticket filing does) or a bypass, and verify-history treats an unmarked change to it as an offender.
