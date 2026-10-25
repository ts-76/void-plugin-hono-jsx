import { createArticleRenderer } from './renderer.ts';
import { configureMarkdownFeatures } from './features.ts';
import type { MarkdownRenderOptions } from './types.ts';

export type { Heading, MarkdownRenderOptions, MarkdownHeading, MarkdownCodeBlock } from './types.ts';

/** Article rendering in Workers and Node, without Node APIs or bundled highlighters. */
export function createMarkdownRenderer(options: MarkdownRenderOptions = {}) {
  // Reject removed Node-only options in JavaScript too, instead of silently
  // changing an application's highlighted output during migration.
  for (const key of ['highlight', 'shiki', 'clientFrontmatter']) {
    if (key in options) throw new TypeError(`Hono Markdown /render: ${key} is not an article option. Use renderCodeBlock for highlighting, or /compiler for trusted modules.`);
  }
  return createArticleRenderer(options, configureMarkdownFeatures);
}

/** HTML is escaped by default; opt-in HTML and custom renderer output must be trusted. */
export async function renderMarkdown(source: string, options: MarkdownRenderOptions = {}) {
  return createMarkdownRenderer(options).render(source);
}
