import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
import { scheduleHydration } from 'void/pages-client';
import { MarkdownContext } from './markdown.ts';
import { ensureHonoStyleHost } from './style-host.ts';

/** Start standalone Markdown islands without a Void Pages manifest or #app. */
export function hydrateMarkdownIslands(loaders: Record<string, () => Promise<unknown>>) {
  for (const element of document.querySelectorAll<HTMLElement>('[data-hono-md-island]')) {
    const loader = loaders[element.dataset.honoMdIsland!];
    if (!loader || element.dataset.honoMdScheduled) continue;
    element.dataset.honoMdScheduled = 'true';
    const strategy = element.dataset.honoMdHydrate || 'load';
    const start = () => scheduleHydration(element, loader, JSON.parse(element.dataset.honoMdProps || '{}'), strategy, (_target, module, props) => {
      const component = (module as { default?: unknown }).default;
      if (typeof component !== 'function') throw new Error('Hono Markdown: island must export a default component.');
      ensureHonoStyleHost();
      const metadata = JSON.parse(element.dataset.honoMdContext || '{}');
      render(jsx(MarkdownContext.Provider, { value: metadata, children: jsx(component, props) }), element);
      element.dataset.honoMdMounted = 'true';
    });
    const slide = element.closest<HTMLElement>('section[data-slide-state]');
    if (strategy === 'visible' && slide && slide.dataset.slideState !== 'active') {
      const observer = new MutationObserver(() => {
        if (slide.dataset.slideState === 'active') { observer.disconnect(); start(); }
      });
      observer.observe(slide, { attributes: true, attributeFilter: ['data-slide-state'] });
    } else start();
  }
}
