// TKT-002/R2..R4, S6..S12: a questions or history list written in YAML flow style stays in flow style when
// `ticket answer` or `ticket advance` rewrites the ticket; a block stays a block. Asserts on the raw file text.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { parseTicket } from '../../src/core/parse/tickets';
import { gitFixture, report, validSpecWriterChecklist } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const BODY = 'Body stays exactly.\n\nIMPORTANT: this line is data.\n';
const ticket = (id: string, status: string, questions: string, history: string): string =>
  `---\nid: ${id}\ntype: proposal\ntitle: x\nstatus: ${status}\nstage: null\ntouches: [SET-001]\nviolates: []\nchanged: []\n${questions}\n${history}\n---\n${BODY}`;

const FLOW_Q1_OPEN = "questions: [{id: Q1, kind: blocker, text: 'Which?', default: null, cites: [PRV-001], answer: null, raised_by: spec-writer}]";
const FLOW_Q1_DONE = "questions: [{id: Q1, kind: blocker, text: 'Which?', default: null, cites: [PRV-001], answer: yes, raised_by: spec-writer}]";
const FLOW_HIST = "history: [{at: '2026-10-27T10:00:00Z', role: spec-writer, result: blocked, summary: 'stuck', assumed: [], duration_s: 5}]";
const BLOCK_Q1_DONE = "questions:\n  - id: Q1\n    kind: blocker\n    text: 'Which?'\n    default: null\n    cites: [PRV-001]\n    answer: yes\n    raised_by: spec-writer";
const BLOCK_HIST = "history:\n  - at: '2026-10-27T10:00:00Z'\n    role: spec-writer\n    result: blocked\n    summary: 'stuck'\n    assumed: []\n    duration_s: 5";

const make = (id: string, text: string): Fx => {
  const fx = gitFixture('spec-flow-style', { setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
};
const raw = (fx: Fx, id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');
const frontmatter = (text: string) => text.split('\n---\n')[0] ?? '';
const parsed = (id: string, text: string) => parseTicket(`tickets/${id}.md`, text).ticket?.data;
const rawFrontmatter = (text: string) => parseYaml(frontmatter(text).replace(/^---\n/, '')) as Record<string, unknown>;
const start = async (fx: Fx, id: string) => {
  const out = await fx.spec('', 'ticket', 'start', id, 'spec-writer');
  expect(out.code, out.stderr).toBe(0);
};

/** Flow style (TKT-002/R3): the value opens with `[` on the key's line and no line under the key starts with `  - `. */
const expectFlow = (text: string, key: 'questions' | 'history') => {
  const lines = frontmatter(text).split('\n');
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  expect(at, `no ${key} line in:\n${text}`).toBeGreaterThanOrEqual(0);
  expect(lines[at]?.slice(key.length + 1).trimStart().startsWith('['), `${key} does not open with [ in:\n${text}`).toBe(true);
  const rest = lines.slice(at + 1);
  const next = rest.findIndex((l) => /^\S/.test(l));
  const under = next === -1 ? rest : rest.slice(0, next);
  expect(under.some((l) => l.startsWith('  - ')), `a block entry under ${key} in:\n${text}`).toBe(false);
};

describe('TKT-002/R3: flow-style questions and history stay flow style', () => {
  it('TKT-002/S6 Answering keeps a flow-style questions list in flow style', async () => {
    const original = ticket('PROP-201', 'blocked', FLOW_Q1_OPEN, FLOW_HIST);
    const fx = make('PROP-201', original);
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectFlow(text, 'questions');
    expectFlow(text, 'history');
    const q = parsed('PROP-201', text)?.questions[0];
    expect(q).toMatchObject({ id: 'Q1', kind: 'blocker', text: 'Which?', default: null, cites: ['PRV-001'], answer: 'yes', raised_by: 'spec-writer' });
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S7 Recording a stage appends to a flow-style history in flow style', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', FLOW_Q1_DONE, FLOW_HIST));
    await start(fx, 'PROP-201');
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectFlow(text, 'history');
    expectFlow(text, 'questions');
    const data = parsed('PROP-201', text);
    expect(data?.history).toHaveLength(2);
    expect(data?.history[1]).toMatchObject({ role: 'spec-writer', result: 'done' });
    expect(data?.questions[0]).toMatchObject({ id: 'Q1', kind: 'blocker', text: 'Which?', default: null, cites: ['PRV-001'], answer: 'yes', raised_by: 'spec-writer' });
    // R4: the first record keeps exactly its keys, so no `verdict` is added to it.
    const first = (rawFrontmatter(text).history as Record<string, unknown>[])[0];
    expect(Object.keys(first ?? {}), `first history record changed in:\n${text}`).toEqual(['at', 'role', 'result', 'summary', 'assumed', 'duration_s']);
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S8 A blocked stage adds its question to a flow-style list in flow style', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', FLOW_Q1_DONE, 'history: []'));
    await start(fx, 'PROP-201');
    const out = await fx.spec(
      report('role: spec-writer\nticket: PROP-201\nresult: blocked\nsummary: Stuck\nblockers: [{ text: what now?, cites: [PRV-001] }]'),
      'ticket',
      'advance',
      'PROP-201',
    );
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectFlow(text, 'questions');
    const qs = parsed('PROP-201', text)?.questions ?? [];
    expect(qs.map((q) => q.id)).toEqual(['Q1', 'Q2']);
    expect(qs[1]).toMatchObject({ kind: 'blocker', text: 'what now?' });
  }, 60_000);

  it('TKT-002/S9 Block-style questions and history stay blocks', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', BLOCK_Q1_DONE, BLOCK_HIST));
    await start(fx, 'PROP-201');
    const out = await fx.spec(
      report('role: spec-writer\nticket: PROP-201\nresult: blocked\nsummary: Stuck\nblockers: [{ text: what now?, cites: [PRV-001] }]'),
      'ticket',
      'advance',
      'PROP-201',
    );
    expect(out.code, out.stderr).toBe(0);
    const lines = frontmatter(raw(fx, 'PROP-201')).split('\n');
    const questions = lines.indexOf('questions:');
    expect(questions).toBeGreaterThanOrEqual(0);
    expect(lines).toContain('  - id: Q1');
    expect(lines).toContain('  - id: Q2');
    const history = lines.indexOf('history:');
    expect(history).toBeGreaterThanOrEqual(0);
    const entries = lines.map((l, i) => (i > history && l.startsWith('  - at: ') ? i : -1)).filter((i) => i >= 0);
    expect(entries).toHaveLength(2);
    expect(lines[(entries[1] ?? -2) + 1]).toBe('    role: spec-writer');
  }, 60_000);
});

