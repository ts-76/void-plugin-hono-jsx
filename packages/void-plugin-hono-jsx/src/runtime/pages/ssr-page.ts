import { jsx, type Context } from 'hono/jsx';
import { createSsrRouter, idleNavigationState } from 'void/pages-client';
import type { PageObject } from 'void/pages-protocol';
import { PageContext, RouterContext, NavigationContext } from './api.tsx';
import { renderHonoDocument } from './ssr-document.ts';

type PageModule = {
  default: unknown;
  frontmatter?: Record<string, unknown>;
  clientFrontmatter?: Record<string, unknown>;
  headings?: unknown[];
};
type PageManifest = {
  components: Record<string, () => PageModule | Promise<PageModule>>;
  layoutTree: Record<string, string[]>;
  routeMeta?: Record<string, { island?: boolean }>;
};
type RenderOptions = {
  staticData: boolean;
  /** Supplied by the generated entry only when Markdown is enabled. */
  markdown?: Pick<Context<never>, 'Provider'>;
  markdownScripts: ReadonlySet<string>;
};

/**
 * Development only. A request can keep an old renderer while the worker module runner
 * reloads, so every server component is loaded while the renderer module evaluates.
 * Pages and layouts then stay in the renderer's module generation.
 */
export async function snapshotComponents(components: PageManifest['components']) {
  await Promise.all(
    Object.entries(components).map(async ([id, load]) => {
      const module = await load();
      components[id] = () => module;
    }),
  );
}

/** The generated entry supplies discovery data; rendering stays type checked here. */
export function createHonoPageRenderer(manifest: PageManifest, options: RenderOptions) {
  return async function renderPage(
    page: PageObject,
    assets: Parameters<typeof renderHonoDocument>[2],
    requestUrl?: string,
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
      content = jsx(options.markdown.Provider, {
        value: { frontmatter, clientFrontmatter, headings, props: page.props },
        children: content,
      });
    content = jsx(RouterContext.Provider, {
      value: createSsrRouter(page.url, page.params, requestUrl),
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
      // Island pages carry their props here because Void's page data format is
      // private (devalue since Void 1.7). Full Pages read props through the router.
      ...(options.markdown
        ? {
            markdown: JSON.stringify({
              frontmatter: clientFrontmatter,
              headings,
              ...(manifest.routeMeta?.[page.component]?.island ? { props: page.props } : {}),
            }),
          }
        : {}),
    });
  };
}
