// PROP-131: a stage takes the first available model and effort of its role's ordered list (CLI-007/R18, R19).
// Every command runs through cli.Run on git copies of chat-mini, with a fake `claude` first on the PATH.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IMPLEMENTER_LIST,
  VERSION_OK,
  cli,
  effortNotSent,
  fakeClaude,
  json,
  jsonList,
  project,
  proposal,
  stageRecord,
  stageRecordPath,
  unmarkCommand,
  worktreeCount,
  worktreeOf,
  wtTicket,
  writeLocal,
} from './model-lists-helpers';
import { bumpReportRefusal, clearReportRefusals, clearSavedReport, loadReport, loadReportRefusals, saveReport } from '../../src/io/report-store';
import { report, tempDir } from '../helpers';

const HARNESS = ['--harness', 'claude-code', '--format', 'json'];
const ROLES = { 'spec-writer': 'opus', tester: 'sonnet', reviewer: 'opus' };
const withImplementer = (implementer: unknown) => ({ 'claude-code': { ...ROLES, implementer } });
const MARKED = 'marked unavailable';

describe('CLI-007 an ordered model list per stage role', () => {
  it('CLI-007/S21 The first model of the list is selected with its effort', async () => {
    const claude = fakeClaude(VERSION_OK);
    const fx = project('prop131-s21', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const out = await cli(fx, { claude }, 'next', 'TASK-101', ...HARNESS);
    expect(out.code, out.stderr).toBe(0);
    const entry = json(out);
    expect(entry).toMatchObject({ ticket: 'TASK-101', action: 'delegate', role: 'implementer', model: 'opus', effort: 'medium' });
    expect(entry.skipped).toEqual([]);
    // The start remembers the model.
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ stage: 'implementer', model: 'opus' });

    // In text the header holds the model and the effort.
    const text = project('prop131-s21-text', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const shown = await cli(text, { claude }, 'next', 'TASK-101', '--harness', 'claude-code');
    expect(shown.code, shown.stderr).toBe(0);
    const header = shown.stdout.split('\n')[0] ?? '';
    expect(header).toContain('model: opus');
    expect(header).toContain('effort: medium');

    // A role set to one text has a model and no effort.
    const single = project('prop131-s21-single', withImplementer('opus'), { only: ['TASK-101'] });
    const plain = await cli(single, { claude }, 'next', 'TASK-101', '--harness', 'claude-code');
    expect(plain.code, plain.stderr).toBe(0);
    const plainHeader = plain.stdout.split('\n')[0] ?? '';
    expect(plainHeader).toContain('model: opus');
    expect(plainHeader).not.toContain('effort:');
  }, 240_000);

  it('CLI-007/S22 A model marked unavailable is skipped until it is unmarked', async () => {
    const claude = fakeClaude(VERSION_OK);
    const reviewer = [{ model: 'opus', effort: 'medium' }, { model: 'sonnet', effort: 'high' }];
    const fx = project('prop131-s22', { 'claude-code': { ...ROLES, implementer: IMPLEMENTER_LIST, reviewer } }, { only: ['TASK-101'] });
    const first = await cli(fx, { claude }, 'next', 'TASK-101', ...HARNESS);
    expect(first.code, first.stderr).toBe(0);
    expect(json(first)).toMatchObject({ model: 'opus', effort: 'medium' });
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ model: 'opus' });

    // While the stage is in progress opus is marked: the restart takes the next model.
    writeLocal(fx, { unavailableModels: { opus: true } });
    const restarted = await cli(fx, { claude }, 'next', 'TASK-101', '--restart', ...HARNESS);
    expect(restarted.code, restarted.stderr).toBe(0);
    const entry = json(restarted);
    expect(entry).toMatchObject({ action: 'delegate', model: 'haiku', effort: 'high' });
    expect(entry.skipped).toEqual([{ model: 'opus', reason: MARKED }]);
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ stage: 'implementer', model: 'haiku' });
    expect(wtTicket(fx, 'TASK-101')).toMatchObject({ status: 'in_progress', stage: 'implementer', history: [] });

    // Later stages skip opus too.
    const detected = await cli(fx, { claude, env: { CLAUDECODE: '1' }, noRoot: true }, 'detect', '--format', 'json');
    const models = (JSON.parse(detected.stdout) as { models: { role: string; model: string | null; effort: string | null; skipped: { model: string; reason: string }[] }[] }).models;
    expect(models.find((m) => m.role === 'reviewer')).toMatchObject({ model: 'sonnet', effort: 'high', skipped: [{ model: 'opus', reason: MARKED }] });

    // Once opus is unmarked the next start selects it again, with nothing skipped.
    writeLocal(fx, { unavailableModels: { opus: false } });
    const again = await cli(fx, { claude }, 'next', 'TASK-101', '--restart', ...HARNESS);
    expect(again.code, again.stderr).toBe(0);
    const back = json(again);
    expect(back).toMatchObject({ model: 'opus', effort: 'medium' });
    expect(back.skipped).toEqual([]);
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ model: 'opus' });
  }, 240_000);

  it('CLI-007/S23 Nothing starts while every model is marked unavailable', async () => {
    const claude = fakeClaude(VERSION_OK);
    const list = [{ model: 'opus' }, { model: 'haiku' }];
    const marks = { unavailableModels: { opus: true, haiku: true } };
    const fx = project('prop131-s23', withImplementer(list), { only: ['TASK-101'], local: marks });
    const out = await cli(fx, { claude }, 'next', 'TASK-101', ...HARNESS);
    expect(out.code).toBe(1);
    const entry = json(out);
    expect(entry.action).toBe('waiting');
    for (const model of ['opus', 'haiku']) {
      const mentions = (entry.blockers ?? []).filter((blocker) => blocker.text.includes(model));
      expect(mentions.some((blocker) => blocker.text.includes(MARKED) && blocker.text.includes(unmarkCommand(model))), `${model} is named with why and how to unmark it`).toBe(true);
    }
    expect(worktreeCount(fx, 'TASK-101')).toBe(0);
    expect(existsSync(stageRecordPath(fx, 'TASK-101'))).toBe(false);

    // A start and a listing say waiting, and nothing starts.
    const started = await cli(fx, { claude }, 'next', '--start', ...HARNESS);
    const startedList = jsonList(started);
    expect(startedList.find((item) => item.ticket === 'TASK-101')?.action).toBe('waiting');
    const summary = await cli(fx, { claude }, 'next', '--summary', ...HARNESS);
    expect(jsonList(summary).find((item) => item.ticket === 'TASK-101')?.action).toBe('waiting');
    expect(worktreeCount(fx, 'TASK-101')).toBe(0);
    expect(fx.ticket('TASK-101')).toMatchObject({ status: 'open', stage: null });
    expect(existsSync(stageRecordPath(fx, 'TASK-101'))).toBe(false);

    // A running stage is not restarted: the restart is an error with the same blockers, and nothing changes.
    const running = project('prop131-s23-running', withImplementer(list), { only: ['TASK-101'] });
    const begun = await cli(running, { claude }, 'next', 'TASK-101', ...HARNESS);
    expect(begun.code, begun.stderr).toBe(0);
    // The running stage holds a kept refused report and two refusals, as CLI-007/S11 makes them.
    // A stage `spec next` started keeps both under its own worktree's git directory, not the main checkout's.
    const stageRoot = worktreeOf(running, 'TASK-101');
    const kept = report('role: tester\nticket: TASK-101\nresult: done\nsummary: Incorrect role');
    saveReport(stageRoot, 'TASK-101', kept);
    expect(bumpReportRefusal(stageRoot, 'TASK-101', 'implementer')).toBe(1);
    expect(bumpReportRefusal(stageRoot, 'TASK-101', 'implementer')).toBe(2);
    expect(loadReport(running.repo, 'TASK-101'), 'the main checkout keeps none').toBeNull();
    const recordBefore = readFileSync(stageRecordPath(running, 'TASK-101'), 'utf8');
    const ticketBefore = wtTicket(running, 'TASK-101');
    writeLocal(running, marks);
    const restart = await cli(running, { claude }, 'next', 'TASK-101', '--restart', ...HARNESS);
    const failure = json(restart);
    expect(failure.action).toBe('error');
    for (const model of ['opus', 'haiku']) {
      const mentions = (failure.blockers ?? []).filter((blocker) => blocker.text.includes(model));
      expect(mentions.some((blocker) => blocker.text.includes(MARKED) && blocker.text.includes(unmarkCommand(model))), `${model} in the restart error`).toBe(true);
    }
    expect(worktreeCount(running, 'TASK-101')).toBe(1);
    expect(readFileSync(stageRecordPath(running, 'TASK-101'), 'utf8')).toBe(recordBefore);
    expect(wtTicket(running, 'TASK-101')).toEqual(ticketBefore);
    // The kept report and the refusal count are as they were: a restart that went on would have cleared both.
    expect(loadReport(stageRoot, 'TASK-101')).toBe(kept);
    expect(loadReportRefusals(stageRoot, 'TASK-101', 'implementer')).toBe(2);
    // Both reads can fail: the store's clearing functions, given that same root, empty exactly what is read above.
    clearSavedReport(stageRoot, 'TASK-101');
    clearReportRefusals(stageRoot, 'TASK-101', 'implementer');
    expect(loadReport(stageRoot, 'TASK-101')).toBeNull();
    expect(loadReportRefusals(stageRoot, 'TASK-101', 'implementer')).toBe(0);
  }, 240_000);

  it('CLI-007/S24 Effort is given only to a Claude Code known to take it', async () => {
    const fx = project('prop131-s24', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const listed = async (claude: ReturnType<typeof fakeClaude>) => {
      const out = await cli(fx, { claude }, 'next', ...HARNESS);
      expect(out.code, out.stderr).toBe(0);
      const entry = jsonList(out).find((item) => item.ticket === 'TASK-101');
      return { entry, stderr: out.stderr };
    };
    const unknown: [string, Parameters<typeof fakeClaude>[0]][] = [
      ['2.1.291', { prints: '2.1.291 (Claude Code)' }],
      ['no version', 'nothing'],
      ['fails', 'fails'],
      ['does not end within 3 seconds', 'hangs'],
    ];
    for (const [what, behaviour] of unknown) {
      const { entry, stderr } = await listed(fakeClaude(behaviour));
      expect(entry, what).toMatchObject({ model: 'opus', effort: null });
      expect(stderr, what).toContain(effortNotSent('medium'));
      expect(stderr.split(effortNotSent('medium')).length - 1, `${what}: one line`).toBe(1);
    }
    for (const version of ['2.1.292 (Claude Code)', '2.2.0 (Claude Code)']) {
      const { entry, stderr } = await listed(fakeClaude({ prints: version }));
      expect(entry, version).toMatchObject({ model: 'opus', effort: 'medium' });
      expect(stderr, version).not.toContain('effort');
    }

    // An entry with no effort, or the Astro harness, never runs `claude`.
    const never = fakeClaude(VERSION_OK);
    const single = project('prop131-s24-single', withImplementer('opus'), { only: ['TASK-101'] });
    const plain = await cli(single, { claude: never }, 'next', ...HARNESS);
    expect(jsonList(plain).find((item) => item.ticket === 'TASK-101')).toMatchObject({ model: 'opus', effort: null });
    const astro = project('prop131-s24-astro', { astro: { implementer: 'builder' }, 'claude-code': { implementer: IMPLEMENTER_LIST } }, { only: ['TASK-101'] });
    const underAstro = await cli(astro, { claude: never }, 'next', '--harness', 'astro', '--format', 'json');
    expect(jsonList(underAstro).find((item) => item.ticket === 'TASK-101')).toMatchObject({ model: 'builder' });
    expect(never.calls()).toBe(0);

    // Starting several tickets runs it once.
    const once = fakeClaude(VERSION_OK);
    const two = project('prop131-s24-two', { 'claude-code': { ...ROLES, implementer: IMPLEMENTER_LIST } }, { only: ['TASK-101', 'TASK-103'] });
    const started = await cli(two, { claude: once }, 'next', '--start', ...HARNESS);
    expect(started.code, started.stderr).toBe(0);
    const entries = jsonList(started).filter((item) => item.action === 'delegate');
    expect(entries.map((item) => item.ticket).sort()).toEqual(['TASK-101', 'TASK-103']);
    for (const item of entries) expect(item).toMatchObject({ model: 'opus', effort: 'medium' });
    expect(once.calls()).toBe(1);
  }, 240_000);

  it('PIP-017/S10 The spec review is delegated like any other stage', async () => {
    const claude = fakeClaude(VERSION_OK);
    const files = { 'tickets/PROP-201.md': proposal('PROP-201', ['spec-writer']) };
    const reviewer = [{ model: 'sonnet', effort: 'high' }, { model: 'opus', effort: 'low' }];
    const modelOf = async (prefix: string, delegation: Record<string, unknown>, local?: Record<string, unknown>) => {
      const fx = project(prefix, { 'claude-code': { 'spec-writer': 'opus', tester: 'sonnet', implementer: 'opus', ...delegation } }, { files, ...(local === undefined ? {} : { local }) });
      const out = await cli(fx, { claude }, 'next', 'PROP-201', ...HARNESS);
      return json(out);
    };
    // Its own setting, with its effort, when it has one.
    const own = await modelOf('prop131-s10-own', { reviewer, 'spec-review': [{ model: 'opus', effort: 'max' }, { model: 'haiku' }] });
    expect(own).toMatchObject({ action: 'delegate', role: 'spec-review', model: 'opus', effort: 'max' });
    // Otherwise the reviewer's, with the reviewer's effort.
    const fallback = await modelOf('prop131-s10-reviewer', { reviewer });
    expect(fallback).toMatchObject({ action: 'delegate', role: 'spec-review', model: 'sonnet', effort: 'high' });
    expect(fallback.skipped).toEqual([]);
    // The reviewer's first entry marked unavailable: the spec review takes the next one of the reviewer's list.
    const skipped = await modelOf('prop131-s10-skipped', { reviewer }, { unavailableModels: { sonnet: true } });
    expect(skipped).toMatchObject({ role: 'spec-review', model: 'opus', effort: 'low' });
    expect(skipped.skipped).toEqual([{ model: 'sonnet', reason: MARKED }]);
  }, 240_000);

  it("INV-020 A machine's model settings only choose among the project's own entries", async () => {
    // A mark of a model the list does not hold changes nothing, and a forged version text is never run.
    const marker = join(tempDir('prop131-inv020-'), 'pwned');
    const forged = fakeClaude({ prints: `2.1.300 (Claude Code)\n$(touch ${marker})\n\`touch ${marker}\`` });
    const fx = project('prop131-inv020', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'], local: { unavailableModels: { fable: true, sonnet: true } } });
    const out = await cli(fx, { claude: forged }, 'next', 'TASK-101', ...HARNESS);
    expect(out.code, out.stderr).toBe(0);
    const entry = json(out);
    expect(entry).toMatchObject({ action: 'delegate', model: 'opus' });
    expect(entry.skipped).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    expect(forged.calls()).toBe(1);

    // A mark of every entry makes the stage not start, never a model the project did not list.
    writeFileSync(join(fx.repo, 'spec/config.local.json'), JSON.stringify({ unavailableModels: { opus: true, haiku: true, sonnet: true } }));
    const restart = await cli(fx, { claude: forged }, 'next', 'TASK-101', '--restart', ...HARNESS);
    const failure = json(restart);
    expect(failure.action).toBe('error');
    expect(failure.model ?? null).toBeNull();
    expect(worktreeCount(fx, 'TASK-101')).toBe(1);
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ model: 'opus' });
  }, 240_000);
});
