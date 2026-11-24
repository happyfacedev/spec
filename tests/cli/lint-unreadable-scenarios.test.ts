// LNT-019 through the CLI: a symlink under the spec root whose target is missing is one L037 error,
// and the other commands still run on the same tree. Each scenario starts from the base spec of
// LNT-001, a throwaway git copy with the dangling symlink added at modules/alpha/broken.md.
import { chmodSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

function danglingBase(): Fx {
  const fx = gitFixture('spec-lint-unreadable', {
    fixture: LINT_BASE,
    setup: (dir) => {
      symlinkSync('does-not-exist.md', join(dir, 'spec/modules/alpha/broken.md'));
    },
  });
  made.push(fx);
  return fx;
}

function plainBase(): Fx {
  const fx = gitFixture('spec-lint-unlistable', { fixture: LINT_BASE });
  made.push(fx);
  return fx;
}

const L037 = {
  rule: 'L037',
  severity: 'error',
  file: 'modules/alpha/broken.md',
  line: 1,
  id: null,
  message: 'modules/alpha/broken.md cannot be read: its symlink target does not exist',
  fix: 'point the symlink at an existing file, or remove it',
};

describe('LNT-019: Report a spec entry that cannot be read (L037)', () => {
  it('LNT-019/S1 A symlink under the spec whose target is missing', async () => {
    const out = await danglingBase().spec('', 'lint', '--format', 'json');
    expect(out.code).toBe(1);
    expect((JSON.parse(out.stdout) as { findings: unknown[] }).findings).toEqual([L037]);
  });

  // Root ignores mode bits, so as root the directory stays listable and the test is skipped.
  it.skipIf(process.getuid?.() === 0)('LNT-019/S1 A directory under the spec that cannot be listed is one L037 error at its path, and lint --ci does not crash', async () => {
    const fx = plainBase();
    const dir = join(fx.repo, 'spec/modules/alpha/sub');
    mkdirSync(dir);
    chmodSync(dir, 0o000);
    try {
      const plain = await fx.spec('', 'lint', '--format', 'json');
      expect(plain.code).toBe(1);
      const findings = (JSON.parse(plain.stdout) as { findings: { rule: string; severity: string; file: string; line: number; id: string | null; message: string }[] }).findings;
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ rule: 'L037', severity: 'error', file: 'modules/alpha/sub', line: 1, id: null });
      expect(findings[0]?.message.startsWith('modules/alpha/sub cannot be read: ')).toBe(true);
      const ci = await fx.spec('', 'lint', '--ci', '--format', 'json');
      expect(ci.code).toBe(1);
      expect((JSON.parse(ci.stdout) as { findings: unknown[] }).findings).toContainEqual(
        expect.objectContaining({ rule: 'L037', file: 'modules/alpha/sub', line: 1 }),
      );
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  it('LNT-019/R1 The --files filter of lint keeps an unreadable entry, outside the per-file rules', async () => {
    const fx = danglingBase();
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--files', 'spec/modules/alpha/contracts.md', '--format', 'json');
    expect(out.code).toBe(1);
    expect((JSON.parse(out.stdout) as { findings: unknown[] }).findings).toContainEqual(L037);
  });

  it('LNT-019/S2 The other commands work on the same tree', async () => {
    const fx = danglingBase();

    const queue = await fx.spec('', 'queue');
    expect(queue.stdout.startsWith('# Queue · spec@')).toBe(true);
    expect(queue.code).toBe(0);

    const show = await fx.spec('', 'show', 'ALP-001');
    const feature = readFileSync(join(fx.repo, 'spec/modules/alpha/features/ALP-001-make-a-widget.md'), 'utf8');
    expect(show.stdout.startsWith(`modules/alpha/features/ALP-001-make-a-widget.md:1\n\n${feature}`)).toBe(true);
    expect(show.code).toBe(0);

    const json = await fx.spec('', 'show', 'ALP-001', '--format', 'json');
    const unit = JSON.parse(json.stdout) as { id: string; type: string };
    expect(unit.id).toBe('ALP-001');
    expect(unit.type).toBe('feature');
    expect(json.code).toBe(0);
  });
});
