import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPublisherPolicy, requestBytes, verifyPublisher } from './publisher.mjs';

// Download only the pinned Linux native distribution; no npm bootstrap,
// lifecycle scripts, wrapper, node-gyp or implicit runtime download is needed.
const policy = loadPublisherPolicy();
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.equal(JSON.parse(readFileSync('release-policy.json', 'utf8')).pnpmVersion, policy.version);
assert.ok(process.env.RUNNER_TEMP);
const root = path.join(process.env.RUNNER_TEMP, 'publisher-cli');
mkdirSync(root, { mode: 0o700 });
const archive = path.join(root, 'distribution.tgz');
try {
  const bytes = await requestBytes(policy.distribution.url, {}, 64 * 1024 * 1024);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, policy.distribution.integrity);
  writeFileSync(archive, bytes);
  const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual([...names].sort(), [...policy.distribution.files].sort());
  assert.ok(execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' }).trim().split('\n').every(line => line.startsWith('-')));
  const pkg = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }));
  assert.equal(pkg.name, policy.distribution.name);
  assert.equal(pkg.version, policy.version);
  assert.deepEqual(pkg.os, ['linux']);
  assert.deepEqual(pkg.cpu, ['x64']);
  const binary = path.join(root, 'pnpm');
  writeFileSync(binary, execFileSync('tar', ['-xOzf', archive, 'package/pnpm'], { maxBuffer: 64 * 1024 * 1024 }), { mode: 0o755, flag: 'wx' });
  verifyPublisher(binary, policy);
  appendFileSync(process.env.GITHUB_ENV, `PNPM_RELEASE_CLI=${binary}\n`);
  console.log(`Verified pnpm ${policy.version} (${policy.target})`);
} finally { rmSync(archive, { force: true }); }
