import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run check:consumer.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 21)) throw new Error('Consumer validation requires Node >=24.21.0.');
const temporary = await mkdtemp(join(tmpdir(), 'hono-pages-consumer-'));
const consumer = join(temporary, 'consumer');
const env = { ...process.env, WRANGLER_LOG_PATH: join(temporary, 'logs'), WRANGLER_SEND_METRICS: 'false', VOID_INSPECTOR_PORT: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
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
async function smoke(mode, browser) {
  const number = await port();
  const args = [join(consumer, 'node_modules/vite/bin/vite.js'), ...(mode === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(number), '--strictPort'];
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
          assert.match(html, /<output[^>]*id="count"[^>]*>5<\/output>/);
          assert.match(html, /Clean package consumer/);
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
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(origin);
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
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
    console.log(`Packed consumer ${mode}: SSR, runtime exports, click, SPA navigation, reset and reload passed.`);
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
  execFileSync(process.execPath, ['scripts/build-package.mjs'], { cwd: repo, stdio: 'inherit' });
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary], join(repo, 'packages/hono-pages')));
  assert.equal(packed.length, 1);
  const entries = packed[0].files.map((entry) => entry.path);
  assert.ok(entries.includes('README.md') && entries.includes('package.json'));
  for (const path of entries) {
    assert.ok(path === 'package.json' || path === 'README.md' || /^dist\/.+\.(js|d\.ts)$/.test(path), `Unexpected packed file: ${path}`);
    const content = await readFile(join(repo, 'packages/hono-pages', path), 'utf8');
    assert.doesNotMatch(content, /\/Users\/|\/private\/|\/nix\/store\/|\.runtime\//, `Machine-specific content: ${path}`);
  }
  await cp(join(repo, 'fixtures/consumer'), consumer, { recursive: true, filter: (path) => !path.includes('node_modules') && !path.includes('/.void') && !path.includes('/dist') });
  console.log('Tarball audit passed. Installing the locked consumer dependencies.');
  npm(['ci', '--no-audit', '--no-fund'], consumer);
  npm(['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', join(temporary, packed[0].filename)], consumer);
  console.log('Checking consumer declarations and browser rendering.');
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, stdio: 'inherit' });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  try {
    await smoke('development', browser);
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: consumer, env, stdio: ['ignore', 'pipe', 'pipe'] });
    await smoke('preview', browser);
  } finally { await browser.close(); }
  console.log(`Package audit passed: ${entries.length} intended files; declarations and locked clean-consumer checks passed.`);
} catch (error) {
  console.error(process.env.KEEP_CONSUMER_FIXTURE ? `Consumer validation failed. Retained workspace: ${consumer}` : 'Consumer validation failed. Set KEEP_CONSUMER_FIXTURE=1 to retain the workspace.');
  throw error;
} finally {
  if (!process.env.KEEP_CONSUMER_FIXTURE) await rm(temporary, { recursive: true, force: true });
}
