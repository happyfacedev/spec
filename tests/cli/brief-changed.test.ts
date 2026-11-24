// PIP-013/S11, R5: what the ticket's branch changed stays whole in every role's brief, found by real
// git against the merge base with the base branch; without a repository or a base branch nothing counts as changed.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** The text of one `## ` group, without its heading. */
const group = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';
const FEATURE = 'spec/modules/providers/features/PRV-001-stream-a-reply.md';
const ROLES = ['spec-writer', 'spec-review', 'tester', 'implementer', 'reviewer'];
const SCENARIO = '### S4: Streams from gemini\nGiven providers.ProviderConfig has "gemini" as the active and enabled provider\nWhen providers.StreamReply runs for a message and "gemini" streams "Hi"\nThen providers.TokenStreamed is emitted once, with "Hi"\n\n## Rules';

/** chat-mini with every role's budget at 1 token, PRV-001/S4 added in the working tree and PROP-201 as the ticket. */
function fresh(prefix: string, opts: { onBranch: boolean }): Fx {
  const addScenario = (dir: string) => {
    const path = join(dir, FEATURE);
    writeFileSync(path, readFileSync(path, 'utf8').replace('## Rules', SCENARIO));
  };
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      const path = join(dir, 'spec/config.json');
      const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      const budgets = Object.fromEntries(ROLES.map((r) => [`brief.${r}`, 1]));
      writeFileSync(path, `${JSON.stringify({ ...config, budgets }, null, 2)}\n`);
      if (!opts.onBranch) addScenario(dir);
    },
  });
  made.push(fx);
  if (opts.onBranch) {
    fx.git('checkout', '-q', '-b', 'ticket/PROP-201');
    addScenario(fx.repo);
    writeFileSync(join(fx.repo, 'src/gemini.ts'), '// BRANCH-CODE-MARKER\nexport const gemini = 1;\n');
    fx.git('add', '-A');
    fx.git('commit', '-q', '-m', 'PROP-201 spec-writer: add a scenario');
  }
  return fx;
}

const WHOLE = '##### S4: Streams from gemini\nGiven providers.ProviderConfig has "gemini" as the active and enabled provider\nWhen providers.StreamReply runs for a message and "gemini" streams "Hi"\nThen providers.TokenStreamed is emitted once, with "Hi"';

describe('PIP-013 what the ticket\'s branch changed stays whole', () => {
  it("PIP-013/S11 What the ticket's branch changed stays whole in every role's brief", async () => {
    const fx = fresh('spec-brief-changed', { onBranch: true });
    for (const role of ROLES) {
      const out = await fx.spec('', 'brief', role, 'PROP-201');
      expect(out.code, role).toBe(0);
      expect(out.stdout, role).toContain(WHOLE);
      expect(out.stdout, role).toContain('- PRV-001/S1 Streams tokens');
      expect(out.stdout, role).not.toContain('##### S1: Streams tokens');
      // "New in the spec" lists it as "- PRV-001/S4 Streams from gemini (added)"; only the scope group must not hold it as a bare line.
      expect(group(out.stdout, 'Features in scope'), role).not.toContain('- PRV-001/S4 Streams from gemini');
      if (role === 'spec-review') expect(out.stdout).toContain('+Then providers.TokenStreamed is emitted once, with "Hi"');
      if (role === 'reviewer') expect(out.stdout).toContain('+// BRANCH-CODE-MARKER');
    }
  }, 120_000);

  it('PIP-013/S11 Without a git repository nothing counts as changed', async () => {
    const fx = fresh('spec-brief-changed-norepo', { onBranch: false });
    rmSync(join(fx.repo, '.git'), { recursive: true, force: true });
    for (const role of ROLES) {
      const out = await fx.spec('', 'brief', role, 'PROP-201');
      expect(out.code, role).toBe(0);
      expect(group(out.stdout, 'Features in scope'), role).toContain('- PRV-001/S4 Streams from gemini');
      expect(out.stdout, role).not.toContain(WHOLE);
      expect(out.stdout, role).toContain('- PRV-001/S1 Streams tokens');
      expect(out.stdout, role).toContain('```ticket');
    }
  }, 120_000);

  it('PIP-013/S11 Without the base branch nothing counts as changed', async () => {
    const fx = fresh('spec-brief-changed-nobase', { onBranch: true });
    fx.git('branch', '-m', 'main', 'trunk');
    for (const role of ROLES) {
      const out = await fx.spec('', 'brief', role, 'PROP-201');
      expect(out.code, role).toBe(0);
      expect(group(out.stdout, 'Features in scope'), role).toContain('- PRV-001/S4 Streams from gemini');
      expect(out.stdout, role).not.toContain(WHOLE);
    }
  }, 120_000);
});
