import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditPublisher, canonical, exchangeOidc, inventoryPath, loadPublisherPolicy, publisherEnvironment, submitWithPublisher } from '../scripts/release/publisher.mjs';
import { sha256, stageReceipt } from '../scripts/release/gate.mjs';

function auditFixture() {
  const policy = structuredClone(loadPublisherPolicy());
  const inventory = JSON.parse(readFileSync(inventoryPath));
  const advisories = policy.acceptedFindings.map(item => ({ id: item.id, modified: item.modified, details: 'reviewed fixture' }));
  for (const [index, item] of policy.acceptedFindings.entries()) item.advisorySha256 = sha256(canonical(advisories[index]));
  const results = inventory.map(pkg => ({ vulns: policy.acceptedFindings.filter(item => item.name === pkg.name && item.version === pkg.version).map(item => ({ id: item.id })) }));
  const request = async url => url.endsWith('/querybatch') ? { results } : advisories.find(a => url.endsWith('/' + a.id));
  return { policy, results, advisories, request };
}

test('publisher audit accepts only reviewed versions/content and fails closed on new, changed or incomplete findings', async () => {
  const f = auditFixture();
  const report = await auditPublisher(f);
  assert.equal(report.auditedPackages, 370);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].id, 'GHSA-vfj7-8cjw-p6xm');
  for (const [index, advisory] of f.advisories.entries()) {
    advisory.details = 'new impact';
    await assert.rejects(auditPublisher(f), /content changed/);
    advisory.details = 'reviewed fixture';
    advisory.modified = 'later';
    await assert.rejects(auditPublisher(f), /advisory changed/);
    advisory.modified = f.policy.acceptedFindings[index].modified;
  }
  f.results[0] = { vulns: [{ id: 'GHSA-xxxx-yyyy-zzzz' }] };
  await assert.rejects(auditPublisher({ ...f, request: async url => url.endsWith('/querybatch') ? { results: f.results } : { id: 'GHSA-xxxx-yyyy-zzzz' } }), /Unreviewed publisher advisory/);
  await assert.rejects(auditPublisher({ ...f, request: async () => ({ results: [] }) }), /Incomplete/);
  await assert.rejects(auditPublisher({ ...f, policy: { ...f.policy, inventorySha256: 'changed' } }), /inventory changed/);
  await assert.rejects(auditPublisher({ ...f, request: async () => ({ results: f.results.map(() => ({ next_page_token: 'more' })) }) }), /pagination/);
  await assert.rejects(auditPublisher({ ...f, request: async () => { throw new Error('service unavailable'); } }), /service unavailable/);
});

