// PROP-131: the ordered model lists in the config (FMT-015/S12 to S14), what `config set` and `detect` do with them
// (CLI-008/S39) and the session-start line that shows the choices (INS-008/S7). Everything runs through cli.Run,
// with a fake `claude` first on the PATH.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorkspace } from '../../src/io/workspace';
import { LINT_BASE, gitFixture, tempDir } from '../helpers';
import {
  VERSION_OK,
  cli,
  fakeClaude,
  json,
  project,
  proposal,
  runIn,
  writeLocal,
  type Fx,
  type Next,
} from './model-lists-helpers';

const HARNESS = ['--harness', 'claude-code', '--format', 'json'];
const MARKED = 'marked unavailable';

interface Finding { rule: string; message: string }
async function lintFindings(fx: Fx): Promise<Finding[]> {
  const out = await cli(fx, {}, 'lint', '--format', 'json');
  return (JSON.parse(out.stdout) as { findings: Finding[] }).findings;
}
const hasL001 = (findings: Finding[], file: string): boolean => findings.some((item) => item.rule === 'L001' && item.message.includes(file));

describe('FMT-015 an ordered list of models per Claude Code role', () => {
  const S12 = {
    'claude-code': {
      'spec-writer': 'opus',
      tester: [{ model: 'sonnet', effort: 'high' }, { model: 'haiku', effort: 'high' }],
      implementer: [{ model: 'opus' }],
      reviewer: [{ model: 'opus-4' }, { model: 'sonnet', effort: 'max' }],
    },
  };
  // One ticket at each stage: PROP-201 the spec-writer's, PROP-202 the spec review's, BUG-301 the tester's, TASK-101 the implementer's, PROP-206 the reviewer's.
  // Proposals that touch the same features hold each other back, so each stage runs in a project of its own, with that ticket the only one open.
  const CRAFTED: Record<string, string> = {
    'PROP-202': proposal('PROP-202', ['spec-writer'], 'SET-001'),
    'PROP-206': proposal('PROP-206', ['spec-writer', 'spec-review', 'tester'], 'SET-001'),
  };
  const STAGES: [string, string][] = [['PROP-201', 'spec-writer'], ['PROP-202', 'spec-review'], ['BUG-301', 'tester'], ['TASK-101', 'implementer'], ['PROP-206', 'reviewer']];

  /** The stage of `id` started in a project of its own. */
  async function stage(prefix: string, delegation: Record<string, unknown>, claude: ReturnType<typeof fakeClaude>, id: string, role: string, local?: Record<string, unknown>): Promise<{ entry: Next; fx: Fx }> {
    const crafted = CRAFTED[id];
    const fx = project(`${prefix}-${id.toLowerCase()}`, delegation as Record<string, Record<string, unknown>>, {
      only: [id],
      ...(crafted === undefined ? {} : { files: { [`tickets/${id}.md`]: crafted } }),
      ...(local === undefined ? {} : { local }),
    });
    const out = await cli(fx, { claude }, 'next', id, ...HARNESS);
    expect(out.code, `${id}: ${out.stderr}${out.stdout.slice(0, 600)}`).toBe(0);
    const entry = json(out);
    expect(entry, id).toMatchObject({ ticket: id, action: 'delegate', role });
    return { entry, fx };
  }

  it('FMT-015/S12 A Claude Code role takes an ordered list of models', async () => {
    const claude = fakeClaude(VERSION_OK);
    const entries = new Map<string, Next>();
    let fx: Fx | undefined;
    for (const [id, role] of STAGES) {
      const started = await stage('prop131-s12', S12, claude, id, role);
      entries.set(id, started.entry);
      fx ??= started.fx;
    }
    expect(entries.get('BUG-301')).toMatchObject({ model: 'sonnet', effort: 'high' });
    expect(entries.get('TASK-101')).toMatchObject({ model: 'opus', effort: null });
    expect(entries.get('PROP-201')).toMatchObject({ model: 'opus', effort: null });
    expect(entries.get('PROP-206')).toMatchObject({ model: 'sonnet', effort: 'max', skipped: [{ model: 'opus-4', reason: 'not a supported model' }] });
    expect(entries.get('PROP-202')).toMatchObject({ model: 'sonnet', effort: 'max' });

    // Lint warns of "opus-4" alone, and finds no missing model and no schema error.
    const findings = await lintFindings(fx ?? project('prop131-s12-lint', S12));
    const unsupported = findings.filter((item) => item.rule === 'L032');
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]?.message).toContain('opus-4');
    expect(findings.filter((item) => item.rule === 'L030')).toEqual([]);
    expect(findings.filter((item) => item.rule === 'L001')).toEqual([]);
  }, 300_000);

  it('FMT-015/S12 a local setting replaces the role\'s whole shared setting', async () => {
    const claude = fakeClaude(VERSION_OK);
    // A local text replaces a shared list, and a local list replaces a shared text or list.
    const local = { delegation: { 'claude-code': { tester: 'opus', 'spec-writer': [{ model: 'haiku', effort: 'low' }], implementer: [{ model: 'haiku', effort: 'high' }] } } };
    expect((await stage('prop131-s12-local', S12, claude, 'BUG-301', 'tester', local)).entry).toMatchObject({ model: 'opus', effort: null });
    expect((await stage('prop131-s12-local', S12, claude, 'PROP-201', 'spec-writer', local)).entry).toMatchObject({ model: 'haiku', effort: 'low' });
    expect((await stage('prop131-s12-local', S12, claude, 'TASK-101', 'implementer', local)).entry).toMatchObject({ model: 'haiku', effort: 'high' });

    // A local "opus-4" over the shared tester list leaves the tester without a model, with L032 and L030.
    const unusable = await stage('prop131-s12-unusable', S12, claude, 'BUG-301', 'tester', { delegation: { 'claude-code': { tester: 'opus-4' } } });
    expect(unusable.entry).toMatchObject({ model: null, effort: null });
    const findings = await lintFindings(unusable.fx);
    expect(findings.some((item) => item.rule === 'L032' && item.message.includes('opus-4'))).toBe(true);
    expect(findings.some((item) => item.rule === 'L030' && item.message.includes('tester'))).toBe(true);
  }, 300_000);

  it('FMT-015/S13 A malformed model list is a lint finding', async () => {
    const fx = gitFixture('prop131-s13', { fixture: LINT_BASE });
    const configPath = join(fx.repo, 'spec/config.json');
    const base = readFileSync(configPath, 'utf8');
    const localPath = join(fx.repo, 'spec/config.local.json');
    const delegationOf = (harness: string, implementer: unknown) => ({ [harness]: { implementer } });
    const variants: [string, string, unknown][] = [
      ['empty list', 'claude-code', []],
      ['a text in a list', 'claude-code', ['sonnet']],
      ['no model', 'claude-code', [{ effort: 'high' }]],
      ['effort "highest"', 'claude-code', [{ model: 'sonnet', effort: 'highest' }]],
      ['effort 3', 'claude-code', [{ model: 'sonnet', effort: 3 }]],
      ['another key', 'claude-code', [{ model: 'sonnet', speed: 'fast' }]],
      ['sonnet twice', 'claude-code', [{ model: 'sonnet' }, { model: 'sonnet', effort: 'high' }]],
      ['a list under astro', 'astro', [{ model: 'builder' }]],
    ];
    // A well-formed list is no finding, so each finding below is the list's.
    writeFileSync(configPath, JSON.stringify({ ...JSON.parse(base) as object, delegation: delegationOf('claude-code', [{ model: 'sonnet', effort: 'high' }, { model: 'haiku' }]) }, null, 2));
    expect((await lintFindings(fx)).filter((item) => item.rule === 'L001')).toEqual([]);
    for (const [what, harness, value] of variants) {
      writeFileSync(configPath, JSON.stringify({ ...JSON.parse(base) as object, delegation: delegationOf(harness, value) }, null, 2));
      expect(hasL001(await lintFindings(fx), 'config.json'), `${what}: in config.json`).toBe(true);
    }
    writeFileSync(configPath, base);
    for (const [what, harness, value] of variants) {
      writeFileSync(localPath, JSON.stringify({ delegation: delegationOf(harness, value) }));
      expect(hasL001(await lintFindings(fx), 'config.local.json'), `${what}: in config.local.json`).toBe(true);
    }
  }, 120_000);

  it('FMT-015/S14 Models this machine cannot use are marked in the local config only', async () => {
    const claude = fakeClaude(VERSION_OK);
    const delegation = {
      'claude-code': { 'spec-writer': 'opus', tester: 'sonnet', implementer: [{ model: 'opus' }, { model: 'haiku' }], reviewer: 'sonnet', 'spec-review': 'opus' },
      astro: { tester: 'opus' },
    };
    const fx = project('prop131-s14', delegation, {
      local: { unavailableModels: { opus: true, sonnet: false } },
      files: { 'tickets/PROP-201.md': proposal('PROP-201', ['spec-writer']) },
    });
    // The next model of the list is chosen, and the spec version does not change.
    const specRoot = join(fx.repo, 'spec');
    const marked = (await loadWorkspace(specRoot, null, fx.repo)).spec.version;
    writeLocal(fx, {});
    expect((await loadWorkspace(specRoot, null, fx.repo)).spec.version).toBe(marked);
    writeLocal(fx, { unavailableModels: { opus: true, sonnet: false } });
    const out = await cli(fx, { claude }, 'next', 'TASK-101', ...HARNESS);
    expect(out.code, out.stderr).toBe(0);
    const entry = json(out);
    expect(entry).toMatchObject({ model: 'haiku', effort: null });
    expect(entry.skipped).toEqual([{ model: 'opus', reason: MARKED }]);

    // A spec review whose own setting names only opus does not take the reviewer's model while opus is marked.
    const review = await cli(fx, { claude }, 'next', 'PROP-201', ...HARNESS);
    const waiting = json(review);
    expect(waiting.action).toBe('waiting');
    expect(waiting.model ?? null).not.toBe('sonnet');
    expect((waiting.blockers ?? []).some((blocker) => blocker.text.includes('opus') && blocker.text.includes(MARKED))).toBe(true);

    // Under astro the setting changes nothing.
    const astro = await cli(fx, { claude }, 'next', 'BUG-301', '--harness', 'astro', '--format', 'json');
    expect(json(astro)).toMatchObject({ action: 'delegate', model: 'opus' });
  }, 300_000);

  it('FMT-015/S14 the config schema refuses a mark outside the local config and a malformed one', async () => {
    const fx = gitFixture('prop131-s14-lint', { fixture: LINT_BASE });
    const configPath = join(fx.repo, 'spec/config.json');
    const base = readFileSync(configPath, 'utf8');
    const localPath = join(fx.repo, 'spec/config.local.json');
    writeFileSync(localPath, JSON.stringify({ unavailableModels: { opus: true, sonnet: false } }));
    expect(hasL001(await lintFindings(fx), 'config.local.json'), 'a good mark is no finding').toBe(false);
    for (const [what, marks] of [['a key that is no alias', { gpt: true }], ['a value that is not true or false', { opus: 'yes' }]] as const) {
      writeFileSync(localPath, JSON.stringify({ unavailableModels: marks }));
      expect(hasL001(await lintFindings(fx), 'config.local.json'), what).toBe(true);
    }
    writeFileSync(localPath, JSON.stringify({}));
    writeFileSync(configPath, JSON.stringify({ ...JSON.parse(base) as object, unavailableModels: { opus: true } }, null, 2));
    const shared = (await lintFindings(fx)).filter((item) => item.rule === 'L001' && item.message.includes('config.json'));
    expect(shared.some((item) => item.message.includes('unavailableModels'))).toBe(true);
  }, 120_000);
});

