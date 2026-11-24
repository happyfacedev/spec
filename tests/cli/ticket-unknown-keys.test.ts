// TKT-001/S9, S11, S16..S21, S30 and LNT-014/S3: keys a ticket has that the ticket schema does not know
// are kept and ignored. Through the CLI, on throwaway git copies of the lint base spec (gate, queue,
// lint) and of chat-mini (advance, answer).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { LINT_BASE, gitFixture, report, validSpecWriterChecklist } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** The lint base spec with these ticket files added (path under `tickets/`) before git sees it. */
function base(tickets: Record<string, string>, edit?: (dir: string) => void): Fx {
  const fx = gitFixture('spec-unknown-keys', {
    fixture: LINT_BASE,
    setup: (dir) => {
      for (const [name, text] of Object.entries(tickets)) writeFileSync(join(dir, 'tickets', name), text);
      edit?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

/** chat-mini with this ticket file added before git sees it. */
function chat(id: string, text: string): Fx {
  const fx = gitFixture('spec-unknown-keys-chat', { setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
}

const record = (extra = '') => `  - at: 2026-10-27T09:00:00.000Z\n    role: tester\n    result: done\n    summary: Tested\n    verdict: null\n    assumed: []\n    duration_s: 3\n${extra}`;
/** A valid open task touching ALP-001 of the base spec; `lines` go right after `stage`, `history` replaces the empty list. */
const task = (id: string, lines = '', history = 'history: []') =>
  `---\nid: ${id}\ntype: task\ntitle: x\nstatus: open\nstage: null\n${lines}touches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\n${history}\n---\nDo it.\n`;

const fm = (text: string) => parse(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '') as Record<string, unknown> & {
  questions: Record<string, unknown>[];
  history: Record<string, unknown>[];
};
const raw = (fx: Fx, id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');

interface Finding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  id: string | null;
  message: string;
  fix: string;
}
const lintJson = async (fx: Fx) => {
  const out = await fx.spec('', 'lint', '--format', 'json');
  return { code: out.code, findings: (JSON.parse(out.stdout) as { findings: Finding[] }).findings };
};
const FIX = 'if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling';

describe('TKT-001: unknown keys in a ticket', () => {
  it('TKT-001/S9 An unknown key', async () => {
    const fx = base({ 'TASK-913.md': task('TASK-913', 'owner: bob\n') });
    const out = await fx.spec('', 'gate', 'TASK-913');
    expect(out.stdout.split('\n')[0]).toBe('TASK-913: ready');
    expect(out.code).toBe(0);
  });

  it('TKT-001/S11 A ticket that does not parse is refused on its schema alone', async () => {
    const fx = base({ 'TASK-904.md': task('TASK-904', 'owner: bob\n').replace('type: task', 'type: chore') });
    const out = await fx.spec('', 'gate', 'TASK-904', '--format', 'json');
    const gate = JSON.parse(out.stdout) as { blockers: { kind: string; id: string; text: string }[] };
    expect(gate.blockers).toEqual([
      { kind: 'schema', id: 'TASK-904', text: 'type: Invalid option: expected one of "proposal"|"bug"|"task": use one of: proposal, bug, task' },
    ]);
    expect(out.stdout).not.toContain('owner');
    expect(out.code).toBe(1);
  });

  it('TKT-001/S16 An unknown field in a history record', async () => {
    const fx = base({ 'TASK-917.md': task('TASK-917', '', `history:\n${record('    findings2: []\n')}`) });
    const out = await fx.spec('', 'gate', 'TASK-917');
    expect(out.stdout.split('\n')[0]).toBe('TASK-917: ready');
    expect(out.code).toBe(0);
  });

  it('TKT-001/S17 Lint warns once for every unknown field of a ticket', async () => {
    const text =
      '---\nid: TASK-918\ntype: task\ntitle: x\nstatus: open\nstage: null\nowner: bob\ntouches: [ALP-001]\nviolates: []\nchanged: []\n' +
      `questions:\n  - id: Q1\n    kind: preference\n    text: Name?\n    default: a\n    cites: []\n    answer: null\n    raised_by: null\n    asked_at: x\nhistory:\n${record('    findings2: []\n')}---\nDo it.\n`;
    const fx = base({ 'TASK-918.md': text });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-918.md')).toEqual([
      { rule: 'L020', severity: 'warning', file: 'tickets/TASK-918.md', line: 7, id: 'TASK-918', message: 'ticket has fields this spec does not know: owner, questions[0].asked_at, history[0].findings2', fix: FIX },
    ]);
    expect(code).toBe(0);
  });

  it('TKT-001/S18 A known field keeps its check beside an unknown one', async () => {
    const text =
      '---\nid: TASK-919\ntype: task\ntitle: x\nstatus: open\nstage: null\ntouches: [ALP-001]\nhistory:\n  - role: chef\n    at: 2026-10-27T09:00:00.000Z\n' +
      '    result: done\n    summary: Tested\n    verdict: null\n    assumed: []\n    duration_s: 3\n    findings2: []\n---\nDo it.\n';
    const fx = base({ 'TASK-919.md': text });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-919.md')).toEqual([
      {
        rule: 'L020',
        severity: 'error',
        file: 'tickets/TASK-919.md',
        line: 9,
        id: 'TASK-919',
        message: 'history[0].role: Invalid option: expected one of "spec-writer"|"spec-review"|"tester"|"implementer"|"reviewer"',
        fix: 'use one of: spec-writer, spec-review, tester, implementer, reviewer',
      },
      { rule: 'L020', severity: 'warning', file: 'tickets/TASK-919.md', line: 16, id: 'TASK-919', message: 'ticket has fields this spec does not know: history[0].findings2', fix: FIX },
    ]);
    expect(code).toBe(1);
  });

  it("TKT-001/S30 A recorded finding's marks and a recorded stage's keys are known", async () => {
    const ticket = (tests: string) =>
      task('TASK-930', '', [
        'history:',
        '  - at: 2026-11-01T09:00:00.000Z',
        '    role: reviewer',
        '    result: done',
        '    summary: Found two gaps',
        '    verdict: changes',
        '    findings:',
        '      - cites: [ALP-001]',
        '        text: no scenario covers the second rate limit',
        '        spec: true',
        '        class: C1',
        '      - cites: [ALP-001]',
        '        text: the test does not check the status',
        `        tests: ${tests}`,
        '        class: C2',
        '    assumed: []',
        '    duration_s: 3',
        '  - at: 2026-11-01T09:05:00.000Z',
        '    role: spec-writer',
        '    result: done',
        '    summary: Specified',
        '    verdict: null',
        '    checklist:',
        '      - item: C1',
        '        outcome: na',
        '        reason: No neighbour is under test in this fixture.',
        '    documents: []',
        '    refusals: 1',
        '    cost_usd: 0.25',
        '    assumed: []',
        '    duration_s: 4',
      ].join('\n'));
    const fx = base({ 'TASK-930.md': ticket('true') });
    expect((await lintJson(fx)).findings.filter((f) => f.file === 'tickets/TASK-930.md')).toEqual([]);
    const bad = (await lintJson(base({ 'TASK-930.md': ticket('"yes"') }))).findings.filter((f) => f.file === 'tickets/TASK-930.md');
    const errors = bad.filter((f) => f.rule === 'L020' && f.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message.startsWith('history[0].findings[1].tests:')).toBe(true);
    expect(bad.filter((f) => f.rule === 'L020' && f.severity === 'warning' && f.message.includes('tests'))).toEqual([]);
  });

  it('TKT-001/S19 Recording a stage keeps unknown fields', async () => {
    const text =
      '---\nid: PROP-920\ntype: proposal\ntitle: x\nowner: bob\nstatus: open\nstage: null\ntouches: [SET-001]\nviolates: []\nchanged: []\n' +
      'questions:\n  - id: Q1\n    kind: preference\n    text: Order?\n    default: alphabetical\n    cites: []\n    answer: null\n    raised_by: null\n    asked_at: x\n' +
      `history:\n${record('    findings2: []\n').replace('role: tester\n    result: done', 'role: spec-writer\n    result: blocked')}---\nDo it.\n`;
    const fx = chat('PROP-920', text);
    const before = fm(text);
    const started = await fx.spec('', 'ticket', 'start', 'PROP-920', 'spec-writer');
    expect(started.code, started.stderr).toBe(0);
    const out = await fx.spec(report('role: spec-writer\nticket: PROP-920\nresult: done\nsummary: Specified\n' + validSpecWriterChecklist()), 'ticket', 'advance', 'PROP-920');
    expect(out.code, out.stderr).toBe(0);
    const after = fm(raw(fx, 'PROP-920'));
    expect(after.owner).toBe('bob');
    const keys = Object.keys(after);
    expect(keys.indexOf('owner')).toBe(keys.indexOf('title') + 1);
    expect(after.questions[0]).toEqual(before.questions[0]);
    expect(after.questions[0]?.asked_at).toBe('x');
    expect(after.history[0]).toEqual(before.history[0]);
    expect(after.history[0]?.findings2).toEqual([]);
    expect(after.history.at(-1)).toMatchObject({ role: 'spec-writer', result: 'done' });
  }, 60_000);

  it('TKT-001/S20 Answering a question keeps unknown fields', async () => {
    const text =
      '---\nid: PROP-921\ntype: proposal\ntitle: x\nowner: bob\nstatus: blocked\nstage: null\ntouches: [SET-001]\nviolates: []\nchanged: []\n' +
      'questions:\n  - id: Q1\n    kind: blocker\n    text: Ok?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n    asked_at: x\n' +
      'history: []\n---\nDo it.\n';
    const fx = chat('PROP-921', text);
    const before = fm(text);
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-921', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const after = fm(raw(fx, 'PROP-921'));
    expect(after.questions[0]).toEqual({ ...before.questions[0], answer: 'yes' });
    expect(after.questions[0]?.asked_at).toBe('x');
    expect(after.owner).toBe('bob');
    const keys = Object.keys(after);
    expect(keys.indexOf('owner')).toBe(keys.indexOf('title') + 1);
  }, 60_000);

  it('TKT-001/S21 The queue reads a ticket that has unknown fields', async () => {
    const fx = base({ 'TASK-922.md': task('TASK-922', '', `history:\n${record('    findings2: []\n')}`) });
    const out = await fx.spec('', 'queue', '--format', 'json');
    const queue = JSON.parse(out.stdout) as { ready: { id: string; type: string }[] };
    expect(queue.ready).toContainEqual(expect.objectContaining({ id: 'TASK-922', type: 'task' }));
  });
});

describe('LNT-014: Report broken tickets (L020)', () => {
  it('LNT-014/S3 A ticket with an unknown field', async () => {
    const fx = base({}, (dir) => {
      const file = join(dir, 'tickets', 'TASK-001.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('history: []\n---', 'history: []\nowner: bob\n---'));
    });
    const { code, findings } = await lintJson(fx);
    expect(findings).toEqual([
      { rule: 'L020', severity: 'warning', file: 'tickets/TASK-001.md', line: 19, id: 'TASK-001', message: 'ticket has fields this spec does not know: owner', fix: FIX },
    ]);
    expect(code).toBe(0);
  });
});
