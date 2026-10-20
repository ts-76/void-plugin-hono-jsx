import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveComponent } from '../dist/compiler/resolve-component.js';
import { extractMarkdown } from '../dist/compiler/markdown-compiler.js';

test('relative component resolution preserves extension priority and directory indexes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hono-markdown-resolution-'));
  try {
    await writeFile(join(root,'Button'),'asset');
    await writeFile(join(root,'Button.tsx'),'export default function Button(){}');
    await mkdir(join(root,'Panel'));await writeFile(join(root,'Panel/index.jsx'),'export default function Panel(){}');
    assert.equal(resolveComponent('./Button',root,['.tsx','.jsx']),join(root,'Button.tsx'));
    assert.equal(resolveComponent('./Button.tsx',root,['.tsx','.jsx']),join(root,'Button.tsx'));
    assert.equal(resolveComponent('./Panel',root,['.tsx','.jsx']),join(root,'Panel/index.jsx'));
    assert.equal(resolveComponent('./Missing',root,['.tsx','.jsx']),null);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('shared copy helper does not own a host virtual-module namespace', async () => {
  const module = await import('../dist/compiler/markdown-copy.js');
  assert.equal(module.markdownCopyId,undefined);
  assert.equal(typeof module.markdownCopyCode,'string');
});
test('script extraction retains static and island imports and ordinary page scripts', () => {
  const result=extractMarkdown('<script>import Counter from "./Counter" with { island: "visible" }; import Box from "./Box" with { component: "static" }; window.ready = true;</script>\n# Heading');
  assert.equal(result.imports[0].hydrate,'visible');assert.equal(result.staticImports[0].importName,'Box');
  assert.match(result.clientCode,/window.ready/);assert.doesNotMatch(result.clientCode,/import /);
});

test('the common distribution retains upstream Markdown and CSS attribution', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.ok(pkg.files.includes('THIRD_PARTY_NOTICES.md'));
  const notice = await readFile(new URL('../THIRD_PARTY_NOTICES.md',import.meta.url),'utf8');
  assert.match(notice,/Cloudflare, Inc/);assert.match(notice,/Yusuke Wada/);
});
