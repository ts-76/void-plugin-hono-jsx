import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { compileMarkdownModule } from '../packages/hono-markdown/dist/compiler/static-markdown.js';
import { selectClientFrontmatter } from '../packages/hono-markdown/dist/compiler/markdown-compiler.js';
import { voidHonoMarkdown } from '../packages/hono-pages/src/plugins/hono-markdown.ts';

const repo = resolve(import.meta.dirname, '..');
const source = '<script>import Probe from "./Probe.tsx" with { island: "load" };</script>\n---\ntitle: Public\ndraft_note: internal only\n---\n# Doc\n\n<Probe slot="a" />\n\n<Probe slot="b" />';
// The island prints the frontmatter it sees, so SSR output shows what hydration will receive.
const probe = "import { useContext } from 'hono/jsx'; import { MarkdownContext } from '@ts-76/hono-markdown'; export default function Probe({ slot }) { const { frontmatter, props } = useContext(MarkdownContext); return <output data-slot={slot} data-frontmatter={JSON.stringify(frontmatter)} data-props={JSON.stringify(props)} />; }";

async function workspace(run) {
  await mkdir(join(repo, '.runtime'), { recursive: true });
  const root = await mkdtemp(join(repo, '.runtime/client-frontmatter-'));
  try { await writeFile(join(root, 'Probe.tsx'), probe); return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function evaluate(root, code, entry = 'page.mjs') {
  await writeFile(join(root, entry), code);
  const out = join(root, 'bundle.mjs');
  await build({ entryPoints: [join(root, entry)], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', jsxImportSource: 'hono/jsx', logLevel: 'silent', absWorkingDir: root });
  return import(pathToFileURL(out).href + '?' + Date.now());
}
const islandFrontmatter = html => [...html.matchAll(/data-frontmatter="([^"]*)"/g)].map(match => JSON.parse(match[1].replaceAll('&quot;', '"')));

test('clientFrontmatter selects keys and validates its value', () => {
  const frontmatter = { title: 'T', draft: true };
  assert.equal(selectClientFrontmatter(frontmatter), frontmatter);
  assert.equal(selectClientFrontmatter(frontmatter, true), frontmatter);
  assert.deepEqual(selectClientFrontmatter(frontmatter, false), {});
  assert.deepEqual(selectClientFrontmatter(frontmatter, ['title', 'missing', 'toString']), { title: 'T' });
  for (const invalid of ['title', [1], {}]) assert.throws(() => selectClientFrontmatter(frontmatter, invalid), /clientFrontmatter/);
});

for (const [label, clientFrontmatter, expected] of [
  ['default exposes every key', undefined, { title: 'Public', draft_note: 'internal only' }],
  ['a key list limits browser frontmatter', ['title'], { title: 'Public' }],
  ['false exposes no frontmatter', false, {}],
]) test(`standalone modules serialize island context once: ${label}`, () => workspace(async root => {
  const result = await compileMarkdownModule(source, { sourcePath: join(root, 'doc.md'), options: { highlight: false, clientFrontmatter } });
  assert.deepEqual(result.frontmatter, { title: 'Public', draft_note: 'internal only' }, 'module metadata stays complete');
  const { default: Doc, frontmatter } = await evaluate(root, result.code);
  assert.deepEqual(frontmatter, result.frontmatter);
  const html = String(await Doc());
  assert.equal((html.match(/data-hono-md-context=/g) ?? []).length, 1);
  const context = JSON.parse(/data-hono-md-context="([^"]*)"/.exec(html)[1].replaceAll('&quot;', '"'));
  assert.deepEqual(context.frontmatter, expected);
  assert.deepEqual(islandFrontmatter(html), [expected, expected], 'SSR islands see the same frontmatter as hydration');
  assert.equal(html.includes('internal only'), expected.draft_note !== undefined);
}));

test('documents without islands do not serialize a browser context', () => workspace(async root => {
  const result = await compileMarkdownModule('---\ntitle: Static\n---\n# Doc', { sourcePath: join(root, 'doc.md') });
  assert.doesNotMatch(result.code, /data-hono-md-context/);
}));

test('Void Markdown pages expose clientFrontmatter and keep page props for SSR islands', () => workspace(async root => {
  await mkdir(join(root, 'pages'));
  const file = join(root, 'pages/doc.md');
  await writeFile(file, source.replaceAll('./Probe.tsx', '../Probe.tsx'));
  const md = voidHonoMarkdown({ highlight: false, clientFrontmatter: ['title'] });
  md.configResolved({ root, plugins: [{ name: 'void-hono:pages' }, md] });
  const { code } = await md.transform.handler(await readFile(file, 'utf8'), file);
  // Render with the bundle's own Hono and context instances, as the SSR page module does.
  const page = await evaluate(join(root, 'pages'), code + "\nexport { MarkdownContext as __Context } from '@ts-76/hono-markdown';\nexport { jsx as __jsx } from 'hono/jsx/jsx-runtime';", 'doc.mjs');
  assert.deepEqual(page.frontmatter, { title: 'Public', draft_note: 'internal only' });
  assert.deepEqual(page.clientFrontmatter, { title: 'Public' });
  const html = String(page.__jsx(page.__Context.Provider, { value: { frontmatter: page.frontmatter, headings: page.headings, props: { user: 'ada' } }, children: page.__jsx(page.default, {}) }));
  assert.deepEqual(islandFrontmatter(html), [{ title: 'Public' }, { title: 'Public' }]);
  assert.equal((html.match(/data-props="\{&quot;user&quot;:&quot;ada&quot;\}"/g) ?? []).length, 2, 'page props still reach SSR islands');
  assert.doesNotMatch(html, /internal only/);

  const unrestricted = voidHonoMarkdown({ highlight: false });
  unrestricted.configResolved({ root, plugins: [{ name: 'void-hono:pages' }, unrestricted] });
  const plain = (await unrestricted.transform.handler(await readFile(file, 'utf8'), file)).code;
  assert.match(plain, /export const clientFrontmatter = frontmatter;/);
  assert.doesNotMatch(plain, /__ClientMarkdown/);
}));
