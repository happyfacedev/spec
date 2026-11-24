// A proposal in the build lane (PIP-021/R9, PIP-024), driven through the CLI in a real git copy of
// chat-mini. The ticket's spec-writer adds PRV-001/S4 and SET-001/S4 and rewords PRV-001/S1 (the
// reference patch of PROP-201), the spec review approves, and the implementer's stage then holds
// the tests and the code of that patch. The test command is a script that tells the stage's whole
// tree (which has the code: "gemini" in src/providers/config.ts) from the proof tree (which has not):
// it copies whole.json on the first and proof.json on the second, appends what it found in the
// tree to `log`, and counts its runs in `count`, all in a folder outside the repository.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { parseSpec } from '../../src/core/parse/spec';
import { loadDir } from '../../src/io/fs';
import { gitFixture, loadFixture, report, tempDir, validSpecWriterChecklist } from '../helpers';

export type Fx = ReturnType<typeof gitFixture>;

/** Parses JSON without throwing, so a test that gets no JSON fails on an assertion, not on an error. */
export function safeJson<T>(text: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const S4_PRV = 'PRV-001/S4 Streams from gemini';
export const S4_SET = 'SET-001/S4 Enable gemini';
export const MUTATIONS = [
  { scenario: 'PRV-001/S4', wrong: 'streams from the first enabled provider, not the active one' },
  { scenario: 'SET-001/S4', wrong: 'enables gemini without saving its key' },
];

const SCRIPT = [
  'dir=$1; out=$2',
  // A run that holds its turn (HOLD_TURN set) until the file holder-release exists.
  'if [ -n "$HOLD_TURN" ]; then touch "$dir/holder-started"; while [ ! -f "$dir/holder-release" ]; do sleep 0.05; done; cp "$dir/whole.json" "$out"; exit 0; fi',
  '{',
  '  echo "== $(pwd)"',
  '  for f in src/providers/config.ts package.json tests/PRV-001.test.ts tests/SET-001.test.ts spec/modules/providers/contracts.md src/other.ts tests/other.test.ts; do',
  '    if [ -f "$f" ]; then echo "$f $(grep -c -e gemini -e other "$f")"; else echo "$f absent"; fi',
  '  done',
  '} >> "$dir/log"',
  'echo x >> "$dir/count"',
  'if grep -q -e gemini -e tidier src/providers/config.ts src/app.ts; then',
  '  [ -f "$dir/whole-noreport" ] && exit 0',
  '  if [ -f "$dir/whole-gate" ]; then touch "$dir/whole-started"; while [ ! -f "$dir/whole-release" ]; do sleep 0.05; done; fi',
  '  cp "$dir/whole.json" "$out"',
  '  [ -f "$dir/whole-fail" ] && exit 1',
  '  exit 0',
  'fi',
  '[ -f "$dir/proof-noreport" ] && exit 0',
  'if [ -f "$dir/proof-gate" ]; then echo "$$" > "$dir/proof-pid"; touch "$dir/proof-started"; while [ ! -f "$dir/proof-release" ]; do sleep 0.05; done; fi',
  'sed "s#__PWD__#$(pwd)#g" "$dir/proof.json" > "$out"',
  'if grep -q \'"status":"failed"\' "$dir/proof.json"; then exit 1; fi',
  'exit 0',
  '',
].join('\n');

/** A check command that prints a lint line and exits 1 while the file `check-fail` exists. */
const CHECK = ['if [ -f "$1/check-fail" ]; then echo "src/app.ts:3 unused"; exit 1; fi', 'exit 0', ''].join('\n');

/** A worktreeSetup that fails while the flag `setup-fail` exists. */
const SETUP = ['echo "$(pwd)" >> "$1/setup-dirs"', 'if [ -f "$1/setup-fail" ]; then echo "setup boom"; exit 1; fi', 'exit 0', ''].join('\n');

export const ticketText = (id: string, lane: string | null, history: readonly string[] = []): string =>
  `---\nid: ${id}\ntype: proposal\ntitle: 'Add a "gemini" fake provider'\nstatus: open\nstage: null\n${lane === null ? '' : `lane: ${lane}\n`}touches: [providers.ProviderId, PRV-001, SET-001]\nviolates: []\nchanged: []\nquestions: []\n${history.length === 0 ? 'history: []' : `history:\n${history.join('\n')}`}\n---\nAdd a new fake provider called "gemini".\n`;

const AT = '2026-10-28T10:00:00.000Z';
/** One history record as YAML; `extra` is added after assumed, as `, lane: full`. */
export const rec = (role: string, o: { extra?: string; result?: string; verdict?: string } = {}): string =>
  `  - { at: "${AT}", role: ${role}, result: ${o.result ?? 'done'}, summary: x, verdict: ${o.verdict ?? (role === 'spec-review' ? 'approve' : 'null')}, assumed: []${o.extra ?? ''} }`;

export interface Result {
  title: string;
  status: 'passed' | 'failed' | 'pending';
  failureDetails?: { name: string }[];
  failureMessages?: string[];
}

export interface ProofOptions {
  /** Failing tests: by scenario, how they fail (assertion by default; 'none' says nothing of the kind). */
  failing?: { id: string; kind?: 'assertion' | 'error' | 'none'; message?: string }[];
  /** Scenarios with no test in the run. */
  omit?: string[];
  /** Scenarios whose test is skipped. */
  skip?: string[];
  /** Another test of a scenario, failing on its assertion. */
  extra?: string[];
  /** A file the run marks failed, with no tests. */
  failedFile?: { name: string; message: string };
}

export interface Case {
  fx: Fx;
  id: string;
  scratch: string;
  /** The check command the project's config holds when the case was built with `checkCommand`. */
  checkCommand: string;
  /** Every test name of the spec after the spec-writer's stage, one per scenario. */
  names: string[];
  /** The next stage after each stage recorded by the setup. */
  nexts: string[];
  flag(name: string, on: boolean): void;
  /** What the proof tree's run reports (whole.json is always every test passing). */
  setProof(o?: ProofOptions): void;
  /** The runs the test command made, each with the files it found, newest last. */
  runs(): { dir: string; files: Record<string, string> }[];
  runCount(): number;
  /** The implementer's report: done, with both mutations, unless `extra` says otherwise. */
  implementer(o?: { mutations?: unknown[] | null; lane?: 'full'; result?: 'done' | 'blocked'; summary?: string; blockers?: string }): string;
  check(message?: string): Promise<{ ok: boolean | undefined; problems: string[] | undefined; stderr: string; code: number | null }>;
  /** `spec ticket advance` in its text form, where a check that could not run prints its reason on stderr. */
  advanceText(message?: string): Promise<{ code: number | null; stdout: string; stderr: string }>;
  advance(message?: string): Promise<{ code: number | null; stdout: string; stderr: string; json: { next: string | null; status: string; problems: string[]; stash?: string } | undefined }>;
}

const made: (() => void)[] = [];
export const cleanupAll = (): void => {
  for (const c of made.splice(0)) c();
};
export type { Fx as BuildFx };

export interface BuildOptions {
  /** The ticket's ID: PROP-215 by default. */
  id?: string;
  /** The ticket's lane line: "build" by default. */
  lane?: string | null;
  /** The spec-writer only rewords PRV-001/S1 (no scenario added or changed), and the stage changes src/app.ts alone. */
  rewordOnly?: boolean;
  /** The project's worktreeSetup fails with "setup boom" while the flag `setup-fail` is set. */
  worktreeSetup?: boolean;
  /** Scenarios the spec-writer lists under documents. */
  documents?: string[];
  /** The spec-writer also removes SET-001/S3. */
  removeS3?: boolean;
  /** The claude-code role models in config.json. */
  delegation?: Record<string, string>;
  /** The stage runs the check command of scratch/check.sh, which fails while the flag `check-fail` is set. */
  checkCommand?: boolean;
  /** Stop before the spec review's stage, or before the implementer's (or tester's) stage starts. */
  stopBefore?: 'spec-review' | 'implementer';
  /** Make the stage's changes (the tests, the code, package.json). On by default. */
  changes?: boolean;
}

export const DEFAULT_ID = 'PROP-215';

/** PROP-215 in its first build stage: spec-writer and spec review done, the implementer's stage running with its changes in the tree. */
export async function buildStage(prefix: string, o: BuildOptions = {}): Promise<Case> {
  const ID = o.id ?? DEFAULT_ID;
  const scratch = tempDir(`${prefix}-scratch-`);
  const script = join(scratch, 'runner.sh');
  writeFileSync(script, SCRIPT);
  writeFileSync(join(scratch, 'check.sh'), CHECK);
  writeFileSync(join(scratch, 'setup.sh'), SETUP);
  const checkCommand = `sh '${join(scratch, 'check.sh')}' '${scratch}'`;
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `sh '${script}' '${scratch}' "{report}"`;
      if (o.checkCommand === true) cfg.checkCommands = [checkCommand];
      if (o.delegation !== undefined) cfg.delegation = { 'claude-code': o.delegation };
      if (o.worktreeSetup === true) cfg.worktreeSetup = `sh '${join(scratch, 'setup.sh')}' '${scratch}'`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      writeFileSync(join(dir, 'tickets', `${ID}.md`), ticketText(ID, o.lane === undefined ? 'build' : o.lane));
    },
  });
  made.push(() => {
    fx.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  });

  const start = async (role: string) => {
    const out = await fx.spec('', 'ticket', 'start', ID, role);
    expect(out.code, out.stderr).toBe(0);
  };
  const adv = async (message: string) => {
    const out = await fx.spec(message, 'ticket', 'advance', ID, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    return safeJson<{ next: string | null; problems: string[] }>(out.stdout);
  };

  // The spec-writer adds PRV-001/S4 and SET-001/S4 and rewords PRV-001/S1.
  await start('spec-writer');
  if (o.rewordOnly !== true) fx.apply('reference/PROP-201.spec-writer.patch');
  const feature = join(fx.repo, 'spec/modules/providers/features/PRV-001-stream-a-reply.md');
  const text = readFileSync(feature, 'utf8');
  expect(text).toContain('### S1: Streams tokens\n');
  writeFileSync(feature, text.replace('### S1: Streams tokens\n', '### S1: Streams tokens as they arrive\n'));
  if (o.removeS3 === true) {
    const settings = join(fx.repo, 'spec/modules/settings/features/SET-001-enable-providers.md');
    const before = readFileSync(settings, 'utf8');
    // A removed scenario's number goes into its feature's retired list (PIP-007/S1).
    const after = before.replace(/### S3: Enable without a key\n[\s\S]*?\n(?=### S4)/, '').replace('invariants: [INV-001]\n', 'invariants: [INV-001]\nretired: [S3]\n');
    expect(after).not.toBe(before);
    expect(after).toContain('retired: [S3]');
    writeFileSync(settings, after);
  }
  const docs = o.documents === undefined ? '' : `documents: ${JSON.stringify(o.documents)}\n`;
  const neighbour = o.rewordOnly === true ? 'PRV-001/S2' : 'PRV-001/S4';
  const changed = o.rewordOnly === true ? 'PRV-001' : 'providers.ProviderConfig';
  const written = await adv(report(`role: spec-writer\nticket: ${ID}\nresult: done\nsummary: Added gemini\nchanged: [${changed}]\n${docs}${validSpecWriterChecklist(neighbour, 'PRV-001/S1')}`));
  expect(written?.problems).toEqual([]);
  expect(written?.next).toBe('spec-review');
  const nexts: string[] = [written?.next ?? ''];

  const spec = parseSpec(loadDir(join(fx.repo, 'spec')));
  const names = spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));
  if (o.rewordOnly !== true) {
    expect(names).toContain(S4_PRV);
    expect(names).toContain(S4_SET);
  }

  const c: Case = {
    fx,
    id: ID,
    scratch,
    checkCommand,
    names,
    nexts,
    flag(name, on) {
      if (on) writeFileSync(join(scratch, name), '');
      else rmSync(join(scratch, name), { force: true });
    },
    setProof(p = {}) {
      const failing = p.failing ?? [{ id: 'PRV-001/S4' }, { id: 'SET-001/S4' }];
      const rows: Result[] = [];
      for (const title of names) {
        const id = title.slice(0, title.indexOf(' '));
        if ((p.omit ?? []).includes(id)) continue;
        const f = failing.find((x) => x.id === id);
        if ((p.skip ?? []).includes(id)) rows.push({ title, status: 'pending' });
        else if (f === undefined) rows.push({ title, status: 'passed' });
        else if (f.kind === 'error') rows.push({ title, status: 'failed', failureDetails: [{ name: 'TypeError' }], failureMessages: [f.message ?? 'TypeError: gemini.stream is not a function\n    at stream (src/app.ts:1:1)'] });
        else if (f.kind === 'none') rows.push({ title, status: 'failed', failureMessages: [f.message ?? 'the test did not pass'] });
        else rows.push({ title, status: 'failed', failureDetails: [{ name: 'AssertionError' }], failureMessages: [f.message ?? 'AssertionError: expected 1 to be 2'] });
      }
      for (const id of p.extra ?? []) {
        const title = names.find((n) => n.startsWith(`${id} `)) ?? id;
        rows.push({ title: `${title} on a second provider`, status: 'failed', failureDetails: [{ name: 'AssertionError' }], failureMessages: ['AssertionError: expected 1 to be 2'] });
      }
      const files = p.failedFile === undefined ? [] : [{ name: p.failedFile.name, status: 'failed', message: p.failedFile.message, assertionResults: [] }];
      writeFileSync(join(scratch, 'proof.json'), JSON.stringify({ testResults: [{ assertionResults: rows }, ...files] }));
    },
    runs() {
      const logFile = join(scratch, 'log');
      if (!existsSync(logFile)) return [];
      return readFileSync(logFile, 'utf8')
        .split('== ')
        .filter((b) => b.trim() !== '')
        .map((block) => {
          const [dir = '', ...lines] = block.split('\n').filter((l) => l !== '');
          return { dir, files: Object.fromEntries(lines.map((l) => [l.slice(0, l.indexOf(' ')), l.slice(l.indexOf(' ') + 1)])) };
        });
    },
    runCount() {
      const file = join(scratch, 'count');
      return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
    },
    implementer(r = {}) {
      const mutations = r.mutations === undefined ? MUTATIONS : r.mutations;
      const lines = [
        'role: implementer',
        `ticket: ${ID}`,
        `result: ${r.result ?? 'done'}`,
        `summary: ${r.summary ?? 'Gemini streams and can be enabled'}`,
        ...(mutations === null ? [] : [`mutations: ${JSON.stringify(mutations)}`]),
        ...(r.lane === undefined ? [] : [`lane: ${r.lane}`]),
        ...(r.blockers === undefined ? [] : [`blockers: ${r.blockers}`]),
      ];
      return report(lines.join('\n'));
    },
    async check(message) {
      const out = await fx.spec(message ?? c.implementer(), 'check-report', 'implementer', ID, '--format', 'json');
      const parsed = safeJson<{ ok: boolean; problems: string[] }>(out.stdout);
      return { ok: parsed?.ok, problems: parsed?.problems, stderr: out.stderr, code: out.code };
    },
    async advanceText(message) {
      const out = await fx.spec(message ?? c.implementer(), 'ticket', 'advance', ID);
      return { code: out.code, stdout: out.stdout, stderr: out.stderr };
    },
    async advance(message) {
      const out = await fx.spec(message ?? c.implementer(), 'ticket', 'advance', ID, '--format', 'json');
      return { code: out.code, stdout: out.stdout, stderr: out.stderr, json: safeJson(out.stdout) };
    },
  };

  writeFileSync(join(scratch, 'whole.json'), JSON.stringify({ testResults: [{ assertionResults: names.map((title) => ({ title, status: 'passed' })) }] }));
  c.setProof();

  if (o.stopBefore === 'spec-review') return c;
  await start('spec-review');
  const reviewed = await adv(report(`role: spec-review\nticket: ${ID}\nresult: done\nsummary: The delta covers its cases\nverdict: approve`));
  expect(reviewed?.problems).toEqual([]);
  expect(reviewed?.next).toBe(o.lane === null || o.lane === 'full' ? 'tester' : 'implementer');
  nexts.push(reviewed?.next ?? '');
  if (o.stopBefore === 'implementer') return c;
  await start('implementer');
  if (o.changes !== false) {
    if (o.rewordOnly === true) appendFileSync(join(fx.repo, 'src/app.ts'), '// a tidier app\n');
    else makeChanges(c);
  }
  return c;
}

