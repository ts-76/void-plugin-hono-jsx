import { useRef, useState } from 'hono/jsx';
import { isAbortError, submitAction, VoidActionError, type FormMethod } from 'void/pages-client';
import { useErrors, useRouter } from './pages.tsx';

function fieldErrors(error: VoidActionError): Record<string, string> {
  const body = error.body;
  if (typeof body !== 'object' || body === null || !('errors' in body) || typeof body.errors !== 'object' || body.errors === null) return {};
  return Object.fromEntries(Object.entries(body.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function useForm<T extends Record<string, unknown>>(initialData: T) {
  const router = useRouter();
  const initialErrors = useErrors();
  const [data, updateData] = useState(initialData);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [wasSuccessful, setSuccessful] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const active = useRef(false);
  const generation = useRef(0);

  const setData: typeof updateData = (next) => {
    updateData(next);
    setSuccessful(false);
    setErrors({});
    setError(null);
  };

  async function submit(method: FormMethod, url: string) {
    if (active.current) return;
    active.current = true;
    const id = ++generation.current;
    setPending(true);
    setSuccessful(false);
    setError(null);
    setErrors({});
    try {
      const result = await submitAction(router, url, { method: method.toUpperCase(), data, preserveScroll: true });
      if (id !== generation.current) return;
      if (result.ok) setSuccessful(true);
      else { setError(result.error); setErrors(fieldErrors(result.error)); }
    } catch (failure) {
      if (id === generation.current && !isAbortError(failure)) {
        setError(failure instanceof Error ? failure : new Error(String(failure)));
      }
    } finally {
      if (id === generation.current) { active.current = false; setPending(false); }
    }
  }

  function cancel() {
    if (!active.current) return;
    const id = ++generation.current;
    active.current = false;
    setPending(false);
    setSuccessful(false);
    void router.refresh().catch((failure: unknown) => {
      if (id === generation.current) setError(failure instanceof Error ? failure : new Error(String(failure)));
    });
  }

  return {
    data, setData, errors, pending, wasSuccessful, error, submit, cancel,
    reset() { setData(initialData); },
    post: (url: string) => submit('post', url),
    put: (url: string) => submit('put', url),
    patch: (url: string) => submit('patch', url),
    delete: (url: string) => submit('delete', url),
  };
}
