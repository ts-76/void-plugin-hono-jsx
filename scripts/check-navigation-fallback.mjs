import assert from 'node:assert/strict';

export async function checkNavigationFallback({ origin, browser }) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const held = [];
  const hold = async (path, fail = false) => {
    let release, requested;
    const gate = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { requested = resolve; });
    const handler = async route => {
      requested();
      await gate;
      try {
        if (fail) await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: JSON.stringify({ message: 'Fallback navigation failed' }) });
        else await route.continue();
      } catch (error) {
        if (!page.isClosed() && !/closed|cancel|abort|handled/i.test(String(error))) throw error;
      }
    };
    await page.route(origin + path, handler);
    const result = { release, seen, async dispose() { release(); await page.unroute(origin + path, handler); } };
    held.push(result);
    return result;
  };
  const visit = path => page.evaluate(path => { window.fallbackVisit = window.transitionRouter.visit(path, { viewTransition: false }).catch(error => { window.fallbackErrors.push(error.message); }); }, path);
  const finish = async () => {
    await page.evaluate(() => window.fallbackVisit);
    await page.locator('#app[data-navigation="idle"]').waitFor();
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);
  };
  try {
    const html = await (await fetch(origin + '/transitions')).text();
    assert.doesNotMatch(html, /id="common-navigation-fallback"|data-hono-navigation-fallback/);
    await page.goto(origin + '/transitions');
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);
    await page.locator('#consumer-layout-input').fill('retained layout input');
    await page.locator('#consumer-layout-increment').click();
    await page.locator('#transition-local').click();
    await page.waitForFunction(() => document.getElementById('transition-local')?.textContent === '1');
    await page.evaluate(() => {
      window.fallbackErrors = [];
      window.fallbackSamples = [];
      window.fallbackStart = performance.now();
      window.fallbackLayout = document.getElementById('consumer-layout-input');
      window.fallbackPage = document.getElementById('transition-value');
      new MutationObserver(() => {
        const fallback = document.getElementById('common-navigation-fallback');
        if (fallback) window.fallbackSamples.push({ at: performance.now(), text: fallback.textContent });
      }).observe(document.getElementById('app'), { childList: true, subtree: true });
    });
    const slow = await hold('/transitions?value=fallback-slow');
    await page.evaluate(() => { window.fallbackStart = performance.now(); });
    await visit('/transitions?value=fallback-slow');
    await slow.seen;
    await page.locator('#common-navigation-fallback').waitFor();
    assert.equal(await page.locator('#transition-value').textContent(), 'initial');
    assert.equal(await page.locator('#transition-local').textContent(), '1');
    assert.equal(await page.evaluate(() => window.fallbackPage === document.getElementById('transition-value') && window.fallbackLayout === document.getElementById('consumer-layout-input')), true);
    assert.equal(await page.locator('#consumer-layout-input').inputValue(), 'retained layout input');
    const firstDelay = await page.evaluate(() => window.fallbackSamples[0].at - window.fallbackStart);
    assert.ok(firstDelay >= 140, `Fallback appeared before its 150ms delay: ${firstDelay}`);
    slow.release(); await finish(); await slow.dispose();
    assert.equal(await page.locator('#transition-value').textContent(), 'fallback-slow');
    assert.equal(await page.locator('#transition-local').textContent(), '0', 'Ordinary GET resets page state');
    assert.equal(await page.locator('#consumer-layout-count').textContent(), '1');
    assert.equal(await page.locator('#consumer-layout-input').inputValue(), 'retained layout input');

    const cancelled = await hold('/transitions?value=fallback-cancelled');
    await visit('/transitions?value=fallback-cancelled'); await cancelled.seen;
    await page.locator('#common-navigation-fallback').waitFor();
    await visit('/transitions?value=fallback-new'); await finish();
    cancelled.release(); await cancelled.dispose();
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#transition-value').textContent(), 'fallback-new');
    assert.equal(await page.title(), 'Transition fallback-new');
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);

    const failed = await hold('/transitions?value=error', true);
    await visit('/transitions?value=error'); await failed.seen;
    await page.locator('#common-navigation-fallback').waitFor();
    failed.release(); await finish(); await failed.dispose();
    assert.equal(await page.locator('#transition-value').textContent(), 'fallback-new');
    assert.equal(await page.title(), 'Transition fallback-new');
    assert.equal(await page.evaluate(() => window.fallbackErrors.length), 1);

    // A presentation component can fail while the GET is still held. This
    // must not retry the same failed Hono subtree during parent state updates.
    await page.evaluate(() => {
      window.fallbackRenderErrors = [];
      window.addEventListener('hono-pages:navigation-error', event => window.fallbackRenderErrors.push(event.detail?.message));
    });
    const broken = await hold('/transitions?value=fallback-render-error');
    await visit('/transitions?value=fallback-render-error'); await broken.seen;
    await page.waitForFunction(() => window.fallbackRenderErrors.length === 1);
    await page.waitForTimeout(180);
    assert.deepEqual(await page.evaluate(() => window.fallbackRenderErrors), ['Fallback component failed']);
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);
    assert.equal(await page.locator('#transition-value').textContent(), 'fallback-new');
    assert.equal(await page.locator('#consumer-layout-input').inputValue(), 'retained layout input');
    await visit('/transitions?value=fallback-recovered'); await finish();
    broken.release(); await broken.dispose();
    await visit('/transitions?value=fallback-new'); await finish();

    await page.locator('#transition-local').click();
    await page.waitForFunction(() => document.getElementById('transition-local')?.textContent === '1');
    const beforePreservedHistory = await page.evaluate(() => history.length);
    await page.evaluate(async () => {
      await window.transitionRouter.prefetch('/transitions?value=fallback-cached');
      window.fallbackSamples.length = 0;
      const before = performance.now();
      await window.transitionRouter.visit('/transitions?value=fallback-cached', { viewTransition: false, preserveState: true, preserveScroll: true });
      window.fallbackFastDuration = performance.now() - before;
    });
    assert.equal(await page.locator('#transition-local').textContent(), '1');
    const fast = await page.evaluate(() => ({ duration: window.fallbackFastDuration, displayed: window.fallbackSamples.length }));
    // The contract is duration-based, not a guarantee about runner performance.
    if (fast.duration < 150) assert.equal(fast.displayed, 0, 'A visit completing before the delay must not flash a fallback');
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);
    // Void 1.2.1 updates history even when the component state is preserved.
    assert.equal(new URL(page.url()).searchParams.get('value'), 'fallback-cached');
    assert.equal(await page.evaluate(() => history.length), beforePreservedHistory + 1);
    await page.goBack();
    await page.waitForFunction(() => document.getElementById('transition-value')?.textContent === 'fallback-new' && document.getElementById('app')?.dataset.navigation === 'idle');
    await page.goForward();
    await page.waitForFunction(() => document.getElementById('transition-value')?.textContent === 'fallback-cached' && document.getElementById('app')?.dataset.navigation === 'idle');
    assert.equal(await page.locator('[data-hono-navigation-fallback]').count(), 0);
    assert.equal(await page.locator('#consumer-layout-input').inputValue(), 'retained layout input');
    assert.equal(await page.evaluate(() => window.fallbackLayout === document.getElementById('consumer-layout-input')), true);
    assert.deepEqual(errors, []);
    console.log(`Navigation fallback: SSR idle, delayed GET (${Math.round(firstDelay)}ms), retained page/layout/input DOM, reset/preserveState, cancellation, fetch/fallback-render failure, history and completed-prefetch (${Math.round(fast.duration)}ms, ${fast.displayed} fallback observations) passed.`);
  } catch (error) {
    console.error('Fallback diagnostic', await page.evaluate(() => ({ url: location.href, title: document.title, value: document.getElementById('transition-value')?.textContent, navigation: document.getElementById('app')?.dataset.navigation, errors: window.fallbackErrors, history: history.length })).catch(() => 'page unavailable'));
    throw error;
  } finally {
    for (const item of held) item.release();
    await page.close();
  }
}
