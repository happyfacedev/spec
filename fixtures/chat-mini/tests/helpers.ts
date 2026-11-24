import { ChatApp } from '../src/app';
import { PROVIDER_IDS, type ProviderId } from '../src/providers/config';
import { FakeProvider, type ScriptStep, done } from '../src/providers/fake-provider';
import type { Result } from '../src/state';

export interface Setup {
  active?: ProviderId;
  enabled?: ProviderId[];
  fallback?: ProviderId | null;
  keys?: Partial<Record<ProviderId, string>>;
  /** Providers without a script finish at once with no text. */
  scripts?: Partial<Record<ProviderId, ScriptStep[]>>;
}

/** A workspace with every known fake provider registered. Defaults: claude active and enabled, with a key. */
export function setup(s: Setup = {}) {
  const providers = Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, new FakeProvider(id, s.scripts?.[id] ?? [done(0, 0)])]),
  ) as Record<ProviderId, FakeProvider>;
  const app = new ChatApp({
    config: { active: s.active ?? 'claude', enabled: s.enabled ?? ['claude'], fallback: s.fallback ?? null },
    keys: s.keys ?? { claude: 'sk-claude-secret' },
    providers: Object.values(providers),
  });
  return { app, providers };
}

export function ok<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result.value;
}
