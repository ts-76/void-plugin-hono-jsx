import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const repo = resolve(import.meta.dirname, '..');

// Test tools stay in the repository; the packed consumer installs only the common package and Hono.
export async function verifyMarkdownWorkerConsumer(root) {
  const require = createRequire(join(root, 'package.json'));
  for (const name of ['yaml', 'shiki', '@shikijs/transformers', 'void', 'vite', 'miniflare', 'esbuild']) {
    assert.throws(() => require.resolve(name), `${name} must not be installed in the article consumer`);
  }
  const workerEntry = '@ts-76/hono-markdown/render';
  const typeSource = `import { createMarkdownRenderer } from '${workerEntry}';
const renderer = createMarkdownRenderer({ breaks: true, headingId: ({ index }) => 'post-section-' + (index + 1) });
// @ts-expect-error The portable article entry excludes built-in highlighting.
createMarkdownRenderer({ highlight: true });
// @ts-expect-error Module options are excluded from article rendering.
createMarkdownRenderer({ clientFrontmatter: false });
// @ts-expect-error Shiki is application-owned for article rendering.
createMarkdownRenderer({ shiki: {} });
export default { async fetch(request: Request) { return new Response((await renderer.render(await request.text())).html); } };
`;

  const source = entry => `import { Hono } from 'hono';
import { createMarkdownRenderer, renderMarkdown } from '${entry}';
const renderer = createMarkdownRenderer({
  breaks: true,
  headingId: ({ index }) => 'post-section-' + (index + 1),
  renderCodeBlock: async ({ html }) => { await Promise.resolve(); return '<figure class="article-code">' + html + '</figure>'; },
});
const app = new Hono();
app.get('/environment', c => c.json({ process: typeof process, Buffer: typeof Buffer }));
app.post('/default', async c => c.json(await renderMarkdown(await c.req.text())));
app.post('/optional', async c => c.json(await renderMarkdown(await c.req.text())));
app.post('/trusted', async c => c.json(await renderMarkdown(await c.req.text(), { html: true })));
app.post('/cms/article', async c => {
  const response = await c.env.CMS.fetch('https://cms.invalid/article', { method: 'POST', body: await c.req.text() });
  const article = await response.json();
  return c.json(await renderer.render(article.body));
});
app.get('/highlight', c => {
  try { createMarkdownRenderer({ highlight: true }); return c.text('Unexpected support', 500); }
  catch (error) { return c.text(error.message, 400); }
});
export default app;
`;
  const attackCases = [
    '<script>globalThis.pwned=1</script>',
    '<img src=x onerror="globalThis.pwned=1">',
    '<svg onload="globalThis.pwned=1"><a href="javascript:alert(1)">click</a></svg>',
    '<iframe srcdoc="<script>parent.pwned=1</script>"></iframe>',
    '<math><mtext><img src=x onerror="globalThis.pwned=1"></mtext></math>',
    '::: tip <img src=x onerror="globalThis.pwned=1">\nText\n:::',
    '[bad](jav&#x61;script:alert%281%29)\n\n![bad](data:image/svg+xml;base64,PHN2Zz4=)',
    '<script>import Counter from "./missing" with { island: "load" };</script>\n\n<Counter />',
    '```html\n</code></pre><script>globalThis.pwned=1</script>\n```',
  ];
  const entries = [
    { entry: workerEntry, conditions: [] },
  ];
  for (const { entry, conditions } of entries) {
    await writeFile(join(root, 'worker-types.ts'), typeSource.replace(workerEntry, entry));
    await writeFile(join(root, 'tsconfig.worker.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', customConditions: conditions, strict: true, noEmit: true, types: [], lib: ['ES2022', 'WebWorker'] },
      files: ['worker-types.ts'],
    }));
    execFileSync(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.worker.json')], { encoding: 'utf8', stdio: 'pipe' });
    const bundle = await build({
      stdin: { contents: source(entry), sourcefile: 'cms-worker.mjs', resolveDir: root },
      absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', conditions,
      write: false, metafile: true, logLevel: 'silent',
    });
    assert.ok(Object.keys(bundle.metafile.inputs).some(path => path.endsWith('hono-markdown/dist/render/index.js')));
    const forbidden = Object.keys(bundle.metafile.inputs).filter(path => /(?:node:|\/dist\/compiler\/|\/node_modules\/(?:@babel\/|shiki\/|@shikijs\/|yaml\/|void\/|vite\/|void-plugin-hono-jsx\/))/.test('/' + path));
    assert.deepEqual(forbidden, [], 'The Worker graph must exclude Node/build-only dependencies');
    for (const output of Object.values(bundle.metafile.outputs)) assert.deepEqual(output.imports, [], 'The Worker must be self-contained');
    // Match the locked workerd release; disable Node compatibility explicitly (dates after August enable it by default).
    const runtime = { modules: true, compatibilityDate: '2026-10-12', compatibilityFlags: ['no_nodejs_compat', 'no_nodejs_compat_v2'] };
    const mf = new Miniflare({ ...convertV4MiniflareOptions({ cf: false, workers: [
      { ...runtime, name: 'article', script: bundle.outputFiles[0].text, serviceBindings: { CMS: 'cms' } },
      { ...runtime, name: 'cms', script: 'export default { async fetch(request) { return Response.json({body: await request.text()}); } };' },
    ] }), telemetry: { enabled: false } });
    const render = async (path, body) => {
      const response = await mf.dispatchFetch('https://article.invalid' + path, { method: 'POST', body });
      assert.equal(response.status, 200);
      return response.json();
    };
    try {
      assert.deepEqual(await (await mf.dispatchFetch('https://article.invalid/environment')).json(), { process: 'undefined', Buffer: 'undefined' });
      const article = await render('/cms/article', '# **CMS article**\n\nOne\nTwo\n\n```html\n<script>bad()</script>\n```');
      assert.deepEqual(article.headings, [{ depth: 1, slug: 'post-section-1', text: 'CMS article' }]);
      assert.match(article.html, /One<br>\nTwo/);
      assert.match(article.html, /<figure class="article-code"><pre><code/);
      assert.equal(article.needsCodeCopy, false);
      assert.equal(article.frontmatter, undefined);
      const results = await Promise.all(Array.from({ length: 12 }, (_, index) => render('/cms/article', `# Article ${index}\n\n[ref][url]\n\n[url]: /article-${index}\n\n\`\`\`txt\n${index}\n\`\`\``)));
      results.forEach((result, index) => {
        assert.deepEqual(result.headings, [{ depth: 1, slug: 'post-section-1', text: `Article ${index}` }]);
        assert.match(result.html, new RegExp(`href="/article-${index}"`));
      });
      const defaults = await render('/default', '# location\n\n# location\n\nhttps://example.com');
      assert.deepEqual(defaults.headings.map(heading => heading.slug), ['user-content-location', 'user-content-location-1']);
      assert.match(defaults.html, /href="https:\/\/example.com"/);
      const optional = await render('/optional', '```js\nconst answer = 42;\n```');
      assert.match(optional.html, /^<pre><code class="language-js">/);
      assert.equal(optional.needsCodeCopy, false);
      for (const input of attackCases) {
        const result = await render('/default', input);
        assert.doesNotMatch(result.html, /<(?:script|img|svg|iframe|math|Counter)\b/i);
        assert.doesNotMatch(result.html, /(?:href|src)="(?:javascript|vbscript|data):/i);
        assert.equal(result.clientCode, undefined);
        assert.equal(result.code, undefined);
      }
      assert.match((await render('/trusted', '<b>Trusted</b>')).html, /<b>Trusted<\/b>/);
      const unsupported = await mf.dispatchFetch('https://article.invalid/highlight');
      assert.equal(unsupported.status, 400);
      assert.match(await unsupported.text(), /not an article option.*renderCodeBlock/);
      console.log(JSON.stringify({ workerArticleConsumer: true, entry, conditions, nodeCompat: false, cmsServiceBinding: true, concurrentRequests: 12, attackCases: attackCases.length, workerTypesWithoutNode: true, forbiddenBundleInputs: forbidden, bundleBytes: bundle.outputFiles[0].contents.length }));
    } finally {
      await mf.dispose();
    }
  }
}
