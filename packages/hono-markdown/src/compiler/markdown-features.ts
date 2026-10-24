import type MarkdownExit from 'markdown-exit';
import type { ShikiTransformer } from 'shiki';
import { configureMarkdownFeatures as configureBaseFeatures } from '../render/features.ts';
import type { HonoMarkdownOptions } from '../render/types.ts';

export type { HonoMarkdownOptions, MarkdownHeading, MarkdownCodeBlock } from '../render/types.ts';

/** `{1,3-5}` fence metadata, clamped to the block so authored ranges cannot allocate beyond it. */
function highlightedLines(info: string, lineCount: number) {
  const ranges = (/\{([\d,-]+)\}/.exec(info)?.[1].split(',') ?? []).flatMap(part => {
    const [start, end = start] = part.split('-', 2).map(value => Number.parseInt(value, 10));
    return start >= 1 && end >= start && start <= lineCount ? [[start, Math.min(end, lineCount)]] : [];
  }).sort((a, b) => a[0] - b[0]);
  const lines = new Set<number>();
  let next = 1;
  for (const [start, end] of ranges) {
    for (let line = Math.max(start, next); line <= end; line++) lines.add(line);
    next = Math.max(next, end + 1);
  }
  return lines;
}

export function configureMarkdownFeatures(md: MarkdownExit, options: HonoMarkdownOptions) {
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
      transformers.transformerNotationDiff(),
      transformers.transformerNotationHighlight(), transformers.transformerNotationFocus(), transformers.transformerNotationErrorLevel(),
    ] };
  };
  let initialized: ReturnType<typeof initialize> | undefined;
  const loading = new Map<string, Promise<void>>();
  configureBaseFeatures(md, options, async (code, label, info) => {
    const { highlighter, selected, languages, transformers } = await (initialized ??= initialize());
    let lang = label;
    if (!['text', 'txt', 'plain', 'plaintext', 'ansi'].includes(lang) && !highlighter.getLoadedLanguages().includes(lang)) {
      if (Object.hasOwn(languages, lang)) {
        if (!loading.has(lang)) loading.set(lang, highlighter.loadLanguage(lang as keyof typeof languages));
        await loading.get(lang);
      } else lang = 'text';
    }
    const lines = highlightedLines(info, code.split('\n').length);
    const metaHighlight: ShikiTransformer = { name: 'hono-markdown:meta-highlight', line(node, line) { if (lines.has(line)) this.addClassToHast(node, 'highlighted'); } };
    const highlighted = highlighter.codeToHtml(code, { lang, themes: selected, defaultColor: 'light', transformers: [metaHighlight, ...transformers], meta: { __raw: info } });
    if (options.renderCodeBlock) return options.renderCodeBlock({ code, language: label, info, html: highlighted });
    const numbers = /:line-numbers\b/.test(info);
    const start = Number(/\{=(\d+)\}/.exec(info)?.[1] ?? 1);
    const count = [...highlighted.matchAll(/class="line(?:[ "])/g)].length;
    const gutter = numbers ? `<div class="line-numbers-wrapper" aria-hidden="true">${Array.from({ length: count }, (_, offset) => `<span class="line-number">${start + offset}</span><br>`).join('')}</div>` : '';
    const active = /(?:^|\s)active(?:\s|$)/.test(info) ? ' active' : '';
    return `<div class="language-${md.utils.escapeHtml(label)}${active}${numbers ? ' line-numbers-mode' : ''}"><button type="button" title="Copy Code" aria-label="Copy Code" class="copy"></button><span class="lang">${md.utils.escapeHtml(label)}</span>${highlighted}${gutter}</div>\n`;
  });
}
