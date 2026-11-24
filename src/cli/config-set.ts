import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isClaudeCodeModel } from '../core/delegation';
import { ConfigSchema, LocalConfigSchema, STAGE_ROLES } from '../core/schemas';
import { type Args, USAGE } from './args';
import { type Out, json, ok, usageError } from './output';

interface JsonMember {
  readonly key: string;
  readonly start: number;
  readonly value: JsonNode;
}
interface JsonNode {
  readonly type: 'object' | 'array' | 'scalar';
  readonly start: number;
  readonly end: number;
  readonly close?: number;
  readonly members?: readonly JsonMember[];
}

function whitespace(text: string, at: number): number {
  while (/\s/.test(text[at] ?? '')) at++;
  return at;
}

function stringEnd(text: string, at: number): number {
  at++;
  while (at < text.length) {
    if (text[at] === '\\') at += 2;
    else if (text[at] === '"') return at + 1;
    else at++;
  }
  throw new Error('invalid JSON string');
}

function parseNode(text: string, start: number): JsonNode {
  const at = whitespace(text, start);
  const first = text[at];
  if (first === '"') return { type: 'scalar', start: at, end: stringEnd(text, at) };
  if (first === '{') {
    let cursor = whitespace(text, at + 1);
    const members: JsonMember[] = [];
    if (text[cursor] === '}') return { type: 'object', start: at, close: cursor, end: cursor + 1, members };
    while (cursor < text.length) {
      const memberStart = whitespace(text, cursor);
      if (text[memberStart] !== '"') throw new Error('invalid JSON object');
      const keyEnd = stringEnd(text, memberStart);
      const key = JSON.parse(text.slice(memberStart, keyEnd)) as string;
      cursor = whitespace(text, keyEnd);
      if (text[cursor] !== ':') throw new Error('invalid JSON object');
      const value = parseNode(text, cursor + 1);
      members.push({ key, start: memberStart, value });
      cursor = whitespace(text, value.end);
      if (text[cursor] === '}') return { type: 'object', start: at, close: cursor, end: cursor + 1, members };
      if (text[cursor] !== ',') throw new Error('invalid JSON object');
      cursor = whitespace(text, cursor + 1);
    }
    throw new Error('invalid JSON object');
  }
  if (first === '[') {
    let cursor = whitespace(text, at + 1);
    if (text[cursor] === ']') return { type: 'array', start: at, close: cursor, end: cursor + 1, members: [] };
    while (cursor < text.length) {
      const value = parseNode(text, cursor);
      cursor = whitespace(text, value.end);
      if (text[cursor] === ']') return { type: 'array', start: at, close: cursor, end: cursor + 1, members: [] };
      if (text[cursor] !== ',') throw new Error('invalid JSON array');
      cursor = whitespace(text, cursor + 1);
    }
    throw new Error('invalid JSON array');
  }
  let end = at;
  while (end < text.length && !/[\s,}\]]/.test(text[end] ?? '')) end++;
  return { type: 'scalar', start: at, end };
}

function parseRoot(text: string): JsonNode {
  JSON.parse(text);
  const root = parseNode(text, 0);
  if (root.type !== 'object') throw new Error('config must be a JSON object');
  return root;
}

function memberOf(node: JsonNode, key: string): JsonMember | undefined {
  return node.type === 'object' ? node.members?.find((member) => member.key === key) : undefined;
}

function indentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart, offset))?.[0] ?? '';
}

function insertMember(text: string, node: JsonNode, key: string, value: unknown): string {
  const close = node.close;
  if (node.type !== 'object' || close === undefined) throw new Error('config parent must be an object');
  const members = node.members ?? [];
  const encoded = JSON.stringify(key) + ': ' + JSON.stringify(value);
  if (members.length === 0) {
    const between = text.slice(node.start + 1, close);
    if (between.includes('\n')) {
      const closeIndent = indentAt(text, close);
      const memberIndent = closeIndent + '  ';
      return text.slice(0, node.start + 1) + '\n' + memberIndent + encoded + '\n' + closeIndent + text.slice(close);
    }
    return text.slice(0, close) + encoded + text.slice(close);
  }
  const last = members[members.length - 1];
  if (!last) throw new Error('config object could not be edited');
  const between = text.slice(node.start + 1, close);
  if (between.includes('\n')) {
    const trailing = text.slice(last.value.end, close);
    const indent = indentAt(text, last.start);
    return text.slice(0, last.value.end) + ',\n' + indent + encoded + trailing + text.slice(close);
  }
  const trailing = text.slice(last.value.end, close);
  return text.slice(0, last.value.end) + `,${trailing || ' '}${encoded}` + text.slice(close);
}

function setJsonPath(text: string, path: readonly string[], value: unknown): string {
  const root = parseRoot(text);
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i] ?? '';
    const member = memberOf(node, segment);
    if (!member) return setJsonPath(insertMember(text, node, segment, {}), path, value);
    if (member.value.type !== 'object') throw new Error(`${path.slice(0, i + 1).join('.')} must be an object`);
    node = member.value;
  }
  const key = path.at(-1);
  if (!key) throw new Error('a config key is required');
  const existing = memberOf(node, key);
  if (existing) return text.slice(0, existing.value.start) + JSON.stringify(value) + text.slice(existing.value.end);
  return insertMember(text, node, key, value);
}

