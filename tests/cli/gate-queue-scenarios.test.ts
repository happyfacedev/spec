// TKT-007 (spec gate) and TKT-010 (spec queue): the scenarios that did not change, one test each, through the CLI
// on throwaway git copies of chat-mini. The scenarios that deal with absorbed tickets are in ticket-combine.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const PRV002 = 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md';
const mk = (setup: (dir: string) => void = () => undefined): Fx => {
  const fx = gitFixture('spec-gate-queue', { setup });
  made.push(fx);
  return fx;
};
const put = (dir: string, id: string, text: string) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); };
const patch = (dir: string, path: string, from: string, to: string) => {
  const text = readFileSync(join(dir, path), 'utf8');
  if (!text.includes(from)) throw new Error(`${path} has no ${from}`);
  writeFileSync(join(dir, path), text.replace(from, to));
};
const withQuestions = (yaml: string) => (dir: string) => { patch(dir, PRV002, 'ui: [UI-001]', `ui: [UI-001]\nquestions:\n${yaml}`); };
const BLOCKER_Q1 = '  - { id: Q1, kind: blocker, text: Does a fallback count toward usage?, cites: [conversation.Message.usage] }';
/** An open ticket file of the given type, with the lines of `over` replacing its defaults by key. */
const tk = (id: string, type: string, over: Record<string, string> = {}, body = 'Do it.') => {
  const lines: Record<string, string> = {
    id: `id: ${id}`,
    type: `type: ${type}`,
    title: 'title: x',
    status: 'status: open',
    stage: 'stage: null',
    touches: 'touches: [PRV-001]',
    violates: 'violates: []',
    changed: 'changed: []',
    questions: 'questions: []',
    history: 'history: []',
    ...over,
  };
  return `---\n${Object.values(lines).join('\n')}\n---\n${body}\n`;
};
const BLOCKER_TICKET_Q = 'questions:\n  - id: Q1\n    kind: blocker\n    text: Which name?\n    default: null\n    cites: []\n    answer: null\n    raised_by: null';

interface GateJson { ticket: string; ready: boolean; blockers: { kind: string; id: string; text: string }[]; preferences: { id: string; default: string; text: string }[] }
interface QueueJson { ready: { id: string; type: string; title: string; stage: string | null; reason: string | null }[]; waiting: { id: string; reason: string | null }[]; blocked: { id: string; type: string; title: string; reason: string | null }[]; inProgress: { id: string }[]; done: number }
const gateJson = async (fx: Fx, id: string) => {
  const out = await fx.spec('', 'gate', id, '--format', 'json');
  return { code: out.code, gate: JSON.parse(out.stdout) as GateJson };
};
const queueJson = async (fx: Fx) => JSON.parse((await fx.spec('', 'queue', '--format', 'json')).stdout) as QueueJson;

