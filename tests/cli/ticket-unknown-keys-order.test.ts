// Regression tests for PROP-046's review findings: raw key order of unknown keys through
// `ticket advance` and `ticket answer` (TKT-001/R10, S19, S20), assumptions with an invalid known key
// (TKT-001/R6, R9) and numeric-looking unknown keys (TKT-001/R9, LNT-014/R4, TKT-001/S17).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, gitFixture, report, validSpecWriterChecklist } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const chat = (id: string, text: string): Fx => {
  const fx = gitFixture('spec-unknown-order', { setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
};
const base = (id: string, text: string): Fx => {
  const fx = gitFixture('spec-unknown-order-base', { fixture: LINT_BASE, setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
};
const raw = (fx: Fx, id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');
/** Each needle occurs, and the first occurrences are in this order. */
const inOrder = (text: string, needles: string[]) => {
  const at = needles.map((n) => text.indexOf(n));
  expect(at.every((i) => i >= 0), `missing in:\n${text}`).toBe(true);
  expect(at, `order of ${needles.join(' | ')} in:\n${text}`).toEqual([...at].sort((a, b) => a - b));
};

interface Finding { rule: string; severity: string; file: string; line: number; message: string }
const lintJson = async (fx: Fx) => {
  const out = await fx.spec('', 'lint', '--format', 'json');
  return { code: out.code, findings: (JSON.parse(out.stdout) as { findings: Finding[] }).findings };
};

const REC = (extra: string) => `  - at: 2026-10-27T09:00:00.000Z\n    role: spec-writer\n    result: blocked\n    summary: Asked\n    verdict: null\n${extra}    duration_s: 3\n`;
const PROP = (id: string, status: string, questions: string, history: string) =>
  `---\nid: ${id}\ntype: proposal\ntitle: x\nowner: bob\nstatus: ${status}\nstage: null\ntouches: [SET-001]\nviolates: []\nchanged: []\n${questions}\n${history}\n---\nDo it.\n`;
const Q_OK = 'questions:\n  - id: Q1\n    kind: preference\n    text: Order?\n    default: alphabetical\n    cites: []\n    answer: null\n    raised_by: null';

describe('Raw key order of unknown keys survives a rewrite (TKT-001/R10)', () => {
  it('TKT-001/S19 Recording a stage keeps unknown keys in place in a flow history record', async () => {
    const hist = 'history: [{at: 2026-10-27T09:00:00.000Z, role: spec-writer, future1: a, result: blocked, summary: Asked, future2: b, verdict: null, assumed: [], duration_s: 3}]';
    const fx = chat('PROP-930', PROP('PROP-930', 'open', Q_OK, hist));
    expect((await fx.spec('', 'ticket', 'start', 'PROP-930', 'spec-writer')).code).toBe(0);
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-930\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-930');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-930');
    inOrder(text, ['title: x', 'owner: bob', 'status:']);
    inOrder(text, ['role: spec-writer', 'future1', 'result: blocked', 'summary: Asked', 'future2', 'verdict: null']);
    expect(text).toMatch(/future1: a/);
    expect(text).toMatch(/future2: b/);
  }, 60_000);

  it('TKT-001/S19 Recording a stage keeps unknown keys in place in nested assumed and findings records (block style)', async () => {
    const extra = '    assumed:\n      - new: Name?\n        future: x\n        value: y\n    findings:\n      - future: z\n        cites: [ZZZ-1]\n        text: t\n';
    const fx = chat('PROP-931', PROP('PROP-931', 'open', Q_OK, `history:\n${REC(extra)}`.trimEnd()));
    expect((await fx.spec('', 'ticket', 'start', 'PROP-931', 'spec-writer')).code).toBe(0);
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-931\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-931');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-931');
    inOrder(text, ['new: Name?', 'future: x', 'value: y']);
    inOrder(text, ['future: z', 'ZZZ-1', 'text: t']);
  }, 60_000);

  it('TKT-001/S19 Recording a stage keeps unknown keys in place in nested records of a flow history', async () => {
    const hist =
      'history: [{at: 2026-10-27T09:00:00.000Z, role: spec-writer, result: blocked, summary: Asked, verdict: null, assumed: [{new: Name?, future: x, value: y}], findings: [{future: z, cites: [ZZZ-1], text: t}], duration_s: 3}]';
    const fx = chat('PROP-932', PROP('PROP-932', 'open', Q_OK, hist));
    expect((await fx.spec('', 'ticket', 'start', 'PROP-932', 'spec-writer')).code).toBe(0);
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-932\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-932');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-932');
    inOrder(text, ['new: Name?', 'future: x', 'value: y']);
    inOrder(text, ['future: z', 'ZZZ-1', 'text: t']);
  }, 60_000);

  it('TKT-001/S20 Answering a question keeps unknown keys in place in flow questions', async () => {
    const qs = 'questions: [{id: Q1, kind: blocker, asked_at: x, text: Ok?, extra: {b: 1, a: 2}, default: null, cites: [], answer: null, raised_by: null}]';
    const fx = chat('PROP-933', PROP('PROP-933', 'blocked', qs, 'history: []'));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-933', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-933');
    inOrder(text, ['id: Q1', 'kind: blocker', 'asked_at: x', 'text: Ok?', 'extra', 'default: null', 'answer: yes']);
    inOrder(text, ['b: 1', 'a: 2']);
  }, 60_000);

});

