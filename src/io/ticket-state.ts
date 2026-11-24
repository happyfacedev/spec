// Per-ticket state in the repository's common git directory: worktree setup paths and stage starts.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { isRecordedModel } from '../core/transcript';
import { commonDir, git } from './git';

const stateDir = (cwd: string, kind: 'setup' | 'stages'): string | null => {
  const common = commonDir(cwd);
  return common === null ? null : join(common, 'spec', kind);
};

/**
 * Records every untracked path in the worktree at `top` (untracked symlinks included), relative to
 * the repository root as `git status` names them.
 */
export function saveSetupPaths(top: string, ticket: string): void {
  const dir = stateDir(top, 'setup');
  if (dir === null) return;
  const r = git(top, ['ls-files', '--others', '--exclude-standard']);
  mkdirSync(dir, { recursive: true });
  // A record that is already there is kept and extended, never shrunk.
  const kept = loadSetupPaths(top, ticket);
  const now = r.code === 0 ? r.stdout.split('\n').filter((p) => p !== '') : [];
  const all = [...new Set([...kept, ...now])];
  writeFileSync(join(dir, `${ticket}.txt`), all.length === 0 ? '' : `${all.join('\n')}\n`);
}

const failedFile = (cwd: string, ticket: string): string | null => {
  const dir = stateDir(cwd, 'setup');
  return dir === null ? null : join(dir, `${ticket}.failed`);
};

/**
 * A checkout's identity is a token kept in its own git admin directory: `git worktree move` keeps
 * that directory, and a new `git worktree add` makes a fresh one.
 */
const tokenFile = (path: string): string | null => {
  const r = git(path, ['rev-parse', '--git-dir']);
  return r.code === 0 ? join(resolve(path, r.stdout.trim()), 'spec-setup-failed') : null;
};

/** Marks the setup of the ticket's worktree at `path` as failed: the next add to that same checkout runs it again. */
export function markSetupFailed(cwd: string, ticket: string, path: string): void {
  const file = failedFile(cwd, ticket);
  const own = tokenFile(path);
  if (file === null || own === null) return;
  const token = randomUUID();
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(own, `${token}\n`);
  writeFileSync(file, `${token}\n`);
}

/** True when the ticket's last setup failed in the checkout at `path`, and in no other. */
export const setupFailed = (cwd: string, ticket: string, path: string): boolean => {
  const file = failedFile(cwd, ticket);
  const own = tokenFile(path);
  if (file === null || own === null || !existsSync(file) || !existsSync(own)) return false;
  try {
    const token = readFileSync(file, 'utf8').trim();
    return token !== '' && readFileSync(own, 'utf8').trim() === token;
  } catch {
    return false;
  }
};

/** Forgets what a removed or replaced checkout left: its failure marker and its setup record. */
export function clearSetupState(cwd: string, ticket: string, record: boolean): void {
  clearSetupFailed(cwd, ticket);
  const dir = stateDir(cwd, 'setup');
  if (record && dir !== null) rmSync(join(dir, `${ticket}.txt`), { force: true });
}

/** Removes the failed-setup marker. */
export function clearSetupFailed(cwd: string, ticket: string): void {
  const file = failedFile(cwd, ticket);
  if (file !== null) rmSync(file, { force: true });
}

/** The paths saveSetupPaths recorded for the ticket; empty when none were. */
export function loadSetupPaths(cwd: string, ticket: string): string[] {
  const dir = stateDir(cwd, 'setup');
  const file = dir === null ? null : join(dir, `${ticket}.txt`);
  return file !== null && existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((p) => p !== '') : [];
}

/** A ticket's current stage start, shared by every worktree of the repository. */
export interface StageStartRecord {
  readonly stage: string;
  readonly started: string;
  readonly model?: unknown;
  readonly entries?: unknown;
}

/** Remembers when the ticket's stage was started, for stage duration in ticket history. */
export function saveStageStart(cwd: string, ticket: string, stage: string, started: string, model?: string | null, entries?: number): void {
  const dir = stateDir(cwd, 'stages');
  if (dir === null) return;
  mkdirSync(dir, { recursive: true });
  const remembered = isRecordedModel(model) && entries !== undefined && Number.isInteger(entries) && entries >= 0 ? { model, entries } : {};
  const record = { stage, started, ...remembered };
  writeFileSync(join(dir, `${ticket}.json`), `${JSON.stringify(record)}\n`);
}

/** The current stage start record for this ticket, or null when none was recorded. */
export function loadStageStartRecord(cwd: string, ticket: string, stage?: string): StageStartRecord | null {
  const dir = stateDir(cwd, 'stages');
  const file = dir === null ? null : join(dir, `${ticket}.json`);
  if (file === null || !existsSync(file)) return null;
  try {
    const r = z.object({ stage: z.string(), started: z.string(), model: z.unknown().optional(), entries: z.unknown().optional() }).safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return r.success && (stage === undefined || r.data.stage === stage) ? r.data : null;
  } catch {
    return null;
  }
}

/** When the ticket's `stage` was started; null when none was recorded for that stage. */
export function loadStageStart(cwd: string, ticket: string, stage: string): string | null {
  return loadStageStartRecord(cwd, ticket, stage)?.started ?? null;
}

/** Removes a consumed model and entry count from the stage start record. */
export function forgetStageStartModel(cwd: string, ticket: string, stage: string, started: string): void {
  const record = loadStageStartRecord(cwd, ticket);
  if (record === null || record.stage !== stage || record.started !== started || (record.model === undefined && record.entries === undefined)) return;
  const dir = stateDir(cwd, 'stages');
  if (dir === null) return;
  const file = join(dir, `${ticket}.json`);
  const temporary = join(dir, `${ticket}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify({ stage: record.stage, started: record.started })}\n`, { flag: 'wx' });
    const current = loadStageStartRecord(cwd, ticket);
    if (
      current === null ||
      current.stage !== record.stage ||
      current.started !== record.started ||
      JSON.stringify(current.model) !== JSON.stringify(record.model) ||
      JSON.stringify(current.entries) !== JSON.stringify(record.entries)
    ) return;
    renameSync(temporary, file);
  } catch {
    // The consumed history entry keeps a stale start model from being used again.
  } finally {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // A leftover temp file is ignored by every stage-state read.
    }
  }
}

/** True while a process with this pid exists; one owned by another user (EPERM) exists too. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}
