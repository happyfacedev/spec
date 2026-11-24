// `spec brief`: always exits 0 and prints problems as text (D17).
import { type ReviewDiff, USAGE_LINE, buildBrief } from '../core/brief';
import { relative } from 'node:path';
import type { Ticket } from '../core/model';
import { ROLES } from '../core/schemas';
import { buildIndex } from '../core/units';
import { toPosix } from '../io/fs';
import { git, isRepo, mergeBase } from '../io/git';
import type { Workspace } from '../io/workspace';
import type { Args } from './args';
import { generatedPaths } from './generated';
import { type Out, ok } from './output';
import { ticketDelta } from './spec-delta';
import { narrowedSpecDiff } from './spec-round';
import { depsOf } from './tickets';

/** `git diff <base>...HEAD` limited to the code and test globs. */
export function reviewDiff(ws: Workspace, base: string): ReviewDiff {
  const globs = [...(ws.config?.codeGlobs ?? []), ...(ws.config?.testGlobs ?? [])];
  if (!isRepo(ws.projectRoot)) return { base, paths: globs, text: null, error: 'not a git repository' };
  const r = git(ws.projectRoot, ['diff', '--no-renames', '--no-color', `${base}...HEAD`, '--', ...globs.map((g) => `:(glob)${g}`)]);
  if (r.code !== 0) return { base, paths: globs, text: null, error: r.stderr.trim().split('\n')[0] ?? 'git diff failed' };
  return { base, paths: globs, text: r.stdout, error: null };
}

/** `git diff` of the spec folder against the merge base with the base branch, committed changes only, generated files left out (PIP-012/R11). */
export function specFolderDiff(ws: Workspace, ticket: Ticket | null = null): ReviewDiff {
  const base = ws.config?.baseBranch ?? 'main';
  const folder = toPosix(relative(ws.projectRoot, ws.specRoot)) || '.';
  if (!isRepo(ws.projectRoot)) return { base, paths: [folder], text: null, error: 'not a git repository' };
  const fork = mergeBase(ws.projectRoot, base, 'HEAD');
  if (!fork) return { base, paths: [folder], text: null, error: `no merge base with ${base}` };
  const excluded = generatedPaths(ws).map((p) => (/[*?[\]{}]/.test(p) ? `:(exclude,glob)${p}` : `:(exclude)${p}`));
  // PIP-012/R15: after an approve, a round that only answers findings is reviewed alone.
  const narrowed = ticket?.data.type === 'proposal' ? narrowedSpecDiff(ws.projectRoot, ticket, base, folder, excluded) : null;
  if (narrowed) return narrowed;
  const r = git(ws.projectRoot, ['diff', '--no-renames', '--no-color', fork, 'HEAD', '--', folder, ...excluded]);
  if (r.code !== 0) return { base, paths: [folder], text: null, error: r.stderr.trim().split('\n')[0] ?? 'git diff failed' };
  return { base, paths: [folder], text: r.stdout, error: null };
}

/** The brief for one role and ID, with what only git knows: the reviewer's diff, a proposal's spec delta. */
export function briefFor(ws: Workspace, role: string, id: string, base: string | null = null, query = ''): string {
  const r = role.trim();
  const ticket = ws.tickets.tickets.find((t) => t.id === id.trim());
  const diff = r === 'reviewer' ? reviewDiff(ws, base ?? ws.config?.baseBranch ?? 'main') : null;
  // Every role's brief keeps what the branch changed whole (PIP-013/R5); only three show it as "New in the spec".
  const delta = ticket?.data.type === 'proposal' && (ROLES as readonly string[]).includes(r) ? ticketDelta(ws) : null;
  const specDiff = r === 'spec-review' && ticket !== undefined ? specFolderDiff(ws, ticket) : null;
  return buildBrief({ spec: ws.spec, index: buildIndex(ws.spec), tickets: ws.tickets, role, id, budgets: ws.config?.budgets ?? {}, diff, specDiff, delta, deps: depsOf(ws), query });
}

/** An argument the skill loader left unexpanded: Claude Code passes `$1` itself when it is not given. */
const unexpanded = (a: string): string => (/^\$(\d+|ARGUMENTS)$/.test(a.trim()) ? '' : a);

export function cmdBrief(ws: Workspace, args: Args, stdin: string | null = null): Out {
  if (stdin !== null) {
    // The whole text as sent: its first word is the role, its second the ID, all of it the query.
    const text = stdin.replace(/\r?\n$/, '');
    const [role = '', id = ''] = text.trim().split(/\s+/).map(unexpanded);
    return ok(briefFor(ws, role, id, args.base, unexpanded(text)));
  }
  // SKILL.md passes '$0' '$1'. Seen live (Claude Code 2.1.311): a missing one arrives as the
  // literal text `$0` or `$1`, not as an empty string.
  const [role = '', id = '', ...extra] = args.positionals.map(unexpanded);
  if (extra.length > 0) return ok(`spec brief takes a role and one ID; ignored: ${extra.join(' ')}\n${USAGE_LINE}\n`);
  return ok(briefFor(ws, role, id, args.base, unexpanded(args.query ?? '')));
}
