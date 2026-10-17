import { Form, useForm } from 'void-plugin-hono-jsx/form';
import type { Props } from './index.server';
export default function Page({ notes }: Props) {
  const json = useForm({ value: '' });
  const multipart = useForm('/?upload', {});
  return <main><h1>Cloudflare Hono RC</h1><p>Only synthetic data; resources will be deleted.</p>
    <Form id="json-form" form={json} url="/?save"><label>JSON value<input id="json-value" value={json.data.value} onInput={e => json.setData('value', (e.currentTarget as HTMLInputElement).value)} /></label><button id="json-save" disabled={json.pending}>Save JSON</button></Form><output id="json-error">{json.errors.value}</output>
    <Form id="multipart-form" form={multipart} encType="multipart/form-data"><label>Multipart value<input id="multipart-value" name="value" value="synthetic multipart" /></label><input name="tags" value="one" type="hidden" /><input name="tags" value="two" type="hidden" /><input id="multipart-file" name="file" type="file" /><button id="multipart-save" disabled={multipart.pending}>Save multipart</button></Form>
    <output id="notes">{JSON.stringify(notes)}</output>
  </main>;
}
