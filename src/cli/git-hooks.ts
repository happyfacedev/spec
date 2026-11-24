import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { git, gitContext } from '../io/git';

export const GIT_HOOK_NAMES = ['pre-commit', 'pre-merge-commit', 'commit-msg'] as const;
export const SPEC_HOOK_MARKER = '# spec-managed-hook v1';

/** Hooks absent from the resolved hook directory or without an active spec dispatch line. */
export function missingGitHookIntegrations(repo: string): string[] {
  const context = gitContext(repo);
  if (context === 'none' || context === 'bare') return [];
  const resolved = git(repo, ['rev-parse', '--git-path', 'hooks']);
  if (resolved.code !== 0) return [...GIT_HOOK_NAMES];
  const hooksDir = resolve(repo, resolved.stdout.trim());
  return GIT_HOOK_NAMES.filter((name) => {
    const file = resolve(hooksDir, name);
    if (!existsSync(file)) return true;
    try {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim());
      const generated = lines.includes(SPEC_HOOK_MARKER) && lines.some((line) => line.startsWith(`exec "$cli" hook git ${name} "$@"`));
      const integration = lines.includes(`.spec/bin/spec hook git ${name} "$@"`) || lines.includes(`exec .spec/bin/spec hook git ${name} "$@"`);
      return !generated && !integration;
    } catch {
      return true;
    }
  });
}
