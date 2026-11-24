import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, tempDir } from '../helpers';

const made: string[] = [];
function project(): string {
  const dir = tempDir('spec-s4-');
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const cli = (cwd: string, argv: string[], env: Record<string, string | undefined> = {}) =>
  run({ argv, cwd, env, scriptPath: undefined });

describe('CLI-008 detect and config set', () => {
  it('CLI-008/S1 Detect an empty repository without a spec', async () => {
    const cwd = project();
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual({ state: 'empty', dirty: false, git: false, stacks: [], harness: null, missingModels: [], models: [], editMode: 'default' });
  });

  it('CLI-008/S2 Detect stack defaults and current Git state', async () => {
    const cwd = project();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^5.0.0' } }));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
    execFileSync('git', ['add', 'package.json'], { cwd });
    execFileSync('git', ['commit', '-q', '-m', 'fixture'], { cwd });
    writeFileSync(join(cwd, 'src.ts'), 'export {}\n');
    const out = await cli(cwd, ['detect', '--format', 'json'], { ASTRO_RUN_ID: 'run-1' });
    expect(out.code).toBe(0);
    const detected = JSON.parse(out.stdout) as { state: string; dirty: boolean; git: boolean; baseBranch?: string; harness: string | null; stacks: { name: string; manifest: string; testCommand: string; codeGlobs: string[]; testGlobs: string[] }[] };
    expect(detected).toMatchObject({ state: 'code', dirty: true, git: true, baseBranch: 'main', harness: 'astro' });
    expect(detected.stacks).toHaveLength(1);
    expect(detected.stacks[0]).toMatchObject({ name: 'node', manifest: 'package.json', codeGlobs: ['src/**'], testGlobs: ['tests/**'] });
    expect(detected.stacks[0]?.testCommand).toContain('vitest run');
  });

  it('CLI-008/S3 Recognize a current spec and the Claude Code harness', async () => {
    const cwd = project();
    mkdirSync(join(cwd, 'spec'));
    writeFileSync(join(cwd, 'spec/config.json'), '{}');
    const out = await cli(cwd, ['detect', '--format', 'json'], { CLAUDECODE: '1' });
    expect(JSON.parse(out.stdout)).toMatchObject({ state: 'spec', harness: 'claude-code' });
  });

  it('CLI-008/S4 Recognize a legacy skill installation', async () => {
    const cwd = project();
    const skill = join(cwd, '.claude/skills/shop-spec');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'skill.json'), JSON.stringify({ specRoot: 'spec' }));
    mkdirSync(join(cwd, 'spec'));
    writeFileSync(join(cwd, 'spec/config.json'), '{}');
    expect(existsSync(join(cwd, '.spec/bin/spec.cjs'))).toBe(false);
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(JSON.parse(out.stdout)).toMatchObject({ state: 'legacy-spec' });
  });

  it('CLI-008/S5 Set a shared config value without reformatting other keys', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const original = '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test"\n}\n';
    const config = join(spec, 'config.json');
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'opus', '--root', spec, '--format', 'json']);
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ path: 'spec/config.json', key: 'delegation.claude-code.reviewer', value: 'opus', local: false });
    expect(readFileSync(config, 'utf8')).toBe(original.replace('"testCommand": "npm test"\n}', '"testCommand": "npm test",\n  "delegation": {"claude-code": {"reviewer": "opus"}}\n}'));
  });

  it('CLI-008/S6 Save a personal delegation override', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    writeFileSync(join(spec, '.gitignore'), '_generated/\nkeep\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'opus', '--local', '--root', spec]);
    expect(out.code).toBe(0);
    expect(JSON.parse(readFileSync(join(spec, 'config.local.json'), 'utf8'))).toEqual({ delegation: { 'claude-code': { reviewer: 'opus' } } });
    expect(readFileSync(config, 'utf8')).toBe(original);
    expect(readFileSync(join(spec, '.gitignore'), 'utf8')).toBe('_generated/\nkeep\nconfig.local.json\n');
    expect(existsSync(config)).toBe(true);
  });

  it('CLI-008/S9 Unrecognized code asks for a stack', async () => {
    const cwd = project();
    writeFileSync(join(cwd, 'README.md'), 'a readme does not identify a stack\\n');
    writeFileSync(join(cwd, 'src.ts'), 'export {}\\n');
    const out = await cli(cwd, ['detect', '--format', 'json']);
    const detected = JSON.parse(out.stdout) as { state: string; stacks: { name: string; manifest: string; testCommand: string }[] };
    expect(detected.state).toBe('code');
    expect(detected.stacks[0]).toMatchObject({ name: 'other', manifest: 'unknown' });
    expect(detected.stacks[0]?.testCommand).toContain('configure testCommand');
  });

  it('CLI-008/S8 Detect Jest from the Node manifest', async () => {
    const cwd = project();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ devDependencies: { jest: '^30.0.0' } }));
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(JSON.parse(out.stdout)).toMatchObject({
      stacks: [{ name: 'node', testCommand: 'npx jest -t "{filter}" --json --outputFile="{report}"' }],
    });
  });

  it('CLI-008/S10 Detect Flutter at the root and in a nested app', async () => {
    const root = project();
    writeFileSync(join(root, 'pubspec.yaml'), 'name: root_app\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const rootOut = await cli(root, ['detect', '--format', 'json']);
    const rootDetection = JSON.parse(rootOut.stdout) as { stacks: { name: string; manifest: string }[] };
    expect(rootDetection.stacks[0]).toMatchObject({ name: 'flutter', manifest: 'pubspec.yaml' });

    const nested = project();
    mkdirSync(join(nested, 'apps/mobile'), { recursive: true });
    writeFileSync(join(nested, 'apps/mobile/pubspec.yaml'), 'name: mobile_app\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const nestedOut = await cli(nested, ['detect', '--format', 'json']);
    const nestedDetection = JSON.parse(nestedOut.stdout) as { stacks: { name: string; manifest: string; codeGlobs: string[]; worktreeSetup?: string }[] };
    expect(nestedDetection.stacks[0]).toMatchObject({
      name: 'flutter',
      manifest: 'apps/mobile/pubspec.yaml',
      codeGlobs: ['apps/mobile/lib/**'],
      worktreeSetup: 'cd "apps/mobile" && flutter pub get',
    });
  });

  it('CLI-008/S11 Detect Jest from a cross-env script', async () => {
    const cwd = project();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'cross-env CI=1 jest --runInBand' } }));
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(JSON.parse(out.stdout)).toMatchObject({
      stacks: [{ name: 'node', testCommand: 'npx jest -t "{filter}" --json --outputFile="{report}"' }],
    });
  });

  it('CLI-008/S12 Text detection prints real line breaks', async () => {
    const cwd = project();
    writeFileSync(join(cwd, 'src.ts'), 'export {}\n');
    const out = await cli(cwd, ['detect']);
    // One line for each detection field, the new cli.Detection.models among them, and the final newline.
    const lines = out.stdout.split('\n');
    expect(lines).toHaveLength(10);
    expect(lines.at(-1)).toBe('');
    // With no active harness the models field reports none (CLI-008/R13).
    expect(lines.filter((line) => line.startsWith('models:'))).toEqual(['models: none']);
    expect(out.stdout).toContain('edit mode: default\n');
    expect(out.stdout).not.toContain('\\n');
    expect(out.stdout).toContain('state: code\ngit:');
    expect(out.stdout).toContain('missing models: none');
    expect(out.stdout.endsWith('\n')).toBe(true);
  });

  it('CLI-008/S13 Ignore operating-system and editor metadata when detecting an empty repository', async () => {
    const cwd = project();
    writeFileSync(join(cwd, '.DS_Store'), 'metadata');
    writeFileSync(join(cwd, 'Thumbs.db'), 'metadata');
    writeFileSync(join(cwd, '.editorconfig'), 'root = true\n');
    mkdirSync(join(cwd, '.claude'));
    mkdirSync(join(cwd, '.idea'));
    mkdirSync(join(cwd, '.vscode'));
    writeFileSync(join(cwd, '.claude/settings.json'), '{}');
    writeFileSync(join(cwd, '.idea/workspace.xml'), '<project/>');
    writeFileSync(join(cwd, '.vscode/settings.json'), '{}');
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ state: 'empty', git: false, dirty: false });
  });

  it('CLI-008/S14 Set an underscore-containing project name', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'name', 'chat_app', '--root', spec, '--format', 'json']);
    expect(out.code).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ name: 'chat_app' });
  });

  it('CLI-008/S15 Detect a legacy skill with an underscore slug', async () => {
    const cwd = project();
    const skill = join(cwd, '.claude/skills/chat_app-spec');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'skill.json'), JSON.stringify({ specRoot: 'spec' }));
    mkdirSync(join(cwd, 'spec'));
    writeFileSync(join(cwd, 'spec/config.json'), '{}');
    expect(existsSync(join(cwd, '.spec/bin/spec.cjs'))).toBe(false);
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(JSON.parse(out.stdout)).toMatchObject({ state: 'legacy-spec' });
  });

  it('CLI-008/S16 Set check commands as JSON', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const original = '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test"\n}\n';
    const config = join(spec, 'config.json');
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'checkCommands', '["npm run lint"]', '--root', spec, '--format', 'json']);
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ key: 'checkCommands', value: ['npm run lint'], path: 'spec/config.json' });
    expect(readFileSync(config, 'utf8')).toBe(original.replace('"testCommand": "npm test"\n}', '"testCommand": "npm test",\n  "checkCommands": ["npm run lint"]\n}'));
  });

  it.each(['claude-sonnet-5-5', 'inherit', 'opus-4'])('CLI-008/S31 Detect treats invalid model %s as missing', async (model) => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    writeFileSync(join(spec, 'config.json'), JSON.stringify({
      formatVersion: 2,
      testCommand: 'npm test',
      delegation: { 'claude-code': { implementer: 'opus', reviewer: model } },
    }));
    const out = await cli(cwd, ['detect', '--format', 'json'], { CLAUDECODE: '1' });
    const detected = JSON.parse(out.stdout) as { harness: string | null; missingModels: string[] };
    expect(out.code).toBe(0);
    expect(detected.harness).toBe('claude-code');
    expect(detected.missingModels).toContain('reviewer');
    expect(readFileSync(join(import.meta.dirname, '../../plugin/skills/spec/SKILL.md'), 'utf8')).toContain('detect.missingModels');
  });

  it('CLI-008/S17 Detect reports roles missing for the active harness', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    writeFileSync(join(spec, 'config.json'), JSON.stringify({ formatVersion: 2, testCommand: 'npm test', delegation: { 'claude-code': { implementer: 'opus' } } }));
    const out = await cli(cwd, ['detect', '--format', 'json'], { CLAUDECODE: '1' });
    const detected = JSON.parse(out.stdout) as { harness: string | null; missingModels: string[] };
    expect(detected).toMatchObject({ harness: 'claude-code', missingModels: ['spec-writer', 'tester', 'reviewer'] });
  });

  it('CLI-008/S19 refuses a custom delegation harness without --force', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'delegation.custom-harness.implementer', 'model-x', '--root', spec]);
    expect(out.code).toBe(2);
    expect(out.stderr).toContain('--force');
    expect(readFileSync(config, 'utf8')).toBe(original);
  });

  it('CLI-008/S20 --force permits a custom delegation harness', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.custom-harness.implementer', 'model-x', '--force', '--root', spec]);
    expect(out.code).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { 'custom-harness': { implementer: 'model-x' } } });
    const lint = await cli(cwd, ['lint', '--format', 'json', '--root', spec]);
    const findings = (JSON.parse(lint.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(lint.code).toBe(0);
    expect(findings.some((item) => item.rule === 'L029' && item.message.includes('custom-harness'))).toBe(true);
  });

  it('CLI-008/S21 accepts Claude Code sonnet', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'sonnet', '--root', spec]);
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { 'claude-code': { reviewer: 'sonnet' } } });
  });

  it('CLI-008/S22 accepts Claude Code opus', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'opus', '--root', spec]);
    expect(out.code).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { 'claude-code': { reviewer: 'opus' } } });
  });

  it('CLI-008/S23 refuses inherit as a Claude Code model', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'inherit', '--root', spec]);
    expect(out.code).toBe(2);
    expect(out.stderr).toContain('inherit');
    expect(readFileSync(config, 'utf8')).toBe(original);
  });

  it('CLI-008/S24 refuses full Claude model IDs', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'claude-haiku-4-5', '--root', spec]);
    expect(out.code).toBe(2);
    expect(readFileSync(config, 'utf8')).toBe(original);
  });

  it('CLI-008/S25 --force does not permit an unsupported Claude model', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'opus-4', '--force', '--root', spec]);
    expect(out.code).toBe(2);
    expect(readFileSync(config, 'utf8')).toBe(original);
  });
  it('CLI-008/S26 A pinned current CLI keeps a legacy skill project in the spec state', async () => {
    const cwd = project();
    const skill = join(cwd, '.claude/skills/shop-spec');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'skill.json'), JSON.stringify({ specRoot: 'spec' }));
    mkdirSync(join(cwd, 'spec'));
    writeFileSync(join(cwd, 'spec/config.json'), '{}');
    mkdirSync(join(cwd, '.spec/bin'), { recursive: true });
    writeFileSync(join(cwd, '.spec/bin/spec.cjs'), '');
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(JSON.parse(out.stdout)).toMatchObject({ state: 'spec' });
  });

  it('CLI-008/S27 accepts Claude Code haiku', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'haiku', '--root', spec]);
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { 'claude-code': { reviewer: 'haiku' } } });
  });

  it('CLI-008/S28 accepts Claude Code fable', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.claude-code.reviewer', 'fable', '--root', spec]);
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { 'claude-code': { reviewer: 'fable' } } });
  });

  it('CLI-008/S29 accepts Astro delegate role values as free-form strings', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    writeFileSync(config, '{\n  "formatVersion": 2,\n  "testCommand": "npm test"\n}\n');
    const out = await cli(cwd, ['config', 'set', 'delegation.astro.implementer', 'flutter-implementer', '--root', spec]);
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ delegation: { astro: { implementer: 'flutter-implementer' } } });
  });

  it('CLI-008/S30 Invalid SPEC_HARNESS produces no active harness or missing models', async () => {
    const cwd = project();
    mkdirSync(join(cwd, 'spec'));
    writeFileSync(join(cwd, 'spec/config.json'), JSON.stringify({
      formatVersion: 2,
      testCommand: 'npm test',
      delegation: { 'claude-code': { implementer: 'opus' } },
    }));
    const out = await cli(cwd, ['detect', '--format', 'json'], { SPEC_HARNESS: 'custom', CLAUDECODE: '1' });
    const detected = JSON.parse(out.stdout) as { harness: string | null; missingModels: string[] };
    expect(out.code).toBe(0);
    expect(detected.harness).toBeNull();
    expect(detected.missingModels).toEqual([]);
  });

  const settings = (cwd: string, file: string, content: string) => {
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    writeFileSync(join(cwd, '.claude', file), content);
  };
  const mode = (value: unknown) => JSON.stringify({ permissions: { defaultMode: value } });

  it('CLI-008/S33 Detect reports the personal edit mode before the shared one', async () => {
    const cwd = project();
    const local = mode('acceptEdits');
    const shared = mode('plan');
    settings(cwd, 'settings.local.json', local);
    settings(cwd, 'settings.json', shared);
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as { editMode: string }).editMode).toBe('acceptEdits');
    const text = await cli(cwd, ['detect']);
    expect(text.stdout.split('\n')).toContain('edit mode: acceptEdits');
    expect(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8')).toBe(local);
    expect(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).toBe(shared);
  });

  it('CLI-008/S34 Detect falls back to the shared edit mode, then to default', async () => {
    const cwd = project();
    settings(cwd, 'settings.json', mode('plan'));
    const out = await cli(cwd, ['detect', '--format', 'json']);
    const detected = JSON.parse(out.stdout) as { editMode: string; harness: string | null };
    expect(detected.editMode).toBe('plan');
    expect(detected.harness).toBeNull();
    const bare = project();
    settings(bare, 'settings.json', JSON.stringify({ permissions: {} }));
    const none = await cli(bare, ['detect', '--format', 'json']);
    expect((JSON.parse(none.stdout) as { editMode: string }).editMode).toBe('default');
    const empty = project();
    expect((JSON.parse((await cli(empty, ['detect', '--format', 'json'])).stdout) as { editMode: string }).editMode).toBe('default');
  });

  it('CLI-008/S35 A broken settings file sets no edit mode', async () => {
    const cwd = project();
    settings(cwd, 'settings.local.json', '{ not json');
    settings(cwd, 'settings.json', mode('acceptEdits'));
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as { editMode: string }).editMode).toBe('acceptEdits');
    for (const bad of [42, '']) {
      const other = project();
      settings(other, 'settings.local.json', mode(bad));
      settings(other, 'settings.json', JSON.stringify({}));
      const res = await cli(other, ['detect', '--format', 'json']);
      expect((JSON.parse(res.stdout) as { editMode: string }).editMode).toBe('default');
    }
  });

  const put = (cwd: string, rel: string, content: string) => {
    mkdirSync(join(cwd, rel, '..'), { recursive: true });
    writeFileSync(join(cwd, rel), content);
  };
  const vitestPkg = JSON.stringify({ devDependencies: { vitest: '^5.0.0' } });
  const flutterPubspec = 'name: mobile_app\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n';
  const manifests = (stdout: string) => (JSON.parse(stdout) as { stacks: { manifest: string }[] }).stacks.map((s) => s.manifest).sort();

  it('CLI-008/S36 Detect skips manifests under fixture, test and example folders', async () => {
    const cwd = project();
    put(cwd, 'package.json', vitestPkg);
    put(cwd, 'apps/mobile/pubspec.yaml', flutterPubspec);
    put(cwd, 'fixtures/dart-mini/pubspec.yaml', 'name: mini\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n');
    put(cwd, 'tests/fixtures/py/requirements.txt', 'pytest\n');
    put(cwd, 'Examples/go.mod', 'module example.com/demo\n');
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect(manifests(out.stdout)).toEqual(['apps/mobile/pubspec.yaml', 'package.json']);
  });

  it('CLI-008/S37 Detect skips manifests the config test globs match', async () => {
    const cwd = project();
    put(cwd, 'package.json', vitestPkg);
    put(cwd, 'e2e/app/package.json', vitestPkg);
    put(cwd, 'spec/config.json', JSON.stringify({ formatVersion: 2, name: 'shop', testCommand: 'npm test', testGlobs: ['tests/**', 'e2e/**'] }));
    const out = await cli(cwd, ['detect', '--format', 'json']);
    expect(out.code).toBe(0);
    expect(manifests(out.stdout)).toEqual(['package.json']);

    const broken = project();
    put(broken, 'package.json', vitestPkg);
    put(broken, 'e2e/app/package.json', vitestPkg);
    put(broken, 'spec/config.json', '{ not json');
    const res = await cli(broken, ['detect', '--format', 'json']);
    expect(res.code).toBe(0);
    expect(manifests(res.stdout)).toEqual(['e2e/app/package.json', 'package.json']);
  });

  it('CLI-008/S38 Init and upgrade add command rules only for the project\'s own stacks', async () => {
    const allowed = (repo: string) =>
      (JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8')) as { permissions: { allow: string[] } }).permissions.allow;
    const shop = (): string => {
      const repo = project();
      put(repo, 'package.json', vitestPkg);
      put(repo, 'fixtures/dart-mini/pubspec.yaml', 'name: mini\nenvironment:\n  sdk: ">=3.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n');
      put(repo, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(go test *)'] } }));
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
      execFileSync('git', ['add', '-A'], { cwd: repo });
      execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: repo });
      return repo;
    };
    const scriptPath = join(REPO, 'plugin/scripts/spec');
    const check = (rules: string[]) => {
      expect(rules).toContain('Bash(npx vitest *)');
      expect(rules.filter((r) => r.startsWith('Bash(dart ') || r.startsWith('Bash(flutter '))).toEqual([]);
      expect(rules).toContain('Bash(go test *)');
    };

    const init = shop();
    const inited = await run({ argv: ['init', '.', '--name', 'shop', '--stack', 'node', '--format', 'json'], env: {}, cwd: init, scriptPath });
    expect(inited.code, inited.stderr).toBe(0);
    check(allowed(init));

    const upgrade = shop();
    const first = await run({ argv: ['init', '.', '--name', 'shop', '--stack', 'node', '--format', 'json'], env: {}, cwd: upgrade, scriptPath });
    expect(first.code, first.stderr).toBe(0);
    put(upgrade, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(go test *)'] } }));
    const upgraded = await run({ argv: ['upgrade', '.', '--from', join(REPO, 'plugin/scripts'), '--format', 'json'], env: {}, cwd: upgrade, scriptPath });
    expect(upgraded.code, upgraded.stderr).toBe(0);
    check(allowed(upgrade));
  });

  it('CLI-008/S7 Refuse unsupported or schema-invalid config without writing', async () => {
    const cwd = project();
    const spec = join(cwd, 'spec');
    mkdirSync(spec);
    const config = join(spec, 'config.json');
    const original = '{\n  "formatVersion": 2,\n  "name": "shop",\n  "testCommand": "npm test"\n}\n';
    writeFileSync(config, original);
    expect((await cli(cwd, ['config', 'set', 'unknown', 'x', '--root', spec])).code).toBe(2);
    expect((await cli(cwd, ['config', 'set', 'name', 'UPPER', '--root', spec])).code).toBe(2);
    expect((await cli(cwd, ['config', 'set', 'testCommand', 'npm test', '--local', '--root', spec])).code).toBe(2);
    // A local key other than delegation and unavailableModels is refused; unavailableModels is never shared and takes only an alias set to true or false.
    expect((await cli(cwd, ['config', 'set', 'name', 'shop', '--local', '--root', spec])).code).toBe(2);
    expect((await cli(cwd, ['config', 'set', 'unavailableModels.opus', 'true', '--root', spec])).code).toBe(2);
    expect((await cli(cwd, ['config', 'set', 'unavailableModels.gpt', 'true', '--local', '--root', spec])).code).toBe(2);
    expect((await cli(cwd, ['config', 'set', 'unavailableModels.opus', 'maybe', '--local', '--root', spec])).code).toBe(2);
    expect(readFileSync(config, 'utf8')).toBe(original);
    expect(existsSync(join(spec, 'config.local.json'))).toBe(false);
  });
});
