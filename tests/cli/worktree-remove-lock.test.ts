// WSP-002/R2: `spec worktree remove` holds the ticket's lock, `spec/worktree-<ID>.lock` in the common git
// directory, the one `spec worktree add` holds. S8 uses real processes ordered by barrier files (no
// sleeps); S9 holds the lock with a live process and drives the 15-minute wait by moving the clock the
// wait reads, since the wait is not exposed; S10 leaves a lock naming a process that has ended.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, gitFixture, tempDir, trackChild } from '../helpers';

const ID = 'BUG-301';
const TSX = join(REPO, 'node_modules/.bin/tsx');
const MAIN = join(REPO, 'src/cli/main.ts');

const made: (() => void)[] = [];
afterAll(() => {
  for (const done of made) done();
});

interface Result {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Waits until `ok()` holds, polling; false when `ms` pass first. */
async function until(ok: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
  return true;
}

function repo(prefix: string, setup?: (dir: string) => void) {
  const scratch = tempDir(`${prefix}-scratch-`);
  const fx = gitFixture(prefix, { setup });
  const top = realpathSync(fx.repo);
  const trees = `${top}.worktrees`;
  made.push(() => {
    fx.git('worktree', 'prune');
    rmSync(trees, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
    fx.cleanup();
  });
  const tree = join(trees, ID);
  const lock = join(top, '.git/spec', `worktree-${ID}.lock`);
  const at = (name: string) => join(scratch, name);
  const proc = (...args: string[]): Promise<Result> =>
    new Promise((resolve) => {
      const child = trackChild(spawn(TSX, [MAIN, ...args, '--root', join(fx.repo, 'spec')], { cwd: fx.repo, stdio: ['ignore', 'pipe', 'pipe'] }));
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
    });
  return {
    fx,
    top,
    tree,
    lock,
    scratch,
    at,
    proc,
    failed: join(top, '.git/spec/setup', `${ID}.failed`),
    /** The ticket's worktree with nothing uncommitted. */
    makeTree: () => {
      const r = fx.git('worktree', 'add', '-q', '-b', `ticket/${ID}`, tree, 'main');
      if (r.code !== 0) throw new Error(`git worktree add ${ID}: ${r.stderr}`);
    },
    remove: () => run({ argv: ['worktree', 'remove', ID, '--root', join(fx.repo, 'spec')], env: {}, cwd: fx.repo, scriptPath: undefined }),
  };
}

const REMOVED = `${ID}: removed `;

describe('WSP-002/R2: remove and the ticket lock', () => {
  it('WSP-002/S8 A remove waits for an add in progress', async () => {
    let scratch = '';
    const r = repo('spec-wt-rm-s8', (dir) => {
      scratch = tempDir('spec-wt-rm-s8-barrier-');
      const path = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      // Setup always fails; while "hold" exists it first waits inside, until the test makes "release".
      cfg.worktreeSetup = [`if [ -e '${scratch}/hold' ]; then touch '${scratch}/in'; while [ ! -e '${scratch}/release' ]; do sleep 0.05; done; fi`, 'echo "npm ERR! setup"', 'exit 1'].join('\n');
      writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
    });
    made.push(() => {
      rmSync(scratch, { recursive: true, force: true });
    });
    // An earlier add whose setup failed: the worktree exists and is marked.
    const first = await r.proc('worktree', 'add', ID);
    expect(first.code).toBe(1);
    expect(existsSync(r.failed)).toBe(true);
    expect(existsSync(r.tree)).toBe(true);

    writeFileSync(join(scratch, 'hold'), '');
    const add = r.proc('worktree', 'add', ID);
    expect(await until(() => existsSync(join(scratch, 'in')), 60_000)).toBe(true);
    expect(existsSync(r.lock)).toBe(true);

    let ended = false;
    const rm = r.proc('worktree', 'remove', ID).then((x) => {
      ended = true;
      return x;
    });
    // Observable, not timed: the remove ending or (when it is held back) the bound passing.
    await until(() => ended, 8_000);
    expect(ended).toBe(false);
    expect(existsSync(r.tree)).toBe(true);
    expect(existsSync(r.failed)).toBe(true);
    writeFileSync(join(scratch, 'release'), '');

    const a = await add;
    const b = await rm;
    expect(a.code).toBe(1);
    expect(a.stderr).toMatch(/^worktreeSetup failed in /);
    expect(b.code, b.stderr).toBe(0);
    expect(b.stdout).toBe(`${REMOVED}${r.tree}; ticket/${ID} is kept\n`);
    expect(existsSync(r.tree)).toBe(false);
    expect(existsSync(r.failed)).toBe(false);
    expect(existsSync(r.lock)).toBe(false);
  }, 180_000);

  it('WSP-002/S9 An add that holds the lock too long', async () => {
    const r = repo('spec-wt-rm-s9');
    r.makeTree();
    // A live process holds the lock: its pid is the one the message names.
    const holder = trackChild(spawn('sleep', ['600'], { stdio: 'ignore' }));
    const pid = holder.pid;
    expect(pid).toBeDefined();
    mkdirSync(join(r.top, '.git/spec'), { recursive: true });
    writeFileSync(r.lock, `${String(pid)} held\n`);
    // The 15 minutes are not exposed: the clock the wait reads moves a minute per reading, so the
    // real wait loop reaches its limit in about a second.
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 60_000));
    let out;
    try {
      out = await r.remove();
    } finally {
      clock.mockRestore();
      holder.kill();
    }
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`another spec worktree add for ${ID} is still running (pid ${String(pid)})\n`);
    expect(out.stdout).toBe('');
    expect(existsSync(r.tree)).toBe(true);
    expect(existsSync(r.lock)).toBe(true);
  }, 60_000);

  it('WSP-002/S10 A lock left by a process that has ended', async () => {
    const r = repo('spec-wt-rm-s10');
    r.makeTree();
    const gone = spawn('true', [], { stdio: 'ignore' });
    await new Promise((done) => gone.on('close', done));
    mkdirSync(join(r.top, '.git/spec'), { recursive: true });
    writeFileSync(r.lock, `${String(gone.pid)} left\n`);

    const out = await r.remove();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`${REMOVED}${r.tree}; ticket/${ID} is kept\n`);
    expect(existsSync(r.tree)).toBe(false);
    // The remove took the dead lock over, held it, and released it: nothing is left behind.
    expect(readdirSync(join(r.top, '.git/spec')).filter((f) => f.startsWith(`worktree-${ID}.lock`))).toEqual([]);
  }, 60_000);
});
