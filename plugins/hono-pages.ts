import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateComponentManifest, resolvePagesDir, resolveStaticPageDataBuildOptions, scanPages, type PageScanResult } from 'void/pages';
import type { Plugin } from 'vite';
import { honoJsx } from './hono-jsx.ts';

const rendererId = 'virtual:void-pages-renderer';
const clientId = 'virtual:void-pages-client';

/** Experimental Pages contract verified against Void 0.26.0. */
export function voidHonoPages(): Plugin[] {
  const runtimeDir = fileURLToPath(new URL('../runtime/', import.meta.url));
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  let scan: PageScanResult | undefined;

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    for (const layout of [...scan.layouts, ...scan.namedLayouts]) {
      if (layout.island || !/\.[jt]sx$/.test(layout.filePath)) throw new Error('Hono Pages: only standard TSX/JSX layouts are supported.');
    }
    for (const page of scan.pages) {
      if (!/\.[jt]sx$/.test(page.componentPath) || page.renderMode === 'island') {
        throw new Error(`Hono Pages: only standard TSX/JSX pages are supported: ${page.componentPath}.`);
      }
      if (page.methods.some((method) => method !== 'loader')) {
        throw new Error(`Hono Pages: actions are not supported yet (issue #5): ${page.componentPath}.`);
      }
      if (page.prerender === true) {
        throw new Error('Hono Pages: prerendering is not supported yet (issue #10).');
      }
    }
    return scan;
  }

  return [honoJsx(), {
    name: 'void-hono:pages',
    config() {
      const require = createRequire(import.meta.url);
      const packagePath = join(dirname(require.resolve('void')), '..', 'package.json');
      const metadata: unknown = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (typeof metadata !== 'object' || metadata === null || !('version' in metadata) || typeof metadata.version !== 'string') {
        throw new Error('Hono Pages: the Void package version is missing.');
      }
      const { version } = metadata;
      if (version !== '0.26.0') {
        throw new Error(`Hono Pages: Void ${version} is unverified; this experimental adapter requires 0.26.0.`);
      }
      if (resolveStaticPageDataBuildOptions(root).enabled) {
        throw new Error('Hono Pages: static output is not supported yet (issue #10).');
      }
      return {
        resolve: { dedupe: ['hono'] },
        build: { manifest: true, rollupOptions: { input: { 'pages-client': clientId } } },
      };
    },
    async buildStart() {
      await rescan();
    },
    resolveId(id) {
      if (id === rendererId || id === clientId) return `\0${id}`;
    },
    async load(id) {
      if (id !== `\0${rendererId}` && id !== `\0${clientId}`) return;
      const currentScan = scan ?? await rescan();
      const manifest = generateComponentManifest(currentScan, pagesDir);
      if (id === `\0${rendererId}`) {
        return `
import { jsx } from 'hono/jsx';
import { createSsrRouter } from 'void/pages-client';
import { PageContext, RouterContext } from ${JSON.stringify(join(runtimeDir, 'pages.tsx'))};
import { serializePageData } from 'void/pages-server';
import { renderHeadToString, renderHtmlAttrs, renderBodyAttrs } from 'void/pages-head';
${manifest}
export async function renderPage(pageObj, assetTags) {
  if (pageObj.deferred?.length || pageObj.deferredKeys) {
    throw new Error('Hono Pages: deferred props are not supported yet (issue #9).');
  }
  const load = components[pageObj.component];
  if (!load) throw new Error('Hono Pages: unknown page component ' + pageObj.component);
  const { default: Page } = await load();
  if (typeof Page !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  let content = jsx(Page, pageObj.props);
  const ids = layoutTree[pageObj.component] ?? [];
  const layouts = await Promise.all(ids.map(async (id) => (await components[id]()).default));
  for (const Layout of layouts.reverse()) {
    if (typeof Layout !== 'function') throw new Error('Hono Pages: a layout must export a component function.');
    content = jsx(Layout, { children: content });
  }
  const markup = await jsx(RouterContext.Provider, { value: createSsrRouter(pageObj.url, pageObj.params), children: jsx(PageContext.Provider, { value: pageObj, children: content }) }).toString();
  const head = pageObj.head;
  return '<!doctype html><html' + (head ? renderHtmlAttrs(head) : '') + '><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">'
    + (head ? renderHeadToString(head) : '') + assetTags.css + assetTags.preloads
    + '</head><body' + (head ? renderBodyAttrs(head) : '') + '>'
    + '<script id="__VOID_PAGE_DATA__" type="application/json">' + serializePageData(pageObj) + '</script>'
    + '<div id="app">' + markup + '</div>' + assetTags.body + '</body></html>';
}
`;
      }
      return `
import { startHonoPages } from ${JSON.stringify(join(runtimeDir, 'client.tsx'))};
${manifest}
await startHonoPages({ components, layoutTree, routeMeta, matchRoute });
`;
    },
  }];
}
