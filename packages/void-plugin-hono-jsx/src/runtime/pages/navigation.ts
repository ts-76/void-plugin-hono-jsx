import {
  createRouterFacade,
  createVoidRouter,
  idleNavigationState,
  refreshPage,
  toUrlString,
  VoidActionError,
  type NavigationMethod,
  type NavigationState,
  type VisitOptions,
  type VoidRouter,
  type VoidRouterConfig,
} from 'void/pages-client';

/** DOM updates still complete when a native animation is skipped or replaced. */
export async function applyWithTransition(enabled: boolean, update: () => Promise<void>) {
  if (!enabled || !document.startViewTransition) return update();
  const transition = document.startViewTransition(update);
  // Rendering failures propagate through updateCallbackDone; animation skips do not.
  void transition.ready.catch(() => {});
  void transition.finished?.catch(() => {});
  await transition.updateCallbackDone;
}

type MultipartVisit = {
  controller: AbortController;
  refresh: 'not-started' | 'starting' | 'started';
};

function cancelled() {
  return new DOMException('Hono Pages: navigation was superseded.', 'AbortError');
}

/** Void owns ordinary visits. The adapter bridges native FormData and Hono render completion. */
export async function createHonoRouter(config: VoidRouterConfig) {
  let multipart: MultipartVisit | undefined;
  let coreNavigation = idleNavigationState();
  let transitionOverride: boolean | undefined;
  let transitionForVisit = config.viewTransitions;
  const publishNavigation = (state: NavigationState) => config.onNavigationChange?.(state);
  function abortMultipart() {
    const previous = multipart;
    multipart = undefined;
    previous?.controller.abort();
  }

  const core = await createVoidRouter({
    ...config,
    // Catch rejected animation promises without swallowing renderer failures.
    viewTransitions: false,
    adapter: {
      ...config.adapter,
      async applyUpdate(page, component, layouts, options) {
        if (multipart?.refresh === 'not-started') throw cancelled();
        await applyWithTransition(transitionForVisit, async () => {
          await config.adapter.applyUpdate(page, component, layouts, options);
        });
      },
    },
    onNavigationChange(state) {
      coreNavigation = state;
      if (state.state !== 'idle') {
        transitionForVisit = transitionOverride ?? config.viewTransitions;
        if (multipart?.refresh === 'starting') multipart.refresh = 'started';
        else if (multipart) abortMultipart();
      }
      if (!multipart) publishNavigation(state);
    },
  });

  function visitCore(url: Parameters<VoidRouter['visit']>[0], options: VisitOptions) {
    const { viewTransition, ...visitOptions } = options;
    transitionOverride = viewTransition;
    try {
      return core.router.visit(url, visitOptions);
    } finally {
      transitionOverride = undefined;
    }
  }

  async function visitMultipart(url: Parameters<VoidRouter['visit']>[0], options: VisitOptions) {
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
      throw new Error('Hono Pages: FormData requires POST, PUT, PATCH or DELETE.');
    const target = new URL(toUrlString(url), window.location.href);
    if (target.origin !== window.location.origin || !['http:', 'https:'].includes(target.protocol))
      throw new Error('Hono Pages: FormData actions must target the current origin.');

    abortMultipart();
    const request: MultipartVisit = { controller: new AbortController(), refresh: 'not-started' };
    multipart = request;
    core.router.flushAll();
    publishNavigation({
      state: 'submitting',
      location: target,
      method: method as NavigationMethod,
    });
    try {
      const response = await fetch(target, {
        method,
        body: options.data as FormData,
        headers: { 'X-VoidPages': 'true', Accept: 'application/json' },
        signal: request.controller.signal,
      });
      let body: unknown;
      if (response.headers.get('content-type')?.includes('application/json'))
        body = await response.json();
      else if (!response.ok) body = await response.text();
      else await response.body?.cancel();
      if (multipart !== request) throw cancelled();
      if (!response.ok)
        throw new VoidActionError({
          body,
          status: response.status,
          statusText: response.statusText,
          url: target.href,
        });
      if (
        typeof body === 'object' &&
        body &&
        'errors' in body &&
        body.errors &&
        Object.keys(body.errors).length
      )
        throw new VoidActionError({
          body: { errors: body.errors },
          status: 422,
          statusText: 'Unprocessable Content',
          url: target.href,
        });
      if (!response.headers.get('X-VoidPages')) {
        window.location.assign(response.url || target.href);
        return;
      }

      const destination = response.redirected
        ? response.url
        : typeof body === 'object' && body && 'url' in body && typeof body.url === 'string'
          ? body.url
          : target.href;
      request.refresh = 'starting';
      // The shared router cannot take raw FormData. Re-enter its GET lifecycle
      // for the refreshed page once the native mutation has finished.
      const page = await visitCore(destination, {
        ...options,
        method: 'GET',
        data: undefined,
        preserveState: options.preserveState ?? true,
        preserveScroll: options.preserveScroll ?? true,
      });
      if (multipart !== request) throw cancelled();
      return page;
    } finally {
      if (multipart === request) {
        multipart = undefined;
        publishNavigation(coreNavigation);
      }
    }
  }

  const router = createRouterFacade(
    {
      ...core.router,
      get url() {
        return core.router.url;
      },
      get params() {
        return core.router.params;
      },
      visit(url, options = {}) {
        if (options.data instanceof FormData) return visitMultipart(url, options);
        const interruptedUpload = multipart !== undefined;
        abortMultipart();
        try {
          return visitCore(url, options);
        } catch (error) {
          if (interruptedUpload) publishNavigation(coreNavigation);
          throw error;
        }
      },
      refresh(options = {}) {
        return refreshPage(router, options);
      },
    },
    () => core.router.url.href,
  );
  return { ...core, router };
}
