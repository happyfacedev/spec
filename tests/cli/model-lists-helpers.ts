// PROP-131: shared setup for the tests of ordered model lists (FMT-015, CLI-007, CLI-008, INS-008, INS-020).
// Every test that can start `claude --version` puts a fake `claude` first on the PATH, so the result is the same
// where the real one is installed and where it is not.
import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, delimiter, dirname, join } from 'node:path';
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { gitFixture, tempDir } from '../helpers';

export type Fx = ReturnType<typeof gitFixture>;
export interface Out { stdout: string; stderr: string; code: number | null }

/** What the fake `claude --version` does. */
export type ClaudeBehaviour = { prints: string } | 'nothing' | 'fails' | 'hangs';
export interface FakeClaude { dir: string; calls(): number }

/** The `claude` on the PATH: it counts its runs, then prints a version, prints nothing, fails, or does not end. */
export function fakeClaude(behaviour: ClaudeBehaviour): FakeClaude {
  const dir = tempDir('fake-claude-');
  const body = behaviour === 'nothing'
    ? ['exit 0']
    : behaviour === 'fails'
      ? ['echo "claude: something went wrong" >&2', 'exit 1']
      : behaviour === 'hangs'
        ? ['exec sleep 30']
        : [`printf '%s\\n' '${behaviour.prints}'`];
  const script = ['#!/bin/sh', `echo x >> '${join(dir, 'calls')}'`, ...body, ''].join('\n');
  const path = join(dir, 'claude');
  writeFileSync(path, script);
  chmodSync(path, 0o755);
  return {
    dir,
    calls: () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8').split('\n').filter(Boolean).length : 0),
  };
}
export const VERSION_OK = { prints: '2.1.312 (Claude Code)' } as const;

interface Options {
  claude?: FakeClaude | undefined;
  env?: Record<string, string | undefined>;
  stdin?: string;
  /** Leave `--root` off, as `detect` runs in the current directory. */
  noRoot?: boolean;
}

/** One command line through cli.Run in the fixture, with the fake `claude` first on the PATH of both the process and the run's environment. */
export async function cli(fx: Fx, options: Options, ...argv: string[]): Promise<Out> {
  return runIn(fx.repo, options, options.noRoot === true ? argv : [...argv, '--root', join(fx.repo, 'spec')]);
}

export async function runIn(cwd: string, options: Options, argv: string[]): Promise<Out> {
  const original = process.env['PATH'] ?? '';
  const path = options.claude === undefined ? original : `${options.claude.dir}${delimiter}${original}`;
  process.env['PATH'] = path;
  try {
    return await run({
      argv,
      env: { PATH: path, ...options.env },
      cwd,
      scriptPath: undefined,
      stdin: () => Promise.resolve(options.stdin ?? ''),
      now: () => '2026-10-27T12:00:00.000Z',
    });
  } finally {
    process.env['PATH'] = original;
  }
}

export type Delegation = Record<string, Record<string, unknown>>;
export interface SetupOptions {
  /** config.local.json: a person's overrides and marks. */
  local?: Record<string, unknown>;
  /** Only these tickets stay open; TASK-101 and TASK-103 then touch features of their own, so both can start. */
  only?: string[];
  /** Tickets whose whole file is replaced (path under the project folder to text). */
  files?: Record<string, string>;
}

/** Marks every ticket but `ids` done and gives TASK-101 and TASK-103 separate features, as CLI-007/S9 does. */
function onlyTickets(dir: string, ids: string[]): void {
  for (const name of readdirSync(join(dir, 'tickets'))) {
    if (ids.includes(name.slice(0, -3))) continue;
    const file = join(dir, 'tickets', name);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: (?:open|blocked|in_progress)$/m, 'status: done'));
  }
  const one = join(dir, 'tickets/TASK-101.md');
  if (ids.includes('TASK-101') && ids.includes('TASK-103')) writeFileSync(one, readFileSync(one, 'utf8').replace('touches: [PRV-001, PRV-002]', 'touches: [CNV-001]'));
  const three = join(dir, 'tickets/TASK-103.md');
  if (ids.includes('TASK-103')) writeFileSync(three, readFileSync(three, 'utf8').replace('touches: [PRV-002]', 'touches: [CNV-002]'));
}

