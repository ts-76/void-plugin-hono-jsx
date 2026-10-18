import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { observePurge } from './isr-purge-observation.mjs';

// Explicit opt-in: this runner mutates only the dedicated, key-protected fixture.
const [originArg, keyFile, reportFile, revision = 'first', phase = 'matrix'] = process.argv.slice(2);
if (!originArg || !keyFile || !reportFile || !['matrix', 'redeploy', 'concurrency', 'purge', 'purge-all'].includes(phase)) {
  throw new Error('Usage: node scripts/check-isr-cloudflare.mjs ORIGIN KEY_FILE REPORT_FILE REVISION [matrix|redeploy|concurrency|purge|purge-all]');
}
const origin = new URL(originArg);
assert.ok(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)));
assert.equal(origin.pathname, '/');
assert.equal(origin.search + origin.hash + origin.username + origin.password, '');
const local = origin.protocol === 'http:';
const fixture = 'void-hono-isr-cloudflare-check';
const key = (await readFile(keyFile, 'utf8')).trim();
assert.ok(key.length >= 32 && key.length <= 100);
const report = { fixture, transport: local ? 'normal loopback fetch pool' : 'normal HTTPS fetch pool', origin: origin.origin, revision, phase, started: new Date().toISOString(), observations: [], checks: [], failures: [], limitations: ['One client location; observed CF-Ray locations only', 'No global immediate purge or KV consistency guarantee', 'Synthetic auth headers, not a full authentication provider'] };
report.purges = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let requests = 0;
async function request(path, init = {}) {
  assert.ok(++requests <= 500, 'Request budget exceeded');
  return fetch(new URL(path, origin), { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
async function control(body) {
  const startedAt = Date.now();
  const response = await request('/api/control', { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, 200, `Fixture control failed: ${response.status}`);
  const data = await response.json();
  assert.equal(data.fixture, fixture);
  assert.equal(data.revision, revision);
  if (body?.purge) report.purges.push({ paths: body.purge, startedAt, completedAt: Date.now() });
  if (!body) assert.ok(data.renders.length < 1000, 'Use a fresh fixture; render log limit reached');
  return data;
}
async function page(path, json = false, headers = {}) {
  const startedAt = Date.now();
  const response = await request(path, { headers: { ...headers, ...(json ? { 'X-VoidPages': 'true' } : {}) } });
  const text = await response.text();
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  let props;
  if (json) { assert.match(response.headers.get('content-type') ?? '', /application\/json/); props = JSON.parse(text).props; }
  else {
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    const match = text.match(/<script[^>]*id="__VOID_PAGE_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(match, `${path}: embedded page data missing`);
    props = JSON.parse(match[1]).props;
    assert.doesNotMatch(text, /<script>window\.isrInjected/);
  }
  assert.equal(props.fixture, fixture);
  assert.equal(props.revision, revision);
  const observation = { path, json, cache: response.headers.get('x-isr-cache'), version: props.version, renderId: props.renderId, viewer: props.viewer, revision: props.revision, kind: props.kind, unlisted: props.unlisted, colo: response.headers.get('cf-ray')?.split('-').at(-1) ?? 'local', privacy: response.headers.get('cache-control'), vary: response.headers.get('vary'), setCookie: response.headers.has('set-cookie') };
  Object.assign(observation, { startedAt, completedAt: Date.now() });
  report.observations.push(observation);
  return { ...observation, props, text };
}
async function until(check, label, timeout = 90000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value && Date.now() <= end) return value; await delay(1100); }
  throw new Error(`Timed out: ${label}`);
}
async function checkpoint(name, details = {}) {
  report.checks.push({ name, ...details });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`PASS ${name}`);
}
async function reset(path, patch = {}) {
  await control({ path, version: 1, fail: false, privacy: 'public', delayMs: 0, ...patch });
  await control({ purge: [path] });
}
async function fresh(path) {
  return until(async () => { const value = await page(path); return value.cache === 'HIT' && value; }, `${path} HIT`);
}
async function afterPurge(paths, expected) {
  const completedAt = report.purges.at(-1).completedAt;
  const results = await Promise.allSettled(paths.map(async path => {
    try {
      const result = await observePurge({ path, expected, completedAt, read: page });
      report.checks.push(result.observation);
      return result.value;
    } catch (error) {
      report.checks.push(error.purgeObservation);
      throw error;
    }
  }));
  const failures = results.filter(result => result.status === 'rejected');
  assert.equal(failures.length, 0, failures.map(result => result.reason.message).join('; '));
}
async function queryChecks() {
    await reset('/query');
    const a = await page('/query?kind=a'); const b = await page('/query?kind=b');
    assert.equal(a.props.kind, 'a'); assert.equal(b.props.kind, 'b');
    await fresh('/query?kind=a'); await fresh('/query?kind=b');
    assert.equal((await page('/query?kind=a', true)).renderId, a.renderId);
    assert.equal((await page('/query?kind=b', true)).renderId, b.renderId);
    const unlisted = await page('/query?kind=c&unlisted=x');
    const unlistedAgain = await page('/query?kind=c&unlisted=x');
    assert.notEqual(unlisted.renderId, unlistedAgain.renderId);
    const normalized = await page('/query?kind=a&unlisted=x'); assert.equal(normalized.renderId, a.renderId); assert.equal(normalized.unlisted, '');
    await control({ path: '/query', version: 2 }); await control({ purge: ['/query'] });
    await afterPurge(['/query?kind=a', '/query?kind=b'], 2);
    for (const kind of ['a', 'b']) {
      await fresh(`/query?kind=${kind}`); assert.equal((await page(`/query?kind=${kind}`, true)).version, 2);
    }
    await checkpoint('query allowlist isolation, unlisted query boundary and path purge of variants');
}
async function purgeAllChecks() {
    for (const path of ['/all-a', '/all-b']) { await reset(path); await page(path); await fresh(path); await control({ path, version: 2 }); }
    await control({ purge: 'all' });
    await afterPurge(['/all-a', '/all-b'], 2);
    for (const path of ['/all-a', '/all-b']) { await fresh(path); assert.equal((await page(path, true)).version, 2); }
    await checkpoint('purge all through public void/isr API');
}
async function observe(name, check) {
  try { await check(); } catch (error) {
    report.failures.push({ name, error: error.message });
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
async function purgeChecks() {
  await observe('query variants and path purge', queryChecks);
  await observe('purge all', purgeAllChecks);
}
async function concurrentCold() {
  await reset('/concurrent', { delayMs: 250 });
  const before = (await control()).renders.filter(row => row.path === '/concurrent').length;
  const parallel = await Promise.all(Array.from({ length: 4 }, () => page('/concurrent')));
  const after = (await control()).renders.filter(row => row.path === '/concurrent').length;
  assert.ok(parallel.every(value => value.version === 1 && value.viewer === 'anonymous'));
  await fresh('/concurrent');
  await checkpoint('four concurrent cold requests return valid public content', { renders: after - before, distinctRenderIds: new Set(parallel.map(value => value.renderId)).size });
}
async function primeRedeploy() {
  await reset('/redeploy'); const redeploy = await page('/redeploy'); await fresh('/redeploy');
  await checkpoint('first deployment cache primed for redeployment check', { renderId: redeploy.renderId });
}
async function concurrentRegeneration() {
  await reset('/page', { delayMs: 250 });
  await page('/page'); await fresh('/page');
  const before = (await control()).renders.filter(row => row.path === '/page').length;
  await control({ path: '/page', version: 2 }); await delay(4400);
  const parallel = await Promise.all(Array.from({ length: 4 }, () => page('/page')));
  assert.ok(parallel.every(value => [1, 2].includes(value.version) && value.viewer === 'anonymous'));
  await until(async () => (await page('/page')).version === 2, 'concurrent stale regeneration');
  await delay(1100);
  const after = (await control()).renders.filter(row => row.path === '/page').length;
  await checkpoint('four concurrent expired requests; eventual new content', { renders: after - before, cacheStates: parallel.map(value => value.cache) });
}
try {
  const statusResponse = await request('/api/status');
  assert.equal(statusResponse.status, 200);
  assert.deepEqual(await statusResponse.json(), { fixture, revision });
  assert.equal((await request('/api/control')).status, 403);
  assert.equal((await request('/api/control', { headers: { Authorization: 'Bearer invalid-synthetic-key' } })).status, 403);
  if (!local) {
    assert.equal((await request('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    for (const [contentType, body, expected] of [['text/plain', '{}', 415], ['application/json', '{', 400], ['application/json', JSON.stringify({ padding: 'x'.repeat(2200) }), 413]]) {
      const response = await request('/api/control', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': contentType }, body });
      assert.equal(response.status, expected); await response.arrayBuffer();
    }
    await checkpoint('fixture identity; unauthorized/malformed/oversized controls rejected');
  } else {
    report.skipped = ['Negative POST controls: known local Miniflare reused-connection failure (#62); verify via HTTPS'];
    await checkpoint('fixture identity; unauthorized GET controls rejected (negative POST checks skipped locally)');
  }
  if (phase === 'redeploy') {
    const state = await control();
    assert.ok(state.renders.some(row => row.path === '/redeploy' && row.revision === 'first'), 'D1 rows from first deployment missing');
    const cold = await page('/redeploy');
    assert.equal(cold.cache, 'MISS');
    assert.equal(cold.props.revision, 'second');
    const hit = await fresh('/redeploy');
    assert.equal(hit.renderId, cold.renderId);
    assert.equal((await page('/redeploy', true)).renderId, hit.renderId);
    await checkpoint('new deployment cache scope; retained D1; matching HTML and JSON', { firstRender: cold.renderId });
  } else if (phase === 'purge-all') {
    await observe('purge all', purgeAllChecks);
  } else if (phase === 'purge') {
    await purgeChecks();
  } else if (phase === 'concurrency') {
    await concurrentCold();
    await concurrentRegeneration();
    await primeRedeploy();
  } else {
    await reset('/page');
    const coldJson = await page('/page', true);
    const cold = await page('/page');
    assert.equal(cold.cache, 'MISS');
    assert.notEqual(cold.renderId, coldJson.renderId);
    const hit = await fresh('/page');
    assert.equal(hit.renderId, cold.renderId);
    assert.equal((await page('/page', true)).renderId, hit.renderId);
    await control({ path: '/page', version: 2 });
    assert.equal((await page('/page')).version, 1);
    await delay(4400);
    const stale = await page('/page');
    assert.equal(stale.cache, 'STALE'); assert.equal(stale.version, 1);
    await until(async () => (await page('/page')).version === 2, 'background regeneration');
    await checkpoint('cold JSON renders live; HTML MISS/HIT/STALE; background regeneration');

    await reset('/global'); const global = await page('/global'); await fresh('/global');
    await control({ path: '/global', version: 2 });
    assert.equal((await page('/global')).renderId, global.renderId);
    for (const path of ['/path', '/header-ttl']) {
      await reset(path); await page(path); await fresh(path);
      await control({ path, version: 2 }); await delay(4400);
      const old = await page(path); assert.equal(old.cache, 'STALE'); assert.equal(old.version, 1);
      await until(async () => (await page(path)).version === 2, `${path} regeneration`);
    }
    for (const path of ['/live', '/header-zero']) {
      await reset(path); const one = await page(path); await control({ path, version: 2 });
      const two = await page(path); assert.equal(two.version, 2); assert.notEqual(one.renderId, two.renderId);
    }
    await checkpoint('global/path/page/header TTL and zero policy');

    await reset('/page'); await page('/page'); await fresh('/page');
    const priorFailures = (await control()).renders.filter(row => row.path === '/page' && row.failed && row.version === 3).length;
    await control({ path: '/page', version: 3, fail: true }); await delay(4400);
    assert.equal((await page('/page')).version, 1);
    await until(async () => (await control()).renders.filter(row => row.path === '/page' && row.failed && row.version === 3).length > priorFailures, 'failed regeneration recorded');
    const failed = await page('/page'); assert.equal(failed.cache, 'STALE'); assert.equal(failed.version, 1);
    await control({ path: '/page', fail: false });
    await until(async () => (await page('/page')).version === 3, 'recovery');
    await checkpoint('failed regeneration retains valid stale HTML and recovers');

    await reset('/global'); const anon = await page('/global'); await fresh('/global');
    for (const name of ['Cookie', 'Authorization', 'Cf-Access-Jwt-Assertion']) {
      for (const viewer of ['alice', 'bob']) {
        const value = name === 'Cookie' ? `isr-user=${viewer}` : name === 'Authorization' ? `Bearer synthetic-${viewer}` : `synthetic-${viewer}`;
        for (const json of [false, true]) {
          const personalized = await page('/global', json, { [name]: value });
          assert.equal(personalized.viewer, viewer); assert.notEqual(personalized.renderId, anon.renderId);
        }
      }
    }
    const publicAgain = await page('/global'); assert.equal(publicAgain.viewer, 'anonymous'); assert.equal(publicAgain.renderId, anon.renderId);
    assert.equal((await page('/global', true)).renderId, anon.renderId);
    await checkpoint('cookie/bearer/access header bypass for HTML and JSON; anonymous cache isolated');

    for (const privacy of ['private', 'no-store', 'no-cache', 'set-cookie', 'vary-language', 'vary-star']) {
      await reset('/boundary', { privacy });
      const one = await page('/boundary'); const two = await page('/boundary'); const json = await page('/boundary', true);
      assert.notEqual(one.renderId, two.renderId); assert.notEqual(json.renderId, two.renderId);
      assert.notEqual(two.cache, 'HIT');
    }
    await reset('/boundary'); const publicBoundary = await page('/boundary'); await fresh('/boundary');
    await control({ path: '/boundary', privacy: 'private', version: 9 }); await delay(4400);
    const transition = await page('/boundary'); assert.equal(transition.renderId, publicBoundary.renderId);
    await until(async () => (await page('/boundary')).version === 9, 'private transition invalidates old public cache');
    const privateOne = await page('/boundary'); const privateTwo = await page('/boundary', true);
    assert.notEqual(privateOne.renderId, privateTwo.renderId); assert.equal(privateTwo.version, 9);
    await checkpoint('response privacy opt-outs; public-to-private invalidates both variants after regeneration');

    await purgeChecks();

    await concurrentCold();
    await concurrentRegeneration();
    await primeRedeploy();
  }
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const tab = await browser.newPage(); const errors = []; const navigations = []; const browserColos = new Set();
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('response', response => { const colo = response.headers()['cf-ray']?.split('-').at(-1); if (colo) browserColos.add(colo); if (response.request().headers()['x-voidpages']) navigations.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await tab.goto(new URL('/page', origin).href);
    await tab.locator('#app[data-hono-pages="mounted"]').waitFor();
    assert.equal(await tab.evaluate(() => window.isrInjected), undefined);
    await tab.locator('#isr-counter').click(); await tab.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
    await tab.locator('#global-link').click(); await tab.waitForURL('**/global');
    await tab.waitForFunction(() => document.querySelector('#isr-path')?.textContent === '/global');
    assert.ok(navigations.some(value => value.path === '/global' && value.status === 200));
    assert.deepEqual(errors, []); await tab.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false }); const ssr = await noJs.newPage();
    await ssr.goto(new URL('/global', origin).href); assert.equal(await ssr.locator('#isr-path').textContent(), '/global'); await noJs.close();
    await checkpoint('Chromium mounting, counter, Pages JSON navigation, escaped props and JS-disabled SSR', { browserErrors: errors.length, browserVersion: browser.version(), colos: [...browserColos].sort() });
  } finally { await browser.close(); }
  report.renders = (await control()).renders;
  report.completed = new Date().toISOString(); report.requests = requests;
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`Completed ${report.checks.length} checks; ${report.failures.length} failed scenarios; ${requests} HTTP requests (browser traffic additional).`);
  if (report.failures.length) process.exitCode = 1;
} catch (error) {
  report.failure = error.message; report.requests = requests;
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  throw error;
}
