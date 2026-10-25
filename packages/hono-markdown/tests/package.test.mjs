import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('only CSS exports are side effects, so unused JavaScript entries are tree-shaken', async () => {
  assert.deepEqual(manifest.sideEffects, ['*.css']);
  const result = await build({
    stdin: { contents: "import '@ts-76/hono-markdown/theme.css';\nimport { renderMarkdown } from '@ts-76/hono-markdown/render';\nimport { hydrateMarkdownIslands } from '@ts-76/hono-markdown/client';\nexport const kept = 1;", resolveDir: import.meta.dirname, sourcefile: 'entry.mjs' },
    bundle: true, format: 'esm', platform: 'browser', write: false, outdir: 'out', metafile: true, logLevel: 'silent',
    external: ['hono', 'hono/*', 'markdown-exit', 'markdown-it-container'],
  });
  const css = result.outputFiles.find(file => file.path.endsWith('.css'));
  const js = result.outputFiles.find(file => file.path.endsWith('.js'));
  assert.ok(css && css.text.includes('.void-md'), 'imported theme CSS is kept');
  assert.doesNotMatch(js.text, /markdown-exit|hono\/jsx/, 'unused JavaScript imports are dropped');
});

test('every subpath export exposes types and a default condition', () => {
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (typeof target === 'string') { assert.match(subpath, /\.css$/); continue; }
    assert.ok(target.types && target.default, subpath);
  }
});

test('article API has one portable export, without environment-specific aliases', async () => {
  assert.deepEqual(manifest.exports['./render'], { types: './dist/render/index.d.ts', default: './dist/render/index.js' });
  assert.equal(manifest.exports['./render/worker'], undefined);
  await assert.rejects(import('@ts-76/hono-markdown/render/worker'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

test("Markdown parsers are internal dependencies, not optional consumer peers", async () => {
  for (const name of ["markdown-exit", "markdown-it-container"]) {
    assert.ok(manifest.dependencies[name]);
    assert.equal(manifest.peerDependencies[name], undefined);
    assert.equal(manifest.peerDependenciesMeta[name], undefined);
  }
});