describe('An assumption with an invalid known key is refused (TKT-001/R6, R9)', () => {
  const task = (assumed: string) =>
    `---\nid: TASK-940\ntype: task\ntitle: x\nstatus: open\nstage: null\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory:\n${REC(`    assumed: [${assumed}]\n`)}---\nDo it.\n`;

  it('TKT-001/R6 {question: BAD, new: Name, value: x, future: 1} is an error', async () => {
    const fx = base('TASK-940', task('{question: BAD, new: Name, value: x, future: 1}'));
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-940.md' && f.severity === 'error')).not.toEqual([]);
    expect(code).toBe(1);
    const gate = await fx.spec('', 'gate', 'TASK-940');
    expect(gate.code).toBe(1);
  });

  it('TKT-001/R6 {question: PROP-1#Q1, new: "", value: x, future: 1} is an error', async () => {
    const fx = base('TASK-940', task('{question: PROP-1#Q1, new: "", value: x, future: 1}'));
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-940.md' && f.severity === 'error')).not.toEqual([]);
    expect(code).toBe(1);
    expect((await fx.spec('', 'gate', 'TASK-940')).code).toBe(1);
  });

  it('TKT-001/R9 A truly unknown key alone is a warning, while the same key beside an invalid known one is an error', async () => {
    expect((await lintJson(base('TASK-940', task('{question: BAD, value: x, future: 1}')))).code).toBe(1);
    expect((await lintJson(base('TASK-940', task('{question: BAD, new: Name, value: x, future: 1}')))).code).toBe(1);
    const fx = base('TASK-940', task('{question: PROP-1#Q1, value: x, future: 1}'));
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-940.md')).toEqual([
      expect.objectContaining({ rule: 'L020', severity: 'warning', message: 'ticket has fields this spec does not know: history[0].assumed[0].future' }),
    ]);
    expect(code).toBe(0);
    expect((await fx.spec('', 'gate', 'TASK-940')).stdout.split('\n')[0]).toBe('TASK-940: ready');
  });
});

describe('Numeric-looking unknown keys keep file order (TKT-001/R9, TKT-001/S17)', () => {
  it('TKT-001/S17 owner then "2" in the frontmatter: both listed in file order, at the line of owner', async () => {
    const text = '---\nid: TASK-941\ntype: task\ntitle: x\nstatus: open\nstage: null\nowner: bob\n"2": x\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n';
    const fx = base('TASK-941', text);
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-941.md')).toEqual([
      expect.objectContaining({ rule: 'L020', severity: 'warning', line: 7, message: 'ticket has fields this spec does not know: owner, 2' }),
    ]);
    expect(code).toBe(0);
  });

  it('TKT-001/S17 a question record with zeta then "2": file order, at the line of zeta', async () => {
    const q = 'questions:\n  - id: Q1\n    kind: preference\n    text: Name?\n    default: a\n    cites: []\n    answer: null\n    raised_by: null\n    zeta: a\n    "2": b';
    const text = `---\nid: TASK-942\ntype: task\ntitle: x\nstatus: open\nstage: null\ntouches: [ALP-001]\nviolates: []\nchanged: []\n${q}\nhistory: []\n---\nDo it.\n`;
    const fx = base('TASK-942', text);
    const { findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-942.md')).toEqual([
      expect.objectContaining({ rule: 'L020', severity: 'warning', line: 18, message: 'ticket has fields this spec does not know: questions[0].zeta, questions[0].2' }),
    ]);
  });
});
