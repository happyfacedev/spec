// PRV-002 Fall back when a provider rate-limits.
import type { Message } from '../conversation/message';
import { type State, emit } from '../state';
import type { ProviderId } from './config';
import { streamReply } from './stream';

export function handleRateLimit(
  state: State,
  reply: Message,
  from: ProviderId,
  retryAfterMs: number,
  messages: string[],
  tried: ProviderId[],
): void {
  const { fallback, enabled } = state.config;
  if (fallback !== null) {
    if (reply.meta.fallbackFrom === undefined) {
      if (enabled.includes(fallback)) {
        reply.meta.fallbackFrom = from;
        emit(state, { type: 'FallbackTriggered', messageId: reply.id, from, to: fallback });
        state.notices.push({ screen: 'UI-001', messageId: reply.id, text: `Switched to ${fallback} because ${from} is rate-limited.` });
        streamReply(state, reply, fallback, messages, [...tried, fallback]);
      } else {
        stopRateLimited(reply, retryAfterMs);
      }
    } else {
      // The fallback is rate-limited as well: try an enabled provider we have not tried yet.
      const next = enabled.find((p) => !tried.includes(p));
      if (next !== undefined) {
        streamReply(state, reply, next, messages, [...tried, next]);
      } else {
        stopRateLimited(reply, retryAfterMs);
      }
    }
  } else {
    stopRateLimited(reply, retryAfterMs);
  }
}

function stopRateLimited(reply: Message, retryAfterMs: number): void {
  reply.meta.stopReason = 'rate_limited';
  reply.meta.retryAfterMs = retryAfterMs;
}
