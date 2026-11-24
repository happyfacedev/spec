// A stage that blocked stashed its work; the next start of that stage on that ticket gets it back (PIP-002/R4).
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, tempDir } from '../helpers';

const entry = (role: string, result: string) => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: ${result}, summary: x, verdict: null, assumed: [] }`;

function ticketText(id: string, type: string, history: string[]): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    'title: Extract provider selection into its own module',
    'status: open',
    'stage: null',
    'touches: [PRV-001, PRV-002]',
    // A bug must name the scenario it violates, or the gate refuses it before any stash is applied.
    type === 'bug' ? 'violates: [PRV-002/S3]' : 'violates: []',
    'changed: []',
    'questions:',
    '  - id: Q1',
    '    kind: blocker',
    '    text: Which module name?',
    '    default: null',
    '    cites: []',
    '    answer: select',
    '    raised_by: implementer',
    'history:',
    ...history,
    '---',
    'Move the selection code.',
    '',
  ].join('\n');
}

/** A fixture whose tickets are committed on main, then one stash per name made from a dirty tree. */
function stashed(prefix: string, tickets: Record<string, string>, stashes: { name: string; edit: string; extra?: string }[], more?: (dir: string) => void) {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      for (const [id, text] of Object.entries(tickets)) writeFileSync(join(dir, 'tickets', `${id}.md`), text);
      more?.(dir);
    },
  });
  for (const s of stashes) {
    writeFileSync(join(fx.repo, s.edit), `${readFileSync(join(fx.repo, s.edit), 'utf8')}// ${s.name}\n`);
    if (s.extra) writeFileSync(join(fx.repo, s.extra), `export const extra = '${s.name}';\n`);
    expect(fx.git('stash', 'push', '-u', '-m', s.name).code).toBe(0);
  }
  expect(fx.git('status', '--porcelain').stdout).toBe('');
  return fx;
}

const lines = (s: string) => s.split('\n').filter((l) => l !== '');

describe('PIP-002/S18 A stage that blocked gets its work back', () => {
  const fx = stashed('spec-stash-restore', { 'TASK-101': ticketText('TASK-101', 'task', [entry('implementer', 'blocked')]) }, [
    { name: 'TASK-101 implementer: blocked', edit: 'src/app.ts', extra: 'src/extra.ts' },
  ]);
  afterAll(() => {
    fx.cleanup();
  });

  it('PIP-002/S18 A stage that blocked gets its work back', async () => {
    expect(fx.git('stash', 'list').stdout).toContain('TASK-101 implementer: blocked');
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
    const status = lines(fx.git('status', '--porcelain').stdout);
    expect(status).toContain(' M src/app.ts');
    expect(status).toContain('?? src/extra.ts');
    expect(readFileSync(join(fx.repo, 'src/app.ts'), 'utf8')).toContain('// TASK-101 implementer: blocked');
    expect(readFileSync(join(fx.repo, 'src/extra.ts'), 'utf8')).toBe("export const extra = 'TASK-101 implementer: blocked';\n");
    expect(fx.git('stash', 'list').stdout).not.toContain('TASK-101 implementer: blocked');
  });
});

describe('PIP-002/S18 the generated command runs once after the restore', () => {
  const scratch = realpathSync(tempDir('spec-stash-gen-'));
  const log = join(scratch, 'log');
  const script = join(scratch, 'build.sh');
  writeFileSync(script, [`echo run >> '${log}'`, 'mkdir -p src/generated', "printf 'built\\n' > src/generated/out.ts", ''].join('\n'));
  const fx = stashed(
    'spec-stash-restore-gen',
    { 'TASK-101': ticketText('TASK-101', 'task', [entry('implementer', 'blocked')]) },
    [{ name: 'TASK-101 implementer: blocked', edit: 'src/app.ts', extra: 'src/extra.ts' }],
    (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.generated = { globs: ['src/generated/**'], command: `sh '${script}'` };
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      mkdirSync(join(dir, 'src/generated'), { recursive: true });
      writeFileSync(join(dir, 'src/generated/out.ts'), 'old\n');
    },
  );
  afterAll(() => {
    fx.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  });

  it('PIP-002/S18 the generated command runs once after the stash is applied, and what it wrote is uncommitted with the work', async () => {
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []).toEqual(['run']);
    const status = lines(fx.git('status', '--porcelain').stdout);
    expect(status).toContain(' M src/app.ts');
    expect(status).toContain('?? src/extra.ts');
    expect(status).toContain(' M src/generated/out.ts');
    expect(readFileSync(join(fx.repo, 'src/generated/out.ts'), 'utf8')).toBe('built\n');
    expect(fx.git('stash', 'list').stdout).not.toContain('TASK-101 implementer: blocked');
  }, 60_000);
});

