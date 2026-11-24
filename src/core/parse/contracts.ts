import { type Finding, finding } from '../findings';
import { PATTERNS, classifyId, contractModule } from '../ids';
import { typeRefs } from '../types';
import { type Block, parseMarkdown } from '../markdown';
import { CONTRACT_KINDS, type Contract, type ContractField, type ContractKind, type Ref, type TypeExpr } from '../model';
import { STATUSES, type Status } from '../schemas';
import { parseMetaLine, splitList } from './common';

interface Draft {
  heading: Block;
  head: Block[];
  fields: { heading: Block; blocks: Block[] }[];
}

interface Line {
  readonly text: string;
  readonly line: number;
}

const linesOf = (blocks: readonly Block[]): Line[] =>
  blocks.flatMap((b) => b.raw.split('\n').map((t, i) => ({ text: t.trim(), line: b.line + i }))).filter((l) => l.text !== '');

/**
 * Contract and member IDs named in type expressions, except `self`. Only types count: an ID in a
 * description is a pointer for the reader, not a dependency impact should follow.
 */
function usesIn(types: readonly TypeExpr[], self: (id: string) => boolean): Ref[] {
  const out: Ref[] = [];
  const seen = new Set<string>();
  for (const l of types) {
    for (const id of typeRefs(l.expr)) {
      const k = classifyId(id);
      if ((k !== 'contract' && k !== 'field') || self(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, line: l.line });
    }
  }
  return out;
}

/** The type expressions in these lines: what follows `Type:` (anywhere) or a leading `Output:`. */
function typesIn(lines: readonly Line[]): TypeExpr[] {
  const out: TypeExpr[] = [];
  for (const l of lines) {
    const t = /(?:^|\s)Type:\s*(\S.*)$/.exec(l.text);
    const o = t ? null : /^Output:\s*(\S.*)$/.exec(l.text);
    const expr = t?.[1] ?? o?.[1];
    if (expr) out.push({ expr: expr.trim(), line: l.line, key: t ? 'Type' : 'Output' });
  }
  return out;
}

/** `Draft: <sources>` on a meta line: the sources, `yes` meaning none; null when absent. */
export const draftValue = (v: string | undefined): readonly string[] | null => (v === undefined ? null : v.trim() === 'yes' ? [] : splitList(v));

/** `Status: deprecated · Superseded by: X · Draft: <sources>` as an optional first line of a field or invariant. */
export function optionalStatusLine(
  file: string,
  id: string,
  line: string,
  lineNo: number,
  findings: Finding[],
): { status: Status; supersededBy: Ref | null; draft: readonly string[] | null } | null {
  if (!line.startsWith('Status:')) return null;
  const meta = parseMetaLine(line);
  const status = meta?.find(([k]) => k === 'Status')?.[1];
  const sup = meta?.find(([k]) => k === 'Superseded by')?.[1] ?? null;
  if (!meta || !(STATUSES as readonly string[]).includes(status ?? '') || meta.some(([k]) => k !== 'Status' && k !== 'Superseded by' && k !== 'Draft')) {
    findings.push(finding('L001', file, lineNo, id, `"${line}" is not "Status: <${STATUSES.join('|')}> · Superseded by: <ID>"`, 'fix the status line'));
    return null;
  }
  return { status: status as Status, supersededBy: sup === null ? null : { id: sup, line: lineNo }, draft: draftValue(meta.find(([k]) => k === 'Draft')?.[1]) };
}

