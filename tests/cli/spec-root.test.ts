// CLI-002: where the spec root comes from, and what a CLI finds through its launcher, symlinks included.
import { cpSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { run } from '../../src/cli/run';
import { resolveSpecRoot } from '../../src/io/root';
import { FIXTURE_SPEC, REPO, tempDir } from '../helpers';
import { git } from '../../src/io/git';

const HEADING = '### S3: Fallback provider also rate-limits';
const NO_ROOT = 'no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json';

const dirs: string[] = [];
/** An empty folder under its real path (the macOS tmp folder is a link), removed after the file's tests. */
function folder(): string {
  const dir = realpathSync(tempDir('spec-root-'));
  dirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** An empty file at `path`, with its folders: root resolution reads a launcher only by its path. */
function writeLauncher(path: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
  return path;
}

/** `<p>/.claude/skills/x-spec` with its launcher, and its skill.json when `json` is given. */
function skillCli(p: string, json?: string): { skill: string; path: string } {
  const skill = join(p, '.claude/skills/x-spec');
  const path = writeLauncher(join(skill, 'scripts/spec'));
  if (json !== undefined) writeFileSync(join(skill, 'skill.json'), json);
  return { skill, path };
}

/** The chat-mini fixture spec copied into `dir`. */
function copySpec(dir: string): void {
  cpSync(FIXTURE_SPEC, dir, { recursive: true });
}

interface Call {
  argv: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  launcher?: string;
}
/** One command line through cli.Run. */
const cli = ({ argv, cwd, env = {}, launcher }: Call) => run({ argv, env, cwd, scriptPath: launcher });

describe('CLI-002 Find the spec root', () => {
  it('CLI-002/S1 --root names the spec root', async () => {
    const out = await cli({ argv: ['find', 'fallback', '--root', 'fixtures/chat-mini/spec'], cwd: REPO });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('providers.FallbackTriggered');
  });

  it('CLI-002/S2 --root wins over SPEC_ROOT', async () => {
    const out = await cli({ argv: ['find', 'fallback', '--root', 'fixtures/chat-mini/spec'], cwd: REPO, env: { SPEC_ROOT: '/nonexistent' } });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('providers.FallbackTriggered');
  });

  it('CLI-002/S3 SPEC_ROOT is used without --root, relative to the working folder', async () => {
    const p = folder();
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['find', 'fallback'], cwd: p, env: { SPEC_ROOT: 'spec' } });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('providers.FallbackTriggered');
  });

  it('CLI-002/S4 SPEC_ROOT wins over the skill folder', async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "spec"}');
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, env: { SPEC_ROOT: '/nonexistent' }, launcher: path });
    expect(out.code).toBe(2);
    expect(out.stderr.startsWith('spec root /nonexistent does not exist')).toBe(true);
  });

  it("CLI-002/S5 The skill folder's skill.json names the spec root, relative to the project", async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "spec"}');
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: folder(), launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it("CLI-002/S6 Outside .claude/skills, skill.json is relative to the skill folder's parent", async () => {
    const p = folder();
    const sk = join(p, 'tools/sk');
    const path = writeLauncher(join(sk, 'scripts/spec'));
    writeFileSync(join(sk, 'skill.json'), '{"specRoot": "spec"}');
    copySpec(join(p, 'tools/spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S7 An older install keeps the spec in the skill folder', async () => {
    const p = folder();
    const { skill, path } = skillCli(p);
    copySpec(skill);
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S8 A skill.json without specRoot falls back to the skill folder', async () => {
    const p = folder();
    const { skill, path } = skillCli(p, '{}');
    copySpec(skill);
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S9 skill.json pointing at a missing folder', async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "missing"}');
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.stderr.startsWith(`spec root ${join(p, 'missing')} does not exist`)).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-002/S10 No skill folder holds anything', async () => {
    const p = folder();
    const { path } = skillCli(p);
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.stderr).toBe(`${NO_ROOT}\n\n${USAGE}`);
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });

  it('CLI-002/S11 Only a folder named scripts is looked above', async () => {
    const p = folder();
    const path = writeLauncher(join(p, 'sk/bin/spec'));
    copySpec(join(p, 'sk'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.stderr.startsWith('no spec root: pass --root')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-002/S12 A symlinked CLI finds its skill folder through the link', async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "spec"}');
    copySpec(join(p, 'spec'));
    const bin = folder();
    symlinkSync(path, join(bin, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: join(bin, 'spec') });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S13 Without a launcher path there is no skill folder', async () => {
    const out = await cli({ argv: ['lint'], cwd: folder() });
    expect(out.stderr.startsWith('no spec root: pass --root')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-002/S14 A root that does not exist', async () => {
    const out = await cli({ argv: ['lint', '--root', '/nonexistent'], cwd: folder() });
    expect(out.stderr).toBe(`spec root /nonexistent does not exist\n\n${USAGE}`);
    expect(out.stdout).toBe('');
    expect(out.code).toBe(2);
  });

  it('CLI-002/S15 The first source found decides, even when its folder is missing', async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "spec"}');
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['lint'], cwd: p, env: { SPEC_ROOT: '/nonexistent' }, launcher: path });
    expect(out.stderr.startsWith('spec root /nonexistent does not exist')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-002/S16 An empty --root or SPEC_ROOT counts as not given', async () => {
    const p = folder();
    const { path } = skillCli(p, '{"specRoot": "spec"}');
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3', '--root='], cwd: p, env: { SPEC_ROOT: '' }, launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S17 The last --root wins', async () => {
    const out = await cli({ argv: ['show', 'PRV-002', '--root', 'fixtures/chat-mini/spec', '--root=/nonexistent'], cwd: REPO });
    expect(out.stderr.startsWith('spec root /nonexistent does not exist')).toBe(true);
    expect(out.code).toBe(2);
  });

  it('CLI-002/S18 A root without config.json is still used', async () => {
    const out = await cli({ argv: ['lint', '--root', folder()], cwd: REPO });
    expect(out.stdout.startsWith('config.json:1 error L001: the spec has no config.json')).toBe(true);
    expect(out.code).toBe(1);
  });

  it('CLI-002/S19 A project .spec/bin/spec launcher resolves to project/spec', async () => {
    const p = folder();
    const path = writeLauncher(join(p, '.spec/bin/spec'));
    copySpec(join(p, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: p, launcher: path });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S20 Without a launcher, the nearest spec/config.json above cwd is used', async () => {
    const p = folder();
    copySpec(join(p, 'spec'));
    const cwd = join(p, 'src/nested');
    mkdirSync(cwd, { recursive: true });
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S21 CLAUDE_PROJECT_DIR is the fallback search start when set', async () => {
    const cwdProject = folder();
    copySpec(join(cwdProject, 'spec'));
    const claudeProject = folder();
    mkdirSync(join(claudeProject, 'spec'), { recursive: true });
    writeFileSync(join(claudeProject, 'spec/config.json'), '{"formatVersion":2,"name":"other","testCommand":"npm test"}');
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: cwdProject, env: { CLAUDE_PROJECT_DIR: claudeProject } });
    expect(out.code).toBe(2);
    expect(out.stdout).not.toContain(HEADING);
  });

  it('CLI-002/S12 A symlinked CLI finds its skill folder through the link', async () => {
    const project = folder();
    copySpec(join(project, 'spec'));
    const link = join(dirname(project), basename(project) + '-link');
    symlinkSync(project, link);
    const cwd = join(link, 'src/nested');
    mkdirSync(cwd, { recursive: true });
    const varAlias = project.startsWith('/private/var/') ? '/var' + project.slice('/private/var'.length) : project;
    const claudeProject = varAlias !== project ? varAlias : link;
    expect(resolveSpecRoot({ flag: null, env: undefined, claudeProjectDir: claudeProject, scriptPath: undefined, cwd })).toBe(join(project, 'spec'));
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd, env: { CLAUDE_PROJECT_DIR: claudeProject } });
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });

  it('CLI-002/S22 A hook with no resolvable spec root is silent and succeeds', async () => {
    const out = await cli({ argv: ['hook', 'claude-code', 'session-start'], cwd: folder() });
    expect(out).toEqual({ stdout: '', stderr: '', code: 0 });
  });

  it('CLI-002/S24 A nested git repository does not inherit its parent spec', async () => {
    const parent = folder();
    cpSync(FIXTURE_SPEC, join(parent, 'spec'), { recursive: true });
    expect(git(parent, ['init', '-q']).code).toBe(0);
    const nested = join(parent, 'nested');
    mkdirSync(nested);
    expect(git(nested, ['init', '-q']).code).toBe(0);
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd: nested });
    expect(out.code).toBe(2);
    expect(out.stderr).toContain('no spec root:');
  });

  it('CLI-002/S25 A fixture spec remains the nearest root inside this repository', async () => {
    const cwd = join(REPO, 'fixtures/chat-mini/src');
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('### S3: Fallback provider also rate-limits');
  });

  it('CLI-002/S23 A project launcher symlink keeps its .spec/bin root', async () => {
    const project = folder();
    const target = writeLauncher(join(project, 'plugin/scripts/spec'));
    const launcher = join(project, '.spec/bin/spec');
    mkdirSync(dirname(launcher), { recursive: true });
    symlinkSync(target, launcher);
    copySpec(join(project, 'spec'));
    const cwd = folder();
    const out = await cli({ argv: ['show', 'PRV-002/S3'], cwd, launcher });
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(HEADING);
  });
});
