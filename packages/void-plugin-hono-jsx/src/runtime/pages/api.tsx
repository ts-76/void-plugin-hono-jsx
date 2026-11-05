import { createContext, useContext, useEffect, useRef, type JSX } from 'hono/jsx';
import {
  createActionClient,
  linkActiveAttributes,
  linkPendingAttributes,
  linkPrefetchStrategies,
  observeLinkVisible,
  resolveLink,
  type LinkActiveMatch,
  type NavigationState,
  type NavigationMethod,
  type VoidRouter,
} from 'void/pages-client';
import type { CacheForInput } from 'void/pages-prefetch';
import type { PageObject } from 'void/pages-protocol';
export type { DeferredState as Deferred } from 'void';
export { HonoStyles } from '../styles/context.ts';
export { deferredResult, type DeferredResult } from './deferred.ts';
export type NavigationFallbackProps = { navigation: NavigationState };

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

export function useShared() {
  return usePage().shared;
}
export function useParams() {
  return usePage().params;
}
export function useErrors() {
  return usePage().errors ?? {};
}

export function useRouter(): VoidRouter {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Hono Pages: useRouter requires a page provider.');
  return router;
}

export type PrefetchStrategy = 'hover' | 'click' | 'mount' | 'visible';
export type LinkProps = Omit<JSX.IntrinsicElements['a'], 'href' | 'onClick'> & {
  href: string;
  activeMatch?: LinkActiveMatch;
  method?: NavigationMethod | Lowercase<NavigationMethod>;
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  reloadDocument?: boolean;
  replace?: boolean;
  viewTransition?: boolean;
  prefetch?: boolean | PrefetchStrategy | ReadonlyArray<PrefetchStrategy>;
  cacheFor?: CacheForInput;
  onNavigate?: (event: { preventDefault(): void }) => void;
  onClick?: (event: MouseEvent) => void;
};

export function Link({
  href,
  activeMatch,
  method = 'GET',
  data,
  preserveScroll,
  preserveState,
  reloadDocument,
  replace,
  viewTransition,
  prefetch,
  cacheFor,
  onNavigate,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onMouseDown,
  onTouchStart,
  ...attributes
}: LinkProps) {
  const router = useRouter();
  const navigation = useContext(NavigationContext);
  const element = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const normalized = method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalized))
    throw new Error('Hono Link: unsupported method.');
  const link = resolveLink({ href, method, data, prefetch, reloadDocument });
  const { isGet: get, href: destination } = link;
  const strategies = linkPrefetchStrategies(
    { prefetch, reloadDocument },
    link,
    router._prefetchDefaultStrategy,
  );
  if (strategies.some((strategy) => !['hover', 'click', 'mount', 'visible'].includes(strategy)))
    throw new Error('Hono Link: unsupported prefetch strategy.');
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const canHandle = () => {
    const url = new URL(destination, window.location.href);
    return (
      !reloadDocument &&
      attributes.download === undefined &&
      (!attributes.target || attributes.target === '_self') &&
      !attributes.rel?.split(/\s+/).includes('external') &&
      url.origin === window.location.origin &&
      ['http:', 'https:'].includes(url.protocol)
    );
  };
  const report = (error: unknown) =>
    window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }));
  const fetchAhead = () => {
    if (!canHandle()) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      connection?.effectiveType === '2g' ||
      connection?.effectiveType === 'slow-2g'
    )
      return;
    const target = new URL(destination, window.location.href);
    if (target.pathname === window.location.pathname && target.search === window.location.search)
      return;
    void router.prefetch(destination, { cacheFor }).catch(report);
  };
  useEffect(() => {
    if (strategies.includes('mount')) fetchAhead();
    const stopObserving =
      strategies.includes('visible') && element.current
        ? observeLinkVisible(element.current, fetchAhead)
        : undefined;
    return () => {
      clear();
      stopObserving?.();
    };
  }, [destination, prefetch, cacheFor, reloadDocument, router]);
  const events = {
    onClick(event: MouseEvent) {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !canHandle()
      )
        return;
      let cancelled = false;
      onNavigate?.({
        preventDefault() {
          cancelled = true;
        },
      });
      event.preventDefault();
      if (!cancelled)
        void router
          .visit(new URL(destination, window.location.href), {
            method: normalized,
            data: get ? undefined : data,
            preserveScroll,
            preserveState,
            replace,
            viewTransition,
          })
          .catch(report);
    },
    onMouseEnter(event: MouseEvent) {
      onMouseEnter?.(event);
      clear();
      if (!event.defaultPrevented && strategies.includes('hover'))
        timer.current = setTimeout(fetchAhead, router._hoverDelay);
    },
    onMouseLeave(event: MouseEvent) {
      onMouseLeave?.(event);
      clear();
    },
    onFocus(event: FocusEvent) {
      onFocus?.(event);
      if (!event.defaultPrevented && strategies.includes('hover')) fetchAhead();
    },
    onMouseDown(event: MouseEvent) {
      onMouseDown?.(event);
      if (!event.defaultPrevented && strategies.includes('click')) fetchAhead();
    },
    onTouchStart(event: TouchEvent) {
      onTouchStart?.(event);
      if (!event.defaultPrevented && (strategies.includes('click') || strategies.includes('hover')))
        fetchAhead();
    },
  };
  const pending = linkPendingAttributes(router, navigation, link);
  const ref = typeof document === 'undefined' ? {} : { ref: element };
  if (get)
    return (
      <a
        {...linkActiveAttributes(router, link, activeMatch)}
        {...pending}
        {...attributes}
        {...events}
        {...ref}
        href={String(destination)}
      />
    );
  return <button {...pending} {...attributes} {...events} {...ref} type="button" />;
}
