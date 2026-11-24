// TKT-001 ticket-file rules through spec gate and spec lint.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => { for (const fx of fixtures) fx.cleanup(); });

function repo(prefix: string, setup?: (dir: string) => void): Fx {
  const fx = gitFixture(prefix, { setup });
  fixtures.push(fx);
  return fx;
}

function ticket(id: string, body: string): string {
  return '---\n' + body + '\n---\nA ticket.\n';
}

function writeTicket(dir: string, path: string, text: string): string {
  const file = join(dir, path);
  const folder = file.slice(0, file.lastIndexOf('/'));
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, text);
  return file;
}

function addPipelineFeature(dir: string): void {
  const folder = 'spec/modules/pipeline';
  mkdirSync(join(dir, folder, 'features'), { recursive: true });
  writeFileSync(join(dir, folder, '_module.md'), '---\nid: pipeline\nprefix: PIP\ndomain: work pipeline\nstatus: active\n---\nCoordinates ticket stages.\n\n## Owns\n- Ticket stages\n\n## Non-goals\nNone\n');
  writeFileSync(join(dir, folder, 'features/PIP-007-gate-a-stage.md'), '---\nid: PIP-007\ntitle: Gate a stage\nmodule: pipeline\nstatus: active\n---\n## Intent\nAllow tickets to touch the pipeline.\n\n## Behaviour\n### S1: The pipeline feature is available\nGiven a project ticket\nWhen its scope names PIP-007\nThen the feature is available\n\n## Rules\nNone\n\n## Out of scope\nNone\n');
}

async function gate(fx: Fx, id: string, ...args: string[]) {
  return fx.spec('', 'gate', id, ...args);
}

async function lint(fx: Fx) {
  return fx.spec('', 'lint', '--format', 'json');
}

type Finding = { rule: string; file: string; message: string; fix: string; severity: string; id: string | null };
type GateResult = { ticket: string; ready: boolean; blockers: { kind: string; id: string; text: string }[]; preferences: { id: string; default: string; text: string }[] };

