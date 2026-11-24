// Layer 3: role evals through a headless harness (DECISIONS X64, X94): Claude Code, or Codex.
// Every decision is graded deterministically: report fields, changed files, hidden tests, lint,
// tool use.
//   npx tsx evals/runner.ts [--harness claude|codex] [--model m] [--effort e] [--case <substring>]
//                           [--trials n] [--parallel n] [--max-run-tokens n]
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { run } from '../src/cli/run';
import { planAdvance } from '../src/core/advance';
import { FileTicketStore } from '../src/io/ticket-store';
import { matchesAny } from '../src/core/glob';
import { extractReport } from '../src/core/report';
import { ROLES } from '../src/core/schemas';
import { parseSpec } from '../src/core/parse/spec';
import { refsMatch } from '../src/core/ids';
import { lintSpec } from '../src/core/lint';
import { parseTicket } from '../src/core/parse/tickets';
import { loadDir } from '../src/io/fs';
import { coversScenario } from '../src/core/test-report';

const REPO = join(import.meta.dirname, '..');
const SPEC = '.claude/skills/chat-spec/scripts/spec';

/** Each sample project: its skill, how a copy is made ready, and the test command roles may run. */
const FIXTURES = {
  'chat-mini': { skill: 'chat-spec', allowed: ['Bash(npx vitest *)', 'Bash(npm test*)'] },
  'dart-mini': { skill: 'cart-spec', allowed: ['Bash(dart test*)', 'Bash(dart analyze*)'] },
} as const;
type FixtureName = keyof typeof FIXTURES;
const COMMAND_SKILLS = ['spec-init', 'feature', 'change', 'bug'];
const cliOf = (f: FixtureName) => `.claude/skills/${FIXTURES[f].skill}/scripts/spec`;
const opt = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const HARNESS = opt('--harness') ?? 'claude';
if (HARNESS !== 'claude' && HARNESS !== 'codex') throw new Error(`--harness is claude or codex, not ${HARNESS}`);
const MODEL = opt('--model') ?? process.env.SPEC_EVAL_MODEL ?? (HARNESS === 'codex' ? 'gpt-6-luna' : 'claude-haiku-5-5');
/** Claude Code `--effort`, or Codex `model_reasoning_effort`; the harness default when absent. */
const EFFORT = opt('--effort') ?? null;
const ONLY = opt('--case');
const TRIALS = opt('--trials') ? Number(opt('--trials')) : null;
const MAX_RUN_TOKENS = opt('--max-run-tokens') ? Number(opt('--max-run-tokens')) : Number.POSITIVE_INFINITY;
const PARALLEL = Math.max(1, Number(opt('--parallel') ?? 4));
const SESSION_TIMEOUT_MS = 15 * 60_000;
const MAX_BOUNCES = 3;
const IDENTITY = { GIT_AUTHOR_NAME: 'eval', GIT_AUTHOR_EMAIL: 'eval@example.com', GIT_COMMITTER_NAME: 'eval', GIT_COMMITTER_EMAIL: 'eval@example.com' };

// ---------------------------------------------------------------- case format

/** An earlier stage. `force` records it without check-report: for diffs that are wrong on purpose. */
const Stage = z.strictObject({ stage: z.enum(ROLES), patch: z.string().nullable().default(null), report: z.string(), force: z.boolean().default(false) });
const Plain = z.strictObject({ patch: z.string(), message: z.string().default('setup patch'), branch: z.string().optional() });
/** Paths deleted and committed before the trial, such as a spec, to start from code alone. */
const Remove = z.strictObject({ remove: z.array(z.string()).min(1), message: z.string().default('setup: remove') });
export const CaseSchema = z.strictObject({
  id: z.string(),
  /** A role's agent, or `command`: a plain session that types `input` (/feature …) unattended. */
  role: z.enum([...ROLES, 'command']),
  fixture: z.enum(['chat-mini', 'dart-mini']),
  ticket: z.string().nullable().default(null),
  input: z.string().nullable().default(null),
  setup: z.array(z.union([Stage, Plain, Remove])).default([]),
  trials: z.number().int().min(1).default(5),
  pass: z.string().regex(/^\d+\/\d+$/),
  tags: z.array(z.string()).default([]),
  expect: z.strictObject({
    refused: z.boolean().optional(),
    report: z
      .strictObject({
        result: z.enum(['done', 'blocked']).optional(),
        blockers: z.string().optional(),
        blockers_cite: z.array(z.string()).default([]),
        /** Some blocker cites at least one of these: for gaps that more than one ID names exactly. */
        blockers_cite_any: z.array(z.string()).default([]),
        verdict: z.enum(['approve', 'changes']).optional(),
        findings_cite: z.array(z.string()).default([]),
        assumed: z.array(z.strictObject({ question: z.string(), value: z.string() })).default([]),
        changed_includes: z.array(z.string()).default([]),
      })
      .optional(),
    files_changed: z.union([z.literal('none'), z.strictObject({ only: z.array(z.string()) }), z.strictObject({ never: z.array(z.string()) })]).optional(),
    hidden_tests: z.array(z.strictObject({ id: z.string(), expect: z.enum(['pass', 'fail']) })).default([]),
    lint: z.literal('clean').optional(),
    tests_pass: z.boolean().optional(),
    /**
     * Tester: a test for the scenario fails now and passes after the reference fix: a patch, or a
     * whole reference file copied over the tester's stubs (`fix_file`).
     */
    reproduces: z
      .strictObject({ scenario: z.string(), fix: z.string().optional(), fix_file: z.strictObject({ path: z.string(), from: z.string() }).optional() })
      .optional(),
    /** The final report passes check-report before a stage is recorded. */
    report_accepted: z.boolean().optional(),
    /** Commands: the one ticket the session filed. `touches_any`: at least one of these. */
    new_ticket: z
      .strictObject({
        type: z.enum(['proposal', 'bug', 'task']),
        touches_any: z.array(z.string()).default([]),
        violates: z.array(z.string()).default([]),
        questions_min: z.number().int().default(0),
        ready: z.boolean().optional(),
      })
      .optional(),
    /** Commands: the session must file no ticket at all. */
    no_new_ticket: z.boolean().optional(),
    /** /spec-init: features drafted from the code, each still a draft with sources (unattended). */
    drafted: z.strictObject({ features_min: z.number().int(), modules_min: z.number().int().default(1) }).optional(),
    final_mentions: z.array(z.string()).default([]),
    ticket_status: z.record(z.string(), z.string()).default({}),
    tools_never: z.array(z.string()).default([]),
    /** A feature's frontmatter link of `kind` lists `includes`, or does not list `excludes`. */
    links: z.array(z.strictObject({ feature: z.string(), kind: z.string(), includes: z.string().optional(), excludes: z.string().optional() })).default([]),
    /** An invariant the fixture lacks: what it applies to, and whether it says how it is shown. */
    new_invariant: z.strictObject({ applies_any: z.array(z.string()).default([]), shown_by: z.boolean().optional() }).optional(),
    /** Some `external: true` module holds an operation a live feature calls. */
    external_module: z.boolean().optional(),
    /** Lint (warnings included) raises none of these rules. */
    lint_never: z.array(z.string()).default([]),
  }),
});
type Case = z.infer<typeof CaseSchema>;

