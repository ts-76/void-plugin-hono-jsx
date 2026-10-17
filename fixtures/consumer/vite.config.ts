import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';
export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx({ navigationFallback: { component: './components/NavigationFallback.tsx', delay: 150 }, viewTransitions: true, prefetch: { hoverDelay: 20, cacheFor: ['5s', '10s'] } })] });
