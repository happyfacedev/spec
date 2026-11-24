// WSP-009 (a project's own generated files are rebuilt when they conflict), plus the clauses it adds to
// WSP-006/S5 (merge) and PIP-002/S24 (the stage-start sync). Throwaway git copies of chat-mini: the
// project's "generated" command is a script outside the repo that writes src/generated/assets.ts from
// templates/*.md and logs each run, so a scenario can say how often and when it ran.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { partitionedDescribe } from './partitioned-it';
const describe = partitionedDescribe(3);
import { git } from '../../src/io/git';
import { parseTicket } from '../../src/core/parse/tickets';
import { gitFixture, report, tempDir } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
const scratch = realpathSync(tempDir('spec-generated-'));
afterAll(() => {
  for (const fx of made) {
    git(fx.repo, ['worktree', 'prune']);
    rmSync(`${realpathSync(fx.repo)}.worktrees`, { recursive: true, force: true });
    fx.cleanup();
  }
  rmSync(scratch, { recursive: true, force: true });
});

const ASSETS = 'src/generated/assets.ts';
const TEMPLATE = 'templates/reviewer.md';
const GLOBS = ['src/generated/**'];
const TEMPLATE_TEXT = 'top line\n\nmiddle one\nmiddle two\nmiddle three\n\nbottom line\n';
const BASE_ASSETS = "export const assets = 'base';\n";
let counter = 0;

/** What the project's build writes: the templates, wrapped. */
const built = (template: string) => `export const assets = \`${template}\`;\n`;

interface Gen {
  /** The generated command, run in the project root. */
  command: string;
  /** One line per run. */
  runs: () => number;
}
/** A command that logs a run and rewrites assets.ts from the templates; `failWith` prints lines, then exits 1. */
function generator(failWith?: string[]): Gen {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  const log = join(dir, 'log');
  const script = join(dir, 'build.sh');
  writeFileSync(
    script,
    [
      `echo run >> '${log}'`,
      ...(failWith ? [...failWith.map((l) => `echo '${l}'`), 'exit 1'] : []),
      'mkdir -p src/generated',
      `{ printf 'export const assets = \`'; cat ${TEMPLATE}; printf '\`;\\n'; } > ${ASSETS}`,
      '',
    ].join('\n'),
  );
  return { command: `sh '${script}'`, runs: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0) };
}

const OTHER = 'src/generated/other.ts';
const NEW_FILE = 'src/generated/created.ts';
const BASE_OTHER = "export const other = 'base';\n";
/** What the extras generator writes to OTHER and NEW_FILE. */
const otherBuilt = (template: string) => `export const other = ${JSON.stringify(template.length)};\n`;
const createdBuilt = "export const created = true;\n";
/** As generator, but it also rewrites a second matching file and creates a new one; `fail` makes it exit 1 after all writes. */
function generatorExtras(fail: boolean): Gen {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  const log = join(dir, 'log');
  const script = join(dir, 'build.sh');
  writeFileSync(
    script,
    [
      `echo run >> '${log}'`,
      `{ printf 'export const assets = \`'; cat ${TEMPLATE}; printf '\`;\\n'; } > ${ASSETS}`,
      `printf 'export const other = %s;\\n' "$(wc -c < ${TEMPLATE} | tr -d ' ')" > ${OTHER}`,
      `printf 'export const created = true;\\n' > ${NEW_FILE}`,
      ...(fail ? ["echo 'half built'", 'exit 1'] : []),
      '',
    ].join('\n'),
  );
  return { command: `sh '${script}'`, runs: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0) };
}

/** A test command that passes, and snapshots assets.ts as it was when the tests ran. */
function tests(): { command: string; ran: () => boolean; snapshot: () => string } {
  const dir = join(scratch, String(++counter));
  mkdirSync(dir);
  const snap = join(dir, 'assets.snapshot');
  const script = join(dir, 'tests.sh');
  writeFileSync(
    script,
    [
      `cp ${ASSETS} '${snap}' 2>/dev/null || echo missing > '${snap}'`,
      `printf '{"testResults":[{"assertionResults":[{"title":"CNV-003/S1 Copy a message","status":"passed"}]}]}' > "$1"`,
      '',
    ].join('\n'),
  );
  return { command: `sh '${script}' "{report}"`, ran: () => existsSync(snap), snapshot: () => readFileSync(snap, 'utf8') };
}

