// The implementer must replace the SPEC-STUB markers its ticket's branch added, and only those
// (ADR-001, I7): code and docs on the base branch may mention the marker.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filesAddingStubs } from '../../src/core/stubs';
import { gitFixture, report } from '../helpers';

const NOTE = '// Stubs are marked SPEC-STUB.\n';
const fx = gitFixture('spec-stubs-branch', {
  setup: (dir) => {
    writeFileSync(join(dir, 'src/notes.ts'), `${NOTE}export const NOTES = 1;\n`);
  },
});
afterAll(fx.cleanup);

const done = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection');
const check = async () => JSON.parse((await fx.spec(done, 'check-report', 'implementer', 'TASK-101', '--format', 'json')).stdout) as { ok: boolean; problems: string[] };

beforeAll(async () => {
  expect((await fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')).code).toBe(0);
});

describe('stubs are counted on the ticket branch only', () => {
  it('PIP-006/S18 A marker already on the base branch is no stub', async () => {
    expect(await check()).toMatchObject({ ok: true, problems: [] });
    // An edit to a line that held the marker on main adds no stub either.
    const notes = join(fx.repo, 'src/notes.ts');
    writeFileSync(notes, readFileSync(notes, 'utf8').replace(NOTE, '// Stubs are marked SPEC-STUB, each one.\n'));
    expect(await check()).toMatchObject({ ok: true, problems: [] });
    expect(filesAddingStubs([{ path: 'a.ts', hunks: [{ removed: ['// SPEC-STUB a'], added: ['// SPEC-STUB b'] }] }])).toEqual([]);
  }, 120_000);

  it('PIP-006/S15 The implementer replaces every stub', async () => {
    appendFileSync(join(fx.repo, 'src/app.ts'), "// SPEC-STUB TASK-101: throw new Error('not yet')\n");
    fx.git('commit', '-qam', 'TASK-101 tester: a stub');
    expect((await check()).problems).toEqual(['SPEC-STUB is still in src/app.ts; replace every stub with the real code']);
    writeFileSync(join(fx.repo, 'src/extra.ts'), '// SPEC-STUB TASK-101\n');
    expect((await check()).problems).toEqual(['SPEC-STUB is still in src/app.ts, src/extra.ts; replace every stub with the real code']);
  }, 120_000);
});
