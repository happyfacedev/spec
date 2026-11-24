// PROP-063: a reviewer's findings are kept whole in its record, class included (PIP-008/S23, R10).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, report } from '../helpers';

const fixtures: ReturnType<typeof gitFixture>[] = [];
afterAll(() => {
  for (const fx of fixtures) fx.cleanup();
});

const entry = (role: string, verdict = 'null') => `  - { at: "2026-10-28T10:00:00.000Z", role: ${role}, result: done, summary: x, verdict: ${verdict}, assumed: [] }`;

/** PROP-201 after its spec-writer, spec-review, tester and implementer stages, committed, so the reviewer is next. */
async function inReviewer() {
  const fx = gitFixture('review-class');
  fixtures.push(fx);
  const file = join(fx.repo, 'tickets/PROP-201.md');
  const history = [entry('spec-writer'), entry('spec-review', 'approve'), entry('tester'), entry('implementer')];
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^history: \[\]$/m, `history:\n${history.join('\n')}`));
  fx.git('add', '-A');
  fx.git('commit', '-q', '-m', 'PROP-201 up to the reviewer');
  const started = await fx.spec('', 'ticket', 'start', 'PROP-201', 'reviewer');
  expect(started.code, started.stderr).toBe(0);
  return fx;
}

describe('PIP-008 the reviewer record', () => {
  it("PIP-008/S23 A reviewer's findings are kept in its record", async () => {
    const fx = await inReviewer();
    const text = 'no scenario covers a second rate limit';
    const message = report(`role: reviewer\nticket: PROP-201\nresult: done\nsummary: The spec lacks a second rate limit\nverdict: changes\nfindings: [{ cites: ["PRV-001/S3"], text: "${text}", spec: true, class: C1 }]`);
    const out = await fx.spec(message, 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout.split('\n').slice(0, 2)).toEqual(['PROP-201 reviewer: The spec lacks a second rate limit', 'next: spec-writer']);
    const last = fx.ticket('PROP-201')?.history.at(-1);
    expect(last).toMatchObject({ role: 'reviewer', result: 'done', verdict: 'changes' });
    expect(last?.findings).toEqual([{ cites: ['PRV-001/S3'], text, spec: true, class: 'C1' }]);
    // The class is a key of the record, not an unknown one: lint does not warn about it.
    const lint = await fx.spec('', 'lint', '--format', 'json');
    const findings = (JSON.parse(lint.stdout) as { findings: { rule: string; message: string }[] }).findings;
    expect(findings.filter((item) => item.message.includes('class'))).toEqual([]);
  }, 120_000);

  it("PIP-008/S23 A reviewer's approval with no findings records none", async () => {
    const fx = await inReviewer();
    const out = await fx.spec(report('role: reviewer\nticket: PROP-201\nresult: done\nsummary: Matches the new scenarios\nverdict: approve'), 'ticket', 'advance', 'PROP-201');
    expect(out.code, out.stderr).toBe(0);
    expect(fx.ticket('PROP-201')?.history.at(-1)).not.toHaveProperty('findings');
  }, 120_000);
});
