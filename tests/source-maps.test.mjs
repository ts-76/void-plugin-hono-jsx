import test from 'node:test';
import assert from 'node:assert/strict';
import MagicString from 'magic-string';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { rewritePagesImport } from '../scripts/rewrite-package-import.mjs';
import { inspectSourceMaps } from '../scripts/release/source-maps.mjs';

const source = "import { x } from './pages.js'; export const value = 1;";
const original = new MagicString(source).generateMap({ file: 'form.js', source: '../src/runtime/form.ts', hires: true, includeContent: true });
const valid = () => new Map([
  ['src/runtime/form.ts', source],
  ['dist/form.js', source + '\n//# sourceMappingURL=form.js.map'],
  ['dist/form.js.map', original.toString()],
  ['dist/form.d.ts', 'export declare const value: 1;\n//# sourceMappingURL=form.d.ts.map'],
  ['dist/form.d.ts.map', JSON.stringify({ version: 3, file: 'form.d.ts', sources: ['../src/runtime/form.ts'], names: [], mappings: 'AAAA' })],
]);

test('rewritten provider import preserves original columns for following code', () => {
  const { code, map } = rewritePagesImport(source, JSON.parse(original.toString()), 'void-plugin-hono-jsx');
  assert.match(code, /"void-plugin-hono-jsx\/pages"/);
  const traced = originalPositionFor(new TraceMap(map), { line: 1, column: code.indexOf('export const') });
  assert.equal(traced.source, '../src/runtime/form.ts');
  assert.equal(traced.line, 1);
  assert.equal(traced.column, source.indexOf('export const'));
  assert.deepEqual(map.sourcesContent, [source]);
});

test('package debug artifacts require both maps and local original source', () => {
  inspectSourceMaps(valid());
  for (const file of ['src/runtime/form.ts', 'dist/form.js.map', 'dist/form.d.ts.map']) {
    const contents = valid(); contents.delete(file);
    assert.throws(() => inspectSourceMaps(contents));
  }
});

for (const [name, patch] of [
  ['external source', { sources: ['https://example.com/form.ts'] }],
  ['source outside package', { sources: ['../../private/form.ts'] }],
  ['stale embedded source', { sourcesContent: ['different source'] }],
  ['original position past source', { mappings: 'AAEA' }],
  ['output name mismatch', { file: 'other.js' }],
  ['malformed VLQ', { mappings: 'AAA!' }],
  ['unterminated VLQ', { mappings: 'g' }],
  ['missing source index', { mappings: 'ACAA' }],
]) test(`debug artifact checks reject ${name}`, () => {
  const contents = valid();
  contents.set('dist/form.js.map', JSON.stringify({ ...JSON.parse(original.toString()), ...patch }));
  assert.throws(() => inspectSourceMaps(contents));
});
