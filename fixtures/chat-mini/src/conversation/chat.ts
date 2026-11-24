// CNV-001 Send a message, CNV-002 Stop a reply mid-stream.
import { streamReply } from '../providers/stream';
import { type Result, type State, fail, newMessage } from '../state';
import type { Message } from './message';

/** Sends `text` to the active provider and returns the reply message. */
export function send(state: State, text: string): Result<Message> {
  const active = state.config.active;
  if (!state.config.enabled.includes(active)) {
    return fail('ProviderDisabled', `${active} is not enabled in this workspace`);
  }
  const messages = [...state.messages.map((m) => m.content), text];
  newMessage(state, text);
  const reply = newMessage(state, '');
  streamReply(state, reply, active, messages, [active]);
  return { ok: true, value: reply };
}

/** Stops a reply that is still streaming. A finished reply is left as it is. */
export function stop(state: State, messageId: string): void {
  const reply = state.messages.find((m) => m.id === messageId);
  if (!reply || reply.meta.stopReason !== undefined) return;
  state.stopped.add(messageId);
  reply.meta.stopReason = 'user';
}
