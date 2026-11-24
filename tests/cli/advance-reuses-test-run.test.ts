// PIP-008/R12: `spec ticket advance` reuses a kept test run only when the spec root, ticket, role,
// test command and git tree all match, and never a failed implementer run. Each fixture's test
// command counts its invocations in a file outside the repository, so a test sees whether advance
// ran the tests again. It fails when src/app.ts holds BROKEN or the file `fail` exists, and writes
// no report when the file `noreport` exists.
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE, gitFixture, report, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;

const scratches: string[] = [];
const cleanups: (() => void)[] = [];
afterAll(() => {
  for (const c of cleanups) c();
  for (const s of scratches) rmSync(s, { recursive: true, force: true });
});

const SCRIPT = [
  'dir=$1; out=$2',
  'echo x >> "$dir/count"',
  '[ -f "$dir/noreport" ] && exit 0',
  'if grep -q BROKEN src/app.ts || [ -f "$dir/fail" ]; then',
  '  echo \'{"testResults":[{"assertionResults":[{"title":"PRV-001/S1 Streams tokens","status":"failed"}]}]}\' > "$out"',
  '  exit 1',
  'fi',
  'echo \'{"testResults":[{"assertionResults":[{"title":"PRV-001/S1 Streams tokens","status":"passed"}]}]}\' > "$out"',
  'exit 0',
  '',
].join('\n');

const REUSED = 'tests: reused the test run made at 2026-10-27T12:00:00.000Z on this tree';
const msg = (role: string) => report(`role: ${role}\nticket: TASK-101\nresult: done\nsummary: Moved it`);

const cli = (proj: string) => (stdin: string, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(proj, 'spec')], env: {}, cwd: proj, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => '2026-10-27T12:00:00.000Z' });

interface Case {
  scratch: string;
  fx: Fx;
  /** The project (spec root's parent); `other` is a second project in the same repository, in the 'two' layout. */
  proj: string;
  other: string;
  kept: string;
  runs(): number;
  checks(): number;
  checkReport(role?: string, proj?: string): Promise<void>;
  advance(proj?: string): Promise<{ stdout: string; stderr: string; code: number }>;
  flag(name: string, on: boolean): void;
}

