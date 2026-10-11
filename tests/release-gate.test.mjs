import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPlan, inspectArtifact, inspectTarball, metadataBlockers, sha256, stageArguments } from '../scripts/release/gate.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hono-release-gate-'));
  const pkgRoot = path.join(root, 'packages/hono-pages');
  const artifactRoot = path.join(root, 'artifacts');
  const candidate = path.join(root, 'candidate/package');
  for (const directory of [pkgRoot, artifactRoot, candidate]) mkdirSync(directory, { recursive: true });
  const policy = { repository: 'ts-76/void-hono-jsx-poc', packageName: 'void-plugin-hono-jsx', packagePath: 'packages/hono-pages', tagPrefix: 'v', releaseNode: '24.21.0', nodeVersions: ['24.21.0'], distTag: 'next', stageEnabled: false, publicPackageEnabled: false, provenance: true, historyDisclosureApproved: false, npmOwner: '', reviewers: [], preventSelfReview: true };
  const pkg = { name: policy.packageName, version: '0.1.0-alpha.0', private: true, license: 'MIT', repository: { url: 'https://github.com/' + policy.repository + '.git' }, publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/', tag: 'next' }, exports: { './plugin': { types: './dist/plugin.d.ts', import: './dist/plugin.js' } } };
  writeFileSync(path.join(root, 'release-policy.json'), JSON.stringify(policy));
  writeFileSync(path.join(pkgRoot, 'package.json'), JSON.stringify(pkg));
  writeFileSync(path.join(root, 'CHANGELOG.md'), '## 0.1.0-alpha.0 (candidate)\n');
  const contents = { 'package.json': JSON.stringify({ ...pkg, private: false }), 'README.md': 'Package guide', 'LICENSE': 'MIT License', 'THIRD_PARTY_NOTICES.md': 'Notices', 'CHANGELOG.md': '## 0.1.0-alpha.0 (candidate)\n', 'dist/plugin.js': 'export const value = 1;', 'dist/plugin.d.ts': 'export declare const value = 1;' };
  for (const [file, content] of Object.entries(contents)) {
    mkdirSync(path.dirname(path.join(candidate, file)), { recursive: true });
    writeFileSync(path.join(candidate, file), content);
    if (file !== 'package.json') { mkdirSync(path.dirname(path.join(pkgRoot, file)), { recursive: true }); writeFileSync(path.join(pkgRoot, file), content); }
  }
  const tarball = path.join(artifactRoot, 'candidate.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', path.join(root, 'candidate'), ...Object.keys(contents).map(file => 'package/' + file)]);
  const evidence = { schema: 2, commit: 'abc', node: 'v24.21.0', package: { name: pkg.name, version: pkg.version }, packagePath: policy.packagePath, sourceMetadataSha256: sha256(readFileSync(path.join(pkgRoot, 'package.json'))), tarball: 'candidate.tgz', files: Object.keys(contents), sha256: sha256(readFileSync(tarball)), validation: { typecheck: true, build: true, test: true, source: true, history: true, secrets: true, dryRun: true, externalConsumer: true } };
  evidence.integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarball)).digest('base64');
  for (const [file, key] of [['history-audit.json', 'historyReportSha256'], ['dependency-audit.json', 'dependencyReportSha256'], ['consumer-dependency-audit.json', 'consumerDependencyReportSha256']]) {
    const content = JSON.stringify({ metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} });
    writeFileSync(path.join(artifactRoot, file), content);
    evidence[key] = sha256(content);
  }
  writeFileSync(path.join(artifactRoot, 'evidence.json'), JSON.stringify(evidence));
  return { root, pkgRoot, artifactRoot, tarball, pkg, policy, evidence, options: { root, artifactRoot, commit: 'abc', ref: 'refs/tags/v0.1.0-alpha.0' }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('preparation accepts the isolated private=false candidate and keeps publication blocked', () => {
  const f = fixture(); try {
    assert.equal(inspectArtifact(f.options).pkg.private, false);
    assert.deepEqual(createPlan(f.options).blockers, ['stage-disabled', 'public-package-disabled', 'npm-owner', 'history-disclosure-unapproved', 'dependency-security-unapproved', 'reviewers-unconfigured']);
    assert.throws(() => stageArguments(createPlan(f.options), f.policy, f.tarball), /Blocked/);
  } finally { f.cleanup(); }
});

test('artifact checks reject changed bytes, commit, source metadata and validation', () => {
  const f = fixture(); try {
    assert.throws(() => inspectArtifact({ ...f.options, commit: 'other' }), /Commit changed/);
    writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify({ ...f.evidence, validation: { ...f.evidence.validation, externalConsumer: false } }));
    assert.throws(() => inspectArtifact(f.options));
    writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify(f.evidence));
    writeFileSync(path.join(f.pkgRoot, 'package.json'), JSON.stringify({ ...f.pkg, name: 'different' }));
    assert.throws(() => inspectArtifact(f.options), /Source metadata changed/);
    writeFileSync(path.join(f.pkgRoot, 'package.json'), JSON.stringify(f.pkg));
    writeFileSync(f.tarball, Buffer.concat([readFileSync(f.tarball), Buffer.from('changed')]));
    assert.throws(() => inspectArtifact(f.options), /Tarball changed/);
  } finally { f.cleanup(); }
});

