import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsx } from 'hono/jsx/jsx-runtime';
import { runtimeModule } from './compile-runtime.mjs';
const { useIslandForm, useForm } = await import(await runtimeModule(new URL('../packages/hono-pages/src/runtime/form.ts', import.meta.url)));
test('island form initializes JSON fields without a Pages provider during SSR', async () => {
  const Page = () => { const form = useIslandForm({ name: 'Original' }); return jsx('output', { children: form.data.name + ':' + form.pending + ':' + form.hasChanges }); };
  assert.equal(await jsx(Page, {}).toString(), '<output>Original:false:false</output>');
});
test('ordinary form still requires the full Pages renderer', async () => {
  const Page = () => { useForm({ name: 'Original' }); return jsx('p', { children: 'invalid' }); };
  await assert.rejects(async () => jsx(Page, {}).toString(), /requires the full Pages renderer/);
});
