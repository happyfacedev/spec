export const PROVIDER_IDS = ['claude', 'gpt', 'mistral'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** providers.ProviderConfig */
export interface ProviderConfig {
  active: ProviderId;
  enabled: ProviderId[];
  fallback: ProviderId | null;
}
