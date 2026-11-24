import type { ChildProcess } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

/**
 * Temp folders and child processes a test file creates, removed and stopped when the test (or, for
 * a child started outside a test, the file) ends. `tests/setup.ts` runs `finishFile` after every
 * file's tests, also when they fail. Vitest skips that hook for a file whose tests are all filtered
 * out (`-t`), although the file's module-scope code has made folders by then, so every folder is
 * also written to the run's manifest (SPEC_TMP_MANIFEST, set by `tests/global-setup.ts`), which the
 * global teardown empties once the whole run is over. Set SPEC_KEEP_TMP=1 to keep the folders for
 * debugging.
 */
const folders = new Set<string>();
const children = new Set<ChildProcess>();

const keep = () => process.env['SPEC_KEEP_TMP'] === '1';

/** A new temp folder under the OS temp folder, removed when the test file ends. */
export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  folders.add(dir);
  const manifest = process.env['SPEC_TMP_MANIFEST'];
  if (manifest) appendFileSync(manifest, `${dir}\n`);
  return dir;
}

const running = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

/** Asks a child to stop, and kills it when it has not exited within two seconds. */
async function stop(child: ChildProcess): Promise<void> {
  if (!running(child)) return;
  const exited = new Promise<void>((done) => child.once('exit', () => { done(); }));
  child.kill('SIGTERM');
  const timer = setTimeout(() => { if (running(child)) child.kill('SIGKILL'); }, 2000);
  await exited;
  clearTimeout(timer);
  children.delete(child);
}

/** Stops a child process the test started when the test ends, also on failure. Returns the child. */
export function trackChild<T extends ChildProcess>(child: T): T {
  children.add(child);
  if (process.env['SPEC_TRACE_CHILDREN'] === '1') {
    const started = performance.now();
    const command = child.spawnfile;
    const args = child.spawnargs.slice(1);
    child.once('close', () => {
      process.stderr.write(`[child] ${command} ${args.join(' ')} ${(performance.now() - started).toFixed(1)} ms\n`);
    });
  }
  try {
    onTestFinished(() => stop(child));
  } catch {
    // Started outside a test (a beforeAll or module scope): the file's end stops it.
  }
  return child;
}

/** Stops every child still running and removes every folder made; run by tests/setup.ts after each file. */
export async function finishFile(): Promise<void> {
  await Promise.all([...children].map(stop));
  if (keep()) return;
  for (const dir of folders) removeFolder(dir);
  folders.clear();
}

/** A folder and the `<folder>.worktrees` the CLI puts beside a repository for its ticket worktrees. */
export function removeFolder(dir: string): void {
  if (keep()) return;
  rmSync(dir, { recursive: true, force: true });
  rmSync(`${dir}.worktrees`, { recursive: true, force: true });
}
