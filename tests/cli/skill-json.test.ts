// CLI-005 S6-S7, CLI-006 S6: a skill.json that is not JSON.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir } from '../helpers';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { run } from '../../src/cli/run';

const FIXTURE_SPEC = join(import.meta.dirname, '../../fixtures/chat-mini/spec');
let p = '';
let launcher = '';
let pointer = '';

beforeAll(() => {
  p = tempDir('spec-skilljson-');
  const skill = join(p, '.claude/skills/x-spec');
  mkdirSync(join(skill, 'scripts'), { recursive: true });
  launcher = join(skill, 'scripts/spec');
  pointer = join(skill, 'skill.json');
  writeFileSync(pointer, 'nope');
  cpSync(FIXTURE_SPEC, join(p, 'spec'), { recursive: true });
});
afterAll(() => {
  rmSync(p, { recursive: true, force: true });
});

const go = (...argv: string[]) => run({ argv, env: {}, cwd: p, scriptPath: launcher });

describe('broken skill.json', () => {
  it('CLI-005/S6 A skill.json that is not JSON is a user error naming the file', async () => {
    const out = await go('show', 'PRV-002/S3');
    expect(out.stderr.startsWith(`${pointer} is not valid JSON`)).toBe(true);
    expect(out.stderr.endsWith(`\n\n${USAGE}`)).toBe(true);
    expect(out.stderr).not.toContain('internal error');
    expect(out.stderr).not.toContain('    at ');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });

  it('CLI-005/S7 --root or SPEC_ROOT makes a broken skill.json irrelevant', async () => {
    const out = await go('lint', '--root', join(p, 'spec'));
    expect(out.code).toBe(0);
    expect(out.stderr).toBe('');
  });

  it('CLI-006/S6 A skill.json that is not JSON', async () => {
    const out = await go('brief', 'implementer', 'TASK-101');
    expect(out.stdout.startsWith(`${pointer} is not valid JSON`)).toBe(true);
    expect(out.stderr).toBe('');
    expect(out.code).toBe(0);
  });
});
