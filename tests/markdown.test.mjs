import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsx } from 'hono/jsx/jsx-runtime';
import { compileMarkdown, extractMarkdown, renderChunks } from '../packages/hono-pages/src/plugins/markdown-compiler.ts';
import { voidHonoMarkdown } from '../packages/hono-pages/src/plugins/hono-markdown.ts';
import { voidHonoPages } from '../packages/hono-pages/src/plugins/hono-pages.ts';
import { MarkdownContext, useFrontmatter, useMarkdownProps } from '../packages/hono-pages/src/runtime/markdown.ts';

test('Markdown compilation separates islands/client code and parses frontmatter, tables and unique heading anchors', () => {
  const result = compileMarkdown('<script>\nimport Counter from "./Counter" with { island: "visible" };\nwindow.client = true;\n</script>\n---\ntitle: Example\n---\n# Repeated **heading**\n\n# Repeated heading\n\n| A | B |\n| - | - |\n| one | two |\n');
  assert.equal(result.frontmatter.title, 'Example');
  assert.deepEqual(result.headings.map(h => h.slug), ['repeated-heading', 'repeated-heading-1']);
  assert.match(result.html, /<table>/);
  assert.equal(compileMarkdown('# Target\n\n<div id="target">Authored</div>').headings[0].slug, 'target-1');
  assert.equal(result.imports.length, 1);
  assert.match(result.graphSource, /island: "visible"/);
  assert.doesNotMatch(result.clientCode, /Counter|island/);
  assert.match(result.clientCode, /window.client/);
});

test('frontmatter and fenced code are data while literal island props preserve names without prototype mutation', () => {
  const result = compileMarkdown('---\ntitle: "</script><script>injected</script>"\n---\n```html\n<script>injected</script>\n```');
  assert.match(result.html, /&lt;script&gt;/);
  const chunks = renderChunks('<section><Counter initial="4" disabled label="One &amp; Two" __proto__="literal" /></section>', new Set(['Counter']));
  assert.equal(chunks[1].props.initial, '4');
  assert.equal(chunks[1].props.disabled, true);
  assert.equal(chunks[1].props.label, 'One & Two');
  assert.equal(chunks[1].props.__proto__, 'literal');
  assert.equal(Object.getPrototypeOf(chunks[1].props), null);
  assert.equal(chunks[0].html + chunks[2].html, '<section></section>');
  assert.throws(() => renderChunks('<Counter>lost content</Counter>', new Set(['Counter'])), /children are unsupported/);
});

for (const source of ['---\ntitle: One\ntitle: Two\n---', '---\n- sequence\n---', '---\nfoo: [bad\n---', '---\na: &cycle [*cycle]\n---']) {
  test('invalid or non-serializable frontmatter fails compilation: ' + source, () => assert.throws(() => compileMarkdown(source), /frontmatter/));
}

test('frontmatter is scoped to the whole SSR layout render and does not persist across requests', async () => {
  function Layout() { return jsx('p', { children: String(useFrontmatter().title) + ':' + String(useMarkdownProps().message) }); }
  const render = title => jsx(MarkdownContext.Provider, { value: { frontmatter: { title }, headings: [], props: { message: title } }, children: jsx(Layout, {}) }).toString();
  assert.deepEqual(await Promise.all([render('One'), render('Two')]), ['<p>One:One</p>', '<p>Two:Two</p>']);
  assert.equal(await jsx(Layout, {}).toString(), '<p>undefined:undefined</p>');
});

test('configured optional Markdown participates in server manifests and island graphs without entering the SPA manifest', async () => {
  const previous = process.cwd(); const root = await mkdtemp(join(tmpdir(), 'hono-markdown-'));
  try {
    await mkdir(join(root, 'pages')); await writeFile(join(root, 'Counter.tsx'), 'export default function Counter() { return <p>Counter</p>; }');
    await writeFile(join(root, 'pages/index.md'), '<script>\nimport Counter from "../Counter" with { island: "load" };\nwindow.script = true;\n</script>\n# Heading\n\n<Counter initial="4" />');
    await writeFile(join(root, 'pages/other.tsx'), 'export default function Page() { return <p>Other</p>; }');
    process.chdir(root);
    const md = voidHonoMarkdown(); const plugins = [...voidHonoPages(), md];
    md.configResolved({ root, plugins });
    const pages = plugins.find(p => p.name === 'void-hono:pages'); const islands = plugins.find(p => p.name === 'void-hono:islands');
    pages.configResolved.handler({ plugins }); islands.configResolved({ plugins });
    pages.environment = { mode: 'build' };
    await pages.buildStart(); await islands.buildStart();
    const server = await pages.load(pages.resolveId('virtual:void-pages-renderer'));
    assert.match(server, /index\.md/); assert.match(server, /MarkdownContext.Provider/); assert.match(server, /new Set\(\["index"\]\)/);
    const client = await pages.load(pages.resolveId('virtual:void-pages-client'));
    assert.doesNotMatch(client, /index\.md/); assert.match(client, /other\.tsx/);
    assert.match(islands.load(islands.resolveId('virtual:void-islands-client')), /Counter\.tsx/);
    const transformed = md.transform.handler(await (await import('node:fs/promises')).readFile(join(root, 'pages/index.md'), 'utf8'), join(root, 'pages/index.md'));
    assert.match(transformed.code, /data-island/); assert.match(transformed.code, /JSON.parse/); assert.doesNotMatch(transformed.code, /window.script/);
    assert.match(md.load(md.resolveId('virtual:void-hono-markdown-client')), /hono-markdown-script/);
    assert.equal(extractMarkdown('# Static').clientCode, '');
  } finally { process.chdir(previous); await rm(root, { recursive: true, force: true }); }
});

test('malformed Markdown island imports fail before becoming browser-only script imports', () => {
  assert.throws(() => extractMarkdown('<script>import { Counter } from "./Counter" with { island: "load" };</script>'), /one default component import/);
});

test('Markdown symlink imports use the same canonical island key as the client registry', { skip: process.platform === 'win32' }, async () => {
  const previous = process.cwd(); const root = await mkdtemp(join(tmpdir(), 'hono-markdown-link-'));
  try {
    await mkdir(join(root, 'pages')); await mkdir(join(root, 'shared'));
    await writeFile(join(root, 'shared/Counter.tsx'), 'export default function Counter() { return <button>Count</button>; }');
    await symlink(join(root, 'shared/Counter.tsx'), join(root, 'LinkedCounter.tsx'));
    const source = '<script>import Counter from "../LinkedCounter" with { island: "load" };</script>\n# Linked\n\n<Counter />';
    await writeFile(join(root, 'pages/index.md'), source); process.chdir(root);
    const md = voidHonoMarkdown(); const plugins = [...voidHonoPages(), md]; md.configResolved({ root, plugins });
    const islands = plugins.find(plugin => plugin.name === 'void-hono:islands'); islands.configResolved({ plugins }); await islands.buildStart();
    const server = md.transform.handler(source, join(root, 'pages/index.md')).code;
    const client = islands.load(islands.resolveId('virtual:void-islands-client'));
    assert.match(server, /'data-island': "shared\/Counter\.tsx"/);
    assert.match(client, /"shared\/Counter\.tsx":/);
    assert.doesNotMatch(server, /'data-island': "LinkedCounter/);
  } finally { process.chdir(previous); await rm(root, { recursive: true, force: true }); }
});
