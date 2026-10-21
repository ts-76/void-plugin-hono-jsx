import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry, sha256, stageArguments, stageReceipt } from './gate.mjs';
import { publisherInventory } from './publisher-inventory.mjs';
import { bracesCoverage, assertNoBracesCalls } from './publisher-coverage.mjs';
import { pathToFileURL } from 'node:url';

export const policyPath = fileURLToPath(new URL('./publisher-policy.json', import.meta.url));
export const inventoryPath = fileURLToPath(new URL('./publisher-js-inventory.json', import.meta.url));
export const loadPublisherPolicy = () => JSON.parse(readFileSync(policyPath, 'utf8'));
export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}

export async function requestBytes(url, options = {}, limit = 4 * 1024 * 1024) {
  assert.equal(new URL(url).protocol, 'https:', 'Publisher network requires HTTPS');
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.ok(response.ok, 'Publisher preflight/service failed');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) { await response.body.cancel().catch(() => {}); throw new Error('Publisher response exceeds limit'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export const requestJson = async (url, options) => JSON.parse((await requestBytes(url, options)).toString('utf8'));

export function checkPublisherFinding(policy, pkg, advisory) {
  const accepted = policy.acceptedFindings.find(item => item.name === pkg.name && item.version === pkg.version && item.id === advisory.id);
  assert.ok(accepted, `Unreviewed publisher advisory: ${pkg.name}@${pkg.version} ${advisory.id}`);
  assert.equal(advisory.modified, accepted.modified, 'Publisher advisory changed; reassess');
  assert.equal(sha256(canonical(advisory)), accepted.advisorySha256, 'Publisher advisory content changed; reassess');
  assert.ok(accepted.reason);
  return { name: pkg.name, version: pkg.version, id: advisory.id, reason: accepted.reason };
}

export async function auditPublisher({ policy = loadPublisherPolicy(), request = requestJson } = {}) {
  assert.equal(policy.schema, 2);
  assert.equal(policy.manager, 'pnpm');
  const inventoryBytes = readFileSync(inventoryPath);
  assert.equal(sha256(inventoryBytes), policy.inventorySha256, 'Publisher inventory changed');
  const inventory = JSON.parse(inventoryBytes);
  const queries = inventory.map(pkg => ({ package: { name: pkg.name, ecosystem: 'npm' }, version: pkg.version }));
  const batch = await request('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries }) });
  assert.equal(batch.results?.length, inventory.length, 'Incomplete publisher audit');
  const findings = [];
  for (const [index, result] of batch.results.entries()) {
    assert.ok(!result.next_page_token, 'Publisher audit pagination requires review');
    for (const item of result.vulns || []) {
      assert.match(item.id, /^(?:CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)$/);
      const advisory = await request(`https://api.osv.dev/v1/vulns/${item.id}`);
      assert.equal(advisory.id, item.id);
      findings.push(checkPublisherFinding(policy, inventory[index], advisory));
    }
  }
  const keys = list => list.map(item => `${item.name}@${item.version}:${item.id}`).sort();
  assert.deepEqual(keys(findings), keys(policy.acceptedFindings), 'Publisher findings changed; reassess');
  return { manager: policy.manager, version: policy.version, node: policy.node, target: policy.target, sourceCommit: policy.sourceCommit,
    policySha256: sha256(readFileSync(policyPath)), inventorySha256: policy.inventorySha256,
    auditedPackages: inventory.length, findings, status: 'accepted only within reviewed stage scope' };
}

export function verifyPublisher(cli, policy = loadPublisherPolicy()) {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.equal(process.version, `v${policy.node}`);
  assert.ok(lstatSync(cli).isFile() && !lstatSync(cli).isSymbolicLink());
  assert.equal(sha256(readFileSync(cli)), policy.distribution.entrySha256, 'Publisher CLI changed');
  const tableBytes = readFileSync(new URL('./publisher-js-files.json', import.meta.url));
  assert.equal(sha256(tableBytes), policy.filesSha256, 'Publisher file table changed');
  const root = path.resolve(path.dirname(cli), '..');
  const table = JSON.parse(tableBytes);
  const actual = [];
  const visit = directory => { for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else { assert.ok(entry.isFile(), 'Publisher contains non-regular file'); actual.push(path.relative(root, file).replaceAll('\\', '/')); }
  } };
  visit(root);
  assert.deepEqual(actual.sort(), table.map(file => file.path).sort(), 'Publisher files changed');
  const files = new Map();
  for (const file of table) {
    const content = readFileSync(path.join(root, file.path));
    assert.equal(sha256(content), file.sha256, `Publisher file changed: ${file.path}`);
    if (/\.(?:mjs|cjs|js)$/.test(file.path) || file.path.endsWith('package.json')) files.set(file.path, content.toString('utf8'));
  }
  assert.deepEqual(publisherInventory(files), JSON.parse(readFileSync(inventoryPath)), 'Publisher inventory differs from distributed files');
  assert.equal(JSON.parse(files.get('package.json')).version, policy.version);
}

export function measurePublisherCoverage(cli, directory) {
  const report = bracesCoverage(readFileSync(cli, 'utf8'), pathToFileURL(cli).href, directory);
  assertNoBracesCalls(report);
  return { modules: report.length, functionsCalled: 0, method: 'V8 coverage of unmodified stage CLI' };
}

export async function exchangeOidc(env, request = requestJson) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.ok(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN && env.ACTIONS_ID_TOKEN_REQUEST_URL, 'OIDC permissions missing');
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  assert.equal(url.protocol, 'https:');
  assert.ok(url.hostname.endsWith('.actions.githubusercontent.com'), 'Unexpected OIDC authority');
  url.searchParams.set('audience', 'npm:registry.npmjs.org');
  const identity = await request(url.href, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
  assert.ok(typeof identity.value === 'string' && identity.value.length && !/[\r\n]/.test(identity.value), 'OIDC identity token missing');
  const exchanged = await request(`${registry}-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(env.PUBLISH_PACKAGE_NAME)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${identity.value}`, 'Content-Type': 'application/json' }
  });
  assert.ok(typeof exchanged.token === 'string' && /^[A-Za-z0-9._~-]+$/.test(exchanged.token), 'OIDC registry token missing');
  return exchanged.token;
}

