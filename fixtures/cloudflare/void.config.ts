import { defineConfig } from 'void/config';
if (process.argv.includes('deploy') && (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.VOID_RC_WORKER)) throw new Error('Set the separately approved account and dedicated Worker name before deployment.');
export default defineConfig({
  worker: { compatibility_date: '2026-10-17', compatibility_flags: ['nodejs_compat'], limits: { cpu_ms: 10 }, vars: { RC_REVISION: process.env.VOID_RC_REVISION ?? 'first' } },
  cloudflare: { name: process.env.VOID_RC_WORKER ?? 'void-hono-rc-local', account_id: process.env.CLOUDFLARE_ACCOUNT_ID, workers_dev: true, preview_urls: true },
  inference: { appType: 'void', bindings: { db: true, kv: false, storage: false, ai: false, email: false } },
  routing: { isr: false },
  head: { meta: [{ charset: 'UTF-8' }], link: [{ rel: 'icon', href: 'data:,' }] },
});