test('publisher subprocess strips existing credentials, proxy, runtime injection and provenance overrides', () => {
  const env = publisherEnvironment({ HOME: 'preserved', PATH: 'preserved-path', GITHUB_ACTIONS: 'true', GITHUB_SHA: 'commit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'oidc-request',
    NPM_TOKEN: 'old', NODE_AUTH_TOKEN: 'old', GH_TOKEN: 'old', NODE_OPTIONS: '--require injected', HTTPS_PROXY: 'proxy', ALL_PROXY: 'proxy',
    PNPM_CONFIG__AUTH: 'old', PNPM_CONFIG_PROVENANCE: 'false', npm_config_userconfig: 'old-file', PNPM_CONFIG_NPMRC_AUTH_FILE: 'old-file' }, '/isolated');
  assert.equal(env.HOME, '/isolated');
  assert.equal(env.GITHUB_SHA, 'commit');
  assert.equal(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'oidc-request');
  for (const key of ['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'GH_TOKEN', 'NODE_OPTIONS', 'HTTPS_PROXY', 'ALL_PROXY', 'PNPM_CONFIG__AUTH', 'PNPM_CONFIG_PROVENANCE', 'npm_config_userconfig', 'PNPM_CONFIG_NPMRC_AUTH_FILE']) assert.ok(!(key in env));
  assert.equal(env.XDG_CONFIG_HOME, '/isolated/config');
  assert.equal(env.PNPM_CONFIG_STATE_DIR, '/isolated/state');
});

function stageFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'pnpm-publisher-test-'));
  const tarball = path.join(root, 'accepted.tgz');
  const bytes = Buffer.from('fixed accepted archive fixture');
  writeFileSync(tarball, bytes);
  const plan = { status: 'ready', blockers: [], package: { name: 'void-plugin-hono-jsx', version: '0.1.0-alpha.0' }, sha256: sha256(bytes), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  const env = { RUNNER_TEMP: root, GITHUB_ACTIONS: 'true', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/identity?fixture=1', NPM_TOKEN: 'old-token' };
  const request = async url => url.includes('/identity?') ? { value: 'fixture-identity' } : { token: 'fresh-oidc-token' };
  const receipt = { [plan.package.name]: { ...plan.package, integrity: plan.integrity, stageId: 'fixture-stage-id' } };
  return { measure: () => ({ modules: 7, functionsCalled: 0 }), binary: '/verified/pnpm', root, bytes, tarball, plan, env, request, policy: { distTag: 'next' }, receipt, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('OIDC HTTP transport accepts npm 201 Created and rejects failed exchanges', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const f = stageFixture();
  t.after(f.cleanup);
  let status = 201;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    if (url.includes('/identity?')) {
      assert.equal(new URL(url).searchParams.get('audience'), 'npm:registry.npmjs.org');
      return new Response(JSON.stringify({ value: 'fixture-identity' }), { status: 200 });
    }
    assert.equal(url, 'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/void-plugin-hono-jsx');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer fixture-identity');
    return new Response(JSON.stringify({ token: 'fresh-oidc-token', token_type: 'oidc' }), { status });
  };
  const env = { ...f.env, PUBLISH_PACKAGE_NAME: f.plan.package.name };
  assert.equal(await exchangeOidc(env), 'fresh-oidc-token');
  status = 401;
  await assert.rejects(exchangeOidc(env), /preflight\/service failed/);
});

test('staging preserves bytes, uses only fresh scoped auth and provenance, and removes auth on success', async () => {
  const f = stageFixture();
  let isolated;
  try {
    const result = await submitWithPublisher({ ...f, run: (binary, args, options) => {
      assert.equal(binary, process.execPath);
      assert.equal(args[0], f.binary);
      assert.deepEqual(args.slice(1, 3), ['stage', 'publish']);
      assert.ok(args.includes('--provenance') && args.includes('--ignore-scripts') && args.includes('--reporter=silent'));
      assert.ok(!args.includes('--force') && !args.includes('--otp') && !args.includes('--no-provenance'));
      assert.equal(args[args.indexOf('--tag') + 1], 'next');
      assert.equal(args[args.indexOf('--access') + 1], 'public');
      assert.deepEqual(readFileSync(args[3]), f.bytes);
      const auth = options.env.NPM_CONFIG_USERCONFIG;
      assert.equal(readFileSync(auth, 'utf8'), '//registry.npmjs.org/:_authToken=fresh-oidc-token\n');
      assert.equal(statSync(auth).mode & 0o777, 0o600);
      assert.ok(!('NPM_TOKEN' in options.env));
      assert.equal(options.env.HOME, options.cwd);
      assert.ok(options.env.NODE_V8_COVERAGE.startsWith(options.cwd + path.sep));
      isolated = options.cwd;
      return JSON.stringify(f.receipt);
    } });
    assert.equal(result.stageId, 'fixture-stage-id');
    assert.ok(!existsSync(isolated));
  } finally { f.cleanup(); }
});

test('OIDC missing token, wrong authority and changed accepted bytes stop before any CLI invocation', async () => {
  const f = stageFixture();
  let calls = 0;
  const run = () => { calls++; throw new Error('must not upload'); };
  try {
    await assert.rejects(submitWithPublisher({ ...f, run, request: async url => url.includes('/identity?') ? { value: 'identity' } : {} }), /registry token missing/);
    await assert.rejects(submitWithPublisher({ ...f, run, env: { ...f.env, ACTIONS_ID_TOKEN_REQUEST_URL: 'https://untrusted.example/identity' } }), /authority/);
    await assert.rejects(submitWithPublisher({ ...f, run, request: async url => {
      if (url.includes('/identity?')) return { value: 'identity' };
      writeFileSync(f.tarball, 'changed after OIDC');
      return { token: 'fresh' };
    } }), /tarball changed/);
    assert.equal(calls, 0);
    assert.deepEqual(readdirSync(f.root), ['accepted.tgz']);
  } finally { f.cleanup(); }
});

test('failed CLI and invalid receipt remove temporary credentials and never retry staging', async () => {
  const f = stageFixture();
  let calls = 0;
  try {
    await assert.rejects(submitWithPublisher({ ...f, run: () => { calls++; throw new Error('registry rejected'); } }), /registry rejected/);
    assert.equal(calls, 1);
    assert.deepEqual(readdirSync(f.root), ['accepted.tgz']);
    await assert.rejects(submitWithPublisher({ ...f, run: () => JSON.stringify({ [f.plan.package.name]: { ...f.plan.package, integrity: 'changed', stageId: 'id' } }) }), /integrity changed/);
    assert.deepEqual(readdirSync(f.root), ['accepted.tgz']);
    assert.throws(() => stageReceipt(JSON.stringify({ [f.plan.package.name]: { name: 'wrong', version: f.plan.package.version, integrity: f.plan.integrity, stageId: 'id' } }), f.plan), /package changed/);
  } finally { f.cleanup(); }
});


test('unexpected braces execution after stage submission stops completion without retry and removes credentials', async () => {
  const f = stageFixture(); let calls = 0;
  try {
    await assert.rejects(submitWithPublisher({ ...f,
      run: () => { calls++; return JSON.stringify(f.receipt); },
      measure: () => { throw new Error('braces executed'); },
    }), /braces executed/);
    assert.equal(calls, 1);
    assert.deepEqual(readdirSync(f.root), ['accepted.tgz']);
  } finally { f.cleanup(); }
});
