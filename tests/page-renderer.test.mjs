import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsx } from 'hono/jsx/jsx-runtime';
import { runtimeModule } from './compile-runtime.mjs';
import { createHonoIslandRenderer } from '../packages/void-plugin-hono-jsx/src/runtime/islands/page.ts';

const { createHonoPageRenderer } = await import(
  await runtimeModule(
    new URL('../packages/void-plugin-hono-jsx/src/runtime/pages/ssr-page.ts', import.meta.url),
  )
);
const { MarkdownContext } = await import(
  await runtimeModule(
    new URL('../packages/void-plugin-hono-jsx/src/runtime/markdown/context.ts', import.meta.url),
  )
);
const { useContext } = await import('hono/jsx');
const page = {
  component: 'index',
  props: { value: 'props' },
  params: {},
  shared: {},
  errors: null,
  url: '/',
};
const assets = {
  css: '<link rel="stylesheet" href="/page.css">',
  preloads: '<link rel="modulepreload" href="/entry.js">',
  body: '<script type="module" src="/entry.js"></script>',
};

test('the page runtime composes layouts and keeps server metadata separate from serialized client metadata', async () => {
  const Page = ({ value }) =>
    jsx('p', { children: value + ':' + useContext(MarkdownContext).frontmatter.private });
  const Layout = ({ children }) => jsx('main', { children });
  const render = createHonoPageRenderer(
    {
      components: {
        index: async () => ({
          default: Page,
          frontmatter: { title: 'Public', private: 'server-only' },
          clientFrontmatter: { title: 'Public' },
          headings: [],
        }),
        layout: async () => ({ default: Layout }),
      },
      layoutTree: { index: ['layout'] },
    },
    { staticData: false, markdown: true, markdownScripts: new Set(['index']) },
  );
  const html = await render(page, assets);
  assert.match(html, /<main><p>props:server-only<\/p><\/main>/);
  assert.match(html, /data-md-script="index"/);
  const metadata = html.match(/data-hono-markdown="([^"]*)"/)[1].replaceAll('&quot;', '"');
  assert.deepEqual(JSON.parse(metadata), { frontmatter: { title: 'Public' }, headings: [] });
  assert.match(html, /href="\/page.css"/);
});

test('SSR resolves the page URL against the actual request origin', async () => {
  const { useRouter } = await import(
    await runtimeModule(
      new URL('../packages/void-plugin-hono-jsx/src/runtime/pages/api.tsx', import.meta.url),
    )
  );
  const Page = () => jsx('output', { children: useRouter().url.href });
  const render = createHonoPageRenderer(
    { components: { index: async () => ({ default: Page }) }, layoutTree: {} },
    { staticData: false, markdown: false, markdownScripts: new Set() },
  );
  const html = await render(
    { ...page, url: '/items?tab=details' },
    assets,
    'https://example.test/items?tab=details',
  );
  assert.match(html, /<output>https:\/\/example\.test\/items\?tab=details<\/output>/);
});

test('the page runtime rejects invalid components and deferred static output', async () => {
  const options = { staticData: false, markdown: false, markdownScripts: new Set() };
  await assert.rejects(
    createHonoPageRenderer({ components: {}, layoutTree: {} }, options)(page, assets),
    /unknown page/,
  );
  const manifest = { components: { index: () => ({ default: 42 }) }, layoutTree: {} };
  await assert.rejects(
    createHonoPageRenderer(manifest, options)(page, assets),
    /component function/,
  );
  await assert.rejects(
    createHonoPageRenderer(manifest, { ...options, staticData: true })(
      { ...page, deferredKeys: ['late'] },
      assets,
    ),
    /cannot be statically prerendered/,
  );
});

test('island page asset filtering preserves CSS and caller assets across static, script-only and interactive pages', async () => {
  const input = {
    css: assets.css,
    preloads: '<link href="/markdown-client-1.js"><link href="/other.js">',
    body: '<script src="/markdown-client-1.js"></script><script src="/islands-client-1.js"></script><script src="/other.js"></script>',
  };
  const original = { ...input };
  const render = createHonoIslandRenderer(async (_page, selected) => selected, {
    interactive: new Set(['script', 'interactive']),
    scriptOnly: new Set(['script']),
    markdownScripts: new Set(['script']),
  });
  assert.deepEqual(await render(page, input), { ...input, preloads: '', body: '' });
  const script = await render({ ...page, component: 'script' }, input);
  assert.equal(script.css, assets.css);
  assert.equal(script.preloads, '');
  assert.match(script.body, /markdown-client/);
  assert.doesNotMatch(script.body, /islands-client/);
  const interactive = await render({ ...page, component: 'interactive' }, input);
  assert.doesNotMatch(interactive.body, /markdown-client/);
  assert.match(interactive.body, /islands-client/);
  assert.equal(interactive.preloads, '<link href="/other.js">');
  assert.deepEqual(input, original);
  assert.throws(
    () => render({ ...page, deferredKeys: ['late'] }, input),
    /deferred props are unsupported/,
  );
});
