// PROP-051: external questions are surfaced by gaps and block only their owning scope.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const fixtures: Fx[] = [];
afterAll(() => { for (const fx of fixtures) fx.cleanup(); });

const question = (id: string, kind: string, text: string, defaultValue = 'null', answer = 'null') =>
  '  - id: ' + id + '\n    kind: ' + kind + '\n    text: ' + text + '\n    default: ' + defaultValue + '\n    cites: []\n    answer: ' + answer + '\n    raised_by: null';
const ticket = (id: string, type: string, touches: string, questions: string) => {
  const questionList = questions === '[]' ? 'questions: []' : 'questions:\n' + questions;
  return '---\nid: ' + id + '\ntype: ' + type + '\ntitle: External question test\nstatus: open\nstage: null\ntouches: [' + touches + ']\nviolates: []\nchanged: []\n' + questionList + '\nhistory: []\n---\nTest ticket.\n';
};

function makeFixture(prefix: string, setup: (dir: string) => void): Fx {
  const fx = gitFixture(prefix, { setup });
  fixtures.push(fx);
  return fx;
}

function addQuestion(dir: string, path: string, q: string) {
  const file = join(dir, path);
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace('status: active\n', 'status: active\nquestions:\n' + q + '\n'));
}

describe('TKT-001 question schema', () => {
  it('TKT-001/S15 A preference that cites a contract', async () => {
    const fx = makeFixture('prop051-question-schema', (dir) => {
      writeFileSync(join(dir, 'tickets/TASK-916.md'), ticket(
        'TASK-916',
        'task',
        'PRV-001',
        question('Q1', 'preference', 'May the contract change?', 'alphabetical'),
      ));
      writeFileSync(join(dir, 'tickets/TASK-917.md'), ticket(
        'TASK-917',
        'task',
        'PRV-001',
        question('Q1', 'external', 'Is the provider API verified?'),
      ));
      for (const id of ['TASK-916', 'TASK-917']) {
        const path = join(dir, 'tickets/' + id + '.md');
        writeFileSync(path, readFileSync(path, 'utf8').replace('cites: []', 'cites: [providers.ProviderConfig]'));
      }
    });

    const preference = await fx.spec('', 'gate', 'TASK-916', '--format', 'json');
    const preferenceResult = JSON.parse(preference.stdout) as { blockers: { kind: string; id: string; text: string }[] };
    expect(preferenceResult.blockers).toEqual([{
      kind: 'schema',
      id: 'TASK-916#Q1',
      text: 'TASK-916#Q1 cites providers.ProviderConfig, so it is a blocker: set kind: blocker',
    }]);

    const external = await fx.spec('', 'gate', 'TASK-917', '--format', 'json');
    const externalResult = JSON.parse(external.stdout) as { blockers: { kind: string; id: string; text: string }[] };
    expect(externalResult.blockers).toEqual([{
      kind: 'question',
      id: 'TASK-917#Q1',
      text: 'Is the provider API verified?',
    }]);
    expect(externalResult.blockers.some((blocker) => blocker.kind === 'schema')).toBe(false);
  }, 60_000);
});

describe('TKT-007 external questions', () => {
  it('TKT-007/S16 An open external question blocks like a blocker', async () => {
    const text = 'Does the external API page results?';
    const fx = makeFixture('prop051-gate-external', (dir) => {
      writeFileSync(join(dir, 'tickets/PROP-208.md'), ticket(
        'PROP-208',
        'proposal',
        'PRV-001',
        question('Q1', 'external', 'Does Claude Code run PreToolUse callbacks in parallel?'),
      ));
      writeFileSync(join(dir, 'tickets/TASK-919.md'), ticket('TASK-919', 'task', 'PRV-002', '[]'));
      writeFileSync(join(dir, 'tickets/TASK-920.md'), ticket('TASK-920', 'task', 'CNV-001', '[]'));
      addQuestion(dir, 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md', question('Q1', 'external', text));
    });

    const ticketGate = await fx.spec('', 'gate', 'PROP-208', '--format', 'json');
    expect(ticketGate.code).toBe(1);
    const ticketResult = JSON.parse(ticketGate.stdout) as { blockers: { kind: string; id: string; text: string }[]; preferences: unknown[] };
    expect(ticketResult.blockers).toEqual([{
      kind: 'question',
      id: 'PROP-208#Q1',
      text: 'Does Claude Code run PreToolUse callbacks in parallel?',
    }]);
    expect(ticketResult.preferences).toEqual([]);

    const inScope = await fx.spec('', 'gate', 'TASK-919', '--format', 'json');
    const inScopeResult = JSON.parse(inScope.stdout) as { blockers: { kind: string; id: string; text: string }[] };
    expect(inScopeResult.blockers).toEqual([{ kind: 'question', id: 'PRV-002#Q1', text }]);

    const outsideScope = await fx.spec('', 'gate', 'TASK-920', '--format', 'json');
    expect(outsideScope.code).toBe(0);
    const outsideResult = JSON.parse(outsideScope.stdout) as { ready: boolean; blockers: unknown[] };
    expect(outsideResult.ready).toBe(true);
    expect(outsideResult.blockers).toEqual([]);

    expect((await fx.spec('', 'ticket', 'answer', 'PROP-208', 'Q1', 'yes, verified in a spike')).code).toBe(0);
    const answered = await fx.spec('', 'gate', 'PROP-208', '--format', 'json');
    expect(answered.code).toBe(0);
    expect((JSON.parse(answered.stdout) as { ready: boolean }).ready).toBe(true);
  }, 60_000);
});
