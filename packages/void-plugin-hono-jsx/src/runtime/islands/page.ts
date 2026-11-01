import type { PageObject } from 'void/pages-protocol';
import type { renderHonoDocument } from '../pages/ssr-document.ts';

type Assets = Parameters<typeof renderHonoDocument>[2];
type IslandPage = PageObject & { deferred?: unknown[] };
type IslandPages = {
  interactive: ReadonlySet<string>;
  scriptOnly: ReadonlySet<string>;
  markdownScripts: ReadonlySet<string>;
};

/** Keep static and script-only pages free of unnecessary scheduler assets. */
export function createHonoIslandRenderer(
  renderPage: (page: PageObject, assets: Assets) => Promise<string>,
  pages: IslandPages,
) {
  return function renderIslandPage(page: IslandPage, assets: Assets) {
    if (page.deferred?.length || page.deferredKeys)
      throw new Error('Hono islands: deferred props are unsupported.');
    if (!pages.markdownScripts.has(page.component))
      assets = {
        ...assets,
        body: assets.body.replace(
          /<script\b[^>]*src=["'][^"']*(?:void-hono-markdown-client|markdown-client-)[^"']*["'][^>]*>\s*<\/script>/g,
          '',
        ),
        preloads: assets.preloads.replace(
          /<link\b[^>]*href=["'][^"']*markdown-client-[^"']*["'][^>]*>/g,
          '',
        ),
      };
    if (!pages.interactive.has(page.component))
      return renderPage(page, { ...assets, preloads: '', body: '' });
    if (pages.scriptOnly.has(page.component)) {
      const body = assets.body.replace(
        /<script\b[^>]*src=["'][^"']*(?:void-islands-client|islands-client-)[^"']*["'][^>]*>\s*<\/script>/g,
        '',
      );
      return renderPage(page, { ...assets, preloads: '', body });
    }
    return renderPage(page, assets);
  };
}
