// Every lint rule has a case under lint-cases/<rule>/: a one-change overlay on _base and the
// reviewed findings it must produce (expected.json, a file snapshot).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RULES, type RuleId } from '../../src/core/findings';
import { toJson } from '../../src/core/graph';
import { lintSpec } from '../../src/core/lint';
import { parseSpec } from '../../src/core/parse/spec';
import { parseTickets } from '../../src/core/parse/tickets';
import type { SourceFile } from '../../src/core/source';
import { loadDir } from '../../src/io/fs';

const DIR = join(import.meta.dirname, 'lint-cases');
const BASE = join(DIR, '_base');

/** Rules checked at the CLI level, where the harness's files live, and where their tests are. */
const PENDING: Partial<Record<string, string>> = {
  L024: 'CLI level: tests/cli/cli.test.ts',
  L028: 'CLI level: tests/cli/lint-scenarios.test.ts',
  L029: 'CLI level: tests/cli/delegation-config.test.ts',
  L030: 'CLI level: tests/cli/delegation-config.test.ts',
  L031: 'CLI level: tests/cli/delegation-config.test.ts',
  L032: 'CLI level: tests/cli/delegation-config.test.ts',
  L033: 'CLI level: tests/cli/lint-scenarios.test.ts',
  L034: 'CLI level: tests/cli/lint-scenarios.test.ts',
  L035: 'CLI level: tests/cli/lint-base.test.ts',
  L036: 'CLI level: tests/cli/lint-scenarios.test.ts',
  L037: 'CLI level: tests/cli/lint-unreadable-scenarios.test.ts',
};

const CaseFile = z.strictObject({
  description: z.string(),
  ci: z.boolean().default(false),
  /** Paths to drop from the base, prefixed spec/ or tickets/. */
  remove: z.array(z.string()).default([]),
  budgets: z.record(z.string(), z.number()).default({}),
});

function overlay(base: SourceFile[], extra: SourceFile[], remove: string[]): SourceFile[] {
  const byPath = new Map(base.filter((f) => !remove.includes(f.path)).map((f) => [f.path, f]));
  for (const f of extra) byPath.set(f.path, f);
  return [...byPath.values()];
}

export function loadCase(dir: string | null) {
  const c = dir ? CaseFile.parse(JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'))) : CaseFile.parse({ description: 'base' });
  const strip = (prefix: string) => c.remove.filter((r) => r.startsWith(prefix)).map((r) => r.slice(prefix.length));
  const spec = overlay(loadDir(join(BASE, 'spec')), dir ? loadDir(join(dir, 'spec')) : [], strip('spec/'));
  const tickets = overlay(loadDir(join(BASE, 'tickets'), BASE), dir ? loadDir(join(dir, 'tickets'), dir) : [], c.remove);
  return { c, findings: lintSpec(parseSpec(spec), { tickets: parseTickets(tickets), ci: c.ci, budgets: c.budgets }) };
}

describe('lint cases', () => {
  it('the base spec lints with no findings at all', () => {
    expect(loadCase(null).findings).toEqual([]);
  });

  for (const rule of Object.keys(RULES) as RuleId[]) {
    const dir = join(DIR, rule);
    const pending = PENDING[rule];
    if (pending) {
      it(`${rule} ${RULES[rule]} is covered at the ${pending}`, () => {
        expect(pending).toMatch(/tests\/cli\//);
      });
      continue;
    }
    it(`${rule} ${RULES[rule]}`, async () => {
      expect(existsSync(join(dir, 'case.json')), `missing lint case for ${rule}`).toBe(true);
      const { findings } = loadCase(dir);
      expect(findings.some((f) => f.rule === rule), `no ${rule} finding`).toBe(true);
      await expect(toJson(findings)).toMatchFileSnapshot(join(dir, 'expected.json'));
    });
  }
});
