// INV-007: each lint rule code names one check for good, so a code two branches each added for different
// checks is renumbered on one of them before it merges. The base branch's rule table is read from git.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/findings';
import { git } from '../../src/io/git';
import { REPO } from '../helpers';

/** The code-to-name entries of a RULES table in source text. */
const table = (source: string): Record<string, string> =>
  Object.fromEntries([...source.matchAll(/^\s*(L\d{3}): '([^']+)',/gm)].map((m) => [m[1] ?? '', m[2] ?? '']));

describe('INV-007: A lint rule code keeps its meaning', () => {
  it('INV-007 A lint rule code keeps its meaning', () => {
    const config = JSON.parse(readFileSync(join(REPO, 'spec/config.json'), 'utf8')) as { baseBranch?: string };
    const base = config.baseBranch ?? 'main';
    const shown = git(REPO, ['show', `${base}:src/core/findings.ts`]);
    // Locally, a fresh repository without the base branch has nothing to compare with. In CI a missing
    // base would let a reused code through unseen, so it fails there.
    if (shown.code !== 0) {
      expect(process.env.CI ?? '', `CI cannot read ${base}:src/core/findings.ts; fetch the base branch in the job`).toBe('');
      return;
    }
    const before = table(shown.stdout);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    const changed = Object.entries(before)
      .filter(([code, name]) => code in RULES && (RULES as Record<string, string>)[code] !== name)
      .map(([code, name]) => `${code}: ${base} has '${name}', this branch has '${(RULES as Record<string, string>)[code]}'`);
    expect(changed).toEqual([]);
  });
});
