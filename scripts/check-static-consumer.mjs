import { checkIslandGraph } from './check-island-graph.mjs';
import { checkIslandPolicies } from './check-island-policies.mjs';
import { launcherArgs } from './consumer-launcher.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, readFile, rm, access, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { createServer } from 'node:http';

export async function checkStaticConsumer({ repo, consumer, browser, env }) {
  for (const directory of ['pages', 'components', 'routes', 'server']) await rm(join(consumer, directory), { recursive: true, force: true });
  await cp(join(repo, 'fixtures/static'), consumer, { recursive: true });
  await mkdir(join(consumer, 'components'), { recursive: true });
  await cp(join(repo, 'fixtures/consumer/components/PolicyCounter.tsx'), join(consumer, 'components/PolicyCounter.tsx'));
  await cp(join(repo, 'fixtures/consumer/pages/policies.island.tsx'), join(consumer, 'pages/policies.island.tsx'));
  await cp(join(repo, 'fixtures/consumer/components/StaticIslandWrapper.tsx'), join(consumer, 'components/StaticIslandWrapper.tsx'));
  await cp(join(repo, 'fixtures/consumer/components/DirectoryWrapper'), join(consumer, 'components/DirectoryWrapper'), { recursive: true });
  await cp(join(repo, 'fixtures/consumer/pages/graph'), join(consumer, 'pages/graph'), { recursive: true });
  await mkdir(join(consumer, 'pages/_layouts'), { recursive: true });
  await cp(join(repo, 'fixtures/consumer/pages/_layouts/graph.island.tsx'), join(consumer, 'pages/_layouts/graph.island.tsx'));
  const build = () => {
    const result = spawnSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, encoding: 'utf8' });
    const log = result.stdout + result.stderr;
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(log);
    return log;
  };
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, stdio: 'inherit' });
  const log = build();
  assert.doesNotMatch(log, /failed to prerender|page\(s\) failed/);
  const output = join(consumer, 'dist/client');
  for (const path of ['index.html', 'users/alice.html', 'users/bob.html', 'forced.html', 'policies.html', 'graph/nested.html', 'graph/named.html', '_void/pages/index.json', '_void/pages/users/alice.json']) await access(join(output, path));
  for (const path of ['skipped.html', 'users/unknown.html']) await assert.rejects(access(join(output, path)));
  const initial = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(initial, /id="static-count"[^>]*>5<\/output>/);
  assert.match(initial, /&lt;\/script&gt;/);
  assert.match(initial, /src="\/assets\//);
  const data = JSON.parse(await readFile(join(output, '_void/pages/users/alice.json'), 'utf8'));
  assert.equal(data.props.label, 'alice');
  assert.equal(data.props.initialCount, 7);
  const requests = [];
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    requests.push(pathname);
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
    const file = join(output, decodeURIComponent(pathname === '/' ? 'index.html' : pathname.slice(1)));
    if (relative(output, file).startsWith('..')) { response.writeHead(404).end(); return; }
    try {
      const resolved = extname(file) ? file : file + '.html';
      const body = await readFile(resolved);
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(resolved)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    for (const [path, label, count] of [['/', 'Static index', 5], ['/users/alice', 'alice', 7], ['/users/bob', 'bob', 8]]) {
      await page.goto(origin + path);
      await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      assert.equal(await page.locator('#static-label').textContent(), label);
      assert.equal(await page.locator('#static-count').textContent(), String(count));
      await page.locator('#static-increment').click();
      await page.waitForFunction((count) => document.querySelector('#static-count')?.textContent === String(count), count + 1);
      await page.reload();
      await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      assert.equal(await page.locator('#static-count').textContent(), String(count));
      assert.equal(await page.evaluate(() => window.staticInjected), undefined);
    }
    await page.locator('#static-home').click();
    await page.waitForURL(origin + '/');
    await page.evaluate(() => { window.staticDocument = 1; });
    await page.locator('#static-alice').click();
    await page.waitForURL('**/users/alice');
    assert.equal(await page.evaluate(() => window.staticDocument), 1);
    assert.equal(await page.locator('#static-count').textContent(), '7');
    assert.ok(requests.includes('/_void/pages/users/alice.json'));
    assert.equal((await fetch(origin + '/skipped')).status, 404);
    assert.equal((await fetch(origin + '/users/unknown')).status, 404);
    await checkIslandPolicies({ origin, page, assert });
    await checkIslandGraph({ origin, page, assert, mode: 'static', consumer });
    assert.deepEqual(errors, []);
  } finally { await page.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log('Static output: native HTML/JSON collection, declared paths, overrides, safe loader props, direct access, refresh, interaction and static-data SPA navigation passed.');

  await writeFile(join(consumer, 'pages/action.tsx'), 'export default function Page() { return <p>Action</p>; }');
  await writeFile(join(consumer, 'pages/action.server.ts'), 'export const action = () => ({});');
  let failure;
  try { build(); } catch (error) { failure = error; }
  assert.ok(failure, 'Static actions must fail');
  assert.match(String(failure), /actions require a server/);
  await rm(join(consumer, 'pages/action.tsx'));
  await rm(join(consumer, 'pages/action.server.ts'));
  await writeFile(join(consumer, 'pages/deferred.tsx'), 'export default function Page() { return <p>Deferred</p>; }');
  await writeFile(join(consumer, 'pages/deferred.server.ts'), "import { defer } from 'void'; export const loader = () => ({ slow: defer(async () => 'value') });");
  const deferredLog = build();
  assert.match(deferredLog, /deferred props cannot be statically prerendered/);
  await assert.rejects(access(join(output, 'deferred.html')));
  console.log('Static diagnostics: actions fail discovery; deferred prerender warns and emits no HTML according to Void build behavior.');
}
