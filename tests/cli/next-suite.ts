// CLI-007 and PIP-017: prepare safe session-delegation tasks through the CLI.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { realPath } from '../../src/io/fs';
import { afterAll, beforeAll, expect } from 'vitest';
import { partitionedDescribe, partitionedIt } from './partitioned-it';
const describe = partitionedDescribe(5, 'spec next', { 'PIP-017 delegated task': 4 });
const it = partitionedIt(5);
import { run } from '../../src/cli/run';
import { parseTicket } from '../../src/core/parse/tickets';
import { detectHarness } from '../../src/cli/next';
import { FIXTURE, REPO, gitFixture, report, tempDir } from '../helpers';
import { finishReport, type FinishReportOps } from '../../src/core/finish-report';
import { bumpReportRefusal, loadReport, saveReport } from '../../src/io/report-store';

const fixtures: ReturnType<typeof gitFixture>[] = [];
const worktrees: { fx: ReturnType<typeof gitFixture>; path: string }[] = [];
const dirs: string[] = [];
afterAll(() => {
  for (const { fx, path } of worktrees) fx.git('worktree', 'remove', '--force', path);
  for (const fx of fixtures) fx.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const invoke = (fx: ReturnType<typeof gitFixture>, env: Record<string, string | undefined>, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(fx.repo, 'spec')], env, cwd: fx.repo, scriptPath: undefined, now: () => '2026-10-30T12:00:00.000Z' });

const invokeAt = (fx: ReturnType<typeof gitFixture>, now: string, env: Record<string, string | undefined>, ...argv: string[]) =>
  run({ argv: [...argv, '--root', join(fx.repo, 'spec')], env, cwd: fx.repo, scriptPath: undefined, now: () => now });

const prepareScopeGapRestart = (dir: string) => {
  rmSync(join(dir, 'spec/modules/settings/features/SET-002-manage-api-keys.md'));
  const ticket = join(dir, 'tickets/PROP-201.md');
  writeFileSync(ticket, readFileSync(ticket, 'utf8').replace('touches: [providers.ProviderId, PRV-001, SET-001]', 'touches: [settings.ApiKey]'));
};
const scopeGapFeature = readFileSync(join(FIXTURE, 'spec/modules/settings/features/SET-002-manage-api-keys.md'), 'utf8');

type Delegate = { ticket: string; action: string; role: string; worktree: string; branch: string; model: string | null; advance: string; task: string };

/** The shell words of `text` (at most `max`), honouring quotes and backslashes; it ends at a backtick or a line end. */
function shellWords(text: string, max = Number.POSITIVE_INFINITY): string[] {
  const words: string[] = [];
  let word: string | null = null;
  let quote: string | null = null;
  for (let i = 0; i < text.length && words.length < max; i++) {
    const c = text.charAt(i);
    if (quote !== null) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < text.length) word = (word ?? '') + text.charAt(++i);
      else word = (word ?? '') + c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word = word ?? '';
    } else if (c === '\\' && i + 1 < text.length) {
      word = (word ?? '') + text.charAt(++i);
    } else if (/\s/.test(c) || c === '`') {
      if (word !== null) words.push(word);
      word = null;
      if (c === '`' || c === '\n') return words;
    } else {
      word = (word ?? '') + c;
    }
  }
  if (word !== null && words.length < max) words.push(word);
  return words;
}

/** The task's Working folder block. */
const folderBlock = (task: string): string => task.split('\n## Working folder\n')[1]?.split('\n## Brief\n')[0] ?? '';

/** The `--root` value the Working folder block gives after the CLI `cli`, as the shell reads it. */
function taskRoot(task: string, cli: string): string {
  const block = folderBlock(task);
  const at = block.indexOf(`${cli} --root `);
  expect(at, `the Working folder block gives the CLI as "${cli} --root <spec root>"`).toBeGreaterThanOrEqual(0);
  return shellWords(block.slice(at + `${cli} --root `.length), 1)[0] ?? '';
}

/** The report path of `entry.advance`, after checking the command form and that the file lies directly in the worktree parent. */
function advanceReportPath(entry: Delegate, cli: string): string {
  const words = shellWords(entry.advance);
  expect(words.slice(0, 5), entry.advance).toEqual([cli, 'ticket', 'advance', entry.ticket, '--report-file']);
  expect(words, entry.advance).toHaveLength(6);
  const path = words[5] ?? '';
  expect(isAbsolute(path), `report path ${path} is absolute`).toBe(true);
  expect(realPath(dirname(path)), 'the report file is directly inside the worktree parent').toBe(realPath(dirname(entry.worktree)));
  expect(path.startsWith(`${entry.worktree}${sep}`), 'the report file is outside the ticket worktree').toBe(false);
  expect(basename(path)).toContain(entry.ticket);
  expect(basename(path)).toContain(entry.role);
  return path;
}

