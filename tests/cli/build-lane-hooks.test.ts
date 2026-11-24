// INS-020/S24 (PROP-116): a build stage goes through the same Claude Code hooks, its proof run included.
// PROP-215 is in the build lane of a git copy of chat-mini (build-lane-fixture.ts) whose earlier stages are
// recorded; the implementer's stage is then started by the before-agent hook in the ticket's own worktree,
// the stage's changes are made there, and its report is delivered through the stop and handback hooks.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseTicket } from '../../src/core/parse/tickets';
import { REPO } from '../helpers';
import { MUTATIONS, buildStage, cleanupAll, safeJson, type Case } from './build-lane-fixture';

afterAll(cleanupAll);

interface Out { stdout: string; stderr: string; code: number | null }
interface HookJson {
  hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string; updatedInput?: Record<string, unknown> };
  systemMessage?: string;
  decision?: string;
  reason?: string;
}
const MODELS = { implementer: 'sonnet', reviewer: 'opus' };
const SESSION = { session_id: 'session-1', permission_mode: 'acceptEdits' };
const NOFAIL = 'no test of SET-001/S4 fails on the code before the build; write one that fails there on what it asserts';

const base = (c: Case) => ({ ...SESSION, transcript_path: join(c.fx.repo, '.git/session.jsonl'), cwd: c.fx.repo });
const hook = (c: Case, event: string, payload: unknown): Promise<Out> => c.fx.spec(JSON.stringify(payload), 'hook', 'claude-code', event);
const requestCall = (c: Case) => ({ ...base(c), hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt: `spec:${c.id}`, subagent_type: 'general-purpose', description: 'drive' }, tool_use_id: 'toolu_agent' });
const handbackCall = (c: Case, message: string) => ({ ...base(c), hook_event_name: 'PreToolUse', tool_name: 'SubagentHandback', tool_input: { message }, tool_use_id: 'toolu_handback', agent_id: 'agent-1', agent_type: 'general-purpose' });
const stopCall = (c: Case, message: string) => ({ ...base(c), hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'agent-1', agent_type: 'general-purpose', last_assistant_message: message });

/** The hook's one JSON line, or undefined when it printed none (an assertion reads it, never an error). */
const jsonOf = (out: Out): HookJson | undefined => safeJson<HookJson>(out.stdout);
const decisionOf = (out: Out) => jsonOf(out)?.hookSpecificOutput?.permissionDecision;
const reasonOf = (out: Out) => jsonOf(out)?.hookSpecificOutput?.permissionDecisionReason ?? '';

const worktreeOf = (c: Case): string => join(dirname(c.fx.repo), `${basename(c.fx.repo)}.worktrees`, c.id);
const wtTicket = (c: Case) => {
  const file = join(worktreeOf(c), 'tickets', `${c.id}.md`);
  return existsSync(file) ? parseTicket(`tickets/${c.id}.md`, readFileSync(file, 'utf8')).ticket?.data : undefined;
};
const wtHistory = (c: Case) => (wtTicket(c)?.history ?? []) as unknown as Record<string, unknown>[];

/** PROP-215 with its spec review approved and the implementer's stage started by the before-agent hook, its changes made in the worktree. */
async function started(prefix: string): Promise<Case> {
  const c = await buildStage(prefix, { stopBefore: 'implementer', delegation: MODELS });
  expect(c.fx.git('checkout', '-q', 'main').code).toBe(0);
  const out = await hook(c, 'before-agent', requestCall(c));
  expect(decisionOf(out), out.stderr + out.stdout).toBe('allow');
  const wt = worktreeOf(c);
  for (const patch of ['PROP-201.tester.patch', 'PROP-201.implementer.patch']) {
    const applied = c.fx.git('-C', wt, 'apply', join(REPO, 'evals/reference', patch));
    expect(applied.code, applied.stderr).toBe(0);
  }
  const pkg = join(wt, 'package.json');
  writeFileSync(pkg, readFileSync(pkg, 'utf8').replace('"vitest": "5.0.5"', '"vitest": "5.0.5",\n    "gemini-sdk": "1.0.0"'));
  return c;
}

