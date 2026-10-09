import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { voidHonoPages } from '../plugins/hono-pages.ts';

async function withPages(files, check) {
  const previous = process.cwd();
  const root = await mkdtemp(join(tmpdir(), 'hono-pages-contract-'));
  try {
    await mkdir(join(root, 'pages'));
    for (const [name, source] of Object.entries(files)) {
      await mkdir(join(root, 'pages', name, '..'), { recursive: true });
      await writeFile(join(root, 'pages', name), source);
    }
    process.chdir(root);
    const plugin = voidHonoPages().find((plugin) => plugin.name === 'void-hono:pages');
    await check(plugin);
  } finally {
    process.chdir(previous);
    await rm(root, { recursive: true, force: true });
  }
}

const page = 'export default function Page() { return <p>Example</p>; }';

test('Void discovers a loader-backed page and the adapter generates both entries', async () => {
  await withPages({
    'index.tsx': page,
    'index.server.ts': 'export const loader = () => ({ initialCount: 7 });',
  }, async (plugin) => {
    await plugin.buildStart();
    const rendererId = plugin.resolveId('virtual:void-pages-renderer');
    const clientId = plugin.resolveId('virtual:void-pages-client');
    const renderer = await plugin.load(rendererId);
    const client = await plugin.load(clientId);
    assert.match(renderer, /index\.tsx/);
    assert.match(renderer, /void\/pages-server/);
    assert.match(client, /startHonoPages/);
    assert.doesNotMatch(client, /index\.server/);
  });
});

for (const [name, files, error] of [
  ['island pages', { 'index.island.tsx': page }, /only standard TSX/],
  ['island layouts', { 'index.tsx': page, '_layouts/shell.island.tsx': page }, /only standard TSX\/JSX layouts/],
  ['actions', { 'index.tsx': page, 'index.server.ts': 'export const action = () => ({});' }, /actions are not supported/],
  ['explicit prerendering', { 'index.tsx': page, 'index.server.ts': 'export const prerender = true;' }, /prerendering is not supported/],
]) {
  test(`rejects unsupported ${name} after scanning real page files`, async () => {
    await withPages(files, async (plugin) => {
      await assert.rejects(() => plugin.buildStart(), error);
    });
  });
}

test('Void route conventions and a client-only page are accepted without a second router', async () => {
  await withPages({
    'about.tsx': page,
    'users/[id].tsx': page,
    'docs/[...slug].tsx': page,
    '(marketing)/contact.tsx': page,
    'browser.tsx': 'const browserOnly = window.navigator.userAgent; ' + page,
    'browser.server.ts': 'export const ssr = false; export const loader = () => ({ initialCount: 11 });',
  }, async (plugin) => {
    await plugin.buildStart();
    const client = await plugin.load(plugin.resolveId('virtual:void-pages-client'));
    assert.match(client, /users\/\[id\]\.tsx/);
    assert.match(client, /docs\/\[\.\.\.slug\]\.tsx/);
    assert.match(client, /browser\.tsx/);
    assert.doesNotMatch(client, /browser\.server/);
  });
});

 test('Void resolves default, named, exclusive and disabled layout chains', async () => {
  await withPages({
    'layout.tsx': page, 'nested/layout.tsx': page, '_layouts/shell.tsx': page,
    'nested/one.tsx': page,
    'nested/named.tsx': 'export const layout = "shell"; ' + page,
    'nested/exclusive.tsx': 'export const layout = "!shell"; ' + page,
    'nested/bare.tsx': 'export const layout = false; ' + page,
  }, async (plugin) => {
    await plugin.buildStart();
    const client = await plugin.load(plugin.resolveId('virtual:void-pages-client'));
    assert.match(client, /"nested\/one": \["layout","nested\/layout"\]/);
    assert.match(client, /"nested\/named": \["layout","_layouts\/shell"\]/);
    assert.match(client, /"nested\/exclusive": \["_layouts\/shell"\]/);
    assert.doesNotMatch(client, /"nested\/bare": \[/);
  });
});
