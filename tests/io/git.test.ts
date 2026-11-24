import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir } from '../helpers';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filesContaining, git } from '../../src/io/git';

describe('filesContaining', () => {
  let dir = '';
  const saved = { ...process.env };
  beforeAll(() => {
    dir = tempDir('spec-git-');
    git(dir, ['init', '-q']);
    mkdirSync(join(dir, 'lib'));
    writeFileSync(join(dir, 'lib/tracked.dart'), '// SPEC-STUB PROP-1\n');
    writeFileSync(join(dir, 'lib/clean.dart'), 'void main() {}\n');
    git(dir, ['add', '.']);
    writeFileSync(join(dir, 'lib/untracked.dart'), '// SPEC-STUB PROP-1\n');
  });
  afterAll(() => {
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds tracked and untracked matches', () => {
    expect(filesContaining(dir, 'SPEC-STUB', ['lib/**'])).toEqual(['lib/tracked.dart', 'lib/untracked.dart']);
  });

  it('still works when the user config sets submodule.recurse', () => {
    process.env = { ...saved, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'submodule.recurse', GIT_CONFIG_VALUE_0: 'true' };
    expect(filesContaining(dir, 'SPEC-STUB', ['lib/**'])).toEqual(['lib/tracked.dart', 'lib/untracked.dart']);
  });
});

