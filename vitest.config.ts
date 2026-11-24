import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/core/lint-cases/**', 'node_modules/**'],
    // Removes the temp folders and stops the child processes each file's tests made (tests/tmp.ts).
    setupFiles: ['tests/setup.ts'],
    // Removes what a file made while collecting when its tests were all filtered out, so its hook never ran.
    globalSetup: ['tests/global-setup.ts'],
    // Most CLI tests build git repos and run the CLI. Under load (several worktrees running the
    // suite at once) the 5 s default fails them at random, which fails stage checks and merges.
    testTimeout: 30_000,
    // Cleanup hooks remove many fixture repos; under the same load the 10 s default fails whole files.
    hookTimeout: 60_000,
  },
});
