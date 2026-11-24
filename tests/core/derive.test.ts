// Links the steps state (X134): the verb follows from the contract's kind and the step that cites it.
import { describe, expect, it } from 'vitest';
import { derivedVerb } from '../../src/core/derive';
import { computeImpact } from '../../src/core/impact';
import { lintSpec } from '../../src/core/lint';
import { baseWith } from '../helpers';

const BET = 'modules/beta/features/BET-001-order-a-widget.md';
const feature = (fm: string, behaviour: string) => `---\n${fm}\n---\n## Intent\nOrder a widget.\n\n## Behaviour\n${behaviour}\n\n## Rules\nNone\n\n## Out of scope\nNone\n`;
const FM = 'id: BET-001\ntitle: Order a widget\nmodule: beta\nstatus: active';
const S1 = '### S1: Order priced by size\nGiven alpha.WidgetMade was emitted for a widget\nAnd alpha.Widget.size is 2\nWhen the user orders it\nThen beta.Order.total is 20';
const links = (files: Record<string, string>, id = 'BET-001') => {
  const f = baseWith(files).spec.features.find((x) => x.id === id);
  return Object.fromEntries(Object.entries(f?.links ?? {}).filter(([, v]) => v.length > 0).map(([k, v]) => [k, v.map((r) => r.id)]));
};

describe('X134 the verb follows from the kind and the step', () => {
  it('an entity or type is read; an operation is called; an event or error arrives (consumed) or is the outcome (emitted)', () => {
    const w = (...k: string[]) => new Set(k);
    expect(derivedVerb('entity', w('Then'))).toBe('reads');
    expect(derivedVerb('type', w('Given'))).toBe('reads');
    expect(derivedVerb('operation', w('When'))).toBe('calls');
    expect(derivedVerb('event', w('Given'))).toBe('consumes');
    expect(derivedVerb('event', w('When', 'Then'))).toBe('consumes');
    expect(derivedVerb('error', w('Then'))).toBe('emits');
    expect(derivedVerb('error', w('Given', 'Then'))).toBe('emits');
  });

  it('the frontmatter lists only writes; the steps state the rest, and lint and impact are unchanged', () => {
    const lean = feature(`${FM}\nwrites: [beta.Order.total]`, S1);
    expect(links({ [BET]: lean })).toEqual({ writes: ['beta.Order.total'], reads: ['alpha.Widget.size'], consumes: ['alpha.WidgetMade'] });
    const { spec, index } = baseWith({ [BET]: lean });
    expect(lintSpec(spec, {})).toEqual([]);
    const full = baseWith();
    const ids = (s: typeof spec, i: typeof index) => computeImpact(s, i, 'alpha.Widget.size', null).reverify.map((x) => x.id);
    expect(ids(spec, index)).toEqual(ids(full.spec, full.index));
  });

  it('a whole contract cited only in a Then checks a written member; cited in a Given, it is read as well', () => {
    const check = feature(`${FM}\nwrites: [beta.Order.total]`, `${S1}\nAnd no other beta.Order is added`);
    expect(links({ [BET]: check }).reads).toEqual(['alpha.Widget.size']);
    const state = feature(`${FM}\nwrites: [beta.Order.total]`, S1.replace('When the user orders it', 'And beta.Order is empty\nWhen the user orders it'));
    expect(links({ [BET]: state }).reads).toEqual(['alpha.Widget.size', 'beta.Order']);
  });

  it('observes and provides cover their cites', () => {
    const obs = feature(`${FM}\nwrites: [beta.Order.total]\nobserves: [alpha.WidgetMade]`, S1);
    expect(links({ [BET]: obs })).toEqual({ writes: ['beta.Order.total'], observes: ['alpha.WidgetMade'], reads: ['alpha.Widget.size'] });
  });

  it('a link whose kind does not fit suggests only verbs a writer may write', () => {
    const wrong = feature(`${FM}\nwrites: [beta.Order.total, alpha.WidgetMade]`, `${S1}\nAnd alpha.WidgetMade is emitted`);
    const { spec } = baseWith({ [BET]: wrong });
    expect(lintSpec(spec, {}).filter((f) => f.rule === 'L004').map((f) => f.fix)).toEqual([
      "remove it from writes: a step that names it links it (consumed in a Given or When, emitted in a Then); list it under observes if the feature's code does not use it; writes takes entity or type contracts",
    ]);
  });

  it('a hand-written derived verb is a warning: the steps already say it', () => {
    const old = feature(`${FM}\nreads: [alpha.Widget.size]\nconsumes: [alpha.WidgetMade]\nwrites: [beta.Order.total]`, S1);
    const { spec } = baseWith({ [BET]: old });
    expect(lintSpec(spec, {}).map((f) => `${f.rule} ${f.severity} ${f.message}`)).toEqual([
      'L001 warning reads is derived from the steps; the frontmatter lists only writes, provides and observes',
      'L001 warning consumes is derived from the steps; the frontmatter lists only writes, provides and observes',
    ]);
  });
});
