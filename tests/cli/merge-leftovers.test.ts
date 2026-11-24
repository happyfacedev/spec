// PROP-050: what a merge that died between its commit and its cleanup leaves behind, and what a re-merge
// (WSP-007/R1), `spec worktree remove` (WSP-002/R3) and `spec worktree list` (WSP-003/R1) do about it.
// The crash is simulated on a throwaway git copy of chat-mini: TASK-101 is merged for real, then its
// worktree, `.failed` marker, setup record and a lock naming a dead process are put back by hand.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { git } from '../../src/io/git';
import { gitFixture, tempDir, trackChild } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const outsideDirs: string[] = [];
const scratch = realpathSync(tempDir('spec-leftovers-'));
afterAll(() => {
  for (const fx of made) {
    git(fx.repo, ['worktree', 'prune']);
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    fx.cleanup();
  }
  for (const dir of outsideDirs) rmSync(dir, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

const ID = 'TASK-101';
const MERGED = `${ID}: not merged, ticket/${ID} is already merged into main`;
const MIN = 60_000;
let counter = 0;

/** A chat-mini copy whose test command writes a passing report. */
function project(edit?: (cfg: Record<string, unknown>) => void, files?: (dir: string) => void): Fx {
  const fx = gitFixture('spec-leftovers', {
    setup: (dir) => {
      files?.(dir);
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      edit?.(cfg);
      const script = join(scratch, `tests-${String(++counter)}.sh`);
      writeFileSync(script, `printf '{"testResults":[{"assertionResults":[{"title":"CNV-003/S1 Copy a message","status":"passed"}]}]}' > "$1"\n`);
      cfg.testCommand = `sh '${script}' "{report}"`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    },
  });
  made.push(fx);
  return fx;
}

const common = (fx: Fx) => join(realpathSync(fx.repo), '.git/spec');
const lockOf = (fx: Fx) => join(common(fx), `worktree-${ID}.lock`);
const failedOf = (fx: Fx) => join(common(fx), `setup/${ID}.failed`);
const recordOf = (fx: Fx) => join(common(fx), `setup/${ID}.txt`);
const treeOf = (fx: Fx) => `${realpathSync(fx.repo)}.worktrees/${ID}`;

/** A process id that has ended. */
async function deadPid(): Promise<number | undefined> {
  const gone = spawn('true', [], { stdio: 'ignore' });
  await new Promise((done) => gone.on('close', done));
  return gone.pid;
}

interface Left {
  /** A `.failed` marker. */
  failed?: boolean;
  /** A lock naming a process that has ended. */
  deadLock?: boolean;
  /** Leave no worktree. */
  noTree?: boolean;
}
/**
 * TASK-101 done and merged into main by a real merge, then the leftovers of a merge that died after
 * its commit: the worktree back on ticket/TASK-101 (nothing uncommitted), the setup record, and what `left` asks for.
 */
async function merged(left: Left = {}) {
  const fx = project();
  expect((await fx.spec('', 'worktree', 'add', ID)).code).toBe(0);
  const tree = treeOf(fx);
  const file = join(tree, `tickets/${ID}.md`);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: done'));
  git(tree, ['add', '-A']);
  git(tree, ['commit', '-q', '-m', `${ID}: done`]);
  const first = await fx.spec('', 'merge', ID);
  expect(first.code, first.stderr).toBe(0);
  expect(existsSync(tree)).toBe(false);
  if (!left.noTree) {
    const back = fx.git('worktree', 'add', '-q', tree, `ticket/${ID}`);
    if (back.code !== 0) throw new Error(`git worktree add ${ID}: ${back.stderr}`);
  }
  mkdirSync(join(common(fx), 'setup'), { recursive: true });
  writeFileSync(recordOf(fx), 'vendor-modules\n');
  if (left.failed) writeFileSync(failedOf(fx), 'earlier-token\n');
  if (left.deadLock) writeFileSync(lockOf(fx), `${String(await deadPid())} left\n`);
  return { fx, tree };
}

describe('WSP-007/R1: merge of an already merged ticket cleans what an earlier merge left', () => {
  it('WSP-007/S13 Already merged, with what a merge that ended early left behind', async () => {
    const { fx, tree } = await merged({ failed: true, deadLock: true });
    const before = fx.git('rev-parse', 'HEAD').stdout;
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${MERGED}; removed its worktree ${tree}\n`);
    expect(out.code).toBe(1);
    expect(existsSync(tree)).toBe(false);
    expect(existsSync(failedOf(fx))).toBe(false);
    expect(existsSync(lockOf(fx))).toBe(false);
    expect(fx.git('rev-parse', '--verify', `refs/heads/ticket/${ID}`).code).toBe(0);
    expect(readFileSync(recordOf(fx), 'utf8')).toBe('vendor-modules\n');
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(before);

    // The JSON form, on a second crashed merge.
    const other = await merged({ failed: true, deadLock: true });
    const json = await other.fx.spec('', 'merge', ID, '--format', 'json');
    expect(JSON.parse(json.stdout)).toEqual([
      { ok: false, ticket: ID, error: `ticket/${ID} is already merged into main; removed its worktree ${other.tree}` },
    ]);

    // A second merge prints the plain refusal and changes nothing.
    const again = await fx.spec('', 'merge', ID);
    expect(again.stdout).toBe(`${MERGED}\n`);
    expect(again.code).toBe(1);
    expect(existsSync(tree)).toBe(false);
    expect(existsSync(lockOf(fx))).toBe(false);
    expect(readFileSync(recordOf(fx), 'utf8')).toBe('vendor-modules\n');
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(before);
  }, 240_000);

  it('WSP-007/S13 A marker and a dead lock with no worktree are gone after the first re-merge', async () => {
    const { fx, tree } = await merged({ failed: true, deadLock: true, noTree: true });
    expect(existsSync(tree)).toBe(false);
    const before = fx.git('rev-parse', 'HEAD').stdout;
    for (const round of [1, 2]) {
      const out = await fx.spec('', 'merge', ID);
      expect(out.stdout, `retry ${String(round)}`).toBe(`${MERGED}\n`);
      expect(out.code).toBe(1);
      expect(existsSync(failedOf(fx)), `retry ${String(round)}`).toBe(false);
      expect(existsSync(lockOf(fx)), `retry ${String(round)}`).toBe(false);
      expect(readFileSync(recordOf(fx), 'utf8')).toBe('vendor-modules\n');
      expect(fx.git('rev-parse', 'HEAD').stdout).toBe(before);
    }
  }, 240_000);

  it('WSP-007/S14 A leftover worktree with uncommitted changes stays', async () => {
    const { fx, tree } = await merged();
    writeFileSync(join(tree, 'notes.txt'), 'mine\n');
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${MERGED}\n`);
    expect(out.code).toBe(1);
    expect(existsSync(join(tree, 'notes.txt'))).toBe(true);
  }, 240_000);

  it('WSP-007/S15 A leftover worktree behind a busy lock', async () => {
    const { fx, tree } = await merged();
    const holder = trackChild(spawn('sleep', ['600'], { stdio: 'ignore' }));
    writeFileSync(lockOf(fx), `${String(holder.pid)} held\n`);
    // The 15 minutes are not exposed: after the merge-lock wait's reading and the start of the ticket-lock
    // wait, the clock the waits read moves a minute per reading, so the real wait loop ends in seconds.
    let readings = 0;
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      readings++;
      if (readings > 2) now += MIN;
      return now;
    });
    let out;
    try {
      out = await fx.spec('', 'merge', ID);
    } finally {
      clock.mockRestore();
      holder.kill();
    }
    expect(out.stdout).toBe(`${MERGED}; its worktree was not removed: another spec worktree add for ${ID} is still running (pid ${String(holder.pid)})\n`);
    expect(out.code).toBe(1);
    expect(existsSync(tree)).toBe(true);
    expect(readFileSync(lockOf(fx), 'utf8')).toBe(`${String(holder.pid)} held\n`);
  }, 240_000);
});

