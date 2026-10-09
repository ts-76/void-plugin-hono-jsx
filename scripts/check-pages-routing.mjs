import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/check-pages-routing.mjs http://127.0.0.1:5174');
const payload = (html) => JSON.parse(html.match(/<script id="__VOID_PAGE_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');

for (const [path, component, value, props, params] of [
  ['/about', 'about', 'Static route', {}, {}],
  ['/users/alice', 'users/[id]', 'alice', { id: 'alice' }, { id: 'alice' }],
  ['/users/bob', 'users/[id]', 'bob', { id: 'bob' }, { id: 'bob' }],
  ['/docs/guide/start', 'docs/[...slug]', 'guide/start', { slug: 'guide/start' }, { slug: 'guide/start' }],
  ['/contact', '(marketing)/contact', 'Grouped route', {}, {}],
]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const page = payload(html);
  assert.equal(page.component, component, path);
  assert.deepEqual(page.props, props, path);
  assert.deepEqual(page.params, params, path);
  assert.ok(html.includes(`id="route-value">${value}</p>`), path);
  const pageResponse = await fetch(new URL(path, base), { headers: { 'X-VoidPages': 'true' } });
  assert.equal(pageResponse.status, 200);
  assert.equal(pageResponse.headers.get('X-VoidPages'), 'true');
  const json = await pageResponse.json();
  assert.deepEqual(json.props, page.props);
  assert.deepEqual(json.params, page.params);
  console.log(`SSR and page protocol passed: ${path}`);
}

const browserResponse = await fetch(new URL('/browser', base));
assert.equal(browserResponse.status, 200);
const browserHtml = await browserResponse.text();
assert.match(browserHtml, /<div id="app" data-void-ssr="false"><\/div>/);
assert.ok(!browserHtml.includes('Client-only page mounted'));
assert.deepEqual(payload(browserHtml).props, { initialCount: 11 });
assert.match(browserHtml, /<script type="module"[^>]*src=/);
for (const path of ['/missing', '/marketing/contact']) {
  assert.equal((await fetch(new URL(path, base))).status, 404);
}
console.log('Client-only shell, loader data, and 404 checks passed');

if (process.argv.includes('--check-build')) {
  const clientDir = fileURLToPath(new URL('../examples/pages/dist/client/assets/', import.meta.url));
  const serverDir = fileURLToPath(new URL('../examples/pages/dist/ssr/assets/', import.meta.url));
  const source = async (directory) => (await Promise.all((await readdir(directory)).filter((file) => file.endsWith('.js')).map((file) => readFile(directory + file, 'utf8')))).join('\n');
  const client = await source(clientDir);
  const server = await source(serverDir);
  assert.ok(server.includes('HonoPagesServerOnlySentinel_93ac62'), 'The sentinel actually exists in the server bundle');
  assert.ok(!client.includes('HonoPagesServerOnlySentinel_93ac62'), 'Server-only code must be absent from client assets');
  console.log('Server-only bundle isolation passed');
}
