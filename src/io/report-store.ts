// The last accepted report of each ticket's running stage, kept inside the git directory so it is
// never committed. A session can stage a report for `ticket advance` to read when stdin is empty,
// so the main session records a stage without copying the role's message (a copy can lose its fence).
// Beside it, the path of the role's transcript, so advance can record the stage's model and cost.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { StageRole } from '../core/schemas';
import { git } from './git';

function storeDir(projectRoot: string): string | null {
  const r = git(projectRoot, ['rev-parse', '--git-dir']);
  return r.code === 0 ? join(resolve(projectRoot, r.stdout.trim()), 'spec', 'reports') : null;
}

export function saveReport(projectRoot: string, ticket: string, message: string, transcript: string | null = null): void {
  const dir = storeDir(projectRoot);
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${ticket}.md`), message);
  if (transcript === null) rmSync(join(dir, `${ticket}.transcript`), { force: true });
  else writeFileSync(join(dir, `${ticket}.transcript`), transcript);
}

export function loadReport(projectRoot: string, ticket: string): string | null {
  const dir = storeDir(projectRoot);
  const file = dir ? join(dir, `${ticket}.md`) : null;
  return file && existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** The transcript path saved with the ticket's report; null when none was. */
export function loadTranscriptPath(projectRoot: string, ticket: string): string | null {
  const dir = storeDir(projectRoot);
  const file = dir ? join(dir, `${ticket}.transcript`) : null;
  return file && existsSync(file) ? readFileSync(file, 'utf8').trim() || null : null;
}

const refusalPath = (dir: string, ticket: string, role: StageRole): string => join(dir, `${ticket}.${role}.refusals`);

export function bumpReportRefusal(projectRoot: string, ticket: string, role: StageRole): number {
  const dir = storeDir(projectRoot);
  if (!dir) return 1;
  mkdirSync(dir, { recursive: true });
  const file = refusalPath(dir, ticket, role);
  const previous = existsSync(file) ? Number(readFileSync(file, 'utf8')) || 0 : 0;
  const next = previous + 1;
  writeFileSync(file, `${next}\n`);
  return next;
}

/** How many reports of the ticket's running stage were refused so far; 0 when none. */
export function loadReportRefusals(projectRoot: string, ticket: string, role: StageRole): number {
  const dir = storeDir(projectRoot);
  const file = dir ? refusalPath(dir, ticket, role) : null;
  return file && existsSync(file) ? Number(readFileSync(file, 'utf8')) || 0 : 0;
}

/** A newly started stage begins its own refusal budget. */
export function clearReportRefusals(projectRoot: string, ticket: string, role: StageRole): void {
  const dir = storeDir(projectRoot);
  if (dir !== null) rmSync(refusalPath(dir, ticket, role), { force: true });
}

export function clearSavedReport(projectRoot: string, ticket: string): void {
  const dir = storeDir(projectRoot);
  if (!dir) return;
  rmSync(join(dir, `${ticket}.md`), { force: true });
  rmSync(join(dir, `${ticket}.transcript`), { force: true });
}

export function clearReport(projectRoot: string, ticket: string): void {
  const dir = storeDir(projectRoot);
  if (!dir || !existsSync(dir)) return;
  clearSavedReport(projectRoot, ticket);
}
