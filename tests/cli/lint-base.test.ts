// LNT-018: lint --base and --ci report IDs a branch reuses or drops against its base (L035).
// Each scenario starts from the base spec of LNT-001, committed on "main" in a git repository, with the
// branch "ticket/TASK-001" made from it and checked out.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { LINT_BASE, gitFixture, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const dirs: string[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

interface Finding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  id: string | null;
  message: string;
  fix: string;
}

const ALP = 'modules/alpha/features/ALP-001-make-a-widget.md';
const CONTRACTS = 'modules/alpha/contracts.md';

const read = (dir: string, path: string) => readFileSync(join(dir, 'spec', path), 'utf8');
/** Edit one spec file of a checkout. */
const patch = (dir: string, path: string, f: (text: string) => string) => {
  writeFileSync(join(dir, 'spec', path), f(read(dir, path)));
};
/** Replace `from` by `to` in a spec file; the text must be there. */
const replace = (dir: string, path: string, from: string, to: string) => {
  patch(dir, path, (t) => {
    if (!t.includes(from)) throw new Error(`${path} has no ${JSON.stringify(from)}`);
    return t.replace(from, to);
  });
};

const scenario = (n: number, title: string, when = 'the user sells a widget') =>
  `### S${n}: ${title}\nGiven no widget exists\nWhen ${when}\nThen alpha.Widget holds a widget of size 2 (R1)\n\n`;
/** Add scenarios ahead of "## Rules" in ALP-001. */
const addScenarios = (dir: string, ...scenarios: string[]) => { replace(dir, ALP, '## Rules', `${scenarios.join('')}## Rules`); };
/** Add R2 to ALP-001 and have S1 show it, so no other finding comes with it. */
const sellS2 = (d: string) => { addScenarios(d, scenario(2, 'Widget sold')); };
const paintS2 = (d: string) => { addScenarios(d, scenario(2, 'Widget painted', 'the user paints a widget')); };
const addRule = (dir: string, text: string) => {
  replace(dir, ALP, '\n## Out of scope', `${text}\n\n## Out of scope`);
  replace(dir, ALP, 'size 2 (R1)', 'size 2 (R1, R2)');
};
const addGizmo = (dir: string, text: string) => {
  patch(dir, CONTRACTS, (t) => `${t.trimEnd()}\n\n### alpha.Gizmo\nKind: entity · Status: active\n${text}\n`);
};

/**
 * The base spec on "main" with "ticket/TASK-001" made from it. `mainEdit` is committed on main after the
 * branch was made (so the two parted); `branchEdit` is applied to the branch's working tree, uncommitted.
 */
function scene(mainEdit: (dir: string) => void, branchEdit: (dir: string) => void): Fx {
  const fx = gitFixture('spec-lint-base', { fixture: LINT_BASE });
  made.push(fx);
  fx.git('checkout', '-q', '-b', 'ticket/TASK-001');
  fx.git('checkout', '-q', 'main');
  mainEdit(fx.repo);
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'main moves on');
  fx.git('checkout', '-q', 'ticket/TASK-001');
  branchEdit(fx.repo);
  return fx;
}

const lintJson = async (fx: Fx, ...flags: string[]) => {
  const out = await fx.spec('', 'lint', ...flags, '--format', 'json');
  return { code: out.code, stdout: out.stdout, stderr: out.stderr, findings: (JSON.parse(out.stdout || '{"findings":[]}') as { findings: Finding[] }).findings };
};
const l035 = (findings: Finding[]) => findings.filter((f) => f.rule === 'L035');
/** The 1-based line of the first line in `file` that starts with `heading`. */
const lineOf = (dir: string, file: string, heading: string) => read(dir, file).split('\n').findIndex((l) => l.startsWith(heading)) + 1;

