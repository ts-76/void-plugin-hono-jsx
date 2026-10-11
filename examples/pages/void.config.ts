import { defineConfig } from 'void/config';

export default defineConfig({
  cloudflare: { name: 'void-hono-pages-smoke' },
  head: {
    title: 'Project default', titleTemplate: '%s | Hono Pages',
    meta: [{ charset: 'UTF-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { name: 'description', content: 'Project description' }, { name: 'project-only', content: 'Project value' }],
    link: [{ rel: 'icon', href: 'data:,' }],
    script: [{ id: 'project-script', innerHTML: 'window.headExecutions=(window.headExecutions||0)+1;' }],
    htmlAttrs: { lang: 'en', 'data-level': 'project' },
    bodyAttrs: { 'data-level': 'project' },
  },
});
