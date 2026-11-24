// TKT-007 gate scenarios at the CLI boundary.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => { for (const fx of fixtures) fx.cleanup(); });

type GateResult = {
  ticket: string;
  ready: boolean;
  blockers: { kind: string; id: string; text: string }[];
  preferences: { id: string; default: string; text: string }[];
};

function repo(prefix: string, setup?: (dir: string) => void): Fx {
  const fx = gitFixture(prefix, { setup });
  fixtures.push(fx);
  return fx;
}

function question(id: string, kind: string, text: string, value: string | null = null): string {
  return '  - id: ' + id + '\n    kind: ' + kind + '\n    text: ' + text + '\n    default: ' + (value ?? 'null') + '\n    cites: []\n    answer: null\n    raised_by: null';
}

function addQuestions(dir: string, path: string, questions: string): void {
  const file = join(dir, path);
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace('status: active\n', 'status: active\nquestions:\n' + questions + '\n'));
}

function ticket(id: string, type: string, fields: string): string {
  const questions = fields.includes('questions:') ? '' : '\nquestions: []';
  return '---\nid: ' + id + '\ntype: ' + type + '\ntitle: Gate scenario\nstatus: open\nstage: null\n' + fields + '\nchanged: []' + questions + '\nhistory: []\n---\nGate test.\n';
}

async function jsonGate(fx: Fx, id: string) {
  const out = await fx.spec('', 'gate', id, '--format', 'json');
  return { out, result: JSON.parse(out.stdout) as GateResult };
}

