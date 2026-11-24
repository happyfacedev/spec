// TKT-001 (S1..S8, S10, S12..S15) and LNT-014 (S1, S2, S4..S15): the ticket file's type rules and
// the L020 findings about tickets, through the CLI on throwaway git copies of the lint base spec.
// The unknown-key scenarios of both features are in ticket-unknown-keys.test.ts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** The lint base spec with `edit` applied to the project directory before git sees it. */
function base(edit: (dir: string) => void): Fx {
  const fx = gitFixture('spec-ticket-schema', { fixture: LINT_BASE, setup: edit });
  made.push(fx);
  return fx;
}
const put = (dir: string, path: string, text: string) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const patch = (dir: string, path: string, f: (text: string) => string) => { writeFileSync(join(dir, path), f(readFileSync(join(dir, path), 'utf8'))); };
/** A ticket file; `over` replaces whole lines of the default valid open task by key. */
const ticket = (id: string, over: Record<string, string | null> = {}, body = 'Do it.') => {
  const lines: Record<string, string> = {
    id: `id: ${id}`,
    type: 'type: task',
    title: 'title: x',
    status: 'status: open',
    stage: 'stage: null',
    touches: 'touches: [ALP-001]',
    violates: 'violates: []',
    changed: 'changed: []',
    questions: 'questions: []',
    history: 'history: []',
  };
  const merged: Record<string, string | null> = { ...lines, ...over };
  return `---\n${Object.values(merged).filter((v) => v !== null).join('\n')}\n---\n${body}\n`;
};
/** The base spec's TASK-001 with a line added before the closing `---`, which is line 19. */
const withLine19 = (dir: string, line: string) => { patch(dir, 'tickets/TASK-001.md', (t) => t.replace('history: []\n---', `history: []\n${line}\n---`)); };

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
const gateJson = async (fx: Fx, id: string) => {
  const out = await fx.spec('', 'gate', id, '--format', 'json');
  return { code: out.code, gate: JSON.parse(out.stdout) as { ready: boolean; blockers: { kind: string; id: string; text: string }[]; preferences: { id: string; default: string }[] } };
};
const L020 = (file: string, line: number, id: string | null, message: string, fix: string, severity = 'error'): Finding => ({ rule: 'L020', severity, file, line, id, message, fix });