function project(prefix: string, opts: { generated?: Gen; tests?: ReturnType<typeof tests>; config?: (cfg: Record<string, unknown>) => void } = {}): Fx {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = (opts.tests ?? tests()).command;
      if (opts.generated) cfg.generated = { globs: GLOBS, command: opts.generated.command };
      opts.config?.(cfg);
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      mkdirSync(join(dir, 'templates'), { recursive: true });
      mkdirSync(join(dir, 'src/generated'), { recursive: true });
      writeFileSync(join(dir, TEMPLATE), TEMPLATE_TEXT);
      writeFileSync(join(dir, ASSETS), BASE_ASSETS);
      writeFileSync(join(dir, OTHER), BASE_OTHER);
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
const commitAll = (fx: Fx, message: string) => {
  fx.git('add', '-A');
  expect(fx.git('commit', '-q', '-m', message).code).toBe(0);
};
const head = (fx: Fx) => fx.git('rev-parse', 'HEAD').stdout.trim();
const short = (fx: Fx) => fx.git('rev-parse', '--short', 'HEAD').stdout.trim();
const noMerge = (fx: Fx) => !existsSync(join(fx.repo, '.git/MERGE_HEAD'));

/** Both sides edit a different end of the template and the generated file's one line, so only the generated file conflicts. */
const branchEdit = (fx: Fx) => {
  write(fx, TEMPLATE, TEMPLATE_TEXT.replace('top line', 'top line, branch'));
  write(fx, ASSETS, "export const assets = 'branch';\n");
};
const mainEdit = (fx: Fx) => {
  write(fx, TEMPLATE, TEMPLATE_TEXT.replace('bottom line', 'bottom line, main'));
  write(fx, ASSETS, "export const assets = 'main';\n");
};
const MERGED_TEMPLATE = TEMPLATE_TEXT.replace('top line', 'top line, branch').replace('bottom line', 'bottom line, main');

/** ticket/TASK-101 done on its branch with `onBranch`, then main with `onMain`; the tree is back on main. */
function finish(fx: Fx, onBranch: (fx: Fx) => void, onMain: (fx: Fx) => void) {
  fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
  write(fx, 'tickets/TASK-101.md', read(fx, 'tickets/TASK-101.md').replace(/^status: .*$/m, 'status: done'));
  onBranch(fx);
  commitAll(fx, 'TASK-101: done');
  fx.git('checkout', '-q', 'main');
  onMain(fx);
  commitAll(fx, 'main moves on');
}
/** As finish, but the ticket stays open: the branch is behind main, for the sync. */
function diverged(fx: Fx, onBranch: (fx: Fx) => void, onMain: (fx: Fx) => void) {
  fx.git('checkout', '-q', '-b', 'ticket/TASK-101');
  onBranch(fx);
  commitAll(fx, 'TASK-101: on the branch');
  fx.git('checkout', '-q', 'main');
  onMain(fx);
  commitAll(fx, 'main moves on');
}
const ticket = (fx: Fx) => parseTicket('tickets/TASK-101.md', read(fx, 'tickets/TASK-101.md')).ticket?.data;

describe('WSP-009: rebuild a project\'s generated files when they conflict', () => {
  it('WSP-009/S1 A merge rebuilds the project\'s generated files that conflict', async () => {
    const gen = generator();
    const t = tests();
    const fx = project('spec-wsp9-s1', { generated: gen, tests: t });
    finish(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(out.code).toBe(0);
    // The command ran once, before the tests; the tests saw, and the merge commit holds, the rebuilt file.
    expect(gen.runs()).toBe(1);
    expect(t.ran()).toBe(true);
    expect(t.snapshot()).toBe(built(MERGED_TEMPLATE));
    expect(read(fx, TEMPLATE)).toBe(MERGED_TEMPLATE);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
    expect(fx.git('status', '--porcelain').stdout).toBe('');

    // Without format.Config.generated the same conflict needs a person.
    const plain = project('spec-wsp9-s1-plain');
    finish(plain, branchEdit, mainEdit);
    const before = head(plain);
    const refused = await plain.spec('', 'merge', 'TASK-101');
    expect(refused.stdout).toBe(`TASK-101: not merged, merging ticket/TASK-101 conflicts in ${ASSETS}; a person must merge it\n`);
    expect(refused.code).toBe(1);
    expect(head(plain)).toBe(before);
    expect(noMerge(plain)).toBe(true);
  }, 120_000);

  it('WSP-009/R2 the command does not run when none of its files conflicted', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-r2', { generated: gen, tests: tests() });
    finish(fx, (f) => { write(f, TEMPLATE, TEMPLATE_TEXT.replace('top line', 'top line, branch')); }, (f) => { write(f, ASSETS, "export const assets = 'main';\n"); });
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)})\n`);
    expect(gen.runs()).toBe(0);
  }, 120_000);

  it('WSP-009/S2 A merge whose generated files do not rebuild', async () => {
    const gen = generator(['build a', 'build b', 'build c', 'build d']);
    const t = tests();
    const fx = project('spec-wsp9-s2', { generated: gen, tests: t });
    finish(fx, branchEdit, mainEdit);
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe('TASK-101: not merged, the generated files do not rebuild: build b | build c | build d\n');
    expect(out.code).toBe(1);
    expect(head(fx)).toBe(before);
    expect(noMerge(fx)).toBe(true);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
    expect(t.ran()).toBe(false);
  }, 120_000);

  it('WSP-009/S3 The sync at a stage\'s start rebuilds them too', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-s3', { generated: gen });
    diverged(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
    expect(read(fx, ASSETS)).toBe(built(MERGED_TEMPLATE));
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
  }, 60_000);

  it('WSP-009/S3 a generated command that fails aborts the sync and refuses the start', async () => {
    const gen = generator(['compiling', 'build failed']);
    const fx = project('spec-wsp9-s3-fail', { generated: gen });
    diverged(fx, branchEdit, mainEdit);
    fx.git('checkout', '-q', 'ticket/TASK-101');
    const tip = head(fx);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('syncing ticket/TASK-101 with main: the generated files do not rebuild: compiling | build failed\n');
    expect(head(fx)).toBe(tip);
    expect(noMerge(fx)).toBe(true);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
    expect(ticket(fx)).toMatchObject({ status: 'open', stage: null });
  }, 60_000);
});

describe('WSP-009 clauses in WSP-006/S5 and PIP-002/S24', () => {
  const bothChangeIndex = (f: Fx) => { write(f, 'spec/index.md', `${read(f, 'spec/index.md')}\nbranch line\n`); branchEdit(f); };
  const mainChangeIndex = (f: Fx) => { write(f, 'spec/index.md', `${read(f, 'spec/index.md')}\nmain line\n`); mainEdit(f); };

  it('WSP-006/S5 a conflict in a project generated file is rebuilt with the spec\'s own', async () => {
    const gen = generator();
    const fx = project('spec-wsp6-s5-gen', { generated: gen, tests: tests() });
    finish(fx, bothChangeIndex, mainChangeIndex);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(read(fx, 'spec/index.md')).not.toMatch(/^(branch|main) line$/m);
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
  }, 120_000);

  it('PIP-002/S24 a conflict in a project generated file is rebuilt in the sync too', async () => {
    const gen = generator();
    const fx = project('spec-pip2-s24-gen', { generated: gen });
    diverged(fx, bothChangeIndex, mainChangeIndex);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(read(fx, 'spec/index.md')).not.toMatch(/^(branch|main) line$/m);
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
  }, 60_000);
});

/** Rewrites the generated key of spec/config.json in the working tree. */
const setGenerated = (fx: Fx, generated: unknown) => {
  const cfg = JSON.parse(read(fx, 'spec/config.json')) as Record<string, unknown>;
  if (generated === undefined) delete cfg.generated;
  else cfg.generated = generated;
  write(fx, 'spec/config.json', `${JSON.stringify(cfg, null, 2)}\n`);
};
const unmerged = (fx: Fx) => fx.git('ls-files', '-u').stdout;

describe('WSP-009 regressions found in review', () => {
  it('WSP-009/S2 a command that fails after writing leaves no partial or new generated files in a merge', async () => {
    const gen = generatorExtras(true);
    const t = tests();
    const fx = project('spec-wsp9-s2-partial', { generated: gen, tests: t });
    finish(fx, branchEdit, mainEdit);
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe('TASK-101: not merged, the generated files do not rebuild: half built\n');
    expect(out.code).toBe(1);
    expect(gen.runs()).toBe(1);
    expect(head(fx)).toBe(before);
    expect(noMerge(fx)).toBe(true);
    expect(unmerged(fx)).toBe('');
    expect(fx.git('status', '--porcelain').stdout).toBe('');
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(read(fx, OTHER)).toBe(BASE_OTHER);
    expect(read(fx, ASSETS)).toBe("export const assets = 'main';\n");
    expect(read(fx, TEMPLATE)).toBe(TEMPLATE_TEXT.replace('bottom line', 'bottom line, main'));
    expect(t.ran()).toBe(false);
  }, 120_000);

  it('WSP-009/S3 a command that fails after writing leaves the branch and worktree as they were', async () => {
    const gen = generatorExtras(true);
    const fx = project('spec-wsp9-s3-partial', { generated: gen });
    diverged(fx, branchEdit, mainEdit);
    fx.git('checkout', '-q', 'ticket/TASK-101');
    const edited = read(fx, 'tickets/TASK-102.md').replace(/^title: .*$/m, 'title: Edited by a person');
    write(fx, 'tickets/TASK-102.md', edited);
    const tip = head(fx);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe('syncing ticket/TASK-101 with main: the generated files do not rebuild: half built\n');
    expect(gen.runs()).toBe(1);
    expect(head(fx)).toBe(tip);
    expect(noMerge(fx)).toBe(true);
    expect(unmerged(fx)).toBe('');
    // Only the person's own edit is uncommitted: no partial or new generated file.
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-102.md\n');
    expect(read(fx, 'tickets/TASK-102.md')).toBe(edited);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(read(fx, OTHER)).toBe(BASE_OTHER);
    expect(read(fx, ASSETS)).toBe("export const assets = 'branch';\n");
    expect(ticket(fx)).toMatchObject({ status: 'open', stage: null });
  }, 60_000);

  it('WSP-009/R2 a merge commit holds every file the command wrote that the globs match', async () => {
    const gen = generatorExtras(false);
    const fx = project('spec-wsp9-r2-extras-merge', { generated: gen, tests: tests() });
    finish(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
    expect(fx.git('show', `HEAD:${OTHER}`).stdout).toBe(otherBuilt(MERGED_TEMPLATE));
    expect(fx.git('show', `HEAD:${NEW_FILE}`).stdout).toBe(createdBuilt);
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 120_000);

  it('WSP-009/R2 a sync commit holds every file the command wrote that the globs match', async () => {
    const gen = generatorExtras(false);
    const fx = project('spec-wsp9-r2-extras-sync', { generated: gen });
    diverged(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
    expect(fx.git('show', `HEAD:${OTHER}`).stdout).toBe(otherBuilt(MERGED_TEMPLATE));
    expect(fx.git('show', `HEAD:${NEW_FILE}`).stdout).toBe(createdBuilt);
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
  }, 60_000);

  it('WSP-009/R1 a merge runs the command the incoming side configures', async () => {
    const oldGen = generator();
    const newGen = generator();
    const fx = project('spec-wsp9-r1-cmd-merge', { generated: oldGen, tests: tests() });
    finish(fx, (f) => { branchEdit(f); setGenerated(f, { globs: GLOBS, command: newGen.command }); }, mainEdit);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(newGen.runs()).toBe(1);
    expect(oldGen.runs()).toBe(0);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
  }, 120_000);

  it('WSP-009/R1 a sync runs the command the incoming side configures', async () => {
    const oldGen = generator();
    const newGen = generator();
    const fx = project('spec-wsp9-r1-cmd-sync', { generated: oldGen });
    diverged(fx, branchEdit, (f) => { mainEdit(f); setGenerated(f, { globs: GLOBS, command: newGen.command }); });
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(newGen.runs()).toBe(1);
    expect(oldGen.runs()).toBe(0);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
  }, 60_000);

  it('WSP-009/R1 a merge that removes generated no longer resolves the conflict', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-r1-removed-merge', { generated: gen, tests: tests() });
    finish(fx, (f) => { branchEdit(f); setGenerated(f, undefined); }, mainEdit);
    const before = head(fx);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: not merged, merging ticket/TASK-101 conflicts in ${ASSETS}; a person must merge it\n`);
    expect(out.code).toBe(1);
    expect(gen.runs()).toBe(0);
    expect(head(fx)).toBe(before);
    expect(noMerge(fx)).toBe(true);
  }, 120_000);

  it('WSP-009/R1 a sync with a base that removes generated no longer resolves the conflict', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-r1-removed-sync', { generated: gen });
    diverged(fx, branchEdit, (f) => { mainEdit(f); setGenerated(f, undefined); });
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code).toBe(1);
    expect(out.stderr).toBe(`syncing ticket/TASK-101 with main conflicts in ${ASSETS}; a person must merge. TASK-101 is blocked; ticket/TASK-101 is as it was.\n`);
    expect(gen.runs()).toBe(0);
    expect(noMerge(fx)).toBe(true);
  }, 60_000);
});

