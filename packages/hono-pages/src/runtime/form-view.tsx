import { useEffect, useState, type JSX, type Child } from 'hono/jsx';
import { formErrorMessage, formRetryMessage, formSubmissionBlocked, scheduleFormRetry, type FormMethod, type FormModel, type VoidActionError } from 'void/pages-client';

export type FormProps = Omit<JSX.IntrinsicElements['form'], 'action' | 'method' | 'onSubmit' | 'onError' | 'encType'> & {
  form: FormModel<[target?: string | FormData, body?: FormData]>;
  method?: FormMethod;
  encType?: 'application/json' | 'multipart/form-data';
  url?: string;
  renderError?: (error: VoidActionError) => Child;
};
export function Form({ form, method = 'post', url, encType = 'application/json', renderError, children, ...props }: FormProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => scheduleFormRetry(form.error, () => setNow(Date.now())), [form.error]);
  const message = formErrorMessage(form);
  const retry = formRetryMessage(form.error);
  const blocked = formSubmissionBlocked(form, now);
  return <form {...props} encType={encType} aria-busy={form.pending} onSubmit={(event: Event) => {
    event.preventDefault();
    if (!blocked) {
      const data = encType === 'multipart/form-data' ? new FormData(event.currentTarget as HTMLFormElement, (event as SubmitEvent).submitter) : undefined;
      void form[method](url ?? data, url ? data : undefined);
    }
  }}>
    {message && <div role="alert" data-void-form-error>{form.error && renderError ? renderError(form.error) : message}{retry && <p>{retry}</p>}</div>}
    {children}
  </form>;
}
