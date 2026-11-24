// WSP-001/R2, R4, R5: which checkout a failed setup belongs to, what survives removal and recreation,
// and a setup record that only grows. All in throwaway git fixtures, through `spec worktree add|remove`.
// The setup script reads toggle files in a scratch folder, so a test chooses per add whether it fails.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture, tempDir } from '../helpers';

const ID = 'TASK-101';
const made: (() => void)[] = [];
afterAll(() => {
  for (const done of made) done();
});

function repo(prefix: string) {
  const scratch = tempDir(`${prefix}-scratch-`);
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const path = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      const s = `'${scratch}'`;
      cfg.worktreeSetup = [
        `echo "$SPEC_TICKET" >> ${s}/runs`,
        `if [ -e ${s}/fail ]; then echo "npm ERR! x"; exit 1; fi`,
        `if [ -e ${s}/make ]; then touch $(cat ${s}/make); fi`,
        `if [ -e ${s}/corrupt ]; then echo garbage > "$(git rev-parse --git-dir)/index"; fi`,
      ].join('\n');
      writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
    },
  });
  const top = realpathSync(fx.repo);
  const trees = `${top}.worktrees`;
  made.push(() => {
    fx.git('worktree', 'prune');
    rmSync(trees, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
    fx.cleanup();
  });
  const setupDir = join(top, '.git/spec/setup');
  const tree = join(trees, ID);
  const toggle = (name: string, on: boolean | string) => {
    if (on === false) rmSync(join(scratch, name), { force: true });
    else writeFileSync(join(scratch, name), on === true ? '' : on);
  };
  return {
    fx,
    top,
    tree,
    trees,
    toggle,
    failed: join(setupDir, `${ID}.failed`),
    record: join(setupDir, `${ID}.txt`),
    runs: () => (existsSync(join(scratch, 'runs')) ? readFileSync(join(scratch, 'runs'), 'utf8').split('\n').filter(Boolean).length : 0),
    /** `spec worktree add` run with the project reached through `at` (default: the fixture's own path). */
    add: (at: string = fx.repo, ...extra: string[]) => run({ argv: ['worktree', 'add', ID, ...extra, '--root', join(at, 'spec')], env: {}, cwd: at, scriptPath: undefined }),
    remove: () => fx.spec('', 'worktree', 'remove', ID),
  };
}