function valueFor(key: string, raw: string): unknown {
  if (key === 'codeGlobs' || key === 'testGlobs' || key === 'checkCommands') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`${key} must be a JSON array, for example ${key === 'checkCommands' ? '["npm run lint"]' : '["src/**"]'}`);
    }
  }
  if (key.startsWith('unavailableModels.')) {
    if (raw !== 'true' && raw !== 'false') throw new Error(`${key} must be true or false`);
    return raw === 'true';
  }
  if (key.startsWith('delegation.') && raw.startsWith('[')) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      // Another harness's delegate role name is free-form, so text that is no list stays text (CLI-008/R9).
      if (!key.startsWith('delegation.claude-code.')) return raw;
      throw new Error(`${key} must be a model or a JSON list, for example '[{"model":"sonnet","effort":"high"}]'`);
    }
  }
  return raw;
}

function validateDelegationValue(key: string, value: unknown, force: boolean): string | null {
  const [root, harness] = key.split('.');
  if (root !== 'delegation' || !harness) return null;
  if (!['claude-code', 'astro'].includes(harness) && !force) return `unsupported delegation harness ${harness}; pass --force to configure a custom harness`;
  if (harness !== 'claude-code') return null;
  const choices: unknown[] = Array.isArray(value) ? value : [value];
  for (const choice of choices) {
    const model = choice !== null && typeof choice === 'object' && 'model' in choice ? choice.model : choice;
    // An entry that names no model at all is left to the config schema.
    if (typeof model === 'string' && !isClaudeCodeModel(model)) return `unsupported Claude Code model ${model}; use sonnet, opus, haiku or fable`;
  }
  return null;
}

function ensureLocalConfigIgnored(specRoot: string): void {
  const path = join(specRoot, '.gitignore');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (current.split(/\r?\n/).some((line) => line.trim() === 'config.local.json')) return;
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const separator = current === '' || current.endsWith('\n') ? '' : newline;
  writeFileSync(path, `${current}${separator}config.local.json${newline}`);
}

function keyPath(key: string, local: boolean): string[] | null {
  if (['name', 'testCommand', 'checkCommands', 'baseBranch', 'worktreeSetup', 'codeGlobs', 'testGlobs'].includes(key)) return local ? null : [key];
  const pieces = key.split('.');
  if (pieces.length === 2 && pieces[0] === 'unavailableModels' && isClaudeCodeModel(pieces[1])) return local ? pieces : null;
  if (pieces.length === 3 && pieces[0] === 'delegation' && pieces[1] && pieces[2]
    && (STAGE_ROLES as readonly string[]).includes(pieces[2])) return pieces;
  return null;
}

export function cmdConfigSet(args: Args, specRoot: string): Out {
  if (args.positionals[0] !== 'set' || args.positionals.length !== 3) {
    return usageError('usage: spec config set <key> <value> [--local]', USAGE);
  }
  const [key, raw] = args.positionals.slice(1);
  if (!key || raw === undefined) return usageError('usage: spec config set <key> <value> [--local]', USAGE);
  const path = keyPath(key, args.local);
  if (!path) {
    const reason = args.local
      ? '--local is allowed only for delegation.<harness>.<role> and unavailableModels.<sonnet|opus|haiku|fable>'
      : keyPath(key, true) !== null ? `${key} needs --local` : `unknown or unsupported config key ${key}`;
    return usageError(reason, USAGE);
  }
  let value: unknown;
  try {
    value = valueFor(key, raw);
  } catch (e) {
    return usageError(e instanceof Error ? e.message : String(e), USAGE);
  }
  const delegationError = validateDelegationValue(key, value, args.force);
  if (delegationError) return usageError(delegationError, USAGE);
  const file = join(specRoot, args.local ? 'config.local.json' : 'config.json');
  if (!args.local && !existsSync(file)) return usageError('spec/config.json does not exist; run spec init first', USAGE);
  let text: string;
  try {
    text = existsSync(file) ? readFileSync(file, 'utf8') : '{\n  "delegation": {}\n}\n';
    const updated = setJsonPath(text, path, value);
    let checked: unknown;
    try {
      checked = JSON.parse(updated) as unknown;
    } catch (e) {
      throw new Error(`updated JSON is invalid: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    const result = args.local ? LocalConfigSchema.safeParse(checked) : ConfigSchema.safeParse(checked);
    if (!result.success) {
      const issue = result.error.issues[0];
      const at = issue?.path.map(String).join('.') || '(root)';
      throw new Error(`${args.local ? 'config.local.json' : 'config.json'} ${at}: ${issue?.message ?? 'invalid value'}`);
    }
    if (args.local) ensureLocalConfigIgnored(specRoot);
    writeFileSync(file, updated);
    const response = { path: args.local ? 'spec/config.local.json' : 'spec/config.json', key, value, local: args.local };
    return args.format === 'json' ? json(response) : ok(`set ${key} in ${response.path}\n`);
  } catch (e) {
    return usageError(e instanceof Error ? e.message : String(e), USAGE);
  }
}
