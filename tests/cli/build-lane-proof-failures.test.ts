// PROP-116 review findings that need tests: what makes advance run the proof run again (PIP-024/S12, R6), a
// proof run that gives no results in each of its ways, with no refusal counted and the proof folder gone
// (PIP-022/S3, PIP-024/S10, R4, R5). The proof tree's setup (`worktreeSetup`) logs its folder to setup-dirs,
// so every case knows which folder the check made. A test command that cannot start or times out is
// simulated, as advance-check-could-not-run-suite.ts does it, but for the proof run alone: the child_process
// module gives the spawn error a real run gives for a test command that names the fixture and runs outside
// the stage's own tree.
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type * as ChildProcess from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { report } from '../helpers';
import { buildStage, cleanupAll, history, lines, safeJson, snapshot, type Case } from './build-lane-fixture';

const repos = new Map<string, string>();

beforeAll(() => {
  const real = process.getBuiltinModule.bind(process);
  const patched = (id: string): unknown => {
    const mod: typeof ChildProcess = real(id as 'node:child_process');
    if (id !== 'node:child_process') return mod;
    const spawnSync = (command: string, args?: readonly string[], options?: { cwd?: string }) => {
      const line = args?.[1] ?? '';
      const dir = line.includes('runner.sh') ? [...repos.keys()].find((s) => line.includes(s)) : undefined;
      const modeFile = dir === undefined ? '' : join(dir, 'proof-mode');
      const mode = dir !== undefined && existsSync(modeFile) ? readFileSync(modeFile, 'utf8').trim() : '';
      const repo = dir === undefined ? undefined : repos.get(dir);
      const inProofTree = repo !== undefined && options?.cwd !== undefined && realpathSync(options.cwd) !== realpathSync(repo);
      if (dir !== undefined && inProofTree && (mode === 'timeout' || mode === 'nostart')) {
        const code = mode === 'nostart' ? 'ENOENT' : 'ETIMEDOUT';
        const error = Object.assign(new Error(`spawnSync /bin/sh ${code}`), { code });
        return { error, status: null, signal: null, stdout: '', stderr: '', pid: 0, output: [null, '', ''] };
      }
      return (mod.spawnSync as (c: string, a?: readonly string[], o?: object) => unknown)(command, args, options);
    };
    return { ...mod, spawnSync };
  };
  vi.spyOn(process, 'getBuiltinModule').mockImplementation(patched as unknown as typeof process.getBuiltinModule);
});

afterAll(() => {
  vi.restoreAllMocks();
  cleanupAll();
});

/** A build stage with a worktreeSetup that logs the proof tree's folder. */
async function stage(prefix: string): Promise<Case> {
  const c = await buildStage(prefix, { worktreeSetup: true });
  repos.set(c.scratch, c.fx.repo);
  return c;
}

/** The proof folders the setup saw, oldest first. */
const proofFolders = (c: Case): string[] => {
  const file = join(c.scratch, 'setup-dirs');
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
};
const setProofMode = (c: Case, mode: string | null): void => {
  if (mode === null) rmSync(join(c.scratch, 'proof-mode'), { force: true });
  else writeFileSync(join(c.scratch, 'proof-mode'), mode);
};
const WRONG_ROLE = (c: Case) => report(`role: tester\nticket: ${c.id}\nresult: done\nsummary: Incorrect role`);
/** The attempt number the next refused report gets: 1 when no refusal was counted before it. */
async function nextAttempt(c: Case): Promise<number | undefined> {
  const out = await c.fx.spec(WRONG_ROLE(c), 'ticket', 'advance', c.id, '--report', '-', '--format', 'json');
  return safeJson<{ attempt: number }>(out.stdout)?.attempt;
}
const NOT_RUN = 'the check could not run: the test command gave no results: on the code before the build: ';

interface Way { name: string; reason: string; arm(c: Case): void; disarm(c: Case): void }
const NO_REPORT: Way = { name: 'no report', reason: 'the test command wrote no report', arm: (c) => { c.flag('proof-noreport', true); }, disarm: (c) => { c.flag('proof-noreport', false); } };
const GARBAGE: Way = {
  name: 'a report in no known format',
  reason: 'the test report is neither JSON nor JUnit XML',
  arm: (c) => { writeFileSync(join(c.scratch, 'proof.json'), 'not a report'); },
  disarm: (c) => { c.setProof(); },
};
const NO_START: Way = { name: 'a test command that fails to start', reason: 'spawnSync /bin/sh ENOENT', arm: (c) => { setProofMode(c, 'nostart'); }, disarm: (c) => { setProofMode(c, null); } };
const TIMEOUT: Way = { name: 'a test command that times out', reason: 'spawnSync /bin/sh ETIMEDOUT', arm: (c) => { setProofMode(c, 'timeout'); }, disarm: (c) => { setProofMode(c, null); } };
const SETUP_FAILS: Way = {
  name: 'a worktreeSetup that fails',
  reason: 'worktreeSetup failed: ',
  arm: (c) => { c.flag('setup-fail', true); },
  disarm: (c) => { c.flag('setup-fail', false); },
};

