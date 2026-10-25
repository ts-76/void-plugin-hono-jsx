import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownRenderer, renderMarkdown } from '@ts-76/hono-markdown/render';

test('the single portable article entry keeps the safe rendering contract', async () => {
  const source = '# **Article**\n\nOne\nTwo\n\n::: tip <img src=x onerror="bad()">\n[bad](javascript:alert%281%29)\n:::\n\n```html\n<script>bad()</script>\n```';
  const options = { breaks: true, headingId: ({ index }) => `post-section-${index + 1}`, renderCodeBlock: async ({ html }) => `<figure class="article-code">${html}</figure>` };
  const worker = await renderMarkdown(source, options);
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

test('removed Node-only and module options fail explicitly for JavaScript callers', async () => {
  for (const options of [{ highlight: true }, { highlight: false }, { highlight: undefined }, { shiki: {} }, { clientFrontmatter: false }]) {
    assert.throws(() => createMarkdownRenderer(options), /not an article option/);
    await assert.rejects(() => renderMarkdown('# Article', options), /not an article option/);
  }
});

test('article HTML opt-in remains explicit', async () => {
  assert.match((await renderMarkdown('<b>Trusted</b>')).html, /&lt;b&gt;Trusted/);
  assert.match((await renderMarkdown('<b>Trusted</b>', { html: true })).html, /<b>Trusted<\/b>/);
});
