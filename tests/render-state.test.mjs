import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderState } from '../packages/void-plugin-hono-jsx/src/runtime/pages/render-state.ts';

const page = (value) => ({
  component: 'index',
  props: { value },
  params: {},
  shared: {},
  errors: null,
  url: '/',
});
const request = (state, value, preserve = true) =>
  state.request(page(value), () => null, [], preserve);

test('a later committed frame resolves coalesced requests and preserves or resets page identity explicitly', async () => {
  const state = createRenderState();
  state.complete(state.initial(page(0), () => null, []));
  const first = request(state, 1, false);
  const second = request(state, 2);
  assert.equal(first.frame.revision, 1);
  assert.equal(second.frame.revision, 1);
  let resolved = false;
  void first.committed.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  assert.equal(resolved, false, 'request completion must wait for a committed render');
  state.complete(second.frame);
  await Promise.all([first.committed, second.committed]);
  const next = request(state, 3, false);
  assert.equal(next.frame.revision, 2);
  state.complete(next.frame);
  await next.committed;
});

test('failed frames restore the last committed props, reject all affected waiters and allow a later successful render', async () => {
  const state = createRenderState();
  const initial = state.initial(page(0), () => null, []);
  state.complete(initial);
  const first = request(state, 1);
  const second = request(state, 2);
  const error = new Error('broken component');
  const rejected = [first, second].map((item) =>
    assert.rejects(item.committed, (failure) => failure === error),
  );
  let restored;
  let recoveries = 0;
  const recover = (previous) => {
    restored = previous;
    recoveries++;
  };
  state.fail(second.frame, error, recover);
  state.fail(second.frame, error, recover);
  assert.equal(restored, undefined, 'recovery must happen outside render traversal');
  assert.equal(state.canCommit(second.frame), false);
  state.complete(second.frame);
  await Promise.all(rejected);
  assert.equal(restored, initial);
  assert.equal(recoveries, 1);
  assert.equal(state.acceptsDeferred(initial.sourceProps), true);
  assert.equal(state.acceptsDeferred(second.frame.sourceProps), false);
  const next = request(state, 3);
  state.complete(next.frame);
  await next.committed;
  assert.equal(state.acceptsDeferred(next.frame.sourceProps), true);
});

test('an older failed render never restores over a newer navigation or settles its waiter', async () => {
  const state = createRenderState();
  state.complete(state.initial(page(0), () => null, []));
  const older = request(state, 1);
  const error = new Error('old failure');
  const rejected = assert.rejects(older.committed, (failure) => failure === error);
  let restored = false;
  state.fail(older.frame, error, () => {
    restored = true;
  });
  const newer = request(state, 2);
  let settled = false;
  void newer.committed.then(() => {
    settled = true;
  });
  await rejected;
  assert.equal(restored, false);
  assert.equal(settled, false);
  assert.equal(state.acceptsDeferred(newer.frame.sourceProps), true);
  state.complete(newer.frame);
  await newer.committed;
});

test('unmount rejects every pending render and isolates other renderer instances', async () => {
  const first = createRenderState(),
    second = createRenderState();
  const pending = [request(first, 1), request(first, 2)];
  const live = request(second, 3);
  const rejected = pending.map((item) => assert.rejects(item.committed, { name: 'AbortError' }));
  first.dispose();
  await Promise.all(rejected);
  second.complete(live.frame);
  await live.committed;
});
