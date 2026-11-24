import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { REPO, tempDir } from '../helpers';

const repo = tempDir('spec-s4-init-stack-');
const launcher = join(REPO, 'plugin/scripts/spec');
afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('INS-001 init stack defaults', () => {
  it('INS-001/S26 Init prefills the selected stack defaults', async () => {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { jest: '^30.0.0' } }));
    mkdirSync(join(repo, 'src'));
    mkdirSync(join(repo, 'tests'));
    const out = await run({ argv: ['init', '.', '--name', 'shop', '--stack', 'node', '--format', 'json'], env: {}, cwd: repo, scriptPath: launcher });
    expect(out.code, out.stderr).toBe(0);
    const config = JSON.parse(readFileSync(join(repo, 'spec/config.json'), 'utf8')) as Record<string, unknown>;
    expect(config).toMatchObject({
      name: 'shop',
      testCommand: 'npx jest -t "{filter}" --json --outputFile="{report}"',
      codeGlobs: ['src/**'],
      testGlobs: ['tests/**'],
    });
  });
});
