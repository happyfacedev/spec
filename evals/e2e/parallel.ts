// X139 retires the hands-off parallel run. This smoke check verifies that next exposes the
// current startable wave for the main session to delegate ticket by ticket.
import { resolve } from 'node:path';
import { run } from '../../src/cli/run';

const project = resolve(import.meta.dirname, '../../fixtures/chat-mini');
const out = await run({
  argv: ['next', '--root', resolve(project, 'spec'), '--format', 'json'],
  env: {},
  cwd: project,
  scriptPath: undefined,
});
if (out.code !== 0) throw new Error(out.stderr || out.stdout);
const tasks = JSON.parse(out.stdout) as { action: string; ticket: string; task?: string; worktree?: string }[];
const startable = tasks.filter((task) => task.action === 'delegate');
if (startable.length === 0) throw new Error('spec next returned no startable tickets');
process.stdout.write(`session delegation wave: ${startable.map((task) => task.ticket).join(', ')}\n`);
