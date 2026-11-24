// WSP-001/R6: `spec worktree add` holds the ticket's lock, `spec/worktree-<ID>.lock` in the common git
// directory. S19 uses real processes ordered by barrier files (no sleeps); S20 holds the lock with a live
// process and drives the 15-minute wait by moving the clock the wait reads; S21 leaves a lock naming a
// process that has ended.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, gitFixture, tempDir, trackChild } from '../helpers';

const ID = 'TASK-101';
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
    add: () => run({ argv: ['worktree', 'add', ID, '--root', join(fx.repo, 'spec')], env: {}, cwd: fx.repo, scriptPath: undefined }),
  };
}

const CREATED = `${ID}: created `;

describe('WSP-001/R6: add and the ticket lock', () => {
  it('WSP-001/S19 A second add waits for the first', async () => {
    let barrier = '';
    const r = repo('spec-wt-add-s19', (dir) => {
      barrier = tempDir('spec-wt-add-s19-barrier-');
      const path = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      // Every run that gets into setup leaves a "run-<n>" folder; the first waits inside until released.
      cfg.worktreeSetup = [
        'k=0; for i in 1 2 3 4; do if mkdir ' + `'${barrier}'` + '/run-$i 2>/dev/null; then k=$i; break; fi; done',
        `if [ "$k" = 1 ]; then touch '${barrier}/in-1'; while [ ! -e '${barrier}/release-1' ]; do sleep 0.05; done; fi`,
        'touch made.txt',
      ].join('\n');
      writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
    });
    made.push(() => {
      rmSync(barrier, { recursive: true, force: true });
    });
    const first = r.proc('worktree', 'add', ID);
    expect(await until(() => existsSync(join(barrier, 'in-1')), 60_000)).toBe(true);
    // The first add is inside setup and holds the lock, which holds a pid.
    expect(existsSync(r.lock)).toBe(true);
    expect(readFileSync(r.lock, 'utf8')).toMatch(/^\d+/);

    let ended = false;
    const second = r.proc('worktree', 'add', ID).then((x) => {
      ended = true;
      return x;
    });
    // Observable, not timed: the second add ending or (when it is held back) the bound passing.
    await until(() => ended || existsSync(join(barrier, 'run-2')), 8_000);
    expect(ended).toBe(false);
    expect(existsSync(join(barrier, 'run-2'))).toBe(false);
    writeFileSync(join(barrier, 'release-1'), '');

    const a = await first;
    const b = await second;
    expect(a.code, a.stderr).toBe(0);
    expect(a.stdout).toBe(`${CREATED}${r.tree} on ticket/${ID}\n`);
    expect(b.code, b.stderr).toBe(0);
    expect(b.stdout).toBe(`${ID}: already at ${r.tree} on ticket/${ID}\n`);
    expect(existsSync(join(barrier, 'run-2'))).toBe(false);
    expect(existsSync(join(r.tree, 'made.txt'))).toBe(true);
    expect(existsSync(r.lock)).toBe(false);
  }, 180_000);

  it('WSP-001/S20 An add that waits too long', async () => {
    const r = repo('spec-wt-add-s20');
    // A live process holds the lock: its pid is the one the message names.
    const holder = trackChild(spawn('sleep', ['600'], { stdio: 'ignore' }));
    const pid = holder.pid;
    expect(pid).toBeDefined();
    mkdirSync(join(r.top, '.git/spec'), { recursive: true });
    const held = `${String(pid)} held\n`;
    writeFileSync(r.lock, held);
    // The 15 minutes are not exposed: the wait reads a clock the test controls. It moves a minute per
    // reading until the 14th minute, then a second per reading, so the real wait loop reaches its limit
    // in a few seconds and the test sees where the add gives up. At every reading before the 15 minutes
    // are over, the add is still running: the other process still holds the lock and nothing is made.
    const start = Date.now();
    let now = start;
    let first = true;
    let elapsed = 0;
    const early: string[] = [];
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      if (first) first = false;
      else now += now - start < 840_000 ? 60_000 : 1_000;
      elapsed = now - start;
      if (elapsed < 900_000) {
        if (!existsSync(r.lock) || readFileSync(r.lock, 'utf8') !== held) early.push(`lock changed at ${String(elapsed)} ms`);
        if (existsSync(r.tree)) early.push(`worktree made at ${String(elapsed)} ms`);
      }
      return now;
    });
    let out;
    let last: number;
    try {
      out = await r.add();
      last = elapsed;
    } finally {
      clock.mockRestore();
      holder.kill();
    }
    expect(early).toEqual([]);
    // It waited the whole 15 minutes (not 1 minute, not an hour) and gave up right after.
    expect(last).toBeGreaterThanOrEqual(900_000);
    expect(last).toBeLessThanOrEqual(910_000);
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`another spec worktree add for ${ID} is still running (pid ${String(pid)})\n`);
    expect(out.stdout).toBe('');
    expect(existsSync(r.tree)).toBe(false);
    expect(r.fx.git('rev-parse', '--verify', '--quiet', `refs/heads/ticket/${ID}`).code).not.toBe(0);
    expect(readFileSync(r.lock, 'utf8')).toBe(held);
  }, 60_000);

  it('WSP-001/S21 A lock left by a process that has ended', async () => {
    const r = repo('spec-wt-add-s21');
    const gone = spawn('true', [], { stdio: 'ignore' });
    await new Promise((done) => gone.on('close', done));
    mkdirSync(join(r.top, '.git/spec'), { recursive: true });
    writeFileSync(r.lock, `${String(gone.pid)} left\n`);

    const out = await r.add();
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`${CREATED}${r.tree} on ticket/${ID}\n`);
    expect(existsSync(r.tree)).toBe(true);
    // The add took the dead lock over, held it, and released it: nothing is left behind.
    expect(readdirSync(join(r.top, '.git/spec')).filter((f) => f.startsWith(`worktree-${ID}.lock`))).toEqual([]);
  }, 60_000);
});
