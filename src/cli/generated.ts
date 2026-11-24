// Files spec builds from others and never merges as text: the spec's index.md and _generated/,
// the pinned CLI, plus project-configured generated outputs. Merging and syncing take one side of a
// generated conflict, rebuild the spec index when needed, and run the project's own rebuild command
// for its `generated` files (WSP-009).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { matchesAny, matchesGlob } from '../core/glob';
import { toPosix } from '../io/fs';
import { changedPaths, git } from '../io/git';
import { putBackAsHead } from '../io/stash';
import { type Workspace, loadWorkspace } from '../io/workspace';
import { writeGenerated } from './commands';

/** The spec's own generated files, relative to the project root. */
export const specGenerated = (ws: Workspace): string[] => {
  const specRel = toPosix(relative(ws.projectRoot, ws.specRoot));
  return [`${specRel}/_generated/`, `${specRel}/index.md`];
};

/** Every generated path: a file, or a folder ending in `/`. */
export const generatedPaths = (ws: Workspace): string[] => [
  ...specGenerated(ws),
  '.spec/bin/',
  `.claude/skills/${ws.spec.skillName ?? 'spec'}/scripts/`,
  ...(ws.config?.generated?.globs ?? []),
  ...(ws.config?.generatedGlobs ?? []),
];

/** Whether `generated.globs` names the path, so a conflict in it can run the command; not `generatedGlobs` (WSP-009/R4). */
export const isProjectGenerated = (ws: Workspace, path: string): boolean => ws.config?.generated !== undefined && matchesAny(path, ws.config.generated.globs);

/** Whether any key names the path as generated: `generated.globs` or a legacy `generatedGlobs` (FMT-002/R12). */
export const isGenerated = (ws: Workspace, path: string): boolean => {
  const builtIns = [...specGenerated(ws), '.spec/bin/', `.claude/skills/${ws.spec.skillName ?? 'spec'}/scripts/`];
  return builtIns.some((g) => path === g || path.startsWith(g))
    || (ws.config?.generatedGlobs ?? []).some((glob) => matchesGlob(path, glob))
    || isProjectGenerated(ws, path);
};

/**
 * The workspace as the merge in progress leaves it: the project's `generated` setting is the merged
 * config's, so the incoming side's change to it counts. A config the merge left unreadable (a
 * conflict in it) gives no result, and the pre-merge workspace stands (WSP-009/R1).
 */
export async function mergedWorkspace(ws: Workspace, root: string): Promise<Workspace> {
  const merged = await loadWorkspace(ws.specRoot, null, root);
  return merged.config === null ? ws : { ...ws, config: merged.config };
}

/** The files the project's globs name that git lists with the given `ls-files` options. */
function projectFiles(ws: Workspace, root: string, options: string[]): string[] {
  const globs = ws.config?.generated?.globs;
  if (globs === undefined) return [];
  const out = git(root, ['ls-files', '-z', ...options, '--exclude-standard']).stdout.split('\0');
  return [...new Set(out.filter((p) => p !== '' && matchesAny(p, globs)))];
}

/** Every file under the project's globs, tracked or not, with its content. */
function snapshot(ws: Workspace, root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const p of projectFiles(ws, root, ['-c', '-o'])) {
    try {
      files.set(p, readFileSync(join(root, p)));
    } catch {
      // Listed but gone: nothing to put back.
    }
  }
  return files;
}

/** Puts the files under the globs back as `before` had them: rewritten, recreated or removed. */
function restore(ws: Workspace, root: string, before: Map<string, Buffer>): void {
  for (const p of projectFiles(ws, root, ['-c', '-o'])) if (!before.has(p)) rmSync(join(root, p), { force: true });
  for (const [p, content] of before) {
    const file = join(root, p);
    const now = ((): Buffer | null => {
      try {
        return readFileSync(file);
      } catch {
        return null;
      }
    })();
    if (now === null || !now.equals(content)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
}

/** Runs the project's rebuild command in `root`: null when it exits 0, else the last three lines of its output. */
function runGeneratedCommand(command: string, root: string): string | null {
  const r = spawnSync('/bin/sh', ['-c', command], { cwd: root, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (!r.error && r.status === 0) return null;
  const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => l.trim() !== '');
  return lines.slice(-3).join(' | ') || r.error?.message || `exit ${String(r.status)}`;
}

/** Every glob that names the project's own generated files: `generated.globs` and an old `generatedGlobs` (WSP-009/R5). */
export const projectGlobs = (ws: Workspace): string[] => [...(ws.config?.generated?.globs ?? []), ...(ws.config?.generatedGlobs ?? [])];

/**
 * After a blocked stage's stash is applied (WSP-009/R6): runs the project's command once, when one
 * is set. A command that fails leaves the generated files as the branch has them and returns what
 * to say on stderr; the restored work stays.
 */
export function rebuildAfterStash(ws: Workspace, root: string, id: string): string | null {
  const command = ws.config?.generated?.command;
  if (command === undefined) return null;
  const failure = runGeneratedCommand(command, root);
  if (failure === null) return null;
  const globs = projectGlobs(ws);
  putBackAsHead(root, changedPaths(root).filter((p) => matchesAny(p, globs)));
  return `${id}: the generated files do not rebuild after the stash: ${failure}; they are as ticket/${id} has them`;
}

/** Paths git left unmerged in the tree at `root`. */
export const conflictedPaths = (root: string): string[] => git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=U']).stdout.split('\n').filter((p) => p !== '');

/** Finishes a merge whose only conflicts are generated files; nothing is committed. */
export async function rebuildGenerated(ws: Workspace, root: string, conflicted: readonly string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (conflicted.length > 0) git(root, ['checkout', '--theirs', '--', ...conflicted]);
  if (conflicted.length > 0) {
    const fresh = await loadWorkspace(ws.specRoot, null, root);
    const built = await writeGenerated(fresh);
    if (!built.ok) return { ok: false, error: `the merged spec does not build: ${built.errors.join('; ')}` };
  }
  // WSP-009/R2: the project's own command runs once, only when one of its `generated.globs` files
  // conflicted, after the above. Without a command, or when only a legacy `generatedGlobs` path
  // conflicted (R4), the side taken stands.
  const command = ws.config?.generated?.command;
  if (command !== undefined && conflicted.some((p) => isProjectGenerated(ws, p))) {
    const before = snapshot(ws, root);
    const failure = runGeneratedCommand(command, root);
    if (failure !== null) {
      // WSP-009/R3: whatever the command wrote is put back, so the caller's undo finds the tree it made.
      restore(ws, root, before);
      return { ok: false, error: `the generated files do not rebuild: ${failure}` };
    }
    // WSP-009/R2: every change the command made under the globs rides in the commit, and nothing else.
    const changed = projectFiles(ws, root, ['-m', '-d', '-o']);
    if (changed.length > 0) git(root, ['add', '-A', '--', ...changed]);
  }
  if (conflicted.length > 0) git(root, ['add', '-A', '--', ...conflicted]);
  return { ok: true };
}
