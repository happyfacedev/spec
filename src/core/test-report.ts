// Test results from any stack: vitest/jest JSON, the Dart/Flutter JSON event stream, or JUnit XML
// (pytest --junitxml, Go via go-junit-report, Gradle/Maven, .NET, most CI runners). Names link
// tests to scenarios.
import { z } from 'zod';

export type TestStatus = 'passed' | 'failed' | 'skipped';

export type TestFailureKind = 'assertion' | 'error';

export interface TestCase {
  readonly name: string;
  readonly status: TestStatus;
  /** Failed tests only, when the report tells a failed check from an error raised. */
  readonly failureKind?: TestFailureKind;
  /** Failed tests only: the first non-blank line of the failure's message, when the report gives one. */
  readonly firstErrorLine?: string;
}

const firstLine = (s: string | undefined): string | undefined => s?.split('\n').map((l) => l.trim()).find((l) => l !== '');

/** The failure fields of a test, left out when there is nothing to say. */
const failureFields = (kind: TestFailureKind | undefined, message: string | undefined): Pick<TestCase, 'failureKind' | 'firstErrorLine'> => {
  const line = firstLine(message);
  return { ...(kind === undefined ? {} : { failureKind: kind }), ...(line === undefined ? {} : { firstErrorLine: line }) };
};

export interface TestRun {
  /** Exit code of the test command; null when it could not run. */
  readonly exitCode: number | null;
  readonly tests: readonly TestCase[];
  /** Why there are no results: the command failed to start, timed out, or wrote no report. */
  readonly error: string | null;
  /** Files or suites the report marks failed with a message of their own (a load error, a throwing hook). */
  readonly failedFiles?: readonly FailedFile[];
  /** The last non-blank lines of the test command's output, stderr then stdout, trimmed. */
  readonly outputTail?: readonly string[];
}

export interface FailedFile {
  /** The file's name as the report gives it. */
  readonly name: string;
  /** The first non-blank line of its message. */
  readonly message: string;
}

const JestJson = z.object({
  testResults: z.array(
    z.object({
      name: z.string().optional(),
      status: z.string().optional(),
      message: z.string().optional(),
      assertionResults: z.array(
        z.object({
          title: z.string(),
          status: z.string(),
          failureDetails: z.array(z.unknown()).optional(),
          failureMessages: z.array(z.unknown()).optional(),
        }),
      ),
    }),
  ),
});

const statusOf = (s: string): TestStatus => (s === 'passed' ? 'passed' : s === 'failed' ? 'failed' : 'skipped');

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function parseJUnit(xml: string): TestCase[] {
  const out: TestCase[] = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(re)) {
    const name = /\bname="([^"]*)"/.exec(m[1] ?? '')?.[1];
    if (name === undefined) continue;
    const body = m[3] ?? '';
    const fail = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body);
    const status: TestStatus = fail ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
    if (!fail) {
      out.push({ name: decode(name), status });
      continue;
    }
    const attr = /\bmessage="([^"]*)"/.exec(fail[2] ?? '')?.[1];
    const text = fail[4] === undefined ? undefined : decode(fail[4]);
    out.push({ name: decode(name), status, ...failureFields(fail[1] === 'error' ? 'error' : 'assertion', firstLine(attr) === undefined ? text : decode(attr ?? '')) });
  }
  return out;
}

/**
 * The Dart test runner's JSON protocol, one event per line: `dart test --reporter json`, and
 * `flutter test --machine`. A test file that does not compile shows as a failed test named
 * "loading <file>", with no test of its own: exactly what a test against missing code gives.
 */
function parseDartEvents(lines: readonly string[]): TestCase[] {
  const names = new Map<number, string>();
  const out: TestCase[] = [];
  const messages = new Map<number, string>();
  for (const line of lines) {
    let e: { type?: string; test?: { id?: number; name?: string }; testID?: number; result?: string; skipped?: boolean; hidden?: boolean; error?: string };
    try {
      e = JSON.parse(line) as typeof e;
    } catch {
      continue;
    }
    if (e.type === 'testStart' && typeof e.test?.id === 'number') names.set(e.test.id, e.test.name ?? '');
    if (e.type === 'error' && typeof e.testID === 'number' && typeof e.error === 'string' && !messages.has(e.testID)) messages.set(e.testID, e.error);
    if (e.type === 'testDone' && typeof e.testID === 'number') {
      const name = names.get(e.testID) ?? '';
      const failed = e.result === 'failure' || e.result === 'error';
      // Hidden tests are the runner's own (loading a file); only a failed one is news.
      if (e.hidden === true && !failed) continue;
      if (failed) out.push({ name, status: 'failed', ...failureFields(e.result === 'error' ? 'error' : 'assertion', messages.get(e.testID)) });
      else out.push({ name, status: e.skipped === true ? 'skipped' : 'passed' });
    }
  }
  return out;
}

