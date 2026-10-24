import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publisherInventory } from '../scripts/release/publisher-inventory.mjs';
import { measurePublisherCoverage } from '../scripts/release/publisher.mjs';
import { pathToFileURL } from 'node:url';

test('publisher inventory includes bundled versions, scoped names and vendored manifests', () => {
  const files = new Map([
    ['dist/pnpm.mjs', 'links/@/braces/3.0.3/' + 'a'.repeat(64) + '/node_modules/braces/index.js\n' +
      'links/@/@sigstore/sign/4.0.2/' + 'b'.repeat(64) + '/node_modules/@sigstore/sign/index.js'],
    ['dist/node_modules/example/package.json', '{"name":"example","version":"1.2.3"}'],
  ]);
  assert.deepEqual(publisherInventory(files), [
    { name: '@sigstore/sign', version: '4.0.2' }, { name: 'braces', version: '3.0.3' }, { name: 'example', version: '1.2.3' },
  ]);
  assert.throws(() => publisherInventory(new Map()), /inventory is empty/);
});

test('coverage requires the verified npm entry and stage command to execute', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'publisher-coverage-'));
  const cli = path.join(directory, 'runtime/bin/npm-cli.js');
  const entry = file => ({ url: pathToFileURL(path.join(directory, 'runtime', file)).href, functions: [{ functionName: '', ranges: [{ startOffset: 0, endOffset: 10, count: 1 }] }] });
  const write = data => writeFileSync(path.join(directory, 'coverage.json'), JSON.stringify(data));
  try {
    assert.throws(() => measurePublisherCoverage(cli, directory), /Missing publisher execution/);
    write({ result: [entry('bin/npm-cli.js')] });
    assert.throws(() => measurePublisherCoverage(cli, directory), /stage\/publish/);
    const stage = entry('lib/commands/stage/publish.js');
    write({ result: [entry('bin/npm-cli.js'), stage] });
    assert.equal(measurePublisherCoverage(cli, directory).stageCommandExecuted, true);
    stage.functions[0].ranges[0].count = 0;
    write({ result: [entry('bin/npm-cli.js'), stage] });
    assert.throws(() => measurePublisherCoverage(cli, directory), /Missing publisher execution/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
