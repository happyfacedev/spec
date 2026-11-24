import { describe, expect, it } from 'vitest';
import { type Queue, buildQueue, renderQueue } from '../../src/core/queue';
import { loadFixture } from '../helpers';

const { spec, tickets, index } = loadFixture();

describe('queue', () => {
  it('groups the fixture tickets and names the next stage', async () => {
    const q = buildQueue(spec, index, tickets);
    expect(q.blocked.map((e) => e.id)).toEqual(['BUG-302', 'PROP-206']);
    expect(q.ready.find((e) => e.id === 'BUG-301')?.stage).toBe('tester');
    await expect(renderQueue(q)).toMatchFileSnapshot('./__snapshots__/chat-mini.queue.txt');
  });

  it('never exceeds the cap, and says how many it left out', () => {
    const entry = (n: number) => ({ id: `PROP-${n}`, type: 'proposal', title: 'A rather long ticket title to fill the queue quickly', stage: 'spec-writer' as const, reason: null });
    const q: Queue = { spec: 'spec@00000000', ready: Array.from({ length: 400 }, (_, i) => entry(i + 1)), waiting: [], blocked: [], inProgress: [], done: 3 };
    const out = renderQueue(q, 10_000);
    expect(out.length).toBeLessThanOrEqual(10_000);
    const shown = out.split('\n').filter((l) => l.startsWith('- PROP-')).length;
    expect(out).toContain(`… ${400 - shown} more tickets not shown`);
    expect(renderQueue(q, 10_000)).toBe(out);
  });
});
