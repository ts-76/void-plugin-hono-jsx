import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { inspectSourceMaps } from './source-maps.mjs';
import path from 'node:path';
export const registry = 'https://registry.npmjs.org/';
export const json = file => JSON.parse(readFileSync(file, 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function inside(root, relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(!path.isAbsolute(relative));
  const parent = realpathSync(root), child = realpathSync(path.resolve(root, relative));
  assert.ok(child === parent || child.startsWith(`${parent}${path.sep}`), 'Path escapes root');
  return child;
}
export function metadataBlockers(pkg, policy, { ref, changelog, license }) {
  const blockers = [];
  const require = (condition, label) => { if (!condition) blockers.push(label); };
  require(policy.stageEnabled === true, 'stage-disabled');
  require(policy.publicPackageEnabled === true && pkg.private === false, 'public-package-disabled');
  require(/^[\w.-]+\/[\w.-]+$/.test(policy.repository) && !policy.repository.includes('OWNER'), 'repository-unconfigured');
  require(pkg.repository?.url === `https://github.com/${policy.repository}.git`, 'repository-mismatch');
  require(pkg.name === policy.packageName && !pkg.name.includes('placeholder'), 'package-name');
  require(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version) && pkg.version !== '0.0.0', 'version');
  require(ref === `refs/tags/${policy.tagPrefix}${pkg.version}`, 'version-tag');
  require(Boolean(pkg.license && pkg.license !== 'UNLICENSED' && license.trim()), 'license');
  require(changelog.split('\n').some(line => line.startsWith(`## ${pkg.version} `) || line === `## ${pkg.version}` || line.startsWith(`## [${pkg.version}](`)), 'release-notes');
  require(/^[a-z0-9][a-z0-9._-]*$/.test(policy.npmOwner), 'npm-owner');
  require((pkg.version.includes('-') ? policy.distTag === 'next' : ['next', 'latest'].includes(policy.distTag)), 'dist-tag');
  require(policy.provenance === true, 'provenance-required');
  require(/^\d+\.\d+\.\d+$/.test(policy.pnpmVersion), 'publisher-version');
  require(policy.historyDisclosureApproved === true, 'history-disclosure-unapproved');
  require(policy.dependencySecurityApproved === true, 'dependency-security-unapproved');
  require(Array.isArray(policy.reviewers) && policy.reviewers.length > 0 && policy.reviewers.every(r => ['User', 'Team'].includes(r.type) && /^[\w.-]+$/.test(r.login)), 'reviewers-unconfigured');
  require(typeof policy.preventSelfReview === 'boolean', 'self-review-policy');
  require(policy.nodeVersions.includes(policy.releaseNode), 'release-node');
  require(pkg.publishConfig?.registry === registry && pkg.publishConfig?.access === 'public' && pkg.publishConfig?.tag === policy.distTag && Object.keys(pkg.publishConfig).length === 3, 'publish-config');
  return blockers;
}
export function inspectArtifact({ root = process.cwd(), artifactRoot = path.join(root, 'artifacts'), commit }) {
  const policy = json(path.join(root, 'release-policy.json'));
  const pkgRoot = inside(root, policy.packagePath);
  const pkg = json(path.join(pkgRoot, 'package.json'));
  const evidence = json(path.join(artifactRoot, 'evidence.json'));
  assert.equal(evidence.schema, 2);
  assert.equal(evidence.sourceMetadataSha256, sha256(readFileSync(path.join(pkgRoot, 'package.json'))), 'Source metadata changed');
  assert.equal(evidence.commit, commit, 'Commit changed');
  assert.deepEqual(evidence.package, { name: pkg.name, version: pkg.version });
  assert.equal(evidence.packagePath, policy.packagePath);
  assert.equal(evidence.node, `v${policy.releaseNode}`, 'Candidate must use the configured release Node');
  assert.match(evidence.tarball, /^[\w.+-]+\.tgz$/);
  const tarball = inside(artifactRoot, evidence.tarball);
  const bytes = readFileSync(tarball);
  assert.equal(sha256(bytes), evidence.sha256, 'Tarball changed');
  assert.equal(evidence.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`, 'Tarball integrity changed');
  for (const [file, digest] of [['history-audit.json', evidence.historyReportSha256], ['dependency-audit.json', evidence.dependencyReportSha256], ['consumer-dependency-audit.json', evidence.consumerDependencyReportSha256]]) {
    assert.equal(sha256(readFileSync(path.join(artifactRoot, file))), digest, `Audit report changed: ${file}`);
  }
  assert.deepEqual(evidence.validation, { typecheck: true, build: true, test: true, source: true, history: true, secrets: true, dryRun: true, externalConsumer: true });
  const { files, contents } = inspectArchive(bytes, evidence.files);
  const packed = JSON.parse(contents.get('package.json'));
  assert.deepEqual(packed, { ...pkg, private: false }, 'Packed metadata changed');
  const sourceFiles = directory => readdirSync(path.join(pkgRoot, directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  assert.deepEqual(files.filter(file => file.startsWith('src/')).sort(), sourceFiles('src').sort(), 'Packaged source file set changed');
  for (const file of files.filter(file => file.startsWith('src/'))) {
    assert.equal(contents.get(file), readFileSync(inside(pkgRoot, file), 'utf8'), `Packaged source changed: ${file}`);
  }
  for (const file of files.filter(file => file.startsWith('src/theme/'))) assert.equal(contents.get(file.replace('src/', 'dist/')), contents.get(file), `Packed theme differs from source: ${file}`);
  assert.equal(contents.get('THIRD_PARTY_NOTICES.md'), readFileSync(path.join(pkgRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8'));
  for (const entry of Object.values(packed.exports)) {
    for (const target of Object.values(entry)) assert.ok(evidence.files.includes(target.replace(/^\.\//, '')), 'Missing export target');
  }
  assert.equal(contents.get('CHANGELOG.md'), readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), 'Packed release notes changed');
  const license = readFileSync(path.join(pkgRoot, 'LICENSE'), 'utf8');
  assert.equal(contents.get('LICENSE'), license);
  assert.equal(sha256(readFileSync(tarball)), evidence.sha256, 'Tarball changed during inspection');
  return { pkg: packed, policy, evidence, tarball, license, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
}
export function createPlan(options) {
  const artifact = inspectArtifact(options);
  const changelog = readFileSync(path.join(options.root || process.cwd(), 'CHANGELOG.md'), 'utf8');
  const blockers = metadataBlockers(artifact.pkg, artifact.policy, { ref: options.ref, changelog, license: artifact.license });
  const dependencyAudit = json(path.join(options.artifactRoot || path.join(options.root || process.cwd(), 'artifacts'), 'dependency-audit.json'));
  const consumerAudit = json(path.join(options.artifactRoot || path.join(options.root || process.cwd(), 'artifacts'), 'consumer-dependency-audit.json'));
  const advisories = [...new Set([dependencyAudit, consumerAudit].flatMap(report => Object.values(report.vulnerabilities || {}).flatMap(item => item.via.filter(via => typeof via === 'object').map(via => via.url))))];
  if (advisories.some(url => !artifact.policy.approvedDependencyAdvisories?.includes(url))) blockers.push('dependency-advisories-unreviewed');
  return { status: blockers.length ? 'blocked' : 'ready', blockers, commit: options.commit, ref: options.ref,
    package: artifact.evidence.package, tarball: artifact.evidence.tarball, sha256: artifact.evidence.sha256,
    integrity: artifact.integrity, dependencyAudit: dependencyAudit.metadata.vulnerabilities, dependencyAdvisories: advisories,
    publisherAudit: 'Required in stage job; exact reviewed Rust findings only; new or changed findings block upload',
    stage: 'not executed', approval: 'npm maintainer review and personal 2FA' };
}
export function requireEnvironmentReview(environment, branches, policy) {
  assert.equal(environment.name, policy.environment);
  assert.equal(environment.can_admins_bypass, false, 'Admin bypass must be disabled');
  const rule = environment.protection_rules?.find(r => r.type === 'required_reviewers');
  assert.ok(rule, 'Required reviewers are missing');
  assert.equal(rule.prevent_self_review, policy.preventSelfReview);
  assert.deepEqual(rule.reviewers.map(r => ({ type: r.type, login: r.reviewer.login || r.reviewer.slug })).sort(compare), [...policy.reviewers].sort(compare));
  assert.deepEqual(environment.deployment_branch_policy, { custom_branch_policies: true, protected_branches: false });
  assert.equal(branches.branch_policies?.length, 1);
  assert.equal(branches.branch_policies[0].type, 'tag');
  assert.equal(branches.branch_policies[0].name, `${policy.tagPrefix}*`);
}
const compare = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
export function stageArguments(plan, policy, tarball) {
  assert.equal(plan.status, 'ready', `Blocked: ${plan.blockers.join(', ')}`);
  return ['stage', 'publish', path.resolve(tarball), '--ignore-scripts', '--json', '--registry', registry,
    '--access', 'public', '--tag', policy.distTag, '--provenance', '--reporter=silent', '--no-git-checks', '--ignore-workspace'];
}
export function stageReceipt(stdout, plan) {
  const parsed = JSON.parse(stdout);
  assert.deepEqual(Object.keys(parsed), [plan.package.name]);
  const result = parsed[plan.package.name];
  assert.equal(result.name, plan.package.name, 'Stage package changed');
  assert.equal(result.version, plan.package.version, 'Stage version changed');
  assert.equal(result.integrity, plan.integrity, 'Stage integrity changed');
  assert.ok(typeof result.stageId === 'string' && result.stageId.length, 'Stage ID missing: inspect npm before retry');
  return result;
}

export function inspectTarball(tarball, expectedFiles) {
  return inspectTarballContents(tarball, expectedFiles).files;
}

export function inspectTarballContents(tarball, expectedFiles) {
  const bytes = readFileSync(tarball);
  const inspected = inspectArchive(bytes, expectedFiles);
  assert.equal(sha256(readFileSync(tarball)), sha256(bytes), 'Tarball changed during inspection');
  return inspected;
}

function inspectArchive(bytes, expectedFiles) {
  const maxEntryBytes = 1024 * 1024;
  const maxArchiveBytes = 8 * 1024 * 1024;
  const env = { ...process.env, LC_ALL: 'C', TZ: 'UTC' };
  delete env.TAR_OPTIONS;
  // Every pass sees the same compressed snapshot, even if the file is replaced.
  // -P preserves original paths for validation; -O never extracts to the filesystem.
  // Ignore zero padding so a concatenated second archive cannot hide entries.
  const tar = args => execFileSync('tar', ['--ignore-zeros', ...args], { input: bytes, env, maxBuffer: maxArchiveBytes });
  const lines = buffer => { const rows = buffer.toString('utf8').split('\n'); if (rows.at(-1) === '') rows.pop(); return rows; };
  const names = lines(tar(['-tPzf', '-']));
  const listing = lines(tar(['-tPvzf', '-']));
  assert.equal(names.length, listing.length, 'Archive listings disagree');
  assert.ok(listing.length && listing.every(line => line.startsWith('-')), 'Tarball must contain only regular files');
  const files = names.map(name => {
    assert.ok(name.startsWith('package/'), 'Unexpected archive root');
    const file = name.slice(8);
    assert.ok(!file.split('/').some(part => !part || part === '.' || part === '..'), 'Unsafe archive path');
    assert.ok(['package.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md'].includes(file) || /^dist\/[\w/.-]+\.(js|d\.ts)(\.map)?$/.test(file) || /^src\/(plugins|runtime)\/[\w.-]+\.tsx?$/.test(file) || /^(src|dist)\/theme\/(index|content|reset|prose|code|containers)\.css$/.test(file), 'Unexpected packed file');
    return file;
  });
  assert.equal(new Set(files).size, files.length, 'Duplicate archive entry');
  if (expectedFiles) assert.deepEqual([...files].sort(), [...expectedFiles].sort(), 'Packed file list changed');
  const sizes = listing.map((line, index) => {
    assert.ok(line.endsWith(' ' + names[index]), 'Archive listing path changed');
    const columns = line.slice(0, -names[index].length).trim().split(/\s+/);
    let size;
    // GNU and BSD tar have different owner/date columns. Reject other formats.
    if (columns.length === 5 && /^\d{4}-\d{2}-\d{2}$/.test(columns[3]) && /^\d{2}:\d{2}$/.test(columns[4])) size = columns[2];
    if (columns.length === 8 && /^\d+$/.test(columns[1]) && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(columns[5]) && /^\d{1,2}$/.test(columns[6]) && /^(\d{4}|\d{2}:\d{2})$/.test(columns[7])) size = columns[4];
    assert.match(size ?? '', /^\d+$/, 'Unsupported archive size listing');
    const number = Number(size);
    assert.ok(Number.isSafeInteger(number) && number <= maxEntryBytes, 'Packed file exceeds inspection size limit');
    return number;
  });
  const total = sizes.reduce((sum, size) => sum + size, 0);
  assert.ok(total <= maxArchiveBytes, 'Archive exceeds inspection size limit');
  const payload = tar(['-xPOzf', '-']);
  assert.equal(payload.length, total, 'Archive payload size changed');
  let offset = 0;
  const contents = new Map();
  for (const [index, file] of files.entries()) {
    const content = payload.subarray(offset, offset + sizes[index]).toString('utf8'); offset += sizes[index];
    contents.set(file, content);
    assert.doesNotMatch(content, /\/(?:Users|home)\/[^/\s]+\/|\/private\/var\/|\/var\/folders\//, 'Machine-specific packed content');
  }
  inspectSourceMaps(contents);
  const pkg = JSON.parse(contents.get('package.json'));
  assert.ok(!pkg.scripts, 'Publishable adapter must not run package lifecycle scripts');
  assert.ok(!pkg.dependencies && !pkg.devDependencies, 'Only documented peer dependencies are shipped');
  return { files, contents };
}
