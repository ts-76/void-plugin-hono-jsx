import { initIslands } from 'void/pages-client';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
import { MarkdownContext } from '../markdown/context.ts';
import { ensureHonoStyleHost } from '../styles/host.ts';

/** Generated loaders supply module identity; mounting and metadata are fixed runtime behavior. */
export function startHonoIslands(loaders: Parameters<typeof initIslands>[0], markdown: boolean) {
  ensureHonoStyleHost();
  for (const element of document.querySelectorAll('[data-hydrate^="media:"]')) {
    const query = element.getAttribute('data-hydrate')!.slice(6).trim();
    if (matchMedia(query).media === 'not all' && query !== 'not all')
      throw new Error('Hono islands: invalid or unsupported media query ' + query);
  }
  initIslands(loaders, (element, module, props) => {
    if (
      !module ||
      typeof module !== 'object' ||
      !('default' in module) ||
      typeof module.default !== 'function'
    )
      throw new Error('Hono islands: a component must export a default function.');
    let content = jsx(module.default, props);
    if (markdown) {
      const metadata = JSON.parse(
        document.getElementById('app')?.getAttribute('data-hono-markdown') || '{}',
      );
      const page = JSON.parse(document.getElementById('__VOID_PAGE_DATA__')?.textContent || '{}');
      content = jsx(MarkdownContext.Provider, {
        value: {
          frontmatter: metadata.frontmatter ?? {},
          headings: metadata.headings ?? [],
          props: page.props ?? {},
        },
        children: content,
      });
    }
    render(content, element as HTMLElement);
    element.setAttribute('data-hono-island', 'mounted');
  });
}
