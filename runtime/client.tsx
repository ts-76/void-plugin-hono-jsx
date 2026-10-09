import { render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { useLayoutEffect, useState } from 'hono/jsx';
import { createVoidRouter, type VoidRouterConfig } from 'void/pages-client';
import { parseCacheFor } from 'void/pages-prefetch';
import { RouterContext } from './pages';

type Manifest = Pick<VoidRouterConfig, 'components' | 'layoutTree' | 'routeMeta' | 'matchRoute'>;

function pageComponent(component: unknown) {
  if (typeof component !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  return component;
}

export async function startHonoPages(manifest: Manifest) {
  const root = document.getElementById('app');
  if (!root) throw new Error('Hono Pages: app root is missing.');
  type Frame = { page: Awaited<ReturnType<typeof createVoidRouter>>['initialPageData']; component: unknown; revision: number };
  let update: ((frame: Frame) => void) | undefined;
  let revision = 0;
  const unsupportedDeferred = () => { throw new Error('Hono Pages: deferred props are not supported yet (issue #9).'); };
  const navigation = await createVoidRouter({
    ...manifest,
    adapter: {
      createDeferred: unsupportedDeferred,
      resolveDeferred: unsupportedDeferred,
      rejectDeferred: unsupportedDeferred,
      isLoading: unsupportedDeferred,
      async applyUpdate(page, component, layouts, options) {
        if (layouts.length) throw new Error('Hono Pages: layouts are not supported yet (issue #4).');
        pageComponent(component);
        if (!update) throw new Error('Hono Pages: page rendering has not started.');
        if (!options.preserveState) revision++;
        update({ page, component, revision });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      },
    },
    viewTransitions: false,
    prefetchHoverDelay: 75,
    prefetchDefaultCacheFor: parseCacheFor('30s'),
    cacheVisitedPageData: false,
    onNavigationChange(state) { root.dataset.navigation = state.state; },
  });

  function App() {
    const [frame, setFrame] = useState<Frame>({ page: navigation.initialPageData, component: navigation.initialComponent, revision });
    const [failed, setFailed] = useState(false);
    useLayoutEffect(() => {
      update = (next) => { setFailed(false); setFrame(next); };
      const onError = () => setFailed(true);
      window.addEventListener('hono-pages:navigation-error', onError);
      return () => { update = undefined; window.removeEventListener('hono-pages:navigation-error', onError); };
    }, []);
    return <RouterContext.Provider value={navigation.router}>
      {failed && <p role="alert">The page could not be loaded. Please try again.</p>}
      {jsx(pageComponent(frame.component), frame.page.props, String(frame.revision))}
    </RouterContext.Provider>;
  }

  render(<App />, root);
  navigation.start();
  navigation.commitInitialRender();
  root.dataset.navigation = 'idle';
  root.dataset.honoPages = 'mounted';
}
