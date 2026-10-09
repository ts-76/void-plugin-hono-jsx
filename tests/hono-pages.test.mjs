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
    assert.match(client, /hono\/jsx\/dom/);
    assert.doesNotMatch(client, /index\.server/);
  });
});

for (const [name, files, error] of [
  ['client-only pages', { 'index.tsx': page, 'index.server.ts': 'export const ssr = false;' }, /only SSR/],
  ['island pages', { 'index.island.tsx': page }, /only SSR/],
  ['layouts', { 'index.tsx': page, 'layout.tsx': page }, /layouts are not supported/],
  ['actions', { 'index.tsx': page, 'index.server.ts': 'export const action = () => ({});' }, /actions are not supported/],
  ['explicit prerendering', { 'index.tsx': page, 'index.server.ts': 'export const prerender = true;' }, /prerendering is not supported/],
]) {
  test(`rejects unsupported ${name} after scanning real page files`, async () => {
    await withPages(files, async (plugin) => {
      await assert.rejects(() => plugin.buildStart(), error);
    });
  });
}
