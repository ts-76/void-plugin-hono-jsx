import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from '../../plugins/hono-pages.ts';

export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
