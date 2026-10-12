import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { voidHonoPages } from '../packages/hono-pages/src/plugins/hono-pages.ts';

async function withPages(files, check, options) {
  const previous = process.cwd();
  const root = await mkdtemp(join(tmpdir(), 'hono-pages-contract-'));
  try {
    await mkdir(join(root, 'pages'));
    for (const [name, source] of Object.entries(files)) {
      await mkdir(join(root, 'pages', name, '..'), { recursive: true });
      await writeFile(join(root, 'pages', name), source);
    }
    process.chdir(root);
    const plugin = voidHonoPages(options).find((plugin) => plugin.name === 'void-hono:pages');
    plugin.environment = { mode: 'build' };
    await check(plugin, voidHonoPages());
  } finally {
    process.chdir(previous);
    await rm(root, { recursive: true, force: true });
  }
}

const page = 'export default function Page() { return <p>Example</p>; }';

test('development SSR captures page/layout modules with providers and excludes browser-only components', async () => {
  await withPages({
    'index.tsx': page,
    'layout.tsx': 'export default function Layout({ children }) { return <main>{children}</main>; }',
    'browser.tsx': 'const browser = window.location; export default function Page() { return <p>{browser.pathname}</p>; }',
    'browser.server.ts': 'export const ssr = false;',
  }, async (plugin) => {
    await plugin.buildStart();
    const id = plugin.resolveId('virtual:void-pages-renderer');
    plugin.environment.mode = 'dev';
    const development = await plugin.load(id);
    assert.match(development, /import \* as __honoPageSnapshot\d+ from .*index\.tsx/);
    assert.match(development, /import \* as __honoPageSnapshot\d+ from .*layout\.tsx/);
    assert.doesNotMatch(development, /browser\.tsx|\(\) => import\(/);
    plugin.environment.mode = 'build';
    const production = await plugin.load(id);
    assert.match(production, /\(\) => import\(/);
    assert.doesNotMatch(production, /__honoPageSnapshot/);
  });
});

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
  ['mixed island layouts and full Pages', { 'index.tsx': page, 'layout.island.tsx': page }, /under an island layout/],
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

const filesForPolicy = (policy) => `import Counter from '../Counter' with { island: '${policy}' }; export default Counter;`;

for (const policy of ['idle', 'visible', 'media:(max-width: 600px)']) {
  test(`accepts supported island policy ${policy} during page discovery`, async () => {
    await withPages({
      'index.island.tsx': `import Counter from '../Counter' with { island: '${policy}' }; export default Counter;`,
      '../Counter.tsx': page,
    }, async (_plugin, plugins) => {
      const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands');
      await islands.buildStart();
      const source = filesForPolicy(policy);
      const transformed = islands.transform(source, join(process.cwd(), 'pages/index.island.tsx'));
      assert.ok(transformed.code.includes(JSON.stringify(policy)));
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
    assert.throws(() => islands.transform(component, join(process.cwd(), 'Counter.tsx')), /useForm.*full Pages/);
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

test('explicit prerender pages and declared dynamic paths remain in the Void manifest', async () => {
  await withPages({
    'index.tsx': page, 'index.server.ts': 'export const prerender = true;',
    'users/[id].tsx': page, 'users/[id].server.ts': 'export const prerender = true; export const getPrerenderPaths = () => [{ id: "alice" }];',
  }, async (plugin) => {
    await plugin.buildStart();
    const renderer = await plugin.load(plugin.resolveId('virtual:void-pages-renderer'));
    assert.match(renderer, /users\/\[id\]\.tsx/);
  });
});

for (const policy of ['unknown', 'media:', 'media:(min-width: 600px', 'media:bad;query']) {
  test('rejects invalid island policy ' + policy, async () => {
    await withPages({ 'index.island.tsx': filesForPolicy(policy), '../Counter.tsx': page }, async (_plugin, plugins) => {
      await assert.rejects(() => plugins.find((plugin) => plugin.name === 'void-hono:islands').buildStart(), /unsupported|invalid/);
    });
  });
}

test('island layouts and nested static component imports register one shared interactive module', async () => {
  await withPages({
    'layout.island.tsx': "import Wrapper from '../Wrapper'; export default Wrapper;",
    'index.island.tsx': page,
    '../Wrapper.tsx': "import Counter from './Counter' with { island: 'visible' }; export default Counter;",
    '../Counter.tsx': page,
    '_layouts/named.island.tsx': page,
  }, async (plugin, plugins) => {
    await plugin.buildStart();
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands');
    await islands.buildStart();
    const renderer = islands.load(islands.resolveId('virtual:void-islands-renderer'));
    assert.match(renderer, /new Set\(\["index"\]\)/);
    assert.match(islands.load(islands.resolveId('virtual:void-islands-client')), /Counter\.tsx/);
    const transformed = islands.transform("import Counter from './Counter' with { island: 'visible' }; export default Counter;", join(process.cwd(), 'Wrapper.tsx'));
    assert.match(transformed.code, /data-hydrate/);
  });
});

test('static import cycles propagate island requirements without duplicate registration', async () => {
  await withPages({
    'index.island.tsx': "import A from '../A'; export default A;",
    '../A.tsx': "import B from './B'; export default B;",
    '../B.tsx': "import A from './A'; import Counter from './Counter' with { island: 'load' }; void A; export default Counter;",
    '../Counter.tsx': page,
  }, async (_plugin, plugins) => {
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands'); await islands.buildStart();
    assert.match(islands.load(islands.resolveId('virtual:void-islands-renderer')), /new Set\(\["index"\]\)/);
    assert.equal([...islands.load(islands.resolveId('virtual:void-islands-client')).matchAll(/Counter\.tsx/g)].length, 2);
  });
});

test('an interactive component cannot introduce another independently scheduled island', async () => {
  await withPages({ 'index.island.tsx': "import Parent from '../Parent' with { island: 'load' }; export default Parent;", '../Parent.tsx': "import Counter from './Counter' with { island: 'visible' }; export default Counter;", '../Counter.tsx': page }, async (_plugin, plugins) => {
    await assert.rejects(() => plugins.find((plugin) => plugin.name === 'void-hono:islands').buildStart(), /inside an interactive component/);
  });
});

test('relative re-exports in static barrels retain the island client requirement', async () => {
  await withPages({ 'index.island.tsx': "import { Wrapper } from '../barrel'; export default Wrapper;", '../barrel.ts': "export { default as Wrapper } from './Wrapper';", '../Wrapper.tsx': "import Counter from './Counter' with { island: 'load' }; export default Counter;", '../Counter.tsx': page }, async (_plugin, plugins) => {
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands'); await islands.buildStart();
    assert.match(islands.load(islands.resolveId('virtual:void-islands-renderer')), /new Set\(\["index"\]\)/);
    assert.match(islands.load(islands.resolveId('virtual:void-islands-client')), /Counter\.tsx/);
  });
});

test('island components accept named provider-free form imports', async () => {
  const component = "import { useIslandForm, Form } from 'void-plugin-hono-jsx/form'; " + page;
  await withPages({ 'index.island.tsx': "import Counter from '../Counter' with { island: 'load' }; export default Counter;", '../Counter.tsx': component }, async (_plugin, plugins) => {
    const islands = plugins.find((plugin) => plugin.name === 'void-hono:islands'); await islands.buildStart();
    assert.doesNotThrow(() => islands.transform(component, join(process.cwd(), 'Counter.tsx')));
  });
});

test('navigation options retain defaults and serialize shared parsed cache durations', async () => {
  await withPages({ 'index.tsx': page }, async plugin => {
    const entry = await plugin.load(plugin.resolveId('virtual:void-pages-client'));
    assert.match(entry, /"viewTransitions":false/);
    assert.match(entry, /"prefetchHoverDelay":75/);
    assert.match(entry, /"stale":30000,"expires":30000/);
  });
  await withPages({ 'index.tsx': page }, async plugin => {
    const entry = await plugin.load(plugin.resolveId('virtual:void-pages-client'));
    assert.match(entry, /"viewTransitions":true/);
    assert.match(entry, /"prefetchHoverDelay":20/);
    assert.match(entry, /"stale":5000,"expires":10000/);
  }, { viewTransitions: true, prefetch: { hoverDelay: 20, cacheFor: ['5s', '10s'] } });
});
for (const options of [ { viewTransitions: 'yes' }, { prefetch: { hoverDelay: -1 } }, { prefetch: { hoverDelay: Infinity } }, { prefetch: { cacheFor: -1 } }, { prefetch: { cacheFor: ['10s', '5s'] } }, { prefetch: { cacheFor: 'bad' } } ]) {
  test('invalid navigation options fail before starting Vite: ' + JSON.stringify(options), () => assert.throws(() => voidHonoPages(options), /Hono Pages:|prefetch:/));
}

test('Markdown routes fail discovery with the upstream gate and exact file', async () => {
  await withPages({ 'guide.md': '# Guide' }, async plugin => {
    await assert.rejects(() => plugin.buildStart(), /@void\/md 0\.27\.0.*no public Hono compiler registration.*guide\.md/);
  });
});

test('optional Markdown configuration reports the Hono boundary before the closed framework dispatch', () => {
  const plugin = voidHonoPages().find(plugin => plugin.name === 'void-hono:pages');
  assert.equal(plugin.configResolved.order, 'pre');
  assert.throws(() => plugin.configResolved.handler({ plugins: [{ name: 'void-md' }] }), /Markdown rendering is blocked.*issue #56/);
  assert.doesNotThrow(() => plugin.configResolved.handler({ plugins: [{ name: 'void-core' }] }));
});

test('Markdown island discovery fails at the same gate before parsing Markdown as JavaScript', async () => {
  await withPages({ 'guide.island.md': '# Guide' }, async (_plugin, plugins) => {
    await assert.rejects(() => plugins.find(plugin => plugin.name === 'void-hono:islands').buildStart(), /@void\/md 0\.27\.0.*guide\.island\.md/);
  });
});
