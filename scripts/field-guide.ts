// Builds docs/field-guide.html, a visual guide to the system. Every file it shows is read from the
// chat-mini fixture, and every command output comes from running PROP-201 through the CLI in a
// throwaway copy, with the reference patches standing in for session delegates. Rebuild after any change
// to the format, the roles or the CLI's output:
//   npm run guide
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli/run';
import { git } from '../src/io/git';

const REPO = join(import.meta.dirname, '..');
const FIXTURE = join(REPO, 'fixtures/chat-mini');
const read = (p: string) => readFileSync(join(FIXTURE, p), 'utf8');
const firstLines = (text: string, n: number) => {
  const lines = text.trimEnd().split('\n');
  return lines.length <= n ? lines.join('\n') : `${lines.slice(0, n).join('\n')}\n…`;
};
/** One `## heading` section of a brief, up to the next `## `. */
const section = (text: string, heading: string, max = 40) => {
  const start = text.indexOf(`## ${heading}`);
  if (start < 0) return '';
  const next = text.indexOf('\n## ', start + 3);
  return firstLines(text.slice(start, next < 0 ? undefined : next), max);
};

// ---------------------------------------------------------------- the files, as they are

interface FileView {
  path: string;
  kind: string;
  caption: string;
  text: string;
}
const files: FileView[] = [
  { path: 'spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md', kind: 'feature', caption: 'One file per feature. Scenarios are Given / When / Then; steps name contracts by ID.', text: read('spec/modules/providers/features/PRV-002-fall-back-on-rate-limit.md') },
  { path: 'spec/modules/providers/contracts.md', kind: 'contract', caption: 'What features share: entities, events, operations, and their fields.', text: read('spec/modules/providers/contracts.md') },
  { path: 'spec/core/invariants.md', kind: 'invariant', caption: 'Always true, everywhere. Every brief that touches them carries them.', text: read('spec/core/invariants.md') },
  { path: 'spec/decisions/ADR-002-fallback-opt-in.md', kind: 'decision', caption: 'Why it is this way, and what was rejected.', text: read('spec/decisions/ADR-002-fallback-opt-in.md') },
  { path: 'spec/ui/UI-001-fallback-notice.md', kind: 'screen', caption: 'A screen, in words a test can check.', text: read('spec/ui/UI-001-fallback-notice.md') },
  { path: 'spec/modules/providers/_module.md', kind: 'module', caption: 'A module: its ID prefix, what it owns, what it depends on.', text: read('spec/modules/providers/_module.md') },
  { path: 'spec/core/glossary.md', kind: 'glossary', caption: 'Shared words, with their aliases.', text: read('spec/core/glossary.md') },
  { path: 'spec/config.json', kind: 'config', caption: 'How to run the tests, which paths each role may change, where tickets live.', text: read('spec/config.json') },
  { path: 'spec/index.md', kind: 'generated', caption: 'Built by spec build. The map of every unit.', text: read('spec/index.md') },
  { path: 'tickets/PROP-201.md', kind: 'ticket', caption: 'Planned work. You write the top; the CLI fills status, changed and history.', text: read('tickets/PROP-201.md') },
  { path: 'tickets/PROP-206.md', kind: 'ticket', caption: 'A ticket with an open blocker question: nothing starts until you answer it.', text: read('tickets/PROP-206.md') },
  { path: 'tests/PRV-002.test.ts', kind: 'test', caption: 'One test per scenario, named after its ID.', text: read('tests/PRV-002.test.ts') },
  { path: 'spec/roles/tester.md', kind: 'role', caption: 'A role prompt, harness-neutral. The main session delegates it with the task brief.', text: read('spec/roles/tester.md') },
  { path: '.claude/skills/feature/SKILL.md', kind: 'skill', caption: 'A command: /feature. It loads the spec near the request, interviews you, and files a proposal.', text: read('.claude/skills/feature/SKILL.md') },
  { path: '.claude/skills/spec-init/SKILL.md', kind: 'skill', caption: 'A command: /spec-init. Builds the spec with you: an interview, or a draft from the code that you confirm.', text: read('.claude/skills/spec-init/SKILL.md') },
  { path: '.claude/skills/chat-spec/SKILL.md', kind: 'skill', caption: 'The Claude Code skill. Loading it runs the CLI and injects the answer.', text: read('.claude/skills/chat-spec/SKILL.md') },
  { path: '.claude/settings.json', kind: 'hooks', caption: 'Two active hooks add session context and lint after edits.', text: read('.claude/settings.json') },
];

