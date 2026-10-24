import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const locks = ['package-lock.json', 'fixtures/consumer-void-1-vite/package-lock.json', 'fixtures/consumer-void-1-vp/package-lock.json'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return value;
}

// This consent applies to one release and three immutable dependency trees.
// It does not waive a finding for arbitrary versions or installed applications.
export function acceptedConsumerRisks({ root, pkg, policy }) {
  const acceptance = policy.consumerRiskAcceptance;
  if (!acceptance || acceptance.packageVersion !== pkg.version) return [];
  assert.equal(acceptance.schema, 1);
  assert.equal(acceptance.node, policy.releaseNode, 'Consumer risk Node baseline changed');
  assert.equal(acceptance.voidPeer, pkg.peerDependencies?.void, 'Consumer risk Void peer changed');
  assert.deepEqual(Object.keys(acceptance.lockfiles).sort(), [...locks].sort(), 'Consumer risk lock set changed');
  for (const file of locks) assert.equal(digest(readFileSync(path.join(root, file))), acceptance.lockfiles[file], `Consumer risk lock changed: ${file}`);
  assert.equal(acceptance.advisories.length, 4);
  return acceptance.advisories.map(item => {
    assert.match(item.id, /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof item.modified, 'string');
    return `https://github.com/advisories/${item.id}`;
  });
}

// Preparation/plan and staging both renew the advisory contents. A changed,
// withdrawn or unavailable record requires reassessment rather than bypass.
export async function verifyConsumerRiskAdvisories(policy, { fetchImpl = fetch } = {}) {
  for (const expected of policy.consumerRiskAcceptance?.advisories || []) {
    const response = await fetchImpl(`https://api.osv.dev/v1/vulns/${expected.id}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    assert.equal(response.status, 200, 'Cannot refresh accepted consumer advisory');
    const advisory = await response.json();
    assert.equal(advisory.id, expected.id);
    assert.equal(advisory.withdrawn, undefined, 'Accepted consumer advisory withdrawn; reassess');
    assert.equal(advisory.modified, expected.modified, 'Accepted consumer advisory modified; reassess');
    assert.equal(digest(canonical(advisory)), expected.sha256, 'Accepted consumer advisory content changed; reassess');
  }
}
