// PIP-012/S22 and R11: the spec review's brief holds the spec delta from real git and the
// spec-writer's checklist, on a throwaway copy of chat-mini whose ticket branch changed the spec.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const FEATURE = 'spec/modules/providers/features/PRV-001-stream-a-reply.md';
const WRITER = [
  '  - at: "2026-10-28T10:00:00.000Z"',
  '    role: spec-writer',
  '    result: done',
  '    summary: x',
  '    verdict: null',
  '    assumed: []',
  '    checklist:',
  '      - { item: C1, outcome: scenarios, ids: [PRV-001/S4] }',
  '      - { item: C2, outcome: na, ids: [], reason: "no path is read" }',
  '      - { item: C3, outcome: na, ids: [], reason: "no shared state" }',
  '      - { item: C4, outcome: na, ids: [], reason: "no trust boundary" }',
  '      - { item: C5, outcome: na, ids: [], reason: "no unknown input" }',
  '      - { item: C6, outcome: scenarios, ids: [PRV-001/S1] }',
  '      - { item: C8, outcome: na, ids: [], reason: "no external fact" }',
].join('\n');

/** chat-mini whose PROP-201 has a done spec-writer stage, on a ticket branch that changed the spec. */
function fresh(opts: { checklist?: boolean; budgets?: Record<string, number>; more?: string } = {}): Fx {
  const fx = gitFixture('spec-brief-spec-review', {
    setup: (dir) => {
      const ticket = join(dir, 'tickets/PROP-201.md');
      const entry = opts.checklist === false ? WRITER.split('\n    checklist:')[0] ?? '' : WRITER;
      writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${entry}`));
      if (opts.budgets) {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        writeFileSync(path, `${JSON.stringify({ ...config, budgets: opts.budgets }, null, 2)}\n`);
      }
    },
  });
  made.push(fx);
  fx.git('checkout', '-q', '-b', 'ticket/PROP-201');
  const feature = join(fx.repo, FEATURE);
  writeFileSync(feature, `${readFileSync(feature, 'utf8')}\nSPEC-DELTA-MARKER with a fence \`\`\` inside.\n${opts.more ?? ''}`);
  // Generated files change too; the delta leaves them out.
  writeFileSync(join(fx.repo, 'spec/index.md'), `${readFileSync(join(fx.repo, 'spec/index.md'), 'utf8')}\nINDEX-MARKER\n`);
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'PROP-201 spec-writer: change the spec');
  return fx;
}

const group = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';
const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

describe('PIP-012 the spec review gets the spec delta and the checklist', () => {
  it("PIP-012/S22 The spec review gets the spec delta and the spec-writer's checklist", async () => {
    const fx = fresh();
    const out = await fx.spec('', 'brief', 'spec-review', 'PROP-201');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Brief · spec-review · PROP-201 · spec@[0-9a-f]{8}$/);
    const checklist = group(out.stdout, "Spec-writer's checklist").trim().split('\n');
    expect(checklist).toContain('- C1 neighbours: scenarios PRV-001/S4');
    expect(checklist).toContain('- C2 environment axes: na: no path is read');
    expect(checklist).toHaveLength(7);
    const delta = group(out.stdout, 'Spec delta');
    expect(delta.startsWith("What the spec-writer changed, against the merge base with main. Judge this change; the rest of the brief is context.\n")).toBe(true);
    // The diff of the spec folder, in a "diff" fence one backtick longer than the longest run inside.
    expect(delta).toContain('````diff\n');
    expect(delta).toContain('+SPEC-DELTA-MARKER with a fence ``` inside.');
    expect(delta).toContain(FEATURE);
    expect(delta).not.toContain('spec/index.md');
    expect(delta).not.toContain('INDEX-MARKER');
    expect(delta.trimEnd().endsWith('\n````')).toBe(true);
    // The neighbours' scenarios are there as for every other role.
    expect(group(out.stdout, 'Neighbours')).toContain('### CNV-001: Send a message\n');
    const groups = groupsOf(out.stdout);
    expect(groups.indexOf("Spec-writer's checklist")).toBeLessThan(groups.indexOf('Spec delta'));
    expect(groups.indexOf('Spec delta')).toBeLessThan(groups.indexOf('Neighbours'));
    expect(groups.at(-1)).toBe('Expand');
    // No other role's brief holds either group.
    for (const role of ['spec-writer', 'tester', 'implementer', 'reviewer']) {
      const other = groupsOf((await fx.spec('', 'brief', role, 'PROP-201')).stdout);
      expect(other, role).not.toContain("Spec-writer's checklist");
      expect(other, role).not.toContain('Spec delta');
    }
  }, 60_000);

  it('PIP-012/S22 A spec-writer stage recorded with no checklist gives the one line', async () => {
    const fx = fresh({ checklist: false });
    const out = await fx.spec('', 'brief', 'spec-review', 'PROP-201');
    expect(group(out.stdout, "Spec-writer's checklist").trim()).toBe('The spec-writer reported no checklist; treat every item as open.');
  }, 60_000);

  it('PIP-012/S22 The delta is neither counted toward the brief nor cut; the budget is 10000 unless brief.spec-review is set', async () => {
    // About 20000 tokens of delta: far over the default budget of 10000, yet nothing is cut or warned.
    const long = Array.from({ length: 2000 }, (_, i) => `Delta line ${i} with enough words to weigh a few tokens each.`).join('\n');
    const fx = fresh({ more: `${long}\nDELTA-LAST-LINE\n` });
    const out = await fx.spec('', 'brief', 'spec-review', 'PROP-201');
    expect(out.stdout).not.toContain('> Warning');
    expect(out.stdout).toContain('+Delta line 0 with enough words');
    expect(out.stdout).toContain('+Delta line 1999 with enough words');
    expect(out.stdout).toContain('+DELTA-LAST-LINE');

    const own = fresh({ budgets: { 'brief.spec-review': 300 } });
    const small = await own.spec('', 'brief', 'spec-review', 'PROP-201');
    expect(small.stdout).toContain('over the spec-review budget of 300. Nothing required was dropped.');
    expect(small.stdout).toContain('+SPEC-DELTA-MARKER');
  }, 60_000);
});

