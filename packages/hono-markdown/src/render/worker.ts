import { createArticleRenderer } from './renderer.ts';
import { configureMarkdownFeatures } from './features.ts';
import type { HonoMarkdownOptions } from './types.ts';

export type { Heading, HonoMarkdownOptions, MarkdownHeading, MarkdownCodeBlock } from './types.ts';
export type WorkerMarkdownOptions = Omit<HonoMarkdownOptions, 'highlight'> & { highlight?: false };

/** Request-time rendering without Node APIs, module compilation or bundled highlighters. */
export function createMarkdownRenderer(options: WorkerMarkdownOptions = {}) {
  return createArticleRenderer(options, configureMarkdownFeatures);
}

export async function renderMarkdown(source: string, options: WorkerMarkdownOptions = {}) {
  return createMarkdownRenderer(options).render(source);
}
