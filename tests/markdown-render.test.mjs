// Run the shared package's rendering/security contract in the root suite as well.
import '../packages/hono-markdown/tests/render.test.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { voidHonoMarkdown } from '../packages/hono-pages/src/plugins/hono-markdown.ts';

test('Void forwards article display options and omits copy scripts for plain/custom code markup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hono-markdown-display-'));
  try {
    await mkdir(join(root, 'pages'));
    await symlink(new URL('../node_modules', import.meta.url), join(root, 'node_modules'), 'dir');
    const file = join(root, 'pages/index.md');
    const source = '# Title\n\nOne\nTwo\n\n<b>Text</b>\n\n```html\n<script>text</script>\n```';
    await writeFile(file, source);
    for (const [index, codeOptions] of [{ highlight: false }, { renderCodeBlock: ({ html }) => `<figure>${html}</figure>` }].entries()) {
      const plugin = voidHonoMarkdown({ ...codeOptions, html: false, breaks: true, headingId: ({ index }) => `post-section-${index + 1}` });
      plugin.configResolved({ root, plugins: [{ name: 'void-hono:pages' }] });
      assert.equal(plugin.api.getClientScripts().size, 0);
      const output = await plugin.transform.handler(source, file);
      const modulePath = join(root, `page-${index}.mjs`);
      await writeFile(modulePath, output.code);
      const page = await import(pathToFileURL(modulePath));
      const html = await page.default().toString();
      assert.match(html, /<h1 id="post-section-1">Title<\/h1>/);
      assert.match(html, /One<br>\nTwo/);
      assert.match(html, /&lt;b&gt;Text&lt;\/b&gt;/);
      assert.doesNotMatch(html, /<script>|class="copy"/);
      assert.equal(page.headings[0].slug, 'post-section-1');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