describe('TKT-007: Gate a ticket with spec gate', () => {
  const shared = mk();

  it('TKT-007/S1 A ready ticket', async () => {
    const out = await shared.spec('', 'gate', 'TASK-101');
    expect(out.stdout).toBe('TASK-101: ready\n');
    expect(out.code).toBe(0);
  }, 60_000);

  it('TKT-007/S2 An open blocker question on the ticket', async () => {
    const out = await shared.spec('', 'gate', 'PROP-206');
    expect(out.stdout).toBe(
      "PROP-206: not ready\n\nBlockers:\n- question PROP-206#Q1: Do renamed providers keep their usage history?\n\nTo unblock:\n- question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record\n",
    );
    expect(out.code).toBe(1);
  }, 60_000);

  it('TKT-007/S3 An open blocker on a unit in scope', async () => {
    const fx = mk(withQuestions(`${BLOCKER_Q1}\n  - { id: Q2, kind: preference, text: Notice wording?, default: as in UI-001 }`));
    const { gate } = await gateJson(fx, 'TASK-103');
    expect(gate.blockers).toEqual([{ kind: 'question', id: 'PRV-002#Q1', text: 'Does a fallback count toward usage?' }]);
    expect(gate.preferences.map((p) => p.id)).toContain('PRV-002#Q2');
  }, 60_000);

  it('TKT-007/S4 A violated scenario puts its feature\'s questions in scope', async () => {
    const fx = mk(withQuestions('  - { id: Q1, kind: blocker, text: Is a third provider ever allowed? }'));
    const { gate } = await gateJson(fx, 'BUG-301');
    expect(gate.blockers.map((b) => b.id)).toEqual(['PRV-002#Q1']);
  }, 60_000);

  it('TKT-007/S5 An answered blocker no longer blocks', async () => {
    const fx = mk(withQuestions('  - { id: Q1, kind: blocker, text: Is a third provider ever allowed?, answer: "no" }'));
    const { gate } = await gateJson(fx, 'BUG-301');
    expect(gate.ready).toBe(true);
  }, 60_000);

  it('TKT-007/S6 A preference proceeds on its default', async () => {
    const out = await shared.spec('', 'gate', 'PROP-202');
    expect(out.stdout).toBe('PROP-202: ready\n\nPreferences (work proceeds on the default):\n- PROP-202#Q1 In what order does the model picker list enabled providers? → alphabetical\n');
    expect(out.code).toBe(0);
  }, 60_000);

  it('TKT-007/S7 The JSON result', async () => {
    const { gate } = await gateJson(shared, 'PROP-202');
    expect(gate.ticket).toBe('PROP-202');
    expect(gate.ready).toBe(true);
    expect(gate.blockers).toEqual([]);
    expect(gate.preferences).toEqual([{ id: 'PROP-202#Q1', default: 'alphabetical', text: 'In what order does the model picker list enabled providers?' }]);
  }, 60_000);

  it('TKT-007/S8 JSON for a refused ticket exits 1', async () => {
    const { code, gate } = await gateJson(shared, 'PROP-206');
    expect(gate.ready).toBe(false);
    expect(code).toBe(1);
  }, 60_000);

  it('TKT-007/S11 A ticket the store does not hold', async () => {
    const out = await shared.spec('', 'gate', 'PROP-20');
    expect(out.stderr.startsWith('Unknown PROP-20. Did you mean PROP-201?')).toBe(true);
    expect(out.code).toBe(2);
  }, 60_000);

  it('TKT-007/S12 An argument that is not a ticket ID', async () => {
    const out = await shared.spec('', 'gate', 'PRV-001');
    expect(out.stderr.startsWith('Unknown PRV-001.')).toBe(true);
  }, 60_000);

  it('TKT-007/S13 Wrong number of arguments', async () => {
    const out = await shared.spec('', 'gate', 'TASK-101', 'TASK-102');
    expect(out.stderr.startsWith('usage: spec gate <TICKET>')).toBe(true);
    expect(out.code).toBe(2);
  }, 60_000);

  it('TKT-007/S14 Questions outside the scope do not block', async () => {
    const fx = mk((dir) => {
      withQuestions(BLOCKER_Q1)(dir);
      put(dir, 'TASK-940', tk('TASK-940', 'task'));
    });
    const { gate } = await gateJson(fx, 'TASK-940');
    expect(gate.blockers.filter((b) => b.kind === 'question')).toEqual([]);
  }, 60_000);

  it('TKT-007/S15 A preference without a default is not listed', async () => {
    const fx = mk(withQuestions('  - { id: Q1, kind: preference, text: Which name?, default: null }'));
    const { gate } = await gateJson(fx, 'TASK-103');
    expect(gate.preferences.map((p) => p.id)).not.toContain('PRV-002#Q1');
  }, 60_000);
});

