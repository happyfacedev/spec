// PIP-009: `spec test` runs the project's testCommand and prints one line per test, through the CLI
// on a throwaway copy of chat-mini whose config holds the command under test.
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TEST_TIMEOUT_MS } from '../../src/io/test-command';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const passing = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'A', status: 'passed' }] }] });
// A passes, B fails, C is skipped (vitest reports a skipped test as "pending").
const mixed = JSON.stringify({ testResults: [{ assertionResults: [{ title: 'A', status: 'passed' }, { title: 'B', status: 'failed' }, { title: 'C', status: 'pending' }] }] });
const VITEST = 'npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"';

/** The spec at `root` with its config.json's testCommand set to `command`. */
function setCommand(root: string, command: string): void {
  const config = join(root, 'spec/config.json');
  const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
  writeFileSync(config, `${JSON.stringify({ ...cfg, testCommand: command }, null, 2)}\n`);
}

/** A throwaway copy of chat-mini whose testCommand is `command`; the report files sit beside it. */
function fixture(command: string): Fx {
  const fx = gitFixture('spec-test-scenarios', {
    setup: (dir) => {
      writeFileSync(join(dir, 'passing.json'), passing);
      writeFileSync(join(dir, 'mixed.json'), mixed);
      setCommand(dir, command);
    },
  });
  made.push(fx);
  return fx;
}

describe('PIP-009: run the tests, one line per test', () => {
  it('PIP-009/S1 Run one scenario\'s tests', async () => {
    const fx = fixture(VITEST);
    const out = await fx.spec('', 'test', 'PRV-002/S1');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').filter((l) => l.startsWith('PASS '))).toEqual(['PASS PRV-002/S1 Fallback enabled']);
  }, 60_000);

  it('PIP-009/S2 One line per test, then a summary', async () => {
    const fx = fixture('cp mixed.json "{report}"; exit 1');
    const out = await fx.spec('', 'test');
    expect(out.stdout).toBe('PASS A\nFAIL B\nSKIP C\n1 passed, 1 failed, 1 skipped (exit 1)\n');
    expect(out.code).toBe(1);
  }, 60_000);

  it('PIP-009/S2 A command that ends with no exit code shows (exit ?)', async () => {
    const fx = fixture('cp mixed.json "{report}"; kill -9 $$');
    const out = await fx.spec('', 'test');
    expect(out.stdout).toBe('PASS A\nFAIL B\nSKIP C\n1 passed, 1 failed, 1 skipped (exit ?)\n');
    expect(out.code).toBe(1);
  }, 60_000);

  it('PIP-009/S3 Every test with no filter', async () => {
    const fx = fixture('echo "[{filter}|{filter}]" >> seen.txt; cp passing.json "{report}"');
    expect((await fx.spec('', 'test')).code).toBe(0);
    expect(readFileSync(join(fx.repo, 'seen.txt'), 'utf8')).toBe('[|]\n');
  }, 60_000);

  it('PIP-009/S4 The report path', async () => {
    const fx = fixture('echo "{report}|{report}" >> seen.txt; cp passing.json "{report}"');
    expect((await fx.spec('', 'test')).code).toBe(0);
    expect((await fx.spec('', 'test')).code).toBe(0);
    const seen = readFileSync(join(fx.repo, 'seen.txt'), 'utf8').trim().split('\n').map((l) => l.split('|'));
    expect(seen).toHaveLength(2);
    const paths = seen.map((line) => line[0] ?? '');
    expect(seen).toEqual(paths.map((p) => [p, p]));
    expect(paths[0]).not.toBe(paths[1]);
    for (const p of paths) {
      expect(basename(p)).toBe('report');
      expect(dirname(dirname(p))).toBe(tmpdir());
      expect(existsSync(dirname(p))).toBe(false);
    }
  }, 60_000);

  it('PIP-009/S5 JSON output', async () => {
    const fx = fixture('cp mixed.json "{report}"; exit 1');
    const out = await fx.spec('', 'test', '--format', 'json');
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toEqual({
      exitCode: 1,
      tests: [
        { name: 'A', status: 'passed' },
        { name: 'B', status: 'failed' },
        { name: 'C', status: 'skipped' },
      ],
      error: null,
    });
  }, 60_000);

  it('PIP-009/S6 Exit 0 only when everything passes', async () => {
    const fx = fixture('cp passing.json "{report}"');
    const ok = await fx.spec('', 'test');
    expect(ok.code, ok.stderr).toBe(0);
    setCommand(fx.repo, 'cp passing.json "{report}"; exit 3');
    expect((await fx.spec('', 'test')).code).toBe(1);
    setCommand(fx.repo, 'cp mixed.json "{report}"');
    expect((await fx.spec('', 'test')).code).toBe(1);
  }, 60_000);

  it('PIP-009/S7 Not a scenario ID', async () => {
    const fx = fixture('touch ran.txt; cp passing.json "{report}"');
    const out = await fx.spec('', 'test', 'not-an-id');
    expect(out.code).toBe(2);
    expect(out.stderr.split('\n')[0]).toBe('Unknown not-an-id. spec test takes a scenario ID, or nothing for every test.');
    expect(existsSync(join(fx.repo, 'ran.txt'))).toBe(false);
  }, 60_000);

  it('PIP-009/S8 The command wrote no report', async () => {
    const fx = fixture('echo boom >&2; exit 1');
    const out = await fx.spec('', 'test');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('spec test: the test command wrote no report to {report}: boom\n');
    setCommand(fx.repo, 'printf "e1\\ne2\\n" >&2; printf "o1\\no2\\n"; exit 1');
    expect((await fx.spec('', 'test')).stderr).toBe('spec test: the test command wrote no report to {report}: e2 | o1 | o2\n');
  }, 60_000);

  it('PIP-009/S9 A report in no known format', async () => {
    const fx = fixture('echo "not a report" > "{report}"');
    const out = await fx.spec('', 'test');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('spec test: the test report is neither JSON nor JUnit XML\n');
  }, 60_000);

  it('PIP-009/S10 No config', async () => {
    const fx = fixture('cp passing.json "{report}"');
    rmSync(join(fx.repo, 'spec/config.json'));
    const out = await fx.spec('', 'test');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('config.json has no testCommand\n');
  }, 60_000);

  it('PIP-009/S11 The command runs in the project root, in a shell, with a time limit', async () => {
    const fx = fixture('pwd > out.txt');
    expect((await fx.spec('', 'test')).code).toBe(1);
    expect(readFileSync(join(fx.repo, 'out.txt'), 'utf8').trim()).toBe(realpathSync(fx.repo));
    setCommand(fx.repo, 'echo "$0" > shell.txt');
    expect((await fx.spec('', 'test')).code).toBe(1);
    expect(readFileSync(join(fx.repo, 'shell.txt'), 'utf8').trim()).toBe('/bin/sh');
    expect(TEST_TIMEOUT_MS).toBe(10 * 60 * 1000);
  }, 60_000);

  it('PIP-009/S12 In JSON, a failed run still prints its result', async () => {
    const fx = fixture('exit 1');
    const out = await fx.spec('', 'test', '--format', 'json');
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toEqual({ exitCode: 1, tests: [], error: expect.stringMatching(/^the test command wrote no report/) as string });
  }, 60_000);
});
