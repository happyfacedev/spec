// INS-010: the after-edit hook lints the file that was just edited. Checked through the CLI entry point
// on a throwaway git copy of chat-mini, with the PostToolUse payload on stdin.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

let fx: ReturnType<typeof gitFixture>;
beforeEach(() => {
  fx = gitFixture('spec-ins010');
});
afterEach(() => {
  fx.cleanup();
});

const PRV003 = 'spec/modules/providers/features/PRV-003-track-token-usage.md';
const NO_WHEN = 'When "claude" finishes a reply reporting 12 input tokens and 3 output tokens\n';
const MISSING_ID = 'PRV-099/S1';

const abs = (path: string) => join(fx.repo, path);
const read = (path: string) => readFileSync(abs(path), 'utf8');
const write = (path: string, text: string) => {
  writeFileSync(abs(path), text);
};
/** PRV-003 with S1's When step removed: lint error L007. */
const breakPrv003 = () => {
  const text = read(PRV003);
  expect(text).toContain(NO_WHEN);
  write(PRV003, text.replace(NO_WHEN, ''));
};
/** PRV-003 with a prose mention of an ID the spec does not have: lint warning L026, no error. */
const warnPrv003 = () => {
  const text = read(PRV003);
  write(PRV003, text.replace('so usage can be shown per message.', `so usage can be shown per message (see ${MISSING_ID}).`));
};
/** Runs the after-edit hook with a PostToolUse payload. */
const afterEdit = (payload: Record<string, unknown>) => fx.spec(JSON.stringify(payload), 'hook', 'claude-code', 'after-edit');
const edited = (toolName: string, path: string) => afterEdit({ hook_event_name: 'PostToolUse', tool_name: toolName, tool_input: { file_path: abs(path) } });

describe('INS-010 lint after every edit', () => {
  it('INS-010/S1 An edit that breaks a scenario', async () => {
    breakPrv003();
    const out = await edited('Edit', PRV003);
    expect(out.stdout).toBe('');
    expect(out.stderr.startsWith('spec lint found problems after this edit:')).toBe(true);
    expect(out.stderr).toContain('L007 PRV-003/S1: scenario PRV-003/S1 has no When step');
    expect(out.code).toBe(2);
  });

  it('INS-010/S2 Each finding with its fix', async () => {
    breakPrv003();
    warnPrv003();
    const line = (n: string) => read(PRV003).split('\n').findIndex((l) => l.startsWith(n)) + 1;
    const out = await edited('Edit', PRV003);
    expect(out.code).toBe(2);
    const lines = out.stderr.trimEnd().split('\n');
    expect(lines.shift()).toBe('spec lint found problems after this edit:');
    // Every finding is a pair: the finding line, then its fix.
    expect(lines.length % 2).toBe(0);
    const pairs: [string, string][] = [];
    for (let i = 0; i < lines.length; i += 2) pairs.push([lines[i] ?? '', lines[i + 1] ?? '']);
    for (const [, fix] of pairs) expect(fix).toMatch(/^ {2}fix: \S/);
    const finding = /^(\S+):(\d+) (error|warning) (L\d+)(?: (\S+))?: (.+)$/;
    const parsed = pairs.map(([head]) => finding.exec(head));
    for (const m of parsed) expect(m).not.toBeNull();
    const error = pairs.find(([head]) => head.includes(' error L007 PRV-003/S1: scenario PRV-003/S1 has no When step'));
    expect(error?.[0]).toBe(`${PRV003.replace(/^spec\//, '')}:${line('### S1')} error L007 PRV-003/S1: scenario PRV-003/S1 has no When step`);
    expect(error?.[1]).toMatch(/^ {2}fix: \S/);
    // The warning in the same file is reported too.
    const warning = pairs.find(([head]) => head.includes(` warning L026 PRV-003: PRV-003 mentions ${MISSING_ID}, which does not exist`));
    expect(warning?.[0]).toBe(`${PRV003.replace(/^spec\//, '')}:${line('Record how many tokens')} warning L026 PRV-003: PRV-003 mentions ${MISSING_ID}, which does not exist`);
    expect(warning?.[1]).toBe('  fix: correct the ID, or write the name without an ID');
    expect(pairs.filter(([head]) => !head.startsWith(PRV003.replace(/^spec\//, '')))).toEqual([]);
  });

  it('INS-010/S3 An edit that leaves the spec clean', async () => {
    const out = await edited('Write', 'spec/core/glossary.md');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(0);
  });

  it('INS-010/S4 Warnings alone do not interrupt', async () => {
    warnPrv003();
    // The edited file does have a finding, and it is only a warning.
    const lint = await fx.spec('', 'lint');
    expect(lint.stdout).toContain(`PRV-003 mentions ${MISSING_ID}, which does not exist`);
    expect(lint.code).toBe(0);
    const out = await edited('Edit', PRV003);
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });

  it('INS-010/S5 Only the edited file is checked', async () => {
    breakPrv003();
    const out = await edited('Write', 'spec/core/glossary.md');
    expect(out.code).toBe(0);
    expect(out.stderr).toBe('');
  });

  it('INS-010/S6 Ticket files are checked too', async () => {
    const ticket = 'tickets/TASK-101.md';
    write(ticket, read(ticket).replace('status: open', 'status: bogus'));
    const out = await edited('Edit', ticket);
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr.startsWith('spec lint found problems after this edit:')).toBe(true);
    expect(out.stderr).toMatch(/^tickets\/TASK-101\.md:\d+ error L020 TASK-101: /m);
  });

  it('INS-010/S7 Files outside the spec and tickets are not linted', async () => {
    breakPrv003();
    const out = await edited('Edit', 'src/app.ts');
    expect(out.stdout).toBe('');
    expect(out.code).toBe(0);
  });

  it('INS-010/S8 A subagent\'s edit as Claude Code recorded it', async () => {
    breakPrv003();
    const out = await afterEdit({
      session_id: 'b4f766df-2f7e-4672-8054-da40ec76b058',
      transcript_path: '/home/user/.claude/projects/x/b4f766df.jsonl',
      cwd: fx.repo,
      prompt_id: 'dabdc06f-5284-4d7c-a470-c2421c0d427e',
      permission_mode: 'acceptEdits',
      agent_id: 'a702edd5a5650513a',
      agent_type: 'implementer',
      effort: { level: 'medium' },
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: abs('src/conversation/chat.ts'), old_string: '(trimmed)', new_string: '(trimmed)', replace_all: false },
      tool_response: { filePath: abs('src/conversation/chat.ts'), oldString: '(trimmed)', newString: '(trimmed)', originalFile: '(trimmed)', structuredPatch: [] },
    });
    expect(out.stdout).toBe('');
    expect(out.code).toBe(0);
  });

  it('INS-010/S9 Other tools and payloads without a path pass through', async () => {
    breakPrv003();
    const readTool = await edited('Read', PRV003);
    expect(readTool.stdout).toBe('');
    expect(readTool.code).toBe(0);
    const noPath = await afterEdit({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: {} });
    expect(noPath.stdout).toBe('');
    expect(noPath.code).toBe(0);
  });
});
