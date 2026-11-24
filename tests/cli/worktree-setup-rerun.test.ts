// WSP-001: spec worktree add, scenario by scenario, in real git; a failed worktreeSetup runs again on
// the next add. Each test runs the CLI in-process on a throwaway copy of chat-mini. Setup scripts that
// must fail once fail while a marker file is absent and create it.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE, gitFixture, tempDir } from '../helpers';

const USAGE_LINE = 'usage: spec worktree add <TICKET> | remove <TICKET> | list';

const made: (() => void)[] = [];
afterAll(() => {
  for (const done of made) done();
});

/** A throwaway repository; `edit` changes its config (given a scratch folder outside it) before its one commit. */
function repo(prefix: string, edit: (cfg: Record<string, unknown>, scratch: string) => void = () => undefined, opts: { nest?: string } = {}) {
  const scratch = tempDir(`${prefix}-scratch-`);
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const path = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      edit(cfg, scratch);
      writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
      if (opts.nest) {
        // The project moves into a folder of the repository.
        const entries = readdirSync(dir);
        mkdirSync(join(dir, opts.nest), { recursive: true });
        for (const e of entries) renameSync(join(dir, e), join(dir, opts.nest, e));
      }
    },
  });
  // git reports real paths (macOS: /private/var for /var).
  const top = realpathSync(fx.repo);
  const trees = `${top}.worktrees`;
  made.push(() => {
    fx.git('worktree', 'prune');
    rmSync(trees, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
    fx.cleanup();
  });
  const setupDir = join(top, '.git/spec/setup');
  const projectRoot = opts.nest ? join(fx.repo, opts.nest) : fx.repo;
  return {
    fx,
    top,
    scratch,
    trees,
    tree: (id: string) => join(trees, id),
    failed: (id: string) => join(setupDir, `${id}.failed`),
    record: (id: string) => join(setupDir, `${id}.txt`),
    // One line per setup run: "<ticket> <SPEC_MAIN_ROOT> <cwd>", paths resolved (macOS: /private/var for /var).
    runs: () =>
      (existsSync(join(scratch, 'runs')) ? readFileSync(join(scratch, 'runs'), 'utf8').split('\n').filter(Boolean) : []).map((line) => {
        const [id, main, cwd] = line.split(' ');
        return main && cwd ? `${id} ${realpathSync(main)} ${realpathSync(cwd)}` : line;
      }),
    add: (...argv: string[]) => run({ argv: ['worktree', 'add', ...argv, '--root', join(projectRoot, 'spec')], env: {}, cwd: projectRoot, scriptPath: undefined }),
  };
}

/** A worktreeSetup that fails once (after leaving partial.log), then succeeds; every run is logged with its environment. */
const failsOnce = (cfg: Record<string, unknown>, scratch: string): void => {
  cfg.worktreeSetup = `echo "$SPEC_TICKET $SPEC_MAIN_ROOT $PWD" >> '${scratch}/runs'; if [ ! -e '${scratch}/marker' ]; then touch partial.log '${scratch}/marker'; echo "npm ERR! a"; exit 1; fi`;
};