describe('PIP-002/S19 Only the same stage on the same ticket restores', () => {
  const history = [entry('tester', 'done'), entry('implementer', 'blocked'), entry('tester', 'reopened')];
  const fx = stashed('spec-stash-other', { 'BUG-301': ticketText('BUG-301', 'bug', history) }, [
    { name: 'BUG-301 implementer: blocked', edit: 'src/app.ts' },
    { name: 'BUG-302 implementer: blocked', edit: 'src/state.ts' },
  ]);
  afterAll(() => {
    fx.cleanup();
  });

  it('PIP-002/S19 Only the same stage on the same ticket restores', async () => {
    const tester = await fx.spec('', 'ticket', 'start', 'BUG-301', 'tester');
    expect(tester.code, tester.stderr).toBe(0);
    expect(lines(fx.git('status', '--porcelain').stdout).filter((l) => !l.includes('tickets/'))).toEqual([]);
    const both = fx.git('stash', 'list').stdout;
    expect(both).toContain('BUG-301 implementer: blocked');
    expect(both).toContain('BUG-302 implementer: blocked');

    // The tester stage is over; the pipeline goes on to the implementer.
    writeFileSync(join(fx.repo, 'tickets/BUG-301.md'), ticketText('BUG-301', 'bug', [...history, entry('tester', 'done')]));
    const implementer = await fx.spec('', 'ticket', 'start', 'BUG-301', 'implementer');
    expect(implementer.code, implementer.stderr).toBe(0);
    expect(lines(fx.git('status', '--porcelain').stdout)).toContain(' M src/app.ts');
    expect(readFileSync(join(fx.repo, 'src/state.ts'), 'utf8')).not.toContain('BUG-302');
    const rest = fx.git('stash', 'list').stdout;
    expect(rest).not.toContain('BUG-301 implementer: blocked');
    expect(rest).toContain('BUG-302 implementer: blocked');
  });
});

describe('PIP-002/S21 Uncommitted work on the ticket\'s own branch', () => {
  const fx = stashed('spec-start-dirty', { 'TASK-101': ticketText('TASK-101', 'task', [entry('implementer', 'blocked')]) }, []);
  afterAll(() => {
    fx.cleanup();
  });

  it('PIP-002/S21 Uncommitted work on the ticket\'s own branch', async () => {
    // The ticket's branch is already checked out, so no switch would catch the dirt (A3).
    expect(fx.git('checkout', '-q', '-b', 'ticket/TASK-101').code).toBe(0);
    writeFileSync(join(fx.repo, 'src/scratch.ts'), 'export {};\n');
    const before = readFileSync(join(fx.repo, 'tickets/TASK-101.md'), 'utf8');
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('cannot start the implementer stage of TASK-101: uncommitted changes in src/scratch.ts; commit or remove them first\n');
    expect(readFileSync(join(fx.repo, 'tickets/TASK-101.md'), 'utf8')).toBe(before);
    expect(lines(fx.git('status', '--porcelain').stdout)).toEqual(['?? src/scratch.ts']);
  });
});