describe('TKT-007 spec gate scenarios', () => {
  it('TKT-007/S1 A ready ticket', async () => {
    const fx = repo('tkt007-s1');
    const out = await fx.spec('', 'gate', 'TASK-101');
    expect(out.stdout).toBe('TASK-101: ready\n');
    expect(out.code).toBe(0);
  });

  it('TKT-007/S2 An open blocker question on the ticket', async () => {
    const fx = repo('tkt007-s2');
    const out = await fx.spec('', 'gate', 'PROP-206');
    expect(out.stdout).toBe([
      'PROP-206: not ready',
      '',
      'Blockers:',
      '- question PROP-206#Q1: Do renamed providers keep their usage history?',
      '',
      'To unblock:',
      "- question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record",
      '',
    ].join('\n'));
    expect(out.code).toBe(1);
  });

  it('TKT-007/S3 An open blocker on a unit in scope', async () => {
    const fx = repo('tkt007-s3', (dir) => {
      addQuestions(dir, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md', [
        question('Q1', 'blocker', 'Does a fallback count toward usage?'),
        question('Q2', 'preference', 'Notice wording?', 'as in UI-001'),
      ].join('\n'));
    });
    const { result } = await jsonGate(fx, 'TASK-103');
    expect(result.blockers).toEqual([{ kind: 'question', id: 'PRV-002#Q1', text: 'Does a fallback count toward usage?' }]);
    expect(result.preferences).toEqual([{ id: 'PRV-002#Q2', default: 'as in UI-001', text: 'Notice wording?' }]);
  });

  it("TKT-007/S4 A violated scenario puts its feature's questions in scope", async () => {
    const fx = repo('tkt007-s4', (dir) => {
      addQuestions(dir, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md', question('Q1', 'blocker', 'Does a fallback count toward usage?'));
    });
    const { result } = await jsonGate(fx, 'BUG-301');
    expect(result.blockers.map((blocker) => blocker.id)).toEqual(['PRV-002#Q1']);
  });

  it('TKT-007/S5 An answered blocker no longer blocks', async () => {
    const fx = repo('tkt007-s5', (dir) => {
      const path = join(dir, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md');
      const source = readFileSync(path, 'utf8');
      writeFileSync(path, source.replace('status: active\n', 'status: active\nquestions:\n  - id: Q1\n    kind: blocker\n    text: Does a fallback count toward usage?\n    default: null\n    cites: []\n    answer: no\n    raised_by: null\n'));
    });
    const { result } = await jsonGate(fx, 'BUG-301');
    expect(result.ready).toBe(true);
  });

  it('TKT-007/S6 A preference proceeds on its default', async () => {
    const fx = repo('tkt007-s6');
    const out = await fx.spec('', 'gate', 'PROP-202');
    expect(out.stdout).toBe([
      'PROP-202: ready',
      '',
      'Preferences (work proceeds on the default):',
      '- PROP-202#Q1 In what order does the model picker list enabled providers? → alphabetical',
      '',
    ].join('\n'));
    expect(out.code).toBe(0);
  });

  it('TKT-007/S7 The JSON result', async () => {
    const fx = repo('tkt007-s7');
    const { out, result } = await jsonGate(fx, 'PROP-202');
    expect(result).toEqual({
      ticket: 'PROP-202',
      ready: true,
      blockers: [],
      preferences: [{ id: 'PROP-202#Q1', default: 'alphabetical', text: 'In what order does the model picker list enabled providers?' }],
    });
    expect(out.code).toBe(0);
  });

  it('TKT-007/S8 JSON for a refused ticket exits 1', async () => {
    const fx = repo('tkt007-s8');
    const { out, result } = await jsonGate(fx, 'PROP-206');
    expect(result.ready).toBe(false);
    expect(out.code).toBe(1);
  });

  it('TKT-007/S9 Blockers in a fixed order, each fix once', async () => {
    const fx = repo('tkt007-s9', (dir) => {
      writeFileSync(join(dir, 'tickets/TASK-930.md'), ticket('TASK-930', 'proposal',
        'touches: [PRV-009]\nviolates: []\ndepends_on: [BUG-301]\nquestions:\n  - id: Q1\n    kind: blocker\n    text: Which provider is safe?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null'));
    });
    const { result } = await jsonGate(fx, 'TASK-930');
    expect(result.blockers.map((blocker) => blocker.kind)).toEqual(['schema', 'unresolved', 'question', 'dependency']);
    const out = await fx.spec('', 'gate', 'TASK-930');
    const lines = out.stdout.split('\n');
    const unblock = lines.slice(lines.indexOf('To unblock:') + 1).filter(Boolean);
    expect(unblock).toEqual([
      '- schema: fix the ticket file so it matches the ticket schema (tickets/TASK-930.md)',
      '- unresolved: correct the ID in touches or violates, or create the unit first',
      '- question: answer it by setting the question\'s answer: field in its owner\'s file (the ID before #); it stays for the record',
      '- dependency: finish the ticket it depends on and merge its branch; this clears by itself, no answer is needed',
    ]);
  });

  it('TKT-007/S10 How each kind is cleared', async () => {
    const fx = repo('tkt007-s10', (dir) => {
      writeFileSync(join(dir, 'tickets/TASK-930.md'), ticket('TASK-930', 'proposal',
        'touches: [PRV-009, UI-001, CNV-003, settings.ApiKey]\nviolates: []\ndepends_on: [BUG-301]\nquestions:\n  - id: Q1\n    kind: blocker\n    text: Which provider is safe?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null'));
      writeFileSync(join(dir, 'spec/ui/UI-001-fallback-notice.md'), readFileSync(join(dir, 'spec/ui/UI-001-fallback-notice.md'), 'utf8').replace('status: active', 'status: removed'));
      const draft = join(dir, 'spec/modules/conversation/features/CNV-003-export-to-markdown.md');
      writeFileSync(draft, readFileSync(draft, 'utf8').replace('status: active\n', 'status: active\ndraft: true\nsources: [README.md]\n'));
    });
    const out = await fx.spec('', 'gate', 'TASK-930');
    const lines = out.stdout.split('\n');
    const unblock = lines.slice(lines.indexOf('To unblock:') + 1).filter(Boolean);
    expect(unblock).toEqual([
      '- schema: fix the ticket file so it matches the ticket schema (tickets/TASK-930.md)',
      '- unresolved: correct the ID in touches or violates, or create the unit first',
      '- removed: point the ticket at the unit that replaced it',
      '- draft: check the drafted unit against what the software should do, then run spec confirm <ID>',
      "- question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record",
      '- scope_gap: add the named feature to touches, or narrow the contracts the ticket touches',
      '- dependency: finish the ticket it depends on and merge its branch; this clears by itself, no answer is needed',
    ]);
  });

  it('TKT-007/S11 A ticket the store does not hold', async () => {
    const fx = repo('tkt007-s11');
    const out = await fx.spec('', 'gate', 'PROP-20');
    expect(out.stderr.startsWith('Unknown PROP-20. Did you mean PROP-201?')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('TKT-007/S12 An argument that is not a ticket ID', async () => {
    const fx = repo('tkt007-s12');
    const out = await fx.spec('', 'gate', 'PRV-001');
    expect(out.stderr.startsWith('Unknown PRV-001.')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('TKT-007/S13 Wrong number of arguments', async () => {
    const fx = repo('tkt007-s13');
    const out = await fx.spec('', 'gate', 'TASK-101', 'TASK-102');
    expect(out.stderr.startsWith('usage: spec gate <TICKET>')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('TKT-007/S14 Questions outside the scope do not block', async () => {
    const fx = repo('tkt007-s14', (dir) => {
      const path = join(dir, 'tickets/TASK-101.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('touches: [PRV-001, PRV-002]', 'touches: [PRV-001]'));
      addQuestions(dir, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md', question('Q1', 'blocker', 'Does a fallback count toward usage?'));
    });
    const { result } = await jsonGate(fx, 'TASK-101');
    expect(result.blockers.some((blocker) => blocker.kind === 'question')).toBe(false);
  });

  it('TKT-007/S15 A preference without a default is not listed', async () => {
    const fx = repo('tkt007-s15', (dir) => {
      const path = join(dir, 'tickets/TASK-101.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('touches: [PRV-001, PRV-002]', 'touches: [PRV-001]'));
      addQuestions(dir, 'spec/modules/providers/features/PRV-001-stream-a-reply.md', question('Q1', 'preference', 'Should the provider be named?'));
    });
    const { result } = await jsonGate(fx, 'TASK-101');
    expect(result.preferences.some((preference) => preference.id === 'PRV-001#Q1')).toBe(false);
  });
});
