import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';
export default defineConfig({plugins:[voidPlugin(),voidHonoJsx()]});