describe('WSP-001/R5: a failed setup belongs to one checkout', () => {
  it('WSP-001/S6 A removed failed worktree leaves no marker for the primary tree', async () => {
    const r = repo('spec-wt-state-rm');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    expect(existsSync(r.failed)).toBe(true);
    const out = await r.remove();
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(r.failed)).toBe(false);
    r.fx.git('checkout', '-q', `ticket/${ID}`);
    const again = await r.add();
    expect(again.code, again.stderr).toBe(0);
    expect(again.stdout).toMatch(new RegExp(`^${ID}: already at `));
    expect(r.runs()).toBe(1);
  }, 60_000);

  it('WSP-001/S6 A stale marker for another checkout does not rerun setup in the primary tree', async () => {
    const r = repo('spec-wt-state-stale-primary');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    const marker = readFileSync(r.failed);
    expect((await r.remove()).code).toBe(0);
    writeFileSync(r.failed, marker);
    r.fx.git('checkout', '-q', `ticket/${ID}`);
    r.toggle('fail', false);
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: already at `));
    expect(r.runs()).toBe(1);
  }, 60_000);

  it('WSP-001/S6 A stale marker for another checkout does not rerun setup in a tree with no record', async () => {
    const r = repo('spec-wt-state-stale-tree');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    const marker = readFileSync(r.failed);
    expect((await r.remove()).code).toBe(0);
    // A checkout made by plain git: spec never set it up, so it has no setup record.
    const other = join(r.trees, 'elsewhere');
    expect(r.fx.git('worktree', 'add', '-q', other, `ticket/${ID}`).code).toBe(0);
    writeFileSync(r.failed, marker);
    r.toggle('fail', false);
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: already at `));
    expect(r.runs()).toBe(1);
    expect(existsSync(r.record)).toBe(false);
  }, 60_000);

  it('WSP-001/S16 A failed checkout moved with git worktree move is still retried', async () => {
    const r = repo('spec-wt-state-move');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    const moved = join(r.trees, 'moved');
    expect(r.fx.git('worktree', 'move', r.tree, moved).code).toBe(0);
    r.toggle('fail', false);
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`${ID}: set up ${moved} on ticket/${ID}\n`);
    expect(r.runs()).toBe(2);
    expect(existsSync(r.failed)).toBe(false);
  }, 60_000);

  it('WSP-001/S6 A checkout removed and recreated at the same path does not inherit the marker', async () => {
    const r = repo('spec-wt-state-recreate');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    // Plain git, so spec's own cleanup does not run: only the checkout's identity differs.
    expect(r.fx.git('worktree', 'remove', '--force', r.tree).code).toBe(0);
    expect(r.fx.git('worktree', 'add', '-q', r.tree, `ticket/${ID}`).code).toBe(0);
    r.toggle('fail', false);
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: already at `));
    expect(r.runs()).toBe(1);
  }, 60_000);
});

describe('WSP-001/R5: the same checkout through another path', () => {
  it('WSP-001/S16 A retry through /var versus /private/var', async () => {
    const r = repo('spec-wt-state-alias-var');
    r.toggle('fail', true);
    expect((await r.add(r.fx.repo)).code).toBe(1);
    r.toggle('fail', false);
    const out = await r.add(r.top);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: set up `));
    expect(existsSync(r.failed)).toBe(false);
    expect(r.runs()).toBe(2);
  }, 60_000);

  it('WSP-001/S16 A retry through a symlink to the project', async () => {
    const r = repo('spec-wt-state-alias-link');
    const holder = tempDir('spec-wt-state-link-');
    made.push(() => {
      rmSync(holder, { recursive: true, force: true });
    });
    const alias = join(holder, 'alias');
    symlinkSync(r.top, alias, 'dir');
    r.toggle('fail', true);
    expect((await r.add(alias)).code).toBe(1);
    r.toggle('fail', false);
    const out = await r.add(r.fx.repo);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: set up `));
    r.toggle('fail', true);
    expect((await r.add(alias)).code).toBe(0);
    expect(r.runs()).toBe(2);
  }, 60_000);
});

describe('WSP-001/R4, R5: setup state is reset for a new checkout', () => {
  it('WSP-001/S18 Old record gone after recreation; repeated failure keeps the marker; success clears it', async () => {
    const r = repo('spec-wt-state-reset');
    r.toggle('make', 'first.txt');
    expect((await r.add()).code).toBe(0);
    expect(readFileSync(r.record, 'utf8').split('\n')).toContain('first.txt');
    // Clean removal: the setup's file goes first, as git refuses a tree with untracked files.
    rmSync(join(r.tree, 'first.txt'));
    expect((await r.remove()).code).toBe(0);
    r.toggle('make', false);
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    expect(existsSync(r.record)).toBe(false);
    expect(existsSync(r.failed)).toBe(true);
    const again = await r.add();
    expect(again.code).toBe(1);
    expect(again.stderr).toMatch(/^worktreeSetup failed in /);
    expect(existsSync(r.failed)).toBe(true);
    expect(existsSync(r.record)).toBe(false);
    r.toggle('fail', false);
    const ok = await r.add();
    expect(ok.code, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(new RegExp(`^${ID}: set up `));
    expect(existsSync(r.failed)).toBe(false);
    expect(existsSync(r.record)).toBe(true);
    expect(readFileSync(r.record, 'utf8')).not.toContain('first.txt');
  }, 60_000);
});

describe('WSP-001/R4: a setup record only grows', () => {
  it('WSP-001/S16 Old paths survive a retry and new ones are appended once', async () => {
    const r = repo('spec-wt-state-grow');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    // A record from earlier work in this checkout.
    mkdirSync(join(r.top, '.git/spec/setup'), { recursive: true });
    writeFileSync(r.record, 'old.txt\nshared.txt\n');
    r.toggle('fail', false);
    r.toggle('make', 'shared.txt new.txt');
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    const lines = readFileSync(r.record, 'utf8').split('\n').filter(Boolean);
    expect([...lines].sort()).toEqual(['new.txt', 'old.txt', 'shared.txt']);
    expect(lines.slice(0, 2)).toEqual(['old.txt', 'shared.txt']);
  }, 60_000);

  it('WSP-001/S16 A failed git path listing does not erase the record', async () => {
    const r = repo('spec-wt-state-listing');
    r.toggle('fail', true);
    expect((await r.add()).code).toBe(1);
    mkdirSync(join(r.top, '.git/spec/setup'), { recursive: true });
    writeFileSync(r.record, 'old.txt\n');
    r.toggle('fail', false);
    // The setup leaves the worktree's index unreadable, so git cannot list its untracked paths.
    r.toggle('corrupt', true);
    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(readFileSync(r.record, 'utf8').split('\n')).toContain('old.txt');
    expect(existsSync(r.failed)).toBe(false);
  }, 60_000);
});