describe('INS-020/S24 A build stage goes through the same hooks', () => {
  it('INS-020/S24 A build stage goes through the same hooks', async () => {
    const c = await buildStage('hooks-s24-request', { stopBefore: 'implementer', delegation: MODELS });
    expect(c.fx.git('checkout', '-q', 'main').code).toBe(0);
    // The request is allowed with the build stage's task, description and model.
    const allowed = await hook(c, 'before-agent', requestCall(c));
    expect(decisionOf(allowed), allowed.stderr + allowed.stdout).toBe('allow');
    const updated = jsonOf(allowed)?.hookSpecificOutput?.updatedInput ?? {};
    expect(updated).toMatchObject({ description: 'PROP-215 implementer', model: 'sonnet' });
    expect(String(updated['prompt'])).toContain('Type proposal, build lane: ');
    expect(String(updated['prompt'])).toMatch(/^mutations: \[\]/m);
  }, 300_000);

  it('INS-020/S24 a valid done report is recorded with its proof run, and the reviewer is next', async () => {
    const c = await started('hooks-s24-done');
    c.setProof();
    const message = c.implementer();
    const out = await hook(c, 'subagent-stop', stopCall(c, message));
    expect(out, 'a recorded stage stops silently').toEqual({ stdout: '', stderr: '', code: 0 });
    expect(wtHistory(c).at(-1)).toMatchObject({ role: 'implementer', result: 'done', mutations: MUTATIONS });
    expect(c.runs().length, 'the whole-tree run and the proof run').toBe(2);
    // A second delivery of the recorded report is acknowledged, while no stage of the ticket is running (INS-020/R18).
    const again = await hook(c, 'before-handback', handbackCall(c, message));
    expect(decisionOf(again)).toBe('allow');
    expect(jsonOf(again)?.systemMessage ?? '').toContain('PROP-215 implementer report already recorded');
    // The next stage is the reviewer's; `spec next` starts it, so it is asked last.
    const next = await c.fx.spec('', 'next', c.id, '--harness', 'claude-code', '--format', 'json');
    expect(safeJson<{ role: string }>(next.stdout)?.role).toBe('reviewer');
  }, 300_000);

  it('INS-020/S24 a report the proof run refuses is sent back with that problem and uses one attempt; one with no results uses none', async () => {
    const c = await started('hooks-s24-refused');
    c.setProof({ failing: [{ id: 'PRV-001/S4' }] });
    const refused = jsonOf(await hook(c, 'subagent-stop', stopCall(c, c.implementer())));
    expect(refused?.decision).toBe('block');
    expect(refused?.reason ?? '').toContain('report refused (attempt 1 of 3)');
    expect(refused?.reason ?? '').toContain(NOFAIL);
    expect(wtTicket(c)).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    // The proof run gives no results: sent back with the could-not-run reason, and no attempt is used.
    c.flag('proof-noreport', true);
    const unchecked = jsonOf(await hook(c, 'subagent-stop', stopCall(c, c.implementer())));
    expect(unchecked?.decision).toBe('block');
    expect((unchecked?.reason ?? '').startsWith('the check could not run: ')).toBe(true);
    c.flag('proof-noreport', false);
    const second = jsonOf(await hook(c, 'subagent-stop', stopCall(c, c.implementer())));
    expect(second?.reason ?? '').toContain('report refused (attempt 2 of 3)');
  }, 300_000);

  it('INS-020/S24 a valid report with lane full is recorded, and the next request gives the tester\'s stage or is refused for its missing model', async () => {
    const c = await started('hooks-s24-full');
    const message = c.implementer({ lane: 'full', mutations: null });
    const stopped = await hook(c, 'before-handback', handbackCall(c, message));
    expect(decisionOf(stopped), stopped.stdout + stopped.stderr).toBe('allow');
    expect(wtHistory(c).at(-1)).toMatchObject({ role: 'implementer', result: 'done', lane: 'full' });
    const next = await hook(c, 'before-agent', requestCall(c));
    expect(decisionOf(next)).toBe('deny');
    expect(reasonOf(next)).toContain('tester');
    // A second delivery of the recorded report is acknowledged.
    const again = await hook(c, 'before-handback', handbackCall(c, message));
    expect(decisionOf(again)).toBe('allow');
    expect(jsonOf(again)?.systemMessage ?? '').toContain('PROP-215 implementer report already recorded');
  }, 300_000);
});