// ---------------------------------------------------------------- trial repo

const sh = (cwd: string, cmd: string, args: string[], input = '', timeout = 120_000, env: Record<string, string> = {}) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', input, timeout, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...IDENTITY, ...env } });

/** The slow commands (model sessions, test runs) run async, so trials can run side by side. */
function shAsync(cwd: string, cmd: string, args: string[], timeout: number, env: Record<string, string> = {}): Promise<{ status: number | null; stdout: string; error: string | null }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...IDENTITY, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', () => undefined);
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ status: null, stdout: Buffer.concat(chunks).toString('utf8'), error: e.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ status: code, stdout: Buffer.concat(chunks).toString('utf8'), error: signal ? `killed by ${signal}` : null });
    });
  });
}
const git = (cwd: string, ...args: string[]) => sh(cwd, 'git', args);
const spec = async (cwd: string, argv: string[], stdin = '') =>
  run({ argv: [...argv, '--root', join(cwd, 'spec')], env: {}, cwd, scriptPath: join(cwd, SPEC), stdin: () => Promise.resolve(stdin) });

const asset = (p: string) => join(REPO, 'evals', p);

function makeRepo(c: Case): string {
  const dir = mkdtempSync(join(tmpdir(), `eval-${c.id.replace(/\W/g, '-')}-`));
  cpSync(join(REPO, 'fixtures', c.fixture), dir, { recursive: true, filter: (s) => !/\/(node_modules|\.dart_tool)(\/|$)/.test(s) && !s.includes('/.claude/agents/') });
  const scripts = join(dir, `.claude/skills/${FIXTURES[c.fixture].skill}/scripts`);
  mkdirSync(scripts, { recursive: true });
  for (const f of ['spec', 'spec.cjs']) cpSync(join(REPO, 'dist', f), join(scripts, f));
  if (c.fixture === 'chat-mini') symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
  if (c.fixture === 'dart-mini') sh(dir, 'dart', ['pub', 'get', '--offline']);
  // Every eval gets the relevant brief in its first message; the session-start queue would add noise.
  const path = join(dir, '.claude/settings.json');
  const s = JSON.parse(readFileSync(path, 'utf8')) as { hooks: Record<string, unknown> };
  delete s.hooks.SessionStart;
  writeFileSync(path, `${JSON.stringify(s, null, 2)}\n`);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'fixture');
  return dir;
}

