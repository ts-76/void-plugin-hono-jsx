import { useForm, action } from 'void-plugin-hono-jsx/form';
function checkLegacy() {
  const form = useForm({ name: 'Original', count: 0 });
  form.setData('name', 'New'); form.reset('name'); form.clearErrors('count');
  // @ts-expect-error unknown field
  form.setData('missing', 'New');
  // @ts-expect-error wrong field value
  form.setData('count', 'New');
}
function checkBound() {
  const form = useForm('/forms?save', { name: 'Original' });
  form.post();
  const multipart = new FormData();
  form.post(multipart); form.post('/forms?save', multipart); form.submit('put', multipart);
  // @ts-expect-error multipart body must be FormData
  form.post('/forms?save', { name: 'invalid' });
  // @ts-expect-error unknown action URL
  useForm('/missing?save', { name: 'Original' });
  // @ts-expect-error unknown one-shot action URL
  action('/missing?save');
}
void checkLegacy; void checkBound;