describe('TKT-001: The ticket file and its type rules', () => {
  it('TKT-001/S1 A ticket with only the keys a person writes', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-900.md', '---\nid: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [ALP-001]\n---\nDo it.\n'); });
    const out = await fx.spec('', 'gate', 'TASK-900');
    expect(out.stdout.split('\n')[0]).toBe('TASK-900: ready');
    expect(out.code).toBe(0);
  });

  it('TKT-001/S2 A bug that names no scenario', async () => {
    const fx = base((d) => { put(d, 'tickets/BUG-302.md', ticket('BUG-302', { type: 'type: bug', touches: 'touches: []' })); });
    const { gate } = await gateJson(fx, 'BUG-302');
    expect(gate.blockers).toEqual([
      { kind: 'schema', id: 'BUG-302', text: 'a bug must name the scenario it violates; without one the behaviour is unspecified: add the violated scenario IDs to violates, or turn the ticket into a proposal' },
    ]);
  });

  it('TKT-001/S3 An ID whose prefix does not match the type', async () => {
    const fx = base((d) => { put(d, 'tickets/BUG-910.md', ticket('BUG-910', { type: 'type: proposal' })); });
    const { gate } = await gateJson(fx, 'BUG-910');
    expect(gate.blockers).toContainEqual({ kind: 'schema', id: 'BUG-910', text: 'a proposal ticket must have a PROP- ID: rename the ticket or set type to match BUG-910' });
  });

  it('TKT-001/S4 A proposal or task that touches nothing', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-911.md', ticket('TASK-911', { touches: 'touches: []' })); });
    const { gate } = await gateJson(fx, 'TASK-911');
    expect(gate.blockers).toContainEqual({ kind: 'schema', id: 'TASK-911', text: 'a task must touch at least one unit: add the units it changes to touches' });
  });

  it('TKT-001/S5 Only bugs list violates', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-912.md', ticket('TASK-912', { violates: 'violates: [ALP-001/S1]' })); });
    const { gate } = await gateJson(fx, 'TASK-912');
    expect(gate.blockers).toContainEqual({ kind: 'schema', id: 'TASK-912', text: 'only bugs may list violates: move the IDs to touches, or set type: bug' });
  });

  it('TKT-001/S6 The file is not named after its ID', async () => {
    const fx = base((d) => { put(d, 'tickets/old-ticket.md', ticket('TASK-003')); });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(L020('tickets/old-ticket.md', 2, 'TASK-003', 'ticket file old-ticket.md is not named TASK-003.md', 'rename the file to TASK-003.md'));
  });

  it('TKT-001/S7 A required key is missing', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-002.md', ticket('TASK-002', { title: null })); });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'L020', severity: 'error', message: 'ticket is missing required field title', fix: 'add title to the frontmatter' }));
  });

  it('TKT-001/S8 A type outside the three', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-002.md', ticket('TASK-002', { type: 'type: chore' })); });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'L020', severity: 'error', fix: 'use one of: proposal, bug, task' }));
  });

  it('TKT-001/S10 A malformed ID in touches', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-914.md', ticket('TASK-914', { touches: 'touches: [not an id]' })); });
    const { gate } = await gateJson(fx, 'TASK-914');
    const b = gate.blockers.find((x) => x.kind === 'schema' && x.id === 'TASK-914');
    expect(b?.text.startsWith('touches[0]:')).toBe(true);
    expect(b?.text.endsWith('is not a valid unit ID: write it like a feature, scenario, rule, contract, invariant, decision or screen ID')).toBe(true);
  });

  it('TKT-001/S12 Two files with one ID', async () => {
    const fx = base((d) => {
      put(d, 'tickets/TASK-101.md', ticket('TASK-101'));
      put(d, 'tickets/archive/TASK-101.md', ticket('TASK-101'));
    });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'L003', file: 'tickets/archive/TASK-101.md', message: 'ticket TASK-101 is also defined in tickets/TASK-101.md' }));
  });

  it('TKT-001/S13 Question values written as YAML numbers or booleans', async () => {
    const q = 'questions:\n  - id: Q1\n    kind: preference\n    text: How many?\n    default: 3\n    cites: []\n    answer: null\n    raised_by: null';
    const fx = base((d) => { put(d, 'tickets/PROP-915.md', ticket('PROP-915', { type: 'type: proposal', questions: q })); });
    const { gate } = await gateJson(fx, 'PROP-915');
    expect(gate.preferences).toEqual([expect.objectContaining({ id: 'PROP-915#Q1', default: '3' })]);
  });

  it('TKT-001/S14 A preference without a default', async () => {
    const q = 'questions:\n  - id: Q1\n    kind: preference\n    text: Which name?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null';
    const fx = base((d) => { put(d, 'tickets/TASK-900.md', ticket('TASK-900', { questions: q })); });
    const { gate } = await gateJson(fx, 'TASK-900');
    expect(gate.blockers).toEqual([{ kind: 'schema', id: 'TASK-900#Q1', text: 'preference TASK-900#Q1 has no default: add the default work proceeds on, or make it a blocker' }]);
  });

  it('TKT-001/S15 A preference that cites a contract', async () => {
    const q = 'questions:\n  - id: Q1\n    kind: preference\n    text: Which name?\n    default: a\n    cites: [alpha.Widget]\n    answer: null\n    raised_by: null';
    const fx = base((d) => { put(d, 'tickets/TASK-916.md', ticket('TASK-916', { questions: q })); });
    const { gate } = await gateJson(fx, 'TASK-916');
    expect(gate.blockers).toContainEqual({ kind: 'schema', id: 'TASK-916#Q1', text: 'TASK-916#Q1 cites alpha.Widget, so it is a blocker: set kind: blocker' });
  });
});

