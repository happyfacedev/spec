import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { git } from './git';
import { z } from 'zod';

export interface RootInputs {
  readonly flag: string | null;
  readonly env: string | undefined;
  readonly claudeProjectDir?: string | undefined;
  /** Path of the running script (process.argv[1]). */
  readonly scriptPath: string | undefined;
  readonly cwd: string;
}

/** cli.InvalidSkillPointer: the skill.json that root resolution reads is not valid JSON. */
export class InvalidSkillPointer extends Error {
  constructor(readonly file: string) {
    super(`${file} is not valid JSON`);
    this.name = 'InvalidSkillPointer';
  }
}

/** `<skill>/skill.json`: where the harness adapter's skill folder finds the spec. */
const SkillPointer = z.object({ specRoot: z.string().min(1) });

/** `<project>/.claude/skills/<name>` → `<project>`, or null for any other folder. */
function projectOfSkill(skillDir: string): string | null {
  const skills = dirname(skillDir);
  const claude = dirname(skills);
  return basename(skills) === 'skills' && basename(claude) === '.claude' ? dirname(claude) : null;
}

/** Links followed in one launcher path before it counts as a loop (the kernel's own limit). */
const MAX_LINKS = 40;

/**
 * The file a launcher path leads to: each symlink in the chain is followed, a relative target against
 * its link's folder. A symlinked folder above the launcher's name is not followed, so the path keeps
 * the folder as typed (on macOS, /var stays /var rather than /private/var).
 */
function followLinks(path: string): string | null {
  let file = path;
  for (let hops = 0; lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink(); hops++) {
    if (hops === MAX_LINKS) return null;
    file = resolve(dirname(file), readlinkSync(file));
  }
  return file;
}

/**
 * --root, then SPEC_ROOT, then an older skill.json pointer, a project-local .spec/bin launcher, and
 * finally the nearest spec/config.json above CLAUDE_PROJECT_DIR (or cwd), without crossing its Git boundary.
 */
function canonicalDir(path: string): string {
  const absolute = resolve(path);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function insideOrAt(path: string, boundary: string): boolean {
  const fromBoundary = relative(boundary, path);
  return fromBoundary === '' || (!fromBoundary.startsWith('..') && !isAbsolute(fromBoundary));
}

function projectOfProjectLauncher(path: string): string | null {
  const bin = dirname(path);
  if (basename(path) !== 'spec' || basename(bin) !== 'bin' || basename(dirname(bin)) !== '.spec') return null;
  return dirname(dirname(bin));
}

export function resolveSpecRoot(i: RootInputs): string | null {
  if (i.flag) return resolve(i.cwd, i.flag);
  if (i.env) return resolve(i.cwd, i.env);

  if (i.scriptPath) {
    const typedLauncher = resolve(i.cwd, i.scriptPath);
    const typedProject = projectOfProjectLauncher(typedLauncher);
    if (typedProject) return resolve(typedProject, 'spec');
    const launcher = followLinks(typedLauncher);
    if (launcher) {
      const project = projectOfProjectLauncher(launcher);
      if (project) return resolve(project, 'spec');
      const bin = dirname(launcher);
      if (basename(bin) === 'scripts') {
        const skill = dirname(bin);
        const pointer = resolve(skill, 'skill.json');
        if (existsSync(pointer)) {
          let json: unknown;
          try {
            json = JSON.parse(readFileSync(pointer, 'utf8'));
          } catch (err) {
            if (err instanceof SyntaxError) throw new InvalidSkillPointer(pointer);
            throw err;
          }
          const p = SkillPointer.safeParse(json);
          if (p.success) return resolve(projectOfSkill(skill) ?? dirname(skill), p.data.specRoot);
        }
        if (existsSync(resolve(skill, 'config.json'))) return skill;
      }
    }
  }

  const start = canonicalDir(i.claudeProjectDir ?? i.cwd);
  const cwd = canonicalDir(i.cwd);
  const projectDir = i.claudeProjectDir ? canonicalDir(i.claudeProjectDir) : null;
  const projectIsAncestor = projectDir !== null && (relative(projectDir, cwd) === '' || (!relative(projectDir, cwd).startsWith('..') && !isAbsolute(relative(projectDir, cwd))));
  const gitRootResult = git(start, ['rev-parse', '--show-toplevel']);
  const boundary = projectIsAncestor ? projectDir : (gitRootResult.code === 0 ? canonicalDir(gitRootResult.stdout.trim()) : null);
  let dir = start;
  while (boundary === null || insideOrAt(dir, boundary)) {
    const spec = resolve(dir, 'spec');
    if (existsSync(resolve(spec, 'config.json'))) return spec;
    if (boundary !== null && dir === boundary) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * The project the spec describes; config paths are relative to it. config.json's `projectRoot`
 * (relative to the spec root) decides when set. Otherwise a spec inside
 * `<project>/.claude/skills/<name>/` (older installs) belongs to `<project>`, and any other spec
 * root belongs to its parent: `spec init` puts the spec at `<project>/spec`. A git-root search
 * would be wrong for a project nested in another repository, such as this repo's fixture.
 */
export function resolveProjectRoot(specRoot: string, configured?: string): string {
  if (configured) return resolve(specRoot, configured);
  return projectOfSkill(specRoot) ?? dirname(specRoot);
}
