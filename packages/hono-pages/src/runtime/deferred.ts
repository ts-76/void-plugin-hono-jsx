import type { DeferredState } from 'void';

/** Null from an upstream completed prefetch remains null, not a repaired error. */
export type DeferredResult<T> = { value: T | null; error: null } | { value: null; error: Error };
type Resource = {
  result?: DeferredResult<unknown>;
  promise?: Promise<DeferredResult<unknown>>;
  serverPromise?: Promise<DeferredResult<unknown>>;
  resolve?: (result: DeferredResult<unknown>) => void;
};
const resources = new WeakMap<object, Resource>();
function resourceFor(ref: unknown): Resource {
  if (typeof ref !== 'object' || ref === null) throw new Error('Hono Pages: deferredResult requires a Deferred state.');
  let resource = resources.get(ref);
  if (!resource) resources.set(ref, resource = {});
  return resource;
}

/** A stable, render-only Promise; Void still owns all execution and delivery. */
export function deferredResult<T>(state: DeferredState<T>): Promise<DeferredResult<T>> {
  const resource = resourceFor(state);
  // SSR emits only the initial Suspense fallback. Do not subscribe a Hono SSR
  // HTML callback to client-owned completion or wait for it on the server.
  if (typeof window === 'undefined') return (resource.serverPromise ??= new Promise(() => {})) as Promise<DeferredResult<T>>;
  if (!state.loading && !resource.result) resource.result = state.error ? { value: null, error: state.error } : { value: state.value, error: null };
  resource.promise ??= resource.result ? Promise.resolve(resource.result) : new Promise(resolve => { resource.resolve = resolve; });
  return resource.promise as Promise<DeferredResult<T>>;
}
function complete(ref: unknown, next: DeferredState<unknown>) {
  const resource = resourceFor(ref);
  resource.result ??= next.error ? { value: null, error: next.error } : { value: next.value, error: null };
  resource.resolve?.(resource.result);
  resource.resolve = undefined;
  // Void replaces its state object on completion. Both objects refer to the
  // same lazy Promise, including completion before component import/use().
  resources.set(next, resource);
  return next;
}
export function createDeferred(): DeferredState<never> {
  return { loading: true, value: null, error: null };
}
export function resolveDeferred(ref: unknown, value: unknown): DeferredState<unknown> {
  return complete(ref, { loading: false, value, error: null });
}
export function rejectDeferred(ref: unknown, message: string): DeferredState<never> {
  return complete(ref, { loading: false, value: null, error: new Error(message) }) as DeferredState<never>;
}
export function isLoading(ref: unknown): boolean {
  return typeof ref === 'object' && ref !== null && 'loading' in ref && ref.loading === true;
}

// Void installs its HTML callbacks before awaiting component imports. Keep early
// messages in its existing queue until the initial deferred registry is ready.
declare global {
  interface Window {
    __resolveDeferred?: (group: string, data: unknown) => void;
    __rejectDeferred?: (group: string, error: string) => void;
    __deferredQueue?: Array<[string, unknown] | [string, 0, string]>;
  }
}
export function bufferInitialDeferred() {
  const resolve = window.__resolveDeferred;
  const reject = window.__rejectDeferred;
  window.__resolveDeferred = (group, data) => (window.__deferredQueue ??= []).push([group, data]);
  window.__rejectDeferred = (group, error) => (window.__deferredQueue ??= []).push([group, 0, error]);
  return () => {
    window.__resolveDeferred = resolve;
    window.__rejectDeferred = reject;
  };
}
