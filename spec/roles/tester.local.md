Follow the patterns of the existing tests in `tests/` and reuse `tests/helpers.ts`. Where a contract has no `Code:` line, drive the behaviour the way a user would: through the CLI entry point `run` in `src/cli/run.ts`, on a spec built with the helpers (`baseWith`, `fixtureWith`, `gitFixture`), and check its printed output, exit code and the files it writes. A new command then fails as unknown without any stub.

Before you finish, run `npm run lint` and `npm run typecheck` and fix everything they report in your test files: the implementer may not change test files, so a lint error you leave blocks the ticket.

The allowed shell commands in this project are the full spec path (`.spec/bin/spec`), `npm test`, `npm run lint`, `npm run typecheck`, `npx vitest run …`, `git status`, `git diff` and `git log`. Change files only with your edit tools, never through the shell.
