import assert from 'node:assert/strict';
export async function checkTransitionConsumer({ origin, page }) {
  await page.goto(origin + '/transitions');
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  assert.equal(await page.locator('meta[name=transition-value]').count(), 1);
  assert.equal(await page.locator('link[rel=canonical]').count(), 1);
  await page.evaluate(() => {
    window.transitionSnapshots = [];
    window.nativeTransition = document.startViewTransition?.bind(document);
    document.startViewTransition = (callback) => window.nativeTransition(async () => {
      await callback();
      window.transitionSnapshots.push({ value: document.getElementById('transition-value')?.textContent, title: document.title, meta: document.head.querySelector('meta[name=transition-value]')?.content, canonical: document.head.querySelector('link[rel=canonical]')?.getAttribute('href') });
    });
  });
  const visit = async (id, value) => {
    await page.locator(id).click();
    await page.waitForFunction(value => document.getElementById('transition-value')?.textContent === value && document.title === 'Transition ' + value && document.getElementById('app')?.dataset.navigation === 'idle', value);
  };
  await visit('#transition-on', 'on');
  assert.deepEqual(await page.evaluate(() => window.transitionSnapshots), [{ value: 'on', title: 'Transition on', meta: 'on', canonical: '/transitions?value=on' }]);
  await visit('#transition-off', 'off');
  assert.equal(await page.evaluate(() => window.transitionSnapshots.length), 1);
  await visit('#transition-default', 'default');
  await visit('#transition-programmatic', 'programmatic');
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('transition-value')?.textContent === 'default' && document.title === 'Transition default');
  await page.goForward();
  await page.waitForFunction(() => document.getElementById('transition-value')?.textContent === 'programmatic' && document.title === 'Transition programmatic');
  assert.equal(await page.evaluate(() => window.transitionSnapshots.every(snapshot => snapshot.title === 'Transition ' + snapshot.value && snapshot.meta === snapshot.value && snapshot.canonical === '/transitions?value=' + snapshot.value)), true);
  assert.equal(await page.locator('#transition-hover-delay').textContent(), '20');
  const prefetched = page.waitForResponse(response => response.url() === origin + '/transitions?value=hover' && response.request().headers().purpose === 'prefetch');
  let hoverRequests = 0;
  const countHover = request => { if (request.url() === origin + '/transitions?value=hover') hoverRequests++; };
  page.on('request', countHover);
  await page.locator('#transition-hover').hover();
  await (await prefetched).finished();
  await visit('#transition-hover', 'hover');
  assert.equal(hoverRequests, 1);
  page.off('request', countHover);
  // Hold an old native callback until a newer transition has fully committed.
  await page.evaluate(() => {
    let hold = true;
    document.startViewTransition = callback => {
      const updateCallbackDone = hold ? new Promise((resolve, reject) => {
        window.releaseOldTransition = () => Promise.resolve(callback()).then(resolve, reject);
      }) : Promise.resolve().then(callback);
      hold = false;
      return { updateCallbackDone };
    };
  });
  await page.locator('#transition-on').click();
  await page.waitForFunction(() => typeof window.releaseOldTransition === 'function');
  await visit('#transition-programmatic', 'programmatic');
  await page.evaluate(() => window.releaseOldTransition());
  assert.equal(await page.locator('#transition-value').textContent(), 'programmatic');
  assert.equal(await page.title(), 'Transition programmatic');
  assert.equal(new URL(page.url()).searchParams.get('value'), 'programmatic');
  await page.locator('#transition-slow').click();
  await visit('#transition-on', 'on');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#transition-value').textContent(), 'on');
  assert.equal(await page.title(), 'Transition on');
  await page.route(origin + '/transitions?value=error', route => route.fulfill({ status: 500, contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: JSON.stringify({ message: 'Transition failure' }) }));
  await page.locator('#transition-error').click();
  await page.getByRole('alert').waitFor();
  await page.locator('#app[data-navigation="idle"]').waitFor();
  assert.equal(await page.locator('#transition-value').textContent(), 'on');
  assert.equal(await page.title(), 'Transition on');
  await page.unroute(origin + '/transitions?value=error');
  await page.evaluate(() => { document.startViewTransition = undefined; });
  await visit('#transition-programmatic', 'programmatic');
  assert.equal(await page.locator('meta[name=transition-value]').count(), 1);
  assert.equal(await page.locator('link[rel=canonical]').count(), 1);
  await page.goto(origin);
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log('View Transitions: native callback sees committed DOM/head, Link override, global/programmatic visits, history, delayed stale callback, cancellation/failure and absent-API fallback passed.');
}
