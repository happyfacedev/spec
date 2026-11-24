import { describe as baseDescribe, it as baseIt } from 'vitest';

function partition(name: unknown, count: number): number {
  let hash = 2;
  for (const char of String(name)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % count;
}

export function partitionedIt(count: number): typeof baseIt {
  const part = Number(process.env['SPEC_TEST_PART'] ?? 0);
  const selected = (name: unknown) =>
    process.env['SPEC_TEST_PART_ALL'] === '1' || partition(name, count) === part;
  const register = ((...args: Parameters<typeof baseIt>) => {
    if (selected(args[0])) baseIt(...args);
  }) as typeof baseIt;

  register.each = ((...tableArgs: Parameters<typeof baseIt.each>) => {
    const each = baseIt.each(...tableArgs);
    return (...args: Parameters<ReturnType<typeof baseIt.each>>) => {
      if (selected(args[0])) each(...args);
    };
  }) as typeof baseIt.each;

  return register;
}

export function partitionedDescribe(
  count: number,
  splitTitle?: string | readonly string[],
  partOverrides: Readonly<Record<string, number>> = {},
): typeof baseDescribe {
  const part = Number(process.env['SPEC_TEST_PART'] ?? 0);
  const splitTitles = typeof splitTitle === 'string' ? [splitTitle] : splitTitle ?? [];
  let depth = 0;
  let topLevelOrdinal = 0;
  let nestedOrdinal = 0;

  const register = (title: string, callback: () => void): void => {
    const all = process.env['SPEC_TEST_PART_ALL'] === '1';
    const topLevel = depth === 0;
    const splitGroup = topLevel && splitTitles.includes(title);
    const defaultPart = splitGroup ? -1 : topLevel ? topLevelOrdinal++ % count : nestedOrdinal++ % count;
    const splitNested = splitTitles.length > 0 && depth === 1;
    const included = all || splitGroup || (topLevel || splitNested
      ? (partOverrides[title] ?? defaultPart) === part
      : true);
    if (!included) return;

    const forceAll = all || (topLevel && !splitGroup) || splitNested;
    const wrapped = () => {
      const previous = process.env['SPEC_TEST_PART_ALL'];
      if (forceAll) process.env['SPEC_TEST_PART_ALL'] = '1';
      depth++;
      try {
        callback();
      } finally {
        depth--;
        if (forceAll) {
          if (previous === undefined) delete process.env['SPEC_TEST_PART_ALL'];
          else process.env['SPEC_TEST_PART_ALL'] = previous;
        }
      }
    };
    baseDescribe(title, wrapped);
  };
  return register as typeof baseDescribe;
}
