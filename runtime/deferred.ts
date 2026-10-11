import type { DeferredState } from 'void';

export function createDeferred(): DeferredState<never> {
  return { loading: true, value: null, error: null };
}
export function resolveDeferred(_ref: unknown, value: unknown): DeferredState<unknown> {
  return { loading: false, value, error: null };
}
export function rejectDeferred(_ref: unknown, message: string): DeferredState<never> {
  return { loading: false, value: null, error: new Error(message) };
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