describe('CLI-008 config set and detect with model lists', () => {
  const CONFIG = '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test",\n  "delegation": {"claude-code": {"reviewer": "opus"}}\n}\n';
  const entry = (role: string, model: string | null, effort: string | null, skipped: { model: string; reason: string }[] = []) => ({ role, model, effort, skipped });

  it('CLI-008/S39 Config set saves a model list and detect reports the choices', async () => {
    const claude = fakeClaude(VERSION_OK);
    const cwd = tempDir('prop131-s39-');
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const configPath = join(spec, 'config.json');
    const localPath = join(spec, 'config.local.json');
    writeFileSync(configPath, CONFIG);
    const set = (argv: string[]) => runIn(cwd, { claude, env: { CLAUDECODE: '1' } }, ['config', 'set', ...argv, '--root', spec, '--format', 'json']);
    const detect = async () => {
      const out = await runIn(cwd, { claude, env: { CLAUDECODE: '1' } }, ['detect', '--format', 'json']);
      expect(out.code, out.stderr).toBe(0);
      return (JSON.parse(out.stdout) as { models: unknown[] }).models;
    };

    const list = [{ model: 'sonnet', effort: 'high' }, { model: 'haiku', effort: 'high' }];
    const saved = await set(['delegation.claude-code.tester', JSON.stringify(list)]);
    expect(saved.code, saved.stderr).toBe(0);
    expect(JSON.parse(saved.stdout)).toMatchObject({ path: 'spec/config.json', key: 'delegation.claude-code.tester', value: list, local: false });
    expect(await detect()).toEqual([
      entry('spec-writer', null, null),
      entry('spec-review', 'opus', null),
      entry('tester', 'sonnet', 'high'),
      entry('implementer', null, null),
      entry('reviewer', 'opus', null),
    ]);

    // A list naming "opus-4", an unknown effort, an empty list or a list under astro is refused and changes no file, with --force too.
    const before = readFileSync(configPath, 'utf8');
    const refused: [string, string][] = [
      ['delegation.claude-code.tester', JSON.stringify([{ model: 'opus-4' }])],
      ['delegation.claude-code.tester', JSON.stringify([{ model: 'sonnet', effort: 'highest' }])],
      ['delegation.claude-code.tester', '[]'],
      ['delegation.astro.tester', JSON.stringify([{ model: 'builder' }])],
    ];
    for (const [key, value] of refused) {
      for (const force of [[], ['--force']]) {
        const out = await set([key, value, ...force]);
        expect(out.code, `${key} ${value} ${force.join(' ')}`).toBe(2);
        expect(readFileSync(configPath, 'utf8')).toBe(before);
        expect(existsSync(localPath)).toBe(false);
      }
    }

    // A mark is saved in the local config only, and makes detect skip the model.
    const marked = await set(['unavailableModels.sonnet', 'true', '--local']);
    expect(marked.code, marked.stderr).toBe(0);
    expect(JSON.parse(marked.stdout)).toMatchObject({ path: 'spec/config.local.json', key: 'unavailableModels.sonnet', value: true, local: true });
    expect(JSON.parse(readFileSync(localPath, 'utf8'))).toMatchObject({ unavailableModels: { sonnet: true } });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
    expect(readFileSync(join(spec, '.gitignore'), 'utf8').split('\n')).toContain('config.local.json');
    const models = await detect();
    expect(models).toEqual([
      entry('spec-writer', null, null),
      entry('spec-review', 'opus', null),
      entry('tester', 'haiku', 'high', [{ model: 'sonnet', reason: MARKED }]),
      entry('implementer', null, null),
      entry('reviewer', 'opus', null),
    ]);
    const unmarked = await set(['unavailableModels.sonnet', 'false', '--local']);
    expect(unmarked.code, unmarked.stderr).toBe(0);
    expect(JSON.parse(unmarked.stdout)).toMatchObject({ value: false });
    expect((await detect())[2]).toEqual(entry('tester', 'sonnet', 'high'));

    // Without --local, with "opus-4", or with a value other than true or false, it is refused and changes no file.
    const localBefore = readFileSync(localPath, 'utf8');
    for (const argv of [['unavailableModels.sonnet', 'true'], ['unavailableModels.opus-4', 'true', '--local'], ['unavailableModels.sonnet', 'maybe', '--local']]) {
      const out = await set(argv);
      expect(out.code, argv.join(' ')).toBe(2);
      expect(readFileSync(configPath, 'utf8')).toBe(before);
      expect(readFileSync(localPath, 'utf8')).toBe(localBefore);
    }
  }, 120_000);
});

