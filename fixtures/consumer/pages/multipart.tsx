import { useState } from 'hono/jsx';
import { Form, useForm, Link, useNavigation, useRouter } from 'void-plugin-hono-jsx';
export default function Multipart({
  uploads,
  reads,
  result,
}: {
  uploads: number;
  reads: number;
  result: unknown;
}) {
  const form = useForm('/multipart?upload', { name: 'model-default' });
  const navigation = useNavigation();
  const router = useRouter();
  const redirect = useForm('/multipart?redirect', {});
  const [foreignError, setForeignError] = useState('');
  const data = () => new FormData(document.getElementById('multipart-form') as HTMLFormElement);
  return (
    <main>
      <h1>Multipart forms</h1>
      <output id="multipart-result">{JSON.stringify(result)}</output>
      <output id="multipart-uploads">{uploads}</output>
      <output id="multipart-reads">{reads}</output>
      <output id="multipart-navigation">
        {navigation.state}:{navigation.method ?? ''}
      </output>
      <output id="multipart-state">
        {String(form.pending)}:{String(form.wasSuccessful)}
      </output>
      <output id="multipart-model">{form.data.name}</output>
      <output id="multipart-error">{form.errors.name ?? ''}</output>
      <Form id="multipart-form" form={form} encType="multipart/form-data">
        <input id="multipart-name" name="name" value="native-field" />
        <input name="tags" type="hidden" value="one" />
        <input name="tags" type="hidden" value="two" />
        <input id="multipart-files" name="files" type="file" multiple />
        <button id="multipart-save" name="intent" value="upload" disabled={form.pending}>
          Upload
        </button>
      </Form>
      <button id="multipart-direct" onClick={() => void form.post({ data: data() })}>
        Bound FormData
      </button>
      {(['put', 'patch', 'delete'] as const).map((method) => (
        <button
          id={'multipart-' + method}
          onClick={() => void form.submit(method, { data: data() })}
        >
          {method}
        </button>
      ))}
      <button
        id="multipart-slow"
        onClick={() => {
          const body = data();
          body.set('slow', '1');
          void form.post({ data: body });
        }}
      >
        Slow
      </button>
      <button id="multipart-cancel" onClick={form.cancel}>
        Cancel
      </button>
      <button
        id="multipart-foreign"
        onClick={() => {
          void router
            .visit('https://foreign.invalid/upload', { method: 'POST', data: data() })
            .catch((error: Error) => setForeignError(error.message));
        }}
      >
        Foreign
      </button>
      {foreignError && <p role="alert">{foreignError}</p>}
      <button id="multipart-redirect" onClick={() => void redirect.post({ data: data() })}>
        Redirect
      </button>
      <Link id="multipart-leave" href="/other">
        Leave
      </Link>
    </main>
  );
}
