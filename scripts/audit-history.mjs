import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') throw new Error('Fetch full history before auditing');
const commits = git(['rev-list', '--all']).trim().split('\n').filter(Boolean);
const blobs = new Map();
for (const commit of commits) {
  for (const entry of git(['ls-tree', '-rz', commit]).split('\0').filter(Boolean)) {
    const [header, file] = entry.split('\t');
    const [, type, id] = header.split(' ');
    if (type === 'blob' && !blobs.has(id)) blobs.set(id, file);
  }
}
const patterns = [
  ['personal-path', /\/(?:Users|home)\/[^/\s]+\/|\/private\/var\/|\/var\/folders\//],
  ['github-credential', /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['credential-url', /https?:\/\/[^/\s:@]+:[^/\s@]+@/],
];
const output = execFileSync('git', ['cat-file', '--batch'], { input: [...blobs.keys()].join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
const findings = [];
let offset = 0;
while (offset < output.length) {
  const end = output.indexOf(10, offset);
  const [id, type, size] = output.subarray(offset, end).toString().split(' ');
  if (type !== 'blob') throw new Error('Unexpected history object');
  const start = end + 1;
  const content = output.subarray(start, start + Number(size)).toString('utf8');
  for (const [category, pattern] of patterns) if (pattern.test(content)) findings.push({ category, file: blobs.get(id), blob: id });
  offset = start + Number(size) + 1;
}
const report = { schema: 1, commits: commits.length, blobs: blobs.size, findings,
  historicalArtifacts: [...new Set([...blobs.values()].filter(file => /(^|\/)(evidence|dist|node_modules)\/|\.(log|tgz)$/.test(file)))],
  limitation: 'Configured patterns only. Findings omit matched values. Gitleaks and maintainer disclosure review are separate checks.' };
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/history-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(`History audit: ${report.commits} commits, ${report.blobs} unique blobs, ${findings.filter(f => f.category === 'personal-path').length} personal-path findings, ${report.historicalArtifacts.length} historical artifact paths.`);
if (findings.some(f => f.category !== 'personal-path')) throw new Error('Credential patterns found in history; inspect the redacted report before release');
console.log('No configured credential patterns found. Personal paths and old artifacts require review before repository disclosure.');
