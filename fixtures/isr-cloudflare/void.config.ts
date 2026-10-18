import { defineConfig } from 'void/config';
const deploying = process.argv.includes('deploy');
const remote = process.env.VOID_ISR_REMOTE === '1';
if (deploying && (!remote || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.VOID_ISR_WORKER || !/^[a-f0-9]{64}$/.test(process.env.VOID_ISR_DIGEST ?? ''))) {
  throw new Error('Pin the approved account, dedicated Worker and ephemeral control-key digest before deployment.');
}
export default defineConfig({
  worker: {
    compatibility_date: '2026-10-18', compatibility_flags: ['nodejs_compat'], limits: { cpu_ms: 10 },
    vars: { ISR_REVISION: process.env.VOID_ISR_REVISION ?? 'first', ISR_VERIFY_DIGEST: process.env.VOID_ISR_DIGEST ?? '' },
    observability: { enabled: true, head_sampling_rate: 1 },
  },
  cloudflare: { name: process.env.VOID_ISR_WORKER ?? 'void-hono-isr-local', account_id: process.env.CLOUDFLARE_ACCOUNT_ID, workers_dev: true, preview_urls: false,
    ...remote ? {} : { kv_namespaces: [{ binding: 'ISR_CACHE', id: '00000000000000000000000000000000' }] },
  },
  inference: { appType: 'void', bindings: { db: true, kv: false, storage: false, ai: false, email: false } },
  routing: { revalidate: { '/path': 4, '*': 60 }, revalidateQueryAllowlist: { '/query': ['kind'] } },
  head: { meta: [{ charset: 'UTF-8' }], link: [{ rel: 'icon', href: 'data:,' }] },
});