/** What the delegated task says about directories: never cd, and not the old "cd there first". */
function expectNoCd(task: string): void {
  expect(task).not.toContain('cd there first');
  expect(task).not.toMatch(/`cd [^`]*`/);
  expect(task).not.toMatch(/&&\s*cd\s|\bcd\s+\S+\s*&&/);
  expect(folderBlock(task)).toMatch(/never[^.\n]*\bcd\b/i);
}

/** `spec next <id> --format json` on a ready ticket: a delegate entry whose stage has started. */
async function delegateEntry(fx: ReturnType<typeof gitFixture>, id: string): Promise<Delegate> {
  const out = await invoke(fx, {}, 'next', id, '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  const entry = JSON.parse(out.stdout) as Delegate;
  if (typeof entry.worktree === 'string') worktrees.push({ fx, path: entry.worktree });
  expect(entry).toMatchObject({ ticket: id, action: 'delegate', role: 'implementer' });
  return entry;
}

/** The main session's step: write the report at the path in `entry.advance`, run that command from the project root. */
async function advanceFromRoot(fx: ReturnType<typeof gitFixture>, entry: Delegate, cli: string): Promise<void> {
  const path = advanceReportPath(entry, cli);
  const text = report(`role: implementer\nticket: ${entry.ticket}\nresult: blocked\nsummary: Needs a meta field\nblockers: [{ text: Needs a meta field, cites: [conversation.Message.meta], external: false }]`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  try {
    const out = await run({ argv: shellWords(entry.advance).slice(1), env: {}, cwd: fx.repo, scriptPath: undefined, now: () => '2026-10-30T12:00:00.000Z' });
    expect(out.code, out.stderr).toBe(0);
  } finally {
    rmSync(path, { force: true });
  }
  expect(readFileSync(join(entry.worktree, `tickets/${entry.ticket}.md`), 'utf8'), 'the report is recorded in the ticket worktree').toContain('Needs a meta field');
  expect(readFileSync(join(fx.repo, `tickets/${entry.ticket}.md`), 'utf8'), 'the project root checkout is not the one recorded into').not.toContain('Needs a meta field');
}

/** A project with the old skill.json-style layout: the skill-local launcher and no `.spec/bin`. */
const pointerFixture = (prefix: string) =>
  gitFixture(prefix, {
    setup: (dir) => {
      rmSync(join(dir, '.spec/bin'), { recursive: true, force: true });
      const scripts = join(dir, '.claude/skills/chat-spec/scripts');
      mkdirSync(scripts, { recursive: true });
      cpSync(join(REPO, 'plugin/scripts/spec'), join(scripts, 'spec'));
    },
  });
const LAUNCHER = '.claude/skills/chat-spec/scripts/spec';

describe('spec next', () => {
  it('INS-014/S37 Driving field references exist on real next delegate entries', async () => {
    const drivingText = [
      readFileSync(join(REPO, 'templates/commands/_drive.md'), 'utf8'),
      readFileSync(join(REPO, 'plugin/skills/run/SKILL.md'), 'utf8'),
    ].join('\n');
    const fields = [...new Set([...drivingText.matchAll(/\bentry\.([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? ''))].sort();
    expect(fields.length).toBeGreaterThan(0);

    const fx = gitFixture('spec-next-driving-fields');
    fixtures.push(fx);
    const out = await invoke(fx, {}, 'next', 'TASK-101', '--harness', 'claude-code', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as Record<string, unknown>;
    worktrees.push({ fx, path: String(entry.worktree) });
    expect(entry.action).toBe('delegate');
    for (const field of fields) expect(Object.hasOwn(entry, field), `next entry is missing entry.${field}`).toBe(true);
  }, 60_000);

  it('CLI-007/S1 Prepare one ready ticket and return its task', async () => {
    const fx = gitFixture('spec-next-one');
    fixtures.push(fx);
    const preview = await fx.spec('', 'next');
    expect(preview.stdout).toContain('(not set — choose one for implementer)');
    expect(preview.stdout).toContain('(planned; created only with --start)');
    const headers = [...preview.stdout.matchAll(/^advance: `([^`\n]*)`$/gm)].map((m) => m[1] ?? '');
    const header = headers.find((line) => line.includes('advance TASK-101 ')) ?? '';
    expect(header.startsWith('.spec/bin/spec ticket advance TASK-101 --report-file '), `header: ${header}`).toBe(true);
    expect(header).not.toContain('<path>');
    const out = await invoke(fx, {}, 'next', 'TASK-101', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as Delegate;
    worktrees.push({ fx, path: entry.worktree });
    expect(entry).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer', branch: 'ticket/TASK-101', model: null });
    expect(entry.task).not.toBe('');
    // The report path is absolute and inside the worktree parent, and the task never cds and runs the relative CLI with --root.
    advanceReportPath(entry, '.spec/bin/spec');
    expectNoCd(entry.task);
    expect(taskRoot(entry.task, '.spec/bin/spec')).toBe(join(entry.worktree, 'spec'));
    expect(readFileSync(join(entry.worktree, 'tickets/TASK-101.md'), 'utf8')).toContain('stage: implementer');
  }, 60_000);

  it('PIP-017/S7 The spec-writer\'s task asks for the case checklist', async () => {
    const promptTemplate = readFileSync(join(REPO, 'roles/spec-writer.md'), 'utf8');
    const sharedPrompt = readFileSync(join(REPO, 'roles/_shared.md'), 'utf8');
    const fx = gitFixture('spec-next-case-checklist-current-prompt', {
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/roles/spec-writer.md'), promptTemplate);
        writeFileSync(join(dir, 'spec/roles/_shared.md'), sharedPrompt);
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { worktree: string; task: string };
    worktrees.push({ fx, path: entry.worktree });

    const prompt = entry.task.split('\n## Working folder\n')[0] ?? '';
    expect(prompt).toMatch(/work through every item.*(?:case checklist|## Case checklist).*before finishing/i);
    expect(prompt).toMatch(/report each under `?checklist:`?/i);
    expect(prompt).toContain('external: true');
    expect(prompt.match(/Work through every item of the brief's case checklist before finishing/g) ?? []).toHaveLength(1);
    expect(prompt).not.toContain('Work through every item of the brief\'s case checklist before finishing, and report each under checklist:. If you could not verify an external fact, end blocked with a blocker marked external: true.');
    expect(prompt).toMatch(/blocked/i);

    const form = /```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '';
    const fields = form.split('\n');
    const documents = fields.findIndex((line) => line.startsWith('documents:'));
    expect(documents).toBeGreaterThanOrEqual(0);
    expect(fields[documents + 1]).toMatch(/^checklist:/);

    const briefText = entry.task.split('## Brief\n')[1]?.split('\n\n## Report block')[0] ?? '';
    expect(briefText).toContain('## Case checklist');
  }, 60_000);

  it('PIP-017/S8 A spec-writer prompt that predates the checklist gets the instruction added', async () => {
    const paragraph = 'Work through every item of the brief\'s case checklist before finishing, and report each under checklist:. If you could not verify an external fact, end blocked with a blocker marked external: true.';
    const fx = gitFixture('spec-next-old-prompt');
    fixtures.push(fx);
    const oldPrompt = readFileSync(join(fx.repo, 'spec/roles/spec-writer.md'), 'utf8');
    const outsideReport = oldPrompt.split('```report')[0] ?? oldPrompt;
    expect(outsideReport).not.toMatch(/`?checklist:`?/i);
    const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { worktree: string; task: string };
    worktrees.push({ fx, path: entry.worktree });
    const prompt = entry.task.split('\n## Working folder\n')[0] ?? '';
    expect(prompt.trimEnd().endsWith('\n\n' + paragraph)).toBe(true);
    const briefText = entry.task.split('## Brief\n')[1]?.split('\n\n## Report block')[0] ?? '';
    expect(briefText).toContain('## Case checklist');

    const other = gitFixture('spec-next-old-prompt-other-role');
    fixtures.push(other);
    const otherOut = await other.spec('', 'next', 'TASK-101', '--format', 'json');
    expect(otherOut.code, otherOut.stderr).toBe(0);
    const otherEntry = JSON.parse(otherOut.stdout) as { worktree: string; task: string };
    worktrees.push({ fx: other, path: otherEntry.worktree });
    const otherPrompt = otherEntry.task.split('\n## Working folder\n')[0] ?? '';
    expect(otherPrompt).not.toContain(paragraph);
  }, 60_000);

  it('PIP-017/S9 A spec-writer report form without documents or checklist gets them', async () => {
    const changedLine = 'changed: []           # unit IDs you changed or added';
    const reportFormFor = async (prefix: string, insertedFields?: string, id = 'PROP-201') => {
      const fx = gitFixture(prefix, insertedFields === undefined ? {} : {
        setup: (dir) => {
          const path = join(dir, 'spec/roles/spec-writer.md');
          const prompt = readFileSync(path, 'utf8');
          if (!prompt.includes(changedLine)) throw new Error('the fixture has no spec-writer changed line');
          writeFileSync(path, prompt.replace(changedLine, changedLine + '\n' + insertedFields));
        },
      });
      fixtures.push(fx);
      const out = await fx.spec('', 'next', id, '--format', 'json');
      expect(out.code, out.stderr).toBe(0);
      const entry = JSON.parse(out.stdout) as { worktree: string; task: string };
      worktrees.push({ fx, path: entry.worktree });
      const block = /```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '';
      expect((entry.task.match(/```report/g) ?? [])).toHaveLength(1);
      return block.split('\n');
    };

    const missing = await reportFormFor('spec-next-report-form-missing');
    const changedAt = missing.findIndex((line) => line.startsWith('changed: []'));
    expect(missing[changedAt + 1]).toBe('documents: []');
    expect(missing[changedAt + 2]).toBe('checklist: []');

    const documentsOnly = await reportFormFor('spec-next-report-form-documents', 'documents: [PRV-001/S4]');
    const documentsAt = documentsOnly.findIndex((line) => line.startsWith('documents:'));
    expect(documentsOnly[documentsAt]).toBe('documents: [PRV-001/S4]');
    expect(documentsOnly[documentsAt + 1]).toBe('checklist: []');
    expect(documentsOnly.filter((line) => line.startsWith('documents:'))).toHaveLength(1);

    const both = await reportFormFor('spec-next-report-form-both', 'documents: [PRV-001/S4]\nchecklist: [{ item: C1, outcome: scenarios, ids: [PRV-001/S4] }]');
    const bothDocumentsAt = both.findIndex((line) => line.startsWith('documents:'));
    expect(both[bothDocumentsAt]).toBe('documents: [PRV-001/S4]');
    expect(both[bothDocumentsAt + 1]).toBe('checklist: [{ item: C1, outcome: scenarios, ids: [PRV-001/S4] }]');

    const otherRole = await reportFormFor('spec-next-report-form-other-role', undefined, 'TASK-101');
    expect(otherRole.some((line) => line.startsWith('documents:'))).toBe(false);
    expect(otherRole.some((line) => line.startsWith('checklist:'))).toBe(false);
  }, 120_000);

  /** chat-mini whose PROP-201 has a done spec-writer stage, so its next stage is the spec review. */
  const specReviewReady = (prefix: string, edit?: (dir: string) => void) =>
    gitFixture(prefix, {
      setup: (dir) => {
        const ticket = join(dir, 'tickets/PROP-201.md');
        const entry = '  - { at: "2026-10-28T10:00:00.000Z", role: spec-writer, result: done, summary: x, verdict: null, assumed: [] }';
        writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${entry}`));
        edit?.(dir);
      },
    });
  /** The prompt this version ships for the spec review, as a project installed by it holds it. */
  const installSpecReview = (dir: string) => {
    writeFileSync(join(dir, 'spec/roles/spec-review.md'), readFileSync(join(REPO, 'roles/spec-review.md'), 'utf8'));
    writeFileSync(join(dir, 'spec/roles/_shared.md'), readFileSync(join(REPO, 'roles/_shared.md'), 'utf8'));
  };
  const withDelegation = (delegation: Record<string, Record<string, string>>) => (dir: string) => {
    const path = join(dir, 'spec/config.json');
    const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    writeFileSync(path, `${JSON.stringify({ ...config, delegation }, null, 2)}\n`);
  };
  const recordNextEntry = async (fx: ReturnType<typeof gitFixture>, entry: Delegate, message: string, now = '2026-10-30T12:00:00.000Z') => {
    const path = advanceReportPath(entry, '.spec/bin/spec');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, message);
    try {
      const out = await run({ argv: shellWords(entry.advance).slice(1), env: {}, cwd: fx.repo, scriptPath: undefined, now: () => now });
      expect(out.code, out.stderr).toBe(0);
    } finally {
      rmSync(path, { force: true });
    }
    const parsed = parseTicket(`tickets/${entry.ticket}.md`, readFileSync(join(entry.worktree, `tickets/${entry.ticket}.md`), 'utf8')).ticket?.data;
    return parsed as unknown as { history: { model?: string; cost_usd?: number }[] } | undefined;
  };
  const stageRecordFile = (fx: ReturnType<typeof gitFixture>, ticket: string) => join(fx.repo, '.git/spec/stages', `${ticket}.json`);
  const configureOnly = (ids: string[], delegation: Record<string, Record<string, string>>) => (dir: string) => {
    for (const name of readdirSync(join(dir, 'tickets'))) {
      if (ids.includes(name.slice(0, -3))) continue;
      const file = join(dir, 'tickets', name);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: (?:open|blocked|in_progress)$/m, 'status: done'));
    }
    const task = join(dir, 'tickets/TASK-101.md');
    if (ids.includes('TASK-101')) writeFileSync(task, readFileSync(task, 'utf8').replace('touches: [PRV-001, PRV-002]', 'touches: [CNV-001]'));
    const task103 = join(dir, 'tickets/TASK-103.md');
    if (ids.includes('TASK-103')) writeFileSync(task103, readFileSync(task103, 'utf8').replace('touches: [PRV-002]', 'touches: [CNV-002]'));
    const config = join(dir, 'spec/config.json');
    const data = JSON.parse(readFileSync(config, 'utf8')) as Record<string, unknown>;
    writeFileSync(config, `${JSON.stringify({ ...data, delegation }, null, 2)}\n`);
  };

  it('PIP-017/S10 The spec review is delegated like any other stage', async () => {
    expect(existsSync(join(REPO, 'roles/spec-review.md')), 'this version ships roles/spec-review.md').toBe(true);
    const fx = specReviewReady('spec-next-spec-review', (dir) => {
      installSpecReview(dir);
      withDelegation({ 'claude-code': { reviewer: 'opus' } })(dir);
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'PROP-201', '--harness', 'claude-code', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string; model: string | null };
    worktrees.push({ fx, path: entry.worktree });
    expect(entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    // The expanded prompt, the Working folder block, the brief, then one report block.
    const prompt = entry.task.split('\n## Working folder\n')[0] ?? '';
    expect(prompt).not.toBe('');
    expect(prompt).not.toMatch(/\{shared\}|\{role\}|\{changed\}/);
    const order = ['\n## Working folder\n', '# Brief · spec-review · PROP-201 · spec@', '\n## Report block\n'].map((part) => entry.task.indexOf(part));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0)))).toBe(true);
    const form = /```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '';
    expect(entry.task.match(/```report/g) ?? []).toHaveLength(1);
    expect(form).toContain('role: spec-review');
    expect(form).toContain('ticket: PROP-201');
    expect(form).toMatch(/^verdict:/m);
    expect(form).toMatch(/^findings:/m);
    // What the prompt asks of the spec reviewer (PIP-017/R7).
    expect(prompt).toMatch(/spec delta/i);
    expect(prompt).toMatch(/neighbours/i);
    expect(prompt).toMatch(/C1 to C6/);
    expect(prompt).toMatch(/C8/);
    // It changes no file but the report file (R7, R17): the old "never edit any file" no longer stands alone.
    expect(prompt).toMatch(/(?:no file|any file|other file)[^\n]*(?:but|except|other than|besides)[^\n]*report file/i);
    expect(prompt).not.toMatch(/Never edit any file\./);
    expect(prompt).toMatch(/approve/);
    expect(prompt).toMatch(/changes/);
    expect(prompt).toMatch(/cite/i);
    expect(prompt).toContain('Follow-up:');
    expect(prompt).toMatch(/proportion/i);
    expect(prompt).toMatch(/one report/i);
    // The model: the harness's reviewer model, or its own spec-review model.
    expect(entry.model).toBe('opus');
    const own = specReviewReady('spec-next-spec-review-own', (dir) => {
      installSpecReview(dir);
      withDelegation({ 'claude-code': { reviewer: 'opus', 'spec-review': 'sonnet' } })(dir);
    });
    fixtures.push(own);
    const ownOut = await own.spec('', 'next', 'PROP-201', '--harness', 'claude-code', '--format', 'json');
    expect(ownOut.code, ownOut.stderr).toBe(0);
    const ownEntry = JSON.parse(ownOut.stdout) as { worktree: string; model: string | null };
    worktrees.push({ fx: own, path: ownEntry.worktree });
    expect(ownEntry.model).toBe('sonnet');
  }, 120_000);

  it('PIP-017/S11 A project installed before the spec review still delegates it', async () => {
    const fx = specReviewReady('spec-next-spec-review-old', withDelegation({ astro: { implementer: 'builder' } }));
    fixtures.push(fx);
    expect(existsSync(join(fx.repo, 'spec/roles/spec-review.md'))).toBe(false);
    const out = await fx.spec('', 'next', 'PROP-201', '--harness', 'astro', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string; model: string | null; missingModels: string[] };
    worktrees.push({ fx, path: entry.worktree });
    expect(entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    // This version's prompt, as init installs it; the project's files stay as they were.
    const shipped = readFileSync(join(REPO, 'roles/spec-review.md'), 'utf8');
    expect(/^role: spec-review$/m.test(shipped)).toBe(true);
    expect(entry.task).toMatch(/spec delta/i);
    expect(existsSync(join(fx.repo, 'spec/roles/spec-review.md'))).toBe(false);
    expect(existsSync(join(entry.worktree, 'spec/roles/spec-review.md'))).toBe(false);
    // Neither a spec-review nor a reviewer model: the spec review is not listed, the reviewer is.
    expect(entry.model).toBeNull();
    expect(entry.missingModels).toContain('reviewer');
    expect(entry.missingModels).not.toContain('spec-review');

    // A file that exists but is not a valid role prompt is an error, as for every role.
    const bad = specReviewReady('spec-next-spec-review-bad', (dir) => {
      writeFileSync(join(dir, 'spec/roles/spec-review.md'), 'not a role prompt\n');
    });
    fixtures.push(bad);
    const badOut = await bad.spec('', 'next', 'PROP-201', '--format', 'json');
    const badEntry = JSON.parse(badOut.stdout) as { action: string; blockers: { text: string }[] };
    expect(badEntry.action).toBe('error');
    expect(badEntry.blockers[0]?.text).toContain('no valid spec/roles/spec-review.md prompt');

    // With neither model set the text header asks the session to choose one for the spec review.
    const plain = specReviewReady('spec-next-spec-review-unset');
    fixtures.push(plain);
    const text = await plain.spec('', 'next', 'PROP-201');
    expect(text.stdout).toContain('model: (not set — choose one for spec-review)');
  }, 120_000);

  it('PIP-003/S20 The role prompts show the summary quoted', async () => {
    const done = (role: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [] }`;
    const stages: [string, string[]][] = [
      ['spec-writer', []],
      ['spec-review', [done('spec-writer')]],
      ['tester', [done('spec-writer'), done('spec-review', 'approve')]],
      ['implementer', [done('spec-writer'), done('spec-review', 'approve'), done('tester')]],
      ['reviewer', [done('spec-writer'), done('spec-review', 'approve'), done('tester'), done('implementer')]],
    ];
    for (const [role, history] of stages) {
      // The project's role prompts are this version's.
      const fx = gitFixture(`spec-next-quoted-summary-${role}`, {
        setup: (dir) => {
          for (const file of ['_shared', role]) writeFileSync(join(dir, `spec/roles/${file}.md`), readFileSync(join(REPO, `roles/${file}.md`), 'utf8'));
          if (history.length === 0) return;
          const ticket = join(dir, 'tickets/PROP-201.md');
          writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
        },
      });
      fixtures.push(fx);
      const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
      expect(out.code, `${role}: ${out.stderr}`).toBe(0);
      const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string };
      worktrees.push({ fx, path: entry.worktree });
      expect(entry, role).toMatchObject({ action: 'delegate', role });
      expect(entry.task.match(/```report/g) ?? [], role).toHaveLength(1);
      const form = (/```report\n([\s\S]*?)\n```/.exec(entry.task)?.[1] ?? '').split('\n');
      expect(form.filter((line) => line.startsWith('summary:')), role).toEqual(['summary: "<one line, at most 120 characters>"']);
    }
  }, 240_000);

  it('PIP-017/S12 The tester\'s task tells it to update the tests a changed behaviour replaces', async () => {
    const fx = gitFixture('spec-next-tester-update-tests', {
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/roles/tester.md'), readFileSync(join(REPO, 'roles/tester.md'), 'utf8'));
        writeFileSync(join(dir, 'spec/roles/_shared.md'), readFileSync(join(REPO, 'roles/_shared.md'), 'utf8'));
        const ticket = join(dir, 'tickets/PROP-201.md');
        const history = [
          '  - { at: "2026-10-28T10:00:00.000Z", role: spec-writer, result: done, summary: x, verdict: null, assumed: [] }',
          '  - { at: "2026-10-28T10:05:00.000Z", role: spec-review, result: done, summary: x, verdict: approve, assumed: [] }',
        ];
        writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string };
    worktrees.push({ fx, path: entry.worktree });
    expect(entry).toMatchObject({ action: 'delegate', role: 'tester' });
    // The role prompt is everything before the Working folder block (PIP-017/R1).
    const prompt = entry.task.split('\n## Working folder\n')[0] ?? '';
    expect(prompt).toContain('You are the tester.');
    // For each changed scenario or rule: search the existing tests for the behaviour the change
    // replaces, update them in the same stage, list their scenario IDs under changed, and name under
    // assumed any it could not decide (PIP-017/R9).
    expect(prompt).toMatch(/for each changed scenario or rule/i);
    expect(prompt).toMatch(/search\w* the existing tests for the behaviou?r .{0,30}replaces/i);
    expect(prompt).toMatch(/update\w* [^.]{0,60}tests[^.]{0,60}same stage/i);
    expect(prompt).toMatch(/scenario IDs[^.]{0,40}under `?changed/i);
    expect(prompt).toMatch(/under `?assumed/i);
    expect(prompt).toMatch(/could not decide/i);
  }, 60_000);

  it('PIP-017/S13 The review tasks ask each finding for its class', async () => {
    const SENTENCE = 'Give each finding a class, as class: <class>: C1 neighbours, C2 environment axes, C3 concurrency and ordering, C4 trust boundaries, C5 fail closed, C6 preserved behaviour, C7 tests that cannot fail, C8 external facts, C9 text and docs, or other.';
    const done = (role: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [] }`;
    /** chat-mini whose PROP-201 has run every stage before the reviewer, so the reviewer is next. */
    const reviewReady = (prefix: string, edit?: (dir: string) => void) =>
      gitFixture(prefix, {
        setup: (dir) => {
          const ticket = join(dir, 'tickets/PROP-201.md');
          const history = [done('spec-writer'), done('spec-review', 'approve'), done('tester'), done('implementer')].join('\n');
          writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history}`));
          edit?.(dir);
        },
      });
    const installShipped = (role: string) => (dir: string) => {
      writeFileSync(join(dir, `spec/roles/${role}.md`), readFileSync(join(REPO, `roles/${role}.md`), 'utf8'));
      writeFileSync(join(dir, 'spec/roles/_shared.md'), readFileSync(join(REPO, 'roles/_shared.md'), 'utf8'));
    };
    /** This version's prompt with every line that says "class:" taken out: a prompt an earlier version installed. */
    const withoutClass = (role: string) => (dir: string) => {
      const kept = readFileSync(join(REPO, `roles/${role}.md`), 'utf8').split('\n').filter((line) => !line.includes('class:')).join('\n');
      writeFileSync(join(dir, `spec/roles/${role}.md`), kept);
    };
    const task = async (fx: ReturnType<typeof gitFixture>, id = 'PROP-201') => {
      fixtures.push(fx);
      const out = await fx.spec('', 'next', id, '--format', 'json');
      expect(out.code, out.stderr).toBe(0);
      const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string };
      worktrees.push({ fx, path: entry.worktree });
      return { entry, prompt: entry.task.split('\n## Working folder\n')[0] ?? '' };
    };
    const count = (text: string) => text.split(SENTENCE).length - 1;

    // This version's reviewer prompt asks for the class once.
    const reviewer = await task(reviewReady('spec-next-class-reviewer', installShipped('reviewer')));
    expect(reviewer.entry).toMatchObject({ action: 'delegate', role: 'reviewer' });
    expect(count(reviewer.prompt)).toBe(1);
    expect(count(reviewer.entry.task)).toBe(1);

    // So does this version's spec-review prompt.
    const specReview = await task(specReviewReady('spec-next-class-spec-review', installSpecReview));
    expect(specReview.entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    expect(count(specReview.prompt)).toBe(1);
    expect(count(specReview.entry.task)).toBe(1);

    // A reviewer prompt that says "class:" nowhere gets the sentence as its own last paragraph; the role file stays as it was.
    const oldReviewer = reviewReady('spec-next-class-old-reviewer');
    const reviewerFile = readFileSync(join(oldReviewer.repo, 'spec/roles/reviewer.md'), 'utf8');
    expect(reviewerFile).not.toContain('class:');
    const oldReviewerTask = await task(oldReviewer);
    expect(oldReviewerTask.entry).toMatchObject({ action: 'delegate', role: 'reviewer' });
    expect(oldReviewerTask.prompt.trimEnd().endsWith(`\n\n${SENTENCE}`)).toBe(true);
    expect(count(oldReviewerTask.entry.task)).toBe(1);
    expect(readFileSync(join(oldReviewer.repo, 'spec/roles/reviewer.md'), 'utf8')).toBe(reviewerFile);
    expect(readFileSync(join(oldReviewerTask.entry.worktree, 'spec/roles/reviewer.md'), 'utf8')).toBe(reviewerFile);

    // The same for a spec-review prompt that says "class:" nowhere.
    const oldSpecReview = specReviewReady('spec-next-class-old-spec-review', withoutClass('spec-review'));
    const specReviewFile = readFileSync(join(oldSpecReview.repo, 'spec/roles/spec-review.md'), 'utf8');
    expect(specReviewFile).not.toContain('class:');
    const oldSpecReviewTask = await task(oldSpecReview);
    expect(oldSpecReviewTask.entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    expect(oldSpecReviewTask.prompt.trimEnd().endsWith(`\n\n${SENTENCE}`)).toBe(true);
    expect(count(oldSpecReviewTask.entry.task)).toBe(1);
    expect(readFileSync(join(oldSpecReview.repo, 'spec/roles/spec-review.md'), 'utf8')).toBe(specReviewFile);

    // The task of a spec-writer, tester or implementer stage holds no such sentence.
    const writer = await task(gitFixture('spec-next-class-spec-writer'));
    expect(writer.entry.role).toBe('spec-writer');
    expect(writer.entry.task).not.toContain('Give each finding a class');
    const implementer = await task(gitFixture('spec-next-class-implementer'), 'TASK-101');
    expect(implementer.entry.role).toBe('implementer');
    expect(implementer.entry.task).not.toContain('Give each finding a class');
    const tester = await task(gitFixture('spec-next-class-tester', {
      setup: (dir) => {
        const ticket = join(dir, 'tickets/PROP-201.md');
        const history = [done('spec-writer'), done('spec-review', 'approve')].join('\n');
        writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history}`));
      },
    }));
    expect(tester.entry.role).toBe('tester');
    expect(tester.entry.task).not.toContain('Give each finding a class');
  }, 300_000);

  it('PIP-017/S14 A project\'s own additions follow the shipped role prompt', async () => {
    const SENTENCE = 'Give each finding a class, as class: <class>: C1 neighbours, C2 environment axes, C3 concurrency and ordering, C4 trust boundaries, C5 fail closed, C6 preserved behaviour, C7 tests that cannot fail, C8 external facts, C9 text and docs, or other.';
    const done = (role: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [] }`;
    const withHistory = (dir: string, history: string[]) => {
      const ticket = join(dir, 'tickets/PROP-201.md');
      writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
    };
    /** A project whose tester prompt is this version's, with `local` as its spec/roles/tester.local.md when given. */
    const testerTask = async (prefix: string, local?: (dir: string) => void) => {
      const fx = gitFixture(prefix, {
        setup: (dir) => {
          writeFileSync(join(dir, 'spec/roles/tester.md'), readFileSync(join(REPO, 'roles/tester.md'), 'utf8'));
          writeFileSync(join(dir, 'spec/roles/_shared.md'), readFileSync(join(REPO, 'roles/_shared.md'), 'utf8'));
          withHistory(dir, [done('spec-writer'), done('spec-review', 'approve')]);
          local?.(dir);
        },
      });
      fixtures.push(fx);
      const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
      expect(out.code, out.stderr).toBe(0);
      const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string; blockers?: { text: string }[] };
      worktrees.push({ fx, path: entry.worktree });
      return { fx, entry, prompt: entry.task.split('\n## Working folder\n')[0] ?? '' };
    };

    const plain = await testerTask('spec-next-local-none');
    expect(plain.entry).toMatchObject({ action: 'delegate', role: 'tester' });

    // The shipped prompt, then the two paragraphs of the local file, the CLI path in their commands.
    const localText = 'Follow the patterns of the existing tests.\n\nRun `spec test` before you finish.\n';
    const withLocal = await testerTask('spec-next-local-file', (dir) => {
      writeFileSync(join(dir, 'spec/roles/tester.local.md'), localText);
    });
    expect(withLocal.entry).toMatchObject({ action: 'delegate', role: 'tester' });
    expect(withLocal.prompt.trimEnd()).toBe(`${plain.prompt.trimEnd()}\n\nFollow the patterns of the existing tests.\n\nRun \`.spec/bin/spec test\` before you finish.`);
    expect(withLocal.entry.task).toContain('\n## Working folder\n');
    expect(withLocal.entry.task.match(/```report/g) ?? []).toHaveLength(1);
    expect(withLocal.entry.task).not.toContain('`spec test` before you finish');
    expect(readFileSync(join(withLocal.fx.repo, 'spec/roles/tester.local.md'), 'utf8')).toBe(localText);

    // With no local text, or only blank lines, the task is what it was before the file existed.
    const blank = await testerTask('spec-next-local-blank', (dir) => {
      writeFileSync(join(dir, 'spec/roles/tester.local.md'), '\n  \n\n');
    });
    expect(blank.prompt).toBe(plain.prompt);
    expect(blank.entry.task.match(/```report/g) ?? []).toHaveLength(1);

    // After a paragraph R10 adds: a reviewer prompt that says "class:" nowhere gets the sentence, then the local text.
    const oldReviewer = gitFixture('spec-next-local-after-class', {
      setup: (dir) => {
        withHistory(dir, [done('spec-writer'), done('spec-review', 'approve'), done('tester'), done('implementer')]);
        writeFileSync(join(dir, 'spec/roles/reviewer.local.md'), 'Check the code against DECISIONS.md.\n');
      },
    });
    fixtures.push(oldReviewer);
    expect(readFileSync(join(oldReviewer.repo, 'spec/roles/reviewer.md'), 'utf8')).not.toContain('class:');
    const reviewerOut = await oldReviewer.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(reviewerOut.code, reviewerOut.stderr).toBe(0);
    const reviewerEntry = JSON.parse(reviewerOut.stdout) as { role: string; worktree: string; task: string };
    worktrees.push({ fx: oldReviewer, path: reviewerEntry.worktree });
    expect(reviewerEntry.role).toBe('reviewer');
    const reviewerPrompt = reviewerEntry.task.split('\n## Working folder\n')[0] ?? '';
    expect(reviewerPrompt.trimEnd().endsWith(`\n\n${SENTENCE}\n\nCheck the code against DECISIONS.md.`)).toBe(true);

    // Also when the prompt is the shipped one the spec review falls back to (R8).
    const fallback = specReviewReady('spec-next-local-fallback', (dir) => {
      writeFileSync(join(dir, 'spec/roles/spec-review.local.md'), 'Read DECISIONS.md first.\n');
    });
    fixtures.push(fallback);
    expect(existsSync(join(fallback.repo, 'spec/roles/spec-review.md'))).toBe(false);
    const fallbackOut = await fallback.spec('', 'next', 'PROP-201', '--format', 'json');
    expect(fallbackOut.code, fallbackOut.stderr).toBe(0);
    const fallbackEntry = JSON.parse(fallbackOut.stdout) as { role: string; worktree: string; task: string };
    worktrees.push({ fx: fallback, path: fallbackEntry.worktree });
    expect(fallbackEntry.role).toBe('spec-review');
    expect((fallbackEntry.task.split('\n## Working folder\n')[0] ?? '').trimEnd().endsWith('\n\nRead DECISIONS.md first.')).toBe(true);
    expect(existsSync(join(fallback.repo, 'spec/roles/spec-review.md'))).toBe(false);

    // A local file that exists but cannot be read as a file is an error naming it.
    const unreadable = gitFixture('spec-next-local-unreadable', {
      setup: (dir) => {
        withHistory(dir, [done('spec-writer'), done('spec-review', 'approve')]);
        mkdirSync(join(dir, 'spec/roles/tester.local.md'), { recursive: true });
        writeFileSync(join(dir, 'spec/roles/tester.local.md/keep'), 'x\n');
      },
    });
    fixtures.push(unreadable);
    const bad = await unreadable.spec('', 'next', 'PROP-201', '--format', 'json');
    const badEntry = JSON.parse(bad.stdout) as { action: string; blockers: { text: string }[] };
    expect(badEntry.action).toBe('error');
    expect(badEntry.blockers[0]?.text).toContain('cannot read spec/roles/tester.local.md');
  }, 300_000);

  /** Task of `PROP-201` (or `id`) in `fx`, split at the Working folder block into the role prompt and the whole task. */
  const promptOf = async (fx: ReturnType<typeof gitFixture>, id = 'PROP-201') => {
    fixtures.push(fx);
    const out = await fx.spec('', 'next', id, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { action: string; role: string; worktree: string; task: string };
    worktrees.push({ fx, path: entry.worktree });
    return { entry, prompt: entry.task.split('\n## Working folder\n')[0] ?? '' };
  };
  const doneStage = (role: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [] }`;
  const installShippedRole = (dir: string, role: string) => {
    writeFileSync(join(dir, `spec/roles/${role}.md`), readFileSync(join(REPO, `roles/${role}.md`), 'utf8'));
    writeFileSync(join(dir, 'spec/roles/_shared.md'), readFileSync(join(REPO, 'roles/_shared.md'), 'utf8'));
  };
  const withStages = (dir: string, history: string[]) => {
    const ticket = join(dir, 'tickets/PROP-201.md');
    writeFileSync(ticket, readFileSync(ticket, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
  };
  /** Wording the computed-value rules (PIP-017/R12, R13) put in a prompt; no older prompt holds any of it. */
  const computedValueWording = [/by hand/i, /non-trivial logic/i, /recompute/i, /Givens/];

  it('PIP-017/S15 The spec-writer\'s task prefers properties to computed values', async () => {
    const { entry, prompt } = await promptOf(gitFixture('spec-next-computed-spec-writer', { setup: (dir) => { installShippedRole(dir, 'spec-writer'); } }));
    expect(entry).toMatchObject({ action: 'delegate', role: 'spec-writer' });
    // What it can derive by hand (an order, a membership, a count) is a property, not a pinned computed value (R12).
    expect(prompt).toMatch(/derive\w* by hand/i);
    expect(prompt).toMatch(/\border\b/i);
    expect(prompt).toMatch(/\bmembership\b/i);
    expect(prompt).toMatch(/\bcount\b/i);
    expect(prompt).toMatch(/\bas a property\b|\bproperty\b[^.]{0,80}\b(?:rather|not|instead)\b|\b(?:rather|not|instead)\b[^.]{0,80}\bproperty\b/i);
    expect(prompt).toMatch(/non-trivial logic/i);
    // A value it does pin is worked out from the scenario's Givens, by running the current build when it can (R12).
    expect(prompt).toMatch(/Givens[^.]{0,200}current build|current build[^.]{0,200}Givens/i);
    expect(prompt).toMatch(/work\w* (?:it|them|the value|that value|the pinned value)? ?out/i);
    // A value it could not work out is named under assumed (R12).
    expect(prompt).toMatch(/under `?assumed`?[^.]{0,120}could not work out|could not work out[^.]{0,120}under `?assumed/i);
    // The instruction is in the task once (R12).
    // The brief the task embeds may say "by hand" too, so count in the role prompt only.
    expect(prompt.match(/by hand/gi) ?? []).toHaveLength(1);
    expect(prompt.match(/non-trivial logic/gi) ?? []).toHaveLength(1);
  }, 60_000);

  it('PIP-017/S16 The spec review recomputes the values a scenario pins', async () => {
    const { entry, prompt } = await promptOf(specReviewReady('spec-next-computed-spec-review', (dir) => { installShippedRole(dir, 'spec-review'); }));
    expect(entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    // Recompute each pinned value that non-trivial logic computes, from the scenario's Givens, and compare it (R13).
    expect(prompt).toMatch(/recompute[^.]{0,200}non-trivial logic|non-trivial logic[^.]{0,200}recompute/i);
    expect(prompt).toMatch(/Givens/);
    expect(prompt).toMatch(/compare\w*[^.]{0,80}pinned value|pinned value[^.]{0,80}compare/i);
    // A value that does not match is a reason for verdict changes, with a finding that cites the scenario and carries a class (R10, R13).
    expect(prompt).toMatch(/(?:does not match|do not match|mismatch)[^.]{0,200}\bchanges\b|\bchanges\b[^.]{0,200}(?:does not match|do not match|mismatch)/i);
    expect(prompt).toMatch(/(?:does not match|do not match|mismatch)[^.]{0,300}\bcites?\b|\bcites?\b[^.]{0,300}(?:does not match|do not match|mismatch)/i);
    expect(prompt).toMatch(/(?:does not match|do not match|mismatch)[^.]{0,300}\bclass\b|\bclass\b[^.]{0,300}(?:does not match|do not match|mismatch)/i);
    // A value it could not recompute goes in a finding whose text starts "Follow-up:" (R13).
    expect(prompt).toMatch(/could not recompute[^.]{0,200}Follow-up:|Follow-up:[^.]{0,200}could not recompute/i);
    // A value it can derive by hand, or a property such as an order or a count, needs no recomputation (R13).
    expect(prompt).toMatch(/by hand[^.]{0,200}\bproperty\b|\bproperty\b[^.]{0,200}by hand/i);
    expect(prompt).toMatch(/no recomputation|need(?:s)? no (?:re)?comput|not (?:need|require)[^.]{0,40}recomput/i);
    // The instruction is in the task once (R13).
    // The brief the task embeds may say "by hand" too, so count in the role prompt only.
    expect(prompt.match(/non-trivial logic/gi) ?? []).toHaveLength(1);
    expect(prompt.match(/by hand/gi) ?? []).toHaveLength(1);
  }, 60_000);

  it('PIP-017/S17 A project\'s older prompts are not extended with the computed-value rules', async () => {
    const lacksRules = (text: string) => !computedValueWording.some((word) => word.test(text));
    const without = (role: string) => (dir: string) => {
      const kept = readFileSync(join(REPO, `roles/${role}.md`), 'utf8').split('\n').filter((line) => lacksRules(line)).join('\n');
      writeFileSync(join(dir, `spec/roles/${role}.md`), kept);
    };

    // A spec-writer prompt an earlier version installed: the fixture's own, which says nothing about pinned values.
    const oldWriter = gitFixture('spec-next-computed-old-spec-writer');
    const writerFile = readFileSync(join(oldWriter.repo, 'spec/roles/spec-writer.md'), 'utf8');
    expect(lacksRules(writerFile)).toBe(true);
    const writer = await promptOf(oldWriter);
    expect(writer.entry).toMatchObject({ action: 'delegate', role: 'spec-writer' });
    for (const word of computedValueWording) expect(writer.prompt, String(word)).not.toMatch(word);
    expect(writer.prompt).toContain("Work through every item of the brief's case checklist before finishing"); // only what R6 adds
    expect(readFileSync(join(oldWriter.repo, 'spec/roles/spec-writer.md'), 'utf8')).toBe(writerFile);
    expect(readFileSync(join(writer.entry.worktree, 'spec/roles/spec-writer.md'), 'utf8')).toBe(writerFile);

    // A current spec-writer prompt with the computed-value lines taken out is just as old.
    const strippedWriter = gitFixture('spec-next-computed-stripped-spec-writer', { setup: (dir) => { installShippedRole(dir, 'spec-writer'); without('spec-writer')(dir); } });
    const strippedWriterFile = readFileSync(join(strippedWriter.repo, 'spec/roles/spec-writer.md'), 'utf8');
    expect(lacksRules(strippedWriterFile)).toBe(true);
    const stripped = await promptOf(strippedWriter);
    for (const word of computedValueWording) expect(stripped.prompt, String(word)).not.toMatch(word);
    expect(readFileSync(join(stripped.entry.worktree, 'spec/roles/spec-writer.md'), 'utf8')).toBe(strippedWriterFile);

    // The same for a spec-review prompt with the lines taken out.
    const oldReview = specReviewReady('spec-next-computed-old-spec-review', (dir) => { installShippedRole(dir, 'spec-review'); without('spec-review')(dir); });
    const reviewFile = readFileSync(join(oldReview.repo, 'spec/roles/spec-review.md'), 'utf8');
    expect(lacksRules(reviewFile)).toBe(true);
    const review = await promptOf(oldReview);
    expect(review.entry).toMatchObject({ action: 'delegate', role: 'spec-review' });
    for (const word of computedValueWording) expect(review.prompt, String(word)).not.toMatch(word);
    expect(readFileSync(join(oldReview.repo, 'spec/roles/spec-review.md'), 'utf8')).toBe(reviewFile);
    expect(readFileSync(join(review.entry.worktree, 'spec/roles/spec-review.md'), 'utf8')).toBe(reviewFile);

    // This version's tester, implementer and reviewer prompts hold neither set of sentences.
    const other: [string, string[]][] = [
      ['tester', [doneStage('spec-writer'), doneStage('spec-review', 'approve')]],
      ['implementer', [doneStage('spec-writer'), doneStage('spec-review', 'approve'), doneStage('tester')]],
      ['reviewer', [doneStage('spec-writer'), doneStage('spec-review', 'approve'), doneStage('tester'), doneStage('implementer')]],
    ];
    for (const [role, history] of other) {
      const result = await promptOf(gitFixture(`spec-next-computed-${role}`, { setup: (dir) => { installShippedRole(dir, role); withStages(dir, history); } }));
      expect(result.entry, role).toMatchObject({ action: 'delegate', role });
      for (const word of computedValueWording) expect(result.prompt, `${role} ${String(word)}`).not.toMatch(word);
    }
  }, 300_000);

  it('PIP-017/S18 Every stage\'s task says to change files with the edit tools', async () => {
    const SENTENCE = "Change files only with your edit tools, never through the shell: no output redirection, heredoc, tee, sed -i or perl -pi into a file. Shell writes skip spec's checks and leave no diff in the session.";
    const count = (text: string) => text.split(SENTENCE).length - 1;
    const writer = doneStage('spec-writer');
    const review = doneStage('spec-review', 'approve');
    const stages: [string, string[]][] = [
      ['spec-writer', []],
      ['spec-review', [writer]],
      ['tester', [writer, review]],
      ['implementer', [writer, review, doneStage('tester')]],
      ['reviewer', [writer, review, doneStage('tester'), doneStage('implementer')]],
    ];
    const history = (dir: string, done: string[]) => { if (done.length > 0) withStages(dir, done); };
    /** This version's prompt for `role` with every line that says "never through the shell" taken out: a prompt an earlier version installed. */
    const withoutSentence = (dir: string, role: string) => {
      for (const file of [role, '_shared']) {
        const kept = readFileSync(join(REPO, `roles/${file}.md`), 'utf8').split('\n').filter((line) => !line.includes('never through the shell')).join('\n');
        writeFileSync(join(dir, `spec/roles/${file}.md`), kept);
      }
    };

    // This version's prompt for each role holds the sentence exactly once, in the role prompt.
    for (const [role, done] of stages) {
      const result = await promptOf(gitFixture(`spec-next-edit-tools-${role}`, { setup: (dir) => { installShippedRole(dir, role); history(dir, done); } }));
      expect(result.entry, role).toMatchObject({ action: 'delegate', role });
      expect(count(result.prompt), role).toBe(1);
    }

    // A project's prompt that predates the rule gets nothing added for it, and its role file stays as it was.
    for (const [role, done] of stages) {
      const old = gitFixture(`spec-next-edit-tools-old-${role}`, { setup: (dir) => { withoutSentence(dir, role); history(dir, done); } });
      const roleFile = readFileSync(join(old.repo, `spec/roles/${role}.md`), 'utf8');
      expect(roleFile, role).not.toContain('never through the shell');
      const result = await promptOf(old);
      expect(result.entry, role).toMatchObject({ action: 'delegate', role });
      expect(result.prompt, role).not.toMatch(/edit tools|never through the shell/i);
      expect(count(result.entry.task), role).toBe(0);
      expect(readFileSync(join(old.repo, `spec/roles/${role}.md`), 'utf8'), role).toBe(roleFile);
      expect(readFileSync(join(result.entry.worktree, `spec/roles/${role}.md`), 'utf8'), role).toBe(roleFile);
    }
  }, 300_000);

  describe('PIP-017 delegated task', () => {
    type Entry = { ticket: string; action: string; role: string; worktree: string; branch: string; model: string | null; advance: string; task: string };
    let fixture: ReturnType<typeof gitFixture>;
    let entry: Entry;
    let preview: string;
    let brief: string;
    beforeAll(async () => {
      fixture = gitFixture('spec-next-pip017-scenarios', {
        setup: (dir) => {
          const path = join(dir, 'spec/config.json');
          const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
          const budgets = (config.budgets ?? {}) as Record<string, number>;
          writeFileSync(path, `${JSON.stringify({ ...config, budgets: { ...budgets, 'brief.implementer': 300 } }, null, 2)}\n`);
        },
      });
      fixtures.push(fixture);
      const planned = await fixture.spec('', 'next');
      preview = planned.stdout;
      const out = await invoke(fixture, {}, 'next', 'TASK-101', '--format', 'json');
      if (out.code !== 0) throw new Error(out.stderr);
      entry = JSON.parse(out.stdout) as Entry;
      worktrees.push({ fx: fixture, path: entry.worktree });
      const briefOut = await run({ argv: ['brief', 'implementer', 'TASK-101', '--root', join(entry.worktree, 'spec')], env: {}, cwd: entry.worktree, scriptPath: undefined });
      brief = briefOut.stdout.trimEnd();
    }, 120_000);

    it('PIP-017/S1 The delegated task includes its role prompt and report form', () => {
      expect(entry).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer', branch: 'ticket/TASK-101', model: null });
      expect(entry.task).toContain('You are the implementer.');
      expect(entry.task).toContain(brief);
      expect(entry.task).toContain('## Report block');
      expect(entry.task).toContain('role: implementer\nticket: TASK-101');
    });

    it('PIP-017/S2 The worktree and CLI path are explicit', () => {
      const block = folderBlock(entry.task);
      expect(isAbsolute(entry.worktree)).toBe(true);
      expect(block).toContain('Absolute worktree: ' + entry.worktree);
      expect(block).toMatch(/work only (inside|in) /i);
      expect(block).toMatch(/absolute paths/i);
      // Each shell command starts in the project root, a cd does not carry over, so the subagent never runs cd.
      expect(block).toMatch(/project root/i);
      expect(block).toMatch(/carr(y|ies) over/i);
      expectNoCd(entry.task);
      // The CLI is the project-root-relative one with --root, never an absolute CLI inside the worktree.
      expect(taskRoot(entry.task, '.spec/bin/spec')).toBe(join(entry.worktree, 'spec'));
      expect(entry.task).not.toContain(join(entry.worktree, '.spec/bin/spec'));
      // Tests run through the CLI's test and the subagent never commits.
      expect(block).toMatch(/\btest\b/);
      expect(block).toMatch(/never commits?/i);
      // Git state is read as `git -C <worktree>` with status, diff or log.
      expect(block).toContain(`git -C ${entry.worktree}`);
      expect(block).toMatch(/\bstatus\b/);
      expect(block).toMatch(/\bdiff\b/);
      expect(block).toMatch(/\blog\b/);
      // Any other project command gets the worktree through its own option or path argument, after its allow rule's words.
      expect(block).toMatch(/directory option/i);
      expect(block).toMatch(/path argument/i);
      expect(block).toMatch(/allow rule/i);
    });

    it('PIP-017/S3 The task uses the existing brief budget', () => {
      const inlineBrief = entry.task.split('## Brief\n')[1]?.split('\n\n## Report block')[0] ?? '';
      expect(brief).toContain('> Warning: this brief is about');
      expect(inlineBrief.trimEnd()).toBe(brief);
    });

    it('PIP-017/S4 One path function supplies the CLI path', () => {
      const prompt = entry.task.split('\n## Working folder\n')[0] ?? '';
      expect(prompt).toMatch(/`\.spec\/bin\/spec (--root \S+ )?test`/);
      expect(prompt).not.toContain('`spec test`');
      expect(entry.task).toContain('CLI: .spec/bin/spec');
    });

    it('PIP-017/S5 The inlined brief and report appear only once', () => {
      expect(entry.task).toContain('Your brief is below; do not run brief again');
      expect(entry.task).not.toContain('If your first message has no brief');
      expect((entry.task.match(/```report/g) ?? [])).toHaveLength(1);
      expect(entry.task).toContain('End your final message with exactly one report block, as shown under Report block below.');
    });

    it('PIP-017/S6 The main session advance command stays outside the task', async () => {
      // The command is the relative advance with an absolute report file directly in the worktree parent, outside every worktree.
      const path = advanceReportPath(entry, '.spec/bin/spec');
      const header = [...preview.matchAll(/^advance: `([^`\n]*)`$/gm)].map((m) => m[1] ?? '').find((line) => line.includes('advance TASK-101 ')) ?? '';
      expect(header.startsWith('.spec/bin/spec ticket advance TASK-101 --report-file '), `header: ${header}`).toBe(true);
      expect(header).not.toContain('<path>');
      expect(entry.task).not.toContain('ticket advance');
      expect(entry.task).not.toContain(entry.advance);
      // The Working folder block names that same report file as the file to save the final report to, and says the main session records the stage (R16).
      const block = folderBlock(entry.task);
      const reportLine = block.split('\n').find((line) => line.includes(path)) ?? '';
      expect(reportLine, `the Working folder block names ${path}`).not.toBe('');
      expect(reportLine).toMatch(/\bsave\w*\b[^\n]*final report|final report[^\n]*\bsave/i);
      expect(block).toMatch(/main session[^\n]*\brecords?\b[^\n]*stage/i);
      // Running it, with the report written there, records the report into the ticket worktree.
      expect(path).not.toBe('');
      await advanceFromRoot(fixture, entry, '.spec/bin/spec');
    });
  });

  it('CLI-007/S14 The main session advances from the project root through the relative CLI', async () => {
    const fx = gitFixture('spec-next-relative-cli');
    fixtures.push(fx);
    const entry = await delegateEntry(fx, 'TASK-101');
    expect(entry).not.toHaveProperty('advanceRelative');
    expect(entry).not.toHaveProperty('cwd');
    // The task's CLI is `.spec/bin/spec --root <spec root in the worktree>`, run from the project root without cd.
    expectNoCd(entry.task);
    expect(taskRoot(entry.task, '.spec/bin/spec')).toBe(join(entry.worktree, 'spec'));
    // The advance command carries the absolute report path; run from the project root it records into the worktree.
    await advanceFromRoot(fx, entry, '.spec/bin/spec');
  }, 60_000);

  it('INS-014/S16 A pointer-layout project uses its local CLI until upgrade', async () => {
    const fx = pointerFixture('spec-next-pointer');
    fixtures.push(fx);

    expect(existsSync(join(fx.repo, '.claude/agents/implementer.md'))).toBe(false);

    const first = await delegateEntry(fx, 'TASK-101');
    expect(first).not.toHaveProperty('advanceRelative');
    expect(first).not.toHaveProperty('cwd');
    advanceReportPath(first, LAUNCHER);
    expect(taskRoot(first.task, LAUNCHER)).toBe(join(first.worktree, 'spec'));
    expect(folderBlock(first.task)).not.toContain('.spec/bin/spec');
    // Only the .spec/bin/spec form matches the allow rule Bash(.spec/bin/spec *).
    expect(first.advance.startsWith('.spec/bin/spec ')).toBe(false);

    const upgraded = await invoke(fx, {}, 'upgrade', '--from', join(REPO, 'plugin/scripts'));
    expect(upgraded.code, upgraded.stderr).toBe(0);
    expect(existsSync(join(fx.repo, '.spec/bin/spec.cjs'))).toBe(true);
    expect(existsSync(join(fx.repo, '.claude/agents/implementer.md'))).toBe(false);

    // TASK-101's stage is already running, so a second ready ticket stands in for "next, after the upgrade".
    const second = await delegateEntry(fx, 'TASK-102');
    expect(second).not.toHaveProperty('advanceRelative');
    expect(second).not.toHaveProperty('cwd');
    advanceReportPath(second, '.spec/bin/spec');
    expect(taskRoot(second.task, '.spec/bin/spec')).toBe(join(second.worktree, 'spec'));
    expectNoCd(second.task);
  }, 120_000);

  it('PIP-017/S19 A stage\'s commands and report file fit the permissions setup already grants', async () => {
    // A project with .spec/bin/spec.cjs, whose folder path holds a space, and a local role file with a spec command.
    const fx = gitFixture('spec next s19 ', {
      setup: (dir) => {
        writeFileSync(join(dir, 'spec/roles/implementer.local.md'), 'Run `spec test` before you finish.\n');
      },
    });
    fixtures.push(fx);
    expect(existsSync(join(fx.repo, '.spec/bin/spec.cjs'))).toBe(true);
    expect(fx.repo).toContain(' ');
    const upgraded = await invoke(fx, {}, 'upgrade', '--from', join(REPO, 'plugin/scripts'));
    expect(upgraded.code, upgraded.stderr).toBe(0);

    const entry = await delegateEntry(fx, 'TASK-101');
    // Every CLI command in the role prompt, the local role file's text and the Working folder block starts with ".spec/bin/spec ".
    const beforeBrief = entry.task.split('\n## Brief\n')[0] ?? '';
    const commands = [...beforeBrief.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '').filter((span) => /^(?:\S*\/)?spec\s+\S/.test(span));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.filter((command) => !command.startsWith('.spec/bin/spec ')), 'commands not starting with ".spec/bin/spec "').toEqual([]);
    expect(beforeBrief).toContain('`.spec/bin/spec test` before you finish');
    const bare = beforeBrief.match(/[^\s`'"]*spec --root /g) ?? [];
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.filter((command) => command !== '.spec/bin/spec --root ')).toEqual([]);
    // The --root value is quoted, so the shell reads the path with its space as one argument; the task holds no cd command.
    expect(entry.worktree).toContain(' ');
    expect(taskRoot(entry.task, '.spec/bin/spec')).toBe(join(entry.worktree, 'spec'));
    expectNoCd(entry.task);
    // cli.Next.advance starts with the ticket advance command; its quoted report path lies in a folder the personal settings list.
    expect(entry.advance.startsWith('.spec/bin/spec ticket advance TASK-101 --report-file ')).toBe(true);
    const reportPath = advanceReportPath(entry, '.spec/bin/spec');
    expect(reportPath).toContain(' ');
    const settingsPath = join(fx.repo, '.claude/settings.local.json');
    expect(existsSync(settingsPath), '.claude/settings.local.json exists').toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { permissions?: { additionalDirectories?: string[] } };
    const listed = (settings.permissions?.additionalDirectories ?? []).map((dir) => realPath(resolve(fx.repo, dir)));
    expect(listed).toContain(realPath(dirname(reportPath)));
  }, 120_000);

  it('PIP-017/S20 A pointer-layout project gets its own launcher in the same form until it upgrades', async () => {
    const fx = pointerFixture('spec-next-pointer-launcher');
    fixtures.push(fx);
    expect(existsSync(join(fx.repo, '.spec/bin/spec.cjs'))).toBe(false);
    expect(existsSync(join(fx.repo, LAUNCHER))).toBe(true);

    const before = await delegateEntry(fx, 'TASK-101');
    expect(taskRoot(before.task, LAUNCHER)).toBe(join(before.worktree, 'spec'));
    expectNoCd(before.task);
    expect(before.advance.startsWith(`${LAUNCHER} ticket advance TASK-101 --report-file `)).toBe(true);
    advanceReportPath(before, LAUNCHER);

    const upgraded = await invoke(fx, {}, 'upgrade', '--from', join(REPO, 'plugin/scripts'));
    expect(upgraded.code, upgraded.stderr).toBe(0);
    expect(existsSync(join(fx.repo, '.spec/bin/spec.cjs'))).toBe(true);

    // The first call already started TASK-101's stage (CLI-007/R4), so the post-upgrade check uses its own ready ticket.
    const after = await delegateEntry(fx, 'TASK-102');
    expect(taskRoot(after.task, '.spec/bin/spec')).toBe(join(after.worktree, 'spec'));
    expectNoCd(after.task);
    expect(after.advance.startsWith('.spec/bin/spec ticket advance TASK-102 --report-file ')).toBe(true);
    advanceReportPath(after, '.spec/bin/spec');
  }, 120_000);

  it('PIP-017/S21 Every stage\'s task says to save the final report and check it before finishing', async () => {
    const writer = doneStage('spec-writer');
    const review = doneStage('spec-review', 'approve');
    const stages: [string, string[]][] = [
      ['spec-writer', []],
      ['spec-review', [writer]],
      ['tester', [writer, review]],
      ['implementer', [writer, review, doneStage('tester')]],
      ['reviewer', [writer, review, doneStage('tester'), doneStage('implementer')]],
    ];
    const history = (dir: string, done: string[]) => { if (done.length > 0) withStages(dir, done); };
    /** This version's prompt for `role` with every line about the report check taken out: a prompt an earlier version installed. */
    const withoutCheck = (dir: string, role: string) => {
      for (const file of [role, '_shared']) {
        const kept = readFileSync(join(REPO, `roles/${file}.md`), 'utf8').split('\n').filter((line) => !/report ok|check-report/.test(line)).join('\n');
        writeFileSync(join(dir, `spec/roles/${file}.md`), kept);
      }
    };
    const taskOf = async (fx: ReturnType<typeof gitFixture>, role: string) => {
      fixtures.push(fx);
      const out = await fx.spec('', 'next', 'PROP-201', '--format', 'json');
      expect(out.code, `${role}: ${out.stderr}`).toBe(0);
      const entry = JSON.parse(out.stdout) as Delegate;
      worktrees.push({ fx, path: entry.worktree });
      expect(entry, role).toMatchObject({ action: 'delegate', role });
      return { entry, prompt: entry.task.split('\n## Working folder\n')[0] ?? '', block: folderBlock(entry.task), reportPath: advanceReportPath(entry, '.spec/bin/spec') };
    };

    for (const [role, done] of stages) {
      const { entry, prompt, block, reportPath } = await taskOf(gitFixture(`spec-next-save-report-${role}`, { setup: (dir) => { installShippedRole(dir, role); history(dir, done); } }), role);
      // The Working folder block names the report file as the one file outside the worktree a stage may write (R2, R17).
      const reportLine = block.split('\n').find((line) => line.includes(reportPath)) ?? '';
      expect(reportLine, `${role}: the Working folder block names ${reportPath}`).not.toBe('');
      expect(reportLine, role).toMatch(/\b(?:one|only) file\b/i);
      expect(reportLine, role).toMatch(/outside/i);
      // The role prompt says once: save the final report to that file, run check-report until "report ok", then end with the report block (R17).
      const lines = prompt.split('\n').filter((line) => line.includes('report ok'));
      expect(lines, `${role}: the prompt says "report ok" exactly once`).toHaveLength(1);
      const line = lines[0] ?? '';
      expect(line, role).toMatch(/\bsave\w*\b[^\n]*final report[^\n]*report file/i);
      expect(line, role).toMatch(/Working folder/);
      expect(line, role).toMatch(/\buntil\b[^\n]*report ok/i);
      expect(line, role).toMatch(/report ok[^\n]*report block/i);
      expect(line.search(/save/i), role).toBeLessThan(line.search(/report ok/));
      expect(prompt.match(/check-report/g) ?? [], role).toHaveLength(1);
      // The check-report command is written with the project CLI path, for that role and ticket (S4, R2, R15).
      const command = (/`([^`\n]*check-report[^`\n]*)`/.exec(line)?.[1] ?? '').trim();
      const parts = /^\.spec\/bin\/spec (?:--root \S+ )?check-report (\S+) (\S+)/.exec(command);
      expect(parts, `${role}: check-report command "${command}"`).not.toBeNull();
      expect(parts?.[1], role).toBe(role);
      expect(parts?.[2], role).toBe('PROP-201');
      // The task never mentions ticket advance and holds no advance command (R16).
      expect(entry.task, role).not.toContain('ticket advance');
      expect(entry.task, role).not.toContain(entry.advance);
      // The reviewers, which change no file, may save that report file and no other (R2, R17).
      if (role === 'reviewer' || role === 'spec-review') {
        expect(prompt, role).toMatch(/(?:no file|any file|other file)[^\n]*(?:but|except|other than|besides)[^\n]*report file/i);
        expect(prompt, role).not.toMatch(/Never edit any file\./);
      }
    }

    // A project's prompt that predates the rule gets nothing added for it; the block still names the report file; its role file stays as it was (R17).
    for (const [role, done] of stages) {
      const old = gitFixture(`spec-next-save-report-old-${role}`, { setup: (dir) => { withoutCheck(dir, role); history(dir, done); } });
      const roleFile = readFileSync(join(old.repo, `spec/roles/${role}.md`), 'utf8');
      expect(roleFile, role).not.toMatch(/report ok|check-report/);
      const { entry, prompt, block, reportPath } = await taskOf(old, role);
      expect(prompt, role).not.toMatch(/report ok|check-report/);
      expect(block, `${role}: the Working folder block still names the report file`).toContain(reportPath);
      expect(readFileSync(join(old.repo, `spec/roles/${role}.md`), 'utf8'), role).toBe(roleFile);
      expect(readFileSync(join(entry.worktree, `spec/roles/${role}.md`), 'utf8'), role).toBe(roleFile);
    }
  }, 600_000);

  it('CLI-007/S2 returns gate questions without starting', async () => {
    const fx = gitFixture('spec-next-waiting');
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'PROP-206', '--format', 'json');
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({
      ticket: 'PROP-206',
      action: 'waiting',
      questions: [{ id: 'Q1' }],
    });
    expect(fx.git('worktree', 'list', '--porcelain').stdout).not.toContain('PROP-206');
  }, 60_000);

  it('INS-014/S26 Gate questions are a normal waiting result from next', async () => {
    const fx = gitFixture('spec-next-skill-waiting');
    fixtures.push(fx);
    const out = await invoke(fx, {}, 'next', 'PROP-206', '--harness', 'claude-code', '--format', 'json');
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({ ticket: 'PROP-206', action: 'waiting', questions: [{ id: 'Q1' }] });
  }, 60_000);

  it('CLI-007/S3 lists the safe plan wave without starting, and --start starts that wave', async () => {
    const fx = gitFixture('spec-next-list');
    fixtures.push(fx);
    const listed = JSON.parse((await fx.spec('', 'next', '--format', 'json')).stdout) as { ticket: string; worktree: string }[];
    expect(listed.some((entry) => entry.ticket === 'TASK-101')).toBe(true);
    expect(fx.git('worktree', 'list', '--porcelain').stdout).not.toContain('TASK-101');

    const single = gitFixture('spec-next-start', {
      setup: (dir) => {
        const tickets = join(dir, 'tickets');
        for (const name of readdirSync(tickets)) {
          if (name === 'TASK-101.md') continue;
          const file = join(tickets, name);
          const source = readFileSync(file, 'utf8');
          writeFileSync(file, source.replace(/^status: (?:open|blocked|in_progress)$/m, 'status: done'));
        }
      },
    });
    fixtures.push(single);
    const started = await single.spec('', 'next', '--start', '--format', 'json');
    expect(started.code, started.stderr).toBe(0);
    const [entry] = JSON.parse(started.stdout) as { ticket: string; action: string; worktree: string }[];
    expect(entry).toMatchObject({ ticket: 'TASK-101', action: 'delegate' });
    if (entry) worktrees.push({ fx: single, path: entry.worktree });
    expect(entry?.worktree).toBe(realPath(join(dirname(single.repo), `${basename(single.repo)}.worktrees`, 'TASK-101')));
  }, 120_000);

  it('CLI-007/S9 respects maxParallel, omits later tickets, and refreshes between starts', async () => {
    const fx = gitFixture('spec-next-max-parallel', {
      setup: (dir) => {
        const configPath = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        config.maxParallel = 2;
        writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
        const tickets = join(dir, 'tickets');
        for (const name of readdirSync(tickets)) {
          if (['TASK-101.md', 'TASK-102.md', 'TASK-103.md'].includes(name)) continue;
          const path = join(tickets, name);
          writeFileSync(path, readFileSync(path, 'utf8').replace(/^status: (?:open|blocked|in_progress)$/m, 'status: done'));
        }
        const one = join(tickets, 'TASK-101.md');
        writeFileSync(one, readFileSync(one, 'utf8').replace('touches: [PRV-001, PRV-002]', 'touches: [CNV-001]'));
        const two = join(tickets, 'TASK-102.md');
        writeFileSync(two, readFileSync(two, 'utf8').replace('touches: [conversation.Message.meta, PRV-002, CNV-002]', 'touches: [CNV-002]\ndepends_on: [TASK-101]'));
        const three = join(tickets, 'TASK-103.md');
        writeFileSync(three, readFileSync(three, 'utf8').replace('touches: [PRV-002]', 'touches: [SET-001]'));
        writeFileSync(join(tickets, 'TASK-104.md'), [
          '---',
          'id: TASK-104',
          'type: task',
          'title: Isolate session configuration',
          'status: open',
          'stage: null',
          'touches: [SET-002]',
          'changed: []',
          'questions: []',
          'history: []',
          'depends_on: []',
          '---',
          'An independent task.',
          '',
        ].join('\n'));
      },
    });
    fixtures.push(fx);
    const listed = JSON.parse((await fx.spec('', 'next', '--format', 'json')).stdout) as { ticket: string }[];
    expect(listed.map((item) => item.ticket)).toEqual(['TASK-101', 'TASK-103']);
    expect(listed.map((item) => item.ticket)).not.toContain('TASK-102');
    expect(listed.map((item) => item.ticket)).not.toContain('TASK-104');
    expect(fx.git('worktree', 'list', '--porcelain').stdout).not.toContain('TASK-101');

    const started = await fx.spec('', 'next', '--start', '--format', 'json');
    expect(started.code, started.stderr).toBe(0);
    const entries = JSON.parse(started.stdout) as { ticket: string; worktree: string }[];
    expect(entries.map((item) => item.ticket)).toEqual(['TASK-101', 'TASK-103']);
    for (const entry of entries) worktrees.push({ fx, path: entry.worktree });
  }, 120_000);

  it('CLI-007/S4 refuses a ticket whose stage is already running', async () => {
    const fx = gitFixture('spec-next-running');
    fixtures.push(fx);
    expect((await fx.spec('', 'ticket', 'start', 'TASK-103', 'implementer')).code).toBe(0);
    const out = await fx.spec('', 'next', 'TASK-103', '--format', 'json');
    expect(out.code).toBe(1);
    const entry = JSON.parse(out.stdout) as { ticket: string; action: string; blockers: { text: string }[] };
    expect(entry).toMatchObject({ ticket: 'TASK-103', action: 'waiting' });
    expect(entry.blockers[0]?.text).toContain('implementer stage running');
  }, 60_000);

  it('CLI-007/S10 Restarts a stage after its delegate stops', async () => {
    const fx = gitFixture('spec-next-restart');
    fixtures.push(fx);
    const started = await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer');
    expect(started.code, started.stderr).toBe(0);
    mkdirSync(join(fx.repo, 'src'), { recursive: true });
    const partial = join(fx.repo, 'src/restart.ts');
    writeFileSync(partial, 'export const partial = true;\\n');

    const refused = await fx.spec('', 'next', 'TASK-101', '--format', 'json');
    expect(refused.code).toBe(1);
    expect(JSON.parse(refused.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'waiting' });

    const restarted = await fx.spec('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    expect(JSON.parse(restarted.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer' });
    expect(readFileSync(partial, 'utf8')).toBe('export const partial = true;\\n');
    expect(fx.git('status', '--porcelain').stdout).toContain('?? src/restart.ts');
    expect(fx.git('stash', 'list').stdout).not.toContain('TASK-101 implementer: blocked');
    expect(fx.ticket('TASK-101')).toMatchObject({ status: 'in_progress', stage: 'implementer' });
  }, 60_000);

  it('CLI-007/S10 Restarts from inside the ticket worktree', async () => {
    const fx = gitFixture('spec-next-restart-inside-worktree');
    fixtures.push(fx);
    const added = await fx.spec('', 'worktree', 'add', 'TASK-101', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const { path, project } = JSON.parse(added.stdout) as { path: string; project: string };
    worktrees.push({ fx, path });
    const at = (stdin: string, ...argv: string[]) => run({
      argv: [...argv, '--root', join(project, 'spec')],
      env: {},
      cwd: project,
      scriptPath: undefined,
      stdin: () => Promise.resolve(stdin),
      now: () => '2026-10-30T12:00:00.000Z',
    });
    expect((await at('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    mkdirSync(join(project, 'src'), { recursive: true });
    const partial = join(project, 'src/restart.ts');
    writeFileSync(partial, 'export const partial = true;\n');

    const restarted = await at('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    expect(JSON.parse(restarted.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer' });
    expect(readFileSync(partial, 'utf8')).toBe('export const partial = true;\n');
  }, 120_000);

  it('CLI-007/S11 Restart drops the kept report and refusal budget', async () => {
    const fx = gitFixture('spec-next-restart-clears-report');
    fixtures.push(fx);
    expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
    const refused = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    const ops: FinishReportOps = {
      current: () => 'TASK-101',
      running: () => 'implementer',
      checkReport: () => ({ ok: false, problems: ['wrong stage role'], report: null }),
      bounce: (ticket) => bumpReportRefusal(fx.repo, ticket, 'implementer'),
      keepRefused: (_role, ticket, message, transcript) => {
        saveReport(fx.repo, ticket, message, transcript);
      },
    };
    for (const attempt of [1, 2, 3]) {
      const result = finishReport('implementer', refused, null, 'TASK-101', ops, true);
      expect(result.attempt).toBe(attempt);
      expect(result.kept).toBe(attempt === 3);
    }
    expect(loadReport(fx.repo, 'TASK-101')).toBe(refused);

    const restarted = await fx.spec('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    expect(loadReport(fx.repo, 'TASK-101')).toBeNull();
    const missing = await fx.spec('', 'ticket', 'advance', 'TASK-101', '--format', 'json');
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('no report for the implementer stage of TASK-101');
    expect(fx.ticket('TASK-101')).toMatchObject({ status: 'in_progress', stage: 'implementer' });

    const nextRefusal = await fx.spec(refused, 'ticket', 'advance', 'TASK-101', '--report', '-', '--format', 'json');
    expect(nextRefusal.code).toBe(1);
    expect(JSON.parse(nextRefusal.stdout)).toMatchObject({ ticket: 'TASK-101', attempt: 1, status: 'in_progress' });
  }, 60_000);

  it('CLI-007/S12 Refuses invalid restart requests without changing ticket state', async () => {
    const fx = gitFixture('spec-next-restart-refusals');
    fixtures.push(fx);
    const noId = await fx.spec('', 'next', '--restart');
    expect(noId.code).toBe(2);
    expect(noId.stderr).toContain('usage: spec next <TICKET> --restart');

    const withStart = await fx.spec('', 'next', 'TASK-101', '--restart', '--start');
    expect(withStart.code).toBe(2);
    expect(withStart.stderr).toContain('usage: spec next <TICKET> --restart');

    const unknown = await fx.spec('', 'next', 'TASK-999', '--restart');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Unknown TASK-999');

    const notRunning = await fx.spec('', 'next', 'TASK-101', '--restart', '--format', 'json');
    expect(notRunning.code).toBe(1);
    const error = JSON.parse(notRunning.stdout) as { ticket: string; action: string; blockers: { text: string }[] };
    expect(error).toMatchObject({ ticket: 'TASK-101', action: 'error' });
    expect(error.blockers[0]?.text).toContain('requires a ticket with an in-progress stage');
    expect(fx.ticket('TASK-101')).toMatchObject({ status: 'open', stage: null });
    expect(fx.git('worktree', 'list', '--porcelain').stdout).not.toContain('TASK-101');
  }, 60_000);

  it('CLI-007/S15 A spec-writer can restart with its uncommitted feature', async () => {
    const fx = gitFixture('spec-next-restart-spec-writer-uncommitted', { setup: prepareScopeGapRestart });
    fixtures.push(fx);
    const added = await fx.spec('', 'worktree', 'add', 'PROP-201', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const { path, project } = JSON.parse(added.stdout) as { path: string; project: string };
    worktrees.push({ fx, path });
    const at = (...argv: string[]) => run({ argv: [...argv, '--root', join(project, 'spec')], env: {}, cwd: project, scriptPath: undefined });
    const started = await at('ticket', 'start', 'PROP-201', 'spec-writer');
    expect(started.code, started.stderr).toBe(0);
    const feature = join(project, 'spec/modules/settings/features/SET-002-manage-api-keys.md');
    writeFileSync(feature, scopeGapFeature);

    const restarted = await fx.spec('', 'next', 'PROP-201', '--restart', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    expect(JSON.parse(restarted.stdout)).toMatchObject({ ticket: 'PROP-201', action: 'delegate', role: 'spec-writer' });
    expect(readFileSync(feature, 'utf8')).toContain('id: SET-002');
  }, 120_000);

  it('CLI-007/S16 A committed base-view scope gap still blocks restart', async () => {
    const fx = gitFixture('spec-next-restart-spec-writer-committed-gap', { setup: prepareScopeGapRestart });
    fixtures.push(fx);
    const added = await fx.spec('', 'worktree', 'add', 'PROP-201', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const { path, project } = JSON.parse(added.stdout) as { path: string; project: string };
    worktrees.push({ fx, path });
    const at = (...argv: string[]) => run({ argv: [...argv, '--root', join(project, 'spec')], env: {}, cwd: project, scriptPath: undefined });
    const started = await at('ticket', 'start', 'PROP-201', 'spec-writer');
    expect(started.code, started.stderr).toBe(0);
    const feature = 'spec/modules/settings/features/SET-002-manage-api-keys.md';
    writeFileSync(join(fx.repo, feature), scopeGapFeature);
    expect(fx.git('add', feature).code).toBe(0);
    expect(fx.git('commit', '-m', 'add unrelated feature').code).toBe(0);

    const restarted = await fx.spec('', 'next', 'PROP-201', '--restart', '--format', 'json');
    expect(restarted.code).toBe(1);
    const entry = JSON.parse(restarted.stdout) as { ticket: string; action: string; blockers: { text: string }[] };
    expect(entry).toMatchObject({ ticket: 'PROP-201', action: 'error' });
    expect(entry.blockers[0]?.text).toContain('is not ready');
    expect(readFileSync(join(project, 'tickets/PROP-201.md'), 'utf8')).toContain('status: in_progress');
  }, 120_000);

  it.each(['claude-sonnet-5-5', 'inherit', 'opus-4'])('CLI-008/S32 Next and the driving skill treat invalid model %s as missing', async (model) => {
    const fx = gitFixture('spec-next-invalid-model-' + model.replace(/[^a-z0-9]+/g, '-'), {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { 'claude-code': { implementer: model } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await invoke(fx, {}, 'next', 'TASK-101', '--harness', 'claude-code', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { model: string | null; missingModels: string[] };
    expect(entry.model).toBeNull();
    expect(entry.missingModels).toContain('implementer');
    for (const command of ['feature', 'change', 'bug', 'run']) {
      expect(readFileSync(join(REPO, 'plugin/skills', command, 'SKILL.md'), 'utf8')).toContain('entry.missingModels');
    }
  }, 60_000);

  it('CLI-007/S17 Delegate entries report missing models for the active harness', async () => {
    const fx = gitFixture('spec-next-missing-models', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'builder' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { model: string | null; missingModels: string[] };
    expect(entry.model).toBe('builder');
    expect(entry.missingModels).toEqual(['spec-writer', 'tester', 'reviewer']);
  }, 60_000);

  it('CLI-007/S5 returns merge until the done branch is merged, then returns done', async () => {
    const pending = gitFixture('spec-next-merge', {
      setup: (dir) => {
        const path = join(dir, 'tickets/TASK-101.md');
        writeFileSync(path, readFileSync(path, 'utf8').replace('status: open', 'status: done'));
      },
    });
    fixtures.push(pending);
    expect(JSON.parse((await pending.spec('', 'next', 'TASK-101', '--format', 'json')).stdout)).toMatchObject({ ticket: 'TASK-101', action: 'merge' });

    const merged = gitFixture('spec-next-done', {
      setup: (dir) => {
        const path = join(dir, 'tickets/TASK-101.md');
        writeFileSync(path, readFileSync(path, 'utf8').replace('status: open', 'status: done'));
      },
    });
    fixtures.push(merged);
    merged.git('branch', 'ticket/TASK-101');
    expect(JSON.parse((await merged.spec('', 'next', 'TASK-101', '--format', 'json')).stdout)).toMatchObject({ ticket: 'TASK-101', action: 'done' });
  }, 60_000);

  it('CLI-007/S7 returns JSON errors for refused report options and a failed start', async () => {
    const fx = gitFixture('spec-next-error');
    fixtures.push(fx);
    const refused = await fx.spec('', 'next', 'TASK-101', '--report', '-', '--format', 'json');
    expect(refused.code).toBe(2);
    const refusedResult = JSON.parse(refused.stdout) as { ticket: string; action: string; blockers: { text: string }[] };
    expect(refusedResult).toMatchObject({ ticket: 'TASK-101', action: 'error' });
    expect(refusedResult.blockers[0]?.text).toContain('does not accept report options');

    const dir = tempDir('spec-next-no-git-');
    dirs.push(dir);
    cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !/\/(node_modules|\.dart_tool)(\/|$)/.test(src) });
    const failed = await run({ argv: ['next', 'TASK-101', '--format', 'json', '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined });
    expect(failed.code).toBe(1);
    const failedResult = JSON.parse(failed.stdout) as { ticket: string; action: string; blockers: { text: string }[] };
    expect(failedResult).toMatchObject({ ticket: 'TASK-101', action: 'error' });
    expect(failedResult.blockers[0]?.text).toContain('not a git repository');
  }, 60_000);

  it('CLI-007/S10 and INS-014/S18 run consumes compact summaries and started tasks', async () => {
    const fx = gitFixture('spec-next-summary');
    fixtures.push(fx);
    const summaryOut = await invoke(fx, {}, 'next', '--summary', '--harness', 'claude-code', '--format', 'json');
    expect(summaryOut.code, summaryOut.stderr).toBe(0);
    const summaries = JSON.parse(summaryOut.stdout) as { ticket: string; action: string; role?: string; worktree?: string; model?: string | null; task?: string }[];
    expect(summaries.length).toBeGreaterThan(0);
    for (const entry of summaries) {
      expect(Object.keys(entry).sort()).toEqual(['action', 'model', 'role', 'ticket', 'worktree']);
      expect(entry.action).toBe('delegate');
      expect(entry.task).toBeUndefined();
    }

    const startedOut = await invoke(fx, {}, 'next', '--start', '--harness', 'claude-code', '--format', 'json');
    expect(startedOut.code, startedOut.stderr).toBe(0);
    const started = JSON.parse(startedOut.stdout) as { ticket: string; action: string; worktree: string; task?: string }[];
    expect(started.length).toBeGreaterThan(0);
    for (const entry of started) {
      worktrees.push({ fx, path: entry.worktree });
      expect(entry.action).toBe('delegate');
      expect(entry.task).toContain('## Brief');
    }

    const skill = readFileSync(join(REPO, 'plugin/skills/run/SKILL.md'), 'utf8');
    expect(skill).toContain('next --summary');
    expect(skill).toContain('next --start');
    expect(skill).toContain('Use the started entries directly');
    expect(skill.indexOf('run `.spec/bin/spec next <ID> --harness')).toBeGreaterThan(skill.indexOf('## Driving a ticket'));
  }, 120_000);

  it('CLI-007/S8 An unset model tells the main session to choose one', async () => {
    const fx = gitFixture('spec-next-unset-model');
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'TASK-101');
    expect(out.stdout).toContain('model: (not set — choose one for implementer)');
  }, 60_000);

  it('CLI-007/S13 A summary lists safe work without the task or brief', async () => {
    const fx = gitFixture('spec-next-summary-only');
    fixtures.push(fx);
    const out = await invoke(fx, {}, 'next', '--summary', '--harness', 'claude-code', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const summaries = JSON.parse(out.stdout) as Record<string, unknown>[];
    expect(summaries.length).toBeGreaterThan(0);
    for (const entry of summaries) {
      expect(Object.keys(entry).sort()).toEqual(['action', 'model', 'role', 'ticket', 'worktree']);
      expect(entry.task).toBeUndefined();
      expect(entry.brief).toBeUndefined();
    }
    expect(summaries.map((entry) => entry.ticket)).toContain('TASK-101');
  }, 60_000);

  it('CLI-008/S18 A next entry lists missing models for its active harness', async () => {
    const fx = gitFixture('spec-next-missing-astro', {
      setup: (dir) => {
        const path = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'builder' } };
        writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
      },
    });
    fixtures.push(fx);
    const out = await fx.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { worktree: string; missingModels: string[] };
    worktrees.push({ fx, path: entry.worktree });
    expect(entry.missingModels).toEqual(expect.arrayContaining(['spec-writer', 'tester', 'reviewer']));
    expect(entry.missingModels).not.toContain('implementer');
  }, 60_000);

  it('INS-014/S18 Run lists compact summaries and delegates started entries', () => {
    const skill = readFileSync(join(REPO, 'plugin/skills/run/SKILL.md'), 'utf8');
    expect(skill).toContain('spec next --summary');
    // Where it relays (INS-020/R13) it starts the wave with --start and delegates the started entries directly.
    expect(skill).toContain('next --start');
    expect(skill).toContain('Use the started entries directly');
    expect(skill).toContain('unknown hook event before-agent');
    // On Claude Code with the hooks it sends stage requests instead.
    expect(skill).toContain('spec:<ID>');
  });

  it('INS-014/S19 A stage returned by --start is already running, not a user question', () => {
    const skill = readFileSync(join(REPO, 'plugin/skills/run/SKILL.md'), 'utf8');
    expect(skill).toContain('already running');
    expect(skill).toContain('do not ask the user or query next before delegation');
  });

  it('CLI-007/S6 and FMT-015/S2 select the harness and its chosen model', async () => {
    expect(detectHarness(null, { SPEC_HARNESS: 'configured', CLAUDECODE: '1' })).toBe('configured');
    expect(detectHarness(null, { CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'astro' })).toBe('astro');
    expect(detectHarness(null, { CLAUDE_CODE_ENTRYPOINT: 'astro' })).toBe('astro');
    expect(detectHarness(null, { ASTRO_RUN_ID: 'run-1', CLAUDECODE: '1' })).toBe('astro');
    expect(detectHarness(null, { SHELL_PROMPT: 'astro' })).toBeNull();
    expect(detectHarness(null, { ASTRO_HOOK: '1' })).toBe('astro');
    expect(detectHarness(null, { CLAUDECODE: '1' })).toBe('claude-code');
    expect(detectHarness('explicit', { SPEC_HARNESS: 'configured' })).toBe('explicit');
    const fx = gitFixture('spec-next-model', {
      setup: (dir) => {
        const file = join(dir, 'spec/config.json');
        const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        config.delegation = { astro: { implementer: 'opus' }, 'claude-code': { implementer: 'sonnet' } };
        writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
      },
    });
    fixtures.push(fx);
    const out = await invoke(fx, { SPEC_HARNESS: 'claude-code', CLAUDECODE: '1' }, 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const entry = JSON.parse(out.stdout) as { model: string; worktree: string };
    worktrees.push({ fx, path: entry.worktree });
    expect(entry.model).toBe('opus');
  }, 60_000);

  it('CLI-007/S18 A started stage remembers the model next chose for it', async () => {
    const fx = gitFixture('spec-next-model-s18', {
      setup: configureOnly(['TASK-101', 'BUG-301'], {
        astro: { implementer: 'claude-sonnet-5-5', tester: 'claude-opus-5-5' },
      }),
    });
    fixtures.push(fx);

    const listedOut = await fx.spec('', 'next', '--harness', 'astro', '--format', 'json');
    expect(listedOut.code, listedOut.stderr).toBe(0);
    const listed = JSON.parse(listedOut.stdout) as { ticket: string }[];
    expect(listed.map((entry) => entry.ticket)).toEqual(['BUG-301', 'TASK-101']);
    expect(existsSync(stageRecordFile(fx, 'BUG-301'))).toBe(false);
    expect(existsSync(stageRecordFile(fx, 'TASK-101'))).toBe(false);

    const started = await fx.spec('', 'next', '--start', '--harness', 'astro', '--format', 'json');
    expect(started.code, started.stderr).toBe(0);
    const entries = JSON.parse(started.stdout) as {
      ticket: string; action: string; role?: string; worktree?: string; model?: string | null;
      advance?: string; task?: string; blockers?: { text: string }[];
    }[];
    const task = entries.find((entry) => entry.ticket === 'TASK-101');
    const bug = entries.find((entry) => entry.ticket === 'BUG-301');
    expect(task).toMatchObject({ action: 'delegate', role: 'implementer', model: 'claude-sonnet-5-5' });
    expect(bug).toMatchObject({ action: 'delegate', role: 'tester', model: 'claude-opus-5-5' });
    for (const entry of [task, bug]) if (entry?.worktree) worktrees.push({ fx, path: entry.worktree });
    expect(JSON.parse(readFileSync(stageRecordFile(fx, 'TASK-101'), 'utf8'))).toMatchObject({ stage: 'implementer', model: 'claude-sonnet-5-5', entries: 0 });
    expect(JSON.parse(readFileSync(stageRecordFile(fx, 'BUG-301'), 'utf8'))).toMatchObject({ stage: 'tester', model: 'claude-opus-5-5', entries: 0 });

    const taskEntry = task as Delegate;
    const taskRecord = await recordNextEntry(fx, taskEntry, report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Need a decision\nblockers: [{ text: Needs an answer, cites: [conversation.Message.meta] }]'));
    expect(taskRecord?.history.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5' });
    expect(taskRecord?.history.at(-1)).not.toHaveProperty('cost_usd');
    const bugEntry = bug as Delegate;
    const bugRecord = await recordNextEntry(fx, bugEntry, report('role: tester\nticket: BUG-301\nresult: blocked\nsummary: Need a decision\nblockers: [{ text: Needs an answer, cites: [BUG-301] }]'));
    expect(bugRecord?.history.at(-1)).toMatchObject({ model: 'claude-opus-5-5' });
    expect(bugRecord?.history.at(-1)).not.toHaveProperty('cost_usd');

    const own = gitFixture('spec-next-model-s18-own', {
      setup: configureOnly(['TASK-101'], { astro: { implementer: 'claude-sonnet-5-5' } }),
    });
    fixtures.push(own);
    const ownOut = await own.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(ownOut.code, ownOut.stderr).toBe(0);
    const ownEntry = JSON.parse(ownOut.stdout) as Delegate;
    worktrees.push({ fx: own, path: ownEntry.worktree });
    expect(ownEntry.model).toBe('claude-sonnet-5-5');
    expect(JSON.parse(readFileSync(stageRecordFile(own, 'TASK-101'), 'utf8'))).toMatchObject({ stage: 'implementer', model: 'claude-sonnet-5-5', entries: 0 });

    const unset = gitFixture('spec-next-model-s18-unset', {
      setup: configureOnly(['TASK-101'], { astro: { reviewer: 'opus' } }),
    });
    fixtures.push(unset);
    const unsetOut = await unset.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(unsetOut.code, unsetOut.stderr).toBe(0);
    const unsetEntry = JSON.parse(unsetOut.stdout) as Delegate;
    worktrees.push({ fx: unset, path: unsetEntry.worktree });
    expect(unsetEntry.model).toBeNull();
    expect(JSON.parse(readFileSync(stageRecordFile(unset, 'TASK-101'), 'utf8'))).not.toHaveProperty('model');

    const waiting = gitFixture('spec-next-model-s18-waiting', {
      setup: (dir) => {
        configureOnly(['TASK-101'], { astro: { implementer: 'claude-sonnet-5-5' } })(dir);
        const file = join(dir, 'tickets/TASK-101.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace('questions: []', [
          'questions:',
          '  - id: Q1',
          '    kind: blocker',
          '    text: Waiting for a person',
          '    default: null',
          '    cites: [TASK-101]',
          '    answer: null',
          '    raised_by: null',
        ].join('\n')));
      },
    });
    fixtures.push(waiting);
    const waitingOut = await waiting.spec('', 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(JSON.parse(waitingOut.stdout)).toMatchObject({ ticket: 'TASK-101', action: 'waiting' });
    expect(existsSync(stageRecordFile(waiting, 'TASK-101'))).toBe(false);
  }, 120_000);

  it('CLI-007/S19 A restart remembers the model it selects, or none', async () => {
    const fx = gitFixture('spec-next-model-s19', {
      setup: configureOnly(['TASK-101'], {
        astro: { implementer: 'claude-sonnet-5-5' },
        'claude-code': { implementer: 'haiku' },
      }),
    });
    fixtures.push(fx);
    const first = await invokeAt(fx, '2026-10-30T12:00:00.000Z', {}, 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(first.code, first.stderr).toBe(0);
    const initial = JSON.parse(first.stdout) as Delegate;
    worktrees.push({ fx, path: initial.worktree });
    expect(JSON.parse(readFileSync(stageRecordFile(fx, 'TASK-101'), 'utf8'))).toMatchObject({ model: 'claude-sonnet-5-5', entries: 0 });

    const restarted = await invokeAt(fx, '2026-10-30T13:00:00.000Z', {}, 'next', 'TASK-101', '--restart', '--harness', 'claude-code', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    const next = JSON.parse(restarted.stdout) as Delegate;
    expect(next.model).toBe('haiku');
    expect(JSON.parse(readFileSync(stageRecordFile(fx, 'TASK-101'), 'utf8'))).toEqual({
      stage: 'implementer', started: '2026-10-30T13:00:00.000Z', model: 'haiku', entries: 0,
    });

    const noModel = gitFixture('spec-next-model-s19-unset', {
      setup: configureOnly(['TASK-101'], {
        astro: { implementer: 'claude-sonnet-5-5' },
        'claude-code': { reviewer: 'opus' },
      }),
    });
    fixtures.push(noModel);
    const firstNoModel = await invokeAt(noModel, '2026-10-30T12:00:00.000Z', {}, 'next', 'TASK-101', '--harness', 'astro', '--format', 'json');
    expect(firstNoModel.code, firstNoModel.stderr).toBe(0);
    const initialNoModel = JSON.parse(firstNoModel.stdout) as Delegate;
    worktrees.push({ fx: noModel, path: initialNoModel.worktree });
    const restartedNoModel = await invokeAt(noModel, '2026-10-30T13:00:00.000Z', {}, 'next', 'TASK-101', '--restart', '--harness', 'claude-code', '--format', 'json');
    expect(restartedNoModel.code, restartedNoModel.stderr).toBe(0);
    const entry = JSON.parse(restartedNoModel.stdout) as Delegate;
    expect(entry.model).toBeNull();
    expect(JSON.parse(readFileSync(stageRecordFile(noModel, 'TASK-101'), 'utf8'))).toEqual({ stage: 'implementer', started: '2026-10-30T13:00:00.000Z' });
    const record = await recordNextEntry(noModel, entry, report('role: implementer\nticket: TASK-101\nresult: blocked\nsummary: Need a decision\nblockers: [{ text: Needs an answer, cites: [conversation.Message.meta] }]'), '2026-10-30T13:10:00.000Z');
    expect(record?.history.at(-1)).not.toHaveProperty('model');
    expect(record?.history.at(-1)).not.toHaveProperty('cost_usd');
  }, 120_000);

  it('CLI-007/S20 A start that fails remembers nothing', async () => {
    const fx = gitFixture('spec-next-model-s20', {
      setup: configureOnly(['TASK-101', 'TASK-103'], {
        astro: { implementer: 'claude-sonnet-5-5' },
      }),
    });
    fixtures.push(fx);
    const added = await fx.spec('', 'worktree', 'add', 'TASK-103', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const task103Tree = (JSON.parse(added.stdout) as { project: string }).project;
    worktrees.push({ fx, path: task103Tree });
    writeFileSync(join(task103Tree, 'src/uncommitted.ts'), 'export const local = true;\n');

    const oldRecord = join(fx.repo, '.git/spec/stages/TASK-103.json');
    mkdirSync(dirname(oldRecord), { recursive: true });
    const before = `{"stage":"implementer","started":"2026-10-26T12:00:00.000Z","model":"earlier-model"}\n`;
    writeFileSync(oldRecord, before);

    const started = await fx.spec('', 'next', '--start', '--harness', 'astro', '--format', 'json');
    const entries = JSON.parse(started.stdout) as {
      ticket: string; action: string; worktree?: string; model?: string | null; blockers?: { text: string }[];
    }[];
    const task101 = entries.find((entry) => entry.ticket === 'TASK-101');
    const task103 = entries.find((entry) => entry.ticket === 'TASK-103');
    expect(task101).toMatchObject({ action: 'delegate', model: 'claude-sonnet-5-5' });
    if (task101?.worktree) worktrees.push({ fx, path: task101.worktree });
    expect(JSON.parse(readFileSync(stageRecordFile(fx, 'TASK-101'), 'utf8'))).toMatchObject({ model: 'claude-sonnet-5-5', entries: 0 });
    expect(task103?.action).toBe('waiting');
    expect(task103?.blockers?.length).toBeGreaterThan(0);
    expect(task103?.blockers?.[0]?.text).toMatch(/uncommitted|commit or remove/i);
    expect(fx.ticket('TASK-103')).toMatchObject({ status: 'open', stage: null });
    expect(readFileSync(oldRecord, 'utf8')).toBe(before);

    const only = await fx.spec('', 'next', 'TASK-103', '--harness', 'astro', '--format', 'json');
    expect(JSON.parse(only.stdout)).toMatchObject({ ticket: 'TASK-103', action: 'error' });
    expect(fx.ticket('TASK-103')).toMatchObject({ status: 'open', stage: null });
    expect(readFileSync(oldRecord, 'utf8')).toBe(before);
  }, 120_000);
});
