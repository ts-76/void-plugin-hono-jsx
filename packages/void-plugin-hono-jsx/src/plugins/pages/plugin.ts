import { realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePath } from 'vite';
import {
  pagesRuntimePath,
  clientRuntimePath,
  markdownRuntimePath,
  ssrPagePath,
  publicRuntimeModules,
} from '../shared/runtime-paths.ts';
import {
  createPagesPlugin,
  generateComponentManifest,
  resolvePagesDir,
  resolvePrefetchConfig,
  type PagesPluginOptions,
  resolveStaticPageDataBuildOptions,
  type PageScanResult,
} from 'void/pages';
import type { Plugin } from 'vite';
import { parseCacheFor } from 'void/pages-prefetch';
import { honoJsxTransform } from '../shared/jsx-transform.ts';
import { honoIslands } from '../islands/plugin.ts';
import { markdownApi, markdownDiagnostic, type HonoMarkdownApi } from '../markdown/api.ts';
import { assertSupportedFrameworks } from '../shared/compatibility.ts';

const rendererId = 'virtual:void-pages-renderer';
const clientId = 'virtual:void-pages-client';

function assertComponentFile(file: string, kind: 'page' | 'layout', markdown = false) {
  if (/\.md$/.test(file)) {
    if (markdown && kind === 'page') return;
    if (markdown) throw new Error('Hono Markdown: layouts must remain TSX/JSX: ' + file);
    throw new Error(`${markdownDiagnostic} ${kind}: ${file}`);
  }
  if (!/\.[jt]sx$/.test(file))
    throw new Error(`Hono Pages: only standard TSX/JSX ${kind}s are supported: ${file}.`);
}

export type HonoJsxOptions = {
  viewTransitions?: boolean;
  /** A default-exported local TSX/JSX component; keeps the current page mounted. */
  navigationFallback?: { component: string; delay?: number };
  prefetch?: PagesPluginOptions['prefetch'];
};

function clientOptions(options: HonoJsxOptions) {
  const viewTransitions = options.viewTransitions ?? false;
  const {
    defaultStrategy: prefetchDefaultStrategy,
    hoverDelay: prefetchHoverDelay,
    cacheFor,
  } = resolvePrefetchConfig(options.prefetch);
  if (typeof viewTransitions !== 'boolean')
    throw new Error('Hono Pages: viewTransitions must be a boolean.');
  if (!Number.isFinite(prefetchHoverDelay) || prefetchHoverDelay < 0)
    throw new Error('Hono Pages: prefetch.hoverDelay must be a finite non-negative number.');
  const prefetchDefaultCacheFor = parseCacheFor(cacheFor);
  if (
    ![prefetchDefaultCacheFor.stale, prefetchDefaultCacheFor.expires].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    prefetchDefaultCacheFor.stale > prefetchDefaultCacheFor.expires
  ) {
    throw new Error(
      'Hono Pages: prefetch.cacheFor must have finite non-negative durations, with stale <= expires.',
    );
  }
  return { viewTransitions, prefetchHoverDelay, prefetchDefaultCacheFor, prefetchDefaultStrategy };
}

