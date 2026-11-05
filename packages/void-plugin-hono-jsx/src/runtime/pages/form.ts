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
type Body<U extends string> = [ResolveActionBody<U>] extends [never]
  ? Fields
  : ResolveActionBody<U> extends Fields
    ? ResolveActionBody<U>
    : Fields;
type FormFields<U extends string, T extends Fields> = string extends keyof Body<U> ? T : Body<U>;
type SetData<T> = {
  (next: T | ((current: T) => T)): void;
  <K extends keyof T & string>(field: K, value: T[K]): void;
};
export type FormSubmitOptions<T extends Fields> = { data?: T | FormData };

export type HonoForm<T extends Fields> = {
  data: T;
  setData: SetData<T>;
  errors: Record<string, string>;
  pending: boolean;
  error: VoidActionError | null;
  hasChanges: boolean;
  wasSuccessful: boolean;
  recentlySuccessful: boolean;
  submit(method: FormMethod, options?: FormSubmitOptions<T>): Promise<void>;
  cancel(): void;
  reset: { (): void; (...fields: Array<(keyof T & string) | FormResetOptions>): void };
  clearErrors(...fields: Array<keyof T & string>): void;
  clearError(): void;
} & Record<FormMethod, (options?: FormSubmitOptions<T>) => Promise<void>>;

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
export function useForm<T extends Fields>(
  url: [ActionUrl] extends [never] ? string : never,
  defaults: T,
  options?: FormOptions,
): HonoForm<T>;
export function useForm<U extends ActionUrl & string, T extends Body<U>>(
  url: U,
  defaults: T,
  ...options: ActionFormOptions<U> extends { params: unknown }
    ? [options: ActionFormOptions<U>]
    : [options?: ActionFormOptions<U>]
): HonoForm<FormFields<U, T>>;
export function useForm(url: string, defaults: Fields, options?: FormOptions): HonoForm<Fields> {
  if (!useContext(RouterContext))
    throw new Error(
      'Hono Pages: useForm requires the full Pages renderer; use useIslandForm for islands.',
    );
  const router = useRouter();
  return useFormModel(
    url,
    defaults,
    useErrors(),
    async (method, url, data) =>
      submitAction(router, interpolateRouteParams(url, options?.params), {
        method: method.toUpperCase(),
        data,
        preserveScroll: true,
      }),
    () => router.refresh(),
    options?.resetOnSuccess,
  );
}

export function useIslandForm<T extends Fields>(
  url: string,
  defaults: T,
  options?: FormOptions,
): HonoForm<T> {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return useFormModel(
    url,
    defaults,
    {},
    async (method, url, data) => {
      const target = new URL(interpolateRouteParams(url, options?.params), window.location.href);
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
    options?.resetOnSuccess,
  );
}

type FormTransport = (
  method: FormMethod,
  url: string,
  data: Fields | FormData,
) => Promise<ActionResult>;
function useFormModel<T extends Fields>(
  url: string,
  initial: T,
  initialErrors: Record<string, string>,
  send: FormTransport,
  abort: () => void | Promise<unknown>,
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
  async function submit(method: FormMethod, options: FormSubmitOptions<T> = {}) {
    if (active.current) return;
    active.current = true;
    const id = ++generation.current;
    setPending(true);
    setSuccessful(false);
    setRecent(false);
    clearTimeout(timer.current);
    setError(null);
    setErrors({});
    const modelAtSubmit = current.current;
    const data = options.data ?? modelAtSubmit;
    const payload = data instanceof FormData ? new FormData() : cloneFormValue(data);
    if (data instanceof FormData) {
      for (const [name, value] of data) (payload as FormData).append(name, value);
    }
    try {
      const result = await send(method, url, payload);
      if (id !== generation.current) return;
      if (result.ok) {
        if (!(payload instanceof FormData) && isEqualFormValue(payload, modelAtSubmit)) {
          defaults.current = resetOnSuccess ? initialSnapshot : payload;
          if (resetOnSuccess && isEqualFormValue(current.current, payload)) {
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
      if (id === generation.current) setError(toFormError(failure, url));
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
    post: (options) => submit('post', options),
    put: (options) => submit('put', options),
    patch: (options) => submit('patch', options),
    delete: (options) => submit('delete', options),
  };
}
