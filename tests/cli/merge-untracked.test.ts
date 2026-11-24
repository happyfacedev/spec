// WSP-007/R4 (PROP-114): an untracked file blocks `spec merge` only where the merge would write a file.
// Throwaway git copies of chat-mini on main; the project's test command is a script outside the repo that
// writes a vitest-style report. The two races (S26, S27) are made by wrapping the child-process module the
// way advance-check-could-not-run.test.ts does: when merge starts `git merge --no-commit`, a file appears
// in the main checkout just before it (S26) or just after it, before the rebuild (S27).
import type * as ChildProcess from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { git } from '../../src/io/git';
import { gitFixture, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const scratch = realpathSync(tempDir('spec-untracked-'));
afterAll(() => {
  for (const fx of made) {
    git(fx.repo, ['worktree', 'prune']);
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    fx.cleanup();
  }
  rmSync(scratch, { recursive: true, force: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const ID = 'TASK-101';
const TITLE = 'CNV-003/S1 Copy a message';
let counter = 0;
const folder = (): string => {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  return dir;
};

/** A test command that runs `lines` in the project root, then writes a report and exits with the status. */
function testCommand(lines: string[] = [], status: 'passed' | 'failed' = 'passed'): string {
  const script = join(folder(), 'tests.sh');
  writeFileSync(
    script,
    [...lines, `printf '{"testResults":[{"assertionResults":[{"title":"%s","status":"%s"}]}]}' '${TITLE}' '${status}' > "$1"`, status === 'passed' ? 'exit 0' : 'exit 1', ''].join('\n'),
  );
  return `sh '${script}' "{report}"`;
}

/** A project command that logs each run, outside the repository. */
function logged(lines: string[] = []): { command: string; runs: () => number } {
  const dir = folder();
  const log = join(dir, 'log');
  const script = join(dir, 'run.sh');
  writeFileSync(script, [`echo run >> '${log}'`, ...lines, ''].join('\n'));
  return { command: `sh '${script}'`, runs: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0) };
}

interface Opts {
  tests?: string;
  afterMerge?: string;
  generated?: { globs: string[]; command?: string };
  setup?: (dir: string) => void;
}
function project(opts: Opts = {}): Fx {
  const fx = gitFixture('spec-untracked', {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = opts.tests ?? testCommand();
      if (opts.afterMerge !== undefined) cfg.afterMerge = opts.afterMerge;
      if (opts.generated !== undefined) cfg.generated = opts.generated;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      opts.setup?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

const read = (fx: Fx, path: string) => readFileSync(join(fx.repo, path), 'utf8');
const write = (fx: Fx, path: string, text: string) => {
  mkdirSync(join(fx.repo, path, '..'), { recursive: true });
  writeFileSync(join(fx.repo, path), text);
};
const head = (fx: Fx) => fx.git('rev-parse', 'HEAD').stdout.trim();
const short = (fx: Fx) => fx.git('rev-parse', '--short', 'HEAD').stdout.trim();
/** Every uncommitted path, untracked files one by one, ignored ones left out. */
const status = (fx: Fx) => fx.git('status', '--porcelain', '--untracked-files=all').stdout;
const mergeInProgress = (fx: Fx) => fx.git('rev-parse', '--verify', '-q', 'MERGE_HEAD').code === 0;
const tracked = (fx: Fx, rev = 'HEAD') => fx.git('ls-tree', '-r', '--name-only', rev).stdout.split('\n');
/** A commit on main. */
function onMain(fx: Fx, edit: () => void) {
  edit();
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'main moves on');
}
/** Branch `ticket/<id>` from main, with the ticket done and `edit` applied; back on main. */
function finish(fx: Fx, edit?: () => void) {
  fx.git('checkout', '-q', '-b', `ticket/${ID}`);
  write(fx, `tickets/${ID}.md`, read(fx, `tickets/${ID}.md`).replace(/^status: .*$/m, 'status: done'));
  edit?.();
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', `${ID}: done`);
  fx.git('checkout', '-q', 'main');
}

/**
 * Runs `act` in the main checkout around the first `git merge --no-commit` the CLI starts there: just
 * before it ("before") or when it has ended ("after"). `fired` says whether it ran.
 */
function aroundMerge(fx: Fx, when: 'before' | 'after', act: () => void): { fired: () => boolean } {
  const real = process.getBuiltinModule.bind(process);
  const repo = realpathSync(fx.repo);
  let fired = false;
  const patched = (id: string): unknown => {
    const mod: typeof ChildProcess = real(id as 'node:child_process');
    if (id !== 'node:child_process') return mod;
    const spawnSync = (command: string, args?: readonly string[], options?: { cwd?: string }) => {
      const starts = !fired && command === 'git' && args?.[0] === 'merge' && args.includes('--no-commit') && options?.cwd !== undefined && realpathSync(options.cwd) === repo;
      if (starts && when === 'before') {
        fired = true;
        act();
      }
      const result = (mod.spawnSync as (c: string, a?: readonly string[], o?: object) => unknown)(command, args, options);
      if (starts && when === 'after') {
        fired = true;
        act();
      }
      return result;
    };
    return { ...mod, spawnSync };
  };
  vi.spyOn(process, 'getBuiltinModule').mockImplementation(patched as unknown as typeof process.getBuiltinModule);
  return { fired: () => fired };
}

describe('WSP-007/R4: untracked files block a merge only where it writes', () => {
  it('WSP-007/S19 Untracked files the merge does not touch stay as they are', async () => {
    const fx = project();
    finish(fx);
    write(fx, 'T3_CODE_ANALYSIS.md', 'analysis notes\n');
    write(fx, 'design/options/a.html', '<p>option a</p>\n');
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
    expect(status(fx)).toBe('?? T3_CODE_ANALYSIS.md\n?? design/options/a.html\n');
    expect(read(fx, 'T3_CODE_ANALYSIS.md')).toBe('analysis notes\n');
    expect(read(fx, 'design/options/a.html')).toBe('<p>option a</p>\n');
    expect(tracked(fx)).not.toContain('T3_CODE_ANALYSIS.md');
    expect(tracked(fx)).not.toContain('design/options/a.html');
    expect(fx.git('merge-base', '--is-ancestor', `ticket/${ID}`, 'main').code).toBe(0);
  }, 120_000);

  it('WSP-007/S20 An untracked file where the ticket\'s branch adds one', async () => {
    const fx = project();
    finish(fx, () => { write(fx, 'docs/plan.md', 'the branch plan\n'); });
    write(fx, 'docs/plan.md', 'my own plan\n');
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: docs/plan.md\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(mergeInProgress(fx)).toBe(false);
    expect(status(fx)).toBe('?? docs/plan.md\n');
    expect(read(fx, 'docs/plan.md')).toBe('my own plan\n');
  }, 120_000);

  it('WSP-007/S21 Tracked changes still refuse, and only what blocks is listed', async () => {
    const fx = project();
    finish(fx);
    onMain(fx, () => {
      for (const n of ['a.ts', 'b.ts', 'c.ts']) write(fx, n, 'one\n');
    });
    write(fx, 'a.ts', 'two\n');
    write(fx, 'b.ts', 'two\n');
    fx.git('add', 'b.ts');
    rmSync(join(fx.repo, 'c.ts'));
    write(fx, 'notes.md', 'my notes\n');
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: a.ts, b.ts, c.ts\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(status(fx)).toBe(' M a.ts\nM  b.ts\n D c.ts\n?? notes.md\n');
    expect(read(fx, 'a.ts')).toBe('two\n');
    expect(read(fx, 'b.ts')).toBe('two\n');
    expect(existsSync(join(fx.repo, 'c.ts'))).toBe(false);
    expect(read(fx, 'notes.md')).toBe('my notes\n');
  }, 120_000);

  it('WSP-007/S22 An untracked file at a generated path', async () => {
    const gen = logged();
    const fx = project({ generated: { globs: ['plugin/generated/**'], command: gen.command } });
    finish(fx);
    write(fx, 'plugin/generated/extra.js', 'mine\n');
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: plugin/generated/extra.js\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(status(fx)).toBe('?? plugin/generated/extra.js\n');
    expect(read(fx, 'plugin/generated/extra.js')).toBe('mine\n');
  }, 120_000);

  it('WSP-007/S23 A refused merge leaves untracked files as they were', async () => {
    const fx = project({ tests: testCommand(["echo 'created meanwhile' > scratch.md"], 'failed') });
    finish(fx);
    write(fx, 'T3_CODE_ANALYSIS.md', 'analysis notes\n');
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout.startsWith(`${ID}: not merged, after merging ticket/${ID} tests fail (${TITLE}`)).toBe(true);
    expect(out.stdout.endsWith(`); ticket/${ID} stays unmerged\n`)).toBe(true);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(mergeInProgress(fx)).toBe(false);
    expect(status(fx)).toBe('?? T3_CODE_ANALYSIS.md\n?? scratch.md\n');
    expect(read(fx, 'T3_CODE_ANALYSIS.md')).toBe('analysis notes\n');
    expect(read(fx, 'scratch.md')).toBe('created meanwhile\n');
  }, 120_000);

  it('WSP-007/S24 The afterMerge commit never holds an untracked file from before the merge', async () => {
    const after = logged(['mkdir -p tools', 'echo built > tools/spec.cjs']);
    const fx = project({ afterMerge: after.command });
    finish(fx);
    write(fx, 'T3_CODE_ANALYSIS.md', 'analysis notes\n');
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
    expect(after.runs()).toBe(1);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe(`${ID}: after merge`);
    const held = fx.git('show', '--name-only', '--format=', 'HEAD').stdout.split('\n');
    expect(held).toContain('tools/spec.cjs');
    expect(held).not.toContain('T3_CODE_ANALYSIS.md');
    expect(tracked(fx)).not.toContain('T3_CODE_ANALYSIS.md');
    expect(status(fx)).toBe('?? T3_CODE_ANALYSIS.md\n');
    expect(read(fx, 'T3_CODE_ANALYSIS.md')).toBe('analysis notes\n');
  }, 120_000);

  it('WSP-007/S25 Ignored files never count', async () => {
    const fx = project({
      setup: (dir) => {
        // The copy links node_modules to this repository's; an ignored file of its own goes in a real folder.
        rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
        mkdirSync(join(dir, 'node_modules'));
        writeFileSync(join(dir, 'node_modules/cache.bin'), 'cache\n');
        expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('node_modules');
      },
    });
    finish(fx);
    expect(status(fx)).toBe('');
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
    expect(read(fx, 'node_modules/cache.bin')).toBe('cache\n');
    expect(status(fx)).toBe('');
  }, 120_000);

  it('WSP-007/S26 An untracked file created where the branch adds one, while the merge starts', async () => {
    const fx = project();
    finish(fx, () => {
      write(fx, 'docs/plan.md', 'the branch plan\n');
      write(fx, 'src/state.ts', `${read(fx, 'src/state.ts')}// changed by the branch\n`);
    });
    const stateOnMain = read(fx, 'src/state.ts');
    const before = head(fx);
    const race = aroundMerge(fx, 'before', () => { write(fx, 'docs/plan.md', 'my own plan\n'); });
    const out = await fx.spec('', 'merge', ID);
    expect(race.fired()).toBe(true);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: docs/plan.md\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(mergeInProgress(fx)).toBe(false);
    expect(read(fx, 'src/state.ts')).toBe(stateOnMain);
    expect(status(fx)).toBe('?? docs/plan.md\n');
    expect(read(fx, 'docs/plan.md')).toBe('my own plan\n');
  }, 120_000);

  it('WSP-007/S27 An untracked file created at a generated path while the merge runs', async () => {
    const gen = logged();
    const fx = project({
      generated: { globs: ['plugin/generated/**'], command: gen.command },
      setup: (dir) => {
        mkdirSync(join(dir, 'plugin/generated'), { recursive: true });
        writeFileSync(join(dir, 'plugin/generated/app.js'), 'base\n');
      },
    });
    finish(fx, () => { write(fx, 'plugin/generated/app.js', 'branch\n'); });
    onMain(fx, () => { write(fx, 'plugin/generated/app.js', 'main\n'); });
    const before = head(fx);
    // The merge conflicts in the generated file; the file appears when git has ended, before the rebuild.
    const race = aroundMerge(fx, 'after', () => { write(fx, 'plugin/generated/extra.js', 'mine\n'); });
    const out = await fx.spec('', 'merge', ID);
    expect(race.fired()).toBe(true);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: plugin/generated/extra.js\n`);
    expect(out.code).toBe(1);
    expect(gen.runs()).toBe(0);
    expect(head(fx)).toBe(before);
    expect(mergeInProgress(fx)).toBe(false);
    expect(read(fx, 'plugin/generated/app.js')).toBe('main\n');
    expect(status(fx)).toBe('?? plugin/generated/extra.js\n');
    expect(read(fx, 'plugin/generated/extra.js')).toBe('mine\n');
  }, 120_000);

  it('WSP-007/S27 An untracked file created at a generated path while the tests run keeps afterMerge from running', async () => {
    const after = logged(['echo built > tools/spec.cjs']);
    const fx = project({
      tests: testCommand(['mkdir -p plugin/generated', "echo 'mine' > plugin/generated/extra.js"]),
      generated: { globs: ['plugin/generated/**'] },
      afterMerge: after.command,
    });
    finish(fx);
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: plugin/generated/extra.js\n`);
    expect(out.code).toBe(1);
    expect(after.runs()).toBe(0);
    expect(head(fx)).toBe(before);
    expect(mergeInProgress(fx)).toBe(false);
    expect(status(fx)).toBe('?? plugin/generated/extra.js\n');
    expect(read(fx, 'plugin/generated/extra.js')).toBe('mine\n');
  }, 120_000);
});
