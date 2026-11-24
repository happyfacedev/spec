// TKT-001/S31..S33 (PROP-092): the ticket file's lane key, through the CLI on throwaway git copies of the lint base spec.
import { mkdirSync, writeFileSync } from 'node:fs';
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
  const fx = gitFixture('spec-ticket-lane', { fixture: LINT_BASE, setup: edit });
  made.push(fx);
  return fx;
}
const put = (dir: string, path: string, text: string) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};
/** A valid open ticket file of `type`, holding a `lane:` line when `lane` is given. */
const ticket = (id: string, type: 'proposal' | 'bug' | 'task', lane: string | null) => {
  const violates = type === 'bug' ? 'violates: [ALP-001/S1]' : 'violates: []';
  const touches = type === 'bug' ? 'touches: []' : 'touches: [ALP-001]';
  const laneLine = lane === null ? '' : `lane: ${lane}\n`;
  return `---\nid: ${id}\ntype: ${type}\ntitle: x\nstatus: open\nstage: null\n${laneLine}${touches}\n${violates}\nchanged: []\nquestions: []\nhistory: []\n---\nDo it.\n`;
};

interface Finding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  id: string | null;
  message: string;
  fix: string;
}
/** Parses JSON without throwing, so a run that printed none fails the assertion that reads it, not on an error. */
const parse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};
const lintJson = async (fx: Fx) => {
  const out = await fx.spec('', 'lint', '--format', 'json');
  return parse<{ findings: Finding[] }>(out.stdout, { findings: [] }).findings;
};
const gateJson = async (fx: Fx, id: string) => {
  const out = await fx.spec('', 'gate', id, '--format', 'json');
  return { code: out.code, gate: parse<{ ready: boolean; blockers: { kind: string; id: string; text: string }[] }>(out.stdout, { ready: false, blockers: [] }) };
};

const LIGHT_ON_NON_PROPOSAL = 'only a proposal may run in a light lane: remove lane, or set lane: full';

describe('TKT-001 the lane of a ticket', () => {
  it('TKT-001/S31 A proposal in a light lane', async () => {
    const fx = base((d) => {
      put(d, 'tickets/PROP-931.md', ticket('PROP-931', 'proposal', 'docs'));
      put(d, 'tickets/PROP-932.md', ticket('PROP-932', 'proposal', 'tests'));
      put(d, 'tickets/PROP-936.md', ticket('PROP-936', 'proposal', 'build'));
    });
    for (const id of ['PROP-931', 'PROP-932', 'PROP-936']) {
      const out = await fx.spec('', 'gate', id);
      expect(out.stdout.split('\n')[0]).toBe(`${id}: ready`);
    }
    const findings = await lintJson(fx);
    expect(findings.filter((f) => ['tickets/PROP-931.md', 'tickets/PROP-932.md', 'tickets/PROP-936.md'].includes(f.file))).toEqual([]);
  });

  it('TKT-001/S32 A light lane on a bug or a task', async () => {
    const fx = base((d) => {
      put(d, 'tickets/BUG-933.md', ticket('BUG-933', 'bug', 'tests'));
      put(d, 'tickets/TASK-934.md', ticket('TASK-934', 'task', 'docs'));
      put(d, 'tickets/BUG-936.md', ticket('BUG-936', 'bug', 'full'));
      put(d, 'tickets/TASK-937.md', ticket('TASK-937', 'task', 'full'));
      put(d, 'tickets/BUG-938.md', ticket('BUG-938', 'bug', 'build'));
      put(d, 'tickets/TASK-939.md', ticket('TASK-939', 'task', 'build'));
    });
    for (const id of ['BUG-933', 'TASK-934', 'BUG-938', 'TASK-939']) {
      const { code, gate } = await gateJson(fx, id);
      expect(gate.blockers).toContainEqual({ kind: 'schema', id, text: LIGHT_ON_NON_PROPOSAL });
      expect(code).toBe(1);
    }
    // A bug or a task in the full lane gives no such blocker.
    for (const id of ['BUG-936', 'TASK-937']) {
      const { gate } = await gateJson(fx, id);
      expect(gate.blockers.filter((b) => b.text === LIGHT_ON_NON_PROPOSAL)).toEqual([]);
      expect(gate.ready).toBe(true);
    }
  });

  it('TKT-001/S33 A lane outside the four', async () => {
    const fx = base((d) => {
      put(d, 'tickets/PROP-935.md', ticket('PROP-935', 'proposal', 'quick'));
    });
    const findings = await lintJson(fx);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'L020', severity: 'error', file: 'tickets/PROP-935.md', fix: 'use one of: full, docs, tests, build' }));
    const { code, gate } = await gateJson(fx, 'PROP-935');
    expect(gate.blockers.filter((b) => b.kind === 'schema' && b.id === 'PROP-935')).toHaveLength(1);
    expect(code).toBe(1);
  });
});
