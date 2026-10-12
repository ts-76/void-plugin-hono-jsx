import MarkdownExit from 'markdown-exit';
import { parseSync } from 'vite';
import { parseDocument } from 'yaml';
import { findIslandImports, editIslandSource } from 'void/pages-islands-plugin';

const unescapeAttribute = new MarkdownExit().utils.unescapeAll;

export type Heading = { depth: number; slug: string; text: string };
export function extractMarkdown(source: string) {
  const match = source.match(/^<script\b[^>]*>([\s\S]*?)<\/script>\s*\n?/);
  const script = match?.[1] ?? '';
  const body = match ? source.slice(match[0].length) : source;
  const imports = findIslandImports(script, 'markdown-script.ts');
  const attributed = parseSync('markdown-script.ts', script).program.body.filter(node => node.type === 'ImportDeclaration' && node.attributes?.some(({ key }) => ('name' in key && key.name === 'island') || ('value' in key && key.value === 'island')));
  if (attributed.length !== imports.length) throw new Error('Hono Markdown: use one default component import with exactly one island attribute.');
  const graphSource = imports.map(entry => script.slice(entry.start, entry.end)).join('\n');
  const clientCode = editIslandSource(script, imports.map(entry => ({ start: entry.start, end: entry.end, text: '' }))).code.trim();
  return { body, script, imports, graphSource, clientCode };
}

export function compileMarkdown(source: string) {
  const extracted = extractMarkdown(source);
  const match = extracted.body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let frontmatter: Record<string, unknown> = {};
  if (match) {
    const yaml = parseDocument(match[1], { uniqueKeys: true });
    if (yaml.errors.length) throw new Error('Hono Markdown: invalid frontmatter: ' + yaml.errors.map(error => error.message).join('; '));
    const value: unknown = yaml.toJS({ maxAliasCount: 50 });
    if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('Hono Markdown: frontmatter must be a mapping.');
    frontmatter = (value ?? {}) as Record<string, unknown>;
    try { JSON.stringify(frontmatter); } catch { throw new Error('Hono Markdown: frontmatter must be JSON serializable.'); }
  }
  const content = match ? extracted.body.slice(match[0].length) : extracted.body;
  const compiler = new MarkdownExit({ html: true, linkify: true });
  const tokens = compiler.parse(content, {});
  const headings: Heading[] = [];
  const slugs = new Map<string, number>();
  const authoredHtml = tokens.flatMap(token => token.type === 'html_block' || token.type === 'html_inline' ? [token.content] : (token.children ?? []).filter(child => child.type === 'html_inline').map(child => child.content)).join('\n');
  const usedIds = new Set([...authoredHtml.matchAll(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => match[1] ?? match[2]));
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'heading_open') continue;
    const inline = tokens[index + 1];
    const text = inline.children?.map(token => token.type === 'text' || token.type === 'code_inline' ? token.content : token.type === 'image' ? token.content : '').join('') ?? inline.content;
    const base = text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') || 'heading';
    let count = slugs.get(base) ?? 0;
    let slug = count ? `${base}-${count}` : base;
    while (usedIds.has(slug)) { count++; slug = `${base}-${count}`; }
    slugs.set(base, count + 1); usedIds.add(slug);
    tokens[index].attrSet('id', slug);
    headings.push({ depth: Number(tokens[index].tag.slice(1)), slug, text });
  }
  return { ...extracted, frontmatter, headings, html: compiler.renderer.render(tokens, compiler.options, {}) };
}

// Component tag splitting follows @void/md 0.27.0's emit-shared convention.
// Hono raw fragments preserve enclosing HTML across the component boundaries.
export function renderChunks(html: string, names: Set<string>) {
  const tags = /<([A-Z]\w*)\s*((?:[^>/"']|"[^"]*"|'[^']*')*)\/\s*>|<([A-Z]\w*)\s*((?:[^>/"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\3\s*>/g;
  const chunks: Array<{ html: string } | { name: string; props: Record<string, string | boolean> }> = [];
  let cursor = 0;
  for (const match of html.matchAll(tags)) {
    const name = match[1] ?? match[3];
    if (!names.has(name)) continue;
    if (match[5]?.trim()) throw new Error('Hono Markdown: island tag children are unsupported; pass literal attributes to a self-closing tag.');
    if (match.index > cursor) chunks.push({ html: html.slice(cursor, match.index) });
    const props: Record<string, string | boolean> = Object.create(null);
    const attrs = match[2] ?? match[4] ?? '';
    const attrRe = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
    for (const attr of attrs.matchAll(attrRe)) {
      const value = attr[2] ?? attr[3] ?? attr[4];
      props[attr[1]] = value === undefined ? true : unescapeAttribute(value);
    }
    chunks.push({ name, props }); cursor = match.index + match[0].length;
  }
  if (cursor < html.length) chunks.push({ html: html.slice(cursor) });
  return chunks;
}
