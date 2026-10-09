import { createContext, useContext, type JSX } from 'hono/jsx';
import type { VoidRouter } from 'void/pages-client';
import type { PageObject } from 'void/pages-protocol';

export const RouterContext = createContext<VoidRouter | null>(null);
export const PageContext = createContext<PageObject | null>(null);

function usePage() {
  const page = useContext(PageContext);
  if (!page) throw new Error('Hono Pages: page data requires a page provider.');
  return page;
}

export function useShared() { return usePage().shared; }
export function useParams() { return usePage().params; }

export function useRouter(): VoidRouter {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Hono Pages: useRouter requires a page provider.');
  return router;
}

type LinkProps = Omit<JSX.IntrinsicElements['a'], 'href' | 'onClick'> & {
  href: string;
  reloadDocument?: boolean;
  replace?: boolean;
  onClick?: (event: MouseEvent) => void;
};

export function Link({ href, reloadDocument, replace, onClick, ...attributes }: LinkProps) {
  const router = useRouter();
  return <a {...attributes} href={href} onClick={(event: MouseEvent) => {
    onClick?.(event);
    if (event.defaultPrevented || reloadDocument || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (attributes.download !== undefined || (attributes.target && attributes.target !== '_self') || attributes.rel?.split(/\s+/).includes('external')) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return;
    event.preventDefault();
    void router.visit(url, { replace }).catch((error: unknown) => {
      window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }));
    });
  }} />;
}