describe('WSP-002/R3: remove and the leftovers of a merged ticket', () => {
  it('WSP-002/S11 What a merge that ended early left of a merged ticket', async () => {
    const { fx, tree } = await merged({ deadLock: true });
    const out = await fx.spec('', 'worktree', 'remove', ID);
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`${ID}: removed ${tree}; ticket/${ID} is kept\n`);
    expect(existsSync(tree)).toBe(false);
    expect(existsSync(lockOf(fx))).toBe(false);
    expect(readFileSync(recordOf(fx), 'utf8')).toBe('vendor-modules\n');
  }, 240_000);

  it('WSP-002/S12 A setup failure left with no worktree', async () => {
    const fx = project();
    fx.git('branch', `ticket/${ID}`);
    mkdirSync(join(common(fx), 'setup'), { recursive: true });
    writeFileSync(failedOf(fx), 'earlier-token\n');
    const out = await fx.spec('', 'worktree', 'remove', ID);
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`${ID} has no worktree\n`);
    expect(existsSync(failedOf(fx))).toBe(false);
  }, 120_000);
});

describe('WSP-003/R1: list marks a merged ticket’s worktree', () => {
  it('WSP-003/S9 A merged ticket’s worktree is marked, not removed', async () => {
    const { fx, tree } = await merged({ failed: true });
    const other = join(`${realpathSync(fx.repo)}.worktrees`, 'TASK-103');
    const added = fx.git('worktree', 'add', '-q', '-b', 'ticket/TASK-103', other, 'main');
    expect(added.code, added.stderr).toBe(0);
    const text = await fx.spec('', 'worktree', 'list');
    expect(text.code, text.stderr).toBe(0);
    expect(text.stdout).toBe(`${[`TASK-101 done ${tree} (merged into main; spec worktree remove ${ID} removes it)`, `TASK-103 open ${other}`].join('\n')}\n`);
    const json = await fx.spec('', 'worktree', 'list', '--format', 'json');
    const rows = JSON.parse(json.stdout) as Record<string, unknown>[];
    expect(rows).toContainEqual({ ticket: ID, path: tree, status: 'done', merged: true });
    const row = rows.find((r) => r.ticket === 'TASK-103');
    expect(row).toEqual({ ticket: 'TASK-103', path: other, status: 'open' });
    expect(row).not.toHaveProperty('merged');
    expect(existsSync(tree)).toBe(true);
    expect(existsSync(failedOf(fx))).toBe(true);
  }, 240_000);
});

