import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';
export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