// PIP-012/R15, S28 and S29 (INV-009): after a spec-review approve, a spec round that only answers
// findings gets a spec review of that round; every other round gets the full delta. Real git: the
// approve is a stage commit on the ticket branch, "main" is merged into it, and the ticket's
// history is the file in the working tree (as in the stage commits, the brief reads it from there).
const PRV1 = FEATURE;
const PRV2 = 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
const SET1 = 'spec/modules/settings/features/SET-001-enable-providers.md';
const S2_LINE = 'Then providers.RateLimited is emitted with providerId "claude" and retryAfterMs 500';
const SET_S2_LINE = 'And "claude" is never called (INV-001)';
const FINDING = { cites: ['PRV-001/S3'], text: 'no scenario covers a second rate limit', spec: true };
const CHECKLIST = [
  { item: 'C1', outcome: 'scenarios', ids: ['PRV-001/S3'] },
  { item: 'C2', outcome: 'na', ids: [], reason: 'no path is read' },
  { item: 'C3', outcome: 'na', ids: [], reason: 'no shared state' },
  { item: 'C4', outcome: 'na', ids: [], reason: 'no trust boundary' },
  { item: 'C5', outcome: 'na', ids: [], reason: 'no unknown input' },
  { item: 'C6', outcome: 'scenarios', ids: ['PRV-001/S1'] },
  { item: 'C8', outcome: 'na', ids: [], reason: 'no external fact' },
];
const FULL_LINE = 'What the spec-writer changed, against the merge base with main. Judge this change; the rest of the brief is context.\n';
const NARROW_LINE = /^What the spec-writer changed since the spec review approved the spec at ([0-9a-f]{7,40}), to answer the findings above\. Judge only this change, as strictly as a full review: every item of the checklist applies to it\. The rest of the brief is context\.\n/;

