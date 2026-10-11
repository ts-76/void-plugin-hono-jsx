import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { json } from './gate.mjs';

// Explicit dispatch works with GITHUB_TOKEN without a long-lived PAT. Validate
// every PR before making any write request; never dispatch npm-stage here.
export async function dispatchReleaseChecks(prs, { repository, defaultBranch, api }) {
  assert.ok(Array.isArray(prs) && prs.length === 1, 'Expected the single configured release PR');
  const number = prs[0]?.number;
  assert.ok(Number.isSafeInteger(number) && number > 0, 'Invalid release PR number');
  const pr = await api('GET', `repos/${repository}/pulls/${number}`);
  assert.equal(pr.state, 'open', 'Release PR is not open');
  assert.equal(pr.user?.login, 'github-actions[bot]', 'Unexpected release PR author');
  assert.equal(pr.base?.repo?.full_name, repository, 'Unexpected base repository');
  assert.equal(pr.base?.ref, defaultBranch, 'Unexpected base branch');
  assert.equal(pr.head?.repo?.full_name, repository, 'Fork release PR is not allowed');
  assert.equal(pr.head?.ref, `release-please--branches--${defaultBranch}`, 'Unexpected release branch');
  assert.ok(pr.labels?.some(label => label.name === 'autorelease: pending'), 'Release label missing');
  assert.match(pr.head?.sha ?? '', /^[0-9a-f]{40}$/, 'Release PR head SHA missing');
  for (const workflow of ['package.yml', 'publisher.yml']) {
    await api('POST', `repos/${repository}/actions/workflows/${workflow}/dispatches`, { ref: pr.head.ref });
  }
  return { number, ref: pr.head.ref, sha: pr.head.sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const policy = json('release-policy.json');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.repository);
  assert.equal(process.env.GITHUB_REF, `refs/heads/${policy.defaultBranch}`);
  const result = await dispatchReleaseChecks(JSON.parse(process.env.RELEASE_PLEASE_PRS || '[]'), {
    repository: policy.repository,
    defaultBranch: policy.defaultBranch,
    api(method, endpoint, body) {
      const args = ['api', '--method', method, endpoint];
      if (body) args.push('--input', '-');
      const output = execFileSync('gh', args, { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
      return output.trim() ? JSON.parse(output) : null;
    },
  });
  console.log(`Dispatched required validation for release PR #${result.number} at ${result.sha}. No npm stage or approval performed.`);
}
