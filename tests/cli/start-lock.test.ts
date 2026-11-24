// Two starts of one ticket at once (ADR-002, A6): both pass the checks on what they read, but only
// one runs the stage. The test holds the ticket's start lock while both wait for it, then lets go.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseTicket } from '../../src/core/parse/tickets';
import { gitFixture } from '../helpers';

const fx = gitFixture('spec-start-lock');
afterAll(fx.cleanup);

describe('the start lock', () => {
  it('PIP-002/S26 Two starts of one ticket at once: exactly one runs the stage', async () => {
    const lock = join(fx.repo, '.git/spec/start/TASK-101.lock');
    mkdirSync(join(lock, '..'), { recursive: true });
    writeFileSync(lock, `${String(process.pid)}\n`);
    const both = Promise.all([fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer'), fx.spec('', 'ticket', 'start', 'TASK-101', 'implementer')]);
    // Both have read the ticket as open and wait for the lock; then it is free.
    await new Promise((done) => setTimeout(done, 500));
    rmSync(lock);
    const outs = await both;
    expect(outs.map((o) => o.code).sort()).toEqual([0, 1]);
    const refused = outs.find((o) => o.code === 1);
    expect(refused?.stderr).toBe('TASK-101 already has its implementer stage running; it started after this command read the ticket\n');
    const t = parseTicket('tickets/TASK-101.md', readFileSync(join(fx.repo, 'tickets/TASK-101.md'), 'utf8')).ticket?.data;
    expect(t).toMatchObject({ status: 'in_progress', stage: 'implementer' });
    expect(fx.git('branch', '--show-current').stdout.trim()).toBe('ticket/TASK-101');
  }, 60_000);

  it('PIP-002/S26 a lock whose owner has died is taken over', async () => {
    const lock = join(fx.repo, '.git/spec/start/TASK-103.lock');
    // A pid no process has: far above any pid the system hands out.
    writeFileSync(lock, '99999999\n');
    fx.git('checkout', '-q', '--', 'tickets');
    fx.git('checkout', '-q', 'main');
    const out = await fx.spec('', 'ticket', 'start', 'TASK-103', 'implementer');
    expect(out.code, out.stderr).toBe(0);
  }, 60_000);
});