type Entry = Record<string, unknown>;
let clock = 0;
const entry = (role: string, verdict: 'approve' | 'changes' | null = null, extra: Entry = {}, result = 'done'): Entry => ({
  at: `2026-10-28T11:${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}.000Z`,
  role,
  result,
  summary: `${role} stage`,
  verdict,
  assumed: [],
  ...extra,
});
const writerEntry = (extra: Entry = {}) => entry('spec-writer', null, { checklist: CHECKLIST, ...extra });

function edit(fx: Fx, rel: string, from: string, to: string): void {
  const path = join(fx.repo, rel);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`${rel}: no "${from}"`);
  writeFileSync(path, text.replace(from, () => to));
}
const append = (fx: Fx, rel: string, text: string): void => {
  writeFileSync(join(fx.repo, rel), `${readFileSync(join(fx.repo, rel), 'utf8')}${text}`);
};
function must(r: { code: number; stderr: string }): void {
  if (r.code !== 0) throw new Error(r.stderr);
}
const commit = (fx: Fx, subject: string, ...paths: string[]) => {
  must(fx.git('add', ...paths));
  must(fx.git('commit', '-q', '-m', subject, '-m', 'Spec-Ticket: PROP-201'));
};
function setHistory(fx: Fx, history: Entry[]): void {
  const path = join(fx.repo, 'tickets/PROP-201.md');
  const lines = history.map((e) => `  - ${JSON.stringify(e)}\n`).join('');
  writeFileSync(path, readFileSync(path, 'utf8').replace(/^history:(?: \[\])?\n(?: {2}- .*\n)*/m, () => (history.length ? `history:\n${lines}` : 'history: []\n')));
}
const head = (fx: Fx) => fx.git('rev-parse', 'HEAD').stdout.trim();

/** A change on "main" after the branch forked, merged into the ticket branch. */
function mergeMain(fx: Fx, conflict: boolean): void {
  must(fx.git('checkout', '-q', 'main'));
  if (conflict) edit(fx, PRV1, S2_LINE, `${S2_LINE} MAIN-LINE`);
  else edit(fx, SET1, SET_S2_LINE, `${SET_S2_LINE}\nAnd MAIN-BROUGHT-STEP nothing else happens`);
  commit(fx, 'main: change the spec', 'spec');
  must(fx.git('checkout', '-q', 'ticket/PROP-201'));
  const merged = fx.git('merge', '--no-ff', '-q', '-m', 'PROP-201: sync with main', '-m', 'Spec-Ticket: PROP-201', 'main');
  if (conflict) {
    expect(merged.code).not.toBe(0);
    const path = join(fx.repo, PRV1);
    writeFileSync(path, readFileSync(path, 'utf8').replace(/<<<<<<< [^\n]*\n[\s\S]*?>>>>>>> [^\n]*\n/, () => `${S2_LINE} BRANCH-LINE MAIN-LINE\n`));
    must(fx.git('add', PRV1));
    must(fx.git('commit', '-q', '--no-edit'));
  } else {
    must(merged);
  }
}

/** The spec-writer round that answers the finding: PRV-001/S3 changes and PRV-001/S5 is added. */
function answerRound(fx: Fx, history: Entry[], opts: { other?: boolean; extra?: Entry } = {}): void {
  edit(fx, PRV1, 'Then no line of the app log contains "sk-claude-secret" (INV-002)', 'Then no line of the app log contains "sk-claude-secret" (INV-002)\nAnd SECOND-LIMIT-STEP the log holds no retry key');
  edit(
    fx,
    PRV1,
    '\n## Rules\nNone',
    [
      '',
      '### S5: A second rate limit',
      'Given providers.ProviderConfig has "claude" as the active and enabled provider and no fallback',
      'When "claude" rate-limits twice in a row',
      'Then providers.RateLimited is emitted twice',
      'And the log shows ```SECOND-LIMIT-FENCE``` once',
      '',
      '## Rules',
      'None',
    ].join('\n'),
  );
  if (opts.other) edit(fx, SET1, 'When the user disables "claude"', 'When the user disables "claude" WRITER-OTHER-UNIT');
  append(fx, 'spec/index.md', '\nINDEX-MARKER\n');
  commit(fx, 'PROP-201 spec-writer: answer the finding', 'spec');
  history.push(writerEntry(opts.extra));
  setHistory(fx, history);
}

