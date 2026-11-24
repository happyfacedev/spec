import { type Finding, countErrors, countWarnings } from '../core/findings';
import { toJson } from '../core/graph';

export interface Out {
  stdout: string;
  stderr: string;
  code: number;
}

export const ok = (stdout: string, code = 0): Out => ({ stdout, stderr: '', code });
export const usageError = (message: string, usage: string, code = 2): Out => ({ stdout: '', stderr: `${message}\n\n${usage}`, code });
export const json = (value: unknown, code = 0): Out => ok(toJson(value), code);

export function renderFindings(findings: readonly Finding[]): string {
  const lines: string[] = [];
  for (const f of findings) {
    lines.push(`${f.file}:${f.line} ${f.severity} ${f.rule}${f.id ? ` ${f.id}` : ''}: ${f.message}`);
    lines.push(`  fix: ${f.fix}`);
  }
  const e = countErrors(findings);
  const w = countWarnings(findings);
  lines.push(e === 0 && w === 0 ? 'lint clean' : `${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'}`);
  return `${lines.join('\n')}\n`;
}
