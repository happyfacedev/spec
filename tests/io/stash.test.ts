// The CLI's stash entries (src/io/stash.ts). Entries are addressed by position, and anything may
// push one at any time; a drop must still remove the entry it means (ADR-002).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { restoreStash } from '../../src/io/stash';
import { gitFixture } from '../helpers';

const fx = gitFixture('spec-stash-drop');
afterAll(fx.cleanup);

describe('restoring a stage\'s stash', () => {
  it('PIP-002/S27 The stage\'s own stash is dropped, though another entry was pushed meanwhile', () => {
    const name = 'TASK-101 implementer: blocked';
    writeFileSync(join(fx.repo, 'src/extra.ts'), 'export const extra = 1;\n');
    expect(fx.git('stash', 'push', '-u', '-q', '-m', name).code).toBe(0);
    const r = restoreStash(fx.repo, name, {
      // Someone else's entry lands on top just before the drop, moving ours to stash@{1}.
      beforeDrop: () => {
        writeFileSync(join(fx.repo, 'src/state.ts'), `${readFileSync(join(fx.repo, 'src/state.ts'), 'utf8')}// someone else\n`);
        expect(fx.git('stash', 'push', '-q', '-m', 'someone else', '--', 'src/state.ts').code).toBe(0);
      },
    });
    expect(r).toEqual({ ok: true, restored: true });
    expect(fx.git('stash', 'list', '--format=%gs').stdout).toBe('On main: someone else\n');
    expect(readFileSync(join(fx.repo, 'src/extra.ts'), 'utf8')).toBe('export const extra = 1;\n');
    // The stash lock is let go.
    expect(existsSync(join(fx.repo, '.git/spec/stash.lock'))).toBe(false);
  });
});
