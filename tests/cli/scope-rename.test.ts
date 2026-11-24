// PIP-005: each role may change only its own files. BUG-002: a staged `git mv` of a protected
// file reports only the new path to the role scope check; the removal of the old path must be
// refused as well (S1).
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO, gitFixture, report, validSpecWriterChecklist, validTesterMutations } from '../helpers';

type Fx = ReturnType<typeof gitFixture>;
const open: Fx[] = [];
afterEach(() => {
  for (const fx of open.splice(0)) fx.cleanup();
});

const CONTRACTS = 'spec/modules/providers/contracts.md';
const touch = (fx: Fx, path: string) => {
  appendFileSync(join(fx.repo, path), '\n// touched\n');
};
/** The stage running, started the normal way. */
const start = async (id: string, role: string): Promise<Fx> => {
  const fx = gitFixture('spec-pip005');
  open.push(fx);
  expect((await fx.spec('', 'ticket', 'start', id, role)).code).toBe(0);
  return fx;
};
/** A stage the pipeline order would not reach yet, running in the committed fixture. */
const running = (id: string, role: string): Fx => {
  const fx = gitFixture('spec-pip005', {
    setup: (dir) => {
      const file = join(dir, 'tickets', `${id}.md`);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: in_progress').replace(/^stage: .*$/m, `stage: ${role}`));
    },
  });
  open.push(fx);
  return fx;
};
const check = async (fx: Fx, role: string, id: string, fields: string) => {
  const msg = report(`role: ${role}\nticket: ${id}\nresult: done\nsummary: x\n${fields}`);
  return JSON.parse((await fx.spec(msg, 'check-report', role, id, '--format', 'json')).stdout) as { ok: boolean; problems: string[] };
};

