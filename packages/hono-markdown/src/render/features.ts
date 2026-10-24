import container from 'markdown-it-container';
import type MarkdownExit from 'markdown-exit';
import type { HonoMarkdownOptions } from './types.ts';

export type MarkdownFeatureConfigurer = (md: MarkdownExit, options: HonoMarkdownOptions) => void;
export type HighlightCode = (code: string, language: string, info: string) => Promise<string>;

export function configureMarkdownFeatures(md: MarkdownExit, options: HonoMarkdownOptions, highlightCode?: HighlightCode) {
  if (options.highlight !== false && !highlightCode) throw new Error('Hono Markdown: built-in highlighting is Node/build-time only. In Workers, omit highlight or set highlight: false and use renderCodeBlock for application-owned highlighting.');
  for (const [kind, title] of [['tip', 'TIP'], ['info', 'INFO'], ['warning', 'WARNING'], ['danger', 'DANGER'], ['details', 'Details']]) {
    md.use(container, kind, { render(tokens: Parameters<NonNullable<typeof md.renderer.rules.fence>>[0], index: number, _options: unknown, env: Parameters<NonNullable<typeof md.renderer.rules.fence>>[3]) {
      if (tokens[index].nesting !== 1) return kind === 'details' ? '</details>\n' : '</div>\n';
      const authored = tokens[index].info.trim().slice(kind.length).trim();
      const rendered = md.renderInline(authored || title, { references: env.references });
      if (kind === 'details') return `<details class="${kind} custom-block"><summary>${rendered}</summary>\n`;
      return `<div class="${kind} custom-block"><p class="custom-block-title${authored ? '' : ' custom-block-title-default'}">${rendered}</p>\n`;
    } });
  }

  if (options.renderCodeBlock) md.renderer.rules.code_block = async (tokens, index) => {
    const code = tokens[index].content;
    return options.renderCodeBlock!({ code, language: 'text', info: '', html: `<pre><code>${md.utils.escapeHtml(code)}</code></pre>\n` });
  };
  md.renderer.rules.fence = async (tokens, index) => {
    const token = tokens[index];
    const label = /^[\w+-]+/.exec(token.info.trim())?.[0] ?? 'text';
    if (options.highlight !== false) return highlightCode!(token.content, label, token.info);
    const html = `<pre><code${token.info.trim() ? ` class="language-${md.utils.escapeHtml(label)}"` : ''}>${md.utils.escapeHtml(token.content)}</code></pre>\n`;
    return options.renderCodeBlock ? options.renderCodeBlock({ code: token.content, language: label, info: token.info, html }) : html;
  };
}