/** Compose Hono JSX transformation, Pages and islands using verified Void contracts. */
export function voidHonoJsx(options: HonoJsxOptions = {}): Plugin[] {
  const navigationOptions = clientOptions(options);
  const root = process.cwd();
  const fallback = options.navigationFallback;
  let fallbackPath: string | undefined;
  const fallbackDelay = fallback?.delay ?? 150;
  if (fallback !== undefined) {
    if (
      !fallback ||
      typeof fallback.component !== 'string' ||
      !fallback.component.trim() ||
      !/\.[jt]sx$/.test(fallback.component)
    )
      throw new Error('Hono Pages: navigationFallback.component must name a local TSX/JSX file.');
    if (!Number.isSafeInteger(fallbackDelay) || fallbackDelay < 0 || fallbackDelay > 2147483647)
      throw new Error(
        'Hono Pages: navigationFallback.delay must be an integer from 0 to 2147483647 milliseconds.',
      );
    fallbackPath = normalizePath(realpathSync(resolve(root, fallback.component)));
    if (!statSync(fallbackPath).isFile())
      throw new Error('Hono Pages: navigationFallback.component must be a file.');
  }
  const pagesDir = resolvePagesDir(root);
  const staticData = resolveStaticPageDataBuildOptions(root);
  let refreshScan: (() => Promise<PageScanResult | null>) | undefined;
  let markdown: HonoMarkdownApi | undefined;

  function validate(scan: PageScanResult) {
    for (const layout of [...scan.layouts, ...scan.namedLayouts]) {
      assertComponentFile(layout.filePath, 'layout');
    }
    for (const page of scan.pages) {
      assertComponentFile(page.componentPath, 'page', Boolean(markdown));
      if (
        staticData.enabled &&
        page.methods.some((method) => method === 'action' || method === 'actions')
      ) {
        throw new Error(
          `Hono Pages: actions require a server and cannot be used with static output: ${page.componentPath}.`,
        );
      }
    }
  }

  const lifecycle = createPagesPlugin(pagesDir, {
    name: 'void-hono:pages',
    root,
    config({ scan }) {
      refreshScan = scan;
    },
    generateRenderer(scan, isDev) {
      validate(scan);
      const rendererScan = isDev
        ? { ...scan, pages: scan.pages.filter((page) => page.renderMode !== 'client') }
        : scan;
      let manifest = generateComponentManifest(rendererScan, pagesDir);
      if (isDev) {
        // Keep page modules and their Hono providers in the same dev generation
        // during overlapping requests and reloads. Production retains lazy imports.
        const imports: string[] = [];
        manifest = manifest.replace(/\(\) => import\(("(?:[^"\\]|\\.)*")\)/g, (_, path: string) => {
          const name = `__honoPageSnapshot${imports.length}`;
          imports.push(`import * as ${name} from ${path};`);
          return `() => ${name}`;
        });
        manifest = imports.join('\n') + '\n' + manifest;
      }
      const scripts = [...(markdown?.getClientScripts().keys() ?? [])];
      return `
import { createHonoPageRenderer } from ${JSON.stringify(ssrPagePath)};
${manifest}
export const renderPage = createHonoPageRenderer({ components, layoutTree }, { staticData: ${staticData.enabled}, markdown: ${Boolean(markdown)}, markdownScripts: new Set(${JSON.stringify(scripts)}) });
`;
    },
    generateClient(scan, staticPageData) {
      validate(scan);
      if (!scan.pages.some((page) => !page.island)) return 'export {};';
      const manifest = generateComponentManifest(
        {
          ...scan,
          pages: scan.pages.filter((page) => !page.island),
          layouts: scan.layouts.filter((layout) => !layout.island),
          namedLayouts: scan.namedLayouts.filter((layout) => !layout.island),
        },
        pagesDir,
      );
      return `
import { startHonoPages } from ${JSON.stringify(clientRuntimePath)};
${fallbackPath ? `import __HonoNavigationFallback from ${JSON.stringify(fallbackPath)};` : ''}
${manifest}
await startHonoPages({ components, layoutTree, routeMeta, matchRoute, staticPageData: ${staticPageData.enabled}, staticPageDataFastPath: ${staticPageData.fastPath} }, { ...${JSON.stringify(navigationOptions)}${fallbackPath ? `, navigationFallback: { component: __HonoNavigationFallback, delay: ${fallbackDelay} }` : ''} });
`;
    },
  });
  const configHook = handler(lifecycle.config);
  const resolvedHook = handler(lifecycle.configResolved);
  const resolveHook = handler(lifecycle.resolveId);

  return [
    honoIslands(),
    honoJsxTransform(),
    {
      ...lifecycle,
      enforce: 'pre',
      config(config, env) {
        assertSupportedFrameworks({
          root: resolve(config.root ?? root),
          viteVersion: this.meta.viteVersion,
        });
        configHook?.call(this, config, env);
        return {
          resolve: { dedupe: ['hono'] },
          build: { manifest: true, rollupOptions: { input: { 'pages-client': clientId } } },
        };
      },
      configResolved: {
        order: 'pre',
        handler(config) {
          markdown = markdownApi(config.plugins);
          resolvedHook?.call(this, config);
        },
      },
      configEnvironment() {
        const modules = Object.keys(publicRuntimeModules);
        const packages = [...new Set(modules.map((id) => id.split('/')[0]))];
        return {
          optimizeDeps: { exclude: ['hono', ...modules] },
          resolve: { noExternal: ['hono', ...packages] },
        };
      },
      async hotUpdate({ file, type, modules, timestamp }) {
        if (!normalizePath(file).startsWith(normalizePath(pagesDir) + '/')) return;
        // Void watches additions/removals and Markdown. Source edits can also
        // change loader or layout exports, so refresh discovery for those edits.
        await refreshScan?.();
        if (type !== 'update') return [];
        const invalidated = new Set<(typeof modules)[number]>();
        for (const module of modules)
          this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
        for (const id of [rendererId, clientId]) {
          const module = this.environment.moduleGraph.getModuleById(`\0${id}`);
          if (module)
            this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
        }
        if (this.environment.config.consumer === 'client') {
          this.environment.hot.send({ type: 'full-reload' });
          return [];
        }
        // Vite must finish server invalidation before the worker reruns a request.
      },
      resolveId(id, importer, options) {
        if ([pagesRuntimePath, clientRuntimePath, markdownRuntimePath, ssrPagePath].includes(id))
          return { id: realpathSync(id), external: false };
        const runtime = publicRuntimeModules[id];
        if (runtime)
          return {
            id: realpathSync(
              this.environment.config.consumer === 'client' ? runtime.client : runtime.server,
            ),
            external: false,
          };
        if (id === rendererId || id === clientId)
          return resolveHook?.call(this, id, importer, options);
      },
    },
  ];
}

function handler<T>(hook: T | { handler: T } | undefined): T | undefined {
  return hook && typeof hook === 'object' && 'handler' in hook ? hook.handler : hook;
}
