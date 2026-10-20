import { scheduleHydration } from 'void/pages-client';
import { hydrateMarkdownIslands as hydrate, type HydrateMarkdownOptions, type IslandLoader } from '@ts-76/hono-markdown/client';

/** Connect Markdown islands to Void; hosts supply any readiness gate. */
export function hydrateMarkdownIslands(loaders: Record<string, IslandLoader>, options: HydrateMarkdownOptions = {}) {
  return hydrate(loaders, { schedule: scheduleHydration, ...options });
}