describe('PIP-005 role scope', () => {
  it('PIP-005/S1 The implementer changes code only', async () => {
    const fx = await start('TASK-101', 'implementer');
    writeFileSync(join(fx.repo, 'src/a.ts'), 'export const a = 1;\n');
    // The spec file is moved into code and staged: git status reports it as a rename.
    expect(fx.git('mv', CONTRACTS, 'src/moved-contracts.ts').code).toBe(0);
    expect(fx.git('status', '--porcelain').stdout).toContain(`R  ${CONTRACTS} -> src/moved-contracts.ts`);
    const { problems } = await check(fx, 'implementer', 'TASK-101', '');
    expect(problems).toContain(`the implementer never changes spec files; revert ${CONTRACTS}`);
  }, 60_000);

  it('PIP-005/S2 The spec-writer changes spec files only', async () => {
    const fx = await start('PROP-201', 'spec-writer');
    touch(fx, CONTRACTS);
    touch(fx, 'src/providers/config.ts');
    const { problems } = await check(fx, 'spec-writer', 'PROP-201', validSpecWriterChecklist());
    expect(problems).toEqual(['the spec-writer changes spec files only; revert src/providers/config.ts']);
  }, 60_000);

  it('PIP-005/S3 The tester changes test files only on a bug', async () => {
    const fx = await start('BUG-301', 'tester');
    const hidden = readFileSync(join(REPO, 'evals/hidden/chat-mini/PRV-002.hidden.test.ts'), 'utf8');
    appendFileSync(join(fx.repo, 'tests/PRV-002.test.ts'), `\n${hidden.slice(hidden.indexOf("it('PRV-002/S3"))}`);
    touch(fx, 'src/providers/fallback.ts');
    const { problems } = await check(fx, 'tester', 'BUG-301', 'changed: [PRV-002/S3]\n' + validTesterMutations('PRV-002/S3'));
    expect(problems).toEqual(['the tester changes test files only; revert src/providers/fallback.ts']);
  }, 60_000);

  it('PIP-005/S4 On a proposal the tester may change code only by stubs', async () => {
    const fx = running('PROP-205', 'tester');
    touch(fx, 'tests/SET-001.test.ts');
    touch(fx, 'spec/modules/conversation/contracts.md');
    const { problems } = await check(fx, 'tester', 'PROP-205', validTesterMutations('CNV-001/S1'));
    expect(problems).toContain('the tester changes test files only, and code only to add stubs marked SPEC-STUB; revert spec/modules/conversation/contracts.md');
  }, 60_000);

  it("PIP-005/S5 On a proposal or a bug the tests are the tester's", async () => {
    const fx = running('PROP-201', 'implementer');
    touch(fx, 'src/providers/config.ts');
    touch(fx, 'tests/PRV-001.test.ts');
    const { problems } = await check(fx, 'implementer', 'PROP-201', '');
    expect(problems).toEqual(['on a proposal the tests are the tester\'s and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong']);
  }, 60_000);

  it('PIP-005/S6 On a task the implementer may move tests with the code', async () => {
    const fx = await start('TASK-101', 'implementer');
    writeFileSync(join(fx.repo, 'src/providers/select.ts'), 'export const select = 1;\n');
    touch(fx, 'tests/PRV-001.test.ts');
    const res = await check(fx, 'implementer', 'TASK-101', '');
    expect(res).toMatchObject({ ok: true, problems: [] });
  }, 120_000);

  it('PIP-005/S7 The reviewer changes nothing', async () => {
    const fx = running('TASK-101', 'reviewer');
    writeFileSync(join(fx.repo, 'src/a.ts'), 'export const a = 1;\n');
    const { problems } = await check(fx, 'reviewer', 'TASK-101', 'verdict: approve');
    expect(problems).toEqual(['the reviewer edits no files; revert src/a.ts']);
  }, 60_000);

  it('PIP-005/S8 A task changes no spec file in any stage', async () => {
    const fx = running('TASK-101', 'spec-writer');
    touch(fx, CONTRACTS);
    const { problems } = await check(fx, 'spec-writer', 'TASK-101', validSpecWriterChecklist());
    expect(problems).toEqual([`a task changes no spec file in any stage; revert ${CONTRACTS}`, 'only proposals change the spec; TASK-101 is a task']);
  }, 60_000);

  it('PIP-005/S9 Only a proposal has a spec stage', async () => {
    const fx = running('BUG-301', 'spec-writer');
    const { problems } = await check(fx, 'spec-writer', 'BUG-301', validSpecWriterChecklist());
    expect(problems).toEqual(['only proposals change the spec; BUG-301 is a bug']);
  }, 60_000);

  it('PIP-005/S10 Protected files never change', async () => {
    const fx = running('PROP-205', 'implementer');
    writeFileSync(join(fx.repo, 'src/conversation/copy.ts'), 'export const copy = 1;\n');
    touch(fx, 'tests/SET-002.test.ts');
    const { problems } = await check(fx, 'implementer', 'PROP-205', '');
    expect(problems).toEqual([
      "on a proposal the tests are the tester's and the implementer changes code only; revert tests/SET-002.test.ts, or report a blocker that cites the scenario whose test is wrong",
      'protected files may not change: revert tests/SET-002.test.ts',
    ]);
  }, 60_000);

  it("PIP-005/S11 Ticket files are not the role's changes", async () => {
    const fx = running('TASK-101', 'reviewer');
    touch(fx, 'tickets/TASK-101.md');
    const res = await check(fx, 'reviewer', 'TASK-101', 'verdict: approve');
    expect(res).toMatchObject({ ok: true, problems: [] });
  }, 60_000);

  it('PIP-005/S12 An invalid stage blocks the ticket and is not committed', async () => {
    const fx = await start('TASK-101', 'implementer');
    writeFileSync(join(fx.repo, 'tests/SET-002.test.ts'), '// overwritten\n');
    const head = fx.git('rev-parse', 'HEAD').stdout;
    const msg = report('role: implementer\nticket: TASK-101\nresult: done\nsummary: x');
    const out = await fx.spec(msg, 'ticket', 'advance', 'TASK-101');
    expect(out.code).toBe(1);
    expect(fx.git('rev-parse', 'HEAD').stdout).toBe(head);
    const questions = fx.ticket('TASK-101')?.questions ?? [];
    const text = questions[questions.length - 1]?.text ?? '';
    expect(text).toContain('invalid report: ');
    expect(text).toContain('protected files may not change');
  }, 120_000);
});
