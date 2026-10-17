import { ErrorBoundary, Suspense, use, useState } from 'hono/jsx';
import { deferredResult, type Deferred, type DeferredResult } from 'void-plugin-hono-jsx/pages';
declare global { interface Window { deferredPromises: Record<string, Promise<DeferredResult<string>>> } }
function Result({ id, result }: { id: string; result: DeferredResult<string> }) {
  if (result.error) throw result.error;
  return <output id={id}>{result.value}</output>;
}
function Value({ id, state }: { id: string; state: Deferred<string> }) {
  const promise = deferredResult(state);
  if (typeof window !== 'undefined') (window.deferredPromises ??= {})[id] = promise;
  const [failed, setFailed] = useState<{ result: DeferredResult<string>; error: Error } | null>(null);
  const result = use(promise);
  if (failed?.result === result) return <output id={id} role="alert">{failed.error.message}</output>;
  // Mount the error boundary after use() has a result: Hono 4's nested pending
  // ErrorBoundary/Suspense can leave stale fallback nodes during an error retry.
  return <ErrorBoundary onError={error => queueMicrotask(() => setFailed({ result, error }))} fallbackRender={error => <output id={id} role="alert">{error.message}</output>}>
    <Result id={id} result={result} />
  </ErrorBoundary>;
}
export default function DeferredPromise({ id, state }: { id: string; state: Deferred<string> }) {
  return <Suspense fallback={<output id={id}>promise pending</output>}><Value id={id} state={state} /></Suspense>;
}
