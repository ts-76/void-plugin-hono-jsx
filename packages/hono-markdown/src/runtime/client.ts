import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
import { MarkdownContext } from './markdown.ts';
import { ensureHonoStyleHost } from './style-host.ts';
export type IslandLoader = () => Promise<unknown>;
export type IslandScheduler = (element: HTMLElement, loader: IslandLoader, props: Record<string, unknown>, strategy: string, mount: (target: Element, module: unknown, props: Record<string, unknown>) => void) => void;
export interface HydrateMarkdownOptions {
  schedule?: IslandScheduler;
  ready?: (element: HTMLElement, start: () => void) => void;
}
/** Host-independent DOM scheduling; no routing or presentation knowledge. */
export const scheduleMarkdownIsland: IslandScheduler = (element, loader, props, strategy, mount) => {
  const start = () => { void loader().then(module => mount(element, module, props)); };
  if (strategy === 'load') start();
  else if (strategy === 'idle') {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 1);
  } else if (strategy === 'visible') {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); } });
    observer.observe(element);
  } else if (strategy.startsWith('media:')) {
    const media = window.matchMedia(strategy.slice(6));
    if (media.matches) start();
    else { const changed = () => { if (media.matches) { media.removeEventListener('change', changed); start(); } }; media.addEventListener('change', changed); }
  } else throw new Error('Hono Markdown: invalid hydration strategy ' + strategy);
};
export function hydrateMarkdownIslands(loaders: Record<string, IslandLoader>, options: HydrateMarkdownOptions = {}) {
  for (const element of document.querySelectorAll<HTMLElement>('[data-hono-md-island]')) {
    const loader = loaders[element.dataset.honoMdIsland!];
    if (!loader || element.dataset.honoMdScheduled) continue;
    element.dataset.honoMdScheduled = 'true';
    const strategy = element.dataset.honoMdHydrate || 'load';
    const start = () => (options.schedule ?? scheduleMarkdownIsland)(element, loader, JSON.parse(element.dataset.honoMdProps || '{}'), strategy, (_target, module, props) => {
      const component = (module as { default?: unknown }).default;
      if (typeof component !== 'function') throw new Error('Hono Markdown: island must export a default component.');
      ensureHonoStyleHost();
      const metadata = JSON.parse(element.dataset.honoMdContext || '{}');
      render(jsx(MarkdownContext.Provider, { value: metadata, children: jsx(component, props) }), element);
      element.dataset.honoMdMounted = 'true';
    });
    if (strategy === 'visible' && options.ready) options.ready(element, start); else start();
  }
}
