import assert from 'node:assert/strict';
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';

/** Real published templates, copied as consumer-owned UI; no fixture compiler. */
export async function checkHonoxpressConsumer({ repo, consumer, browser, withServer, build, prepare }) {
  for (const directory of ['pages', 'components']) await rm(join(consumer, directory), { recursive: true, force: true });
  await cp(join(repo, 'fixtures/honoxpress'), consumer, { recursive: true });
  await cp(join(consumer, 'node_modules/honoxpress/templates'), join(consumer, 'components/honoxpress'), { recursive: true });
  await writeFile(join(consumer, 'void.config.ts'), "import { defineConfig } from 'void/config'; export default defineConfig({ cloudflare: { name: 'hono-honoxpress-consumer' }, head: { meta: [{charset:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'}], link: [{rel:'icon',href:'data:,'}] } });");
  prepare();

  async function check(origin, mode) {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    const noJs = await staticContext.newPage();
    const verify = async (tab, locale) => {
      assert.equal(await tab.locator('.hx-callout').evaluate(node => getComputedStyle(node).borderRadius), '19px');
      assert.equal(await tab.locator('.hx-cards').evaluate(node => getComputedStyle(node).display), 'grid');
      assert.equal(await tab.locator('.hx-step').count(), 1);
      assert.equal(await tab.locator('#hx-properties tbody tr').count(), 1);
      assert.equal(await tab.locator('html').getAttribute('lang'), locale);
      assert.equal(await tab.locator('head > style#hono-css').count(), 1);
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const toc = await tab.locator('.toc-rail nav a').evaluateAll(links => links.map(link => decodeURIComponent(link.hash.slice(1))));
      assert.ok(toc.length >= 2);
      for (const id of toc) assert.equal(await tab.locator(`[id="${id}"]`).count(), 1);
      assert.equal(await tab.locator('#hx-loader').textContent(), locale === 'ja' ? 'ローダーの値' : 'Loader value');
    };
    try {
      if (mode !== 'static') {
        const nonces = new Set();
        await Promise.all(['en', 'ja', 'en', 'ja'].map(async locale => {
          const response = await fetch(`${origin}/hx/${locale}/static`); const html = await response.text();
          const style = html.match(/<style id="hono-css"[^>]*>([\s\S]*?)<\/style>/)?.[1];
          assert.match(style, new RegExp(`--hx-response-language:${locale}`));
          assert.doesNotMatch(style, new RegExp(`--hx-response-language:${locale === 'ja' ? 'en' : 'ja'}`));
          const nonce = html.match(/<style id="hono-css" nonce="([^"]+)"/)?.[1]; assert.ok(nonce); nonces.add(nonce);
          if (mode === 'preview') assert.ok(response.headers.get('content-security-policy').includes(`'nonce-${nonce}'`));
        }));
        assert.equal(nonces.size, 4);
      }
      for (const locale of ['en', 'ja']) for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
        await noJs.setViewportSize({ width, height: 900 }); await noJs.emulateMedia({ colorScheme: theme });
        const response = await noJs.goto(`${origin}/hx/${locale}/static`); assert.equal(response.status(), 200);
        await verify(noJs, locale);
        assert.equal(await noJs.locator('script[src],link[rel="modulepreload"],script:not([type="application/json"])').count(), 0);
        const details = noJs.locator('.hx-accordion-item'); await details.locator('summary').click(); assert.equal(await details.evaluate(node => node.open), true);
        await noJs.goto(`${origin}/hx/${locale}/interactive`); await verify(noJs, locale);
        assert.match(await noJs.locator('#hx-island-context').textContent(), /const typed: string/);
        const staticScripts = []; const listener = request => { if (request.resourceType() === 'script') staticScripts.push(request.url()); }; page.on('request', listener);
        await page.goto(`${origin}/hx/${locale}/static`); await verify(page, locale);
        assert.deepEqual(staticScripts, []); page.off('request', listener);
        await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme });
        const interactive = await page.goto(`${origin}/hx/${locale}/interactive`);
        if (mode === 'preview') assert.match(interactive.headers()['content-security-policy'], /nonce-/);
        await page.locator('[data-hono-island="mounted"]').waitFor();
        assert.equal(await page.locator('[data-hono-island]').count(), 1);
        await verify(page, locale);
        assert.equal(await page.locator('#hx-island-context').getAttribute('data-locale'), locale);
        assert.equal(await page.locator('#hx-island-context').getAttribute('data-message'), locale === 'ja' ? 'ローダーの値' : 'Loader value');
        await page.evaluate(() => { window.hxHost = document.getElementById('hono-css'); window.hxNonce = window.hxHost.nonce; });
        const tabs = page.getByRole('tab'); await tabs.first().focus(); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].at(1)?.getAttribute('aria-selected') === 'true');
        const panel = page.locator('[role="tabpanel"]:visible'); assert.match(await panel.textContent(), /const typed =/);
        await panel.getByRole('button').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'const typed = "Hello";');
        assert.equal(await page.evaluate(() => window.hxHost === document.getElementById('hono-css') && window.hxHost.nonce === window.hxNonce), true);
        if (!(await page.locator('.theme-desktop [data-hx-theme-switch]').isVisible())) await page.locator('.mobile-nav > summary').click();
        const select = page.locator('[data-hx-theme-switch]:visible').first();
        for (const choice of ['light', 'dark', 'system']) {
          await select.selectOption(choice);
          assert.equal(await page.locator('html').getAttribute('data-theme'), choice === 'system' ? theme : choice);
        }
        await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
        await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme === 'dark' ? 'light' : 'dark');
        await page.locator('.mobile-nav').evaluate(node => { node.open = false; });
        await page.evaluate(() => { window.hxDocument = true; });
        await page.locator(`.language-links a[lang="${locale === 'en' ? 'ja' : 'en'}"]`).click();
        await page.waitForURL(`**/hx/${locale === 'en' ? 'ja' : 'en'}/interactive`);
        assert.equal(await page.evaluate(() => window.hxDocument), undefined, 'Markdown language links use document navigation');
        await page.goBack(); await page.waitForURL(`**/hx/${locale}/interactive`); await page.goForward();
        assert.match(await page.title(), /Loaded/);
      }
      if (mode === 'development') {
        // Structural edits must not race the previous interactive document's HMR reload.
        await page.goto(origin + '/hx/en/static');
        const file = join(consumer, 'pages/hx/en/static.md'); const source = await readFile(file, 'utf8');
        const wrapper = join(consumer, 'components/hx/Properties.tsx'); const wrapperSource = await readFile(wrapper, 'utf8');
        const added = join(consumer, 'pages/hx/en/added.md');
        const waitFor = async (path, predicate) => {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            const response = await fetch(origin + path); const html = await response.text();
            if (predicate(response.status, html)) return html;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('honoxpress Markdown update did not propagate: ' + path);
        };
        try {
          await writeFile(file, source.replace('## Nested heading', '## Edited heading'));
          await waitFor('/hx/en/static', (status, html) => status === 200 && html.includes('id="edited-heading"') && html.includes('href="#edited-heading"'));
          await writeFile(file, source);
          await writeFile(wrapper, 'export default function Properties() { return <p id="hx-edited-wrapper">Wrapper edited</p>; }');
          await waitFor('/hx/en/static', (status, html) => status === 200 && html.includes('id="hx-edited-wrapper"'));
          await writeFile(wrapper, wrapperSource);
          await waitFor('/hx/en/static', (status, html) => status === 200 && html.includes('staticOnlyProperty117'));
          await writeFile(added, source.replace('slug: static', 'slug: added').replace('href: /hx/en/static', 'href: /hx/en/added'));
          await waitFor('/hx/en/added', (status, html) => status === 200 && html.includes('href="/hx/en/added"'));
          await page.goto(origin + '/hx/en/added');
          assert.equal(await page.locator('script[src],link[rel="modulepreload"]').count(), 0);
          await rm(added); await waitFor('/hx/en/added', status => status === 404);
          await waitFor('/hx/en/static', (status, html) => status === 200 && !html.includes('href="/hx/en/added"'));
        } finally { await writeFile(file, source); await writeFile(wrapper, wrapperSource); await rm(added, { force: true }); }
      }
      assert.equal((await fetch(origin + '/hx/en/missing')).status, 404);
      assert.deepEqual(errors, []);
      console.log(`honoxpress ${mode}: 24 JS-disabled cases, 12 zero-script documents, 12 interactive EN/JA/1280/390/320/light-dark/system cases, nested content, wrapper/context/catalog/TOC, tabs/copy/theme, native history and CSS/nonce passed.`);
    } finally { await staticContext.close(); await context.close(); }
  }
  await withServer('development', check);
  build(); await withServer('preview', check);
  // Worker and browser assets must never execute the authoring toolchain.
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await inspect(file);
      else if (entry.name.endsWith('.js')) {
        const code = await readFile(file, 'utf8');
        assert.doesNotMatch(code, /markdown-exit|markdown-it-container|createHighlighter|vscode-textmate|parseDocument\(/);
        if (file.includes('/client/')) assert.doesNotMatch(code, /staticOnlyProperty117|hx-callout-content|class DocsCatalog/);
      }
    }
  }
  await inspect(join(consumer, 'dist'));
  await writeFile(join(consumer, 'void.config.ts'), "import { defineConfig } from 'void/config'; export default defineConfig({ output: 'static', cloudflare: { name: 'hono-honoxpress-static' }, head: { meta: [{charset:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'}], link: [{rel:'icon',href:'data:,'}] } });");
  build();
  const output = join(consumer, 'dist/client');
  for (const locale of ['en', 'ja']) for (const slug of ['static', 'interactive']) assert.match(await readFile(join(output, 'hx', locale, slug + '.html'), 'utf8'), /hx-callout/);
  // Serve generated files directly: no Worker or framework fallback.
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('..')) { response.writeHead(404).end(); return; }
    const file = join(output, pathname + (pathname.split('/').at(-1).includes('.') ? '' : '.html'));
    try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': (file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/json') + '; charset=utf-8' }).end(bytes); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await check(`http://127.0.0.1:${server.address().port}`, 'static'); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
