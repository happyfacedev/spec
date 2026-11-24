import type { Message } from './conversation/message';
import type { ProviderConfig, ProviderId } from './providers/config';
import type { FakeProvider } from './providers/fake-provider';

export type AppEvent =
  | { type: 'TokenStreamed'; messageId: string; text: string }
  | { type: 'RateLimited'; providerId: ProviderId; retryAfterMs: number }
  | { type: 'FallbackTriggered'; messageId: string; from: ProviderId; to: ProviderId };

export interface Notice {
  screen: 'UI-001';
  messageId: string;
  text: string;
}

export type ErrorCode = 'ProviderDisabled' | 'MissingApiKey';

/** Errors are values with a code. Their text never carries API key material (INV-002). */
export interface AppError {
  code: ErrorCode;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const fail = (code: ErrorCode, message: string): { ok: false; error: AppError } => ({ ok: false, error: { code, message } });

/** Everything one workspace holds. Feature modules take it as their first argument. */
export interface State {
  config: ProviderConfig;
  keys: Map<ProviderId, string>;
  providers: Map<ProviderId, FakeProvider>;
  messages: Message[];
  events: AppEvent[];
  notices: Notice[];
  log: string[];
  stopped: Set<string>;
  listeners: ((event: AppEvent) => void)[];
  nextMessageId: number;
}

export function emit(state: State, event: AppEvent): void {
  state.events.push(event);
  for (const listener of state.listeners) listener(event);
}

export function newMessage(state: State, content: string): Message {
  const message: Message = { id: `m${state.nextMessageId++}`, content, meta: {}, usage: null };
  state.messages.push(message);
  return message;
}
