// PROP-131: the before-agent hook sends the chosen model and effort of a stage request (INS-020/S25), and
// closes a failed launch from the running denial (INS-020/S26). The hooks run through cli.Run on git copies of
// chat-mini, with a fake `claude` first on the PATH.
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
  project,
  stageRecord,
  stageRecordPath,
  unmarkCommand,
  worktreeCount,
  wtTicket,
  type Fx,
} from './model-lists-helpers';

const ROLES = { 'spec-writer': 'opus', tester: 'sonnet', reviewer: 'opus' };
const withImplementer = (implementer: unknown) => ({ 'claude-code': { ...ROLES, implementer } });
const RUNNING = 'already has its implementer stage running; do not delegate it again';
const MARKED = 'marked unavailable';

const SESSION = { session_id: 'session-1', permission_mode: 'acceptEdits' };
const agentCall = (fx: Fx, toolInput: Record<string, unknown>) => ({
  ...SESSION, transcript_path: join(fx.repo, '.git/session.jsonl'), cwd: fx.repo, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: toolInput, tool_use_id: 'toolu_agent',
});
const request = (extra: Record<string, unknown> = {}) => ({ prompt: 'spec:TASK-101', subagent_type: 'general-purpose', description: 'drive', ...extra });

interface Decision { decision: string | undefined; reason: string; updated: Record<string, unknown>; systemMessage: string | undefined }
/** `spec hook claude-code before-agent` for one Agent call: the PreToolUse decision it prints. */
async function ask(fx: Fx, claude: ReturnType<typeof fakeClaude>, toolInput: Record<string, unknown>): Promise<Decision> {
  const out = await cli(fx, { claude, stdin: JSON.stringify(agentCall(fx, toolInput)) }, 'hook', 'claude-code', 'before-agent');
  expect(out.code, out.stderr).toBe(0);
  expect(out.stdout.trimEnd().split('\n'), `one JSON line: ${out.stdout}`).toHaveLength(1);
  const parsed = JSON.parse(out.stdout) as {
    hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string; updatedInput?: Record<string, unknown> };
    systemMessage?: string;
  };
  expect(parsed.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  return {
    decision: parsed.hookSpecificOutput?.permissionDecision,
    reason: parsed.hookSpecificOutput?.permissionDecisionReason ?? '',
    updated: parsed.hookSpecificOutput?.updatedInput ?? {},
    systemMessage: parsed.systemMessage,
  };
}

