import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MarkdownContext, useFrontmatter } from '@ts-76/hono-markdown';
import { MarkdownContext as legacyContext, useFrontmatter as legacyHook } from '../packages/hono-pages/src/runtime/markdown.ts';
import { extractMarkdown } from '@ts-76/hono-markdown/parser';
import { extractMarkdown as legacyExtract } from '../packages/hono-pages/src/plugins/markdown-compiler.ts';

test('old and neutral Markdown imports share the exact provider, hooks and parser', () => {
  assert.equal(MarkdownContext, legacyContext);
  assert.equal(useFrontmatter, legacyHook);
  assert.equal(extractMarkdown, legacyExtract);
  const source = '<script>import Counter from "./Counter" with { island: "visible" }; import Box from "./Box" with { component: "static" }; window.ready = true;</script>\n# Title';
  const parsed = extractMarkdown(source);
  assert.equal(parsed.imports[0].hydrate, 'visible');
  assert.equal(parsed.staticImports[0].importName, 'Box');
  assert.match(parsed.clientCode, /window.ready/);
  assert.doesNotMatch(parsed.clientCode, /import /);
});
test('neutral package and scheduler have no Void, Vite or deck conventions', async () => {
  const pkg=JSON.parse(await readFile(new URL('../packages/hono-markdown/package.json',import.meta.url),'utf8'));
  for (const dep of ['void','vite','hono-decks','honoxpress']) {
    assert.equal(pkg.dependencies?.[dep],undefined);assert.equal(pkg.peerDependencies?.[dep],undefined);
  }
  const resolver=await readFile(new URL('../packages/hono-markdown/src/compiler/resolve-component.ts',import.meta.url),'utf8');
  assert.doesNotMatch(resolver, /from ['"](?:void|vite)/);
  const source=await readFile(new URL('../packages/hono-markdown/src/runtime/client.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/void\/|data-slide-state|section\[/);
});
