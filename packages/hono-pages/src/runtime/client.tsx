import { ErrorBoundary, render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { useLayoutEffect, useState } from 'hono/jsx';
import { idleNavigationState, type NavigationState, type VoidRouterConfig } from 'void/pages-client';
import { PageContext, RouterContext, NavigationContext, setActionRouter } from './pages.tsx';
import { NavigationFallback, type NavigationFallbackOptions } from './navigation-fallback.tsx';
import { createHonoRouter } from './navigation.ts';
import { createDocumentHead } from './document-head.ts';
import { ensureHonoStyleHost } from './style-host.ts';
import { createDeferred, resolveDeferred, rejectDeferred, isLoading, bufferInitialDeferred } from './deferred.ts';

type NavigationOptions = Pick<VoidRouterConfig, 'viewTransitions' | 'prefetchHoverDelay' | 'prefetchDefaultCacheFor'> & { navigationFallback?: NavigationFallbackOptions };

type Manifest = Pick<VoidRouterConfig, 'components' | 'layoutTree' | 'routeMeta' | 'matchRoute' | 'staticPageData' | 'staticPageDataFastPath'>;

function pageComponent(component: unknown) {
  if (typeof component !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  return component;
}

export async function startHonoPages(manifest: Manifest, options: NavigationOptions) {
  ensureHonoStyleHost();
  if (options.navigationFallback && typeof options.navigationFallback.component !== 'function') throw new Error('Hono Pages: navigationFallback must default-export a component function.');
  const root = document.getElementById('app');
  if (!root) throw new Error('Hono Pages: app root is missing.');
  type Frame = { page: Awaited<ReturnType<typeof createHonoRouter>>['initialPageData']; sourceProps: Record<string, unknown>; component: unknown; layouts: unknown[]; revision: number; commit: number };
  let update: ((frame: Frame) => void) | undefined;
  let revision = 0;
  let commit = 0;
  const pendingCommits = new Map<number, { resolve(): void; reject(error: unknown): void }>();
  let committedFrame: Frame | undefined;
  const failedFrames = new Set<number>();
  let navigationState = idleNavigationState();
  let updateNavigation: ((state: NavigationState) => void) | undefined;
  let applyDocumentHead: ReturnType<typeof createDocumentHead> | undefined;
  let renderedProps: Record<string, unknown> | undefined;
  let updateDeferred: ((props: Record<string, unknown>) => void) | undefined;
  const initialization = createHonoRouter({
    ...manifest,
    adapter: {
      createDeferred, resolveDeferred, rejectDeferred, isLoading,
      onDeferredUpdate(props) {
        if (props === renderedProps) updateDeferred?.({ ...props });
      },
      async applyUpdate(page, component, layouts, options) {
        layouts.forEach(pageComponent);
        pageComponent(component);
        if (!update) throw new Error('Hono Pages: page rendering has not started.');
        if (!options.preserveState) revision++;
        renderedProps = page.props;
        const nextCommit = ++commit;
        const committed = new Promise<void>((resolve, reject) => pendingCommits.set(nextCommit, { resolve, reject }));
        update({ page: { ...page, props: { ...page.props } }, sourceProps: page.props, component, layouts, revision, commit: nextCommit });
        await committed;
      },
    },
    ...options,
    cacheVisitedPageData: false,
    onNavigationChange(state) { navigationState = state; updateNavigation?.(state); root.dataset.navigation = state.state; },
  });
  const releaseBuffer = bufferInitialDeferred();
  const navigation = await initialization.finally(releaseBuffer);
  setActionRouter(navigation.router);
  renderedProps = navigation.initialPageData.props;
  applyDocumentHead = createDocumentHead(navigation.initialPageData.head);

  const initialFrame: Frame = { page: { ...navigation.initialPageData, props: { ...navigation.initialPageData.props } }, sourceProps: navigation.initialPageData.props, component: navigation.initialComponent, layouts: navigation.initialLayouts, revision, commit };
  function PageFrame({ frame }: { frame: Frame }) {
    useLayoutEffect(() => {
      if (failedFrames.has(frame.commit)) return;
      if (frame.commit > 0) applyDocumentHead?.(frame.page.head);
      committedFrame = frame;
      for (const id of failedFrames) if (id < frame.commit) failedFrames.delete(id);
      for (const [id, pending] of pendingCommits) if (id <= frame.commit) { pendingCommits.delete(id); pending.resolve(); }
    }, [frame]);
    let content = jsx(pageComponent(frame.component), frame.page.props, String(frame.revision));
    const ids = manifest.layoutTree[frame.page.component] ?? [];
    for (let index = frame.layouts.length - 1; index >= 0; index--) {
      content = jsx(pageComponent(frame.layouts[index]), { children: content }, ids[index]);
    }
    return <PageContext.Provider value={frame.page}>{content}</PageContext.Provider>;
  }

  function App() {
    const [frame, setFrame] = useState<Frame>(initialFrame);
    const [pendingNavigation, setNavigation] = useState(navigationState);
    const [failed, setFailed] = useState(false);
    const [recovery, setRecovery] = useState(0);
    useLayoutEffect(() => {
      updateNavigation = setNavigation;
      setNavigation(navigationState);
      updateDeferred = (props) => setFrame((frame) => ({ ...frame, page: { ...frame.page, props } }));
      update = (next) => { setFailed(false); setFrame(next); };
      const onError = () => setFailed(true);
      window.addEventListener('hono-pages:navigation-error', onError);
      return () => { for (const pending of pendingCommits.values()) pending.reject(new DOMException('Hono Pages: renderer unmounted.', 'AbortError')); pendingCommits.clear(); updateNavigation = undefined; update = undefined; updateDeferred = undefined; window.removeEventListener('hono-pages:navigation-error', onError); };
    }, []);
    const renderFailed = (error: unknown) => {
      if (failedFrames.has(frame.commit)) return;
      failedFrames.add(frame.commit);
      queueMicrotask(() => {
      // A rejected child never reaches PageFrame's commit effect. Roll back
      // outside the render traversal, then reject every coalesced waiter.
      if (commit === frame.commit) {
        if (committedFrame) { renderedProps = committedFrame.sourceProps; setFrame(committedFrame); }
        // Discard the partially built Hono tree only after a render failure.
        // Successful navigations keep the same boundary and layout state.
        setRecovery(value => value + 1);
        setFailed(true);
      }
      for (const [id, pending] of pendingCommits) if (id <= frame.commit) { pendingCommits.delete(id); pending.reject(error); }
      });
    };
    return <RouterContext.Provider value={navigation.router}>
      <NavigationContext.Provider value={pendingNavigation}>
        {failed && <p role="alert">The page could not be loaded. Please try again.</p>}
        <ErrorBoundary key={recovery} onError={renderFailed} fallback={<></>}>
          <PageFrame frame={frame} />
        </ErrorBoundary>
        {options.navigationFallback && <NavigationFallback state={pendingNavigation} options={options.navigationFallback} />}
      </NavigationContext.Provider>
    </RouterContext.Provider>;
  }

  render(<App />, root);
  navigation.start();
  navigation.commitInitialRender();
  root.dataset.navigation = 'idle';
  root.dataset.honoPages = 'mounted';
}
