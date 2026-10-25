import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown, createMarkdownRenderer } from '@ts-76/hono-markdown/render';
import { compileMarkdown } from '@ts-76/hono-markdown/parser';
import { compileMarkdownModule } from '@ts-76/hono-markdown/compiler';

test('article rendering escapes authored HTML, scripts, component tags and container titles by default', async () => {
  const source = '<script>not valid JavaScript {</script>\n\n<img src=x onerror="globalThis.pwned=1">\n\n<Counter onclick="bad()" />\n\n::: tip <img src=x onerror="bad()">\nText\n:::';
  const result = await renderMarkdown(source);
  assert.doesNotMatch(result.html, /<(?:script|img|Counter)\b/i);
  assert.match(result.html, /&lt;script&gt;not valid JavaScript/);
  assert.match(result.html, /&lt;img src=x/);
  assert.equal(result.clientCode, undefined);
  assert.equal(result.code, undefined);
  assert.deepEqual(result.headings, []);
});

test('article input is content, without module prelude, YAML metadata or component resolution', async () => {
  const result = await renderMarkdown('<script>import Secret from "/does-not-exist" with { component: "static" };</script>\n\n---\ntitle: Article\n---\n\n:::component Secret\n# Body\n:::\n\n<Secret />');
  assert.match(result.html, /&lt;script&gt;import Secret/);
  assert.match(result.html, /title: Article/);
  assert.match(result.html, /:::component Secret/);
  assert.match(result.html, /&lt;Secret \/&gt;/);
  assert.equal(result.frontmatter, undefined);
});

