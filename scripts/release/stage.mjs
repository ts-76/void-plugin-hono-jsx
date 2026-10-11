import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createPlan, inspectArtifact, requireEnvironmentReview, stageArguments, stageReceipt, registry } from './gate.mjs';
// All checks precede the sole remote mutation. Never approve or directly publish here.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.NPM_STAGE_AUTHORIZATION, 'protected-environment');
assert.equal(process.env.NPM_STAGING_ENABLED, 'true');
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GITHUB_REF_TYPE, 'tag');
assert.ok(process.env.RELEASE_ARTIFACT_ROOT);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim()) throw new Error('Release source must remain clean');
assert.equal(commit, process.env.GITHUB_SHA);
const options = { commit, ref: process.env.GITHUB_REF, artifactRoot: process.env.RELEASE_ARTIFACT_ROOT };
const plan = createPlan(options);
assert.equal(plan.status, 'ready', `Blocked: ${plan.blockers.join(', ')}`);
const { policy, evidence } = inspectArtifact(options);
assert.equal(process.env.GITHUB_REPOSITORY, policy.repository);
assert.equal(evidence.runId, process.env.GITHUB_RUN_ID);
assert.equal(evidence.runAttempt, process.env.GITHUB_RUN_ATTEMPT);
assert.equal(evidence.workflow, `${policy.repository}/.github/workflows/npm-stage.yml@${process.env.GITHUB_REF}`);
assert.equal(execFileSync('git', ['rev-parse', `${process.env.GITHUB_REF}^{commit}`], { encoding: 'utf8' }).trim(), commit);
execFileSync('git', ['merge-base', '--is-ancestor', commit, `origin/${policy.defaultBranch}`]);
const get = async suffix => {
  const response = await fetch(`https://api.github.com/repos/${policy.repository}${suffix}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, 'Cannot verify GitHub protection');
  return response.json();
};
const repo = await get('');
assert.equal(repo.private, false, 'Provenance requires a public OSS copy');
requireEnvironmentReview(await get(`/environments/${encodeURIComponent(policy.environment)}`), await get(`/environments/${encodeURIComponent(policy.environment)}/deployment-branch-policies`), policy);
const version = await fetch(`${registry}${encodeURIComponent(plan.package.name)}/${encodeURIComponent(plan.package.version)}`, { signal: AbortSignal.timeout(15000) });
assert.equal(version.status, 404, 'Version exists or registry preflight failed');
const existing = await fetch(`${registry}${encodeURIComponent(plan.package.name)}`, { signal: AbortSignal.timeout(15000) });
assert.equal(existing.status, 200, 'Bootstrap package and Trusted Publisher manually first');
assert.ok((await existing.json()).maintainers?.some(m => m.name === policy.npmOwner));
assert.ok(process.env.NPM_RELEASE_CLI);
assert.equal(execFileSync(process.execPath, [process.env.NPM_RELEASE_CLI, '--version'], { encoding: 'utf8' }).trim(), policy.npmVersion);
// Re-read the accepted bytes immediately before submission; no pack/build command exists here.
const artifact = inspectArtifact(options);
const result = stageReceipt(execFileSync(process.execPath, [process.env.NPM_RELEASE_CLI, ...stageArguments(plan, policy, artifact.tarball)], { encoding: 'utf8', timeout: 120000 }), plan);
writeFileSync('stage-receipt.json', JSON.stringify({ ...plan, stage: 'submitted; awaiting npm maintainer 2FA', stageId: result.stageId }, null, 2) + '\n');
