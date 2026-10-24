import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_EVENT_NAME, 'push');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.equal(process.env.GITHUB_REPOSITORY, 'ts-76/void-plugin-hono-jsx');
assert.ok(process.env.RELEASE_CLI && process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
const pkg = JSON.parse(readFileSync('packages/hono-markdown/package.json'));
assert.equal(pkg.name, '@ts-76/hono-markdown');
const directory = path.resolve('common-artifact');
const archives = readdirSync(directory).filter(file => file.endsWith('.tgz'));
assert.deepEqual(archives, [`ts-76-hono-markdown-${pkg.version}.tgz`]);
const published = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`, { signal: AbortSignal.timeout(15000) });
assert.ok(published.status === 200 || published.status === 404, 'Registry preflight failed');
if (published.status === 200) {
  console.log(`${pkg.name}@${pkg.version} already exists; no new provenance generated.`);
} else {
  const archive = path.join(directory, archives[0]);
  const bytes = readFileSync(archive);
  const require = createRequire(path.join(path.dirname(process.env.RELEASE_CLI), '../package.json'));
  const npa = require('npm-package-arg');
  const { generateProvenance, verifyProvenance } = require(path.join(path.dirname(require.resolve('libnpmpublish')), 'provenance.js'));
  const subject = { name: npa.toPurl(npa.resolve(pkg.name, pkg.version)), digest: { sha512: createHash('sha512').update(bytes).digest('hex') } };
  const bundle = await generateProvenance([subject], {});
  const file = path.join(directory, `${archives[0]}.sigstore`);
  writeFileSync(file, JSON.stringify(bundle));
  await verifyProvenance(subject, file);
  const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64'));
  assert.ok(statement.predicate.buildDefinition.resolvedDependencies.some(entry => entry.digest.gitCommit === process.env.GITHUB_SHA));
  assert.equal(statement.predicate.buildDefinition.externalParameters.workflow.ref, 'refs/heads/main');
  console.log(`Signed and verified ${pkg.name}@${pkg.version} from ${process.env.GITHUB_SHA}; no npm upload performed.`);
}
