// The shipped-prompt manifest (INS-005/R5): which stage-role prompts each version of spec shipped.
import { ROLE_MANIFEST } from '../generated/role-manifest';
import { STAGE_ROLES, type StageRole } from './schemas';

/** Whether the manifest lists any prompt for this version. */
export function manifestHasVersion(version: string): boolean {
  return Object.hasOwn(ROLE_MANIFEST, version);
}

/** Whether `hash` (a sha256 in hex) is a prompt this version shipped for `role`. */
export function manifestListsRole(version: string, role: StageRole, hash: string): boolean {
  if (!Object.hasOwn(ROLE_MANIFEST, version)) return false;
  const roles = ROLE_MANIFEST[version];
  return roles !== undefined && Object.hasOwn(roles, role) && (roles[role] ?? []).includes(hash);
}

/** The stage role of a path `<spec root>/roles/<role>.md` (a `.local.md` or any other path is none). */
export function stageRoleOfPath(specRel: string, path: string): StageRole | null {
  const prefix = `${specRel === '' ? '' : `${specRel}/`}roles/`;
  if (!path.startsWith(prefix) || !path.endsWith('.md')) return null;
  const name = path.slice(prefix.length, -'.md'.length);
  return STAGE_ROLES.find((role) => role === name) ?? null;
}