/** The index after the end of a markup construct that starts at `i` and ends with `close`, or -1. */
function endOf(xml: string, i: number, skip: number, close: string): number {
  const at = xml.indexOf(close, i + skip);
  return at < 0 ? -1 : at + close.length;
}

/**
 * The index after a comment or processing instruction at `i`, else -1. With `doctype`, a doctype
 * (and its bracketed internal subset) counts too.
 */
function skipMisc(xml: string, i: number, doctype: boolean): number {
  if (xml.startsWith('<!--', i)) return endOf(xml, i, 4, '-->');
  if (xml.startsWith('<?', i)) return endOf(xml, i, 2, '?>');
  if (doctype && /^<!DOCTYPE\b/i.test(xml.slice(i, i + 9))) {
    let depth = 0;
    let quote = '';
    for (let j = i + 9; j < xml.length; j++) {
      const c = xml[j];
      // A bracket or ">" inside a quoted literal (an entity value, say) is text.
      if (quote !== '') {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '<' && (xml.startsWith('<!--', j) || xml.startsWith('<?', j))) {
        // A quote inside a comment or instruction of the subset opens no literal.
        const end = xml.startsWith('<!--', j) ? endOf(xml, j, 4, '-->') : endOf(xml, j, 2, '?>');
        if (end < 0) return -1;
        j = end - 1;
      } else if (c === '[') depth++;
      else if (c === ']') depth--;
      else if (c === '>' && depth <= 0) return j + 1;
    }
  }
  return -1;
}

/** The index after whitespace at `i`. */
function skipSpace(xml: string, i: number): number {
  let j = i;
  while (j < xml.length && /\s/.test(xml[j] ?? '')) j++;
  return j;
}

/**
 * PIP-010/R3: whether XML text is exactly one complete JUnit document: an optional prolog (declaration,
 * comments, instructions, doctype), one root element "testsuites" or "testsuite" with every element
 * inside it closed, and after it only whitespace, comments and instructions.
 */
function isCompleteJUnit(xml: string): boolean {
  let i = skipSpace(xml, 0);
  for (;;) {
    const next = skipMisc(xml, i, true);
    if (next < 0) break;
    i = skipSpace(xml, next);
  }
  const rootName = /^<(testsuites|testsuite)(?=[\s/>])/.exec(xml.slice(i, i + 12))?.[1];
  if (rootName === undefined) return false;
  const stack: string[] = [];
  while (i < xml.length) {
    if (xml[i] !== '<') {
      const next = xml.indexOf('<', i);
      if (next < 0) return false;
      i = next;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      i = endOf(xml, i, 9, ']]>');
    } else if (xml.startsWith('<!--', i) || xml.startsWith('<?', i)) {
      i = skipMisc(xml, i, false);
    } else if (xml.startsWith('</', i)) {
      const close = /^<\/([^\s>/]+)\s*>/.exec(xml.slice(i, i + 256));
      if (!close || close[1] !== stack.pop()) return false;
      i += close[0].length;
    } else {
      const name = /^<([^\s>/!?]+)/.exec(xml.slice(i, i + 256))?.[1];
      if (name === undefined) return false;
      // The tag ends at the first ">" outside a quoted attribute value.
      let j = i + 1 + name.length;
      let quote = '';
      while (j < xml.length && (quote !== '' || xml[j] !== '>')) {
        const c = xml[j] ?? '';
        if (quote === '' && (c === '"' || c === "'")) quote = c;
        else if (c === quote) quote = '';
        j++;
      }
      if (j >= xml.length) return false;
      if (xml[j - 1] !== '/') stack.push(name);
      i = j + 1;
    }
    if (i < 0) return false;
    if (stack.length === 0) {
      // The root has closed: only whitespace, comments and instructions may follow.
      i = skipSpace(xml, i);
      while (i < xml.length) {
        const next = skipMisc(xml, i, false);
        if (next < 0) return false;
        i = skipSpace(xml, next);
      }
      return true;
    }
  }
  return false;
}

