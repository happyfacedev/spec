import { createHash } from 'node:crypto';
import { compareStrings } from './ids';

/** One file as loaded by src/io. `path` is POSIX and relative to its base (spec root or project root). */
export interface SourceFile {
  readonly path: string;
  readonly content: Uint8Array;
}

const decoder = new TextDecoder('utf-8');

/** Decoded text with CRLF normalised to LF. */
export function textOf(file: SourceFile): string {
  return decoder.decode(file.content).replace(/\r\n?/g, '\n');
}

export function sourceFromText(path: string, text: string): SourceFile {
  return { path, content: new TextEncoder().encode(text) };
}

/** Generated or bundled paths under the spec root; never authored. */
export function isGeneratedPath(path: string): boolean {
  return path === 'index.md' || path.startsWith('_generated/') || path.startsWith('scripts/');
}

export function isAuthoredPath(path: string): boolean {
  return !isGeneratedPath(path) && !path.split('/').some((seg) => seg.startsWith('.'));
}

/** Files the spec version covers: authored units and config except delegation tooling config, not role prompts or local overrides. */
export function isVersionedPath(path: string): boolean {
  return isAuthoredPath(path) && path !== 'config.local.json' && !path.startsWith('roles/');
}

function skipJsonWhitespace(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i] ?? '')) i++;
  return i;
}

function jsonStringEnd(text: string, from: number): number | null {
  for (let i = from + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '"') return i + 1;
  }
  return null;
}

function jsonValueEnd(text: string, from: number): number | null {
  const first = text[from];
  if (first === '"') return jsonStringEnd(text, from);
  if (first !== '{' && first !== '[') {
    let i = from;
    while (i < text.length && text[i] !== ',' && text[i] !== '}') i++;
    return i;
  }
  const closers = [first === '{' ? '}' : ']'];
  let quoted = false;
  for (let i = from + 1; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '\\') i++;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') closers.push('}');
    else if (char === '[') closers.push(']');
    else if (char === '}' || char === ']') {
      if (closers.pop() !== char) return null;
      if (closers.length === 0) return i + 1;
    }
  }
  return null;
}

/** The role-model map is tooling config, not part of the authored spec version. */
function withoutDelegation(text: string): string | null {
  const open = skipJsonWhitespace(text, 0);
  if (text[open] !== '{') return null;
  let i = skipJsonWhitespace(text, open + 1);
  let previousComma = -1;
  while (i < text.length && text[i] !== '}') {
    if (text[i] !== '"') return null;
    const keyEnd = jsonStringEnd(text, i);
    if (keyEnd === null) return null;
    let key: unknown;
    try {
      key = JSON.parse(text.slice(i, keyEnd));
    } catch {
      return null;
    }
    const colon = skipJsonWhitespace(text, keyEnd);
    if (text[colon] !== ':') return null;
    const valueStart = skipJsonWhitespace(text, colon + 1);
    const valueEnd = jsonValueEnd(text, valueStart);
    if (valueEnd === null) return null;
    const after = skipJsonWhitespace(text, valueEnd);
    if (key === 'delegation') {
      if (text[after] === ',') return text.slice(0, i) + text.slice(skipJsonWhitespace(text, after + 1));
      if (text[after] === '}' && previousComma >= 0) return text.slice(0, previousComma) + text.slice(valueEnd);
      if (text[after] === '}') return text.slice(0, i) + text.slice(valueEnd);
      return null;
    }
    if (text[after] === '}') return null;
    if (text[after] !== ',') return null;
    previousComma = after;
    i = skipJsonWhitespace(text, after + 1);
  }
  return null;
}

/**
 * spec@<first 8 hex of SHA-256 over the sorted (path, content) pairs of authored spec files>.
 * Each pair is encoded as path NUL content NUL so no two file sets collide.
 */
export function specVersion(files: readonly SourceFile[]): string {
  const hash = createHash('sha256');
  const authored = files.filter((f) => isVersionedPath(f.path)).sort((a, b) => compareStrings(a.path, b.path));
  for (const f of authored) {
    hash.update(f.path, 'utf8');
    hash.update(new Uint8Array([0]));
    const config = f.path === 'config.json' ? withoutDelegation(decoder.decode(f.content)) : null;
    const content = config === null ? f.content : new TextEncoder().encode(config);
    hash.update(content);
    hash.update(new Uint8Array([0]));
  }
  return `spec@${hash.digest('hex').slice(0, 8)}`;
}

/** Line count as an editor shows it: a trailing newline does not add a line. */
export function lineCount(text: string): number {
  if (text === '') return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
}
