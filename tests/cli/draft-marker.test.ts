// ADP-001: a draft marker on a feature, module, decision, screen, contract or invariant makes that unit a
// draft, which spec gaps lists; lint refuses a draft marker on a member. Each test runs the CLI on a copy of chat-mini.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fixture = ReturnType<typeof gitFixture>;
type Draft = { id: string; title: string; sources: string[]; file: string };
type Finding = { rule: string; severity: string; file: string; line: number; id: string | null; message: string; fix: string };

const CNV_001 = 'modules/conversation/features/CNV-001-send-a-message.md';
const CNV_003 = 'modules/conversation/features/CNV-003-export-to-markdown.md';
const CONVERSATION = 'modules/conversation/_module.md';
const CONTRACTS = 'modules/conversation/contracts.md';
const INVARIANTS = 'core/invariants.md';
const ADR_001 = 'decisions/ADR-001-one-message-format.md';
const UI_001 = 'ui/UI-001-fallback-notice.md';
const INV_002 = '### INV-002: API keys never appear in logs, exports or error messages\n';

const fixtures: Fixture[] = [];
afterAll(() => {
  for (const f of fixtures) f.cleanup();
});

/** Replaces the one place `from` holds in a spec file; fails when the file does not hold it. */
function replaceIn(spec: string, file: string, from: string, to: string) {
  const path = join(spec, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`${file} does not hold ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}

/**
 * A copy of chat-mini whose spec `edit` has changed, built as the CLI leaves it. BUG-302 is taken out
 * of the copy: it is a bug with no violates, which lint warns about, and these scenarios need an
 * otherwise clean spec.
 */
async function draftedSpec(prefix: string, edit: (spec: string) => void): Promise<Fixture> {
  const fx = gitFixture(prefix, {
    setup: (repo) => {
      rmSync(join(repo, 'tickets/BUG-302.md'));
      edit(join(repo, 'spec'));
    },
  });
  fixtures.push(fx);
  expect((await fx.spec('', 'build')).code).toBe(0);
  return fx;
}

/** What `spec gaps --no-tests --format json` lists as drafts. */
async function gapDrafts(fx: Fixture): Promise<Draft[]> {
  const out = await fx.spec('', 'gaps', '--no-tests', '--format', 'json');
  expect(out.code).toBe(0);
  return (JSON.parse(out.stdout) as { drafts: Draft[] }).drafts;
}

const draftOf = (list: Draft[], id: string) => list.find((d) => d.id === id);

/**
 * The conversation contracts with conversation.Message.content on line 9, its first line `status`.
 * The rest is chat-mini's, in the same order after the message.
 */
const messageContracts = (status: string) => `# conversation contracts

### conversation.Message
Kind: entity · Status: active
One message, same shape for every provider.
Decisions: ADR-001

#### conversation.Message.content
${status}
The text of the message. Type: string

#### conversation.Message.id
Identifies the message. Type: conversation.MessageId

#### conversation.Message.meta
Delivery details. Type: conversation.DeliveryMeta

#### conversation.Message.usage
Token counts for the reply, null until the reply finishes. Type: conversation.Usage | null

### conversation.MessageId
Kind: type · Status: active
Identifies one message in a conversation. Type: string

### conversation.DeliveryMeta
Kind: type · Status: active
How a reply was delivered. A member that does not apply is left out.

#### conversation.DeliveryMeta.fallbackFrom
The provider that rate-limited before the fallback finished the reply. Type: providers.ProviderId?

#### conversation.DeliveryMeta.stopReason
Why the reply stopped. Type: ("done" | "user" | "rate_limited")?

#### conversation.DeliveryMeta.retryAfterMs
How long the provider asked callers to wait, in milliseconds. Type: int?

### conversation.Usage
Kind: type · Status: active
The tokens one reply used.

#### conversation.Usage.inputTokens
Tokens sent to the provider. Type: int

#### conversation.Usage.outputTokens
Tokens the provider returned. Type: int

### conversation.ProviderDisabled
Kind: error · Status: active
Sending failed: the active provider is not enabled in the workspace. Its text never holds key material.
`;

describe('ADP-001 Mark a unit as a draft', () => {
  it('ADP-001/S1 A feature marked in its frontmatter', async () => {
    const fx = await draftedSpec('spec-adp-s1', (spec) => { replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n'); },
    );
    expect(draftOf(await gapDrafts(fx), 'CNV-003')).toEqual(
      expect.objectContaining({ sources: ['src/conversation/export.ts:3', 'README.md'], file: CNV_003 }),
    );
  });

  it('ADP-001/S2 Modules, decisions and screens take the same keys', async () => {
    const fx = await draftedSpec('spec-adp-s2', (spec) => {
      replaceIn(spec, CONVERSATION, 'status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n');
      replaceIn(spec, ADR_001, 'status: accepted\n', 'status: accepted\ndraft: true\nsources: [README.md]\n');
      replaceIn(spec, UI_001, 'status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n');
    });
    const drafts = await gapDrafts(fx);
    expect(draftOf(drafts, 'conversation')).toEqual(expect.objectContaining({ sources: ['README.md'] }));
    expect(draftOf(drafts, 'ADR-001')).toEqual(expect.objectContaining({ sources: ['README.md'] }));
    expect(draftOf(drafts, 'UI-001')).toEqual(expect.objectContaining({ sources: ['README.md'] }));
  });

  it('ADP-001/S3 Sources as a block list', async () => {
    const fx = await draftedSpec('spec-adp-s3', (spec) => { replaceIn(spec, CONVERSATION, 'status: active\n', 'status: active\ndraft: true\nsources:\n  - README.md\n  - src/a.ts\n'); },
    );
    expect(draftOf(await gapDrafts(fx), 'conversation')).toEqual(expect.objectContaining({ sources: ['README.md', 'src/a.ts'] }));
  });

  it('ADP-001/S4 Sources without draft true mark nothing', async () => {
    const fx = await draftedSpec('spec-adp-s4', (spec) => { replaceIn(spec, CNV_001, 'status: active\n', 'status: active\nsources: [README.md]\n'); });
    expect((await gapDrafts(fx)).map((d) => d.id)).not.toContain('CNV-001');
  });

  it('ADP-001/S5 A contract marked on its status line', async () => {
    const fx = await draftedSpec('spec-adp-s5', (spec) => { replaceIn(spec, CONTRACTS, '### conversation.Message\nKind: entity · Status: active\n', '### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15\n'); },
    );
    expect(draftOf(await gapDrafts(fx), 'conversation.Message')).toEqual(expect.objectContaining({ sources: ['src/conversation/message.ts:15'] }));
  });

  it('ADP-001/S6 Several sources on a status line', async () => {
    const fx = await draftedSpec('spec-adp-s6', (spec) => { replaceIn(spec, CONTRACTS, '### conversation.Usage\nKind: type · Status: active\n', '### conversation.Usage\nKind: type · Status: active · Draft: src/usage.ts:4, README.md\n'); },
    );
    expect(draftOf(await gapDrafts(fx), 'conversation.Usage')).toEqual(expect.objectContaining({ sources: ['src/usage.ts:4', 'README.md'] }));
  });

  it('ADP-001/S7 An invariant marked as a draft with no sources', async () => {
    const fx = await draftedSpec('spec-adp-s7', (spec) => { replaceIn(spec, INVARIANTS, INV_002, `${INV_002}Status: active · Draft: yes\n`); });
    expect(draftOf(await gapDrafts(fx), 'INV-002')).toEqual(expect.objectContaining({ sources: [] }));
  });

  it("ADP-001/S8 A member's draft marker is refused", async () => {
    const fx = await draftedSpec('spec-adp-s8', (spec) => { writeFileSync(join(spec, CONTRACTS), messageContracts('Status: active · Draft: src/x.ts')); });
    const lint = await fx.spec('', 'lint', '--format', 'json');
    expect(lint.code).toBe(1);
    expect((JSON.parse(lint.stdout) as { findings: Finding[] }).findings).toEqual([
      {
        rule: 'L001',
        severity: 'error',
        file: CONTRACTS,
        line: 9,
        id: 'conversation.Message.content',
        message: '· Draft: marks a contract, not a member; mark the contract conversation.Message instead',
        fix: 'move · Draft: <sources> to the status line of conversation.Message',
      },
    ]);
    const ids = (await gapDrafts(fx)).map((d) => d.id);
    expect(ids).not.toContain('conversation.Message.content');
    expect(ids).not.toContain('conversation.Message');

    // R1, which S8 cites: the refusal holds whatever the marker's sources; here a bare "Draft: yes" on the member.
    const bare = await draftedSpec('spec-adp-s8-r1', (spec) => { writeFileSync(join(spec, CONTRACTS), messageContracts('Status: active · Draft: yes')); });
    const bareLint = await bare.spec('', 'lint', '--format', 'json');
    expect(bareLint.code).toBe(1);
    expect((JSON.parse(bareLint.stdout) as { findings: Finding[] }).findings).toContainEqual(
      expect.objectContaining({ rule: 'L001', severity: 'error', file: CONTRACTS, line: 9, id: 'conversation.Message.content' }),
    );
  });

  it('ADP-001/S9 Lint accepts drafts', async () => {
    const fx = await draftedSpec('spec-adp-s9', (spec) => {
      replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
      replaceIn(spec, CONTRACTS, '### conversation.Message\nKind: entity · Status: active\n', '### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15\n');
      replaceIn(spec, INVARIANTS, INV_002, `${INV_002}Status: active · Draft: yes\n`);
    });
    expect((await fx.spec('', 'lint')).code).toBe(0);
  });
});
