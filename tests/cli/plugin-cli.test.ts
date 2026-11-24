import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURE_SPEC, REPO, tempDir as makeTempDir, trackChild } from '../helpers';
import { run } from '../../src/cli/run';

const PLUGIN = join(REPO, 'plugin/scripts/spec');
const PACKAGE_VERSION = (JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string }).version;
const [MAJOR, MINOR, PATCH] = PACKAGE_VERSION.split('.').map(Number);
const NEWER_VERSION = `${MAJOR ?? 0}.${MINOR ?? 0}.${(PATCH ?? 0) + 1}`;
const tempDir = (): string => makeTempDir('spec-plugin-cli-');
const cleanEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.SPEC_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  delete env.SPEC_CLI_DELEGATED;
  delete env.SPEC_PLUGIN_VERSION;
  return env;
};
const fixtureProject = (): string => {
  const repo = tempDir();
  cpSync(FIXTURE_SPEC, join(repo, 'spec'), { recursive: true });
  return repo;
};

describe('INS-014 Claude Code plugin CLI', () => {
  it('INS-014/S11 A normal CLI launcher does not defer to the project copy', async () => {
    const repo = fixtureProject();
    mkdirSync(join(repo, '.spec/bin'), { recursive: true });
    writeFileSync(join(repo, '.spec/bin/spec.cjs'), 'pinned');
    writeFileSync(join(repo, '.spec/bin/spec'), '#!/bin/sh\\nprintf delegated\\n');
    const out = await run({ argv: ['show', 'PRV-002/S3'], env: cleanEnv(), cwd: repo, scriptPath: join(repo, 'bin/spec') });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('### S3: Fallback provider also rate-limits');
    expect(out.stdout).not.toBe('delegated');
  });

  it('INS-014/S8 Defers project commands to the pinned copy with argv, stdin and status intact', () => {
    const repo = fixtureProject();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'spec.cjs'), 'pinned');
    writeFileSync(join(bin, 'spec'), [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin: fs.readFileSync(0, 'utf8'), pluginVersion: process.env.SPEC_PLUGIN_VERSION, delegated: process.env.SPEC_CLI_DELEGATED }));",
      "process.stderr.write('delegated stderr');",
      'process.exitCode = 7;',
      '',
    ].join('\n'));
    const argv = ['brief', '--stdin', '--format', 'json'];
    const out = spawnSync(PLUGIN, argv, { cwd: repo, env: cleanEnv(), input: 'payload from hook\n', encoding: 'utf8' });
    expect(out.status).toBe(7);
    expect(JSON.parse(out.stdout)).toEqual({ argv, stdin: 'payload from hook\n', pluginVersion: PACKAGE_VERSION, delegated: '1' });
    expect(out.stderr).toBe('delegated stderr');
  });

  it('INS-014/S8 Defers verify-history to the pinned copy like every project command', () => {
    const repo = fixtureProject();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'spec.cjs'), 'pinned');
    writeFileSync(join(bin, 'spec'), [
      '#!/usr/bin/env node',
      "process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), pluginVersion: process.env.SPEC_PLUGIN_VERSION, delegated: process.env.SPEC_CLI_DELEGATED, offenders: [] }));",
      'process.exitCode = 1;',
      '',
    ].join('\n'));
    const argv = ['verify-history', '--since', 'HEAD', '--format', 'json'];
    const out = spawnSync(PLUGIN, argv, { cwd: repo, env: cleanEnv(), encoding: 'utf8' });
    expect(JSON.parse(out.stdout)).toEqual({ argv, pluginVersion: PACKAGE_VERSION, delegated: '1', offenders: [] });
    expect(out.status).toBe(1);
  });

  it('INS-014/S14 A deferred next command does not wait for open stdin', async () => {
    const repo = fixtureProject();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'spec.cjs'), '');
    writeFileSync(join(bin, 'spec'), "process.stdout.write('delegated next');");
    const child = trackChild(spawn(PLUGIN, ['next', '--format', 'json'], { cwd: repo, env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] }));
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve({ code: null, signal: null, timedOut: true });
      }, 2_000);
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, timedOut: false });
      });
    });
    expect(result.timedOut, stderr).toBe(false);
    expect(result.code, `${stderr}\n${stdout}`).toBe(0);
    expect(stdout).toBe('delegated next');
  });

  it('INS-014/S9 A newer plugin appends its hint inside the session-start JSON', () => {
    const repo = fixtureProject();
    mkdirSync(join(repo, '.spec/bin'), { recursive: true });
    writeFileSync(join(repo, '.spec/bin/spec.cjs'), 'pinned');
    const env = cleanEnv();
    env.SPEC_CLI_DELEGATED = '1';
    env.SPEC_PLUGIN_VERSION = NEWER_VERSION;
    const out = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: repo, env, input: '{}', encoding: 'utf8' });
    expect(out.status).toBe(0);
    const parsed = JSON.parse(out.stdout) as { hookSpecificOutput: { additionalContext: string } };
    expect(parsed.hookSpecificOutput.additionalContext).toContain(`spec plugin ${NEWER_VERSION} is newer than this project's ${PACKAGE_VERSION}: edit/commit/history enforcement needs upgrade; run .spec/bin/spec upgrade`);
  });

  it('INS-015/S22 A newer plugin keeps old pinned hooks silent and asks for upgrade', () => {
    const repo = fixtureProject();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'spec.cjs'), 'pinned');
    writeFileSync(join(bin, 'spec'), [
      '#!/usr/bin/env node',
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') process.stdout.write('spec 0.0.1\\n');",
      "else if (args[2] === 'session-start') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'ticket workflow' } }) + '\\n');",
      "else { process.stderr.write('unknown hook event ' + args[2] + '; events: session-start\\n'); process.exitCode = 1; }",
      '',
    ].join('\n'));
    const unknown = spawnSync(PLUGIN, ['hook', 'claude-code', 'before-edit'], { cwd: repo, env: cleanEnv(), input: '{}', encoding: 'utf8' });
    expect(unknown).toMatchObject({ status: 0, stdout: '', stderr: '' });
    // The new events stay silent too, for a payload that is not a spec stage request.
    const agent = (prompt: string) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt, subagent_type: 'general-purpose' } });
    const unrelated: [string, string][] = [
      ['before-agent', agent('Explore the repo')],
      ['before-handback', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'SubagentHandback', tool_input: { message: 'Done.' } })],
      ['subagent-start', JSON.stringify({ hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'general-purpose' })],
      ['subagent-stop', JSON.stringify({ hook_event_name: 'SubagentStop', agent_id: 'a1', agent_type: 'general-purpose', last_assistant_message: 'Done.' })],
    ];
    for (const [event, input] of unrelated) {
      expect(spawnSync(PLUGIN, ['hook', 'claude-code', event], { cwd: repo, env: cleanEnv(), input, encoding: 'utf8' }), event).toMatchObject({ status: 0, stdout: '', stderr: '' });
    }
    // Except a before-agent spec stage request, which is refused and names the upgrade (INS-020/S20).
    const stageRequest = spawnSync(PLUGIN, ['hook', 'claude-code', 'before-agent'], { cwd: repo, env: cleanEnv(), input: agent('spec:TASK-101'), encoding: 'utf8' });
    expect(stageRequest.status).toBe(0);
    expect(stageRequest.stdout, `a refusal on stdout; stderr: ${stageRequest.stderr}`).not.toBe('');
    const refusal = (JSON.parse(stageRequest.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput;
    expect(refusal.permissionDecision).toBe('deny');
    expect(refusal.permissionDecisionReason.startsWith('spec could not prepare TASK-101: ')).toBe(true);
    expect(refusal.permissionDecisionReason).toContain('.spec/bin/spec upgrade');
    const session = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: repo, env: cleanEnv(), input: '{}', encoding: 'utf8' });
    expect(session.status).toBe(0);
    const context = (JSON.parse(session.stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    expect(context).toContain('edit/commit/history enforcement needs upgrade');
    expect(context).toContain('.spec/bin/spec upgrade');
  });

  it('INS-016/S17 A failing pinned CLI does not block a shell command', async () => {
    const failure = 'cannot load workspace\n';
    const command = 'npm test';
    // A project whose pinned CLI fails the way an older one does while loading its workspace; with `exit0` it refuses with exit 0 instead.
    const pinnedProject = (exit0: boolean): string => {
      const repo = fixtureProject();
      const bin = join(repo, '.spec/bin');
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, 'spec.cjs'), 'pinned');
      writeFileSync(join(bin, 'spec'), exit0
        ? "process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'refused by pinned' } }) + '\\n');\n"
        : "process.stderr.write('cannot load workspace\\n'); process.exitCode = 1;\n");
      return repo;
    };
    const hook = (repo: string, event: string, input: string) =>
      run({ argv: ['hook', 'claude-code', event], env: cleanEnv(), cwd: repo, scriptPath: PLUGIN, stdin: () => Promise.resolve(input) });
    const claude = (tool: string) => JSON.stringify({ tool_name: tool, tool_input: { command, file_path: 'src/app.ts' } });
    const astro = JSON.stringify({ astro_tool_name: 'mcp__astro__bash', astro_tool_input: { command } });

    // Then the launcher emits nothing on stdout and stderr and exits 0, for a Claude Code Bash payload and an Astro bash payload (R19).
    const failing = pinnedProject(false);
    const bothNamesShell = JSON.stringify({ tool_name: 'Bash', astro_tool_name: 'mcp__astro__bash', tool_input: { command }, astro_tool_input: { command } });
    for (const input of [claude('Bash'), astro, bothNamesShell]) {
      expect(await hook(failing, 'before-edit', input), input).toEqual({ stdout: '', stderr: '', code: 0 });
    }
    // But an edit tool keeps the failure and the pinned CLI's stderr.
    for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
      expect(await hook(failing, 'before-edit', claude(tool)), tool).toEqual({ stdout: '', stderr: failure, code: 1 });
    }
    // A payload that is not plainly a shell payload keeps the failure.
    const notShell = [
      'not json',
      JSON.stringify({ tool_input: { command } }),
      JSON.stringify({ tool_name: 'Edit', astro_tool_name: 'mcp__astro__bash', tool_input: { command }, astro_tool_input: { command } }),
      claude('bash'),
      // Conflicting tool names keep the failure in both directions, whatever the input looks like.
      JSON.stringify({ tool_name: 'Read', astro_tool_name: 'mcp__astro__bash', tool_input: { command }, astro_tool_input: { command } }),
      JSON.stringify({ tool_name: 'Bash', astro_tool_name: 'mcp__astro__read', tool_input: { command }, astro_tool_input: { command } }),
      JSON.stringify({ tool_name: 'Bash', astro_tool_name: 'mcp__astro__edit', tool_input: { file_path: 'src/app.ts' }, astro_tool_input: { file_path: 'src/app.ts' } }),
      JSON.stringify({ tool_name: 'Bash', astro_tool_name: 'mcp__astro__write', tool_input: { command, file_path: 'src/app.ts' } }),
      JSON.stringify({ tool_name: 'Read', astro_tool_name: 'mcp__astro__bash', astro_tool_input: { file_path: 'src/app.ts' } }),
    ];
    for (const input of notShell) {
      expect(await hook(failing, 'before-edit', input), input).toEqual({ stdout: '', stderr: failure, code: 1 });
    }
    // The same failure on another hook event keeps the failure.
    expect(await hook(failing, 'after-edit', claude('Bash'))).toEqual({ stdout: '', stderr: failure, code: 1 });
    // A refusal the pinned CLI gives with exit 0 reaches the caller unchanged.
    const refusing = pinnedProject(true);
    const refusal = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'refused by pinned' } };
    for (const input of [claude('Bash'), astro]) {
      const out = await hook(refusing, 'before-edit', input);
      expect(out.code).toBe(0);
      expect(out.stderr).toBe('');
      expect(JSON.parse(out.stdout)).toEqual(refusal);
    }
  }, 60_000);

  it('INS-014/S13 A delegated hook spawn failure is non-blocking', () => {
    const repo = fixtureProject();
    const bin = join(repo, '.spec/bin');
    mkdirSync(bin, { recursive: true });
    cpSync(PLUGIN, join(bin, 'spec'));
    writeFileSync(join(bin, 'spec.cjs'), "process.kill(process.pid, 'SIGTERM');\n");
    const hook = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: repo, env: cleanEnv(), input: '{}', encoding: 'utf8' });
    expect(hook).toMatchObject({ status: 0, stdout: '' });
    expect(hook.stderr).toContain('spec: could not run');
    expect(hook.stderr.trimEnd().split('\n')).toHaveLength(1);
    const agent = (prompt: string) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt, subagent_type: 'general-purpose' } });
    const unrelated = spawnSync(PLUGIN, ['hook', 'claude-code', 'before-agent'], { cwd: repo, env: cleanEnv(), input: agent('Explore the repo'), encoding: 'utf8' });
    expect(unrelated).toMatchObject({ status: 0, stdout: '' });
    expect(unrelated.stderr.trimEnd().split('\n')).toHaveLength(1);
    // A spec stage request is refused instead (INS-020/S20).
    const stageRequest = spawnSync(PLUGIN, ['hook', 'claude-code', 'before-agent'], { cwd: repo, env: cleanEnv(), input: agent('spec:TASK-101'), encoding: 'utf8' });
    expect(stageRequest.status).toBe(0);
    expect(stageRequest.stdout, `a refusal on stdout; stderr: ${stageRequest.stderr}`).not.toBe('');
    const refusal = (JSON.parse(stageRequest.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput;
    expect(refusal.permissionDecision).toBe('deny');
    expect(refusal.permissionDecisionReason.startsWith('spec could not prepare TASK-101: ')).toBe(true);
    const command = spawnSync(PLUGIN, ['show', 'PRV-002/S3'], { cwd: repo, env: cleanEnv(), encoding: 'utf8' });
    expect(command).toMatchObject({ status: 1, stdout: '' });
    expect(command.stderr).toContain('spec: could not run');
  });

  it('INS-014/S12 Old-layout hooks only ask to migrate on session-start', () => {
    const repo = fixtureProject();
    const session = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: repo, env: cleanEnv(), input: '{}', encoding: 'utf8' });
    expect(session.status).toBe(0);
    const context = (JSON.parse(session.stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    expect(context).toBe(`spec here uses an older layout; ask Claude to run "${realpathSync(PLUGIN)}" upgrade to migrate`);
    const subagent = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: repo, env: cleanEnv(), input: JSON.stringify({ agent: 'subagent', run_id: 'old-layout', cwd: repo }), encoding: 'utf8' });
    expect(subagent).toMatchObject({ status: 0, stdout: '', stderr: '' });
    const events: [string, string][] = [
      ['before-delegate', JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: 'implementer', prompt: 'TASK-101' } })],
      ['after-edit', JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'spec/config.json' } })],
      ['before-finish', JSON.stringify({ agent_type: 'implementer', last_assistant_message: 'done' })],
    ];
    for (const [event, input] of events) {
      const out = spawnSync(PLUGIN, ['hook', 'claude-code', event], { cwd: repo, env: cleanEnv(), input, encoding: 'utf8' });
      expect(out).toMatchObject({ status: 0, stdout: '', stderr: '' });
    }
    expect(readFileSync(join(repo, 'spec/config.json'), 'utf8')).toContain('formatVersion');
    expect(readFileSync(join(repo, 'spec/roles/implementer.md'), 'utf8')).toContain('role: implementer');
    expect(existsSync(join(repo, '.spec/bin/spec.cjs'))).toBe(false);
    expect(existsSync(join(repo, '.claude/agents/implementer.md'))).toBe(false);
  });

  it('INS-014/S10 A user-wide plugin hook with no project spec is silent', () => {
    const out = spawnSync(PLUGIN, ['hook', 'claude-code', 'session-start'], { cwd: tempDir(), env: cleanEnv(), input: '', encoding: 'utf8' });
    expect(out).toMatchObject({ status: 0, stdout: '', stderr: '' });
  });
});
