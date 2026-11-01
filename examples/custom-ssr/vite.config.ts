import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { honoJsxTransform } from '../../packages/void-plugin-hono-jsx/src/plugins/shared/jsx-transform.ts';

export default defineConfig({ plugins: [honoJsxTransform(), voidPlugin()] });
