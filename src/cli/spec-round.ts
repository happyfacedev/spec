// PIP-012/R15 and INV-009: the spec review after an approve, when the spec round only answers findings.
// Everything is decided from the ticket's history and git; a report's `changed:` list plays no part.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReviewDiff } from '../core/brief';
import { specDelta } from '../core/delta';
import { classifyId } from '../core/ids';
import type { Ticket } from '../core/model';
import { parseSpec } from '../core/parse/spec';
import { parseTicket } from '../core/parse/tickets';
import { buildIndex } from '../core/units';
import { filesAt, git, mergeBase } from '../io/git';

/** The spec unit's feature, or its contract for a field; any other unit stands for itself. */
function holder(id: string): string {
  const kind = classifyId(id);
  if (kind === 'scenario' || kind === 'rule') return id.slice(0, id.indexOf('/'));
  if (kind === 'contract' || kind === 'field') return id.split('.').slice(0, 2).join('.');
  return id;
}

/** The cites of the findings that count: a reviewer's marked `spec`, and every spec-review finding (R15). */
function countedCites(history: Ticket['data']['history']): string[] {
  return history.flatMap((h) => {
    if (h.role === 'spec-review') return (h.findings ?? []).flatMap((f) => f.cites);
    if (h.role === 'reviewer') return (h.findings ?? []).filter((f) => f.spec === true).flatMap((f) => f.cites);
    return [];
  });
}

type Stage = Ticket['data']['history'][number];

/** The ticket's history as committed at `rev`, or null when the file is absent or does not parse. */
function committedHistory(cwd: string, rev: string, file: string): Ticket['data']['history'] | null {
  const r = git(cwd, ['show', `${rev}:./${file}`]);
  return r.code === 0 ? (parseTicket(file, r.stdout).ticket?.data.history ?? null) : null;
}

const sameRecord = (a: Stage, b: Stage): boolean => a.at === b.at && a.role === b.role && a.result === b.result && a.verdict === b.verdict;

/**
 * The latest spec-review stage commit on HEAD's first-parent-or-merged history (PIP-008/R1: subject
 * "<ID> spec-review: …" with the Spec-Ticket trailer) whose committed ticket file ends with that
 * stage's own done "approve" record, added by that commit; its position in the history is
 * returned with it. The working-tree history only confirms it (INV-009).
 */
function approveStage(cwd: string, ticket: Ticket): { commit: string; index: number } | null {
  const log = git(cwd, ['log', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e', 'HEAD', '--', ticket.file]);
  if (log.code !== 0) return null;
  const prefix = `${ticket.id} spec-review: `;
  const trailer = `Spec-Ticket: ${ticket.id}`;
  for (const entry of log.stdout.split('\x1e')) {
    const [hash = '', subject = '', body = ''] = entry.replace(/^\n/, '').split('\x1f');
    if (!hash || !subject.startsWith(prefix) || !body.split('\n').some((l) => l.trim() === trailer)) continue;
    const now = committedHistory(cwd, hash, ticket.file);
    const stage = now?.at(-1);
    if (!now || !stage || stage.role !== 'spec-review' || stage.result !== 'done' || stage.verdict !== 'approve') continue;
    // The commit added that record to what its parent held, which it left as it was.
    const before = committedHistory(cwd, `${hash}^`, ticket.file) ?? [];
    if (before.length >= now.length || !before.every((b, i) => {
      const n = now[i];
      return n !== undefined && sameRecord(b, n);
    })) continue;
    // The working-tree history must carry the same record there, and no later approve of its own.
    const live = ticket.data.history;
    const at = now.length - 1;
    const there = live[at];
    if (!there || !sameRecord(there, stage) || live.findLastIndex((h) => h.role === 'spec-review' && h.verdict === 'approve') !== at) return null;
    return { commit: hash, index: at };
  }
  return null;
}

/**
 * The approved spec with what the base branch brought since applied to it, as a tree; null when
 * that does not apply without a conflict or git cannot tell.
 */
function approvedTree(cwd: string, folder: string, excluded: readonly string[], base: string, commit: string): string | null {
  const before = mergeBase(cwd, base, commit);
  const after = mergeBase(cwd, base, 'HEAD');
  if (!before || !after) return null;
  const scratch = mkdtempSync(join(tmpdir(), 'spec-round-'));
  try {
    const env = { GIT_INDEX_FILE: join(scratch, 'index') };
    if (git(cwd, ['read-tree', commit], env).code !== 0) return null;
    if (before !== after) {
      const patch = git(cwd, ['diff', '--binary', '--no-renames', '--no-color', '--no-ext-diff', before, after, '--', folder, ...excluded]);
      if (patch.code !== 0) return null;
      if (patch.stdout !== '') {
        const top = git(cwd, ['rev-parse', '--show-toplevel']);
        if (top.code !== 0) return null;
        const file = join(scratch, 'base.patch');
        writeFileSync(file, patch.stdout);
        if (git(top.stdout.trim(), ['apply', '--cached', '--whitespace=nowarn', file], env).code !== 0) return null;
      }
    }
    const tree = git(cwd, ['write-tree'], env);
    return tree.code === 0 ? tree.stdout.trim() : null;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * The spec folder's change from the approved spec to HEAD, when every unit it adds, changes or
 * removes is cited by a counted finding recorded after the approve, or sits in a feature or
 * contract that holds a cited unit. Null whenever the full delta applies (R15).
 */
export function narrowedSpecDiff(cwd: string, ticket: Ticket, base: string, folder: string, excluded: readonly string[]): ReviewDiff | null {
  const history = ticket.data.history;
  // The approval is the committed stage record; the working-tree history only confirms it (INV-009).
  const stage = approveStage(cwd, ticket);
  if (!stage) return null;
  const { commit } = stage;
  const cites = countedCites(history.slice(stage.index + 1));
  if (cites.length === 0) return null;
  const tree = approvedTree(cwd, folder, excluded, base, commit);
  if (!tree) return null;

  const was = filesAt(cwd, tree, folder);
  const now = filesAt(cwd, 'HEAD', folder);
  if (!was || !now) return null;
  const d = specDelta(base, buildIndex(parseSpec(was)), buildIndex(parseSpec(now)));
  const cited = new Set(cites);
  const holders = new Set(cites.map(holder));
  if ([...d.added, ...d.changed, ...d.reworded, ...d.removed, ...d.unretired].some((id) => !cited.has(id) && !holders.has(holder(id)))) return null;

  const diff = git(cwd, ['diff', '--no-renames', '--no-color', tree, 'HEAD', '--', folder, ...excluded]);
  if (diff.code !== 0 || diff.stdout === '') return null;
  const short = git(cwd, ['rev-parse', '--short', commit]);
  return { base, paths: [folder], text: diff.stdout, error: null, since: short.code === 0 ? short.stdout.trim() : commit };
}
