import { ErrorBoundary, render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { useLayoutEffect, useState } from 'hono/jsx';
import {
  idleNavigationState,
  type NavigationState,
  type VoidRouterConfig,
} from 'void/pages-client';
import { PageContext, RouterContext, NavigationContext, setActionRouter } from './api.tsx';
import { NavigationFallback, type NavigationFallbackOptions } from './navigation-fallback.tsx';
import { createHonoRouter } from './navigation.ts';
import { createDocumentHead } from './document-head.ts';
import { ensureHonoStyleHost } from '../styles/host.ts';
import {
  createDeferred,
  resolveDeferred,
  rejectDeferred,
  isLoading,
  bufferInitialDeferred,
} from './deferred.ts';
import { createRenderState, type RenderFrame } from './render-state.ts';

type NavigationOptions = Pick<
  VoidRouterConfig,
  'viewTransitions' | 'prefetchHoverDelay' | 'prefetchDefaultCacheFor' | 'prefetchDefaultStrategy'
> & { navigationFallback?: NavigationFallbackOptions };

type Manifest = Pick<
  VoidRouterConfig,
  | 'components'
  | 'layoutTree'
  | 'routeMeta'
  | 'matchRoute'
  | 'staticPageData'
  | 'staticPageDataFastPath'
>;

function pageComponent(component: unknown) {
  if (typeof component !== 'function')
    throw new Error('Hono Pages: a page must export a component function.');
  return component;
}

export async function startHonoPages(manifest: Manifest, options: NavigationOptions) {
  ensureHonoStyleHost();
  if (options.navigationFallback && typeof options.navigationFallback.component !== 'function')
    throw new Error('Hono Pages: navigationFallback must default-export a component function.');
  const root = document.getElementById('app');
  if (!root) throw new Error('Hono Pages: app root is missing.');
  const renders = createRenderState();
  let update: ((frame: RenderFrame) => void) | undefined;
  let navigationState = idleNavigationState();
  let updateNavigation: ((state: NavigationState) => void) | undefined;
  let applyDocumentHead: ReturnType<typeof createDocumentHead> | undefined;
  let updateDeferred: ((props: Record<string, unknown>) => void) | undefined;
  const initialization = createHonoRouter({
    ...manifest,
    adapter: {
      createDeferred,
      resolveDeferred,
      rejectDeferred,
      isLoading,
      onDeferredUpdate(props) {
        if (renders.acceptsDeferred(props)) updateDeferred?.({ ...props });
      },
      async applyUpdate(page, component, layouts, options) {
        layouts.forEach(pageComponent);
        pageComponent(component);
        if (!update) throw new Error('Hono Pages: page rendering has not started.');
        const { frame, committed } = renders.request(
          page,
          component,
          layouts,
          options.preserveState,
        );
        update(frame);
        await committed;
      },
    },
    ...options,
    cacheVisitedPageData: false,
    onNavigationChange(state) {
      navigationState = state;
      updateNavigation?.(state);
      root.dataset.navigation = state.state;
    },
  });
  const releaseBuffer = bufferInitialDeferred();
  const navigation = await initialization.finally(releaseBuffer);
  setActionRouter(navigation.router);
  applyDocumentHead = createDocumentHead(navigation.initialPageData.head);

  const initialFrame = renders.initial(
    navigation.initialPageData,
    navigation.initialComponent,
    navigation.initialLayouts,
  );
  function PageFrame({ frame }: { frame: RenderFrame }) {
    useLayoutEffect(() => {
      if (!renders.canCommit(frame)) return;
      if (frame.commit > 0) applyDocumentHead?.(frame.page.head);
      renders.complete(frame);
    }, [frame]);
    let content = jsx(pageComponent(frame.component), frame.page.props, String(frame.revision));
    const ids = manifest.layoutTree[frame.page.component] ?? [];
    for (let index = frame.layouts.length - 1; index >= 0; index--) {
      content = jsx(pageComponent(frame.layouts[index]), { children: content }, ids[index]);
    }
    return <PageContext.Provider value={frame.page}>{content}</PageContext.Provider>;
  }

  function App() {
    const [frame, setFrame] = useState<RenderFrame>(initialFrame);
    const [pendingNavigation, setNavigation] = useState(navigationState);
    const [failed, setFailed] = useState(false);
    const [recovery, setRecovery] = useState(0);
    useLayoutEffect(() => {
      updateNavigation = setNavigation;
      setNavigation(navigationState);
      updateDeferred = (props) =>
        setFrame((frame) => ({ ...frame, page: { ...frame.page, props } }));
      update = (next) => {
        setFailed(false);
        setFrame(next);
      };
      const onError = () => setFailed(true);
      window.addEventListener('hono-pages:navigation-error', onError);
      return () => {
        renders.dispose();
        updateNavigation = undefined;
        update = undefined;
        updateDeferred = undefined;
        window.removeEventListener('hono-pages:navigation-error', onError);
      };
    }, []);
    const renderFailed = (error: unknown) =>
      renders.fail(frame, error, (previous) => {
        if (previous) setFrame(previous);
        // Only failed renders discard the partial tree; successful visits retain layout state.
        setRecovery((value) => value + 1);
        setFailed(true);
      });
    return (
      <RouterContext.Provider value={navigation.router}>
        <NavigationContext.Provider value={pendingNavigation}>
          {failed && <p role="alert">The page could not be loaded. Please try again.</p>}
          <ErrorBoundary key={recovery} onError={renderFailed} fallback={<></>}>
            <PageFrame frame={frame} />
          </ErrorBoundary>
          {options.navigationFallback && (
            <NavigationFallback state={pendingNavigation} options={options.navigationFallback} />
          )}
        </NavigationContext.Provider>
      </RouterContext.Provider>
    );
  }

  render(<App />, root);
  navigation.start();
  navigation.commitInitialRender();
  root.dataset.navigation = 'idle';
  root.dataset.honoPages = 'mounted';
}
