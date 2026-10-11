import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const patterns = [
  ['personal paths', /\/(?:Users|home)\/[^/\s]+\/|\/private\/var\/|\/var\/folders\//],
  ['GitHub credentials', /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['private keys', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access keys', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['credential-bearing URLs', /https?:\/\/[^/\s:@]+:[^/\s@]+@/],
];
const failures = [];
for (const file of files) {
  if (/(^|\/)(?:node_modules|dist|\.runtime|\.void|\.wrangler)\/|\.tgz$|(?:^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) failures.push(`${file}: accidental artifact`);
  const content = readFileSync(file, 'utf8');
  for (const [category, pattern] of patterns) if (pattern.test(content)) failures.push(`${file}: ${category}`);
}
const notice = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
assert.equal(readFileSync('packages/hono-pages/THIRD_PARTY_NOTICES.md', 'utf8'), notice);
const pkg = JSON.parse(readFileSync('packages/hono-pages/package.json', 'utf8'));
assert.equal(pkg.name, 'void-plugin-hono-jsx');
assert.ok(pkg.files.includes('THIRD_PARTY_NOTICES.md'));
assert.equal(pkg.license, 'MIT');
assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).license, 'MIT');
assert.equal(readFileSync('packages/hono-pages/LICENSE', 'utf8'), readFileSync('LICENSE', 'utf8'));
assert.ok(pkg.files.includes('LICENSE'));
if (failures.length) throw new Error(`Release audit failed:\n${failures.join('\n')}`);
console.log(`Release audit passed for ${files.length} tracked/proposed files; no configured path, credential or accidental-artifact patterns found. Upstream notices match.`);
console.log('This scans the current tree, not Git history, and does not certify the absence of every secret. MIT license files and metadata match; CI and publication decisions remain release gates.');