export function parseContracts(file: string, text: string, homeModule: string): { contracts: Contract[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const doc = parseMarkdown(text);
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  for (const b of doc.blocks) {
    if (b.type === 'heading' && b.depth <= 2) {
      cur = null;
      continue;
    }
    if (b.type === 'heading' && b.depth === 3) {
      cur = { heading: b, head: [], fields: [] };
      drafts.push(cur);
      continue;
    }
    if (b.type === 'heading' && b.depth === 4) {
      if (!cur) {
        findings.push(finding('L001', file, b.line, b.title, `field "${b.title}" is outside a contract section`, 'put fields under their "### <module>.<Name>" contract'));
        continue;
      }
      cur.fields.push({ heading: b, blocks: [] });
      continue;
    }
    if (!cur) continue;
    const field = cur.fields[cur.fields.length - 1];
    if (field) field.blocks.push(b);
    else cur.head.push(b);
  }

  const contracts: Contract[] = [];
  for (const d of drafts) {
    const id = d.heading.title;
    const line = d.heading.line;
    if (!PATTERNS.contract.test(id) || id.split('.').length !== 2) {
      findings.push(finding('L002', file, line, id, `contract heading "${id}" is not <module>.<Name>`, 'write the heading as "### <module>.<Name>"'));
      continue;
    }
    if (contractModule(id) !== homeModule) {
      findings.push(finding('L019', file, line, id, `${id} is defined in the ${homeModule} contracts file`, `move it to modules/${contractModule(id)}/contracts.md, or rename it ${homeModule}.${id.split('.')[1] ?? ''}`));
    }
    const headLines = linesOf(d.head);
    const kindLine = headLines[0];
    let kind: ContractKind = 'entity';
    let status: Status = 'active';
    let supersededBy: Ref | null = null;
    let draft: readonly string[] | null = null;
    const meta = kindLine && kindLine.line === d.heading.endLine + 1 ? parseMetaLine(kindLine.text) : null;
    const kv = new Map(meta ?? []);
    const k = kv.get('Kind');
    const s = kv.get('Status');
    const okKeys = meta?.every(([key], i) => (i === 0 ? key === 'Kind' : i === 1 ? key === 'Status' : key === 'Superseded by' || key === 'Draft')) ?? false;
    if (!meta || !okKeys || !(CONTRACT_KINDS as readonly string[]).includes(k ?? '') || !(STATUSES as readonly string[]).includes(s ?? '')) {
      findings.push(finding('L001', file, kindLine?.line ?? line, id, `the line after "### ${id}" must be "Kind: <${CONTRACT_KINDS.join('|')}> · Status: <${STATUSES.join('|')}>"`, `add "Kind: entity · Status: active" (or ${CONTRACT_KINDS.slice(1).join(' / ')}) right under the heading`));
    } else {
      kind = k as ContractKind;
      status = s as Status;
      const sup = kv.get('Superseded by');
      if (sup !== undefined) supersededBy = { id: sup, line: kindLine?.line ?? line };
      draft = draftValue(kv.get('Draft'));
    }
    const decisions: Ref[] = [];
    for (const l of headLines) {
      const m = /^Decisions:\s*(.*)$/.exec(l.text);
      if (!m) continue;
      for (const adr of splitList(m[1] ?? '')) {
        if (!PATTERNS.decision.test(adr)) {
          findings.push(finding('L002', file, l.line, id, `"${adr}" in the Decisions line is not an ADR ID`, 'list ADR-<NNN> IDs, comma-separated'));
        } else decisions.push({ id: adr, line: l.line });
      }
    }
    let code: Contract['code'] = null;
    for (const l of headLines) {
      const list = /^(Payload|Input):/.exec(l.text)?.[1];
      if (list) {
        findings.push(finding('L001', file, l.line, id, `"${list}:" lists are format 1; write each member as "#### ${id}.<member>" with a Type: line`, `turn each "- name: type" item into "#### ${id}.<name>", a one-line description, and "Type: <type>"`));
      }
      if (/\bIn code:/.test(l.text)) {
        findings.push(finding('L001', file, l.line, id, '"In code:" is format 1; write it as its own line, "Code: <symbol>"', 'move the code name to a "Code: Class.method(args)" line under the summary'));
      }
      const c = /^Code:\s*(\S.*)$/.exec(l.text);
      if (c?.[1]) {
        const text = c[1].replace(/`/g, '').trim();
        // A signature restates the members in one stack's syntax, and drifts from them (X128).
        if (text.includes('(')) {
          findings.push(finding('L001', file, l.line, id, `"Code: ${text}" holds a signature; Code: names the symbol, and the members are its inputs`, `write "Code: ${(text.split('(')[0] ?? text).trim()}", and give each input a #### member`));
        }
        code = { text, symbol: (text.split('(')[0] ?? text).trim(), line: l.line };
      }
    }
    const summary = headLines.slice(1).find((l) => !/^(Decisions|Payload|Input|Output|Code):/.test(l.text) && !l.text.startsWith('-'))?.text ?? '';
    // The meta and Decisions lines name the contract's lifecycle, not what it is made of.
    const headTypes = typesIn(headLines.slice(1).filter((l) => !/^Decisions:/.test(l.text)));
    const own = (x: string) => x === id || x.startsWith(`${id}.`);

    const fields: ContractField[] = [];
    for (const f of d.fields) {
      const fid = f.heading.title;
      const fline = f.heading.line;
      if (!PATTERNS.contract.test(fid) || fid.split('.').length !== 3) {
        findings.push(finding('L002', file, fline, fid, `field heading "${fid}" is not <module>.<Name>.<field>`, `write the heading as "#### ${id}.<field>"`));
        continue;
      }
      if (!fid.startsWith(`${id}.`)) {
        findings.push(finding('L019', file, fline, fid, `field ${fid} sits under ${id}`, `rename it ${id}.${fid.split('.')[2] ?? ''}, or move it under its entity`));
        continue;
      }
      const first = f.blocks[0]?.raw.split('\n')[0]?.trim() ?? '';
      const st = optionalStatusLine(file, fid, first, f.blocks[0]?.line ?? fline, findings);
      const last = f.blocks[f.blocks.length - 1];
      const memberTypes = typesIn(linesOf(f.blocks).filter((l) => !(st && l.line === (f.blocks[0]?.line ?? -1))));
      fields.push({
        type: 'field',
        id: fid,
        entity: id,
        status: st ? st.status : status,
        supersededBy: st ? st.supersededBy : null,
        // A draft marks a contract or an invariant, never a member (ADP-001/R1): lint refuses it.
        draftLine: st && st.draft !== null ? (f.blocks[0]?.line ?? fline) : null,
        uses: usesIn(memberTypes, (x) => x === fid),
        types: memberTypes,
        text: text.slice(f.heading.start, last ? last.end : f.heading.end),
        file,
        line: fline,
      });
    }
    const lastHead = d.head[d.head.length - 1];
    const lastField = d.fields[d.fields.length - 1];
    const lastFieldBlock = lastField?.blocks[lastField.blocks.length - 1];
    const end = lastFieldBlock?.end ?? lastField?.heading.end ?? lastHead?.end ?? d.heading.end;
    contracts.push({
      type: 'contract',
      id,
      kind,
      homeModule,
      status,
      draft,
      supersededBy,
      summary,
      decisions,
      code,
      uses: usesIn(headTypes, own),
      types: headTypes,
      fields,
      text: text.slice(d.heading.start, end),
      headText: text.slice(d.heading.start, lastHead ? lastHead.end : d.heading.end),
      file,
      line,
    });
  }
  return { contracts, findings };
}
