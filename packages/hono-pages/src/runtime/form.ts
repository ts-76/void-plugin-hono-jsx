import { useContext, useEffect, useRef, useState } from 'hono/jsx';
import { isAbortError, isEqualFormValue, interpolateRouteParams, submitAction, VoidActionError, type FormMethod } from 'void/pages-client';
import type { ActionFormOptions, ActionUrl, ResolveActionBody } from 'void/routes';
import { RouterContext, useErrors, useRouter, action } from './pages.tsx';
export { Form, type FormProps } from './form-view.tsx';
export { action };

type Fields = Record<string, unknown>;
type Body<U extends string> = ResolveActionBody<U> extends Fields ? ResolveActionBody<U> : Fields;
type SetData<T> = { (next: T | ((current: T) => T)): void; <K extends keyof T & string>(field: K, value: T[K]): void };
export type HonoForm<T extends Fields> = {
  data: T; setData: SetData<T>; errors: Record<string, string>; pending: boolean;
  error: VoidActionError | null; hasChanges: boolean; wasSuccessful: boolean; recentlySuccessful: boolean;
  submit(method: FormMethod, target?: string | FormData): Promise<void>; cancel(): void;
  reset: { (): void; (...fields: Array<keyof T & string>): void }; clearErrors(...fields: Array<keyof T & string>): void; clearError(): void;
} & Record<FormMethod, (target?: string | FormData) => Promise<void>>;

function fieldErrors(error: VoidActionError): Record<string, string> {
  const body = error.body;
  if (typeof body !== 'object' || body === null || !('errors' in body) || typeof body.errors !== 'object' || body.errors === null) return {};
  return Object.fromEntries(Object.entries(body.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function useForm<T extends Fields>(initialData: T): HonoForm<T>;
export function useForm<U extends ActionUrl & string>(url: U, defaults: Body<U>, options?: ActionFormOptions<U>): HonoForm<Body<U>>;
export function useForm(initial: string | Fields, values?: Fields, options?: { params?: Record<string, string> }): HonoForm<Fields> {
  if (!useContext(RouterContext)) throw new Error('Hono Pages: useForm requires the full Pages renderer; use useIslandForm for islands.');
  const router = useRouter();
  const bound = typeof initial === 'string' ? initial : undefined;
  const defaults = useRef({ ...(typeof initial === 'string' ? values ?? {} : initial) });
  const current = useRef({ ...defaults.current });
  const [data, updateData] = useState(current.current);
  const [errors, setErrors] = useState(useErrors());
  const [pending, setPending] = useState(false);
  const [wasSuccessful, setSuccessful] = useState(false);
  const [recentlySuccessful, setRecent] = useState(false);
  const [error, setError] = useState<VoidActionError | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { ++generation.current; active.current = false; clearTimeout(timer.current); }, []);

  const setData: SetData<Fields> = (next: Fields | ((current: Fields) => Fields) | string, value?: unknown) => {
    current.current = typeof next === 'string' ? { ...current.current, [next]: value } : typeof next === 'function' ? next(current.current) : { ...next };
    updateData(current.current); setSuccessful(false); setErrors({}); setError(null); setRecent(false); clearTimeout(timer.current);
  };
  async function submit(method: FormMethod, target?: string | FormData) {
    const url = typeof target === 'string' ? target : bound;
    if (!url) throw new Error('Hono Form: supply an action URL to useForm or submit.');
    if (active.current) return;
    active.current = true; const id = ++generation.current;
    setPending(true); setSuccessful(false); setRecent(false); clearTimeout(timer.current); setError(null); setErrors({});
    const submitted = { ...current.current };
    try {
      const result = await submitAction(router, interpolateRouteParams(url, options?.params), { method: method.toUpperCase(), data: submitted, preserveScroll: true });
      if (id !== generation.current) return;
      if (result.ok) {
        if (bound) defaults.current = submitted;
        setSuccessful(true); setRecent(true);
        timer.current = setTimeout(() => { if (id === generation.current) setRecent(false); }, 2000);
      } else { setError(result.error); setErrors(fieldErrors(result.error)); }
    } catch (failure) {
      if (id === generation.current && !isAbortError(failure)) setError(failure instanceof VoidActionError ? failure : new VoidActionError({ body: { message: failure instanceof Error ? failure.message : String(failure) }, status: 0, statusText: 'Network Error', url }));
    } finally {
      if (id === generation.current) { active.current = false; setPending(false); }
    }
  }
  function cancel() {
    if (!active.current) return;
    const id = ++generation.current; active.current = false; setPending(false); setSuccessful(false); setRecent(false); clearTimeout(timer.current);
    void router.refresh().catch((failure: unknown) => {
      if (id === generation.current) setError(failure instanceof VoidActionError ? failure : new VoidActionError({ body: { message: String(failure) }, status: 0, statusText: 'Network Error', url: router.path }));
    });
  }
  return {
    data, setData, errors, pending, wasSuccessful, recentlySuccessful, error, submit, cancel,
    hasChanges: Object.keys({ ...defaults.current, ...data }).some((key) => !isEqualFormValue(defaults.current[key], data[key])),
    reset(...fields: Array<string | MouseEvent>) { const keys = fields.filter((field): field is string => typeof field === 'string'); setData(keys.length ? { ...current.current, ...Object.fromEntries(keys.map((key) => [key, defaults.current[key]])) } : { ...defaults.current }); },
    clearErrors(...fields) { setErrors((previous) => fields.length ? Object.fromEntries(Object.entries(previous).filter(([field]) => !fields.includes(field))) : {}); },
    clearError() { setError(null); },
    post: (target) => submit('post', target), put: (target) => submit('put', target), patch: (target) => submit('patch', target), delete: (target) => submit('delete', target),
  };
}
