// X139 retires the hands-off ticket pipeline eval. This smoke check exercises the session's next handoff.
import { resolve } from 'node:path';
import { run } from '../../src/cli/run';

const project = resolve(import.meta.dirname, '../../fixtures/chat-mini');
const out = await run({
  argv: ['next', '--root', resolve(project, 'spec'), '--harness', 'claude-code', '--format', 'json'],
  env: {},
  cwd: project,
  scriptPath: undefined,
});
if (out.code !== 0) throw new Error(out.stderr || out.stdout);
const tasks = JSON.parse(out.stdout) as { action: string; ticket: string; task?: string }[];
const startable = tasks.filter((task) => task.action === 'delegate' && task.task);
if (startable.length === 0) throw new Error('spec next returned no startable chat-mini tasks');
process.stdout.write(`session delegation tasks ready: ${startable.map((task) => task.ticket).join(', ')}\n`);
