import { createPageNavigationEngine, createRouterFacade, idleNavigationState, isAbortError, type PageNavigationResource, type VoidRouter, type VoidRouterConfig, type NavigationMethod } from 'void/pages-client';

/** DOM updates still complete when a native animation is skipped or replaced. */
export async function applyWithTransition(enabled: boolean, update: () => Promise<void>) {
  if (!enabled || !document.startViewTransition) return update();
  const transition = document.startViewTransition(update);
  // ready rejects for expected animation skips; updateCallbackDone separately
  // propagates rendering failures. Never patch the browser's native method.
  void transition.ready.catch(() => {});
  await transition.updateCallbackDone;
}

/** Hono render integration over Void's public navigation engine and facade. */
export async function createHonoRouter(config: VoidRouterConfig) {
  const engine = await createPageNavigationEngine(config);
  const currentUrl = () => window.location.pathname + window.location.search + window.location.hash;
  const toUrl = (value: string | URL) => new URL(value, window.location.href);
  const normalize = (value: string | URL) => { const url = toUrl(value); return url.pathname + url.search + url.hash; };
  let routeUrl = currentUrl();
  let routeParams = engine.initialPageData.params ?? {};
  let active: number | null = null;
  const setRoute = (url: string, params = routeParams) => { routeUrl = url; routeParams = params; config.onRouteChange?.(url); };
  const assertCurrent = (resource: PageNavigationResource) => {
    if (active !== resource.id) throw new DOMException('Hono Pages: stale navigation callback discarded.', 'AbortError');
  };
  async function apply(resource: PageNavigationResource) {
    active = resource.id;
    config.onNavigationChange?.({ state: resource.method === 'GET' ? 'loading' : 'submitting', location: toUrl(resource.fetchUrl + resource.hash), method: resource.method.toUpperCase() as NavigationMethod });
    try {
      const result = await resource.shell;
      if (!result) return;
      assertCurrent(resource);
      setRoute(result.pageData.url || resource.fetchUrl + resource.hash, result.pageData.params ?? {});
      await applyWithTransition(resource.options.viewTransition ?? config.viewTransitions, async () => {
        assertCurrent(resource);
        await config.adapter.applyUpdate(result.pageData, result.component, result.layouts, { preserveState: resource.options.preserveState ?? resource.method !== 'GET' });
      });
      assertCurrent(resource);
      await resource.commit();
      if (active === resource.id) setRoute(currentUrl(), result.pageData.params ?? {});
      return result.pageData;
    } catch (error) {
      if (resource.method === 'GET' && !resource.options._resolveOnShell && isAbortError(error)) return;
      throw error;
    } finally {
      if (active === resource.id) { active = null; setRoute(currentUrl()); config.onNavigationChange?.(idleNavigationState()); }
    }
  }
  const raw: VoidRouter = {
    _hoverDelay: engine._hoverDelay,
    get url() { return toUrl(routeUrl); },
    get path() { return this.url.pathname; },
    get query() { return this.url.searchParams; },
    get params() { return routeParams; },
    visit(url, options = {}) { return apply(engine.prepareVisit(normalize(url), options)); },
    refresh(options = {}) { return raw.visit(window.location.pathname + window.location.search, { preserveState: true, preserveScroll: true, ...options }); },
    prefetch(url, options = {}) { return engine.prefetch(normalize(url), options); },
    flush(url, method = 'GET') { engine.flush(normalize(url), method); },
    flushAll() { engine.flushAll(); },
  };
  const router = createRouterFacade(raw, () => routeUrl, () => routeParams);
  engine.setPopStateHandler((url, options) => { void router.visit(url, options).catch(error => window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }))); });
  return { router, initialPageData: engine.initialPageData, initialComponent: engine.initialComponent, initialLayouts: engine.initialLayouts, start: engine.start, commitInitialRender: engine.commitInitialRender };
}
