// WSP-006: spec merge, scenario by scenario, on throwaway git copies of chat-mini. The project's test
// command is a script outside the repo that writes a vitest-style report, so each scenario says what
// the tests did on the merged result (and on the rerun). Tickets are made by hand: the ticket file
// is on main as open, and its branch flips it to done.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterAll, expect, vi } from 'vitest';
import { partitionedDescribe, partitionedIt } from './partitioned-it';
const describe = partitionedDescribe(3, 'WSP-006: merge a done ticket when the merged result passes');
const it = partitionedIt(3);
import { git } from '../../src/io/git';
import { REPO, gitFixture, tempDir, trackChild } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const scratch = realpathSync(tempDir('spec-merge-'));
afterAll(() => {
  for (const fx of made) {
    git(fx.repo, ['worktree', 'prune']);
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    fx.cleanup();
  }
  rmSync(scratch, { recursive: true, force: true });
}, 120_000);

const TITLE = 'CNV-003/S1 Copy a message';
type Tests = 'pass' | 'fail' | 'flaky' | 'exit1';
let counter = 0;

/** A test command that writes a report: all pass; the test fails; it fails then passes on the rerun; exit 1 with no failed test. */
function testCommand(kind: Tests): string {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  const count = join(dir, 'count');
  const script = join(dir, 'tests.sh');
  const status = { pass: 'passed', fail: 'failed', flaky: '$([ "$n" -ge 2 ] && echo passed || echo failed)', exit1: 'passed' }[kind];
  const code = { pass: '0', fail: '1', flaky: '$([ "$n" -ge 2 ] && echo 0 || echo 1)', exit1: '1' }[kind];
  writeFileSync(
    script,
    [
      `n=$(cat '${count}' 2>/dev/null || echo 0)`,
      'n=$((n+1))',
      `echo $n > '${count}'`,
      kind === 'exit1'
        ? `echo '{"testResults":[{"assertionResults":[]}]}' > "$1"`
        : `printf '{"testResults":[{"assertionResults":[{"title":"%s","status":"%s"}]}]}' '${TITLE}' "${status}" > "$1"`,
      `exit ${code}`,
      '',
    ].join('\n'),
  );
  return `sh '${script}' "{report}"`;
}

const ticketMd = (id: string, title: string, extra = '') =>
  `---\nid: ${id}\ntype: task\ntitle: ${title}\nstatus: open\nstage: null\ntouches: [CNV-003]\nviolates: []\nchanged: []\nquestions: []\nhistory: []\n---\n${extra}Body.\n`;

