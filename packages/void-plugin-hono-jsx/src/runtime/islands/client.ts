import type { initIslands } from 'void/pages-client';
import type { Context } from 'hono/jsx';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
import { ensureHonoStyleHost } from '../styles/host.ts';

// Development only: how to render each mounted island again, by island id.
const mounted = new Map<string, Set<(module: unknown) => void>>();

/**
 * Renders every mounted island with these ids again using an edited component module.
 * Returns false when none is mounted, so the caller can fall back to a page reload.
 * Island state resets because Hono JSX has no Fast Refresh.
 */
export function remountHonoIslands(ids: readonly string[], module: unknown): boolean {
  const remounts = ids.flatMap((id) => [...(mounted.get(id) ?? [])]);
  for (const remount of remounts) remount(module);
  return remounts.length > 0;
}

/**
 * Void schedules the islands. This callback restores the Hono context and mounts each one.
 * The generated entry passes the Markdown context only when Markdown is enabled.
 */
export function createHonoIslandMounter(
  markdown?: Pick<Context<never>, 'Provider'>,
): Parameters<typeof initIslands>[1] {
  ensureHonoStyleHost();
  for (const element of document.querySelectorAll('[data-hydrate^="media:"]')) {
    const query = element.getAttribute('data-hydrate')!.slice(6).trim();
    if (matchMedia(query).media === 'not all' && query !== 'not all')
      throw new Error('Hono islands: invalid or unsupported media query ' + query);
  }
  return (element, module, props) => {
    const mount = (module: unknown) => {
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
        content = jsx(markdown.Provider, {
          value: {
            frontmatter: metadata.frontmatter ?? {},
            headings: metadata.headings ?? [],
            props: metadata.props ?? {},
          },
          children: content,
        });
      }
      render(content, element as HTMLElement);
      element.setAttribute('data-hono-island', 'mounted');
    };
    mount(module);
    const id = element.getAttribute('data-island');
    if (import.meta.hot && id) {
      if (!mounted.has(id)) mounted.set(id, new Set());
      mounted.get(id)!.add(mount);
    }
  };
}