// ---------------------------------------------------------------- one ticket, for real

const dir = mkdtempSync(join(tmpdir(), 'field-guide-'));
cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes('/node_modules') });
symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
const g = (...args: string[]) => git(dir, args).stdout.trimEnd();
g('init', '-q', '-b', 'main');
g('config', 'user.name', 'you');
g('config', 'user.email', 'you@example.com');
g('add', '-A');
g('commit', '-q', '-m', 'chat-mini');

const spec = async (stdin: string, ...argv: string[]) => {
  const o = await run({ argv: [...argv, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve(stdin), now: () => '2026-10-27T12:00:00.000Z' });
  return `${o.stdout}${o.stderr}`.trimEnd();
};
const apply = (patch: string) => {
  const r = git(dir, ['apply', join(REPO, 'evals/reference', patch)]);
  if (r.code !== 0) throw new Error(`${patch}: ${r.stderr}`);
};
const report = (fields: string) => `\`\`\`report\n${fields}\n\`\`\``;
const testLines = (out: string) =>
  out
    .split('\n')
    .filter((l) => /^(PASS|FAIL) (PRV-001|SET-001)\//.test(l) || / passed, /.test(l))
    .join('\n');

interface Panel {
  title: string;
  kind: 'file' | 'cmd' | 'diff' | 'tests' | 'report';
  text: string;
}
interface Step {
  key: string;
  label: string;
  actor: string;
  caption: string;
  panels: Panel[];
}
const steps: Step[] = [];

steps.push({ key: 'ticket', label: 'Ticket', actor: 'You', caption: 'You say what you want, and what it touches.', panels: [{ title: 'tickets/PROP-201.md', kind: 'file', text: read('tickets/PROP-201.md') }] });

steps.push({
  key: 'gate',
  label: 'Gate',
  actor: 'CLI',
  caption: 'Is the path clear? What does the change reach?',
  panels: [
    { title: '$ spec gate PROP-201', kind: 'cmd', text: await spec('', 'gate', 'PROP-201') },
    { title: '$ spec impact PROP-201', kind: 'cmd', text: firstLines(await spec('', 'impact', 'PROP-201'), 22) },
  ],
});

{
  const brief = await spec('', 'brief', 'spec-writer', 'PROP-201');
  await spec('', 'ticket', 'start', 'PROP-201', 'spec-writer');
  apply('PROP-201.spec-writer.patch');
  const diff = g('diff', '--', 'spec');
  const r = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini to ProviderId, PRV-001/S4 and SET-001/S4\nchanged: [providers.ProviderConfig, PRV-001/S4, SET-001/S4]');
  const adv = await spec(r, 'ticket', 'advance', 'PROP-201');
  steps.push({
    key: 'spec-writer',
    label: 'spec-writer',
    actor: 'Delegate',
    caption: 'The spec changes first. Lint must be clean.',
    panels: [
      { title: 'Its brief (start)', kind: 'file', text: firstLines(brief, 26) },
      { title: 'What it changed', kind: 'diff', text: diff },
      { title: 'Its report', kind: 'report', text: r },
      { title: '$ spec ticket advance PROP-201', kind: 'cmd', text: adv },
    ],
  });
}

{
  await spec('', 'ticket', 'start', 'PROP-201', 'tester');
  const brief = await spec('', 'brief', 'tester', 'PROP-201');
  apply('PROP-201.tester.patch');
  const diff = g('diff', '--', 'tests');
  const tests = testLines(await spec('', 'test'));
  const r = report('role: tester\nticket: PROP-201\nresult: done\nsummary: Tests for PRV-001/S4 and SET-001/S4\nchanged: [PRV-001/S4, SET-001/S4]\nmutations: [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider, not the active one" }, { scenario: SET-001/S4, wrong: "enables gemini without saving its key" }]');
  const adv = await spec(r, 'ticket', 'advance', 'PROP-201');
  steps.push({
    key: 'tester',
    label: 'tester',
    actor: 'Delegate',
    caption: 'Tests before code. The new behaviour must fail now.',
    panels: [
      { title: 'Its brief: what is new', kind: 'file', text: section(brief, 'New in the spec') },
      { title: 'What it changed', kind: 'diff', text: diff },
      { title: '$ spec test', kind: 'tests', text: tests },
      { title: '$ spec ticket advance PROP-201', kind: 'cmd', text: adv },
    ],
  });
}

{
  await spec('', 'ticket', 'start', 'PROP-201', 'implementer');
  apply('PROP-201.implementer.patch');
  const diff = g('diff', '--', 'src');
  const tests = testLines(await spec('', 'test'));
  const r = report('role: implementer\nticket: PROP-201\nresult: done\nsummary: Added gemini to PROVIDER_IDS\nchanged: [PRV-001/S4, SET-001/S4]');
  const adv = await spec(r, 'ticket', 'advance', 'PROP-201');
  steps.push({
    key: 'implementer',
    label: 'implementer',
    actor: 'Delegate',
    caption: 'Code until every test passes. No test may change.',
    panels: [
      { title: 'What it changed', kind: 'diff', text: diff },
      { title: '$ spec test', kind: 'tests', text: tests },
      { title: 'Its report', kind: 'report', text: r },
      { title: '$ spec ticket advance PROP-201', kind: 'cmd', text: adv },
    ],
  });
}

{
  await spec('', 'ticket', 'start', 'PROP-201', 'reviewer');
  const brief = await spec('', 'brief', 'reviewer', 'PROP-201');
  const r = report('role: reviewer\nticket: PROP-201\nresult: done\nsummary: The diff makes PRV-001/S4 and SET-001/S4 true and breaks nothing\nverdict: approve');
  const adv = await spec(r, 'ticket', 'advance', 'PROP-201');
  steps.push({
    key: 'reviewer',
    label: 'reviewer',
    actor: 'Delegate',
    caption: 'Every scenario, rule and invariant, checked against the diff.',
    panels: [
      { title: 'Its brief: the checklist', kind: 'file', text: section(brief, 'Review checklist') },
      { title: 'Its report', kind: 'report', text: r },
      { title: '$ spec ticket advance PROP-201', kind: 'cmd', text: adv },
    ],
  });
}

{
  const log = g('log', '--format=%h  %s', 'main..HEAD');
  const ticket = readFileSync(join(dir, 'tickets/PROP-201.md'), 'utf8');
  steps.push({
    key: 'merge',
    label: 'Merge',
    actor: 'You',
    caption: 'One commit per stage. You read it, then merge.',
    panels: [
      { title: '$ git log --oneline main..ticket/PROP-201', kind: 'cmd', text: log },
      { title: 'tickets/PROP-201.md, after', kind: 'file', text: ticket },
    ],
  });
}
rmSync(dir, { recursive: true, force: true });

// ---------------------------------------------------------------- many tickets

const planOut = await run({ argv: ['next', '--format', 'json', '--root', join(FIXTURE, 'spec')], env: {}, cwd: FIXTURE, scriptPath: undefined });
const plan = JSON.parse(planOut.stdout) as unknown;

// ---------------------------------------------------------------- the page

const data = JSON.stringify({ files, steps, plan }).replace(/</g, '\\u003c');
const html = readFileSync(join(REPO, 'scripts/field-guide.html'), 'utf8').replace('"__DATA__"', data);
writeFileSync(join(REPO, 'docs/field-guide.html'), html);
process.stdout.write(`wrote docs/field-guide.html (${String(files.length)} files, ${String(steps.length)} steps)\n`);
