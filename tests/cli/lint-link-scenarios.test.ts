// LNT-008 through the CLI, on a throwaway git copy of the lint-case base spec. Each scenario
// overlays one change on the base and checks the findings of `spec lint --format json`.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LINT_BASE, gitFixture } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const made: Fx[] = [];
afterAll(() => {
  for (const fx of made) fx.cleanup();
});

/** The base spec with `edit` applied to the project directory before git sees it. */
function base(edit?: (dir: string) => void): Fx {
  const fx = gitFixture('spec-lint-links', { fixture: LINT_BASE, setup: edit });
  made.push(fx);
  return fx;
}

/** Replaces one fragment of a base file. A fragment the base lacks is a broken setup, so it throws. */
function replaceIn(dir: string, path: string, from: string, to: string) {
  const file = join(dir, path);
  const text = readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`${path} has no ${JSON.stringify(from)}`);
  writeFileSync(file, text.replace(from, to));
}

function appendTo(dir: string, path: string, text: string) {
  const file = join(dir, path);
  writeFileSync(file, `${readFileSync(file, 'utf8').trimEnd()}\n\n${text}`);
}

interface Finding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  id: string | null;
  message: string;
  fix: string;
}
const findingsOf = async (fx: Fx): Promise<Finding[]> => {
  const out = await fx.spec('', 'lint', '--format', 'json');
  return (JSON.parse(out.stdout) as { findings: Finding[] }).findings;
};
const l004Of = async (fx: Fx) => (await findingsOf(fx)).filter((f) => f.rule === 'L004');
const l004 = (file: string, line: number, id: string, message: string, fix: string): Finding => ({ rule: 'L004', severity: 'error', file, line, id, message, fix });

const BET = 'spec/modules/beta/features/BET-001-order-a-widget.md';
const ALP = 'spec/modules/alpha/features/ALP-001-make-a-widget.md';
const UI = 'spec/ui/UI-001-widget-card.md';
const INV = 'spec/core/invariants.md';
const ALP_CONTRACTS = 'spec/modules/alpha/contracts.md';
const BETA_CONTRACTS = 'spec/modules/beta/contracts.md';
const BETA_MODULE = 'spec/modules/beta/_module.md';

