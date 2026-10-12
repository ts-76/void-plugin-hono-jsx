export async function checkLinkConsumer({ origin, page, assert }) {
  const prefetched = [];
  const listener = (request) => { if (request.headers().purpose === 'prefetch') prefetched.push(request.url()); };
  page.on('request', listener);
  const waitPrefetch = async (value) => {
    const deadline = Date.now() + 10000;
    while (!prefetched.some((url) => url.endsWith('value=' + value)) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(prefetched.some((url) => url.endsWith('value=' + value)), value + ' prefetch');
  };
  try {
    const response = await fetch(origin + '/links');
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/links\?keep=1(?:&amp;|&)value=query(?:&amp;|&)tag=one(?:&amp;|&)tag=two"/);
    assert.doesNotMatch(html, /prefetch=|preserveState=|preserveScroll=|onNavigate=/);
    await page.goto(origin + '/links');
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await page.waitForFunction(() => document.querySelector('#links-heading'));
    assert.equal(await page.locator('#navigation-state').textContent(), 'idle:-:-');
    await page.locator('#slow-link').click();
    await page.waitForFunction(() => document.querySelector('#navigation-state')?.textContent === 'loading:GET:/links');
    assert.equal(await page.locator('#layout-navigation-state').textContent(), 'loading');
    await page.waitForFunction(() => document.querySelector('#navigation-state')?.textContent === 'idle:-:-');
    await page.locator('#slow-link').click();
    await page.locator('#query-link').click();
    await page.waitForFunction(() => document.querySelector('#navigation-state')?.textContent === 'idle:-:-');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#link-value').textContent(), 'query:one,two');
    await page.goto(origin + '/links');
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await waitPrefetch('mount');
    await waitPrefetch('visible');
    await page.locator('#prefetch-link').hover();
    await waitPrefetch('hover');
    await page.locator('#click-prefetch').dispatchEvent('mousedown');
    await waitPrefetch('click');
    await page.locator('#link-increment').click();
    await page.locator('#cancel-link').click();
    assert.equal(new URL(page.url()).pathname, '/links');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('#state-link').dispatchEvent('click', { button: 0 });
    await page.waitForFunction(() => document.querySelector('#link-value')?.textContent === 'kept:');
    assert.equal(await page.locator('#link-count').textContent(), '1');
    await page.locator('#query-link').dispatchEvent('click', { button: 0 });
    await page.waitForFunction(() => document.querySelector('#link-value')?.textContent === 'query:one,two');
    await page.locator('#app[data-navigation="idle"]').waitFor();
    assert.equal(await page.locator('#link-count').textContent(), '0');
    assert.equal(await page.evaluate(() => window.scrollY), 600);
    await page.waitForURL((url) => url.searchParams.get('keep') === '1');
    const before = await page.evaluate(() => history.length);
    await page.locator('#replace-link').click();
    await page.waitForFunction(() => document.querySelector('#link-value')?.textContent === 'replaced:');
    assert.equal(await page.evaluate(() => history.length), before);
    for (const method of ['post', 'put', 'patch', 'delete']) {
      assert.equal(await page.locator('#mutation-' + method).evaluate((node) => node.tagName), 'BUTTON');
      await page.locator('#mutation-' + method).click();
      await page.waitForFunction((method) => document.querySelector('#navigation-state')?.textContent === 'submitting:' + method + ':/links', method.toUpperCase());
      assert.equal(await page.locator('#layout-navigation-state').textContent(), 'submitting');
      await page.waitForFunction((value) => document.querySelector('#link-value')?.textContent === value, method.toUpperCase() + ':saved:');
    }
    await page.route(origin + '/links?fail', (route) => route.fulfill({ status: 500, contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: JSON.stringify({ message: 'Link action failed' }) }));
    await page.locator('#fail-link').click();
    await page.getByRole('alert').waitFor();
    await page.waitForFunction(() => document.querySelector('#navigation-state')?.textContent === 'idle:-:-');
    await page.goto(origin);
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  } finally { page.off('request', listener); }
  console.log('Link consumer: query, mutation/named actions, failure, prefetch strategies, cancellation, state/scroll and replace passed.');
}
