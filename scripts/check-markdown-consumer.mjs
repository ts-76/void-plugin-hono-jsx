import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cp, rm, readFile, writeFile, mkdir, access, readdir, symlink } from 'node:fs/promises';
import { dirname, join, relative, extname } from 'node:path';
import { createServer as netServer } from 'node:net';
import { createServer } from 'node:http';
import { consumerStack, launcherArgs } from './consumer-launcher.mjs';
import { checkIslandPolicies } from './check-island-policies.mjs';
import { dependencyAudit } from './release/dependency-audit.mjs';
import { checkHonoxpressConsumer } from './check-honoxpress-consumer.mjs';

export async function checkMarkdownConsumer({ repo, consumer: original, browser, env: originalEnv, tarball, npmCli }) {
  const consumer = join(dirname(original), 'markdown-consumer');
  const stack = consumerStack(originalEnv);
  const env = { ...originalEnv };
  const npm = args => execFileSync(process.execPath, [npmCli, ...args], { cwd: consumer, env, stdio: 'inherit' });
  await rm(consumer, { recursive: true, force: true });
  await cp(join(repo, 'fixtures/markdown'), consumer, { recursive: true });
  await symlink('MarkdownCounter.tsx', join(consumer, 'components/LinkedCounter.tsx'), 'file');
  const overlay = JSON.parse(await readFile(join(consumer, 'parser-lock.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(join(repo, 'fixtures', stack.fixture, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(repo, 'fixtures', stack.fixture, 'package-lock.json'), 'utf8'));
  Object.assign(pkg.devDependencies, overlay.devDependencies);
  Object.assign(lock.packages[''].devDependencies, overlay.devDependencies);
  for (const [name, entry] of Object.entries(overlay.packages)) {
    if (lock.packages[name] !== undefined) assert.deepEqual(lock.packages[name], entry, `Review parser lock collision with ${name}`);
    lock.packages[name] = entry;
  }
  await writeFile(join(consumer, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(join(consumer, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  npm(['ci', '--no-audit', '--no-fund']);
  npm(['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', originalEnv.HONO_MARKDOWN_PACKAGE, tarball]);
  execFileSync(process.execPath, ['--input-type=module', '-e', String.raw`
    import assert from 'node:assert/strict';
    import { compileMarkdownModule } from '@ts-76/hono-markdown/compiler';
    const source = '<script>import Counter from "../../components/MarkdownCounter.tsx" with { island: "load" };</script>\n<Counter onclick="bad()" />';
    await assert.rejects(compileMarkdownModule(source, { sourcePath: process.cwd() + '/pages/docs/security.md', options: { highlight: false } }), /invalid or reserved component attribute onclick/);
    console.log('Installed common Markdown compiler rejects event-handler island attributes.');
  `], { cwd: consumer, env, stdio: 'inherit' });
  const consumerManifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'));
  for (const name of ['markdown-exit', 'markdown-it-container']) {
    assert.equal(consumerManifest.dependencies?.[name] ?? consumerManifest.devDependencies?.[name], undefined, 'Parser setup must be transitive');
  }
  const optionalReport = dependencyAudit({ npmCli, cwd: consumer, env, output: join(consumer, 'markdown-audit.json') });
  for (const name of ['markdown-exit', 'yaml', 'shiki', '@shikijs/transformers', 'markdown-it-container', 'entities', 'linkify-it', 'mdurl', 'punycode.js', 'uc.micro']) assert.equal(optionalReport.vulnerabilities[name], undefined, `New parser advisory: ${name}`);
  if (originalEnv.RELEASE_CONSUMER_AUDIT) await cp(join(consumer, 'markdown-audit.json'), originalEnv.RELEASE_CONSUMER_AUDIT.replace(/\.json$/, '-markdown.json'));
  execFileSync(process.execPath, ['node_modules/void/dist/cli/cli.mjs', 'prepare'], { cwd: consumer, env, stdio: 'inherit' });
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, env, stdio: 'inherit' });
  const build = () => execFileSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, stdio: ['ignore', 'pipe', 'pipe'] });
  async function port() { const server = netServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const number = server.address().port; await new Promise(resolve => server.close(resolve)); return number; }
  async function withServer(mode, check) {
    const number = await port();
    const child = spawn(process.execPath, launcherArgs(consumer, mode === 'development' ? 'dev' : 'preview', ['--host', '127.0.0.1', '--port', String(number), '--strictPort'], env), { cwd: consumer, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs = (logs + data).slice(-32000); });
    const origin = `http://127.0.0.1:${number}`;
    try {
      const deadline = Date.now() + 60000;
      while (true) {
        if (child.exitCode !== null) throw new Error(logs);
        try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
        if (Date.now() > deadline) throw new Error('Markdown server did not start: ' + logs);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      await check(origin, mode);
    } catch (error) { console.error(logs.slice(-8000)); throw error; }
    finally {
      if (child.exitCode === null) {
        const exited = new Promise(resolve => child.once('exit', resolve));
        const stop = signal => { try { process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
        stop('SIGTERM'); await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
        if (child.exitCode === null) { stop('SIGKILL'); await exited; }
      }
    }
  }
  async function checkPages(origin, mode) {
    const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      const html = await (await fetch(origin + '/docs/interactive?name=Alice')).text();
      assert.match(html, mode === 'static' ? /id="markdown-loader">Loader visitor<\/output>/ : /id="markdown-loader">Loader Alice<\/output>/);
      assert.match(html, /id="markdown-layout-title"[^>]*>Interactive Markdown<\/header>/); assert.match(html, /data-hydrate="load"/); assert.match(html, /id="first-value">4/);
      assert.match(html, /id="first-frontmatter">Interactive Markdown<\/output>/);
      assert.match(html, mode === 'static' ? /<title>Dynamic Loader visitor<\/title>/ : /<title>Dynamic Loader Alice<\/title>/);
      await page.goto(origin); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      await page.evaluate(() => { window.markdownDocument = 1; });
      await page.locator('#markdown-link').click(); await page.waitForURL('**/docs/interactive');
      assert.equal(await page.evaluate(() => window.markdownDocument), undefined, 'Markdown uses document navigation');
      await page.waitForFunction(() => document.getElementById('markdown-script')?.textContent === 'active page script');
      await page.locator('[data-hono-island] #first-increment').click();
      await page.waitForFunction(() => document.getElementById('first-value')?.textContent === '5');
      assert.equal(await page.locator('#second-value').textContent(), '9');
      assert.equal(await page.locator('#first-frontmatter').textContent(), 'Interactive Markdown');
      assert.equal(await page.evaluate(() => window.markdownScriptRuns), 1);
      assert.equal(await page.evaluate(() => window.wrongMarkdownScript), undefined);
      await page.reload(); await page.locator('[data-hono-island] #first-increment').waitFor();
      assert.equal(await page.locator('#first-value').textContent(), '4');
      await page.locator('#markdown-back').click(); await page.waitForURL(origin + '/'); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      const scripts = []; const listener = request => { if (request.resourceType() === 'script') scripts.push(request.url()); }; page.on('request', listener);
      await page.goto(origin + '/docs/plain');
      assert.equal(await page.locator('#markdown-layout-title').textContent(), 'Plain </script> Markdown');
      assert.equal(await page.locator('#markdown-layout-title').evaluate(node => getComputedStyle(node).borderTopWidth), '3px');
      assert.equal(await page.locator('script[src],link[rel="modulepreload"]').count(), 0); assert.deepEqual(scripts, []);
      assert.equal(await page.locator('#markdown-headings').textContent(), 'plain-markdown,repeated-heading,repeated-heading-1');
      assert.equal(await page.evaluate(() => window.markdownInjected), undefined);
      assert.equal(await page.locator('table td').first().textContent(), 'one');
      page.off('request', listener);
      await page.goto(origin + '/docs/named'); assert.equal(await page.locator('#markdown-named-title').textContent(), 'Named Markdown');
      assert.equal(await page.locator('#markdown-layout').count(), 0, 'Named layout replaces the nested default chain');
      assert.equal(await page.locator('script[src]').count(), 0);
      await page.goto(origin + '/docs/layout-counter'); await page.locator('[data-hono-island] #layout-increment').click();
      await page.waitForFunction(() => document.getElementById('layout-value')?.textContent === '3');
      assert.equal(await page.locator('#layout-frontmatter').textContent(), 'Layout counter');
      await page.goto(origin + '/docs/linked');
      await page.locator('[data-hono-island] #linked-increment').click();
      assert.equal(await page.locator('#linked-value').textContent(), '3');
      assert.equal(await page.locator('#linked-frontmatter').textContent(), 'Linked Markdown');
      assert.match(await page.locator('[data-island]').getAttribute('data-island'), /components\/MarkdownCounter\.tsx$/);
      const scriptRequests = []; const scriptListener = request => { if (request.resourceType() === 'script') scriptRequests.push(request.url()); }; page.on('request', scriptListener);
      await page.goto(origin + '/docs/script-only'); await page.waitForFunction(() => window.onlyMarkdownScript === true);
      assert.equal(await page.locator('#script-only').textContent(), 'script-only ready');
      assert.equal(await page.evaluate(() => window.wrongMarkdownScript), undefined);
      assert.ok(scriptRequests.every(url => !url.includes('islands-client') && !url.includes('jsx-') && !url.includes('pages-client')), 'Script-only Markdown must not load framework entries');
      page.off('request', scriptListener);
      await checkIslandPolicies({ origin, page, assert });
      if (mode === 'development') {
        const file = join(consumer, 'pages/docs/interactive.md'); const source = await readFile(file, 'utf8');
        await page.goto(origin + '/docs/interactive'); await page.waitForFunction(() => document.getElementById('markdown-script')?.textContent === 'active page script');
        try {
          await writeFile(file, source.replace('Interactive Markdown', 'Edited Markdown').replace('active page script', 'edited script'));
          await page.waitForFunction(() => document.getElementById('markdown-layout-title')?.textContent === 'Edited Markdown' && document.getElementById('markdown-script')?.textContent === 'edited script');
        } finally { await writeFile(file, source); }
        await page.waitForFunction(() => document.getElementById('markdown-layout-title')?.textContent === 'Interactive Markdown' && document.getElementById('markdown-script')?.textContent === 'active page script');
        // Leave the HMR-connected page before triggering structural changes.
        await page.goto(origin + '/docs/plain');
        assert.equal(await page.locator('script[src]').count(), 0);
        const added = join(consumer, 'pages/docs/snapshot-added.md');
        const authored = '<script>window.dynamicMarkdown = true; document.getElementById("dynamic-markdown").textContent = "script active";</script>\n# Added snapshot\n<div id="dynamic-markdown">SSR</div>\n';
        const waitForRoute = async (present, script) => {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            const response = await fetch(origin + '/docs/snapshot-added');
            const html = await response.text();
            if (present ? response.ok && html.includes('dynamic-markdown') && html.includes('data-md-script=') === script : response.status === 404) return;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('Markdown route snapshot did not update');
        };
        try {
          await writeFile(added, authored); await waitForRoute(true, true);
          await page.goto(origin + '/docs/snapshot-added');
          await page.waitForFunction(() => window.dynamicMarkdown === true && document.getElementById('dynamic-markdown')?.textContent === 'script active');
          await writeFile(added, '# No script\n<div id="dynamic-markdown">SSR</div>\n');
          // Script-only and zero-script pages omit the HMR client. Check a fresh document.
          await waitForRoute(true, false); await page.reload();
          assert.equal(await page.locator('#dynamic-markdown').textContent(), 'SSR');
          assert.equal(await page.locator('script[src],link[rel="modulepreload"]').count(), 0);
          await writeFile(added, authored); await waitForRoute(true, true); await page.reload();
          await page.waitForFunction(() => window.dynamicMarkdown === true && document.getElementById('dynamic-markdown')?.textContent === 'script active');
          await page.goto(origin + '/docs/plain');
          await rm(added); await waitForRoute(false);
          assert.equal(await page.locator('script[src],link[rel="modulepreload"]').count(), 0);
        } finally { await rm(added, { force: true }); }
      }
      assert.deepEqual(errors, []);
      console.log(`Markdown ${mode}: SSR/loader/head, layouts/frontmatter, independent islands/context, native TSX roundtrip, page scripts/zero-script pages and scheduling passed.`);
    } finally { await page.close(); }
  }
  async function checkFeatures(origin, mode) {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); const errors = []; const scripts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    try {
      await page.goto(origin + '/docs/features');
      await page.locator('.language-ts > button.copy').waitFor();
      assert.equal(await page.locator('.custom-block').count(), 5);
      assert.equal(await page.locator('.tip .custom-block-title strong').textContent(), 'Helpful title');
      const details = page.locator('details.custom-block');
      assert.equal(await details.evaluate(element => element.open), false);
      await details.locator('summary').click(); assert.equal(await details.evaluate(element => element.open), true);
      assert.equal(await page.evaluate(() => window.markdownInjected), undefined);
      assert.match(await page.locator('.language-unknown-language code').textContent(), /<script>window.markdownInjected = true<\/script>/);
      assert.equal(await page.locator('.language-unknown-language [data-island]').count(), 0);
      assert.equal(await page.locator('.line-number').first().textContent(), '5');
      const button = page.locator('.language-ts > button.copy');
      await button.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.language-ts > button.copy')?.classList.contains('copied'));
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'const after = 2');
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; const outside = document.createElement('p'); outside.id='outside-theme'; outside.textContent='Outside';  document.body.append(outside); });
      const scope = await page.evaluate(() => {
        const element = document.getElementById('outside-theme');
        const measure = () => { const style=getComputedStyle(element); return [style.color,style.backgroundColor,style.fontFamily,style.fontSize,style.lineHeight,style.marginTop,style.borderTopWidth]; };
        const enabled=measure();const sheets=Array.from(document.styleSheets);const states=sheets.map(sheet=>sheet.disabled);
        sheets.forEach(sheet=>{sheet.disabled=true;});const disabled=measure();sheets.forEach((sheet,index)=>{sheet.disabled=states[index];});
        return {enabled,disabled};
      });
      assert.deepEqual(scope.enabled, scope.disabled, 'content-only CSS must not restyle outside content');
      const token = page.locator('.language-ts .line span[style]').first();
      const light = await token.evaluate(element => getComputedStyle(element).color);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      assert.notEqual(await token.evaluate(element => getComputedStyle(element).color), light);
      assert.equal(await page.locator('#outside-theme').evaluate(element => getComputedStyle(element).color), scope.enabled[0]);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      assert.equal(await token.evaluate(element => getComputedStyle(element).color), light, 'explicit light overrides system dark');
      await page.evaluate(() => { delete document.documentElement.dataset.theme; });
      assert.notEqual(await token.evaluate(element => getComputedStyle(element).color), light, 'auto follows system dark');
      for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Markdown overflow at ${width}`); }
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await button.click();
      await page.waitForFunction(() => document.querySelector('.language-ts > button.copy')?.classList.contains('copy-error'));
      assert.equal(await button.getAttribute('aria-label'), 'Copy failed');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
      const unavailable = page.locator('.language-unknown-language > button.copy'); await unavailable.click();
      assert.equal(await unavailable.getAttribute('aria-label'), 'Copy failed');
      assert.ok(scripts.length > 0);
      assert.ok(scripts.every(url => !/void-islands-client|islands-client-/.test(url)), 'copy-only documents must not load the island scheduler');
      assert.deepEqual(errors, []);
      console.log(`Markdown ${mode}: official containers, Shiki/notation, clipboard success/failure, scoped light/dark theme and mobile width passed.`);
    } finally { await context.close(); }
  }

  await withServer('development', async (origin, mode) => { await checkPages(origin, mode); await checkFeatures(origin, mode); });
  build(); await withServer('preview', async (origin, mode) => { await checkPages(origin, mode); await checkFeatures(origin, mode); });
  // Exercise the packed adapter against the published common package, whose
  // compiler may not expose the newer clientFrontmatter result property.
  const vitePath = join(consumer, 'vite.config.ts');
  const articlePath = join(consumer, 'pages/docs/interactive.md');
  const originalVite = await readFile(vitePath, 'utf8');
  const originalArticle = await readFile(articlePath, 'utf8');
  try {
    await writeFile(articlePath, originalArticle.replace('title: Interactive Markdown', 'title: Interactive Markdown\ndraft_note: private-client-frontmatter-regression'));
    for (const selection of [['title'], false]) {
      await writeFile(vitePath, originalVite.replace('voidHonoMarkdown()', `voidHonoMarkdown({ clientFrontmatter: ${JSON.stringify(selection)} })`));
      execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, env, stdio: 'inherit' });
      const check = async (origin, mode) => {
        const html = await (await fetch(origin + '/docs/interactive')).text();
        assert.doesNotMatch(html, /private-client-frontmatter-regression/);
        assert.match(html, /id="markdown-layout-title"[^>]*>Interactive Markdown<\/header>/, 'layouts retain full frontmatter');
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin + '/docs/interactive');
          const metadata = JSON.parse(await page.locator('#app').getAttribute('data-hono-markdown'));
          assert.deepEqual(metadata.frontmatter, selection === false ? {} : { title: 'Interactive Markdown' });
          assert.equal(await page.locator('#first-frontmatter').textContent(), selection === false ? 'undefined' : 'Interactive Markdown');
          await page.locator('[data-hono-island] #first-increment').click();
          await page.waitForFunction(() => document.getElementById('first-value')?.textContent === '5');
          assert.equal(await page.locator('#first-frontmatter').textContent(), selection === false ? 'undefined' : 'Interactive Markdown');
          const layoutHtml = await (await fetch(origin + '/docs/layout-counter')).text();
          assert.match(layoutHtml, new RegExp(`id="layout-frontmatter">${selection === false ? 'undefined' : 'Layout counter'}<`), 'layout islands use browser frontmatter during SSR');
          await page.goto(origin + '/docs/layout-counter');
          await page.locator('[data-hono-island] #layout-increment').click();
          await page.waitForFunction(() => document.getElementById('layout-value')?.textContent === '3');
          assert.equal(await page.locator('#layout-frontmatter').textContent(), selection === false ? 'undefined' : 'Layout counter');
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
        console.log(`Markdown ${mode}: published common compiler, clientFrontmatter ${JSON.stringify(selection)}, complete layout metadata and SSR/hydration isolation passed.`);
      };
      await withServer('development', check);
      build(); await withServer('preview', check);
    }
  } finally {
    await writeFile(vitePath, originalVite);
    await writeFile(articlePath, originalArticle);
  }
  await writeFile(join(consumer, 'void.config.ts'), "import { defineConfig } from 'void/config'; export default defineConfig({ output: 'static', cloudflare: { name: 'hono-markdown-static' }, head: { link: [{ rel: 'icon', href: 'data:,' }] } });");
  build();
  const output = join(consumer, 'dist/client');
  for (const file of ['docs/plain.html', 'docs/interactive.html', 'docs/named.html', 'docs/script-only.html', 'docs/features.html', 'policies.html']) await access(join(output, file));
  const plain = await readFile(join(output, 'docs/plain.html'), 'utf8');
  assert.match(plain, /border-top:3px solid rgb\(12,34,56\)/);
  assert.doesNotMatch(plain, /<script[^>]+src=|rel="modulepreload"/); assert.match(plain, /Plain &lt;\/script&gt; Markdown/);
  // Browser validation below is served by files only, without a worker.
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = join(output, decodeURIComponent(pathname === '/' ? 'index.html' : pathname.slice(1)));
    if (relative(output, file).startsWith('..')) { response.writeHead(404).end(); return; }
    try { const resolved = extname(file) ? file : file + '.html'; const body = await readFile(resolved); response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(resolved)] ?? 'application/octet-stream' }).end(body); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { const origin = `http://127.0.0.1:${server.address().port}`; await checkPages(origin, 'static'); await checkFeatures(origin, 'static'); }
  finally { await new Promise(resolve => server.close(resolve)); }
  const assets = await readdir(join(output, 'assets'));
  for (const file of assets.filter(file => file.endsWith('.js'))) assert.doesNotMatch(await readFile(join(output, 'assets', file), 'utf8'), /Plain &lt;|No browser JavaScript|require\(["']yaml|markdown-exit|createHighlighter|vscode-textmate|markdown-it-container/);
  await checkHonoxpressConsumer({ repo, consumer, browser, withServer, build, prepare() {
    execFileSync(process.execPath, ['node_modules/void/dist/cli/cli.mjs', 'prepare'], { cwd: consumer, env, stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, env, stdio: 'inherit' });
  } });
  console.log(`Optional Markdown consumer ${stack.name}, Void ${stack.void}, ${stack.launcher} host ${stack.hostVite}: packed artifact, pinned parsers, dev/build/preview/static and parser audit passed.`);
}
