import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { matchesAny } from '../core/glob';

export const STACK_NAMES = ['flutter', 'dart', 'node', 'python', 'go', 'rust', 'other'] as const;
export type StackName = (typeof STACK_NAMES)[number];

export interface StackInfo {
  readonly name: StackName;
  readonly manifest: string;
  readonly testCommand: string;
  readonly codeGlobs: string[];
  readonly testGlobs: string[];
  readonly worktreeSetup?: string;
}

const failedSetupCommand = `printf '%s\\n' '<testsuite><testcase name="configure testCommand"><failure message="configure testCommand for this stack"/></testcase></testsuite>' > "{report}"`;

function prefixed(prefix: string, glob: string): string {
  return prefix === '' ? glob : `${prefix}/${glob}`;
}

function packageRunner(manifest: string): 'vitest' | 'jest' | null {
  try {
    const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      optionalDependencies?: Record<string, unknown>;
      scripts?: Record<string, unknown>;
    };
    const declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }));
    const script = typeof pkg.scripts?.test === 'string' ? pkg.scripts.test : '';
    if (declared.has('vitest') || /\bvitest\b/.test(script)) return 'vitest';
    if (declared.has('jest') || /\bjest\b/.test(script)) return 'jest';
  } catch {
    // The manifest is still reported; setup can decide how to repair it.
  }
  return null;
}

function stackFor(path: string, manifestName: string, prefix: string): StackInfo | null {
  const manifest = prefixed(prefix, manifestName);
  const abs = join(path, manifestName);
  if (manifestName === 'pubspec.yaml') {
    const pubspec = readFileSync(abs, 'utf8');
    const flutter = /(?:^|\n)\s*flutter:\s*(?:\n|$)/.test(pubspec) || /sdk:\s*flutter/.test(pubspec);
    const name = flutter ? 'flutter' : 'dart';
    return {
      name,
      manifest,
      testCommand: flutter
        ? `cd "${prefix}" && flutter test --machine --plain-name "{filter}" > "{report}"`.replace(/^cd "" && /, '')
        : `cd "${prefix}" && dart test --reporter json --name "{filter}" > "{report}"`.replace(/^cd "" && /, ''),
      codeGlobs: [prefixed(prefix, 'lib/**')],
      testGlobs: [prefixed(prefix, 'test/**')],
      worktreeSetup: prefix ? `cd "${prefix}" && ${flutter ? 'flutter pub get' : 'dart pub get'}` : (flutter ? 'flutter pub get' : 'dart pub get'),
    };
  }
  if (manifestName === 'package.json') {
    const runner = packageRunner(abs);
    return {
      name: 'node',
      manifest,
      testCommand: runner === 'vitest'
        ? `cd "${prefix}" && npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"`.replace(/^cd "" && /, '')
        : runner === 'jest'
          ? `cd "${prefix}" && npx jest -t "{filter}" --json --outputFile="{report}"`.replace(/^cd "" && /, '')
          : failedSetupCommand,
      codeGlobs: [prefixed(prefix, 'src/**')],
      testGlobs: [prefixed(prefix, 'tests/**')],
      worktreeSetup: `ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules`,
    };
  }
  if (manifestName === 'pyproject.toml' || manifestName === 'pytest.ini' || manifestName === 'setup.cfg' || manifestName === 'requirements.txt') {
    return {
      name: 'python',
      manifest,
      testCommand: `cd "${prefix}" && pytest -k "{filter}" --junitxml="{report}"`.replace(/^cd "" && /, ''),
      codeGlobs: [prefixed(prefix, '**/*.py')],
      testGlobs: [prefixed(prefix, 'tests/**')],
    };
  }
  if (manifestName === 'go.mod') {
    return {
      name: 'go',
      manifest,
      testCommand: `cd "${prefix}" && go test ./... -run "{filter}" -v 2>&1 | go-junit-report > "{report}"`.replace(/^cd "" && /, ''),
      codeGlobs: [prefixed(prefix, '**/*.go')],
      testGlobs: [prefixed(prefix, '**/*_test.go')],
    };
  }
  if (manifestName === 'Cargo.toml') {
    return {
      name: 'rust',
      manifest,
      testCommand: failedSetupCommand,
      codeGlobs: [prefixed(prefix, 'src/**')],
      testGlobs: [prefixed(prefix, 'tests/**')],
    };
  }
  return null;
}

