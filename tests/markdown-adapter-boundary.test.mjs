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

test('Void Markdown client does not infer host state and honors an explicit readiness gate', async () => {
  const { hydrateMarkdownIslands } = await import('../packages/hono-pages/src/runtime/markdown-islands.ts');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const element = {
    dataset: { honoMdIsland: 'counter', honoMdHydrate: 'visible' },
    closest() { assert.fail('Void must not inspect a host-owned DOM ancestor'); },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelectorAll: () => [element] } });
  try {
    const scheduled = [];
    const module = {};
    const loader = async () => module;
    const options = { schedule: (...args) => scheduled.push(args) };
    hydrateMarkdownIslands({ counter: loader }, options);
    assert.equal(scheduled.length, 1, 'without a host gate, schedule immediately');
    assert.equal(scheduled[0][0], element);
    // The common runtime wraps the loader so host schedulers cannot leak load failures.
    assert.equal(await scheduled[0][1](), module);
    assert.equal(scheduled[0][3], 'visible');

    delete element.dataset.honoMdScheduled;
    let activate;
    hydrateMarkdownIslands({ counter: loader }, {
      ...options,
      ready(target, start) { assert.equal(target, element); activate = start; },
    });
    assert.equal(scheduled.length, 1, 'an explicit host gate may defer scheduling');
    activate();
    assert.equal(scheduled.length, 2);
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  }
});
