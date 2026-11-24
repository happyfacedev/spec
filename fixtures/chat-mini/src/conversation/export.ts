// CNV-003 Export a conversation to Markdown.
import type { Message } from './message';

/** The content of each message, in order, separated by one blank line. */
export function exportMarkdown(messages: readonly Message[]): string {
  return `${messages.map((m) => m.content).join('\n\n')}\n`;
}
