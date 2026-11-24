// FMT-015: per-harness role models and the gitignored local delegation override.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { parseConfig } from '../../src/core/parse/tickets';
import { loadWorkspace } from '../../src/io/workspace';
import { gitFixture, LINT_BASE, tempDir } from '../helpers';

const fixtures: ReturnType<typeof gitFixture>[] = [];
const dirs: string[] = [];
afterAll(() => {
  for (const fx of fixtures) fx.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('delegation config', () => {
  it('FMT-015/S1 delegation is optional', () => {
    const parsed = parseConfig('config.json', '{ "formatVersion": 2, "testCommand": "npm test" }');
    expect(parsed.findings).toEqual([]);
    expect(parsed.config?.delegation).toBeUndefined();
  });

  it('FMT-015/S2 accepts an unknown free-form harness key', () => {
    const parsed = parseConfig('config.json', JSON.stringify({ formatVersion: 2, testCommand: 'npm test', delegation: { 'custom-harness': { implementer: 'model-x' } } }));
    expect(parsed.findings).toEqual([]);
    expect(parsed.config?.delegation?.['custom-harness']?.implementer).toBe('model-x');
  });

  it('FMT-015/S3 config.local.json overrides delegation and ignores unrelated local keys', async () => {
    const fx = gitFixture('spec-local-delegation', {
      setup: (dir) => {
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'opus', reviewer: 'reviewer-v1' }, 'claude-code': { implementer: 'sonnet' } };
        writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
        writeFileSync(join(dir, 'spec/.gitignore'), '_generated/\nconfig.local.json\n');
        writeFileSync(join(dir, 'spec/config.local.json'), JSON.stringify({ delegation: { astro: { implementer: 'local-opus' } }, testCommand: 42 }));
      },
    });
    fixtures.push(fx);
    const ws = await loadWorkspace(join(fx.repo, 'spec'), null, fx.repo);
    expect(ws.delegation).toMatchObject({ astro: { implementer: 'local-opus', reviewer: 'reviewer-v1' }, 'claude-code': { implementer: 'sonnet' } });
    expect(ws.config?.testCommand).toContain('vitest');
    expect((await fx.spec('', 'lint')).stdout).toContain('0 errors');
    const next = await fx.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    const entry = JSON.parse(next.stdout) as { model: string; worktree: string };
    expect(entry.model).toBe('local-opus');
    fx.git('worktree', 'remove', '--force', entry.worktree);
    const added = JSON.parse((await fx.spec('', 'worktree', 'add', 'TASK-101', '--format', 'json')).stdout) as { project: string };
    const fromWorktree = await run({ argv: ['next', '--harness', 'astro', '--format', 'json', '--root', join(added.project, 'spec')], env: {}, cwd: added.project, scriptPath: undefined });
    const listed = JSON.parse(fromWorktree.stdout) as { ticket: string; model: string | null }[];
    expect(listed.find((item) => item.ticket === 'TASK-101')?.model).toBe('local-opus');
    fx.git('worktree', 'remove', '--force', added.project);
    const localPath = join(fx.repo, 'spec/config.local.json');
    writeFileSync(localPath, JSON.stringify({ delegation: { astro: { implementer: 'changed-local-model' } } }));
    expect((await loadWorkspace(join(fx.repo, 'spec'), null, fx.repo)).spec.version).toBe(ws.spec.version);
  }, 60_000);

  it('FMT-015/S4 invalid delegation roles and model values are config findings', async () => {
    const main = gitFixture('spec-bad-delegation', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { wizard: 'sonnet', implementer: 7 } };
        writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
      },
    });
    fixtures.push(main);
    const mainOut = await main.spec('', 'lint');
    expect(mainOut.code).toBe(1);
    expect(mainOut.stdout).toContain('config.json delegation.astro');

    const local = gitFixture('spec-bad-local-delegation', {
      fixture: LINT_BASE,
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/config.local.json'), JSON.stringify({ delegation: { astro: { wizard: 'sonnet' } } }));
      },
    });
    fixtures.push(local);
    const localOut = await local.spec('', 'lint');
    expect(localOut.code).toBe(1);
    expect(localOut.stdout).toContain('config.local.json delegation');

    const notObject = gitFixture('spec-local-delegation-not-object', {
      fixture: LINT_BASE,
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/config.local.json'), '[]');
      },
    });
    fixtures.push(notObject);
    const malformed = await notObject.spec('', 'lint');
    expect(malformed.code).toBe(1);
    expect(malformed.stdout).toContain('config.local.json (root)');

  }, 60_000);

  it('FMT-015/S6 Unknown harnesses remain usable with an L029 lint warning', async () => {
    const fx = gitFixture('spec-custom-harness-warning', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        const complete = { 'spec-writer': 'writer', tester: 'tester', implementer: 'builder', reviewer: 'reviewer' };
        const claudeCode = { 'spec-writer': 'opus', tester: 'sonnet', implementer: 'sonnet', reviewer: 'opus' };
        config.delegation = { 'claude-code': claudeCode, 'custom-harness': complete };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const result = JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] };
    expect(out.code).toBe(0);
    expect(result.findings.some((item) => item.rule === 'L029' && item.message.includes('custom-harness'))).toBe(true);
    expect(result.findings.some((item) => item.rule === 'L030')).toBe(false);
  });

  it('FMT-015/S7 A partial harness map warns for every missing role', async () => {
    const partial = gitFixture('spec-partial-harness-warning', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'builder' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(partial);
    const out = await partial.spec('', 'lint', '--format', 'json');
    const result = JSON.parse(out.stdout) as { findings: { rule: string; id?: string | null; message: string }[] };
    expect(out.code).toBe(0);
    expect(result.findings.filter((item) => item.rule === 'L030').map((item) => item.message)).toEqual([
      'delegation.astro has no model for reviewer',
      'delegation.astro has no model for spec-writer',
      'delegation.astro has no model for tester',
    ]);

    const complete = gitFixture('spec-complete-harness-no-warning', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { 'spec-writer': 'writer', tester: 'tester', implementer: 'builder', reviewer: 'reviewer' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(complete);
    const clean = await complete.spec('', 'lint', '--format', 'json');
    const cleanResult = JSON.parse(clean.stdout) as { findings: { rule: string }[] };
    expect(cleanResult.findings.some((item) => item.rule === 'L030')).toBe(false);
  });

  it('FMT-015/S8 Invalid stored Claude Code models warn in shared config', async () => {
    const fx = gitFixture('spec-invalid-claude-shared-model', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { 'claude-code': { reviewer: 'claude-haiku-4-5' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L032')).toEqual([
      expect.objectContaining({ message: 'delegation.claude-code has unsupported model claude-haiku-4-5 for reviewer' }),
    ]);
  });

  it('FMT-015/S9 Invalid stored Claude Code models warn in local config', async () => {
    const fx = gitFixture('spec-invalid-claude-local-model', {
      fixture: LINT_BASE,
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/config.local.json'), JSON.stringify({ delegation: { 'claude-code': { reviewer: 'opus-4' } } }));
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L032')).toEqual([
      expect.objectContaining({ message: 'delegation.claude-code has unsupported model opus-4 for reviewer' }),
    ]);
  });

  it('FMT-015/S11 The spec review takes its own model or the reviewer\'s', async () => {
    const four = { 'spec-writer': 'opus', tester: 'sonnet', implementer: 'sonnet', reviewer: 'opus' };
    const prepare = (delegation: Record<string, Record<string, string>>) => (dir: string) => {
      const path = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      writeFileSync(path, JSON.stringify({ ...config, delegation }, null, 2) + '\n');
      const ticket = join(dir, 'tickets/PROP-201.md');
      const entry = '  - { at: "2026-10-28T10:00:00.000Z", role: spec-writer, result: done, summary: x, verdict: null, assumed: [] }';
      writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${entry}`));
    };
    const modelOf = async (fx: ReturnType<typeof gitFixture>) => {
      const out = await fx.spec('', 'next', 'PROP-201', '--harness', 'claude-code', '--format', 'json');
      expect(out.code, out.stderr).toBe(0);
      const entry = JSON.parse(out.stdout) as { role: string; model: string | null; worktree: string };
      expect(entry.role).toBe('spec-review');
      fx.git('worktree', 'remove', '--force', entry.worktree);
      return entry.model;
    };
    const lintRules = async (fx: ReturnType<typeof gitFixture>) => {
      const out = await fx.spec('', 'lint', '--format', 'json');
      return (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    };

    const reviewers = gitFixture('spec-review-model-reviewer', { setup: prepare({ 'claude-code': four }) });
    fixtures.push(reviewers);
    const findings = await lintRules(reviewers);
    expect(findings.filter((item) => item.rule === 'L001' || item.rule === 'L030')).toEqual([]);
    expect(await modelOf(reviewers)).toBe('opus');

    const own = gitFixture('spec-review-model-own', { setup: prepare({ 'claude-code': { ...four, 'spec-review': 'sonnet' } }) });
    fixtures.push(own);
    expect((await lintRules(own)).filter((item) => item.rule === 'L001' || item.rule === 'L030' || item.rule === 'L032')).toEqual([]);
    expect(await modelOf(own)).toBe('sonnet');

    // A spec-review key alone is configured, but the others are still missing.
    const set = gitFixture('spec-review-model-set');
    fixtures.push(set);
    const out = await set.spec('', 'config', 'set', 'delegation.claude-code.spec-review', 'sonnet', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(set.repo, 'spec/config.json'), 'utf8')) as { delegation: unknown }).toMatchObject({ delegation: { 'claude-code': { 'spec-review': 'sonnet' } } });
  }, 120_000);

  it('FMT-015/S7 A partial harness map warns for every missing role: a missing spec-review role is never an L030, a missing reviewer is', async () => {
    const fx = gitFixture('spec-review-never-l030', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { 'spec-writer': 'writer', tester: 'tester', implementer: 'builder', 'spec-review': 'critic' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L001')).toEqual([]);
    expect(findings.filter((item) => item.rule === 'L030').map((item) => item.message)).toEqual(['delegation.astro has no model for reviewer']);
  });

  it('LNT-003/S25 Invalid Claude Code values warn and count as missing in CI', async () => {
    const fx = gitFixture('spec-invalid-claude-values-missing', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { 'claude-code': {
          'spec-writer': 'sonnet',
          tester: 'claude-sonnet-5-5',
          implementer: 'inherit',
          reviewer: 'opus-4',
        } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const built = await fx.spec('', 'build');
    expect(built.code, built.stderr).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code, out.stdout + out.stderr).toBe(0);
    expect(findings.filter((item) => item.rule === 'L032').map((item) => item.message)).toEqual([
      'delegation.claude-code has unsupported model claude-sonnet-5-5 for tester',
      'delegation.claude-code has unsupported model inherit for implementer',
      'delegation.claude-code has unsupported model opus-4 for reviewer',
    ]);
    expect(findings.filter((item) => item.rule === 'L030').map((item) => item.message)).toEqual([
      'delegation.claude-code has no valid model for implementer',
      'delegation.claude-code has no valid model for reviewer',
      'delegation.claude-code has no valid model for tester',
    ]);
  });

  it('FMT-015/S10 Astro delegate role values are not checked against Claude Code models', async () => {
    const fx = gitFixture('spec-astro-free-role-model', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'flutter-implementer' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.some((item) => item.rule === 'L032')).toBe(false);
  });

  it('LNT-003/S18 A custom harness has a lint warning, not a schema error', async () => {
    const fx = gitFixture('spec-lint-custom-harness', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { 'custom-harness': { 'spec-writer': 'writer', tester: 'tester', implementer: 'builder', reviewer: 'reviewer' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const result = JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] };
    expect(out.code).toBe(0);
    expect(result.findings.some((item) => item.rule === 'L029' && item.message.includes('custom-harness'))).toBe(true);
    expect(result.findings.some((item) => item.rule === 'L001')).toBe(false);
  });

  it('LNT-003/S19 A partial harness delegation warns for every unset role', async () => {
    const fx = gitFixture('spec-lint-missing-models', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'builder' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'lint', '--format', 'json');
    const result = JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] };
    expect(out.code).toBe(0);
    expect(result.findings.filter((item) => item.rule === 'L030').map((item) => item.message)).toEqual([
      'delegation.astro has no model for reviewer',
      'delegation.astro has no model for spec-writer',
      'delegation.astro has no model for tester',
    ]);
  });

  it('LNT-003/S20 CI warns for each missing role in a partial harness', async () => {
    const fx = gitFixture('spec-lint-ci-partial-harness', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'builder' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L030').map((item) => item.message)).toEqual([
      'delegation.astro has no model for reviewer',
      'delegation.astro has no model for spec-writer',
      'delegation.astro has no model for tester',
    ]);
  });

  it('LNT-003/S21 CI warns when a current-format config omits delegation', async () => {
    const fx = gitFixture('spec-lint-ci-no-delegation', { fixture: LINT_BASE });
    fixtures.push(fx);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L031')).toEqual([
      expect.objectContaining({ message: 'delegation is required for current-format projects; local-only teams may use config.local.json' }),
    ]);
  });

  it('LNT-003/S22 Older formats stay exempt from the missing-delegation warning', async () => {
    const fx = gitFixture('spec-lint-ci-old-format-no-delegation', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.formatVersion = 1;
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string }[] }).findings;
    expect(findings.some((item) => item.rule === 'L031')).toBe(false);
  });

  it('LNT-003/S23 An unspecified format stays exempt from the missing-delegation warning', async () => {
    const fx = gitFixture('spec-lint-ci-unspecified-format-no-delegation', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        delete config.formatVersion;
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string }[] }).findings;
    expect(findings.some((item) => item.rule === 'L031')).toBe(false);
  });

  it('LNT-003/S24 An empty delegation map also has no configured harness', async () => {
    const fx = gitFixture('spec-lint-ci-empty-delegation', {
      fixture: LINT_BASE,
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = {};
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = await fx.spec('', 'lint', '--ci', '--format', 'json');
    const findings = (JSON.parse(out.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(out.code).toBe(0);
    expect(findings.filter((item) => item.rule === 'L031')).toEqual([
      expect.objectContaining({ message: 'delegation is required for current-format projects; local-only teams may use config.local.json' }),
    ]);
  });

  it('FMT-015/S5 init ignores the local configuration file', async () => {
    const dir = tempDir('spec-init-local-');
    dirs.push(dir);
    const out = await run({ argv: ['init', dir, '--name', 'local'], env: {}, cwd: dir, scriptPath: undefined });
    expect(out.code).toBe(0);
    expect(readFileSync(join(dir, 'spec/.gitignore'), 'utf8')).toContain('config.local.json');
  }, 60_000);
});
