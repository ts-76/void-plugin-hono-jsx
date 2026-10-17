export async function checkMultipartConsumer({ origin, page, assert }) {
  const result = () => JSON.parse(document.getElementById('multipart-result').textContent);
  const wait = (selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text });
  await page.goto(origin + '/multipart'); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  await page.locator('#multipart-files').setInputFiles([{ name: 'hello-日本語.txt', mimeType: 'text/plain', buffer: Buffer.from('hello upload') }, { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) }]);
  const requests = []; const listener = request => { if (request.url().startsWith(origin + '/multipart')) requests.push({ method: request.method(), contentType: request.headers()['content-type'] }); };
  page.on('request', listener);
  try {
    await page.evaluate(() => { window.multipartDocument = 123; });
    const reads = Number(await page.locator('#multipart-reads').textContent());
    await page.locator('#multipart-save').click();
    await page.waitForFunction(() => JSON.parse(document.getElementById('multipart-result').textContent)?.name === 'native-field');
    const saved = await page.evaluate(result);
    assert.deepEqual(saved.tags, ['one', 'two']);
    assert.deepEqual(saved.files, [{ name: 'hello-日本語.txt', type: 'text/plain', size: 12, text: 'hello upload' }, { name: 'empty.txt', type: 'text/plain', size: 0, text: '' }]);
    assert.equal(saved.intent, 'upload'); assert.match(saved.contentType, /^multipart\/form-data; boundary=/);
    assert.equal(await page.locator('#multipart-model').textContent(), 'model-default');
    assert.equal(await page.evaluate(() => window.multipartDocument), 123, 'keep the document during multipart refresh');
    assert.equal(Number(await page.locator('#multipart-reads').textContent()), reads + 2, 'action loader plus explicit GET refresh');
    assert.deepEqual(requests.map(request => request.method), ['POST', 'GET']);
    await page.locator('#multipart-name').fill(''); await page.locator('#multipart-save').click();
    await wait('#multipart-error', 'Name is required.');
    assert.equal(await page.locator('#multipart-name').inputValue(), '');
    assert.equal(await page.locator('#multipart-files').evaluate(input => input.files.length), 2, 'validation keeps files');
    for (const [button, name, method] of [['direct','bound','POST'], ['explicit','explicit','POST'], ['put','put','PUT'], ['patch','patch','PATCH'], ['delete','delete','DELETE']]) {
      await page.locator('#multipart-name').fill(name); await page.locator('#multipart-' + button).click();
      await page.waitForFunction(({ name, method }) => { const value = JSON.parse(document.getElementById('multipart-result').textContent); return value?.name === name && value?.method === method; }, { name, method });
      await wait('#multipart-state', 'false:true');
    }
    await page.locator('#multipart-name').fill('duplicate');
    const count = Number(await page.locator('#multipart-uploads').textContent());
    const before = requests.filter(request => request.method === 'POST').length;
    await page.evaluate(() => { document.getElementById('multipart-slow').click(); document.getElementById('multipart-slow').click(); });
    await wait('#multipart-navigation', 'submitting:POST');
    await wait('#multipart-uploads', String(count + 1)); await wait('#multipart-state', 'false:true');
    assert.equal(requests.filter(request => request.method === 'POST').length, before + 1);
    await page.locator('#multipart-name').fill('cancelled'); await page.locator('#multipart-slow').click();
    await wait('#multipart-navigation', 'submitting:POST'); await page.locator('#multipart-cancel').click();
    await wait('#multipart-state', 'false:false'); await page.waitForTimeout(650);
    assert.equal((await page.evaluate(result)).name, 'duplicate', 'cancel must not apply a late upload response');
    await page.locator('#multipart-name').fill('left-page'); await page.locator('#multipart-slow').click();
    await wait('#multipart-navigation', 'submitting:POST'); await page.locator('#multipart-leave').click();
    await page.locator('#other-heading').waitFor(); await page.waitForTimeout(650);
    assert.equal(new URL(page.url()).pathname, '/other', 'later navigation wins over the upload');
    await page.goto(origin + '/multipart'); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    let foreign = 0;
    await page.route('https://foreign.invalid/**', route => { foreign++; return route.fulfill({ status: 200, body: '{}' }); });
    await page.locator('#multipart-foreign').click();
    await page.getByRole('alert').filter({ hasText: 'current origin' }).waitFor();
    assert.equal(foreign, 0); await page.unroute('https://foreign.invalid/**');
    await page.locator('#multipart-redirect').click(); await page.locator('#links-heading').waitFor();
  } finally { page.off('request', listener); }
  await page.goto(origin + '/multipart-island'); await page.locator('[data-hono-island="mounted"]').waitFor();
  await page.locator('#island-multipart-files').setInputFiles([{ name: 'island.txt', mimeType: 'text/plain', buffer: Buffer.from('island body') }]);
  await page.locator('#island-multipart-name').fill(''); await page.locator('#island-multipart-save').click();
  await wait('#island-multipart-error', 'Name is required.');
  assert.equal(await page.locator('#island-multipart-files').evaluate(input => input.files.length), 1);
  await page.locator('#island-multipart-name').fill('island-native');
  await page.evaluate(() => { window.islandMultipartDocument = 456; });
  await page.locator('#island-multipart-save').click();
  await page.waitForFunction(() => JSON.parse(document.getElementById('island-multipart-result').textContent)?.name === 'island-native');
  const island = JSON.parse(await page.locator('#island-multipart-result').textContent());
  assert.deepEqual(island.tags, ['one', 'two']); assert.equal(island.files[0].text, 'island body');
  assert.equal(island.intent, 'island-upload'); assert.match(island.contentType, /^multipart\/form-data; boundary=/);
  assert.equal(await page.evaluate(() => window.islandMultipartDocument), undefined, 'island success reloads the document');
  await page.goto(origin); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log('Multipart forms: browser boundary, native fields/submitter, repeated fields/files, bound/explicit URL and CRUD, validation retention, duplicate/cancel/navigation generations, mutation state and redirect passed. Successful actions use one explicit GET refresh.');
}
