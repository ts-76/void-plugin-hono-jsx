import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256 } from '../scripts/release/gate.mjs';
export function releaseFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hono-release-gate-'));
  const pkgRoot = path.join(root, 'packages/hono-pages');
  const artifactRoot = path.join(root, 'artifacts');
  const candidate = path.join(root, 'candidate/package');
  for (const directory of [pkgRoot, artifactRoot, candidate]) mkdirSync(directory, { recursive: true });
  const policy = { repository: 'ts-76/void-plugin-hono-jsx', packageName: 'void-plugin-hono-jsx', packagePath: 'packages/hono-pages', tagPrefix: 'v', releaseNode: '24.22.1', pnpmVersion: '12.11.2', nodeVersions: ['24.22.1'], distTag: 'next', stageEnabled: false, publicPackageEnabled: false, provenance: true, historyDisclosureApproved: false, npmOwner: '', reviewers: [], preventSelfReview: true };
  const pkg = { name: policy.packageName, version: '0.1.0-alpha.0', private: true, license: 'MIT', repository: { url: 'https://github.com/' + policy.repository + '.git' }, publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/', tag: 'next' }, exports: { './plugin': { types: './dist/plugin.d.ts', import: './dist/plugin.js' } } };
  writeFileSync(path.join(root, 'release-policy.json'), JSON.stringify(policy));
  writeFileSync(path.join(pkgRoot, 'package.json'), JSON.stringify(pkg));
  writeFileSync(path.join(root, 'CHANGELOG.md'), '## 0.1.0-alpha.0 (candidate)\n');
  const contents = { 'package.json': JSON.stringify({ ...pkg, private: false }), 'README.md': 'Package guide', 'LICENSE': 'MIT License', 'THIRD_PARTY_NOTICES.md': 'Notices', 'CHANGELOG.md': '## 0.1.0-alpha.0 (candidate)\n', 'dist/plugin.js': 'export const value = 1;\n//# sourceMappingURL=plugin.js.map', 'dist/plugin.d.ts': 'export declare const value = 1;\n//# sourceMappingURL=plugin.d.ts.map',
    'src/plugins/plugin.ts': 'export const value = 1;',
    'dist/plugin.js.map': JSON.stringify({ version: 3, file: 'plugin.js', names: [], sources: ['../src/plugins/plugin.ts'], sourcesContent: ['export const value = 1;'], mappings: 'AAAA' }),
    'dist/plugin.d.ts.map': JSON.stringify({ version: 3, file: 'plugin.d.ts', names: [], sources: ['../src/plugins/plugin.ts'], mappings: 'AAAA' }) };
  for (const [file, content] of Object.entries(contents)) {
    mkdirSync(path.dirname(path.join(candidate, file)), { recursive: true });
    writeFileSync(path.join(candidate, file), content);
    if (file !== 'package.json') { mkdirSync(path.dirname(path.join(pkgRoot, file)), { recursive: true }); writeFileSync(path.join(pkgRoot, file), content); }
  }
  const tarball = path.join(artifactRoot, 'candidate.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', path.join(root, 'candidate'), ...Object.keys(contents).map(file => 'package/' + file)]);
  const evidence = { schema: 2, commit: 'abc', node: 'v24.22.1', package: { name: pkg.name, version: pkg.version }, packagePath: policy.packagePath, sourceMetadataSha256: sha256(readFileSync(path.join(pkgRoot, 'package.json'))), tarball: 'candidate.tgz', files: Object.keys(contents), sha256: sha256(readFileSync(tarball)), validation: { typecheck: true, build: true, test: true, source: true, history: true, secrets: true, dryRun: true, externalConsumer: true } };
  evidence.integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarball)).digest('base64');
  for (const [file, key] of [['history-audit.json', 'historyReportSha256'], ['dependency-audit.json', 'dependencyReportSha256'], ['consumer-dependency-audit.json', 'consumerDependencyReportSha256']]) {
    const content = JSON.stringify({ metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} });
    writeFileSync(path.join(artifactRoot, file), content);
    evidence[key] = sha256(content);
  }
  writeFileSync(path.join(artifactRoot, 'evidence.json'), JSON.stringify(evidence));
  return { root, pkgRoot, artifactRoot, tarball, pkg, policy, evidence, options: { root, artifactRoot, commit: 'abc', ref: 'refs/tags/v0.1.0-alpha.0' }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
