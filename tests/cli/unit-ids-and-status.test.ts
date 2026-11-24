// FMT-003 (the shape of a unit ID) and FMT-004 (statuses and tombstones) through the CLI, on a copy of the
// lint-case base spec.
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { LINT_BASE, tempDir } from '../helpers';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

interface Project {
  spec: string;
  cli: (...argv: string[]) => ReturnType<typeof run>;
  read: (path: string) => string;
  write: (path: string, text: string) => void;
  edit: (path: string, f: (text: string) => string) => void;
  move: (from: string, to: string) => void;
}

/** A copy of the base spec with `edit` applied. */
function project(edit?: (p: Project) => void): Project {
  const dir = tempDir('spec-units-');
  dirs.push(dir);
  cpSync(LINT_BASE, dir, { recursive: true });
  const spec = join(dir, 'spec');
  const p: Project = {
    spec,
    cli: (...argv) => run({ argv: [...argv, '--root', spec], env: {}, cwd: dir, scriptPath: undefined }),
    read: (path) => readFileSync(join(spec, path), 'utf8'),
    write: (path, text) => {
      mkdirSync(dirname(join(spec, path)), { recursive: true });
      writeFileSync(join(spec, path), text);
    },
    edit: (path, f) => { p.write(path, f(p.read(path))); },
    move: (from, to) => {
      mkdirSync(dirname(join(spec, to)), { recursive: true });
      renameSync(join(spec, from), join(spec, to));
    },
  };
  edit?.(p);
  return p;
}

interface Shown {
  id: string;
  type: string;
  file: string;
  status: string;
}
const show = async (p: Project, id: string) => JSON.parse((await p.cli('show', id, '--format', 'json')).stdout) as Shown;

const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const CONTRACTS = 'modules/alpha/contracts.md';

const feature = (id: string, module: string, extra = '', behaviour = 'None') =>
  `---\nid: ${id}\ntitle: Feature ${id}\nmodule: ${module}\nstatus: active\n${extra}---\n## Intent\nA feature.\n\n## Behaviour\n${behaviour}\n\n## Rules\nNone\n\n## Out of scope\nNone\n`;

