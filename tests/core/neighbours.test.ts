// PIP-012/S21, R10 and PIP-013/S1..S7: the neighbours' scenarios in a brief, and what is cut first
// when a brief is over its budget. Run on chat-mini: PROP-201 touches providers.ProviderId, PRV-001
// and SET-001, so its impact re-verifies CNV-001, CNV-003, PRV-003 (features), INV-001 (an
// invariant) and UI-001 (a screen with no scenarios), in that order.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUDGETS, type BriefInput, buildBrief, estimateTokens } from '../../src/core/brief';
import { parseTicket } from '../../src/core/parse/tickets';
import { FIXTURE_SPEC, fixtureFile, fixtureWith, loadFixture } from '../helpers';

const fx = loadFixture();
const brief = (role: string, id: string, extra: Partial<BriefInput> = {}) => buildBrief({ ...fx, role, id, ...extra });
const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
/** The text of one `## ` group, without its heading. */
const group = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';
/** The brief without its `## Neighbours` group. */
const withoutNeighbours = (text: string) => text.replace(/\n## Neighbours\n[\s\S]*?(?=\n## )/, '');
const ROLES = ['spec-writer', 'implementer', 'tester', 'reviewer'];
const INTRO = 'These features use what this ticket changes, and the ticket does not touch them. Keep these scenarios true.';
const cutLine = (id: string, title: string) => `- ${id} ${title}: cut to fit the budget; run \`spec show ${id}\``;

/** One scenario of a chat-mini feature as the feature file stores it, with its heading two levels lower. */
function scenario(file: string, n: number): string {
  const text = readFileSync(join(FIXTURE_SPEC, 'modules', file), 'utf8');
  const rest = text.slice(text.indexOf(`### S${n}:`));
  const next = rest.slice(4).search(/\n#{2,3} /);
  return `##${(next === -1 ? rest : rest.slice(0, next + 4)).trimEnd()}`;
}
const CNV001 = 'conversation/features/CNV-001-send-a-message.md';
const CNV003 = 'conversation/features/CNV-003-export-to-markdown.md';
const PRV003 = 'providers/features/PRV-003-track-token-usage.md';

/** A proposal that touches only CNV-003, whose impact reaches no other feature. */
function lonely(): Pick<BriefInput, 'tickets'> {
  const text = '---\nid: PROP-299\ntype: proposal\ntitle: Touch the export only\nstatus: open\nstage: null\ntouches: [CNV-003]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nChange the export.\n';
  const parsed = parseTicket('tickets/PROP-299.md', text).ticket;
  if (!parsed) throw new Error('ticket does not parse');
  return { tickets: { ...fx.tickets, tickets: [...fx.tickets.tickets, parsed] } };
}

describe('PIP-012 neighbours in a brief', () => {
  it("PIP-012/S21 The neighbours' scenarios", () => {
    const text = brief('tester', 'PROP-201');
    const groups = groupsOf(text);
    expect(groups.slice(-2)).toEqual(['Neighbours', 'Expand']);
    const neighbours = group(text, 'Neighbours');
    expect(neighbours.startsWith(INTRO)).toBe(true);

    // The features graph.Impact.reverify flags, in its order, each with its scenarios as the feature has them.
    const cnv001 = neighbours.indexOf('### CNV-001: Send a message\n');
    const cnv003 = neighbours.indexOf('### CNV-003: Export a conversation to Markdown\n');
    const prv003 = neighbours.indexOf('### PRV-003: Track token usage per message\n');
    expect(cnv001).toBeGreaterThan(0);
    expect(cnv003).toBeGreaterThan(cnv001);
    expect(prv003).toBeGreaterThan(cnv003);
    const s1 = neighbours.indexOf(scenario(CNV001, 1));
    const s2 = neighbours.indexOf(scenario(CNV001, 2));
    expect(s1).toBeGreaterThan(cnv001);
    expect(s2).toBeGreaterThan(s1);
    expect(s2).toBeLessThan(cnv003);
    expect(neighbours).toContain('##### S1: Send to active provider\nGiven providers.ProviderConfig has "claude" as the active and enabled provider');
    for (const n of [1, 2]) expect(neighbours.indexOf(scenario(CNV003, n))).toBeGreaterThan(cnv003);
    expect(neighbours.indexOf(scenario(PRV003, 1))).toBeGreaterThan(prv003);
    // Headings sit two levels lower than in the feature file.
    expect(neighbours).not.toMatch(/^### S\d/m);

    // A screen with no scenarios, an invariant, a feature the ticket touches and one it only must change are not neighbours.
    // Scenarios are quoted as stored, and CNV-001/S2 cites (INV-001) in a step: only the units' own sections are absent.
    expect(neighbours).not.toMatch(/^### UI-001\b/m);
    expect(neighbours).not.toMatch(/^### INV-001\b/m);
    expect(neighbours).toContain('And "claude" is never called (INV-001)');
    expect(neighbours).not.toMatch(/^### (PRV-001|SET-001|PRV-002|SET-002|CNV-002)\b/m);
  });

  it('PIP-012/S21 Every role\'s brief for a proposal or a bug holds the same group', () => {
    for (const id of ['PROP-201', 'BUG-301']) {
      const tester = group(brief('tester', id), 'Neighbours');
      expect(tester, id).not.toBe('');
      for (const role of ROLES) {
        const text = brief(role, id);
        expect(group(text, 'Neighbours'), `${role} ${id}`).toBe(tester);
        expect(groupsOf(text).at(-1)).toBe('Expand');
        expect(groupsOf(text).at(-2), `${role} ${id}`).toBe('Neighbours');
      }
    }
    // BUG-301 violates PRV-002/S3: only CNV-003 reads what it changes.
    const bug = group(brief('tester', 'BUG-301'), 'Neighbours');
    expect(bug).toContain('### CNV-003: Export a conversation to Markdown\n');
    expect(bug).not.toContain('### CNV-001');
    expect(bug).not.toMatch(/^### UI-001\b/m);
  });

  it('PIP-012/S21 A task, a unit, or a ticket whose impact reaches no other feature has no Neighbours', () => {
    for (const role of ROLES) {
      expect(groupsOf(brief(role, 'TASK-102')), role).not.toContain('Neighbours');
      expect(groupsOf(brief(role, 'providers.RateLimited')), role).not.toContain('Neighbours');
      expect(groupsOf(buildBrief({ ...fx, ...lonely(), role, id: 'PROP-299' })), role).not.toContain('Neighbours');
    }
    // The control: the same ticket gives every role a brief with the other groups.
    expect(groupsOf(buildBrief({ ...fx, ...lonely(), role: 'tester', id: 'PROP-299' }))).toContain('Features in scope');
  });

  it('PIP-012/S2 The groups each role gets: Neighbours come just before Expand, after the role\'s own last group', () => {
    const after: Record<string, string> = { 'spec-writer': 'Case checklist', implementer: 'Terms', tester: 'Terms', reviewer: 'Diff' };
    for (const role of ROLES) {
      const diff = role === 'reviewer' ? { diff: { base: 'main', paths: ['src/**'], text: '+const a = 1;', error: null } } : {};
      const groups = groupsOf(brief(role, 'PROP-201', diff));
      expect(groups.slice(-2), role).toEqual(['Neighbours', 'Expand']);
      expect(groups.indexOf(after[role] ?? ''), role).toBe(groups.length - 3);
    }
  });
});

describe('PIP-013 budgets', () => {
  it('PIP-013/S1 The default budgets', () => {
    expect(BUDGETS).toEqual({ 'spec-writer': 10_000, implementer: 6_000, tester: 4_000, reviewer: 8_000 });
  });

  it('PIP-013/S2 A project\'s own budget', () => {
    const full = brief('implementer', 'TASK-101');
    expect(full).toContain('#### Consequences');
    const own = brief('implementer', 'TASK-101', { budgets: { 'brief.implementer': 2000 } });
    expect(own).not.toContain('#### Consequences');
    expect(estimateTokens(own) <= 2000 || own.includes('over the implementer budget of 2000. Nothing required was dropped.')).toBe(true);
  });

  it('PIP-013/S3 Decisions lose their consequences before anything required', () => {
    const full = brief('implementer', 'TASK-101');
    const shrunk = brief('implementer', 'TASK-101', { budgets: { 'brief.implementer': estimateTokens(full) - 20 } });
    expect(shrunk).not.toContain('#### Consequences');
    expect(shrunk).not.toContain('> Warning');
    expect(shrunk).toContain('File: modules/providers/features/PRV-002-fall-back-on-rate-limit.md');
    // Nothing required goes first: every scenario of both features is still quoted in full (R2).
    expect(shrunk).not.toContain('Listed by title to fit the budget');
    for (const title of ['S1: Streams tokens', 'S2: Provider rate-limits', 'S3: The key never reaches the log', 'S1: Fallback enabled', 'S2: Fallback disabled', 'S3: Fallback provider also rate-limits', 'S4: Fallback provider not enabled']) {
      expect(shrunk).toContain(`##### ${title}\n`);
    }
  });

  it('PIP-013/S5 Still over budget after every cut', () => {
    const text = brief('implementer', 'TASK-101', { budgets: { 'brief.implementer': 300 } });
    expect(text.split('\n')[1]).toMatch(/^> Warning: this brief is about \d+ tokens, over the implementer budget of 300\. Nothing required was dropped\.$/);
    expect(text).toContain('```ticket');
    expect(text).toContain('### INV-002');
    // TASK-101 names no scenario, so none is kept: each is its one line, never its steps (R3, R6).
    expect(text).toContain('- PRV-002/S4 Fallback provider not enabled');
    expect(text).toContain('- PRV-001/S1 Streams tokens');
    expect(text).not.toMatch(/^#{5} S\d/m);
    expect(text.match(/^File: /gm)?.length).toBe(1);
  });

  it('PIP-013/S6 The reviewer\'s diff does not count', () => {
    const budget = BUDGETS.reviewer;
    const diff = { base: 'main', paths: ['src/**'], text: '+' + 'const a = 1;\n+'.repeat(budget * 4 / 8), error: null };
    expect(estimateTokens(diff.text)).toBeGreaterThan(budget);
    const text = brief('reviewer', 'TASK-101', { diff });
    expect(text).not.toContain('> Warning');
    expect(text).toContain(diff.text.trimEnd());
    expect(text).toContain('#### Consequences');
  });

  it('PIP-013/S4 The order things are cut in: each neighbour first, from the last, then the decisions\' consequences', () => {
    const full = brief('implementer', 'PROP-201');
    const without = withoutNeighbours(full);
    expect(full).toContain('#### Consequences');
    expect(group(full, 'Neighbours')).toContain('##### S1: Send to active provider');

    // One cut brings the brief inside: step 1 only, and the decisions keep their consequences.
    const lastCut = brief('implementer', 'PROP-201', { budgets: { 'brief.implementer': estimateTokens(full) - 5 } });
    expect(group(lastCut, 'Neighbours')).toContain(cutLine('PRV-003', 'Track token usage per message'));
    expect(lastCut).toContain('#### Consequences');

    // A brief that is over budget without its neighbours carries no neighbour scenario, and the later steps follow.
    const cutAll = brief('implementer', 'PROP-201', { budgets: { 'brief.implementer': estimateTokens(without) - 20 } });
    const neighbours = group(cutAll, 'Neighbours');
    expect(neighbours).not.toMatch(/^#{5} S\d/m);
    for (const [id, title] of [['CNV-001', 'Send a message'], ['CNV-003', 'Export a conversation to Markdown'], ['PRV-003', 'Track token usage per message']]) {
      expect(neighbours).toContain(cutLine(id ?? '', title ?? ''));
    }
    expect(cutAll).not.toContain('#### Consequences');
  });

  it('PIP-013/S7 Neighbours are cut first, each to a spec show line', () => {
    const full = brief('tester', 'PROP-201');
    const neighbours = group(full, 'Neighbours');
    const at = neighbours.indexOf('### PRV-003: Track token usage per message');
    expect(at).toBeGreaterThan(0);
    // The brief with the last neighbour cut to its line, as R4 words it: the budget lies between that size and the full one.
    const lastCut = full.replace(neighbours.slice(at).trimEnd(), cutLine('PRV-003', 'Track token usage per message'));
    const budget = estimateTokens(lastCut) + 10;
    expect(budget).toBeLessThan(estimateTokens(full));

    const text = brief('tester', 'PROP-201', { budgets: { 'brief.tester': budget } });
    const cut = group(text, 'Neighbours');
    expect(cut).toContain('### CNV-001: Send a message\n');
    expect(cut).toContain(scenario(CNV001, 1));
    expect(cut).toContain(scenario(CNV001, 2));
    expect(cut).toContain('### CNV-003: Export a conversation to Markdown\n');
    expect(cut).toContain(cutLine('PRV-003', 'Track token usage per message'));
    expect(cut).not.toContain('### PRV-003');
    expect(cut).not.toContain(scenario(PRV003, 1));
    // Nothing else is cut, and there is no warning.
    expect(withoutNeighbours(text)).toBe(withoutNeighbours(full));
    expect(text).not.toContain('> Warning');

    // With a budget so small that every cut is made, every neighbour is a line, and the warning still says nothing required was dropped.
    const tiny = brief('tester', 'PROP-201', { budgets: { 'brief.tester': 300 } });
    const lines = group(tiny, 'Neighbours');
    for (const [id, title] of [['CNV-001', 'Send a message'], ['CNV-003', 'Export a conversation to Markdown'], ['PRV-003', 'Track token usage per message']]) {
      expect(lines).toContain(cutLine(id ?? '', title ?? ''));
    }
    expect(lines).not.toMatch(/^#{5} S\d/m);
    expect(tiny.split('\n')[1]).toMatch(/^> Warning: this brief is about \d+ tokens, over the tester budget of 300\. Nothing required was dropped\.$/);
  });
});

// PIP-013/S4, S8..S11, R5, R6: over budget, the scenarios and rules the ticket neither changed nor cites
// are listed by ID and title (step 6), and the contracts no kept unit needs are cut after them (step 7).

const HINT = 'Listed by title to fit the budget; run `spec show <ID>` for the full text:';
const delta = (d: Partial<{ added: string[]; changed: string[] }> = {}) => ({ base: 'main', added: [], changed: [], removed: [], reworded: [], unretired: [], ...d });
/** The `### <ID>` section of a group, up to the next `### ` heading (or the end). */
const section = (text: string, id: string) => new RegExp(`(?:^|\\n)### ${id.replace(/\./g, '\\.')}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n### |$)`).exec(text)?.[0] ?? '';
const countOf = (text: string, part: string) => text.split(part).length - 1;

/** A proposal in memory that touches the given units; its body may cite more by ID. */
function proposal(id: string, touches: string[], body = 'Change it.'): Pick<BriefInput, 'tickets'> {
  const text = `---\nid: ${id}\ntype: proposal\ntitle: A proposal for the budget tests\nstatus: open\nstage: null\ntouches: [${touches.join(', ')}]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\n${body}\n`;
  const parsed = parseTicket(`tickets/${id}.md`, text).ticket;
  if (!parsed) throw new Error('ticket does not parse');
  return { tickets: { ...fx.tickets, tickets: [...fx.tickets.tickets, parsed] } };
}

/**
 * The largest budget at which `has` holds for the brief. A cut is never undone as the budget falls,
 * so `has` is true at every smaller budget; 0 when it is not true even at a budget of 1.
 */
function threshold(render: (budget: number) => string, has: (text: string) => boolean): number {
  let lo = 1;
  let hi = estimateTokens(render(1_000_000)) + 1;
  if (!has(render(lo)) || has(render(hi))) return 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (has(render(mid))) lo = mid;
    else hi = mid;
  }
  return lo;
}

describe('PIP-013 the scenarios and rules that are not kept are listed by title', () => {
  it('PIP-013/S4 The order things are cut in: consequences, later features, then each feature by title, then contracts', () => {
    const t = proposal('PROP-298', ['PRV-001', 'PRV-002/S3']);
    const at = (budget: number) => brief('implementer', 'PROP-298', { ...t, budgets: { 'brief.implementer': budget } });
    const t3 = threshold(at, (x) => !x.includes('#### Consequences'));
    const t5 = threshold(at, (x) => !x.includes('File: modules/providers/features/PRV-002'));
    const t6first = threshold(at, (x) => x.includes('- PRV-001/S1 Streams tokens'));
    const t6second = threshold(at, (x) => x.includes('- PRV-002/S1 Fallback enabled'));
    const t7 = threshold(at, (x) => x.includes('### providers.FallbackTriggered (title only)'));
    // Every step happens, each only once the one before it is not enough (R2).
    expect(t7).toBeGreaterThan(0);
    expect(t7).toBeLessThan(t6second);
    expect(t6second).toBeLessThan(t6first);
    expect(t6first).toBeLessThan(t5);
    expect(t5).toBeLessThan(t3);

    // Step 3 alone: the decisions lose their consequences and every scenario is still whole.
    const step3 = at(t3);
    expect(step3).toContain('File: modules/providers/features/PRV-002');
    expect(step3).not.toContain(HINT);

    // Step 5 alone: the later feature keeps its scenarios and its kept rule (R2 is cited by the kept PRV-002/S3), not its other rule.
    const step5 = at(t5);
    expect(step5).not.toContain('File: modules/providers/features/PRV-002');
    expect(step5).toContain('File: modules/providers/features/PRV-001');
    expect(step5).toContain('##### S1: Fallback enabled');
    expect(step5).toContain('- R2: One fallback per reply. No chains.');
    expect(step5).not.toContain('- R1: The fallback is used only when it is enabled in this workspace (INV-001)');
    expect(step5).toContain('##### S1: Streams tokens');
    expect(step5).not.toContain(HINT);

    // Step 6 takes the first feature alone: PRV-001 is lines, PRV-002 is still whole.
    const step6a = at(t6first);
    expect(step6a).toContain('- PRV-001/S1 Streams tokens');
    expect(step6a).not.toContain('##### S1: Streams tokens');
    expect(step6a).toContain('##### S1: Fallback enabled');
    expect(countOf(step6a, HINT)).toBe(1);
    expect(step6a).not.toContain('- PRV-002/S1 Fallback enabled');

    // Then the second; the contracts are still whole until step 7.
    const step6b = at(t6second);
    expect(countOf(step6b, HINT)).toBe(2);
    expect(step6b).toContain('- PRV-002/S1 Fallback enabled');
    expect(step6b).toContain('##### S3: Fallback provider also rate-limits');
    expect(section(group(step6b, 'Contracts'), 'providers.FallbackTriggered')).toContain('Kind: event');
    expect(step6b).not.toContain('### providers.FallbackTriggered (title only)');

    // Step 7 last: the contract only a listed scenario names is a title.
    expect(at(t7)).toContain('### providers.FallbackTriggered (title only)');
  });

  it('PIP-013/S4 Step 5 keeps a rule the ticket cites or its branch changed, and what a kept scenario cites', () => {
    const t = proposal('PROP-297', ['PRV-001', 'PRV-002'], 'Keep PRV-002/R1 exactly as it is.');
    const changed = delta({ changed: ['PRV-002/R2'] });
    const at = (budget: number, extra: Partial<BriefInput> = {}) => brief('implementer', 'PROP-297', { ...t, budgets: { 'brief.implementer': budget }, delta: changed, ...extra });
    const t5 = threshold(at, (x) => !x.includes('File: modules/providers/features/PRV-002'));
    expect(t5).toBeGreaterThan(0);
    const step5 = at(t5);
    expect(step5).not.toContain('File: modules/providers/features/PRV-002');
    // R1 is named by the ticket, R2 changed on its branch: neither is dropped with the others.
    expect(step5).toContain('- R1: The fallback is used only when it is enabled in this workspace (INV-001)');
    expect(step5).toContain('- R2: One fallback per reply. No chains.');
    expect(step5).toContain('##### S3: Fallback provider also rate-limits');
    expect(step5).not.toContain(HINT);
  });

  it('PIP-013/S4 Step 4 and step 7 keep a contract the ticket names or its branch changed', () => {
    // PROP-201 touches providers.ProviderId; with every cut made it is still quoted whole.
    const named = brief('implementer', 'PROP-201', { budgets: { 'brief.implementer': 1 } });
    expect(section(group(named, 'Contracts'), 'providers.ProviderId')).toContain('Kind: type · Status: active');
    expect(named).not.toContain('### providers.ProviderId (title only)');
    // conversation.MessageId is nothing a kept unit needs, so it is a title, unless the branch changed it.
    expect(named).toContain('### conversation.MessageId (title only)');
    const changed = brief('implementer', 'PROP-201', { budgets: { 'brief.implementer': 1 }, delta: delta({ changed: ['conversation.MessageId'] }) });
    expect(section(group(changed, 'Contracts'), 'conversation.MessageId')).toContain('Kind: type · Status: active');
    expect(changed).not.toContain('### conversation.MessageId (title only)');
  });

  it('PIP-013/S8 The scenario a bug violates stays whole while the rest are listed by title', () => {
    // About 1210 tokens remain after the first five cuts of this brief; 1100 is below that.
    const text = brief('tester', 'BUG-301', { budgets: { 'brief.tester': 1100 } });
    const feature = section(group(text, 'Features in scope'), 'PRV-002');
    expect(feature).toContain('##### S3: Fallback provider also rate-limits\nGiven providers.ProviderConfig has "claude" active, "claude", "gpt" and "mistral" enabled, and "gpt" as fallback');
    expect(feature).toContain('And "mistral" is never called (R2)');
    expect(feature).toContain('- R2: One fallback per reply. No chains.');
    const hint = feature.indexOf(HINT);
    expect(hint).toBeGreaterThan(feature.indexOf('- R2: One fallback per reply. No chains.'));
    expect(hint).toBeGreaterThan(feature.indexOf('And "mistral" is never called (R2)'));
    const lines = ['- PRV-002/S1 Fallback enabled', '- PRV-002/S2 Fallback disabled', '- PRV-002/S4 Fallback provider not enabled', '- PRV-002/R1 The fallback is used only when it is enabled in this workspace (INV-001)'];
    let from = hint;
    for (const line of lines) {
      const i = feature.indexOf(line, from);
      expect(i, line).toBeGreaterThan(from - 1);
      from = i;
    }
    for (const title of ['S1: Fallback enabled', 'S2: Fallback disabled', 'S4: Fallback provider not enabled']) expect(text).not.toContain(`##### ${title}`);
    expect(text).not.toContain('- R1: The fallback is used only when it is enabled in this workspace (INV-001)');
  });

  it('PIP-013/S9 Contracts follow the scenarios that stay', () => {
    const text = brief('tester', 'BUG-301', { budgets: { 'brief.tester': 1 } });
    const contracts = group(text, 'Contracts');
    for (const id of ['providers.ProviderConfig', 'providers.RateLimited', 'conversation.DeliveryMeta', 'providers.ProviderId']) {
      expect(section(contracts, id), id).toContain('Kind: ');
      expect(contracts, id).not.toContain(`### ${id} (title only)`);
    }
    expect(contracts).toContain('#### conversation.Message.meta');
    expect(contracts).toContain('### providers.FallbackTriggered (title only)');
    expect(section(contracts, 'providers.FallbackTriggered')).not.toContain('Kind: event');
    expect(text).toContain('### INV-001: A conversation goes only to enabled providers\nApplies to: providers.ProviderConfig.enabled');
    expect(text.split('\n')[1]).toMatch(/^> Warning: this brief is about \d+ tokens, over the tester budget of 1\. Nothing required was dropped\.$/);
  });

  it('PIP-013/S10 Features are listed by title one at a time, from the first', () => {
    // At least the brief with only PRV-001 listed (about 1760 tokens), below its size after five cuts (about 1975).
    const text = brief('implementer', 'TASK-101', { budgets: { 'brief.implementer': 1900 } });
    for (const line of ['- PRV-001/S1 Streams tokens', '- PRV-001/S2 Provider rate-limits', '- PRV-001/S3 The key never reaches the log']) expect(text).toContain(line);
    expect(text).not.toContain('##### S1: Streams tokens');
    const features = group(text, 'Features in scope');
    expect(countOf(features, HINT)).toBe(1);
    expect(features.indexOf(HINT)).toBeLessThan(features.indexOf('### PRV-002'));
    expect(section(features, 'PRV-002')).toContain('##### S4: Fallback provider not enabled\nGiven providers.ProviderConfig has "claude" active, only "claude" enabled, and "gpt" as fallback');
    expect(section(features, 'PRV-002')).toContain('And "gpt" is never called (INV-001, R1)');
    expect(text).not.toContain('> Warning');
  });

  it('PIP-013/S11 What the ticket\'s branch changed stays whole in every role\'s brief', () => {
    const feature = fixtureFile('modules/providers/features/PRV-001-stream-a-reply.md');
    const added = '### S4: Streams from gemini\nGiven providers.ProviderConfig has "gemini" as the active and enabled provider\nWhen providers.StreamReply runs for a message and "gemini" streams "Hi"\nThen providers.TokenStreamed is emitted once, with "Hi"\n\n## Rules';
    const changedSpec = fixtureWith({ 'modules/providers/features/PRV-001-stream-a-reply.md': feature.replace('## Rules', added) });
    const budgets = { 'brief.spec-writer': 1, 'brief.spec-review': 1, 'brief.tester': 1, 'brief.implementer': 1, 'brief.reviewer': 1 };
    const diff = { base: 'main', paths: ['src/**'], text: '+const gemini = 1;', error: null };
    const specDiff = { base: 'main', paths: ['spec'], text: '+SPEC-DELTA-LINE', error: null };
    const ask = (role: string, d: ReturnType<typeof delta> | null) => buildBrief({ ...fx, ...changedSpec, role, id: 'PROP-201', budgets, delta: d, diff, specDiff });
    for (const role of ['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer']) {
      const text = ask(role, delta({ added: ['PRV-001/S4'] }));
      expect(text, role).toContain('##### S4: Streams from gemini\nGiven providers.ProviderConfig has "gemini" as the active and enabled provider\nWhen providers.StreamReply runs for a message and "gemini" streams "Hi"\nThen providers.TokenStreamed is emitted once, with "Hi"');
      expect(text, role).toContain('- PRV-001/S1 Streams tokens');
      expect(text, role).not.toContain('##### S1: Streams tokens');
      // "New in the spec" lists it as "- PRV-001/S4 Streams from gemini (added)"; only the scope group must not hold it as a bare line.
      expect(group(text, 'Features in scope'), role).not.toContain('- PRV-001/S4 Streams from gemini');
      if (role === 'spec-review') expect(text).toContain('+SPEC-DELTA-LINE');
      if (role === 'reviewer') expect(text).toContain('+const gemini = 1;');
    }
    // With no repository or no base branch the caller has no delta: nothing counts as changed, and the brief is otherwise complete.
    for (const role of ['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer']) {
      const text = ask(role, null);
      expect(group(text, 'Features in scope'), role).toContain('- PRV-001/S4 Streams from gemini');
      expect(text, role).not.toContain('##### S4: Streams from gemini');
      expect(text, role).toContain('- PRV-001/S1 Streams tokens');
      expect(text, role).toContain('```ticket');
      expect(groupsOf(text).at(-1), role).toBe('Expand');
    }
  });
});
