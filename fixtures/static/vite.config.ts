import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

// This fixture replaces the ordinary app, including its optional fallback file.
// Exercise the default plugin configuration rather than retaining that app's path.
export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx()] });
