export async function checkIslandForms({ origin, page, assert }) {
  const mounted = () => page.locator('[data-hono-island] #island-save').waitFor();
  const wait = (id, value) => page.waitForFunction(({ id, value }) => document.getElementById(id)?.textContent === value, { id, value });
  await page.goto(origin + '/island-forms'); await mounted();
  await page.locator('#island-name').fill(''); await page.locator('#island-save').click();
  await wait('island-field-error', 'Island name required.');
  assert.equal(await page.locator('#island-name').inputValue(), '');
  await page.locator('#island-clear').click(); await wait('island-field-error', '');
  await page.evaluate(() => { window.islandFormDocument = 123; });
  await page.locator('#island-name').fill('Post'); await page.locator('#island-save').click();
  await wait('island-saved', 'Post'); await mounted();
  assert.equal(await page.evaluate(() => window.islandFormDocument), undefined);
  for (const method of ['put', 'patch', 'delete']) {
    await page.locator('#island-name').fill(method); await page.locator('#island-' + method).click();
    await wait('island-saved', method === 'delete' ? 'Island original' : method); await mounted();
  }
  const before = Number(await page.locator('#island-submissions').textContent());
  await page.locator('#island-name').fill('Slow');
  await page.evaluate(() => { document.querySelector('#island-slow').click(); document.querySelector('#island-slow').click(); });
  await wait('island-submissions', String(before + 1)); await mounted();
  await page.locator('#island-name').fill('Cancelled write');
  await page.evaluate(() => { document.querySelector('#island-slow').click(); setTimeout(() => document.querySelector('#island-cancel').click(), 40); });
  await page.waitForFunction(() => document.querySelector('#island-form-state')?.textContent.startsWith('false:'));
  await page.waitForTimeout(850);
  assert.equal(await page.locator('#island-saved').textContent(), 'Slow');
  await page.reload(); await wait('island-saved', 'Cancelled write'); await mounted();
  await page.route(origin + '/island-forms?fail', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.locator('#island-fail').click(); await page.getByRole('alert').waitFor();
  await page.locator('#island-clear').click(); assert.equal(await page.getByRole('alert').count(), 0);
  let external = 0;
  await page.route('https://example.test/**', (route) => { external++; return route.abort(); });
  await page.locator('#island-external').click();
  await wait('island-form-error', 'Hono island form: actions must target the current origin.'); assert.equal(external, 0);
  await page.locator('#island-clear').click();
  await page.locator('#island-redirect').click(); await page.locator('#links-heading').waitFor();
  await page.goto(origin); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log('Island forms: provider-free SSR/mount, validation/input, CRUD, document reload/redirect, duplicate suppression, abort without write rollback and same-origin boundary passed.');
}