interface Opts {
  tests?: Tests;
  /** New tickets, as [id, title]. */
  tickets?: [string, string][];
  setup?: (dir: string) => void;
  /** The afterMerge command. */
  afterMerge?: string;
  generatedGlobs?: string[];
  /** The `generated` key, as format.GeneratedConfig. */
  generated?: { globs: string[]; command?: string };
}
/** An afterMerge command that appends "<cwd> <branch>" to a log outside the repo, then runs `lines`. */
function afterMergeScript(lines: string[]): { command: string; log: string } {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  const log = join(dir, 'log');
  const script = join(dir, 'after.sh');
  writeFileSync(script, [`echo "$(pwd -P) $(git branch --show-current)" >> '${log}'`, ...lines, ''].join('\n'));
  return { command: `sh '${script}'`, log };
}
function project(opts: Opts = {}): Fx {
  const fx = gitFixture('spec-merge', {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = testCommand(opts.tests ?? 'pass');
      if (opts.afterMerge) cfg.afterMerge = opts.afterMerge;
      if (opts.generatedGlobs !== undefined) cfg.generatedGlobs = opts.generatedGlobs;
      if (opts.generated !== undefined) cfg.generated = opts.generated;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      for (const [id, title] of opts.tickets ?? []) writeFileSync(join(dir, 'tickets', `${id}.md`), ticketMd(id, title));
      opts.setup?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

const read = (fx: Fx, path: string) => readFileSync(join(fx.repo, path), 'utf8');
const write = (fx: Fx, path: string, text: string) => {
  mkdirSync(join(fx.repo, path, '..'), { recursive: true });
  writeFileSync(join(fx.repo, path), text);
};
/** Branch `ticket/<id>` from main, with the ticket done and `edit` applied; back on main. */
function finish(fx: Fx, id: string, edit?: () => void) {
  fx.git('checkout', '-q', '-b', `ticket/${id}`);
  write(fx, `tickets/${id}.md`, read(fx, `tickets/${id}.md`).replace(/^status: .*$/m, 'status: done'));
  edit?.();
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', `${id}: done`);
  fx.git('checkout', '-q', 'main');
}
/** A commit on main. */
function onMain(fx: Fx, edit: () => void) {
  edit();
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'main moves on');
}
const head = (fx: Fx) => fx.git('rev-parse', 'HEAD').stdout.trim();
const short = (fx: Fx) => fx.git('rev-parse', '--short', 'HEAD').stdout.trim();
const clean = (fx: Fx) => fx.git('status', '--porcelain').stdout;
const replaceIn = (fx: Fx, path: string, from: string | RegExp, to: string) => { write(fx, path, read(fx, path).replace(from, to)); };
const mergeJson = async (fx: Fx, ...ids: string[]) => JSON.parse((await fx.spec('', 'merge', ...ids, '--format', 'json')).stdout) as Record<string, unknown>[];
const EXPORT = 'src/conversation/export.ts';

describe('WSP-006: merge a done ticket when the merged result passes', () => {
  it('WSP-006/S1 A done ticket merges', async () => {
    const fx = project();
    finish(fx, 'TASK-101');
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('Merge ticket/TASK-101: Extract provider selection into its own module');
    expect(fx.git('log', '-1', '--format=%B').stdout).toContain('Spec-Ticket: TASK-101');
    expect(fx.git('rev-list', '--parents', '-n', '1', 'HEAD').stdout.trim().split(' ')).toHaveLength(3);
    expect(fx.git('rev-parse', 'HEAD^1').stdout.trim()).toBe(before);
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
  }, 120_000);

  it('WSP-006/S2 Tests fail on the merged result', async () => {
    const fx = project({ tests: 'fail', tickets: [['TASK-105', 'Break the export']] });
    finish(fx, 'TASK-105', () => { replaceIn(fx, EXPORT, "join('\\n\\n')", "join('\\n')"); });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-105');
    expect(out.stdout.startsWith('TASK-105: not merged, after merging ticket/TASK-105 tests fail (CNV-003/S1')).toBe(true);
    expect(out.stdout.endsWith('); ticket/TASK-105 stays unmerged\n')).toBe(true);
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-006/S3 The test detail when no test is named', async () => {
    const fx = project({ tests: 'exit1', tickets: [['TASK-105', 'Break the export']] });
    finish(fx, 'TASK-105');
    const out = await fx.spec('', 'merge', 'TASK-105');
    expect(out.stdout).toBe('TASK-105: not merged, after merging ticket/TASK-105 tests fail (exit 1); ticket/TASK-105 stays unmerged\n');
  }, 120_000);

  it('WSP-006/S4 Lint errors on the merged result', async () => {
    const fx = project({ tickets: [['TASK-106', 'Spoil the spec']] });
    finish(fx, 'TASK-106', () => { replaceIn(fx, 'spec/modules/conversation/features/CNV-001-send-a-message.md', /\n---\n/, '\nrequires: [BET-001]\n---\n'); });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-106');
    expect(out.stdout).toBe('TASK-106: not merged, after merging ticket/TASK-106 the spec has lint errors; ticket/TASK-106 stays unmerged\n');
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
  }, 120_000);

  it('WSP-006/S4 Lint errors on the merged result: a dangling symlink under spec/ is one L037 error and refuses the merge', async () => {
    const fx = project({ tickets: [['TASK-107', 'Dangle a link']] });
    finish(fx, 'TASK-107', () => { symlinkSync('does-not-exist.md', join(fx.repo, 'spec/modules/conversation/broken.md')); });
    fx.git('checkout', '-q', 'ticket/TASK-107');
    const lint = await fx.spec('', 'lint', '--format', 'json');
    expect((JSON.parse(lint.stdout) as { findings: { rule: string; file: string }[] }).findings).toContainEqual(expect.objectContaining({ rule: 'L037', file: 'modules/conversation/broken.md' }));
    fx.git('checkout', '-q', 'main');
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-107');
    expect(out.stdout).toBe('TASK-107: not merged, after merging ticket/TASK-107 the spec has lint errors; ticket/TASK-107 stays unmerged\n');
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
    expect(fx.git('ls-files', 'spec/modules/conversation/broken.md').stdout).toBe('');
  }, 120_000);

  const bothChangeGeneratedAndIndex = (fx: Fx, generatedPath: string) => {
    finish(fx, 'TASK-103', () => {
      write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nbranch line\n`);
      write(fx, generatedPath, `branch generated: ${generatedPath}\n`);
    });
    onMain(fx, () => {
      write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nmain line\n`);
      write(fx, generatedPath, `main generated: ${generatedPath}\n`);
    });
  };

  it('WSP-006/S5 Only generated files conflict', async () => {
    const ordinary = project();
    finish(ordinary, 'TASK-103', () => { write(ordinary, 'plugin/notes.md', 'branch note\n'); });
    onMain(ordinary, () => { write(ordinary, 'plugin/notes.md', 'main note\n'); });
    const blocked = await ordinary.spec('', 'merge', 'TASK-103');
    expect(blocked.stdout).toBe('TASK-103: not merged, merging ticket/TASK-103 conflicts in plugin/notes.md; a person must merge it\n');
    expect(clean(ordinary)).toBe('');

    const fx = project({ generatedGlobs: ['plugin/generated/**'] });
    bothChangeGeneratedAndIndex(fx, 'plugin/generated/app.js');
    const out = await fx.spec('', 'merge', 'TASK-103');
    expect(out.stdout).toBe(`TASK-103: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(read(fx, 'spec/index.md')).not.toMatch(/^(branch|main) line$/m);
    expect(read(fx, 'plugin/generated/app.js')).toBe('branch generated: plugin/generated/app.js\n');
    expect(clean(fx)).toBe('');
    // spec/index.md is what spec build writes.
    expect((await fx.spec('', 'build')).code).toBe(0);
    expect(clean(fx)).toBe('');
    const json = project({ generatedGlobs: ['plugin/generated/**'] });
    bothChangeGeneratedAndIndex(json, 'plugin/generated/app.js');
    expect((await mergeJson(json, 'TASK-103'))[0]).toMatchObject({ ok: true, ticket: 'TASK-103', rebuilt: true });

    // FMT-002/R8: `generated` with globs and no command gives the same result as the old key.
    const noCommand = project({ generated: { globs: ['plugin/generated/**'] } });
    bothChangeGeneratedAndIndex(noCommand, 'plugin/generated/app.js');
    const taken = await noCommand.spec('', 'merge', 'TASK-103');
    expect(taken.stdout).toBe(`TASK-103: merged (${short(noCommand)}, generated files rebuilt)\n`);
    expect(taken.code).toBe(0);
    expect(read(noCommand, 'spec/index.md')).not.toMatch(/^(branch|main) line$/m);
    expect(read(noCommand, 'plugin/generated/app.js')).toBe('branch generated: plugin/generated/app.js\n');
    expect(clean(noCommand)).toBe('');
    expect((await noCommand.spec('', 'build')).code).toBe(0);
    expect(clean(noCommand)).toBe('');
    const noCommandJson = project({ generated: { globs: ['plugin/generated/**'] } });
    bothChangeGeneratedAndIndex(noCommandJson, 'plugin/generated/app.js');
    expect((await mergeJson(noCommandJson, 'TASK-103'))[0]).toMatchObject({ ok: true, ticket: 'TASK-103', rebuilt: true });

    // With a command, the file it names is rebuilt as WSP-009 says, and stdout is the same.
    const withCommand = project({ generated: { globs: ['src/generated/**'], command: "mkdir -p src/generated && printf 'rebuilt\\n' > src/generated/assets.ts" } });
    bothChangeGeneratedAndIndex(withCommand, 'src/generated/assets.ts');
    const rebuilt = await withCommand.spec('', 'merge', 'TASK-103');
    expect(rebuilt.stdout).toBe(`TASK-103: merged (${short(withCommand)}, generated files rebuilt)\n`);
    expect(read(withCommand, 'src/generated/assets.ts')).toBe('rebuilt\n');
    expect(read(withCommand, 'spec/index.md')).not.toMatch(/^(branch|main) line$/m);
    expect(clean(withCommand)).toBe('');

    // A project without `generated` still needs a person for the same file.
    const none = project();
    bothChangeGeneratedAndIndex(none, 'plugin/generated/app.js');
    const refused = await none.spec('', 'merge', 'TASK-103');
    expect(refused.stdout).toContain('conflicts in plugin/generated/app.js');
    expect(refused.code).toBe(1);
  }, 240_000);

  it('WSP-006/S6 The merged spec cannot be built', async () => {
    const fx = project();
    finish(fx, 'TASK-103', () => {
      write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nbranch line\n`);
      write(fx, 'spec/stray.md', '# Stray\n');
    });
    onMain(fx, () => { write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nmain line\n`); });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-103');
    expect(out.stdout.startsWith('TASK-103: not merged, the merged spec does not build: ')).toBe(true);
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
  }, 120_000);

  it('WSP-006/S7 Any other conflict needs a person', async () => {
    const fx = project();
    finish(fx, 'TASK-103', () => {
      replaceIn(fx, EXPORT, "join('\\n\\n')", "join('\\n---\\n')");
      write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nbranch line\n`);
    });
    onMain(fx, () => {
      replaceIn(fx, EXPORT, "join('\\n\\n')", "join('\\n\\n\\n')");
      write(fx, 'spec/index.md', `${read(fx, 'spec/index.md')}\nmain line\n`);
    });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-103');
    expect(out.stdout).toBe(`TASK-103: not merged, merging ticket/TASK-103 conflicts in ${EXPORT}; a person must merge it\n`);
    expect(head(fx)).toBe(before);
    expect(existsSync(join(fx.repo, '.git/MERGE_HEAD'))).toBe(false);
    expect(clean(fx)).toBe('');
  }, 120_000);

  /** TASK-101 with its worktree, done on its branch there. */
  const withWorktree = async (extra?: (tree: string) => void, opts: Opts = {}) => {
    const fx = project(opts);
    expect((await fx.spec('', 'worktree', 'add', 'TASK-101')).code).toBe(0);
    const tree = `${realpathSync(fx.repo)}.worktrees/TASK-101`;
    const file = join(tree, 'tickets/TASK-101.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: done'));
    git(tree, ['add', '-A']);
    git(tree, ['commit', '-q', '-m', 'TASK-101: done']);
    extra?.(tree);
    return { fx, tree };
  };

  it("WSP-006/S8 The merged ticket's worktree is removed", async () => {
    const { fx, tree } = await withWorktree();
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.code).toBe(0);
    expect(existsSync(tree)).toBe(false);
    expect(fx.git('rev-parse', '--verify', 'refs/heads/ticket/TASK-101').code).toBe(0);
  }, 120_000);

  it('WSP-006/S9 A worktree with uncommitted changes stays', async () => {
    const { fx, tree } = await withWorktree((t) => { writeFileSync(join(t, 'notes.txt'), 'mine\n'); });
    const kept = `${tree} has uncommitted changes: notes.txt`;
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(existsSync(join(tree, 'notes.txt'))).toBe(true);
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}), but its worktree was kept: ${kept}\n`);
    expect(out.code).toBe(0);
  }, 120_000);

  it('WSP-006/S9 The JSON form reports worktreeKept', async () => {
    const { fx, tree } = await withWorktree((t) => { writeFileSync(join(t, 'notes.txt'), 'mine\n'); });
    const out = await mergeJson(fx, 'TASK-101');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ok: true, ticket: 'TASK-101', worktreeKept: `${tree} has uncommitted changes: notes.txt` });
  }, 120_000);

  const blocked = (fx: Fx) => { onMain(fx, () => { write(
        fx,
        'tickets/TASK-102.md',
        read(fx, 'tickets/TASK-102.md')
          .replace(/^status: .*$/m, 'status: blocked')
          .replace(/^stage: .*$/m, 'stage: implementer')
          .replace(/^questions: \[\]$/m, 'questions:\n  - id: Q1\n    kind: blocker\n    text: meta has no key for it\n    default: null\n    cites: [conversation.Message.meta]\n    answer: null\n    raised_by: implementer'),
      ); },
    ); };

  it('WSP-006/S10 Several tickets, in order', async () => {
    const fx = project();
    finish(fx, 'TASK-101');
    finish(fx, 'TASK-103');
    blocked(fx);
    const out = await fx.spec('', 'merge', 'TASK-101', 'TASK-102', 'TASK-103');
    expect(out.stdout.split('\n')).toEqual([
      expect.stringMatching(/^TASK-101: merged \(.+\)$/) as string,
      'TASK-102: not merged, TASK-102 is blocked, not done',
      expect.stringMatching(/^TASK-103: merged \(.+\)$/) as string,
      '',
    ]);
    expect(fx.git('log', '--first-parent', '--format=%s', '-2').stdout.trim().split('\n')).toEqual(['Merge ticket/TASK-103: Simplify the fallback code', 'Merge ticket/TASK-101: Extract provider selection into its own module']);
    expect(out.code).toBe(1);
  }, 240_000);

  it('WSP-006/S11 The JSON form', async () => {
    const fx = project();
    finish(fx, 'TASK-101');
    blocked(fx);
    const out = await mergeJson(fx, 'TASK-101', 'TASK-102');
    expect(out).toEqual([
      { ok: true, ticket: 'TASK-101', commit: short(fx), rebuilt: false },
      { ok: false, ticket: 'TASK-102', error: 'TASK-102 is blocked, not done' },
    ]);
  }, 240_000);

  const roleLine = (fx: Fx, role: string, mark: string) => { write(fx, `spec/roles/${role}.md`, `${read(fx, `spec/roles/${role}.md`).trimEnd()}\n\n${mark}\n`); };
  const rolesDiverge = (fx: Fx) => {
    finish(fx, 'TASK-107', () => { roleLine(fx, 'reviewer', 'REVIEWER-MARK'); });
    onMain(fx, () => { roleLine(fx, 'tester', 'TESTER-MARK'); });
  };

  it('role prompt changes merge without writing compiled agents', async () => {
    const fx = project({ tickets: [['TASK-107', 'Reword two roles']] });
    rolesDiverge(fx);
    const out = await fx.spec('', 'merge', 'TASK-107');
    expect(out.stdout).toBe(`TASK-107: merged (${short(fx)})\n`);
    expect(clean(fx)).toBe('');
    expect(fx.git('ls-tree', '-r', '--name-only', 'HEAD').stdout).not.toContain('.claude/agents/');
    const json = project({ tickets: [['TASK-107', 'Reword two roles']] });
    rolesDiverge(json);
    const result = (await mergeJson(json, 'TASK-107'))[0];
    expect(result).toMatchObject({ ok: true, rebuilt: false });
    expect(result).not.toHaveProperty('agentsCompiled');
  }, 240_000);

  const SOURCE = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\n';
  const BUNDLE = '.claude/skills/chat-spec/scripts/spec.cjs';
  /** A skill folder with a bundled CLI that the project's build (npm run build) writes from src/bundle-source.txt. */
  const withBundle = (dir: string) => {
    const pkg = join(dir, 'package.json');
    const cfg = JSON.parse(readFileSync(pkg, 'utf8')) as { scripts: Record<string, string> };
    cfg.scripts.build = 'node build-bundle.js';
    writeFileSync(pkg, `${JSON.stringify(cfg, null, 2)}\n`);
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    writeFileSync(
      join(dir, 'build-bundle.js'),
      `import { readFileSync, writeFileSync } from 'node:fs';\nconst src = readFileSync('src/bundle-source.txt', 'utf8');\nif (src.includes('BREAK')) {\n  console.error('src/app.ts:3 type error');\n  console.error('build failed');\n  process.exit(1);\n}\nwriteFileSync('${BUNDLE}', '// bundle of: ' + src);\n`,
    );
    writeFileSync(join(dir, 'src/bundle-source.txt'), SOURCE);
    mkdirSync(join(dir, '.claude/skills/chat-spec/scripts'), { recursive: true });
    writeFileSync(join(dir, '.claude/skills/chat-spec/scripts/spec'), '#!/bin/sh\nexec node "$(dirname "$0")/spec.cjs" "$@"\n');
    writeFileSync(join(dir, BUNDLE), `// bundle of: ${SOURCE}`);
  };
  const sourceDiverges = (fx: Fx, id: string) => {
    finish(fx, id, () => { replaceIn(fx, 'src/bundle-source.txt', 'one', 'ONE'); });
    onMain(fx, () => { replaceIn(fx, 'src/bundle-source.txt', 'seven', 'SEVEN'); });
  };
  const MERGED = '// bundle of: ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN\n';

  it('WSP-006/S24 The bundled CLI is the afterMerge command\'s to rebuild', async () => {
    // Merge itself never runs the project's build: the bundle stays as the merge left it.
    const fx = project({ setup: withBundle, tickets: [['TASK-108', 'Change the source']] });
    sourceDiverges(fx, 'TASK-108');
    const out = await fx.spec('', 'merge', 'TASK-108');
    expect(out.stdout).toBe(`TASK-108: merged (${short(fx)})\n`);
    expect(read(fx, BUNDLE)).toBe(`// bundle of: ${SOURCE}`);
    expect(clean(fx)).toBe('');
    // With afterMerge running the build, the merged source's bundle is placed and committed.
    const after = project({ setup: withBundle, tickets: [['TASK-108', 'Change the source']], afterMerge: 'npm run build --silent' });
    sourceDiverges(after, 'TASK-108');
    const built = await after.spec('', 'merge', 'TASK-108');
    expect(built.stdout).toBe(`TASK-108: merged (${short(after)})\n`);
    expect(read(after, BUNDLE)).toBe(MERGED);
    expect(after.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-108: after merge');
    expect(after.git('show', `HEAD:${BUNDLE}`).stdout).toBe(MERGED);
    expect(clean(after)).toBe('');
  }, 240_000);

  const bothChangeGenerated = (fx: Fx) => {
    finish(fx, 'TASK-109', () => {
      write(fx, '.claude/agents/reviewer.md', 'branch line\n');
      write(fx, BUNDLE, '// bundle of: branch\n');
    });
    onMain(fx, () => {
      write(fx, '.claude/agents/reviewer.md', 'main line\n');
      write(fx, BUNDLE, '// bundle of: main\n');
    });
  };

  it('WSP-006/S34 A legacy agent file is no longer treated as generated', async () => {
    const fx = project({ setup: withBundle, tickets: [['TASK-109', 'Refresh the generated files']] });
    bothChangeGenerated(fx);
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-109');
    expect(out.stdout).toBe('TASK-109: not merged, merging ticket/TASK-109 conflicts in .claude/agents/reviewer.md; a person must merge it\n');
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
    const json = project({ setup: withBundle, tickets: [['TASK-109', 'Refresh the generated files']] });
    bothChangeGenerated(json);
    const result = (await mergeJson(json, 'TASK-109'))[0];
    expect(result?.ok).toBe(false);
    expect(String(result?.error)).toContain('.claude/agents/reviewer.md');
  }, 240_000);

  it('WSP-006/S16 A flaky test still refuses the merge', async () => {
    const fx = project({ tests: 'flaky', tickets: [['TASK-111', 'Copy things']] });
    finish(fx, 'TASK-111');
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-111');
    expect(out.stdout).toBe(`TASK-111: not merged, after merging ticket/TASK-111 tests fail (${TITLE} (flaky: failed, then passed on the rerun)); ticket/TASK-111 stays unmerged\n`);
    expect(head(fx)).toBe(before);
    expect(clean(fx)).toBe('');
  }, 120_000);

  it('WSP-006/S17 A test that fails again is not flaky', async () => {
    const fx = project({ tests: 'fail', tickets: [['TASK-111', 'Copy things']] });
    finish(fx, 'TASK-111');
    const out = await fx.spec('', 'merge', 'TASK-111');
    expect(out.stdout).toBe(`TASK-111: not merged, after merging ticket/TASK-111 tests fail (${TITLE}); ticket/TASK-111 stays unmerged\n`);
  }, 120_000);

  const runs = (log: string) => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

  it('WSP-006/S18 afterMerge runs after a merge and its changes are committed', async () => {
    const after = afterMergeScript(['mkdir -p tools', 'echo built > tools/spec.cjs']);
    const fx = project({ afterMerge: after.command, tickets: [['TASK-112', 'Ship the CLI']] });
    finish(fx, 'TASK-112');
    const out = await fx.spec('', 'merge', 'TASK-112');
    expect(runs(after.log)).toEqual([`${realpathSync(fx.repo)} main`]);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-112: after merge');
    expect(fx.git('log', '-1', '--format=%B').stdout).toContain('Spec-Ticket: TASK-112');
    expect(fx.git('log', '-2', '--format=%s').stdout.split('\n')[1]).toBe('Merge ticket/TASK-112: Ship the CLI');
    expect(fx.git('show', 'HEAD:tools/spec.cjs').stdout).toBe('built\n');
    expect(out.stdout).toBe(`TASK-112: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
  }, 120_000);

  it('WSP-006/S19 afterMerge that changes nothing makes no commit', async () => {
    const after = afterMergeScript([]);
    const fx = project({ afterMerge: after.command, tickets: [['TASK-112', 'Ship the CLI']] });
    finish(fx, 'TASK-112');
    const out = await fx.spec('', 'merge', 'TASK-112');
    expect(runs(after.log)).toHaveLength(1);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('Merge ticket/TASK-112: Ship the CLI');
    expect(out.stdout).toBe(`TASK-112: merged (${short(fx)})\n`);
  }, 120_000);

  it('WSP-006/S20 A failing afterMerge leaves the merge in place', async () => {
    const after = afterMergeScript(['echo build a', 'echo build b', 'echo build c', 'echo build d', 'exit 1']);
    const fx = project({ afterMerge: after.command, tickets: [['TASK-112', 'Ship the CLI'], ['TASK-113', 'Ship more']] });
    finish(fx, 'TASK-112');
    finish(fx, 'TASK-113');
    const out = await fx.spec('', 'merge', 'TASK-112', 'TASK-113', '--format', 'json');
    const list = JSON.parse(out.stdout) as Record<string, unknown>[];
    expect(fx.git('merge-base', '--is-ancestor', 'ticket/TASK-112', 'main').code).toBe(0);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ ok: true, ticket: 'TASK-112', rebuilt: false, afterMergeError: 'afterMerge failed: build b | build c | build d' });
    expect(list[0]?.commit).toEqual(expect.any(String));
    expect(list[1]).toMatchObject({ ok: true, ticket: 'TASK-113' });
    expect(out.code).toBe(1);
  }, 240_000);

  it('WSP-006/S21 The text form of a failing afterMerge', async () => {
    const after = afterMergeScript(['echo build failed', 'exit 1']);
    const fx = project({ afterMerge: after.command, tickets: [['TASK-112', 'Ship the CLI']] });
    finish(fx, 'TASK-112');
    const out = await fx.spec('', 'merge', 'TASK-112');
    expect(out.stdout).toBe(`TASK-112: merged (${short(fx)}), but afterMerge failed: build failed\n`);
    expect(out.code).toBe(1);
  }, 120_000);

  it('WSP-006/S22 Without afterMerge nothing runs', async () => {
    const fx = project({ tickets: [['TASK-112', 'Ship the CLI']] });
    finish(fx, 'TASK-112');
    const out = await fx.spec('', 'merge', 'TASK-112');
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('Merge ticket/TASK-112: Ship the CLI');
    expect(out.stdout).toBe(`TASK-112: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
  }, 120_000);

  it('WSP-006/S23 afterMerge does not run for a refused merge', async () => {
    const after = afterMergeScript(['echo ran']);
    const fx = project({ tests: 'fail', afterMerge: after.command, tickets: [['TASK-105', 'Break the export']] });
    finish(fx, 'TASK-105', () => { replaceIn(fx, EXPORT, "join('\\n\\n')", "join('\\n')"); });
    const out = await fx.spec('', 'merge', 'TASK-105');
    expect(out.stdout).toContain('TASK-105: not merged, after merging ticket/TASK-105 tests fail');
    expect(runs(after.log)).toEqual([]);
  }, 120_000);

  /** A test command that takes a second, then fails while `fail.mark` is in the tree; `extra` runs first. */
  function markedTests(extra = ''): string {
    const dir = join(scratch, String(++counter));
    mkdirSync(dir);
    const script = join(dir, 'tests.sh');
    writeFileSync(script, [extra, 'sleep 1', 'if [ -f fail.mark ]; then s=failed; c=1; else s=passed; c=0; fi', `printf '{"testResults":[{"assertionResults":[{"title":"%s","status":"%s"}]}]}' '${TITLE}' "$s" > "$1"`, 'exit $c', ''].join('\n'));
    return `sh '${script}' "{report}"`;
  }
  const mergeIn = (fx: Fx, id: string) =>
    new Promise<{ code: number; stdout: string }>((done) => {
      const child = trackChild(spawn(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), join(REPO, 'src/cli/main.ts'), 'merge', id, '--root', join(fx.repo, 'spec')], { cwd: fx.repo, stdio: ['ignore', 'pipe', 'pipe'] }));
      let stdout = '';
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
      child.on('close', (code) => {
        done({ code: code ?? 1, stdout });
      });
    });

  it('WSP-006/S25 Two merges at once: a refused one never undoes the other', async () => {
    const fx = project({ tickets: [['TASK-201', 'Merge first'], ['TASK-202', 'Fail after the other']], setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = markedTests();
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    } });
    finish(fx, 'TASK-201');
    finish(fx, 'TASK-202', () => { write(fx, 'fail.mark', 'x\n'); });
    const [a, b] = await Promise.all([mergeIn(fx, 'TASK-201'), mergeIn(fx, 'TASK-202')]);
    expect(a.stdout).toMatch(/^TASK-201: merged \(/);
    expect(b.stdout).toContain('TASK-202: not merged, after merging ticket/TASK-202 tests fail');
    // Whichever ran first, the successful merge is on main and the refused one left nothing.
    const log = fx.git('log', '--first-parent', '--format=%s', 'main').stdout.split('\n');
    expect(log).toContain('Merge ticket/TASK-201: Merge first');
    expect(log).not.toContain('Merge ticket/TASK-202: Fail after the other');
    expect(existsSync(join(fx.repo, 'fail.mark'))).toBe(false);
    expect(clean(fx)).toBe('');
  }, 240_000);

  it('WSP-006/S26 A refused merge leaves a base branch that moved on', async () => {
    // Something outside spec commits on main while the merged result is tested.
    const fx = project({ tickets: [['TASK-203', 'Fail while main moves']], setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = markedTests("git commit -q --allow-empty -m 'someone else'");
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    } });
    finish(fx, 'TASK-203', () => { write(fx, 'fail.mark', 'x\n'); });
    const out = await fx.spec('', 'merge', 'TASK-203');
    const moved = fx.git('rev-parse', 'HEAD').stdout.trim();
    expect(out.stdout).toContain('TASK-203: not merged, after merging ticket/TASK-203 tests fail');
    expect(out.stdout).toContain(`; main moved to ${moved.slice(0, 7)} during the merge, so spec left it as it is: undo the merge of ticket/TASK-203 by hand\n`);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('someone else');
    expect(out.code).toBe(1);
  }, 240_000);

  /** A project whose test command first runs `extra` in the main checkout, then fails while fail.mark is there. */
  const editingTests = (id: string, title: string, extra: string) =>
    project({ tickets: [[id, title]], setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = markedTests(extra);
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    } });

  it('WSP-006/S27 A refused merge keeps what was changed in the checkout meanwhile', async () => {
    // Someone edits a file the merge does not touch while the merged result is tested.
    const fx = editingTests('TASK-204', 'Fail while a file is edited', "echo '// edited while the tests ran' >> src/state.ts");
    finish(fx, 'TASK-204', () => { write(fx, 'fail.mark', 'x\n'); });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-204');
    expect(out.stdout).toBe('TASK-204: not merged, after merging ticket/TASK-204 tests fail (CNV-003/S1 Copy a message); ticket/TASK-204 stays unmerged\n');
    expect(head(fx)).toBe(before);
    expect(read(fx, 'src/state.ts')).toContain('// edited while the tests ran');
    expect(clean(fx)).toBe(' M src/state.ts\n');
  }, 240_000);

  it('WSP-006/S33 A conflict in the pinned CLI is generated', async () => {
    const fx = project();
    const bundle = '.spec/bin/spec.cjs';
    fx.git('add', '-f', bundle);
    fx.git('commit', '-q', '-m', 'pin the CLI');
    finish(fx, 'TASK-103', () => { write(fx, bundle, 'ticket bundle\n'); });
    onMain(fx, () => { write(fx, bundle, 'main bundle\n'); });
    const out = await fx.spec('', 'merge', 'TASK-103');
    expect(out.code, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toContain('TASK-103: merged (');
    expect(out.stdout).toContain('generated files rebuilt');
    expect(read(fx, bundle)).toBe('ticket bundle\n');
    expect(clean(fx)).toBe('');
  }, 120_000);

  it('WSP-006/S28 A refused merge that would overwrite a change leaves the base branch for a person', async () => {
    // The edit lands in a file the merge changed, so moving main back would overwrite it.
    const fx = editingTests('TASK-205', 'Fail while the export is edited', `echo '// edited while the tests ran' >> ${EXPORT}`);
    finish(fx, 'TASK-205', () => {
      write(fx, 'fail.mark', 'x\n');
      replaceIn(fx, EXPORT, "join('\\n\\n')", "join('\\n\\n\\n')");
    });
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-205');
    expect(out.stdout).toBe(`TASK-205: not merged, after merging ticket/TASK-205 tests fail (CNV-003/S1 Copy a message); spec could not move main back to ${before.slice(0, 7)} without overwriting uncommitted changes in ${EXPORT}, so it left main as it is: undo the merge of ticket/TASK-205 by hand\n`);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('Merge ticket/TASK-205: Fail while the export is edited');
    expect(read(fx, EXPORT)).toContain('// edited while the tests ran');
    expect(out.code).toBe(1);
  }, 240_000);

  // WSP-006/R8: the merge takes the ticket's lock (after merge.lock) to remove the merged ticket's worktree.
  const common = (fx: Fx) => join(realpathSync(fx.repo), '.git/spec');
  const ticketLock = (fx: Fx) => join(common(fx), 'worktree-TASK-101.lock');
  const mergeLock = (fx: Fx) => join(common(fx), 'merge.lock');
  const failedMark = (fx: Fx) => join(common(fx), 'setup/TASK-101.failed');
  const BUSY = (pid: number | undefined) => `another spec worktree add for TASK-101 is still running (pid ${String(pid)})`;
  /** Runs the CLI as its own process; resolves when it ends. */
  const proc = (fx: Fx, ...args: string[]) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
      const child = trackChild(spawn(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), join(REPO, 'src/cli/main.ts'), ...args, '--root', join(fx.repo, 'spec')], { cwd: fx.repo, stdio: ['ignore', 'pipe', 'pipe'] }));
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
      child.on('close', (code) => {
        done({ code, stdout, stderr });
      });
    });
  const until = async (ok: () => boolean, ms: number): Promise<boolean> => {
    const end = Date.now() + ms;
    while (!ok()) {
      if (Date.now() > end) return false;
      await new Promise((r) => setTimeout(r, 25));
    }
    return true;
  };
  const recordFile = (fx: Fx) => join(common(fx), 'setup/TASK-101.txt');
  const text = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf8') : null);
  const MIN = 60_000;
  const WAIT = 15 * MIN;
  /**
   * The clock the lock waits read (nothing else in the merge reads Date.now). The first reading is the
   * merge-lock wait, which gets its lock at once; the second starts the ticket-lock wait, whose elapsed
   * time is then 0. It moves a minute per reading until the 14th minute, then a second, so the real
   * wait loop reaches its limit in seconds and `watch` sees every reading before the 15 minutes are over.
   */
  const waitClock = (watch: (elapsed: number) => void) => {
    let readings = 0;
    let now = Date.now();
    let start = now;
    let elapsed = 0;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
      readings++;
      if (readings === 2) start = now;
      else if (readings > 2) now += elapsed < WAIT - MIN ? MIN : 1_000;
      elapsed = readings < 2 ? 0 : now - start;
      if (readings >= 2) watch(elapsed);
      return now;
    });
    return { readings: () => readings, elapsed: () => elapsed, stop: () => { spy.mockRestore(); } };
  };
  /** A live process holds the ticket's lock; `fx` has its worktree, and a seeded failed marker and setup record. */
  const holdTicketLock = (fx: Fx) => {
    const holder = trackChild(spawn('sleep', ['600'], { stdio: 'ignore' }));
    mkdirSync(join(common(fx), 'setup'), { recursive: true });
    writeFileSync(ticketLock(fx), `${String(holder.pid)} held\n`);
    writeFileSync(failedMark(fx), 'earlier-token\n');
    writeFileSync(recordFile(fx), 'vendor-modules\n');
    return holder;
  };
  /** Merges TASK-101 (which has a worktree) while another process holds its lock; checks nothing changes during the 15 minutes. */
  const mergeWhileHeld = async (extra: Opts, ...args: string[]) => {
    const { fx, tree } = await withWorktree(undefined, extra);
    const holder = holdTicketLock(fx);
    const state = () => ({ lock: text(ticketLock(fx)), failed: text(failedMark(fx)), record: text(recordFile(fx)), tree: existsSync(tree) });
    const before = state();
    const treeHead = git(tree, ['rev-parse', 'HEAD']).stdout;
    const treeStatus = git(tree, ['status', '--porcelain']).stdout;
    const early: string[] = [];
    const clock = waitClock((elapsed) => {
      if (elapsed < WAIT && JSON.stringify(state()) !== JSON.stringify(before)) early.push(`state changed at ${String(elapsed)} ms: ${JSON.stringify(state())}`);
    });
    try {
      const out = await fx.spec('', 'merge', 'TASK-101', ...args);
      return { fx, tree, out, pid: holder.pid, early, last: clock.elapsed(), before, after: state(), same: git(tree, ['rev-parse', 'HEAD']).stdout === treeHead && git(tree, ['status', '--porcelain']).stdout === treeStatus };
    } finally {
      clock.stop();
      holder.kill();
    }
  };
  /** What the merge must not touch while another process holds the ticket's lock and 15 minutes pass. */
  const expectLeftAlone = (r: Awaited<ReturnType<typeof mergeWhileHeld>>) => {
    expect(r.early).toEqual([]);
    // It waited the whole 15 minutes (not 1 minute, not an hour) and then went on.
    expect(r.last).toBeGreaterThanOrEqual(WAIT);
    expect(r.last).toBeLessThanOrEqual(WAIT + 10_000);
    expect(r.before).toEqual({ lock: `${String(r.pid)} held\n`, failed: 'earlier-token\n', record: 'vendor-modules\n', tree: true });
    expect(r.after).toEqual(r.before);
    expect(existsSync(mergeLock(r.fx))).toBe(false);
    expect(r.same).toBe(true);
    expect(existsSync(r.tree)).toBe(true);
    expect(r.fx.git('merge-base', '--is-ancestor', 'ticket/TASK-101', 'main').code).toBe(0);
  };
  /** An afterMerge that logs, when it runs, who holds merge.lock and the ticket's lock and which process started it. */
  const lockProbe = (fail = false) => {
    const dir = join(scratch, String(++counter));
    mkdirSync(dir);
    const probe = join(dir, 'locks');
    const script = join(dir, 'probe.sh');
    writeFileSync(script, [
      'c="$(git rev-parse --git-common-dir)/spec"',
      'm=absent; if [ -e "$c/merge.lock" ]; then m=$(cut -d" " -f1 "$c/merge.lock"); fi',
      't=absent; if [ -e "$c/worktree-TASK-101.lock" ]; then t=$(cut -d" " -f1 "$c/worktree-TASK-101.lock"); fi',
      `echo "$m $t $PPID" >> '${probe}'`,
      ...(fail ? ['echo probe failed', 'exit 1'] : []),
      '',
    ].join('\n'));
    return { command: `exec sh '${script}'`, seen: () => text(probe)?.trim().split('\n') ?? [] };
  };

  it('WSP-006/S29 A merge waits for an add of the same ticket before it removes the worktree', async () => {
    const barrier = join(scratch, String(++counter));
    mkdirSync(barrier);
    const fx = project({ setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      // Setup always fails; while "hold" exists it first waits inside, until the test makes "release".
      cfg.worktreeSetup = [`if [ -e '${barrier}/hold' ]; then touch '${barrier}/in'; while [ ! -e '${barrier}/release' ]; do sleep 0.05; done; fi`, 'echo "npm ERR! setup"', 'exit 1'].join('\n');
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    } });
    const tree = `${realpathSync(fx.repo)}.worktrees/TASK-101`;
    // The earlier add whose setup failed: the worktree exists and is marked; the ticket is done there.
    expect((await proc(fx, 'worktree', 'add', 'TASK-101')).code).toBe(1);
    expect(existsSync(failedMark(fx))).toBe(true);
    const file = join(tree, 'tickets/TASK-101.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: done'));
    git(tree, ['add', '-A']);
    git(tree, ['commit', '-q', '-m', 'TASK-101: done']);

    writeFileSync(join(barrier, 'hold'), '');
    const add = proc(fx, 'worktree', 'add', 'TASK-101');
    expect(await until(() => existsSync(join(barrier, 'in')), 60_000)).toBe(true);
    expect(existsSync(ticketLock(fx))).toBe(true);

    let ended = false;
    const merge = proc(fx, 'merge', 'TASK-101').then((x) => {
      ended = true;
      return x;
    });
    // Observable, not timed: the merge holds merge.lock and then ends, or (when it is held back) the bound passes.
    expect(await until(() => existsSync(mergeLock(fx)), 60_000)).toBe(true);
    await until(() => ended, 8_000);
    expect(ended).toBe(false);
    expect(existsSync(tree)).toBe(true);
    expect(existsSync(failedMark(fx))).toBe(true);
    expect(existsSync(mergeLock(fx))).toBe(true);
    writeFileSync(join(barrier, 'release'), '');

    const a = await add;
    const m = await merge;
    expect(a.code).toBe(1);
    expect(a.stderr).toMatch(/^worktreeSetup failed in /);
    expect(m.code, m.stderr).toBe(0);
    expect(m.stdout).toBe(`TASK-101: merged (${short(fx)})\n`);
    expect(existsSync(tree)).toBe(false);
    expect(existsSync(failedMark(fx))).toBe(false);
    expect(existsSync(ticketLock(fx))).toBe(false);
    expect(existsSync(mergeLock(fx))).toBe(false);
  }, 240_000);

  it("WSP-006/S30 An add that holds the ticket's lock too long", async () => {
    const r = await mergeWhileHeld({});
    expect(r.fx.git('log', '--first-parent', '--format=%s', '-1').stdout.trim()).toBe('Merge ticket/TASK-101: Extract provider selection into its own module');
    expect(r.out.stdout).toBe(`TASK-101: merged (${short(r.fx)}), but its worktree was not removed: ${BUSY(r.pid)}\n`);
    expect(r.out.code).toBe(0);
    expectLeftAlone(r);
  }, 120_000);

  it('WSP-006/S31 The JSON form of a worktree left behind a busy lock', async () => {
    const r = await mergeWhileHeld({}, '--format', 'json');
    expect(JSON.parse(r.out.stdout)).toEqual([{ ok: true, ticket: 'TASK-101', commit: short(r.fx), rebuilt: false, worktreeBusy: BUSY(r.pid) }]);
    expect(r.out.code).toBe(0);
    expectLeftAlone(r);
  }, 120_000);

  it("WSP-006/S30 afterMerge runs once under merge.lock when the ticket's lock stayed busy, and leaves that lock alone", async () => {
    const probe = lockProbe();
    const r = await mergeWhileHeld({ afterMerge: probe.command });
    expect(r.out.stdout).toBe(`TASK-101: merged (${short(r.fx)}), but its worktree was not removed: ${BUSY(r.pid)}\n`);
    expect(r.out.code).toBe(0);
    // This merge held merge.lock (it is the process that started afterMerge); the ticket's lock is still the other process's.
    expect(probe.seen()).toEqual([`${String(process.pid)} ${String(r.pid)} ${String(process.pid)}`]);
    expectLeftAlone(r);
  }, 120_000);

  it("WSP-006/S30 A failing afterMerge after a busy ticket lock reports both and leaves that lock alone", async () => {
    const probe = lockProbe(true);
    const r = await mergeWhileHeld({ afterMerge: probe.command });
    expect(r.out.stdout).toBe(`TASK-101: merged (${short(r.fx)}), but its worktree was not removed: ${BUSY(r.pid)}, but afterMerge failed: probe failed\n`);
    expect(r.out.code).toBe(1);
    expect(probe.seen()).toEqual([`${String(process.pid)} ${String(r.pid)} ${String(process.pid)}`]);
    expectLeftAlone(r);
  }, 120_000);

  it("WSP-006/S8 afterMerge runs with merge.lock held and this merge's ticket lock already released", async () => {
    const probe = lockProbe();
    const { fx, tree } = await withWorktree(undefined, { afterMerge: probe.command });
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)})\n`);
    expect(out.code).toBe(0);
    expect(existsSync(tree)).toBe(false);
    expect(probe.seen()).toEqual([`${String(process.pid)} absent ${String(process.pid)}`]);
    expect(existsSync(ticketLock(fx))).toBe(false);
    expect(existsSync(mergeLock(fx))).toBe(false);
  }, 120_000);

  it('WSP-006/S8 A failing afterMerge still runs under merge.lock, and both locks are released', async () => {
    const probe = lockProbe(true);
    const { fx, tree } = await withWorktree(undefined, { afterMerge: probe.command });
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}), but afterMerge failed: probe failed\n`);
    expect(out.code).toBe(1);
    expect(existsSync(tree)).toBe(false);
    expect(probe.seen()).toEqual([`${String(process.pid)} absent ${String(process.pid)}`]);
    expect(existsSync(ticketLock(fx))).toBe(false);
    expect(existsSync(mergeLock(fx))).toBe(false);
  }, 120_000);

  it("WSP-006/S2 A refused merge undoes without waiting on or changing another process's ticket lock", async () => {
    const { fx, tree } = await withWorktree(undefined, { tests: 'fail' });
    const holder = holdTicketLock(fx);
    const before = fx.git('rev-parse', 'HEAD').stdout;
    const treeHead = git(tree, ['rev-parse', 'HEAD']).stdout;
    const clock = waitClock(() => undefined);
    try {
      const out = await fx.spec('', 'merge', 'TASK-101');
      expect(out.stdout.startsWith('TASK-101: not merged, after merging ticket/TASK-101 tests fail (CNV-003/S1')).toBe(true);
      expect(out.code).toBe(1);
      // The merge-lock wait is the only reading of the clock: nothing waited for the ticket's lock.
      expect(clock.readings()).toBe(1);
    } finally {
      clock.stop();
      holder.kill();
    }
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(before);
    expect(clean(fx)).toBe('');
    expect(readFileSync(ticketLock(fx), 'utf8')).toBe(`${String(holder.pid)} held\n`);
    expect(readFileSync(failedMark(fx), 'utf8')).toBe('earlier-token\n');
    expect(readFileSync(recordFile(fx), 'utf8')).toBe('vendor-modules\n');
    expect(existsSync(tree)).toBe(true);
    expect(git(tree, ['rev-parse', 'HEAD']).stdout).toBe(treeHead);
    expect(existsSync(mergeLock(fx))).toBe(false);
  }, 120_000);

  it('WSP-006/S9 A dirty worktree whose setup failed keeps its edits and setup state', async () => {
    const fx = project({ setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.worktreeSetup = 'echo "npm ERR! setup"; exit 1';
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
    } });
    const tree = `${realpathSync(fx.repo)}.worktrees/TASK-101`;
    expect((await fx.spec('', 'worktree', 'add', 'TASK-101')).code).toBe(1);
    const file = join(tree, 'tickets/TASK-101.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: done'));
    git(tree, ['add', '-A']);
    git(tree, ['commit', '-q', '-m', 'TASK-101: done']);
    writeFileSync(join(tree, 'src/state.ts'), `${readFileSync(join(tree, 'src/state.ts'), 'utf8')}// my edit\n`);
    writeFileSync(join(tree, 'notes.txt'), 'mine\n');
    // A setup record an earlier setup left (a failed setup writes none of its own).
    writeFileSync(recordFile(fx), 'vendor-modules\n');
    const failed = text(failedMark(fx));
    expect(failed).not.toBeNull();
    const status = git(tree, ['status', '--porcelain']).stdout;
    const edited = readFileSync(join(tree, 'src/state.ts'), 'utf8');

    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}), but its worktree was kept: ${tree} has uncommitted changes: notes.txt, src/state.ts\n`);
    expect(out.code).toBe(0);
    expect(fx.git('merge-base', '--is-ancestor', 'ticket/TASK-101', 'main').code).toBe(0);
    expect(existsSync(tree)).toBe(true);
    expect(readFileSync(join(tree, 'src/state.ts'), 'utf8')).toBe(edited);
    expect(readFileSync(join(tree, 'notes.txt'), 'utf8')).toBe('mine\n');
    expect(git(tree, ['status', '--porcelain']).stdout).toBe(status);
    expect(text(failedMark(fx))).toBe(failed);
    expect(text(recordFile(fx))).toBe('vendor-modules\n');
    expect(existsSync(ticketLock(fx))).toBe(false);
    expect(existsSync(mergeLock(fx))).toBe(false);
  }, 120_000);

  it('WSP-006/S32 A ticket lock left by a process that has ended', async () => {
    const { fx, tree } = await withWorktree();
    const gone = spawn('true', [], { stdio: 'ignore' });
    await new Promise((done) => gone.on('close', done));
    mkdirSync(common(fx), { recursive: true });
    writeFileSync(ticketLock(fx), `${String(gone.pid)} left\n`);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)})\n`);
    expect(existsSync(tree)).toBe(false);
    expect(existsSync(ticketLock(fx))).toBe(false);
  }, 120_000);
});
