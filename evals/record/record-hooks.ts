// Records raw Claude Code hook payloads from real headless sessions, to answer V1–V10.
//   npx tsx evals/record/record-hooks.ts [--model claude-haiku-5-5] [--keep]
// Runs in a throwaway copy of chat-mini. Bash is limited to the bundled CLI and read-only git, and
// edits use acceptEdits, so the session can change nothing outside the copy.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '../..');
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
};
const MODEL = arg('--model', 'claude-haiku-5-5');
const OUT = join(REPO, 'evals/record/out', new Date().toISOString().replace(/[:.]/g, '-'));
const SPEC = '.claude/skills/chat-spec/scripts/spec';

// stdin is closed at once: headless Claude Code otherwise waits for piped input.
const sh = (cwd: string, cmd: string, args: string[], timeout = 120_000) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, input: '', maxBuffer: 256 * 1024 * 1024 });

// 1. A throwaway project with the skill installed and the bundle copied in.
sh(REPO, process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build.ts']);
const repo = mkdtempSync(join(tmpdir(), 'spec-record-'));
const recorder = mkdtempSync(join(tmpdir(), 'spec-recorder-'));
cpSync(join(REPO, 'fixtures/chat-mini'), repo, { recursive: true, filter: (s) => !s.includes('/node_modules') });
mkdirSync(join(repo, '.claude/skills/chat-spec/scripts'), { recursive: true });
for (const f of ['spec', 'spec.cjs']) cpSync(join(REPO, 'dist', f), join(repo, '.claude/skills/chat-spec/scripts', f));
symlinkSync(join(REPO, 'node_modules'), join(repo, 'node_modules'), 'dir');

// 2. A logger on every event, beside the real hooks. It lives outside the project copy.
const logDir = join(recorder, 'hook-log');
mkdirSync(logDir, { recursive: true });
writeFileSync(
  join(recorder, 'log-hook.cjs'),
  `const fs=require('fs');const p=require('path');let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const n=fs.readdirSync(${JSON.stringify(logDir)}).length;fs.writeFileSync(p.join(${JSON.stringify(logDir)},String(n).padStart(4,'0')+'-'+process.argv[2]+'.json'),d);});`,
);
const settingsPath = join(repo, '.claude/settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks: Record<string, unknown[]> };
for (const event of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop']) {
  const tool = event === 'PreToolUse' || event === 'PostToolUse';
  (settings.hooks[event] ??= []).push({ ...(tool ? { matcher: '*' } : {}), hooks: [{ type: 'command', command: `node "${join(recorder, 'log-hook.cjs')}" ${event}` }] });
}
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
const id = ['-c', 'user.name=recorder', '-c', 'user.email=recorder@example.com'];
sh(repo, 'git', ['init', '-q', '-b', 'main']);
sh(repo, 'git', ['add', '-A']);
sh(repo, 'git', [...id, 'commit', '-q', '-m', 'fixture with recorder']);

const allowed = [`Bash(${SPEC} *)`, 'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)', 'Read', 'Grep', 'Glob', 'Edit', 'Write', 'Agent', 'Skill'];
function session(name: string, prompt: string, extra: string[]) {
  const r = sh(
    repo,
    'claude',
    ['-p', prompt, '--model', MODEL, '--permission-mode', 'acceptEdits', '--allowedTools', ...allowed, '--output-format', 'stream-json', '--verbose', ...extra],
    20 * 60_000,
  );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.stream.jsonl`), r.stdout);
  writeFileSync(join(OUT, `${name}.stderr.txt`), `${r.stderr}\nexit ${r.status ?? '?'}${r.error ? ` error ${r.error.message}` : ''}\n`);
  return r;
}

// 3b. Skill arguments that try to break out of their quotes (V6, V8).
const canary = join(recorder, 'pwned');
session('B-skill-args', `/chat-spec implementer x'; touch ${canary}; '`, []);

// 4. Collect and summarise.
const payloads = readdirSync(logDir).sort().map((f) => ({ file: f, data: JSON.parse(readFileSync(join(logDir, f), 'utf8')) as Record<string, unknown> }));
mkdirSync(join(OUT, 'payloads'), { recursive: true });
const scrub = (s: string) => s.replaceAll(repo, '$REPO').replaceAll(recorder, '$RECORDER').replaceAll(process.env.HOME ?? '~', '$HOME');
for (const p of payloads) writeFileSync(join(OUT, 'payloads', p.file), scrub(JSON.stringify(p.data, null, 2)));

const of = (e: string) => payloads.filter((p) => p.file.endsWith(`-${e}.json`)).map((p) => p.data);
const delegations = of('PreToolUse').filter((d) => ['Agent', 'Task'].includes(String(d.tool_name)));
const stops = of('SubagentStop');
const subagentEdits = of('PostToolUse').filter((d) => ['Edit', 'Write', 'MultiEdit'].includes(String(d.tool_name)) && ('agent_id' in d || 'agent_type' in d));
const firstUserLine = (() => {
  const path = stops.map((s) => s.agent_transcript_path).find((x): x is string => typeof x === 'string' && existsSync(x));
  if (!path) return null;
  const first = readFileSync(path, 'utf8').split('\n').find((l) => l.includes('"user"'));
  return first ? JSON.stringify(first).slice(0, 300) : null;
})();
const summary = {
  model: MODEL,
  V1_delegation_tool_names: [...new Set(of('PreToolUse').map((d) => String(d.tool_name)))],
  V2_delegation_input_keys: [...new Set(delegations.flatMap((d) => Object.keys((d.tool_input as object | undefined) ?? {})))],
  V3_subagent_first_user_entry: firstUserLine,
  V4_post_tool_use_from_subagent: subagentEdits.length,
  V5_subagent_stop_keys: [...new Set(stops.flatMap((s) => Object.keys(s)))],
  V6_canary_created: existsSync(canary),
  events: [...new Set(payloads.map((p) => p.file.replace(/^\d+-|\.json$/g, '')))],
  git_log: sh(repo, 'git', ['log', '--all', '--format=%s']).stdout.trim().split('\n'),
  out: OUT,
};
writeFileSync(join(OUT, 'summary.json'), scrub(JSON.stringify(summary, null, 2)));
process.stdout.write(`${scrub(JSON.stringify(summary, null, 2))}\n`);
if (!process.argv.includes('--keep')) {
  rmSync(repo, { recursive: true, force: true });
  rmSync(recorder, { recursive: true, force: true });
}
