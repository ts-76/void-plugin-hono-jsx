import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
import { MarkdownContext } from './markdown.ts';
import { ensureHonoStyleHost } from './style-host.ts';
export type IslandLoader = () => Promise<unknown>;
/** May return a cleanup that cancels pending work for an island that has not started loading. */
export type IslandScheduler = (element: HTMLElement, loader: IslandLoader, props: Record<string, unknown>, strategy: string, mount: (target: Element, module: unknown, props: Record<string, unknown>) => void) => void | (() => void);
export interface HydrateMarkdownOptions {
  schedule?: IslandScheduler;
  ready?: (element: HTMLElement, start: () => void) => void;
}
/** Host-independent DOM scheduling; no routing or presentation knowledge. */
export const scheduleMarkdownIsland: IslandScheduler = (element, loader, props, strategy, mount) => {
  const start = () => { void loader().then(module => mount(element, module, props)); };
  if (strategy === 'load') start();
  else if (strategy === 'idle') {
    if ('requestIdleCallback' in window) { const id = window.requestIdleCallback(start, { timeout: 2000 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(start, 1);
    return () => clearTimeout(id);
  } else if (strategy === 'visible') {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); } });
    observer.observe(element);
    return () => observer.disconnect();
  } else if (strategy.startsWith('media:')) {
    const media = window.matchMedia(strategy.slice(6));
    if (media.matches) start();
    else { const changed = () => { if (media.matches) { media.removeEventListener('change', changed); start(); } }; media.addEventListener('change', changed); return () => media.removeEventListener('change', changed); }
  } else throw new Error('Hono Markdown: invalid hydration strategy ' + strategy);
};
const failedLoad = Symbol('failed island load');
const report = (error: unknown) => { if (typeof reportError === 'function') reportError(error); else console.error(error); };
/** Returns a function that cancels islands which have not started mounting. Mounted islands stay. */
export function hydrateMarkdownIslands(loaders: Record<string, IslandLoader>, options: HydrateMarkdownOptions = {}) {
  const cleanups: Array<() => void> = [];
  let disposed = false;
  for (const element of document.querySelectorAll<HTMLElement>('[data-hono-md-island]')) {
    const loader = loaders[element.dataset.honoMdIsland!];
    if (!loader || element.dataset.honoMdScheduled) continue;
    element.dataset.honoMdScheduled = 'true';
    delete element.dataset.honoMdError;
    const strategy = element.dataset.honoMdHydrate || 'load';
    // Failures are reported once and leave the island retryable by a later call.
    const fail = (error: unknown) => {
      delete element.dataset.honoMdScheduled;
      element.dataset.honoMdError = 'true';
      report(error);
    };
    const load = () => loader().catch(error => { if (!disposed) fail(error); return failedLoad; });
    const start = () => {
      if (disposed) return;
      const cleanup = (options.schedule ?? scheduleMarkdownIsland)(element, load, JSON.parse(element.dataset.honoMdProps || '{}'), strategy, (_target, module, props) => {
        if (disposed || module === failedLoad) return;
        try {
          const component = (module as { default?: unknown }).default;
          if (typeof component !== 'function') throw new Error('Hono Markdown: island must export a default component.');
          ensureHonoStyleHost();
          const metadata = JSON.parse(element.dataset.honoMdContext || '{}');
          render(jsx(MarkdownContext.Provider, { value: metadata, children: jsx(component, props) }), element);
          element.dataset.honoMdMounted = 'true';
        } catch (error) { fail(error); }
      });
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    };
    cleanups.push(() => { if (!element.dataset.honoMdMounted) delete element.dataset.honoMdScheduled; });
    if (strategy === 'visible' && options.ready) options.ready(element, start); else start();
  }
  return () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
