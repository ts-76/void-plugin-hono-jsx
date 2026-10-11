import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { checkSourceContracts } from './check-source-contracts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'hono-pages-source-'));
const env = { ...process.env, WRANGLER_LOG_PATH: join(temporary, 'logs'), WRANGLER_SEND_METRICS: 'false', VOID_INSPECTOR_PORT: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function smoke(mode, browser) {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const address = reservation.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${address.port}`;
  const child = spawn(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), ...(mode === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(address.port), '--strictPort'], { cwd: join(repo, 'examples/pages'), env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (data) => { logs = (logs + data).slice(-64000); });
  child.stderr.on('data', (data) => { logs = (logs + data).slice(-64000); });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  let page;
  try {
    let ready = false;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(logs);
      try { ready = (await fetch(origin, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
      if (ready) break;
      await delay(100);
    }
    assert.ok(ready, `${mode} did not start: ${logs}`);
    await checkSourceContracts(origin, mode === 'preview');
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const text = (selector) => page.locator(selector).textContent();
    const mounted = () => page.locator('#app[data-hono-pages="mounted"]').waitFor();
    const waitText = (selector, value) => page.waitForFunction(({ selector, value }) => document.querySelector(selector)?.textContent === value, { selector, value });
    async function click(selector) {
      if (selector.startsWith('#nav-') && !(await page.locator(selector).isVisible())) {
        await page.locator('#navigation-tools > summary').click();
      }
      await page.locator(selector).click();
      await page.locator('#app[data-navigation="idle"]').waitFor();
    }

    await page.goto(origin + '/users/alice');
    await mounted();
    await page.evaluate(() => { window.sourceDocument = 123; });
    await click('#nav-bob');
    await waitText('#route-value', 'bob');
    assert.equal(await page.evaluate(() => window.sourceDocument), 123);
    await click('#nav-alice');
    assert.equal(new URL(page.url()).search, '?tab=profile');
    await page.goBack();
    await waitText('#route-value', 'bob');
    await page.goForward();
    await waitText('#route-value', 'alice');
    await click('#nav-hash');
    assert.equal(new URL(page.url()).hash, '#route-value');
    await page.locator('#route-count + button').click();
    await waitText('#route-count', '1');
    await click('#nav-refresh');
    assert.equal(await text('#route-count'), '1');
    // Observe the router's decision before preventing native browser navigation.
    for (const [selector, modified] of [['#nav-bob', true], ['#nav-external', false], ['#nav-download', false], ['#nav-reload', false]]) {
      const intercepted = await page.evaluate(({ selector, modified }) => {
        let intercepted;
        document.addEventListener('click', (event) => { intercepted = event.defaultPrevented; }, { once: true });
        window.addEventListener('click', (event) => event.preventDefault(), { once: true });
        document.querySelector(selector).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: modified }));
        return intercepted;
      }, { selector, modified });
      assert.equal(intercepted, false, `Native link ${selector}`);
    }
    await page.evaluate(() => { document.querySelector('#nav-slow').click(); setTimeout(() => document.querySelector('#nav-bob').click(), 40); });
    await waitText('#route-value', 'bob');
    await delay(800);
    assert.equal(await text('#route-value'), 'bob');
    await page.route('**/users/failed?fail=1', (route) => route.fulfill({ contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: 'invalid json' }));
    await click('#nav-failed');
    await page.getByRole('alert').waitFor();
    assert.equal(await text('#route-value'), 'bob');
    await click('#nav-browser');
    await page.locator('#browser-agent').waitFor();
    assert.ok((await text('#browser-agent')).length > 0);
    assert.equal(await page.evaluate(() => window.sourceDocument), 123);
    await page.goBack();
    await page.locator('#app[data-navigation="idle"]').waitFor();
    await click('#nav-reload');
    await mounted();
    assert.equal(new URL(page.url()).pathname, '/about');
    assert.equal(await page.evaluate(() => window.sourceDocument), undefined);
    console.log(`Source ${mode}: navigation, history, refresh, cancellation, failure recovery and client-only mounting passed.`);

    await page.goto(origin + '/layouts/one');
    await mounted();
    await page.evaluate(() => { window.layoutDocument = 123; });
    await page.locator('#root-increment').click();
    await page.locator('#nested-increment').click();
    await page.locator('#route-count + button').click();
    await waitText('#route-count', '1');
    await click('#layout-two');
    await waitText('#route-count', '0');
    assert.equal(await text('#root-count'), '1');
    assert.equal(await text('#nested-count'), '1');
    assert.equal(await text('[data-shared="root"]'), JSON.stringify({ tenant: 'demo', path: '/layouts/two' }));
    await click('#layout-named');
    assert.equal(await text('#root-count'), '1');
    assert.equal(await page.locator('#nested-count').count(), 0);
    assert.equal(await text('#named-count'), '0');
    await click('#layout-one');
    assert.equal(await text('#nested-count'), '0');
    assert.equal(await page.locator('#named-count').count(), 0);
    await click('#layout-exclusive');
    assert.equal(await page.locator('#root-count').count(), 0);
    await click('#layout-bare');
    assert.equal(await page.locator('[data-layout]').count(), 0);
    await click('#layout-one');
    assert.equal(await text('#root-count'), '0');
    assert.equal(await text('#nested-count'), '0');
    assert.equal(await page.evaluate(() => window.layoutDocument), 123);
    await click('#nav-alice');
    assert.equal(await text('[data-params="root"]'), JSON.stringify({ id: 'alice' }));
    console.log(`Source ${mode}: surviving layout state, page reset, named/exclusive/disabled layouts, shared data and params passed.`);

    await page.goto(origin + '/edit');
    await mounted();
    await page.evaluate(() => { window.actionDocument = 123; });
    await page.locator('#name').fill('');
    await click('#save');
    await waitText('#name-error', 'Name is required.');
    assert.equal(await page.locator('#name').inputValue(), '');
    for (const method of ['save', 'put', 'patch']) {
      await page.locator('#name').fill(`${method} value`);
      await click('#' + method);
      await waitText('#form-pending', 'false');
      await waitText('#saved-name', `${method} value`);
      assert.equal(await page.locator('#name').inputValue(), `${method} value`);
      assert.equal(await text('#form-success'), 'true');
      assert.equal(await page.evaluate(() => window.actionDocument), 123);
    }
    await click('#delete');
    await waitText('#saved-name', 'Original');
    await page.goto(origin + '/named');
    await mounted();
    await page.locator('#name').fill('Named save');
    await click('#save');
    await waitText('#saved-name', 'Named save');
    await click('#fail');
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('#name').inputValue(), 'Named save');
    await click('#save');
    await waitText('#form-success', 'true');
    assert.equal(await page.getByRole('alert').count(), 0);
    const before = Number(await text('#submissions'));
    await page.evaluate(() => { document.querySelector('#slow').click(); document.querySelector('#slow').click(); });
    await waitText('#submissions', String(before + 1));
    await waitText('#form-pending', 'false');
    await page.evaluate(() => { document.querySelector('#slow').click(); setTimeout(() => document.querySelector('#cancel').click(), 40); });
    await waitText('#form-pending', 'false');
    await delay(800);
    assert.equal(await text('#form-success'), 'false');
    await click('#redirect');
    await waitText('#route-value', 'saved');
    assert.equal(new URL(page.url()).pathname, '/users/saved');
    console.log(`Source ${mode}: CRUD, named actions, input/errors, failure recovery, duplicate suppression, cancellation and redirects passed.`);

    await page.goto(origin + '/head/one');
    await mounted();
    async function checkHead(name) {
      assert.equal(await page.title(), name + ' | Hono Pages');
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), name);
      for (const selector of ['meta[name="description"]', 'meta[charset]', 'meta[name="viewport"]', 'link[rel="icon"]', '#page-data']) assert.equal(await page.locator(selector).count(), 1, selector);
      assert.equal(await page.locator('meta[name="project-only"]').getAttribute('content'), 'Project value');
      assert.equal(await page.locator('meta[name="middleware-only"]').getAttribute('content'), 'Middleware value');
      assert.equal(await page.locator('html').getAttribute('data-level'), 'page');
      assert.equal(await page.locator('body').getAttribute('data-level'), 'page');
      assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), '/head/' + name);
    }
    await checkHead('one');
    await page.evaluate(() => { window.initialHeadScript = document.querySelector('#project-script'); });
    for (const name of ['two', 'one', 'two']) {
      await click('#head-' + name);
      await page.waitForFunction((name) => document.title === `${name} | Hono Pages`, name);
      await checkHead(name);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), name);
      assert.equal(await page.locator('meta[name="description"]').count(), 1);
      const other = name === 'one' ? 'two' : 'one';
      assert.equal(await page.locator(`meta[name="page-${other}"]`).count(), 0);
      assert.equal(await page.evaluate((other) => document.documentElement.hasAttribute('data-page-' + other) || document.body.hasAttribute('data-page-' + other), other), false);
      assert.equal(await page.evaluate(() => window.headExecutions), 1);
      assert.equal(await page.evaluate(() => window.initialHeadScript === document.querySelector('#project-script')), true);
      assert.equal(await page.locator('#page-data').evaluate((node) => JSON.parse(node.textContent).name), name);
    }
    await page.goBack();
    await page.waitForFunction(() => document.title === 'one | Hono Pages');
    await checkHead('one');
    await page.goForward();
    await page.waitForFunction(() => document.title === 'two | Hono Pages');
    await checkHead('two');
    await click('#head-refresh');
    await checkHead('two');
    await click('#head-default');
    assert.equal(await page.locator('#page-data').count(), 0);
    assert.equal(await page.title(), 'Middleware default | Hono Pages');
    assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'Middleware description');
    assert.equal(await page.locator('html').getAttribute('data-level'), 'middleware');
    assert.equal(await page.locator('body').getAttribute('data-level'), 'middleware');
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    await page.goBack();
    await page.locator('#page-data').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => window.pageHeadExecutions), 1);
    const hostile = '</title><script>window.headInjected=true</script>&"';
    await page.goto(origin + '/head/one?title=' + encodeURIComponent(hostile));
    await mounted();
    assert.equal(await page.title(), hostile + ' | Hono Pages');
    assert.equal(await page.evaluate(() => window.headInjected), undefined);
    assert.equal(await page.locator('#page-data').evaluate((node) => JSON.parse(node.textContent).name), hostile);
    assert.deepEqual(errors, []);
    assert.equal(child.exitCode, null);
    console.log(`Source ${mode}: head replacement, stale removal, safe values, script node retention and inert reinsertion passed without unhandled errors.`);
  } catch (error) { console.error(logs.slice(-6000)); throw error; } finally {
    if (page) await page.close();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const stop = (signal) => { try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      stop('SIGTERM');
      await Promise.race([exited, delay(3000)]);
      if (child.exitCode === null && child.signalCode === null) { stop('SIGKILL'); await exited; }
    }
  }
}

try {
  execFileSync(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: join(repo, 'examples/pages'), env, stdio: 'inherit' });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  try { await smoke('development', browser); await smoke('preview', browser); } finally { await browser.close(); }
} finally { await rm(temporary, { recursive: true, force: true }); }
