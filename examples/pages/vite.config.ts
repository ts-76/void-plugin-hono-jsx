import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from '../../packages/hono-pages/src/plugins/hono-jsx.ts';
import { voidHonoMarkdown } from '../../packages/hono-pages/src/plugins/hono-markdown.ts';

export default defineConfig({
  // Generated islands and this source example must share the Markdown context.
  resolve: { alias: { 'void-plugin-hono-jsx/markdown': fileURLToPath(new URL('../../packages/hono-pages/src/runtime/markdown.ts', import.meta.url)) } },
  plugins: [voidPlugin(), voidHonoJsx(), voidHonoMarkdown()],
});
