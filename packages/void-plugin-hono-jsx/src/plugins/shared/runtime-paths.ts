import { fileURLToPath } from 'node:url';

// Source fixtures use TSX; npm consumers use the precompiled environment entries.
// Keep this adaptation in TypeScript so both emitted maps describe the actual code.
const compiled = new URL(import.meta.url).pathname.endsWith('.js');
export const pagesRuntimePath = fileURLToPath(
  new URL(compiled ? '../../server/pages/api.js' : '../../runtime/pages/api.tsx', import.meta.url),
);
export const clientRuntimePath = fileURLToPath(
  new URL(
    compiled ? '../../browser/pages/client.js' : '../../runtime/pages/client.tsx',
    import.meta.url,
  ),
);
export const markdownRuntimePath = fileURLToPath(
  new URL(
    compiled ? '../../server/markdown/context.js' : '../../runtime/markdown/context.ts',
    import.meta.url,
  ),
);
export const ssrPagePath = fileURLToPath(
  new URL(
    compiled ? '../../server/pages/ssr-page.js' : '../../runtime/pages/ssr-page.ts',
    import.meta.url,
  ),
);
export const islandPagePath = fileURLToPath(
  new URL(
    compiled ? '../../server/islands/page.js' : '../../runtime/islands/page.ts',
    import.meta.url,
  ),
);
export const islandClientPath = fileURLToPath(
  new URL(
    compiled ? '../../browser/islands/client.js' : '../../runtime/islands/client.ts',
    import.meta.url,
  ),
);
export const publicRuntimeModules: Record<string, { server: string; client: string }> = compiled
  ? {
      'void-plugin-hono-jsx/markdown': {
        server: markdownRuntimePath,
        client: fileURLToPath(new URL('../../browser/markdown/context.js', import.meta.url)),
      },
      'void-plugin-hono-jsx/pages': {
        server: pagesRuntimePath,
        client: fileURLToPath(new URL('../../browser/pages/api.js', import.meta.url)),
      },
      'void-plugin-hono-jsx/form': {
        server: fileURLToPath(new URL('../../server/pages/form.js', import.meta.url)),
        client: fileURLToPath(new URL('../../browser/pages/form.js', import.meta.url)),
      },
    }
  : {};
