import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileStaticMarkdown, readStaticMarkdown, compileMarkdownModule, readMarkdownModule } from '../packages/hono-pages/src/plugins/static-markdown.ts';

test('standalone Markdown emits static components, context, metadata and shared copy client code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'static-md-'));
  try {
    await writeFile(join(root, 'Callout.tsx'), 'export default function Callout() {}');
    const source = '<script>import Callout from "./Callout.tsx" with { component: "static" };</script>\n---\ntitle: Standalone\n---\n# Hello\n\n:::component Callout title="Advice"\n**Strong** body.\n:::\n\n```ts\nconst value = 1;\n```';
    const parsed = readStaticMarkdown(source);
    assert.equal(parsed.frontmatter.title, 'Standalone');
    assert.match(parsed.content, /^# Hello/);
    const result = await compileStaticMarkdown(source, { sourcePath: join(root, 'deck.md') });
    assert.match(result.code, /MarkdownContext.Provider/);
    assert.match(result.code, /from "void-plugin-hono-jsx\/markdown"/);
    assert.doesNotMatch(result.code, /from ["']@ts-76\/hono-markdown/);
    assert.match(result.code, /jsx\(__component0/);
    assert.match(result.code, /<strong>Strong/);
    assert.match(result.code, /class: 'void-md'/);
    assert.match(result.code, /shiki/);
    assert.match(result.clientCode, /clipboard/);
    assert.deepEqual(result.headings, [{ depth: 1, slug: 'hello', text: 'Hello' }]);
    assert.equal((await compileStaticMarkdown('# Static', { sourcePath: join(root, 'static.md') })).clientCode, '');
    await assert.rejects(compileStaticMarkdown('<script>import Missing from "./Missing.tsx" with { component: "static" };</script>\n<Missing />', { sourcePath: join(root, 'deck.md') }), /cannot resolve/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const source of [
  '<script>import Counter from "./Counter.tsx" with { island: "load" };</script>\n<Counter />',
  '<script>window.custom = true;</script>\n# Title',
]) test('standalone Markdown rejects page-only interactivity', async () => {
  assert.throws(() => readStaticMarkdown(source), /static components only/);
  await assert.rejects(compileStaticMarkdown(source, { sourcePath: '/deck.md' }), /static components only/);
});


test('module compiler emits islands separately and keeps the static API strict', async () => {
  const root = await mkdtemp(join(tmpdir(), 'island-md-'));
  try {
    await writeFile(join(root, 'Counter.tsx'), 'export default function Counter() {}');
    for (const policy of ['load', 'visible', 'idle', 'media:(min-width: 600px)']) {
      const source = `<script>import Counter from "./Counter.tsx" with { island: "${policy}" };</script>\n---\ntitle: Island context\n---\n# Interactive\n\n<Counter label="hello" />`;
      assert.match(readMarkdownModule(source).content, /Interactive/);
      const result = await compileMarkdownModule(source, { sourcePath: join(root, 'deck.md') });
      assert.equal(result.islands.length, 1);
      assert.match(result.code, /from "void-plugin-hono-jsx\/markdown"/);
      assert.doesNotMatch(result.code, /from ["']@ts-76\/hono-markdown/);
      assert.equal(result.islands[0].hydrate, policy);
      assert.equal(result.islands[0].modulePath, join(root, 'Counter.tsx'));
      assert.match(result.code, /data-hono-md-context/);
      assert.match(result.code, /children: jsx/);
      assert.throws(() => readStaticMarkdown(source), /static components only/);
    }
    await assert.rejects(compileMarkdownModule('<script>window.bad = true;</script>\n# bad', { sourcePath: join(root, 'deck.md') }), /component imports only/);
    await assert.rejects(compileMarkdownModule('<script>import Counter from "./Counter.tsx" with { island: "unknown" };</script>\n<Counter />', { sourcePath: join(root, 'deck.md') }), /invalid island/);
    assert.deepEqual((await compileMarkdownModule('# Static', { sourcePath: join(root, 'deck.md') })).islands, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