/** TASK-101 in its implementer stage (in both projects of the 'two' layout), in a repo whose test command and check command count their runs. */
async function stage(prefix: string, layout: 'plain' | 'two' = 'plain'): Promise<Case> {
  const scratch = tempDir(`${prefix}-`);
  scratches.push(scratch);
  const script = join(scratch, 'runner.sh');
  writeFileSync(script, SCRIPT);
  let fixture: string | undefined;
  if (layout === 'two') {
    fixture = join(scratch, 'layout');
    for (const p of ['packages/app', 'packages/other']) {
      mkdirSync(join(fixture, p), { recursive: true });
      cpSync(FIXTURE, join(fixture, p), { recursive: true, filter: (src) => !/\/node_modules(\/|$)/.test(src) });
    }
  }
  const projects = layout === 'two' ? ['packages/app', 'packages/other'] : [''];
  const fx = gitFixture(prefix, {
    ...(fixture === undefined ? {} : { fixture }),
    setup: (dir) => {
      for (const p of projects) {
        const config = join(dir, p, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
        cfg.testCommand = `sh '${script}' '${scratch}' "{report}"`;
        cfg.checkCommands = [`echo x >> '${join(scratch, 'checks')}'`];
        writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      }
    },
  });
  cleanups.push(fx.cleanup);
  const proj = layout === 'two' ? join(fx.repo, 'packages/app') : fx.repo;
  const other = join(fx.repo, 'packages/other');
  for (const p of layout === 'two' ? [proj, other] : [proj]) {
    const started = await cli(p)('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(started.code, started.stderr).toBe(0);
    // A second start refuses uncommitted changes anywhere in the repository.
    if (layout === 'two') {
      fx.git('add', '-A');
      fx.git('commit', '-q', '-m', `started in ${p}`);
    }
  }
  const lines = (file: string) => (existsSync(join(scratch, file)) ? readFileSync(join(scratch, file), 'utf8').split('\n').filter(Boolean).length : 0);
  return {
    scratch,
    fx,
    proj,
    other,
    kept: join(fx.repo, '.git/spec/test-runs/TASK-101.json'),
    runs: () => lines('count'),
    checks: () => lines('checks'),
    async checkReport(role = 'implementer', at = proj) {
      await cli(at)(msg(role), 'check-report', role, 'TASK-101', '--format', 'json');
    },
    advance: (at = proj) => cli(at)(msg('implementer'), 'ticket', 'advance', 'TASK-101'),
    flag(name, on) {
      if (on) writeFileSync(join(scratch, name), '');
      else rmSync(join(scratch, name), { force: true });
    },
  };
}

describe('PIP-008 advance and the test run a check kept', () => {
  it('PIP-008/S25 Advance reuses the test run check-report made on the same tree', async () => {
    const c = await stage('spec-reuse-same');
    await c.checkReport();
    expect(c.runs()).toBe(1);
    expect(existsSync(c.kept), 'check-report keeps its run in spec/test-runs/TASK-101.json in the common git directory').toBe(true);

    const out = await c.advance();
    expect(c.runs(), 'advance ran the test command again').toBe(1);
    expect(out.stderr.split('\n')[0]).toBe(REUSED);
    expect(out.code).toBe(0);
    expect(c.checks(), 'each check command still runs, in check-report and in advance').toBe(2);

    // stdout is what it would be had the tests run.
    const plain = await stage('spec-reuse-plain');
    const base = await plain.advance();
    expect(plain.runs()).toBe(1);
    expect(out.stdout).toBe(base.stdout);
  }, 180_000);

  const differences: { name: string; role?: string; before?: (c: Case) => void; change: (c: Case) => void }[] = [
    {
      name: 'a tracked file changed',
      change: (c) => {
        appendFileSync(join(c.proj, 'src/app.ts'), '\n// changed\n');
      },
    },
    {
      name: 'a tracked file changed and staged',
      change: (c) => {
        appendFileSync(join(c.proj, 'src/app.ts'), '\n// staged\n');
        c.fx.git('add', 'src/app.ts');
      },
    },
    {
      name: 'a tracked file deleted',
      change: (c) => {
        rmSync(join(c.proj, 'tsconfig.json'));
      },
    },
    {
      name: 'an untracked file added',
      change: (c) => {
        writeFileSync(join(c.proj, 'notes.txt'), 'new\n');
      },
    },
    {
      name: 'an untracked file changed',
      before: (c) => {
        writeFileSync(join(c.proj, 'notes.txt'), 'one\n');
      },
      change: (c) => {
        writeFileSync(join(c.proj, 'notes.txt'), 'two\n');
      },
    },
    {
      name: 'an untracked file removed',
      before: (c) => {
        writeFileSync(join(c.proj, 'notes.txt'), 'one\n');
      },
      change: (c) => {
        rmSync(join(c.proj, 'notes.txt'));
      },
    },
    {
      name: 'the test command changed',
      change: (c) => {
        const config = join(c.proj, 'spec/config.json');
        const cfg = JSON.parse(readFileSync(config, 'utf8')) as { testCommand: string };
        cfg.testCommand += ' # changed';
        writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      },
    },
    { name: 'the kept run is for another role', role: 'tester', change: () => undefined },
    {
      name: 'the kept file cannot be read',
      change: (c) => {
        writeFileSync(c.kept, 'not json {');
      },
    },
  ];

  it('PIP-008/S26 Anything that differs runs the tests again', async () => {
    for (const d of differences) {
      const c = await stage('spec-reuse-diff');
      d.before?.(c);
      await c.checkReport(d.role);
      expect(c.runs(), `${d.name}: check-report ran the tests`).toBe(1);
      expect(existsSync(c.kept), `${d.name}: check-report keeps its run`).toBe(true);
      d.change(c);
      const out = await c.advance();
      expect(c.runs(), `${d.name}: advance runs the test command again`).toBe(2);
      expect(out.stderr, `${d.name}: no reuse`).not.toMatch(/^tests: reused/m);
    }
  }, 540_000);

  it('PIP-008/S26 A project in a subfolder whose dirty tracked file starts failing is tested again', async () => {
    const c = await stage('spec-reuse-sub', 'two');
    appendFileSync(join(c.proj, 'src/app.ts'), '\n// dirty already\n');
    await c.checkReport();
    expect(c.runs()).toBe(1);
    expect(existsSync(c.kept), 'check-report keeps its passing run').toBe(true);
    appendFileSync(join(c.proj, 'src/app.ts'), '\n// BROKEN\n');
    const out = await c.advance();
    expect(c.runs(), 'advance ran no tests on a changed file').toBe(2);
    expect(out.stderr).not.toMatch(/^tests: reused/m);
  }, 180_000);

  it('PIP-008/S26 A later check that gives no results leaves nothing to reuse', async () => {
    const c = await stage('spec-reuse-noresults');
    await c.checkReport();
    expect(c.runs()).toBe(1);
    expect(existsSync(c.kept)).toBe(true);
    c.flag('noreport', true);
    await c.checkReport();
    expect(c.runs()).toBe(2);
    c.flag('noreport', false);
    const out = await c.advance();
    expect(c.runs(), 'advance reused the earlier pass').toBe(3);
    expect(out.stderr).not.toMatch(/^tests: reused/m);
  }, 180_000);

  it('PIP-008/S26 A later check that fails leaves nothing to reuse', async () => {
    const c = await stage('spec-reuse-fail');
    await c.checkReport();
    expect(c.runs()).toBe(1);
    c.flag('fail', true);
    await c.checkReport();
    expect(c.runs(), 'the later check ran the tests').toBe(2);
    c.flag('fail', false);
    const out = await c.advance();
    expect(c.runs(), 'advance reused the earlier pass').toBe(3);
    expect(out.stderr).not.toMatch(/^tests: reused/m);
  }, 180_000);

  it('PIP-008/S26 A run kept for another spec root with its own TASK-101 is not reused', async () => {
    const c = await stage('spec-reuse-root', 'two');
    await c.checkReport('implementer', c.proj);
    expect(c.runs()).toBe(1);
    expect(existsSync(c.kept)).toBe(true);
    const out = await c.advance(c.other);
    expect(c.runs(), 'advance reused the other root\'s run').toBe(2);
    expect(out.stderr).not.toMatch(/^tests: reused/m);
  }, 180_000);

  it('PIP-008/S26 A failed implementer run is not reused', async () => {
    const c = await stage('spec-reuse-failed');
    c.flag('fail', true);
    await c.checkReport();
    expect(c.runs()).toBe(1);
    expect(existsSync(c.kept), 'check-report keeps its failed run').toBe(true);
    c.flag('fail', false);
    const out = await c.advance();
    expect(c.runs(), 'advance reused a failed run').toBe(2);
    expect(out.stderr).not.toMatch(/^tests: reused/m);
  }, 180_000);
});
