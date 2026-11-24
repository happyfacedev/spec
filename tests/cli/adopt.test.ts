// Drafts: units an agent drafted from code and docs, refused by the gate until a person confirms
// them; spec gaps lists them with the rest of what /spec-init asks about.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { textOf } from '../../src/core/source';
import { loadDir } from '../../src/io/fs';
import { fixtureFile, gitFixture } from '../helpers';

type Fixture = ReturnType<typeof gitFixture>;

const fx = gitFixture('spec-adopt');
const feature = join(fx.repo, 'spec/modules/conversation/features/CNV-003-export-to-markdown.md');
const contracts = join(fx.repo, 'spec/modules/conversation/contracts.md');
const invariants = join(fx.repo, 'spec/core/invariants.md');
afterAll(fx.cleanup);

const CNV_003 = 'modules/conversation/features/CNV-003-export-to-markdown.md';
const CONVERSATION = 'modules/conversation/_module.md';
const CONTRACTS = 'modules/conversation/contracts.md';
const INVARIANTS = 'core/invariants.md';
const INV_002 = '### INV-002: API keys never appear in logs, exports or error messages\n';

const copies: Fixture[] = [];
afterAll(() => {
  for (const copy of copies) copy.cleanup();
});

/** Replaces the one place `from` holds in a spec file; fails when the file does not hold it. */
function replaceIn(spec: string, file: string, from: string, to: string) {
  const path = join(spec, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`${file} does not hold ${JSON.stringify(from)}`);
  writeFileSync(path, text.replace(from, to));
}

/** A copy of chat-mini whose spec `edit` has changed, built as the CLI leaves it. */
async function specWith(prefix: string, edit?: (spec: string) => void): Promise<Fixture> {
  const copy = gitFixture(prefix, { setup: (repo) => edit?.(join(repo, 'spec')) });
  copies.push(copy);
  expect((await copy.spec('', 'build')).code).toBe(0);
  return copy;
}

const specText = (copy: Fixture, file: string) => readFileSync(join(copy.repo, 'spec', file), 'utf8');
/** Every spec file's text by path, so any change to the spec shows as a difference. */
const specTree = (copy: Fixture) => new Map(loadDir(join(copy.repo, 'spec')).map((f) => [f.path, textOf(f)]));

async function gapDrafts(copy: Fixture) {
  const out = await copy.spec('', 'gaps', '--no-tests', '--format', 'json');
  return (JSON.parse(out.stdout) as { drafts: { id: string }[] }).drafts;
}

/** The three drafted units of ADP-005/S5: CNV-003, conversation.Message and INV-002. */
function draftThree(spec: string) {
  replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
  replaceIn(spec, CONTRACTS, '### conversation.Message\nKind: entity · Status: active\n', '### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15\n');
  replaceIn(spec, INVARIANTS, INV_002, `${INV_002}Status: active · Draft: yes\n`);
}

beforeAll(async () => {
  // As /spec-init would leave them: drafted from the code, with where each came from.
  writeFileSync(feature, readFileSync(feature, 'utf8').replace('status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n'));
  writeFileSync(contracts, readFileSync(contracts, 'utf8').replace('### conversation.Message\nKind: entity · Status: active', '### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15'));
  writeFileSync(invariants, readFileSync(invariants, 'utf8').replace('### INV-002: API keys never appear in logs, exports or error messages\n', '### INV-002: API keys never appear in logs, exports or error messages\nStatus: active · Draft: yes\n'));
  expect((await fx.spec('', 'build')).code).toBe(0);
});

describe('drafts', () => {
  it('lint accepts them; gaps lists each with its sources', async () => {
    expect((await fx.spec('', 'lint')).code).toBe(0);
    const g = JSON.parse((await fx.spec('', 'gaps', '--no-tests', '--format', 'json')).stdout) as { drafts: { id: string; sources: string[] }[]; scenariosWithoutTests: null };
    expect(g.drafts).toHaveLength(3);
    expect(g.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'CNV-003', sources: ['src/conversation/export.ts:3', 'README.md'] }),
        expect.objectContaining({ id: 'conversation.Message', sources: ['src/conversation/message.ts:15'] }),
        expect.objectContaining({ id: 'INV-002', sources: [] }),
      ]),
    );
    expect(g.scenariosWithoutTests).toBeNull();
  });

  it('the gate refuses work on a draft, naming the unit to confirm', async () => {
    const t = await fx.spec(JSON.stringify({ type: 'task', title: 'Tidy the export', touches: ['CNV-003/S1'], body: 'x' }), 'ticket', 'new', '--dry-run');
    expect(t.stdout).toContain('- draft CNV-003: CNV-003 is a draft, not yet confirmed');
    expect(t.stdout).toContain('run spec confirm <ID>');
  });
});

