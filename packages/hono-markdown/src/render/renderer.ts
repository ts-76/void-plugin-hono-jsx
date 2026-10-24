import { createContentParser, parseContent, stripByteOrderMark } from './content.ts';
import type { MarkdownFeatureConfigurer } from './features.ts';
import type { HonoMarkdownOptions } from './types.ts';

/** Article content only: no YAML, script prelude, component imports or generated modules. */
export function createArticleRenderer(options: HonoMarkdownOptions, configureFeatures: MarkdownFeatureConfigurer) {
  const renderOptions = { ...options, highlight: options.highlight ?? false };
  const parser = createContentParser(renderOptions, false, configureFeatures);
  return {
    async render(source: string) {
      const { tokens, env, headings, hasCode, needsCodeCopy } = parseContent(parser, stripByteOrderMark(source), renderOptions, {}, 'user-content-');
      return { html: await parser.renderer.renderAsync(tokens, parser.options, env), headings, hasCode, needsCodeCopy };
    },
  };
}
