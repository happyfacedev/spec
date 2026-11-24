// SET-001 Enable providers.
import type { ProviderId } from '../providers/config';
import { type Result, type State, fail } from '../state';

export function enable(state: State, providerId: ProviderId): Result<void> {
  if (!state.keys.has(providerId)) return fail('MissingApiKey', `${providerId} has no API key`);
  if (!state.config.enabled.includes(providerId)) state.config.enabled.push(providerId);
  return { ok: true, value: undefined };
}

export function disable(state: State, providerId: ProviderId): void {
  state.config.enabled = state.config.enabled.filter((p) => p !== providerId);
}
