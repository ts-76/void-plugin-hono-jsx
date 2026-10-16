export async function checkIslandPolicies({ origin, page, assert }) {
  const context = await page.context().browser().newContext({ viewport: { width: 900, height: 600 } });
  await context.addInitScript(() => { window.idleCallbacks = []; window.requestIdleCallback = (callback) => { window.idleCallbacks.push(callback); return window.idleCallbacks.length; }; });
  const check = await context.newPage();
  const errors = [];
  check.on('pageerror', (error) => errors.push(error.message));
  try {
    await check.goto(origin + '/policies');
    await check.waitForFunction(() => window.idleCallbacks?.length === 1);
    for (const id of ['idle', 'visible', 'media']) {
      assert.equal(await check.locator('#' + id + '-count').textContent(), '0');
      assert.equal(await check.locator('#' + id + '-count').locator('xpath=ancestor::*[@data-hono-island]').count(), 0);
    }
    await check.evaluate(() => window.idleCallbacks.splice(0).forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 })));
    await check.locator('[data-hono-island] #idle-increment').click();
    assert.equal(await check.locator('#idle-count').textContent(), '1');
    await check.setViewportSize({ width: 500, height: 600 });
    await check.locator('[data-hono-island] #media-increment').click();
    assert.equal(await check.locator('#media-count').textContent(), '1');
    await check.setViewportSize({ width: 900, height: 600 });
    await check.setViewportSize({ width: 500, height: 600 });
    assert.equal(await check.locator('#media-count').textContent(), '1', 'not remounted');
    await check.locator('#visible-count').scrollIntoViewIfNeeded();
    await check.locator('[data-hono-island] #visible-increment').click();
    assert.equal(await check.locator('#visible-count').textContent(), '1');
    await check.evaluate(() => window.scrollTo(0, 0));
    await check.locator('#visible-count').scrollIntoViewIfNeeded();
    assert.equal(await check.locator('#visible-count').textContent(), '1', 'not remounted');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  console.log('Island policies: delayed idle, offscreen visible, unmatched/matched media, independent props and no duplicate mount passed.');
}
