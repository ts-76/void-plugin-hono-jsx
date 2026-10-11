import { defineConfig } from 'void/config';
export default defineConfig({
  cloudflare: { name: 'hono-pages-consumer-smoke' },
  head: { meta: [{ charset: 'UTF-8' }], link: [{ rel: 'icon', href: 'data:,' }] },
});