describe('LNT-018: Report IDs a branch reuses against its base (L035)', () => {
  it('LNT-018/S1 A scenario number both sides added with different titles', async () => {
    const fx = scene(sellS2, paintS2);
    const out = await lintJson(fx, '--base', 'main');
    const line = lineOf(fx.repo, ALP, '### S2');
    expect(out.findings).toEqual([
      {
        rule: 'L035',
        severity: 'error',
        file: ALP,
        line,
        id: 'ALP-001/S2',
        message: "ALP-001/S2 is 'Widget painted' here and 'Widget sold' on main, and each side added it after they parted",
        fix: 'IDs are never reused: give this one an ID that main does not have',
      },
    ]);
    expect(out.code).toBe(1);
    const ci = await lintJson(fx, '--ci');
    expect(l035(ci.findings)).toEqual(out.findings);
  });

  it('LNT-018/S2 A rule number both sides added with different text', async () => {
    const fx = scene((d) => { addRule(d, '- R2: Every widget has a name'); }, (d) => { addRule(d, '- R2: A widget is red'); });
    const out = await lintJson(fx, '--base', 'main');
    const line = lineOf(fx.repo, ALP, '- R2:');
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0]).toMatchObject({
      rule: 'L035',
      severity: 'error',
      file: ALP,
      line,
      id: 'ALP-001/R2',
      message: "ALP-001/R2 is 'A widget is red' here and 'Every widget has a name' on main, and each side added it after they parted",
    });

    const gizmo = scene((d) => { addGizmo(d, 'A gizmo from main.'); }, (d) => { addGizmo(d, 'A gizmo from the branch.'); });
    const g = await lintJson(gizmo, '--base', 'main');
    const found = l035(g.findings).filter((f) => f.id === 'alpha.Gizmo');
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe('alpha.Gizmo is defined differently here and on main, and each side added it after they parted');
  });

  it('LNT-018/S2 A feature both sides added with the same title and intent but different links', async () => {
    const ALP2 = 'modules/alpha/features/ALP-002-sell-a-widget.md';
    const addFeature = (writes: string) => (d: string) => {
      writeFileSync(
        join(d, 'spec', ALP2),
        `---\nid: ALP-002\ntitle: Sell a widget\nmodule: alpha\nstatus: active\nwrites: [${writes}]\n---\n## Intent\nSell a widget.\n\n## Behaviour\nNone\n\n## Rules\nNone\n\n## Out of scope\nNone\n`,
      );
    };
    const fx = scene(addFeature('alpha.Widget'), addFeature('alpha.WidgetMade'));
    const out = await lintJson(fx, '--base', 'main');
    const found = l035(out.findings).filter((f) => f.id === 'ALP-002');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      severity: 'error',
      file: ALP2,
      message: 'ALP-002 is defined differently here and on main, and each side added it after they parted',
    });
  });

  it('LNT-018/S3 A renamed scenario is not a reused one', async () => {
    const fx = scene(
      (d) => {
        replace(d, ALP, '### S1: Widget made', '### S1: Widget built');
        addScenarios(d, scenario(2, 'Widget sold'), scenario(3, 'Widget painted', 'the user paints a widget'));
      },
      (d) => {
        replace(d, ALP, '### S1: Widget made', '### S1: A widget is made');
        replace(d, ALP, 'When the user makes a widget of size 2', 'When the user makes a widget of size 3 on request');
        addScenarios(d, scenario(3, 'Widget painted', 'the user paints a widget'));
      },
    );
    const out = await lintJson(fx, '--base', 'main');
    expect(l035(out.findings)).toEqual([]);
    expect(out.stderr).toBe('');
  });

  it('LNT-018/S4 A scenario dropped without retiring its number', async () => {
    const dropS1 = (d: string) => {
      patch(d, ALP, (t) => t.replace(/### S1: Widget made\n[\s\S]*?\n\n(?=## Rules)/, ''));
    };
    const fx = scene(() => undefined, dropS1);
    expect(read(fx.repo, ALP)).not.toContain('### S1');
    const out = await lintJson(fx, '--base', 'main');
    const dropped = l035(out.findings);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatchObject({
      severity: 'error',
      file: ALP,
      line: 1,
      id: 'ALP-001/S1',
      message: 'ALP-001/S1 is on main but not here; add S1 to retired in ALP-001, so its number is never reused',
    });
    expect(out.code).toBe(1);

    const retired = scene(() => undefined, (d) => {
      dropS1(d);
      replace(d, ALP, 'module: alpha\n', 'module: alpha\nretired: [S1]\n');
    });
    expect(l035((await lintJson(retired, '--base', 'main')).findings)).toEqual([]);

    const event = scene(() => undefined, (d) => {
      replace(d, ALP, 'And alpha.WidgetMade is emitted\n', '');
      patch(d, CONTRACTS, (t) => t.replace(/### alpha\.WidgetMade\n[\s\S]*$/, ''));
    });
    const e = await lintJson(event, '--base', 'main');
    const gone = l035(e.findings).filter((f) => f.id === 'alpha.WidgetMade');
    expect(gone).toHaveLength(1);
    expect(gone[0]).toMatchObject({
      file: CONTRACTS,
      line: 1,
      message: 'alpha.WidgetMade is on main but not here; keep it as a tombstone with status: removed',
    });
  });

  it('LNT-018/S5 Nothing to compare with', async () => {
    const dir = tempDir('spec-lint-nogit-');
    dirs.push(dir);
    cpSync(LINT_BASE, dir, { recursive: true });
    const outside = await run({ argv: ['lint', '--ci', '--format', 'json', '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined });
    const parsed = JSON.parse(outside.stdout) as { findings: Finding[] };
    expect(l035(parsed.findings)).toEqual([]);

    const fx = scene(sellS2, paintS2);
    const plain = await lintJson(fx);
    expect(l035(plain.findings)).toEqual([]);
  });

  it('LNT-018/S6 A base that cannot be read is refused', async () => {
    const fx = scene(() => undefined, () => undefined);
    const out = await fx.spec('', 'lint', '--base', 'nope');
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr.startsWith('--base nope is not a commit in this repository')).toBe(true);
  });
});