describe('TKT-001 ticket-file rules', () => {
  it('TKT-001/S1 A ticket with only the keys a person writes', async () => {
    const fx = repo('tkt001-s1', (dir) => {
      writeTicket(dir, 'tickets/TASK-900.md', ticket('TASK-900',
        'id: TASK-900\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]'));
    });
    const out = await fx.spec('', 'gate', 'TASK-900');
    expect(out.stdout.split('\n')[0]).toBe('TASK-900: ready');
    expect(out.code).toBe(0);
  });

  it('TKT-001/S3 An ID whose prefix does not match the type', async () => {
    const fx = repo('tkt001-s3', (dir) => writeTicket(dir, 'tickets/BUG-910.md', ticket('BUG-910',
      'id: BUG-910\ntype: proposal\ntitle: x\nstatus: open\ntouches: [PRV-001]\nviolates: []')));
    const result = JSON.parse((await gate(fx, 'BUG-910', '--format', 'json')).stdout) as GateResult;
    expect(result.blockers).toContainEqual({
      kind: 'schema',
      id: 'BUG-910',
      text: 'a proposal ticket must have a PROP- ID: rename the ticket or set type to match BUG-910',
    });
  });

  it('TKT-001/S4 A proposal or task that touches nothing', async () => {
    const fx = repo('tkt001-s4', (dir) => writeTicket(dir, 'tickets/TASK-911.md', ticket('TASK-911',
      'id: TASK-911\ntype: task\ntitle: x\nstatus: open\ntouches: []')));
    const result = JSON.parse((await gate(fx, 'TASK-911', '--format', 'json')).stdout) as GateResult;
    expect(result.blockers).toContainEqual({
      kind: 'schema',
      id: 'TASK-911',
      text: 'a task must touch at least one unit: add the units it changes to touches',
    });
  });

  it('TKT-001/S5 Only bugs list violates', async () => {
    const fx = repo('tkt001-s5', (dir) => writeTicket(dir, 'tickets/TASK-912.md', ticket('TASK-912',
      'id: TASK-912\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]\nviolates: [PRV-002/S3]')));
    const result = JSON.parse((await gate(fx, 'TASK-912', '--format', 'json')).stdout) as GateResult;
    expect(result.blockers).toContainEqual({
      kind: 'schema',
      id: 'TASK-912',
      text: 'only bugs may list violates: move the IDs to touches, or set type: bug',
    });
  });

  it('TKT-001/S6 The file is not named after its ID', async () => {
    const fx = repo('tkt001-s6', (dir) => writeTicket(dir, 'tickets/old-ticket.md', ticket('TASK-003',
      'id: TASK-003\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]')));
    const out = await lint(fx);
    const findings = (JSON.parse(out.stdout) as { findings: Finding[] }).findings;
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'L020',
      file: 'tickets/old-ticket.md',
      message: 'ticket file old-ticket.md is not named TASK-003.md',
      fix: 'rename the file to TASK-003.md',
    }));
  });

  it('TKT-001/S7 A required key is missing', async () => {
    const fx = repo('tkt001-s7', (dir) => writeTicket(dir, 'tickets/TASK-002.md', ticket('TASK-002',
      'id: TASK-002\ntype: task\nstatus: open\ntouches: [PRV-001]')));
    const findings = (JSON.parse((await lint(fx)).stdout) as { findings: Finding[] }).findings;
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'L020',
      severity: 'error',
      message: 'ticket is missing required field title',
      fix: 'add title to the frontmatter',
    }));
  });

  it('TKT-001/S8 A type outside the three', async () => {
    const fx = repo('tkt001-s8', (dir) => writeTicket(dir, 'tickets/TASK-002.md', ticket('TASK-002',
      'id: TASK-002\ntype: chore\ntitle: x\nstatus: open\ntouches: [PRV-001]')));
    const findings = (JSON.parse((await lint(fx)).stdout) as { findings: Finding[] }).findings;
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'L020',
      severity: 'error',
      fix: 'use one of: proposal, bug, task',
    }));
  });

  it('TKT-001/S9 An unknown key', async () => {
    const fx = repo('tkt001-s9', (dir) => writeTicket(dir, 'tickets/TASK-913.md', ticket('TASK-913',
      'id: TASK-913\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]\nowner: alex')));
    // TKT-001/R9 (PROP-046): an unknown string key is kept and ignored, so the gate passes.
    const out = await gate(fx, 'TASK-913');
    expect(out.stdout.split('\n')[0]).toBe('TASK-913: ready');
    expect(out.code).toBe(0);
  });

  it('TKT-001/S10 A malformed ID in touches', async () => {
    const fx = repo('tkt001-s10', (dir) => writeTicket(dir, 'tickets/TASK-914.md', ticket('TASK-914',
      'id: TASK-914\ntype: task\ntitle: x\nstatus: open\ntouches: [not an id]')));
    const result = JSON.parse((await gate(fx, 'TASK-914', '--format', 'json')).stdout) as GateResult;
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]?.kind).toBe('schema');
    expect(result.blockers[0]?.id).toBe('TASK-914');
    expect(result.blockers[0]?.text.startsWith('touches[0]:')).toBe(true);
    expect(result.blockers[0]?.text.endsWith('is not a valid unit ID: write it like a feature, scenario, rule, contract, invariant, decision or screen ID')).toBe(true);
  });

  it('TKT-001/S11 A ticket that does not parse is refused on its schema alone', async () => {
    const fx = repo('tkt001-s11', (dir) => writeTicket(dir, 'tickets/TASK-904.md', ticket('TASK-904',
      'id: TASK-904\ntype: chore\ntitle: x\nstatus: open\ntouches: [PRV-001]')));
    const findings = (JSON.parse((await lint(fx)).stdout) as { findings: Finding[] }).findings;
    const finding = findings.find((item) => item.file === 'tickets/TASK-904.md' && item.rule === 'L020');
    if (finding === undefined) throw new Error('TASK-904 has no L020 finding');
    const result = JSON.parse((await gate(fx, 'TASK-904', '--format', 'json')).stdout) as GateResult;
    expect(result.blockers).toEqual([{
      kind: 'schema',
      id: 'TASK-904',
      text: finding.message + ': ' + finding.fix,
    }]);
  });

  it('TKT-001/S12 Two files with one ID', async () => {
    const fx = repo('tkt001-s12', (dir) => writeTicket(dir, 'tickets/archive/TASK-101.md', ticket('TASK-101',
      'id: TASK-101\ntype: task\ntitle: x\nstatus: open\ntouches: [PRV-001]')));
    const findings = (JSON.parse((await lint(fx)).stdout) as { findings: Finding[] }).findings;
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'L003',
      file: 'tickets/archive/TASK-101.md',
      message: 'ticket TASK-101 is also defined in tickets/TASK-101.md',
    }));
  });

  it('TKT-001/S13 Question values written as YAML numbers or booleans', async () => {
    const fx = repo('tkt001-s13', (dir) => writeTicket(dir, 'tickets/PROP-915.md', ticket('PROP-915',
      'id: PROP-915\ntype: proposal\ntitle: x\nstatus: open\ntouches: [PRV-001]\nquestions:\n  - id: Q1\n    kind: preference\n    text: Which order?\n    default: 3\n    cites: []\n    answer: null\n    raised_by: null')));
    const result = JSON.parse((await gate(fx, 'PROP-915', '--format', 'json')).stdout) as GateResult;
    expect(result.preferences).toContainEqual({ id: 'PROP-915#Q1', default: '3', text: 'Which order?' });
  });

  it("TKT-001/S29 A ticket's question cites only its own ticket", async () => {
    const own = '  - id: Q1\n    kind: blocker\n    text: Is the own ticket citation accepted?\n    default: null\n    cites: [PROP-900]\n    answer: verified\n    raised_by: null';
    const foreign = '  - id: Q2\n    kind: blocker\n    text: Is the foreign ticket citation accepted?\n    default: null\n    cites: [PROP-901]\n    answer: verified\n    raised_by: null';
    const source = (questions: string) => ticket('PROP-900',
      'id: PROP-900\ntype: proposal\ntitle: x\nstatus: open\nstage: null\ntouches: [PIP-007]\nviolates: []\nchanged: []\nquestions:\n' + questions + '\nhistory: []\ndepends_on: []');
    const invalid = repo('tkt001-s16-foreign-cite', (dir) => {
      addPipelineFeature(dir);
      writeTicket(dir, 'tickets/PROP-900.md', source(own + '\n' + foreign));
    });
    const refused = await gate(invalid, 'PROP-900', '--format', 'json');
    expect(refused.code).toBe(1);
    expect((JSON.parse(refused.stdout) as GateResult).blockers).toEqual([{
      kind: 'schema',
      id: 'PROP-900',
      text: 'questions[1].cites[0]: a ticket question may cite only its own ticket ID: fix questions[1].cites[0] to match the ticket schema',
    }]);

    const ownOnly = repo('tkt001-s16-own-cite', (dir) => {
      addPipelineFeature(dir);
      writeTicket(dir, 'tickets/PROP-900.md', source(own));
    });
    const accepted = await gate(ownOnly, 'PROP-900');
    expect(accepted.code, accepted.stderr + accepted.stdout).toBe(0);
    expect(accepted.stdout.trim()).toBe('PROP-900: ready');
  });
});
