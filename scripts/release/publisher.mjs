import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry, sha256, stageArguments, stageReceipt } from './gate.mjs';

export const policyPath = fileURLToPath(new URL('./publisher-policy.json', import.meta.url));
export const inventoryPath = fileURLToPath(new URL('./publisher-rust-inventory.json', import.meta.url));
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

export function checkRustFinding(policy, pkg, advisory) {
  const accepted = policy.acceptedRustFindings.find(item => item.name === pkg.name && item.version === pkg.version && item.id === advisory.id);
  assert.ok(accepted, `Unreviewed publisher advisory: ${pkg.name}@${pkg.version} ${advisory.id}`);
  assert.equal(advisory.modified, accepted.modified, 'Publisher advisory changed; reassess');
  assert.equal(sha256(canonical(advisory)), accepted.advisorySha256, 'Publisher advisory content changed; reassess');
  assert.ok(accepted.reason);
  return { name: pkg.name, version: pkg.version, id: advisory.id, reason: accepted.reason };
}

export async function auditPublisher({ policy = loadPublisherPolicy(), request = requestJson, bytes = requestBytes } = {}) {
  assert.equal(policy.schema, 1);
  assert.equal(policy.manager, 'pnpm');
  assert.equal(policy.target, 'x86_64-unknown-linux-gnu');
  const inventoryBytes = readFileSync(inventoryPath);
  assert.equal(sha256(inventoryBytes), policy.inventorySha256, 'Publisher inventory changed');
  const inventory = JSON.parse(inventoryBytes);
  const lock = await bytes(`https://raw.githubusercontent.com/pnpm/pnpm/${policy.sourceCommit}/Cargo.lock`);
  assert.equal(sha256(lock), policy.cargoLockSha256, 'Publisher lock changed');
  const queries = inventory.map(pkg => ({ package: { name: pkg.name, ecosystem: 'crates.io' }, version: pkg.version }));
  const batch = await request('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries }) });
  assert.equal(batch.results?.length, inventory.length, 'Incomplete publisher audit');
  const findings = [];
  for (const [index, result] of batch.results.entries()) {
    assert.ok(!result.next_page_token, 'Publisher audit pagination requires review');
    for (const item of result.vulns || []) {
      assert.match(item.id, /^(?:RUSTSEC-\d{4}-\d+|GHSA-[a-z0-9-]+)$/);
      const advisory = await request(`https://api.osv.dev/v1/vulns/${item.id}`);
      assert.equal(advisory.id, item.id);
      findings.push(checkRustFinding(policy, inventory[index], advisory));
    }
  }
  const keys = list => list.map(item => `${item.name}@${item.version}:${item.id}`).sort();
  assert.deepEqual(keys(findings), keys(policy.acceptedRustFindings), 'Publisher findings changed; reassess');
  return { manager: policy.manager, version: policy.version, target: policy.target, sourceCommit: policy.sourceCommit,
    policySha256: sha256(readFileSync(policyPath)), inventorySha256: policy.inventorySha256,
    auditedCrates: inventory.length, findings, status: 'accepted only within reviewed stage scope' };
}

export function verifyPublisher(binary, policy = loadPublisherPolicy()) {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.ok(lstatSync(binary).isFile() && !lstatSync(binary).isSymbolicLink());
  assert.equal(sha256(readFileSync(binary)), policy.distribution.binarySha256, 'Publisher binary changed');
  const root = mkdtempSync(path.join(path.dirname(binary), 'verify-'));
  try {
    const auth = path.join(root, 'user.npmrc');
    writeFileSync(auth, '', { mode: 0o600, flag: 'wx' });
    assert.equal(execFileSync(binary, ['--version', '--userconfig', auth, '--ignore-workspace'], {
      cwd: root, env: publisherEnvironment({ PATH: process.env.PATH }, root), encoding: 'utf8'
    }).trim(), policy.version);
  } finally { rmSync(root, { recursive: true, force: true }); }
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
  return { ...Object.fromEntries(keep.filter(key => env[key] !== undefined).map(key => [key, env[key]])),
    XDG_CONFIG_HOME: path.join(root, 'config'), XDG_CACHE_HOME: path.join(root, 'cache'), XDG_DATA_HOME: path.join(root, 'data'),
    PNPM_HOME: path.join(root, 'pnpm-home'), PNPM_CONFIG_STATE_DIR: path.join(root, 'state'),
    PNPM_CONFIG_STORE_DIR: path.join(root, 'store'), PNPM_CONFIG_IGNORE_WORKSPACE: 'true' };
}

// The only upload runner. No long-lived token is inherited, and OIDC preflight
// must succeed before pnpm is allowed to attempt staging. Its fallback may use
// only this freshly exchanged OIDC token. Auth/state are removed on every exit.
export async function submitWithPublisher({ binary, plan, policy, tarball, env = process.env, request = requestJson, run = execFileSync }) {
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
    const args = [...stageArguments(plan, policy, accepted), '--userconfig', auth];
    return stageReceipt(run(binary, args, { cwd: root, env: publisherEnvironment(env, root), encoding: 'utf8', timeout: 120000,
      maxBuffer: 1024 * 1024 }), plan);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
