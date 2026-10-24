import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileMarkdown, extractMarkdown, renderChunks } from '../packages/hono-pages/src/plugins/markdown-compiler.ts';
import { voidHonoMarkdown } from '../packages/hono-pages/src/plugins/hono-markdown.ts';
import { honoIslands } from '../packages/hono-pages/src/plugins/hono-islands.ts';

const declarations = '<script>import Note from "../Note" with { component: "static" }; import Card from "../Card" with { component: "static" };</script>\n';
test('static imports belong to the server graph, not the page script or island registry', () => {
  const result = extractMarkdown(declarations);
  assert.equal(result.staticImports.length, 2);
  assert.equal(result.clientCode, '');
  assert.equal(result.imports.length, 0);
  assert.match(result.graphSource, /import Note from/);
  assert.doesNotMatch(result.graphSource, /component:|island:/);
  assert.match(extractMarkdown(declarations.replace('</script>', 'window.client = true;</script>')).clientCode, /window.client/);
});

test('nested component containers share Markdown headings, references and escaped text', async () => {
  const result = await compileMarkdown(declarations + '::::component Note title="日本語 &amp; English"\n## Nested **heading**\n\n:::component Card disabled\nA [reference][ref] and `literal <Card />`.\n:::\n::::\n\n[ref]: /target\n');
  assert.deepEqual(result.headings, [{ depth: 2, slug: 'nested-heading', text: 'Nested heading' }]);
  assert.match(result.html, /href="\/target"/);
  const chunks = renderChunks(result.html, new Set(['Note', 'Card']), new Set(['Note', 'Card']));
  assert.equal(chunks[0].props.title, '日本語 & English');
  const nested = chunks[0].children.find(chunk => chunk.name === 'Card');
  assert.equal(nested.props.disabled, true);
  assert.match(nested.children[0].html, /&lt;Card \/&gt;/);
});

test('nested tags of the same name retain every child and fail on mismatched tags', () => {
  const chunks = renderChunks('<Note>outer<Note>inner</Note>end</Note>', new Set(['Note']), new Set(['Note']));
  assert.equal(chunks[0].children[1].children[0].html, 'inner');
  assert.equal(chunks[0].children[2].html, 'end');
  assert.throws(() => renderChunks('<Note><Card></Note>', new Set(['Note', 'Card']), new Set(['Note', 'Card'])), /mismatched/);
  assert.throws(() => renderChunks('<Note>lost', new Set(['Note']), new Set(['Note'])), /unclosed/);
});

test('existing literal island keys remain data while static self-closing components omit children', () => {
  const island = renderChunks('<Counter onboarding="intro" __proto__="data" />', new Set(['Counter']))[0];
  assert.equal(island.props.onboarding, 'intro'); assert.equal(island.props.__proto__, 'data');
  assert.equal(Object.getPrototypeOf(island.props), null);
  assert.equal(renderChunks('<Note />', new Set(['Note']), new Set(['Note']))[0].children, undefined);
});

test('authored raw-text HTML, comments and escaped fences never invoke components', async () => {
  const html = '<!-- <Note /> --><script>"<Note />"</script><SCRIPT>"<Note />"</SCRIPT><style>x{content:"<Note />"}</style><pre><Note /></pre><textarea><Note /></textarea>';
  assert.deepEqual(renderChunks(html, new Set(['Note']), new Set(['Note'])), [{ html }]);
  const code = await compileMarkdown(declarations + '```md\n:::component Note\n<Note />\n:::\n```');
  assert.ok(renderChunks(code.html, new Set(['Note']), new Set(['Note'])).every(chunk => 'html' in chunk));
});

for (const attributes of ['value={data}', '{...props}', 'onclick="alert(1)"', 'children="replace"', 'ref="x"', 'constructor="x"', '__proto__="x"', 'title="a" title="b"', 'items={[1,2]}']) {
  test('component props reject expressions and renderer-owned attributes: ' + attributes, () => {
    assert.throws(() => renderChunks(`<Note ${attributes} />`, new Set(['Note']), new Set(['Note'])), /literal|reserved/);
  });
}

