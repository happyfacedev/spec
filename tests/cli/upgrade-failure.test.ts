// INS-013/R7, S29-S33: a failed copy or rename during `spec upgrade` leaves the old .spec/bin and nothing else.
// INS-013/R8, S34: when the restore fails too, the old bundle stays as a named backup.
// The failures are injected into the file system the CLI uses (node:fs, in this process): a source file that
// cannot be read, a disk that fills at the second write into .spec/bin, a rename onto the launcher that fails once.
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REPO, tempDir as makeTempDir } from '../helpers';

const faults = vi.hoisted(() => ({
  /** Reads and copies of `name` inside one of `dirs` fail with EACCES. */
  unreadable: null as { dirs: string[]; name: string } | null,
  /** The first rename onto one of these paths fails with EIO. */
  renameFails: null as string[] | null,
  /** The second write of a file into one of `dirs` stores a few bytes and then fails with ENOSPC. */
  full: null as { dirs: string[]; writes: number } | null,
  /** Once the launcher rename has failed, every rename or copy onto one of these paths fails with EROFS (the restore). */
  restoreFails: null as { paths: string[]; armed: boolean } | null,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const nodePath = await import('node:path');
  const basename = (value: string): string => nodePath.basename(value);
  const dirname = (value: string): string => nodePath.dirname(value);
  type Fn = (...args: unknown[]) => unknown;
  const fail = (code: string, message: string): Error => Object.assign(new Error(`${code}: ${message}`), { code });
  const readGuard = <T>(fn: T, positions: number[]): T =>
    ((...args: unknown[]) => {
      const f = faults.unreadable;
      for (const i of positions) {
        const path = args[i];
        if (f && typeof path === 'string' && basename(path) === f.name && f.dirs.includes(dirname(path))) throw fail('EACCES', `permission denied, open '${path}'`);
      }
      return (fn as unknown as Fn)(...args);
    }) as unknown as T;
  const writeGuard = <T>(fn: T, destination: number): T =>
    ((...args: unknown[]) => {
      const f = faults.full;
      const path = args[destination];
      if (f && typeof path === 'string' && f.dirs.includes(dirname(path))) {
        f.writes += 1;
        if (f.writes === 2) {
          actual.writeFileSync(path, 'partial');
          throw fail('ENOSPC', 'no space left on device, write');
        }
      }
      return (fn as unknown as Fn)(...args);
    }) as unknown as T;
  const restoreGuard = <T>(fn: T): T =>
    ((...args: unknown[]) => {
      const path = args[1];
      const f = faults.restoreFails;
      if (f?.armed && typeof path === 'string' && f.paths.includes(path)) throw fail('EROFS', `restore refused, read-only file system '${path}'`);
      return (fn as unknown as Fn)(...args);
    }) as unknown as T;
  const renameGuard = <T>(fn: T): T =>
    restoreGuard(((...args: unknown[]) => {
      const path = args[1];
      if (faults.renameFails && typeof path === 'string' && faults.renameFails.includes(path)) {
        faults.renameFails = null;
        if (faults.restoreFails) faults.restoreFails.armed = true;
        throw fail('EIO', `i/o error, rename '${String(args[0])}' -> '${path}'`);
      }
      return (fn as unknown as Fn)(...args);
    }) as unknown as T);
  return {
    ...actual,
    readFileSync: readGuard(actual.readFileSync, [0]),
    copyFileSync: restoreGuard(writeGuard(readGuard(actual.copyFileSync, [0]), 1)),
    cpSync: readGuard(actual.cpSync, [0]),
    openSync: readGuard(actual.openSync, [0]),
    createReadStream: readGuard(actual.createReadStream, [0]),
    writeFileSync: writeGuard(actual.writeFileSync, 0),
    appendFileSync: writeGuard(actual.appendFileSync, 0),
    renameSync: renameGuard(actual.renameSync),
  };
});

const { run } = await import('../../src/cli/run');

const tempDir = (): string => makeTempDir('spec-ins013-fail-');
// A source with a launcher that runs and prints its version, and a bundle.
const makeSource = (): string => {
  const dir = tempDir();
  writeFileSync(join(dir, 'spec'), '#!/usr/bin/env node\nprocess.stdout.write("spec 0.5.0\\n");\n');
  chmodSync(join(dir, 'spec'), 0o755);
  writeFileSync(join(dir, 'spec.cjs'), 'new bundle\n');
  return dir;
};
const installOld = (repo: string): string => {
  const bin = join(repo, '.spec/bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'spec'), '#!/usr/bin/env node\nprocess.stdout.write("spec 0.0.1\\n");\n');
  chmodSync(join(bin, 'spec'), 0o755);
  writeFileSync(join(bin, 'spec.cjs'), 'old bundle\n');
  return bin;
};
const upgrade = (repo: string, source: string) => run({ argv: ['upgrade', repo, '--from', source], env: { HOME: tempDir() }, cwd: repo, scriptPath: undefined });
const entries = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const snapshot = (bin: string): Record<string, string> => Object.fromEntries(entries(bin).map((name) => [name, readFileSync(join(bin, name), 'utf8')]));
// A path under the repository as spelled by the test and as the file system resolves it (tmpdir may be a symlink).
const both = (repo: string, relative: string): string[] => [join(repo, relative), join(realpathSync(repo), relative)];
const firstLine = (text: string): string => text.split('\n')[0] ?? '';
const expectFailed = (out: { stdout: string; stderr: string; code: number }): void => {
  expect(out.code, out.stdout + out.stderr).toBe(1);
  expect(firstLine(out.stderr).startsWith('upgrade failed: '), out.stderr).toBe(true);
};

afterEach(() => {
  faults.unreadable = null;
  faults.renameFails = null;
  faults.full = null;
  faults.restoreFails = null;
});
describe('INS-013 upgrade failures keep the old install (R7)', () => {
  it('INS-013/S29 A bundle that cannot be copied leaves the old install', async () => {
    const repo = tempDir();
    const bin = installOld(repo);
    const before = snapshot(bin);
    const source = makeSource();
    faults.unreadable = { dirs: [source, realpathSync(source)], name: 'spec.cjs' };
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(snapshot(bin)).toEqual(before);
    expect(entries(bin)).toEqual(['spec', 'spec.cjs']);
  });

  it('INS-013/S30 A launcher that cannot be copied never leaves a launcher without its bundle', async () => {
    const repo = tempDir();
    const source = makeSource();
    faults.unreadable = { dirs: [source, realpathSync(source)], name: 'spec' };
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(entries(join(repo, '.spec/bin'))).toEqual([]);
  });

  it('INS-013/S31 A write that fails part way leaves the old install and writes nothing else', async () => {
    const repo = tempDir();
    const bin = installOld(repo);
    const skill = join(repo, '.claude/skills/orchestrate/SKILL.md');
    mkdirSync(join(repo, '.claude/skills/orchestrate'), { recursive: true });
    writeFileSync(skill, readFileSync(join(REPO, 'tests/fixtures/legacy-orchestrate.md'), 'utf8').replaceAll('chat', 'shop'));
    const settings = join(repo, '.claude/settings.json');
    const hook = { type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.spec/bin/spec hook claude-code before-finish' };
    writeFileSync(settings, JSON.stringify({ hooks: { SubagentStop: [{ hooks: [hook] }] }, permissions: { allow: ['Bash(.claude/skills/shop-spec/scripts/spec *)'] } }, null, 2) + '\n');
    const before = snapshot(bin);
    const skillBefore = readFileSync(skill);
    const settingsBefore = readFileSync(settings);
    const source = makeSource();
    faults.full = { dirs: both(repo, '.spec/bin'), writes: 0 };
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(snapshot(bin)).toEqual(before);
    expect(entries(bin)).toEqual(['spec', 'spec.cjs']);
    expect(readFileSync(skill).equals(skillBefore), 'SKILL.md is unchanged').toBe(true);
    expect(readFileSync(settings).equals(settingsBefore), 'settings.json is unchanged').toBe(true);
  });

  it('INS-013/S32 A launcher that cannot be put in place after the bundle restores the old bundle', async () => {
    const repo = tempDir();
    const bin = installOld(repo);
    const before = snapshot(bin);
    const mode = statSync(join(bin, 'spec')).mode & 0o777;
    const source = makeSource();
    faults.renameFails = both(repo, '.spec/bin/spec');
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(faults.renameFails, 'the launcher rename was attempted').toBeNull();
    expect(snapshot(bin)).toEqual(before);
    expect(entries(bin)).toEqual(['spec', 'spec.cjs']);
    expect(statSync(join(bin, 'spec')).mode & 0o777).toBe(mode);
  });

  it('INS-013/S33 A launcher that cannot be put in place on a fresh install leaves nothing', async () => {
    const repo = tempDir();
    const source = makeSource();
    faults.renameFails = both(repo, '.spec/bin/spec');
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(faults.renameFails, 'the launcher rename was attempted').toBeNull();
    expect(entries(join(repo, '.spec/bin'))).toEqual([]);
  });

  it('INS-013/S34 A restore that fails too keeps the old bundle and says how to put it back', async () => {
    const repo = tempDir();
    const bin = installOld(repo);
    const before = snapshot(bin);
    const source = makeSource();
    faults.renameFails = both(repo, '.spec/bin/spec');
    faults.restoreFails = { paths: both(repo, '.spec/bin/spec.cjs'), armed: false };
    const out = await upgrade(repo, source);
    expectFailed(out);
    expect(faults.renameFails, 'the launcher rename was attempted').toBeNull();
    expect(out.stdout).toBe('');
    // The first line carries the error of the launcher rename that started the rollback.
    expect(firstLine(out.stderr)).toMatch(/EIO: i\/o error, rename .* -> '.*\.spec\/bin\/spec'/);
    // The error of the failed restore is reported too.
    expect(out.stderr).toContain('EROFS: restore refused');
    // Exactly one extra file is left in .spec/bin: the backup, named in stderr and equal to the old bundle.
    const extra = entries(bin).filter((name) => name !== 'spec' && name !== 'spec.cjs');
    expect(extra, 'one backup file next to spec and spec.cjs').toHaveLength(1);
    const backup = extra[0] ?? '';
    expect(entries(bin)).toEqual(['spec', 'spec.cjs', backup].sort());
    expect(out.stderr, 'stderr names the backup file').toContain(backup);
    expect(readFileSync(join(bin, backup), 'utf8')).toBe(before['spec.cjs']);
    // The launcher is unchanged.
    expect(readFileSync(join(bin, 'spec'), 'utf8')).toBe(before['spec']);
    // One line names the backup and spec.cjs (apart from the backup's own name) and says to move it over.
    const guidance = out.stderr.split('\n').filter((line) => line.includes(backup) && line.split(backup).join('').includes('spec.cjs'));
    expect(guidance.length, `a line with the backup name and spec.cjs in: ${out.stderr}`).toBeGreaterThan(0);
    expect(guidance.some((line) => /\b(move|mv)\b/i.test(line)), 'the line says to move the backup').toBe(true);
  });
});