async function replaySetup(dir: string, c: Case): Promise<string | null> {
  for (const s of c.setup) {
    if ('stage' in s) {
      const t = c.ticket ?? '';
      const started = await spec(dir, ['ticket', 'start', t, s.stage]);
      if (started.code !== 0) return `setup: ticket start ${s.stage}: ${started.stderr}`;
      if (s.patch) {
        const a = git(dir, 'apply', asset(s.patch));
        if (a.status !== 0) return `setup: ${s.patch}: ${a.stderr}`;
      }
      const message = `\`\`\`report\n${s.report.trim()}\n\`\`\`\n`;
      if (s.force) {
        const store = new FileTicketStore(join(dir, 'tickets'), dir);
        const ticket = await store.get(t);
        const report = extractReport(message).report;
        if (!ticket || !report) return `setup: forced ${s.stage} needs a ticket and a valid report`;
        const plan = planAdvance(ticket, report, 'setup');
        const u = await store.update(t, plan.patch);
        if (!u.ok) return `setup: ${u.error}`;
        git(dir, 'add', '-A');
        git(dir, 'commit', '-q', '-m', plan.commitMessage);
        continue;
      }
      const adv = await spec(dir, ['ticket', 'advance', t, '--format', 'json'], message);
      if (adv.code !== 0) return `setup: advance ${s.stage}: ${adv.stdout}${adv.stderr}`;
    } else if ('remove' in s) {
      for (const p of s.remove) rmSync(join(dir, p), { recursive: true, force: true });
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', s.message);
    } else {
      if (s.branch && git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim() !== s.branch) git(dir, 'checkout', '-q', '-B', s.branch);
      const a = git(dir, 'apply', asset(s.patch));
      if (a.status !== 0) return `setup: ${s.patch}: ${a.stderr}`;
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', s.message);
    }
  }
  return null;
}


// ---------------------------------------------------------------- claude

interface Usage {
  input: number;
  cached: number;
  output: number;
  costUsd: number;
  turns: number;
}

interface Session {
  sessionId: string | null;
  final: string;
  usage: Usage;
  toolUses: { name: string; input: Record<string, unknown>; sub: boolean }[];
  error: string | null;
}

/**
 * What a project would allow its agents: the bundled CLI by any of the paths models write
 * (relative, absolute, real path, or bare `spec` on PATH), read-only git, reverting uncommitted
 * changes, and the project's own test command.
 */
function allowedFor(dir: string, fixture: FixtureName): string[] {
  const real = realpathSync(dir);
  const cli = cliOf(fixture);
  return [
    `Bash(${cli} *)`,
    `Bash(./${cli} *)`,
    `Bash(${dir}/${cli} *)`,
    `Bash(${real}/${cli} *)`,
    'Bash(spec *)',
    'Bash(git status*)',
    'Bash(git diff*)',
    'Bash(git log*)',
    'Bash(git show*)',
    'Bash(git checkout -- *)',
    'Bash(git restore *)',
    ...FIXTURES[fixture].allowed,
    `Skill(${FIXTURES[fixture].skill})`,
    'Read',
    'Grep',
    'Glob',
    'Edit',
    'Write',
    'Skill',
  ];
}

/** Command trials have no one to answer, which the commands are written to handle. */
const UNATTENDED = 'You run unattended: no one will answer questions or confirmations. Where you would ask the user, follow the command’s instructions for running unattended.';

async function claude(dir: string, fixture: FixtureName, agent: string | null, prompt: string, transcript: string, resume: string | null, extraAllowed: readonly string[] = []): Promise<Session> {
  const role = agent ? readFileSync(join(dir, 'spec/roles', `${agent}.md`), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '').trim() : '';
  const system = role ? `${UNATTENDED}\n\n${role}` : UNATTENDED;
  const who = ['--append-system-prompt', system];
  const args = ['-p', prompt, '--model', MODEL, ...(EFFORT ? ['--effort', EFFORT] : []), ...who, '--permission-mode', 'acceptEdits', '--allowedTools', ...allowedFor(dir, fixture), ...extraAllowed, ...COMMAND_SKILLS.map((s) => `Skill(${s})`), '--setting-sources', 'project', '--strict-mcp-config', '--output-format', 'stream-json', '--verbose'];
  if (resume) args.push('--resume', resume);
  // The skill's scripts/ on PATH, so a bare `spec` resolves too.
  const r = await shAsync(dir, 'claude', args, SESSION_TIMEOUT_MS, { PATH: `${join(dir, `.claude/skills/${FIXTURES[fixture].skill}/scripts`)}:${process.env.PATH ?? ''}` });
  writeFileSync(transcript, r.stdout, { flag: 'a' });
  const s: Session = { sessionId: null, final: '', usage: { input: 0, cached: 0, output: 0, costUsd: 0, turns: 0 }, toolUses: [], error: r.error };
  for (const line of r.stdout.split('\n')) {
    let e: { type?: string; session_id?: string; parent_tool_use_id?: string | null; message?: { content?: unknown }; result?: string; usage?: Record<string, number>; total_cost_usd?: number; num_turns?: number };
    try {
      e = JSON.parse(line) as typeof e;
    } catch {
      continue;
    }
    if (e.session_id) s.sessionId = e.session_id;
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      for (const c of e.message.content as { type?: string; name?: string; input?: Record<string, unknown> }[]) {
        if (c.type === 'tool_use' && c.name) s.toolUses.push({ name: c.name, input: c.input ?? {}, sub: !!e.parent_tool_use_id });
      }
    }
    if (e.type === 'result') {
      s.final = e.result ?? '';
      const u = e.usage ?? {};
      s.usage = {
        input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        cached: u.cache_read_input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        costUsd: e.total_cost_usd ?? 0,
        turns: e.num_turns ?? 0,
      };
    }
  }
  return s;
}

// ---------------------------------------------------------------- codex
//
// Codex has no agents, skills or hooks, so the runner supplies what Claude Code's adapter does:
// - an agent is its role prompt (spec/roles/<role>.md, as installed) at the top of the prompt;
// - a command (`/feature …`) is its skill file, with `$ARGUMENTS` filled in and each `!` line run;
// The role prompts say to read files with file tools and to run one shell command per call:
// Claude Code permission rules need that. Codex reads with the shell, so a note says so.

