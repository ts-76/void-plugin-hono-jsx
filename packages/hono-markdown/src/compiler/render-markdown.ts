import { createContentParser, parseContent } from './markdown-content.ts';
import type { HonoMarkdownOptions } from './markdown-features.ts';

export type { Heading } from './markdown-content.ts';
export type { HonoMarkdownOptions, MarkdownHeading, MarkdownCodeBlock } from './markdown-features.ts';

/** Article content only: no YAML, script prelude, component imports or generated modules. */
export function createMarkdownRenderer(options: HonoMarkdownOptions = {}) {
  const renderOptions = { highlight: false, ...options };
  const parser = createContentParser(renderOptions, false);
  return {
    async render(source: string) {
      const { tokens, env, headings, hasCode, needsCodeCopy } = parseContent(parser, source, renderOptions, {}, 'user-content-');
      return { html: await parser.renderer.renderAsync(tokens, parser.options, env), headings, hasCode, needsCodeCopy };
    },
  };
}

/** Raw HTML is escaped by default. Enabling html or a custom renderer requires trusted output. */
export async function renderMarkdown(source: string, options: HonoMarkdownOptions = {}) {
  return createMarkdownRenderer(options).render(source);
}
