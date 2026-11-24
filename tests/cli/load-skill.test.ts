// INS-012: the plugin brief skill and command skills send arguments to the pinned CLI as stdin.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE_SPEC, REPO, tempDir as makeTempDir } from '../helpers';

const tempDir = (): string => makeTempDir('spec-ins012-');
const cli = (cwd: string, stdin: string | undefined, ...argv: string[]) =>
  run({ argv, env: {}, cwd, scriptPath: undefined, stdin: stdin === undefined ? undefined : () => Promise.resolve(stdin) });
/** `spec brief --stdin` on the fixture spec, as the plugin skill would run it. */
const briefStdin = (text: string) => cli(process.cwd(), text, 'brief', '--stdin', '--root', FIXTURE_SPEC);

/** The shell command a plugin skill injects: its fenced ```! block, else inline form. */
function injectedCommand(skillMd: string): string {
  const fenced = /```!\n([\s\S]*?)\n```/.exec(skillMd);
  if (fenced) return fenced[1] ?? '';
  return /!`([^`\n]*)`/.exec(skillMd)?.[1] ?? '';
}

/** Replaces the Claude Code argument placeholder with its literal text. */
function fill(command: string, args: string): string {
  return command.split('$ARGUMENTS').join(args);
}

/** Replaces the project CLI with a stub that records its arguments and stdin. */
function stubCli(repo: string): { args: () => string[] | null; stdin: () => string | null } {
  const dir = join(repo, '.spec/bin');
  mkdirSync(dir, { recursive: true });
  const output = join(tempDir(), 'seen');
  const path = join(dir, 'spec');
  writeFileSync(path, `#!/bin/sh\nfor arg in "$@"; do printf '%s\\n' "$arg"; done > '${output}.args'\ncat > '${output}.stdin'\n`);
  chmodSync(path, 0o755);
  return {
    args: () => (existsSync(`${output}.args`) ? readFileSync(`${output}.args`, 'utf8').split('\n').slice(0, -1) : null),
    stdin: () => (existsSync(`${output}.stdin`) ? readFileSync(`${output}.stdin`, 'utf8') : null),
  };
}

/** Runs one plugin skill's injected command with these arguments. */
function loadSkill(args: string, file = 'plugin/skills/brief/SKILL.md', shell = 'sh') {
  const repo = tempDir();
  const seen = stubCli(repo);
  const skill = readFileSync(join(REPO, file), 'utf8');
  const command = fill(injectedCommand(skill), args);
  const sh = spawnSync(shell, ['-c', command], { cwd: repo, encoding: 'utf8' });
  return { sh, repo, args: seen.args(), stdin: seen.stdin() };
}
const SHELLS = ['sh', 'bash', 'zsh'].filter((shell) => spawnSync(shell, ['-c', 'true']).status === 0);
/** What was sent, without the here-document's closing newline. */
const sent = (stdin: string | null): string | null => (stdin === null ? null : stdin.replace(/\n$/, ''));
const TRICKY = 'what\'s "the" gate $HOME `ls` back\\slash (paren) {brace} ${X} $(echo hi)';
const firstLine = (out: { stdout: string }) => out.stdout.split('\n')[0];

describe('INS-012 plugin brief skill arguments', () => {
  it('INS-012/S18 No arguments', async () => {
    const got = loadSkill('$ARGUMENTS');
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe('$ARGUMENTS');
    expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING'))).toMatch(/^# Brief · spec@[0-9a-f]{8}$/);
  });

  it('INS-012/S19 One unit ID', async () => {
    const got = loadSkill('PRV-002/S3');
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe('PRV-002/S3');
    expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING'))).toMatch(/^# PRV-002\/S3 · spec@[0-9a-f]{8}$/);
  });

  it('INS-012/S20 A role and an ID', async () => {
    const got = loadSkill('implementer TASK-101');
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe('implementer TASK-101');
    expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING'))).toMatch(/^# Brief · implementer · TASK-101 · spec@[0-9a-f]{8}$/);
  });

  it('INS-012/S21 The words of a question', async () => {
    const text = 'what happens when a provider rate limits';
    const got = loadSkill(text);
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe(text);
    expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING'))).toMatch(/^# Search · /);
  });

  it('INS-012/S22 Bad arguments still load', async () => {
    const got = loadSkill('tester');
    expect(got.sh.status).toBe(0);
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe('tester');
    const out = await briefStdin(sent(got.stdin) ?? 'MISSING');
    expect(out.code).toBe(0);
    expect(out.stdout).toBe((await cli(process.cwd(), undefined, 'brief', 'tester', '--root', FIXTURE_SPEC)).stdout);
  });

  it('INS-012/S23 An apostrophe in the arguments', async () => {
    const got = loadSkill("what's a gate");
    expect(got.sh.status).toBe(0);
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe("what's a gate");
    expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING'))).toMatch(/^# Search · what's gate · spec@[0-9a-f]{8}$/);
  });

  it('INS-012/S24 Quotes, shell variables, substitutions and metacharacters are passed literally', () => {
    const got = loadSkill(TRICKY);
    expect(got.sh.status).toBe(0);
    expect(got.args).toEqual(['brief', '--stdin']);
    expect(sent(got.stdin)).toBe(TRICKY);
  });

  for (const command of ['feature', 'bug', 'change']) {
    it(`INS-012/S25 The /${command} command passes arguments the same way`, async () => {
      const text = "what's new";
      const got = loadSkill(text, `plugin/skills/${command}/SKILL.md`);
      expect(got.sh.status).toBe(0);
      expect(got.args).toEqual(['brief', '--stdin']);
      expect(sent(got.stdin)).toBe(text);
      expect((await briefStdin(sent(got.stdin) ?? 'MISSING')).stdout).toBe((await cli(process.cwd(), undefined, 'brief', "what's", 'new', '--query', text, '--root', FIXTURE_SPEC)).stdout);
    });
  }
});

describe('INS-012 text holding the delimiter line', () => {
  const end = 'SPEC_ARGUMENTS_4b7e2c9d_END';
  const payload = ["what's a gate", end, 'touch PWNED'];

  it('INS-012/S26 Text holding the delimiter line runs nothing', async () => {
    expect(SHELLS.length).toBeGreaterThan(0);
    for (const shell of SHELLS) {
      const got = loadSkill(payload.join('\n'), 'plugin/skills/brief/SKILL.md', shell);
      expect(got.sh.status, shell).toBe(0);
      expect(existsSync(join(got.repo, 'PWNED')), shell).toBe(false);
      expect(got.args, shell).toEqual(['brief', '--stdin']);
      expect(sent(got.stdin), shell).toBe("what's a gate");
      expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING')), shell).toMatch(/^# Search · what's gate · spec@[0-9a-f]{8}$/);
    }
  });

  it('INS-012/S27 Under zsh, a broken line after the delimiter fails and runs nothing', async () => {
    expect(SHELLS).toContain('zsh');
    for (const shell of SHELLS) {
      const got = loadSkill([...payload, '"'].join('\n'), 'plugin/skills/brief/SKILL.md', shell);
      expect(existsSync(join(got.repo, 'PWNED')), shell).toBe(false);
      if (shell === 'zsh') {
        expect(got.sh.status).toBe(1);
        expect(got.args).toBeNull();
      } else {
        expect(got.sh.status, shell).toBe(0);
        expect(sent(got.stdin), shell).toBe("what's a gate");
        expect(firstLine(await briefStdin(sent(got.stdin) ?? 'MISSING')), shell).toMatch(/^# Search · what's gate · spec@[0-9a-f]{8}$/);
      }
    }
  });
});
