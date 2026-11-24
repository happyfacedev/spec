// TASK-001: a run leaves no temp folders behind, also a run that filters every test of a file out
// (`spec test <scenario ID>` does), because that file's module-scope code has made folders by then
// and vitest does not run its afterAll hooks.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, tempDir } from './helpers';

const VITEST = join(REPO, 'node_modules/vitest/vitest.mjs');

/** What a nested vitest run leaves in a private temp folder of its own. */
function leftovers(...args: string[]): string[] {
  const home = tempDir('spec-cleanup-check-');
  mkdirSync(join(home, 'T'));
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: join(home, 'T') };
  delete env['SPEC_TMP_MANIFEST'];
  delete env['SPEC_KEEP_TMP'];
  const run = spawnSync(process.execPath, [VITEST, 'run', '--root', REPO, ...args], { cwd: REPO, env, encoding: 'utf8', timeout: 120_000 });
  expect(run.status, run.stdout + run.stderr).toBe(0);
  return readdirSync(join(home, 'T')).filter((name) => name.startsWith('spec-'));
}

describe('temp folders of a test run', () => {
  it('a run that filters out every test of a file, whose module scope makes folders, leaves none', () => {
    // tests/cli/exit-codes.test.ts makes a folder at module scope.
    expect(leftovers('tests/cli/exit-codes.test.ts', '-t', 'no test has this name')).toEqual([]);
  });

  it('a run that runs the tests of a file leaves none', () => {
    expect(leftovers('tests/cli/exit-codes.test.ts')).toEqual([]);
  });
});
