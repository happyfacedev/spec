// Path globs for config.json: `**` crosses directories,
// `*` and `?` stay within one segment. Paths are POSIX and relative to the project root.

const cache = new Map<string, RegExp>();

export function globToRegExp(glob: string): RegExp {
  const hit = cache.get(glob);
  if (hit) return hit;
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] ?? '';
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` matches zero or more directories; a trailing `**` matches everything below.
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const out = new RegExp(`^${re}$`);
  cache.set(glob, out);
  return out;
}

export const matchesGlob = (path: string, glob: string): boolean => globToRegExp(glob).test(path);
export const matchesAny = (path: string, globs: readonly string[]): boolean => globs.some((g) => matchesGlob(path, g));

/** A config glob must stay within the project and use the path spelling matched by the CLI. */
export function isProjectRelativeGlob(glob: string): boolean {
  return glob !== ''
    && !glob.startsWith('/')
    && !/^[A-Za-z]:/.test(glob)
    && !glob.includes('\\')
    && glob.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}
