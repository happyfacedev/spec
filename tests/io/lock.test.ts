// The locks in the git directory (src/io/lock.ts), contended by real processes. Every contender
// starts while the lock still holds the pid of a process that has ended, so they all try to take
// it over at once; no two may ever hold it at the same time (ADR-002).
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, tempDir } from '../helpers';

const dir = tempDir('spec-lock-');
const children: ChildProcess[] = [];
afterAll(async () => {
  // No child may still be writing into the directory when it is removed.
  await Promise.all(
    children.map(
      (c) =>
        new Promise<void>((done) => {
          if (c.exitCode !== null || c.signalCode !== null) {
            done();
            return;
          }
          c.once('close', () => {
            done();
          });
          c.kill('SIGKILL');
        }),
    ),
  );
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});

const CHILD = join(REPO, 'tests/io/lock-child.ts');
const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
/** A pid no process has: far above any the system hands out. */
const DEAD = 99_999_999;

async function contend(name: string, contenders: number, rounds: number): Promise<number[]> {
  const lock = join(dir, `${name}.lock`);
  const log = join(dir, `${name}.log`);
  const go = join(dir, `${name}.go`);
  const counter = join(dir, `${name}.counter`);
  writeFileSync(lock, `${String(DEAD)} stale\n`);
  const ready = Array.from({ length: contenders }, (_, i) => join(dir, `${name}.ready.${String(i)}`));
  const runs = ready.map(
    (r) =>
      new Promise<number>((done) => {
        const c = spawn(process.execPath, [TSX, CHILD, lock, log, counter, r, go, String(rounds)], { cwd: REPO, stdio: 'ignore' });
        children.push(c);
        c.on('close', (code) => {
          done(code ?? 1);
        });
      }),
  );
  // Let them all go at once, so each finds the dead pid.
  while (!ready.every((r) => existsSync(r))) await new Promise((done) => setTimeout(done, 20));
  writeFileSync(go, '');
  expect(await Promise.all(runs)).toEqual(ready.map(() => 0));
  return readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map(Number);
}

describe('locks shared by every process of a repository', () => {
  it('PIP-002/S26 (WSP-006/R7) contenders that find a dead owner take the lock over one at a time', async () => {
    // Each holder leaves the lock as a dead process would, so all 60 acquisitions are takeovers.
    // Each hold reads the shared counter under the lock and writes it plus one; holds that overlapped
    // would read the same value, so the log is exactly 0..59 in order only when none interleaved.
    const holds = await contend('takeover', 12, 5);
    expect(holds).toEqual(Array.from({ length: 60 }, (_, i) => i));
    expect(existsSync(join(dir, 'takeover.lock.takeover'))).toBe(false);
  }, 120_000);
});
