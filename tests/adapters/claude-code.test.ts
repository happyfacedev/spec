// Layer 2: hook payloads in, hook output out, through the real bundled CLI in a throwaway copy of
// chat-mini. Cases live in tests/adapters/claude-code/<event>/<case>.json. "source" says whether a
// payload follows Claude Code's documented shape or was recorded from a real session (V1–V10).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { git } from '../../src/io/git';
import { buildForTests, FIXTURE, REPO, tempDir } from '../helpers';

const CASES = join(import.meta.dirname, 'claude-code');
const Case = z.strictObject({
  source: z.enum(['documented', 'recorded']),
  description: z.string(),
  /** Files written into the repo copy before the hook runs. `$REPO` is replaced by its path. */
  files: z.record(z.string(), z.string()).default({}),
  /** Run the hook this many times; the last run is checked (bounce limits). */
  runs: z.number().int().min(1).default(1),
  stdin: z.unknown(),
  expect: z.strictObject({
    exitCode: z.number(),
    stdout: z.unknown().optional(),
    stdoutEmpty: z.boolean().optional(),
    stdoutIncludes: z.array(z.string()).default([]),
    stderrIncludes: z.array(z.string()).default([]),
  }),
});

const temps: string[] = [];
beforeAll(() => {
  buildForTests();
}, 60_000);
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

function repoCopy(): string {
  const dir = tempDir('spec-hook-');
  temps.push(dir);
  cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes('/node_modules') && !src.includes('/.claude/agents/') });
  const scripts = join(dir, '.claude/skills/chat-spec/scripts');
  mkdirSync(scripts, { recursive: true });
  for (const f of ['spec', 'spec.cjs']) cpSync(join(REPO, 'dist', f), join(scripts, f));
  // A finishing implementer or tester runs the real test command, which needs vitest.
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
  const id = ['-c', 'user.name=test', '-c', 'user.email=test@example.com'];
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['add', '-A']);
  git(dir, [...id, 'commit', '-q', '-m', 'fixture']);
  return dir;
}

const events = existsSync(CASES) ? readdirSync(CASES).filter((event) => ['session-start', 'before-edit', 'after-edit'].includes(event)).sort() : [];
describe('claude-code hooks (layer 2)', () => {
  it('has a case for every hook event', () => {
    expect(events).toEqual(['after-edit', 'before-edit', 'session-start']);
  });
  for (const event of events) {
    for (const file of readdirSync(join(CASES, event)).sort()) {
      it(`${event}/${file}`, () => {
        const c = Case.parse(JSON.parse(readFileSync(join(CASES, event, file), 'utf8')));
        const repo = repoCopy();
        const sub = (s: string) => s.replaceAll('$REPO', repo);
        for (const [path, text] of Object.entries(c.files)) {
          mkdirSync(dirname(join(repo, path)), { recursive: true });
          writeFileSync(join(repo, path), sub(text));
        }
        const bounces = tempDir('spec-bounce-');
        temps.push(bounces);
        let r = spawnSync('.claude/skills/chat-spec/scripts/spec', ['hook', 'claude-code', event], { cwd: repo, input: '', encoding: 'utf8' });
        for (let i = 0; i < c.runs; i++) {
          r = spawnSync('.claude/skills/chat-spec/scripts/spec', ['hook', 'claude-code', event], {
            cwd: repo,
            input: sub(JSON.stringify(c.stdin)),
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: repo, TMPDIR: bounces },
          });
        }
        expect(r.status, r.stderr).toBe(c.expect.exitCode);
        if (c.expect.stdoutEmpty) expect(r.stdout).toBe('');
        if (c.expect.stdout !== undefined) expect(JSON.parse(r.stdout)).toMatchObject(c.expect.stdout as object);
        for (const s of c.expect.stdoutIncludes) expect(r.stdout).toContain(s);
        for (const s of c.expect.stderrIncludes) expect(r.stderr).toContain(s);
      }, 60_000);
    }
  }
});
