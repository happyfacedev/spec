// ADP-004: spec gaps lists every Code: line whose symbol no code file holds. The check reads only the
// code globs' files outside the test globs, and in a Git work tree only those Git does not ignore.
// Each test builds a throwaway copy of a fixture, then runs `spec gaps --no-tests` on it.
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/run';
import { LINT_BASE, fillTree, gitFixture, runCliLimited } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

const STREAM_REPLY = { id: 'providers.StreamReply', code: 'streamReply' };
const MAKE_WIDGET = { id: 'alpha.MakeWidget', code: 'Factory.makeWidget' };
const HOLDS_STREAM_REPLY = 'export function streamReply(): void {}\n';

const write = (dir: string, path: string, text: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const append = (dir: string, path: string, text: string) => { writeFileSync(join(dir, path), readFileSync(join(dir, path), 'utf8') + text); };
const setConfig = (dir: string, f: (cfg: Record<string, unknown>) => void) => {
  const path = join(dir, 'spec/config.json');
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  f(cfg);
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
};

/** The chat-mini project with no file under src/ holding "streamReply" any more, then `edit` applied before git sees it. */
function chat(edit?: (dir: string) => void, prefix = 'spec-adp-004'): Fx {
  const fx = gitFixture(prefix, {
    setup: (dir) => {
      for (const rel of readdirSync(join(dir, 'src'), { recursive: true, encoding: 'utf8' })) {
        const path = join(dir, 'src', rel);
        if (statSync(path).isFile()) writeFileSync(path, readFileSync(path, 'utf8').replaceAll('streamReply', 'pipeReply'));
      }
      edit?.(dir);
    },
  });
  made.push(fx);
  return fx;
}

/** The lint-case base project with the contract "alpha.MakeWidget" (Code: Factory.makeWidget(size)) and `edit` applied. */
function alpha(status: 'active' | 'removed', edit: (dir: string) => void): Fx {
  const fx = gitFixture('spec-adp-004-alpha', {
    fixture: LINT_BASE,
    setup: (dir) => {
      append(dir, 'spec/modules/alpha/contracts.md', `\n### alpha.MakeWidget\nKind: operation · Status: ${status}\nMakes a widget.\nCode: Factory.makeWidget(size)\nOutput: null\n`);
      edit(dir);
    },
  });
  made.push(fx);
  return fx;
}

interface Gaps {
  codeNotFound: { id: string; code: string }[] | null;
}

/** `spec gaps --no-tests` run on the project in `dir` (the folder that holds spec/). */
const gapsIn = (dir: string, ...flags: string[]) =>
  run({ argv: ['gaps', '--no-tests', ...flags, '--root', join(dir, 'spec')], env: {}, cwd: dir, scriptPath: undefined, stdin: () => Promise.resolve(''), now: () => '2026-10-27T12:00:00.000Z' });
const codeNotFoundIn = async (dir: string) => {
  const out = await gapsIn(dir, '--format', 'json');
  expect(out.code, out.stderr).toBe(0);
  return (JSON.parse(out.stdout) as Gaps).codeNotFound;
};

describe('ADP-004 Find code pointers no code file holds', () => {
  it('ADP-004/S1 A renamed symbol', async () => {
    const fx = chat();
    const text = await gapsIn(fx.repo);
    expect(text.stdout).toContain('## Code pointers not found (1)\n- providers.StreamReply Code: streamReply (update the Code: line, or the code)\n');
    expect(await codeNotFoundIn(fx.repo)).toEqual([STREAM_REPLY]);
  });

  it('ADP-004/S2 Owner and name in one file', async () => {
    const fx = alpha('active', (dir) => { write(dir, 'src/factory.ts', 'class Factory {\n  makeWidget() {}\n}\n'); });
    expect(await codeNotFoundIn(fx.repo)).toEqual([]);
  });

  it('ADP-004/S3 The name alone is not enough', async () => {
    const fx = alpha('active', (dir) => { write(dir, 'src/old.ts', '// makeWidget was removed years ago\n'); });
    expect(await codeNotFoundIn(fx.repo)).toEqual([MAKE_WIDGET]);
  });

  it('ADP-004/S4 Only the last two parts count', async () => {
    const fx = alpha('active', (dir) => {
      write(dir, 'src/factory.ts', 'class Factory {\n  makeWidget() {}\n}\n');
      const path = join(dir, 'spec/modules/alpha/contracts.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('Code: Factory.makeWidget(size)', 'Code: shop.Factory.makeWidget'));
    });
    expect(await codeNotFoundIn(fx.repo)).toEqual([]);
  });

  it('ADP-004/S5 Test files do not count', async () => {
    const fx = chat((dir) => { append(dir, 'tests/helpers.ts', '\n// streamReply\n'); });
    expect(await codeNotFoundIn(fx.repo)).toEqual([STREAM_REPLY]);
  });

  it('ADP-004/S6 No code globs', async () => {
    const fx = chat((dir) => { setConfig(dir, (cfg) => (cfg['codeGlobs'] = [])); });
    expect(await codeNotFoundIn(fx.repo)).toBeNull();
    expect((await gapsIn(fx.repo)).stdout).not.toContain('## Code pointers not found');
  });

  it('ADP-004/S7 Every pointer found', async () => {
    const fx = chat((dir) => { write(dir, 'src/providers/stream.ts', HOLDS_STREAM_REPLY); });
    expect((await gapsIn(fx.repo)).stdout).not.toContain('## Code pointers not found');
    expect(await codeNotFoundIn(fx.repo)).toEqual([]);
  });

  it('ADP-004/S8 A removed contract is not checked', async () => {
    const fx = alpha('removed', () => undefined);
    expect(await codeNotFoundIn(fx.repo)).not.toContainEqual(MAKE_WIDGET);
  });

  it('ADP-004/S9 A file Git ignores does not count', async () => {
    const fx = chat((dir) => {
      append(dir, '.gitignore', 'src/generated/\n');
      write(dir, 'src/generated/stream.ts', HOLDS_STREAM_REPLY);
    });
    expect(fx.git('ls-files', 'src/generated').stdout).toBe('');
    expect(await codeNotFoundIn(fx.repo)).toEqual([STREAM_REPLY]);
  });

  it('ADP-004/S10 An untracked file Git does not ignore counts', async () => {
    const fx = chat();
    write(fx.repo, 'src/new.ts', HOLDS_STREAM_REPLY);
    expect(fx.git('ls-files', 'src/new.ts').stdout).toBe('');
    expect(await codeNotFoundIn(fx.repo)).toEqual([]);
  });

  it('ADP-004/S11 A large ignored tree does not stop the check', { timeout: 120_000 }, () => {
    const fx = chat((dir) => {
      setConfig(dir, (cfg) => (cfg['codeGlobs'] = ['packages/**']));
      append(dir, '.gitignore', 'build/\n');
      write(dir, 'packages/app/src/reply.ts', HOLDS_STREAM_REPLY);
      fillTree(join(dir, 'packages/app/build'));
    });
    const out = runCliLimited(fx.repo, 'gaps', '--no-tests', '--format', 'json');
    expect(out.stderr).not.toContain('heap out of memory');
    expect(out.code).toBe(0);
    expect((JSON.parse(out.stdout) as Gaps).codeNotFound).toEqual([]);
  });

  it('ADP-004/S12 Outside a Git work tree ignore files are not read', async () => {
    const fx = chat((dir) => {
      append(dir, '.gitignore', 'src/generated/\n');
      write(dir, 'src/generated/stream.ts', HOLDS_STREAM_REPLY);
    });
    rmSync(join(fx.repo, '.git'), { recursive: true, force: true });
    expect(await codeNotFoundIn(fx.repo)).toEqual([]);

    const nested = chat((dir) => { write(dir, 'src/node_modules/lib/stream.ts', HOLDS_STREAM_REPLY); });
    rmSync(join(nested.repo, '.git'), { recursive: true, force: true });
    expect(await codeNotFoundIn(nested.repo)).toEqual([STREAM_REPLY]);
  });

  it('ADP-004/S13 Git cannot list the files', async () => {
    const fx = chat((dir) => {
      append(dir, '.gitignore', 'src/generated/\n');
      write(dir, 'src/generated/stream.ts', HOLDS_STREAM_REPLY);
    });
    vi.stubEnv('PATH', join(fx.repo, 'no-such-bin'));
    try {
      expect(await codeNotFoundIn(fx.repo)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('ADP-004/S14 A project inside a larger Git work tree', async () => {
    /** chat-mini moved into the folder "app" of the work tree, with `edit` applied to the project. */
    const inApp = (edit: (app: string) => void) =>
      chat((dir) => {
        const app = join(dir, 'app');
        mkdirSync(app);
        for (const entry of readdirSync(dir)) if (entry !== 'app') renameSync(join(dir, entry), join(app, entry));
        append(app, '.gitignore', 'src/generated/\n');
        edit(app);
      }, 'spec-adp-004-nested');
    const held = inApp((app) => { write(app, 'src/stream.ts', HOLDS_STREAM_REPLY); });
    expect(held.git('ls-files', 'app/src/stream.ts').stdout.trim()).toBe('app/src/stream.ts');
    expect(await codeNotFoundIn(join(held.repo, 'app'))).toEqual([]);

    const ignored = inApp((app) => { write(app, 'src/generated/stream.ts', HOLDS_STREAM_REPLY); });
    expect(await codeNotFoundIn(join(ignored.repo, 'app'))).toEqual([STREAM_REPLY]);
  });

  it('ADP-004/S15 A tracked file deleted from disk', async () => {
    const fx = chat((dir) => { write(dir, 'src/old.ts', HOLDS_STREAM_REPLY); });
    expect(fx.git('ls-files', 'src/old.ts').stdout.trim()).toBe('src/old.ts');
    rmSync(join(fx.repo, 'src/old.ts'));
    const out = await gapsIn(fx.repo, '--format', 'json');
    expect(out.code, out.stderr).toBe(0);
    expect((JSON.parse(out.stdout) as Gaps).codeNotFound).toEqual([STREAM_REPLY]);
  });
});
