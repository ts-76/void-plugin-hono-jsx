import { render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { useLayoutEffect, useState } from 'hono/jsx';
import { createVoidRouter, idleNavigationState, type NavigationState, type VoidRouterConfig } from 'void/pages-client';
import { PageContext, RouterContext, NavigationContext, setActionRouter } from './pages.tsx';
import { createDocumentHead } from './document-head.ts';
import { createDeferred, resolveDeferred, rejectDeferred, isLoading, bufferInitialDeferred } from './deferred.ts';

type NavigationOptions = Pick<VoidRouterConfig, 'viewTransitions' | 'prefetchHoverDelay' | 'prefetchDefaultCacheFor'>;

type Manifest = Pick<VoidRouterConfig, 'components' | 'layoutTree' | 'routeMeta' | 'matchRoute' | 'staticPageData' | 'staticPageDataFastPath'>;

function pageComponent(component: unknown) {
  if (typeof component !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  return component;
}

export async function startHonoPages(manifest: Manifest, options: NavigationOptions) {
  const root = document.getElementById('app');
  if (!root) throw new Error('Hono Pages: app root is missing.');
  type Frame = { page: Awaited<ReturnType<typeof createVoidRouter>>['initialPageData']; component: unknown; layouts: unknown[]; revision: number; commit: number };
  let update: ((frame: Frame) => void) | undefined;
  let revision = 0;
  let commit = 0;
  let navigationEpoch = 0;
  let renderIntent: { url: string; epoch: number } | undefined;
  const pendingCommits = new Map<number, () => void>();
  let navigationState = idleNavigationState();
  let updateNavigation: ((state: NavigationState) => void) | undefined;
  let applyDocumentHead: ReturnType<typeof createDocumentHead> | undefined;
  let renderedProps: Record<string, unknown> | undefined;
  let updateDeferred: ((props: Record<string, unknown>) => void) | undefined;
  const initialization = createVoidRouter({
    ...manifest,
    adapter: {
      createDeferred, resolveDeferred, rejectDeferred, isLoading,
      onDeferredUpdate(props) {
        if (props === renderedProps) updateDeferred?.({ ...props });
      },
      async applyUpdate(page, component, layouts, options) {
        // A native transition may delay its callback beyond a newer request.
        // Void reports the shell's route before calling the adapter; discard an
        // old callback instead of drawing its DOM/head over the newer page.
        if (renderIntent?.epoch !== navigationEpoch || renderIntent.url !== page.url) throw new DOMException('Hono Pages: stale navigation callback discarded.', 'AbortError');
        layouts.forEach(pageComponent);
        pageComponent(component);
        if (!update) throw new Error('Hono Pages: page rendering has not started.');
        if (!options.preserveState) revision++;
        renderedProps = page.props;
        const nextCommit = ++commit;
        const committed = new Promise<void>(resolve => pendingCommits.set(nextCommit, resolve));
        update({ page: { ...page, props: { ...page.props } }, component, layouts, revision, commit: nextCommit });
        await committed;
      },
    },
    ...options,
    cacheVisitedPageData: false,
    onRouteChange(url) { renderIntent = { url, epoch: navigationEpoch }; },
    onNavigationChange(state) { if (state.state !== 'idle') navigationEpoch++; navigationState = state; updateNavigation?.(state); root.dataset.navigation = state.state; },
  });
  const releaseBuffer = bufferInitialDeferred();
  const navigation = await initialization.finally(releaseBuffer);
  setActionRouter(navigation.router);
  renderedProps = navigation.initialPageData.props;
  applyDocumentHead = createDocumentHead(navigation.initialPageData.head);

  function App() {
    const [frame, setFrame] = useState<Frame>({ page: { ...navigation.initialPageData, props: { ...navigation.initialPageData.props } }, component: navigation.initialComponent, layouts: navigation.initialLayouts, revision, commit });
    const [pendingNavigation, setNavigation] = useState(navigationState);
    const [failed, setFailed] = useState(false);
    useLayoutEffect(() => {
      updateNavigation = setNavigation;
      setNavigation(navigationState);
      updateDeferred = (props) => setFrame((frame) => ({ ...frame, page: { ...frame.page, props } }));
      update = (next) => { setFailed(false); setFrame(next); };
      const onError = () => setFailed(true);
      window.addEventListener('hono-pages:navigation-error', onError);
      return () => { for (const resolve of pendingCommits.values()) resolve(); pendingCommits.clear(); updateNavigation = undefined; update = undefined; updateDeferred = undefined; window.removeEventListener('hono-pages:navigation-error', onError); };
    }, []);
    useLayoutEffect(() => {
      if (frame.commit > 0) applyDocumentHead?.(frame.page.head);
      // Hono has committed the complete child DOM before layout effects run.
      // Coalesced frames also release older waiters using the newest snapshot.
      for (const [id, resolve] of pendingCommits) if (id <= frame.commit) { pendingCommits.delete(id); resolve(); }
    }, [frame]);
    let content = jsx(pageComponent(frame.component), frame.page.props, String(frame.revision));
    const ids = manifest.layoutTree[frame.page.component] ?? [];
    for (let index = frame.layouts.length - 1; index >= 0; index--) {
      content = jsx(pageComponent(frame.layouts[index]), { children: content }, ids[index]);
    }
    return <RouterContext.Provider value={navigation.router}>
      <PageContext.Provider value={frame.page}>
        <NavigationContext.Provider value={pendingNavigation}>
          {failed && <p role="alert">The page could not be loaded. Please try again.</p>}
          {content}
        </NavigationContext.Provider>
      </PageContext.Provider>
    </RouterContext.Provider>;
  }

  render(<App />, root);
  navigation.start();
  navigation.commitInitialRender();
  root.dataset.navigation = 'idle';
  root.dataset.honoPages = 'mounted';
}
