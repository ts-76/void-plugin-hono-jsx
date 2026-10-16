import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
export async function checkIslandGraph({ origin, page, assert, mode, consumer }) {
  await page.goto(origin + '/graph/nested', { waitUntil: 'commit' }).catch((error) => { if (!error.message.includes('ERR_ABORTED')) throw error; });
  for (const id of ['root', 'nested', 'page', 'other']) {
    await page.locator('[data-hono-island] #' + id + '-increment').click();
    assert.equal(await page.locator('#' + id + '-count').textContent(), '1');
  }
  assert.equal(await page.locator('[data-island]').count(), 4);
  assert.equal(await page.locator('#graph-root').count(), 1); assert.equal(await page.locator('#graph-nested').count(), 1);
  await page.goto(origin + '/graph/named');
  await page.locator('[data-hono-island] #named-increment').click();
  assert.equal(await page.locator('#named-count').textContent(), '1');
  assert.equal(await page.locator('#graph-root').count(), 0);
  await page.goto(origin + '/graph/static');
  assert.equal(await page.locator('script[src], link[rel="modulepreload"]').count(), 0);
  if (mode === 'development') {
    const path = join(consumer, 'components/StaticIslandWrapper.tsx');
    const original = await readFile(path, 'utf8');
    const alternate = join(consumer, 'components/AlternatePolicyCounter.tsx');
    try {
      await writeFile(alternate, (await readFile(join(consumer, 'components/PolicyCounter.tsx'), 'utf8')).replace('useState(0)', 'useState(100)'));
      await writeFile(path, original.replace('./PolicyCounter', './AlternatePolicyCounter').replace('<div>', '<div data-graph-revision="updated">'));
      await page.goto(origin + '/graph/nested', { waitUntil: 'commit' }).catch((error) => { if (!error.message.includes('ERR_ABORTED')) throw error; });
      await page.locator('[data-graph-revision="updated"]').first().waitFor();
      await page.locator('[data-hono-island] #page-increment').click();
      assert.equal(await page.locator('#page-count').textContent(), '101');
    } finally { await writeFile(path, original); await rm(alternate, { force: true }); }
    await page.goto(origin + '/graph/nested', { waitUntil: 'commit' }).catch((error) => { if (!error.message.includes('ERR_ABORTED')) throw error; });
    await page.waitForFunction(() => document.querySelector('[data-hono-island] #page-count')?.textContent === '0');
  }
  await page.goto(origin); await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log('Island graph: root/nested/named layouts, static wrapper, independent repeated props, zero-script chain and component edits passed.');
}