const codexNote = (cli: string) =>
  [
    'How this session works: you run in Codex, headless. There are no subagents, skills or hooks.',
    '- Read and search files with shell commands (`cat`, `sed -n`, `rg`, `ls`), and edit files with apply_patch. Where the text below says file tools, Read, Grep, Glob, Edit or Write, use these.',
    '- The rule below about one shell command per call is for another harness; here you may combine commands.',
    `- The spec CLI is \`spec\` on PATH, the same as \`${cli}\`.`,
  ].join('\n');

const stripFrontmatter = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n?/, '');

/** `/name args` → the command's skill text, as Claude Code's skill loader would expand it. */
function expandCommand(dir: string, input: string, path: string): string {
  const m = /^\/(\S+)\s*([\s\S]*)$/.exec(input.trim());
  const file = m ? join(dir, '.claude/skills', m[1] ?? '', 'SKILL.md') : '';
  if (!m || !existsSync(file)) return input;
  const args = (m[2] ?? '').trim();
  const words = args.split(/\s+/);
  let text = stripFrontmatter(readFileSync(file, 'utf8')).replaceAll('$ARGUMENTS', args);
  text = text.replace(/\$(\d+)/g, (_, n: string) => words[Number(n)] ?? '');
  return text.replace(/!`([^`]+)`/g, (_, cmd: string) => sh(dir, '/bin/sh', ['-c', cmd], '', 120_000, { PATH: path }).stdout.trimEnd());
}

/** A Codex stand-in: prepare a task with next, run a mock stage, then record its report file. */

const VITEST_DIRS = ['.vite-temp', '.vite'].map((d) => {
  const p = join(REPO, 'node_modules', d);
  mkdirSync(p, { recursive: true });
  return realpathSync(p);
});

/**
 * Flutter's `dart` wrapper writes to the Flutter cache, outside the sandbox, so `dart test` fails
 * under Codex. Its bundled SDK runs read-only; put it first, as a Dart-only machine would have it.
 */
const DART_SDK = (() => {
  const dart = sh(REPO, '/bin/sh', ['-c', 'command -v dart']).stdout.trim();
  const sdk = dart ? join(realpathSync(dart), '..', 'cache/dart-sdk/bin') : '';
  return sdk && existsSync(join(sdk, 'dart')) ? `${sdk}:` : '';
})();

async function codex(dir: string, fixture: FixtureName, agent: string | null, prompt: string, transcript: string, resume: string | null): Promise<Session> {
  const path = `${join(dir, `.claude/skills/${FIXTURES[fixture].skill}/scripts`)}:${DART_SDK}${process.env.PATH ?? ''}`;
  let text = prompt;
  if (!resume) {
    const role = agent ? stripFrontmatter(readFileSync(join(dir, 'spec/roles', `${agent}.md`), 'utf8')).trim() : null;
    text = role
      ? `${codexNote(cliOf(fixture))}\n\n# Your role\n\n${role}\n\n# Your task\n\n${prompt}`
      : `${codexNote(cliOf(fixture))}\n${UNATTENDED}\n\nThe user typed: ${prompt}\n\n${expandCommand(dir, prompt, path)}`;
  }
  const common = [
    '--json',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    '-m',
    MODEL,
    '-c',
    'approval_policy="never"',
    // A login shell would rerun the user's profile, which reorders PATH (spec, the Dart SDK).
    '-c',
    'allow_login_shell=false',
    '-c',
    'sandbox_mode="workspace-write"',
    // .git too: ticket new and ticket start commit, and accepted reports wait under .git. And
    // vitest's caches: chat-mini's node_modules is a link to this repo's, outside the workspace.
    '-c',
    `sandbox_workspace_write.writable_roots=${JSON.stringify([join(realpathSync(dir), '.git'), ...VITEST_DIRS])}`,
    ...(EFFORT ? ['-c', `model_reasoning_effort="${EFFORT}"`] : []),
  ];
  const args = resume ? ['exec', 'resume', ...common, resume, text] : ['exec', ...common, '-C', dir, text];
  const r = await shAsync(dir, 'codex', args, SESSION_TIMEOUT_MS, { PATH: path });
  writeFileSync(transcript, r.stdout, { flag: 'a' });
  const s: Session = { sessionId: resume, final: '', usage: { input: 0, cached: 0, output: 0, costUsd: 0, turns: 0 }, toolUses: [], error: r.error };
  for (const line of r.stdout.split('\n')) {
    let e: { type?: string; thread_id?: string; item?: { type?: string; text?: string; command?: string; changes?: unknown }; usage?: Record<string, number> };
    try {
      e = JSON.parse(line) as typeof e;
    } catch {
      continue;
    }
    if (e.type === 'thread.started' && e.thread_id) s.sessionId = e.thread_id;
    if (e.type === 'item.completed' && e.item) {
      const it = e.item;
      if (it.type === 'agent_message') s.final = it.text ?? '';
      if (it.type === 'command_execution') {
        s.usage.turns++;
        s.toolUses.push({ name: 'Bash', input: { command: it.command ?? '' }, sub: false });
      }
      if (it.type === 'file_change') {
        s.usage.turns++;
        s.toolUses.push({ name: 'Edit', input: { changes: it.changes }, sub: false });
      }
    }
    if (e.type === 'turn.completed' && e.usage) {
      const cached = e.usage.cached_input_tokens ?? 0;
      s.usage.input += (e.usage.input_tokens ?? 0) - cached;
      s.usage.cached += cached;
      s.usage.output += e.usage.output_tokens ?? 0;
    }
  }
  return s;
}

