import type { ProviderId } from './config';

/** What a fake provider does, step by step, each time it is called. */
export type ScriptStep =
  | { type: 'token'; text: string }
  | { type: 'rateLimit'; retryAfterMs: number }
  | { type: 'done'; inputTokens: number; outputTokens: number };

export interface ProviderRequest {
  apiKey: string;
  messages: string[];
}

export const token = (text: string): ScriptStep => ({ type: 'token', text });
export const rateLimit = (retryAfterMs: number): ScriptStep => ({ type: 'rateLimit', retryAfterMs });
export const done = (inputTokens: number, outputTokens: number): ScriptStep => ({ type: 'done', inputTokens, outputTokens });

/** A model provider with no network: it replays its script on every call and records the call. */
export class FakeProvider {
  readonly calls: ProviderRequest[] = [];

  constructor(
    readonly id: ProviderId,
    private readonly script: readonly ScriptStep[],
  ) {}

  *stream(request: ProviderRequest): Generator<ScriptStep> {
    this.calls.push(request);
    yield* this.script;
  }
}
