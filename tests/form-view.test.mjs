import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';
import { jsx } from 'hono/jsx/jsx-runtime';
import { VoidActionError } from 'void/pages-client';
const source = await readFile(new URL('../packages/hono-pages/src/runtime/form-view.tsx', import.meta.url), 'utf8');
const transformed = await transformWithOxc(source, 'form-view.tsx', { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } });
const code = transformed.code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => 'from ' + JSON.stringify(import.meta.resolve(name)));
const { Form } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const model = { pending: false, error: null, errors: {}, post() {}, put() {}, patch() {}, delete() {} };

test('Form renders field validation and controlled children safely during SSR', async () => {
  const markup = await jsx(Form, { form: { ...model, errors: { name: '<invalid>' } }, children: jsx('input', { value: 'retained' }) }).toString();
  assert.match(markup, /role="alert"/); assert.match(markup, /&lt;invalid&gt;/); assert.match(markup, /value="retained"/);
});
test('Form renders custom quota error and explicit retry deadline without starting browser timers', async () => {
  const error = new VoidActionError({ status: 429, statusText: 'Too Many Requests', url: '/edit', body: { code: 'usage_limit', resource: 'requests', reason: 'rate_limit', message: 'Try later', retryAt: '2099-01-01T00:00:00Z' } });
  const markup = await jsx(Form, { form: { ...model, error }, renderError: () => 'Custom error' }).toString();
  assert.match(markup, /Custom error/); assert.match(markup, /Try again after/); assert.match(markup, /2099/);
});
