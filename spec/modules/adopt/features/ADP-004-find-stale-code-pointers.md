---
id: ADP-004
title: Find code pointers no code file holds
module: adopt
status: active
---
## Intent
A contract's `Code:` line points at the symbol that implements it. When the code renames or deletes that symbol the pointer goes stale, so `spec gaps` lists every pointer whose symbol no code file holds. The check is by words, so it catches drift, not proof that the name still means the same thing. It reads only the project's own code: files the code globs name and the test globs do not, and in a Git work tree only files Git does not ignore, so build output and installed packages neither count nor stop the check.

## Behaviour
### S1: A renamed symbol
Given the contract "providers.StreamReply" with the line "Code: streamReply"
And the config's codeGlobs is ["src/**"] and no file under src/ holds the word "streamReply" any more
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then the output holds "## Code pointers not found (1)" and then "- providers.StreamReply Code: streamReply (update the Code: line, or the code)"
And adopt.GapReport.codeNotFound is one adopt.CodeGap with id "providers.StreamReply" and code "streamReply" in JSON

### S2: Owner and name in one file
Given the contract "alpha.MakeWidget" with the line "Code: Factory.makeWidget(size)"
And the only code file is "class Factory {\n  makeWidget() {}\n}"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is []

### S3: The name alone is not enough
Given the contract "alpha.MakeWidget" with the line "Code: Factory.makeWidget(size)"
And the only code file is "// makeWidget was removed years ago"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is one adopt.CodeGap with id "alpha.MakeWidget" and code "Factory.makeWidget"

### S4: Only the last two parts count
Given the contract "alpha.MakeWidget" with the line "Code: shop.Factory.makeWidget"
And one code file holds the words "Factory" and "makeWidget" but not "shop"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is []

### S5: Test files do not count
Given the contract "providers.StreamReply" with the line "Code: streamReply"
And the config's testGlobs is ["tests/**"] and only "tests/helpers.ts" holds the word "streamReply"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound holds "providers.StreamReply"

### S6: No code globs
Given the config's codeGlobs is []
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is null
And no "## Code pointers not found" section is printed in text

### S7: Every pointer found
Given every contract's Code: line names a symbol a code file holds
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then no "## Code pointers not found" section is printed
And adopt.GapReport.codeNotFound is [] in JSON

### S8: A removed contract is not checked
Given the contract "alpha.MakeWidget" with status removed and the line "Code: Factory.makeWidget"
And no code file holds "makeWidget"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound does not hold "alpha.MakeWidget"

### S9: A file Git ignores does not count
Given the contract "providers.StreamReply" with the line "Code: streamReply" and the config's codeGlobs is ["src/**"]
And the project is a Git work tree whose ".gitignore" lists "src/generated/", and only "src/generated/stream.ts" holds the word "streamReply"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is one adopt.CodeGap with id "providers.StreamReply" and code "streamReply" (R1)

### S10: An untracked file Git does not ignore counts
Given the contract and codeGlobs of S9, in a Git work tree where only "src/new.ts", which no commit holds and no ignore rule matches, holds the word "streamReply"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is [] (R1)

### S11: A large ignored tree does not stop the check
Given the contract "providers.StreamReply" with the line "Code: streamReply" and the config's codeGlobs is ["packages/**"]
And the project is a Git work tree whose ".gitignore" lists "build/", the committed file "packages/app/src/reply.ts" holds the word "streamReply", and "packages/app/build/" holds thousands of files that together are larger than the memory the command runs with
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then cli.CommandResult.exitCode is 0 and adopt.GapReport.codeNotFound is [] (R3)

### S12: Outside a Git work tree ignore files are not read
Given the contract and codeGlobs of S9, in a project that is in no Git work tree, whose ".gitignore" lists "src/generated/", and where only "src/generated/stream.ts" holds the word "streamReply"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is [] (R2)
But when the only file holding "streamReply" is instead "src/node_modules/lib/stream.ts", that file does not count, since the walk skips every folder named "node_modules", so adopt.GapReport.codeNotFound is one adopt.CodeGap with id "providers.StreamReply" and code "streamReply" (R2)

### S13: Git cannot list the files
Given the Git work tree of S9, but the git command cannot run because it is not on the PATH
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is [], since "src/generated/stream.ts" counts as it does outside a Git work tree (R2)

### S14: A project inside a larger Git work tree
Given the project root is the folder "app" of a Git work tree, with the contract of S9, the config's codeGlobs ["src/**"], and "app/.gitignore" listing "src/generated/"
And the committed file "app/src/stream.ts" holds the word "streamReply"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.codeNotFound is [], since paths are matched against the globs relative to the project root (R1)
And when "streamReply" is instead held only by "app/src/generated/stream.ts", adopt.GapReport.codeNotFound holds "providers.StreamReply" (R1)

### S15: A tracked file deleted from disk
Given the contract and codeGlobs of S9, in a Git work tree where the committed file "src/old.ts" was the only file holding the word "streamReply" and has since been deleted from disk, uncommitted
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then cli.CommandResult.exitCode is 0 and adopt.GapReport.codeNotFound holds "providers.StreamReply" (R1)

## Rules
- R1: In a Git work tree, the check reads only files whose path relative to the project root matches a code glob and no test glob, and that Git lists as tracked or as untracked and not ignored (`git ls-files --cached --others --exclude-standard`); a file Git ignores never counts and is never read, even when a code glob matches it; a listed file that is gone from disk or cannot be read is skipped
- R2: Outside a Git work tree, or when Git cannot list the project's files, the check walks the folders under the project root, skipping every folder named `node_modules` or `.git`, without reading any ignore file, and reads only those whose path matches a code glob and no test glob
- R3: Files are chosen by path before any is read, so files the check does not count never stop it, however many or large they are

## Out of scope
- The warning `spec lint --ci` gives for the same pointer (L024): the lint module
- The check runs whether or not the tests run: `--no-tests` does not skip it
