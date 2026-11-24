// L024 (X112): `spec lint --ci` checks each Code: line against the code it points into.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture } from '../helpers';

const fx = gitFixture('spec-code-pointer');
afterAll(fx.cleanup);

const l024 = async () => (JSON.parse((await fx.spec('', 'lint', '--ci', '--format', 'json')).stdout) as { findings: { rule: string; id: string; message: string; severity: string }[] }).findings.filter((f) => f.rule === 'L024');

describe('L024 code-pointer', () => {
  it('passes while the code holds the symbol', async () => {
    expect(await l024()).toEqual([]);
  });

  it('warns once the code renames it, naming the contract', async () => {
    const file = join(fx.repo, 'src/providers/stream.ts');
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('streamReply', 'pipeReply'));
    for (const f of ['src/providers/fallback.ts', 'src/conversation/chat.ts']) {
      const p = join(fx.repo, f);
      writeFileSync(p, readFileSync(p, 'utf8').replaceAll('streamReply', 'pipeReply'));
    }
    expect((await l024()).map((f) => `${f.severity} ${f.id}: ${f.message}`)).toEqual(['warning providers.StreamReply: Code: streamReply is not in the code']);
  });
});
