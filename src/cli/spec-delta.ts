// The spec as the ticket's branch changed it: the working tree against the merge base with the
// base branch. Null outside a repository or without a base branch.
import { relative } from 'node:path';
import { type SpecDelta, specDelta } from '../core/delta';
import { parseSpec } from '../core/parse/spec';
import { buildIndex } from '../core/units';
import { toPosix } from '../io/fs';
import { filesAt, isRepo, mergeBase } from '../io/git';
import type { Workspace } from '../io/workspace';

export function ticketDelta(ws: Workspace): SpecDelta | null {
  if (!isRepo(ws.projectRoot)) return null;
  const base = ws.config?.baseBranch ?? 'main';
  const fork = mergeBase(ws.projectRoot, base, 'HEAD');
  if (!fork) return null;
  const files = filesAt(ws.projectRoot, fork, toPosix(relative(ws.projectRoot, ws.specRoot)));
  if (!files) return null;
  return specDelta(base, buildIndex(parseSpec(files)), buildIndex(ws.spec));
}