/** One model session in the chosen harness. */
function session(dir: string, fixture: FixtureName, agent: string | null, prompt: string, transcript: string, resume: string | null, extraAllowed: readonly string[] = []): Promise<Session> {
  return HARNESS === 'codex' ? codex(dir, fixture, agent, prompt, transcript, resume) : claude(dir, fixture, agent, prompt, transcript, resume, extraAllowed);
}

const add = (a: Usage, b: Usage): Usage => ({ input: a.input + b.input, cached: a.cached + b.cached, output: a.output + b.output, costUsd: a.costUsd + b.costUsd, turns: a.turns + b.turns });

// ---------------------------------------------------------------- grading

/** What the trial itself changed: everything since `base`, the commit the session started from. */
function changedPaths(dir: string, base: string): string[] {
  const sinceBase = git(dir, 'diff', '--name-only', base).stdout.split('\n');
  const untracked = git(dir, 'ls-files', '--others', '--exclude-standard').stdout.split('\n');
  return [...new Set([...sinceBase, ...untracked].map((p) => p.trim()).filter((p) => p !== '' && !p.startsWith('tickets/')))].sort();
}

/** The project's own test command, through `spec test`, so grading works on any stack. Async, so trials run side by side. */
async function testRun(dir: string, fixture: FixtureName): Promise<Map<string, string>> {
  const r = await shAsync(dir, join(dir, cliOf(fixture)), ['test', '--format', 'json', '--root', join(dir, 'spec')], 300_000);
  try {
    const run = JSON.parse(r.stdout) as { tests: { name: string; status: string }[] };
    return new Map(run.tests.map((t) => [t.name, t.status]));
  } catch {
    return new Map();
  }
}

const statusOf = (results: Map<string, string>, id: string) => [...results].find(([name]) => name === id || name.startsWith(`${id} `))?.[1];

