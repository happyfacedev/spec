// spec ticket advance after a spec-writer stage adds the features the gate's scope rule requires.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gitFixture, report, validSpecWriterChecklist } from '../helpers';

const fx = gitFixture('spec-advance-scope');
afterAll(fx.cleanup);

describe('spec ticket advance, scope', () => {
  it('PIP-008/S19 The features the gate\'s scope rule requires are added', async () => {
    expect((await fx.spec('', 'ticket', 'start', 'PROP-201', 'spec-writer')).code).toBe(0);
    // The stage extends settings.ApiKey, which SET-002 writes; SET-002 is not in the ticket's touches.
    const contracts = join(fx.repo, 'spec/modules/settings/contracts.md');
    writeFileSync(contracts, readFileSync(contracts, 'utf8').replace('### settings.MissingApiKey', '#### settings.ApiKey.label\nA name the person gives the key. Type: string?\n\n### settings.MissingApiKey'));
    const msg = report('role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Extended the API key\nchanged: [settings.ApiKey]\n' + validSpecWriterChecklist('SET-002/S1'));
    const adv = await fx.spec(msg, 'ticket', 'advance', 'PROP-201');
    expect(adv.code, adv.stderr).toBe(0);
    const lines = adv.stdout.split('\n');
    expect(lines[0]).toBe('PROP-201 spec-writer: Extended the API key');
    expect(lines[1]).toBe('next: spec-review');
    expect(lines[2]).toBe('scope: added SET-002 to changed');
    expect(fx.ticket('PROP-201')?.changed).toEqual(expect.arrayContaining(['settings.ApiKey', 'SET-002']));
    const gate = JSON.parse((await fx.spec('', 'gate', 'PROP-201', '--format', 'json')).stdout) as { blockers: { kind: string; id: string }[] };
    expect(gate.blockers.filter((b) => b.kind === 'scope_gap' && b.id === 'SET-002')).toEqual([]);
  }, 60_000);
});
