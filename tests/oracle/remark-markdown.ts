// Test-only oracle: the CommonMark parser the block scanner in src/core/markdown.ts must agree with.
import type { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export interface OracleBlock {
  type: string;
  line: number;
  endLine: number;
  start: number;
  end: number;
  depth: number;
}

const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']);

export function remarkBlocks(text: string): { frontmatter: { raw: string; line: number } | null; blocks: OracleBlock[] } {
  const root: Root = processor.parse(text);
  let frontmatter: { raw: string; line: number } | null = null;
  const blocks: OracleBlock[] = [];
  for (const node of root.children) {
    const pos = node.position;
    if (!pos || pos.start.offset === undefined || pos.end.offset === undefined) continue;
    if (node.type === 'yaml') {
      frontmatter = { raw: node.value, line: pos.start.line + 1 };
      continue;
    }
    blocks.push({
      type: node.type,
      line: pos.start.line,
      endLine: pos.end.line,
      start: pos.start.offset,
      end: pos.end.offset,
      depth: node.type === 'heading' ? node.depth : 0,
    });
  }
  return { frontmatter, blocks };
}
