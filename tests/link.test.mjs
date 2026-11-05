import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';
import { jsx } from 'hono/jsx/jsx-runtime';
import { createSsrRouter } from 'void/pages-client';

const source = await readFile(
  new URL('../packages/void-plugin-hono-jsx/src/runtime/pages/api.tsx', import.meta.url),
  'utf8',
);
const transformed = await transformWithOxc(source, 'pages.tsx', {
  jsx: { runtime: 'automatic', importSource: 'hono/jsx' },
});
const code = transformed.code.replace(
  /from (["'])([^"']+)\1/g,
  (_, quote, name) =>
    'from ' +
    JSON.stringify(
      name.startsWith('.')
        ? new URL(
            name,
            new URL('../packages/void-plugin-hono-jsx/src/runtime/pages/api.tsx', import.meta.url),
          ).href
        : import.meta.resolve(name),
    ),
);
const { Link, RouterContext, NavigationContext, useNavigation } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
const html = async (props, url = '/', navigation = null) =>
  jsx(RouterContext.Provider, {
    value: createSsrRouter(url),
    children: jsx(NavigationContext.Provider, {
      value: navigation,
      children: jsx(Link, { children: 'Go', ...props }),
    }),
  }).toString();

test('SSR Link merges query data without leaking navigation props or browser effects', async () => {
  const rendered = await html({
    href: '/users?keep=1',
    data: { tag: ['one', 'two'], empty: null },
    prefetch: 'mount',
    preserveState: true,
    viewTransition: false,
  });
  assert.match(rendered, /href="\/users\?keep=1(?:&amp;|&)tag=one(?:&amp;|&)tag=two"/);
  assert.doesNotMatch(rendered, /prefetch=|preserveState=|viewTransition=|empty=/);
});

test('mutation Link renders a button, not a GET anchor', async () => {
  assert.match(
    await html({ href: '/users?save', method: 'patch', data: { value: 'saved' } }),
    /^<button[^>]*type="button"/,
  );
});

for (const props of [
  { href: '/', data: { nested: {} } },
  { href: '/', method: 'post', prefetch: true },
  { href: '/', method: 'put', reloadDocument: true },
  { href: '/', prefetch: 'unknown' },
  { href: '/', method: 'TRACE' },
])
  test('invalid Link options fail during SSR: ' + JSON.stringify(props), async () => {
    await assert.rejects(() => html(props), /Link|GET data/);
  });

test('navigation hook is idle in SSR and requires a provider', async () => {
  const read = () => jsx('output', { children: JSON.stringify(useNavigation()) });
  await assert.rejects(async () => jsx(read, {}).toString(), /requires a page provider/);
  const markup = await jsx(NavigationContext.Provider, {
    value: { state: 'idle', location: null, method: null },
    children: jsx(read, {}),
  }).toString();
  assert.match(markup, /idle/);
});

test('Link distinguishes current page, active ancestor and pending destination', async () => {
  const path = '/items/1';
  const navigation = {
    state: 'loading',
    method: 'GET',
    location: new URL('/items?page=2', 'http://localhost'),
  };
  const current = await html({ href: path }, path);
  assert.match(current, /aria-current="page".*data-void-active/);
  const pending = await html({ href: '/items?page=2', activeMatch: 'prefix' }, path, navigation);
  assert.match(pending, /data-void-active.*data-void-pending/);
  assert.doesNotMatch(pending, /aria-current/);
  assert.doesNotMatch(
    await html({ href: '/items?page=3' }, path, navigation),
    /data-void-active|data-void-pending/,
  );
});
