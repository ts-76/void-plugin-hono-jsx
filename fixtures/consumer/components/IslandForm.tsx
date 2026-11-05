import { Form, useIslandForm } from 'void-plugin-hono-jsx';
export default function Island({ saved, submissions }: { saved: string; submissions: number }) {
  const form = useIslandForm('/island-forms?save', { name: saved } as {
    name: string;
    probe?: 'slow' | 'fail';
  });
  const foreign = useIslandForm('https://example.test/write', { name: saved });
  const redirect = useIslandForm('/island-forms?redirect', {});
  return (
    <section>
      <output id="island-saved">{saved}</output>
      <output id="island-submissions">{submissions}</output>
      <output id="island-form-state">
        {String(form.pending)}:{String(form.hasChanges)}:{String(form.wasSuccessful)}
      </output>
      <output id="island-field-error">{form.errors.name ?? ''}</output>
      <output id="island-form-error">{foreign.error?.message ?? form.error?.message ?? ''}</output>
      <Form form={form}>
        <input
          id="island-name"
          value={form.data.name}
          onInput={(event: Event) =>
            form.setData('name', (event.currentTarget as HTMLInputElement).value)
          }
        />
        <button id="island-save" type="submit">
          Save
        </button>
      </Form>
      {(['put', 'patch', 'delete'] as const).map((method) => (
        <button id={'island-' + method} onClick={() => void form[method]()}>
          {method}
        </button>
      ))}
      <button id="island-reset" onClick={form.reset}>
        Reset
      </button>
      <button
        id="island-clear"
        onClick={() => {
          form.clearErrors();
          form.clearError();
          foreign.clearError();
        }}
      >
        Clear
      </button>
      <button
        id="island-slow"
        onClick={() => void form.post({ data: { ...form.data, probe: 'slow' } })}
      >
        Slow
      </button>
      <button id="island-cancel" onClick={form.cancel}>
        Cancel
      </button>
      <button
        id="island-fail"
        onClick={() => void form.post({ data: { ...form.data, probe: 'fail' } })}
      >
        Failure
      </button>
      <button id="island-external" onClick={() => void foreign.post()}>
        External
      </button>
      <button id="island-redirect" onClick={() => void redirect.post()}>
        Redirect
      </button>
    </section>
  );
}
