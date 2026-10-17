import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Mutates only the explicitly identified temporary synthetic-data fixture.
export async function checkCloudflareConsumer(origin, expectedRevision) {
  const target = new URL(origin);
  assert.ok(target.protocol === 'https:' || target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.pathname, '/');
  const status = await fetch(new URL('/api/status', target));
  assert.equal(status.status, 200);
  const identity = await status.json();
  assert.equal(identity.fixture, 'void-hono-rc-cloudflare-check', 'Refuse writes to another application');
  assert.equal(identity.framework, 'Hono JSX');
  if (expectedRevision) assert.equal(identity.revision, expectedRevision);
  const document = await fetch(target);
  assert.equal(document.status, 200);
  assert.match(await document.text(), /Cloudflare Hono RC/);
  assert.equal(await (await fetch(new URL('/check.txt', target))).text(), 'void-hono-rc-synthetic-asset\n');
  const token = `synthetic-${Date.now()}`;
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(target.href);
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await page.locator('#layout-increment').click();
    await page.waitForFunction(() => document.querySelector('#layout-count')?.textContent === '1');
    await page.evaluate(() => { window.rcDocument = true; });
    await page.locator('#other').click();
    await page.waitForURL(new URL('/other', target).href);
    await page.waitForFunction(() => document.title === 'Other RC page');
    assert.equal(await page.locator('meta[name="rc-page"]').getAttribute('content'), 'other');
    assert.equal(await page.locator('#layout-count').textContent(), '1');
    assert.equal(await page.evaluate(() => window.rcDocument), true);
    await page.locator('#home').click();
    await page.waitForURL(target.href);
    await page.waitForFunction(() => document.title === 'Cloudflare Hono RC');
    await page.locator('#json-save').click();
    await page.waitForFunction(() => document.querySelector('#json-error')?.textContent?.includes('1 to 80'));
    await page.locator('#json-value').fill(token);
    await page.locator('#json-save').click();
    await page.waitForFunction(value => JSON.parse(document.querySelector('#notes').textContent).some(note => note.value === value && note.transport === 'json'), token);
    await page.locator('#multipart-value').fill(`${token}-multipart`);
    await page.locator('#multipart-file').setInputFiles({ name: 'synthetic.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic file') });
    const requests = [];
    const record = request => { if (new URL(request.url()).pathname === '/') requests.push(request.method()); };
    page.on('request', record);
    await page.locator('#multipart-save').click();
    await page.waitForFunction(value => JSON.parse(document.querySelector('#notes').textContent).some(note => note.value === value && note.transport === 'multipart'), `${token}-multipart`);
    page.off('request', record);
    assert.equal(requests.filter(method => method === 'POST').length, 1);
    assert.equal(requests.filter(method => method === 'GET').length, 1);
    const saved = JSON.parse(await page.locator('#notes').textContent()).find(note => note.value === `${token}-multipart`);
    assert.deepEqual(JSON.parse(saved.detail), { tags: ['one', 'two'], file: { name: 'synthetic.txt', size: 14, text: 'synthetic file' } });
    await page.reload();
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    assert.ok((await page.locator('#notes').textContent()).includes(token));
    await page.goto(new URL('/island', target).href);
    await page.locator('[data-hono-island="mounted"]').waitFor();
    await page.locator('#island-counter').click();
    await page.waitForFunction(() => document.querySelector('#island-counter')?.textContent === 'Island 2');
    await page.goto(new URL('/markdown', target).href);
    await page.locator('h1').filter({ hasText: 'RC Markdown' }).waitFor();
    assert.equal(await page.locator('script[src]').count(), 0);
    assert.deepEqual(errors, []);
    // Local Miniflare/Vite early rejections can fail on a reused socket even
    // after consuming the response. Real HTTPS Workers keep normal pooling.
    const localRejectionHeaders = target.protocol === 'http:' ? { Connection: 'close' } : {};
    const oversized = await fetch(new URL('/?save', target), { method: 'POST', headers: { ...localRejectionHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(5000) }) });
    assert.equal(oversized.status, 413);
    await oversized.arrayBuffer();
    const foreign = await fetch(new URL('/?save', target), { method: 'POST', headers: { ...localRejectionHeaders, Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'rejected' }) });
    assert.equal(foreign.status, 403);
    await foreign.arrayBuffer();
    const after = await (await fetch(new URL('/api/status', target))).json();
    assert.ok(after.notes.some(note => note.value === token));
    assert.ok(after.notes.some(note => note.value === `${token}-multipart`));
    console.log(JSON.stringify({ origin: target.origin, revision: identity.revision, syntheticValue: token, checks: ['SSR', 'assets', 'D1 JSON write/read/validation', 'multipart plus one GET', 'navigation/layout/head', 'island', 'trusted Markdown', 'body/origin limits'], browserErrors: errors }));
    return { syntheticValue: token, revision: identity.revision };
  } finally { await browser.close(); }
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  assert.ok(process.argv[2], 'Pass the explicitly approved temporary fixture URL');
  await checkCloudflareConsumer(process.argv[2], process.argv[3]);
}
