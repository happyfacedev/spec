// Spec clarity probes: they test the spec, not the roles. Each question is asked with only the
// feature's implementer brief, with "Not specified by the spec" always on offer. Three trials,
// majority vote. A wrong answer, or "not specified" where the spec should decide, is a gap.
//   npx tsx evals/probes.ts [--model m] [--trials n] [--parallel n]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { run } from '../src/cli/run';

const REPO = join(import.meta.dirname, '..');
const ROOT = join(REPO, 'fixtures/chat-mini/spec');
const opt = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MODEL = opt('--model') ?? 'claude-haiku-5-5';
const TRIALS = Number(opt('--trials') ?? 3);
const PARALLEL = Number(opt('--parallel') ?? 4);
const NOT_SPECIFIED = 'Not specified by the spec';
const LETTERS = ['A', 'B', 'C', 'D'];

const ProbeFile = z.strictObject({
  feature: z.string(),
  probes: z.array(z.strictObject({ q: z.string(), options: z.array(z.string()).length(3), answer: z.string() })),
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const cwd = mkdtempSync(join(tmpdir(), 'probe-'));
    const tools = ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Agent', 'Skill', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite'];
    const child = spawn('claude', ['-p', prompt, '--model', MODEL, '--setting-sources', 'project', '--strict-mcp-config', '--disallowedTools', ...tools, '--output-format', 'json'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.on('close', () => {
      rmSync(cwd, { recursive: true, force: true });
      try {
        const result = (JSON.parse(out) as { result?: unknown }).result;
        resolve(typeof result === 'string' ? result : '');
      } catch {
        resolve('');
      }
    });
  });
}

const letterOf = (text: string) => /```answer\s*\n\s*([A-D])\b/.exec(text)?.[1] ?? /\b([A-D])\b/.exec(text.trim().slice(-20))?.[1] ?? null;

async function main() {
  const files = readdirSync(join(REPO, 'evals/probes')).filter((f) => f.endsWith('.yaml')).sort();
  const jobs: { feature: string; q: string; options: string[]; answer: string }[] = [];
  for (const f of files) {
    const p = ProbeFile.parse(parse(readFileSync(join(REPO, 'evals/probes', f), 'utf8')));
    for (const probe of p.probes) jobs.push({ feature: p.feature, ...probe, options: [...probe.options, NOT_SPECIFIED] });
  }
  const briefs = new Map<string, string>();
  for (const feature of new Set(jobs.map((j) => j.feature))) {
    briefs.set(feature, (await run({ argv: ['brief', 'implementer', feature, '--root', ROOT], env: {}, cwd: REPO, scriptPath: undefined })).stdout);
  }
  const tasks = jobs.flatMap((j, n) => Array.from({ length: TRIALS }, () => ({ j, n })));
  const votes = new Map<number, (string | null)[]>();
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const t = tasks[next++];
      if (!t) return;
      const prompt = `${briefs.get(t.j.feature) ?? ''}\n\n## Question\n${t.j.q}\n\n${t.j.options.map((o, i) => `${LETTERS[i] ?? '?'}) ${o}`).join('\n')}\n\nAnswer from the brief alone; do not guess beyond it. Reply with exactly one fenced block:\n\`\`\`answer\n<one letter>\n\`\`\`\n`;
      const letter = letterOf(await ask(prompt));
      votes.set(t.n, [...(votes.get(t.n) ?? []), letter]);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const rows = jobs.map((j, n) => {
    const v = votes.get(n) ?? [];
    const counts = new Map<string, number>();
    for (const x of v) if (x) counts.set(x, (counts.get(x) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    const chosen = top && top[1] * 2 > v.length ? (j.options[LETTERS.indexOf(top[0])] ?? null) : null;
    const verdict = chosen === j.answer ? 'ok' : chosen === NOT_SPECIFIED ? 'gap (said not specified)' : chosen === null ? 'no majority' : 'gap (wrong answer)';
    return { feature: j.feature, q: j.q, expected: j.answer, chosen, votes: v.join(''), verdict };
  });
  const outDir = join(REPO, 'evals/results', `probes-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'probes.json'), `${JSON.stringify({ model: MODEL, rows }, null, 2)}\n`);
  const table = ['| Feature | Question | Expected | Majority | Votes | Verdict |', '| --- | --- | --- | --- | --- | --- |', ...rows.map((r) => `| ${r.feature} | ${r.q} | ${r.expected} | ${r.chosen ?? '-'} | ${r.votes} | ${r.verdict} |`)];
  writeFileSync(join(outDir, 'probes.md'), `${table.join('\n')}\n`);
  process.stdout.write(`${table.join('\n')}\n\n${rows.filter((r) => r.verdict === 'ok').length}/${rows.length} probes answered as the spec decides. ${outDir}\n`);
}

void main();
