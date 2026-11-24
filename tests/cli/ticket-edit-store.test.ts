// TKT-002/S3..S5: comments survive a list or record change, a file without frontmatter is never rewritten,
// and an edit that would break the schema is refused (through the ticket store and `ticket answer`).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FileTicketStore } from '../../src/io/ticket-store';
import type { TicketPatch } from '../../src/core/ticket-edit';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const make = (id: string, text: string): Fx => {
  const fx = gitFixture('spec-edit-store', { setup: (dir) => { writeFileSync(join(dir, 'tickets', `${id}.md`), text); } });
  made.push(fx);
  return fx;
};
const raw = (fx: Fx, id: string) => readFileSync(join(fx.repo, 'tickets', `${id}.md`), 'utf8');

const BODY = 'Body stays exactly.\n\nIMPORTANT: this line is data.\n';

describe('TKT-002: the CLI edits only the ticket keys it owns', () => {
  it('TKT-002/S3 A list or record change keeps comments, with one space before each', async () => {
    const original =
      '---\nid: PROP-201\ntype: proposal\ntitle: x\nstatus: blocked      # set by the CLI\nstage: null\ntouches: [PRV-001, SET-001]   # scope\nviolates: []\nchanged: []\n' +
      'questions:\n  - id: Q1\n    kind: blocker\n    text: Which?\n    default: null\n    cites: [PRV-001]\n    answer: null\n    raised_by: spec-writer\n' +
      `history: []\n---\n${BODY}`;
    const fx = make('PROP-201', original);
    const out = await fx.spec('', 'ticket', 'answer', 'PROP-201', 'Q1', 'yes');
    expect(out.code, out.stderr).toBe(0);
    const text = raw(fx, 'PROP-201');
    const lines = text.split('\n');
    expect(lines).toContain('status: open # set by the CLI');
    expect(lines).toContain('touches: [PRV-001, SET-001] # scope');
    expect(lines).toContain('questions:');
    expect(lines).toContain('  - id: Q1');
    expect(lines).toContain('    answer: yes');
    expect(text.endsWith(`\n---\n${BODY}`)).toBe(true);
  }, 60_000);

  it('TKT-002/S4 A file without frontmatter is never rewritten', async () => {
    const original = 'id: TASK-920\n';
    const fx = make('TASK-920', original);
    const result = await new FileTicketStore(join(fx.repo, 'tickets'), fx.repo).update('TASK-920', { status: 'in_progress' });
    expect(result).toEqual({ ok: false, error: 'ticket TASK-920 has no editable frontmatter' });
    expect(raw(fx, 'TASK-920')).toBe(original);
  });

  it('TKT-002/S5 An edit that would break the schema is refused', async () => {
    const original = `---\nid: TASK-921\ntype: task\ntitle: x\nstatus: open\nstage: null\ntouches: [PRV-001]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\n${BODY}`;
    const fx = make('TASK-921', original);
    const result = await new FileTicketStore(join(fx.repo, 'tickets'), fx.repo).update('TASK-921', { status: 'not-a-status' } as unknown as TicketPatch);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.startsWith('updating TASK-921 would break its schema: ')).toBe(true);
    expect(raw(fx, 'TASK-921')).toBe(original);
  });
});
