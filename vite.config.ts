import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { honoJsx } from './plugins/hono-jsx.ts';

export default defineConfig({ plugins: [honoJsx(), voidPlugin()] });
