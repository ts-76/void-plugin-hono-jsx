import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';
import { needsFullConsumers } from '../scripts/ci-scope.mjs';

test('only documentation prose PRs skip consumers; all release paths fail closed', () => {
  assert.equal(needsFullConsumers(['docs/pages.md', 'docs/markdown.md'], 'pull_request'), false);
  for (const files of [[], ['README.md'], ['CHANGELOG.md'], ['docs/dependency-security.md'], ['docs/releasing.md'], ['docs/release-please.md'], ['packages/hono-markdown/README.md'], ['fixtures/markdown/pages/index.md'], ['docs/example.ts'], ['scripts/ci-scope.mjs'], ['.github/workflows/package.yml'], ['docs/pages.md', 'src/index.ts']]) {
    assert.equal(needsFullConsumers(files, 'pull_request'), true, JSON.stringify(files));
  }
  for (const event of ['push', 'workflow_dispatch', undefined]) assert.equal(needsFullConsumers(['docs/pages.md'], event), true);
});

test('publisher avoids duplicate feature pushes while preserving required PR and main checks', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/publisher.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.ok(workflow.jobs.rust);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.match(workflow.concurrency.group, /head\.repo\.full_name/);
});

test('the required aggregate rejects failed, cancelled and missing checks', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/package.yml', import.meta.url), 'utf8'));
  const script = workflow.jobs['required-baseline'].steps[0].run;
  const run = overrides => spawnSync('bash', ['-e', '-c', script], { env: { ...process.env, SCOPE_RESULT: 'success', FULL: 'true', PREPARE_RESULT: 'success', CONSUMER_RESULT: 'success', ...overrides } }).status;
  assert.equal(run({}), 0);
  assert.equal(run({ FULL: 'false', PREPARE_RESULT: 'skipped', CONSUMER_RESULT: 'skipped' }), 0);
  for (const overrides of [{ SCOPE_RESULT: 'failure' }, { SCOPE_RESULT: 'cancelled' }, { FULL: '' }, { PREPARE_RESULT: 'skipped' }, { PREPARE_RESULT: 'failure' }, { CONSUMER_RESULT: 'failure' }, { CONSUMER_RESULT: 'cancelled' }, { CONSUMER_RESULT: 'skipped' }, { FULL: 'false' }]) {
    assert.notEqual(run(overrides), 0, JSON.stringify(overrides));
  }
});
