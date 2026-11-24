// Bundles src/cli into dist/: spec.cjs (the whole CLI, no runtime install) and spec (a launcher).
// The bundle is .cjs so it runs the same under any package.json "type" in the repo it is copied
// into; an extensionless file would follow the nearest package.json. See DECISIONS.md (X2).
import { chmod, mkdir, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { COMMANDS, expandCommand } from '../src/core/commands';
import { build } from 'esbuild';
import { z } from 'zod';
import { ASSETS_PATH, renderAssets } from './gen-assets';
import { MANIFEST_PATH, wantedManifest } from './gen-role-manifest';

const pkg = z.object({ version: z.string() }).parse(JSON.parse(await readFile('package.json', 'utf8')));
const outIndex = process.argv.indexOf('--out');
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
if (outIndex >= 0 && (!outPath || outPath.startsWith('--'))) throw new Error('--out needs a directory');
const pluginOutput = outPath ? resolve(outPath) : process.cwd();
// Roles and templates ride inside the bundle. Isolated plugin builds refuse to refresh tracked assets.
const generatedAssets = renderAssets();
if (outPath) {
  if ((await readFile(ASSETS_PATH, 'utf8')) !== generatedAssets) throw new Error('src/generated/assets.ts is stale; run npx tsx scripts/gen-assets.ts');
} else await writeFile(ASSETS_PATH, generatedAssets);
// The shipped-prompt manifest gains this version's role prompt hashes; earlier entries are never removed (INS-005/R5).
const generatedManifest = wantedManifest();
if (outPath) {
  if ((await readFile(MANIFEST_PATH, 'utf8')) !== generatedManifest) throw new Error('src/generated/role-manifest.ts is stale; run npx tsx scripts/gen-role-manifest.ts');
} else await writeFile(MANIFEST_PATH, generatedManifest);

await build({
  entryPoints: ['src/cli/main.ts'],
  outfile: 'dist/spec.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  minify: true,
  define: { __SPEC_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  logLevel: 'warning',
});

// The launcher has no import or require syntax, so it is valid as CommonJS and as an ES module and
// runs whatever "type" the nearest package.json declares. It loads spec.cjs beside its real path
// (symlinks resolved) through the CommonJS loader, with the compile cache on (Node 22.1+).
// Needs process.getBuiltinModule: Node 20.16+ or 22.3+.
export const LAUNCHER = `#!/usr/bin/env node
const mod = process.getBuiltinModule('node:module');
mod.enableCompileCache?.();
mod.createRequire(process.getBuiltinModule('node:fs').realpathSync(process.argv[1]))('./spec.cjs');
`;

await writeFile('dist/spec', LAUNCHER, 'utf8');
await chmod('dist/spec', 0o755);
await chmod('dist/spec.cjs', 0o755);

const pluginDescription = 'A project specification as a graph of units, with a CLI and Claude Code workflow.';
const namespaceCommands = (text: string): string =>
  text.replace(/(?<![\w/])\/(feature|change|bug|spec-init|run|brief)(?![\w/-])/g, '/spec:$1');
await mkdir(join(pluginOutput, 'plugin/scripts'), { recursive: true });
await writeFile(join(pluginOutput, 'plugin/scripts/spec'), LAUNCHER, 'utf8');
await chmod(join(pluginOutput, 'plugin/scripts/spec'), 0o755);
await writeFile(join(pluginOutput, 'plugin/scripts/spec.cjs'), await readFile('dist/spec.cjs'));
await chmod(join(pluginOutput, 'plugin/scripts/spec.cjs'), 0o755);
if (!outPath) {
  await mkdir('.spec/bin', { recursive: true });
  await writeFile('.spec/bin/spec', LAUNCHER, 'utf8');
  await chmod('.spec/bin/spec', 0o755);
  await writeFile('.spec/bin/spec.cjs', await readFile('dist/spec.cjs'));
  await chmod('.spec/bin/spec.cjs', 0o755);
}

// No version: Claude Code follows the plugin's git commit (INS-014/R1). The happyface marketplace lists the
// plugin, so this repository publishes no marketplace of its own (INS-019/R1); a stale one is removed.
await mkdir(join(pluginOutput, 'plugin/.claude-plugin'), { recursive: true });
await writeFile(join(pluginOutput, 'plugin/.claude-plugin/plugin.json'), JSON.stringify({ name: 'spec', description: pluginDescription }, null, 2) + '\n');
// Only the stale marketplace file goes; the folder goes too only when that leaves it empty.
if (!outPath) {
  await rm('.claude-plugin/marketplace.json', { force: true });
  const left = await readdir('.claude-plugin').catch(() => null);
  if (left !== null && left.length === 0) await rmdir('.claude-plugin');
}

// The installed plugin is this folder alone, and its bundle contains yaml and zod, so the licenses ship inside it.
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await writeFile(join(pluginOutput, 'plugin', file), await readFile(file));

await mkdir(join(pluginOutput, 'plugin/hooks'), { recursive: true });
await writeFile(join(pluginOutput, 'plugin/hooks/hooks.json'), await readFile('plugin/hooks/hooks.json'));
const docsOutput = join(pluginOutput, 'plugin/docs');
await mkdir(docsOutput, { recursive: true });
for (const doc of ['WORKFLOW.md', 'FORMAT.md', 'TICKETS.md']) await writeFile(join(docsOutput, doc), await readFile(join('docs', doc)));
await mkdir(join(pluginOutput, 'plugin/skills/spec'), { recursive: true });
await writeFile(join(pluginOutput, 'plugin/skills/spec/SKILL.md'), await readFile('plugin/skills/spec/SKILL.md'));

const interview = await readFile('templates/commands/_interview.md', 'utf8');
const drive = await readFile('templates/commands/_drive.md', 'utf8');
await mkdir(join(pluginOutput, 'plugin/skills'), { recursive: true });
await rm(join(pluginOutput, 'plugin/skills/orchestrate'), { recursive: true, force: true });
for (const command of COMMANDS) {
  const template = await readFile('templates/commands/' + command + '.md', 'utf8');
  await mkdir(join(pluginOutput, 'plugin/skills/' + command), { recursive: true });
  await writeFile(join(pluginOutput, 'plugin/skills/' + command + '/SKILL.md'), namespaceCommands(expandCommand(template, interview, drive, '.spec/bin/spec', 'this project')));
}
let brief = (await readFile('templates/SKILL.md', 'utf8'))
  .replace('name: {project}-spec', 'name: brief')
  .replace('description: Source of truth for how {project} behaves.', 'description: Source of truth for how this project behaves.')
  .replaceAll('${CLAUDE_SKILL_DIR}/scripts/spec', '.spec/bin/spec')
  .replaceAll('{project}', 'this project');
await mkdir(join(pluginOutput, 'plugin/skills/brief'), { recursive: true });
brief = brief.replace('---\n```!', '---\n\nIf `.spec/bin/spec` is missing, ask Claude to run `/spec:spec` to set up this project.\n\n```!');
await writeFile(join(pluginOutput, 'plugin/skills/brief/SKILL.md'), namespaceCommands(brief));
