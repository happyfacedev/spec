// SET-002 Manage API keys.
import type { ProviderId } from '../providers/config';
import type { State } from '../state';

export function addKey(state: State, providerId: ProviderId, secret: string): void {
  state.keys.set(providerId, secret);
}

export function deleteKey(state: State, providerId: ProviderId): void {
  state.keys.delete(providerId);
}

/** The only way a key is shown: four stars and its last four characters. */
export function maskedKey(state: State, providerId: ProviderId): string | null {
  const secret = state.keys.get(providerId);
  return secret === undefined ? null : `****${secret.slice(-4)}`;
}
