import { Form, useIslandForm } from 'void-plugin-hono-jsx/form';
export default function MultipartIsland() {
  const form = useIslandForm({ name: 'island-model' });
  return <Form id="island-multipart-form" form={form} url="/multipart-island?upload" encType="multipart/form-data">
    <input id="island-multipart-name" name="name" value="island-native" />
    <input type="hidden" name="tags" value="one" /><input type="hidden" name="tags" value="two" />
    <input id="island-multipart-files" name="files" type="file" multiple />
    <output id="island-multipart-error">{form.errors.name ?? ''}</output>
    <button id="island-multipart-save" name="intent" value="island-upload" disabled={form.pending}>Upload</button>
  </Form>;
}
