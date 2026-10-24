import { createArticleRenderer } from '../render/renderer.ts';
import { configureMarkdownFeatures } from './markdown-features.ts';
import type { HonoMarkdownOptions } from '../render/types.ts';

export type { Heading, HonoMarkdownOptions, MarkdownHeading, MarkdownCodeBlock } from '../render/types.ts';

export function createMarkdownRenderer(options: HonoMarkdownOptions = {}) {
  return createArticleRenderer(options, configureMarkdownFeatures);
}

/** Raw HTML is escaped by default. Enabling html or a custom renderer requires trusted output. */
export async function renderMarkdown(source: string, options: HonoMarkdownOptions = {}) {
  return createMarkdownRenderer(options).render(source);
}
