// INS-018: init and upgrade keep a spec-managed Git hook that serves another project (PROP-113).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, tempDir } from '../helpers';

const HOOKS = ['pre-commit', 'pre-merge-commit', 'commit-msg'] as const;
type Hook = (typeof HOOKS)[number];
const scriptPath = join(REPO, 'plugin/scripts/spec');
const SLOW = 120_000;

const gitIn = (cwd: string, ...args: string[]): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(result.status, `git ${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result.stdout;
};

/** A committed repository with a folder `tmp-probe` in it. */
function scratch(name: string): string {
  const repo = tempDir(`spec-ins018-${name}-`);
  gitIn(repo, 'init', '-q', '-b', 'main');
  gitIn(repo, 'config', 'user.name', 'test');
  gitIn(repo, 'config', 'user.email', 'test@example.com');
  mkdirSync(join(repo, 'tmp-probe'));
  writeFileSync(join(repo, 'tmp-probe/README.md'), 'probe\n');
  writeFileSync(join(repo, 'README.md'), 'repository\n');
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '-q', '-m', 'baseline');
  return repo;
}

const hookPath = (repo: string, name: Hook): string => join(repo, '.git/hooks', name);
const hookText = (repo: string, name: Hook): string => readFileSync(hookPath(repo, name), 'utf8');

/**
 * A hook file as a spec build writes it, with a stale comment so a rewrite is visible. `project` is the
 * project path it records; null leaves the record out. `extra` is one more line after the marker.
 */
const hookBody = (name: Hook, project: string | null, extra = ''): string =>
  `#!/bin/sh\n# spec-managed-hook v1\n# stale body\n${extra}worktree_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0\n${
    project === null ? '' : `project_root="$worktree_root"/'${project}'\n`
  }cli="$project_root/.spec/bin/spec"\nexec "$cli" hook git ${name} "$@" --root "$project_root/spec"\n`;

const putHook = (repo: string, name: Hook, text: string): void => {
  mkdirSync(join(repo, '.git/hooks'), { recursive: true });
  writeFileSync(hookPath(repo, name), text, { mode: 0o755 });
};
const putAll = (repo: string, project: string | null): Record<Hook, string> => {
  const texts = {} as Record<Hook, string>;
  for (const name of HOOKS) {
    texts[name] = hookBody(name, project);
    putHook(repo, name, texts[name]);
  }
  return texts;
};
const records = (repo: string, name: Hook, project: string): boolean => hookText(repo, name).includes(`project_root="$worktree_root"/'${project}'\n`);

const initIn = (cwd: string, project: string, ...extra: string[]) => run({ argv: ['init', project, '--name', 'probe', ...extra], env: {}, cwd, scriptPath });
const upgradeIn = (cwd: string, project: string, ...extra: string[]) =>
  run({ argv: ['upgrade', project, '--from', join(REPO, 'plugin/scripts'), ...extra], env: {}, cwd, scriptPath });

/** Initializes `project` so a later upgrade has something to upgrade; the hooks it wrote are replaced by the caller. */
const prepare = async (repo: string, project: string): Promise<void> => {
  const out = await initIn(repo, project);
  expect(out.code, out.stdout + out.stderr).toBe(0);
};

const keptNote = (name: Hook, served: string, mine: string): string =>
  `kept .git/hooks/${name}; it serves the spec project at ${served}, not this project at ${mine}; to repoint it, delete that file and run spec upgrade in ${mine}`;
const unreadableNote = (name: Hook, mine: string): string =>
  `kept .git/hooks/${name}; its spec project path cannot be read; to repoint it, delete that file and run spec upgrade in ${mine}`;
const tookOverNote = (name: Hook, gone: string): string => `took over .git/hooks/${name} from the spec project at ${gone}, which no longer exists`;

interface Json {
  written?: string[];
  updated?: string[];
  notes: string[];
}
const parsed = (stdout: string): Json => JSON.parse(stdout) as Json;

describe('INS-018 Keep Git hooks that serve another project', () => {
  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: init in the nested folder', async () => {
    const repo = scratch('s1-init');
    const before = putAll(repo, '.');
    const out = await initIn(repo, 'tmp-probe');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(out.stdout).not.toContain(`wrote .git/hooks/${name}`);
      expect(out.stdout).toContain(`note: ${keptNote(name, '.', 'tmp-probe')}\n`);
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: json notes of init', async () => {
    const repo = scratch('s1-init-json');
    const before = putAll(repo, '.');
    const out = await initIn(repo, 'tmp-probe', '--format', 'json');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    const result = parsed(out.stdout);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(result.written).not.toContain(`.git/hooks/${name}`);
      expect(result.notes).toContain(keptNote(name, '.', 'tmp-probe'));
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: upgrade in the nested folder', async () => {
    const repo = scratch('s1-upgrade');
    await prepare(repo, 'tmp-probe');
    const before = putAll(repo, '.');
    const out = await upgradeIn(repo, 'tmp-probe');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(out.stdout).not.toContain(`updated .git/hooks/${name}`);
      expect(out.stdout).toContain(`note: ${keptNote(name, '.', 'tmp-probe')}\n`);
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: json notes of upgrade', async () => {
    const repo = scratch('s1-upgrade-json');
    await prepare(repo, 'tmp-probe');
    const before = putAll(repo, '.');
    const out = await upgradeIn(repo, 'tmp-probe', '--format', 'json');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    const result = parsed(out.stdout);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(result.updated).not.toContain(`.git/hooks/${name}`);
      expect(result.notes).toContain(keptNote(name, '.', 'tmp-probe'));
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: the other way round, init at the root', async () => {
    const repo = scratch('s1-reverse-init');
    const before = putAll(repo, 'tmp-probe');
    const out = await initIn(repo, '.');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(out.stdout).not.toContain(`wrote .git/hooks/${name}`);
      expect(out.stdout).toContain(`note: ${keptNote(name, 'tmp-probe', '.')}\n`);
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: the other way round, upgrade at the root', async () => {
    const repo = scratch('s1-reverse-upgrade');
    await prepare(repo, '.');
    const before = putAll(repo, 'tmp-probe');
    const out = await upgradeIn(repo, '.', '--format', 'json');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    const result = parsed(out.stdout);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(result.updated).not.toContain(`.git/hooks/${name}`);
      expect(result.notes).toContain(keptNote(name, 'tmp-probe', '.'));
    }
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: each hook file is decided on its own', async () => {
    const repo = scratch('s1-each');
    const served = hookBody('pre-commit', '.');
    putHook(repo, 'pre-commit', served);
    const out = await initIn(repo, 'tmp-probe');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    expect(hookText(repo, 'pre-commit')).toBe(served);
    expect(out.stdout).toContain(`note: ${keptNote('pre-commit', '.', 'tmp-probe')}\n`);
    expect(out.stdout).toContain('wrote .git/hooks/commit-msg');
    expect(records(repo, 'commit-msg', 'tmp-probe')).toBe(true);
  }, SLOW);

  it('INS-018/S1 A nested project\'s init keeps hooks that serve another project: deleting the hooks and running upgrade repoints them', async () => {
    const repo = scratch('s1-repoint');
    await prepare(repo, 'tmp-probe');
    putAll(repo, '.');
    const kept = await upgradeIn(repo, 'tmp-probe');
    expect(kept.code, kept.stdout + kept.stderr).toBe(0);
    for (const name of HOOKS) expect(records(repo, name, '.')).toBe(true);
    // The person deletes the three files.
    for (const name of HOOKS) rmSync(hookPath(repo, name));
    for (const name of HOOKS) expect(existsSync(hookPath(repo, name))).toBe(false);
    const out = await upgradeIn(repo, 'tmp-probe');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) expect(records(repo, name, 'tmp-probe')).toBe(true);
  }, SLOW);

  it('INS-018/S2 A spec-managed hook whose project is gone may be taken over: init', async () => {
    const repo = scratch('s2-init');
    putAll(repo, 'gone-probe');
    const out = await initIn(repo, '.');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(records(repo, name, '.')).toBe(true);
      expect(hookText(repo, name)).not.toContain('# stale body');
      expect(out.stdout).toContain(`wrote .git/hooks/${name}\n`);
      expect(out.stdout).toContain(`note: ${tookOverNote(name, 'gone-probe')}\n`);
    }
  }, SLOW);

  it('INS-018/S2 A spec-managed hook whose project is gone may be taken over: upgrade, json notes', async () => {
    const repo = scratch('s2-upgrade');
    await prepare(repo, '.');
    putAll(repo, 'gone-probe');
    const out = await upgradeIn(repo, '.', '--format', 'json');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    const result = parsed(out.stdout);
    for (const name of HOOKS) {
      expect(records(repo, name, '.')).toBe(true);
      expect(hookText(repo, name)).not.toContain('# stale body');
      expect(result.updated).toContain(`.git/hooks/${name}`);
      expect(result.notes).toContain(tookOverNote(name, 'gone-probe'));
    }
  }, SLOW);

  it('INS-018/S2 A spec-managed hook whose project is gone may be taken over: upgrade lists updated lines', async () => {
    const repo = scratch('s2-upgrade-text');
    await prepare(repo, '.');
    putAll(repo, 'gone-probe');
    const out = await upgradeIn(repo, '.');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(out.stdout).toContain(`updated .git/hooks/${name}\n`);
      expect(out.stdout).toContain(`note: ${tookOverNote(name, 'gone-probe')}\n`);
    }
  }, SLOW);

  it('INS-018/S2 A spec-managed hook whose project is gone may be taken over: a linked worktree still has the folder', async () => {
    const repo = scratch('s2-linked');
    const linked = join(tempDir('spec-ins018-s2-linked-wt-'), 'wt');
    gitIn(repo, 'worktree', 'add', '-q', '-b', 'other', linked);
    mkdirSync(join(linked, 'gone-probe'));
    const before = putAll(repo, 'gone-probe');
    const out = await initIn(repo, '.');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(before[name]);
      expect(out.stdout).not.toContain(`wrote .git/hooks/${name}`);
      expect(out.stdout).toContain(`note: ${keptNote(name, 'gone-probe', '.')}\n`);
      expect(out.stdout).not.toContain('took over');
    }
  }, SLOW);

  it('INS-018/S3 A spec-managed hook with an unreadable project path is kept: init', async () => {
    const repo = scratch('s3-init');
    const sentinel = join(tempDir('spec-ins018-s3-sentinel-'), 'ran');
    const run1 = `touch '${sentinel}'\n`;
    const texts: Record<Hook, string> = {
      'pre-commit': hookBody('pre-commit', null, run1),
      'pre-merge-commit': hookBody('pre-merge-commit', join(repo, 'tmp-probe'), run1),
      'commit-msg': hookBody('commit-msg', `../${basename(repo)}/tmp-probe`, run1),
    };
    for (const name of HOOKS) putHook(repo, name, texts[name]);
    const out = await initIn(repo, 'tmp-probe');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(texts[name]);
      expect(out.stdout).not.toContain(`wrote .git/hooks/${name}`);
      expect(out.stdout).toContain(`note: ${unreadableNote(name, 'tmp-probe')}\n`);
    }
    expect(existsSync(sentinel)).toBe(false);
  }, SLOW);

  it('INS-018/S3 A spec-managed hook with an unreadable project path is kept: upgrade, json notes', async () => {
    const repo = scratch('s3-upgrade');
    await prepare(repo, 'tmp-probe');
    const sentinel = join(tempDir('spec-ins018-s3-sentinel-'), 'ran');
    const run1 = `touch '${sentinel}'\n`;
    const texts: Record<Hook, string> = {
      'pre-commit': hookBody('pre-commit', null, run1),
      'pre-merge-commit': hookBody('pre-merge-commit', join(repo, 'tmp-probe'), run1),
      'commit-msg': hookBody('commit-msg', `../${basename(repo)}/tmp-probe`, run1),
    };
    for (const name of HOOKS) putHook(repo, name, texts[name]);
    const out = await upgradeIn(repo, 'tmp-probe', '--format', 'json');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    const result = parsed(out.stdout);
    for (const name of HOOKS) {
      expect(hookText(repo, name)).toBe(texts[name]);
      expect(result.updated).not.toContain(`.git/hooks/${name}`);
      expect(result.notes).toContain(unreadableNote(name, 'tmp-probe'));
    }
    expect(existsSync(sentinel)).toBe(false);
  }, SLOW);

  describe('INS-018/S4 Hooks for the same project are still updated however the project is named', () => {
    const namings: { title: string; name: (repo: string) => string }[] = [
      { title: 'a relative path', name: () => 'tmp-probe' },
      { title: 'an absolute path', name: (repo) => join(repo, 'tmp-probe') },
      {
        title: 'a path through a symlink',
        name: (repo) => {
          const link = join(tempDir('spec-ins018-s4-link-'), 'probe-link');
          symlinkSync(join(repo, 'tmp-probe'), link, 'dir');
          return link;
        },
      },
    ];

    for (const naming of namings) {
      it(`INS-018/S4 Hooks for the same project are still updated however the project is named: init by ${naming.title}`, async () => {
        const repo = scratch('s4-init');
        putAll(repo, 'tmp-probe');
        const out = await initIn(repo, naming.name(repo));
        expect(out.code, out.stdout + out.stderr).toBe(0);
        for (const name of HOOKS) {
          expect(records(repo, name, 'tmp-probe')).toBe(true);
          expect(hookText(repo, name)).not.toContain('# stale body');
          expect(out.stdout).toContain(`wrote .git/hooks/${name}\n`);
        }
        expect(out.stdout).not.toContain('kept .git/hooks/');
        expect(out.stdout).not.toContain('took over');
      }, SLOW);

      it(`INS-018/S4 Hooks for the same project are still updated however the project is named: upgrade by ${naming.title}`, async () => {
        const repo = scratch('s4-upgrade');
        await prepare(repo, 'tmp-probe');
        putAll(repo, 'tmp-probe');
        const out = await upgradeIn(repo, naming.name(repo));
        expect(out.code, out.stdout + out.stderr).toBe(0);
        for (const name of HOOKS) {
          expect(records(repo, name, 'tmp-probe')).toBe(true);
          expect(hookText(repo, name)).not.toContain('# stale body');
          expect(out.stdout).toContain(`updated .git/hooks/${name}\n`);
        }
        expect(out.stdout).not.toContain('kept .git/hooks/');
        expect(out.stdout).not.toContain('took over');
      }, SLOW);
    }
  });
});

describe('INS-015/S3 Git hooks use the common git directory and preserve existing hooks', () => {
  it('INS-015/S3 Git hooks use the common git directory and preserve existing hooks: an existing hook of this same project is updated', async () => {
    const repo = scratch('ins015-s3');
    await prepare(repo, '.');
    const stale = hookBody('pre-commit', '.');
    putHook(repo, 'pre-commit', stale);
    const out = await initIn(repo, '.');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    expect(hookText(repo, 'pre-commit')).not.toBe(stale);
    expect(hookText(repo, 'pre-commit')).not.toContain('# stale body');
    expect(records(repo, 'pre-commit', '.')).toBe(true);
    expect(out.stdout).toContain('wrote .git/hooks/pre-commit\n');
    expect(out.stdout).not.toContain('kept .git/hooks/');
  }, SLOW);
});
