import { defineConfig } from 'void/config';
export default defineConfig({ output: 'static', cloudflare: { name: 'hono-pages-static-consumer' }, head: { meta: [{ charset: 'UTF-8' }], link: [{ rel: 'icon', href: 'data:,' }] } });
