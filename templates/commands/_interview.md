The injected brief above is required. If it is missing, if the harness does not run `!` blocks (as in Astro), run `{cli} brief --stdin` yourself with the user request as stdin before asking questions.

How to ask:
- Read what the spec already says before asking anything. Never ask what the spec answers.
- Ask one question at a time, only about something that changes behaviour: inputs, outputs, limits, errors, what happens at the edges. Offer the likely answers as choices when you can.
- Never invent behaviour. What the user does not know becomes a question on the ticket: a `blocker` if the answer could change behaviour, a `preference` with a `default` if a reversible default is safe.
- Stop asking once every Then step could be written with a concrete value a test can check.
- If no one can answer, record every open point as a question on the ticket and continue.

How to file it:
- First check that no ticket already covers it: `{cli} queue`, and `{cli} show <ticket ID>` for any that looks close. If one does, tell the user its ID and file nothing.
- Name units by their IDs: features (`PRV-002`), scenarios (`PRV-002/S3`), contracts (`providers.ProviderConfig`, or a field when only it changes). Check each with `{cli} show <ID>`; search with `{cli} find <words>`.
- Write the ticket as JSON to a file with your file tool in the session scratch directory, then run `{cli} ticket new --dry-run <file>`. Fix what the gate reports (an unknown ID, a scope gap), then run `{cli} ticket new <file>`. Open questions may stay open: they are for the user.
  The JSON: `{ "type", "title", "touches": [IDs], "violates": [scenario IDs], "depends_on": [ticket IDs], "questions": [{ "kind": "blocker" | "preference", "text", "default", "cites": [IDs] }], "body": "what the user wants, in their words" }`.
- `depends_on` is only for a ticket whose result this one needs, for example a contract it adds. Tickets that change the same files or features do not depend on each other: `{cli} plan` keeps conflicting tickets apart, and merging resolves shared files.
- Show the user the ticket ID, what it touches, its reach (`{cli} impact <ID>`), and its open questions. Ask whether to start it. After yes, follow Driving a ticket below.
