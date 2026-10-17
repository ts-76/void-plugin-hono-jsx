import { realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePath } from 'vite';
import { pagesRuntimePath, clientRuntimePath, markdownRuntimePath, publicRuntimeModules } from './runtime-paths.ts';
import { generateComponentManifest, resolvePagesDir, resolveStaticPageDataBuildOptions, scanPages, type PageScanResult } from 'void/pages';
import type { Plugin } from 'vite';
import { parseCacheFor, type CacheForInput } from 'void/pages-prefetch';
import { honoJsxTransform } from './jsx-transform.ts';
import { honoIslands } from './hono-islands.ts';
import { markdownApi, markdownDiagnostic, type HonoMarkdownApi } from './markdown-api.ts';
import { assertSupportedFrameworks } from './compatibility.ts';

const rendererId = 'virtual:void-pages-renderer';
const clientId = 'virtual:void-pages-client';

function assertComponentFile(file: string, kind: 'page' | 'layout', markdown = false) {
  if (/\.md$/.test(file)) { if (markdown && kind === 'page') return; if (markdown) throw new Error('Hono Markdown: layouts must remain TSX/JSX: ' + file); throw new Error(`${markdownDiagnostic} ${kind}: ${file}`); }
  if (!/\.[jt]sx$/.test(file)) throw new Error(`Hono Pages: only standard TSX/JSX ${kind}s are supported: ${file}.`);
}


export type HonoJsxOptions = {
  viewTransitions?: boolean;
  /** A default-exported local TSX/JSX component; keeps the current page mounted. */
  navigationFallback?: { component: string; delay?: number };
  prefetch?: { hoverDelay?: number; cacheFor?: CacheForInput };
};

function clientOptions(options: HonoJsxOptions) {
  const viewTransitions = options.viewTransitions ?? false;
  const prefetchHoverDelay = options.prefetch?.hoverDelay ?? 75;
  if (typeof viewTransitions !== 'boolean') throw new Error('Hono Pages: viewTransitions must be a boolean.');
  if (!Number.isFinite(prefetchHoverDelay) || prefetchHoverDelay < 0) throw new Error('Hono Pages: prefetch.hoverDelay must be a finite non-negative number.');
  const prefetchDefaultCacheFor = parseCacheFor(options.prefetch?.cacheFor ?? '30s');
  if (![prefetchDefaultCacheFor.stale, prefetchDefaultCacheFor.expires].every(value => Number.isFinite(value) && value >= 0) || prefetchDefaultCacheFor.stale > prefetchDefaultCacheFor.expires) {
    throw new Error('Hono Pages: prefetch.cacheFor must have finite non-negative durations, with stale <= expires.');
  }
  return { viewTransitions, prefetchHoverDelay, prefetchDefaultCacheFor };
}

