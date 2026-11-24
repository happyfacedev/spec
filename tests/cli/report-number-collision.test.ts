// PIP-007/S22: a done spec-writer report is refused for a scenario or rule number that the branch of
// another ticket in flight, with a recorded spec-writer stage, also added with different text (R10).
// PIP-007/S23-S27: the same for an invariant, decision, feature or screen number, naming the next free ID (R11).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, report, validSpecWriterChecklist } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => {
  for (const fx of fixtures) fx.cleanup();
});

const FEATURE = 'spec/modules/settings/features/SET-001-enable-providers.md';
const R1 = '- R1: A provider needs an API key before it can be enabled\n';

/** A scenario number and a rule number that SET-001 gains, with the words that make their text differ. */
interface Units {
  scenario: number;
  rule: number;
  title: string;
  ruleText: string;
  word: string;
}
const theirs: Units = { scenario: 4, rule: 2, title: 'Stats name the stage', ruleText: 'Stats name the stage of each provider', word: 'stats' };
const mine: Units = { scenario: 4, rule: 2, title: 'A refused report is counted', ruleText: 'A refused report is counted', word: 'refusal' };

function addUnits(dir: string, u: Units): void {
  const path = join(dir, FEATURE);
  const scenario = `### S${String(u.scenario)}: ${u.title}\nGiven settings.ApiKey exists for "${u.word}"\nWhen the user enables "${u.word}"\nThen providers.ProviderConfig lists "${u.word}" as enabled (R${String(u.rule)})\n\n`;
  const text = readFileSync(path, 'utf8');
  if (!text.includes('## Rules') || !text.includes(R1)) throw new Error('SET-001 is not as the fixture has it');
  writeFileSync(path, text.replace('## Rules', `${scenario}## Rules`).replace(R1, `${R1}- R${String(u.rule)}: ${u.ruleText}\n`));
}

const ticketFile = (dir: string, id: string) => join(dir, 'tickets', `${id}.md`);
const recordedEntry = '  - at: 2026-10-27T10:00:00.000Z\n    role: spec-writer\n    result: done\n    summary: Specified it\n    verdict: null\n    assumed: []\n';
const running = (text: string) => text.replace(/^status: .*$/m, 'status: in_progress').replace(/^stage: .*$/m, 'stage: spec-writer');

/** A change to the spec folder of a checkout. */
type Edit = (dir: string) => void;
type State = 'recorded' | 'unrecorded' | 'merged';

/** A ticket in flight: its spec stage is recorded, running but not recorded, or its branch merged into main. */
interface Other {
  id: string;
  state: State;
  edit: Edit;
}

/** The ticket text with one recorded spec-writer stage in its history. */
function withRecordedStage(id: string, text: string): string {
  const empty = /^history: \[\]$/m;
  const recorded = empty.test(text) ? text.replace(empty, `history:\n${recordedEntry.trimEnd()}`) : text.replace('\nquestions:\n', `\nhistory:\n${recordedEntry}questions:\n`);
  if (recorded === text) throw new Error(`${id} has no history or questions line to put its recorded stage in`);
  return recorded;
}

/**
 * PROP-201 runs its spec-writer stage on ticket/PROP-201, which is checked out; its edit (`ours`) is
 * uncommitted. Each of `others` is a branch from main that made its own edit.
 */
function build(others: Other[], ours: Edit): Fx {
  const fx = gitFixture('spec-report-collision');
  fixtures.push(fx);
  fx.git('checkout', '-q', '-b', 'ticket/PROP-201');
  writeFileSync(ticketFile(fx.repo, 'PROP-201'), running(readFileSync(ticketFile(fx.repo, 'PROP-201'), 'utf8')));
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'PROP-201: started');
  fx.git('checkout', '-q', 'main');

  for (const other of others) {
    fx.git('checkout', '-q', '-b', `ticket/${other.id}`);
    other.edit(fx.repo);
    const text = readFileSync(ticketFile(fx.repo, other.id), 'utf8');
    writeFileSync(ticketFile(fx.repo, other.id), other.state === 'unrecorded' ? running(text) : withRecordedStage(other.id, text));
    fx.git('add', '-A');
    fx.git('commit', '-q', '-m', `${other.id} spec-writer: Specified it`);
    fx.git('checkout', '-q', 'main');
    if (other.state === 'merged') {
      const merged = fx.git('merge', '-q', '--no-ff', '-m', `merge ${other.id}`, `ticket/${other.id}`);
      expect(merged.code, merged.stderr).toBe(0);
    }
  }

  fx.git('checkout', '-q', 'ticket/PROP-201');
  ours(fx.repo);
  return fx;
}

