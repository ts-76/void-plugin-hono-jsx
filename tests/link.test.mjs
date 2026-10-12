import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';
import { jsx } from 'hono/jsx/jsx-runtime';
import { createSsrRouter } from 'void/pages-client';

const source = await readFile(new URL('../packages/hono-pages/src/runtime/pages.tsx', import.meta.url), 'utf8');
const transformed = await transformWithOxc(source, 'pages.tsx', { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } });
const code = transformed.code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => 'from ' + JSON.stringify(import.meta.resolve(name)));
const { Link, RouterContext } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const html = async (props) => jsx(RouterContext.Provider, { value: createSsrRouter('/'), children: jsx(Link, { children: 'Go', ...props }) }).toString();

test('SSR Link merges query data without leaking navigation props or browser effects', async () => {
  const rendered = await html({ href: '/users?keep=1', data: { tag: ['one', 'two'], empty: null }, prefetch: 'mount', preserveState: true });
  assert.match(rendered, /href="\/users\?keep=1(?:&amp;|&)tag=one(?:&amp;|&)tag=two"/);
  assert.doesNotMatch(rendered, /prefetch=|preserveState=|empty=/);
});

test('mutation Link renders a button, not a GET anchor', async () => {
  assert.match(await html({ href: '/users?save', method: 'patch', data: { value: 'saved' } }), /^<button[^>]*type="button"/);
});

for (const props of [
  { href: '/', data: { nested: {} } },
  { href: '/', method: 'post', prefetch: true },
  { href: '/', method: 'put', reloadDocument: true },
  { href: '/', prefetch: 'unknown' },
  { href: '/', method: 'TRACE' },
]) test('invalid Link options fail during SSR: ' + JSON.stringify(props), async () => {
  await assert.rejects(() => html(props), /Link|GET data/);
});
