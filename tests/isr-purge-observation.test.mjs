import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observePurge } from '../scripts/isr-purge-observation.mjs';

test('purge observation records the old HIT and a bounded new response', async () => {
  let time = 1000;
  const values = [{ version: 1, cache: 'HIT' }, { version: 2, cache: 'MISS' }];
  const result = await observePurge({ path: '/query?kind=a', expected: 2, completedAt: 1000, read: async () => values.shift(), now: () => time, sleep: async ms => { time += ms; } });
  assert.equal(result.value.version, 2);
  assert.deepEqual(result.observation, { name: 'purge observation', path: '/query?kind=a', expected: 2, completedAt: 1000, outcome: 'pass', initialVersion: 1, initialCache: 'HIT', lastVersion: 2, lastCache: 'MISS', elapsedMs: 1100 });
});

test('another variant does not get a new observation window after the first deadline', async () => {
  let time = 0;
  const read = async () => ({ version: 1, cache: 'HIT' });
  await assert.rejects(observePurge({ path: '/query?kind=a', expected: 2, completedAt: 0, read, now: () => time, sleep: async ms => { time += ms; } }), error => {
    assert.equal(error.purgeObservation.elapsedMs, 25000);
    assert.equal(error.purgeObservation.lastVersion, 1);
    return true;
  });
  let reads = 0;
  await assert.rejects(observePurge({ path: '/query?kind=b', expected: 2, completedAt: 0, read: async () => { reads++; return { version: 2, cache: 'MISS' }; }, now: () => time }), /within 25000ms of purge completion/);
  assert.equal(reads, 0);
});

test('a response that finishes after the shared deadline cannot pass', async () => {
  let time = 24999;
  await assert.rejects(observePurge({ path: '/query?kind=b', expected: 2, completedAt: 0, read: async () => { time = 25001; return { version: 2, cache: 'MISS' }; }, now: () => time }), error => {
    assert.equal(error.purgeObservation.outcome, 'fail');
    assert.equal(error.purgeObservation.lastVersion, 2);
    assert.equal(error.purgeObservation.elapsedMs, 25001);
    return true;
  });
});

test('a request failure retains the preceding cache observation', async () => {
  let time = 0;
  let reads = 0;
  await assert.rejects(observePurge({ path: '/query?kind=b', expected: 2, completedAt: 0, read: async () => {
    if (reads++) throw new Error('Synthetic request failure');
    return { version: 1, cache: 'HIT' };
  }, now: () => time, sleep: async ms => { time += ms; } }), error => {
    assert.equal(error.purgeObservation.initialVersion, 1);
    assert.equal(error.purgeObservation.lastCache, 'HIT');
    assert.equal(error.purgeObservation.error, 'Synthetic request failure');
    return true;
  });
});