describe('FMT-003: Recognise a unit by the shape of its ID', () => {
  it('FMT-003/S1 Features take three or four digits', async () => {
    const p = project((q) => { q.write('modules/alpha/features/ALP-1000-thousand.md', feature('ALP-1000', 'alpha')); });
    expect((await show(p, 'ALP-1000')).type).toBe('feature');
    expect((await show(p, 'ALP-001')).type).toBe('feature');
  });

  it('FMT-003/S2 Scenarios and rules are numbered inside their feature', async () => {
    const p = project();
    expect((await show(p, 'ALP-001/S1')).type).toBe('scenario');
    expect((await show(p, 'ALP-001/R1')).type).toBe('rule');
  });

  it('FMT-003/S3 Contracts and members', async () => {
    const p = project();
    expect((await show(p, 'alpha.Widget')).type).toBe('contract');
    expect((await show(p, 'alpha.Widget.size')).type).toBe('field');
  });

  it('FMT-003/S4 A member name may start with a capital or hold underscores', async () => {
    const p = project((q) => {
      q.edit(CONTRACTS, (t) => t.replace('#### alpha.Widget.size', '#### alpha.Widget.SizeCm\nThe size in cm. Type: number\n\n#### alpha.Widget.size_cm\nThe size in cm. Type: number\n\n#### alpha.Widget.size'));
    });
    expect((await show(p, 'alpha.Widget.SizeCm')).type).toBe('field');
    expect((await show(p, 'alpha.Widget.size_cm')).type).toBe('field');
  });

  it('FMT-003/S5 Invariants, decisions and screens go past 999', async () => {
    const p = project((q) => {
      q.edit('core/invariants.md', (t) => `${t.trimEnd()}\n\n### INV-1000: A thousandth invariant\nHolds.\n`);
      q.write('decisions/ADR-1000-thousand.md', q.read('decisions/ADR-001-widgets-have-sizes.md').replace('ADR-001', 'ADR-1000'));
      q.write('ui/UI-1000-thousand.md', q.read('ui/UI-001-widget-card.md').replace('UI-001', 'UI-1000'));
    });
    expect((await show(p, 'INV-1000')).type).toBe('invariant');
    expect((await show(p, 'ADR-1000')).type).toBe('decision');
    expect((await show(p, 'UI-1000')).type).toBe('screen');
  });

  it('FMT-003/S6 A module is its folder name', async () => {
    const shown = await show(project(), 'alpha');
    expect(shown.type).toBe('module');
    expect(shown.file).toBe('modules/alpha/_module.md');
  });

  it('FMT-003/S7 A reserved prefix never makes a feature', async () => {
    const out = await project().cli('show', 'PROP-001/S1');
    expect(out.stderr.startsWith('Unknown PROP-001/S1.')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('FMT-003/S8 A malformed ID is never looked up', async () => {
    const out = await project().cli('show', 'alp-001');
    expect(out.stderr.startsWith('Unknown alp-001.')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('FMT-003/S9 IDs sort by the value of their numbers', async () => {
    const step = (n: number) => `### S${n}: Scenario ${n}\nGiven no widget exists\nWhen the user acts\nThen alpha.Widget holds a widget of size 2 (R1)\n\n`;
    const p = project((q) => { q.edit(ALP, (t) => t.replace('## Rules', `${step(2)}${step(10)}## Rules`)); });
    await p.cli('build');
    const graph = JSON.parse(p.read('_generated/graph.json')) as { scenarios: { id: string }[] };
    const ids = graph.scenarios.map((s) => s.id);
    expect(ids.indexOf('ALP-001/S2')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('ALP-001/S2')).toBeLessThan(ids.indexOf('ALP-001/S10'));
  });

  it('FMT-003/S10 A feature keeps its ID when it moves', async () => {
    const to = 'modules/alpha/features/BET-001-order-a-widget.md';
    const p = project((q) => {
      q.move(BET, to);
      q.edit(to, (t) => t.replace('module: beta', 'module: alpha'));
    });
    const shown = await show(p, 'BET-001');
    expect(shown.type).toBe('feature');
    expect(shown.file).toBe(to);
    const lint = JSON.parse((await p.cli('lint', '--format', 'json')).stdout) as { findings: { file: string }[] };
    expect(lint.findings.filter((f) => f.file === to)).toEqual([]);
  });
});

describe('FMT-004: Give every unit a status and keep removed IDs', () => {
  const deprecate = (q: Project) => { q.edit(BET, (t) => t.replace('status: active', 'status: deprecated')); };

  it('FMT-004/S1 A feature\'s status is its frontmatter status', async () => {
    expect((await show(project(deprecate), 'BET-001')).status).toBe('deprecated');
  });

  it('FMT-004/S2 Scenarios and rules take their feature\'s status', async () => {
    expect((await show(project(deprecate), 'BET-001/S1')).status).toBe('deprecated');
  });

  it('FMT-004/S3 A member takes its contract\'s status unless it has its own', async () => {
    const p = project((q) => {
      q.edit(CONTRACTS, (t) => t.replace('The widget\'s size. Type: number', 'Status: deprecated · Superseded by: alpha.Widget.name\nThe widget\'s size. Type: number'));
    });
    expect((await show(p, 'alpha.Widget.size')).status).toBe('deprecated');
    expect((await show(p, 'alpha.Widget.name')).status).toBe('active');
  });

  it('FMT-004/S4 An invariant without a status line is active', async () => {
    const p = project((q) => {
      q.edit('core/invariants.md', (t) => `${t.trimEnd()}\n\n### INV-002: A retired rule\nStatus: removed\nNo longer holds.\n`);
    });
    expect((await show(p, 'INV-001')).status).toBe('active');
    expect((await show(p, 'INV-002')).status).toBe('removed');
  });

  it('FMT-004/S5 A removed feature is a tombstone', async () => {
    const p = project((q) => {
      q.write(BET, feature('BET-001', 'beta', 'retired: [S1]\n').replace('status: active', 'status: removed'));
    });
    await p.cli('build');
    const graph = JSON.parse(p.read('_generated/graph.json')) as { scenarios: { feature: string }[] };
    expect(graph.scenarios.filter((s) => s.feature === 'BET-001')).toEqual([]);
    expect((await show(p, 'BET-001')).status).toBe('removed');
    const lint = JSON.parse((await p.cli('lint', '--format', 'json')).stdout) as { findings: { file: string }[] };
    expect(lint.findings.filter((f) => f.file === BET)).toEqual([]);
  });

  it('FMT-004/S9 A tombstone points at its replacement', async () => {
    const p = project((q) => {
      q.edit('core/invariants.md', (t) => `${t.trimEnd()}\n\n### INV-002: An old rule\nStatus: removed · Superseded by: INV-003\nReplaced.\n\n### INV-003: A new rule\nHolds.\n`);
    });
    await p.cli('build');
    const graph = JSON.parse(p.read('_generated/graph.json')) as { edges: { from: string; to: string; kind: string }[] };
    expect(graph.edges).toContainEqual({ from: 'INV-002', to: 'INV-003', kind: 'superseded_by' });
  });
});
