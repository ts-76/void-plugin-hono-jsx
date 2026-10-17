import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { honoJsxTransform } from '../../packages/hono-pages/src/plugins/jsx-transform.ts';

export default defineConfig({ plugins: [honoJsxTransform(), voidPlugin()] });
