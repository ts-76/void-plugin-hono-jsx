import { useEffect, useState, type JSX, type Child } from 'hono/jsx';
import { formErrorMessage, formRetryMessage, formSubmissionBlocked, scheduleFormRetry, type FormMethod, type FormModel, type VoidActionError } from 'void/pages-client';

export type FormProps = Omit<JSX.IntrinsicElements['form'], 'action' | 'method' | 'onSubmit' | 'onError'> & {
  form: FormModel<[string | FormData | undefined]>;
  method?: FormMethod;
  url?: string;
  renderError?: (error: VoidActionError) => Child;
};
export function Form({ form, method = 'post', url, renderError, children, ...props }: FormProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => scheduleFormRetry(form.error, () => setNow(Date.now())), [form.error]);
  const message = formErrorMessage(form);
  const retry = formRetryMessage(form.error);
  const blocked = formSubmissionBlocked(form, now);
  return <form {...props} aria-busy={form.pending} onSubmit={(event: Event) => {
    event.preventDefault();
    if (!blocked) void form[method](url ?? new FormData(event.currentTarget as HTMLFormElement));
  }}>
    {message && <div role="alert" data-void-form-error>{form.error && renderError ? renderError(form.error) : message}{retry && <p>{retry}</p>}</div>}
    {children}
  </form>;
}
