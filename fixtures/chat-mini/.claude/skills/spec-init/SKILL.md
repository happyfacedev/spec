---
name: spec-init
description: Build chat's spec with the user. With no code yet, interview the user from scratch; with existing code, draft the spec from the code, tests and docs, then confirm every part with the user. Use to start a spec, or to continue one that still has gaps.
argument-hint: [what the project is, or documents to read]
allowed-tools: Bash(.claude/skills/chat-spec/scripts/spec *)
---
# /spec-init: build the spec with the user

What the spec holds and lacks now:

!`.claude/skills/chat-spec/scripts/spec gaps --no-tests`

The spec is the source of truth for what the software does. Every part must be something the user agreed to. You write the files; the user decides what they say.

## 1. Set up

- Ask the user how deep to go: **draft fast** (the main features now, the rest later through `/feature`) or **cover everything** now. Unattended, draft fast.
- Look at the project with your file tools. Is there code beyond `spec/`, `tickets/` and `.claude/`? Then go to **3, existing code**. If not, go to **2, new project**.

## 2. New project: interview

Ask about one part at a time, in this order. After each answer, write it to the spec, run `.claude/skills/chat-spec/scripts/spec lint`, fix what it reports, and let the gaps decide the next question.
1. Purpose and actors: `core/overview.md`.
2. Modules and what each owns: `modules/<module>/_module.md`, one ID prefix each.
3. Features and their scenarios, with concrete values: `modules/<module>/features/<ID>-<slug>.md`.
4. Contracts the features share: `modules/<module>/contracts.md`.
5. Invariants (`core/invariants.md`), decisions (`decisions/`), screens (`ui/`), glossary terms (`core/glossary.md`).

How to ask:
- Read what the spec already says before asking anything. Never ask what the spec answers.
- Ask one question at a time, only about something that changes behaviour: inputs, outputs, limits, errors, what happens at the edges. Offer the likely answers as choices when you can.
- Never invent behaviour. What the user does not know becomes a question on the ticket: a `blocker` if the answer could change behaviour, a `preference` with a `default` if a reversible default is safe.
- Stop asking once every Then step could be written with a concrete value a test can check.
- If no one can answer you (you run unattended), do not wait: put every open point on the ticket as a question and go on.

## 3. Existing code: draft, then confirm

**Pass 1, draft from evidence.** Read the code, tests, README and docs, and any documents the user names. Draft modules, features with their scenarios, contracts and invariants for what the code does.
- Mark each drafted unit with where it came from. Frontmatter units get `draft: true` and `sources: [src/x.ts:12, README.md]`. Contracts and invariants put `· Draft: src/x.ts:12` at the end of their status line, for example `Kind: entity · Status: active · Draft: src/cart.dart:14`.
- Write what the code does, not what it should do. Where the code and a document disagree, write what the code does, and add a question for the user citing both.
- Run `.claude/skills/chat-spec/scripts/spec lint` until it is clean.

**Pass 2, confirm with the user.** Go through `.claude/skills/chat-spec/scripts/spec gaps`, one draft at a time.
- Show the draft and its sources, then ask: "the code does this: is that what it should do?"
- **Yes:** `.claude/skills/chat-spec/scripts/spec confirm <ID>`.
- **Different wording, same behaviour:** edit it, then confirm it.
- **The code is wrong:** confirm the spec as it should be, then file a bug against the scenario with `/bug`.
- **It should change:** confirm it as it is now, then file a proposal with `/feature` or `/change`.
- Then the open questions, then scenarios without a test. Those become tester tasks later.

Repeat until `.claude/skills/chat-spec/scripts/spec gaps` is empty or the user stops. Unattended, do pass 1 only: leave every unit a draft, and put every doubt in a question for the user, in the `questions:` of the unit it is about (see Format), where `.claude/skills/chat-spec/scripts/spec gaps` lists it.

## Format

A feature, in `modules/<module>/features/<ID>-<slug>.md`. Leave out link keys that would be empty.

