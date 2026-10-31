import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from '../../packages/void-plugin-hono-jsx/src/plugins/pages/plugin.ts';
import { voidHonoMarkdown } from '../../packages/void-plugin-hono-jsx/src/plugins/markdown/plugin.ts';

export default defineConfig({
  // Generated islands and this source example must share the Markdown context.
  resolve: {
    alias: {
      'void-plugin-hono-jsx/markdown': fileURLToPath(
        new URL(
          '../../packages/void-plugin-hono-jsx/src/runtime/markdown/context.ts',
          import.meta.url,
        ),
      ),
    },
  },
  plugins: [voidPlugin(), voidHonoJsx(), voidHonoMarkdown()],
});
