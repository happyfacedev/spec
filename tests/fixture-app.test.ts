// chat-mini must stay easy, testable and verifiable: every scenario has exactly one visible test
// named "<ScenarioID> <title>" (except the planted gap), the visible suite passes, and the planted
// BUG-301 is real: its hidden test fails on main and passes with the reference fix.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compareIds } from '../src/core/ids';
import { lintSpec } from '../src/core/lint';
import { parseSpec } from '../src/core/parse/spec';
import { loadDir } from '../src/io/fs';
import { tempDir } from './helpers';

const REPO = join(import.meta.dirname, '..');
const APP = join(REPO, 'fixtures/chat-mini');
const SPEC = join(APP, 'spec');
const HIDDEN = join(REPO, 'evals/hidden/chat-mini');
const VITEST = join(REPO, 'node_modules/vitest/vitest.mjs');

/** Scenarios main deliberately ships without a visible test (handoff: how BUG-301 slipped through). */
const PLANTED_GAPS = ['PRV-002/S3'];

const TEST_NAME = /\bit\(\s*(['"`])([A-Z]{2,4}-\d{3,4}\/S\d+) (.+?)\1/g;

function visibleTests(): { id: string; title: string; file: string }[] {
  const dir = join(APP, 'tests');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.test.ts'))
    .flatMap((file) => [...readFileSync(join(dir, file), 'utf8').matchAll(TEST_NAME)].map((m) => ({ id: m[2] ?? '', title: m[3] ?? '', file })));
}

const Report = z.object({
  numFailedTests: z.number(),
  numPassedTests: z.number(),
  testResults: z.array(z.object({ assertionResults: z.array(z.object({ title: z.string(), status: z.string() })) })),
});

const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

/** A throwaway copy of chat-mini that resolves vitest from this repo. */
function copyApp(): string {
  const dir = tempDir('chat-mini-');
  temps.push(dir);
  cpSync(APP, dir, { recursive: true, filter: (src) => !src.includes('/node_modules') });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}

function runTests(root: string): Map<string, string> {
  const report = join(root, '.report.json');
  const r = spawnSync(process.execPath, [VITEST, 'run', '--root', root, '--reporter=json', `--outputFile=${report}`], { cwd: root, encoding: 'utf8' });
  expect(existsSync(report), `vitest wrote no report:\n${r.stderr}`).toBe(true);
  const parsed = Report.parse(JSON.parse(readFileSync(report, 'utf8')));
  return new Map(parsed.testResults.flatMap((f) => f.assertionResults.map((a): [string, string] => [a.title, a.status])));
}

describe('chat-mini sample app', () => {
  const scenarios = parseSpec(loadDir(SPEC)).features.flatMap((f) => f.scenarios);

  it('every scenario has exactly one visible test named "<ScenarioID> <title>", except the planted gap', () => {
    const tests = visibleTests();
    const expected = scenarios.filter((s) => !PLANTED_GAPS.includes(s.id)).map((s) => `${s.id} ${s.title}`);
    expect(tests.map((t) => `${t.id} ${t.title}`).sort(compareIds)).toEqual(expected.sort(compareIds));
  });

  it('each test file holds only its own feature\'s scenarios', () => {
    for (const t of visibleTests()) expect(t.file).toBe(`${t.id.split('/')[0] ?? ''}.test.ts`);
  });

  it('the planted gaps are real scenarios with hidden tests', () => {
    // PROP-201's hidden tests cover scenarios its spec stage adds, so they are not in main's spec.
    const hidden = readdirSync(HIDDEN).flatMap((f) => [...readFileSync(join(HIDDEN, f), 'utf8').matchAll(TEST_NAME)].map((m) => `${m[2] ?? ''} ${m[3] ?? ''}`));
    for (const gap of PLANTED_GAPS) {
      const s = scenarios.find((x) => x.id === gap);
      expect(s, `${gap} is not in the spec`).toBeDefined();
      expect(hidden).toContain(`${gap} ${s?.title ?? ''}`);
    }
  });

  it('the visible suite passes on main', () => {
    const results = runTests(copyApp());
    expect([...results.values()].every((s) => s === 'passed'), JSON.stringify([...results])).toBe(true);
    expect(results.size).toBe(scenarios.length - PLANTED_GAPS.length);
  }, 60_000);

  const hide = (dir: string, file: string) => {
    cpSync(join(HIDDEN, file), join(dir, 'tests', file));
  };
  const applyFrom = (dir: string, patch: string) => {
    const r = spawnSync('git', ['apply', join(REPO, 'evals', patch)], { cwd: dir, encoding: 'utf8' });
    expect(r.status, `${patch}: ${r.stderr}`).toBe(0);
  };
  const apply = (dir: string, patch: string) => {
    applyFrom(dir, `reference/${patch}`);
  };

  it('BUG-301 is planted: the hidden PRV-002/S3 test fails on main', () => {
    const dir = copyApp();
    hide(dir, 'PRV-002.hidden.test.ts');
    const results = runTests(dir);
    expect(results.get('PRV-002/S3 Fallback provider also rate-limits')).toBe('failed');
    expect([...results].filter(([name, s]) => s !== 'passed' && !name.startsWith('PRV-002/S3'))).toEqual([]);
  }, 60_000);

  it('the BUG-301 reference fix makes every visible and hidden test pass', () => {
    const dir = copyApp();
    hide(dir, 'PRV-002.hidden.test.ts');
    apply(dir, 'BUG-301.implementer.patch');
    const results = runTests(dir);
    expect([...results].filter(([, s]) => s !== 'passed')).toEqual([]);
    expect(results.size).toBe(scenarios.length);
  }, 60_000);

  it('every eval patch and diff applies cleanly to main on its own', () => {
    const patches = [...readdirSync(join(REPO, 'evals/reference')).map((f) => `reference/${f}`), ...readdirSync(join(REPO, 'evals/diffs')).map((f) => `diffs/${f}`)];
    expect(patches.length).toBeGreaterThanOrEqual(9);
    for (const p of patches) {
      const dir = copyApp();
      const r = spawnSync('git', ['apply', '--check', join(REPO, 'evals', p)], { cwd: dir, encoding: 'utf8' });
      expect(r.status, `${p}: ${r.stderr}`).toBe(0);
    }
  }, 60_000);

  it('PROP-202: the order test fails on main and passes with the reference stages', () => {
    const before = copyApp();
    hide(before, 'PROP-202.hidden.test.ts');
    expect(runTests(before).get('PROP-202/order The picker lists enabled providers alphabetically')).toBe('failed');
    const dir = copyApp();
    for (const stage of ['spec-writer', 'implementer']) apply(dir, `PROP-202.${stage}.patch`);
    hide(dir, 'PROP-202.hidden.test.ts');
    expect([...runTests(dir)].filter(([, s]) => s !== 'passed')).toEqual([]);
  }, 90_000);

  it('TASK-101 diffs: the clean refactor keeps every behaviour (BUG-301 included); the key log breaks PRV-001/S3', () => {
    const clean = copyApp();
    applyFrom(clean, 'diffs/clean-refactor.patch');
    hide(clean, 'PRV-002.hidden.test.ts');
    hide(clean, 'TASK-103.hidden.test.ts');
    const c = runTests(clean);
    expect([...c].filter(([, s]) => s !== 'passed').map(([n]) => n)).toEqual(['PRV-002/S3 Fallback provider also rate-limits']);
    const leaky = copyApp();
    applyFrom(leaky, 'diffs/logs-api-key.patch');
    expect(runTests(leaky).get('PRV-001/S3 The key never reaches the log')).toBe('failed');
  }, 90_000);

  // Test-first (DECISIONS X76): each proposal's tester patch, on top of its spec stage, has at least
  // one failing test, and the implementer patch turns the whole suite green.
  for (const [id, red, added] of [
    ['PROP-201', 'PRV-001/S4 Streams from gemini', ['PRV-001/S4', 'SET-001/S4']],
    ['PROP-202', 'SET-001/S4 Picker lists enabled providers', ['SET-001/S4']],
    ['PROP-205', 'CNV-001/S3 Copy a message', ['CNV-001/S3']],
  ] as const) {
    it(`${id}: the tester's tests fail before the implementer's patch and pass after`, () => {
      const dir = copyApp();
      for (const stage of ['spec-writer', 'tester']) apply(dir, `${id}.${stage}.patch`);
      const failing = [...runTests(dir)].filter(([, s]) => s === 'failed').map(([n]) => n);
      expect(failing).toContain(red);
      // Only tests of the scenarios the proposal added are red; everything else still holds.
      expect(failing.filter((n) => !added.some((s) => n.startsWith(`${s} `)))).toEqual([]);
      apply(dir, `${id}.implementer.patch`);
      expect([...runTests(dir)].filter(([, s]) => s !== 'passed')).toEqual([]);
    }, 90_000);
  }

  it('PROP-201: hidden tests fail on main; the reference stages apply in order, lint clean, and pass', () => {
    const before = copyApp();
    hide(before, 'PROP-201.hidden.test.ts');
    // Streaming from gemini needs the implementer's change; enabling it already works at runtime
    // (only the ProviderId type forbids it), so only PRV-001/S4 must fail before.
    expect(runTests(before).get('PRV-001/S4 Streams from gemini')).toBe('failed');
    const dir = copyApp();
    for (const stage of ['spec-writer', 'tester', 'implementer']) apply(dir, `PROP-201.${stage}.patch`);
    const lint = lintSpec(parseSpec(loadDir(join(dir, 'spec'))));
    expect(lint.filter((f) => f.severity === 'error')).toEqual([]);
    hide(dir, 'PROP-201.hidden.test.ts');
    const results = runTests(dir);
    expect([...results].filter(([, s]) => s !== 'passed')).toEqual([]);
    expect(results.has('PRV-001/S4 Streams from gemini') && results.has('SET-001/S4 Enable gemini')).toBe(true);
  }, 90_000);
});
