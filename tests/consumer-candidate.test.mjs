import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { releaseFixture } from './release-fixture.mjs';
import { consumerStack, consumerStacks } from '../scripts/consumer-launcher.mjs';
import { verifyConsumerCandidate } from '../scripts/release/verify-consumer.mjs';
import { inspectArtifact, inspectPreparedArtifact, createPlan } from '../scripts/release/gate.mjs';

function fixture() {
  const f = releaseFixture();
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ts-76/void-plugin-hono-jsx', GITHUB_REF: 'refs/heads/codex/test', GITHUB_SHA: 'abc', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', RELEASE_CONSUMER_STACK: 'void-1-vp' };
  env.GITHUB_WORKFLOW_REF = env.GITHUB_REPOSITORY + '/.github/workflows/package.yml@' + env.GITHUB_REF;
  Object.assign(f.evidence, { consumerStack: consumerStack({ RELEASE_CONSUMER_STACK: 'baseline' }), workflow: env.GITHUB_WORKFLOW_REF, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT });
  writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify(f.evidence));
  return { ...f, env, verify(runConsumer, overrides = {}) { return verifyConsumerCandidate({ ...f.options, env: { ...env, ...overrides }, runConsumer }); } };
}
const report = JSON.stringify({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { esbuild: { via: [{ url: 'https://github.com/advisories/GHSA-67mh-4wv8-2f99' }] } } });

test('each consumer validates the same baseline bytes but must write its own audit evidence', () => {
  const f = fixture();
  try {
    const bytes = readFileSync(f.tarball); let calls = 0;
    const verified = f.verify(({ tarball, env }) => {
      calls++; assert.equal(realpathSync(tarball), realpathSync(f.tarball)); assert.equal(existsSync(env.RELEASE_CONSUMER_AUDIT), false);
      writeFileSync(env.RELEASE_CONSUMER_AUDIT, report);
    });
    assert.equal(calls, 1); assert.equal(verified.consumerStack.name, 'void-1-vp');
    assert.equal(verified.sha256, f.evidence.sha256); assert.equal(verified.historyReportSha256, f.evidence.historyReportSha256);
    assert.notEqual(verified.consumerDependencyReportSha256, f.evidence.consumerDependencyReportSha256);
    assert.deepEqual(readFileSync(f.tarball), bytes); inspectArtifact(f.options);
  } finally { f.cleanup(); }
});

test('another run, attempt, workflow or source fails before consumer execution', () => {
  const f = fixture(); let calls = 0;
  try {
    const original = readFileSync(path.join(f.artifactRoot, 'evidence.json'), 'utf8');
    for (const overrides of [{ GITHUB_RUN_ID: '456' }, { GITHUB_RUN_ATTEMPT: '3' }, { GITHUB_REF: 'refs/heads/other' }, { GITHUB_WORKFLOW_REF: 'other/workflow' }, { GITHUB_SHA: 'other' }, { GITHUB_RUN_ID: '' }, { RELEASE_CONSUMER_STACK: 'baseline' }]) {
      assert.throws(() => f.verify(() => { calls++; }, overrides));
    }
    assert.equal(calls, 0); assert.equal(readFileSync(path.join(f.artifactRoot, 'evidence.json'), 'utf8'), original);
  } finally { f.cleanup(); }
});

test('candidate mutation, a missing fresh audit or a failed consumer never yields accepted evidence', () => {
  for (const failure of ['bytes', 'missing-audit', 'consumer']) {
    const f = fixture();
    try {
      assert.throws(() => f.verify(({ env }) => {
        if (failure === 'consumer') throw new Error('consumer failed');
        if (failure === 'missing-audit') return;
        writeFileSync(f.tarball, Buffer.concat([readFileSync(f.tarball), Buffer.from('changed')]));
        writeFileSync(env.RELEASE_CONSUMER_AUDIT, report);
      }));
      assert.throws(() => inspectArtifact(f.options));
    } finally { f.cleanup(); }
  }
});

