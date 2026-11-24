// Locks in the repository's common git directory, shared by every worktree: a file that holds its
// owner's pid and a token. A lock whose owner has died is taken over.
//
// A lock is created by linking a temp file that already holds the pid, so a lock file is never
// empty. Taking over a dead lock is atomic (ADR-002): only a contender that holds the lock's
// takeover guard (another such file, `<lock>.takeover`) removes it. While a lock's owner is dead
// and the guard is held, nothing else can remove, release or replace that lock, so the guard holder
// removes exactly the dead one. A guard is held for a few system calls; one left by a dead process
// is moved aside, and anything moved that was not that dead guard is linked back.
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { commonDir } from './git';
import { isAlive } from './ticket-state';

export type Lock = { ok: true; release: () => void } | { ok: false; holder: number | null };

/** `<git common dir>/spec/<name>`, or null outside a repository. */
export const lockPath = (cwd: string, name: string): string | null => {
  const common = commonDir(cwd);
  return common === null ? null : join(common, 'spec', name);
};

interface Seen {
  readonly pid: number | null;
  readonly token: string;
  readonly ino: number;
  readonly mtimeMs: number;
}

/** What is at `path` now, or null when nothing is. */
function inspect(path: string): Seen | null {
  try {
    const st = statSync(path);
    const [pid, token] = readFileSync(path, 'utf8').trim().split(' ');
    const n = Number(pid);
    return { pid: Number.isInteger(n) && n > 0 ? n : null, token: token ?? '', ino: st.ino, mtimeMs: st.mtimeMs };
  } catch {
    return null;
  }
}

/** A lock written before locks held a token, or by a process that died writing it, may hold no pid. */
const dead = (s: Seen): boolean => (s.pid === null ? Date.now() - s.mtimeMs > 10_000 : !isAlive(s.pid));

const unique = (path: string, kind: string) => `${path}.${String(process.pid)}.${randomBytes(6).toString('hex')}.${kind}`;

/** Creates `path` holding this process's pid and `token`; false when it exists. */
function create(path: string, token: string): boolean {
  const tmp = unique(path, 'tmp');
  writeFileSync(tmp, `${String(process.pid)} ${token}\n`);
  try {
    linkSync(tmp, path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Removes `path` only if it is still the file `seen` describes; puts back anything else it moved. */
function removeIfSame(path: string, seen: Seen): void {
  const aside = unique(path, 'stale');
  try {
    renameSync(path, aside);
  } catch {
    return;
  }
  const moved = inspect(aside);
  if (moved !== null && moved.ino !== seen.ino) {
    try {
      linkSync(aside, path);
    } catch {
      // Something new is at `path` already; the file moved aside held a guard, not a lock.
    }
  }
  rmSync(aside, { force: true });
}

/** One attempt: the lock, or the pid that holds it. */
export function tryLock(path: string): Lock {
  mkdirSync(dirname(path), { recursive: true });
  const token = randomBytes(8).toString('hex');
  const held = (): Lock => ({
    ok: true,
    release: () => {
      if (inspect(path)?.token === token) rmSync(path, { force: true });
    },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (create(path, token)) return held();
    const seen = inspect(path);
    if (seen === null) continue;
    if (!dead(seen)) return { ok: false, holder: seen.pid };
    const guard = `${path}.takeover`;
    const guardToken = randomBytes(8).toString('hex');
    if (!create(guard, guardToken)) {
      const g = inspect(guard);
      if (g !== null && dead(g)) removeIfSame(guard, g);
      return { ok: false, holder: seen.pid };
    }
    try {
      // Under the guard: a lock whose owner is dead stays as it is until the guard holder removes it.
      const again = inspect(path);
      if (again !== null && dead(again)) rmSync(path, { force: true });
    } finally {
      if (inspect(guard)?.token === guardToken) rmSync(guard, { force: true });
    }
  }
  return { ok: false, holder: inspect(path)?.pid ?? null };
}

/** Waits for the lock, polling, up to `timeoutMs`. */
export async function waitForLock(path: string, timeoutMs: number): Promise<Lock> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const l = tryLock(path);
    if (l.ok || Date.now() >= until) return l;
    await new Promise((done) => setTimeout(done, 100));
  }
}

/** waitForLock, for callers that cannot await: the thread sleeps between attempts. */
export function waitForLockSync(path: string, timeoutMs: number): Lock {
  const until = Date.now() + timeoutMs;
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    const l = tryLock(path);
    if (l.ok || Date.now() >= until) return l;
    Atomics.wait(nap, 0, 0, 50);
  }
}
