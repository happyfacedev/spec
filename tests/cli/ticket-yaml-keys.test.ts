// TKT-001/R11: a ticket file may not use YAML anchors, aliases or keys that are not strings
// (TKT-001/S22..S26, LNT-014/S16, S17); a quoted key is an unknown string key that stays quoted.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const base = (edit: (dir: string) => void): Fx => {
  const fx = gitFixture('spec-yaml-keys', { fixture: LINT_BASE, setup: edit });
  made.push(fx);
  return fx;
};
const chat = (id: string, text: string): Fx => {
  const fx = gitFixture('spec-yaml-keys-chat', { setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
};
const put = (dir: string, id: string, text: string) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); };

interface Finding { rule: string; severity: string; file: string; line: number; id: string | null; message: string; fix: string }
const lintJson = async (fx: Fx) => {
  const out = await fx.spec('', 'lint', '--format', 'json');
  return { code: out.code, findings: (JSON.parse(out.stdout) as { findings: Finding[] }).findings };
};
const ANCHOR_FIX = 'write the value out: ticket files may not use YAML anchors or aliases';
const err = (file: string, line: number, id: string | null, message: string, fix: string): Finding => ({ rule: 'L020', severity: 'error', file, line, id, message, fix });

describe('TKT-001/R11: anchors, aliases and keys that are not strings', () => {
  it('TKT-001/S22 A ticket that uses a YAML anchor and an alias', async () => {
    const text = '---\nid: TASK-923\ntype: task\ntitle: x\nstatus: open\ntouches: &units [ALP-001]\nowner: *units\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-923', text); });
    const { code, findings } = await lintJson(fx);
    const mine = findings.filter((f) => f.file === 'tickets/TASK-923.md');
    expect(mine).toEqual([
      err('tickets/TASK-923.md', 6, 'TASK-923', 'ticket uses the YAML anchor &units', ANCHOR_FIX),
      err('tickets/TASK-923.md', 7, 'TASK-923', 'ticket uses the YAML alias *units', ANCHOR_FIX),
    ]);
    expect(mine.some((f) => f.message.includes('owner'))).toBe(false);
    expect(code).toBe(1);
  });

  it('TKT-001/S22 The anchor is reported at its own line when its value is on the next line', async () => {
    const text = '---\nid: TASK-928\ntype: task\ntitle: x\nstatus: open\nstage: null\nowner: &a\n  bob\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-928', text); });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-928.md')).toEqual([err('tickets/TASK-928.md', 7, 'TASK-928', 'ticket uses the YAML anchor &a', ANCHOR_FIX)]);
    expect(code).toBe(1);
  });

  it('TKT-001/S22 The anchor is reported at its own line before a block mapping or sequence on the next lines', async () => {
    const text =
      '---\nid: TASK-929\ntype: task\ntitle: x\nstatus: open\nstage: null\nextra: &m\n  k: v\ntags: &s\n  - a\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-929', text); });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-929.md')).toEqual([
      err('tickets/TASK-929.md', 7, 'TASK-929', 'ticket uses the YAML anchor &m', ANCHOR_FIX),
      err('tickets/TASK-929.md', 9, 'TASK-929', 'ticket uses the YAML anchor &s', ANCHOR_FIX),
    ]);
    expect(code).toBe(1);
  });

  it('TKT-001/S22 An anchor on its own line before flow-style frontmatter is reported at its line', async () => {
    const text = '---\n&root\n{id: TASK-930, type: task, title: x, status: open, stage: null, touches: [ALP-001], violates: [], changed: [], questions: [], history: []}\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-930', text); });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-930.md')).toEqual([err('tickets/TASK-930.md', 2, 'TASK-930', 'ticket uses the YAML anchor &root', ANCHOR_FIX)]);
    expect(code).toBe(1);
  });

  it('TKT-001/S23 A ticket with a bare numeric key', async () => {
    const text =
      '---\nid: TASK-924\ntype: task\ntitle: x\nstatus: open\nstage: null\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions:\n  - id: Q1\n    2: x\n    kind: preference\n    text: Name?\n    default: a\n    cites: []\n    answer: null\n    raised_by: null\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-924', text); });
    const { code, findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/TASK-924.md')).toEqual([
      err('tickets/TASK-924.md', 12, 'TASK-924', 'ticket has a key that is not a string: 2', 'quote the key: "2"'),
    ]);
    expect(code).toBe(1);
  });

  it('TKT-001/S24 The gate refuses a ticket with a boolean key', async () => {
    const text = '---\nid: TASK-925\ntype: task\ntitle: x\nstatus: open\nstage: null\ntrue: x\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'TASK-925', text); });
    const out = await fx.spec('', 'gate', 'TASK-925', '--format', 'json');
    expect((JSON.parse(out.stdout) as { blockers: unknown[] }).blockers).toEqual([
      { kind: 'schema', id: 'TASK-925', text: 'ticket has a key that is not a string: true: quote the key: "true"' },
    ]);
    expect(out.code).toBe(1);
  });

  it('TKT-001/S25 A quoted key is a string key', async () => {
    const text =
      '---\nid: PROP-926\ntype: proposal\ntitle: x\nstatus: blocked\nstage: null\n"2": x\ntouches: [SET-001]\nviolates: []\nchanged: []\nquestions:\n  - id: Q1\n    kind: blocker\n    text: Ok?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n    "7": y\nhistory: []\n---\nDo it.\n';
    const fx = base((d) => { put(d, 'PROP-926', text); });
    const { findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/PROP-926.md')).toEqual([
      {
        rule: 'L020',
        severity: 'warning',
        file: 'tickets/PROP-926.md',
        line: 7,
        id: 'PROP-926',
        message: 'ticket has fields this spec does not know: 2, questions[0].7',
        fix: 'if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling',
      },
    ]);
  });

  it('TKT-001/S26 A rewrite keeps a quoted key quoted', async () => {
    const text =
      '---\nid: PROP-927\ntype: proposal\ntitle: x\nstatus: blocked\nstage: null\n"2": x\ntouches: [SET-001]\nviolates: []\nchanged: []\nquestions:\n  - id: Q1\n    kind: blocker\n    text: Ok?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null\n    "7": y\nhistory: []\n---\nDo it.\n';
    const fx = chat('PROP-927', text);
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-927', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const saved = readFileSync(join(fx.repo, 'tickets', 'PROP-927.md'), 'utf8');
    expect(saved).toContain('answer: yes');
    expect(saved.split('\n')).toContain('"2": x');
    expect(saved.split('\n')).toContain('    "7": y');
  }, 60_000);
});