test('modified audit evidence and newly unreviewed dependency advisories block staging', () => {
  const f = fixture(); try {
    const report = { metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { esbuild: { via: [{ url: 'https://github.com/advisories/GHSA-example' }] } } };
    const content = JSON.stringify(report);
    writeFileSync(path.join(f.artifactRoot, 'dependency-audit.json'), content);
    assert.throws(() => inspectArtifact(f.options), /Audit report changed/);
    f.evidence.dependencyReportSha256 = sha256(content);
    writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify(f.evidence));
    assert.ok(createPlan(f.options).blockers.includes('dependency-advisories-unreviewed'));
  } finally { f.cleanup(); }
});

test('public metadata and tag must match the reviewed experimental policy', () => {
  const f = fixture(); try {
    const policy = { ...f.policy, stageEnabled: true, publicPackageEnabled: true, historyDisclosureApproved: true, dependencySecurityApproved: true, npmOwner: 'publisher', reviewers: [{ type: 'User', login: 'reviewer' }] };
    const pkg = { ...f.pkg, private: false };
    const context = { ref: f.options.ref, changelog: '## 0.1.0-alpha.0', license: 'MIT' };
    assert.deepEqual(metadataBlockers(pkg, policy, context), []);
    assert.ok(metadataBlockers(pkg, { ...policy, distTag: 'latest' }, context).includes('dist-tag'));
    assert.ok(metadataBlockers(pkg, policy, { ...context, ref: 'refs/heads/main' }).includes('version-tag'));
    assert.ok(metadataBlockers({ ...pkg, publishConfig: { ...pkg.publishConfig, registry: 'https://example.com/' } }, policy, context).includes('publish-config'));
  } finally { f.cleanup(); }
});

test('tarball allowlist rejects unexpected files and symbolic links', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.root, 'candidate/package/unexpected.txt'), 'Unexpected');
    execFileSync('tar', ['-czf', f.tarball, '-C', path.join(f.root, 'candidate'), 'package/unexpected.txt']);
    assert.throws(() => inspectTarball(f.tarball), /Unexpected packed file/);
    execFileSync('ln', ['-s', 'README.md', path.join(f.root, 'candidate/package/alias.js')]);
    execFileSync('tar', ['-czf', f.tarball, '-C', path.join(f.root, 'candidate'), 'package/alias.js']);
    assert.throws(() => inspectTarball(f.tarball), /regular files/);
  } finally { f.cleanup(); }
});