describe('LNT-008: Report links that do not resolve or do not fit (L004)', () => {
  it('LNT-008/S1 A frontmatter link to an ID that does not exist', async () => {
    const fx = base((dir) => {
      replaceIn(dir, BET, 'writes: [beta.Order.total]\n', 'writes: [beta.Order.total]\ninvariants: [INV-009]\n');
    });
    expect(await l004Of(fx)).toContainEqual(
      l004('modules/beta/features/BET-001-order-a-widget.md', 7, 'BET-001', 'BET-001 invariants INV-009, which does not exist', 'did you mean INV-001? Otherwise define INV-009 first'),
    );
  });

  it('LNT-008/S2 A step that cites a member that does not exist', async () => {
    const fx = base((dir) => {
      replaceIn(dir, BET, 'When the user orders it', 'And alpha.Widget.size is 2 and alpha.Widget.colour is red\nWhen the user orders it');
    });
    const fix = 'did you mean alpha.Widget.name? Otherwise define alpha.Widget.colour first';
    expect(await l004Of(fx)).toEqual([
      l004('modules/beta/features/BET-001-order-a-widget.md', 15, 'BET-001', 'BET-001 reads alpha.Widget.colour, which does not exist', fix),
      l004('modules/beta/features/BET-001-order-a-widget.md', 15, 'BET-001/S1', 'BET-001/S1 cites alpha.Widget.colour, which does not exist', fix),
    ]);
  });

  it('LNT-008/S3 No ID close enough to suggest', async () => {
    const fx = base((dir) => {
      replaceIn(dir, INV, '### INV-001: A widget always has a size', '### INV-1 A widget always has a size');
    });
    const findings = await l004Of(fx);
    expect(findings).toContainEqual(l004('modules/alpha/features/ALP-001-make-a-widget.md', 7, 'ALP-001', 'ALP-001 invariants INV-001, which does not exist', 'define INV-001 first, or remove the reference'));
    expect(findings).toContainEqual(l004('modules/alpha/features/ALP-001-make-a-widget.md', 23, 'ALP-001/R1', 'ALP-001/R1 cites INV-001, which does not exist', 'define INV-001 first, or remove the reference'));
  });

  it('LNT-008/S4 A link to a unit of the wrong kind', async () => {
    const fx = base((dir) => {
      replaceIn(dir, INV, 'Decisions: ADR-001', 'Decisions: ADR-001\nApplies to: ALP-001');
    });
    expect(await findingsOf(fx)).toEqual([l004('core/invariants.md', 6, 'INV-001', 'INV-001 applies ALP-001, which is a feature', 'applies points to contract or field IDs')]);
  });

  it('LNT-008/S5 A provided contract that is not an operation', async () => {
    const fx = base((dir) => {
      replaceIn(dir, ALP, 'writes: [alpha.Widget]\n', 'writes: [alpha.Widget]\nprovides: [alpha.Widget]\n');
    });
    expect(await l004Of(fx)).toContainEqual(
      l004(
        'modules/alpha/features/ALP-001-make-a-widget.md',
        7,
        'ALP-001',
        'ALP-001 provides alpha.Widget, which is an entity',
        "list alpha.Widget under writes, or under observes if the feature's code does not use it; provides takes operation contracts",
      ),
    );
  });

  it('LNT-008/S6 A written event', async () => {
    const fx = base((dir) => {
      replaceIn(dir, ALP, 'writes: [alpha.Widget]', 'writes: [alpha.Widget, alpha.WidgetMade]');
    });
    expect(await findingsOf(fx)).toEqual([
      l004(
        'modules/alpha/features/ALP-001-make-a-widget.md',
        6,
        'ALP-001',
        'ALP-001 writes alpha.WidgetMade, which is an event',
        "remove it from writes: a step that names it links it (consumed in a Given or When, emitted in a Then); list it under observes if the feature's code does not use it; writes takes entity or type contracts",
      ),
    ]);
  });

  it('LNT-008/S7 Providing an external module\'s operation', async () => {
    const fx = base((dir) => {
      rmSync(join(dir, BET));
      replaceIn(dir, BETA_MODULE, 'status: active\n', 'status: active\nexternal: true\n');
      appendTo(dir, BETA_CONTRACTS, '### beta.Pay\nKind: operation · Status: active\nCharges a payment.\nOutput: beta.Order\n');
      replaceIn(dir, ALP, 'writes: [alpha.Widget]\n', 'writes: [alpha.Widget]\nprovides: [beta.Pay]\n');
      replaceIn(dir, ALP, 'When the user makes a widget of size 2', 'When the user makes a widget of size 2 through beta.Pay');
    });
    expect(await l004Of(fx)).toContainEqual(
      l004('modules/alpha/features/ALP-001-make-a-widget.md', 7, 'ALP-001', 'ALP-001 provides beta.Pay, which belongs to external module beta', 'call it (calls); the other system provides it'),
    );
  });

  it('LNT-008/S8 A type that names a contract that does not exist', async () => {
    const fx = base((dir) => {
      replaceIn(dir, ALP_CONTRACTS, "The widget's name. Type: string", "The widget's name. Type: alpha.Label");
    });
    expect(await findingsOf(fx)).toEqual([
      l004('modules/alpha/contracts.md', 8, 'alpha.Widget.name', 'alpha.Widget.name uses alpha.Label, which does not exist', 'define alpha.Label first, or remove the reference'),
    ]);
  });

  it('LNT-008/S9 A screen image that does not exist', async () => {
    const fx = base((dir) => {
      replaceIn(dir, UI, 'status: active\n', 'status: active\nimage: card.png\n');
    });
    expect(await findingsOf(fx)).toEqual([l004('ui/UI-001-widget-card.md', 1, 'UI-001', 'image card.png does not exist', 'add the image at ui/card.png, or remove image:')]);
  });

  it('LNT-008/S10 An Applies to member that does not exist', async () => {
    const fx = base((dir) => {
      replaceIn(dir, INV, 'Decisions: ADR-001', 'Decisions: ADR-001\nApplies to: alpha.Widget.weight');
    });
    expect(await findingsOf(fx)).toEqual([
      l004('core/invariants.md', 6, 'INV-001', 'INV-001 applies alpha.Widget.weight, which does not exist', 'did you mean alpha.Widget.size? Otherwise define alpha.Widget.weight first'),
    ]);
  });

  it('LNT-008/S11 A screen link that does not suit the contract\'s kind', async () => {
    const fx = base((dir) => {
      replaceIn(dir, UI, 'status: active\n', 'status: active\ncalls: [alpha.Widget]\n');
    });
    expect(await findingsOf(fx)).toEqual([
      l004('ui/UI-001-widget-card.md', 5, 'UI-001', 'UI-001 calls alpha.Widget, which is an entity', 'list alpha.Widget under shows; calls takes operation contracts'),
    ]);
  });

  it('LNT-008/S12 Emitting an external module\'s event', async () => {
    const fx = base((dir) => {
      rmSync(join(dir, BET));
      replaceIn(dir, BETA_MODULE, 'status: active\n', 'status: active\nexternal: true\n');
      appendTo(dir, BETA_CONTRACTS, '### beta.Paid\nKind: event · Status: active\nA payment was made.\n');
      replaceIn(dir, ALP, 'And UI-001 is shown\n', 'And UI-001 is shown\nAnd beta.Paid is emitted\n');
    });
    expect(await l004Of(fx)).toContainEqual(
      l004('modules/alpha/features/ALP-001-make-a-widget.md', 21, 'ALP-001', 'ALP-001 emits beta.Paid, which belongs to external module beta', 'consume it (consumes); the other system emits it'),
    );
  });

  it('LNT-008/S13 A screen shows an operation', async () => {
    const fx = base((dir) => {
      appendTo(dir, ALP_CONTRACTS, '### alpha.MakeWidget\nKind: operation · Status: active\nMakes one widget.\nOutput: alpha.Widget\n');
      replaceIn(dir, UI, 'status: active\n', 'status: active\nshows: [alpha.MakeWidget]\n');
    });
    expect(await findingsOf(fx)).toEqual([
      l004('ui/UI-001-widget-card.md', 5, 'UI-001', 'UI-001 shows alpha.MakeWidget, which is an operation', 'list alpha.MakeWidget under calls; shows takes entity or type or event or error contracts'),
    ]);
  });
});
