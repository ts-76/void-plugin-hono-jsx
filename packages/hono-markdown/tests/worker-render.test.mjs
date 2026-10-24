import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown as renderNode } from '@ts-76/hono-markdown/render';
import { createMarkdownRenderer, renderMarkdown } from '@ts-76/hono-markdown/render/worker';

test('Worker and Node article entries keep the same safe rendering contract', async () => {
  const source = '# **Article**\n\nOne\nTwo\n\n::: tip <img src=x onerror="bad()">\n[bad](javascript:alert%281%29)\n:::\n\n```html\n<script>bad()</script>\n```';
  const options = { breaks: true, headingId: ({ index }) => `post-section-${index + 1}`, renderCodeBlock: async ({ html }) => `<figure class="article-code">${html}</figure>` };
  const worker = await renderMarkdown(source, options);
  assert.deepEqual(worker, await renderNode(source, options));
  assert.match(worker.html, /One<br>\nTwo/);
  assert.match(worker.html, /<figure class="article-code"><pre><code/);
  assert.doesNotMatch(worker.html, /<script>|<img|href="javascript:/);
  assert.equal(worker.needsCodeCopy, false);
});

test('Worker renderer resets heading IDs and references across concurrent asynchronous renders', async () => {
  const renderer = createMarkdownRenderer({ headingId: ({ index }) => `section-${index + 1}`, renderCodeBlock: async ({ html }) => { await Promise.resolve(); return html; } });
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) => renderer.render(`# Article ${index}\n\n[local][ref]\n\n[ref]: /article-${index}\n\n\`\`\`txt\n${index}\n\`\`\``)));
  results.forEach((result, index) => {
    assert.deepEqual(result.headings, [{ depth: 1, slug: 'section-1', text: `Article ${index}` }]);
    assert.match(result.html, new RegExp(`href="/article-${index}"`));
  });
});

test('Worker HTML opt-in remains explicit and built-in highlighting fails with actionable guidance', async () => {
  assert.match((await renderMarkdown('<b>Trusted</b>')).html, /&lt;b&gt;Trusted/);
  assert.match((await renderMarkdown('<b>Trusted</b>', { html: true })).html, /<b>Trusted<\/b>/);
  assert.throws(() => createMarkdownRenderer({ highlight: true }), /Node\/build-time only.*renderCodeBlock/);
  await assert.rejects(() => renderMarkdown('# Article', { highlight: true }), /Node\/build-time only/);
});
