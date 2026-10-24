// Evaluation only. The upload runner never imports this descriptor or script.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonical, requestBytes, requestJson } from './publisher.mjs';

const policy = JSON.parse(readFileSync(new URL('./npm-candidate.json', import.meta.url)));
assert.equal(policy.schema, 1);
assert.equal(policy.manager, 'npm');
assert.equal(policy.status, 'evaluation-only; not an upload policy');
assert.equal(process.version, `v${policy.node}`);
assert.ok(process.env.RUNNER_TEMP);
const root = path.join(process.env.RUNNER_TEMP, 'npm-candidate-cli');
mkdirSync(root, { mode: 0o700 });
const archive = path.join(root, 'distribution.tgz');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const bytes = await requestBytes(policy.distribution.url, {}, 64 * 1024 * 1024);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, policy.distribution.integrity);
  writeFileSync(archive, bytes);
  execFileSync('python3', ['-c', `import pathlib,sys,tarfile
with tarfile.open(sys.argv[1]) as tar:
 names=set()
 for member in tar.getmembers():
  parts=pathlib.PurePosixPath(member.name).parts
  assert member.isfile() and parts[0]=='package' and '..' not in parts and not member.name.startswith('/')
  assert member.name not in names
  names.add(member.name)
 tar.extractall(sys.argv[2],filter='data')`, archive, root]);
  const packageRoot = path.join(root, 'package');
  const files = [], packages = new Map();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        assert.ok(entry.isFile(), 'Non-regular candidate file');
        const content = readFileSync(file);
        files.push({ path: path.relative(packageRoot, file).replaceAll('\\', '/'), sha256: sha256(content) });
        if (entry.name === 'package.json') {
          const metadata = JSON.parse(content);
          if (metadata.name && metadata.version) packages.set(`${metadata.name}@${metadata.version}`, { name: metadata.name, version: metadata.version });
        }
      }
    }
  }
  visit(packageRoot);
  files.sort((a, b) => a.path < b.path ? -1 : 1);
  const inventory = [...packages.values()].sort((a, b) => `${a.name}@${a.version}` < `${b.name}@${b.version}` ? -1 : 1);
  assert.equal(files.length, policy.files);
  assert.equal(sha256(JSON.stringify(files)), policy.filesSha256, 'Candidate files changed');
  assert.equal(inventory.length, policy.packages);
  assert.equal(sha256(JSON.stringify(inventory)), policy.inventorySha256, 'Candidate inventory changed');
  assert.equal(JSON.parse(readFileSync(path.join(packageRoot, 'package.json'))).version, policy.version);
  const reportDirectory = path.join(process.env.RUNNER_TEMP, 'npm-candidate-report');
  mkdirSync(reportDirectory, { mode: 0o700 });
  writeFileSync(path.join(reportDirectory, 'files.json'), JSON.stringify(files, null, 2) + '\n');
  writeFileSync(path.join(reportDirectory, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
  const result = await requestJson('https://api.osv.dev/v1/querybatch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries: inventory.map(pkg => ({ package: { name: pkg.name, ecosystem: 'npm' }, version: pkg.version })) }),
  });
  assert.equal(result.results?.length, inventory.length, 'Incomplete candidate audit');
  const findings = [];
  for (const [index, entry] of result.results.entries()) {
    assert.ok(!entry.next_page_token, 'Candidate audit pagination requires review');
    for (const vulnerability of entry.vulns || []) {
      assert.match(vulnerability.id, /^(?:CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)$/);
      const advisory = await requestJson(`https://api.osv.dev/v1/vulns/${vulnerability.id}`);
      assert.equal(advisory.id, vulnerability.id);
      findings.push({ ...inventory[index], id: advisory.id, modified: advisory.modified, advisorySha256: sha256(canonical(advisory)) });
    }
  }
  writeFileSync(path.join(reportDirectory, 'audit.json'), JSON.stringify({
    node: process.version, version: policy.version, inventorySha256: policy.inventorySha256,
    auditedPackages: inventory.length, findings,
    status: findings.length ? 'blocked: unreviewed findings; evaluation only' : 'evaluation only; upload integration is not approved',
  }, null, 2) + '\n');
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `NPM_CANDIDATE_CLI=${path.join(packageRoot, policy.distribution.entry)}\n`);
  console.log(`Evaluation only: ${files.length} files, ${inventory.length} packages, ${findings.length} unreviewed findings. No upload policy changed.`);
} finally {
  rmSync(archive, { force: true });
}
