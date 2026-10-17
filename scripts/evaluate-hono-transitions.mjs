import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

// An experiment on a disposable copy, separate from artifact acceptance checks.
const { values } = parseArgs({ options: { consumer: { type: 'string' }, output: { type: 'string' } } });
if (!values.consumer || !values.output) throw new Error('Usage: node scripts/evaluate-hono-transitions.mjs --consumer <retained baseline consumer> --output <results.json>');
const input = resolve(values.consumer);
const metadata = JSON.parse(await readFile(join(input, 'package.json'), 'utf8'));
assert.equal(metadata.name, 'hono-pages-current-consumer', 'Use the retained baseline check:consumer fixture.');
assert.equal(metadata.private, true);
const scratch = await mkdtemp(join(tmpdir(), 'hono-transition-evaluation-'));
const consumer = join(scratch, 'consumer');
const records = [];
let browser, original;

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  const signal = value => {
    try { process.platform === 'win32' ? child.kill(value) : process.kill(-child.pid, value); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  signal('SIGTERM');
  await Promise.race([ended, new Promise(resolve => setTimeout(resolve, 3000))]);
  if (child.exitCode === null && child.signalCode === null) { signal('SIGKILL'); await ended; }
}

function instrument(source, variant) {
  const replace = (from, to) => {
    assert.equal(source.split(from).length, 2, `Expected one known instrumentation point: ${from}`);
    source = source.replace(from, to);
  };
  replace('useLayoutEffect, useState', 'useLayoutEffect, useState, startTransition, useTransition');
  replace('const [frame, setFrame] = useState(initialFrame);', `const [frame, setFrame] = useState(initialFrame);
    const [honoPending, startHono] = useTransition();
    window.__honoPending = honoPending;`);
  const update = 'setFailed(false); setFrame(next);';
  const wrapped = variant === 'baseline' ? update : `${variant === 'startTransition' ? 'startTransition' : 'startHono'}(() => { ${update} });`;
  replace(`update = (next) => { ${update} };`, `update = (next) => { window.__probeApplied = true; ${wrapped} };`);
  replace('navigation.start();', 'window.__probeRouter = navigation.router; navigation.start();');
  return source;
}

async function inspect(page) {
  return page.evaluate(() => ({
    path: location.pathname,
    navigation: document.querySelector('#app').dataset.navigation,
    honoPending: window.__honoPending,
    done: window.__probeDone,
    fallback: document.querySelector('#deferred-promise')?.textContent,
    immediate: document.querySelector('#deferred-immediate')?.textContent,
  }));
}

try {
  await cp(input, consumer, { recursive: true, dereference: true });
  // The full checker finishes with static/ISR fixtures. Restore shared Pages
  // source only in this copy, keeping the installed candidate and peers.
  const fixture = fileURLToPath(new URL('../fixtures/consumer/', import.meta.url));
  for (const name of ['pages', 'components', 'routes', 'server', '.void', 'dist', '.wrangler']) await rm(join(consumer, name), { recursive: true, force: true });
  for (const name of await readdir(fixture)) {
    if (!['package.json', 'package-lock.json'].includes(name)) await cp(join(fixture, name), join(consumer, name), { recursive: true });
  }
  const client = join(consumer, 'node_modules/void-plugin-hono-jsx/dist/browser/client.js');
  original = await readFile(client, 'utf8');
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', VOID_INSPECTOR_PORT: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_LOG_PATH: join(scratch, 'runtime-logs') };
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  for (const variant of ['baseline', 'startTransition', 'useTransition']) {
    await writeFile(client, instrument(original, variant));
    for (const mode of ['dev', 'preview']) {
      if (mode === 'preview') execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: consumer, env, stdio: 'pipe', timeout: 90000 });
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const args = ['node_modules/vite/bin/vite.js', ...(mode === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort', ...(mode === 'dev' ? ['--force'] : [])];
      const child = spawn(process.execPath, args, { cwd: consumer, env, detached: process.platform !== 'win32', stdio: 'pipe' });
      let logs = '';
      const log = data => { logs = (logs + data).slice(-10000); };
      child.stdout.on('data', log);
      child.stderr.on('data', log);
      let page;
      try {
        let ready = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          try { if ((await fetch(origin + '/transitions', { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch {}
          assert.equal(child.exitCode, null, logs);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        assert.ok(ready, logs);
        page = await browser.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + '/transitions');
        await page.locator('#app[data-hono-pages="mounted"]').waitFor();
        const token = `probe-${variant}-${mode}`;
        await page.evaluate(token => {
          window.__probeDone = false;
          window.__probeApplied = false;
          void window.__probeRouter.visit('/deferred?token=' + token, { viewTransition: false }).then(() => { window.__probeDone = true; });
        }, token);
        await page.waitForFunction(() => window.__probeApplied === true);
        // Producer stays controlled/pending; this is an observation window,
        // not a claim about frame time or performance.
        await page.waitForTimeout(250);
        const pending = await inspect(page);
        const response = await fetch(origin + '/api/deferred-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).released, true);
        await page.waitForFunction(() => document.querySelector('#deferred-promise')?.textContent?.startsWith('Resolved'));
        await page.waitForFunction(() => window.__probeDone === true);
        const resolved = await inspect(page);
        const record = { variant, mode, pending, resolved, errors };
        records.push(record);
        console.log(JSON.stringify(record));
        assert.deepEqual(errors, []);
        assert.equal(resolved.path, '/deferred');
        assert.equal(resolved.navigation, 'idle');
        if (variant === 'startTransition') {
          assert.equal(pending.path, '/transitions');
          assert.equal(pending.navigation, 'loading');
          assert.equal(pending.done, false);
          assert.equal(pending.immediate, undefined);
        } else {
          assert.equal(pending.path, '/deferred');
          assert.equal(pending.navigation, 'idle');
          assert.equal(pending.done, true);
          assert.equal(pending.fallback, 'promise pending');
          assert.equal(pending.honoPending, false);
        }
      } catch (error) { console.error(logs); throw error; }
      finally { await page?.close(); await stop(child); }
    }
  }
} finally {
  await browser?.close();
  try {
    await writeFile(resolve(values.output), JSON.stringify({ hono: metadata.dependencies.hono, void: metadata.devDependencies.void, clientSha256: original && createHash('sha256').update(original).digest('hex'), records }, null, 2));
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
