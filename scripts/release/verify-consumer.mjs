import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerStack } from '../consumer-launcher.mjs';
import { inspectArtifact, sha256 } from './gate.mjs';

/** Reuse one baseline-accepted candidate only within its originating CI run. */
export function verifyConsumerCandidate({ root = process.cwd(), artifactRoot = path.join(root, 'artifacts'), commit, env = process.env, runConsumer }) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Shared candidates require a GitHub Actions run');
  assert.match(env.GITHUB_RUN_ID ?? '', /^[1-9]\d*$/, 'Missing workflow run ID');
  assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9]\d*$/, 'Missing workflow attempt');
  assert.match(env.GITHUB_REF ?? '', /^refs\//, 'Missing workflow ref');
  const artifact = inspectArtifact({ root, artifactRoot, commit });
  const { evidence, policy, tarball } = artifact;
  assert.equal(process.version, `v${policy.releaseNode}`, 'Use the configured release Node');
  assert.equal(env.GITHUB_SHA, commit, 'Workflow source changed');
  assert.equal(env.GITHUB_REPOSITORY, policy.repository);
  assert.equal(env.GITHUB_WORKFLOW_REF, `${policy.repository}/.github/workflows/package.yml@${env.GITHUB_REF}`);
  assert.equal(evidence.workflow, env.GITHUB_WORKFLOW_REF, 'Candidate workflow changed');
  assert.equal(evidence.runId, env.GITHUB_RUN_ID, 'Candidate belongs to another run');
  assert.equal(evidence.runAttempt, env.GITHUB_RUN_ATTEMPT, 'Candidate belongs to another attempt');
  assert.deepEqual(evidence.consumerStack, consumerStack({ RELEASE_CONSUMER_STACK: 'baseline' }), 'Input must be the baseline-accepted candidate');
  const stack = consumerStack(env);
  assert.notEqual(stack.name, 'baseline', 'Baseline was already verified by preparation');
  const report = path.join(artifactRoot, 'consumer-dependency-audit.json');
  // A successful command must generate its own reports, never reuse the baseline audit.
  rmSync(report);
  rmSync(report.replace(/\.json$/, '-markdown.json'), { force: true });
  const consumerEnv = { ...env, RELEASE_CONSUMER_AUDIT: report };
  if (runConsumer) runConsumer({ tarball, env: consumerEnv });
  else {
    assert.ok(env.npm_execpath, 'Run with npm run release:verify-consumer');
    execFileSync(process.execPath, [env.npm_execpath, 'run', 'check:consumer', '--', '--tarball', tarball], { cwd: root, env: consumerEnv, stdio: 'inherit', timeout: 10 * 60 * 1000 });
  }
  const verified = { ...evidence, consumerStack: stack, consumerDependencyReportSha256: sha256(readFileSync(report)) };
  writeFileSync(path.join(artifactRoot, 'evidence.json'), JSON.stringify(verified, null, 2) + '\n');
  // Recheck raw bytes, source/maps, original common audits and the fresh consumer report.
  inspectArtifact({ root, artifactRoot, commit });
  console.log(`Verified the same candidate ${evidence.sha256} with locked ${stack.name}. No upload or stage performed.`);
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd();
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const clean = () => assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '', 'Release source must remain clean');
  clean(); const commit = git(['rev-parse', 'HEAD']);
  verifyConsumerCandidate({ root, commit });
  clean(); assert.equal(git(['rev-parse', 'HEAD']), commit, 'Source commit changed');
}
