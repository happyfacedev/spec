// Scale benchmark: generates a lint-clean spec of a chosen size and times every stage.
//   npx tsx scripts/bench.ts [modules=40] [featuresPerModule=50] [--keep]
// 40 × 50 = 2,000 features, about the size of the handoff's target project (~900k tokens).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildBrief, estimateTokens } from '../src/core/brief';
import { buildGraph, toJson } from '../src/core/graph';
import { computeImpact } from '../src/core/impact';
import { lintSpec } from '../src/core/lint';
import { parseSpec } from '../src/core/parse/spec';
import { parseTickets } from '../src/core/parse/tickets';
import { buildQueue } from '../src/core/queue';
import { LineCounter, parseDocument } from 'yaml';
import { parseMarkdown } from '../src/core/markdown';
import { textOf } from '../src/core/source';
import { buildIndex } from '../src/core/units';
import { loadDir } from '../src/io/fs';

const [mArg, fArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const M = Number(mArg ?? 40);
const F = Number(fArg ?? 50);
const keep = process.argv.includes('--keep');
const ENTITIES = 10;
const EVENTS = 5;
const TICKETS = 200;

const root = mkdtempSync(join(tmpdir(), 'spec-bench-'));
const spec = join(root, '.claude/skills/bench-spec');
const write = (path: string, text: string) => {
  mkdirSync(dirname(join(spec, path)), { recursive: true });
  writeFileSync(join(spec, path), text);
};
const mod = (i: number) => `m${String(i).padStart(2, '0')}`;
const prefix = (i: number) => `M${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`;
const fid = (i: number, j: number) => `${prefix(i)}-${String(j + 1).padStart(3, '0')}`;

write('SKILL.md', '---\nname: bench-spec\ndescription: bench\n---\n!`echo`\n');
write('config.json', JSON.stringify({ formatVersion: 2, tickets: { adapter: 'files', dir: 'tickets' }, testCommand: 'true', codeGlobs: ['src/**'], testGlobs: ['tests/**'] }));
write('core/overview.md', '# bench\n\n## Purpose\nA generated spec for timing the CLI.\n');
write('core/conventions.md', '# Conventions\n\n## Scenario style\nGiven / When / Then.\n');
write('core/invariants.md', `# Invariants\n\n${Array.from({ length: M }, (_, i) => `### INV-${String(i + 1).padStart(3, '0')}: Invariant ${i}\nModule ${mod(i)} never loses data.\nDecisions: ADR-${String(i + 1).padStart(3, '0')}\n`).join('\n')}`);
write('core/glossary.md', `# Glossary\n\n${Array.from({ length: 200 }, (_, k) => `### Term${k}\nThe thing number ${k}.\nAliases: alias${k}\n`).join('\n')}`);
for (let i = 0; i < M; i++) {
  const adr = `ADR-${String(i + 1).padStart(3, '0')}`;
  write(`decisions/${adr}-decision-${i}.md`, `---\nid: ${adr}\ntitle: Decision ${i}\nstatus: accepted\nsupersedes: []\n---\n## Decision\nModule ${mod(i)} keeps one store.\n\n## Consequences\nIt is simple.\n\n## Context\nNone\n\n## Alternatives\nNone\n`);
  write(`modules/${mod(i)}/_module.md`, `---\nid: ${mod(i)}\nprefix: ${prefix(i)}\ndomain: d${i % 8}\nstatus: active\n---\nModule ${i} owns its entities and events.\n\n## Owns\n- Entities of ${mod(i)}\n\n## Non-goals\nNone\n`);
  const contracts: string[] = [];
  for (let k = 0; k < ENTITIES; k++) {
    contracts.push(`### ${mod(i)}.Entity${k}\nKind: entity · Status: active\nEntity ${k} of module ${i}.${k === 0 ? `\nDecisions: ADR-${String(i + 1).padStart(3, '0')}` : ''}\n`);
    for (let f = 0; f < 4; f++) contracts.push(`#### ${mod(i)}.Entity${k}.f${f}\nField ${f}. Type: string\n`);
  }
  for (let k = 0; k < EVENTS; k++) contracts.push(`### ${mod(i)}.Event${k}\nKind: event · Status: active\nEvent ${k} of module ${i}.\n\n#### ${mod(i)}.Event${k}.id\nThe record. Type: string\n`);
  write(`modules/${mod(i)}/contracts.md`, `# ${mod(i)} contracts\n\n${contracts.join('\n')}`);
  for (let j = 0; j < F; j++) {
    const writes = `${mod(i)}.Entity${j % ENTITIES}.f${j % 4}`;
    const emits = `${mod(i)}.Event${j % EVENTS}`;
    const reads = `${mod((i + 1) % M)}.Entity${j % ENTITIES}`;
    const consumes = `${mod((i + M - 1) % M)}.Event${j % EVENTS}`;
    const inv = `INV-${String(i + 1).padStart(3, '0')}`;
    const scenarios = [1, 2, 3, 4].map(
      (n) => `### S${n}: Case ${n} of feature ${j}\nGiven ${reads} holds a record for Term${(i * F + j) % 200}\nAnd ${consumes} was received\nWhen the user acts on it in way ${n}\nThen ${writes} is updated with value ${n}${n <= 2 ? ` (R${n})` : ''}\nAnd ${emits} is emitted once`,
    );
    write(
      `modules/${mod(i)}/features/${fid(i, j)}-feature-${j}.md`,
      `---\nid: ${fid(i, j)}\ntitle: Feature ${j} of module ${i}\nmodule: ${mod(i)}\nstatus: active\nreads: [${reads}]\nwrites: [${writes}]\nemits: [${emits}]\nconsumes: [${consumes}]\ninvariants: [${inv}]\n---\n## Intent\nFeature ${j} lets the user act on entity ${j % ENTITIES} of module ${i}, keeping ${inv} true. It reads its neighbour's entity and reacts to the previous module's event.\n\n## Behaviour\n${scenarios.join('\n\n')}\n\n## Rules\n- R1: Value ${j} is never negative (${inv})\n- R2: At most one update per action.\n\n## Out of scope\n- Undo\n`,
    );
  }
}
const ticketsDir = join(root, 'tickets');
mkdirSync(ticketsDir, { recursive: true });
for (let n = 0; n < TICKETS; n++) {
  const i = n % M;
  const j = n % F;
  const id = `TASK-${n + 1}`;
  writeFileSync(join(ticketsDir, `${id}.md`), `---\nid: ${id}\ntype: task\ntitle: Tidy feature ${j} of module ${i}\nstatus: open\ntouches: [${fid(i, j)}]\n---\nTidy it.\n`);
}

const time = <T>(label: string, f: () => T): T => {
  const s = process.hrtime.bigint();
  const r = f();
  console.log(`${label.padEnd(34)} ${(Number(process.hrtime.bigint() - s) / 1e6).toFixed(0).padStart(6)} ms`);
  return r;
};

const files = time('load files', () => loadDir(spec));
const bytes = files.reduce((a, f) => a + f.content.length, 0);
console.log(`spec: ${files.length} files, ${(bytes / 1e6).toFixed(2)} MB, ~${Math.round(bytes / 4 / 1000)}k tokens; ${M * F} features, ${M * F * 4} scenarios`);
const parsed = time('parse spec', () => parseSpec(files));
{
  // Where parse time goes: the Markdown block parser and the YAML frontmatter parser alone.
  const texts = files.filter((f) => f.path.endsWith('.md')).map(textOf);
  const docs = time('  of which: markdown blocks', () => texts.map((t) => parseMarkdown(t)));
  time('  of which: yaml frontmatter', () => {
    for (const d of docs) if (d.frontmatter) parseDocument(d.frontmatter.raw, { lineCounter: new LineCounter() }).toJS();
  });
}
const index = time('build index', () => buildIndex(parsed));
const tickets = time('parse tickets', () => parseTickets(loadDir(ticketsDir, root)));
const findings = time('lint (all rules, --ci off)', () => lintSpec(parsed, { tickets }));
const errors = findings.filter((f) => f.severity === 'error');
console.log(`lint: ${errors.length} errors, ${findings.length - errors.length} warnings${errors[0] ? `; first: ${errors[0].rule} ${errors[0].message}` : ''}`);
time('graph.json', () => toJson(buildGraph(parsed, index)));
const hot = `${mod(1)}.Entity0`;
const impact = time(`impact ${hot}`, () => computeImpact(parsed, index, hot, null));
console.log(`impact: ${impact.mustChange.length} must change, ${impact.reverify.length} re-verify`);
time('impact depth 3', () => computeImpact(parsed, index, hot, null, { depth: 3 }));
const brief = time('brief implementer TASK-1', () => buildBrief({ spec: parsed, index, tickets, role: 'implementer', id: 'TASK-1' }));
console.log(`brief: ~${estimateTokens(brief)} tokens`);
time(`queue (${TICKETS} tickets, gate each)`, () => buildQueue(parsed, index, tickets));

const cli = join(import.meta.dirname, '../dist/spec');
for (const args of [['lint'], ['brief', 'implementer', 'TASK-1'], ['impact', hot]]) {
  const s = process.hrtime.bigint();
  const r = spawnSync(cli, [...args, '--root', spec], { encoding: 'utf8' });
  console.log(`${`dist/spec ${args.join(' ')}`.padEnd(34)} ${(Number(process.hrtime.bigint() - s) / 1e6).toFixed(0).padStart(6)} ms (exit ${r.status ?? '?'})`);
}
if (keep) console.log(`kept: ${spec}`);
else rmSync(root, { recursive: true, force: true });
