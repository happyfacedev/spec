---
id: SET-002
title: Manage API keys
module: settings
status: active
writes: [settings.ApiKey]
invariants: [INV-002]
---
## Intent
Let the user add and delete the API key of a provider, without ever showing the secret again.

## Behaviour
### S1: Add a key
Given no settings.ApiKey exists for "gpt"
When the user adds the key "sk-gpt-1234" for "gpt"
Then settings.ApiKey holds "sk-gpt-1234" for "gpt"
And the key is shown masked as "****1234"

### S2: Delete a key
Given settings.ApiKey exists for "gpt"
When the user deletes the key for "gpt"
Then settings.ApiKey holds no key for "gpt"
And no masked key is shown for "gpt"

## Rules
None

## Out of scope
- Validating a key against the provider
- What happens to an enabled provider whose key is deleted