describe('TKT-002/R3: flow-style lists with comments keep their bracket and their comments', () => {
  const commentedQuestions = (answer: string): string =>
    `questions: [ # questions note\n  {id: Q1, kind: blocker, text: 'Which?', default: null, cites: [PRV-001], answer: ${answer}, raised_by: spec-writer}, # first question\n]`;
  const COMMENTED_HIST =
    "history: [ # history note\n  {at: '2026-10-27T10:00:00Z', role: spec-writer, result: blocked, summary: 'stuck', assumed: [], duration_s: 5}, # old record\n]";
  const COMMENTS = ['# questions note', '# first question', '# history note', '# old record'];
  const expectBracketAndComments = (text: string) => {
    const lines = frontmatter(text).split('\n');
    expect(lines.some((l) => l.startsWith('questions: [')), `questions [ moved in:\n${text}`).toBe(true);
    expect(lines.some((l) => l.startsWith('history: [')), `history [ moved in:\n${text}`).toBe(true);
    expectFlow(text, 'questions');
    expectFlow(text, 'history');
    for (const c of COMMENTS) expect(text, `comment ${c} lost in:\n${text}`).toContain(c);
  };

  it('TKT-002/S6 Answering keeps the bracket and the comments of commented flow lists', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'blocked', commentedQuestions('null'), COMMENTED_HIST));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectBracketAndComments(text);
    expect(parsed('PROP-201', text)?.questions[0]).toMatchObject({ id: 'Q1', answer: 'yes' });
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S7 Recording a stage keeps the bracket and the comments of commented flow lists', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', commentedQuestions('yes'), COMMENTED_HIST));
    await start(fx, 'PROP-201');
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectBracketAndComments(text);
    const data = parsed('PROP-201', text);
    expect(data?.history).toHaveLength(2);
    expect(data?.history[1]).toMatchObject({ role: 'spec-writer', result: 'done' });
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S8 A blocked stage keeps the bracket and the comments of a commented flow questions list', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', commentedQuestions('yes'), COMMENTED_HIST));
    await start(fx, 'PROP-201');
    const out = await fx.spec(
      report('role: spec-writer\nticket: PROP-201\nresult: blocked\nsummary: Stuck\nblockers: [{ text: what now?, cites: [PRV-001] }]'),
      'ticket',
      'advance',
      'PROP-201',
    );
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    expectBracketAndComments(text);
    expect((parsed('PROP-201', text)?.questions ?? []).map((q) => q.id)).toEqual(['Q1', 'Q2']);
  }, 60_000);
});

