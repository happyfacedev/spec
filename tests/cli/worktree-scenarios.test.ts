// WSP-002 and WSP-003: spec worktree list and spec worktree remove, scenario by scenario, in real
// git. Each test runs the CLI in-process on a throwaway copy of chat-mini; its ticket worktrees go
// beside it, in `<repo>.worktrees`, as git reports them.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE, REPO, gitFixture } from '../helpers';

const JSON_ADAPTER = join(REPO, 'examples/ticket-adapters/json-file.mjs');
const USAGE_LINE = 'usage: spec worktree add <TICKET> | remove <TICKET> | list';

const made: (() => void)[] = [];
afterAll(() => {
  for (const done of made) done();
});

/** A chat-mini ticket file with its status and stage set. */
const ticketText = (id: string, status: 'open' | 'in_progress', stage: string | null): string =>
  readFileSync(join(FIXTURE, 'tickets', `${id}.md`), 'utf8')
    .replace(/^status: .*$/m, `status: ${status}`)
    .replace(/^stage: .*$/m, `stage: ${stage ?? 'null'}`);

/** Edits a copy's spec/config.json before its one commit. */
function setConfig(dir: string, edit: (cfg: Record<string, unknown>) => void): void {
  const path = join(dir, 'spec/config.json');
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  edit(cfg);
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
}

/** BUG-301 in progress in the repository's own tickets folder. */
const bugInProgress = (dir: string): void => {
  writeFileSync(join(dir, 'tickets/BUG-301.md'), ticketText('BUG-301', 'in_progress', 'tester'));
};

/** A src/export.ts that the worktree can change without a commit. */
const withSrcExport = (dir: string): void => {
  writeFileSync(join(dir, 'src/export.ts'), 'export const format = 1;\n');
};

/** Tickets in a folder beside the repository: tickets.dir is "../<name>-tickets", and that folder holds these files. */
const outside =
  (tickets: Record<string, string>) =>
  (dir: string): void => {
    rmSync(join(dir, 'tickets'), { recursive: true, force: true });
    mkdirSync(`${dir}-tickets`);
    for (const [id, text] of Object.entries(tickets)) writeFileSync(join(`${dir}-tickets`, `${id}.md`), text);
    setConfig(dir, (cfg) => {
      cfg.tickets = { adapter: 'files', dir: `../${basename(dir)}-tickets` };
    });
  };

/** Tickets in a tracker: the example JSON adapter over .tracker.json, and no ticket files in the repository. */
const tracker =
  (tickets: Record<string, string>) =>
  (dir: string): void => {
    rmSync(join(dir, 'tickets'), { recursive: true, force: true });
    writeFileSync(join(dir, '.tracker.json'), JSON.stringify(tickets));
    setConfig(dir, (cfg) => {
      cfg.tickets = { adapter: 'command', command: `node ${JSON_ADAPTER} .tracker.json` };
    });
  };

interface Repo {
  readonly fx: ReturnType<typeof gitFixture>;
  /** Makes the ticket's worktree on ticket/<ID>, cut from main, at <repo>.worktrees/<ID>, and returns its path. */
  readonly tree: (id: string) => string;
}

/** A throwaway copy of chat-mini with `setup` applied before its one commit; everything is removed after. */
function repo(prefix: string, setup?: (dir: string) => void): Repo {
  const fx = gitFixture(prefix, { setup });
  // git reports real paths (macOS: /private/var for /var).
  const trees = `${realpathSync(fx.repo)}.worktrees`;
  made.push(() => {
    rmSync(trees, { recursive: true, force: true });
    rmSync(`${fx.repo}-tickets`, { recursive: true, force: true });
    fx.cleanup();
  });
  return {
    fx,
    tree: (id) => {
      const path = join(trees, id);
      const r = fx.git('worktree', 'add', '-q', '-b', `ticket/${id}`, path, 'main');
      if (r.code !== 0) throw new Error(`git worktree add ${id}: ${r.stderr}`);
      return path;
    },
  };
}

