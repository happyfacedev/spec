// spec ticket answer --back (TKT-006/S15..S20) and the stage a reopened ticket starts (PIP-001/S11),
// through the CLI against a throwaway git copy of chat-mini.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { run } from '../../src/cli/run';
import { gitFixture } from '../helpers';

const CLOCK = '2026-10-29T09:00:00.000Z';
const QUESTION = 'The test for PRV-002/S3 expects the wrong status';

const fx = gitFixture('spec-answer-back');
afterAll(() => {
  fx.cleanup();
});

const spec = (...argv: string[]) => run({ argv: [...argv, '--root', join(fx.repo, 'spec')], env: {}, cwd: fx.repo, scriptPath: undefined, stdin: () => Promise.resolve(''), now: () => CLOCK });

interface TicketSetup {
  id: string;
  type: string;
  status: string;
  stage?: string;
  history: [role: string, result: string][];
  question?: boolean;
  answer?: string;
}

/** Writes the ticket file the way the CLI keeps it: frontmatter then a one-line body. */
function put(o: TicketSetup): string {
  const history = o.history.length === 0 ? 'history: []' : `history:\n${o.history.map(([role, result]) => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: ${result}, summary: x, verdict: null, assumed: [] }`).join('\n')}`;
  const questions =
    o.question === false
      ? 'questions: []'
      : `questions:\n  - id: Q1\n    kind: blocker\n    text: ${QUESTION}\n    default: null\n    cites: []\n    answer: ${o.answer ?? 'null'}\n    raised_by: implementer`;
  const text = `---\nid: ${o.id}\ntype: ${o.type}\ntitle: Let users rename providers\nstatus: ${o.status}\nstage: ${o.stage ?? 'null'}\ntouches: [providers.ProviderConfig, SET-001]\nviolates: []\nchanged: []\n${questions}\n${history}\n---\nGive each provider a display name.\n`;
  writeFileSync(join(fx.repo, 'tickets', `${o.id}.md`), text);
  return text;
}

const raw = (id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');
const live = (id: string) => {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw(id));
  return parse(m?.[1] ?? '') as { status: string; stage: string | null; questions: { id: string; answer: string | null }[]; history: Record<string, unknown>[] };
};

const BLOCKED_PROPOSAL: TicketSetup = {
  id: 'PROP-206',
  type: 'proposal',
  status: 'blocked',
  history: [
    ['spec-writer', 'done'],
    ['tester', 'done'],
    ['implementer', 'blocked'],
  ],
};

describe('spec ticket answer --back', () => {
  it('TKT-006/S15 An answer sends the ticket back to an earlier stage', async () => {
    put(BLOCKED_PROPOSAL);
    const out = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'the', 'test', 'is', 'wrong', '--back', 'tester');
    expect(out.stdout).toBe('PROP-206#Q1 answered. PROP-206 is ready again.\nnext: tester\n');
    expect(out.code).toBe(0);
    const t = live('PROP-206');
    expect(t.questions[0]?.answer).toBe('the test is wrong');
    expect(t.status).toBe('open');
    expect(t.history).toHaveLength(4);
    expect(t.history.at(-1)).toEqual({ at: CLOCK, role: 'tester', result: 'reopened', summary: 'reopened by PROP-206#Q1', verdict: null, assumed: [] });
  });

  it('TKT-006/S15 An answer sends the ticket back to an earlier stage: the spec review is one of them', async () => {
    put({ ...BLOCKED_PROPOSAL, history: [['spec-writer', 'done'], ['spec-review', 'done'], ['tester', 'done'], ['implementer', 'blocked']] });
    const out = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'the', 'spec', 'is', 'wrong', '--back', 'spec-review');
    expect(out.stdout).toBe('PROP-206#Q1 answered. PROP-206 is ready again.\nnext: spec-review\n');
    expect(out.code).toBe(0);
    const t = live('PROP-206');
    expect(t.status).toBe('open');
    expect(t.history).toHaveLength(5);
    expect(t.history.at(-1)).toEqual({ at: CLOCK, role: 'spec-review', result: 'reopened', summary: 'reopened by PROP-206#Q1', verdict: null, assumed: [] });
    // The spec review runs next; once it is done the pipeline goes on to the tester.
    const refused = await spec('ticket', 'start', 'PROP-206', 'tester');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('the next stage of PROP-206 is spec-review, not tester');
  });

  it('TKT-006/S16 The JSON result names the next stage', async () => {
    put(BLOCKED_PROPOSAL);
    const out = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'the', 'test', 'is', 'wrong', '--back', 'tester', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'PROP-206', question: 'Q1', answer: 'the test is wrong', ready: true, next: 'tester' });

    const before = put(BLOCKED_PROPOSAL);
    const plain = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'the', 'test', 'is', 'wrong', '--format', 'json');
    expect(JSON.parse(plain.stdout)).not.toHaveProperty('next');
    expect(live('PROP-206').history).toEqual((parse(/^---\n([\s\S]*?)\n---/.exec(before)?.[1] ?? '') as { history: unknown[] }).history);
  });

  it('TKT-006/S17 A role that has not run cannot be gone back to', async () => {
    const before = put({ ...BLOCKED_PROPOSAL, history: [['spec-writer', 'done'], ['tester', 'done']] });
    const out = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'x', '--back', 'reviewer');
    expect(out.stderr).toBe('PROP-206 has no finished reviewer stage to go back to; stages it has finished: spec-writer, tester\n');
    expect(out.code).toBe(1);
    expect(raw('PROP-206')).toBe(before);
  });

  it("TKT-006/S18 A role the ticket's type does not run", async () => {
    put({ id: 'TASK-101', type: 'task', status: 'blocked', history: [['implementer', 'done']] });
    const out = await spec('ticket', 'answer', 'TASK-101', 'Q1', 'x', '--back', 'tester');
    expect(out.stderr).toBe('TASK-101 has no finished tester stage to go back to; stages it has finished: implementer\n');
    expect(out.code).toBe(1);
  });

  it('TKT-006/S19 An unknown role, or none', async () => {
    const before = put({ id: 'PROP-206', type: 'proposal', status: 'open', history: [] });
    const unknown = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'x', '--back', 'boss');
    expect(unknown.stderr).toMatch(/^Unknown role boss\. Roles: spec-writer, spec-review, tester, implementer, reviewer/);
    expect(unknown.code).toBe(2);
    const none = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'x', '--back');
    expect(none.stderr).toMatch(/^usage: /);
    expect(none.code).toBe(2);
    expect(raw('PROP-206')).toBe(before);
  });

  it('TKT-006/S20 A stage is running', async () => {
    const before = put({ id: 'PROP-206', type: 'proposal', status: 'in_progress', stage: 'tester', history: [['spec-writer', 'done']] });
    const out = await spec('ticket', 'answer', 'PROP-206', 'Q1', 'x', '--back', 'spec-writer');
    expect(out.stderr).toBe('PROP-206 has its tester stage running; finish it before going back\n');
    expect(out.code).toBe(1);
    expect(live('PROP-206').questions[0]?.answer).toBeNull();
    expect(raw('PROP-206')).toBe(before);
  });
});

describe('a reopened ticket through spec ticket start', () => {
  it('PIP-001/S11 A reopened stage runs next, and the pipeline continues from it', async () => {
    put({
      ...BLOCKED_PROPOSAL,
      status: 'open',
      answer: 'the test is wrong',
      history: [
        ['spec-writer', 'done'],
        ['tester', 'done'],
        ['implementer', 'blocked'],
        ['tester', 'reopened'],
      ],
    });
    const refused = await spec('ticket', 'start', 'PROP-206', 'implementer');
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('the next stage of PROP-206 is tester, not implementer');
    const started = await spec('ticket', 'start', 'PROP-206', 'tester', '--format', 'json');
    expect(started.code, started.stderr).toBe(0);
    expect(JSON.parse(started.stdout)).toMatchObject({ ticket: 'PROP-206', stage: 'tester', status: 'in_progress' });
  });
});
