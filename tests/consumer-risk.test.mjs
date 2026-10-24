import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acceptedConsumerRisks, verifyConsumerRiskAdvisories, canonical } from '../scripts/release/consumer-risk.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');
const records = ['4qv8-2p9j-2685', 'f72v-6w45-q472', 'xjj6-f33q-929c', 'mrhx-c7xc-m3w5'].map(id => ({ id: `GHSA-${id}`, modified: '2026-10-24T00:00:00Z', summary: 'Reviewed fixture' }));
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'consumer-risk-'));
  const locks = ['package-lock.json', 'fixtures/consumer-void-1-vite/package-lock.json', 'fixtures/consumer-void-1-vp/package-lock.json'];
  for (const file of locks) { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), 'locked'); }
  const pkg = { version: '0.7.0', peerDependencies: { void: '>=1.2.1 <1.3.0' } };
  const policy = { releaseNode: '24.22.1', consumerRiskAcceptance: { schema: 1, packageVersion: '0.7.0', node: '24.22.1', voidPeer: pkg.peerDependencies.void, lockfiles: Object.fromEntries(locks.map(file => [file, sha('locked')])), advisories: records.map(record => ({ id: record.id, modified: record.modified, sha256: sha(canonical(record)) })) } };
  return { root, pkg, policy, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('consumer acceptance expires with the adapter version and cannot waive a changed lock, peer or Node runtime', () => {
  const f = fixture(); try {
    assert.equal(acceptedConsumerRisks(f).length, 4);
    assert.deepEqual(acceptedConsumerRisks({ ...f, pkg: { ...f.pkg, version: '0.7.1' } }), []);
    assert.deepEqual(acceptedConsumerRisks({ ...f, policy: {} }), []);
    assert.throws(() => acceptedConsumerRisks({ ...f, policy: { ...f.policy, releaseNode: '24.23.0' } }), /Node baseline changed/);
    assert.throws(() => acceptedConsumerRisks({ ...f, pkg: { ...f.pkg, peerDependencies: { void: '>=1.3.0' } } }), /Void peer changed/);
    writeFileSync(path.join(f.root, 'fixtures/consumer-void-1-vp/package-lock.json'), 'updated');
    assert.throws(() => acceptedConsumerRisks(f), /lock changed/);
  } finally { f.cleanup(); }
});

test('fresh advisory verification accepts the complete unchanged records regardless of JSON key order', async () => {
  const f = fixture(); try {
    const requests = [];
    await verifyConsumerRiskAdvisories(f.policy, { fetchImpl: async url => {
      requests.push(url); const record = records.find(record => url.endsWith('/' + record.id));
      return { status: 200, json: async () => ({ summary: record.summary, modified: record.modified, id: record.id }) };
    } });
    assert.equal(requests.length, 4);
    assert.ok(requests.every(url => url.startsWith('https://api.osv.dev/v1/vulns/GHSA-')));
  } finally { f.cleanup(); }
});

test('changed, withdrawn, missing or unavailable advisory records cannot reuse owner acceptance', async () => {
  const f = fixture(); try {
    for (const change of [{ modified: 'later' }, { summary: 'new attack surface' }, { withdrawn: '2026-10-24' }, { id: 'other' }]) {
      await assert.rejects(verifyConsumerRiskAdvisories(f.policy, { fetchImpl: async () => ({ status: 200, json: async () => ({ ...records[0], ...change }) }) }));
    }
    await assert.rejects(verifyConsumerRiskAdvisories(f.policy, { fetchImpl: async () => ({ status: 503 }) }), /Cannot refresh/);
    await assert.rejects(verifyConsumerRiskAdvisories(f.policy, { fetchImpl: async () => { throw new Error('network unavailable'); } }), /network unavailable/);
  } finally { f.cleanup(); }
});