test('workflow prepares once, verifies both stacks in parallel and preserves fresh stage acceptance', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/package.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main', 'release/**']);
  const jobs = workflow.jobs;
  assert.ok(jobs.prepare.steps.some(step => step.run === 'npm run release:prepare -- --defer-consumer'));
  assert.equal(jobs.consumer.needs, 'prepare');
  assert.deepEqual(jobs.consumer.strategy.matrix.stack.sort(), Object.keys(consumerStacks).sort());
  assert.equal(jobs.consumer.strategy['fail-fast'], false);
  const download = jobs.consumer.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
  const upload = jobs.prepare.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(download.with.name, upload.with.name); assert.match(download.with.name, /github\.run_attempt/);
  assert.equal(jobs['required-baseline'].name, 'Pinned framework baseline on Node 24.22.1');
  assert.deepEqual(jobs['required-baseline'].needs, ['changes', 'prepare', 'consumer']);
  const stage = parse(readFileSync(new URL('../.github/workflows/npm-stage.yml', import.meta.url), 'utf8'));
  assert.ok(stage.jobs.prepare.steps.some(step => step.run === 'npm run release:prepare'));
  assert.ok(!stage.jobs.prepare.steps.some(step => /defer-consumer/.test(step.run || '')));
});

function pendingFixture() {
  const f = fixture();
  f.evidence.validation.externalConsumer = false;
  f.evidence.consumerStack = null;
  f.evidence.consumerDependencyReportSha256 = null;
  rmSync(path.join(f.artifactRoot, 'consumer-dependency-audit.json'));
  writeFileSync(path.join(f.artifactRoot, 'evidence.json'), JSON.stringify(f.evidence));
  return f;
}

test('pending source evidence cannot pass release inspection or planning, even with a caller flag', () => {
  const f = pendingFixture();
  try {
    inspectPreparedArtifact(f.options);
    assert.throws(() => inspectArtifact({ ...f.options, allowPending: true }));
    assert.throws(() => createPlan({ ...f.options, allowPending: true }));
  } finally { f.cleanup(); }
});

test('both parallel stacks accept the same pending bytes only after their own full consumer', () => {
  for (const stack of Object.keys(consumerStacks)) {
    const f = pendingFixture();
    try {
      const verified = f.verify(({ env }) => writeFileSync(env.RELEASE_CONSUMER_AUDIT, report), { RELEASE_CONSUMER_STACK: stack });
      assert.equal(verified.sha256, f.evidence.sha256);
      assert.equal(verified.validation.externalConsumer, true);
      assert.equal(verified.consumerStack.name, stack);
      inspectArtifact(f.options);
    } finally { f.cleanup(); }
  }
});

test('a failed parallel consumer leaves pending evidence unaccepted', () => {
  for (const failure of ['consumer', 'missing-audit', 'bytes']) {
    const f = pendingFixture();
    try {
      assert.throws(() => f.verify(({ env }) => {
        if (failure === 'consumer') throw new Error('consumer failed');
        if (failure === 'missing-audit') return;
        writeFileSync(env.RELEASE_CONSUMER_AUDIT, report);
        writeFileSync(f.tarball, 'changed');
      }, { RELEASE_CONSUMER_STACK: 'baseline' }));
      assert.throws(() => inspectArtifact(f.options));
    } finally { f.cleanup(); }
  }
});

test('release preparation cannot select historical unsupported frameworks', () => {
  for (const name of ['vite-patch', 'latest-vite', 'scaffold-vp', 'latest-vp', 'void-1-vite']) assert.throws(() => consumerStack({ RELEASE_CONSUMER_STACK: name }), /Unknown consumer stack/);
  assert.equal(consumerStack({}).void, '1.2.1');
  assert.equal(consumerStack({}).fixture, 'consumer-void-1-vite');
});
