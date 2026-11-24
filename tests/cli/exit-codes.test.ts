// CLI-005 S1-S3 and S8, CLI-006 S1-S4: exit codes and where problems are printed.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { run } from '../../src/cli/run';
import { tempDir } from '../helpers';

const ROOT = join(import.meta.dirname, '../../fixtures/chat-mini/spec');
const go = (...argv: string[]) => run({ argv, env: {}, cwd: process.cwd(), scriptPath: undefined });
const empty = tempDir('spec-empty-');
afterAll(() => {
  rmSync(empty, { recursive: true, force: true });
});

describe('CLI-005 exit codes', () => {
  it('CLI-005/S1 A command that succeeds exits 0', async () => {
    const out = await go('lint', '--root', ROOT);
    expect(out.code).toBe(0);
    expect(out.stderr).toBe('');
  });

  it('CLI-005/S2 A command that runs and finds a failure exits 1', async () => {
    const out = await go('lint', '--root', empty);
    expect(out.stdout.trimEnd().endsWith('1 error, 0 warnings')).toBe(true);
    expect(out.code).toBe(1);
  });

  it('CLI-005/S3 A wrong command line exits 2 with the usage', async () => {
    const out = await go('lint', '--bogus', '--root', ROOT);
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr.endsWith(`\n\n${USAGE}`)).toBe(true);
  });
  it('CLI-005/S9 spec hook with no spec root is silent and succeeds', async () => {
    const missing = join(empty, 'nonexistent');
    const out = await run({ argv: ['hook', 'claude-code', 'session-start', '--root', missing], env: {}, cwd: empty, scriptPath: undefined, stdin: () => Promise.resolve('{}') });
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });
});

describe('CLI-006 brief always exits 0', () => {
  it('CLI-006/S1 A malformed command line', async () => {
    const out = await go('brief', '--format', 'xml', '--root', ROOT);
    expect(out.stdout).toBe(`--format is text or json, not xml\n\n${USAGE}`);
    expect(out.stderr).toBe('');
    expect(out.code).toBe(0);
  });

  it('CLI-006/S2 An unknown option', async () => {
    const out = await go('brief', '--bogus', '--root', ROOT);
    expect(out.stdout.startsWith('unknown option --bogus')).toBe(true);
    expect(out.code).toBe(0);
  });

  it('CLI-006/S3 No spec root', async () => {
    const out = await run({ argv: ['brief'], env: {}, cwd: empty, scriptPath: undefined });
    expect(out.stdout).toBe(`no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json\n\n${USAGE}`);
    expect(out.stderr).toBe('');
    expect(out.code).toBe(0);
  });

  it('CLI-006/S4 A spec root that does not exist', async () => {
    const out = await go('brief', 'implementer', 'TASK-101', '--root', '/nonexistent');
    expect(out.stdout.startsWith('spec root /nonexistent does not exist')).toBe(true);
    expect(out.code).toBe(0);
  });
});
