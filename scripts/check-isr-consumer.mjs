import { launcherArgs } from './consumer-launcher.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';

export async function checkIsrConsumer({ repo, consumer, browser, env }) {
  for (const directory of ['pages', 'components', 'routes', 'server', 'dist', '.void', '.wrangler']) await rm(join(consumer, directory), { recursive: true, force: true });
  await cp(join(repo, 'fixtures/isr'), consumer, { recursive: true });
  const types = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: consumer, env, encoding: 'utf8' });
  assert.equal(types.status, 0, types.stdout + types.stderr);
  const build = spawnSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, encoding: 'utf8' });
  if (build.error) throw build.error;
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const address = reservation.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, launcherArgs(consumer, 'preview', ['--host', '127.0.0.1', '--port', String(address.port), '--strictPort'], env), { cwd: consumer, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const origin = `http://127.0.0.1:${address.port}`;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const status = async () => (await fetch(origin + '/api/control')).json();
  const update = async (body) => { const response = await fetch(origin + '/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(response.status, 200); };
  const document = async (path = '/') => {
    const response = await fetch(origin + path);
    const html = await response.text();
    assert.equal(response.status, 200, html);
    const payload = html.match(/<script[^>]*id="__VOID_PAGE_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(payload, 'Missing safely serialized page data');
    return { response, html, props: JSON.parse(payload[1]).props };
  };
  async function until(check, message) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) { if (await check()) return; await delay(50); }
    throw new Error(message);
  }
  let page;
  try {
    await until(async () => { if (child.exitCode !== null) throw new Error(logs); try { return (await fetch(origin + '/api/control')).ok; } catch { return false; } }, 'ISR preview did not start');
    const first = await document();
    assert.equal(first.response.headers.get('x-isr-cache'), 'MISS');
    assert.equal(first.props.version, 1);
    assert.match(first.html, /&lt;\/script&gt;/);
    assert.doesNotMatch(first.html, /<script>window\.isrInjected/);
    await until(async () => (await document()).response.headers.get('x-isr-cache') === 'HIT', 'Fresh cache was not populated');
    assert.equal((await status()).renders['/'], 1);
    await document('/global');
    await update({ version: 2 });
    assert.equal((await document()).props.version, 1);
    assert.equal((await status()).renders['/'], 1);
    await delay(1200);
    const stale = await document();
    assert.equal(stale.response.headers.get('x-isr-cache'), 'STALE');
    assert.equal(stale.props.version, 1);
    let regenerated;
    await until(async () => { regenerated = await document(); return regenerated.props.version === 2; }, 'ISR did not regenerate changed loader data');
    assert.equal((await status()).renders['/'], 2);
    assert.equal((await document('/global')).props.version, 1);
    assert.equal((await status()).renders['/global'], 1);
    assert.equal((await document('/live')).props.version, 2);
    await update({ version: 3 });
    assert.equal((await document('/live')).props.version, 3);
    assert.equal((await status()).renders['/live'], 2);
    await update({ fail: true });
    await delay(1200);
    assert.equal((await document()).props.version, 2);
    await until(async () => (await status()).renders['/'] >= 3, 'Failed regeneration was not attempted');
    await delay(100);
    const afterFailure = await document();
    assert.equal(afterFailure.props.version, 2);
    assert.equal(afterFailure.response.headers.get('x-isr-cache'), 'STALE');
    await update({ fail: false });
    await until(async () => (await document()).props.version === 3, 'ISR did not recover after failed regeneration');
    page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    assert.equal(await page.locator('#isr-version').textContent(), '3');
    assert.equal(await page.locator('#isr-message').textContent(), first.props.message);
    assert.equal(await page.evaluate(() => window.isrInjected), undefined);
    await page.locator('#isr-increment').click();
    await page.waitForFunction(() => document.querySelector('#isr-count')?.textContent === '4');
    const assets = [...regenerated.html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g)];
    assert.ok(assets.length > 0, 'Cached HTML must reference the production client assets');
    for (const match of assets) assert.equal((await fetch(origin + match[1])).status, 200);
    assert.deepEqual(errors, []);
    assert.equal(child.exitCode, null);
    console.log('ISR local preview: native KV/Cache API MISS, fresh HIT, expired STALE, background regeneration, per-page/global/zero overrides, safe props/assets and browser mounting passed.');
    console.log('ISR failure: failed regeneration retained stale valid HTML and recovered after the loader succeeded. Managed edge behavior remains unverified.');
  } catch (error) { console.error(logs.slice(-6000)); throw error; } finally {
    if (page) await page.close();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM');
      await Promise.race([exited, delay(3000)]);
      if (child.exitCode === null && child.signalCode === null) { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); await exited; }
    }
  }
}
