// GRF-006: spec find ranks the units and glossary terms that match the words, best first. Through the CLI entry point run, on the chat-mini fixture spec.
import { describe, expect, it } from 'vitest';
import { USAGE } from '../../src/cli/args';
import { run } from '../../src/cli/run';
import { titleOf } from '../../src/core/units';
import { FIXTURE_SPEC, loadFixture } from '../helpers';

const fx = loadFixture();
const find = (...argv: string[]) => run({ argv: ['find', ...argv, '--root', FIXTURE_SPEC], env: {}, cwd: process.cwd(), scriptPath: undefined });

interface Hit {
  id: string;
  type: string;
  title: string;
  score: number;
}
interface FindResult {
  spec: string;
  query: string;
  hits: Hit[];
}
const findJson = async (...words: string[]) => JSON.parse((await find(...words, '--format', 'json')).stdout) as FindResult;
const scoreOf = (hits: Hit[], id: string) => hits.find((h) => h.id === id)?.score;

describe('GRF-006: Find units by words', () => {
  it('GRF-006/S1 An exact ID ranks first', async () => {
    const out = await find('PRV-002');
    expect(out.stdout.split('\n')[0]).toBe('PRV-002  feature  Fall back when a provider rate-limits');
    expect(out.code).toBe(0);
  });

  it('GRF-006/S2 IDs holding the word follow, ties in natural ID order', async () => {
    const out = await find('PRV-002');
    expect(out.stdout.split('\n').slice(1, 7)).toEqual([
      'PRV-002/R1  rule  The fallback is used only when it is enabled in this workspace (INV-001)',
      'PRV-002/R2  rule  One fallback per reply. No chains.',
      'PRV-002/S1  scenario  Fallback enabled',
      'PRV-002/S2  scenario  Fallback disabled',
      'PRV-002/S3  scenario  Fallback provider also rate-limits',
      'PRV-002/S4  scenario  Fallback provider not enabled',
    ]);
    const { hits } = await findJson('PRV-002');
    for (const id of ['PRV-002/R1', 'PRV-002/R2', 'PRV-002/S1', 'PRV-002/S2', 'PRV-002/S3', 'PRV-002/S4']) expect(scoreOf(hits, id), id).toBe(30);
  });

  it('GRF-006/S3 A glossary term by its name', async () => {
    const out = await find('fallback');
    expect(out.stdout.split('\n')[0]).toBe('Fallback  term  The one provider that finishes a reply when the active provider rate-limits, if the workspace has set one.');
    const { hits } = await findJson('fallback');
    expect(hits[0]).toMatchObject({ id: 'Fallback', type: 'term', score: 150 });
  });

  it('GRF-006/S4 A glossary term by its alias', async () => {
    const out = await find('rate-limit');
    expect(out.stdout.split('\n')[0]).toBe('Rate limit  term  A refusal by a provider to serve a request now, with a time after which to retry.');
    const { hits } = await findJson('rate-limit');
    expect(hits[0]).toMatchObject({ id: 'Rate limit', type: 'term', score: 50 });
  });

  it('GRF-006/S5 Whole words in titles, plurals included, rank above parts of words', async () => {
    const { hits } = await findJson('rate-limit');
    expect(scoreOf(hits, 'PRV-001/S2')).toBe(10);
    const partial = hits.findIndex((h) => h.id === 'conversation.DeliveryMeta.fallbackFrom');
    expect(hits[partial]?.score).toBe(4);
    const whole = hits.flatMap((h, i) => (h.score === 10 ? [i] : []));
    expect(whole).toContain(hits.findIndex((h) => h.id === 'PRV-001/S2'));
    for (const i of whole) expect(i).toBeLessThan(partial);
  });

  it('GRF-006/S6 Case does not matter', async () => {
    expect((await find('FALLBACK')).stdout).toBe((await find('fallback')).stdout);
  });

  it('GRF-006/S7 Several words add up', async () => {
    const parsed = await findJson('rate', 'limit');
    expect(parsed.hits[0]).toMatchObject({ id: 'Rate limit', type: 'term', score: 210 });
    expect(parsed.hits[1]).toMatchObject({ id: 'providers.RateLimited', score: 80 });
    expect(parsed.query).toBe('rate limit');
  });

  it('GRF-006/S8 At most 20 hits', async () => {
    const held = [...fx.index.byId.values()].filter((u) => `${u.id} ${titleOf(u)}`.toLowerCase().includes('a')).length
      + fx.spec.terms.filter((t) => `${t.term} ${t.text}`.toLowerCase().includes('a')).length;
    expect(held).toBeGreaterThan(20);
    const out = await find('a');
    expect(out.stdout.endsWith('\n')).toBe(true);
    expect(out.stdout.slice(0, -1).split('\n')).toHaveLength(20);
  });

  it('GRF-006/S9 No match', async () => {
    const out = await find('zebra');
    expect(out.stdout).toBe('no matches for "zebra"\n');
    expect(out.code).toBe(0);
  });

  it('GRF-006/S10 The hits as JSON', async () => {
    const out = await find('provider', '--format', 'json');
    expect(out.code).toBe(0);
    expect(Object.keys(JSON.parse(out.stdout) as object)).toEqual(['spec', 'query', 'hits']);
    const parsed = JSON.parse(out.stdout) as FindResult;
    expect(parsed.query).toBe('provider');
    expect(parsed.hits[0]).toEqual({ id: 'Provider', type: 'term', title: 'A fake model backend that streams a reply for a conversation.', score: 150 });
  });

  it('GRF-006/S11 No match as JSON', async () => {
    const out = await find('zebra', '--format', 'json');
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as FindResult).hits).toEqual([]);
  });

  it('GRF-006/S12 No words', async () => {
    const out = await find();
    expect(out.code).toBe(2);
    expect(out.stdout).toBe('');
    expect(out.stderr).toBe(`usage: spec find <words>\n\n${USAGE}`);
  });

  it('GRF-006/S13 A glossary term by a multi-word alias', async () => {
    const { hits } = await findJson('rate', 'limits');
    expect(hits[0]).toMatchObject({ id: 'Rate limit', type: 'term', score: 80 });
    expect(hits[1]).toMatchObject({ id: 'providers.RateLimited', score: 50 });
  });
});
