// One workspace of chat-mini. A thin facade over the feature modules.
import { send, stop } from './conversation/chat';
import { exportMarkdown } from './conversation/export';
import type { Message } from './conversation/message';
import type { ProviderConfig, ProviderId } from './providers/config';
import type { FakeProvider } from './providers/fake-provider';
import { addKey, deleteKey, maskedKey } from './settings/keys';
import { disable, enable } from './settings/providers';
import type { AppEvent, Notice, Result, State } from './state';

export interface AppOptions {
  config: ProviderConfig;
  keys?: Partial<Record<ProviderId, string>>;
  providers: readonly FakeProvider[];
}

export class ChatApp {
  readonly state: State;

  constructor(options: AppOptions) {
    this.state = {
      config: { ...options.config, enabled: [...options.config.enabled] },
      keys: new Map(Object.entries(options.keys ?? {}) as [ProviderId, string][]),
      providers: new Map(options.providers.map((p) => [p.id, p])),
      messages: [],
      events: [],
      notices: [],
      log: [],
      stopped: new Set(),
      listeners: [],
      nextMessageId: 1,
    };
  }

  get config(): ProviderConfig {
    return this.state.config;
  }
  get messages(): readonly Message[] {
    return this.state.messages;
  }
  get events(): readonly AppEvent[] {
    return this.state.events;
  }
  get notices(): readonly Notice[] {
    return this.state.notices;
  }
  get log(): readonly string[] {
    return this.state.log;
  }

  onEvent(listener: (event: AppEvent) => void): void {
    this.state.listeners.push(listener);
  }

  send(text: string): Result<Message> {
    return send(this.state, text);
  }
  stop(messageId: string): void {
    stop(this.state, messageId);
  }
  exportMarkdown(): string {
    return exportMarkdown(this.state.messages);
  }

  enable(providerId: ProviderId): Result<void> {
    return enable(this.state, providerId);
  }
  disable(providerId: ProviderId): void {
    disable(this.state, providerId);
  }

  addKey(providerId: ProviderId, secret: string): void {
    addKey(this.state, providerId, secret);
  }
  deleteKey(providerId: ProviderId): void {
    deleteKey(this.state, providerId);
  }
  maskedKey(providerId: ProviderId): string | null {
    return maskedKey(this.state, providerId);
  }
}
