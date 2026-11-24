// A test name claims a scenario of this spec only with one of its module prefixes (ADR-001, I8):
// tests that name another spec's IDs as data, such as chat-mini's in this repository, claim nothing.
import { describe, expect, it } from 'vitest';
import { findGaps } from '../../src/core/adopt';
import { type StageContext, checkReport } from '../../src/core/report';
import type { TestCase } from '../../src/core/test-report';
import { baseWith, report, ticketOf } from '../helpers';

// The lint-case spec: modules alpha (ALP) and beta (BET); TASK-001 touches ALP-001.
const base = baseWith();
const tester = (tests: TestCase[]): StageContext => {
  const t = ticketOf(base.tickets, 'TASK-001');
  return {
    spec: base.spec,
    index: base.index,
    ticket: { ...t, data: { ...t.data, status: 'in_progress', stage: 'tester' } },
    role: 'tester',
    changedPaths: ['tests/ALP-001.test.ts'],
    specPrefix: 'spec',
    ticketsPrefix: 'tickets',
    codeGlobs: ['src/**'],
    testGlobs: ['tests/**'],
    protectedGlobs: [],
    lint: [],
    tests: { exitCode: 1, tests, error: null },
    newScenarios: [],
    removed: [],
    unretired: [],
    specChanged: [],
    codeChanges: [],
    stubsLeft: [],
  };
};
const done = report('role: tester\nticket: TASK-001\nresult: done\nsummary: Tests for ALP-001');
const own = { name: 'ALP-001/S1 Widget made', status: 'failed' as const };

describe("test names claim only this spec's scenarios", () => {
  it("PIP-006/S17 A test named with another spec's ID claims no scenario", () => {
    const r = checkReport(done, tester([own, { name: 'PRV-002/S1 is a fixture scenario', status: 'passed' }]));
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('PIP-006/S7 A test named after a scenario the spec does not have', () => {
    const r = checkReport(done, tester([own, { name: 'ALP-001/S9 Removed long ago', status: 'passed' }]));
    expect(r.problems).toEqual(['test "ALP-001/S9 Removed long ago" names ALP-001/S9, which is not in the spec; delete or rename it']);
  });

  it("ADP-003/S8 A test named with another spec's ID is no gap", () => {
    const tests: TestCase[] = [own, { name: 'PRV-002/S1 is a fixture scenario', status: 'passed' }, { name: 'test_PRV_002_S3_fixture', status: 'passed' }, { name: 'ALP-001/S9 Ghost', status: 'passed' }];
    expect(findGaps(base.spec, base.index, tests).testsWithoutScenario).toEqual(['ALP-001/S9 Ghost']);
  });
});
