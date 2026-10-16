import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';
export default defineConfig({ plugins: [voidPlugin(), voidHonoPages({ viewTransitions: true, prefetch: { hoverDelay: 20, cacheFor: ['5s', '10s'] } })] });
