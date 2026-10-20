import { scheduleHydration } from 'void/pages-client';
import { hydrateMarkdownIslands as hydrate, type HydrateMarkdownOptions, type IslandLoader } from '@ts-76/hono-markdown/client';

/** Legacy entry retains slide activation semantics for existing hono-decks clients. */
export function hydrateMarkdownIslands(loaders: Record<string, IslandLoader>, options: HydrateMarkdownOptions = {}) {
  return hydrate(loaders, { schedule: scheduleHydration, ...options, ready: options.ready ?? legacySlideReady });
}
function legacySlideReady(element: HTMLElement, start: () => void) {
  const slide = element.closest<HTMLElement>('section[data-slide-state]');
  if (!slide || slide.dataset.slideState === 'active') { start(); return; }
  const observer = new MutationObserver(() => { if (slide.dataset.slideState === 'active') { observer.disconnect(); start(); } });
  observer.observe(slide, { attributes: true, attributeFilter: ['data-slide-state'] });
}
