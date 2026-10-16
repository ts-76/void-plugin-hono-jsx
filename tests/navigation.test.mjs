import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWithTransition } from '../packages/hono-pages/src/runtime/navigation.ts';

test('native animation skips do not hide failed updates or resolve before render commit', async () => {
  const previous = globalThis.document;
  try {
    let release;
    const committed = new Promise(resolve => { release = resolve; });
    let started = 0;
    globalThis.document = { startViewTransition(update) {
      started++;
      return { ready: Promise.reject(new DOMException('Animation superseded', 'AbortError')), finished: Promise.reject(new DOMException('Animation did not finish', 'AbortError')), updateCallbackDone: update() };
    } };
    let done = false;
    const render = applyWithTransition(true, () => committed).then(() => { done = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(done, false);
    release();
    await render;
    assert.equal(started, 1);
    await assert.rejects(() => applyWithTransition(true, async () => { throw new Error('Render failed'); }), /Render failed/);
    await applyWithTransition(false, async () => {});
    assert.equal(started, 2);
    globalThis.document = {};
    await applyWithTransition(true, async () => {});
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
