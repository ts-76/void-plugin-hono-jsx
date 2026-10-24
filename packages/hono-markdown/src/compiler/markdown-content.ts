import MarkdownExit from 'markdown-exit';
import { configureMarkdownFeatures, type HonoMarkdownOptions } from './markdown-features.ts';

export type Heading = { depth: number; slug: string; text: string };

export function createContentParser(options: HonoMarkdownOptions, trusted: boolean) {
  const parser = new MarkdownExit({ html: options.html ?? trusted, breaks: options.breaks ?? false, linkify: options.linkify ?? true });
  if (!trusted) {
    const validateLink = parser.validateLink;
    // Keep the parser's own checks and narrow schemes for article content.
    // Relative/fragment URLs remain valid. Raw HTML, when opted in, is trusted.
    parser.validateLink = url => {
      const decoded = url.replace(/%([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const scheme = /^([a-z][a-z\d+.-]*):/i.exec(decoded.replace(/[\s\u0000-\u001f\u007f]/g, ''))?.[1].toLowerCase();
      return validateLink(url) && (!scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme));
    };
  }
  configureMarkdownFeatures(parser, options);
  return parser;
}

export function parseContent(parser: MarkdownExit, content: string, options: HonoMarkdownOptions, env: Record<string, unknown> = {}, headingPrefix = '') {
  const tokens = parser.parse(content, env);
  const headings: Heading[] = [];
  const slugs = new Map<string, number>();
  const authoredHtml = tokens.flatMap(token => token.type === 'html_block' || token.type === 'html_inline' ? [token.content] : (token.children ?? []).filter(child => child.type === 'html_inline').map(child => child.content)).join('\n');
  const usedIds = new Set([...authoredHtml.matchAll(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(match => parser.utils.unescapeAll(match[1] ?? match[2] ?? match[3])));
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'heading_open') continue;
    const inline = tokens[index + 1];
    const text = inline.children?.map(token => token.type === 'text' || token.type === 'code_inline' ? token.content : token.type === 'image' ? token.content : '').join('') ?? inline.content;
    const depth = Number(tokens[index].tag.slice(1));
    const generated = options.headingId?.({ depth, text, index: headings.length });
    if (options.headingId && (typeof generated !== 'string' || !generated || /[\s\u0000-\u001f\u007f]/u.test(generated))) throw new Error('Hono Markdown: headingId must return a non-empty ID without whitespace or control characters.');
    const base = generated ?? headingPrefix + (text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') || 'heading');
    let count = slugs.get(base) ?? 0;
    let slug = count ? `${base}-${count}` : base;
    while (usedIds.has(slug)) { count++; slug = `${base}-${count}`; }
    slugs.set(base, count + 1); usedIds.add(slug);
    tokens[index].attrSet('id', slug);
    headings.push({ depth, slug, text });
  }
  const hasCode = tokens.some(token => token.type === 'fence');
  return { headings, tokens, env, hasCode, needsCodeCopy: hasCode && options.highlight !== false && !options.renderCodeBlock };
}
