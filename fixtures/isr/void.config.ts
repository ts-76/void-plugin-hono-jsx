import { defineConfig } from 'void/config';
export default defineConfig({
  cloudflare: {
    name: 'hono-pages-isr-local',
    kv_namespaces: [{ binding: 'ISR_CACHE', id: '00000000000000000000000000000000' }],
  },
  routing: { revalidate: 60 },
  head: { meta: [{ charset: 'UTF-8' }], link: [{ rel: 'icon', href: 'data:,' }] },
});