describe('LNT-014: Report broken tickets (L020)', () => {
  it('LNT-014/S1 A ticket missing a required field', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-002.md', ticket('TASK-002', { title: null })); });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(L020('tickets/TASK-002.md', 1, 'TASK-002', 'ticket is missing required field title', 'add title to the frontmatter'));
  });

  it('LNT-014/S2 A ticket type that does not exist', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-002.md', ticket('TASK-002', { type: 'type: chore' })); });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(L020('tickets/TASK-002.md', 3, 'TASK-002', 'type: Invalid option: expected one of "proposal"|"bug"|"task"', 'use one of: proposal, bug, task'));
  });

  it('LNT-014/S4 A ticket file with no frontmatter', async () => {
    const fx = base((d) => { put(d, 'tickets/TASK-003.md', 'no frontmatter'); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-003.md', 1, null, 'ticket has no YAML frontmatter', 'start the file with a --- frontmatter block')]);
  });

  it('LNT-014/S5 A ticket file not named after its ticket', async () => {
    const fx = base((d) => { put(d, 'tickets/old-ticket.md', ticket('TASK-003')); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/old-ticket.md', 2, 'TASK-003', 'ticket file old-ticket.md is not named TASK-003.md', 'rename the file to TASK-003.md')]);
  });

  it('LNT-014/S6 A bug that names no scenario', async () => {
    const fx = base((d) => { put(d, 'tickets/BUG-001.md', ticket('BUG-001', { type: 'type: bug', touches: 'touches: []' })); });
    const { code, findings } = await lintJson(fx);
    expect(findings).toEqual([
      L020('tickets/BUG-001.md', 8, 'BUG-001', 'a bug must name the scenario it violates; without one the behaviour is unspecified', 'add the violated scenario IDs to violates, or turn the ticket into a proposal', 'warning'),
    ]);
    expect(code).toBe(0);
  });

  it('LNT-014/S7 A task that touches nothing', async () => {
    const fx = base((d) => { patch(d, 'tickets/TASK-001.md', (t) => t.replace('touches: [ALP-001]', 'touches: []')); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-001.md', 7, 'TASK-001', 'a task must touch at least one unit', 'add the units it changes to touches', 'warning')]);
  });

  it('LNT-014/S8 A non-bug that lists violates', async () => {
    const fx = base((d) => { patch(d, 'tickets/TASK-001.md', (t) => t.replace('violates: []', 'violates: [ALP-001/S1]')); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-001.md', 7, 'TASK-001', 'only bugs may list violates', 'move the IDs to touches, or set type: bug', 'warning')]);
  });

  it('LNT-014/S9 An ID that does not match the type', async () => {
    const fx = base((d) => { patch(d, 'tickets/TASK-001.md', (t) => t.replace('type: task', 'type: proposal')); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-001.md', 7, 'TASK-001', 'a proposal ticket must have a PROP- ID', 'rename the ticket or set type to match TASK-001', 'warning')]);
  });

  it('LNT-014/S10 A ticket that depends on itself', async () => {
    const fx = base((d) => { withLine19(d, 'depends_on: [TASK-001]'); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-001.md', 19, 'TASK-001', 'TASK-001 depends on itself', 'remove it from depends_on')]);
  });

  it('LNT-014/S11 A dependency that is not a ticket', async () => {
    const fx = base((d) => { withLine19(d, 'depends_on: [TASK-404]'); });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tickets/TASK-001.md', 19, 'TASK-001', 'depends_on TASK-404, which is not a ticket', 'correct the ID, or remove it from depends_on')]);
  });

  it('LNT-014/S12 Dependencies that loop', async () => {
    const fx = base((d) => {
      withLine19(d, 'depends_on: [TASK-002]');
      const text = readFileSync(join(d, 'tickets/TASK-001.md'), 'utf8').replace('id: TASK-001', 'id: TASK-002');
      put(d, 'tickets/TASK-002.md', text.replace('depends_on: [TASK-002]', 'depends_on: [TASK-001]'));
    });
    const { findings } = await lintJson(fx);
    const fix = 'break the cycle: one of these tickets must come first';
    expect(findings).toEqual([
      L020('tickets/TASK-001.md', 19, 'TASK-001', 'TASK-001 depends on itself through depends_on', fix),
      L020('tickets/TASK-002.md', 19, 'TASK-002', 'TASK-002 depends on itself through depends_on', fix),
    ]);
  });

  it('LNT-014/S13 A tickets command that fails', async () => {
    const fx = base((d) => { patch(d, 'spec/config.json', (t) => t.replace('"tickets": { "adapter": "files", "dir": "tickets" }', '"tickets": { "adapter": "command", "command": "false" }')); });
    const { findings } = await lintJson(fx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'L020', severity: 'error', file: 'tracker', line: 1, id: null, fix: 'fix the tickets command in config.json (docs/TICKETS.md)' });
    expect(findings[0]?.message.startsWith('the tickets command exited 1')).toBe(true);
  });

  it('LNT-014/S14 A tickets command that prints something else', async () => {
    const fx = base((d) => {
      put(d, 'tools/tickets.mjs', "process.stdout.write('[]');\n");
      patch(d, 'spec/config.json', (t) => t.replace('"tickets": { "adapter": "files", "dir": "tickets" }', '"tickets": { "adapter": "command", "command": "node tools/tickets.mjs" }'));
    });
    const { findings } = await lintJson(fx);
    expect(findings).toEqual([L020('tracker', 1, null, '`list` did not print {"tickets":[{"id","text"}]}', 'fix the tickets command in config.json (docs/TICKETS.md)')]);
  });

  it('LNT-014/S15 A tracker ticket is named by its ID', async () => {
    const fx = base((d) => {
      put(d, 'tools/tickets.mjs', `process.stdout.write(JSON.stringify({ tickets: [{ id: 'TASK-001', text: ${JSON.stringify(ticket('TASK-001', { title: null }))} }] }));\n`);
      patch(d, 'spec/config.json', (t) => t.replace('"tickets": { "adapter": "files", "dir": "tickets" }', '"tickets": { "adapter": "command", "command": "node tools/tickets.mjs" }'));
    });
    const { findings } = await lintJson(fx);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'L020', severity: 'error', file: 'tracker/TASK-001.md', line: 1, id: 'TASK-001', message: 'ticket is missing required field title' }));
  });
});

/** An absorbed-ticket file: `absorbed_into` sits on line 6, straight after the status. */
const proposal = (id: string, status: string, into: string | null) =>
  `---\nid: ${id}\ntype: proposal\ntitle: x\nstatus: ${status}\n${into === null ? '' : `absorbed_into: ${into}\n`}stage: null\ntouches: [ALP-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n`;

describe('TKT-001/R12: absorbed tickets', () => {
  it('TKT-001/S27 An absorbed ticket passes lint', async () => {
    const fx = base((d) => {
      put(d, 'tickets/PROP-201.md', proposal('PROP-201', 'open', null));
      put(d, 'tickets/PROP-202.md', proposal('PROP-202', 'absorbed', 'PROP-201'));
    });
    const { findings } = await lintJson(fx);
    expect(findings.filter((f) => f.file === 'tickets/PROP-202.md')).toEqual([]);
  });

  it('TKT-001/S28 absorbed_into that does not hold', async () => {
    const fx = base((d) => {
      put(d, 'tickets/PROP-201.md', proposal('PROP-201', 'open', null));
      put(d, 'tickets/PROP-203.md', proposal('PROP-203', 'absorbed', 'PROP-201'));
      put(d, 'tickets/PROP-204.md', proposal('PROP-204', 'absorbed', 'PROP-299'));
      put(d, 'tickets/PROP-205.md', proposal('PROP-205', 'absorbed', 'PROP-203'));
      put(d, 'tickets/PROP-206.md', proposal('PROP-206', 'open', 'PROP-201'));
      put(d, 'tickets/PROP-207.md', proposal('PROP-207', 'absorbed', null));
    });
    const { findings } = await lintJson(fx);
    const errors = (id: string) => findings.filter((f) => f.file === `tickets/${id}.md` && f.rule === 'L020' && f.severity === 'error');
    expect(errors('PROP-204')).toEqual([L020('tickets/PROP-204.md', 6, 'PROP-204', 'absorbed_into PROP-299, which is not a ticket', 'name the ticket it was combined into')]);
    expect(errors('PROP-205')).toEqual([L020('tickets/PROP-205.md', 6, 'PROP-205', 'absorbed_into PROP-203, which is itself absorbed into PROP-201', 'set absorbed_into to PROP-201')]);
    expect(errors('PROP-206')).toEqual([L020('tickets/PROP-206.md', 6, 'PROP-206', 'only an absorbed ticket has absorbed_into', 'remove absorbed_into')]);
    expect(errors('PROP-207')).toEqual([L020('tickets/PROP-207.md', 5, 'PROP-207', 'an absorbed ticket names the ticket it went into', 'add absorbed_into')]);
  });
});
