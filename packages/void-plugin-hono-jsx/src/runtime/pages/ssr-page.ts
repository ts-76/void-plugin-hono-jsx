import { jsx } from 'hono/jsx';
import { createSsrRouter, idleNavigationState } from 'void/pages-client';
import type { PageObject } from 'void/pages-protocol';
import { PageContext, RouterContext, NavigationContext } from './api.tsx';
import { MarkdownContext, type MarkdownHeading } from '../markdown/context.ts';
import { renderHonoDocument } from './ssr-document.ts';

type PageModule = {
  default: unknown;
  frontmatter?: Record<string, unknown>;
  clientFrontmatter?: Record<string, unknown>;
  headings?: MarkdownHeading[];
};
type PageManifest = {
  components: Record<string, () => PageModule | Promise<PageModule>>;
  layoutTree: Record<string, string[]>;
};
type RenderOptions = {
  staticData: boolean;
  markdown: boolean;
  markdownScripts: ReadonlySet<string>;
};

/** The generated entry supplies discovery data; rendering stays type checked here. */
export function createHonoPageRenderer(manifest: PageManifest, options: RenderOptions) {
  return async function renderPage(
    page: PageObject,
    assets: Parameters<typeof renderHonoDocument>[2],
  ) {
    if (options.staticData && page.deferredKeys)
      throw new Error(
        'Hono Pages: deferred props cannot be statically prerendered; remove defer().',
      );
    const load = manifest.components[page.component];
    if (!load) throw new Error('Hono Pages: unknown page component ' + page.component);
    const {
      default: Page,
      frontmatter = {},
      clientFrontmatter = frontmatter,
      headings = [],
    } = await load();
    if (typeof Page !== 'function')
      throw new Error('Hono Pages: a page must export a component function.');
    let content = jsx(Page, page.props);
    const ids = manifest.layoutTree[page.component] ?? [];
    const layouts = await Promise.all(
      ids.map(async (id) => (await manifest.components[id]()).default),
    );
    for (const Layout of layouts.reverse()) {
      if (typeof Layout !== 'function')
        throw new Error('Hono Pages: a layout must export a component function.');
      content = jsx(Layout, { children: content });
    }
    if (options.markdown)
      content = jsx(MarkdownContext.Provider, {
        value: { frontmatter, clientFrontmatter, headings, props: page.props },
        children: content,
      });
    content = jsx(RouterContext.Provider, {
      value: createSsrRouter(page.url, page.params),
      children: jsx(PageContext.Provider, {
        value: page,
        children: jsx(NavigationContext.Provider, {
          value: idleNavigationState(),
          children: content,
        }),
      }),
    });
    return renderHonoDocument(content, page, assets, {
      markdownScript: options.markdownScripts.has(page.component) ? page.component : undefined,
      ...(options.markdown
        ? { markdown: JSON.stringify({ frontmatter: clientFrontmatter, headings }) }
        : {}),
    });
  };
}
