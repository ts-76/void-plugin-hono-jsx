import { createContext, useContext, useEffect, useRef, type JSX } from 'hono/jsx';
import { createActionClient, mergeDataIntoHref, type NavigationState, type NavigationMethod, type VoidRouter } from 'void/pages-client';
import type { CacheForInput } from 'void/pages-prefetch';
import type { PageObject } from 'void/pages-protocol';
export type { DeferredState as Deferred } from 'void';

const actionClient = createActionClient();
export const action = actionClient.action;
export const setActionRouter = actionClient.setActionRouter;

export const RouterContext = createContext<VoidRouter | null>(null);
export const NavigationContext = createContext<NavigationState | null>(null);
export const PageContext = createContext<PageObject | null>(null);

function usePage() {
  const page = useContext(PageContext);
  if (!page) throw new Error('Hono Pages: page data requires a page provider.');
  return page;
}

export function useNavigation(): NavigationState {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error('Hono Pages: useNavigation requires a page provider.');
  return navigation;
}

export function useShared() { return usePage().shared; }
export function useParams() { return usePage().params; }
export function useErrors() { return usePage().errors ?? {}; }

export function useRouter(): VoidRouter {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Hono Pages: useRouter requires a page provider.');
  return router;
}

export type PrefetchStrategy = 'hover' | 'click' | 'mount' | 'visible';
export type LinkProps = Omit<JSX.IntrinsicElements['a'], 'href' | 'onClick'> & {
  href: string;
  method?: NavigationMethod | Lowercase<NavigationMethod>;
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  reloadDocument?: boolean;
  replace?: boolean;
  prefetch?: boolean | PrefetchStrategy | ReadonlyArray<PrefetchStrategy>;
  cacheFor?: CacheForInput;
  onNavigate?: (event: { preventDefault(): void }) => void;
  onClick?: (event: MouseEvent) => void;
};

export function Link({ href, method = 'GET', data, preserveScroll, preserveState, reloadDocument, replace,
  prefetch = false, cacheFor, onNavigate, onClick, onMouseEnter, onMouseLeave, onFocus, onMouseDown, onTouchStart,
  ...attributes }: LinkProps) {
  const router = useRouter();
  const element = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const normalized = method.toUpperCase();
  const get = normalized === 'GET';
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalized)) throw new Error('Hono Link: unsupported method.');
  if (!get && (prefetch !== false || reloadDocument)) throw new Error('Hono Link: prefetch and reloadDocument only support GET links.');
  const destination = get ? mergeDataIntoHref(href, data) : href;
  const strategies = reloadDocument || prefetch === false ? [] : prefetch === true ? ['hover'] : typeof prefetch === 'string' ? [prefetch] : prefetch;
  if (strategies.some((strategy) => !['hover', 'click', 'mount', 'visible'].includes(strategy))) throw new Error('Hono Link: unsupported prefetch strategy.');
  const clear = () => { clearTimeout(timer.current); timer.current = undefined; };
  const canHandle = () => {
    const url = new URL(destination, window.location.href);
    return !reloadDocument && attributes.download === undefined && (!attributes.target || attributes.target === '_self') &&
      !attributes.rel?.split(/\s+/).includes('external') && url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol);
  };
  const report = (error: unknown) => window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }));
  const fetchAhead = () => {
    if (canHandle()) void router.prefetch(destination, { cacheFor }).catch(report);
  };
  useEffect(() => {
    if (strategies.includes('mount')) fetchAhead();
    let observer: IntersectionObserver | undefined;
    if (strategies.includes('visible') && element.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer?.disconnect(); fetchAhead(); }
      });
      observer.observe(element.current);
    }
    return () => { clear(); observer?.disconnect(); };
  }, [destination, prefetch, cacheFor, reloadDocument, router]);
  const events = {
    onClick(event: MouseEvent) {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !canHandle()) return;
      let cancelled = false;
      onNavigate?.({ preventDefault() { cancelled = true; } });
      event.preventDefault();
      if (!cancelled) void router.visit(new URL(destination, window.location.href), { method: normalized, data: get ? undefined : data, preserveScroll, preserveState, replace }).catch(report);
    },
    onMouseEnter(event: MouseEvent) {
      onMouseEnter?.(event); clear();
      if (!event.defaultPrevented && strategies.includes('hover')) timer.current = setTimeout(fetchAhead, router._hoverDelay);
    },
    onMouseLeave(event: MouseEvent) { onMouseLeave?.(event); clear(); },
    onFocus(event: FocusEvent) { onFocus?.(event); if (!event.defaultPrevented && strategies.includes('hover')) fetchAhead(); },
    onMouseDown(event: MouseEvent) { onMouseDown?.(event); if (!event.defaultPrevented && strategies.includes('click')) fetchAhead(); },
    onTouchStart(event: TouchEvent) { onTouchStart?.(event); if (!event.defaultPrevented && strategies.includes('click')) fetchAhead(); },
  };
  if (get) return <a {...attributes} {...events} ref={element} href={destination} />;
  return <button {...attributes} {...events} ref={element} type="button" />;
}