export function publisherEnvironment(env, root) {
  const keep = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'GITHUB_ACTIONS', 'GITHUB_SERVER_URL', 'GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_SHA',
    'GITHUB_WORKFLOW_REF', 'GITHUB_WORKFLOW_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_EVENT_NAME', 'GITHUB_REPOSITORY_ID',
    'GITHUB_REPOSITORY_OWNER_ID', 'RUNNER_ENVIRONMENT', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
  return { ...Object.fromEntries(keep.filter(key => env[key] !== undefined).map(key => [key, env[key]])), HOME: root,
    XDG_CONFIG_HOME: path.join(root, 'config'), XDG_CACHE_HOME: path.join(root, 'cache'), XDG_DATA_HOME: path.join(root, 'data'),
    PNPM_HOME: path.join(root, 'pnpm-home'), PNPM_CONFIG_STATE_DIR: path.join(root, 'state'),
    PNPM_CONFIG_STORE_DIR: path.join(root, 'store'), PNPM_CONFIG_IGNORE_WORKSPACE: 'true' };
}

// The only upload runner. No long-lived token is inherited, and OIDC preflight
// must succeed before pnpm is allowed to attempt staging. Its fallback may use
// only this freshly exchanged OIDC token. Auth/state are removed on every exit.
export async function submitWithPublisher({ binary, plan, policy, tarball, env = process.env, request = requestJson, run = execFileSync, measure = measurePublisherCoverage }) {
  assert.equal(plan.status, 'ready');
  assert.ok(env.RUNNER_TEMP);
  const token = await exchangeOidc({ ...env, PUBLISH_PACKAGE_NAME: plan.package.name }, request);
  const root = mkdtempSync(path.join(env.RUNNER_TEMP, 'pnpm-stage-'));
  try {
    const bytes = readFileSync(tarball);
    assert.equal(sha256(bytes), plan.sha256, 'Accepted tarball changed before upload');
    assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, plan.integrity);
    const accepted = path.join(root, path.basename(tarball));
    writeFileSync(accepted, bytes, { mode: 0o600, flag: 'wx' });
    const auth = path.join(root, 'user.npmrc');
    writeFileSync(auth, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600, flag: 'wx' });
    const args = [binary, ...stageArguments(plan, policy, accepted)];
    const coverage = path.join(root, 'coverage'); mkdirSync(coverage);
    const receipt = stageReceipt(run(process.execPath, args, { cwd: root, env: { ...publisherEnvironment(env, root), NODE_V8_COVERAGE: coverage, NPM_CONFIG_USERCONFIG: auth }, encoding: 'utf8', timeout: 120000,
      maxBuffer: 1024 * 1024 }), plan);
    return { ...receipt, reachability: measure(binary, coverage) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
