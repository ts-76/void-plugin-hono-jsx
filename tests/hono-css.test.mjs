import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fragment, Suspense } from 'hono/jsx';
import { jsx } from 'hono/jsx/jsx-runtime';
import { css, Style } from 'hono/css';
import { runtimeModule } from './compile-runtime.mjs';

const { renderHonoDocument } = await import(await runtimeModule(new URL('../packages/hono-pages/src/runtime/ssr-document.ts', import.meta.url)));
const { HonoStyles } = await import(await runtimeModule(new URL('../packages/hono-pages/src/runtime/style-context.ts', import.meta.url)));
const page = { component: 'index', props: {}, params: {}, shared: {}, errors: null, url: '/' };
const assets = { css: '<link rel="stylesheet" href="/app.css">', preloads: '', body: '' };
const styles = html => html.match(/<style id="hono-css"[^>]*>([\s\S]*?)<\/style>/)?.[1];

test('complete SSR callbacks fill one head host before application styles', async () => {
  const component = () => jsx('p', { class: css`color:rgb(11,22,33);`, children: '日本語 & English' });
  const html = await renderHonoDocument(jsx(component, {}), page, assets);
  assert.match(styles(html), /color:rgb\(11,22,33\)/);
  assert.equal((html.match(/id="hono-css"/g) ?? []).length, 1);
  assert.ok(html.indexOf('id="hono-css"') < html.indexOf('/app.css'));
  assert.ok(html.indexOf('id="hono-css"') < html.indexOf('</head>'));
  assert.match(html, /日本語 &amp; English/);
  assert.doesNotMatch(html, /textContent\+=|\[object Promise\]/);
});

test('parallel async SSR keeps CSS and CSP nonces inside each response', async () => {
  const outputs = await Promise.all(Array.from({ length: 8 }, (_, index) => {
    const component = async () => {
      await new Promise(resolve => setTimeout(resolve, index % 3));
      return jsx(Fragment, { children: [jsx(HonoStyles, { nonce: `request-${index}` }), jsx('p', { class: css`--request-${index}:1;`, children: index })] });
    };
    return renderHonoDocument(jsx(component, {}), page, assets);
  }));
  for (const [index, html] of outputs.entries()) {
    assert.match(html, new RegExp(`id="hono-css" nonce="request-${index}"`));
    assert.match(styles(html), new RegExp(`--request-${index}:1`));
    for (let other = 0; other < outputs.length; other++) if (other !== index) assert.doesNotMatch(styles(html), new RegExp(`--request-${other}:1`));
  }
});

test('CSS collection keeps server Suspense fallback without waiting for results', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const slow = async () => { await pending; return jsx('p', { children: 'Late result' }); };
  const fallback = jsx('p', { class: css`color:rgb(44,55,66);`, children: 'Loading' });
  let timer;
  try {
    const html = await Promise.race([renderHonoDocument(jsx(Suspense, { fallback, children: jsx(slow, {}) }), page, assets), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SSR waited on Suspense')), 200); })]);
    assert.match(html, /Loading/);
    assert.match(styles(html), /color:rgb\(44,55,66\)/);
    assert.doesNotMatch(html, /Late result|data-hono-target/);
  } finally { clearTimeout(timer); release(); }
});

test('nonce configuration rejects conflicts and unsafe values before emitting HTML', async () => {
  for (const nonce of ['', 123, 'bad"nonce', 'bad nonce', '</style>']) await assert.rejects(renderHonoDocument(jsx(HonoStyles, { nonce }), page, assets), /CSP base64 value/);
  await assert.rejects(renderHonoDocument(jsx('p', {}), page, { ...assets, devCssNonce: 'bad"nonce' }), /CSP base64 value/);
  await assert.rejects(renderHonoDocument(jsx(Fragment, { children: [jsx(HonoStyles, { nonce: 'one' }), jsx(HonoStyles, { nonce: 'two' })] }), page, assets), /different style nonces/);
  const inherited = await renderHonoDocument(jsx(Fragment, { children: [jsx(HonoStyles, { nonce: 'shared' }), jsx(HonoStyles, {}), jsx(HonoStyles, { nonce: 'shared' })] }), page, assets);
  assert.match(inherited, /id="hono-css" nonce="shared"/);
  const html = await renderHonoDocument(jsx('p', {}), page, { ...assets, devCssNonce: 'dev-nonce' });
  assert.match(html, /id="hono-css" nonce="dev-nonce"/);
});

test('a native Style inside the redraw root fails with migration guidance', async () => {
  await assert.rejects(renderHonoDocument(jsx(Style, {}), page, assets), /adapter owns #hono-css.*HonoStyles/);
});
