// Whether the installed Claude Code is known to take a reasoning effort per Agent call (CLI-007/R19).
import { spawnSync } from 'node:child_process';
import type { Effort } from '../core/schemas';

const MIN_VERSION = [2, 1, 292] as const;
const TIMEOUT_MS = 3000;

/** Why an effort was left out, as stderr, the hook's message and session start say it. */
export const EFFORT_NOT_SENT = `not sent: Claude Code ${MIN_VERSION.join('.')} or later was not found`;

/** Runs `claude --version` from the PATH. What it prints is only compared: never run and never shown (INV-020). */
function claudeTakesEffort(env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    const r = spawnSync('claude', ['--version'], { env, encoding: 'utf8', timeout: TIMEOUT_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] });
    if (r.error !== undefined || r.status !== 0) return false;
    const version = /^\s*(\d+)\.(\d+)\.(\d+)/.exec(r.stdout)?.slice(1).map(Number);
    if (version === undefined) return false;
    for (const [i, wanted] of MIN_VERSION.entries()) {
      const found = version[i] ?? 0;
      if (found !== wanted) return found > wanted;
    }
    return true;
  } catch {
    return false;
  }
}

/** Decides the efforts of one command; `claude` runs at most once, and only when an effort is asked about. */
export interface EffortGate {
  /** The effort to send, or null when there is none or Claude Code is not known to take one. */
  send(effort: Effort | null): Effort | null;
  /** One line naming the efforts left out, or null. */
  notice(): string | null;
}

export function effortGate(env: Readonly<Record<string, string | undefined>>): EffortGate {
  let takes: boolean | undefined;
  const unsent = new Set<Effort>();
  return {
    send(effort) {
      if (effort === null) return null;
      takes ??= claudeTakesEffort(env);
      if (takes) return effort;
      unsent.add(effort);
      return null;
    },
    notice: () => (unsent.size === 0 ? null : `effort ${[...unsent].join(', ')} ${EFFORT_NOT_SENT}`),
  };
}
