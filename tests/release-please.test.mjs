import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchReleaseChecks } from '../scripts/release/check-release-prs.mjs';

const repository = 'ts-76/void-plugin-hono-jsx';
const defaultBranch = 'main';
const valid = () => ({ state: 'open', user: { login: 'github-actions[bot]' }, base: { ref: 'main', repo: { full_name: repository } }, head: { ref: 'release-please--branches--main', sha: 'a'.repeat(40), repo: { full_name: repository } }, labels: [{ name: 'autorelease: pending' }] });

test('bot release PR dispatches both required checks against its branch, never npm staging', async () => {
  const calls = [];
  const result = await dispatchReleaseChecks([{ number: 42 }], { repository, defaultBranch, api: async (...args) => { calls.push(args); return args[0] === 'GET' ? valid() : null; } });
  assert.deepEqual(result, { number: 42, ref: 'release-please--branches--main', sha: 'a'.repeat(40) });
  assert.deepEqual(calls, [
    ['GET', `repos/${repository}/pulls/42`],
    ['POST', `repos/${repository}/actions/workflows/package.yml/dispatches`, { ref: result.ref }],
    ['POST', `repos/${repository}/actions/workflows/publisher.yml/dispatches`, { ref: result.ref }],
  ]);
});

test('foreign, untrusted, closed or malformed release PRs fail before dispatch', async () => {
  for (const change of [
    pr => { pr.head.repo.full_name = 'other/fork'; },
    pr => { pr.base.repo.full_name = 'other/repo'; },
    pr => { pr.base.ref = 'other'; },
    pr => { pr.user.login = 'other'; },
    pr => { pr.state = 'closed'; },
    pr => { pr.head.ref = 'codex/unrelated'; },
    pr => { pr.labels = []; },
    pr => { pr.head.sha = 'bad'; },
  ]) {
    const pr = valid(); change(pr); let writes = 0;
    await assert.rejects(dispatchReleaseChecks([{ number: 42 }], { repository, defaultBranch, api: async method => { if (method === 'POST') writes++; return pr; } }));
    assert.equal(writes, 0);
  }
  for (const prs of [[], [{ number: 1 }, { number: 2 }], [{ number: -1 }], [{ number: '42' }], null]) {
    let calls = 0;
    await assert.rejects(dispatchReleaseChecks(prs, { repository, defaultBranch, api: async () => { calls++; } }));
    assert.equal(calls, 0);
  }
});

test('a failed check dispatch fails the workflow instead of claiming CI was started', async () => {
  await assert.rejects(dispatchReleaseChecks([{ number: 42 }], { repository, defaultBranch, api: async method => { if (method === 'POST') throw new Error('dispatch denied'); return valid(); } }), /dispatch denied/);
});