describe('TKT-010: See every ticket with spec queue', () => {
  const GROUPS = `# Queue · spec@3f8f2372

## Ready (7)
- BUG-301 bug · next tester · Fallback moves on to a third provider
- PROP-201 proposal · next spec-writer · Add a "gemini" fake provider
- PROP-202 proposal · next spec-writer · List enabled providers in the model picker
- PROP-205 proposal · next spec-writer · Add a copy-message action
- TASK-101 task · next implementer · Extract provider selection into its own module
- TASK-102 task · next implementer · Record which provider produced each message
- TASK-103 task · next implementer · Simplify the fallback code

## Blocked (2)
- BUG-302 bug · Export looks ugly
  schema BUG-302: a bug must name the scenario it violates; without one the behaviour is unspecified: add the violated scenario IDs to violates, or turn the ticket into a proposal
- PROP-206 proposal · Let users rename providers
  question PROP-206#Q1: Do renamed providers keep their usage history?

## In progress (0)
None

Done: 0
`;
  const plain = mk();

  it('TKT-010/S1 The groups', async () => {
    const out = await plain.spec('', 'queue');
    expect(out.stdout).toBe(GROUPS);
    expect(out.code).toBe(0);
  }, 60_000);

  it('TKT-010/S2 A ticket in progress shows its running stage', async () => {
    const fx = mk((dir) => { patch(dir, 'tickets/BUG-301.md', 'status: open\nstage: null', 'status: in_progress\nstage: tester'); });
    const out = await fx.spec('', 'queue');
    expect(out.stdout).toContain('## In progress (1)\n- BUG-301 bug · stage tester · Fallback moves on to a third provider');
  }, 60_000);

  it('TKT-010/S3 A ticket that only waits for other tickets', async () => {
    const fx = mk((dir) => { put(dir, 'TASK-901', tk('TASK-901', 'task', { title: 'title: After BUG-301', depends_on: 'depends_on: [BUG-301]' })); });
    const q = await queueJson(fx);
    expect(q.waiting.map((e) => e.id)).toEqual(['TASK-901']);
    expect(q.blocked.map((e) => e.id)).not.toContain('TASK-901');
    const out = await fx.spec('', 'queue');
    expect(out.stdout).toContain('## Waiting (1)\n- TASK-901 task · After BUG-301\n  waits for BUG-301, which is open');
  }, 60_000);

  it('TKT-010/S4 No Waiting section when nothing waits', async () => {
    const out = await plain.spec('', 'queue');
    expect(out.stdout).not.toContain('## Waiting');
  }, 60_000);

  it('TKT-010/S5 A ticket blocked by a person and a dependency is Blocked', async () => {
    const fx = mk((dir) => { put(dir, 'TASK-941', tk('TASK-941', 'task', { depends_on: 'depends_on: [BUG-301]', questions: BLOCKER_TICKET_Q })); });
    const q = await queueJson(fx);
    expect(q.blocked.find((e) => e.id === 'TASK-941')?.reason).toBe('question TASK-941#Q1: Which name?');
  }, 60_000);

  it('TKT-010/S6 Done tickets are counted, not listed', async () => {
    const fx = mk((dir) => {
      for (const id of ['TASK-101', 'TASK-102', 'TASK-103']) patch(dir, `tickets/${id}.md`, 'status: open', 'status: done');
    });
    const out = await fx.spec('', 'queue');
    expect(out.stdout.endsWith('\nDone: 3\n')).toBe(true);
    for (const id of ['TASK-101', 'TASK-102', 'TASK-103']) expect(out.stdout).not.toContain(`- ${id} `);
  }, 60_000);

  it('TKT-010/S7 A ticket file that does not parse', async () => {
    const fx = mk((dir) => {
      put(dir, 'TASK-942', tk('TASK-942', 'chore'));
      put(dir, 'TASK-944', tk('TASK-944', 'task', {
        history: 'history:\n  - { at: "2026-10-27T10:00:00Z", role: tester, result: done, summary: x, verdict: null, assumed: [], cost_usd: -1 }',
      }));
    });
    const q = await queueJson(fx);
    const e = q.blocked.find((x) => x.id === 'TASK-942');
    expect(e).toMatchObject({ id: 'TASK-942', type: 'unknown', title: '(does not parse)' });
    expect(e?.reason?.startsWith('schema TASK-942: type: Invalid option')).toBe(true);
    const invalidMeasure = q.blocked.find((x) => x.id === 'TASK-944');
    expect(invalidMeasure).toMatchObject({ id: 'TASK-944', type: 'unknown', title: '(does not parse)' });
    expect(invalidMeasure?.reason?.startsWith('schema TASK-944: history[0].cost_usd:')).toBe(true);
  }, 60_000);

  it('TKT-010/S8 A ticket whose reviews went round too often', async () => {
    const review = '  - at: 2026-10-27T10:00:00Z\n    role: reviewer\n    result: done\n    summary: again\n    verdict: changes\n    assumed: []\n    duration_s: 5';
    const fx = mk((dir) => { put(dir, 'TASK-943', tk('TASK-943', 'task', { history: `history:\n${[review, review, review].join('\n')}` })); });
    const q = await queueJson(fx);
    expect(q.blocked.find((e) => e.id === 'TASK-943')?.reason).toBe('the reviewer asked for changes 3 times; a person must decide');
  }, 60_000);

  describe('with 400 ready tickets', () => {
    const many = mk((dir) => {
      for (let n = 1; n <= 400; n += 1) {
        const id = `TASK-${String(n + 500).padStart(3, '0')}`;
        put(dir, id, tk(id, 'task', { title: `title: A rather long ticket title to fill the queue quickly ${n}` }));
      }
    });

    it('TKT-010/S9 The output is capped', async () => {
      const out = await many.spec('', 'queue');
      expect(out.stdout.length).toBeLessThanOrEqual(10_000);
      const shown = out.stdout.split('\n').filter((l) => /^- (BUG|PROP|TASK)-\d+ /.test(l)).length;
      const total = 400 + 7 + 2; // the 400, the fixture's 7 ready and its 2 blocked
      expect(out.stdout).toContain(`… ${total - shown} more tickets not shown (capped at 10000 characters); run spec queue --format json for all`);
      expect((await many.spec('', 'queue')).stdout).toBe(out.stdout);
    }, 120_000);

    it('TKT-010/S10 The JSON result is never capped', async () => {
      const q = await queueJson(many);
      const mine = q.ready.filter((e) => /^TASK-\d+$/.test(e.id) && Number(e.id.slice(5)) > 500);
      expect(mine).toHaveLength(400);
      for (const e of mine) expect(e).toMatchObject({ stage: 'implementer', reason: null });
    }, 120_000);
  });

  it('TKT-010/S11 The queue takes no arguments', async () => {
    const out = await plain.spec('', 'queue', 'TASK-101');
    expect(out.stderr.startsWith('usage: spec queue')).toBe(true);
    expect(out.code).toBe(2);
  }, 60_000);
});
