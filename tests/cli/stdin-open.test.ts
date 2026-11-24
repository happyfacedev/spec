import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, gitFixture, tempDir, trackChild } from '../helpers';

const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const MAIN = join(REPO, 'src/cli/main.ts');
const fixtures: ReturnType<typeof gitFixture>[] = [];
const dirs: string[] = [];
afterAll(() => {
  for (const fx of fixtures) fx.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

async function runWithOpenStdin(fx: ReturnType<typeof gitFixture>, ...argv: string[]): Promise<{ timedOut: boolean; code: number | null; stdout: string; stderr: string }> {
  const env = { ...process.env };
  delete env.SPEC_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  delete env.SPEC_CLI_DELEGATED;
  const child = trackChild(
    spawn(process.execPath, [TSX, MAIN, ...argv, '--root', join(fx.repo, 'spec')], {
      cwd: fx.repo,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 15_000);
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ timedOut, code, stdout, stderr });
    });
  });
}

function fixture(): ReturnType<typeof gitFixture> {
  const fx = gitFixture('spec-open-stdin');
  fixtures.push(fx);
  return fx;
}

describe('CLI-001 open stdin handling', () => {
  it('CLI-001/S12 ticket advance --report-file does not wait for open stdin', async () => {
    const fx = fixture();
    const started = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(started.code, started.stderr).toBe(0);
    const dir = tempDir('spec-open-stdin-report-');
    dirs.push(dir);
    const reportFile = join(dir, 'report.txt');
    writeFileSync(reportFile, 'not a valid role report\n');

    const out = await runWithOpenStdin(fx, 'ticket', 'advance', 'TASK-101', '--report-file', reportFile);
    expect(out.timedOut, out.stderr).toBe(false);
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('report refused');
  }, 30_000);

  it('CLI-001/S13 brief without --stdin does not wait for open stdin', async () => {
    const out = await runWithOpenStdin(fixture(), 'brief', 'implementer', 'TASK-101');
    expect(out.timedOut, out.stderr).toBe(false);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('# Brief · implementer ·');
  }, 30_000);

  it('CLI-001/S14 next does not wait for open stdin', async () => {
    const out = await runWithOpenStdin(fixture(), 'next', '--summary', '--format', 'json');
    expect(out.timedOut, out.stderr).toBe(false);
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toBeInstanceOf(Array);
  }, 30_000);

  it('CLI-001/S15 lint does not wait for open stdin', async () => {
    const out = await runWithOpenStdin(fixture(), 'lint', '--ci');
    expect(out.timedOut, out.stderr).toBe(false);
    expect(out.code).toBe(0);
  }, 30_000);
});
