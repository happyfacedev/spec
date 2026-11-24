// spec ticket answer (TKT-006/S1..S14) through the CLI against a throwaway git copy of chat-mini.
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { gitFixture } from '../helpers';

const fx = gitFixture('spec-answer');
const trees = `${realpathSync(fx.repo)}.worktrees`;
afterAll(() => {
  fx.git('worktree', 'prune');
  rmSync(trees, { recursive: true, force: true });
  fx.cleanup();
});

const path = (id: string) => join(fx.repo, 'tickets', `${id}.md`);
const raw = (id: string) => readFileSync(path(id), 'utf8');
const fm = (text: string) => parse(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '') as { status: string; questions: { id: string; answer: string | null }[] };

const blocker = (n: number, answer = 'null') => `  - id: Q${n}\n    kind: blocker\n    text: Question ${n}?\n    default: null\n    cites: []\n    answer: ${answer}\n    raised_by: null`;
/** PROP-206 with the given status and questions. */
const prop206 = (status: string, questions: string[]) =>
  `---\nid: PROP-206\ntype: proposal\ntitle: Let users rename providers\nstatus: ${status}\nstage: null\ntouches: [providers.ProviderConfig, SET-001]\nviolates: []\nchanged: []\nquestions:\n${questions.join('\n')}\nhistory: []\n---\nGive each provider a name.\n`;

describe('spec ticket answer', () => {
  it('TKT-006/S1 The answer is recorded and the ticket is ready again', async () => {
    writeFileSync(path('PROP-206'), prop206('open', [blocker(1)]));
    expect((await fx.spec('', 'gate', 'PROP-206')).code).toBe(1);
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes,', 'history', 'follows', 'the', 'provider');
    expect(out.stdout).toBe('PROP-206#Q1 answered. PROP-206 is ready again.\n');
    expect(fm(raw('PROP-206')).questions[0]?.answer).toBe('yes, history follows the provider');
    expect(out.code).toBe(0);
  });

  it('TKT-006/S2 Still not ready', async () => {
    writeFileSync(path('PROP-207'), prop206('open', [blocker(1), blocker(2)]).replaceAll('PROP-206', 'PROP-207'));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-207', 'Q1', 'no');
    expect(out.stdout).toBe('PROP-207#Q1 answered. PROP-207 is still not ready; spec gate PROP-207 says why.\n');
    expect(out.code).toBe(0);
  });

  it('TKT-006/S3 A blocked ticket goes back to open', async () => {
    writeFileSync(path('PROP-206'), prop206('blocked', [blocker(1)]));
    await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
    expect(fm(raw('PROP-206')).status).toBe('open');
  });

  it('TKT-006/S4 Other statuses are kept', async () => {
    const before = prop206('open', [blocker(1)]);
    writeFileSync(path('PROP-206'), before);
    await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
    expect(fm(raw('PROP-206')).status).toBe('open');
    expect(raw('PROP-206')).toBe(prop206('open', [blocker(1, 'yes')]));
  });

  it('TKT-006/S5 The question may be named with its ticket', async () => {
    writeFileSync(path('PROP-206'), prop206('open', [blocker(1)]));
    await fx.spec('', 'ticket', 'answer', 'PROP-206', 'PROP-206#Q1', 'yes');
    expect(fm(raw('PROP-206')).questions[0]?.answer).toBe('yes');
  });

  it('TKT-006/S6 A question on a spec unit', async () => {
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'PRV-002#Q1', 'x');
    expect(out.stderr).toBe('PRV-002#Q1 is a question on PRV-002, a spec unit: answer it in its spec file\n');
    expect(out.code).toBe(1);
  });

  it('TKT-006/S7 A question the ticket does not have', async () => {
    writeFileSync(path('PROP-206'), prop206('open', [blocker(1)]));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q9', 'x');
    expect(out.stderr).toBe('PROP-206 has no question Q9; its questions: Q1\n');
  });

  it('TKT-006/S8 A ticket with no questions', async () => {
    const out = await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'x');
    expect(out.stderr).toBe('TASK-101 has no question Q1; its questions: none\n');
  });

  it('TKT-006/S9 No answer given', async () => {
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1');
    expect(out.stderr.startsWith('usage: spec ticket answer <TICKET> <Q> <answer>')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('TKT-006/S10 An unknown ticket', async () => {
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-20', 'Q1', 'x');
    expect(out.stderr.startsWith('Unknown PROP-20. Did you mean PROP-201?')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('TKT-006/S11 The JSON result', async () => {
    writeFileSync(path('PROP-206'), prop206('open', [blocker(1)]));
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes', '--format', 'json');
    expect(JSON.parse(out.stdout)).toEqual({ ticket: 'PROP-206', question: 'Q1', answer: 'yes', ready: true });
  });

  it('TKT-006/S12 Answering a ticket that lives elsewhere', async () => {
    const bug = readFileSync(path('BUG-301'), 'utf8').replace('questions: []', `questions:\n${blocker(1)}`);
    expect(bug).toContain('Question 1?');
    writeFileSync(path('BUG-301'), bug);
    fx.git('add', '-A');
    fx.git('commit', '-q', '-m', 'BUG-301 has a question');
    mkdirSync(trees, { recursive: true });
    expect((await fx.spec('', 'worktree', 'add', 'BUG-301')).code).toBe(0);
    const live = join(trees, 'BUG-301', 'tickets/BUG-301.md');
    expect(fm(readFileSync(live, 'utf8')).questions[0]?.answer).toBeNull();
    const out = await fx.spec('', 'ticket', 'answer', 'BUG-301', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    expect(fm(readFileSync(live, 'utf8')).questions[0]?.answer).toBe('yes');
  }, 60_000);
});

describe('spec ticket answer in a tracker', () => {
  it('TKT-006/S13 The store refuses', async () => {
    const adapter = `import { readFileSync } from 'node:fs';
const [op, id] = process.argv.slice(2);
const text = readFileSync('ticket.md', 'utf8');
if (op === 'list') process.stdout.write(JSON.stringify({ tickets: [{ id: 'PROP-206', text }] }));
else if (op === 'put' && id) { readFileSync(0, 'utf8'); process.stdout.write('{"ok":false,"error":"PROP-206 changed since it was read"}'); }
`;
    const t = gitFixture('spec-answer-tracker', {
      setup: (dir) => {
        rmSync(join(dir, 'tickets'), { recursive: true, force: true });
        mkdirSync(join(dir, 'tools'), { recursive: true });
        writeFileSync(join(dir, 'tools/tickets.mjs'), adapter);
        writeFileSync(join(dir, 'ticket.md'), prop206('blocked', [blocker(1)]));
        const cfgPath = join(dir, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
        cfg.tickets = { adapter: 'command', command: 'node tools/tickets.mjs' };
        writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    });
    try {
      const out = await t.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'yes');
      expect(out.stderr).toBe('the tracker refused the update: PROP-206 changed since it was read\n');
      expect(out.code).toBe(1);
    } finally {
      t.cleanup();
    }
  }, 30_000);

  it('TKT-006/S14 An answered question is answered again', async () => {
    writeFileSync(path('PROP-206'), prop206('open', [blocker(1, 'yes')]));
    await fx.spec('', 'ticket', 'answer', 'PROP-206', 'Q1', 'no');
    expect(fm(raw('PROP-206')).questions[0]?.answer).toBe('no');
  });
});