describe('WSP-001: Give a ticket its own worktree', () => {
  it('WSP-001/S1 A new worktree on a new branch from the base branch', async () => {
    const r = repo('spec-wt-add-s1');
    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`TASK-101: created ${r.tree('TASK-101')} on ticket/TASK-101\n`);
    expect(r.fx.git('-C', r.tree('TASK-101'), 'branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
    expect(r.fx.git('rev-parse', 'ticket/TASK-101').stdout.trim()).toBe(r.fx.git('rev-parse', 'main').stdout.trim());
  }, 60_000);

  it('WSP-001/S2 The JSON form', async () => {
    const r = repo('spec-wt-add-s2');
    const out = await r.add('BUG-301', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ok: true, path: r.tree('BUG-301'), project: r.tree('BUG-301'), created: true });
  }, 60_000);

  it('WSP-001/S3 The worktrees folder set in the config', async () => {
    // A fixed `../trees` would sit directly in the system temp folder and collide with the same
    // test running in another worktree's suite, so the folder lives in this test's own scratch.
    const r = repo('spec-wt-add-s3', (cfg, scratch) => {
      cfg.worktrees = `../${basename(scratch)}/trees`;
    });
    const out = await r.add('TASK-101', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const path = join(dirname(r.top), basename(r.scratch), 'trees', 'TASK-101');
    made.push(() => {
      rmSync(dirname(path), { recursive: true, force: true });
    });
    expect(realpathSync((JSON.parse(out.stdout) as { path: string }).path)).toBe(path);
    expect(existsSync(path)).toBe(true);
  }, 60_000);

  it('WSP-001/S4 Another base branch', async () => {
    const r = repo('spec-wt-add-s4', (cfg) => {
      cfg.baseBranch = 'develop';
    });
    r.fx.git('checkout', '-q', '-b', 'develop');
    writeFileSync(join(r.fx.repo, 'develop.txt'), 'develop\n');
    r.fx.git('add', '-A');
    r.fx.git('commit', '-q', '-m', 'develop work');
    r.fx.git('checkout', '-q', 'main');
    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    const tip = r.fx.git('rev-parse', 'ticket/TASK-101').stdout.trim();
    expect(tip).toBe(r.fx.git('rev-parse', 'develop').stdout.trim());
    expect(tip).not.toBe(r.fx.git('rev-parse', 'main').stdout.trim());
  }, 60_000);

  it('WSP-001/S5 An existing branch is checked out as it is', async () => {
    const r = repo('spec-wt-add-s5');
    r.fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
    writeFileSync(join(r.fx.repo, 'work.txt'), 'work\n');
    r.fx.git('add', '-A');
    r.fx.git('commit', '-q', '-m', 'TASK-101: work');
    const tip = r.fx.git('rev-parse', 'HEAD').stdout.trim();
    r.fx.git('checkout', '-q', 'main');
    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(r.fx.git('-C', r.tree('TASK-101'), 'rev-parse', 'HEAD').stdout.trim()).toBe(tip);
    expect(readFileSync(join(r.tree('TASK-101'), 'work.txt'), 'utf8')).toBe('work\n');
  }, 60_000);

  it('WSP-001/S6 A ticket that already has a worktree', async () => {
    const r = repo('spec-wt-add-s6', (cfg, s) => {
      cfg.worktreeSetup = `echo run >> '${s}/runs'`;
    });
    expect((await r.add('BUG-301')).code).toBe(0);
    expect(r.runs()).toHaveLength(1);
    const out = await r.add('BUG-301', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ok: true, path: r.tree('BUG-301'), project: r.tree('BUG-301'), created: false });
    expect(r.runs()).toHaveLength(1);
    const text = await r.add('BUG-301');
    expect(text.stdout).toBe(`BUG-301: already at ${r.tree('BUG-301')} on ticket/BUG-301\n`);
    expect(r.runs()).toHaveLength(1);
  }, 60_000);

  it('WSP-001/S7 worktreeSetup runs in the new tree', async () => {
    const r = repo('spec-wt-add-s7', (cfg, s) => {
      cfg.worktreeSetup = `echo "$SPEC_TICKET $SPEC_MAIN_ROOT $PWD" >> '${s}/runs'; ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules`;
    });
    const out = await r.add('BUG-301');
    expect(out.code, out.stderr).toBe(0);
    expect(r.runs()).toEqual([`BUG-301 ${r.top} ${r.tree('BUG-301')}`]);
    expect(existsSync(join(r.tree('BUG-301'), 'node_modules'))).toBe(true);
  }, 60_000);

  it('WSP-001/S8 worktreeSetup fails', async () => {
    const r = repo('spec-wt-add-s8', (cfg) => {
      cfg.worktreeSetup = 'echo "npm ERR! a"; echo "npm ERR! b"; echo "npm ERR! c"; exit 1';
    });
    const out = await r.add('TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`worktreeSetup failed in ${r.tree('TASK-101')}: npm ERR! a | npm ERR! b | npm ERR! c\n`);
    expect(existsSync(r.tree('TASK-101'))).toBe(true);
    expect(existsSync(r.failed('TASK-101'))).toBe(true);
    expect(existsSync(r.record('TASK-101'))).toBe(false);
  }, 60_000);

  it('WSP-001/S9 The bundled CLI is copied into the new tree', async () => {
    const r = repo('spec-wt-add-s9');
    const scripts = '.claude/skills/chat-spec/scripts';
    mkdirSync(join(r.fx.repo, scripts), { recursive: true });
    writeFileSync(join(r.fx.repo, scripts, 'spec'), 'bundle\n');
    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(readFileSync(join(r.tree('TASK-101'), scripts, 'spec'), 'utf8')).toBe('bundle\n');
  }, 60_000);

  it('WSP-001/S22 An untracked pinned CLI is copied into a new worktree', async () => {
    const r = repo('spec-wt-add-s19');
    const source = join(r.fx.repo, '.spec/bin');
    const launcher = readFileSync(join(source, 'spec'));
    const bundle = readFileSync(join(source, 'spec.cjs'));
    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(readFileSync(join(r.tree('TASK-101'), '.spec/bin/spec'))).toEqual(launcher);
    expect(readFileSync(join(r.tree('TASK-101'), '.spec/bin/spec.cjs'))).toEqual(bundle);
  }, 60_000);

  it('WSP-001/S10 A project inside a larger repository', async () => {
    const r = repo('spec-wt-add-s10', undefined, { nest: 'apps/chat' });
    const out = await r.add('TASK-101', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const added = JSON.parse(out.stdout) as { path: string; project: string };
    expect(added.path).toBe(r.tree('TASK-101'));
    expect(added.project.replace(/\/$/, '')).toBe(join(r.tree('TASK-101'), 'apps/chat'));
  }, 60_000);

  it('WSP-001/S11 A ticket that does not exist', async () => {
    const r = repo('spec-wt-add-s11');
    const out = await r.add('TASK-999');
    expect(out.code).toBe(2);
    expect(out.stderr.startsWith('Unknown TASK-999.')).toBe(true);
    expect(r.fx.git('branch', '--list', 'ticket/TASK-999').stdout.trim()).toBe('');
  }, 60_000);

  it('WSP-001/S12 No ticket, or not a ticket ID', async () => {
    const r = repo('spec-wt-add-s12');
    for (const argv of [[], ['cart']]) {
      const out = await r.add(...argv);
      expect(out.code).toBe(2);
      expect(out.stderr.slice(0, USAGE_LINE.length)).toBe(USAGE_LINE);
    }
  }, 60_000);

  it('WSP-001/S13 Not a git repository', async () => {
    const dir = tempDir('spec-wt-add-s13-');
    made.push(() => {
      rmSync(dir, { recursive: true, force: true });
    });
    cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !/\/node_modules(\/|$)/.test(src) });
    const out = await run({ argv: ['worktree', 'add', 'TASK-101', '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined });
    expect(out.code).toBe(1);
    expect([`${dir} is not a git repository\n`, `${realpathSync(dir)} is not a git repository\n`]).toContain(out.stderr);
  }, 60_000);

  it('WSP-001/S14 git refuses to add the worktree', async () => {
    const r = repo('spec-wt-add-s14');
    mkdirSync(r.tree('TASK-101'), { recursive: true });
    writeFileSync(join(r.tree('TASK-101'), 'stray.txt'), 'x\n');
    const out = await r.add('TASK-101');
    expect(out.code).toBe(1);
    const head = 'git could not add a worktree for TASK-101: ';
    expect(out.stderr.startsWith(head)).toBe(true);
    expect(out.stderr.slice(head.length).trim()).not.toBe('');
  }, 60_000);

  it('WSP-001/S16 A failed setup runs again on the next add', async () => {
    const r = repo('spec-wt-rerun-s16', failsOnce);
    expect((await r.add('TASK-101')).code).toBe(1);
    const tip = r.fx.git('rev-parse', 'ticket/TASK-101').stdout.trim();

    const out = await r.add('TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`TASK-101: set up ${r.tree('TASK-101')} on ticket/TASK-101\n`);
    expect(r.runs()).toEqual([`TASK-101 ${r.top} ${r.tree('TASK-101')}`, `TASK-101 ${r.top} ${r.tree('TASK-101')}`]);
    expect(r.fx.git('rev-parse', 'ticket/TASK-101').stdout.trim()).toBe(tip);
    expect(r.fx.git('worktree', 'list', '--porcelain').stdout.match(/^worktree /gm)).toHaveLength(2);
    expect(readFileSync(r.record('TASK-101'), 'utf8').split('\n')).toContain('partial.log');
    expect(existsSync(r.failed('TASK-101'))).toBe(false);

    const third = await r.add('TASK-101');
    expect(third.stdout).toBe(`TASK-101: already at ${r.tree('TASK-101')} on ticket/TASK-101\n`);
    expect(r.runs()).toHaveLength(2);
  }, 60_000);

  it('WSP-001/S17 The JSON form after a failed setup', async () => {
    const r = repo('spec-wt-rerun-s17', failsOnce);
    expect((await r.add('BUG-301')).code).toBe(1);
    const out = await r.add('BUG-301', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ ok: true, path: r.tree('BUG-301'), project: r.tree('BUG-301'), created: false });
    expect(r.runs()).toHaveLength(2);
    expect(r.runs()[1]).toBe(`BUG-301 ${r.top} ${r.tree('BUG-301')}`);
  }, 60_000);

  it('WSP-001/S18 Setup fails again', async () => {
    const r = repo('spec-wt-rerun-s18', (cfg) => {
      cfg.worktreeSetup = 'echo "npm ERR! a"; exit 1';
    });
    expect((await r.add('TASK-101')).code).toBe(1);
    const out = await r.add('TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`worktreeSetup failed in ${r.tree('TASK-101')}: npm ERR! a\n`);
    expect(existsSync(r.tree('TASK-101'))).toBe(true);
    expect(existsSync(r.failed('TASK-101'))).toBe(true);
    expect(existsSync(r.record('TASK-101'))).toBe(false);
  }, 60_000);
});
