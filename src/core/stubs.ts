// Test-first in compiled languages. A test against code that does not exist yet does not compile
// (Dart, Go, Rust, Java, Swift), so it gives no result at all. On a proposal the tester may add
// stubs: the smallest code that compiles and throws, at the entry point a contract names, marked
// SPEC-STUB. Every code change the tester makes must carry the marker, and the implementer may
// finish only when no marker its ticket's branch added is left.

export const STUB_MARKER = 'SPEC-STUB';

export interface Hunk {
  readonly removed: readonly string[];
  readonly added: readonly string[];
}

export interface FileHunks {
  readonly path: string;
  readonly hunks: readonly Hunk[];
}

/** `git diff -U0` output → the changed lines of each file, hunk by hunk. */
export function parseUnifiedDiff(text: string): FileHunks[] {
  const files: { path: string; hunks: { removed: string[]; added: string[] }[] }[] = [];
  let file: (typeof files)[number] | null = null;
  let hunk: { removed: string[]; added: string[] } | null = null;
  for (const line of text.split('\n')) {
    const b = /^\+\+\+ b\/(.*)$/.exec(line);
    if (line.startsWith('diff --git ')) {
      file = null;
      hunk = null;
    } else if (b) {
      file = { path: b[1] ?? '', hunks: [] };
      files.push(file);
    } else if (line.startsWith('@@') && file) {
      hunk = { removed: [], added: [] };
      file.hunks.push(hunk);
    } else if (hunk && line.startsWith('+') && !line.startsWith('+++')) hunk.added.push(line.slice(1));
    else if (hunk && line.startsWith('-') && !line.startsWith('---')) hunk.removed.push(line.slice(1));
  }
  return files;
}

/**
 * Files where the changes add a marker: a hunk with more added than removed lines holding it.
 * A line that held the marker before and was only edited is not a new stub.
 */
export function filesAddingStubs(files: readonly FileHunks[]): string[] {
  const marked = (lines: readonly string[]) => lines.filter((l) => l.includes(STUB_MARKER)).length;
  return [...new Set(files.filter((f) => f.hunks.some((h) => marked(h.added) > marked(h.removed))).map((f) => f.path))].sort();
}

/** Each change that is not a stub: a hunk whose added lines do not carry the marker. */
export function unmarkedChanges(files: readonly FileHunks[]): { path: string; line: string }[] {
  const out: { path: string; line: string }[] = [];
  for (const f of files) {
    for (const h of f.hunks) {
      if (h.added.some((l) => l.includes(STUB_MARKER))) continue;
      // A blank line between stubs changes nothing.
      if (h.removed.length === 0 && h.added.every((l) => l.trim() === '')) continue;
      const first = h.added.find((l) => l.trim() !== '') ?? (h.removed[0] !== undefined ? `(removed) ${h.removed[0]}` : '');
      out.push({ path: f.path, line: first.trim() });
    }
  }
  return out;
}
