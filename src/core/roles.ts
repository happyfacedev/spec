// Harness-neutral role prompts: roles/<role>.md in the skill. Templates in this repo share one
// block of rules (roles/_shared.md); `spec init` writes them out expanded and self-contained.
import { z } from 'zod';
import { type Finding, finding } from './findings';
import { parseFrontmatter } from './frontmatter';
import { parseMarkdown } from './markdown';
import { ROLES, type Role } from './schemas';

export const CAPABILITIES = ['read', 'edit', 'run', 'spec', 'tickets', 'delegate'] as const;
export type Capability = (typeof CAPABILITIES)[number];

const RoleFrontmatter = z.strictObject({
  role: z.enum(ROLES),
  description: z.string().min(1).max(200),
  capabilities: z.array(z.enum(CAPABILITIES)).min(1),
  /** Template only: what this role lists under `changed`. */
  changed: z.string().optional(),
  /** Template only: a line this role's report form holds beyond the shared ones, after `changed`. */
  form: z.string().optional(),
  /** Template only: what this role's `blockers:` entries look like, when it is more than { text, cites }. */
  blockers: z.string().optional(),
});

export interface RoleFile {
  readonly role: Role;
  readonly description: string;
  readonly capabilities: readonly Capability[];
  readonly body: string;
}

const body = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

/** A repo template plus the shared rules → the neutral role file `spec init` installs; null if it does not parse. */
export function expandRole(template: string, shared: string): string | null {
  const d = parseFrontmatter('role', parseMarkdown(template), RoleFrontmatter, 'role').data;
  if (!d) return null;
  const text = body(template)
    .replace('{shared}', shared.trim())
    .replace('\n{form}', d.form === undefined ? '' : `\n${d.form}`)
    .replaceAll('{role}', d.role)
    .replaceAll('{changed}', d.changed ?? '')
    .replaceAll('{blockers}', d.blockers ?? '{ text: "<what is unknown>", cites: [<IDs>] }');
  return `---\nrole: ${d.role}\ndescription: ${d.description}\ncapabilities: [${d.capabilities.join(', ')}]\n---\n${text}\n`;
}

export function parseRoleFile(path: string, text: string): { role: RoleFile | null; findings: Finding[] } {
  const fm = parseFrontmatter(path, parseMarkdown(text), RoleFrontmatter, 'role');
  if (!fm.data) return { role: null, findings: fm.findings };
  const findings = [...fm.findings];
  if (!path.endsWith(`/${fm.data.role}.md`) && path !== `${fm.data.role}.md`) {
    findings.push(finding('L002', path, 1, fm.data.role, `role file ${path} is not named ${fm.data.role}.md`, `rename it roles/${fm.data.role}.md`));
  }
  return { role: { role: fm.data.role, description: fm.data.description, capabilities: fm.data.capabilities, body: body(text) }, findings };
}

/** The installed CLI path for a project. Older layouts keep their skill-local launcher. */
export function projectCliPath(skillName: string | null, legacyLayout = false): string {
  return legacyLayout ? `.claude/skills/${skillName ?? 'spec'}/scripts/spec` : '.spec/bin/spec';
}
