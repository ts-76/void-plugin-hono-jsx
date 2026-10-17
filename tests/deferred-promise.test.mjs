import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsx } from 'hono/jsx/jsx-runtime';
import { use, Suspense } from 'hono/jsx';
import { createDeferred, resolveDeferred, rejectDeferred, deferredResult, isLoading } from '../packages/hono-pages/src/runtime/deferred.ts';

async function browser(check) {
  const old = globalThis.window;
  globalThis.window = {};
  try { await check(); } finally { if (old === undefined) delete globalThis.window; else globalThis.window = old; }
}

test('one lazy Promise follows the original Void ref and its immutable completion', () => browser(async () => {
  const state = createDeferred();
  const promise = deferredResult(state);
  assert.equal(deferredResult(state), promise);
  assert.throws(() => use(promise), error => error === promise);
  const completed = resolveDeferred(state, 'delivered once');
  assert.equal(isLoading(state), true);
  assert.equal(isLoading(completed), false);
  assert.notEqual(completed, state);
  assert.equal(deferredResult(completed), promise);
  assert.deepEqual(await promise, { value: 'delivered once', error: null });
  assert.equal(use(promise).value, 'delivered once');
  for (let n = 0; n < 100; n++) assert.equal(deferredResult(completed), promise);
}));

test('early completion and independent grouped props keep their own stable result', () => browser(async () => {
  const left = createDeferred(), right = createDeferred();
  const completedLeft = resolveDeferred(left, 'left'), completedRight = resolveDeferred(right, 'right');
  const first = deferredResult(left), second = deferredResult(right);
  assert.equal(deferredResult(completedLeft), first);
  assert.equal(deferredResult(completedRight), second);
  assert.notEqual(first, second);
  assert.equal((await first).value, 'left');
  assert.equal((await second).value, 'right');
  const restored = { ...completedLeft };
  assert.deepEqual(await deferredResult(restored), { value: 'left', error: null });
  const nullState = resolveDeferred(createDeferred(), null);
  assert.deepEqual(await deferredResult(nullState), { value: null, error: null });
}));

test('reject/dispose fulfill an error envelope without unhandled derived rejections', () => browser(async () => {
  const unhandled = [];
  const collect = error => unhandled.push(error);
  process.on('unhandledRejection', collect);
  try {
    for (const message of ['Internal Server Error', 'Navigation disposed before deferred props resolved']) {
      const state = createDeferred();
      const promise = deferredResult(state);
      // Hono's Suspense observes this exact chain. It must not reject.
      const retried = promise.finally(() => {});
      const completed = rejectDeferred(state, message);
      assert.equal(deferredResult(completed), promise);
      assert.equal((await retried).error.message, message);
      assert.equal(completed.error.message, message);
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', collect); }
}));

test('SSR Suspense returns only the initial fallback without waiting for a result', async () => {
  const state = createDeferred();
  const promise = deferredResult(state);
  assert.equal(deferredResult(state), promise);
  function Reader() { const result = use(deferredResult(state)); if (result.error) throw result.error; return jsx('p', { children: result.value }); }
  let timer;
  try {
    const html = await Promise.race([
      jsx(Suspense, { fallback: jsx('p', { children: 'server fallback' }), children: jsx(Reader, {}) }).toString(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SSR waited for a client-owned deferred result')), 250); }),
    ]);
    assert.match(String(html), /server fallback/);
    assert.doesNotMatch(String(html), /data-hono-target|<script/);
  } finally { clearTimeout(timer); }
});