/** Reads a report file's text in whichever supported format it is. */
export function parseTestReport(text: string): { tests: TestCase[]; failedFiles?: FailedFile[] } | { error: string } {
  const t = text.trimStart();
  if (t.startsWith('<')) return isCompleteJUnit(t) ? { tests: parseJUnit(t) } : { error: 'the XML test report is not a complete JUnit report' };
  const lines = t.split('\n').filter((l) => l.trim() !== '');
  // flutter test may print pub's progress to stdout ahead of the first event.
  const first = lines.findIndex((l) => /^\{.*("protocolVersion"|"type":\s*"(start|testStart|suite)")/.test(l.trim()));
  if (first >= 0 && lines.length - first > 1) return { tests: parseDartEvents(lines.slice(first)) };
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch {
    return { error: 'the test report is neither JSON nor JUnit XML' };
  }
  const r = JestJson.safeParse(raw);
  if (!r.success) return { error: 'the JSON test report is not in the vitest/jest or Dart format' };
  const failedFiles = r.data.testResults.flatMap((f): FailedFile[] => {
    const message = f.status === 'failed' ? firstLine(f.message) : undefined;
    return message === undefined || f.name === undefined ? [] : [{ name: f.name, message }];
  });
  return {
    ...(failedFiles.length > 0 ? { failedFiles } : {}),
    tests: r.data.testResults.flatMap((f) =>
      f.assertionResults.map((a): TestCase => {
        const status = statusOf(a.status);
        return status === 'failed' ? { name: a.title, status, ...jestFailure(a.failureDetails, a.failureMessages) } : { name: a.title, status };
      }),
    ),
  };
}

/** vitest/jest: the failure's type name is its failureDetails name, else the name that starts its message. */
function jestFailure(details: readonly unknown[] | undefined, messages: readonly unknown[] | undefined): Pick<TestCase, 'failureKind' | 'firstErrorLine'> {
  const message = typeof messages?.[0] === 'string' ? messages[0] : undefined;
  const d = details?.[0];
  const named = typeof d === 'object' && d !== null && 'name' in d && typeof d.name === 'string' && d.name !== '' ? d.name : undefined;
  const typeName = named ?? (message === undefined ? undefined : /^\s*([A-Za-z_$][\w$.]*)\s*:/.exec(message)?.[1]);
  const kind: TestFailureKind | undefined = typeName === undefined ? undefined : /Assertion|Expected/.test(typeName) ? 'assertion' : 'error';
  return failureFields(kind, message);
}

/**
 * A test covers a scenario when its name starts with the scenario ID and a space
 * ("PRV-002/S1 Fallback enabled"). For stacks whose test names must be identifiers, the ID with
 * `-` and `/` as `_` also counts, after an optional `test`/`Test` prefix ("test_PRV_002_S1_x",
 * "TestPRV_002_S1X"). Tests grouped by feature also count: a group "PRV-002" around a test
 * "S1 Fallback enabled" reports "PRV-002 S1 Fallback enabled" (Dart, Flutter).
 */
/** The scenario a test's name says it covers, in any of the styles coversScenario accepts; else null. */
export function scenarioOfTest(testName: string): string | null {
  const direct = /^([A-Z]{2,4}-\d{3,4}\/S\d+)(?=\s|$)/.exec(testName);
  if (direct?.[1]) return direct[1];
  const grouped = /^([A-Z]{2,4}-\d{3,4}) (S\d+)(?=\s|$)/.exec(testName);
  if (grouped?.[1] && grouped[2]) return `${grouped[1]}/${grouped[2]}`;
  const ident = /^([A-Z]{2,4})_(\d{3,4})_S(\d+)(?![0-9])/.exec(testName.replace(/^(test_?|Test_?)/, ''));
  if (ident?.[1] && ident[2] && ident[3]) return `${ident[1]}-${ident[2]}/S${ident[3]}`;
  return null;
}

/**
 * The scenario of this spec a test's name claims: scenarioOfTest's, when its feature prefix is one
 * of `prefixes`. Another spec's ID in a test name (a fixture's, an example's) claims nothing, as in
 * lint's L026.
 */
export function claimedScenario(testName: string, prefixes: ReadonlySet<string>): string | null {
  const s = scenarioOfTest(testName);
  return s !== null && prefixes.has(s.slice(0, s.indexOf('-'))) ? s : null;
}

export function coversScenario(testName: string, scenarioId: string): boolean {
  if (testName.startsWith(`${scenarioId} `) || testName === scenarioId) return true;
  // PIP-011/R2: a feature group's name is the feature ID, a space and the scenario number, on its own
  // ("PRV-002 S1", for a test named "S1") or followed by a space.
  const slash = scenarioId.indexOf('/');
  if (slash > 0) {
    const grouped = `${scenarioId.slice(0, slash)} ${scenarioId.slice(slash + 1)}`;
    if (testName === grouped || testName.startsWith(`${grouped} `)) return true;
  }
  const ident = scenarioId.replace(/[-/]/g, '_');
  const bare = testName.replace(/^(test_?|Test_?)/, '');
  return bare === ident || (bare.startsWith(ident) && !/[0-9]/.test(bare[ident.length] ?? ''));
}