async function grade(dir: string, c: Case, s: Session | null, refused: boolean, base: string): Promise<string[]> {
  const fails: string[] = [];
  const e = c.expect;
  if (e.refused !== undefined && e.refused !== refused) fails.push(`expected refused=${e.refused}, got ${refused}`);
  if (refused) return fails;
  if (e.report) {
    const r = extractReport(s?.final ?? '').report;
    if (!r) fails.push('no valid report in the final message');
    else {
      if (e.report.result && r.result !== e.report.result) fails.push(`result ${r.result}, expected ${e.report.result}`);
      if (e.report.blockers === '>=1' && r.blockers.length < 1) fails.push('expected at least one blocker');
      for (const id of e.report.blockers_cite) if (!r.blockers.some((b) => b.cites.includes(id))) fails.push(`no blocker cites ${id}`);
      const any = e.report.blockers_cite_any;
      if (any.length > 0 && !r.blockers.some((b) => b.cites.some((c) => any.includes(c)))) fails.push(`no blocker cites any of ${any.join(', ')}`);
      if (e.report.verdict && r.verdict !== e.report.verdict) fails.push(`verdict ${r.verdict ?? 'none'}, expected ${e.report.verdict}`);
      for (const id of e.report.findings_cite) if (!r.findings.some((f) => f.cites.includes(id))) fails.push(`no finding cites ${id}`);
      for (const a of e.report.assumed) if (!r.assumed.some((x) => 'question' in x && x.question === a.question && x.value.toLowerCase() === a.value.toLowerCase())) fails.push(`assumed lacks ${a.question} = ${a.value}`);
      for (const id of e.report.changed_includes) if (!r.changed.includes(id)) fails.push(`changed lacks ${id}`);
    }
  }
  const paths = changedPaths(dir, base);
  if (e.files_changed === 'none' && paths.length > 0) fails.push(`expected no changes, got ${paths.join(', ')}`);
  if (e.files_changed && typeof e.files_changed === 'object') {
    if ('only' in e.files_changed) {
      const only = e.files_changed.only;
      const bad = paths.filter((p) => !matchesAny(p, only));
      if (bad.length > 0) fails.push(`changed outside ${only.join(', ')}: ${bad.join(', ')}`);
    } else {
      const never = e.files_changed.never;
      const bad = paths.filter((p) => matchesAny(p, never));
      if (bad.length > 0) fails.push(`changed forbidden paths: ${bad.join(', ')}`);
    }
  }
  if (e.lint === 'clean') {
    const l = await spec(dir, ['lint']);
    if (l.code !== 0) fails.push(`lint not clean: ${l.stdout.split('\n').filter((x) => x.includes(' error ')).slice(0, 3).join(' | ')}`);
  }
  // The visible suite first; hidden tests join only for their own check, then leave again.
  if (e.tests_pass) {
    const results = await testRun(dir, c.fixture);
    const failed = [...results].filter(([, st]) => st === 'failed').map(([n]) => n);
    if (results.size === 0) fails.push('tests did not run');
    else if (failed.length > 0) fails.push(`tests fail: ${failed.slice(0, 3).join('; ')}`);
  }
  if (e.hidden_tests.length > 0) {
    const hidden = readdirSync(join(REPO, 'evals/hidden', c.fixture));
    for (const f of hidden) cpSync(join(REPO, 'evals/hidden', c.fixture, f), join(dir, 'tests', f));
    const results = await testRun(dir, c.fixture);
    for (const h of e.hidden_tests) {
      const st = statusOf(results, h.id);
      if (h.expect === 'pass' && st !== 'passed') fails.push(`hidden ${h.id}: ${st ?? 'missing'}, expected pass`);
      if (h.expect === 'fail' && st !== 'failed') fails.push(`hidden ${h.id}: ${st ?? 'missing'}, expected fail`);
    }
    for (const f of hidden) rmSync(join(dir, 'tests', f), { force: true });
  }
  if (e.new_ticket || e.no_new_ticket) {
    const had = new Set(readdirSync(join(REPO, 'fixtures', c.fixture, 'tickets')));
    const added = readdirSync(join(dir, 'tickets')).filter((f) => f.endsWith('.md') && !had.has(f));
    if (e.no_new_ticket && added.length > 0) fails.push(`filed ${added.join(', ')}, expected no ticket`);
    const want = e.new_ticket;
    if (want && added.length !== 1) fails.push(`expected one new ticket, got ${added.length === 0 ? 'none' : added.join(', ')}`);
    else if (want) {
      const file = added[0] ?? '';
      const t = parseTicket(`tickets/${file}`, readFileSync(join(dir, 'tickets', file), 'utf8')).ticket?.data;
      if (!t) fails.push(`${file} does not parse`);
      else {
        if (t.type !== want.type) fails.push(`${t.id} is a ${t.type}, expected a ${want.type}`);
        // A member matches its contract, and a scenario or rule matches its feature (X33).
        const hit = (id: string) => t.touches.some((x) => x === id || x.startsWith(`${id}.`) || x.startsWith(`${id}/`) || id.startsWith(`${x}.`));
        if (want.touches_any.length > 0 && !want.touches_any.some(hit)) fails.push(`${t.id} touches ${t.touches.join(', ') || 'nothing'}; expected one of ${want.touches_any.join(', ')}`);
        for (const v of want.violates) if (!t.violates.includes(v)) fails.push(`${t.id} does not name ${v} in violates`);
        if (t.questions.length < want.questions_min) fails.push(`${t.id} has ${t.questions.length} questions, expected at least ${want.questions_min}`);
        if (t.status !== 'open') fails.push(`${t.id} is ${t.status}: an unattended command must not start it`);
        if (want.ready !== undefined) {
          const g = await spec(dir, ['gate', t.id]);
          if ((g.code === 0) !== want.ready) fails.push(`${t.id} gate: ${g.stdout.split('\n').slice(0, 3).join(' | ')}`);
        }
      }
    }
  }
  if (e.drafted) {
    const g = await spec(dir, ['gaps', '--no-tests', '--format', 'json']);
    const drafts = (JSON.parse(g.stdout || '{"drafts":[]}') as { drafts: { id: string; sources: string[] }[] }).drafts;
    const features = drafts.filter((d) => /^[A-Z]{2,4}-\d{3,4}$/.test(d.id));
    const modules = drafts.filter((d) => /^[a-z][a-z0-9-]*$/.test(d.id));
    if (features.length < e.drafted.features_min) fails.push(`${String(features.length)} drafted features, expected at least ${String(e.drafted.features_min)}`);
    if (modules.length < e.drafted.modules_min) fails.push(`${String(modules.length)} drafted modules, expected at least ${String(e.drafted.modules_min)}`);
    if (features.some((f) => f.sources.length === 0)) fails.push(`drafted features without sources: ${features.filter((f) => f.sources.length === 0).map((f) => f.id).join(', ')}`);
    // Unattended, nothing may be confirmed: every feature in the spec must still be a draft.
    const allFeatures = parseSpec(loadDir(join(dir, 'spec'))).features.map((f) => f.id);
    const confirmed = allFeatures.filter((id) => !features.some((f) => f.id === id));
    if (confirmed.length > 0) fails.push(`confirmed without the user: ${confirmed.join(', ')}`);
  }
  if (e.report_accepted) {
    const check = await spec(dir, ['check-report', c.role, c.ticket ?? '', '--format', 'json'], s?.final ?? '');
    if (check.code !== 0) fails.push(`check-report refused the final report: ${(JSON.parse(check.stdout || '{"problems":[]}') as { problems: string[] }).problems.slice(0, 2).join(' | ')}`);
  }
  const rep = e.reproduces;
  if (rep) {
    const named = (results: Map<string, string>) => [...results].filter(([n]) => coversScenario(n, rep.scenario));
    const visible = named(await testRun(dir, c.fixture));
    if (visible.length === 0) fails.push(`no visible test named "${rep.scenario} …"`);
    else if (!visible.some(([, st]) => st === 'failed')) fails.push(`${rep.scenario} test passes on the current code`);
    else {
      // The tester's test must turn green with the reference fix applied on top of its work: a
      // patch, or a whole reference file over its stubs.
      let applied = { status: 0 as number | null, stderr: '' };
      if (rep.fix_file) cpSync(asset(rep.fix_file.from), join(dir, rep.fix_file.path));
      else applied = git(dir, 'apply', asset(rep.fix ?? ''));
      if (applied.status !== 0) fails.push(`reference fix did not apply: ${applied.stderr}`);
      else if (!named(await testRun(dir, c.fixture)).every(([, st]) => st === 'passed')) fails.push(`${rep.scenario} test fails even with the reference fix`);
    }
  }
  for (const m of e.final_mentions) if (!(s?.final ?? '').includes(m)) fails.push(`final message does not mention ${m}`);
  for (const [t, st] of Object.entries(e.ticket_status)) {
    // A ticket's state is committed on its own branch; main still holds the original.
    const onBranch = git(dir, 'show', `ticket/${t}:tickets/${t}.md`);
    const text = onBranch.status === 0 ? onBranch.stdout : readFileSync(join(dir, 'tickets', `${t}.md`), 'utf8');
    const got = /^status: (\S+)/m.exec(text)?.[1];
    if (got !== st) fails.push(`${t} status ${got ?? '?'}, expected ${st}`);
  }
  for (const tool of e.tools_never) if (s?.toolUses.some((u) => u.name === tool)) fails.push(`used tool ${tool}`);
  if (e.links.length > 0 || e.new_invariant || e.external_module || e.lint_never.length > 0) fails.push(...gradeSpec(dir, c));
  return fails;
}

