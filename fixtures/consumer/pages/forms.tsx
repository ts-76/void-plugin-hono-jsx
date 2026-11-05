import { Form, action, useForm } from 'void-plugin-hono-jsx';
export default function Forms({ saved, submissions }: { saved: string; submissions: number }) {
  const defaults: { name: string; note: string; probe?: 'slow' | 'fail' | 'quota' } = {
    name: 'Original',
    note: 'Default',
  };
  const form = useForm('/forms?save', defaults);
  const redirect = useForm('/forms?redirect', {});
  return (
    <main>
      <h1>Forms</h1>
      <output id="form-saved">{saved}</output>
      <output id="form-submissions">{submissions}</output>
      <output id="form-state">
        {String(form.pending)}:{String(form.hasChanges)}:{String(form.wasSuccessful)}:
        {String(form.recentlySuccessful)}
      </output>
      <Form
        form={form}
        id="bound-form"
        renderError={(error) => <span id="custom-form-error">{error.message}</span>}
      >
        <input
          id="form-name"
          value={String(form.data.name)}
          onInput={(event: Event) =>
            form.setData('name', (event.currentTarget as HTMLInputElement).value)
          }
        />
        <output id="field-error">{form.errors.name ?? ''}</output>
        <input
          id="form-note"
          value={String(form.data.note)}
          onInput={(event: Event) =>
            form.setData('note', (event.currentTarget as HTMLInputElement).value)
          }
        />
        <output id="note-error">{form.errors.note ?? ''}</output>
        <button id="form-save" type="submit" disabled={form.pending}>
          Save
        </button>
      </Form>
      <button id="clear-field" onClick={() => form.clearErrors('name')}>
        Clear field
      </button>
      <button id="clear-error" onClick={form.clearError}>
        Clear action error
      </button>
      <button id="form-reset" onClick={form.reset}>
        Reset
      </button>
      <button
        id="form-fail"
        onClick={() => void form.post({ data: { ...form.data, probe: 'fail' } })}
      >
        Failure
      </button>
      <button
        id="form-slow"
        onClick={() => void form.post({ data: { ...form.data, probe: 'slow' } })}
      >
        Slow
      </button>
      <button id="form-cancel" onClick={form.cancel}>
        Cancel
      </button>
      {(['put', 'patch', 'delete'] as const).map((method) => (
        <button id={'form-' + method} onClick={() => void form[method]()}>
          {method}
        </button>
      ))}
      <button
        id="one-shot"
        onClick={() => void action('/forms?save', { data: { name: 'One shot' } })}
      >
        One shot
      </button>
      <button
        id="form-quota"
        onClick={() => void form.post({ data: { ...form.data, probe: 'quota' } })}
      >
        Quota
      </button>
      <button id="form-redirect" onClick={() => void redirect.post()}>
        Redirect
      </button>
    </main>
  );
}
