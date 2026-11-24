// PIP-015: every way of calling spec brief answers, never with an error. One test per scenario, through the CLI entry point run.
import { existsSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run';
import { FIXTURE_SPEC, loadFixture, tempDir } from '../helpers';

const fx = loadFixture();
const USAGE = 'Usage: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>';
const brief = (...argv: string[]) => run({ argv: ['brief', ...argv, '--root', FIXTURE_SPEC], env: {}, cwd: process.cwd(), scriptPath: undefined });
const show = (id: string) => run({ argv: ['show', id, '--root', FIXTURE_SPEC], env: {}, cwd: process.cwd(), scriptPath: undefined });
const groupsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
/** The text of one `## ` group, without its heading. */
const section = (text: string, name: string) => new RegExp(`(?:^|\\n)## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text)?.[1] ?? '';
const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? '';
const moduleLine = (m: { id: string; prefix: string; responsibility: string }) => `- ${m.id} (${m.prefix}): ${firstSentence(m.responsibility)}`;

describe('PIP-015 spec brief entry points', () => {
  it('PIP-015/S1 No arguments', async () => {
    expect(fx.spec.version).toBe('spec@3f8f2372');
    const out = await brief();
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toBe('# Brief · spec@3f8f2372');
    expect(groupsOf(out.stdout)).toEqual(['Modules', 'Queue', 'Usage']);
    const modules = section(out.stdout, 'Modules');
    const headings = modules.split('\n').filter((l) => l.startsWith('### ')).sort();
    const domains = [...new Set(fx.spec.modules.map((m) => m.domain))].map((d) => `### ${d}`).sort();
    expect(headings).toEqual(domains);
    const lines = modules.split('\n');
    for (const m of fx.spec.modules) {
      const n = fx.spec.features.filter((f) => f.module === m.id && f.status === 'active').length;
      expect(lines).toContain(`- ${m.id} (${m.prefix}, ${n} feature${n === 1 ? '' : 's'}): ${firstSentence(m.responsibility)}`);
    }
  });

  it("PIP-015/S2 The skill's unfilled placeholders count as empty", async () => {
    const home = await brief();
    expect((await brief('$0', '$1')).stdout).toBe(home.stdout);
    expect((await brief('--query', '$ARGUMENTS')).stdout).toBe(home.stdout);
  });

  it('PIP-015/S3 One ID and no role', async () => {
    const unit = await brief('PRV-002/S3');
    expect(unit.code).toBe(0);
    expect(unit.stdout.split('\n')[0]).toBe('# PRV-002/S3 · spec@3f8f2372');
    const shown = await show('PRV-002/S3');
    expect(unit.stdout).toBe(`# PRV-002/S3 · spec@3f8f2372\n\n${shown.stdout}\nFor a role's brief: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>\n`);
    const ticket = await brief('TASK-101');
    const task = await show('TASK-101');
    expect(ticket.stdout).toBe(`# TASK-101 · spec@3f8f2372\n\n${task.stdout}\nFor a role's brief: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>\n`);
  });

  it('PIP-015/S22 Brief hints list stage roles only', async () => {
    const unit = await brief('PRV-002/S3');
    const hint = unit.stdout.split('\n').find((line) => line.startsWith("For a role's brief: "));
    expect(hint).toBe(`For a role's brief: ${USAGE.replace('Usage: ', '')}`);
    expect(hint).not.toContain('overseer');

    const invalid = await brief('boss');
    expect(invalid.stdout).toContain(USAGE);
    expect(USAGE).not.toContain('overseer');
  });


  it('PIP-015/S6 Free text searches the spec', async () => {
    const out = await brief('fallback', '--query', 'fallback provider also rate-limits');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toBe('# Search · fallback provider also rate-limits · spec@3f8f2372');
    expect(groupsOf(out.stdout)).toEqual(['Best matches', 'Other matches', 'Expand']);
    const best = section(out.stdout, 'Best matches');
    const quoted = best.split('\n').filter((l) => /^### \S+$/.test(l));
    expect(quoted.length).toBeGreaterThanOrEqual(1);
    expect(quoted.length).toBeLessThanOrEqual(3);
    expect(best).toContain('### PRV-002/S3');
    expect(best).toContain('Then the reply stops');
    const others = section(out.stdout, 'Other matches').split('\n').filter((l) => l !== '');
    expect(others.length).toBeGreaterThan(0);
    for (const line of others) expect(line).toMatch(/^- .+ \S+ · .+$/);
  });

  it('PIP-015/S7 A search that matches nothing', async () => {
    const out = await brief('xylophone', '--query', 'xylophone zebra');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(`No unit matches. ${USAGE}`);
    const lines = out.stdout.split('\n');
    for (const m of fx.spec.modules) expect(lines).toContain(moduleLine(m));
  });

  it('PIP-015/S8 Bad input gets a hint, never an error', async () => {
    const rows: [string[], string][] = [
      [['implementr', 'TASK-101'], 'Unknown role implementr. Did you mean implementer?'],
      [['implementer', 'PRV-02'], 'Unknown PRV-02. Did you mean PRV-002?'],
      [['implementer', 'TASK-102x'], 'Unknown TASK-102x. Did you mean TASK-102?'],
      [['implementer', 'TASK-999'], 'Unknown TASK-999.'],
      [['implementer'], 'implementer needs a ticket or unit ID.'],
      [['implementer', 'providers'], 'Unknown providers.'],
      [['overseer', 'TASK-101'], 'Unknown role overseer.'],
    ];
    for (const [argv, hint] of rows) {
      const out = await brief(...argv);
      expect(out.code, hint).toBe(0);
      expect(out.stdout.split('\n')[0], hint).toBe(hint);
      expect(out.stdout, hint).toContain('Usage: spec brief');
    }
  });

  it('PIP-015/S9 Shell text in an argument is only text', async () => {
    expect(existsSync('/tmp/pwned'), 'a stale /tmp/pwned exists').toBe(false);
    const out = await brief('implementer', "x'; touch /tmp/pwned; '");
    expect(out.stdout.split('\n')[0]).toBe("Unknown x'; touch /tmp/pwned; '.");
    expect(existsSync('/tmp/pwned')).toBe(false);
  });

  it('PIP-015/S10 Extra arguments', async () => {
    const out = await brief('implementer', 'TASK-101', 'extra');
    expect(out.code).toBe(0);
    const lines = out.stdout.split('\n');
    expect(lines[0]).toBe('spec brief takes a role and one ID; ignored: extra');
    expect(lines[1]).toBe(USAGE);
  });

  it('PIP-015/S11 No spec root, or an option brief does not take', async () => {
    const empty = tempDir('pip-015-s11-');
    try {
      const noRoot = await run({ argv: ['brief', 'implementer', 'TASK-101'], env: {}, cwd: empty, scriptPath: undefined });
      expect(noRoot.code).toBe(0);
      expect(noRoot.stdout.startsWith('no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json')).toBe(true);
      const depth = await run({ argv: ['brief', 'implementer', 'TASK-101', '--depth', 'x'], env: {}, cwd: empty, scriptPath: undefined });
      expect(depth.code).toBe(0);
      expect(depth.stdout).toBe(noRoot.stdout);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('PIP-015/S12 Short words are left out of a search', async () => {
    const out = await brief('what', '--query', 'what happens when a provider rate limits');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Search · what happens when provider rate limits · spec@[0-9a-f]{8}$/);
    expect(section(out.stdout, 'Other matches').split('\n')).toContain('- providers.RateLimited contract · The provider refused a request because of rate limits.');
  });

  it('PIP-015/S13 A query whose first word is close to a role is searched', async () => {
    const out = await brief('review', '--query', 'review fallback rules');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Search · review fallback rules · spec@[0-9a-f]{8}$/);
    expect(out.stdout).not.toContain('Unknown role');
  });

  it('PIP-015/S14 A query of only short words matches nothing', async () => {
    const out = await brief('to', '--query', 'to be or as');
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(`No unit matches. ${USAGE}`);
    const lines = out.stdout.split('\n');
    for (const m of fx.spec.modules) expect(lines).toContain(moduleLine(m));
    expect(out.stdout).not.toContain('Unknown role');
  });

  it('PIP-015/S15 A unit ID as the first argument is searched when a query is given', async () => {
    const out = await brief('PRV-002/S3', '--query', 'PRV-002/S3 fallback provider also rate-limits');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Search · PRV-002\/S3 fallback provider also rate-limits · spec@[0-9a-f]{8}$/);
    expect(out.stdout).not.toContain('Unknown role');
    expect(out.stdout.split('\n')).toContain('## Best matches');
  });

  it('PIP-015/S16 A module ID as the first argument is searched when a query is given', async () => {
    const out = await brief('providers', '--query', 'providers rate limits');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Search · providers rate limits · spec@[0-9a-f]{8}$/);
    expect(out.stdout.split('\n').filter((l) => l.startsWith('Unknown'))).toEqual([]);
    expect(out.stdout.split('\n')).toContain('## Best matches');
  });

  it('PIP-015/S17 A lone unit ID given again as the query is shown, not searched', async () => {
    const out = await brief('PRV-002/S3', '--query', 'PRV-002/S3');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# PRV-002\/S3 · spec@[0-9a-f]{8}$/);
    expect(out.stdout).toBe((await brief('PRV-002/S3')).stdout);
    expect(out.stdout.split('\n')).not.toContain('## Best matches');
  });

  it('PIP-015/S18 A lone ticket ID given again as the query is shown, not searched', async () => {
    const out = await brief('TASK-101', '--query', 'TASK-101');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# TASK-101 · spec@[0-9a-f]{8}$/);
    expect(out.stdout).toBe((await brief('TASK-101')).stdout);
    expect(out.stdout.split('\n')).not.toContain('## Best matches');
  });

  it('PIP-015/S19 A lone module ID given again as the query is shown, not searched', async () => {
    const out = await brief('providers', '--query', 'providers');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# providers · spec@[0-9a-f]{8}$/);
    expect(out.stdout).toBe((await brief('providers')).stdout);
    expect(out.stdout.split('\n')).not.toContain('## Best matches');
  });

  it('PIP-015/S20 A lone glossary term given again as the query is shown, not searched', async () => {
    const out = await brief('Fallback', '--query', 'Fallback');
    expect(out.code).toBe(0);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Fallback · spec@[0-9a-f]{8}$/);
    expect(out.stdout).toBe((await brief('Fallback')).stdout);
    expect(out.stdout.split('\n')).not.toContain('## Best matches');
  });

  it('PIP-015/S21 The arguments arrive on standard input', async () => {
    const viaStdin = (text: string, ...extra: string[]) =>
      run({ argv: ['brief', '--stdin', ...extra, '--root', FIXTURE_SPEC], env: {}, cwd: process.cwd(), scriptPath: undefined, stdin: () => Promise.resolve(text) });
    const text = "what's a gate";
    const out = await viaStdin(text);
    expect(out.code).toBe(0);
    expect(out.stdout).toBe((await brief("what's", 'a', '--query', text)).stdout);
    expect(out.stdout.split('\n')[0]).toMatch(/^# Search · what's gate · spec@[0-9a-f]{8}$/);
    const tricky = 'what\'s "the" gate $HOME `ls` back\\slash (x)';
    expect((await viaStdin(tricky)).stdout.split('\n')[0]).toMatch(/^# Search · what's "the" gate \$HOME `ls` back\\slash \(x\) · spec@[0-9a-f]{8}$/);
    expect((await viaStdin(text, 'tester', 'TASK-101')).stdout).toBe(out.stdout);
    const home = await brief();
    expect((await viaStdin('$ARGUMENTS')).stdout).toBe(home.stdout);
  });
});
