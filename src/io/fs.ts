import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { SourceFile } from '../core/source';

const SKIP_DIRS = new Set(['node_modules', '.git']);

export const toPosix = (p: string): string => p.split(sep).join('/');

/** The real path, symlinks resolved (macOS reports /var as /private/var); the path as given if it does not exist. */
export function realPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** `path` relative to `dir` when it lies inside it, comparing real paths; otherwise null. */
export function relativeInside(path: string, dir: string): string | null {
  const a = realPath(path);
  const d = realPath(dir);
  if (a !== d && !a.startsWith(d + sep)) return null;
  return toPosix(relative(d, a));
}

/** An entry the loader skipped because it cannot be read (LNT-019/R1). */
export interface UnreadableEntry {
  /** POSIX path relative to the loaded base. */
  readonly path: string;
  /** Why, as the tail of "cannot be read: ...". */
  readonly reason: string;
}

function unreadableReason(full: string, error: unknown): string {
  try {
    if (lstatSync(full).isSymbolicLink()) return 'its symlink target does not exist';
  } catch {
    // fall through to the error's own message
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every file under `dir`, with POSIX paths relative to `base` (default `dir`). Sorted by path.
 * An entry that cannot be stat'ed or read is skipped and, when `skipped` is given, recorded there.
 */
export function loadDir(dir: string, base: string = dir, skipped?: UnreadableEntry[]): SourceFile[] {
  const out: SourceFile[] = [];
  if (!existsSync(dir)) return out;
  // Only a caller that collects skipped entries tolerates them; any other fails, naming the entry.
  const skip = (full: string, error: unknown) => {
    const entry = { path: toPosix(relative(base, full)), reason: unreadableReason(full, error) };
    if (!skipped) throw new Error(`${entry.path} cannot be read: ${entry.reason}`, { cause: error });
    skipped.push(entry);
  };
  const walk = (d: string) => {
    let names: string[];
    try {
      names = readdirSync(d).sort();
    } catch (error) {
      skip(d, error);
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(d, name);
      let isDir = false;
      try {
        const st = statSync(full);
        isDir = st.isDirectory();
        if (st.isFile()) out.push({ path: toPosix(relative(base, full)), content: new Uint8Array(readFileSync(full)) });
      } catch (error) {
        skip(full, error);
      }
      if (isDir) walk(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * The POSIX paths, relative to `dir`, of every file under it, found without reading any file.
 * Skips folders named node_modules or .git; an entry that cannot be stat'ed is left out. Sorted by path.
 */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const walk = (d: string) => {
    let names: string[];
    try {
      names = readdirSync(d).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(d, name);
      try {
        const st = statSync(full);
        if (st.isFile()) out.push(toPosix(relative(dir, full)));
        else if (st.isDirectory()) walk(full);
      } catch {
        // Left out, as loadDir leaves out what it cannot stat.
      }
    }
  };
  walk(dir);
  return out;
}

/** Writes only when the content differs, so unchanged generated files keep their mtime. */
export async function writeIfChanged(path: string, text: string): Promise<boolean> {
  const current = existsSync(path) ? await readFile(path, 'utf8') : null;
  if (current === text) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
  return true;
}
