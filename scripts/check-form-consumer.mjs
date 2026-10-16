export async function checkFormConsumer({ origin, page, assert }) {
  const wait = (selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text });
  await page.goto(origin + '/forms');
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  await wait('#form-state', 'false:false:false:false');
  await page.locator('#form-name').fill('');
  await page.locator('#form-save').click();
  await wait('#field-error', 'Name is required.');
  assert.equal(await page.locator('#form-name').inputValue(), '');
  await page.locator('#clear-field').click();
  await wait('#field-error', '');
  await page.locator('#clear-error').click();
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.locator('#form-name').fill('Saved');
  await page.locator('#form-save').click();
  await wait('#form-saved', 'Saved');
  await wait('#form-state', 'false:false:true:true');
  await wait('#form-state', 'false:false:true:false');
  await page.locator('#form-name').fill('Edited');
  await wait('#form-state', 'false:true:false:false');
  await page.locator('#form-reset').click();
  assert.equal(await page.locator('#form-name').inputValue(), 'Saved');
  for (const method of ['put', 'patch', 'delete']) {
    await page.locator('#form-name').fill(method);
    await page.locator('#form-' + method).click();
    await wait('#form-saved', method === 'delete' ? 'Original' : method);
  }
  await page.locator('#one-shot').click();
  await wait('#form-saved', 'One shot');
  const count = Number(await page.locator('#form-submissions').textContent());
  await page.evaluate(() => { document.querySelector('#form-slow').click(); document.querySelector('#form-slow').click(); });
  await wait('#form-submissions', String(count + 1));
  await page.evaluate(() => { document.querySelector('#form-slow').click(); setTimeout(() => document.querySelector('#form-cancel').click(), 40); });
  await page.waitForFunction(() => document.querySelector('#form-state')?.textContent.startsWith('false:'));
  await page.waitForTimeout(650);
  assert.equal((await page.locator('#form-state').textContent()).split(':')[2], 'false');
  await page.route(origin + '/forms?fail', (route) => route.fulfill({ status: 500, contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: JSON.stringify({ message: 'Form failed' }) }));
  await page.locator('#form-fail').click();
  await page.locator('#custom-form-error').waitFor();
  await page.locator('#clear-error').click();
  assert.equal(await page.getByRole('alert').count(), 0);
  let quotaRequests = 0;
  await page.route(origin + '/forms?quota', (route) => { quotaRequests++; return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'X-VoidPages': 'true' }, body: JSON.stringify({ code: 'usage_limit', resource: 'requests', reason: 'rate_limit', message: 'Try later', retryAt: new Date(Date.now() + 1500).toISOString() }) }); });
  await page.locator('#form-quota').click();
  await page.locator('#custom-form-error').waitFor();
  let attempts = 0;
  const listener = (request) => { if (request.method() === 'POST' && request.url() === origin + '/forms?save') attempts++; };
  page.on('request', listener);
  try {
    await page.locator('#form-save').click();
    await page.waitForTimeout(200);
    assert.equal(attempts, 0);
    await page.waitForTimeout(1600);
    assert.equal(attempts, 0, 'no automatic retry');
    await page.locator('#form-save').click();
    await page.waitForFunction(() => document.querySelector('#form-state')?.textContent === 'false:false:true:true');
    assert.equal(attempts, 1);
    assert.equal(quotaRequests, 1);
  } finally { page.off('request', listener); }
  await page.locator('#form-redirect').click();
  await page.locator('#links-heading').waitFor();
  await page.goto(origin);
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log('Form consumer: bound/legacy API, validation, controlled input, success/dirty/reset/clear, CRUD, single action, duplicate/cancel, custom error and redirect passed.');
}