/** Compose Hono JSX transformation, Pages and islands using verified Void contracts. */
export function voidHonoJsx(options: HonoJsxOptions = {}): Plugin[] {
  const navigationOptions = clientOptions(options);
  const root = process.cwd();
  const fallback = options.navigationFallback;
  let fallbackPath: string | undefined;
  const fallbackDelay = fallback?.delay ?? 150;
  if (fallback !== undefined) {
    if (!fallback || typeof fallback.component !== 'string' || !fallback.component.trim() || !/\.[jt]sx$/.test(fallback.component)) throw new Error('Hono Pages: navigationFallback.component must name a local TSX/JSX file.');
    if (!Number.isSafeInteger(fallbackDelay) || fallbackDelay < 0 || fallbackDelay > 2147483647) throw new Error('Hono Pages: navigationFallback.delay must be an integer from 0 to 2147483647 milliseconds.');
    fallbackPath = normalizePath(realpathSync(resolve(root, fallback.component)));
    if (!statSync(fallbackPath).isFile()) throw new Error('Hono Pages: navigationFallback.component must be a file.');
  }
  const pagesDir = resolvePagesDir(root);
  const staticData = resolveStaticPageDataBuildOptions(root);
  let scan: PageScanResult | undefined;
  let markdown: HonoMarkdownApi | undefined;

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    for (const layout of [...scan.layouts, ...scan.namedLayouts]) {
      assertComponentFile(layout.filePath, 'layout');
    }
    for (const page of scan.pages) {
      assertComponentFile(page.componentPath, 'page', Boolean(markdown));
      if (staticData.enabled && page.methods.some((method) => method === 'action' || method === 'actions')) {
        throw new Error(`Hono Pages: actions require a server and cannot be used with static output: ${page.componentPath}.`);
      }
    }
    return scan;
  }

  return [honoIslands(), honoJsxTransform(), {
    name: 'void-hono:pages',
    enforce: 'pre',
    config(config) {
      assertSupportedFrameworks({ root: resolve(config.root ?? root), viteVersion: this?.meta?.viteVersion });
      return {
        resolve: { dedupe: ['hono'] },
        build: { manifest: true, rollupOptions: { input: { 'pages-client': clientId } } },
      };
    },
    configResolved: {
      order: 'pre',
      handler(config) {
        markdown = markdownApi(config.plugins);
      },
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
      if (id === pagesRuntimePath || id === clientRuntimePath || id === markdownRuntimePath) return { id: realpathSync(id), external: false };
      const runtime = publicRuntimeModules[id];
      if (runtime) return { id: realpathSync(this.environment.config.consumer === 'client' ? runtime.client : runtime.server), external: false };
    },
    async load(id) {
      if (id !== `\0${rendererId}` && id !== `\0${clientId}`) return;
      const currentScan = scan ?? await rescan();
      const serverSnapshot = id === `\0${rendererId}` && this.environment.mode === 'dev';
      const manifestScan = id === `\0${clientId}`
        ? { ...currentScan, pages: currentScan.pages.filter((page) => !page.island), layouts: currentScan.layouts.filter((layout) => !layout.island), namedLayouts: currentScan.namedLayouts.filter((layout) => !layout.island) }
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
        const markdownScriptIds = [...(markdown?.getClientScripts().keys() ?? [])];
        return `
import { jsx } from 'hono/jsx';
${markdown ? `import { MarkdownContext } from ${JSON.stringify(markdownRuntimePath)};` : ''}
const markdownScriptIds = new Set(${JSON.stringify(markdownScriptIds)});
import { createSsrRouter, idleNavigationState } from 'void/pages-client';
import { PageContext, RouterContext, NavigationContext } from ${JSON.stringify(pagesRuntimePath)};
import { serializePageData } from 'void/pages-server';
import { renderHeadToString, renderHtmlAttrs, renderBodyAttrs } from 'void/pages-head';
${manifest}
export async function renderPage(pageObj, assetTags) {
  if (${JSON.stringify(staticData.enabled)} && pageObj.deferredKeys) throw new Error('Hono Pages: deferred props cannot be statically prerendered; remove defer().');
  const load = components[pageObj.component];
  if (!load) throw new Error('Hono Pages: unknown page component ' + pageObj.component);
  const { default: Page, frontmatter = {}, headings = [] } = await load();
  if (typeof Page !== 'function') throw new Error('Hono Pages: a page must export a component function.');
  let content = jsx(Page, pageObj.props);
  const ids = layoutTree[pageObj.component] ?? [];
  const layouts = await Promise.all(ids.map(async (id) => (await components[id]()).default));
  for (const Layout of layouts.reverse()) {
    if (typeof Layout !== 'function') throw new Error('Hono Pages: a layout must export a component function.');
    content = jsx(Layout, { children: content });
  }
  ${markdown ? 'content = jsx(MarkdownContext.Provider, { value: { frontmatter, headings, props: pageObj.props }, children: content });' : ''}
  const markup = await jsx(RouterContext.Provider, { value: createSsrRouter(pageObj.url, pageObj.params), children: jsx(PageContext.Provider, { value: pageObj, children: jsx(NavigationContext.Provider, { value: idleNavigationState(), children: content }) }) }).toString();
  const appHtml = await jsx('div', { id: 'app', 'data-md-script': markdownScriptIds.has(pageObj.component) ? pageObj.component : undefined, ${markdown ? "'data-hono-markdown': JSON.stringify({ frontmatter, headings })," : ''} dangerouslySetInnerHTML: { __html: markup } }).toString();
  const head = pageObj.head;
  const body = pageObj.deferredKeys ? assetTags.body.replaceAll('<script type="module"', '<script async type="module"') : assetTags.body;
  return '<!doctype html><html' + (head ? renderHtmlAttrs(head) : '') + '><head>'
    + (head ? renderHeadToString(head) : '') + assetTags.css + assetTags.preloads
    + '</head><body' + (head ? renderBodyAttrs(head) : '') + '>'
    + '<script id="__VOID_PAGE_DATA__" type="application/json">' + serializePageData(pageObj) + '</script>'
    + appHtml + body + '</body></html>';
}
`;
      }
      return `
import { startHonoPages } from ${JSON.stringify(clientRuntimePath)};
${fallbackPath ? `import __HonoNavigationFallback from ${JSON.stringify(fallbackPath)};` : ''}
${manifest}
await startHonoPages({ components, layoutTree, routeMeta, matchRoute, staticPageData: ${JSON.stringify(staticData.enabled)}, staticPageDataFastPath: ${JSON.stringify(staticData.fastPath)} }, { ...${JSON.stringify(navigationOptions)}${fallbackPath ? `, navigationFallback: { component: __HonoNavigationFallback, delay: ${fallbackDelay} }` : ''} });
`;
    },
  }];
}
