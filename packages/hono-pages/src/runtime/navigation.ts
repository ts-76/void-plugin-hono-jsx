import { createPageNavigationEngine, createRouterFacade, refreshPage, idleNavigationState, isAbortError, VoidActionError, type VisitOptions, type PageNavigationResource, type VoidRouter, type VoidRouterConfig, type NavigationMethod } from 'void/pages-client';

/** DOM updates still complete when a native animation is skipped or replaced. */
export async function applyWithTransition(enabled: boolean, update: () => Promise<void>) {
  if (!enabled || !document.startViewTransition) return update();
  const transition = document.startViewTransition(update);
  // Rendering failures propagate through updateCallbackDone; animation skips do not.
  void transition.ready.catch(() => {});
  void transition.finished?.catch(() => {});
  await transition.updateCallbackDone;
}

/** Hono render integration over Void's public navigation engine and facade. */
export async function createHonoRouter(config: VoidRouterConfig) {
  const engine = await createPageNavigationEngine(config);
  const currentUrl = () => window.location.pathname + window.location.search + window.location.hash;
  const toUrl = (value: string | URL) => new URL(value, window.location.href);
  const normalize = (value: string | URL) => {
    const url = toUrl(value);
    // Preserve foreign origins and schemes for the shared engine's guards.
    return url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol)
      ? url.pathname + url.search + url.hash : url.href;
  };
  let routeUrl = currentUrl();
  let routeParams = engine.initialPageData.params ?? {};
  let active: number | null = null;
  let resource: PageNavigationResource | undefined;
  let multipartController: AbortController | undefined;
  let multipartId = 0;
  const setRoute = (url: string, params = routeParams) => { routeUrl = url; routeParams = params; config.onRouteChange?.(url); };
  const assertCurrent = (id: number) => {
    if (active !== id) throw new DOMException('Hono Pages: stale navigation callback discarded.', 'AbortError');
  };
  async function apply(next: PageNavigationResource, navigationMethod = next.method) {
    resource = next; active = next.id;
    const previousParams = routeParams;
    config.onNavigationChange?.({ state: navigationMethod === 'GET' ? 'loading' : 'submitting', location: toUrl(next.fetchUrl + next.hash), method: navigationMethod.toUpperCase() as NavigationMethod });
    try {
      const result = await next.shell;
      if (!result) return;
      assertCurrent(next.id);
      setRoute(result.pageData.url || next.fetchUrl + next.hash, result.pageData.params ?? {});
      await applyWithTransition(next.options.viewTransition ?? config.viewTransitions, async () => {
        assertCurrent(next.id);
        await config.adapter.applyUpdate(result.pageData, result.component, result.layouts, { preserveState: next.options.preserveState ?? next.method !== 'GET' });
      });
      assertCurrent(next.id);
      await next.commit();
      if (active === next.id) setRoute(currentUrl(), result.pageData.params ?? {});
      return result.pageData;
    } catch (error) {
      if (active === next.id) routeParams = previousParams;
      if (navigationMethod === 'GET' && !next.options._resolveOnShell && isAbortError(error)) return;
      throw error;
    } finally {
      if (resource === next) resource = undefined;
      if (active === next.id) { active = null; setRoute(currentUrl()); config.onNavigationChange?.(idleNavigationState()); }
    }
  }

  async function visitMultipart(url: string, options: VisitOptions) {
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw new Error('Hono Pages: FormData requires POST, PUT, PATCH or DELETE.');
    const target = toUrl(url);
    if (target.origin !== window.location.origin || !['http:', 'https:'].includes(target.protocol)) throw new Error('Hono Pages: FormData actions must target the current origin.');
    // Negative IDs cannot collide with the shared engine's positive generation IDs.
    const id = --multipartId;
    active = id;
    resource?.abort(); multipartController?.abort();
    const controller = multipartController = new AbortController();
    engine.flushAll();
    config.onNavigationChange?.({ state: 'submitting', location: target, method: method as NavigationMethod });
    try {
      const response = await fetch(target, { method, body: options.data as FormData, headers: { 'X-VoidPages': 'true', Accept: 'application/json' }, signal: controller.signal });
      let body: unknown;
      if (response.headers.get('content-type')?.includes('application/json')) body = await response.json();
      else if (!response.ok) body = await response.text();
      else await response.body?.cancel();
      assertCurrent(id);
      if (!response.ok) throw new VoidActionError({ body, status: response.status, statusText: response.statusText, url });
      if (typeof body === 'object' && body !== null && 'errors' in body && body.errors && Object.keys(body.errors).length) {
        throw new VoidActionError({ body: { errors: body.errors }, status: 422, statusText: 'Unprocessable Content', url });
      }
      if (!response.headers.get('X-VoidPages')) { window.location.assign(response.url || target.href); return; }
      const destination = response.redirected ? response.url : typeof body === 'object' && body !== null && 'url' in body && typeof body.url === 'string' ? body.url : target.href;
      multipartController = undefined;
      // The public engine cannot consume raw FormData or an externally fetched shell.
      // Refresh through its GET protocol, retaining component state and mutation UI.
      return await apply(engine.prepareVisit(normalize(destination), { ...options, method: 'GET', data: undefined, preserveState: options.preserveState ?? true, preserveScroll: options.preserveScroll ?? true }), method);
    } finally {
      if (multipartController === controller) multipartController = undefined;
      if (active === id) { active = null; setRoute(currentUrl()); config.onNavigationChange?.(idleNavigationState()); }
    }
  }

  const raw: VoidRouter = {
    _hoverDelay: engine._hoverDelay,
    get url() { return toUrl(routeUrl); },
    get path() { return this.url.pathname; },
    get query() { return this.url.searchParams; },
    get params() { return routeParams; },
    visit(url, options = {}) {
      if (options.data instanceof FormData) return visitMultipart(normalize(url), options);
      multipartController?.abort(); multipartController = undefined;
      return apply(engine.prepareVisit(normalize(url), options));
    },
    refresh(options = {}) { return refreshPage(raw, options); },
    prefetch(url, options = {}) { return engine.prefetch(normalize(url), options); },
    flush(url, method = 'GET') { engine.flush(normalize(url), method); },
    flushAll() { engine.flushAll(); },
  };
  const router = createRouterFacade(raw, () => routeUrl, () => routeParams);
  engine.setPopStateHandler((url, options) => { void router.visit(url, options).catch(error => window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }))); });
  return { router, initialPageData: engine.initialPageData, initialComponent: engine.initialComponent, initialLayouts: engine.initialLayouts, start: engine.start, commitInitialRender: engine.commitInitialRender };
}
