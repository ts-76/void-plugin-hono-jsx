import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from '../../packages/hono-pages/src/plugins/hono-pages.ts';

export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
