import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { voidHonoMarkdown } from '../packages/hono-pages/src/plugins/hono-markdown.ts';
import { honoIslands } from '../packages/hono-pages/src/plugins/hono-islands.ts';

function fixture() {
  const previous = process.cwd();
  const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'hono-markdown-snapshot-')));
  fs.mkdirSync(join(root, 'pages')); process.chdir(root);
  const md = voidHonoMarkdown();
  return { root, md, configure() { md.configResolved({ root, plugins: [{ name: 'void-hono:pages' }, md] }); }, cleanup() { process.chdir(previous); fs.rmSync(root, { recursive: true, force: true }); } };
}

test('100 Markdown pages share one graph snapshot and getters perform no repeated reads or walks', async () => {
  const f = fixture(); const read = fs.readFileSync; const walk = fs.readdirSync;
  try {
    for (let i = 0; i < 100; i++) fs.writeFileSync(join(f.root, `pages/p${i}.md`), '<script>window.script = true;</script>\n# Page');
    f.configure();
    const islands = honoIslands(); islands.configResolved({ plugins: [f.md] });
    let reads = 0, walks = 0;
    fs.readFileSync = function(file, ...args) { if (String(file).startsWith(f.root) && String(file).endsWith('.md')) reads++; return read.call(this, file, ...args); };
    fs.readdirSync = function(file, ...args) { if (String(file).startsWith(f.root)) walks++; return walk.call(this, file, ...args); };
    syncBuiltinESMExports();
    await islands.buildStart();
    const beforeGetters = reads;
    const snapshot = f.md.api.getClientScripts();
    assert.equal(snapshot.size, 100);
    for (let i = 0; i < 100; i++) { assert.equal(f.md.api.getClientScripts(), snapshot); f.md.api.getGraphSource(join(f.root, `pages/p${i}.md`)); }
    assert.equal(reads, beforeGetters, 'script and graph getters must not reread Markdown');
    islands.load(islands.resolveId('virtual:void-islands-renderer'));
    f.md.load(f.md.resolveId('virtual:void-hono-markdown-client'));
    assert.equal(reads, 300); assert.equal(walks, 1); // 1 snapshot + 2 upstream discovery/render passes.
  } finally { fs.readFileSync = read; fs.readdirSync = walk; syncBuiltinESMExports(); f.cleanup(); }
});

test('graph-first hot updates see script addition/removal, new pages and deleted pages across environments', async () => {
  const f = fixture();
  try {
    const file = join(f.root, 'pages/index.md'); fs.writeFileSync(file, '# Static'); f.configure();
    const islands = honoIslands(); islands.configResolved({ plugins: [f.md] }); await islands.buildStart();
    const environment = { config: { consumer: 'client' }, moduleGraph: { getModuleById() {} }, hot: { send() {} } };
    const update = async (target, type = 'update') => {
      const event = { file: target, type, modules: [], timestamp: Date.now() };
      // Vite calls the islands hook first; the graph must already see this edit.
      await islands.hotUpdate.call({ environment }, event);
      f.md.hotUpdate.call({ environment: { ...environment, config: { consumer: 'server' } } }, event);
    };
    fs.writeFileSync(file, '<script>window.active = true;</script>\n# Script'); await update(file);
    assert.equal(f.md.api.getClientScripts().size, 1);
    assert.match(islands.load(islands.resolveId('virtual:void-islands-renderer')), /const scriptOnly = new Set\(\["index"\]\)/);
    assert.match(f.md.load(file + '?hono-markdown-script'), /window.active/);
    const added = join(f.root, 'pages/new.md'); fs.writeFileSync(added, '<script>window.added = true;</script>\n# Added'); await update(added, 'create');
    assert.equal(f.md.api.getClientScripts().size, 2);
    fs.writeFileSync(file, '# Static again'); await update(file);
    assert.deepEqual([...f.md.api.getClientScripts().keys()], ['new']);
    assert.equal(f.md.load(file + '?hono-markdown-script'), 'export {};');
    fs.unlinkSync(added); await update(added, 'delete');
    assert.equal(f.md.api.getClientScripts().size, 0);
    assert.equal(f.md.load(f.md.resolveId('virtual:void-hono-markdown-client')), 'export {};');
  } finally { f.cleanup(); }
});

test('failed extraction keeps a complete old snapshot and recovers without leaking between projects', () => {
  const first = fixture(); let second;
  try {
    const file = join(first.root, 'pages/index.md'); fs.writeFileSync(file, '<script>window.first = true;</script>\n# First'); first.configure();
    const snapshot = first.md.api.getClientScripts();
    second = fixture(); fs.writeFileSync(join(second.root, 'pages/index.md'), '<script>window.second = true;</script>\n# Second'); second.configure();
    assert.match(second.md.api.getClientScripts().get('index'), /window.second/);
    fs.writeFileSync(file, '<script>import { Counter } from "./Counter" with { island: "load" };</script>\n# Bad');
    assert.throws(() => first.md.api.refresh(), /one default component import/);
    assert.equal(first.md.api.getClientScripts(), snapshot);
    fs.writeFileSync(file, '# Recovered'); first.md.api.refresh();
    assert.equal(first.md.api.getClientScripts().size, 0);
    assert.match(second.md.api.getClientScripts().get('index'), /window.second/);
  } finally { second?.cleanup(); first.cleanup(); }
});

test('fenced code adds only a page-local copy module and removing it restores a zero-script snapshot', () => {
  const f=fixture();
  try {
    const file=join(f.root,'pages/index.md'); fs.writeFileSync(file,'# Static'); f.configure();
    assert.equal(f.md.api.getClientScripts().size,0);
    fs.writeFileSync(file,'# Code\n\n```js\nconst value = 1\n```'); f.md.api.refresh();
    assert.match(f.md.api.getClientScripts().get('index'), /virtual:void-hono-markdown-copy/);
    fs.writeFileSync(file,'# Static with `inline code`'); f.md.api.refresh();
    assert.equal(f.md.api.getClientScripts().size,0);
  } finally { f.cleanup(); }
});

test('static layout CSS reaches production assets without adding a JS runtime or dev CSS injection', async () => {
  const f=fixture();
  try {
    fs.writeFileSync(join(f.root,'pages/index.island.tsx'),'export default function Page() { return <p>Static</p>; }');
    fs.writeFileSync(join(f.root,'pages/layout.island.tsx'), 'import "./layout.css"; export default function Layout({children}) { return <main>{children}</main>; }');
    fs.writeFileSync(join(f.root,'pages/layout.css'),'.scoped { color: red; }');
    f.configure();const islands=honoIslands();islands.configResolved({plugins:[f.md]});await islands.buildStart();
    const id=islands.resolveId('virtual:void-islands-client');
    const built=islands.load.call({environment:{mode:'build'}},id);
    assert.match(built,/import .*layout\.css/);assert.doesNotMatch(built,/initIslands|hono\/jsx/);
    assert.equal(islands.load.call({environment:{mode:'dev'}},id),'export {};');
    const renderer=islands.load(islands.resolveId('virtual:void-islands-renderer'));
    assert.match(renderer,/preloads: '', body: ''/);assert.doesNotMatch(renderer,/css: ''/);
  } finally { f.cleanup(); }
});