interface Opts {
  /** No approve: the first spec review asked for changes. */
  readonly noApprove?: boolean;
  /** The approve commit sits on a side branch the ticket branch never merged. */
  readonly side?: boolean;
  /** "main" and the pre-approve round change the same line of PRV-001/S2. */
  readonly conflict?: boolean;
  /** The reviewer's finding asks for tests only, not marked spec. */
  readonly noSpecFinding?: boolean;
  readonly other?: boolean;
  readonly extra?: Entry;
}

/** chat-mini on a ticket branch: a first spec round, the approve, the code stages, a reviewer finding, main merged, the answering round. */
function proposal(opts: Opts = {}): { fx: Fx; history: Entry[]; approve: string } {
  const fx = gitFixture('spec-brief-narrow');
  made.push(fx);
  must(fx.git('checkout', '-q', '-b', 'ticket/PROP-201'));
  append(fx, PRV2, '\nROUND1-MARKER\n');
  if (opts.conflict) edit(fx, PRV1, S2_LINE, `${S2_LINE} BRANCH-LINE`);
  commit(fx, 'PROP-201 spec-writer: the first round', 'spec');
  const history: Entry[] = [writerEntry()];
  let approve = '';
  if (opts.noApprove) {
    history.push(entry('spec-review', 'changes', { findings: [FINDING] }));
  } else {
    history.push(entry('spec-review', 'approve'));
    if (opts.side) must(fx.git('checkout', '-q', '-b', 'side'));
    setHistory(fx, history);
    commit(fx, 'PROP-201 spec-review: Approved', 'tickets/PROP-201.md');
    approve = head(fx);
    if (opts.side) {
      must(fx.git('checkout', '-q', 'ticket/PROP-201'));
      setHistory(fx, []);
    }
    history.push(entry('tester'), entry('implementer'));
    history.push(entry('reviewer', 'changes', { findings: [opts.noSpecFinding ? { cites: ['PRV-001/S3'], text: FINDING.text, tests: true } : FINDING] }));
    if (opts.noSpecFinding) history.push(entry('spec-writer', null, {}, 'reopened'));
  }
  mergeMain(fx, opts.conflict === true);
  answerRound(fx, history, { ...(opts.other === undefined ? {} : { other: opts.other }), ...(opts.extra === undefined ? {} : { extra: opts.extra }) });
  return { fx, history, approve };
}

const briefOf = async (fx: Fx) => (await fx.spec('', 'brief', 'spec-review', 'PROP-201')).stdout;