/** The CLI run inside a tree, as a harness session there would. */
const specIn = (dir: string, ...argv: string[]) => run({ argv: [...argv, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined });

describe('WSP-003: List ticket worktrees', () => {
  it('WSP-003/S1 No ticket worktrees', async () => {
    const r = repo('spec-wt-list-s1');
    const out = await r.fx.spec('', 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe('no ticket worktrees\n');
  }, 30_000);

  it('WSP-003/S2 One line per ticket worktree', async () => {
    const r = repo('spec-wt-list-s2', bugInProgress);
    const bug = r.tree('BUG-301');
    const task = r.tree('TASK-103');
    const out = await r.fx.spec('', 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`BUG-301 in_progress ${bug}\nTASK-103 open ${task}\n`);
  }, 30_000);

  it('WSP-003/S3 The JSON form', async () => {
    const r = repo('spec-wt-list-s3', bugInProgress);
    const bug = r.tree('BUG-301');
    const out = await r.fx.spec('', 'worktree', 'list', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual([{ ticket: 'BUG-301', path: bug, status: 'in_progress' }]);
  }, 30_000);

  it('WSP-003/S4 The main tree on a ticket branch is listed too', async () => {
    const r = repo('spec-wt-list-s4');
    r.fx.git('checkout', '-q', '-b', 'ticket/PROP-205');
    const out = await r.fx.spec('', 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n')).toContain(`PROP-205 open ${realpathSync(r.fx.repo)}`);
  }, 30_000);

  it('WSP-003/S5 A branch with no ticket', async () => {
    const r = repo('spec-wt-list-s5');
    const tree = r.tree('TASK-900');
    const text = await r.fx.spec('', 'worktree', 'list');
    expect(text.code, text.stderr).toBe(0);
    expect(text.stdout.split('\n')).toContain(`TASK-900 ? ${tree}`);
    const json = await r.fx.spec('', 'worktree', 'list', '--format', 'json');
    expect(json.code, json.stderr).toBe(0);
    expect(JSON.parse(json.stdout)).toContainEqual({ ticket: 'TASK-900', path: tree, status: null });
  }, 30_000);

  it('WSP-003/S6 An unknown subcommand', async () => {
    const r = repo('spec-wt-list-s6');
    const out = await r.fx.spec('', 'worktree', 'prune');
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr.slice(0, USAGE_LINE.length)).toBe(USAGE_LINE);
  }, 30_000);

  it('WSP-003/S7 Tickets in a folder outside the repository', async () => {
    const r = repo('spec-wt-list-s7', outside({ 'BUG-301': ticketText('BUG-301', 'in_progress', 'tester') }));
    const bug = r.tree('BUG-301');
    const out = await r.fx.spec('', 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`BUG-301 in_progress ${bug}\n`);
  }, 30_000);

  it('WSP-003/S8 Tickets in a tracker', async () => {
    const r = repo('spec-wt-list-s8', tracker({ 'BUG-301': ticketText('BUG-301', 'in_progress', 'tester') }));
    const bug = r.tree('BUG-301');
    const out = await r.fx.spec('', 'worktree', 'list');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`BUG-301 in_progress ${bug}\n`);
  }, 30_000);
});

describe("WSP-002: Remove a ticket's worktree", () => {
  it('WSP-002/S1 Remove a worktree and keep its branch', async () => {
    const r = repo('spec-wt-rm-s1');
    const bug = r.tree('BUG-301');
    writeFileSync(join(bug, 'notes.txt'), 'work\n');
    r.fx.git('-C', bug, 'add', '-A');
    r.fx.git('-C', bug, 'commit', '-q', '-m', 'BUG-301: work');
    const tip = r.fx.git('rev-parse', 'ticket/BUG-301').stdout.trim();
    const out = await r.fx.spec('', 'worktree', 'remove', 'BUG-301');
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(bug)).toBe(false);
    expect(r.fx.git('rev-parse', 'ticket/BUG-301').stdout.trim()).toBe(tip);
    expect(out.stdout).toBe(`BUG-301: removed ${bug}; ticket/BUG-301 is kept\n`);
  }, 30_000);

  it('WSP-002/S2 A ticket with no worktree', async () => {
    const r = repo('spec-wt-rm-s2');
    const out = await r.fx.spec('', 'worktree', 'remove', 'TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('TASK-101 has no worktree\n');
  }, 30_000);

  it('WSP-002/S3 Removing the tree the command runs in', async () => {
    const r = repo('spec-wt-rm-s3');
    const tree = r.tree('TASK-101');
    const out = await specIn(tree, 'worktree', 'remove', 'TASK-101');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe("TASK-101's worktree is this one; run remove from another tree\n");
  }, 30_000);

  it('WSP-002/S4 Uncommitted changes keep the worktree', async () => {
    const r = repo('spec-wt-rm-s4', withSrcExport);
    const tree = r.tree('BUG-301');
    writeFileSync(join(tree, 'src/export.ts'), 'export const format = 2;\n');
    const out = await r.fx.spec('', 'worktree', 'remove', 'BUG-301');
    expect(out.code).toBe(1);
    const head = `git could not remove ${tree}: `;
    expect(out.stderr.startsWith(head)).toBe(true);
    expect(out.stderr.slice(head.length).trim()).not.toBe('');
    expect(existsSync(tree)).toBe(true);
    expect(readFileSync(join(tree, 'src/export.ts'), 'utf8')).toBe('export const format = 2;\n');
  }, 30_000);

  it('WSP-002/S5 No ticket, or not a ticket ID', async () => {
    const r = repo('spec-wt-rm-s5');
    for (const argv of [['worktree', 'remove'], ['worktree', 'remove', 'cart']]) {
      const out = await r.fx.spec('', ...argv);
      expect(out.code).toBe(2);
      expect(out.stdout).toBe('');
      expect(out.stderr.slice(0, USAGE_LINE.length)).toBe(USAGE_LINE);
    }
  }, 30_000);

  it('WSP-002/S6 Tickets in a folder outside the repository', async () => {
    const r = repo('spec-wt-rm-s6', outside({ 'BUG-301': ticketText('BUG-301', 'in_progress', 'tester') }));
    const tree = r.tree('BUG-301');
    const out = await r.fx.spec('', 'worktree', 'remove', 'BUG-301');
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(tree)).toBe(false);
    expect(out.stdout).toBe(`BUG-301: removed ${tree}; ticket/BUG-301 is kept\n`);
  }, 30_000);

  it('WSP-002/S7 Tickets in a tracker', async () => {
    const r = repo('spec-wt-rm-s7', tracker({ 'TASK-103': ticketText('TASK-103', 'open', null) }));
    const tree = r.tree('TASK-103');
    const out = await r.fx.spec('', 'worktree', 'remove', 'TASK-103');
    expect(out.code, out.stderr).toBe(0);
    expect(existsSync(tree)).toBe(false);
    expect(out.stdout).toBe(`TASK-103: removed ${tree}; ticket/TASK-103 is kept\n`);
  }, 30_000);
});