/** The first build stage's changes: the tests and the code of the PROP-201 reference, and package.json. */
export function makeChanges(c: Case): void {
  c.fx.apply('reference/PROP-201.tester.patch');
  c.fx.apply('reference/PROP-201.implementer.patch');
  const pkg = join(c.fx.repo, 'package.json');
  const text = readFileSync(pkg, 'utf8');
  expect(text).toContain('"vitest": "5.0.5"');
  writeFileSync(pkg, text.replace('"vitest": "5.0.5"', '"vitest": "5.0.5",\n    "gemini-sdk": "1.0.0"'));
}

/** Forgets the runs the test command made so far. */
export const resetRuns = (c: Case): void => {
  rmSync(join(c.scratch, 'log'), { force: true });
  rmSync(join(c.scratch, 'count'), { force: true });
};

/** The ticket's history records, as the file holds them. */
export const history = (c: Case): Record<string, unknown>[] => c.fx.ticket(c.id)?.history ?? [];

/** Records the first build stage (its checks pass), then a reviewer's "changes" with one finding marked neither spec nor tests. */
export async function firstStageThenChanges(c: Case): Promise<void> {
  const done = await c.advance();
  expect(done.json?.problems).toEqual([]);
  expect(done.json?.next).toBe('reviewer');
  const started = await c.fx.spec('', 'ticket', 'start', c.id, 'reviewer');
  expect(started.code, started.stderr).toBe(0);
  const message = report(`role: reviewer\nticket: ${c.id}\nresult: done\nsummary: One thing to fix\nverdict: changes\nfindings: [{ cites: [PRV-001/S4], text: "a finding", class: C9 }]`);
  const out = await c.fx.spec(message, 'ticket', 'advance', c.id, '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  const json = safeJson<{ next: string | null; problems: string[] }>(out.stdout);
  expect(json?.problems).toEqual([]);
  expect(json?.next).toBe('implementer');
}

/** main brings "src/other.ts" and "tests/other.test.ts" while the ticket's branch waits. */
export function mainBrings(c: Case): void {
  const out = c.fx.git('checkout', '-q', 'main');
  expect(out.code, out.stderr).toBe(0);
  writeFileSync(join(c.fx.repo, 'src/other.ts'), 'export const other = 1;\n');
  writeFileSync(join(c.fx.repo, 'tests/other.test.ts'), '// other\n');
  expect(c.fx.git('add', '-A').code).toBe(0);
  expect(c.fx.git('commit', '-q', '-m', 'main brings other').code).toBe(0);
}

/** The second build stage after `firstStageThenChanges` and `mainBrings`: it changes src/providers/config.ts and the test of SET-001/S4. */
export async function secondBuildStage(c: Case): Promise<void> {
  const out = await c.fx.spec('', 'ticket', 'start', c.id, 'implementer');
  expect(out.code, out.stderr).toBe(0);
  appendFileSync(join(c.fx.repo, 'src/providers/config.ts'), '// a second look\n');
  appendFileSync(join(c.fx.repo, 'tests/SET-001.test.ts'), '// a stronger gemini test\n');
}

/** Everything that must not change while a check runs. */
export function snapshot(fx: Fx): Record<string, string> {
  const g = (...args: string[]) => fx.git(...args).stdout;
  return {
    head: g('rev-parse', 'HEAD'),
    branches: g('branch', '--list'),
    status: g('status', '--porcelain', '--untracked-files=all'),
    staged: g('diff', '--cached', '--name-only'),
    stash: g('stash', 'list'),
    worktrees: g('worktree', 'list'),
  };
}

const scratchFolders: string[] = [];
const ALL = loadFixture().spec.features.flatMap((f) => f.scenarios.map((s) => `${s.id} ${s.title}`));

/** A chat-mini copy holding `tickets`, whose test command reports every test of the base spec passing. */
export function plainFixture(prefix: string, tickets: Record<string, string>): Fx {
  const scratch = tempDir(`${prefix}-scratch-`);
  scratchFolders.push(scratch);
  const reportFile = join(scratch, 'report.json');
  writeFileSync(reportFile, JSON.stringify({ testResults: [{ assertionResults: ALL.map((title) => ({ title, status: 'passed' })) }] }));
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const config = join(dir, 'spec/config.json');
      const cfg = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
      cfg.testCommand = `cp '${reportFile}' "{report}"`;
      writeFileSync(config, `${JSON.stringify(cfg, null, 2)}\n`);
      for (const [id, text] of Object.entries(tickets)) writeFileSync(join(dir, 'tickets', `${id}.md`), text);
    },
  });
  made.push(() => {
    fx.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  });
  return fx;
}

/** The stage each ticket runs next, as `spec queue` reads the tickets of this tree. */
export async function nextOf(fx: Fx, ids: readonly string[]): Promise<Record<string, string | null>> {
  const out = await fx.spec('', 'queue', '--format', 'json');
  const queue = safeJson<{ ready: { id: string; stage: string | null }[] }>(out.stdout);
  return Object.fromEntries(ids.map((id) => [id, queue?.ready.find((e) => e.id === id)?.stage ?? null]));
}

/** The next stage of proposals seeded with a lane and a history: one fixture, one queue. */
export async function ordersOf(prefix: string, seeded: Record<string, { lane: string | null; history: readonly string[] }>): Promise<Record<string, string | null>> {
  const fx = plainFixture(prefix, Object.fromEntries(Object.entries(seeded).map(([id, s]) => [id, ticketText(id, s.lane, s.history)])));
  return nextOf(fx, Object.keys(seeded));
}

export const lines = (text: string, prefix: string): string[] => text.split('\n').filter((l) => l.startsWith(prefix));

export const appendCode = (c: Case, file: string, text: string): void => {
  appendFileSync(join(c.fx.repo, file), text);
};