describe('ADP-005 Confirm drafted units', () => {
  it('ADP-005/S1 Confirm a feature', async () => {
    const copy = await specWith('spec-adp5-s1', (spec) => {
      replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
    });
    expect(specText(copy, CNV_003)).toContain('draft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
    const out = await copy.spec('', 'confirm', 'CNV-003');
    expect(specText(copy, CNV_003)).toBe(fixtureFile(CNV_003));
    expect(out.stdout).toBe('CNV-003: confirmed\n');
    expect(out.code).toBe(0);
  });

  it('ADP-005/S2 Confirm a module with a block list of sources', async () => {
    const copy = await specWith('spec-adp5-s2', (spec) => {
      replaceIn(spec, CONVERSATION, 'status: active\n', 'status: active\ndraft: true\nsources:\n  - README.md\n  - src/a.ts\n');
    });
    expect(specText(copy, CONVERSATION)).toContain('draft: true\nsources:\n  - README.md\n  - src/a.ts\n');
    await copy.spec('', 'confirm', 'conversation');
    expect(specText(copy, CONVERSATION)).toBe(fixtureFile(CONVERSATION));
  });

  it('ADP-005/S3 Confirm a contract', async () => {
    const copy = await specWith('spec-adp5-s3', (spec) => {
      replaceIn(spec, CONTRACTS, '### conversation.Message\nKind: entity · Status: active\n', '### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15\n');
    });
    expect(specText(copy, CONTRACTS)).toContain('### conversation.Message\nKind: entity · Status: active · Draft: src/conversation/message.ts:15\n');
    await copy.spec('', 'confirm', 'conversation.Message');
    expect(specText(copy, CONTRACTS)).toBe(fixtureFile(CONTRACTS));
  });

  it('ADP-005/S4 Confirm an invariant', async () => {
    const copy = await specWith('spec-adp5-s4', (spec) => {
      replaceIn(spec, INVARIANTS, INV_002, `${INV_002}Status: active · Draft: yes\n`);
    });
    const before = specText(copy, INVARIANTS);
    expect(before).toContain('Status: active · Draft: yes\n');
    await copy.spec('', 'confirm', 'INV-002');
    expect(specText(copy, INVARIANTS)).toBe(before.replace('Status: active · Draft: yes\n', 'Status: active\n'));
  });

  it('ADP-005/S5 Several IDs in one run', async () => {
    const copy = await specWith('spec-adp5-s5', draftThree);
    expect(await gapDrafts(copy)).toHaveLength(3);
    const out = await copy.spec('', 'confirm', 'CNV-003', 'conversation.Message', 'INV-002');
    expect(out.stdout).toBe('CNV-003: confirmed\nconversation.Message: confirmed\nINV-002: confirmed\n');
    expect(await gapDrafts(copy)).toEqual([]);
  });

  it('ADP-005/S6 A scenario is confirmed with its feature', async () => {
    const copy = await specWith('spec-adp5-s6');
    const out = await copy.spec('', 'confirm', 'CNV-001/S1');
    expect(out.stderr).toBe('CNV-001/S1 is confirmed with its feature: spec confirm CNV-001\n');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(1);
  });

  it('ADP-005/S7 A member is confirmed with its contract', async () => {
    const copy = await specWith('spec-adp5-s7');
    const out = await copy.spec('', 'confirm', 'conversation.Message.content');
    expect(out.stderr).toBe('conversation.Message.content is confirmed with its contract: spec confirm conversation.Message\n');
  });

  it('ADP-005/S8 An unknown ID with a near match', async () => {
    const copy = await specWith('spec-adp5-s8');
    const out = await copy.spec('', 'confirm', 'INV-099');
    expect(out.stderr).toBe('INV-099 is not a unit; did you mean INV-001?\n');
    expect(out.code).toBe(1);
  });

  it('ADP-005/S9 An unknown ID with no near match', async () => {
    const copy = await specWith('spec-adp5-s9');
    const out = await copy.spec('', 'confirm', 'zzzzqq');
    expect(out.stderr).toBe('zzzzqq is not a unit\n');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(1);
  });

  it('ADP-005/S10 A unit that is not a draft', async () => {
    const copy = await specWith('spec-adp5-s10');
    const before = specTree(copy);
    const out = await copy.spec('', 'confirm', 'CNV-001');
    expect(out.stderr).toBe('CNV-001 is not a draft\n');
    expect(specTree(copy)).toEqual(before);
  });

  it('ADP-005/S11 The same ID twice', async () => {
    const copy = await specWith('spec-adp5-s11', (spec) => {
      replaceIn(spec, CONVERSATION, 'status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n');
    });
    const out = await copy.spec('', 'confirm', 'conversation', 'conversation');
    expect(out.stdout).toBe('conversation: confirmed\n');
    expect(out.stderr).toBe('conversation: its draft marker was not found in modules/conversation/_module.md\n');
    expect(out.code).toBe(1);
  });

  it('ADP-005/S12 Confirmed lines on stdout, problems on stderr', async () => {
    const copy = await specWith('spec-adp5-s12', (spec) => {
      replaceIn(spec, CNV_003, 'status: active\n', 'status: active\ndraft: true\nsources: [src/conversation/export.ts:3, README.md]\n');
    });
    const out = await copy.spec('', 'confirm', 'CNV-001/S1', 'CNV-003', 'CNV-001');
    expect(out.stdout).toBe('CNV-003: confirmed\n');
    expect(out.stderr).toBe('CNV-001/S1 is confirmed with its feature: spec confirm CNV-001\nCNV-001 is not a draft\n');
    expect(specText(copy, CNV_003)).toBe(fixtureFile(CNV_003));
    expect(out.code).toBe(1);
  });

  it('ADP-005/S13 JSON output', async () => {
    const copy = await specWith('spec-adp5-s13', (spec) => {
      replaceIn(spec, CONTRACTS, '### conversation.Usage\nKind: type · Status: active\n', '### conversation.Usage\nKind: type · Status: active · Draft: src/usage.ts:4\n');
    });
    const out = await copy.spec('', 'confirm', 'conversation.Usage', 'CNV-001', '--format', 'json');
    const doc = JSON.parse(out.stdout) as { confirmed: string[]; problems: string[] };
    expect(doc.confirmed).toEqual(['conversation.Usage']);
    expect(doc.problems).toEqual(['CNV-001 is not a draft']);
    expect(out.stderr).toBe('');
    expect(out.code).toBe(1);
  });

  it('ADP-005/S14 No IDs', async () => {
    const copy = await specWith('spec-adp5-s14');
    const out = await copy.spec('', 'confirm');
    expect(out.stderr).toBe(`usage: spec confirm <ID>...\n\n${USAGE}`);
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });
});
