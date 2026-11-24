import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, tempDir } from '../helpers';

const repos: string[] = [];
afterAll(() => {
  for (const repo of repos) rmSync(repo, { recursive: true, force: true });
});

/** A committed git checkout in a folder called `folder`, holding the manifest and the given `.claude/settings.json`. */
function gitProject(prefix: string, manifest: string, settings: unknown, folder = 'shop'): string {
  const parent = tempDir(prefix);
  repos.push(parent);
  const repo = join(parent, folder);
  mkdirSync(repo);
  writeFileSync(join(repo, manifest), manifest === 'package.json'
    ? JSON.stringify({ devDependencies: { vitest: '^5.0.0' } })
    : '[project]\nname = "example"\n');
  mkdirSync(join(repo, '.claude'), { recursive: true });
  writeFileSync(join(repo, '.claude/settings.json'), JSON.stringify(settings, null, 2) + '\n');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: repo });
  return repo;
}

const scriptPath = join(REPO, 'plugin/scripts/spec');
const initIn = (repo: string, ...args: string[]) => run({ argv: ['init', '.', '--name', 'shop', ...args], env: {}, cwd: repo, scriptPath });
const upgradeIn = (repo: string) => run({ argv: ['upgrade', '.', '--from', join(REPO, 'plugin/scripts'), '--format', 'json'], env: {}, cwd: repo, scriptPath });
type Settings = {
  model?: string;
  permissions: { allow?: string[]; deny?: string[]; defaultMode?: string; additionalDirectories?: string[] };
  hooks: { PostToolUse: { hooks: { command: string }[] }[] };
  enabledPlugins: Record<string, boolean>;
  extraKnownMarketplaces?: Record<string, unknown>;
};
// The marketplace entry init and upgrade register (INS-003/R6).
const HAPPYFACE = { source: { source: 'github', repo: 'happyfacedev/happyface-plugins' } };
const settingsText = (repo: string): string => readFileSync(join(repo, '.claude/settings.json'), 'utf8');
// INS-003/S25-S28 run each command on its own checkout: "spec upgrade ." or "spec init . --name shop".
const COMMANDS = [
  { name: 'upgrade', apply: (repo: string) => upgradeIn(repo) },
  { name: 'init', apply: (repo: string) => initIn(repo) },
] as const;
const readSettings = (repo: string): Settings => JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8')) as Settings;
const readLocal = (repo: string): Settings => {
  const path = join(repo, '.claude/settings.local.json');
  expect(existsSync(path), '.claude/settings.local.json exists').toBe(true);
  return JSON.parse(readFileSync(path, 'utf8')) as Settings;
};

