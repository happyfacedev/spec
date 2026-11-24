import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { tempDir } from '../tmp';
import { commonDir, git, isRepo, parseCatFileBatchOutput, withCommandGitCache } from '../../src/io/git';

const fixedCount = (calls: readonly (readonly unknown[])[], fact: string): number =>
  calls.filter((call) => call[0] === 'git' && Array.isArray(call[1]) && call[1].length === 2 && call[1][0] === 'rev-parse' && call[1][1] === fact).length;

const bundleCount = (calls: readonly (readonly unknown[])[]): number =>
  calls.filter((call) => {
    if (call[0] !== 'git' || !Array.isArray(call[1])) return false;
    const args = call[1] as readonly unknown[];
    return args[0] === 'rev-parse'
      && ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'].every((fact) => args.includes(fact));
  }).length;

describe('test worker Git path', () => {
  it('uses the real Git binary first when global setup found it', () => {
    const directory = process.env['SPEC_TEST_REAL_GIT_DIR'];
    if (directory === undefined) return;
    expect(process.env.PATH?.split(delimiter)[0]).toBe(directory);
    expect(realpathSync(join(directory, 'git'))).not.toBe('/usr/bin/git');
  });
});

describe('command-scoped fixed Git facts', () => {
  it('reuses successful facts once per directory and command', () => {
    const repo = tempDir('git-facts-');
    const nested = join(repo, 'nested');
    mkdirSync(nested);
    expect(git(repo, ['init', '-q']).code).toBe(0);
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        expect(isRepo(repo)).toBe(true);
        expect(isRepo(repo)).toBe(true);
        expect(commonDir(repo)).not.toBeNull();
        expect(commonDir(repo)).not.toBeNull();
        expect(git(repo, ['rev-parse', '--show-toplevel']).code).toBe(0);
        expect(git(repo, ['rev-parse', '--show-toplevel']).code).toBe(0);
        expect(git(repo, ['rev-parse', '--show-prefix']).code).toBe(0);
        expect(git(repo, ['rev-parse', '--show-prefix']).code).toBe(0);
        expect(isRepo(nested)).toBe(true);
        expect(isRepo(nested)).toBe(true);
      });
      expect(bundleCount(spawn.mock.calls)).toBe(2);
      expect(fixedCount(spawn.mock.calls, '--git-dir')).toBe(0);
      expect(fixedCount(spawn.mock.calls, '--git-common-dir')).toBe(0);
      expect(fixedCount(spawn.mock.calls, '--show-toplevel')).toBe(0);
      expect(fixedCount(spawn.mock.calls, '--show-prefix')).toBe(0);

      withCommandGitCache(() => {
        expect(isRepo(repo)).toBe(true);
      });
      expect(bundleCount(spawn.mock.calls)).toBe(3);
    } finally {
      spawn.mockRestore();
    }
  });

  it('does not cache failures and drops facts after init', () => {
    const repo = tempDir('git-facts-init-');
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        expect(isRepo(repo)).toBe(false);
        expect(isRepo(repo)).toBe(false);
        expect(git(repo, ['init', '-q']).code).toBe(0);
        expect(isRepo(repo)).toBe(true);
        expect(isRepo(repo)).toBe(true);
      });
      expect(bundleCount(spawn.mock.calls)).toBe(2);
      expect(fixedCount(spawn.mock.calls, '--git-dir')).toBe(2);
      withCommandGitCache(() => {
        expect(isRepo(repo)).toBe(true);
      });
      expect(bundleCount(spawn.mock.calls)).toBe(3);
    } finally {
      spawn.mockRestore();
    }
  });

  it('falls back to single facts for bare repositories and paths inside the git directory', () => {
    const bare = tempDir('git-facts-bare-');
    const repo = tempDir('git-facts-metadata-');
    expect(git(bare, ['init', '--bare', '-q']).code).toBe(0);
    expect(git(repo, ['init', '-q']).code).toBe(0);

    const directories = [bare, join(repo, '.git')];
    const facts = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'];
    const oracle = new Map(directories.map((directory) => [
      directory,
      new Map(facts.map((fact) => [fact, git(directory, ['rev-parse', fact], {})])),
    ]));
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        for (const directory of directories) {
          expect(isRepo(directory)).toBe(true);
          expect(commonDir(directory)).not.toBeNull();
          for (const fact of facts) {
            const actual = git(directory, ['rev-parse', fact]);
            expect(actual.code).toBe(oracle.get(directory)?.get(fact)?.code);
            expect(actual.stdout).toBe(oracle.get(directory)?.get(fact)?.stdout);
          }
        }
      });
      expect(bundleCount(spawn.mock.calls)).toBe(2);
      for (const fact of facts) expect(fixedCount(spawn.mock.calls, fact)).toBe(2);
    } finally {
      spawn.mockRestore();
    }
  });

  it('refuses a combined answer whose path contains a newline and matches single queries', () => {
    const parent = tempDir('git-facts-paths-');
    const repositories = [join(parent, 'space path'), join(parent, 'line\nbreak')];
    for (const repo of repositories) {
      mkdirSync(repo);
      expect(git(repo, ['init', '-q', '-b', 'main']).code).toBe(0);
    }
    const facts = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'];
    const oracle = new Map(repositories.map((repo) => [
      repo,
      new Map(facts.map((fact) => [fact, git(repo, ['rev-parse', fact], {}).stdout])),
    ]));
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        for (const repo of repositories) {
          for (const fact of facts) {
            expect(git(repo, ['rev-parse', fact]).stdout).toBe(oracle.get(repo)?.get(fact));
          }
        }
      });
      expect(bundleCount(spawn.mock.calls)).toBe(2);
      for (const fact of facts) expect(fixedCount(spawn.mock.calls, fact)).toBe(1);
    } finally {
      spawn.mockRestore();
    }
  });

  it('drops successful facts when init creates a nested repository', () => {
    const repo = tempDir('git-facts-parent-');
    const nested = join(repo, 'nested');
    mkdirSync(nested);
    expect(git(repo, ['init', '-q']).code).toBe(0);
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        expect(commonDir(nested)).toBe(join(repo, '.git'));
        expect(commonDir(nested)).toBe(join(repo, '.git'));
        expect(git(nested, ['init', '-q']).code).toBe(0);
        expect(commonDir(nested)).toBe(join(nested, '.git'));
        expect(commonDir(nested)).toBe(join(nested, '.git'));
      });
      expect(bundleCount(spawn.mock.calls)).toBe(2);
    } finally {
      spawn.mockRestore();
    }
  });

  it('matches single queries and invalidates repository facts around worktree changes', () => {
    const repo = tempDir('git-facts-worktree-');
    const tree = join(tempDir('git-facts-tree-'), 'checkout');
    expect(git(repo, ['init', '-q', '-b', 'main']).code).toBe(0);
    expect(git(repo, ['config', 'user.name', 'test']).code).toBe(0);
    expect(git(repo, ['config', 'user.email', 'test@example.com']).code).toBe(0);
    writeFileSync(join(repo, 'file'), 'content\n');
    expect(git(repo, ['add', 'file']).code).toBe(0);
    expect(git(repo, ['commit', '-q', '-m', 'fixture']).code).toBe(0);

    const facts = ['--git-dir', '--git-common-dir', '--show-toplevel', '--show-prefix'];
    const rootOracle = new Map(facts.map((fact) => [fact, git(repo, ['rev-parse', fact], {}).stdout]));
    const childProcess = process.getBuiltinModule('node:child_process');
    const spawn = vi.spyOn(childProcess, 'spawnSync');
    try {
      withCommandGitCache(() => {
        for (const fact of facts) {
          expect(git(repo, ['rev-parse', fact]).stdout).toBe(rootOracle.get(fact));
        }
        expect(git(repo, ['worktree', 'add', '-q', '-b', 'ticket/TASK-006', tree, 'HEAD']).code).toBe(0);
        for (const fact of facts) {
          const oracle = git(tree, ['rev-parse', fact], {});
          const combined = git(tree, ['rev-parse', fact]);
          expect(combined.code).toBe(oracle.code);
          expect(combined.stdout).toBe(oracle.stdout);
        }
        expect(git(repo, ['rev-parse', '--show-toplevel']).stdout.trim()).toBe(realpathSync(repo));
        expect(git(tree, ['rev-parse', '--show-toplevel']).stdout.trim()).toBe(realpathSync(tree));
        expect(git(repo, ['worktree', 'remove', tree]).code).toBe(0);
        expect(git(tree, ['rev-parse', '--show-toplevel']).code).not.toBe(0);
      });
      expect(bundleCount(spawn.mock.calls)).toBe(4);
      for (const fact of facts) {
        expect(fixedCount(spawn.mock.calls, fact)).toBe(fact === '--show-toplevel' ? 2 : 1);
      }
    } finally {
      spawn.mockRestore();
    }
  });

  it('skips an ambiguous cat-file header and reads the next object', () => {
    const response = Buffer.from('short-id ambiguous\nnext-id blob 3\nabc\n');
    const objects = parseCatFileBatchOutput(response, ['short-id', 'next-id']);
    expect(objects[0]).toBeNull();
    expect(objects[1]?.type).toBe('blob');
    expect(Buffer.from(objects[1]?.contents ?? []).toString('utf8')).toBe('abc');
  });
});
