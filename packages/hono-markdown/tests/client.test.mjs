import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';
import { hydrateMarkdownIslands, scheduleMarkdownIsland } from '@ts-76/hono-markdown/client';

// Minimal browser globals: islands are data-only elements and schedulers are observable fakes.
function browser(elements) {
  const saved = Object.fromEntries(['document', 'window', 'IntersectionObserver', 'reportError'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const events = { reported: [], disconnected: 0, removed: 0, cancelledIdle: 0 };
  const define = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  define('document', { querySelectorAll: () => elements });
  define('reportError', error => events.reported.push(error));
  define('IntersectionObserver', class { observe() {} disconnect() { events.disconnected++; } });
  define('window', {
    requestIdleCallback: () => 7,
    cancelIdleCallback: id => { assert.equal(id, 7); events.cancelledIdle++; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() { events.removed++; } }),
  });
  const restore = () => { for (const [name, descriptor] of Object.entries(saved)) descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]; };
  return { events, restore };
}
const island = (id, hydrate = 'load') => ({ dataset: { honoMdIsland: id, honoMdHydrate: hydrate } });
// Mirrors a host scheduler such as Void's: load, then mount, without its own error handling.
const eager = (element, loader, props, _strategy, mount) => { void loader().then(module => mount(element, module, props)); };

test('failed island loads and mounts are reported without unhandled rejections and stay retryable', async () => {
  const element = island('counter');
  const { events, restore } = browser([element]);
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    hydrateMarkdownIslands({ counter: () => Promise.reject(new Error('network')) }, { schedule: eager });
    await tick();
    assert.deepEqual(events.reported.map(error => error.message), ['network']);
    assert.equal(element.dataset.honoMdError, 'true');
    assert.equal(element.dataset.honoMdScheduled, undefined);

    hydrateMarkdownIslands({ counter: async () => ({ default: 'not a component' }) }, { schedule: eager });
    await tick();
    assert.match(events.reported[1].message, /default component/);
    assert.equal(element.dataset.honoMdScheduled, undefined, 'a failed mount can be retried as well');
    assert.equal(element.dataset.honoMdMounted, undefined);
    await tick();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
    restore();
  }
});

test('disposing cancels pending default schedules, host gates and in-flight loads', async () => {
  const elements = [island('a', 'visible'), island('b', 'idle'), island('c', 'media:(min-width: 1px)'), island('d', 'load')];
  const { events, restore } = browser(elements);
  try {
    let resolveLoad;
    const component = () => assert.fail('a disposed island must not mount');
    const pending = new Promise(resolve => { resolveLoad = resolve; });
    const loaders = { a: async () => ({ default: component }), b: async () => ({ default: component }), c: async () => ({ default: component }), d: () => pending };
    const dispose = hydrateMarkdownIslands(loaders);
    dispose();
    assert.deepEqual({ disconnected: events.disconnected, cancelledIdle: events.cancelledIdle, removed: events.removed }, { disconnected: 1, cancelledIdle: 1, removed: 1 });
    resolveLoad({ default: component });
    await tick();
    assert.ok(elements.every(element => element.dataset.honoMdScheduled === undefined && element.dataset.honoMdMounted === undefined));
    dispose();

    let start;
    const scheduled = [];
    const gated = hydrateMarkdownIslands({ a: loaders.a }, { schedule: (...args) => scheduled.push(args), ready: (_element, activate) => { start = activate; } });
    gated();
    start();
    assert.equal(scheduled.length, 0, 'a gate opened after disposal does not schedule');
  } finally {
    restore();
  }
});

test('the default scheduler still validates strategies and returns no cleanup for immediate loads', () => {
  const { restore } = browser([]);
  try {
    assert.equal(scheduleMarkdownIsland(island('x'), async () => ({}), {}, 'load', () => {}), undefined);
    assert.throws(() => scheduleMarkdownIsland(island('x'), async () => ({}), {}, 'later', () => {}), /invalid hydration strategy/);
  } finally {
    restore();
  }
});
