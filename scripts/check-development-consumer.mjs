import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkDevelopmentConsumer({ page, origin, consumer, assertRunning }) {
  const source = join(consumer, 'pages/index.tsx');
  const loader = join(consumer, 'pages/index.server.ts');
  const originalSource = await readFile(source, 'utf8');
  const originalLoader = await readFile(loader, 'utf8');
  const added = join(consumer, 'pages/added.tsx');
  await page.addInitScript(() => {
    window.__consumerMountWrites = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target.id === 'app' && record.target.getAttribute('data-hono-pages') === 'mounted') window.__consumerMountWrites++;
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-hono-pages'] });
  });
  async function mountedOnce() {
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.__consumerMountWrites), 1, 'Each document must complete Pages initialization exactly once');
  }
  let failed = false;
  try {
    await page.goto(origin);
    await mountedOnce();
    await page.locator('#increment').click();
    await page.waitForFunction(() => document.querySelector('#count')?.textContent === '6');
    await writeFile(source, originalSource.replace('Clean package consumer', 'Edited package consumer'));
    await page.getByRole('heading', { name: 'Edited package consumer' }).waitFor();
    await mountedOnce();
    assert.equal(await page.locator('#count').textContent(), '5');
    await writeFile(loader, originalLoader.replace('initialCount: 5', 'initialCount: 12'));
    await page.waitForFunction(() => document.querySelector('#count')?.textContent === '12');
    await mountedOnce();
    await page.locator('#increment').click();
    await page.waitForFunction(() => document.querySelector('#count')?.textContent === '13');
    // Requests may arrive while the module runner is replacing a page/loader.
    // Every response must retain the matching JSX and Pages provider identity.
    for (let revision = 0; revision < 12; revision++) {
      const heading = `Reload revision ${revision}`;
      await Promise.all([
        writeFile(source, originalSource.replace('Clean package consumer', heading)),
        writeFile(loader, originalLoader.replace('initialCount: 5', `initialCount: ${20 + revision}`)),
      ]);
      const deadline = Date.now() + 10000;
      let current = false;
      while (Date.now() < deadline) {
        const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(origin)));
        for (const response of responses) {
          assert.equal(response.status, 200, `SSR lost its provider during revision ${revision}`);
          const html = await response.text();
          assert.match(html, /id="runtime-hooks"/);
          if (html.includes(heading) && html.includes(`>${20 + revision}</output>`)) current = true;
        }
        if (current) break;
      }
      assert.ok(current, `SSR did not pick up revision ${revision}`);
      await page.getByRole('heading', { name: heading }).waitFor();
      await page.waitForFunction((count) => document.querySelector('#count')?.textContent === String(count), 20 + revision);
      await mountedOnce();
    }
    await writeFile(added, "import { Link } from 'void-plugin-hono-jsx/pages'; export default function Page() { return <main><h1 id=\"added-page\">Added page</h1><Link id=\"added-home\" href=\"/\">Home</Link></main>; }");
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline) {
      const response = await fetch(origin + '/added');
      if (response.ok && (await response.text()).includes('Added page')) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'New page route did not appear');
    await page.goto(origin + '/added');
    await mountedOnce();
    await page.locator('#added-home').click();
    await page.waitForURL(origin + '/');
    await rm(added);
    let removed = false;
    while (Date.now() < deadline + 10000) {
      if ((await fetch(origin + '/added')).status === 404) { removed = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(removed, 'Removed page route stayed active');
    await mountedOnce();
    assertRunning();
    console.log('Development: concurrent SSR during page/loader edits, state reset, page add/remove, current manifests and single browser initialization passed without a server restart.');
  } catch (error) { failed = true; throw error; } finally {
    await rm(added, { force: true });
    await writeFile(source, originalSource);
    if (!failed) await page.getByRole('heading', { name: 'Clean package consumer' }).waitFor();
    await writeFile(loader, originalLoader);
    if (!failed) {
      await page.waitForFunction(() => document.querySelector('#count')?.textContent === '5');
      await mountedOnce();
    }
  }
}