// PROP-071: one generated key. `generated.command` is optional, and `generatedGlobs` is read as more
// `generated.globs` without a command.
const PLUGIN = 'plugin/generated/app.js';
const PLUGIN_GLOBS = ['plugin/generated/**'];
const noCommand = (cfg: Record<string, unknown>) => { cfg.generated = { globs: GLOBS }; };
const legacyGlobs = (cfg: Record<string, unknown>) => { cfg.generatedGlobs = GLOBS; };
const bothKeys = (command: string) => (cfg: Record<string, unknown>) => { cfg.generated = { globs: GLOBS, command }; cfg.generatedGlobs = PLUGIN_GLOBS; };
const pluginBranch = (f: Fx) => { write(f, PLUGIN, 'branch plugin\n'); };
const pluginMain = (f: Fx) => { write(f, PLUGIN, 'main plugin\n'); };

describe('WSP-009: without a command a conflict takes one side', () => {
  /** A merge of the conflict in ASSETS only, under `config`. */
  async function mergeAssets(prefix: string, config: (cfg: Record<string, unknown>) => void) {
    const t = tests();
    const fx = project(prefix, { tests: t, config });
    finish(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'merge', 'TASK-101');
    return { fx, t, out };
  }

  it('WSP-009/S4 Without a command, a conflict takes one side and nothing is rebuilt', async () => {
    const { fx, t, out } = await mergeAssets('spec-wsp9-s4', noCommand);
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(out.code).toBe(0);
    // The merge commit holds the generated file of ticket/TASK-101, untouched by any rebuild.
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe("export const assets = 'branch';\n");
    expect(read(fx, ASSETS)).toBe("export const assets = 'branch';\n");
    expect(read(fx, TEMPLATE)).toBe(MERGED_TEMPLATE);
    expect(t.ran()).toBe(true);
    expect(t.snapshot()).toBe("export const assets = 'branch';\n");
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 120_000);

  it('WSP-009/S4 the same holds when config.json holds generatedGlobs and no generated', async () => {
    const { fx, out } = await mergeAssets('spec-wsp9-s4-legacy', legacyGlobs);
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(out.code).toBe(0);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe("export const assets = 'branch';\n");
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 120_000);

  it('FMT-002/S19 a conflict under the generatedGlobs path is handled as generated with globs only', async () => {
    const fx = project('spec-fmt2-s19-merge', { tests: tests(), config: (cfg) => { cfg.generatedGlobs = PLUGIN_GLOBS; } });
    finish(fx, pluginBranch, pluginMain);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(out.code).toBe(0);
    expect(fx.git('show', `HEAD:${PLUGIN}`).stdout).toBe('branch plugin\n');
  }, 120_000);

  it('WSP-009/S4 a conflict only under generatedGlobs does not run the generated command', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-s4-both', { tests: tests(), config: bothKeys(gen.command) });
    finish(fx, pluginBranch, pluginMain);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(out.code).toBe(0);
    expect(gen.runs()).toBe(0);
    expect(fx.git('show', `HEAD:${PLUGIN}`).stdout).toBe('branch plugin\n');
    expect(fx.git('status', '--porcelain').stdout).toBe('');
  }, 120_000);

  it('WSP-009/S4 the command runs once when a file the generated globs match conflicted too', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-r4-both', { tests: tests(), config: bothKeys(gen.command) });
    finish(fx, (f) => { branchEdit(f); pluginBranch(f); }, (f) => { mainEdit(f); pluginMain(f); });
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.stdout).toBe(`TASK-101: merged (${short(fx)}, generated files rebuilt)\n`);
    expect(gen.runs()).toBe(1);
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe(built(MERGED_TEMPLATE));
    expect(fx.git('show', `HEAD:${PLUGIN}`).stdout).toBe('branch plugin\n');
  }, 120_000);

  it('WSP-006/S5 an old generatedGlobs path takes the branch side alongside a generated command', async () => {
    const gen = generator();
    const fx = project('spec-wsp6-s5-both', { tests: tests(), config: bothKeys(gen.command) });
    finish(fx, pluginBranch, pluginMain);
    const out = await fx.spec('', 'merge', 'TASK-101');
    expect(out.code).toBe(0);
    expect(read(fx, PLUGIN)).toBe('branch plugin\n');
    expect(gen.runs()).toBe(0);
  }, 120_000);
});

