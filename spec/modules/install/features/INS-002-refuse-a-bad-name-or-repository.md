---
id: INS-002
title: Refuse a bad project name or repository
module: install
status: active
retired: [S3]
---
## Intent
The project name is recorded in spec/config.json, so it must be a lowercase slug. Init checks its arguments before it writes anything.

## Behaviour
### S1: A name with capitals is refused
Given an empty folder "repo"
When the user runs `spec init repo --name Shop` through install.Init
Then the command fails with install.InvalidName, stderr starting "--name is a lowercase slug, such as chat; not Shop"
And it exits 2
And nothing is written in "repo" (R1)

### S2: A name that does not start with a letter is refused
Given an empty folder "repo"
When the user runs `spec init repo --name 1shop` through install.Init
Then the command fails with install.InvalidName
And it exits 2 (R1)


### S4: A repository that does not exist is refused
Given the working directory has no folder "nowhere"
When the user runs `spec init nowhere --name shop` through install.Init
Then the command fails with install.NotADirectory, stderr starting "<absolute path of nowhere> is not a directory"
And it exits 2
And no folder "nowhere" is created

### S5: A file is not a repository
Given the working directory holds a file "notes.txt"
When the user runs `spec init notes.txt --name shop` through install.Init
Then the command fails with install.NotADirectory
And it exits 2

### S6: The name is required
Given an empty folder "repo"
When the user runs `spec init repo` through install.Init
Then the command fails with cli.UsageError, stderr starting "usage: spec init <repo> --name <project>" followed by the usage text
And it exits 2

### S7: The repository is required
When the user runs `spec init --name shop` through install.Init
Then the command fails with cli.UsageError
And it exits 2

### S8: Letters, digits and hyphens are accepted
Given an empty folder "repo"
When the user runs spec init repo --name my-shop2 through install.Init
Then it exits 0
And spec/config.json has name "my-shop2"
And the CLI is installed at .spec/bin/spec

### S9: An underscore is accepted in a project slug
Given an empty folder "repo"
When the user runs spec init repo --name chat_app through install.Init
Then it exits 0
And spec/config.json has name "chat_app"
And the CLI is installed at .spec/bin/spec (R1)

## Rules
- R1: A project name matches `^[a-z][a-z0-9_-]*$`

## Out of scope
- A name that ends with or repeats hyphens: accepted as it is