describe('INS-008 session start shows the model of each stage role', () => {
  const LIST = {
    'claude-code': {
      'spec-writer': [{ model: 'opus', effort: 'medium' }],
      tester: [{ model: 'sonnet', effort: 'high' }, { model: 'haiku', effort: 'high' }],
      implementer: 'opus',
    },
  };
  const CLAUDE_CODE = { CLAUDECODE: '1' };
  const LINE = 'Models: spec-writer opus medium · spec-review not set · tester sonnet high · implementer opus · reviewer not set';

  async function context(fx: Fx, claude: ReturnType<typeof fakeClaude>, env: Record<string, string> = CLAUDE_CODE): Promise<string[]> {
    const out = await cli(fx, { claude, env, stdin: JSON.stringify({ agent: 'main', run_id: 'astro-session', cwd: fx.repo }) }, 'hook', 'claude-code', 'session-start');
    expect(out.code, out.stderr).toBe(0);
    const parsed = JSON.parse(out.stdout) as { hookSpecificOutput: { additionalContext: string } };
    return parsed.hookSpecificOutput.additionalContext.split('\n');
  }
  const modelsLine = (lines: string[]): string | undefined => lines.find((line) => line.startsWith('Models:'));

  it('INS-008/S6 The payload can carry Astro session metadata', async () => {
    const fx = project('prop131-ins008-s6', { 'claude-code': { reviewer: 'opus' } });
    const claude = fakeClaude(VERSION_OK);
    const out = await cli(fx, { claude, stdin: JSON.stringify({ agent: 'main', run_id: 'astro-session', cwd: fx.repo }) }, 'hook', 'claude-code', 'session-start');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.trimEnd().split('\n'), 'one JSON payload').toHaveLength(1);
    const parsed = JSON.parse(out.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart');
    const context = parsed.hookSpecificOutput.additionalContext;
    expect(context).toContain('/spec:feature');
    expect(context).toContain('.spec/bin/spec queue');
    expect(context.split('\n').length).toBeLessThanOrEqual(8);
    // The same short context as a session that carries no Astro metadata.
    const plain = await cli(fx, { claude, stdin: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: fx.repo }) }, 'hook', 'claude-code', 'session-start');
    const plainContext = (JSON.parse(plain.stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    expect(context).toBe(plainContext);
  }, 120_000);

  it('INS-008/S5 A ticket worktree session is silent', async () => {
    const fx = project('prop131-ins008-s5', { 'claude-code': { reviewer: 'opus' } });
    const added = await cli(fx, {}, 'worktree', 'add', 'TASK-101', '--format', 'json');
    expect(added.code, added.stderr).toBe(0);
    const worktree = (JSON.parse(added.stdout) as { project: string }).project;
    const out = await cli(fx, { stdin: JSON.stringify({ agent: 'main', run_id: 'astro-session', cwd: worktree }) }, 'hook', 'claude-code', 'session-start');
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  }, 120_000);

  it('INS-008/S7 One line names the model of each stage role', async () => {
    const known = fakeClaude(VERSION_OK);
    const fx = project('prop131-ins008', LIST);
    const lines = await context(fx, known);
    expect(modelsLine(lines)).toBe(LINE);
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(known.calls()).toBe(1);
    const rest = lines.filter((line) => !line.startsWith('Models:'));
    expect(rest.some((line) => line.includes('/spec:feature'))).toBe(true);

    // The version is not known: no effort, and the line says so.
    const unknown = fakeClaude('nothing');
    const noEffort = modelsLine(await context(fx, unknown)) ?? '';
    expect(noEffort.startsWith('Models: spec-writer opus · spec-review not set · tester sonnet · implementer opus · reviewer not set')).toBe(true);
    expect(noEffort.endsWith(' · effort not sent: Claude Code 2.1.292 or later was not found')).toBe(true);
    expect(noEffort).not.toMatch(/\b(medium|high)\b/);

    // A marked model is shown as skipped.
    writeLocal(fx, { unavailableModels: { sonnet: true } });
    expect(modelsLine(await context(fx, known))).toBe(LINE.replace('tester sonnet high', 'tester haiku high (sonnet marked unavailable)'));
    writeLocal(fx, { unavailableModels: { sonnet: true, haiku: true } });
    expect(modelsLine(await context(fx, known))).toBe(LINE.replace('tester sonnet high', 'tester none available (sonnet, haiku marked unavailable)'));
    writeLocal(fx, {});

    // No effort is set anywhere: `claude` is not run.
    const plain = fakeClaude(VERSION_OK);
    const single = project('prop131-ins008-single', { 'claude-code': { 'spec-writer': 'opus', tester: 'sonnet', implementer: 'opus' } });
    expect(modelsLine(await context(single, plain))).toBe('Models: spec-writer opus · spec-review not set · tester sonnet · implementer opus · reviewer not set');
    expect(plain.calls()).toBe(0);

    // No such line under Astro, with no claude-code model set, or with a config that cannot be read; the rest is as before.
    const astro = await context(fx, known, { ASTRO_RUN_ID: 'run-1' });
    expect(modelsLine(astro)).toBeUndefined();
    expect(astro).toEqual(rest);
    const none = project('prop131-ins008-none', { astro: { tester: 'builder' } });
    const bare = await context(none, known);
    expect(modelsLine(bare)).toBeUndefined();
    expect(bare).toEqual(rest);
    const broken = project('prop131-ins008-broken', LIST);
    writeFileSync(join(broken.repo, 'spec/config.json'), '{ not json');
    const unreadable = await cli(broken, { claude: known, env: CLAUDE_CODE, stdin: JSON.stringify({ agent: 'main', run_id: 'astro-session', cwd: broken.repo }) }, 'hook', 'claude-code', 'session-start');
    expect(unreadable.stdout).not.toContain('Models:');
  }, 240_000);
});
