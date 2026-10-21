import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPublisherPolicy, requestBytes, verifyPublisher } from './publisher.mjs';

// Fetch only the pinned archive; no package install or lifecycle runs here.
const policy = loadPublisherPolicy();
assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64');
assert.equal(process.version, `v${policy.node}`);
assert.equal(JSON.parse(readFileSync('release-policy.json', 'utf8')).pnpmVersion, policy.version);
assert.ok(process.env.RUNNER_TEMP);
const root = path.join(process.env.RUNNER_TEMP, 'publisher-cli'); mkdirSync(root, { mode: 0o700 });
const archive = path.join(root, 'distribution.tgz');
try {
  const bytes = await requestBytes(policy.distribution.url, {}, 64 * 1024 * 1024);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, policy.distribution.integrity);
  writeFileSync(archive, bytes);
  // The pinned archive digest is checked first; reject paths and non-regular files before extraction.
  execFileSync('python3', ['-c', `import pathlib,sys,tarfile
with tarfile.open(sys.argv[1]) as tar:
 names=set()
 for member in tar.getmembers():
  parts=pathlib.PurePosixPath(member.name).parts
  assert member.isfile() and parts[0]=='package' and '..' not in parts and not member.name.startswith('/')
  assert member.name not in names
  names.add(member.name)
 tar.extractall(sys.argv[2],filter='data')`, archive, root]);
  const cli = path.join(root, 'package', policy.distribution.entry);
  verifyPublisher(cli, policy);
  const output = execFileSync(process.execPath, [cli, '--version', '--ignore-workspace'], {
    cwd: root, env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: path.join(root, 'config'), PNPM_HOME: path.join(root, 'home') }, encoding: 'utf8'
  });
  assert.equal(output.trim(), policy.version);
  appendFileSync(process.env.GITHUB_ENV, `PNPM_RELEASE_CLI=${cli}\n`);
  console.log(`Verified JavaScript pnpm ${policy.version} on Node ${policy.node}`);
} finally { rmSync(archive, { force: true }); }