describe('PIP-002/S24 the sync without a command', () => {
  /** The sync of a conflict in ASSETS only, under `config`. */
  async function syncAssets(prefix: string, config: (cfg: Record<string, unknown>) => void) {
    const fx = project(prefix, { config });
    diverged(fx, branchEdit, mainEdit);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    return { fx, out };
  }

  it('PIP-002/S24 generated with no command: the sync commit holds the base\'s copy and nothing is rebuilt', async () => {
    const { fx, out } = await syncAssets('spec-pip2-s24-nocmd', noCommand);
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe("export const assets = 'main';\n");
    expect(read(fx, ASSETS)).toBe("export const assets = 'main';\n");
    expect(fx.git('show', `HEAD:${TEMPLATE}`).stdout).toBe(MERGED_TEMPLATE);
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
  }, 60_000);

  it('PIP-002/S24 an old generatedGlobs: the sync commit holds the base\'s copy and nothing is rebuilt', async () => {
    const { fx, out } = await syncAssets('spec-pip2-s24-legacy', legacyGlobs);
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('log', '-1', '--format=%s').stdout.trim()).toBe('TASK-101: sync with main');
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe("export const assets = 'main';\n");
    expect(fx.git('status', '--porcelain').stdout).toBe(' M tickets/TASK-101.md\n');
  }, 60_000);

  it('PIP-002/S24 a conflict only under generatedGlobs does not run the generated command', async () => {
    const gen = generator();
    const fx = project('spec-pip2-s24-both', { config: bothKeys(gen.command) });
    diverged(fx, pluginBranch, pluginMain);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(gen.runs()).toBe(0);
    expect(fx.git('show', `HEAD:${PLUGIN}`).stdout).toBe('main plugin\n');
  }, 60_000);
});