/** The format judgments of a spec stage: which verb, which invariant, which module (X114–X125). */
export function gradeSpec(dir: string, c: Case): string[] {
  const fails: string[] = [];
  const e = c.expect;
  const now = parseSpec(loadDir(join(dir, 'spec')));
  for (const l of e.links) {
    const f = now.features.find((x) => x.id === l.feature);
    const ids = ((f?.links as Record<string, readonly { id: string }[]> | undefined)?.[l.kind] ?? []).map((r) => r.id);
    if (!f) fails.push(`no feature ${l.feature}`);
    else if (l.includes && !ids.some((id) => refsMatch(id, l.includes ?? ''))) fails.push(`${l.feature} ${l.kind} lacks ${l.includes} (has ${ids.join(', ') || 'none'})`);
    else if (l.excludes && ids.some((id) => refsMatch(id, l.excludes ?? ''))) fails.push(`${l.feature} ${l.kind} lists ${l.excludes}`);
  }
  if (e.new_invariant) {
    const before = new Set(parseSpec(loadDir(join(REPO, 'fixtures', c.fixture, 'spec'))).invariants.map((i) => i.id));
    const added = now.invariants.filter((i) => !before.has(i.id));
    const want = e.new_invariant;
    const fit = added.filter((i) => (want.applies_any.length === 0 || i.applies.some((a) => want.applies_any.some((w) => refsMatch(a.id, w)))) && (want.shown_by === undefined || (i.shownBy !== null) === want.shown_by));
    if (added.length === 0) fails.push('no new invariant');
    else if (fit.length === 0) fails.push(`new invariant ${added.map((i) => `${i.id} (applies ${i.applies.map((a) => a.id).join(', ') || 'nothing'}, shown by ${i.shownBy ?? 'nothing'})`).join('; ')} does not match ${JSON.stringify(want)}`);
  }
  if (e.external_module) {
    const ext = new Set(now.modules.filter((m) => m.external).map((m) => m.id));
    const ops = now.contracts.filter((x) => ext.has(x.homeModule) && x.kind === 'operation').map((x) => x.id);
    const called = now.features.some((f) => f.status !== 'removed' && f.links.calls.some((r) => ops.some((o) => refsMatch(r.id, o))));
    if (ext.size === 0) fails.push('no external module');
    else if (!called) fails.push(`no feature calls an operation of ${[...ext].join(', ')}`);
  }
  if (e.lint_never.length > 0) {
    const hit = lintSpec(now, {}).filter((x) => e.lint_never.includes(x.rule));
    if (hit.length > 0) fails.push(`lint: ${hit.map((x) => `${x.rule} ${x.message}`).join('; ')}`);
  }
  return fails;
}

// ---------------------------------------------------------------- trial

interface TrialResult {
  pass: boolean;
  fails: string[];
  usage: Usage;
  bounces: number;
  error: string | null;
}