describe('LNT-014/R5: anchors, aliases and non-string keys are L020 errors', () => {
  it('LNT-014/S16 A ticket that uses a YAML anchor and an alias', async () => {
    const fx = base((d) => {
      const file = join(d, 'tickets/TASK-001.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('touches: [ALP-001]', 'touches: &units [ALP-001]').replace('history: []\n---', 'history: []\nowner: *units\n---'));
    });
    const { code, findings } = await lintJson(fx);
    expect(findings).toEqual([
      err('tickets/TASK-001.md', 7, 'TASK-001', 'ticket uses the YAML anchor &units', ANCHOR_FIX),
      err('tickets/TASK-001.md', 19, 'TASK-001', 'ticket uses the YAML alias *units', ANCHOR_FIX),
    ]);
    expect(code).toBe(1);
  });

  it('LNT-014/S17 A ticket with a null key', async () => {
    const fx = base((d) => {
      const file = join(d, 'tickets/TASK-001.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace('history: []\n---', 'history: []\nnull: x\n---'));
    });
    const { code, findings } = await lintJson(fx);
    expect(findings).toEqual([err('tickets/TASK-001.md', 19, 'TASK-001', 'ticket has a key that is not a string: null', 'quote the key: "null"')]);
    expect(code).toBe(1);
  });
});