/**
 * TASK-101 done in a tickets folder outside the repository, its branch merged into main by git, and its
 * worktree still there with nothing uncommitted.
 */
function mergedOutside() {
  const fx = project(undefined, (dir) => {
    const outside = `${dir}-tickets`;
    mkdirSync(outside);
    for (const name of readdirSync(join(dir, 'tickets'))) {
      const text = readFileSync(join(dir, 'tickets', name), 'utf8');
      writeFileSync(join(outside, name), name === `${ID}.md` ? text.replace(/^status: .*$/m, 'status: done') : text);
    }
    rmSync(join(dir, 'tickets'), { recursive: true, force: true });
    const config = join(dir, 'spec/config.json');
    const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
    cfg.tickets = { adapter: 'files', dir: `../${basename(dir)}-tickets` };
    writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
  });
  outsideDirs.push(`${fx.repo}-tickets`);
  // The branch is merged into main by git; its worktree is still there.
  const tree = treeOf(fx);
  fx.git('checkout', '-q', '-b', `ticket/${ID}`);
  writeFileSync(join(fx.repo, 'work.txt'), 'work\n');
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', `${ID}: work`);
  fx.git('checkout', '-q', 'main');
  expect(fx.git('merge', '-q', '--no-ff', '-m', `Merge ticket/${ID}`, `ticket/${ID}`).code).toBe(0);
  const added = fx.git('worktree', 'add', '-q', tree, `ticket/${ID}`);
  expect(added.code, added.stderr).toBe(0);
  return { fx, tree };
}

