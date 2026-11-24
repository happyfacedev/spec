import type { ProviderId } from '../providers/config';

export interface MessageMeta {
  fallbackFrom?: ProviderId;
  stopReason?: 'done' | 'user' | 'rate_limited';
  retryAfterMs?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** conversation.Message: the same shape for every provider (ADR-001). */
export interface Message {
  id: string;
  content: string;
  meta: MessageMeta;
  usage: Usage | null;
}
