// INS-007 R1: a misconfigured hook or an unreadable payload exits 1, a non-blocking error in Claude Code,
// so the session goes on. Checked through the CLI entry point on a throwaway copy of chat-mini, and on
// throwaway folders for the spec roots that are missing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { gitFixture, tempDir as makeTempDir } from '../helpers';

const fx = gitFixture('spec-ins007');
afterAll(() => {
  fx.cleanup();
});

function tempDir(): string {
  return makeTempDir('spec-ins007-');
}

/** A folder whose skill folder `.claude/skills/x-spec` holds skill.json as given (none when null). */
function installAt(skillJson: string | null) {
  const p = tempDir();
  const skill = join(p, '.claude/skills/x-spec');
  mkdirSync(join(skill, 'scripts'), { recursive: true });
  if (skillJson !== null) writeFileSync(join(skill, 'skill.json'), skillJson);
  return { p, launcher: join(skill, 'scripts/spec'), pointer: join(skill, 'skill.json') };
}

/** One `spec hook` call through the CLI entry point, with "{}" on stdin. */
const hook = (argv: string[], opts: { cwd: string; scriptPath?: string; env?: Record<string, string | undefined> }) =>
  run({ argv: ['hook', ...argv], env: opts.env ?? {}, cwd: opts.cwd, scriptPath: opts.scriptPath, stdin: () => Promise.resolve('{}') });

describe('INS-007 hook entry', () => {
  it('INS-007/S1 Another harness is refused', async () => {
    const out = await fx.spec('', 'hook', 'other', 'session-start');
    expect(out.stderr.startsWith('unknown harness other; supported: claude-code')).toBe(true);
    expect(out.code).toBe(1);
  });

  it('INS-007/S2 An unknown event is refused', async () => {
    const out = await fx.spec('', 'hook', 'claude-code', 'nope');
    expect(out.stderr.startsWith('unknown hook event nope; events: session-start, before-edit, after-edit, before-agent, before-handback, subagent-start, subagent-stop'), out.stderr).toBe(true);
    expect(out.code).toBe(1);
  });

  it('INS-007/S3 A missing event is refused', async () => {
    const out = await fx.spec('', 'hook', 'claude-code');
    expect(out.stderr.startsWith('unknown hook event (none); events:')).toBe(true);
    expect(out.code).toBe(1);
  });

  it('INS-007/S4 Input that is not JSON', async () => {
    const out = await fx.spec('nope', 'hook', 'claude-code', 'after-edit');
    expect(out.stderr).toBe('spec hook: the hook input is not JSON\n');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(1);
  });

  it('INS-007/S13 Removed hook events are silent no-ops', async () => {
    for (const event of ['before-delegate', 'before-finish']) {
      const out = await fx.spec('nope', 'hook', 'claude-code', event);
      expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
    }
  });

  it('INS-007/S11 Hooks without a resolvable root are silent', async () => {
    const { p, launcher } = installAt(null);
    const out = await hook(['claude-code', 'session-start'], { cwd: p, scriptPath: launcher });
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });

  it('INS-007/S12 An invalid old skill pointer is silent for hooks', async () => {
    const { p, launcher } = installAt('nope');
    const out = await hook(['claude-code', 'session-start'], { cwd: p, scriptPath: launcher });
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });
});