describe('PIP-002/S22 A stash that does not apply blocks the ticket', () => {
  const history = [entry('implementer', 'blocked')];
  const fx = stashed('spec-stash-conflict', { 'TASK-101': ticketText('TASK-101', 'task', history) }, []);
  afterAll(() => {
    fx.cleanup();
  });

  it('PIP-002/S22 A stash that does not apply blocks the ticket', async () => {
    // The stash and the branch change the same line, so the stash cannot apply (A4).
    expect(fx.git('checkout', '-q', '-b', 'ticket/TASK-101').code).toBe(0);
    const app = join(fx.repo, 'src/app.ts');
    const original = readFileSync(app, 'utf8');
    writeFileSync(app, `${original}export const mode = 'stash';\n`);
    writeFileSync(join(fx.repo, 'src/extra.ts'), 'export const extra = 1;\n');
    expect(fx.git('stash', 'push', '-u', '-m', 'TASK-101 implementer: blocked').code).toBe(0);
    writeFileSync(app, `${original}export const mode = 'branch';\n`);
    expect(fx.git('commit', '-q', '-am', 'branch moves on').code).toBe(0);
    expect(fx.git('checkout', '-q', 'main').code).toBe(0);

    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    const start = 'git stash "TASK-101 implementer: blocked" does not apply to ticket/TASK-101: it conflicts in src/app.ts. It also holds new files that only git stash show --include-untracked lists: src/extra.ts.';
    expect(out.stderr.startsWith(start)).toBe(true);
    const list = fx.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(': TASK-101 implementer: blocked'));
    expect(list).toBeDefined();
    const stash = (list ?? '').split(' ')[0] ?? '';
    expect(fx.git('diff', '--name-only', `${stash}^1`, stash).stdout.trim().split('\n')).toContain('src/app.ts');
    expect(fx.git('ls-tree', '-r', '--name-only', `${stash}^3`).stdout.trim().split('\n')).toEqual(['src/extra.ts']);
    expect(existsSync(join(fx.repo, 'src/extra.ts'))).toBe(false);
    expect(lines(fx.git('status', '--porcelain', '--untracked-files=all').stdout).filter((l) => !l.includes('tickets/'))).toEqual([]);
    expect(readFileSync(app, 'utf8')).toBe(`${original}export const mode = 'branch';\n`);
    const t = fx.ticket('TASK-101');
    expect(t).toMatchObject({ status: 'blocked', stage: null });
    expect(t?.history).toHaveLength(history.length);
    expect(t?.questions.at(-1)).toMatchObject({ id: 'Q2', kind: 'blocker', raised_by: 'implementer', answer: null });
    expect(t?.questions.at(-1)?.text.startsWith(start)).toBe(true);
  });

  it('PIP-002/S22 a stash with no new files gives the question and stderr no "It also holds" sentence', async () => {
    const g = stashed('spec-stash-conflict-plain', { 'TASK-101': ticketText('TASK-101', 'task', history) }, []);
    try {
      expect(g.git('checkout', '-q', '-b', 'ticket/TASK-101').code).toBe(0);
      const app = join(g.repo, 'src/app.ts');
      const original = readFileSync(app, 'utf8');
      writeFileSync(app, `${original}export const mode = 'stash';\n`);
      expect(g.git('stash', 'push', '-u', '-m', 'TASK-101 implementer: blocked').code).toBe(0);
      writeFileSync(app, `${original}export const mode = 'branch';\n`);
      expect(g.git('commit', '-q', '-am', 'branch moves on').code).toBe(0);
      expect(g.git('checkout', '-q', 'main').code).toBe(0);

      const out = await g.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
      expect(out.code).toBe(1);
      expect(out.stderr.startsWith('git stash "TASK-101 implementer: blocked" does not apply to ticket/TASK-101: it conflicts in src/app.ts')).toBe(true);
      expect(out.stderr).not.toContain('It also holds');
      expect(g.ticket('TASK-101')?.questions.at(-1)?.text).not.toContain('It also holds');
    } finally {
      g.cleanup();
    }
  });
});

describe('PIP-002/S20 Nothing was stashed', () => {
  const fx = stashed('spec-stash-none', {}, []);
  afterAll(() => {
    fx.cleanup();
  });

  it('PIP-002/S20 Nothing was stashed', async () => {
    expect(fx.git('stash', 'list').stdout).not.toContain('TASK-101 implementer: blocked');
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(lines(fx.git('status', '--porcelain').stdout).filter((l) => !l.includes('tickets/'))).toEqual([]);
  });
});
