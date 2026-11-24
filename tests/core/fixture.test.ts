// The chat-mini fixture: lints clean, builds a reviewed graph, and every build is byte-identical.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph, toJson } from '../../src/core/graph';
import { renderIndex } from '../../src/core/index-md';
import { lintSpec } from '../../src/core/lint';
import { parseSpec } from '../../src/core/parse/spec';
import { sourceFromText } from '../../src/core/source';
import { parseTickets } from '../../src/core/parse/tickets';
import { loadDir } from '../../src/io/fs';

const FIXTURE = join(import.meta.dirname, '../../fixtures/chat-mini');
const ROOT = join(FIXTURE, 'spec');

const load = () => ({ spec: parseSpec(loadDir(ROOT)), tickets: parseTickets(loadDir(join(FIXTURE, 'tickets'), FIXTURE)) });

describe('chat-mini fixture', () => {
  it('lints clean, with --ci, and only BUG-302 warns', () => {
    const { spec, tickets } = load();
    const findings = lintSpec(spec, { tickets, ci: true });
    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(findings.map((f) => `${f.rule} ${f.id ?? ''}`)).toEqual(['L020 BUG-302']);
  });

  it('has the units the handoff lists', () => {
    const { spec, tickets } = load();
    expect(spec.modules.map((m) => `${m.id}:${m.prefix}`)).toEqual(['conversation:CNV', 'providers:PRV', 'settings:SET']);
    expect(spec.features.map((f) => f.id)).toEqual(['CNV-001', 'CNV-002', 'CNV-003', 'PRV-001', 'PRV-002', 'PRV-003', 'SET-001', 'SET-002']);
    expect(spec.contracts.map((c) => `${c.id}:${c.kind}`)).toEqual([
      'conversation.DeliveryMeta:type',
      'conversation.Message:entity',
      'conversation.MessageId:type',
      'conversation.ProviderDisabled:error',
      'conversation.Usage:type',
      'providers.FallbackTriggered:event',
      'providers.ProviderConfig:entity',
      'providers.ProviderId:type',
      'providers.RateLimited:event',
      'providers.StreamReply:operation',
      'providers.TokenStreamed:event',
      'settings.ApiKey:entity',
      'settings.MissingApiKey:error',
    ]);
    // Event members are addressable, like entity fields.
    expect(spec.contracts.find((c) => c.id === 'providers.RateLimited')?.fields.map((f) => f.id)).toEqual(['providers.RateLimited.providerId', 'providers.RateLimited.retryAfterMs']);
    expect(spec.contracts.find((c) => c.id === 'conversation.Message')?.fields.map((f) => f.id)).toEqual([
      'conversation.Message.id',
      'conversation.Message.content',
      'conversation.Message.meta',
      'conversation.Message.usage',
    ]);
    expect(spec.invariants.map((i) => i.id)).toEqual(['INV-001', 'INV-002']);
    expect(spec.decisions.map((d) => d.id)).toEqual(['ADR-001', 'ADR-002']);
    expect(spec.screens.map((s) => s.id)).toEqual(['UI-001']);
    expect(spec.terms.map((t) => t.term)).toEqual(['Fallback', 'Message', 'Provider', 'Rate limit', 'Workspace']);
    expect(tickets.tickets.map((t) => t.id)).toEqual(['BUG-301', 'BUG-302', 'PROP-201', 'PROP-202', 'PROP-205', 'PROP-206', 'TASK-101', 'TASK-102', 'TASK-103']);
  });

  it('the BUG-301 scenario: a second rate limit stops the reply', () => {
    const s3 = load().spec.features.find((f) => f.id === 'PRV-002')?.scenarios.find((s) => s.id === 'PRV-002/S3');
    expect(s3?.cites.map((c) => c.id)).toEqual(['providers.ProviderConfig', 'providers.RateLimited', 'conversation.Message.meta', 'PRV-002/R2']);
    expect(s3?.steps.map((s) => s.keyword)).toContain('When');
  });

  it('graph.json matches the reviewed snapshot', async () => {
    await expect(toJson(buildGraph(load().spec))).toMatchFileSnapshot('./__snapshots__/chat-mini.graph.json');
  });

  it('index.md matches the reviewed snapshot', async () => {
    await expect(renderIndex(load().spec)).toMatchFileSnapshot('./__snapshots__/chat-mini.index.md');
  });

  it('two builds are byte-identical, and the version does not depend on load order', () => {
    const a = load();
    const b = load();
    expect(toJson(buildGraph(a.spec))).toBe(toJson(buildGraph(b.spec)));
    const reversed = parseSpec([...loadDir(ROOT)].reverse());
    expect(reversed.version).toBe(a.spec.version);
    expect(toJson(buildGraph(reversed))).toBe(toJson(buildGraph(a.spec)));
  });

  it('FMT-015/S2 and X137 exclude tooling config from the spec version', () => {
    const files = loadDir(ROOT);
    const withoutGenerated = files.filter((f) => f.path !== 'index.md' && !f.path.startsWith('_generated/'));
    expect(parseSpec(withoutGenerated).version).toBe(parseSpec(files).version);
    expect(parseSpec([...files, sourceFromText('config.local.json', '{"delegation":{"astro":{"tester":"opus"}}}')]).version).toBe(parseSpec(files).version);
    const projectConfig = JSON.parse(new TextDecoder().decode(files.find((file) => file.path === 'config.json')?.content)) as Record<string, unknown>;
    projectConfig.delegation = { astro: { tester: 'opus' } };
    const withDelegation = files.map((file) => file.path === 'config.json' ? sourceFromText('config.json', `${JSON.stringify(projectConfig, null, 2)}\n`) : file);
    expect(parseSpec(withDelegation).version).toBe(parseSpec(files).version);
  });
});
