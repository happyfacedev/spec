// PIP-003: read the report block a stage ends with. S11 and S12 are in review-gap.test.ts.
import { describe, expect, it } from 'vitest';
import { extractReport } from '../../src/core/report';

const block = (body: string, fence = '```') => `Done.\n\n${fence}report\n${body}\n${fence}\n`;
const BASE = 'role: implementer\nticket: TASK-101\nresult: done\nsummary: Extracted provider selection';

describe('PIP-003 the report block', () => {
  it('PIP-003/S1 A well-formed report', () => {
    const r = extractReport(block('role: implementer\nticket: "TASK-101"\nresult: done\nsummary: Extracted provider selection', '~~~'));
    expect(r.problems).toEqual([]);
    expect(r.report).toMatchObject({ role: 'implementer', result: 'done', summary: 'Extracted provider selection', changed: [], assumed: [], blockers: [], findings: [], verdict: null });
  });

  it('PIP-003/S2 Other code blocks are ignored', () => {
    const r = extractReport(`\`\`\`ts\nconst x = 1;\n\`\`\`\n\n${block(BASE)}`);
    expect(r.problems).toEqual([]);
    expect(r.report?.role).toBe('implementer');
  });

  it('PIP-003/S3 No report block', () => {
    const r = extractReport('All done!');
    expect(r.problems).toEqual(['the final message has no ```report block; end with exactly one']);
    expect(r.report).toBeNull();
  });

  it('PIP-003/S4 Two report blocks', () => {
    expect(extractReport(`${block(BASE)}\n${block(BASE)}`).problems).toEqual(['the final message has 2 report blocks; end with exactly one']);
  });

  it('PIP-003/S5 Not YAML', () => {
    const r = extractReport(block('role: [implementer'));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith('the report is not valid YAML: ')).toBe(true);
    expect(r.problems[0]).not.toContain('\n');
  });

  it('PIP-003/S6 A value outside its type', () => {
    const r = extractReport(block(BASE.replace('result: done', 'result: finished')));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith('report result: ')).toBe(true);
  });

  it('PIP-003/S7 An unknown key', () => {
    const r = extractReport(block(`${BASE}\nnotes: hello`));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith('report (root): ')).toBe(true);
    expect(r.problems[0]).toContain('notes');
  });

  it('PIP-003/S8 A summary that is too long', () => {
    const long = extractReport(block(BASE.replace('Extracted provider selection', 'x'.repeat(501))));
    expect(long.problems).toHaveLength(1);
    expect(long.problems[0]?.startsWith('report summary: ')).toBe(true);
    expect(extractReport(block(BASE.replace('Extracted provider selection', 'x'.repeat(215)))).problems).toEqual([]);
  });

  it('PIP-003/S9 A ticket ID in the wrong shape', () => {
    const r = extractReport(block(BASE.replace('TASK-101', 'ticket-1')));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith('report ticket: not a valid ')).toBe(true);
  });

  it('PIP-003/S10 An assumption has one of two shapes', () => {
    const r = extractReport(block(`${BASE}\nassumed: [{ question: "PROP-202#Q1", value: alphabetical }, { new: "Name of the new module", value: 3 }]`));
    expect(r.problems).toEqual([]);
    expect(r.report?.assumed).toEqual([
      { question: 'PROP-202#Q1', value: 'alphabetical' },
      { new: 'Name of the new module', value: '3' },
    ]);
  });

  it('PIP-003/S13 A spec-writer lists the scenarios that document today\'s behaviour', () => {
    const base = 'role: spec-writer\nticket: PROP-201\nresult: done\nsummary: Added gemini';
    const listed = extractReport(block(`${base}\ndocuments: [PRV-001/S4, SET-001/S4]`));
    expect(listed.problems).toEqual([]);
    expect(listed.report).toMatchObject({ documents: ['PRV-001/S4', 'SET-001/S4'] });
    expect(extractReport(block(base)).report).toMatchObject({ documents: [] });
    const text = extractReport(block(`${base}\ndocuments: PRV-001/S4`));
    expect(text.problems).toHaveLength(1);
    expect(text.problems[0]?.startsWith('report documents: ')).toBe(true);
  });

  it('PIP-003/S19 A one-line summary may hold a colon', () => {
    const head = 'role: implementer\nticket: TASK-101\nresult: done';
    const bare = extractReport(block(`${head}\nsummary: Second fix: the colon case\nchanged: []`));
    expect(bare.problems).toEqual([]);
    expect(bare.report?.summary).toBe('Second fix: the colon case');
    // A bare summary with a colon reads the same wherever the next key is.
    const before = extractReport(block(`${head}\nsummary: Second fix: the colon case\nassumed: []\nverdict: null`));
    expect(before.problems).toEqual([]);
    expect(before.report?.summary).toBe('Second fix: the colon case');

    const quoted = extractReport(block(`${head}\nsummary: "Second fix: the colon case"\nchanged: []`));
    expect(quoted.problems).toEqual([]);
    expect(quoted.report?.summary).toBe('Second fix: the colon case');

    const unclosed = extractReport(block(`${head}\nsummary: "Second fix: the colon case\nchanged: []`));
    expect(unclosed.problems).toHaveLength(1);
    expect(unclosed.problems[0]?.startsWith('the report is not valid YAML: ')).toBe(true);
    expect(unclosed.report).toBeNull();
  });

  it('PIP-003/S19 a value that starts with a YAML indicator is still read as YAML', () => {
    const head = 'role: implementer\nticket: TASK-101\nresult: done';
    // A flow list with a colon inside is not plain text: it stays invalid here, as before.
    const flow = extractReport(block(`${head}\nsummary: [Second fix: the colon case\nchanged: []`));
    expect(flow.problems).toHaveLength(1);
    expect(flow.problems[0]?.startsWith('the report is not valid YAML: ')).toBe(true);
    // A single-quoted summary is read as YAML too.
    const single = extractReport(block(`${head}\nsummary: 'Second fix: the colon case'\nchanged: []`));
    expect(single.problems).toEqual([]);
    expect(single.report?.summary).toBe('Second fix: the colon case');
  });

  it('PIP-003/S21 The report is read as YAML first', () => {
    const head = 'role: implementer\nticket: TASK-101';
    // Valid YAML as written: the comments are comments, and the summary is not rewritten into one holding " # a note".
    const plain = extractReport(block(`${head}\nresult: done  # done | blocked\nsummary: Plain thing # a note\nchanged: []`));
    expect(plain.problems).toEqual([]);
    expect(plain.report?.result).toBe('done');
    expect(plain.report?.summary).toBe('Plain thing');

    // With a colon in the summary the YAML fails, the summary is recovered, and the comment on the result line is still a comment.
    const colon = extractReport(block(`${head}\nresult: done  # done | blocked\nsummary: Second fix: the colon case\nchanged: []`));
    expect(colon.problems).toEqual([]);
    expect(colon.report?.result).toBe('done');
    expect(colon.report?.summary).toBe('Second fix: the colon case');
  });

  it('PIP-003/S18 A finding may carry a class', () => {
    const reviewer = 'role: reviewer\nticket: TASK-101\nresult: done\nsummary: ok\nverdict: changes';
    const finding = (fields: string) => `${reviewer}\nfindings: [{ cites: ["PRV-001/R1"], text: "select.ts ignores the rule"${fields} }]`;
    const r = extractReport(block(`${reviewer}\nfindings: [{ cites: ["PRV-001/S3"], text: "no scenario covers a second rate limit", class: C1 }, { cites: ["PRV-001/R1"], text: "select.ts ignores the rule" }]`));
    expect(r.problems).toEqual([]);
    expect(r.report?.findings).toEqual([
      { cites: ['PRV-001/S3'], text: 'no scenario covers a second rate limit', class: 'C1' },
      { cites: ['PRV-001/R1'], text: 'select.ts ignores the rule' },
    ]);
    expect(r.report?.findings[1]).not.toHaveProperty('class');
    // Every class of the conventions reads, and so does other.
    for (const cls of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'other']) {
      expect(extractReport(block(finding(`, class: ${cls}`))).report?.findings[0], cls).toMatchObject({ class: cls });
    }
    // A class outside pipeline.FindingClass is refused with one problem, whatever its shape.
    for (const bad of ['C10', 'c1', 'neighbours', '"C0"', 'Other']) {
      const refused = extractReport(block(finding(`, class: ${bad}`)));
      expect(refused.problems, bad).toHaveLength(1);
      expect(refused.problems[0], bad).toMatch(/^report findings[.\d]*: /);
    }
  });
});
