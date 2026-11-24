// A line diff for showing a person what an update would replace. Longest common subsequence;
// role prompts and similar files are tens of lines, so quadratic is fine.

/** Unified-style lines (' ', '-', '+'), with unchanged runs cut to `context` lines around changes. */
export function lineDiff(before: string, after: string, context = 2): string[] {
  const lines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'));
  const a = lines(before);
  const b = lines(after);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] ?? [];
      row[j] = a[i] === b[j] ? (lcs[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const ops: { op: ' ' | '-' | '+'; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ op: ' ', line: a[i++] ?? '' });
      j++;
    } else if (j < b.length && (i >= a.length || (lcs[i]?.[j + 1] ?? 0) >= (lcs[i + 1]?.[j] ?? 0))) ops.push({ op: '+', line: b[j++] ?? '' });
    else ops.push({ op: '-', line: a[i++] ?? '' });
  }
  const near = (k: number) => ops.slice(Math.max(0, k - context), k + context + 1).some((o) => o.op !== ' ');
  const out: string[] = [];
  let skipped = false;
  ops.forEach((o, k) => {
    if (o.op !== ' ' || near(k)) {
      if (skipped) out.push('  …');
      skipped = false;
      out.push(`${o.op} ${o.line}`);
    } else skipped = true;
  });
  return out;
}