/** Arms the way, advances by `--report -`, and checks the stage, ticket and git are as they were, no refusal was counted and the proof folder is gone. */
async function couldNotRun(c: Case, way: Way): Promise<void> {
  const ticketFile = join(c.fx.repo, 'tickets', `${c.id}.md`);
  const before = { git: snapshot(c.fx), ticket: readFileSync(ticketFile, 'utf8'), history: history(c).length, folders: proofFolders(c).length };
  way.arm(c);
  const out = await c.fx.spec(c.implementer(), 'ticket', 'advance', c.id, '--report', '-');
  expect(out.code, `${way.name}: ${out.stderr}`).toBe(3);
  expect(lines(out.stderr, `${NOT_RUN}${way.reason}`), way.name).toHaveLength(1);
  expect(snapshot(c.fx), `${way.name}: git`).toEqual(before.git);
  expect(readFileSync(ticketFile, 'utf8'), `${way.name}: the ticket file`).toBe(before.ticket);
  expect(history(c), `${way.name}: history`).toHaveLength(before.history);
  // The proof folder this check made is gone, whichever way it ended (PIP-024/R4).
  const folders = proofFolders(c);
  expect(folders, `${way.name}: the setup saw the proof folder`).toHaveLength(before.folders + 1);
  expect(existsSync(folders.at(-1) ?? c.fx.repo), `${way.name}: the proof folder is left behind`).toBe(false);
  way.disarm(c);
  // No refusal was counted: the next refused report is the first attempt (PIP-022/R1, INV-015).
  expect(await nextAttempt(c), `${way.name}: the refusal count moved`).toBe(1);
}

describe('PIP-022/S3 Every way a run gives no results is a check that could not run', () => {
  it('PIP-022/S3 the proof run of a build stage that gives no results, in each of its four ways, counts no refusal and leaves no folder', async () => {
    for (const way of [NO_REPORT, GARBAGE, NO_START, TIMEOUT]) {
      const c = await stage(`failures-s3-${way.reason.length}`);
      await couldNotRun(c, way);
    }
  }, 300_000);
});

describe('PIP-024/S10 A proof run with no results neither accepts nor refuses', () => {
  it('PIP-024/S10 no report and a failing worktreeSetup count no refusal and leave no proof folder', async () => {
    for (const way of [NO_REPORT, SETUP_FAILS]) {
      const c = await stage(`failures-s10-${way.reason.length}`);
      await couldNotRun(c, way);
    }
  }, 300_000);
});

describe('PIP-024/S12 Advance reuses a proof run made on the same trees', () => {
  const REUSED_TEST = /^tests: reused the test run made at \S+ on this tree$/;
  const PROOF = 'tests: running the proof run on the code before the build';
  const keptProof = (c: Case) => join(c.fx.repo, '.git/spec/test-runs', `${c.id}.proof.json`);

  /** A check made the kept runs; `change` leaves the stage's tree as it is but changes what the proof run depends on. Advance then makes the proof run again alone. */
  async function proofAgain(prefix: string, change: (c: Case) => void): Promise<void> {
    const c = await stage(prefix);
    expect((await c.check()).ok).toBe(true);
    expect(c.runCount()).toBe(2);
    expect(existsSync(keptProof(c)), 'the check kept its proof run').toBe(true);
    change(c);
    const out = await c.advance();
    expect(out.code, out.stderr).toBe(0);
    expect(out.json?.problems).toEqual([]);
    expect(c.runCount(), 'the whole-tree run is reused, the proof run is made again').toBe(3);
    const notes = lines(out.stderr, 'tests: ');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(REUSED_TEST);
    expect(notes[1]).toBe(PROOF);
    expect(out.stderr).not.toContain('reused the proof run');
  }

  it('PIP-024/S12 a moved merge base makes the proof run again, the tree being as it was', async () => {
    await proofAgain('failures-s12-base', (c) => {
      const g = c.fx.git;
      const tree = g('rev-parse', 'main^{tree}').stdout.trim();
      const moved = g('commit-tree', tree, '-p', 'main', '-m', 'main moves').stdout.trim();
      expect(moved).not.toBe('');
      expect(g('update-ref', 'refs/heads/main', moved).code).toBe(0);
      const merged = g('merge', '--no-edit', 'main');
      expect(merged.code, merged.stderr + merged.stdout).toBe(0);
    });
  }, 300_000);

  it('PIP-024/S12 a changed worktreeSetup makes the proof run again, the tree being as it was', async () => {
    await proofAgain('failures-s12-setup', (c) => {
      // The tree key never sees a tracked file marked skip-worktree, so the command changes while the tree does not.
      expect(c.fx.git('update-index', '--skip-worktree', 'spec/config.json').code).toBe(0);
      const file = join(c.fx.repo, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(file, 'utf8')) as { worktreeSetup: string };
      cfg.worktreeSetup = `${cfg.worktreeSetup} # changed`;
      writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
    });
  }, 300_000);

  it('PIP-024/S12 a kept proof run that is cut short is not reused', async () => {
    await proofAgain('failures-s12-cut', (c) => {
      writeFileSync(keptProof(c), readFileSync(keptProof(c), 'utf8').slice(0, 40));
    });
  }, 300_000);

  it('PIP-024/S12 a kept proof run that holds no tests array is not reused', async () => {
    await proofAgain('failures-s12-no-tests', (c) => {
      const kept = JSON.parse(readFileSync(keptProof(c), 'utf8')) as { run: Record<string, unknown> };
      delete kept.run['tests'];
      writeFileSync(keptProof(c), JSON.stringify(kept));
    });
  }, 300_000);
});