async function trial(c: Case, out: string): Promise<TrialResult> {
  const dir = makeRepo(c);
  const transcript = `${out}.jsonl`;
  let usage: Usage = { input: 0, cached: 0, output: 0, costUsd: 0, turns: 0 };
  try {
    const setupError = await replaySetup(dir, c);
    if (setupError) return { pass: false, fails: [setupError], usage, bounces: 0, error: setupError };
    if (c.role === 'command') {
      // The user's side: a plain session types the command, as Alex would.
      const s = await session(dir, c.fixture, null, c.input ?? '', transcript, null);
      const fails = await grade(dir, c, s, false, 'HEAD');
      return { pass: fails.length === 0, fails, usage: s.usage, bounces: 0, error: s.error };
    }

    // Role trial: the runner prepares a gated ticket stage and passes its brief directly to the harness.
    const t = c.ticket ?? '';
    const gate = await spec(dir, ['gate', t]);
    if (gate.code !== 0) {
      const fails = await grade(dir, c, null, true, 'HEAD');
      return { pass: fails.length === 0, fails, usage, bounces: 0, error: null };
    }
    await spec(dir, ['ticket', 'start', t, c.role]);
    const base = git(dir, 'rev-parse', 'HEAD').stdout.trim();
    const brief = (await spec(dir, ['brief', c.role, t])).stdout;
    let s = await session(dir, c.fixture, c.role, `${t}\n\n${brief}`, transcript, null);
    usage = s.usage;
    let bounces = 0;
    // check-report problems go back to the model, at most 3 times.
    for (; bounces < MAX_BOUNCES; bounces++) {
      const check = await spec(dir, ['check-report', c.role, t, '--format', 'json'], s.final);
      const problems = (JSON.parse(check.stdout || '{"problems":[]}') as { problems: string[] }).problems;
      if (check.code === 0 || !s.sessionId) break;
      const next = await session(dir, c.fixture, c.role, `Your report was not accepted. Fix these, then finish again with one report block:\n${problems.map((p) => `- ${p}`).join('\n')}`, transcript, s.sessionId);
      usage = add(usage, next.usage);
      s = { ...next, toolUses: [...s.toolUses, ...next.toolUses] };
    }
    const fails = await grade(dir, c, s, false, base);
    return { pass: fails.length === 0, fails, usage, bounces, error: s.error };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- main

async function main() {
  sh(REPO, process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build.ts']);
  const files = readdirSync(asset('cases'))
    .flatMap((r) => readdirSync(join(asset('cases'), r)).map((f) => join(asset('cases'), r, f)))
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const cases = files.map((f) => CaseSchema.parse(parse(readFileSync(f, 'utf8')))).filter((c) => !ONLY || c.id.includes(ONLY));
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${HARNESS}-${MODEL}${EFFORT ? `-${EFFORT}` : ''}-${process.pid}`;
  const outRoot = join(REPO, 'evals/results', runId);
  const summary: { id: string; passed: number; trials: number; threshold: string; ok: boolean; medianTurns: number; input: number; cached: number; output: number; costUsd: number; fails: string[] }[] = [];
  let spent = 0;
  // Every (case, trial) is a job; PARALLEL of them run at once, each in its own repo copy.
  const jobs = cases.flatMap((c) => Array.from({ length: TRIALS ?? c.trials }, (_, i) => ({ c, i: i + 1 })));
  const byCase = new Map<string, TrialResult[]>(cases.map((c) => [c.id, []]));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length && spent < MAX_RUN_TOKENS) {
      const job = jobs[next++];
      if (!job) return;
      const dir = join(outRoot, job.c.id.replace('/', '__'));
      mkdirSync(dir, { recursive: true });
      const r = await trial(job.c, join(dir, String(job.i)));
      byCase.get(job.c.id)?.push(r);
      spent += r.usage.input + r.usage.output;
      process.stdout.write(`${job.c.id} trial ${job.i}: ${r.pass ? 'pass' : `FAIL ${r.fails.join('; ')}`}\n`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  for (const c of cases) {
    const dir = join(outRoot, c.id.replace('/', '__'));
    const results = byCase.get(c.id) ?? [];
    const [k = 0, of = 1] = c.pass.split('/').map(Number);
    const passed = results.filter((r) => r.pass).length;
    const turns = results.map((r) => r.usage.turns).sort((a, b) => a - b);
    const sum = (f: (u: Usage) => number) => results.reduce((a, r) => a + f(r.usage), 0);
    summary.push({
      id: c.id,
      passed,
      trials: results.length,
      threshold: c.pass,
      ok: results.length > 0 && passed / results.length >= k / of,
      medianTurns: turns[Math.floor(turns.length / 2)] ?? 0,
      input: sum((u) => u.input),
      cached: sum((u) => u.cached),
      output: sum((u) => u.output),
      costUsd: Math.round(sum((u) => u.costUsd) * 10_000) / 10_000,
      fails: [...new Set(results.flatMap((r) => r.fails))],
    });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'trials.json'), `${JSON.stringify(results, null, 2)}\n`);
  }
  writeFileSync(join(outRoot, 'results.json'), `${JSON.stringify({ harness: HARNESS, model: MODEL, effort: EFFORT, summary }, null, 2)}\n`);
  const table = ['| Case | Pass | Threshold | OK | Median turns | Input | Cached | Output | Cost (USD) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const s of summary) table.push(`| ${s.id} | ${s.passed}/${s.trials} | ${s.threshold} | ${s.ok ? 'yes' : 'NO'} | ${s.medianTurns} | ${s.input} | ${s.cached} | ${s.output} | ${s.costUsd} |`);
  writeFileSync(join(outRoot, 'summary.md'), `${table.join('\n')}\n`);
  process.stdout.write(`\n${table.join('\n')}\n\nresults: ${outRoot}\n`);
  const baselinePath = asset('baseline.json');
  if (existsSync(baselinePath)) {
    const base = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, number>;
    for (const s of summary) if (base[s.id] !== undefined && s.passed / Math.max(1, s.trials) < (base[s.id] ?? 0)) process.stdout.write(`regression: ${s.id} below baseline ${base[s.id] ?? 0}\n`);
  }
  process.exitCode = summary.every((s) => s.ok) ? 0 : 1;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) void main();
