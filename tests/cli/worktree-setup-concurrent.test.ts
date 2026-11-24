// WSP-001/R2, R4, R5: two `spec worktree add` runs for one ticket at once, as separate processes (the
// setup command blocks a process, so in-process runs could not overlap). The setup script is ordered by
// barrier files, not by time: the first run waits inside setup until the test releases it, and any run
// that is inside setup at the same time as another leaves the file "overlap".
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
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

function repo(prefix: string) {
  const scratch = tempDir(`${prefix}-scratch-`);
  const s = `'${scratch}'`;
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const path = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      cfg.worktreeSetup = [
        // Each run takes the next free number, atomically.
        'k=0; for i in 1 2 3 4 5 6; do if mkdir ' + s + '/run-$i 2>/dev/null; then k=$i; break; fi; done',
        `mkdir ${s}/inside 2>/dev/null || touch ${s}/overlap`,
        // The first run waits here until the test releases it.
        `if [ "$k" = 1 ]; then touch ${s}/in-1; while [ ! -e ${s}/release-1 ]; do sleep 0.05; done; fi`,
        `if [ -e ${s}/fail ]; then rmdir ${s}/inside 2>/dev/null; echo "npm ERR! run $k"; exit 1; fi`,
        `touch made-$k.txt`,
        `rmdir ${s}/inside 2>/dev/null`,
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
  const at = (name: string) => join(scratch, name);
  const toggle = (name: string, on: boolean) => {
    if (on) writeFileSync(at(name), '');
    else rmSync(at(name), { force: true });
  };
  /** Clears the barrier and run files between phases. */
  const reset = () => {
    for (const f of readdirSync(scratch)) if (f !== 'fail') rmSync(at(f), { recursive: true, force: true });
  };
  /** `spec worktree add` as its own process. */
  const start = (): Promise<Result> =>
    new Promise((resolve) => {
      const child = trackChild(spawn(TSX, [MAIN, 'worktree', 'add', ID, '--root', join(fx.repo, 'spec')], { cwd: fx.repo, stdio: ['ignore', 'pipe', 'pipe'] }));
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
    });
  /**
   * Starts one add, waits until its setup is inside the script, starts a second add, gives it the
   * chance to enter setup too (it can only do so when nothing serialises the two), then lets the
   * first one go and returns both results.
   */
  const overlapping = async (): Promise<[Result, Result]> => {
    const a = start();
    expect(await until(() => existsSync(at('in-1')), 60_000)).toBe(true);
    const b = start();
    // Observable, not timed: the second run entering setup, or (when it is held back) the bound passing.
    await until(() => existsSync(at('run-2')), 8_000);
    toggle('release-1', true);
    return [await a, await b];
  };
  return {
    fx,
    top,
    tree: join(trees, ID),
    toggle,
    reset,
    at,
    overlapping,
    runs: () => readdirSync(scratch).filter((f) => f.startsWith('run-')).length,
    failed: join(setupDir, `${ID}.failed`),
    record: join(setupDir, `${ID}.txt`),
    /** A first add whose setup fails, so the ticket's worktree is marked and the next add retries. */
    seedFailure: async () => {
      toggle('fail', true);
      toggle('release-1', true);
      const first = await start();
      expect(first.code).toBe(1);
      reset();
      toggle('fail', true);
    },
  };
}

describe('WSP-001/R5: overlapping adds for one ticket', () => {
  it('WSP-001/S18 Two overlapping failed setups leave the next add to retry', async () => {
    const r = repo('spec-wt-conc-fail');
    await r.seedFailure();
    const [a, b] = await r.overlapping();
    expect(existsSync(r.at('overlap'))).toBe(false);
    expect([a.code, b.code]).toEqual([1, 1]);
    expect(a.stderr).toMatch(/^worktreeSetup failed in /);
    expect(b.stderr).toMatch(/^worktreeSetup failed in /);
    expect(r.runs()).toBe(2);
    expect(existsSync(r.failed)).toBe(true);
    expect(existsSync(r.record)).toBe(false);

    r.toggle('fail', false);
    const next = await r.fx.spec('', 'worktree', 'add', ID);
    expect(next.code, next.stderr).toBe(0);
    expect(next.stdout).toMatch(new RegExp(`^${ID}: set up `));
    expect(existsSync(r.failed)).toBe(false);
  }, 180_000);

  it('WSP-001/S16 Two overlapping successful retries keep every recorded path', async () => {
    const r = repo('spec-wt-conc-ok');
    await r.seedFailure();
    // A record from earlier work in this checkout.
    mkdirSync(join(r.top, '.git/spec/setup'), { recursive: true });
    writeFileSync(r.record, 'earlier.txt\n');
    r.toggle('fail', false);
    const [a, b] = await r.overlapping();
    expect(existsSync(r.at('overlap'))).toBe(false);
    expect(a.code, a.stderr).toBe(0);
    expect(b.code, b.stderr).toBe(0);
    expect(a.stdout).toMatch(new RegExp(`^${ID}: set up `));
    const lines = readFileSync(r.record, 'utf8').split('\n').filter(Boolean);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain('earlier.txt');
    expect(lines).toContain('made-1.txt');
    // The second add either retried too (its file is listed as well) or found the setup done.
    if (r.runs() === 2) expect(lines).toContain('made-2.txt');
    else expect(b.stdout).toMatch(new RegExp(`^${ID}: already at `));
    expect(existsSync(r.failed)).toBe(false);
  }, 180_000);
});
