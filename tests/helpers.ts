import { execFileSync, spawnSync } from 'node:child_process';
import { constants, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { run } from '../src/cli/run';
import type { Ticket } from '../src/core/model';
import type { Role } from '../src/core/schemas';
import { git } from '../src/io/git';
import { sourceFromText } from '../src/core/source';
import { parseSpec } from '../src/core/parse/spec';
import { parseTicket, parseTickets } from '../src/core/parse/tickets';
import { buildIndex } from '../src/core/units';
import { loadDir } from '../src/io/fs';
import { removeFolder, tempDir } from './tmp';

// Every test's temp folder comes from tempDir and every child process it starts goes through
// trackChild: both are cleaned up when the test or its file ends, on failure too (SPEC_KEEP_TMP=1 keeps the folders).
export { tempDir, trackChild } from './tmp';

export const REPO = join(import.meta.dirname, '..');

/** Build dist for CLI tests while keeping committed plugin outputs read-only. */
export function buildForTests(): void {
  const output = tempDir('spec-plugin-build-');
  try {
    execFileSync(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build.ts', '--out', output], { cwd: REPO });
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}
export const FIXTURE = join(REPO, 'fixtures/chat-mini');
export const FIXTURE_SPEC = join(FIXTURE, 'spec');

export function traceChild<T>(command: string, args: readonly string[], action: () => T): T {
  if (process.env['SPEC_TRACE_CHILDREN'] !== '1') return action();
  const started = performance.now();
  try {
    return action();
  } finally {
    process.stderr.write(`[child] ${command} ${args.join(' ')} ${(performance.now() - started).toFixed(1)} ms\n`);
  }
}

export function installPinnedCli(repo: string): void {
  const bin = join(repo, '.spec/bin');
  mkdirSync(bin, { recursive: true });
  for (const file of ['spec', 'spec.cjs']) cpSync(join(REPO, 'plugin/scripts', file), join(bin, file));
}

/** The fixture spec with some files replaced or added, in memory. */
export function fixtureWith(overrides: Record<string, string>) {
  const files = new Map(loadDir(FIXTURE_SPEC).map((f) => [f.path, f]));
  for (const [path, text] of Object.entries(overrides)) files.set(path, sourceFromText(path, text));
  const spec = parseSpec([...files.values()]);
  return { spec, index: buildIndex(spec) };
}

export const LINT_BASE = join(REPO, 'tests/core/lint-cases/_base');

/** The minimal lint-case spec with files replaced, added, or (null) removed, in memory. */
export function baseWith(files: Record<string, string | null> = {}) {
  const byPath = new Map(loadDir(join(LINT_BASE, 'spec')).map((f) => [f.path, f]));
  for (const [path, text] of Object.entries(files)) {
    if (text === null) byPath.delete(path);
    else byPath.set(path, sourceFromText(path, text));
  }
  const spec = parseSpec([...byPath.values()]);
  return { spec, index: buildIndex(spec), tickets: parseTickets(loadDir(join(LINT_BASE, 'tickets'), LINT_BASE)) };
}

export function fixtureFile(path: string): string {
  return readFileSync(join(FIXTURE_SPEC, path), 'utf8');
}

export function loadFixture() {
  const spec = parseSpec(loadDir(FIXTURE_SPEC));
  const tickets = parseTickets(loadDir(join(FIXTURE, 'tickets'), FIXTURE));
  return { spec, tickets, index: buildIndex(spec) };
}

export function ticketOf(tickets: { tickets: readonly Ticket[] }, id: string): Ticket {
  const t = tickets.tickets.find((x) => x.id === id);
  if (!t) throw new Error(`no fixture ticket ${id}`);
  return t;
}

const fixtureTemplates = new Map<string, string>();

function fixtureTemplate(fixture: string): string {
  if (fixture === FIXTURE) {
    const shared = process.env['SPEC_FIXTURE_TEMPLATE'];
    if (shared && existsSync(shared)) return shared;
  }

  const cached = fixtureTemplates.get(fixture);
  if (cached && existsSync(cached)) return cached;

  const template = tempDir('spec-fixture-template-');
  cpSync(fixture, template, { recursive: true, mode: constants.COPYFILE_FICLONE, filter: (src) => !/\/(node_modules|\.dart_tool)(\/|$)/.test(src) && !src.includes('/.claude/agents/') });
  if (fixture === FIXTURE) {
    installPinnedCli(template);
    symlinkSync(join(REPO, 'node_modules'), join(template, 'node_modules'), 'dir');
  }

  const g = (...args: string[]) => git(template, args);
  g('init', '-q', '-b', 'main');
  g('config', 'user.name', 'test');
  g('config', 'user.email', 'test@example.com');
  g('add', '-A');
  g('commit', '-q', '-m', 'fixture');
  fixtureTemplates.set(fixture, template);
  return template;
}

/**
 * A throwaway copy of a prepared fixture repository on `main`, resolving node_modules from this repo.
 * `spec` runs the CLI in-process against it. Setup changes are included in the fixture's first commit.
 * The folder is removed when the test file ends; `cleanup` removes it sooner.
 */
export function gitFixture(prefix: string, opts: { fixture?: string; patches?: string; setup?: (dir: string) => void } = {}) {
  const fixture = opts.fixture ?? FIXTURE;
  const repo = tempDir(`${prefix}-`);
  cpSync(fixtureTemplate(fixture), repo, { recursive: true, mode: constants.COPYFILE_FICLONE });
  const g = (...args: string[]) => traceChild('git', args, () => git(repo, args));
  if (opts.setup) {
    const gitDir = join(repo, '.git');
    const parkedGitDir = `${repo}.git-template`;
    renameSync(gitDir, parkedGitDir);
    try {
      opts.setup(repo);
    } finally {
      renameSync(parkedGitDir, gitDir);
    }
    const staged = g('add', '-A');
    if (staged.code !== 0) throw new Error(`could not stage fixture setup: ${staged.stderr}`);
    const committed = g('commit', '--amend', '--no-edit', '-q');
    if (committed.code !== 0) throw new Error(`could not commit fixture setup: ${committed.stderr}`);
  }
  const spec = (stdin: string, ...argv: string[]) =>
    run({ argv: [...argv, '--root', join(repo, 'spec')], env: {}, cwd: repo, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => '2026-10-27T12:00:00.000Z' });
  const ticket = (id: string) => parseTicket(`tickets/${id}.md`, readFileSync(join(repo, 'tickets', `${id}.md`), 'utf8')).ticket?.data;
  const apply = (patch: string) => {
    const r = git(repo, ['apply', join(REPO, opts.patches ?? 'evals', patch)]);
    if (r.code !== 0) throw new Error(`${patch}: ${r.stderr}`);
  };
  const cleanup = () => {
    removeFolder(repo);
  };
  return { repo, git: g, spec, ticket, apply, cleanup };
}

export const report = (fields: string): string => `Stage finished.\n\n\`\`\`report\n${fields.trim()}\n\`\`\`\n`;

/** A structurally valid checklist for reports in tests of unrelated spec-writer behavior. */
export function validSpecWriterChecklist(neighbourScenario = 'PRV-001/S1', preservedScenario = neighbourScenario): string {
  return 'checklist: ' + JSON.stringify([
    { item: 'C1', outcome: 'scenarios', ids: [neighbourScenario] },
    { item: 'C2', outcome: 'na', reason: 'No environment axes apply in this fixture.' },
    { item: 'C3', outcome: 'na', reason: 'No shared state is under test in this fixture.' },
    { item: 'C4', outcome: 'na', reason: 'No trust boundary is under test in this fixture.' },
    { item: 'C5', outcome: 'na', reason: 'No unknown input is under test in this fixture.' },
    { item: 'C6', outcome: 'scenarios', ids: [preservedScenario] },
    { item: 'C8', outcome: 'na', reason: 'No unverified external fact applies in this fixture.' },
  ]);
}

/**
 * A done tester report's mutations (PIP-019), one per scenario the ticket changes, for reports in
 * tests of unrelated tester behavior. Give exactly the scenarios the ticket changes: a scenario the
 * spec does not have is refused.
 */
export function validTesterMutations(...scenarios: string[]): string {
  return 'mutations: ' + JSON.stringify(testerMutations(...scenarios));
}

/** The mutations `validTesterMutations` reports, as the stage record keeps them. */
export function testerMutations(...scenarios: string[]): { scenario: string; wrong: string }[] {
  return scenarios.map((scenario) => ({ scenario, wrong: `ignores what ${scenario} says` }));
}

/**
 * The spec-review stage role (PIP-001/R1). Parsed rather than written as a literal, so the tests
 * compile before pipeline.Role holds it and stay valid once it does.
 */
export const SPEC_REVIEW = JSON.parse('"spec-review"') as Role;

/**
 * Runs a proposal's spec review in a git fixture, as a stage that approves (PIP-001/S1): starts the
 * stage after the spec-writer's, advances it with an approving report, and returns the recording.
 * Tests of what follows the spec-writer (the tester and later) call it between the two.
 */
export async function approveSpecReview(fx: ReturnType<typeof gitFixture>, ticket: string) {
  const started = await fx.spec('', 'ticket', 'start', ticket, 'spec-review');
  expect(started.code, started.stderr).toBe(0);
  const message = report(`role: spec-review\nticket: ${ticket}\nresult: done\nsummary: The delta covers its cases\nverdict: approve`);
  const out = await fx.spec(message, 'ticket', 'advance', ticket, '--format', 'json');
  return JSON.parse(out.stdout) as { problems: string[]; next: string | null; status: string };
}

/** An in-memory ticket for cases the fixture does not hold. */
export function syntheticTicket(frontmatter: string): Ticket {
  const { ticket, findings } = parseTicket('tickets/SYNTHETIC.md', `---\n${frontmatter}\n---\nSynthetic.\n`);
  if (!ticket) throw new Error(`synthetic ticket does not parse: ${JSON.stringify(findings)}`);
  return ticket;
}

/** The heap limit, in MB, that `runCliLimited` gives the command: smaller than the tree `fillTree` writes. */
export const HEAP_LIMIT_MB = 160;

/**
 * Writes `files` text files of `bytes` bytes each under `dir/<n>/`, none holding a word a Code: line
 * names. 2000 files of 128 KB are 250 MB, more than the 160 MB heap `runCliLimited` allows.
 */
export function fillTree(dir: string, files = 2000, bytes = 128 * 1024): void {
  const text = `${'filler '.repeat(Math.ceil(bytes / 7))}\n`.slice(0, bytes);
  for (let i = 0; i < files; i++) {
    const folder = join(dir, String(i % 20));
    if (i < 20) mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `f${i}.ts`), text);
  }
}

/**
 * Runs the CLI from source in a child process whose Node heap is limited to HEAP_LIMIT_MB, in the
 * folder `repo`, with the spec at `repo/spec`. A command that reads the whole tree of `fillTree` dies
 * with an out-of-memory exit code there; one that skips it exits normally.
 */
export function runCliLimited(repo: string, ...argv: string[]): { code: number | null; stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: `--max-old-space-size=${HEAP_LIMIT_MB}` };
  delete env['SPEC_ROOT'];
  delete env['CLAUDE_PROJECT_DIR'];
  delete env['SPEC_CLI_DELEGATED'];
  const r = spawnSync(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), join(REPO, 'src/cli/main.ts'), ...argv, '--root', join(repo, 'spec')], {
    cwd: repo,
    env,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
