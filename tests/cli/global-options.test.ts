// CLI-003: the global options, read before any command runs. One test per scenario, through the CLI entry point run.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { run } from '../../src/cli/run';
import { FIXTURE, FIXTURE_SPEC, REPO, tempDir } from '../helpers';

/** A command line through cli.Run in `cwd`, with the environment given. */
const cli = (argv: string[], cwd: string = REPO, env: Record<string, string> = {}) => run({ argv, env, cwd, scriptPath: undefined });
/** A command line with the chat-mini fixture spec as the spec root. */
const onFixture = (...argv: string[]) => cli(argv, REPO, { SPEC_ROOT: FIXTURE_SPEC });
/** A command line refused before any command ran: nothing on stdout, exit 2. */
function expectRefused(out: { stdout: string; code: number }) {
  expect(out.stdout).toBe('');
  expect(out.code).toBe(2);
}
/** The last line of a text output. */
function lastLine(text: string): string | undefined {
  const lines = text.trimEnd().split('\n');
  return lines[lines.length - 1];
}

/** The chat-mini spec in a folder of its own, whose tickets come from a tracker command that records each run in `ran`. */
function trackerSpec() {
  const dir = tempDir('cli-003-tracker-');
  cpSync(FIXTURE_SPEC, join(dir, 'spec'), { recursive: true });
  const cfgPath = join(dir, 'spec', 'config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
  cfg.tickets = { adapter: 'command', command: 'node tools/tickets.mjs' };
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  const ran = join(dir, 'ran.txt');
  mkdirSync(join(dir, 'tools'));
  writeFileSync(join(dir, 'tools/tickets.mjs'), `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(ran)}, process.argv.slice(2).join(' ') + '\\n');\nprocess.exitCode = 2;\n`);
  return { spec: join(dir, 'spec'), ran };
}

describe('CLI-003 Read the global options', () => {
  it('CLI-003/S1 Text is the default format', async () => {
    const out = await onFixture('lint');
    expect(lastLine(out.stdout)).toBe('0 errors, 1 warning');
    expect(() => JSON.parse(out.stdout) as unknown).toThrow();
  });

  it('CLI-003/S2 --format json prints one JSON document', async () => {
    const out = await onFixture('lint', '--format', 'json');
    expect(out.code).toBe(0);
    const doc = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(doc).toHaveProperty('spec');
    expect(doc).toHaveProperty('findings');
  });

  it("CLI-003/S3 An option's value may follow an equals sign", async () => {
    const equals = await cli(['lint', '--format=json', '--root=fixtures/chat-mini/spec']);
    const spaced = await cli(['lint', '--format', 'json', '--root', 'fixtures/chat-mini/spec']);
    expect(equals.stdout).not.toBe('');
    expect(equals.stdout).toBe(spaced.stdout);
  });

  it('CLI-003/S4 The last --format wins', async () => {
    const out = await onFixture('lint', '--format', 'json', '--format', 'text');
    expect(lastLine(out.stdout)).toBe('0 errors, 1 warning');
  });

  it('CLI-003/S5 A format other than text or json', async () => {
    const out = await onFixture('lint', '--format', 'xml');
    expect(out.stderr).toBe(`--format is text or json, not xml\n\n${USAGE}`);
    expectRefused(out);
  });

  it('CLI-003/S6 Format values are case-sensitive', async () => {
    const out = await onFixture('lint', '--format', 'JSON');
    expect(out.stderr.startsWith('--format is text or json, not JSON')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S7 An unknown option', async () => {
    const out = await onFixture('lint', '--bogus');
    expect(out.stderr).toBe(`unknown option --bogus\n\n${USAGE}`);
    expectRefused(out);
  });

  it('CLI-003/S8 An option with no value', async () => {
    const out = await onFixture('lint', '--root');
    expect(out.stderr.startsWith('--root needs a value')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S9 A following option is never taken as a value', async () => {
    const out = await onFixture('lint', '--root', '--ci');
    expect(out.stderr.startsWith('--root needs a value')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S10 --tickets with no value', async () => {
    const out = await onFixture('lint', '--tickets');
    expect(out.stderr.startsWith('--tickets needs a value')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S11 A depth that is not a whole number of 1 or more', async () => {
    const out = await onFixture('impact', 'PRV-001', '--depth', '0');
    expect(out.stderr.startsWith('--depth is a whole number of 1 or more')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S12 Every problem on the line is reported, one per line', async () => {
    const out = await onFixture('lint', '--bogus', '--format', 'xml');
    expect(out.stderr).toBe(`unknown option --bogus\n--format is text or json, not xml\n\n${USAGE}`);
    expectRefused(out);
  });

  it('CLI-003/S13 Command-line errors are text even with --format json', async () => {
    const out = await onFixture('lint', '--format', 'json', '--bogus');
    expect(out.stderr.startsWith('unknown option --bogus')).toBe(true);
    expectRefused(out);
  });

  it('CLI-003/S14 --tickets names the ticket folder', async () => {
    // Given: the fixture's own tickets/ folder holds BUG-302, which lint reports as L020.
    expect((await onFixture('lint')).stdout).toContain('L020');
    const out = await onFixture('lint', '--tickets', tempDir('cli-003-empty-'));
    expect(out.stdout).toBe('lint clean\n');
    expect(out.code).toBe(0);
  });

  it('CLI-003/S15 A --tickets folder that does not exist holds no tickets', async () => {
    const out = await onFixture('lint', '--tickets', join(tempDir('cli-003-none-'), 'none'));
    expect(out.stdout).toBe('lint clean\n');
    expect(out.code).toBe(0);
  });

  it('CLI-003/S16 --tickets replaces a tracker command', async () => {
    const f = trackerSpec();
    const folder = tempDir('cli-003-tickets-');
    copyFileSync(join(FIXTURE, 'tickets', 'TASK-101.md'), join(folder, 'TASK-101.md'));
    const out = await cli(['queue', '--tickets', folder], REPO, { SPEC_ROOT: f.spec });
    expect(existsSync(f.ran), 'the tickets command ran').toBe(false);
    expect(out.stdout).toContain('## Ready (1)');
    expect(out.stdout).toContain('- TASK-101 task · next implementer · Extract provider selection into its own module');
  });

  it('CLI-003/S17 A relative --tickets is resolved against the working folder', async () => {
    const work = tempDir('cli-003-cwd-');
    mkdirSync(join(work, 't'));
    const out = await cli(['lint', '--tickets', 't'], work, { SPEC_ROOT: FIXTURE_SPEC });
    expect(out.stdout).toBe('lint clean\n');
  });

  it('CLI-003/S18 A depth on a command that does not take one is ignored', async () => {
    const plain = await onFixture('lint');
    const out = await onFixture('lint', '--depth', '0');
    expect(out.stdout).toBe(plain.stdout);
    expect(out.code).toBe(0);
  });
});
