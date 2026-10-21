import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publisherInventory } from '../scripts/release/publisher-inventory.mjs';
import { bracesCoverage, assertNoBracesCalls } from '../scripts/release/publisher-coverage.mjs';

test('publisher inventory includes bundled versions, scoped names and vendored manifests', () => {
  const files = new Map([
    ['dist/pnpm.mjs', 'links/@/braces/3.0.3/' + 'a'.repeat(64) + '/node_modules/braces/index.js\n' +
      'links/@/@sigstore/sign/4.0.2/' + 'b'.repeat(64) + '/node_modules/@sigstore/sign/index.js'],
    ['dist/node_modules/example/package.json', '{"name":"example","version":"1.2.3"}'],
  ]);
  assert.deepEqual(publisherInventory(files), [
    { name: '@sigstore/sign', version: '4.0.2' }, { name: 'braces', version: '3.0.3' }, { name: 'example', version: '1.2.3' },
  ]);
  assert.throws(() => publisherInventory(new Map()), /Expected bundled braces/);
});

test('coverage rejects missing data and actual brace calls while allowing module initialization', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'publisher-coverage-'));
  const source = '// fixture/node_modules/braces/lib/parse.js\nfunction parse() {}\n// another/module.js\n';
  const url = 'file:///fixture/pnpm.mjs';
  const functions = [
    { functionName: 'fixture/node_modules/braces/lib/parse.js', ranges: [{ startOffset: 1, endOffset: 60, count: 1 }] },
    { functionName: 'parse', ranges: [{ startOffset: 45, endOffset: 59, count: 0 }] },
  ];
  const write = data => writeFileSync(path.join(directory, 'coverage.json'), JSON.stringify(data));
  try {
    assert.throws(() => bracesCoverage(source, url, directory), /Missing CLI/);
    write({ result: [{ url, functions }] });
    assertNoBracesCalls(bracesCoverage(source, url, directory));
    functions[1].ranges[0].count = 1;
    write({ result: [{ url, functions }] });
    assert.throws(() => assertNoBracesCalls(bracesCoverage(source, url, directory)), /braces executed/);
    write({ result: [{ url, functions: [] }] });
    assert.throws(() => bracesCoverage(source, url, directory), /Incomplete coverage/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
