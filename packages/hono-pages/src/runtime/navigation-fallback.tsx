import { useEffect, useState, type FC } from 'hono/jsx';
import { ErrorBoundary } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import type { NavigationState } from 'void/pages-client';
import type { NavigationFallbackProps } from './pages.tsx';

export type NavigationFallbackOptions = { component: FC<NavigationFallbackProps>; delay: number };

/** Presentation only: it neither replaces the page nor acknowledges its commit. */
export function NavigationFallback({ state, options }: { state: NavigationState; options: NavigationFallbackOptions }) {
  const [visibleFor, setVisibleFor] = useState<NavigationState | null>(null);
  const [failedFor, setFailedFor] = useState<NavigationState | null>(null);
  const loading = state.state === 'loading' && state.method === 'GET';
  useEffect(() => {
    setVisibleFor(null);
    if (!loading) return;
    const timer = setTimeout(() => setVisibleFor(state), options.delay);
    return () => clearTimeout(timer);
  }, [state]);
  // Identity hides the old fallback immediately, before effect cleanup, on every
  // new navigation/idle state. A queued old timer cannot affect another visit.
  if (!loading || visibleFor !== state || failedFor === state) return null;
  return <ErrorBoundary fallback={<></>} onError={error => queueMicrotask(() => {
    // Hono retries a failed child on parent updates. Remove this presentation
    // subtree before reporting the error; a later navigation may try again.
    setFailedFor(state);
    window.dispatchEvent(new CustomEvent('hono-pages:navigation-error', { detail: error }));
  })}>
    <div data-hono-navigation-fallback role="status" aria-live="polite">{jsx(options.component, { navigation: state })}</div>
  </ErrorBoundary>;
}
