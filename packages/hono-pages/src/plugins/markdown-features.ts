export * from '@ts-76/hono-markdown/features';
import type { HonoMarkdownOptions as CommonMarkdownOptions } from '@ts-76/hono-markdown/features';

/** The host owns which metadata it serializes, including with older common compilers. */
export type HonoMarkdownOptions = CommonMarkdownOptions & {
  clientFrontmatter?: boolean | readonly string[];
};
