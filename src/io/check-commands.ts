// Runs format.Config.checkCommands (PIP-006/R7): the project's own lint and type checks, in a shell.
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { matchesAny } from '../core/glob';

const TIMEOUT_MS = 10 * 60 * 1000;
const FIRST_LINES = 5;

/** The project root as given and, when it differs, its realpath (so /var and /private/var both match). */
function projectRoots(projectRoot: string): string[] {
  const roots = [resolve(projectRoot)];
  try {
    const real = realpathSync(projectRoot);
    if (!roots.includes(real)) roots.push(real);
  } catch {
    // an unreadable root keeps only the form as given
  }
  return roots;
}

/** A path token as the form relative to the project root: relative as printed, or absolute inside a root; else undefined. */
function projectRelative(token: string, roots: readonly string[]): string | undefined {
  if (!isAbsolute(token)) return token.replace(/^\.\//, '');
  for (const root of roots) {
    const rel = relative(root, token);
    if (rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) return rel.split(sep).join('/');
  }
  return undefined;
}

/**
 * Runs each command in order over the project. The implementer is refused when any exits non-zero;
 * the tester only for a failure that names a file under `testGlobs`.
 */
export function checkCommandProblems(projectRoot: string, commands: readonly string[], role: 'tester' | 'implementer', testGlobs: readonly string[]): string[] {
  const { spawnSync } = process.getBuiltinModule('node:child_process');
  const problems: string[] = [];
  for (const cmd of commands) {
    const r = spawnSync('/bin/sh', ['-c', cmd], { cwd: projectRoot, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    if (r.error === undefined && r.status === 0) continue;
    const lines = `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    if (r.error !== undefined) lines.unshift(r.error.message);
    if (role === 'implementer') {
      problems.push(`${cmd} fails (exit ${r.status ?? '?'}): ${lines.slice(0, FIRST_LINES).join('; ')}`);
      continue;
    }
    const roots = projectRoots(projectRoot);
    const files: string[] = [];
    for (const line of lines) {
      // The token pattern stops at ":", so a trailing ":<line>[:<col>]" is already dropped.
      for (const token of line.match(/[\w@./-]+/g) ?? []) {
        const file = projectRelative(token, roots);
        if (file !== undefined && matchesAny(file, testGlobs) && !files.includes(file)) files.push(file);
      }
    }
    if (files.length === 0) continue;
    const about = lines.filter((l) => files.some((f) => l.includes(f)));
    problems.push(`${cmd} fails on ${files.join(', ')}: ${about.slice(0, FIRST_LINES).join('; ')}; fix it before the implementer starts`);
  }
  return problems;
}
