// PRV-001 Stream a reply, PRV-003 Track token usage.
import type { Message } from '../conversation/message';
import { type State, emit } from '../state';
import type { ProviderId } from './config';
import { handleRateLimit } from './fallback';

/** Calls one provider and streams its reply into `reply`. `tried` lists the providers used so far. */
export function streamReply(state: State, reply: Message, providerId: ProviderId, messages: string[], tried: ProviderId[]): void {
  const provider = state.providers.get(providerId);
  if (!provider) throw new Error(`no fake provider registered for ${providerId}`);
  const apiKey = state.keys.get(providerId) ?? '';
  state.log.push(`request to ${providerId} with ${messages.length} message(s)`);

  for (const step of provider.stream({ apiKey, messages })) {
    if (step.type === 'token') {
      reply.content += step.text;
      emit(state, { type: 'TokenStreamed', messageId: reply.id, text: step.text });
      if (state.stopped.has(reply.id)) return;
    } else if (step.type === 'rateLimit') {
      emit(state, { type: 'RateLimited', providerId, retryAfterMs: step.retryAfterMs });
      handleRateLimit(state, reply, providerId, step.retryAfterMs, messages, tried);
      return;
    } else {
      reply.usage = { inputTokens: step.inputTokens, outputTokens: step.outputTokens };
      reply.meta.stopReason = 'done';
      state.log.push(`reply ${reply.id} from ${providerId} done`);
      return;
    }
  }
}