/** ticket/PROP-202 added SET-001's units, in the state `other` says; `ours` and `theirUnits` say what each branch adds. */
function scene(other: State, ours: Units, theirUnits: Units = theirs): Fx {
  return build(
    [
      {
        id: 'PROP-202',
        state: other,
        edit: (dir) => {
          addUnits(dir, theirUnits);
        },
      },
    ],
    (dir) => {
      addUnits(dir, ours);
    },
  );
}

async function problems(fx: Fx, extra = ''): Promise<string[]> {
  const message = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Counted the refusals\n' + extra + validSpecWriterChecklist('PRV-001/S1'));
  const out = await fx.spec(message, 'check-report', 'spec-writer', 'PROP-201', '--format', 'json');
  return (JSON.parse(out.stdout) as { problems: string[] }).problems;
}
const naming = (found: string[]) => found.filter((p) => /PROP-20[26]/.test(p));
const taken = (id: string) => `${id} is also new on ticket/PROP-202, whose spec stage is recorded; take numbers after those PROP-202 added to SET-001, or wait for PROP-202 to merge`;
/** PIP-007/R11: the problem for a top-level ID, naming the next free ID. */
const takenBy = (id: string, next: string, ticket = 'PROP-202') => `${id} is also new on ticket/${ticket}, whose spec stage is recorded; take ${next}, or wait for ${ticket} to merge`;

const specFile = (dir: string, path: string) => join(dir, 'spec', path);

/** Appends an invariant to core/invariants.md. */
const invariant =
  (n: number, text: string): Edit =>
  (dir) => {
    const path = specFile(dir, 'core/invariants.md');
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n\n### INV-${String(n).padStart(3, '0')}: ${text}\nApplies to: providers.ProviderConfig.enabled\n${text} always holds.\n`);
  };

/** Adds a decision file. */
const decision =
  (n: number, text: string): Edit =>
  (dir) => {
    const id = `ADR-${String(n).padStart(3, '0')}`;
    writeFileSync(specFile(dir, `decisions/${id}-new-decision.md`), `---\nid: ${id}\ntitle: ${text}\nstatus: accepted\n---\n## Decision\n${text}.\n\n## Consequences\n- ${text} is kept.\n\n## Context\nNone.\n\n## Alternatives\n- Do nothing: rejected.\n`);
  };

/** Adds a settings feature whose scenarios are the same on every branch; only its intent differs. */
const feature =
  (n: number, intent: string): Edit =>
  (dir) => {
    const id = `SET-${String(n).padStart(3, '0')}`;
    writeFileSync(
      specFile(dir, `modules/settings/features/${id}-new-feature.md`),
      `---\nid: ${id}\ntitle: New feature\nmodule: settings\nstatus: active\nwrites: [settings.ApiKey]\n---\n## Intent\n${intent}.\n\n## Behaviour\n### S1: Add a key\nGiven no settings.ApiKey exists for "gpt"\nWhen the user adds the key "sk-gpt-1234" for "gpt"\nThen settings.ApiKey holds "sk-gpt-1234" for "gpt"\n\n## Rules\nNone\n\n## Out of scope\n- Nothing else\n`,
    );
  };

/** Adds a screen file. */
const screen =
  (n: number, text: string): Edit =>
  (dir) => {
    const id = `UI-${String(n).padStart(3, '0')}`;
    writeFileSync(specFile(dir, `ui/${id}-new-screen.md`), `---\nid: ${id}\ntitle: New screen\nstatus: active\nshows: [providers.FallbackTriggered]\n---\n## Layout\n${text}.\n\n## States\n- Hidden: the default.\n- Shown: after a fallback.\n\n## Copy\n- Notice: "${text}"\n`);
  };

