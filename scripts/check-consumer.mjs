import { checkMultipartConsumer } from './check-multipart-consumer.mjs';
import { checkMarkdownConsumer } from './check-markdown-consumer.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectTarball } from './release/gate.mjs';
import { inspectSourceMaps } from './release/source-maps.mjs';
import { dependencyAudit } from './release/dependency-audit.mjs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseSync } from 'vite';
import { checkTransitionConsumer } from './check-transition-consumer.mjs';
import { checkDeferredConsumer } from './check-deferred-consumer.mjs';
import { checkStaticConsumer } from './check-static-consumer.mjs';
import { checkDevelopmentConsumer } from './check-development-consumer.mjs';
import { checkCompatibilityConsumer } from './check-compatibility-consumer.mjs';
import { consumerStack, launcherArgs } from './consumer-launcher.mjs';
import { checkIslandForms } from './check-island-forms.mjs';
import { checkIslandGraph } from './check-island-graph.mjs';
import { checkIslandPolicies } from './check-island-policies.mjs';
import { checkFormConsumer } from './check-form-consumer.mjs';
import { checkLinkConsumer } from './check-link-consumer.mjs';
import { checkIsrConsumer } from './check-isr-consumer.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run check:consumer.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 21)) throw new Error('Consumer validation requires Node >=24.21.0.');
const temporary = await mkdtemp(join(tmpdir(), 'hono-pages-consumer-'));
const consumer = join(temporary, 'consumer');
const env = { ...process.env, PATH: dirname(process.execPath) + (process.platform === 'win32' ? ';' : ':') + (process.env.PATH || ''), WRANGLER_LOG_PATH: join(temporary, 'logs'), WRANGLER_SEND_METRICS: 'false', VOID_INSPECTOR_PORT: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
await mkdir(env.WRANGLER_LOG_PATH);
function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}
async function smoke(mode, browser, staticOnly = false) {
  const number = await port();
  const args = launcherArgs(consumer, mode === 'preview' ? 'preview' : 'dev', ['--host', '127.0.0.1', '--port', String(number), '--strictPort'], env);
  const child = spawn(process.execPath, args, { cwd: consumer, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (data) => { logs = (logs + data).slice(-64000); });
  child.stderr.on('data', (data) => { logs = (logs + data).slice(-64000); });
  const origin = `http://127.0.0.1:${number}`;
  try {
    let ready = false;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${mode} exited: ${logs}`);
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          const html = await response.text();
          if (staticOnly) assert.match(html, /Static Hono island page/);
          else {
            assert.match(html, /<output[^>]*id="count"[^>]*>5<\/output>/);
            assert.match(html, /Clean package consumer/);
          }
          ready = true;
          break;
        }
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, `${mode} did not become ready: ${logs.slice(-5000)}`);
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !((message.location().url.endsWith('/links?fail') || message.location().url.endsWith('/forms?fail') || message.location().url.endsWith('/island-forms?fail') || message.location().url.endsWith('/transitions?value=error')) && message.text().includes('500') || message.location().url.endsWith('/forms?quota') && message.text().includes('429') || (message.location().url.endsWith('/island-forms?save') || message.location().url.endsWith('/multipart?upload') || message.location().url.endsWith('/multipart-island?upload')) && message.text().includes('422'))) errors.push(message.text()); });
    try {
      const staticScripts = [];
      if (staticOnly) page.on('request', (request) => { if (request.resourceType() === 'script') staticScripts.push(request.url()); });
      await page.goto(origin);
      if (staticOnly) {
        await page.locator('#static-only').waitFor();
        assert.equal(await page.locator('script[src], link[rel="modulepreload"]').count(), 0);
        assert.deepEqual(staticScripts, []);
        assert.deepEqual(errors, []);
        console.log('Static-only package consumer preview: server content and zero JavaScript requests passed.');
        return;
      }
      await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      assert.equal(await page.locator('#count').textContent(), '5');
      assert.equal(await page.locator('#runtime-hooks').textContent(), '/:0:0:0:Consumer');
      await page.locator('#increment').click();
      await page.waitForFunction(() => document.querySelector('#count')?.textContent === '6');
      await page.evaluate(() => { window.consumerDocument = 123; });
      await page.locator('#other').click();
      await page.locator('#other-heading').waitFor();
      await page.waitForURL('**/other');
      assert.equal(await page.evaluate(() => window.consumerDocument), 123);
      await page.locator('#home').click();
      await page.waitForURL(origin + '/');
      assert.equal(await page.locator('#count').textContent(), '5');
      await page.reload();
      await page.locator('#app[data-hono-pages="mounted"]').waitFor();
      assert.equal(await page.locator('#count').textContent(), '5');
      if (mode === 'development') await checkDevelopmentConsumer({ origin, page, consumer, assertRunning: () => { assert.equal(child.exitCode, null); assert.equal(child.signalCode, null); assert.doesNotMatch(logs, /server restarted|restarting server/i); } });
      await checkLinkConsumer({ origin, page, assert });
      await checkFormConsumer({ origin, page, assert });
      await checkMultipartConsumer({ origin, page, assert });
      await checkIslandPolicies({ origin, page, assert });
      await checkIslandGraph({ origin, page, assert, mode, consumer });
      await checkIslandForms({ origin, page, assert });
      await checkDeferredConsumer({ origin, page, mode });
      await checkTransitionConsumer({ origin, page });
      const islandResponse = await fetch(origin + '/islands');
      assert.equal(islandResponse.status, 200);
      const islandHtml = await islandResponse.text();
      assert.match(islandHtml, /STATIC_ISLAND_PAGE_SENTINEL/);
      assert.match(islandHtml, /id="island-count"[^>]*>9<\/output>/);
      assert.match(islandHtml, /data-hydrate="load"/);
      await page.evaluate(() => { window.consumerDocument = 321; });
      await page.locator('#islands-link').click();
      await page.waitForURL('**/islands');
      assert.equal(await page.evaluate(() => window.consumerDocument), undefined);
      await page.locator('[data-hono-island="mounted"]').waitFor();
      const marker = page.locator('[data-island]');
      const props = JSON.parse(await marker.getAttribute('data-props'));
      assert.equal(props.initialCount, 9);
      assert.equal(await page.locator('#island-message').textContent(), props.message);
      assert.equal(await page.evaluate(() => window.islandInjected), undefined);
      await page.locator('#island-increment').click();
      await page.waitForFunction(() => document.querySelector('#island-count')?.textContent === '10');
      await page.reload();
      await page.locator('[data-hono-island="mounted"]').waitFor();
      assert.equal(await page.locator('#island-count').textContent(), '9');
      assert.equal(await page.locator('#static-island-content').textContent(), 'STATIC_ISLAND_PAGE_SENTINEL');
      const scripts = [];
      page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
      await page.goto(origin + '/static');
      await page.locator('#static-only').waitFor();
      assert.equal(await page.locator('script[src], link[rel="modulepreload"]').count(), 0);
      assert.deepEqual(scripts, []);
      assert.deepEqual(errors, []);
    } catch (error) { console.error(logs.slice(-5000)); throw error; } finally { await page.close(); }
    console.log(`Packed consumer ${mode}: SSR, runtime exports, click, SPA navigation, reset, reload, load-policy islands, safe props and static-only zero-script rendering passed.`);
  } finally {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      const stop = (signal) => {
        try {
          if (process.platform === 'win32') child.kill(signal);
          else process.kill(-child.pid, signal);
        } catch (error) { if (error.code !== 'ESRCH') throw error; }
      };
      stop('SIGTERM');
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
      if (child.exitCode === null && child.signalCode === null) { stop('SIGKILL'); await exited; }
    }
  }
}
try {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--tarball'), 'Use --tarball <accepted artifact>');
  let tarball;
  if (args.length) {
    tarball = resolve(args[1]);
  } else {
    execFileSync(process.execPath, ['scripts/build-package.mjs'], { cwd: repo, stdio: 'inherit' });
    const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], join(repo, 'packages/hono-pages')));
    assert.equal(packed.length, 1);
    tarball = join(temporary, packed[0].filename);
  }
  const digest = async () => createHash('sha256').update(await readFile(tarball)).digest('hex');
  const acceptedDigest = await digest();
  const entries = inspectTarball(tarball);
  const metadata = JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }));
  const expected = JSON.parse(await readFile(join(repo, 'packages/hono-pages/package.json'), 'utf8'));
  assert.deepEqual(metadata, args.length ? { ...expected, private: false } : expected, 'Unexpected consumer artifact metadata');
  await cp(join(repo, 'fixtures/consumer'), consumer, { recursive: true, filter: (path) => !path.includes('node_modules') && !path.includes('/.void') && !path.includes('/dist') });
  const stack = consumerStack(env);
  if (stack.fixture !== 'consumer') {
    for (const file of ['package.json', 'package-lock.json']) await cp(join(repo, 'fixtures', stack.fixture, file), join(consumer, file));
  }
  console.log(`Tarball audit passed. Installing locked consumer ${stack.name}: Void ${stack.void}, npm Vite ${stack.vite}, ${stack.launcher} host ${stack.hostVite}.`);
  npm(['ci', '--no-audit', '--no-fund'], consumer);
  npm(['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', tarball], consumer);
  assert.equal((await readdir(join(consumer, 'node_modules'))).includes('markdown-exit'), false, 'Ordinary consumers must not install the optional Markdown parser');
  if (env.RELEASE_CONSUMER_AUDIT) dependencyAudit({ npmCli, cwd: consumer, env, output: env.RELEASE_CONSUMER_AUDIT });
  const installedContents = new Map();
  for (const file of entries) {
    const installed = await readFile(join(consumer, 'node_modules', expected.name, file), 'utf8');
    assert.equal(installed, execFileSync('tar', ['-xOzf', tarball, 'package/' + file], { encoding: 'utf8' }), `Installed artifact changed: ${file}`);
    installedContents.set(file, installed);
  }
  inspectSourceMaps(installedContents);
  console.log('Installed source/declaration maps resolve to the exact packaged TypeScript sources.');
  console.log('Checking consumer declarations and browser rendering.');
  execFileSync(process.execPath, ['node_modules/void/dist/cli/cli.mjs', 'prepare'], { cwd: consumer, env, stdio: 'inherit' });
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, stdio: 'inherit' });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  try {
    await smoke('development', browser);
    execFileSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const assets = join(consumer, 'dist/client/assets');
    for (const file of await readdir(assets)) {
      if (!file.endsWith('.js')) continue;
      const code = await readFile(join(assets, file), 'utf8');
      assert.doesNotMatch(code, /STATIC_ISLAND_PAGE_SENTINEL|STATIC_ONLY_PAGE_SENTINEL/, `Static page leaked into client bundle: ${file}`);
    }
    await smoke('preview', browser);
    await rm(join(consumer, 'pages'), { recursive: true });
    await mkdir(join(consumer, 'pages'));
    await cp(join(repo, 'fixtures/consumer/pages/static.island.tsx'), join(consumer, 'pages/index.island.tsx'));
    await cp(join(repo, 'fixtures/consumer/components/StaticLayout.island.tsx'), join(consumer, 'pages/layout.island.tsx'));
    execFileSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const file of await readdir(assets)) {
      if (!file.endsWith('.js')) continue;
      const code = await readFile(join(assets, file), 'utf8');
      const body = parseSync(file, code).program.body;
      assert.ok(body.every((node) => node.type === 'ExportNamedDeclaration' && !node.declaration && !node.specifiers.length), `Static-only build contains executable client code: ${file}`);
    }
    console.log('Static-only client assets: no executable statements or framework imports.');
    await smoke('preview', browser, true);
    await checkStaticConsumer({ repo, consumer, browser, env });
    await checkCompatibilityConsumer({ consumer, env, stack });
    await checkIsrConsumer({ repo, consumer, browser, env });
    await checkMarkdownConsumer({ repo, consumer, browser, env, tarball, npmCli });
  } finally { await browser.close(); }
  assert.equal(await digest(), acceptedDigest, 'Accepted artifact changed during validation');
  console.log(`Package audit passed: ${entries.length} intended files; declarations and locked clean-consumer checks passed.`);
} catch (error) {
  console.error(process.env.KEEP_CONSUMER_FIXTURE ? `Consumer validation failed. Retained workspace: ${consumer}` : 'Consumer validation failed. Set KEEP_CONSUMER_FIXTURE=1 to retain the workspace.');
  throw error;
} finally {
  if (!process.env.KEEP_CONSUMER_FIXTURE) await rm(temporary, { recursive: true, force: true });
}
