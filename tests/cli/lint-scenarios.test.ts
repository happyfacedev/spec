// LNT-001 and LNT-003 through the CLI, on a throwaway git copy of the lint-case base spec
// (the "base spec" of both features).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, fillTree, gitFixture, runCliLimited, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const externalDirs: string[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
  for (const dir of externalDirs) rmSync(dir, { recursive: true, force: true });
});

/** The base spec with `edit` applied to the project directory before git sees it. */
function base(edit?: (dir: string) => void): Fx {
  const fx = gitFixture('spec-lint-scenarios', {
    fixture: LINT_BASE,
    setup: (dir) => {
      setConfig(dir, (cfg) => (cfg.delegation = { 'claude-code': { 'spec-writer': 'opus', tester: 'sonnet', implementer: 'sonnet', reviewer: 'opus' } }));
      edit?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

const read = (dir: string, path: string) => readFileSync(join(dir, path), 'utf8');
const patch = (dir: string, path: string, f: (text: string) => string) => { writeFileSync(join(dir, path), f(read(dir, path))); };
const setConfig = (dir: string, f: (cfg: Record<string, unknown>) => void) => { patch(dir, 'spec/config.json', (t) => {
    const cfg = JSON.parse(t) as Record<string, unknown>;
    f(cfg);
    return `${JSON.stringify(cfg, null, 2)}\n`;
  }); };

interface Finding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  id: string | null;
  message: string;
  fix: string;
}
const lintJson = async (fx: Fx, ...flags: string[]) => {
  const out = await fx.spec('', 'lint', ...flags, '--format', 'json');
  return { code: out.code, report: JSON.parse(out.stdout) as { spec: string; findings: Finding[] } };
};

const REFUNDED = (dir: string) => { patch(dir, 'spec/modules/beta/contracts.md', (t) => `${t.trimEnd()}\n\n### beta.Refunded\nKind: event · Status: active\nA refund was made.\n`); };
const FORMAT3 = (dir: string) => { setConfig(dir, (cfg) => (cfg.formatVersion = 3)); };

describe('LNT-001: Lint the spec and the tickets', () => {
  it('LNT-001/S1 The base spec lints clean', async () => {
    const out = await base().spec('', 'lint');
    expect(out.stdout).toBe('lint clean\n');
    expect(out.code).toBe(0);
  });

  it('LNT-001/S2 JSON output of a clean spec', async () => {
    const { code, report } = await lintJson(base());
    expect(report.spec).toMatch(/^spec@[0-9a-f]{8}$/);
    expect(report.findings).toEqual([]);
    expect(code).toBe(0);
  });

  it('LNT-001/S3 An error without a unit', async () => {
    const out = await base(FORMAT3).spec('', 'lint');
    expect(out.stdout).toBe('config.json:1 error L001: config.json is format 3, newer than this spec CLI (format 2)\n  fix: update the spec CLI\n1 error, 0 warnings\n');
    expect(out.code).toBe(1);
  });

  it('LNT-001/S4 Warnings alone pass', async () => {
    const out = await base(REFUNDED).spec('', 'lint');
    expect(out.stdout).toBe(
      'modules/beta/contracts.md:10 warning L012 beta.Refunded: nothing references beta.Refunded\n  fix: reference it from the features that read or write it, or deprecate it\n0 errors, 1 warning\n',
    );
    expect(out.code).toBe(0);
  });

  it('LNT-001/S5 Findings are sorted by file, then line, then rule', async () => {
    const fx = base((dir) => { patch(dir, 'spec/modules/beta/contracts.md', (t) => `${t.trimEnd()}\n\n#### alpha.Widget.colour\nThe colour. Type: string\n\n### alpha.Gizmo\nKind: event · Status: active\nA gizmo.\n`); },
    );
    const out = await fx.spec('', 'lint');
    const { report } = await lintJson(fx);
    expect(report.findings.map((f) => [f.rule, f.severity, f.file, f.line, f.id])).toEqual([
      ['L019', 'error', 'modules/beta/contracts.md', 10, 'alpha.Widget.colour'],
      ['L012', 'warning', 'modules/beta/contracts.md', 13, 'alpha.Gizmo'],
      ['L019', 'error', 'modules/beta/contracts.md', 13, 'alpha.Gizmo'],
    ]);
    expect(out.stdout.trimEnd().split('\n').at(-1)).toBe('2 errors, 1 warning');
  });

  it('LNT-001/S6 JSON keys of a finding', async () => {
    const { code, report } = await lintJson(base(REFUNDED));
    expect(report.findings).toHaveLength(1);
    expect(Object.keys(report.findings[0] ?? {})).toEqual(['rule', 'severity', 'file', 'line', 'id', 'message', 'fix']);
    expect(Object.values(report.findings[0] ?? {})).toEqual(['L012', 'warning', 'modules/beta/contracts.md', 10, 'beta.Refunded', 'nothing references beta.Refunded', 'reference it from the features that read or write it, or deprecate it']);
    expect(code).toBe(0);
  });

  it('LNT-001/S7 JSON output exits 1 on an error', async () => {
    const { code, report } = await lintJson(base(FORMAT3));
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ rule: 'L001', severity: 'error', file: 'config.json', line: 1, message: 'config.json is format 3, newer than this spec CLI (format 2)' });
    expect(code).toBe(1);
  });

  it('LNT-001/S8 Ticket findings name the file from the project root', async () => {
    const fx = base((dir) => { patch(dir, 'tickets/TASK-001.md', (t) => t.replace('default: widget-utils', 'default: null')); });
    const { report } = await lintJson(fx);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ rule: 'L010', severity: 'error', file: 'tickets/TASK-001.md', line: 11 });
  });

  it('LNT-001/S9 L013 is retired', async () => {
    const fx = base((dir) => { patch(dir, 'spec/modules/alpha/features/ALP-001-make-a-widget.md', (t) => t.replace('ui: [UI-001]\n', 'ui: [UI-001]\nrequires: [BET-001]\n')); });
    const { report } = await lintJson(fx);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ rule: 'L001', line: 10, message: 'unknown field requires in feature', fix: 'remove requires or fix its spelling' });
    expect(report.findings.some((f) => f.rule === 'L013')).toBe(false);
  });

  it('LNT-001/S10 L015 is retired', async () => {
    const fx = base((dir) => { patch(dir, 'spec/core/overview.md', (t) => `${t}\n## Modules\n- alpha\n- gamma\n`); });
    const out = await fx.spec('', 'lint');
    expect(out.stdout).toBe('lint clean\n');
    expect((await lintJson(fx)).report.findings.some((f) => f.rule === 'L015')).toBe(false);
  });
});

  it('LNT-004/S14 A project name with spaces is refused by the config schema', async () => {
    const fx = base((dir) => { setConfig(dir, (cfg) => (cfg.name = 'My App')); });
    const { report } = await lintJson(fx);
    expect(report.findings).toContainEqual(expect.objectContaining({
      rule: 'L001',
      file: 'config.json',
      message: 'config.json name: Invalid string: must match pattern /^[a-z][a-z0-9_-]*$/',
    }));
  });

  describe('LNT-003: Check generated files, code pointers and allowed commands in CI', () => {
  it('LNT-003/S1 index.md is missing', async () => {
    const { report } = await lintJson(base(), '--ci');
    expect(report.findings).toEqual([missingHookWarning, { rule: 'L017', severity: 'error', file: 'index.md', line: 1, id: null, message: 'index.md is missing', fix: 'run spec build and commit the result' }]);
  });

  it('LNT-003/S2 Plain lint does not check index.md', async () => {
    expect((await lintJson(base())).report.findings).toEqual([]);
  });

  it('LNT-003/S3 index.md is stale', async () => {
    const fx = base();
    expect((await fx.spec('', 'build')).code).toBe(0);
    patch(fx.repo, 'spec/modules/alpha/features/ALP-001-make-a-widget.md', (t) => t.replace('title: Make a widget', 'title: Make one widget'));
    const { report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([missingHookWarning, { rule: 'L017', severity: 'error', file: 'index.md', line: 1, id: null, message: 'index.md is stale', fix: 'run spec build and commit the result' }]);
  });

  const withCode = (dir: string) => {
    setConfig(dir, (cfg) => (cfg.codeGlobs = ['src/**']));
    patch(dir, 'spec/modules/alpha/contracts.md', (t) => t.replace('One widget.\n', 'One widget.\nCode: Widget.make\n'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src/widget.ts'), 'export class Widget {\n  make(): number {\n    return 1;\n  }\n}\n');
  };
  const renamed = (dir: string) => {
    withCode(dir);
    writeFileSync(join(dir, 'src/widget.ts'), 'export class Widget {\n  build(): number {\n    return 1;\n  }\n}\n');
    mkdirSync(join(dir, 'tests'), { recursive: true });
    writeFileSync(join(dir, 'tests/w.ts'), "// Widget.make\nexport const w = 'Widget.make';\n");
  };

  it('LNT-003/S7 A Code: line whose symbol the code still holds', async () => {
    const fx = base(withCode);
    expect((await fx.spec('', 'build')).code).toBe(0);
    expect((await lintJson(fx, '--ci')).report.findings).toEqual([missingHookWarning]);
  });

  it('LNT-003/S8 A Code: line whose symbol the code no longer holds', async () => {
    const fx = base(renamed);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([
      missingHookWarning,
      {
        rule: 'L024',
        severity: 'warning',
        file: 'modules/alpha/contracts.md',
        line: 6,
        id: 'alpha.Widget',
        message: 'Code: Widget.make is not in the code',
        fix: 'update the Code: line to where the code implements it now, or restore the code',
      },
    ]);
    expect(code).toBe(0);
  });

  it('LNT-003/S9 No code globs, no code check', async () => {
    const fx = base((dir) => {
      renamed(dir);
      setConfig(dir, (cfg) => (cfg.codeGlobs = []));
    });
    expect((await fx.spec('', 'build')).code).toBe(0);
    expect((await lintJson(fx, '--ci')).report.findings).toEqual([missingHookWarning]);
  });

  it('LNT-003/S29 A file Git ignores does not hold a Code: symbol', async () => {
    const fx = base((dir) => {
      renamed(dir);
      rmSync(join(dir, 'tests'), { recursive: true, force: true });
      writeFileSync(join(dir, '.gitignore'), 'src/gen/\n');
      mkdirSync(join(dir, 'src/gen'), { recursive: true });
      writeFileSync(join(dir, 'src/gen/widget.ts'), 'export class Widget {\n  make(): number {\n    return 1;\n  }\n}\n');
    });
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([
      missingHookWarning,
      {
        rule: 'L024',
        severity: 'warning',
        file: 'modules/alpha/contracts.md',
        line: 6,
        id: 'alpha.Widget',
        message: 'Code: Widget.make is not in the code',
        fix: 'update the Code: line to where the code implements it now, or restore the code',
      },
    ]);
    expect(code).toBe(0);
  });

  it('LNT-003/S30 A large ignored tree does not stop the CI check', { timeout: 120_000 }, async () => {
    const fx = base((dir) => {
      withCode(dir);
      setConfig(dir, (cfg) => (cfg.codeGlobs = ['src/**', 'build/**']));
      writeFileSync(join(dir, '.gitignore'), 'build/\n');
      fillTree(join(dir, 'build'));
    });
    expect((await fx.spec('', 'build')).code).toBe(0);
    const out = runCliLimited(fx.repo, 'lint', '--ci', '--format', 'json');
    expect(out.stderr).not.toContain('heap out of memory');
    expect((JSON.parse(out.stdout) as { findings: Finding[] }).findings).toEqual([missingHookWarning]);
    expect(out.code).toBe(0);
  });

  const withLegacyDispatch = (dir: string) => {
    setConfig(dir, (cfg) => {
      cfg.dispatchCommand = 'claude -p {ticket}';
      cfg.models = { small: 'sonnet', large: 'opus', threshold: 4 };
    });
  };
  const legacyFindings = [
    {
      rule: 'L028',
      severity: 'warning',
      file: 'config.json',
      line: 1,
      id: null,
      message: 'dispatchCommand is ignored since X139; the session drives stages with spec next',
      fix: 'remove dispatchCommand from config.json',
    },
    {
      rule: 'L028',
      severity: 'warning',
      file: 'config.json',
      line: 1,
      id: null,
      message: 'models is ignored since X139; the session drives stages with spec next',
      fix: 'remove models from config.json',
    },
  ];

  it('LNT-003/S15 Legacy keys warn on plain lint', async () => {
    const fx = base(withLegacyDispatch);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx);
    expect(report.findings).toEqual(legacyFindings);
    expect(code).toBe(0);
  });

  const missingHookWarning = {
    rule: 'L033',
    severity: 'warning',
    file: 'config.json',
    line: 1,
    id: null,
    message: 'Git enforcement hooks are not installed or integrated: pre-commit, pre-merge-commit, commit-msg',
    fix: 'run .spec/bin/spec upgrade and add the reported lines to the configured hook files',
  };

  it('LNT-003/S16 CI includes both compatibility warnings', async () => {
    const fx = base(withLegacyDispatch);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([...legacyFindings, missingHookWarning]);
    expect(code).toBe(0);
  });

  it('LNT-003/S17 A config without legacy keys has no compatibility warning', async () => {
    const fx = base();
    expect((await fx.spec('', 'build')).code).toBe(0);
    expect((await lintJson(fx)).report.findings).toEqual([]);
  });

  it('LNT-003/S26 CI warns when Git enforcement hooks are missing: CI warns when the common hooks directory has no enforcement hooks', async () => {
    const fx = base();
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([missingHookWarning]);
    expect(code).toBe(0);
  });

  it('LNT-003/S26 CI warns when Git enforcement hooks are missing: CI warns when an in-tree hooksPath has no integration lines', async () => {
    const fx = base((dir) => {
      mkdirSync(join(dir, '.husky'), { recursive: true });
      writeFileSync(join(dir, '.husky/pre-commit'), '#!/bin/sh\n# .spec/bin/spec hook git pre-commit "$@"\necho user hook\n');
    });
    fx.git('config', 'core.hooksPath', '.husky');
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([missingHookWarning]);
    expect(code).toBe(0);
  });

  it('LNT-003/S26 CI warns when Git enforcement hooks are missing: CI warns when an external hooksPath has no integration lines', async () => {
    const fx = base();
    const globalHooks = tempDir('spec-lint-external-hooks-');
    externalDirs.push(globalHooks);
    writeFileSync(join(globalHooks, 'pre-commit'), '#!/bin/sh\\necho global hook\\n');
    fx.git('config', 'core.hooksPath', globalHooks);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([missingHookWarning]);
    expect(code).toBe(0);
  });

  it('LNT-003/S26 CI warns when Git enforcement hooks are missing: CI is quiet when all three common hooks contain spec integration lines', async () => {
    const fx = base();
    const hooks = join(fx.repo, '.git/hooks');
    mkdirSync(hooks, { recursive: true });
    for (const name of ['pre-commit', 'pre-merge-commit', 'commit-msg']) {
      writeFileSync(join(hooks, name), `#!/bin/sh\n.spec/bin/spec hook git ${name} "$@"\n`);
    }
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings).toEqual([]);
    expect(code).toBe(0);
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: plain lint warns when afterMerge has no generated globs', async () => {
    const fx = base((dir) => {
      setConfig(dir, (config) => { config.afterMerge = 'npm run build'; config.generatedGlobs = []; });
    });
    const { code, report } = await lintJson(fx);
    expect(report.findings.filter((entry) => entry.rule === 'L034')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        file: 'config.json',
        line: 1,
        message: 'afterMerge is configured but generated is not set; history only authorizes its generated-path commits',
        fix: 'set generated.globs to the project-relative patterns written by afterMerge, or remove afterMerge',
      }),
    ]);
    expect(code).toBe(0);
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: CI lint also warns when afterMerge has no generated globs', async () => {
    const fx = base((dir) => {
      setConfig(dir, (config) => { config.afterMerge = 'npm run build'; config.generatedGlobs = []; });
    });
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { code, report } = await lintJson(fx, '--ci');
    expect(report.findings.some((entry) => entry.rule === 'L034' && entry.severity === 'warning')).toBe(true);
    expect(report.findings.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(code).toBe(0);
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: omits the warning when afterMerge is not set', async () => {
    const { report } = await lintJson(base());
    expect(report.findings.some((entry) => entry.rule === 'L034')).toBe(false);
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: omits the warning when generatedGlobs is non-empty', async () => {
    const fx = base((dir) => {
      setConfig(dir, (config) => { config.afterMerge = 'npm run build'; config.generatedGlobs = ['src/generated/**']; });
    });
    const { report } = await lintJson(fx);
    expect(report.findings.some((entry) => entry.rule === 'L034')).toBe(false);
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: omits the warning when generated is set, with or without a command', async () => {
    for (const generated of [{ globs: ['src/generated/**'] }, { globs: ['src/generated/**'], command: 'npm run build' }]) {
      const fx = base((dir) => {
        setConfig(dir, (config) => { config.afterMerge = 'npm run build'; config.generated = generated; });
      });
      const { report } = await lintJson(fx);
      expect(report.findings.some((entry) => entry.rule === 'L034'), JSON.stringify(generated)).toBe(false);
    }
  });

  it('LNT-003/S27 Lint warns when afterMerge has no generated globs: CI lint words L034 by the generated key too', async () => {
    const fx = base((dir) => {
      setConfig(dir, (config) => { config.afterMerge = 'npm run build'; });
    });
    expect((await fx.spec('', 'build')).code).toBe(0);
    const { report } = await lintJson(fx, '--ci');
    expect(report.findings.filter((entry) => entry.rule === 'L034')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        file: 'config.json',
        line: 1,
        message: 'afterMerge is configured but generated is not set; history only authorizes its generated-path commits',
        fix: 'set generated.globs to the project-relative patterns written by afterMerge, or remove afterMerge',
      }),
    ]);
  });

  const l036 = {
    rule: 'L036',
    severity: 'warning',
    file: 'config.json',
    line: 1,
    message: 'generatedGlobs is replaced by generated; it is read as generated.globs without a command',
    fix: 'move its globs into generated.globs and remove generatedGlobs',
  };

  it('LNT-003/S28 A legacy generatedGlobs warns that generated replaces it: plain lint and CI', async () => {
    const fx = base((dir) => {
      setConfig(dir, (config) => { config.generatedGlobs = ['plugin/generated/**']; });
    });
    const plain = await lintJson(fx);
    expect(plain.report.findings.filter((entry) => entry.rule === 'L036')).toEqual([expect.objectContaining(l036)]);
    expect(plain.code).toBe(0);
    expect((await fx.spec('', 'build')).code).toBe(0);
    const ci = await lintJson(fx, '--ci');
    expect(ci.report.findings.filter((entry) => entry.rule === 'L036')).toEqual([expect.objectContaining(l036)]);
    expect(ci.code).toBe(0);
  });

  it('LNT-003/S28 A legacy generatedGlobs warns that generated replaces it: no L036 when generatedGlobs is absent or holds no glob', async () => {
    const absent = await lintJson(base());
    expect(absent.report.findings.some((entry) => entry.rule === 'L036')).toBe(false);
    const empty = await lintJson(base((dir) => { setConfig(dir, (config) => { config.generatedGlobs = []; }); }));
    expect(empty.report.findings.some((entry) => entry.rule === 'L036')).toBe(false);
  });

  it('LNT-003/S28 A legacy generatedGlobs warns that generated replaces it: L036 is one warning even with generated set, and generated alone does not warn', async () => {
    const both = await lintJson(base((dir) => {
      setConfig(dir, (config) => { config.generated = { globs: ['src/generated/**'] }; config.generatedGlobs = ['plugin/generated/**', 'build/**']; });
    }));
    expect(both.report.findings.filter((entry) => entry.rule === 'L036')).toEqual([expect.objectContaining(l036)]);
    expect(both.code).toBe(0);
    const only = await lintJson(base((dir) => { setConfig(dir, (config) => { config.generated = { globs: ['src/generated/**'] }; }); }));
    expect(only.report.findings.some((entry) => entry.rule === 'L036')).toBe(false);
  });
});