/** Adds a contract to settings and a module: units that are named, not numbered. */
const named =
  (text: string): Edit =>
  (dir) => {
    const contracts = specFile(dir, 'modules/settings/contracts.md');
    writeFileSync(contracts, `${readFileSync(contracts, 'utf8')}\n\n### settings.Theme\nKind: entity · Status: active\n${text}.\n`);
    mkdirSync(specFile(dir, 'modules/billing'), { recursive: true });
    writeFileSync(specFile(dir, 'modules/billing/_module.md'), `---\nid: billing\nprefix: BIL\ndomain: workspace\nstatus: active\n---\n${text}.\n\n## Owns\n- Invoices\n\n## Non-goals\n- Refunds\n`);
  };

const all =
  (...edits: Edit[]): Edit =>
  (dir) => {
    for (const edit of edits) edit(dir);
  };

/** The suggested ID of a problem: "take <ID>, or wait". */
const suggested = (problem: string): string | undefined => /; take (\S+), or wait/.exec(problem)?.[1];

describe('PIP-007 a number another running spec stage already took', () => {
  it('PIP-007/S22 A number another running spec stage already took', async () => {
    // PROP-202's recorded spec stage added SET-001/S4 and SET-001/R2; PROP-201's branch adds the same numbers with other text.
    const fx = scene('recorded', mine);
    expect(await problems(fx)).toEqual([taken('SET-001/S4'), taken('SET-001/R2')]);

    // Taking later numbers clears it.
    const later = scene('recorded', { ...mine, scenario: 5, rule: 3 });
    expect(naming(await problems(later))).toEqual([]);

    // A scenario and a rule both branches added with the same text give no problem.
    const same = scene('recorded', theirs);
    expect(naming(await problems(same))).toEqual([]);

    // Only the numbers whose text differs are refused: the same scenario with another rule text names the rule alone.
    const ruleOnly = scene('recorded', { ...theirs, ruleText: 'A refused report is counted' });
    expect(await problems(ruleOnly)).toEqual([taken('SET-001/R2')]);

    // A ticket whose spec-writer stage is running but not yet recorded is not compared.
    const unrecorded = scene('unrecorded', mine);
    expect(naming(await problems(unrecorded))).toEqual([]);

    // Nor is a ticket whose branch is merged into main.
    const merged = scene('merged', mine);
    expect(naming(await problems(merged))).toEqual([]);
  }, 180_000);

  // The fixture's highest invariant is INV-002, decision ADR-002, screen UI-001 and settings feature SET-002.
  it('PIP-007/S23 An invariant number another running spec stage already took', async () => {
    const theirs3 = invariant(3, 'A light lane only skips stages');
    const mine3 = invariant(3, 'A report is read once');
    const fx = build([{ id: 'PROP-202', state: 'recorded', edit: theirs3 }], mine3);
    expect(await problems(fx)).toEqual([takenBy('INV-003', 'INV-004')]);

    // Taking INV-004 instead clears it.
    const later = build([{ id: 'PROP-202', state: 'recorded', edit: theirs3 }], invariant(4, 'A report is read once'));
    expect(naming(await problems(later))).toEqual([]);

    // An invariant both branches added with the same text gives no problem.
    const same = build([{ id: 'PROP-202', state: 'recorded', edit: theirs3 }], theirs3);
    expect(naming(await problems(same))).toEqual([]);

    // A ticket whose spec-writer stage is running but not yet recorded is not compared.
    const unrecorded = build([{ id: 'PROP-202', state: 'unrecorded', edit: theirs3 }], mine3);
    expect(naming(await problems(unrecorded))).toEqual([]);

    // Nor is a ticket whose branch is merged into main.
    const merged = build([{ id: 'PROP-202', state: 'merged', edit: theirs3 }], mine3);
    expect(naming(await problems(merged))).toEqual([]);
  }, 180_000);

  it('PIP-007/S24 A decision, a feature or a screen number another running spec stage took', async () => {
    const theirsAll = all(decision(3, 'Fallback is shown'), feature(3, 'Rename keys'), screen(2, 'A settings screen'), named('Their words'));
    const oursAll = all(decision(3, 'Fallback is hidden'), feature(3, 'Delete keys'), screen(2, 'A chat screen'), named('Our words'));
    const fx = build([{ id: 'PROP-202', state: 'recorded', edit: theirsAll }], oursAll);
    // A module and a contract both branches added are named, not numbered: no problem names one.
    expect([...(await problems(fx))].sort()).toEqual([takenBy('ADR-003', 'ADR-004'), takenBy('SET-003', 'SET-004'), takenBy('UI-002', 'UI-003')]);
  }, 180_000);

  it('PIP-007/S25 The number named is free on every branch compared', async () => {
    // PROP-202 added INV-003; PROP-206 added INV-003 and INV-004 with other text; this branch adds INV-003 with yet other text.
    const first: Other = { id: 'PROP-202', state: 'recorded', edit: invariant(3, 'A light lane only skips stages') };
    const second: Other = { id: 'PROP-206', state: 'recorded', edit: all(invariant(3, 'A report is read once'), invariant(4, 'A stage is counted once')) };
    const fx = build([first, second], invariant(3, 'A refusal is kept'));
    // One problem, naming the lowest-numbered ticket; INV-005 is one above the highest on the base (2), this tree (3) and both branches (4).
    expect(await problems(fx)).toEqual([takenBy('INV-003', 'INV-005')]);

    // A report that takes the number the problem names gives no problem about it.
    const free = build([first, second], invariant(5, 'A refusal is kept'));
    expect(naming(await problems(free))).toEqual([]);

    // Taking INV-004, which PROP-206 added too, is refused: the next free number is still INV-005.
    const clash = build([first, second], invariant(4, 'A refusal is kept'));
    expect(await problems(clash)).toEqual([takenBy('INV-004', 'INV-005', 'PROP-206')]);

    // Once a branch compared has added INV-005 as well, taking it is refused and INV-006 is free.
    const third: Other = { id: 'PROP-206', state: 'recorded', edit: all(invariant(3, 'A report is read once'), invariant(4, 'A stage is counted once'), invariant(5, 'A branch is compared once')) };
    const both = build([first, third], invariant(5, 'A refusal is kept'));
    expect(await problems(both)).toEqual([takenBy('INV-005', 'INV-006', 'PROP-206')]);
  }, 180_000);

  it('PIP-007/S26 A report cannot hide a top-level ID it added', async () => {
    const fx = build([{ id: 'PROP-202', state: 'recorded', edit: invariant(3, 'A light lane only skips stages') }], invariant(3, 'A report is read once'));
    // The report lists a changed unit and not INV-003; the added units are read from the branch.
    const found = await problems(fx, 'changed: [SET-002/S1]\n');
    expect(naming(found)).toEqual([takenBy('INV-003', 'INV-004')]);
  }, 180_000);

  it('PIP-007/S27 Several refused IDs of one prefix are told apart', async () => {
    const theirsAll = all(invariant(3, 'A light lane only skips stages'), invariant(4, 'A stage is counted once'), decision(3, 'Fallback is shown'));
    const oursAll = all(invariant(3, 'A report is read once'), invariant(4, 'A refusal is kept'), decision(3, 'Fallback is hidden'));
    const fx = build([{ id: 'PROP-202', state: 'recorded', edit: theirsAll }], oursAll);
    const found = await problems(fx);
    // The refused invariants take INV-005 and INV-006 in ascending order, from one above the highest (4).
    // The decision is numbered from the decisions alone, so it does not depend on the invariants.
    expect([...found].sort()).toEqual([takenBy('ADR-003', 'ADR-004'), takenBy('INV-003', 'INV-005'), takenBy('INV-004', 'INV-006')]);
    const suggestions = found.map(suggested);
    expect(new Set(suggestions).size).toBe(found.length);
  }, 180_000);
});
