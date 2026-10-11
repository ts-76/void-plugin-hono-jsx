import { render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { useLayoutEffect, useState } from 'hono/jsx';
import { createVoidRouter, type VoidRouterConfig } from 'void/pages-client';
import { parseCacheFor } from 'void/pages-prefetch';
import { PageContext, RouterContext } from './pages.tsx';
import { createDocumentHead } from './document-head.ts';
import { createDeferred, resolveDeferred, rejectDeferred, isLoading, bufferInitialDeferred } from './deferred.ts';

type Manifest = Pick<VoidRouterConfig, 'components' | 'layoutTree' | 'routeMeta' | 'matchRoute' | 'staticPageData' | 'staticPageDataFastPath'>;

function pageComponent(component: unknown) {
  if (typeof component !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  return component;
}

export async function startHonoPages(manifest: Manifest) {
  const root = document.getElementById('app');
  if (!root) throw new Error('Hono Pages: app root is missing.');
  type Frame = { page: Awaited<ReturnType<typeof createVoidRouter>>['initialPageData']; component: unknown; layouts: unknown[]; revision: number };
  let update: ((frame: Frame) => void) | undefined;
  let revision = 0;
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
        layouts.forEach(pageComponent);
        pageComponent(component);
        if (!update) throw new Error('Hono Pages: page rendering has not started.');
        if (!options.preserveState) revision++;
        renderedProps = page.props;
        update({ page: { ...page, props: { ...page.props } }, component, layouts, revision });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        applyDocumentHead?.(page.head);
      },
    },
    viewTransitions: false,
    prefetchHoverDelay: 75,
    prefetchDefaultCacheFor: parseCacheFor('30s'),
    cacheVisitedPageData: false,
    onNavigationChange(state) { root.dataset.navigation = state.state; },
  });
  const releaseBuffer = bufferInitialDeferred();
  const navigation = await initialization.finally(releaseBuffer);
  renderedProps = navigation.initialPageData.props;
  applyDocumentHead = createDocumentHead(navigation.initialPageData.head);

  function App() {
    const [frame, setFrame] = useState<Frame>({ page: { ...navigation.initialPageData, props: { ...navigation.initialPageData.props } }, component: navigation.initialComponent, layouts: navigation.initialLayouts, revision });
    const [failed, setFailed] = useState(false);
    useLayoutEffect(() => {
      updateDeferred = (props) => setFrame((frame) => ({ ...frame, page: { ...frame.page, props } }));
      update = (next) => { setFailed(false); setFrame(next); };
      const onError = () => setFailed(true);
      window.addEventListener('hono-pages:navigation-error', onError);
      return () => { update = undefined; updateDeferred = undefined; window.removeEventListener('hono-pages:navigation-error', onError); };
    }, []);
    let content = jsx(pageComponent(frame.component), frame.page.props, String(frame.revision));
    const ids = manifest.layoutTree[frame.page.component] ?? [];
    for (let index = frame.layouts.length - 1; index >= 0; index--) {
      content = jsx(pageComponent(frame.layouts[index]), { children: content }, ids[index]);
    }
    return <RouterContext.Provider value={navigation.router}>
      <PageContext.Provider value={frame.page}>
        {failed && <p role="alert">The page could not be loaded. Please try again.</p>}
        {content}
      </PageContext.Provider>
    </RouterContext.Provider>;
  }

  render(<App />, root);
  navigation.start();
  navigation.commitInitialRender();
  root.dataset.navigation = 'idle';
  root.dataset.honoPages = 'mounted';
}
