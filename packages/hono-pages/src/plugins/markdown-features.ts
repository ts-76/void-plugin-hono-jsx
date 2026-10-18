import { createRequire } from 'node:module';
import type MarkdownExit from 'markdown-exit';
import type { PluginWithParams } from 'markdown-exit';

/** Matches @void/md's public Markdown options; languages load on demand. */
export type HonoMarkdownOptions = {
  shiki?: { themes?: { light: string; dark: string } };
};

export function configureMarkdownFeatures(md: MarkdownExit, options: HonoMarkdownOptions) {
  const container = createRequire(import.meta.url)('markdown-it-container') as PluginWithParams;
  for (const [kind, title] of [['tip', 'TIP'], ['info', 'INFO'], ['warning', 'WARNING'], ['danger', 'DANGER'], ['details', 'Details']]) {
    md.use(container, kind, { render(tokens: Parameters<NonNullable<typeof md.renderer.rules.fence>>[0], index: number, _options: unknown, env: Parameters<NonNullable<typeof md.renderer.rules.fence>>[3]) {
      if (tokens[index].nesting !== 1) return kind === 'details' ? '</details>\n' : '</div>\n';
      const authored = tokens[index].info.trim().slice(kind.length).trim();
      const rendered = md.renderInline(authored || title, { references: env.references });
      if (kind === 'details') return `<details class="${kind} custom-block"><summary>${rendered}</summary>\n`;
      return `<div class="${kind} custom-block"><p class="custom-block-title${authored ? '' : ' custom-block-title-default'}">${rendered}</p>\n`;
    } });
  }

  // One highlighter per plugin, not a global first-options-wins singleton.
  const themes = { light: options.shiki?.themes?.light ?? 'github-light', dark: options.shiki?.themes?.dark ?? 'github-dark' };
  const initialize = async () => {
    const [shiki, { createJavaScriptRegexEngine }, transformers] = await Promise.all([
      import('shiki'), import('shiki/engine/javascript'), import('@shikijs/transformers'),
    ]);
    for (const theme of Object.values(themes)) if (!Object.hasOwn(shiki.bundledThemes, theme)) throw new Error(`Hono Markdown: unknown Shiki theme ${JSON.stringify(theme)}.`);
    const selected = themes as { light: keyof typeof shiki.bundledThemes; dark: keyof typeof shiki.bundledThemes };
    const highlighter = await shiki.createHighlighter({ engine: createJavaScriptRegexEngine(), themes: [...new Set(Object.values(selected))], langs: [] });
    return { highlighter, selected, languages: shiki.bundledLanguages, transformers: [
      transformers.transformerMetaHighlight(), transformers.transformerNotationDiff(),
      transformers.transformerNotationHighlight(), transformers.transformerNotationFocus(), transformers.transformerNotationErrorLevel(),
    ] };
  };
  let initialized: ReturnType<typeof initialize> | undefined;
  const loading = new Map<string, Promise<void>>();
  md.renderer.rules.fence = async (tokens, index) => {
    const token = tokens[index];
    const { highlighter, selected, languages, transformers } = await (initialized ??= initialize());
    const label = /^[\w+-]+/.exec(token.info.trim())?.[0] ?? 'text';
    let lang = label;
    if (!['text', 'txt', 'plain', 'plaintext', 'ansi'].includes(lang) && !highlighter.getLoadedLanguages().includes(lang)) {
      if (Object.hasOwn(languages, lang)) {
        if (!loading.has(lang)) loading.set(lang, highlighter.loadLanguage(lang as keyof typeof languages));
        await loading.get(lang);
      } else lang = 'text';
    }
    const highlighted = highlighter.codeToHtml(token.content, { lang, themes: selected, defaultColor: 'light', transformers, meta: { __raw: token.info } });
    const numbers = /:line-numbers\b/.test(token.info);
    const start = Number(/\{=(\d+)\}/.exec(token.info)?.[1] ?? 1);
    const count = [...highlighted.matchAll(/class="line(?:[ "])/g)].length;
    const gutter = numbers ? `<div class="line-numbers-wrapper" aria-hidden="true">${Array.from({ length: count }, (_, offset) => `<span class="line-number">${start + offset}</span><br>`).join('')}</div>` : '';
    const active = /(?:^|\s)active(?:\s|$)/.test(token.info) ? ' active' : '';
    return `<div class="language-${md.utils.escapeHtml(label)}${active}${numbers ? ' line-numbers-mode' : ''}"><button type="button" title="Copy Code" aria-label="Copy Code" class="copy"></button><span class="lang">${md.utils.escapeHtml(label)}</span>${highlighted}${gutter}</div>\n`;
  };
}
