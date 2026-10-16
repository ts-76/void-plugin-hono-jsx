import { fileURLToPath } from 'node:url';

// Source fixtures use TSX; npm consumers use the precompiled environment entries.
// Keep this adaptation in TypeScript so both emitted maps describe the actual code.
const compiled = new URL(import.meta.url).pathname.endsWith('.js');
export const pagesRuntimePath = fileURLToPath(new URL(compiled ? '../server/pages.js' : '../runtime/pages.tsx', import.meta.url));
export const clientRuntimePath = fileURLToPath(new URL(compiled ? '../browser/client.js' : '../runtime/client.tsx', import.meta.url));
export const markdownRuntimePath = fileURLToPath(new URL(compiled ? '../server/markdown.js' : '../runtime/markdown.ts', import.meta.url));
export const publicRuntimeModules: Record<string, { server: string; client: string }> = compiled ? {
  'void-plugin-hono-jsx/markdown': { server: markdownRuntimePath, client: fileURLToPath(new URL('../browser/markdown.js', import.meta.url)) },
  'void-plugin-hono-jsx/pages': { server: pagesRuntimePath, client: fileURLToPath(new URL('../browser/pages.js', import.meta.url)) },
  'void-plugin-hono-jsx/form': {
    server: fileURLToPath(new URL('../server/form.js', import.meta.url)),
    client: fileURLToPath(new URL('../browser/form.js', import.meta.url)),
  },
} : {};