const MANIFESTS = ['pubspec.yaml', 'package.json', 'pyproject.toml', 'pytest.ini', 'setup.cfg', 'requirements.txt', 'go.mod', 'Cargo.toml'];
const SKIP_DIRS = new Set(['.git', '.idea', '.vscode', '.spec', '.dart_tool', '.pytest_cache', '.venv', 'node_modules', 'target', 'vendor', 'build', 'dist', 'coverage']);

// CLI-008/R12: folders whose manifests belong to fixtures, tests or samples, not the project.
const SAMPLE_DIRS = new Set(['fixtures', '__fixtures__', 'test', 'tests', '__tests__', 'testdata', 'example', 'examples', 'sample', 'samples']);

/** The `testGlobs` of `spec/config.json` in `root`; none when the file is missing or invalid. */
function configTestGlobs(root: string): string[] {
  try {
    const config = JSON.parse(readFileSync(join(root, 'spec', 'config.json'), 'utf8')) as { testGlobs?: unknown };
    return Array.isArray(config.testGlobs) ? config.testGlobs.filter((glob): glob is string => typeof glob === 'string') : [];
  } catch {
    return [];
  }
}

export function detectStacks(root: string): StackInfo[] {
  const found: StackInfo[] = [];
  const testGlobs = configTestGlobs(root);
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const prefix = relative(root, dir).split('\\').join('/');
    for (const manifestName of MANIFESTS) {
      if (entries.some((entry) => entry.isFile() && entry.name === manifestName)) {
        if (prefix !== '' && matchesAny(prefixed(prefix, manifestName), testGlobs)) continue;
        const stack = stackFor(dir, manifestName, prefix);
        if (stack) found.push(stack);
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !SAMPLE_DIRS.has(entry.name.toLowerCase()) && !entry.name.startsWith('.')) walk(join(dir, entry.name));
    }
  };
  walk(root);
  return found.sort((a, b) => a.manifest.localeCompare(b.manifest));
}

export function defaultsForStack(name: string, root: string): StackInfo | null {
  if (!STACK_NAMES.includes(name as StackName)) return null;
  const stackName = name as StackName;
  const detected = detectStacks(root).find((stack) => stack.name === stackName);
  if (detected) return detected;
  const manifest = stackName === 'flutter' || stackName === 'dart' ? 'pubspec.yaml'
    : stackName === 'node' ? 'package.json'
      : stackName === 'python' ? 'pyproject.toml'
        : stackName === 'go' ? 'go.mod'
          : stackName === 'rust' ? 'Cargo.toml' : 'unknown';
  if (stackName === 'flutter' || stackName === 'dart') {
    return {
      name: stackName, manifest, testCommand: stackName === 'flutter'
        ? 'flutter test --machine --plain-name "{filter}" > "{report}"'
        : 'dart test --reporter json --name "{filter}" > "{report}"',
      codeGlobs: ['lib/**'], testGlobs: ['test/**'],
      worktreeSetup: stackName === 'flutter' ? 'flutter pub get' : 'dart pub get',
    };
  }
  if (stackName === 'node') return {
    name: stackName, manifest, testCommand: failedSetupCommand, codeGlobs: ['src/**'], testGlobs: ['tests/**'],
    worktreeSetup: 'ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules',
  };
  if (stackName === 'python') return {
    name: stackName, manifest, testCommand: 'pytest -k "{filter}" --junitxml="{report}"', codeGlobs: ['**/*.py'], testGlobs: ['tests/**'],
  };
  if (stackName === 'go') return {
    name: stackName, manifest, testCommand: 'go test ./... -run "{filter}" -v 2>&1 | go-junit-report > "{report}"', codeGlobs: ['**/*.go'], testGlobs: ['**/*_test.go'],
  };
  return {
    name: stackName, manifest, testCommand: failedSetupCommand,
    codeGlobs: stackName === 'rust' ? ['src/**'] : [], testGlobs: stackName === 'rust' ? ['tests/**'] : [],
  };
}
