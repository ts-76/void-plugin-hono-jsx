import { useContext, useEffect, useRef, useState } from 'hono/jsx';
import {
  cloneFormValue,
  isAbortError,
  isEqualFormValue,
  interpolateRouteParams,
  parseFormResetArgs,
  submitAction,
  VoidActionError,
  type ActionResult,
  type FormMethod,
  type FormResetOptions,
} from 'void/pages-client';
import type { ActionFormOptions, ActionUrl, ResolveActionBody } from 'void/routes';
import { RouterContext, useErrors, useRouter, action } from './api.tsx';
export { Form, type FormProps } from './form-view.tsx';
export { action };

type Fields = Record<string, unknown>;
type Body<U extends string> = ResolveActionBody<U> extends Fields ? ResolveActionBody<U> : Fields;
type SetData<T> = {
  (next: T | ((current: T) => T)): void;
  <K extends keyof T & string>(field: K, value: T[K]): void;
};
export type HonoForm<T extends Fields> = {
  data: T;
  setData: SetData<T>;
  errors: Record<string, string>;
  pending: boolean;
  error: VoidActionError | null;
  hasChanges: boolean;
  wasSuccessful: boolean;
  recentlySuccessful: boolean;
  submit(method: FormMethod, target?: string | FormData, body?: FormData): Promise<void>;
  cancel(): void;
  reset: { (): void; (...fields: Array<(keyof T & string) | FormResetOptions>): void };
  clearErrors(...fields: Array<keyof T & string>): void;
  clearError(): void;
} & Record<FormMethod, (target?: string | FormData, body?: FormData) => Promise<void>>;

function toFormError(failure: unknown, url: string): VoidActionError {
  if (failure instanceof VoidActionError) return failure;
  const message = failure instanceof Error ? failure.message : String(failure);
  const error = new VoidActionError({
    body: { message },
    status: 0,
    statusText: 'Network Error',
    url,
  });
  error.message = message;
  return error;
}