// PROP-074: a blocked stage's stash leaves out the generated files, and restoring it rebuilds them.
describe('WSP-009/R5, R6: a blocked stage\'s stash and the generated files', () => {
  const BLOCKED = 'TASK-101 implementer: blocked';
  const stuck = report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Stuck\nblockers: [{ text: Needs a name, cites: [TASK-101] }]');
  const nonTicket = (s: string) => s.split('\n').filter((l) => l !== '' && !l.includes('tickets/'));
  /** The files the blocked stash holds: [tracked changes, new files]. */
  const stashHolds = (fx: Fx): [string[], string[]] => {
    const sha = fx.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(`: ${BLOCKED}`))?.split(' ')[0] ?? '';
    expect(sha).not.toBe('');
    const tracked = fx.git('diff', '--name-only', `${sha}^1`, sha).stdout.split('\n').filter(Boolean).sort();
    const added = fx.git('rev-parse', '--verify', '--quiet', `${sha}^3`).code === 0 ? fx.git('ls-tree', '-r', '--name-only', `${sha}^3`).stdout.split('\n').filter(Boolean).sort() : [];
    return [tracked, added];
  };
  /** Starts the implementer stage, leaves changed/new work in the tree, and ends the stage blocked. */
  async function block(fx: Fx, generatedWork: boolean | 'staged') {
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    leaveWork(fx, generatedWork);
    const out = await fx.spec(stuck, 'ticket', 'advance', 'TASK-101');
    expect(out.code, out.stderr).toBe(0);
    return out;
  }
  /** Ordinary work, plus generated changes that are unstaged, or `'staged'` in the index. */
  function leaveWork(fx: Fx, generatedWork: boolean | 'staged') {
    write(fx, 'src/app.ts', `${read(fx, 'src/app.ts')}// half done\n`);
    write(fx, 'src/extra.ts', 'export const extra = 1;\n');
    write(fx, TEMPLATE, TEMPLATE_TEXT.replace('top line', 'top line, branch'));
    if (generatedWork) {
      write(fx, ASSETS, "export const assets = 'stage';\n");
      write(fx, NEW_FILE, createdBuilt);
    }
    if (generatedWork === 'staged') expect(fx.git('add', ASSETS, NEW_FILE).code).toBe(0);
  }
  /** The files in the stash's index commit, which git fills from staged changes whatever the pathspec. */
  const stashIndex = (fx: Fx): string[] => {
    const sha = fx.git('stash', 'list', '--format=%H %gs').stdout.split('\n').find((l) => l.endsWith(`: ${BLOCKED}`))?.split(' ')[0] ?? '';
    return fx.git('diff', '--name-only', `${sha}^1`, `${sha}^2`).stdout.split('\n').filter(Boolean).sort();
  };
  /** Then main changes the other end of the template and the generated file, and the stage starts again. */
  async function resume(fx: Fx) {
    expect(fx.git('checkout', '-q', 'main').code).toBe(0);
    mainEdit(fx);
    commitAll(fx, 'main moves on');
    expect(fx.git('checkout', '-q', 'ticket/TASK-101').code).toBe(0);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    return fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
  }

  it('WSP-009/S5 A blocked stage\'s stash comes back without its generated files', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-s5', { generated: gen });
    const out = await block(fx, true);
    expect(out.stdout.split('\n').filter(Boolean).at(-1)).toBe(`stash: ${BLOCKED}`);
    const [tracked, added] = stashHolds(fx);
    expect(tracked).toEqual(['src/app.ts', TEMPLATE]);
    expect(added).toEqual(['src/extra.ts']);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([]);
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(gen.runs()).toBe(0);

    const again = await resume(fx);
    expect(again.code, again.stderr).toBe(0);
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    const status = nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout);
    expect(status.sort()).toEqual([` M ${ASSETS}`, ' M src/app.ts', `?? src/extra.ts`, ` M ${TEMPLATE}`].sort());
    expect(read(fx, 'src/app.ts').endsWith('// half done\n')).toBe(true);
    expect(read(fx, 'src/extra.ts')).toBe('export const extra = 1;\n');
    expect(read(fx, TEMPLATE)).toBe(MERGED_TEMPLATE);
    expect(gen.runs()).toBe(1);
    expect(read(fx, ASSETS)).toBe(built(MERGED_TEMPLATE));
  }, 120_000);

  it('WSP-009/S5 without a command, the generated file is as the branch has it after the sync and nothing runs', async () => {
    const fx = project('spec-wsp9-s5-nocmd', { config: noCommand });
    await block(fx, true);
    const [tracked, added] = stashHolds(fx);
    expect(tracked).toEqual(['src/app.ts', TEMPLATE]);
    expect(added).toEqual(['src/extra.ts']);
    const again = await resume(fx);
    expect(again.code, again.stderr).toBe(0);
    expect(again.stderr).toBe('');
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout).sort()).toEqual([' M src/app.ts', `?? src/extra.ts`, ` M ${TEMPLATE}`].sort());
    expect(read(fx, ASSETS)).toBe("export const assets = 'main';\n");
    expect(fx.git('show', `HEAD:${ASSETS}`).stdout).toBe("export const assets = 'main';\n");
  }, 120_000);

  it('WSP-009/S5 an old generatedGlobs file is left out of the stash too', async () => {
    const fx = project('spec-wsp9-s5-legacy', { config: legacyGlobs });
    await block(fx, true);
    const [tracked, added] = stashHolds(fx);
    expect(tracked).toEqual(['src/app.ts', TEMPLATE]);
    expect(added).toEqual(['src/extra.ts']);
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([]);
  }, 120_000);

  it('WSP-009/S5 staged generated changes, tracked and new, are left out of the stash too', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-s5-staged', { generated: gen });
    await block(fx, 'staged');
    const [tracked, added] = stashHolds(fx);
    expect(tracked).toEqual(['src/app.ts', TEMPLATE]);
    expect(added).toEqual(['src/extra.ts']);
    expect(stashIndex(fx)).not.toContain(ASSETS);
    expect(stashIndex(fx)).not.toContain(NEW_FILE);
    expect(fx.git('diff', '--cached', '--name-only').stdout.split('\n').filter((l) => l !== '' && !l.includes('tickets/'))).toEqual([]);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([]);
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);

    const again = await resume(fx);
    expect(again.code, again.stderr).toBe(0);
    expect(read(fx, ASSETS)).toBe(built(MERGED_TEMPLATE));
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout).sort()).toEqual([` M ${ASSETS}`, ' M src/app.ts', '?? src/extra.ts', ` M ${TEMPLATE}`].sort());
  }, 120_000);

  it('WSP-009/S5 the stash of spec next --restart leaves out staged generated changes', async () => {
    // No command, so a staged generated file that came back with the stash would show; a rebuild would hide it.
    const fx = project('spec-wsp9-s5-restart', { config: noCommand });
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    leaveWork(fx, 'staged');
    const out = await fx.spec('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(read(fx, 'src/app.ts').endsWith('// half done\n')).toBe(true);
    expect(read(fx, 'src/extra.ts')).toBe('export const extra = 1;\n');
    expect(fx.git('diff', '--cached', '--name-only').stdout.split('\n').filter((l) => l !== '' && !l.includes('tickets/'))).toEqual([]);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout).sort()).toEqual([' M src/app.ts', '?? src/extra.ts', ` M ${TEMPLATE}`].sort());
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
  }, 120_000);

  it('WSP-009/S6 a failed rebuild reached through spec next is on stderr, in text output', async () => {
    const gen = generatorExtras(true);
    const fx = project('spec-wsp9-s6-next', { generated: gen });
    await block(fx, false);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    const out = await fx.spec('', 'next', 'TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.startsWith('ticket: TASK-101  role: implementer')).toBe(true);
    expect(out.stderr).toBe('TASK-101: the generated files do not rebuild after the stash: half built; they are as ticket/TASK-101 has them\n');
    expect(gen.runs()).toBe(1);
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(read(fx, 'src/extra.ts')).toBe('export const extra = 1;\n');
  }, 120_000);

  it('WSP-009/S6 a failed rebuild reached through spec next is on stderr, and stdout stays the JSON entry', async () => {
    const gen = generator(['build failed']);
    const fx = project('spec-wsp9-s6-next-json', { generated: gen });
    await block(fx, false);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    const out = await fx.spec('', 'next', 'TASK-101', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer' });
    expect(out.stderr).toBe('TASK-101: the generated files do not rebuild after the stash: build failed; they are as ticket/TASK-101 has them\n');
  }, 120_000);

  it('WSP-009/S6 a failed rebuild after spec next --restart is on stderr', async () => {
    const gen = generator(['build failed']);
    const fx = project('spec-wsp9-s6-restart', { generated: gen });
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    leaveWork(fx, false);
    const out = await fx.spec('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer' });
    expect(out.stderr).toBe('TASK-101: the generated files do not rebuild after the stash: build failed; they are as ticket/TASK-101 has them\n');
    expect(read(fx, 'src/extra.ts')).toBe('export const extra = 1;\n');
  }, 120_000);

  it('WSP-009/S6 A restore whose generated files do not rebuild keeps the restored work and says so', async () => {
    const gen = generatorExtras(true);
    const fx = project('spec-wsp9-s6-fail', { generated: gen });
    await block(fx, false);
    expect(fx.git('stash', 'list').stdout).toContain(BLOCKED);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stderr).toBe('TASK-101: the generated files do not rebuild after the stash: half built; they are as ticket/TASK-101 has them\n');
    expect(gen.runs()).toBe(1);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout).sort()).toEqual([' M src/app.ts', `?? src/extra.ts`, ` M ${TEMPLATE}`].sort());
    expect(read(fx, ASSETS)).toBe(BASE_ASSETS);
    expect(read(fx, OTHER)).toBe(BASE_OTHER);
    expect(existsSync(join(fx.repo, NEW_FILE))).toBe(false);
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
  }, 120_000);

  it('WSP-009/S6 the failure message joins the last three lines of the output', async () => {
    const gen = generator(['build a', 'build b', 'build c', 'build d']);
    const fx = project('spec-wsp9-s6-lines', { generated: gen });
    await block(fx, false);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stderr).toBe('TASK-101: the generated files do not rebuild after the stash: build b | build c | build d; they are as ticket/TASK-101 has them\n');
  }, 120_000);

  const CLI_BUNDLE = '.spec/bin/spec.cjs';
  /** The fixture ignores .spec/bin/; this project tracks the pinned CLI, as a project that commits it does. */
  const trackCli = (fx: Fx) => {
    expect(fx.git('add', '-f', CLI_BUNDLE).code).toBe(0);
    expect(fx.git('commit', '-q', '-m', 'track the pinned CLI').code).toBe(0);
  };

  it('WSP-009/S7 A blocked stage\'s stash leaves out the pinned CLI', async () => {
    const fx = project('spec-wsp9-s7');
    trackCli(fx);
    expect(fx.git('ls-files', CLI_BUNDLE).stdout.trim()).toBe(CLI_BUNDLE);
    const bundle = read(fx, CLI_BUNDLE);
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    write(fx, 'src/app.ts', `${read(fx, 'src/app.ts')}// half done\n`);
    write(fx, CLI_BUNDLE, `${bundle}// stage edit\n`);
    const out = await fx.spec(stuck, 'ticket', 'advance', 'TASK-101');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').filter(Boolean).at(-1)).toBe(`stash: ${BLOCKED}`);
    const [tracked, added] = stashHolds(fx);
    expect(tracked).toEqual(['src/app.ts']);
    expect(added).toEqual([]);
    expect(stashIndex(fx)).not.toContain(CLI_BUNDLE);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([]);
    expect(read(fx, CLI_BUNDLE)).toBe(bundle);

    // Then main changes the pinned CLI, and the stage starts again.
    expect(fx.git('checkout', '-q', 'main').code).toBe(0);
    write(fx, CLI_BUNDLE, `${bundle}// main edit\n`);
    commitAll(fx, 'main moves the pinned CLI');
    expect(fx.git('checkout', '-q', 'ticket/TASK-101').code).toBe(0);
    expect((await fx.spec('', 'ticket', 'answer', 'TASK-101', 'Q1', 'go', 'on')).code).toBe(0);
    const again = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(again.code, again.stderr).toBe(0);
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([' M src/app.ts']);
    expect(read(fx, 'src/app.ts').endsWith('// half done\n')).toBe(true);
    expect(read(fx, CLI_BUNDLE)).toBe(`${bundle}// main edit\n`);
    expect(fx.git('show', `HEAD:${CLI_BUNDLE}`).stdout).toBe(`${bundle}// main edit\n`);
  }, 120_000);

  it('WSP-009/S7 a stash made before, that also holds the pinned CLI, does not conflict', async () => {
    const fx = project('spec-wsp9-s7-old');
    trackCli(fx);
    const bundle = read(fx, CLI_BUNDLE);
    expect(fx.git('checkout', '-q', '-b', 'ticket/TASK-101').code).toBe(0);
    write(fx, 'src/app.ts', `${read(fx, 'src/app.ts')}// half done\n`);
    write(fx, CLI_BUNDLE, `${bundle}// stash edit\n`);
    expect(fx.git('stash', 'push', '-u', '-m', BLOCKED).code).toBe(0);
    expect(fx.git('checkout', '-q', 'main').code).toBe(0);
    write(fx, CLI_BUNDLE, `${bundle}// main edit\n`);
    commitAll(fx, 'main moves the pinned CLI');

    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stderr).toBe('');
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(read(fx, CLI_BUNDLE)).toBe(`${bundle}// main edit\n`);
    expect(fx.git('show', `HEAD:${CLI_BUNDLE}`).stdout).toBe(`${bundle}// main edit\n`);
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout)).toEqual([' M src/app.ts']);
    expect(read(fx, 'src/app.ts').endsWith('// half done\n')).toBe(true);
  }, 120_000);

  it('WSP-009/S6 a stash made before, that also holds a generated file, does not conflict', async () => {
    const gen = generator();
    const fx = project('spec-wsp9-s6-old', { generated: gen });
    expect(fx.git('checkout', '-q', '-b', 'ticket/TASK-101').code).toBe(0);
    write(fx, 'src/app.ts', `${read(fx, 'src/app.ts')}// half done\n`);
    write(fx, 'src/extra.ts', 'export const extra = 1;\n');
    write(fx, ASSETS, "export const assets = 'stash';\n");
    expect(fx.git('stash', 'push', '-u', '-m', BLOCKED).code).toBe(0);
    write(fx, ASSETS, "export const assets = 'branch';\n");
    commitAll(fx, 'branch moves on');
    expect(fx.git('checkout', '-q', 'main').code).toBe(0);

    const out = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stderr).toBe('');
    expect(fx.git('stash', 'list').stdout).not.toContain(BLOCKED);
    expect(gen.runs()).toBe(1);
    expect(read(fx, ASSETS)).toBe(built(TEMPLATE_TEXT));
    expect(nonTicket(fx.git('status', '--porcelain', '--untracked-files=all').stdout).sort()).toEqual([` M ${ASSETS}`, ' M src/app.ts', `?? src/extra.ts`].sort());
    expect(read(fx, 'src/app.ts').endsWith('// half done\n')).toBe(true);
    expect(read(fx, 'src/extra.ts')).toBe('export const extra = 1;\n');
  }, 120_000);
});
