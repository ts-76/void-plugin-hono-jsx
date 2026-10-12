import { consumerStack } from '../consumer-launcher.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { json, sha256, inside, inspectTarball, registry } from './gate.mjs';
import { dependencyAudit } from './dependency-audit.mjs';

const root = process.cwd();
const policy = json('release-policy.json');
const pkgRoot = inside(root, policy.packagePath);
const pkg = json(path.join(pkgRoot, 'package.json'));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run with npm run release:prepare');
assert.equal(pkg.name, policy.packageName);
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.notEqual(pkg.version, '0.0.0');
assert.equal(process.version, 'v' + policy.releaseNode, 'Use the configured release Node');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const clean = () => assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '', 'Commit source before preparing release evidence');
clean();
const commit = git(['rev-parse', 'HEAD']);
const sourceMetadataSha256 = sha256(readFileSync(path.join(pkgRoot, 'package.json')));
const output = path.join(root, 'artifacts');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
const temporary = mkdtempSync(path.join(tmpdir(), 'hono-pages-release-'));
const env = { ...process.env, WRANGLER_LOG_PATH: path.join(temporary, 'logs'), WRANGLER_SEND_METRICS: 'false', VOID_INSPECTOR_PORT: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
const npm = (args, cwd = root, capture = false) => execFileSync(process.execPath, [npmCli, ...args], { cwd, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', timeout: 10 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
try {
  dependencyAudit({ npmCli, cwd: root, env, output: path.join(output, 'dependency-audit.json') });
  for (const command of ['audit:release', 'audit:history', 'audit:secrets', 'typecheck', 'test', 'build:custom-ssr', 'check:source', 'build:package']) npm(['run', command]);
  const candidate = path.join(temporary, 'package');
  mkdirSync(candidate);
  for (const file of pkg.files) cpSync(path.join(pkgRoot, file), path.join(candidate, file), { recursive: true });
  // Source stays private. This one documented metadata change is isolated to the
  // candidate and recorded before its exact bytes are exercised by the consumer.
  writeFileSync(path.join(candidate, 'package.json'), JSON.stringify({ ...pkg, private: false }, null, 2) + '\n');
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', output], candidate, true));
  assert.equal(packed.length, 1);
  const tarball = path.join(output, packed[0].filename);
  const files = inspectTarball(tarball);
  const acceptedSha256 = sha256(readFileSync(tarball));
  env.RELEASE_CONSUMER_AUDIT = path.join(output, 'consumer-dependency-audit.json');
  npm(['run', 'check:consumer', '--', '--tarball', tarball]);
  const dryRun = JSON.parse(npm(['publish', tarball, '--dry-run', '--ignore-scripts', '--json', '--registry', registry, '--access', 'public', '--tag', policy.distTag, '--provenance=false'], root, true));
  writeFileSync(path.join(output, 'dry-run.json'), JSON.stringify(dryRun, null, 2) + '\n');
  assert.equal(sha256(readFileSync(tarball)), acceptedSha256, 'Candidate bytes changed');
  clean();
  assert.equal(git(['rev-parse', 'HEAD']), commit, 'Source commit changed during validation');
  assert.equal(sha256(readFileSync(path.join(pkgRoot, 'package.json'))), sourceMetadataSha256);
  const bytes = readFileSync(tarball);
  const evidence = { schema: 2, commit, node: process.version, package: { name: pkg.name, version: pkg.version }, packagePath: policy.packagePath,
    sourceMetadataSha256, candidateMetadataChange: { private: false }, tarball: packed[0].filename, files, sha256: acceptedSha256,
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), size: bytes.length,
    validation: { typecheck: true, build: true, test: true, source: true, history: true, secrets: true, dryRun: true, externalConsumer: true },
    historyReportSha256: sha256(readFileSync(path.join(output, 'history-audit.json'))),
    dependencyReportSha256: sha256(readFileSync(path.join(output, 'dependency-audit.json'))),
    consumerDependencyReportSha256: sha256(readFileSync(path.join(output, 'consumer-dependency-audit.json'))),
    consumerStack: consumerStack(),
    workflow: process.env.GITHUB_WORKFLOW_REF || null, runId: process.env.GITHUB_RUN_ID || null, runAttempt: process.env.GITHUB_RUN_ATTEMPT || null };
  writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Prepared ${pkg.name}@${pkg.version}: ${files.length} files; SHA256 ${evidence.sha256}. No registry upload or approval performed.`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