for (const attributes of ['onClick="alert(1)"', 'onclick="alert(1)"', 'ONMOUSEOVER="x"', 'onPointerDown="x"', 'onanimationend="x"', 'onSomething="x"', 'children="replace"', 'key="x"', 'Ref="x"', 'dangerouslySetInnerHTML="x"']) {
  test('island props reject renderer-owned attributes and event handlers: ' + attributes, () => {
    assert.throws(() => renderChunks(`<Counter ${attributes} />`, new Set(['Counter'])), /reserved/);
  });
}

test('island props keep ordinary data names that merely start with "on"', () => {
  const [island] = renderChunks('<Counter onboarding="intro" online once="1" one="2" onion __proto__="data" constructor="c" />', new Set(['Counter']));
  assert.deepEqual(Object.keys(island.props), ['onboarding', 'online', 'once', 'one', 'onion', '__proto__', 'constructor']);
});

test('unknown/container-island names and malformed static imports fail clearly', async () => {
  await assert.rejects(compileMarkdown(declarations + ':::component Missing\nText\n:::'), /declared static/);
  await assert.rejects(compileMarkdown('<script>import Note from "../Note" with { island: "load" };</script>\n:::component Note\nText\n:::'), /declared static/);
  for (const statement of ['import { Note } from "./Note" with { component: "static" };', 'import Note from "./Note" with { component: "client" };', 'import Note from "./Note" with { component: "static", unknown: "x" };']) assert.throws(() => extractMarkdown(`<script>${statement}</script>`), /default component import/);
  assert.throws(() => renderChunks('<Note>body</Note>', new Set(['Note'])), /island tag children/);
});

test('static wrapper dependencies keep CSS and nested explicit islands without importing the wrapper in the client entry', async () => {
  const previous = process.cwd(); const root = await mkdtemp(join(tmpdir(), 'hono-markdown-static-'));
  try {
    await mkdir(join(root, 'pages'));
    await writeFile(join(root, 'pages/index.md'), declarations.replace('import Card from "../Card" with { component: "static" };', '') + ':::component Note\nBody\n:::');
    await writeFile(join(root, 'Note.tsx'), 'import "./style.css"; export default function Note({children}) {return <aside>{children}</aside>}');
    await writeFile(join(root, 'style.css'), '.static-wrapper {color:red}');
    process.chdir(root);
    const md = voidHonoMarkdown(); md.configResolved({ root, plugins: [{ name: 'void-hono:pages' }, md] });
    const islands = honoIslands(); islands.configResolved({ plugins: [md] }); await islands.buildStart();
    assert.equal(md.api.getClientScripts().size, 0);
    const client = islands.load.call({ environment: { mode: 'build' } }, islands.resolveId('virtual:void-islands-client'));
    assert.match(client, /style\.css/); assert.doesNotMatch(client, /Note\.tsx|initIslands/);
    const emitted = (await md.transform.handler(await (await import('node:fs/promises')).readFile(join(root, 'pages/index.md'), 'utf8'), join(root, 'pages/index.md'))).code;
    assert.match(emitted, /Note/); assert.doesNotMatch(emitted, /data-island|component: "static"/);
    const snapshot = md.api.getClientScripts();
    const filename = join(root, 'pages/index.md');
    const original = await (await import('node:fs/promises')).readFile(filename, 'utf8');
    await writeFile(filename, declarations + ':::component Missing\nBody\n:::');
    assert.throws(() => md.api.refresh(), /declared static/);
    assert.equal(md.api.getClientScripts(), snapshot, 'invalid component syntax cannot replace a complete scan snapshot');
    await writeFile(filename, original);
    await writeFile(join(root, 'Counter.tsx'), 'export default function Counter() { return <button>Count</button>; }');
    await writeFile(join(root, 'Note.tsx'), 'import Counter from "./Counter" with { island: "load" }; export default function Note({children}) {return <aside>{children}<Counter /></aside>}');
    await islands.buildStart();
    const interactive = islands.load.call({ environment: { mode: 'build' } }, islands.resolveId('virtual:void-islands-client'));
    assert.match(interactive, /Counter\.tsx/); assert.doesNotMatch(interactive, /Note\.tsx/);
  } finally { process.chdir(previous); await rm(root, { recursive: true, force: true }); }
});
