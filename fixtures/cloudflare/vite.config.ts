import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';
import { voidHonoMarkdown } from 'void-plugin-hono-jsx/markdown/plugin';
export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx(), voidHonoMarkdown()] });
