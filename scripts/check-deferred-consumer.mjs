import assert from 'node:assert/strict';

export async function checkDeferredConsumer({ origin, page, mode }) {
  const control = async (token, fail = false) => {
    const response = await fetch(origin + '/api/deferred-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, fail }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).released, true);
  };
  const waitForCompletion = async (token) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const state = await (await fetch(origin + '/api/deferred-control?token=' + token)).json();
      if (state.completions >= state.requests && state.requests > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Deferred producer did not complete: ${token}`);
  };
  const stream = await fetch(origin + '/deferred?token=html-stream');
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /Immediate html-stream/);
  assert.match(first, /Loading slow value/);
  assert.match(first, /<script async type="module"/);
  const pending = await (await fetch(origin + '/api/deferred-control?token=html-stream')).json();
  assert.equal(pending.result.state, 'pending');
  await control('html-stream');
  let rest = '';
  while (true) { const chunk = await reader.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value); }
  assert.match(rest, /__resolveDeferred/);
  assert.match(rest, /\\u003c\/script\\u003e/);
  await page.locator('#consumer-layout-increment').click();
  await page.waitForFunction(() => document.querySelector('#consumer-layout-count')?.textContent === '1');
  await page.evaluate(() => { window.consumerLayout = document.querySelector('#consumer-layout-count'); });
  await page.locator('#deferred-link').click();
  await page.waitForURL('**/deferred?token=spa');
  assert.equal(await page.locator('#deferred-immediate').textContent(), 'Immediate spa');
  assert.equal(await page.locator('#deferred-state').textContent(), 'Loading slow value');
  await page.locator('#deferred-local-increment').click();
  await page.waitForFunction(() => document.querySelector('#deferred-local')?.textContent === '1');
  await control('spa');
  await page.waitForFunction(() => document.querySelector('#deferred-state')?.textContent?.startsWith('Resolved spa:'));
  assert.equal(await page.locator('#deferred-local').textContent(), '1');
  assert.equal(await page.locator('#consumer-layout-count').textContent(), '1');
  assert.equal(await page.evaluate(() => window.consumerLayout === document.querySelector('#consumer-layout-count')), true);
  await page.locator('#deferred-next').click();
  await page.waitForURL('**/deferred?token=spa-next');
  assert.equal(await page.locator('#deferred-state').textContent(), 'Loading slow value');
  await page.locator('#deferred-away').click();
  await page.waitForURL('**/other');
  await control('spa-next');
  await waitForCompletion('spa-next');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#other-heading').textContent(), 'Other page');
  assert.equal(await page.locator('#deferred-state').count(), 0);
  assert.equal(await page.locator('#consumer-layout-count').textContent(), '1');
  assert.equal(await page.evaluate(() => window.consumerLayout === document.querySelector('#consumer-layout-count')), true);
  await page.goto(origin + '/deferred?token=direct', { waitUntil: 'commit' });
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  assert.equal(await page.locator('#deferred-state').textContent(), 'Loading slow value');
  await control('direct');
  await page.waitForFunction(() => document.querySelector('#deferred-state')?.textContent?.startsWith('Resolved direct:'));
  await page.goto(origin + '/deferred?token=failure', { waitUntil: 'commit' });
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  assert.equal(await page.locator('#deferred-state').textContent(), 'Loading slow value');
  await control('failure', true);
  const failureMessage = mode === 'development' ? 'Deferred example unavailable.' : 'Internal Server Error';
  await page.waitForFunction(message => document.querySelector('#deferred-state')?.textContent === message, failureMessage);
  assert.equal(await page.locator('#deferred-state').getAttribute('role'), 'alert');
  // Void 0.26.1 deliberately hides internal error details in production streams.
  const rejectedStream = await fetch(origin + '/deferred?token=failure', { headers: { 'X-VoidPages': 'true' } });
  const rejectedBody = await rejectedStream.text();
  const rejectedMessages = rejectedBody.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rejectedMessages.find(message => message.__deferred === 'slow')?.error, failureMessage);
  if (mode !== 'development') assert.doesNotMatch(rejectedBody, /Deferred example unavailable\./);
  let allowModule;
  const held = new Promise((resolve) => { allowModule = resolve; });
  let sawModule;
  const requested = new Promise((resolve) => { sawModule = resolve; });
  const componentUrl = /\/(?:pages\/deferred\.tsx|assets\/deferred-[^/]+\.js)(?:\?.*)?$/;
  await page.route(componentUrl, async (route) => { sawModule(); await held; await route.continue(); });
  try {
    await page.goto(origin + '/deferred?token=early', { waitUntil: 'commit' });
    await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(new Error('Initial deferred component was not requested')), 5000))]);
    await page.waitForFunction(() => typeof window.__resolveDeferred === 'function');
    await control('early');
    await page.waitForFunction(() => window.__deferredQueue?.some((entry) => entry[0] === 'slow'));
    assert.equal(await page.locator('#deferred-state').textContent(), 'Loading slow value');
    allowModule();
    await page.locator('#app[data-hono-pages="mounted"]').waitFor();
    await page.waitForFunction(() => document.querySelector('#deferred-state')?.textContent?.startsWith('Resolved early:'));
  } finally {
    allowModule();
    await page.unroute(componentUrl);
  }
  await page.goto(origin);
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  let allowPendingModule;
  const pendingHeld = new Promise((resolve) => { allowPendingModule = resolve; });
  let sawPendingModule;
  const pendingRequested = new Promise((resolve) => { sawPendingModule = resolve; });
  await page.route(componentUrl, async (route) => { sawPendingModule(); await pendingHeld; await route.continue(); });
  try {
    await page.locator('#deferred-link').click();
    await Promise.race([pendingRequested, new Promise((_, reject) => setTimeout(() => reject(new Error('Pending deferred component was not requested')), 5000))]);
    await waitForCompletion('spa');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#initial-prop').textContent(), '5');
    assert.equal(await page.locator('#deferred-state').count(), 0);
    allowPendingModule();
    await page.waitForURL('**/deferred?token=spa');
    await page.waitForFunction(() => document.querySelector('#deferred-state')?.textContent?.startsWith('Resolved spa:'));
  } finally {
    allowPendingModule();
    await page.unroute(componentUrl);
  }
  await page.goto(origin);
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  const groupStatus = async (token) => (await fetch(origin + '/api/deferred-control?token=' + token)).json();
  const groupToken = `group-${mode === 'development' ? 'development' : 'production'}`;
  const groupStream = await fetch(origin + '/deferred-group?token=' + groupToken);
  const groupReader = groupStream.body.getReader();
  const shell = new TextDecoder().decode((await groupReader.read()).value);
  assert.match(shell, /id="group-left">pending/);
  assert.match(shell, /id="group-right">pending/);
  assert.equal((await groupStatus(groupToken)).requests, 1);
  await control(groupToken);
  let completion = '';
  while (true) { const chunk = await groupReader.read(); if (chunk.done) break; completion += new TextDecoder().decode(chunk.value); }
  assert.equal(completion.match(/window\.__resolveDeferred\?/g)?.length, 1);
  assert.match(completion, /"bundle"/);
  await page.locator('#group-link').click();
  await page.waitForFunction(() => document.querySelector('#group-left')?.textContent?.endsWith(':left:0'));
  await page.locator('#group-increment').click();
  const beforeMutation = await groupStatus(groupToken);
  await page.locator('#group-save').click();
  await page.waitForFunction(() => document.querySelector('#group-version')?.textContent === '1');
  assert.match(await page.locator('#group-left').textContent(), /:left:0$/);
  assert.match(await page.locator('#group-right').textContent(), /:right:0$/);
  assert.equal(await page.locator('#group-increment').textContent(), '1');
  assert.equal((await groupStatus(groupToken)).requests, beforeMutation.requests);
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelector('#group-right')?.textContent?.endsWith(':right:1'));
  await page.locator('#group-prefetch').click();
  const prefetchedToken = groupToken + '-prefetch';
  const deadline = Date.now() + 5000;
  while ((await groupStatus(prefetchedToken)).requests === 0) {
    if (Date.now() > deadline) throw new Error('Grouped prefetch was not started');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  await control(prefetchedToken);
  await page.waitForFunction(() => document.querySelector('#group-prefetched')?.textContent === 'true');
  assert.equal((await groupStatus(prefetchedToken)).requests, 1);
  await page.locator('#group-visit').click();
  await page.waitForFunction(() => document.querySelector('#group-left')?.textContent?.includes('-prefetch:'));
  assert.match(await page.locator('#group-right').textContent(), /:right:1$/);
  assert.equal((await groupStatus(prefetchedToken)).requests, 1);
  await page.locator('#group-away').click();
  await page.waitForURL('**/other');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#group-left')?.textContent?.includes('-prefetch:'));
  await page.goForward();
  await page.waitForURL('**/other');
  await page.goto(origin + '/deferred-group?token=group-failure-' + mode, { waitUntil: 'commit' });
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  await control('group-failure-' + mode, true);
  await page.waitForFunction(message => ['group-left', 'group-right'].every(id => document.getElementById(id)?.textContent === message), failureMessage);
  assert.equal((await groupStatus('group-failure-' + mode)).requests, 1);
  await page.locator('#group-pending').click();
  await page.waitForFunction(() => document.querySelector('#group-left')?.textContent === 'pending');
  await page.locator('#group-away').click();
  await page.waitForURL('**/other');
  await control('group-failure-' + mode + '-pending');
  await waitForCompletion('group-failure-' + mode + '-pending');
  assert.equal(await page.locator('#group-left').count(), 0);
  assert.equal(await page.locator('#other-heading').textContent(), 'Other page');
  await page.goto(origin);
  await page.locator('#app[data-hono-pages="mounted"]').waitFor();
  console.log(`Grouped deferred ${mode}: one resolver, HTML/SPA projections, mutation value retention, fresh load, cached prefetch, history and sanitized errors passed.`);
  console.log(`Deferred ${mode}: immediate streamed shell, HTML/NDJSON completion, typed errors, early completion queue, page/layout retention, pending-page isolation and stale navigation discard passed.`);
}
