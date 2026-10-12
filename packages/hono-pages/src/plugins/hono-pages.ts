import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePath } from 'vite';
import { pagesRuntimePath, clientRuntimePath, publicRuntimeModules } from './runtime-paths.ts';
import { generateComponentManifest, resolvePagesDir, resolveStaticPageDataBuildOptions, scanPages, type PageScanResult } from 'void/pages';
import type { Plugin } from 'vite';
import { honoJsx } from './hono-jsx.ts';
import { honoIslands } from './hono-islands.ts';
import { assertSupportedFrameworks } from './compatibility.ts';

const rendererId = 'virtual:void-pages-renderer';
const clientId = 'virtual:void-pages-client';

/** Experimental Pages contract verified against Void 0.26.1 and 0.27.0. */
export function voidHonoPages(): Plugin[] {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  const staticData = resolveStaticPageDataBuildOptions(root);
  let scan: PageScanResult | undefined;

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    for (const layout of [...scan.layouts, ...scan.namedLayouts]) {
      if (layout.island || !/\.[jt]sx$/.test(layout.filePath)) throw new Error('Hono Pages: only standard TSX/JSX layouts are supported.');
    }
    for (const page of scan.pages) {
      if (!/\.[jt]sx$/.test(page.componentPath)) {
        throw new Error(`Hono Pages: only standard TSX/JSX pages are supported: ${page.componentPath}.`);
      }
      if (staticData.enabled && page.methods.some((method) => method === 'action' || method === 'actions')) {
        throw new Error(`Hono Pages: actions require a server and cannot be used with static output: ${page.componentPath}.`);
      }
    }
    return scan;
  }

  return [honoIslands(), honoJsx(), {
    name: 'void-hono:pages',
    enforce: 'pre',
    config(config) {
      assertSupportedFrameworks({ root: resolve(config.root ?? root), viteVersion: this?.meta?.viteVersion });
      return {
        resolve: { dedupe: ['hono'] },
        build: { manifest: true, rollupOptions: { input: { 'pages-client': clientId } } },
      };
    },
    configEnvironment() {
      const modules = Object.keys(publicRuntimeModules);
      const packages = [...new Set(modules.map((id) => id.slice(0, id.lastIndexOf('/'))))];
      return { optimizeDeps: { exclude: ['hono', ...modules] }, resolve: { noExternal: ['hono', ...packages] } };
    },
    async buildStart() {
      await rescan();
    },
    configureServer(server) {
      const clear = (file: string) => {
        if (normalizePath(file).startsWith(normalizePath(pagesDir) + '/')) scan = undefined;
      };
      server.watcher.on('add', clear);
      server.watcher.on('unlink', clear);
      server.httpServer?.once('close', () => { server.watcher.off('add', clear); server.watcher.off('unlink', clear); });
    },
    async hotUpdate({ file, type, modules, timestamp }) {
      if (!normalizePath(file).startsWith(normalizePath(pagesDir) + '/')) return;
      await rescan();
      if (type !== 'update') return [];
      const invalidated = new Set<(typeof modules)[number]>();
      for (const module of modules) this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
      for (const id of [rendererId, clientId]) {
        const module = this.environment.moduleGraph.getModuleById(`\0${id}`);
        if (module) this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
      }
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    },
    resolveId(id) {
      if (id === rendererId || id === clientId) return `\0${id}`;
      if (id === pagesRuntimePath || id === clientRuntimePath) return { id: realpathSync(id), external: false };
      const runtime = publicRuntimeModules[id];
      if (runtime) return { id: realpathSync(this.environment.config.consumer === 'client' ? runtime.client : runtime.server), external: false };
    },
    async load(id) {
      if (id !== `\0${rendererId}` && id !== `\0${clientId}`) return;
      const currentScan = scan ?? await rescan();
      const serverSnapshot = id === `\0${rendererId}` && this.environment.mode === 'dev';
      const manifestScan = id === `\0${clientId}`
        ? { ...currentScan, pages: currentScan.pages.filter((page) => !page.island) }
        : serverSnapshot ? { ...currentScan, pages: currentScan.pages.filter((page) => page.renderMode !== 'client') } : currentScan;
      let manifest = generateComponentManifest(manifestScan, pagesDir);
      if (serverSnapshot) {
        // A request can retain the old renderer while the worker module runner
        // reloads. Capture components with its providers instead of importing
        // a new generation into an in-flight render. Browser-only pages remain
        // absent from this server graph; production keeps lazy imports.
        const imports: string[] = [];
        manifest = manifest.replace(/\(\) => import\(("(?:[^"\\]|\\.)*")\)/g, (_, path: string) => {
          const name = `__honoPageSnapshot${imports.length}`;
          imports.push(`import * as ${name} from ${path};`);
          return `() => ${name}`;
        });
        manifest = imports.join('\n') + '\n' + manifest;
      }
      if (id === `\0${clientId}` && !currentScan.pages.some((page) => !page.island)) return 'export {};';
      if (id === `\0${rendererId}`) {
        return `
import { jsx } from 'hono/jsx';
import { createSsrRouter } from 'void/pages-client';
import { PageContext, RouterContext } from ${JSON.stringify(pagesRuntimePath)};
import { serializePageData } from 'void/pages-server';
import { renderHeadToString, renderHtmlAttrs, renderBodyAttrs } from 'void/pages-head';
${manifest}
export async function renderPage(pageObj, assetTags) {
  if (${JSON.stringify(staticData.enabled)} && pageObj.deferredKeys) throw new Error('Hono Pages: deferred props cannot be statically prerendered; remove defer().');
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
  const body = pageObj.deferredKeys ? assetTags.body.replaceAll('<script type="module"', '<script async type="module"') : assetTags.body;
  return '<!doctype html><html' + (head ? renderHtmlAttrs(head) : '') + '><head>'
    + (head ? renderHeadToString(head) : '') + assetTags.css + assetTags.preloads
    + '</head><body' + (head ? renderBodyAttrs(head) : '') + '>'
    + '<script id="__VOID_PAGE_DATA__" type="application/json">' + serializePageData(pageObj) + '</script>'
    + '<div id="app">' + markup + '</div>' + body + '</body></html>';
}
`;
      }
      return `
import { startHonoPages } from ${JSON.stringify(clientRuntimePath)};
${manifest}
await startHonoPages({ components, layoutTree, routeMeta, matchRoute, staticPageData: ${JSON.stringify(staticData.enabled)}, staticPageDataFastPath: ${JSON.stringify(staticData.fastPath)} });
`;
    },
  }];
}
