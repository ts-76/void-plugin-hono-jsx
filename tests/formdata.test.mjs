import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsx } from 'hono/jsx/jsx-runtime';
import { runtimeModule } from './compile-runtime.mjs';
const { useForm, useIslandForm } = await import(await runtimeModule(new URL('../packages/hono-pages/src/runtime/form.ts', import.meta.url)));
const { RouterContext, PageContext } = await import(await runtimeModule(new URL('../packages/hono-pages/src/runtime/pages.tsx', import.meta.url)));

async function model(bound = true) {
  const visits = []; let form;
  const router = { async visit(url, options) { visits.push({ url, ...options }); }, async refresh() {} };
  const Page = () => { form = bound ? useForm('/upload', { name: 'model-default' }) : useForm({ name: 'model-default' }); return jsx('p', { children: 'Form' }); };
  await jsx(RouterContext.Provider, { value: router, children: jsx(PageContext.Provider, { value: { errors: {} }, children: jsx(Page, {}) }) }).toString();
  return { form, visits };
}
function payload() {
  const data = new FormData(); data.append('name', 'native-field'); data.append('tags', 'one'); data.append('tags', 'two');
  data.append('files', new File(['hello'], '日本語.txt', { type: 'text/plain' })); data.append('files', new File([], 'empty.txt'));
  return data;
}

test('bound FormData submits native values, repeated fields and files without replacing the JSON model', async () => {
  const { form, visits } = await model(); const data = payload();
  await form.post(data); data.set('name', 'changed-after-submit');
  assert.equal(visits[0].url, '/upload'); assert.equal(visits[0].method, 'POST');
  assert.equal(visits[0].data.get('name'), 'native-field'); assert.deepEqual(visits[0].data.getAll('tags'), ['one', 'two']);
  const files = visits[0].data.getAll('files'); assert.deepEqual(files.map(file => file.name), ['日本語.txt', 'empty.txt']);
  assert.equal(await files[0].text(), 'hello'); assert.equal(files[1].size, 0);
  assert.equal(form.data.name, 'model-default'); form.setData({ name: 'cleanup' });
});

test('URL plus FormData and submit(method, FormData) retain the requested mutation method', async () => {
  const { form, visits } = await model(); const data = payload();
  for (const method of ['post', 'put', 'patch', 'delete']) await form[method]('/explicit', data);
  await form.submit('patch', data);
  assert.deepEqual(visits.map(({ url, method }) => [url, method]), [['/explicit','POST'], ['/explicit','PUT'], ['/explicit','PATCH'], ['/explicit','DELETE'], ['/upload','PATCH']]);
  assert.ok(visits.every(({ data }) => data instanceof FormData)); form.setData({ name: 'cleanup' });
});

test('JSON forms retain model submission and unbound FormData requires an explicit URL', async () => {
  const { form, visits } = await model(false);
  await assert.rejects(() => form.post(payload()), /supply an action URL/); assert.equal(visits.length, 0);
  await form.post('/json'); assert.deepEqual(visits[0].data, { name: 'model-default' });
  await assert.rejects(() => form.post(payload(), payload()), /supply FormData once/);
  form.setData({ name: 'cleanup' });
});

test('island multipart transport lets fetch create its boundary while JSON transport keeps its content type', async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window;
  const requests = []; let form;
  try {
    globalThis.window = { location: { href: 'https://example.test/form', origin: 'https://example.test' } };
    globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return new Response('{"errors":{"name":"Required"}}', { status: 422, headers: { 'Content-Type': 'application/json' } }); };
    const Page = () => { form = useIslandForm({ name: 'model-default' }); return jsx('p', { children: 'Island' }); };
    await jsx(Page, {}).toString();
    await form.post('/upload', payload());
    assert.equal(requests[0].headers, undefined); assert.ok(requests[0].body instanceof FormData);
    assert.deepEqual(requests[0].body.getAll('tags'), ['one', 'two']);
    await form.post('/json'); assert.equal(requests[1].headers['Content-Type'], 'application/json'); assert.equal(requests[1].body, '{"name":"model-default"}');
    await form.post('https://other.test/upload', payload()); assert.equal(requests.length, 2);
  } finally { globalThis.fetch = previousFetch; if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