test('article URLs reject executable, encoded, data and unknown schemes in links and images', async () => {
  const dangerous = ['javascript:alert%281%29', 'JaVaScRiPt:alert%281%29', 'jav&#x61;script:alert%281%29', 'javascript&#58;alert%281%29', 'java&#x09;script:alert%281%29', 'java&#x0a;script:alert%281%29', 'vbscript:msgbox%281%29', 'file:///etc/passwd', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA', 'custom:command'];
  for (const url of dangerous) {
    const result = await renderMarkdown(`[link](${url})\n\n![image](${url})\n\n[reference][bad]\n\n[bad]: ${url}`);
    assert.doesNotMatch(result.html, /<(?:a|img)\b/, url);
  }
  const allowed = await renderMarkdown('[web](https://example.com) [mail](mailto:me@example.com) [phone](tel:123) [local](/guide) [fragment](#section)\n\n![image](./image.png)');
  assert.equal((allowed.html.match(/<a /g) ?? []).length, 5);
  assert.match(allowed.html, /<img src="\.\/image.png"/);
});

test('HTML opt-in is explicit and the existing trusted compiler keeps its authored module contract', async () => {
  assert.match((await renderMarkdown('<b>trusted</b>', { html: true })).html, /<b>trusted<\/b>/);
  const trusted = await compileMarkdown('<script>window.ready=true;</script>\n\n<div>Authored</div>');
  assert.equal(trusted.clientCode, 'window.ready=true;');
  assert.match(trusted.html, /<div>Authored<\/div>/);
  const escaped = await compileMarkdown('<b>Text</b>', { html: false });
  assert.match(escaped.html, /&lt;b&gt;Text&lt;\/b&gt;/);
});

test('breaks, linkify and sequential heading IDs are scoped per document and renderer', async () => {
  const renderer = createMarkdownRenderer({ breaks: true, linkify: false, headingId: ({ index }) => `post-section-${index + 1}` });
  const source = '# **Title**\n\nLine one\nLine two\n\n## 次の `見出し`\n\nhttps://example.com';
  const [a, b] = await Promise.all([renderer.render(source), renderer.render(source)]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.headings, [{ depth: 1, slug: 'post-section-1', text: 'Title' }, { depth: 2, slug: 'post-section-2', text: '次の 見出し' }]);
  assert.match(a.html, /Line one<br>\nLine two/);
  assert.doesNotMatch(a.html, /<a /);
  const defaults = await renderMarkdown('a\nb\n\nhttps://example.com\n\n# Title');
  assert.doesNotMatch(defaults.html, /<br>/);
  assert.match(defaults.html, /<a href="https:\/\/example.com"/);
  assert.equal(defaults.headings[0].slug, 'user-content-title');
});

test('heading IDs are unique, escaped, validated and avoid authored IDs', async () => {
  const result = await renderMarkdown('<span ID=repeat>Existing</span><span id="repeat&#45;1">Entity</span>\n\n# One\n\n## Two', { html: true, headingId: () => 'repeat' });
  assert.deepEqual(result.headings.map(h => h.slug), ['repeat-2', 'repeat-3']);
  const quoted = await renderMarkdown('# Safe', { headingId: () => 'x"onclick="bad' });
  assert.match(quoted.html, /id="x&quot;onclick=&quot;bad"/);
  for (const id of ['', 'two words', 'x\u0000', null, undefined, 1]) await assert.rejects(() => renderMarkdown('# Bad', { headingId: () => id }), /headingId/);
  const reserved = await renderMarkdown('# location\n\n# name');
  assert.deepEqual(reserved.headings.map(h => h.slug), ['user-content-location', 'user-content-name']);
});

test('plain code and custom code output preserve escaping without requiring Shiki initialization', async () => {
  const source = '```html\n<script>bad()</script>\n```\n\n    <img src=x onerror=bad()>\n';
  const options = {};
  const plain = await renderMarkdown(source, options);
  assert.match(plain.html, /<pre><code class="language-html">&lt;script&gt;/);
  assert.doesNotMatch(plain.html, /shiki|class="copy"|<script>|<img/);
  const seen = [];
  const custom = await renderMarkdown(source, { ...options, renderCodeBlock: async block => { seen.push(block); return `<figure class="article-code">${block.html}</figure>`; } });
  assert.equal((custom.html.match(/<figure /g) ?? []).length, 2);
  assert.equal(seen[0].language, 'html');
  assert.equal(seen[0].code, '<script>bad()</script>\n');
  assert.equal(seen[1].language, 'text');
  assert.doesNotMatch(custom.html, /<script>|<img/);
});

test('custom article highlighting belongs to the application without default copy UI', async () => {
  const result = await renderMarkdown('```js\nconst answer = 42\n```', { renderCodeBlock: async ({ code, language }) => {
    const { codeToHtml } = await import('shiki');
    return `<section class="article-code">${await codeToHtml(code, { lang: language, theme: 'github-light' })}</section>`;
  } });
  assert.match(result.html, /<section class="article-code"><pre class="shiki/);
  assert.doesNotMatch(result.html, /class="copy"|<div class="language/);
  assert.equal(result.needsCodeCopy, false);
});

test('plain article code needs no scripts, and module options omit unused copy code', async () => {
  const source = '```js\nconst answer = 42\n```';
  const article = await renderMarkdown(source);
  assert.match(article.html, /^<pre><code class="language-js">/);
  assert.equal(article.needsCodeCopy, false);
  const highlighted = await compileMarkdown(source);
  assert.match(highlighted.html, /class="copy"/);
  assert.equal(highlighted.needsCodeCopy, true);
  for (const options of [{ highlight: false }, { renderCodeBlock: ({ html }) => html }]) {
    const result = await compileMarkdownModule(source, { sourcePath: '/article.md', options });
    assert.equal(result.clientCode, '');
    assert.doesNotMatch(result.code, /class=\\"copy\\"/);
  }
});

test('a leading byte order mark does not hide the first heading or module frontmatter', async () => {
  const article = '# First\n\nBody';
  assert.deepEqual(await renderMarkdown('﻿' + article), await renderMarkdown(article));
  const module = '---\ntitle: Doc\n---\n\n# First';
  const withMark = await compileMarkdown('﻿' + module);
  assert.deepEqual(withMark.frontmatter, { title: 'Doc' });
  assert.deepEqual(withMark.headings, (await compileMarkdown(module)).headings);
  assert.match((await renderMarkdown('﻿﻿# Kept')).html, /﻿/, 'only one leading mark is removed');
});

test('heading slugs keep combining marks and leave other text unchanged', async () => {
  const { headings } = await renderMarkdown('# हिन्दी\n\n# ภาษาไทย\n\n# 日本語の見出し\n\n# Hello, World!\n\n# café');
  assert.deepEqual(headings.map(heading => heading.slug), ['user-content-हिन्दी', 'user-content-ภาษาไทย', 'user-content-日本語の見出し', 'user-content-hello-world', 'user-content-café']);
});
