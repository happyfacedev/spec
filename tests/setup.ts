import { delimiter } from 'node:path';
import { afterAll } from 'vitest';
import { finishFile } from './tmp';

const realGitDirectory = process.env['SPEC_TEST_REAL_GIT_DIR'];
if (realGitDirectory && process.env.PATH?.split(delimiter)[0] !== realGitDirectory) {
  process.env.PATH = `${realGitDirectory}${delimiter}${process.env.PATH ?? ''}`;
}

// Registered before the files' own hooks, so it runs after them: a file's afterAll can still use its folders.
afterAll(finishFile);