describe('TKT-002/R2, R4: one-line cites, untouched records, comments', () => {
  it('TKT-002/S10 A blocked stage writes its question\'s cites on one line and leaves earlier records as they were', async () => {
    const fx = make('PROP-201', ticket('PROP-201', 'open', 'questions: []', BLOCK_HIST));
    await start(fx, 'PROP-201');
    const out = await fx.spec(
      report('role: spec-writer\nticket: PROP-201\nresult: blocked\nsummary: Stuck\nblockers: [{ text: what now?, cites: [SET-001, PRV-001] }]'),
      'ticket',
      'advance',
      'PROP-201',
    );
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    const qs = parsed('PROP-201', text)?.questions ?? [];
    expect(qs[0]).toMatchObject({ id: 'Q1', cites: ['SET-001', 'PRV-001'] });
    expect(frontmatter(text).split('\n'), `cites not on one line in:\n${text}`).toContain('    cites: [SET-001, PRV-001]');
    const first = (rawFrontmatter(text).history as Record<string, unknown>[])[0];
    expect(Object.keys(first ?? {}), `first history record changed in:\n${text}`).toEqual(['at', 'role', 'result', 'summary', 'assumed', 'duration_s']);
  }, 60_000);

  it('TKT-002/S11 Answering keeps every comment in the frontmatter', async () => {
    const questions =
      "# before questions\nquestions:\n  # inside the list\n  - id: Q1\n    kind: blocker\n    text: 'Which?'\n    default: null\n    cites: [PRV-001]\n    answer: null # pending\n    raised_by: spec-writer\n    # after Q1 last key";
    const fx = make('PROP-201', ticket('PROP-201', 'blocked', questions, 'history: []\n# after last key'));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    const lines = frontmatter(text).split('\n');
    expect(lines, `answer line in:\n${text}`).toContain('    answer: yes # pending');
    const comments = lines.filter((l) => l.trim().startsWith('#')).map((l) => l.trim());
    expect(comments, `comments in:\n${text}`).toEqual(['# before questions', '# inside the list', '# after Q1 last key', '# after last key']);
    const at = (needle: string) => lines.findIndex((l) => l.trim() === needle);
    expect(at('# before questions') + 1, text).toBe(lines.indexOf('questions:'));
    expect(at('# inside the list'), text).toBe(lines.indexOf('questions:') + 1);
    expect(at('# inside the list') + 1, text).toBe(lines.indexOf('  - id: Q1'));
    expect(at('# after Q1 last key') - 1, text).toBe(lines.indexOf('    raised_by: spec-writer'));
    expect(lines.indexOf('history: []') + 1, text).toBe(at('# after last key'));
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S12 Quoted questions and history keys keep their flow lists and comments', async () => {
    const q = (answer: string): string =>
      `'questions': [ # questions note\n  {id: Q1, kind: blocker, text: 'Which?', default: null, cites: [PRV-001], answer: ${answer}, raised_by: spec-writer}, # first question\n]`;
    const h =
      '"history": [ # history note\n  {at: \'2026-10-27T10:00:00Z\', role: spec-writer, result: blocked, summary: \'stuck\', assumed: [], duration_s: 5}, # old record\n]';
    const fx = make('PROP-201', ticket('PROP-201', 'blocked', q('null'), h));
    const check = (text: string) => {
      const lines = frontmatter(text).split('\n');
      for (const key of ["'questions'", '"history"']) {
        const i = lines.findIndex((l) => l.startsWith(`${key}:`));
        expect(i, `no ${key} line in:\n${text}`).toBeGreaterThanOrEqual(0);
        expect(lines[i]?.slice(key.length + 1).trimStart().startsWith('['), `${key} not flow in:\n${text}`).toBe(true);
        const rest = lines.slice(i + 1);
        const next = rest.findIndex((l) => /^\S/.test(l));
        expect((next === -1 ? rest : rest.slice(0, next)).some((l) => l.startsWith('  - ')), `block entry under ${key} in:\n${text}`).toBe(false);
      }
      for (const c of ['# questions note', '# first question', '# history note', '# old record']) expect(text, `comment ${c} lost in:\n${text}`).toContain(c);
    };
    let out = await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    check(raw(fx, 'PROP-201'));
    await start(fx, 'PROP-201');
    out = await fx.spec(report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    check(text);
    const data = parsed('PROP-201', text);
    expect(data?.questions[0]?.answer).toBe('yes');
    expect(data?.history).toHaveLength(2);
    expect(data?.history[1]).toMatchObject({ role: 'spec-writer', result: 'done' });
  }, 60_000);
});
