// CLI wiring through run(): exit codes, input safety, formats. No subprocess, no disk writes.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';

const ROOT = join(import.meta.dirname, '../../fixtures/chat-mini/spec');
const spec = (...argv: string[]) => run({ argv: [...argv, '--root', ROOT], env: {}, cwd: process.cwd(), scriptPath: undefined });

describe('spec CLI', () => {
  it('--version', async () => {
    const out = await run({ argv: ['--version'], env: {}, cwd: process.cwd(), scriptPath: undefined });
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/^spec \S+\n$/);
  });

  it('lint exits 0 on the clean fixture, and json carries the spec version', async () => {
    const out = await spec('lint', '--format', 'json');
    expect(out.code).toBe(0);
    const parsed = JSON.parse(out.stdout) as { spec: string; findings: unknown[] };
    expect(parsed.spec).toMatch(/^spec@[0-9a-f]{8}$/);
  });

  it('lint --files limits per-file rules to those files', async () => {
    const out = await spec('lint', '--format', 'json', '--files', join(ROOT, 'core/glossary.md'));
    const parsed = JSON.parse(out.stdout) as { findings: { rule: string }[] };
    // The BUG-302 warning is per-file (L020) and its file was not named.
    expect(parsed.findings).toEqual([]);
  });

  it('show prints the stored unit with backlinks', async () => {
    const out = await spec('show', 'providers.RateLimited');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('### providers.RateLimited');
    expect(out.stdout).toContain('- PRV-002 consumes');
    expect(out.stdout).toContain('- PRV-001 emits');
  });

  it('show refuses unknown IDs with a suggestion and exits 2', async () => {
    const out = await spec('show', 'PRV-02');
    expect(out.code).toBe(2);
    expect(out.stderr).toMatch(/^Unknown PRV-02\. Did you mean PRV-002\?/);
  });

  it('show never treats shell text as an ID', async () => {
    const out = await spec('show', "x'; touch /tmp/pwned; '");
    expect(out.code).toBe(2);
    expect(out.stderr).toMatch(/^Unknown x'; touch \/tmp\/pwned; '\.\n/);
  });

  it('find ranks exact IDs first', async () => {
    const out = await spec('find', 'PRV-002');
    expect(out.stdout.split('\n')[0]).toMatch(/^PRV-002 {2}feature/);
  });

  it('impact prints rings for a unit and for a ticket', async () => {
    const unit = await spec('impact', 'UI-001');
    expect(unit.code).toBe(0);
    expect(unit.stdout).toContain('- PRV-002 Fall back when a provider rate-limits');
    const ticket = JSON.parse((await spec('impact', 'TASK-102', '--format', 'json')).stdout) as { changed: string[] };
    expect(ticket.changed).toEqual(['CNV-002', 'PRV-002']);
  });

  it('impact refuses modules, unknown IDs and bad depths', async () => {
    expect((await spec('impact', 'providers')).stderr).toMatch(/^impact takes a feature/);
    expect((await spec('impact', 'PRV-009')).stderr).toMatch(/^Unknown PRV-009\. Did you mean PRV-00\d\?/);
    expect((await spec('impact', 'TASK-999')).code).toBe(2);
    expect((await spec('impact', 'PRV-001', '--depth', '0')).code).toBe(2);
  });

  it('brief always exits 0, even before it exists or with bad options', async () => {
    expect((await spec('brief', 'implementer', 'TASK-101')).code).toBe(0);
    expect((await spec('brief', '--depth', 'x')).code).toBe(0);
  });

  it('usage errors exit 2', async () => {
    expect((await spec('nope')).code).toBe(2);
    expect((await spec('lint', '--format', 'xml')).code).toBe(2);
  });
});