describe('WSP-007/R1: merge of an already merged ticket whose tickets live outside the repository', () => {
  it('WSP-007/S18 Already merged, with tickets in a folder outside the repository', async () => {
    const { fx, tree } = mergedOutside();
    const before = fx.git('rev-parse', 'HEAD').stdout;
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${MERGED}; removed its worktree ${tree}\n`);
    expect(out.code).toBe(1);
    expect(existsSync(tree)).toBe(false);
    expect(fx.git('rev-parse', '--verify', `refs/heads/ticket/${ID}`).code).toBe(0);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(before);
  }, 120_000);
});

describe('WSP-003/R1: list with tickets outside the repository', () => {
  it('WSP-003/S9 A merged ticket’s worktree is marked when the tickets live outside the repository', async () => {
    const { fx, tree } = mergedOutside();
    const text = await fx.spec('', 'worktree', 'list');
    expect(text.code, text.stderr).toBe(0);
    expect(text.stdout).toBe(`${ID} done ${tree} (merged into main; spec worktree remove ${ID} removes it)\n`);
    const json = await fx.spec('', 'worktree', 'list', '--format', 'json');
    expect(JSON.parse(json.stdout)).toEqual([{ ticket: ID, path: tree, status: 'done', merged: true }]);
    expect(existsSync(tree)).toBe(true);
  }, 120_000);
});

const read = (fx: Fx, path: string) => readFileSync(join(fx.repo, path), 'utf8');
const write = (fx: Fx, path: string, text: string) => {
  mkdirSync(join(fx.repo, path, '..'), { recursive: true });
  writeFileSync(join(fx.repo, path), text);
};
const head = (fx: Fx) => fx.git('rev-parse', 'HEAD').stdout.trim();
const porcelain = (fx: Fx) => fx.git('status', '--porcelain').stdout;
/** A commit on main. */
function onMain(fx: Fx, edit: () => void) {
  edit();
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'main moves on');
}
/** Branch `ticket/<id>` from main with the ticket done; back on main. */
function finish(fx: Fx, id: string) {
  fx.git('checkout', '-q', '-b', `ticket/${id}`);
  write(fx, `tickets/${id}.md`, read(fx, `tickets/${id}.md`).replace(/^status: .*$/m, 'status: done'));
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', `${id}: done`);
  fx.git('checkout', '-q', 'main');
}
/** Sets a ticket's status on main. */
const setStatus = (fx: Fx, id: string, status: string) => {
  onMain(fx, () => {
    write(fx, `tickets/${id}.md`, read(fx, `tickets/${id}.md`).replace(/^status: .*$/m, `status: ${status}`));
  });
};

describe('WSP-007: what merge refuses before it merges', () => {
  it('WSP-007/S1 The base branch is not checked out here', async () => {
    const fx = project();
    finish(fx, ID);
    fx.git('checkout', '-q', '-b', 'ticket/PROP-205');
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, merging happens on main; this tree has ticket/PROP-205 checked out\n`);
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S2 Uncommitted changes on the base branch', async () => {
    const fx = project();
    finish(fx, ID);
    const names = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    onMain(fx, () => {
      for (const n of names) write(fx, n, 'one\n');
    });
    for (const n of names) write(fx, n, 'two\n');
    write(fx, 'f.ts', 'new\n');
    const before = head(fx);
    const status = porcelain(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, main has uncommitted changes: a.ts, b.ts, c.ts, d.ts, e.ts\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(porcelain(fx)).toBe(status);
    expect(read(fx, 'a.ts')).toBe('two\n');
  }, 120_000);

  it('WSP-007/S3 A ticket that is not done', async () => {
    const fx = project();
    setStatus(fx, 'TASK-102', 'blocked');
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-102');
    expect(out.stdout).toBe('TASK-102: not merged, TASK-102 is blocked, not done\n');
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
  }, 120_000);

  it('WSP-007/S4 A ticket in progress', async () => {
    const fx = project();
    setStatus(fx, 'TASK-103', 'in_progress');
    const out = await fx.spec('', 'merge', 'TASK-103');
    expect(out.stdout).toBe('TASK-103: not merged, TASK-103 is in progress, not done\n');
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S5 Done is read from the ticket’s live state', async () => {
    const fx = project();
    finish(fx, ID);
    expect(read(fx, `tickets/${ID}.md`)).toMatch(/^status: open$/m);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toMatch(new RegExp(`^${ID}: merged \\(`));
    expect(out.code).toBe(0);
    expect(fx.git('merge-base', '--is-ancestor', `ticket/${ID}`, 'main').code).toBe(0);
  }, 120_000);

  it('WSP-007/S6 Already merged', async () => {
    const fx = project();
    finish(fx, ID);
    expect((await fx.spec('', 'merge', ID)).code).toBe(0);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${MERGED}\n`);
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S7 The ticket has no branch', async () => {
    const fx = project();
    onMain(fx, () => {
      write(fx, 'tickets/TASK-107.md', read(fx, 'tickets/TASK-101.md').replace(/TASK-101/g, 'TASK-107').replace(/^status: .*$/m, 'status: done'));
    });
    const out = await fx.spec('', 'merge', 'TASK-107');
    expect(out.stdout).toBe('TASK-107: not merged, ticket/TASK-107 does not exist\n');
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S8 No such ticket', async () => {
    const fx = project();
    const out = await fx.spec('', 'merge', 'TASK-999');
    expect(out.stdout).toBe('TASK-999: not merged, unknown ticket TASK-999\n');
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S9 No tickets', async () => {
    const fx = project();
    const out = await fx.spec('', 'merge');
    expect(out.stderr.startsWith('usage: spec merge <TICKET>...')).toBe(true);
    expect(out.code).toBe(2);
  }, 120_000);

  it('WSP-007/S10 An argument that is not a ticket ID', async () => {
    const fx = project();
    const out = await fx.spec('', 'merge', 'cart');
    expect(out.stderr.startsWith('Unknown cart.')).toBe(true);
    expect(out.code).toBe(2);
  }, 120_000);

  it('WSP-007/S16 Every argument is checked before anything merges', async () => {
    const fx = project();
    finish(fx, ID);
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID, 'cart');
    expect(out.stderr.startsWith('Unknown cart.')).toBe(true);
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(head(fx)).toBe(before);
    expect(fx.git('merge-base', '--is-ancestor', `ticket/${ID}`, 'main').code).toBe(1);
  }, 120_000);

  it('WSP-007/S17 No test command to run on the merged result', async () => {
    const fx = project();
    finish(fx, ID);
    onMain(fx, () => {
      rmSync(join(fx.repo, 'spec/config.json'));
    });
    const before = head(fx);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, config.json has no testCommand to run on the merged result\n`);
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(porcelain(fx)).toBe('');
    expect(fx.git('rev-parse', '--verify', '-q', 'MERGE_HEAD').code).not.toBe(0);
    expect(fx.git('merge-base', '--is-ancestor', `ticket/${ID}`, 'main').code).toBe(1);
  }, 120_000);

  it('WSP-007/S11 Not a git repository', async () => {
    const fx = project();
    rmSync(join(fx.repo, '.git'), { recursive: true, force: true });
    const out = await fx.spec('', 'merge', ID);
    expect([`${ID}: not merged, ${fx.repo} is not a git repository\n`, `${ID}: not merged, ${realpathSync(fx.repo)} is not a git repository\n`]).toContain(out.stdout);
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-007/S12 Another base branch', async () => {
    const fx = project((cfg) => {
      cfg.baseBranch = 'develop';
    });
    finish(fx, ID);
    const out = await fx.spec('', 'merge', ID);
    expect(out.stdout).toBe(`${ID}: not merged, merging happens on develop; this tree has main checked out\n`);
    expect(out.code).toBe(1);
  }, 120_000);
});
