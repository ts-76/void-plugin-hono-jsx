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
    await check(plugin, voidHonoPages());
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
  ['island layouts', { 'index.tsx': page, '_layouts/shell.island.tsx': page }, /only standard TSX\/JSX layouts/],
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

test('loader, action and named-action modules remain server-only in the component manifest', async () => {
  await withPages({
    'edit.tsx': page,
    'edit.server.ts': 'export const loader = () => ({ name: "Original" }); export const action = () => ({});',
    'named.tsx': page,
    'named.server.ts': 'export const actions = { save: () => ({}) };',
  }, async (plugin) => {
    await plugin.buildStart();
    const client = await plugin.load(plugin.resolveId('virtual:void-pages-client'));
    assert.match(client, /edit\.tsx/);
    assert.match(client, /named\.tsx/);
    assert.doesNotMatch(client, /edit\.server|named\.server/);
  });
});

for (const policy of ['idle', 'visible', 'media:(max-width: 600px)']) {
  test(`rejects unsupported island policy ${policy} during page discovery`, async () => {
    await withPages({
      'index.island.tsx': `import Counter from '../Counter' with { island: '${policy}' }; export default Counter;`,
      '../Counter.tsx': page,
    }, async (_plugin, plugins) => {
      const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands');
      await assert.rejects(() => islands.buildStart(), /unsupported policy.*use island: 'load'/);
    });
  });
}

test('island components reject form helpers with an explicit diagnostic', async () => {
  const component = "import { useForm } from 'void-plugin-hono-jsx/form'; " + page;
  await withPages({
    'index.island.tsx': "import Counter from '../Counter' with { island: 'load' }; export default Counter;",
    '../Counter.tsx': component,
  }, async (_plugin, plugins) => {
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands');
    await islands.buildStart();
    assert.throws(() => islands.transform(component, join(process.cwd(), 'Counter.tsx')), /form helpers are unsupported/);
  });
});

test('malformed island imports fail instead of silently rendering static components', async () => {
  await withPages({
    'index.island.tsx': "import { Counter } from '../Counter' with { island: 'load' }; " + page,
    '../Counter.tsx': page,
  }, async (_plugin, plugins) => {
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands');
    await assert.rejects(() => islands.buildStart(), /one default import with exactly one island/);
  });
});
