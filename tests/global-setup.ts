import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { removeFolder } from './tmp';

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function firstGitOnPath(pathValue: string): string | null {
  for (const directory of pathValue.split(delimiter)) {
    const candidate = resolve(directory || process.cwd(), 'git');
    if (executable(candidate)) return candidate;
  }
  return null;
}

function useXcodeGit(): void {
  if (process.platform !== 'darwin') return;
  const path = process.env.PATH ?? '';
  const git = firstGitOnPath(path);
  if (git === null) return;
  try {
    if (realpathSync(git) !== '/usr/bin/git') return;
  } catch {
    return;
  }
  const result = spawnSync('/usr/bin/xcrun', ['-f', 'git'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return;
  const realGit = result.stdout.trim();
  if (!isAbsolute(realGit) || !executable(realGit)) return;
  const directory = dirname(realGit);
  process.env['SPEC_TEST_REAL_GIT_DIR'] = directory;
  if (path.split(delimiter)[0] !== directory) process.env.PATH = `${directory}${delimiter}${path}`;
}

const REPO = join(import.meta.dirname, '..');
const FIXTURE = join(REPO, 'fixtures/chat-mini');

/**
 * Runs once per vitest run, in the main process. It gives the workers a manifest to list every temp
 * folder they make (tests/tmp.ts), and on teardown, after every file is done, removes whatever the
 * per-file hook left: the folders made while collecting a file whose tests were all filtered out.
 * The shared Git fixture is prepared here once, then copied by each test that needs an isolated repo.
 */
export default function setup(): () => void {
  useXcodeGit();
  const home = mkdtempSync(join(tmpdir(), 'spec-run-'));
  const manifest = join(home, 'folders');
  const template = join(home, 'fixture-template');
  cpSync(FIXTURE, template, { recursive: true, mode: constants.COPYFILE_FICLONE, filter: (src) => !/\/(node_modules|\.dart_tool)(\/|$)/.test(src) && !src.includes('/.claude/agents/') });
  const bin = join(template, '.spec/bin');
  mkdirSync(bin, { recursive: true });
  for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(bin, file));
  symlinkSync(join(REPO, 'node_modules'), join(template, 'node_modules'), 'dir');
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.name', 'test'], ['config', 'user.email', 'test@example.com'], ['add', '-A'], ['commit', '-q', '-m', 'fixture']]) {
    execFileSync('git', args, { cwd: template, stdio: 'ignore' });
  }
  process.env['SPEC_TMP_MANIFEST'] = manifest;
  process.env['SPEC_FIXTURE_TEMPLATE'] = template;
  return () => {
    delete process.env['SPEC_TMP_MANIFEST'];
    delete process.env['SPEC_FIXTURE_TEMPLATE'];
    if (process.env['SPEC_KEEP_TMP'] === '1') return;
    if (existsSync(manifest)) {
      for (const dir of new Set(readFileSync(manifest, 'utf8').split('\n'))) if (dir) removeFolder(dir);
    }
    rmSync(home, { recursive: true, force: true });
  };
}