```markdown
---
id: CRT-001
title: Edit the cart
module: cart
status: active
writes: [cart.Cart.lines]
provides: [cart.AddItem]
invariants: [INV-001]
---
## Intent
One paragraph: what this is for.

## Behaviour
### S1: Add an item
Given an empty cart
When the shopper adds "apple" at 120 cents with quantity 2 through cart.AddItem
Then cart.Cart.lines is exactly one line: name "apple", priceCents 120, quantity 2

### S2: Quantity below 1
Given an empty cart
When the shopper adds "apple" at 120 cents with quantity 0 through cart.AddItem
Then adding fails with cart.InvalidQuantity (R1)

## Rules
- R1: Every line has a quantity of at least 1

## Out of scope
- Merging two lines with the same name
```

The steps link the feature to the contracts they name: an entity or type is read, an operation is called, an event or error in a When (or only in a Given) is consumed, and one in a Then is the outcome the feature emits (here `cart.InvalidQuantity`). The frontmatter lists only what a step cannot say: `writes` (what the code changes, checked in a Then), `provides` (the operations it implements, invoked in the When) and `observes` (a contract the scenarios set up or check while the code does not use it). A step may carry a table (lines starting `|`) or a fenced block for data too long for one line.

Another system's API (a payment provider, a vendor SDK) is a module with `external: true` in its `_module.md`: it holds only the contracts this product uses, and features call its operations and consume its events. A flow across screens is a scenario whose steps cite each screen: `Given UI-001 is shown … Then UI-002 is shown`.

Contracts, in `modules/<module>/contracts.md`. Kinds: entity, event, operation, type, error. Members are `####` headings under any kind, each with a `Type:`. Types are written in one notation whatever the language: `string int number decimal bool bytes date datetime duration null`, `"literals"`, `<module>.<Name>`, `T[]`, `map<K, V>`, `A | B`, and `T?` for a member that may be left out. A shape with keys is its own `Kind: type` with members, never `{ … }`. `Code:` names the symbol that implements a contract, never its signature: an operation's inputs are its members. A type is a `Type:` expression or a record of members; an entity, event or error is its members; an operation is its members and an `Output:`.

```markdown
### cart.AddItem
Kind: operation · Status: active
Adds a line to the cart.
Code: Cart.add
Output: null | cart.InvalidQuantity

#### cart.AddItem.quantity
How many to add. Type: int

### cart.InvalidQuantity
Kind: error · Status: active
The quantity is below 1.
```

A link to a contract covers all its members: list `cart.Cart` once when the feature uses most of it, or the members it uses (`cart.Cart.lines`) when only some matter. Every contract or member a step names must be covered by a link.

A module, in `modules/<module>/_module.md`. `id` is the folder name; `prefix` numbers its features (`CRT-001`); `domain` groups modules in `index.md`.

```markdown
---
id: cart
prefix: CRT
domain: shopping
status: active
---
Holds what the shopper is about to buy, until checkout.

## Owns
- The cart and its lines

## Non-goals
- Payment
```

Invariants, in `core/invariants.md`: each names what it constrains, and a scenario shows it by citing it, `Then … (INV-001)`. One no scenario can show says how it is checked instead.

```markdown
### INV-001: Money is whole cents
Applies to: cart.Line.priceCents, cart.Cart.totalCents
Every price and total is an integer number of cents.

### INV-002: Search answers within 300 ms
Applies to: catalog.Search
Shown by: the search benchmark in CI
The 95th percentile stays under 300 ms with 10,000 products.
```

A screen, in `ui/UI-<NNN>-<slug>.md`. A feature whose step shows it lists it under `ui:`.

```markdown
---
id: UI-001
title: Cart
status: active
shows: [cart.Cart.lines]
calls: [cart.AddItem]
---
## Layout
The lines, then the total and a checkout button.

## States
- Empty: "Your cart is empty" and no checkout button.

## Copy
- Total: "Total {amount}"
```

A question, in the frontmatter of the feature, module, screen or decision it is about. A `blocker` could change behaviour and stops work until answered; a `preference` has a safe `default` work proceeds on. A question that cites a contract or an invariant is a blocker.

```yaml
questions:
  - id: Q1
    kind: blocker
    text: Is a quantity above 20 refused, or capped at 20?
    default: null
    cites: [cart.AddItem.quantity]
    answer: null
    raised_by: null
```

Read `core/conventions.md` for the scenario rules, and run `.claude/skills/chat-spec/scripts/spec lint` after every change: it names each problem and its fix.
