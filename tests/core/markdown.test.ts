// The block scanner must agree with remark (CommonMark) on every spec file in the repo and on
// the edge cases spec authors are likely to write.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../src/core/markdown';
import { REPO } from '../helpers';
import { remarkBlocks } from '../oracle/remark-markdown';

const scan = (text: string) => {
  const d = parseMarkdown(text);
  return { frontmatter: d.frontmatter, blocks: d.blocks.map(({ type, line, endLine, start, end, depth }) => ({ type, line, endLine, start, end, depth })) };
};

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.git') return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return name.endsWith('.md') ? [full] : [];
  });
}

describe('block scanner agrees with remark', () => {
  const files = [...markdownFiles(join(REPO, 'fixtures')), ...markdownFiles(join(REPO, 'tests/core/lint-cases')), ...markdownFiles(join(REPO, 'tests/core/__snapshots__'))];
  it(`on every spec, ticket and brief file in the repo (${files.length})`, () => {
    expect(files.length).toBeGreaterThan(50);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(scan(text), relative(REPO, f)).toEqual(remarkBlocks(text));
    }
  });

  const cases: Record<string, string> = {
    'heading inside a fence': '# A\n\n```md\n### not a heading\n```\n\n## B\n',
    'tilde fence and info string': '~~~yaml\na: 1\n~~~\ntext\n',
    'unclosed fence runs to the end': 'intro\n\n```\ncode\n\nmore\n',
    'backtick in a backtick info string is not a fence': '``` a`b\ntext\n',
    'setext headings': 'Title\n=====\n\nSub\n---\npara\n',
    'closing hashes and empty heading': '## Title ##\n\n#\n\ntext\n',
    'thematic breaks': 'a\n\n***\n\n- - -\n\nb\n',
    'paragraph interrupted by a list': 'Given x\n- item\n- item 2\n',
    'loose list with blank lines and nesting': '- a\n\n- b\n  - b1\n    more\n\nafter\n',
    'ordered list': '1. one\n2. two\n10. ten\n\ntext\n',
    'ordered list not starting at 1 does not interrupt': 'para\n2. two\n',
    'blockquote with lazy continuation': '> quoted\nlazy line\n\n> again\n',
    'html comment over several lines': '<!-- a\nb\n-->\n\ntext\n',
    'html block': '<div>\nx\n</div>\n\ntext\n',
    'indented code after a blank line': 'para\n\n    code\n    more\n\nend\n',
    'trailing spaces and indentation': '  para with indent   \nnext line  \n\n   ### H\n',
    'trailing spaces on every block type': '## H  \n\n- item  \n- two  \n\n```  \ncode  \n```  \n\n> q  \n\n***  \n\n<!-- c -->  \n',
    'frontmatter only': '---\na: 1\n---\n',
    'unclosed frontmatter is not frontmatter': '---\na: 1\n\ntext\n',
    'empty frontmatter': '---\n---\nbody\n',
  };
  for (const [name, text] of Object.entries(cases)) {
    it(name, () => {
      expect(scan(text)).toEqual(remarkBlocks(text));
    });
  }
});
