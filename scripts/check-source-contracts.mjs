import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const payload = (html) => JSON.parse(html.match(/<script id="__VOID_PAGE_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');

// Preserve the HTTP, SSR and bundle checks formerly run by the manual Pages scripts.
export async function checkSourceContracts(base, checkBuild) {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /Server loader initial count: 7/);
  assert.match(html, /<output[^>]*id="count"[^>]*>7<\/output>/);
  const data = html.match(/<script id="__VOID_PAGE_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(data && !data.includes('<'), 'Safe embedded page JSON');
  assert.equal(payload(html).component, 'index');
  assert.equal(payload(html).props.initialCount, 7);
  assert.equal(payload(html).props.message, '</script><script>globalThis.__honoPagesInjected = true</script>&\u2028\u2029');
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;/);
  assert.match(html, /<script type="module"[^>]*src=/);

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
  }

  const browserResponse = await fetch(new URL('/browser', base));
  assert.equal(browserResponse.status, 200);
  const browserHtml = await browserResponse.text();
  assert.match(browserHtml, /<div id="app" data-void-ssr="false"><\/div>/);
  assert.ok(!browserHtml.includes('Client-only page mounted'));
  assert.deepEqual(payload(browserHtml).props, { initialCount: 11 });
  assert.match(browserHtml, /<script type="module"[^>]*src=/);
  for (const path of ['/missing', '/marketing/contact']) {
    const response = await fetch(new URL(path, base));
    await response.text();
    assert.equal(response.status, 404);
  }

  for (const [name, chain] of Object.entries({ one: ['root', 'nested'], two: ['root', 'nested'], named: ['root', 'named'], exclusive: ['named'], bare: [] })) {
    const response = await fetch(base + '/layouts/' + name);
    assert.equal(response.status, 200);
    const html = await response.text();
    const positions = chain.map((layout) => {
      const position = html.indexOf(`data-layout="${layout}"`);
      assert.ok(position >= 0, `Missing SSR layout ${layout}`);
      return position;
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.equal((html.match(/data-layout=/g) ?? []).length, chain.length);
    if (chain.length) assert.ok(html.includes('demo') && html.includes('/layouts/' + name));
  }
  assert.ok((await (await fetch(base + '/users/alice')).text()).includes('&quot;id&quot;:&quot;alice&quot;'));

  async function action(path, method = 'POST', name = 'Test', headers = {}) {
    return fetch(base + path, { method, headers: { 'X-VoidPages': 'true', Accept: 'application/json', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ name }), redirect: 'manual' });
  }
  for (const path of ['/edit', '/named?save']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await action(path, method, method + ' name');
      assert.equal(response.status, 200);
      const page = await response.json();
      assert.equal(page.props.name, method === 'DELETE' ? 'Original' : method + ' name');
      assert.equal(page.errors, null);
    }
    const invalid = await (await action(path, 'POST', '')).json();
    assert.deepEqual(invalid.errors, { name: 'Name is required.' });
    assert.equal(invalid.props.name, 'Original');
  }
  const redirect = await action('/named?redirect');
  await redirect.text();
  assert.equal(redirect.status, 302);
  // Void 1.2 removes the source action name from a GET redirect destination.
  assert.equal(redirect.headers.get('location'), '/users/saved');
  // Unknown-action routing does not need a body. A body-bearing unknown POST
  // can reset Workerd's reused dev connection (documented upstream limitation).
  // Keep that transport repro separate from this HTTP 404 contract check.
  const unknown = await fetch(base + '/named?unknown', { method: 'POST', headers: { 'X-VoidPages': 'true', Accept: 'application/json', Connection: 'close' } });
  await unknown.text();
  assert.equal(unknown.status, 404);
  const failure = await fetch(base + '/named?fail', { method: 'POST', headers: { 'X-VoidPages': 'true', Accept: 'application/json', Connection: 'close' } });
  assert.match(await failure.text(), /Example action failed\./);
  assert.equal(failure.status, 500);

  for (const name of ['one', 'two']) {
    const response = await fetch(base + '/head/' + name);
    assert.equal(response.status, 200);
    const markup = await response.text();
    assert.ok(markup.includes(`<title>${name} | Hono Pages</title>`));
    assert.ok(markup.includes(`name="description" content="${name}"`));
    assert.ok(markup.includes(`data-page-${name}="${name}"`));
    assert.ok(markup.includes('id="page-data"') && markup.includes('id="project-script"'));
    assert.equal((markup.match(/name="viewport"/g) ?? []).length, 1);
    assert.equal((markup.match(/charset="UTF-8"/g) ?? []).length, 1);
  }
  const hostile = '</title><script>window.headInjected=true</script>&"';
  const markup = await (await fetch(base + '/head/one?title=' + encodeURIComponent(hostile))).text();
  assert.ok(markup.includes('<title>&lt;/title&gt;&lt;script&gt;window.headInjected=true&lt;/script&gt;&amp;&quot; | Hono Pages</title>'));
  assert.ok(!markup.includes('<script>window.headInjected=true</script>'));

  if (checkBuild) {
    const source = async (directory) => (await Promise.all((await readdir(directory)).filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(file, directory), 'utf8')))).join('\n');
    const client = await source(new URL('../examples/pages/dist/client/assets/', import.meta.url));
    const server = await source(new URL('../examples/pages/dist/ssr/assets/', import.meta.url));
    assert.ok(server.includes('HonoPagesServerOnlySentinel_93ac62'), 'Sentinel exists in server bundle');
    assert.ok(!client.includes('HonoPagesServerOnlySentinel_93ac62'), 'Server-only code absent from browser');
    assert.doesNotMatch(client, /Example action failed\.|Name is required\./);
  }
  console.log(`Source HTTP ${base}: safe props, routes, client-only shells, SSR layouts/head, action protocol and ${checkBuild ? 'bundle isolation' : 'development rendering'} passed.`);
}
