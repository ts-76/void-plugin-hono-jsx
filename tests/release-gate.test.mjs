import { releaseFixture as fixture } from './release-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPlan, inspectArtifact, inspectTarball, metadataBlockers, sha256, stageArguments } from '../scripts/release/gate.mjs';


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

test('accepted dependency advisory remains reported while new consumer findings block staging', () => {
  const f = fixture(); try {
    const accepted = 'https://github.com/advisories/GHSA-67mh-4wv8-2f99';
    const report = { metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { esbuild: { via: [{ url: accepted }] } } };
    const content = JSON.stringify(report);
    writeFileSync(path.join(f.artifactRoot, 'dependency-audit.json'), content);
    assert.throws(() => inspectArtifact(f.options), /Audit report changed/);
    f.evidence.dependencyReportSha256 = sha256(content);
    writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify(f.evidence));
    assert.ok(createPlan(f.options).blockers.includes('dependency-advisories-unreviewed'));
    writeFileSync(path.join(f.root, 'release-policy.json'), JSON.stringify({ ...f.policy, dependencySecurityApproved: true, approvedDependencyAdvisories: [accepted] }));
    const plan = createPlan(f.options);
    assert.deepEqual(plan.dependencyAdvisories, [accepted]);
    assert.equal(plan.dependencyAudit.total, 1);
    assert.ok(!plan.blockers.includes('dependency-advisories-unreviewed'));
    assert.ok(!plan.blockers.includes('dependency-security-unapproved'));
    assert.equal(plan.status, 'blocked');
    assert.throws(() => stageArguments(plan, f.policy, f.tarball), /Blocked/);

    const newFinding = JSON.stringify({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { other: { via: [{ url: 'https://github.com/advisories/GHSA-new-finding' }] } } });
    writeFileSync(path.join(f.artifactRoot, 'consumer-dependency-audit.json'), newFinding);
    assert.throws(() => inspectArtifact(f.options), /Audit report changed/);
    f.evidence.consumerDependencyReportSha256 = sha256(newFinding);
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

test('artifact inspection rejects packaged source differing from the reviewed checkout', () => {
  const f = fixture(); try {
    writeFileSync(path.join(f.pkgRoot, 'src/plugins/plugin.ts'), 'export const changed = 2;');
    assert.throws(() => inspectArtifact(f.options), /Packaged source changed/);
  } finally { f.cleanup(); }
});

test('RC and normal-release tags cannot silently target the wrong installation channel', () => {
  const f = fixture();
  try {
    const base = { ...f.policy, stageEnabled: true, publicPackageEnabled: true, historyDisclosureApproved: true, dependencySecurityApproved: true, npmOwner: 'publisher', reviewers: [{ type: 'User', login: 'reviewer' }] };
    for (const [version, tag, accepted] of [['0.1.0-rc.0','next',true], ['0.1.0-rc.0','latest',false], ['0.1.0','next',true], ['0.1.0','latest',true], ['0.1.0','other',false]]) {
      const pkg = { ...f.pkg, private: false, version, publishConfig: { ...f.pkg.publishConfig, tag } };
      const blockers = metadataBlockers(pkg, { ...base, distTag: tag }, { ref: `refs/tags/v${version}`, changelog: `## ${version}`, license: 'MIT' });
      assert.equal(blockers.includes('dist-tag'), !accepted, `${version}/${tag}`);
      if (accepted) assert.deepEqual(blockers, []);
      assert.ok(metadataBlockers(pkg, { ...base, distTag: tag === 'next' ? 'latest' : 'next' }, { ref: `refs/tags/v${version}`, changelog: `## ${version}`, license: 'MIT' }).includes('publish-config'));
    }
  } finally { f.cleanup(); }
});