describe('PIP-012 the spec review after an approve', () => {
  it('PIP-012/S28 A spec round that only answers findings gets a spec review of that round', async () => {
    const { fx, history, approve } = proposal();
    const out = await briefOf(fx);
    const delta = group(out, 'Spec delta');
    const line = NARROW_LINE.exec(delta);
    expect(line, delta.slice(0, 300)).not.toBeNull();
    expect(approve.startsWith(line?.[1] ?? 'none')).toBe(true);
    // A fence one backtick longer than the longest run inside (the added S5 holds a run of three).
    expect(delta).toContain('````diff\n');
    expect(delta.trimEnd().endsWith('\n````')).toBe(true);
    expect(delta).toContain(PRV1);
    expect(delta).toContain('+### S5: A second rate limit');
    expect(delta).toContain('+And SECOND-LIMIT-STEP the log holds no retry key');
    // Not the first spec-writer stage's changes, not generated files, not what "main" brought.
    expect(delta).not.toContain('ROUND1-MARKER');
    expect(delta).not.toContain(PRV2);
    expect(delta).not.toContain('MAIN-BROUGHT-STEP');
    expect(delta).not.toContain('SET-001-enable-providers.md');
    expect(delta).not.toContain('spec/index.md');
    expect(delta).not.toContain('INDEX-MARKER');
    expect(group(out, 'Review findings').trim()).toBe('- PRV-001/S3 (gap in the spec): no scenario covers a second rate limit');
    // Every other group is as in S22.
    expect(group(out, "Spec-writer's checklist").trim().split('\n')).toHaveLength(7);
    expect(group(out, 'Neighbours')).toContain('### CNV-001: Send a message\n');
    const groups = groupsOf(out);
    expect(groups.indexOf("Spec-writer's checklist")).toBeLessThan(groups.indexOf('Spec delta'));
    expect(groups.indexOf('Spec delta')).toBeLessThan(groups.indexOf('Neighbours'));
    expect(groups.at(-1)).toBe('Expand');

    // The spec review asks for changes citing PRV-001/S5; the next round changes only PRV-001/S5.
    history.push(entry('spec-review', 'changes', { findings: [{ cites: ['PRV-001/S5'], text: 'the second limit has no retry delay' }] }));
    edit(fx, PRV1, 'Then providers.RateLimited is emitted twice', 'Then providers.RateLimited is emitted twice, each with retryAfterMs 500 ROUND2-STEP');
    commit(fx, 'PROP-201 spec-writer: answer the spec review', 'spec');
    history.push(writerEntry());
    setHistory(fx, history);
    const again = group(await briefOf(fx), 'Spec delta');
    const second = NARROW_LINE.exec(again);
    expect(second, again.slice(0, 300)).not.toBeNull();
    expect(second?.[1]).toBe(line?.[1]);
    expect(again).toContain('+And SECOND-LIMIT-STEP the log holds no retry key');
    expect(again).toContain('ROUND2-STEP');
    expect(again).not.toContain('ROUND1-MARKER');
    expect(again).not.toContain('MAIN-BROUGHT-STEP');
  }, 120_000);

  const expectFull = (delta: string) => {
    expect(delta.startsWith(FULL_LINE), delta.slice(0, 300)).toBe(true);
    expect(delta).not.toContain('since the spec review approved');
    // The branch's whole diff of the spec folder, the first round's change among it.
    expect(delta).toContain('ROUND1-MARKER');
    expect(delta).toContain('+### S5: A second rate limit');
    expect(delta).toContain('````diff\n');
    expect(delta).not.toContain('spec/index.md');
  };

  it('PIP-012/S29 A round that changes anything else gets the full spec review', async () => {
    // The report lists only the cited units; the CLI reads git, not that list.
    const { fx } = proposal({ other: true, extra: { changed: ['PRV-001/S3', 'PRV-001/S5'] } });
    const delta = group(await briefOf(fx), 'Spec delta');
    expectFull(delta);
    expect(delta).toContain('WRITER-OTHER-UNIT');
  }, 120_000);

  it('PIP-012/S29 The full delta when the history holds no approve', async () => {
    const { fx } = proposal({ noApprove: true });
    expectFull(group(await briefOf(fx), 'Spec delta'));
  }, 120_000);

  it('PIP-012/S29 The full delta when no finding after the approve is marked spec or from a spec review', async () => {
    const { fx } = proposal({ noSpecFinding: true });
    expectFull(group(await briefOf(fx), 'Spec delta'));
  }, 120_000);

  it("PIP-012/S29 The full delta when the approve's commit is not in HEAD's history", async () => {
    const { fx, approve } = proposal({ side: true });
    expect(fx.git('merge-base', '--is-ancestor', approve, 'HEAD').code).not.toBe(0);
    expectFull(group(await briefOf(fx), 'Spec delta'));
  }, 120_000);

  it('PIP-012/S29 The full delta when what main brought cannot be applied to the approved spec without a conflict', async () => {
    const { fx } = proposal({ conflict: true });
    expectFull(group(await briefOf(fx), 'Spec delta'));
  }, 120_000);

  it('PIP-012/S29 Not a git repository: Unavailable after the full delta first line', async () => {
    const { fx } = proposal();
    rmSync(join(fx.repo, '.git'), { recursive: true, force: true });
    const delta = group(await briefOf(fx), 'Spec delta');
    expect(delta.startsWith(FULL_LINE)).toBe(true);
    expect(delta.slice(FULL_LINE.length).trim()).toMatch(/^Unavailable \(.+\)\.$/);
    expect(delta).not.toContain('since the spec review approved');
  }, 120_000);

  // INV-009: the approve is established from the committed stage records, not from the history
  // text in the working tree, which a hand edit can change.
  it("PIP-012/S29 The full delta when an approve entry's at is edited to a later spec-writer stage's timestamp", async () => {
    const fx = gitFixture('spec-brief-forged-at');
    made.push(fx);
    must(fx.git('checkout', '-q', '-b', 'ticket/PROP-201'));
    append(fx, PRV2, '\nROUND1-MARKER\n');
    commit(fx, 'PROP-201 spec-writer: the first round', 'spec');
    const history: Entry[] = [writerEntry(), entry('spec-review', 'approve')];
    setHistory(fx, history);
    commit(fx, 'PROP-201 spec-review: Approved', 'tickets/PROP-201.md');
    history.push(entry('tester'), entry('implementer'), entry('reviewer', 'changes', { findings: [FINDING] }));
    mergeMain(fx, false);
    // A later spec-writer stage changes a unit no finding cites, and its record is committed with it.
    edit(fx, SET1, 'When the user disables "claude"', 'When the user disables "claude" WRITER-OTHER-UNIT');
    const later = writerEntry();
    history.push(later);
    setHistory(fx, history);
    commit(fx, 'PROP-201 spec-writer: another unit', 'spec', 'tickets/PROP-201.md');
    // Then a change inside the finding's feature.
    answerRound(fx, history);
    // By hand, the approve entry gets the timestamp first committed by that later stage.
    setHistory(fx, history.map((e) => (e.role === 'spec-review' ? { ...e, at: later.at } : e)));
    const delta = group(await briefOf(fx), 'Spec delta');
    expectFull(delta);
    expect(delta).toContain('WRITER-OTHER-UNIT');
  }, 120_000);

  it('PIP-012/S29 The full delta when a committed spec-review changes record is edited to approve', async () => {
    const fx = gitFixture('spec-brief-forged-verdict');
    made.push(fx);
    must(fx.git('checkout', '-q', '-b', 'ticket/PROP-201'));
    append(fx, PRV2, '\nROUND1-MARKER\n');
    commit(fx, 'PROP-201 spec-writer: the first round', 'spec');
    const history: Entry[] = [writerEntry(), entry('spec-review', 'changes', { findings: [{ cites: ['PRV-002'], text: 'the first round is unclear' }] })];
    setHistory(fx, history);
    commit(fx, 'PROP-201 spec-review: Changes requested', 'tickets/PROP-201.md');
    history.push(entry('tester'), entry('implementer'), entry('reviewer', 'changes', { findings: [FINDING] }));
    mergeMain(fx, false);
    answerRound(fx, history);
    // By hand, the committed "changes" record becomes an "approve".
    setHistory(fx, history.map((e) => (e.role === 'spec-review' ? { ...e, verdict: 'approve', findings: undefined } : e)));
    const delta = group(await briefOf(fx), 'Spec delta');
    expectFull(delta);
  }, 120_000);
});