describe('INS-020 a stage request carries the chosen model and effort', () => {
  it('INS-020/S25 A stage request carries the chosen effort', async () => {
    const claude = fakeClaude(VERSION_OK);
    // The first model of the list, with its effort, whatever effort the call gave.
    const list = project('prop131-s25-list', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const sent = await ask(list, claude, request({ effort: 'low' }));
    expect(sent.decision).toBe('allow');
    expect(sent.updated).toMatchObject({ description: 'TASK-101 implementer', model: 'opus', effort: 'medium', subagent_type: 'general-purpose' });
    expect(stageRecord(list, 'TASK-101')).toMatchObject({ stage: 'implementer', model: 'opus' });

    // One text sets no effort: the key is as the call gave it, and left out when the call had none.
    const text = project('prop131-s25-text', withImplementer('sonnet'), { only: ['TASK-101'] });
    const given = await ask(text, claude, request({ effort: 'low' }));
    expect(given.decision).toBe('allow');
    expect(given.updated).toMatchObject({ model: 'sonnet', effort: 'low' });
    const bare = project('prop131-s25-bare', withImplementer('sonnet'), { only: ['TASK-101'] });
    const none = await ask(bare, claude, request());
    expect(none.decision).toBe('allow');
    expect(none.updated).toMatchObject({ model: 'sonnet' });
    expect(none.updated).not.toHaveProperty('effort');

    // The version is not known: the list's effort is not sent, the call's own is passed back, and the person is told.
    const unknown = project('prop131-s25-unknown', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const lost = await ask(unknown, fakeClaude('nothing'), request({ effort: 'low' }));
    expect(lost.decision).toBe('allow');
    expect(lost.updated).toMatchObject({ model: 'opus', effort: 'low' });
    expect(lost.systemMessage).toContain(effortNotSent('medium'));
  }, 300_000);

  it('INS-020/S26 A failed launch is closed from the running denial', async () => {
    const claude = fakeClaude(VERSION_OK);
    const fx = project('prop131-s26', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
    const started = await ask(fx, claude, request());
    expect(started.decision).toBe('allow');
    expect(stageRecord(fx, 'TASK-101')).toMatchObject({ model: 'opus' });

    // The launch failed and no subagent runs the stage: the next request names the model it was started on.
    const denied = await ask(fx, claude, request());
    expect(denied.decision).toBe('deny');
    expect(denied.reason).toContain(RUNNING);
    expect(denied.reason).toContain('opus');
    expect(denied.reason).toContain('.spec/bin/spec config set unavailableModels.opus true --local');
    expect(denied.reason).toContain('.spec/bin/spec next TASK-101 --restart');
    expect(denied.reason).toMatch(/confirm/i);
    expect(denied.reason).toMatch(/usage limit/i);
    expect(denied.reason).toMatch(/outage/i);

    // Following it: the model is marked, the stage restarts on the next model, and nothing is recorded.
    const marked = await cli(fx, { claude }, 'config', 'set', 'unavailableModels.opus', 'true', '--local', '--format', 'json');
    expect(marked.code, marked.stderr).toBe(0);
    const restarted = await cli(fx, { claude }, 'next', 'TASK-101', '--restart', '--harness', 'claude-code', '--format', 'json');
    expect(restarted.code, restarted.stderr).toBe(0);
    const entry = json(restarted);
    expect(entry).toMatchObject({ action: 'delegate', model: 'haiku', effort: 'high' });
    expect(entry.skipped).toEqual([{ model: 'opus', reason: MARKED }]);
    expect(wtTicket(fx, 'TASK-101')).toMatchObject({ status: 'in_progress', stage: 'implementer', history: [] });
    const again = await ask(fx, claude, request());
    expect(again.decision).toBe('deny');
    expect(again.reason).toContain('.spec/bin/spec config set unavailableModels.haiku true --local');
    expect(again.reason).not.toContain('unavailableModels.opus');
  }, 300_000);

  it('INS-020/S26 A start record that is not this stage\'s alias names no model and no mark command', async () => {
    const claude = fakeClaude(VERSION_OK);
    const forged: [string, (record: Record<string, unknown>) => Record<string, unknown>][] = [
      ['no model', (record) => {
        const copy = { ...record };
        delete copy.model;
        return copy;
      }],
      ['not an alias', (record) => ({ ...record, model: 'claude-opus-5-5' })],
      ['another stage\'s', (record) => ({ ...record, stage: 'tester', model: 'opus' })],
    ];
    for (const [what, edit] of forged) {
      const fx = project('prop131-s26-record', withImplementer(IMPLEMENTER_LIST), { only: ['TASK-101'] });
      expect((await ask(fx, claude, request())).decision, what).toBe('allow');
      const path = stageRecordPath(fx, 'TASK-101');
      writeFileSync(path, JSON.stringify(edit(stageRecord(fx, 'TASK-101'))));
      const denied = await ask(fx, claude, request());
      expect(denied.decision, what).toBe('deny');
      expect(denied.reason, what).toContain(RUNNING);
      expect(denied.reason, what).not.toContain('unavailableModels');
      expect(denied.reason, what).not.toMatch(/\b(sonnet|opus|haiku|fable)\b/);
      expect(denied.reason, what).not.toContain('claude-opus-5-5');
    }
  }, 300_000);

  it('INS-020/S26 every model of a ready stage\'s list marked denies the request with the blockers', async () => {
    const claude = fakeClaude(VERSION_OK);
    const fx = project('prop131-s26-marked', withImplementer([{ model: 'opus' }, { model: 'haiku' }]), {
      only: ['TASK-101'],
      local: { unavailableModels: { opus: true, haiku: true } },
    });
    const denied = await ask(fx, claude, request());
    expect(denied.decision).toBe('deny');
    for (const model of ['opus', 'haiku']) {
      expect(denied.reason).toContain(MARKED);
      expect(denied.reason).toContain(unmarkCommand(model));
    }
    expect(worktreeCount(fx, 'TASK-101')).toBe(0);
    expect(existsSync(stageRecordPath(fx, 'TASK-101'))).toBe(false);
    expect(readFileSync(join(fx.repo, 'tickets/TASK-101.md'), 'utf8')).toContain('status: open');
  }, 120_000);
});