describe('INS-003 worktree and stack permissions', () => {
  it('INS-003/S15 Init grants worktree and detected stack access', async () => {
    const repo = gitProject('spec-s4-init-permissions-', 'package.json', {
      model: 'sonnet',
      permissions: { allow: ['Bash(custom *)'], deny: ['Bash(rm *)'] },
      hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'echo keep' }] }] },
    });
    const out = await initIn(repo, '--stack', 'node', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const settings = readSettings(repo);
    expect(readLocal(repo).permissions.additionalDirectories).toContain('../shop.worktrees');
    expect(settings.permissions).not.toHaveProperty('additionalDirectories');
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(['Skill', 'Bash(npx vitest *)', 'Bash(custom *)']));
    expect(readFileSync(join(repo, '.gitignore'), 'utf8').split(/\r?\n/)).toContain('.claude/settings.local.json');
    expect(settings.model).toBe('sonnet');
    expect(settings.permissions.deny).toEqual(['Bash(rm *)']);
    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.command).toBe('echo keep');
  });

  it('INS-003/S16 Upgrade merges access for the current stack', async () => {
    const repo = gitProject('spec-s4-upgrade-permissions-', 'pyproject.toml', {
      permissions: { defaultMode: 'default', allow: ['Bash(custom *)'], deny: ['Bash(rm *)'] },
      enabledPlugins: { 'spec@happyface': false },
    });
    const out = await upgradeIn(repo);
    expect(out.code, out.stderr).toBe(0);
    const settings = readSettings(repo);
    expect(readLocal(repo).permissions.additionalDirectories).toContain('../shop.worktrees');
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(['Skill', 'Bash(pytest *)', 'Bash(custom *)']));
    expect(settings.permissions.deny).toEqual(['Bash(rm *)']);
    expect(settings.permissions.defaultMode).toBe('default');
    expect(settings.enabledPlugins).toEqual({ 'spec@happyface': false });
  });

  it('INS-003/S22 A checkout under another folder name leaves the committed settings unchanged', async () => {
    const committed = {
      permissions: {
        allow: ['Bash(.spec/bin/spec *)', 'Bash(./.spec/bin/spec *)', 'Skill(spec:brief)', 'Skill', 'Bash(npx vitest *)'],
        additionalDirectories: ['../shop.worktrees'],
      },
      enabledPlugins: { 'spec@happyface': true },
      extraKnownMarketplaces: { happyface: HAPPYFACE },
    };
    const repo = gitProject('spec-s4-other-folder-', 'package.json', committed, 'shop-2');
    const before = readFileSync(join(repo, '.claude/settings.json'), 'utf8');
    const upgraded = await upgradeIn(repo);
    expect(upgraded.code, upgraded.stderr).toBe(0);
    const initialized = await initIn(repo);
    expect(initialized.code, initialized.stderr).toBe(0);
    expect(readFileSync(join(repo, '.claude/settings.json'), 'utf8')).toBe(before);
    expect(readSettings(repo).permissions.additionalDirectories).toEqual(['../shop.worktrees']);
    const status = execFileSync('git', ['status', '--porcelain', '--', '.claude/settings.json'], { cwd: repo, encoding: 'utf8' });
    expect(status).toBe('');
    expect(readLocal(repo).permissions.additionalDirectories).toEqual(['../shop-2.worktrees']);
  });

  it('INS-003/S23 Existing personal settings are kept', async () => {
    const repo = gitProject('spec-s4-local-kept-', 'package.json', { permissions: { allow: ['Bash(existing *)'] } });
    writeFileSync(join(repo, '.claude/settings.local.json'), JSON.stringify({
      model: 'haiku',
      permissions: { defaultMode: 'plan', allow: ['Bash(make *)'], additionalDirectories: ['../shared'] },
    }, null, 2) + '\n');
    for (let round = 0; round < 2; round++) {
      const out = await initIn(repo);
      expect(out.code, out.stderr).toBe(0);
    }
    const local = readLocal(repo);
    expect(local.model).toBe('haiku');
    expect(local.permissions.defaultMode).toBe('plan');
    expect(local.permissions.allow).toContain('Bash(make *)');
    expect(local.permissions.additionalDirectories).toContain('../shared');
    expect(local.permissions.additionalDirectories?.filter((dir) => dir === '../shop.worktrees')).toHaveLength(1);
  });

  it('INS-003/S24 A personal settings file that is not a JSON object is left alone', async () => {
    const repo = gitProject('spec-s4-local-array-', 'package.json', { permissions: { allow: ['Bash(existing *)'] } });
    writeFileSync(join(repo, '.claude/settings.local.json'), '[1]');
    const out = await initIn(repo, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(readFileSync(join(repo, '.claude/settings.local.json'), 'utf8')).toBe('[1]');
    const installation = JSON.parse(out.stdout) as { notes: string[]; written: string[] };
    expect(installation.notes).toContain(".claude/settings.local.json is not a JSON object; add '../shop.worktrees' to permissions.additionalDirectories by hand");
    expect(installation.written.length).toBeGreaterThan(0);
    expect(readSettings(repo).permissions.allow).toContain('Skill');
  });

  it('INS-003/S17 Init writes acceptEdits only to local settings after opt-in', async () => {
    const repo = gitProject('spec-s4-accept-edits-', 'package.json', {
      model: 'sonnet',
      permissions: { allow: ['Bash(existing *)'], deny: ['Bash(rm *)'] },
    });
    writeFileSync(join(repo, '.gitignore'), 'existing\n');
    const out = await initIn(repo, '--stack', 'node', '--accept-edits', '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    const settings = readSettings(repo);
    expect(settings.model).toBe('sonnet');
    expect(settings.permissions).not.toHaveProperty('defaultMode');
    expect(readLocal(repo).permissions.defaultMode).toBe('acceptEdits');
    expect(readFileSync(join(repo, '.gitignore'), 'utf8')).toContain('existing\n');
    expect(readFileSync(join(repo, '.gitignore'), 'utf8')).toContain('.claude/settings.local.json');
    expect(settings.permissions.allow).toContain('Bash(existing *)');
    expect(settings.permissions.deny).toEqual(['Bash(rm *)']);
    expect(settings.permissions.allow).not.toContain('Edit');
    expect(settings.permissions.allow).not.toContain('Write');
  });

  it('INS-003/S18 Init without opt-in does not add a personal default mode', async () => {
    const repo = gitProject('spec-s4-default-mode-absent-', 'package.json', {
      permissions: { allow: ['Bash(existing *)'] },
    });
    const out = await initIn(repo);
    expect(out.code, out.stderr).toBe(0);
    expect(readSettings(repo).permissions).not.toHaveProperty('defaultMode');
    expect(readLocal(repo).permissions).not.toHaveProperty('defaultMode');
  });

  it('INS-003/S19 Init without opt-in preserves an existing default mode', async () => {
    const repo = gitProject('spec-s4-default-mode-kept-', 'package.json', {
      permissions: { defaultMode: 'default', allow: ['Bash(existing *)'] },
    });
    const out = await initIn(repo);
    expect(out.code, out.stderr).toBe(0);
    expect(readSettings(repo).permissions.defaultMode).toBe('default');
  });

  it('INS-003/S20 Opt-in keeps and reports a conflicting shared mode', async () => {
    const repo = gitProject('spec-s4-shared-mode-conflict-', 'package.json', {
      permissions: { defaultMode: 'plan', allow: ['Bash(existing *)'] },
    });
    const out = await initIn(repo, '--accept-edits');
    expect(out.code).not.toBe(0);
    expect(out.stderr + out.stdout).toContain('plan');
    expect(out.stderr + out.stdout).toContain('settings.json');
    expect(readSettings(repo).permissions.defaultMode).toBe('plan');
  });

  it('INS-003/S21 Opt-in keeps and reports a conflicting personal mode', async () => {
    const repo = gitProject('spec-s4-local-mode-conflict-', 'package.json', {
      permissions: { allow: ['Bash(existing *)'] },
    });
    const local = { permissions: { defaultMode: 'plan', allow: ['Bash(local *)'] } };
    writeFileSync(join(repo, '.claude/settings.local.json'), JSON.stringify(local, null, 2) + '\n');
    const out = await initIn(repo, '--accept-edits');
    expect(out.code).not.toBe(0);
    expect(out.stderr + out.stdout).toContain('plan');
    expect(out.stderr + out.stdout).toContain('settings.local.json');
    const kept = readLocal(repo);
    expect(kept.permissions.defaultMode).toBe('plan');
    expect(kept.permissions.allow).toContain('Bash(local *)');
  });

  it("INS-003/S25 An older project's plugin ID moves to spec@happyface", async () => {
    for (const command of COMMANDS) {
      const repo = gitProject('spec-s25-' + command.name + '-', 'package.json', { enabledPlugins: { 'spec@spec': true, 'tools@team': false } });
      const out = await command.apply(repo);
      expect(out.code, command.name + ': ' + out.stderr).toBe(0);
      const settings = readSettings(repo);
      expect(settings.enabledPlugins, command.name).toEqual({ 'spec@happyface': true, 'tools@team': false });
      expect(Object.hasOwn(settings.enabledPlugins, 'spec@spec'), command.name).toBe(false);
      expect(settings.extraKnownMarketplaces?.happyface, command.name).toEqual(HAPPYFACE);
      const migrated = settingsText(repo);
      const again = await command.apply(repo);
      expect(again.code, command.name + ' again: ' + again.stderr).toBe(0);
      expect(settingsText(repo), command.name + ' a second time leaves the file unchanged').toBe(migrated);
    }
  });

  it('INS-003/S26 A project that disabled the old ID stays disabled', async () => {
    for (const command of COMMANDS) {
      const repo = gitProject('spec-s26-' + command.name + '-', 'package.json', { enabledPlugins: { 'spec@spec': false } });
      const out = await command.apply(repo);
      expect(out.code, command.name + ': ' + out.stderr).toBe(0);
      expect(readSettings(repo).enabledPlugins, command.name).toEqual({ 'spec@happyface': false });
    }
  });

  it("INS-003/S27 The new ID's value wins over a leftover old ID", async () => {
    for (const command of COMMANDS) {
      const repo = gitProject('spec-s27-' + command.name + '-', 'package.json', { enabledPlugins: { 'spec@spec': true, 'spec@happyface': false } });
      const out = await command.apply(repo);
      expect(out.code, command.name + ': ' + out.stderr).toBe(0);
      expect(readSettings(repo).enabledPlugins, command.name).toEqual({ 'spec@happyface': false });
    }
  });

  it('INS-003/S28 Marketplaces already registered are kept', async () => {
    const registered = {
      happyface: { source: { source: 'github', repo: 'someone/fork' } },
      team: { source: { source: 'git', url: 'https://example.com/team.git' } },
    };
    for (const command of COMMANDS) {
      const repo = gitProject('spec-s28-' + command.name + '-', 'package.json', { extraKnownMarketplaces: registered });
      const out = await command.apply(repo);
      expect(out.code, command.name + ': ' + out.stderr).toBe(0);
      expect(readSettings(repo).extraKnownMarketplaces, command.name).toEqual(registered);
      expect(settingsText(repo), command.name).not.toContain('autoUpdate');
    }
  });

  it('INS-003/S29 A marketplace list that is not a JSON object is left alone', async () => {
    const repo = gitProject('spec-s29-', 'package.json', { extraKnownMarketplaces: ['happyface'] });
    const before = settingsText(repo);
    const out = await initIn(repo, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect(settingsText(repo)).toBe(before);
    const installation = JSON.parse(out.stdout) as { notes: string[]; written: string[] };
    expect(installation.notes).toContain('.claude/settings.json extraKnownMarketplaces is not an object; add the happyface marketplace by hand');
    expect(installation.written).toContain('spec/config.json');
    expect(installation.written.some((path) => path.startsWith('.claude/settings.json'))).toBe(false);
    expect(existsSync(join(repo, 'spec/config.json'))).toBe(true);
    expect(existsSync(join(repo, '.claude/settings.local.json'))).toBe(true);
  });

  it('INV-018 Spec never changes where a registered marketplace points', async () => {
    const forged = { happyface: { source: { source: 'git', url: 'https://example.com/elsewhere.git' } } };
    for (const command of COMMANDS) {
      const repo = gitProject('spec-inv018-' + command.name + '-', 'package.json', { extraKnownMarketplaces: forged, enabledPlugins: { 'spec@happyface': true } });
      const out = await command.apply(repo);
      expect(out.code, command.name + ': ' + out.stderr).toBe(0);
      expect(readSettings(repo).extraKnownMarketplaces, command.name).toEqual(forged);
      expect(settingsText(repo), command.name).not.toContain('autoUpdate');
    }
  });
});
