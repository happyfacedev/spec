// The spec's type language: one portable notation for `Type:` and `Output:`, whatever the stack.
//
//   member   = type "?"?          ("?": the member may be absent; members only)
//   type     = union
//   union    = list ("|" list)*
//   list     = primary ("[]")*
//   primary  = primitive | literal | ref | "map<" type "," type ">" | "(" type ")"
//   primitive: string int number decimal bool bytes date datetime duration null
//   literal  : "text" or a number
//   ref      : <module>.<Name> (a contract the spec defines)
//
// Absent and null differ: `T?` may be left out; `T | null` is always there and may be null (JSON,
// TypeScript `?:`, Go `omitempty` and Python `NotRequired` all tell them apart). `?` applies to
// the whole type, so a union takes parentheses: `(A | B)?`. A shape with named keys is a `Kind:
// type` contract with `####` members, never an inline object: its keys then have IDs impact can
// follow. `decimal` is exact (money); `number` is not. Each stack maps the notation once
// (docs/FORMAT.md).

export const PRIMITIVES = ['string', 'int', 'number', 'decimal', 'bool', 'bytes', 'date', 'datetime', 'duration', 'null'] as const;

/**
 * Native spellings writers reach for, with the portable form to write instead. `$` is the inner
 * type. Where a native name means different things in different stacks, the fix names each reading
 * (Python's Optional is nullable; Java's may be absent), so it never changes what was meant.
 */
const MAYBE = '$? (may be absent) or $ | null (may be null)';
const NATIVE: Readonly<Record<string, string>> = {
  List: '$[]',
  Array: '$[]',
  Set: '$[], and state that items are unique as a rule',
  Iterable: '$[]',
  Sequence: '$[]',
  Vec: '$[]',
  Map: 'map<$>',
  Dict: 'map<$>',
  Record: 'map<$>',
  Optional: MAYBE,
  Option: MAYBE,
  Maybe: MAYBE,
  Nullable: '$ | null',
  String: 'string',
  Int: 'int',
  Integer: 'int',
  Long: 'int',
  long: 'int',
  integer: 'int',
  Number: 'number',
  Double: 'number',
  double: 'number',
  Float: 'number',
  float: 'number',
  Decimal: 'decimal',
  BigDecimal: 'decimal',
  Bool: 'bool',
  Boolean: 'bool',
  boolean: 'bool',
  DateTime: 'datetime',
  Date: 'date',
  Duration: 'duration',
  Uint8List: 'bytes',
  void: 'null (an operation with no result is Output: null)',
  None: 'null',
  undefined: 'T? on a member that may be absent, or null',
};

type Token = { kind: 'ref' | 'name' | 'literal' | 'sym'; text: string };

const TOKEN = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)|([a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)|([A-Za-z_][A-Za-z0-9_]*)|(\[\]|[|<>,(){}[\]?:]))/y;

function tokenize(expr: string): Token[] | string {
  const out: Token[] = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  while (at < expr.length) {
    if (expr.slice(at).trim() === '') break;
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(expr);
    if (!m) return `unexpected "${expr.slice(at).trim()[0] ?? ''}"`;
    if (m[1] !== undefined) out.push({ kind: 'literal', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'ref', text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: 'name', text: m[3] });
    else out.push({ kind: 'sym', text: m[4] ?? '' });
    at = TOKEN.lastIndex;
  }
  return out;
}

/** The contract IDs a type expression names. A quoted literal is a value, never a reference. */
export function typeRefs(expr: string): string[] {
  const toks = tokenize(expr);
  if (typeof toks === 'string') return [];
  return [...new Set(toks.filter((t) => t.kind === 'ref').map((t) => t.text))];
}

export interface TypeProblem {
  readonly message: string;
}

/**
 * Null when `expr` is a spec type, else what is wrong with it. `known` names the contracts the
 * spec defines by their bare Name, so `ProviderId` can be answered with `providers.ProviderId`.
 */
export function checkType(expr: string, known: ReadonlyMap<string, readonly string[]> = new Map(), member = false): TypeProblem | null {
  if (/\{/.test(expr)) return { message: 'an inline object; name it as a Kind: type contract with members' };
  const toks = tokenize(expr);
  if (typeof toks === 'string') return { message: toks };
  let i = 0;
  const peek = () => toks[i];
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const expect = (text: string) => {
    if (peek()?.text !== text) fail(peek() ? `unexpected "${peek()?.text ?? ''}"; expected "${text}"` : `expected "${text}"`);
    i++;
  };
  const inner = (): string => {
    // The text of a native type's <…> arguments, for the fix message.
    let depth = 0;
    const parts: string[] = [];
    for (; i < toks.length; i++) {
      const t = toks[i];
      if (!t) break;
      if (t.text === '<') depth++;
      else if (t.text === '>') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      if (depth > 0 && !(depth === 1 && t.text === '<')) parts.push(t.text === ',' ? ', ' : t.text);
    }
    return parts.join('');
  };
  const primary = (): void => {
    const t = peek();
    if (!t) fail('expected a type');
    if (!t) return;
    i++;
    if (t.kind === 'literal' || t.kind === 'ref') return;
    if (t.text === '(') {
      union();
      expect(')');
      return;
    }
    if (t.kind === 'sym') fail(`unexpected "${t.text}"`);
    if ((PRIMITIVES as readonly string[]).includes(t.text)) return;
    if (t.text === 'map') {
      expect('<');
      union();
      expect(',');
      union();
      expect('>');
      return;
    }
    const native = NATIVE[t.text];
    if (native !== undefined) {
      const args = peek()?.text === '<' ? inner() : '';
      fail(`${t.text} is not a spec type; write ${native.replaceAll('$', args || 'T')}`);
    }
    const defined = known.get(t.text);
    if (defined && defined.length > 0) fail(`${t.text} is written bare; write ${defined.join(' or ')}`);
    if (/^[A-Z]/.test(t.text)) fail(`${t.text} is not defined; add it as a type contract and write <module>.${t.text}`);
    fail(`${t.text} is not a primitive (${PRIMITIVES.join(', ')})`);
  };
  const list = () => {
    primary();
    while (peek()?.text === '[]') i++;
  };
  const union = (): number => {
    let alternatives = 1;
    list();
    while (peek()?.text === '|') {
      i++;
      list();
      alternatives++;
    }
    return alternatives;
  };
  try {
    const alternatives = union();
    if (peek()?.text === '?') {
      i++;
      if (!member) fail('only a member may be optional (?)');
      if (alternatives > 1) fail(`? makes the whole type optional; write (${expr.trim().replace(/\?$/, '').trim()})?`);
    }
    if (i < toks.length) fail(`unexpected "${peek()?.text ?? ''}"`);
    return null;
  } catch (e) {
    return { message: e instanceof Error ? e.message : String(e) };
  }
}