/** A setup for gitFixture: the claude-code delegation in config.json, and optionally config.local.json, ticket files and a smaller queue. */
export function configured(delegation: Delegation, options: SetupOptions = {}): (dir: string) => void {
  return (dir) => {
    const path = join(dir, 'spec/config.json');
    const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    config.delegation = delegation;
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
    const ignore = join(dir, 'spec/.gitignore');
    const before = existsSync(ignore) ? readFileSync(ignore, 'utf8') : '';
    if (!before.split('\n').includes('config.local.json')) writeFileSync(ignore, `${before}${before === '' || before.endsWith('\n') ? '' : '\n'}config.local.json\n`);
    if (options.local !== undefined) writeFileSync(join(dir, 'spec/config.local.json'), `${JSON.stringify(options.local, null, 2)}\n`);
    if (options.only !== undefined) onlyTickets(dir, options.only);
    for (const [file, text] of Object.entries(options.files ?? {})) writeFileSync(join(dir, file), text);
  };
}

export const project = (prefix: string, delegation: Delegation, options: SetupOptions = {}): Fx => gitFixture(prefix, { setup: configured(delegation, options) });

/** The whole config.local.json of a checkout, replaced (it is ignored, so no commit holds it). */
export function writeLocal(fx: Fx, local: Record<string, unknown>): void {
  writeFileSync(join(fx.repo, 'spec/config.local.json'), `${JSON.stringify(local, null, 2)}\n`);
}

/** A proposal ticket whose `done` stages are recorded: it is at the stage after the last of them. */
export function proposal(id: string, done: ('spec-writer' | 'spec-review' | 'tester')[], touches = 'PRV-001'): string {
  const entry = (role: string) => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${role === 'spec-review' ? 'approve' : 'null'}, assumed: []${role === 'tester' ? ', passed: true' : ''} }`;
  const history = done.length === 0 ? 'history: []' : `history:\n${done.map(entry).join('\n')}`;
  return `---\nid: ${id}\ntype: proposal\ntitle: ${id} fixture\nstatus: open\nstage: null\ntouches: [${touches}]\nviolates: []\nchanged: []\nquestions: []\n${history}\n---\nA fixture proposal.\n`;
}

export interface Next {
  ticket: string;
  action: string;
  role?: string;
  worktree?: string;
  model?: string | null;
  effort?: string | null;
  skipped?: { model: string; reason: string }[];
  blockers?: { text: string; kind?: string; id?: string }[];
  advance?: string;
  task?: string;
}
/** The one `spec next <ID> --format json` entry a command printed. */
export const json = (out: Out): Next => JSON.parse(out.stdout) as Next;
/** The entries of a listing, `spec next --format json` without a ticket. */
export const jsonList = (out: Out): Next[] => JSON.parse(out.stdout) as Next[];

export const worktreeOf = (fx: Fx, id: string): string => join(dirname(fx.repo), `${basename(fx.repo)}.worktrees`, id);
export const worktreeCount = (fx: Fx, id: string): number =>
  fx.git('worktree', 'list', '--porcelain').stdout.split('\n').filter((line) => line.startsWith('worktree ') && line.endsWith(`/${id}`)).length;
/** The ticket as its worktree holds it, or undefined when it has no worktree. */
export function wtTicket(fx: Fx, id: string) {
  const file = join(worktreeOf(fx, id), 'tickets', `${id}.md`);
  return existsSync(file) ? parseTicket(`tickets/${id}.md`, readFileSync(file, 'utf8')).ticket?.data : undefined;
}
/** The stage start record `spec next` writes in the repository's common git directory (PIP-025/R2). */
export const stageRecordPath = (fx: Fx, id: string): string => join(fx.repo, '.git/spec/stages', `${id}.json`);
export const stageRecord = (fx: Fx, id: string): Record<string, unknown> => JSON.parse(readFileSync(stageRecordPath(fx, id), 'utf8')) as Record<string, unknown>;

/** The command CLI-007/S23 gives to unmark a model. */
export const unmarkCommand = (model: string): string => `.spec/bin/spec config set unavailableModels.${model} false --local`;

/** The line CLI-007/S24 puts on stderr when an effort is not sent. */
export const effortNotSent = (effort: string): string => `effort ${effort} not sent: Claude Code 2.1.292 or later was not found`;

export const IMPLEMENTER_LIST = [{ model: 'opus', effort: 'medium' }, { model: 'haiku', effort: 'high' }];
