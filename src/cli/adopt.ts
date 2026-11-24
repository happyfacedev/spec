// spec gaps and spec confirm: the loop that builds a spec with a person (/spec-init).
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CodeFile, confirmInText, findGaps, renderGaps } from '../core/adopt';
import { matchesAny } from '../core/glob';
import { closestId } from '../core/ids';
import { textOf } from '../core/source';
import { listFiles } from '../io/fs';
import { git } from '../io/git';
import { buildIndex, draftOf } from '../core/units';
import { runTestCommandWithTurn, testRunLocation, testRunTicket } from '../io/test-run-turn';
import { reloadWorkspaceSpec, type Workspace } from '../io/workspace';
import { type Args, USAGE } from './args';
import { writeGenerated } from './commands';
import { type Out, json, ok, usageError } from './output';

/** The code files `Code:` lines point into: the config's code globs, without its tests. Null when none are set. */
export function codeFiles(ws: Workspace): CodeFile[] | null {
  const codeGlobs = ws.config?.codeGlobs ?? [];
  const testGlobs = ws.config?.testGlobs ?? [];
  if (codeGlobs.length === 0) return null;
  // Paths are chosen before any file is read (ADP-004/R3). In a Git work tree Git names the files it does not
  // ignore (ADP-004/R1); otherwise the walk does (ADP-004/R2). A file that cannot be read is skipped.
  const out: CodeFile[] = [];
  for (const path of candidatePaths(ws.projectRoot)) {
    if (!matchesAny(path, codeGlobs) || matchesAny(path, testGlobs)) continue;
    try {
      if (!statSync(join(ws.projectRoot, path)).isFile()) continue;
      out.push({ path, text: textOf({ path, content: new Uint8Array(readFileSync(join(ws.projectRoot, path))) }) });
    } catch {
      // Gone from disk or unreadable.
    }
  }
  return out;
}

/** Project-relative POSIX paths: what Git tracks or leaves unignored, or, when Git cannot list them, the walk's. */
function candidatePaths(projectRoot: string): string[] {
  const listed = git(projectRoot, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.']);
  if (listed.code !== 0 || typeof listed.stdout !== 'string') return listFiles(projectRoot);
  return [...new Set(listed.stdout.split('\0').filter((p) => p !== ''))].sort();
}

/** spec gaps [--no-tests]: drafts, open questions, empty modules, unused contracts, untested scenarios, stale Code: lines. */
export async function cmdGaps(ws: Workspace, args: Args, write?: (text: string) => void): Promise<Out> {
  const execution = args.noTests || !ws.config ? null : await runTestCommandWithTurn(ws.projectRoot, ws.config.testCommand, '', {
    command: 'spec gaps',
    maxTestRuns: ws.config.maxTestRuns ?? 1,
    ticket: testRunTicket(ws.ticketGit.current),
    location: testRunLocation(ws.projectRoot, ws.ticketGit.current),
    ...(write ? { stderr: write } : {}),
  });
  const run = execution?.run ?? null;
  const tests = run && run.error === null ? run.tests : null;
  const g = findGaps(ws.spec, buildIndex(ws.spec), tests, codeFiles(ws));
  const out = args.format === 'json' ? json({ spec: ws.spec.version, ...g }) : ok(renderGaps(g, ws.spec.version, run?.error ?? null));
  return execution?.stderr ? { ...out, stderr: `${execution.stderr}${out.stderr}` } : out;
}

/** spec confirm <ID>...: a person checked these drafted units; they become ordinary spec. */
export async function cmdConfirm(ws: Workspace, args: Args): Promise<Out> {
  if (args.positionals.length === 0) return usageError('usage: spec confirm <ID>...', USAGE);
  const index = buildIndex(ws.spec);
  const done: string[] = [];
  const problems: string[] = [];
  for (const id of args.positionals) {
    const u = index.byId.get(id);
    if (!u) {
      const near = closestId(id, [...index.byId.keys()]);
      problems.push(`${id} is not a unit${near ? `; did you mean ${near}?` : ''}`);
      continue;
    }
    if (u.type === 'scenario' || u.type === 'rule' || u.type === 'field') {
      problems.push(`${id} is confirmed with its ${u.type === 'field' ? 'contract' : 'feature'}: spec confirm ${u.type === 'field' ? u.entity : u.feature}`);
      continue;
    }
    if (draftOf(u, index.byId) === null) {
      problems.push(`${id} is not a draft`);
      continue;
    }
    const path = join(ws.specRoot, u.file);
    const next = confirmInText(readFileSync(path, 'utf8'), u);
    if (next === null) problems.push(`${id}: its draft marker was not found in ${u.file}`);
    else {
      writeFileSync(path, next);
      done.push(id);
    }
  }
  if (done.length > 0) await writeGenerated(reloadWorkspaceSpec(ws));
  const code = problems.length === 0 ? 0 : 1;
  if (args.format === 'json') return json({ confirmed: done, problems }, code);
  return { stdout: done.map((d) => `${d}: confirmed\n`).join(''), stderr: problems.map((p) => `${p}\n`).join(''), code };
}