function fieldErrors(error: VoidActionError): Record<string, string> {
  const body = error.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('errors' in body) ||
    typeof body.errors !== 'object' ||
    body.errors === null
  )
    return {};
  return Object.fromEntries(
    Object.entries(body.errors).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

type FormOptions = { params?: Record<string, string>; resetOnSuccess?: boolean };
export function useForm<T extends Fields>(initialData: T): HonoForm<T>;
export function useForm<T extends Fields>(
  url: [ActionUrl] extends [never] ? string : never,
  defaults: T,
  options?: FormOptions,
): HonoForm<T>;
export function useForm<U extends ActionUrl & string>(
  url: U,
  defaults: Body<U>,
  options?: ActionFormOptions<U>,
): HonoForm<Body<U>>;
export function useForm(
  initial: string | Fields,
  values?: Fields,
  options?: FormOptions,
): HonoForm<Fields> {
  if (!useContext(RouterContext))
    throw new Error(
      'Hono Pages: useForm requires the full Pages renderer; use useIslandForm for islands.',
    );
  const router = useRouter();
  const bound = typeof initial === 'string' ? initial : undefined;
  return useFormModel(
    typeof initial === 'string' ? (values ?? {}) : initial,
    useErrors(),
    async (method, url, data) =>
      submitAction(router, interpolateRouteParams(url, options?.params), {
        method: method.toUpperCase(),
        data,
        preserveScroll: true,
      }),
    () => router.refresh(),
    bound,
    options?.resetOnSuccess,
  );
}

export function useIslandForm<T extends Fields>(defaults: T): HonoForm<T> {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return useFormModel(
    defaults,
    {},
    async (method, url, data) => {
      const target = new URL(url, window.location.href);
      if (
        target.origin !== window.location.origin ||
        !['http:', 'https:'].includes(target.protocol)
      )
        throw new Error('Hono island form: actions must target the current origin.');
      controller.current = new AbortController();
      const multipart = data instanceof FormData;
      const response = await fetch(target, {
        method: method.toUpperCase(),
        headers: multipart ? undefined : { 'Content-Type': 'application/json' },
        body: multipart ? data : JSON.stringify(data),
        signal: controller.current.signal,
      });
      if (response.redirected && response.ok) {
        window.location.assign(response.url);
        return { ok: true, pageData: undefined };
      }
      if (response.ok) {
        window.location.reload();
        return { ok: true, pageData: undefined };
      }
      let body: unknown;
      try {
        body = response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : await response.text();
      } catch {
        body = null;
      }
      return {
        ok: false,
        error: new VoidActionError({
          body,
          status: response.status,
          statusText: response.statusText,
          url: target.href,
        }),
      };
    },
    () => controller.current?.abort(),
  );
}

type FormTransport = (
  method: FormMethod,
  url: string,
  data: Fields | FormData,
) => Promise<ActionResult>;
function useFormModel<T extends Fields>(
  initial: T,
  initialErrors: Record<string, string>,
  send: FormTransport,
  abort: () => void | Promise<unknown>,
  bound?: string,
  resetOnSuccess = false,
): HonoForm<T> {
  const initialValues = useRef<T | null>(null);
  const initialSnapshot = (initialValues.current ??= cloneFormValue(initial));
  const defaults = useRef(initialSnapshot);
  const [data, updateData] = useState(() => cloneFormValue(initialSnapshot));
  const current = useRef(data);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [wasSuccessful, setSuccessful] = useState(false);
  const [recentlySuccessful, setRecent] = useState(false);
  const [error, setError] = useState<VoidActionError | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      ++generation.current;
      active.current = false;
      clearTimeout(timer.current);
    },
    [],
  );

  const setData: SetData<T> = (next: T | ((current: T) => T) | string, value?: unknown) => {
    const previous = current.current;
    current.current =
      typeof next === 'string'
        ? ({ ...current.current, [next]: value } as T)
        : typeof next === 'function'
          ? next(current.current)
          : { ...next };
    const edited = current.current;
    updateData(edited);
    setSuccessful(false);
    setErrors((messages) =>
      Object.fromEntries(
        Object.entries(messages).filter(([key]) => isEqualFormValue(previous[key], edited[key])),
      ),
    );
    setError(null);
    setRecent(false);
    clearTimeout(timer.current);
  };
  async function submit(method: FormMethod, target?: string | FormData, body?: FormData) {
    if (target instanceof FormData && body) throw new Error('Hono Form: supply FormData once.');
    const multipart = target instanceof FormData ? target : body;
    const url = typeof target === 'string' ? target : bound;
    if (!url) throw new Error('Hono Form: supply an action URL to useForm or submit.');
    if (active.current) return;
    active.current = true;
    const id = ++generation.current;
    setPending(true);
    setSuccessful(false);
    setRecent(false);
    clearTimeout(timer.current);
    setError(null);
    setErrors({});
    const submitted = cloneFormValue(current.current);
    const payload = multipart ? new FormData() : submitted;
    if (multipart) for (const [name, value] of multipart) (payload as FormData).append(name, value);
    try {
      const result = await send(method, url, payload);
      if (id !== generation.current) return;
      if (result.ok) {
        if (bound && !multipart) {
          defaults.current = resetOnSuccess ? initialSnapshot : submitted;
          if (resetOnSuccess && isEqualFormValue(current.current, submitted)) {
            current.current = cloneFormValue(defaults.current);
            updateData(current.current);
          }
        }
        setSuccessful(true);
        setRecent(true);
        timer.current = setTimeout(() => {
          if (id === generation.current) setRecent(false);
        }, 2000);
      } else {
        setError(result.error);
        setErrors(fieldErrors(result.error));
      }
    } catch (failure) {
      if (id === generation.current && !isAbortError(failure)) setError(toFormError(failure, url));
    } finally {
      if (id === generation.current) {
        active.current = false;
        setPending(false);
      }
    }
  }
  function cancel() {
    if (!active.current) return;
    const id = ++generation.current;
    active.current = false;
    setPending(false);
    setSuccessful(false);
    setRecent(false);
    clearTimeout(timer.current);
    void Promise.resolve(abort()).catch((failure: unknown) => {
      if (id === generation.current) setError(toFormError(failure, bound ?? 'island'));
    });
  }
  return {
    data,
    setData,
    errors,
    pending,
    wasSuccessful,
    recentlySuccessful,
    error,
    submit,
    cancel,
    hasChanges: Object.keys({ ...defaults.current, ...data }).some(
      (key) => !isEqualFormValue(defaults.current[key], data[key]),
    ),
    reset(...args: Array<string | FormResetOptions | MouseEvent>) {
      const { initial: toInitial, fields } = parseFormResetArgs(
        args.filter(
          (arg): arg is string | FormResetOptions =>
            typeof arg === 'string' || !(arg instanceof Event),
        ),
      );
      const source = toInitial ? initialSnapshot : defaults.current;
      setData(
        fields.length
          ? ({
              ...current.current,
              ...Object.fromEntries(fields.map((key) => [key, cloneFormValue(source[key])])),
            } as T)
          : cloneFormValue(source),
      );
    },
    clearErrors(...fields) {
      setErrors((previous) =>
        fields.length
          ? Object.fromEntries(
              Object.entries(previous).filter(([field]) => !fields.includes(field)),
            )
          : {},
      );
    },
    clearError() {
      setError(null);
    },
    post: (target, body) => submit('post', target, body),
    put: (target, body) => submit('put', target, body),
    patch: (target, body) => submit('patch', target, body),
    delete: (target, body) => submit('delete', target, body),
  };
}
