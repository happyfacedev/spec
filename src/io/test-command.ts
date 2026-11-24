// Runs config.json's testCommand. It is the project's own command, so it runs in a shell; the
// only values substituted in are a validated scenario ID (or nothing) and a temp file path.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PATTERNS } from '../core/ids';
import { type TestRun, parseTestReport } from '../core/test-report';

export const TEST_TIMEOUT_MS = 10 * 60 * 1000;

export function runTestCommand(projectRoot: string, template: string, filter = ''): TestRun {
  if (filter !== '' && !PATTERNS.scenario.test(filter)) return { exitCode: null, tests: [], error: `invalid filter ${filter}` };
  const dir = mkdtempSync(join(tmpdir(), 'spec-tests-'));
  const report = join(dir, 'report');
  try {
    const cmd = template.replaceAll('{filter}', filter).replaceAll('{report}', report);
    const { spawnSync } = process.getBuiltinModule('node:child_process');
    const r = spawnSync('/bin/sh', ['-c', cmd], { cwd: projectRoot, encoding: 'utf8', timeout: TEST_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    if (r.error) return { exitCode: null, tests: [], error: r.error.message };
    if (!existsSync(report)) {
      const tail = `${r.stderr}${r.stdout}`.trim().split('\n').slice(-3).join(' | ');
      return { exitCode: r.status, tests: [], error: `the test command wrote no report to {report}${tail ? `: ${tail}` : ''}` };
    }
    const parsed = parseTestReport(readFileSync(report, 'utf8'));
    if ('error' in parsed) return { exitCode: r.status, tests: [], error: parsed.error };
    const prefix = `${projectRoot.replace(/\/+$/, '')}/`;
    const failedFiles = (parsed.failedFiles ?? []).map((f) => ({ name: f.name.startsWith(prefix) ? f.name.slice(prefix.length) : f.name, message: f.message }));
    const outputTail = `${r.stderr}${r.stdout}`.split('\n').map((l) => l.trim()).filter((l) => l !== '').slice(-5);
    return {
      exitCode: r.status,
      tests: parsed.tests,
      error: null,
      ...(failedFiles.length > 0 ? { failedFiles } : {}),
      ...(r.status !== 0 && outputTail.length > 0 ? { outputTail } : {}),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
