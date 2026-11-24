// X139 retires the hands-off feature run: it required one CLI process to own the whole pipeline.
// This smoke check verifies that the main session receives a startable task for the Dart fixture.
import { resolve } from 'node:path';
import { run } from '../../src/cli/run';

const project = resolve(import.meta.dirname, '../../fixtures/dart-mini');
const out = await run({
  argv: ['next', '--root', resolve(project, 'spec'), '--format', 'json'],
  env: {},
  cwd: project,
  scriptPath: undefined,
});
if (out.code !== 0) throw new Error(out.stderr || out.stdout);
const tasks = JSON.parse(out.stdout) as { action: string; ticket: string; task?: string }[];
if (!tasks.some((task) => task.action === 'delegate' && task.task)) throw new Error('spec next returned no startable Dart task');
process.stdout.write(`session delegation task ready: ${tasks.map((task) => task.ticket).join(', ')}\n`);
