export async function checkCssConsumer({ origin, page, browser, assert, mode }) {
  const expectedBackground = theme => theme === 'dark' ? 'rgb(20, 30, 40)' : 'rgb(240, 245, 250)';
  const verify = async (tab, theme, second = false) => {
    const state = await tab.locator('#css-card').evaluate(element => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderRadius }));
    assert.deepEqual(state, { color: second ? 'rgb(65, 45, 125)' : 'rgb(15, 85, 45)', background: expectedBackground(theme), radius: '13px' });
    assert.equal(await tab.locator('style#hono-css').count(), 1);
    assert.equal(await tab.locator('head > style#hono-css').count(), 1);
    assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  };
  // First paint must work without mounting, including the ordinary CSS override.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  try {
    for (const lang of ['en', 'ja']) for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
      await staticPage.setViewportSize({ width, height: 800 });
      const response = await staticPage.goto(`${origin}/css/${lang}/one?theme=${theme}`);
      assert.equal(response.status(), 200);
      await verify(staticPage, theme);
      assert.equal(await staticPage.locator('html').getAttribute('lang'), lang);
    }
  } finally { await context.close(); }

  for (const lang of ['en', 'ja']) for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: theme });
    const response = await page.goto(`${origin}/css/${lang}/one?theme=${theme}`);
    if (mode === 'preview') assert.match(response.headers()['content-security-policy'], /style-src 'self' 'nonce-/);
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await verify(page, theme);
    await page.evaluate(() => { window.cssHost = document.getElementById('hono-css'); window.cssNonce = window.cssHost.nonce; window.cssDocument = document; });
    const stable = async () => assert.equal(await page.evaluate(() => document === window.cssDocument && document.getElementById('hono-css') === window.cssHost && window.cssHost.isConnected && window.cssHost.nonce === window.cssNonce), true);
    await page.locator('#css-increment').click();
    await page.waitForFunction(() => document.querySelector('#css-count')?.textContent === '1');
    const next = async () => { await page.locator('#css-next').click(); await page.locator('#app[data-navigation="idle"]').waitFor(); };
    await next(); await verify(page, theme, true); await stable();
    await page.locator('#css-language').click(); await page.locator('#app[data-navigation="idle"]').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), lang === 'en' ? 'ja' : 'en');
    await page.goBack(); await page.locator('#app[data-navigation="idle"]').waitFor(); await stable();
    await page.goForward(); await page.locator('#app[data-navigation="idle"]').waitFor(); await verify(page, theme, true);
    const rules = await page.evaluate(() => window.cssHost.sheet.cssRules.length);
    for (let index = 0; index < 3; index++) { await next(); await next(); }
    assert.equal(await page.evaluate(() => window.cssHost.sheet.cssRules.length), rules);
    await page.locator('#css-theme').click(); await page.locator('#app[data-navigation="idle"]').waitFor();
    await verify(page, theme === 'dark' ? 'light' : 'dark', true); await stable();
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: 'light' });
  console.log(`Hono CSS ${mode}: no-JS SSR, EN/JA, 1280/390/320px, light/dark, native cascade, stable host/nonce, route/history changes and bounded warm rules passed.`);
}
