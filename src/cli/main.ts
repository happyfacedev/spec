import { parseArgs } from './args';
import { run } from './run';

const argv = process.argv.slice(2);
const env = { ...process.env };
// The delegated CLI consumes these once; commands it launches must not inherit them.
delete process.env.SPEC_CLI_DELEGATED;
delete process.env.SPEC_PLUGIN_VERSION;

/** Reads all of stdin; an interactive terminal gives nothing rather than waiting. */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

run({ argv, env, cwd: process.cwd(), scriptPath: process.argv[1], stdin: readStdin, stderr: (text) => process.stderr.write(text) }).then(
  (out) => {
    if (out.stdout) process.stdout.write(out.stdout);
    if (out.stderr) process.stderr.write(out.stderr);
    process.exitCode = out.code;
  },
  (err: unknown) => {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    // brief always exits 0, even on a bug: a failing injected command aborts a Claude Code skill.
    if (parseArgs(argv).command === 'brief') {
      process.stdout.write(`spec brief failed: ${detail}\n`);
      process.exitCode = 0;
      return;
    }
    process.stderr.write(`spec: internal error: ${detail}\n`);
    process.exitCode = 2;
  },
);
